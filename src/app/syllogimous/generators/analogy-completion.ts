/**
 * Analogy Completion — "A is to B as ? is to ?".
 *
 * Analogy states both pairs and asks whether they match. This states one and
 * asks which pair makes the match, which is not the same task wearing a
 * different sentence.
 *
 * Judging a stated match is elimination: take the claim one axis at a time and
 * stop at the first axis that disagrees. Half the false items in that mode are
 * settled by whichever axis the reader happens to check first, and the rest of
 * the relation is never derived at all. A completion cannot be answered that
 * way — the stem's relation has to be held in full before any candidate can be
 * measured against it, because a candidate that matches on the axis you looked
 * at first tells you nothing until you have looked at the others.
 *
 * ── Why a composed space rather than a borrowed item ──
 *
 * Analogy takes a finished question from one of five other modes and overwrites
 * its conclusion, so what it can build depends on what else is switched on, and
 * "the same relation" has to be defined five times over — once per layout, in
 * that layout's own terms. A composed space defines it once: the relation
 * between a pair is its displacement, one sign per axis, and two relations match
 * when every sign matches. That is checkable by comparing two strings, which is
 * what makes the answer a fact about the item rather than a claim about it.
 *
 * ── What makes an item well-formed ──
 *
 * Four distinct objects, as in Analogy: a candidate sharing an object with the
 * stem would be answerable by noticing the shared name. Both candidate pairs
 * have to be *derived* — `derivedPairs` drops any pair a premise states
 * outright, since matching two sentences is not matching two relations. And
 * exactly one of the two offered matches, by construction: the menu is two
 * long, so there is no room for a second right answer to hide in.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { own, PAIR_RELATION_WORDS, hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, NdLayout, axesForDimensions, buildNdLayout, derivedPairs,
    renderNdPattern, renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext, buildSeries, extendWithSeries, seriesWanted } from "./context";

/** A pair of objects and the relation between them, as `derivedPairs` gives it. */
type Pair = { a: string; b: string; key: string };

/**
 * How wide the space is.
 *
 * Every axis is another sign to carry from the stem to the candidates, and
 * unlike a premise it cannot be read off one sentence — it is accumulated along
 * the chain. Two is the floor because a one-axis relation has three values and
 * a decoy is then always the reverse, which is a different question. Five is
 * the ceiling: the sixth preset axis is Distinction, which has no direction to
 * carry, and a relation with a non-directional component in it stops being the
 * thing this mode is about.
 */
function axisCount(numOfPremises: number): number {
    return Math.max(2, Math.min(5, numOfPremises - 2));
}

/** On how many axes two relations disagree. */
function keyDistance(one: string, other: string): number {
    const a = one.split(",");
    const b = other.split(",");
    return a.reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);
}

/** Whether two pairs name four different objects. */
function disjoint(one: Pair, other: Pair): boolean {
    return one.a !== other.a && one.a !== other.b
        && one.b !== other.a && one.b !== other.b;
}

const pairText = (p: Pair) => `${subj(p.a)} ${own("pair-to")} ${subj(p.b)}`;

export function createAnalogyCompletion(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createAnalogyCompletion");

    const type = EnumQuestionType.AnalogyCompletion;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode's own ceiling, not the caller's idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));

    const nearMiss = ctx.hasRung(type, "near-miss");

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);
        const layout = buildNdLayout(words, axes);

        const drawn = drawItem(layout, nearMiss);
        if (!drawn) continue;

        const { stem, answer, decoy } = drawn;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(renderNdPremises(layout), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            stemLine(stem),
        ];

        const shown = shuffle([answer, decoy]);
        question.choices = shown.map(pairText);
        question.correctChoice = shown.indexOf(answer);
        question.answerMode = "choice";
        /*
         * Plain text, not markup: two of the three places the screen shows a
         * prompt interpolate it rather than binding innerHTML, so a prompt with
         * the stem marked up in it renders its own tags on those two. The stem
         * is a premise for that reason — premises are rendered as HTML
         * everywhere, and they are the half of the card minimal mode converts.
         */
        question.choicePrompt = "Which pair completes the analogy?";
        // Scored as "did they pick the right one", like every other choice item.
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "A pair completes it only if the relation runs the same way on "
            + "<b>every</b> axis — and in the same direction.",
        ];

        question.explanation = explainCompletion(layout, stem, answer, decoy);
        /*
         * Where everything was, for the panel that opens after a wrong answer.
         *
         * Safe to keep on the item because the map is drawn inside the review
         * block and nowhere else — during play it would hand over the whole
         * space, which is the one thing the reader is meant to accumulate. A
         * missed completion is nearly always a relation carried wrongly down
         * the chain, and the picture is what shows where it went.
         */
        question.wordCoordMap = { ...layout.coords };
        question.axisNames = axes.map(a => a.scale.name);

        /*
         * The same space, another stem.
         *
         * Reading the chain is the whole cost of the item and it is paid once:
         * every object's position is fixed by the premises, and a second
         * question about a different pair re-uses all of it. So the map stays
         * exactly as it is and only the stem line and the two candidates are
         * replaced — which is the half being asked about, and the same trade
         * Infer the Relation makes for the same reason.
         */
        if (seriesWanted(ctx)) {
            const mapLines = question.premises.slice(0, -1);
            const spent = new Set([stem.key]);

            extendWithSeries(question, buildSeries(() => {
                const next = drawItem(layout, nearMiss, spent);
                if (!next) return null;
                spent.add(next.stem.key);

                const options = shuffle([next.answer, next.decoy]);
                return {
                    /*
                     * Named rather than blank. The stem moves with the claim, so
                     * History has no conclusion line to show for it and would
                     * print the heading over nothing — while the pair being
                     * asked about appears only in the premises it swapped in.
                     */
                    text: stemLine(next.stem),
                    isValid: true,
                    /*
                     * This claim's own derivation. The item's explains the first
                     * stem — different objects and a different relation — so
                     * leaving it in place would close confidently on a pair the
                     * card no longer shows.
                     */
                    explanation: explainCompletion(layout, next.stem, next.answer, next.decoy),
                    premises: [...mapLines, stemLine(next.stem)],
                    choices: options.map(pairText),
                    correctChoice: options.indexOf(next.answer),
                    prompt: "Which pair completes the analogy?",
                    key: next.stem.key + "#" + next.stem.a + next.stem.b,
                };
            }));
        }

        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * A stem, the pair that completes it, and the one that does not.
 *
 * Drawn together because the three constrain each other: a stem with no
 * matching pair disjoint from it is not a stem, and on the `near-miss` rung a
 * stem whose spare relations all disagree on several axes has no decoy worth
 * offering. Trying them one at a time and backing out is the same search
 * written less clearly.
 */
function drawItem(
    layout: NdLayout,
    nearMiss: boolean,
    /** Relations already asked about, so a series does not repeat a question. */
    spent = new Set<string>(),
): { stem: Pair; answer: Pair; decoy: Pair } | null {
    const pairs = derivedPairs(layout);
    if (pairs.length < 3) return null;

    for (const stem of shuffle([...pairs])) {
        if (spent.has(stem.key)) continue;

        const matches = pairs.filter(p => p.key === stem.key && disjoint(p, stem));
        if (!matches.length) continue;

        /*
         * Decoys are drawn from the pairs disjoint from the stem, which lets
         * one be the answer's own reverse — the sharpest of them, and the
         * mistake this mode is built to catch. What they may not be is a second
         * right answer, so the key has to differ.
         */
        let decoys = pairs.filter(p => p.key !== stem.key && disjoint(p, stem));
        if (nearMiss) decoys = decoys.filter(p => keyDistance(p.key, stem.key) === 1);
        if (!decoys.length) continue;

        const answer = pickUniqueItems(matches, 1).picked[0];
        const decoy = pickUniqueItems(decoys, 1).picked[0];
        return { stem, answer, decoy };
    }

    return null;
}

/** "A to B is the same relation as ? to ?" — the question, said as a premise. */
function stemLine(stem: Pair): string {
    return `${pairText(stem)} ${rel(PAIR_RELATION_WORDS.same)} ${hi("?")} ${own("pair-to")} ${hi("?")}`;
}

/**
 * Why that pair and not the other.
 *
 * Written as the comparison it is: the stem's relation spelled out in full,
 * then each candidate against it. The closing line names only the pair that
 * completes the analogy — the stem is in the premises, not in what the item
 * asks, and a derivation that closes on an object the question never offers is
 * the failure `tests/derivation.test.ts` exists to catch.
 */
function explainCompletion(layout: NdLayout, stem: Pair, answer: Pair, decoy: Pair): string[] {
    const deltas = (key: string) => key.split(",").map(Number);
    const pattern = (key: string) => renderNdPattern(layout.axes, deltas(key));

    const stemDeltas = deltas(stem.key);
    const off = deltas(decoy.key)
        .map((v, i) => ({ v, i }))
        .filter(({ v, i }) => v !== stemDeltas[i])
        .map(({ i }) => layout.axes[i].scale.name);

    return [
        `${pairText(stem)}: ${pattern(stem.key)}`,
        `${pairText(decoy)}: ${pattern(decoy.key)} — differs on ${off.join(" and ")}`,
        `${pairText(answer)}: ${pattern(answer.key)}, which is the stem's relation on every axis`,
        `so ${pairText(answer)} completes it`,
    ];
}
