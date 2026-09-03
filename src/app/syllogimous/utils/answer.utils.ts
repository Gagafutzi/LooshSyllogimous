/**
 * Taking an answer, and judging one.
 *
 * Split out of `GameService.checkQuestion` for one reason: the thing that has
 * gone wrong here twice is not the arithmetic, it is the *pairing* — what the
 * card is asking and what the answer is compared against drifting apart. Both
 * faults were reported the same way, as a correct answer marked wrong, and
 * neither was visible to any test, because the rule lived inside a method that
 * also stops clocks, plays sounds and builds the next question.
 *
 * As two functions over a Question it can be walked: generate an item, answer
 * every claim the way the item says is right, and assert it comes out right.
 * That is `tests/answering.test.ts`, and it is the shape of the report.
 *
 * Pure apart from writing the answer onto the question it is given. No Angular,
 * no clock, no storage.
 */

import { Question } from "../models/question.models";

/** Whether this item has more claims to ask after the one on screen. */
export function hasNextClaim(q: Question): boolean {
    return q.series.length > 1 && q.seriesAt < q.series.length - 1;
}

/**
 * Record the claim on screen and put the next one up.
 *
 * Returns whether the claim just answered was right, for the flash. The clock
 * and the sound belong to the caller — this is only the swap.
 *
 * **Everything the card shows about the claim changes together.** The premises
 * above it and the options below it are as much a part of the question as the
 * sentence between them, so a claim that brings its own carries them here. What
 * a claim may *not* bring is a different way of answering: `answerMode` decides
 * which control is on screen and is fixed for the item, which is why
 * `tests/answering.test.ts` holds every claim of a series to the item's own
 * mode.
 */
export function takeSeriesAnswer(q: Question, value: boolean): boolean {
    const right = value === q.series[q.seriesAt].isValid;
    q.seriesAnswers[q.seriesAt] = right;

    q.seriesAt++;
    const before = q.premises;
    const next = q.series[q.seriesAt];
    q.conclusion = next.text;
    q.isValid = next.isValid;
    // A picking claim brings its own options and prompt with it; the premises
    // above them do not move, which is the whole point.
    if (next.choices) {
        q.choices = [...next.choices];
        q.correctChoice = next.correctChoice ?? -1;
        q.choicePrompt = next.prompt ?? q.choicePrompt;
        q.userChoice = -1;
    }
    // A claim that brought its own derivation is a claim the item's own would
    // have described wrongly.
    if (next.explanation) q.explanation = [...next.explanation];
    /*
     * Where the claim replaces the premises, the part being asked about is what
     * changed and the part that cost the reading did not — a map's examples, a
     * space's relations. Everything else keeps every premise it had.
     */
    if (next.premises) q.premises = [...next.premises];

    /*
     * Where the new question is, so the carousel can go there.
     *
     * The first premise that differs is the head of the part this claim
     * replaced — the operator lines, the chain being mapped — and everything
     * above it is the reading already paid for. A claim that changed no premise
     * asks its question in the conclusion or the options instead, which is what
     * -1 means.
     */
    q.seriesFocusPremise = next.premises
        ? q.premises.findIndex((p, i) => p !== before[i])
        : -1;

    return right;
}

/**
 * The verdict on the whole item, recording the last claim on the way.
 *
 * The verdict and the score are about the *set* — getting two of three is not
 * getting the item — while the ability model is handed the claims separately by
 * the caller, because "answered one of two" and "answered neither" are
 * different evidence about a player and identical to an AND.
 *
 * `value` is undefined on a timeout, which is wrong by definition: nothing was
 * answered.
 */
export function judgeItem(q: Question, value?: boolean): boolean {
    if (q.series.length) {
        q.seriesAnswers[q.seriesAt] =
            value != null && value === q.series[q.seriesAt].isValid;
        return q.series.every((_, i) => q.seriesAnswers[i] === true);
    }
    return value != null && value === q.isValid;
}

/**
 * How each conclusion of an item went.
 *
 * Reported from play: *"even a correct conclusion was shown as incorrect after
 * a previous incorrect answer"*. Every conclusion is counted on its own -- the
 * ability model takes each as its own piece of evidence, which is what
 * `perClaimCredit` means -- and the screens were the only part that still
 * collapsed an item to one true-or-false.
 *
 * Two different collapses, both wrong:
 *
 *   `judgeItem`             every conclusion or nothing. Right for the tier
 *                           score, which is about clearing the item; wrong as
 *                           the word shown after the last conclusion, where it
 *                           reads as a verdict on the one just answered.
 *   `userAnswer === isValid` the *last* conclusion, because `takeSeriesAnswer`
 *                           moves `isValid` onto each claim as the card
 *                           advances. Seven display sites used this, so a slip
 *                           on the first of three drew the whole card green if
 *                           the third went well and red if it did not -- in
 *                           both cases reporting one conclusion as the item.
 *
 * A tally is what both were approximating. Anything displaying an answered item
 * counts conclusions from here rather than deriving its own.
 *
 * Reads stored history as well as live questions, where the values are plain
 * JSON and the arrays may predate the fields -- hence the guards.
 */
export interface ItemTally {
    /** Conclusions the item asked. One, for the modes that ask one. */
    asked: number;
    /** How many were answered the way the item asks. */
    right: number;
    /**
     * The clock ran out before the item was finished.
     *
     * Kept apart from the tally rather than zeroing it: conclusions answered
     * before the clock stopped were answered, and were counted.
     */
    timedOut: boolean;
}

/**
 * Just enough of an answered item to count its conclusions.
 *
 * Structural rather than `Question`, so the session summary -- which keeps a
 * lighter record -- counts with the same function instead of a ninth copy of
 * the rule.
 */
export interface AnsweredView {
    userAnswer?: boolean;
    isValid?: boolean;
    series?: unknown[];
    seriesAnswers?: (boolean | undefined)[];
}

export function itemTally(q: AnsweredView): ItemTally {
    const timedOut = q.userAnswer === undefined;
    const series = q.series ?? [];
    if (series.length) {
        const answers = q.seriesAnswers ?? [];
        return {
            asked: series.length,
            right: series.reduce<number>((n, _, i) => n + (answers[i] === true ? 1 : 0), 0),
            timedOut,
        };
    }
    return {
        asked: 1,
        right: !timedOut && q.userAnswer === q.isValid ? 1 : 0,
        timedOut,
    };
}

/** Every conclusion the item asked, answered right. */
export function itemWasRight(q: AnsweredView): boolean {
    const { asked, right, timedOut } = itemTally(q);
    return !timedOut && right === asked;
}

/**
 * The share of an item's conclusions that were right.
 *
 * What an accuracy figure should average, now that a three-conclusion item is
 * three answers. Averaging `itemWasRight` instead would score two-of-three the
 * same as none-of-three.
 */
export function itemCredit(q: AnsweredView): number {
    const { asked, right } = itemTally(q);
    return asked ? right / asked : 0;
}
