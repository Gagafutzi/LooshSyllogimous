/**
 * Delay line — read an arrangement now, judge it several screens later.
 *
 * Every other mode in the app hands you the premises and the conclusion
 * together: the reasoning is hard, the *holding* is free. The stream took the
 * other extreme — premises arrive one at a time and expire, so what is held is
 * a handful of live relations. Neither asks you to keep a **whole finished
 * arrangement** intact while building another one on top of it.
 *
 * That is what this is. Screen `i` shows arrangement `i` and asks about
 * arrangement `i - delay`, so at any moment you are encoding one structure and
 * retrieving a different one — and the two are the same kind of thing, made of
 * the same objects and relations, which is what makes them interfere. It is
 * n-back where the item held is a relational model rather than a letter.
 *
 * **The shape of a run, and why it has the edges it does.**
 *
 * With `rounds` conclusions at a delay of `n` there are `rounds + n` screens.
 * The first `n` show an arrangement and ask nothing — there is nothing old
 * enough to ask about yet — and the last `n` ask without showing anything new,
 * because the pipeline has to drain. Those held screens are why `holdOnly`
 * exists: the alternative is to front-load the first `n` arrangements onto one
 * card, which measures span on a long list and is the thing this mode is not.
 *
 * **Composition, not generation.** The arrangements are whole ordinary
 * questions built by the ordinary generators, so every mode's own difficulty,
 * rungs and phrasing come along unchanged and this file cannot drift from them.
 * All it does is decide which screen shows what.
 */

import { Question, SeriesClaim } from "../models/question.models";
import { EnumQuestionType } from "../constants/question.constants";

/** Modes a delay line can be built from: those judged true or false. */
export const DELAY_TYPES: EnumQuestionType[] = [
    EnumQuestionType.Distinction,
    EnumQuestionType.ComparisonNumerical,
    EnumQuestionType.ComparisonChronological,
    EnumQuestionType.LinearVertical,
    EnumQuestionType.LinearHorizontal,
    EnumQuestionType.LinearContains,
    EnumQuestionType.Syllogism,
    EnumQuestionType.Direction,
    EnumQuestionType.Direction3DSpatial,
    EnumQuestionType.Direction3DTemporal,
];

export const DEFAULT_DELAY = 2;
export const DEFAULT_DELAY_ROUNDS = 8;

/** How a held screen is labelled, so the card says what it is asking for. */
export const HOLD_TEXT = "Hold this arrangement. You will be asked about it later.";

/**
 * Compose finished questions into one delay-line item.
 *
 * `sets` must hold `rounds + delay` arrangements; the first `rounds` of them
 * are the ones that get shown, and the first `rounds` are also the ones asked
 * about — the tail exists only because the last screens have no new set.
 */
export function composeDelayLine(sets: Question[], delay: number): Question {
    const n = Math.max(1, Math.floor(delay));
    const rounds = Math.max(1, sets.length - n);
    const q = new Question(sets[0].type);

    const series: SeriesClaim[] = [];
    for (let i = 0; i < rounds + n; i++) {
        const shown = i < rounds ? sets[i] : null;
        const asked = i >= n ? sets[i - n] : null;

        if (!asked) {
            series.push({
                text: HOLD_TEXT,
                isValid: true,
                holdOnly: true,
                premises: shown ? [...shown.premises] : [],
            });
            continue;
        }

        series.push({
            text: asked.conclusion as string,
            isValid: asked.isValid,
            /*
             * The arrangement's own derivation, so the review after a miss
             * explains the set that was asked about rather than the one that
             * happened to be on screen when the answer was given.
             */
            explanation: asked.explanation?.length ? [...asked.explanation] : undefined,
            /*
             * Only the new arrangement is shown. Re-displaying the one being
             * asked about would remove the entire demand while looking
             * identical, which is the same trap the stream documents.
             */
            premises: shown ? [...shown.premises] : [],
        });
    }

    q.series = series;
    q.seriesAnswers = [];
    q.seriesAt = 0;
    q.premises = [...series[0].premises!];
    q.conclusion = series[0].text;
    q.isValid = series[0].isValid;
    q.answerMode = "boolean";
    /*
     * Unscored, like the stream and for the same reason: the ability model
     * prices an item by its premise count and rungs, and a delay line's
     * difficulty is mostly the delay — a quantity it has no coefficient for.
     * Feeding it in would move the estimate on evidence it cannot read.
     */
    q.playgroundMode = true;
    return q;
}
