/**
 * Infer the relation — P9.
 *
 * Every other mode tells you what the relation is and asks where something
 * sits. This one shows the space in full, then makes a handful of claims with
 * an operator whose meaning is withheld, and asks what the operator *is*.
 *
 * That inverts the task. Deriving a relation is composition; identifying one is
 * induction — you hold each candidate against the evidence and eliminate. It is
 * the cheapest induction mode the roadmap lists because it needs no new
 * machinery at all: the layout is an ordinary composed space, the candidates are
 * the axes it was built from, and an answer is checked by comparing integers.
 *
 * ── What makes an item well-formed ──
 *
 * Exactly one axis may be consistent with every ⊕ claim. An item where two axes
 * both fit has no answer, and generating one would be worse than generating
 * nothing — so uniqueness is checked by construction and the draw is retried
 * until it holds. This is the whole difficulty knob: more axes mean more
 * candidates to eliminate, and fewer claims mean less to eliminate them with.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { scrambleByFactor } from "../utils/premise-order.utils";
import {
    AxisSpec, axesForDimensions, buildNdLayout, compareOn, isCircular, ndAxisColors,
    renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext, buildSeries, extendWithSeries, seriesWanted } from "./context";

/** The stand-in for the relation being identified. */
const OPERATOR = "⊕";

/**
 * A symbol per question, not one reused.
 *
 * The setup says the operator means one relation "every time", which is true
 * within a question and would be a lie across a series of them — a reader
 * carrying ⊕ over from the last claim would be answering the wrong question
 * with the right method.
 */
const OPERATORS = ["⊕", "⊗", "⊙", "⊘", "⊛"];

/**
 * How many axes an item offers as candidates.
 *
 * Three is the floor: with two, eliminating one identifies the other, and the
 * item is a coin flip dressed as induction. Six is the ceiling the composed
 * spaces already use.
 */
function candidateCount(numOfPremises: number): number {
    return Math.max(3, Math.min(6, numOfPremises - 1));
}

/**
 * Axes an operator claim could be about.
 *
 * Circular axes are excluded, and not for convenience: on a ring nothing is
 * greater than anything else, so "A ⊕ B" has no truth value to be consistent
 * with, and the axis could never be eliminated *or* confirmed.
 */
const usable = (axes: AxisSpec[]) => axes.filter(a => !isCircular(a));

export function createInferRelation(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createInferRelation");

    const type = EnumQuestionType.InferRelation;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = candidateCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));
    const colors = ndAxisColors(axes);

    // Objects enough for a layout to state, plus pairs to make claims about.
    const objectCount = Math.max(4, Math.min(7, numOfPremises));

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, objectCount);
        const layout = buildNdLayout(words, axes);

        /*
         * Claims are drawn from *derived* pairs as readily as stated ones: the
         * layout is given in full, so every pair's relation is knowable, and
         * restricting to stated pairs would let the operator be identified by
         * matching a premise's wording rather than by reasoning about it.
         */
        const pairs: Array<[string, string]> = [];
        for (const a of words) for (const b of words) if (a !== b) pairs.push([a, b]);

        const claimCount = 2 + Math.floor(Math.random() * 2);
        const hidden = Math.floor(Math.random() * axes.length);

        // Only pairs the hidden axis actually orders can carry a claim: "A ⊕ B"
        // has to be true of it, and a tie is neither direction.
        const truthy = pairs.filter(([a, b]) => compareOn(layout, hidden, a, b) === 1);
        if (truthy.length < claimCount) continue;

        const claims = pickUniqueItems(truthy, claimCount).picked;

        /*
         * The uniqueness test, and the reason this mode is verifiable rather
         * than plausible. An axis survives if every claim holds on it; the item
         * is only usable when the hidden axis is the sole survivor.
         */
        const survivors = axes
            .map((_, i) => i)
            .filter(i => !isCircular(axes[i])
                && claims.every(([a, b]) => compareOn(layout, i, a, b) === 1));
        if (survivors.length !== 1 || survivors[0] !== hidden) continue;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...scrambleByFactor(renderNdPremises(layout), ctx.settingsOverrideService.scramble),
            ...claims.map(([a, b]) => `${subj(a)} ${hi(OPERATOR)} ${subj(b)}`),
        ];

        /*
         * Candidates are the axes' own relation words, so answering means
         * naming a relation rather than an index. Shuffled, because a correct
         * answer sitting at the hidden axis's position would be readable off
         * the premise order.
         */
        /*
         * Two relations, and the wrong one nearly fits.
         *
         * Every axis used to be offered, which turns elimination into a sweep:
         * on six axes most candidates are ruled out by the first claim and cost
         * nothing. The one worth offering is the axis that survives the most
         * claims without surviving them all — the answer a reader lands on if
         * they stop checking one claim early, which is the mistake this mode is
         * built to catch.
         */
        const candidates = usable(axes).filter(a => a !== axes[hidden]);
        const runnerUp = candidates
            .map(a => ({
                axis: a,
                fits: claims.filter(([x, y]) => compareOn(layout, axes.indexOf(a), x, y) === 1).length,
            }))
            .sort((p, q) => q.fits - p.fits)[0];
        if (!runnerUp) continue;

        const shown = shuffle([axes[hidden], runnerUp.axis]);
        question.choices = shown.map(a => rel(a.scale.above, colors[axes.indexOf(a)]));
        question.correctChoice = shown.indexOf(axes[hidden]);
        question.answerMode = "choice";
        question.choicePrompt = `Which relation is ${OPERATOR}?`;
        // Scored as "did they pick the right one", like every other choice item.
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `<b>${OPERATOR}</b> is one of the relations below, the same one every `
            + "time. Which?",
        ];

        question.explanation = explainInference(
            layout, axes, colors, claims, hidden, survivors);

        /*
         * The same space, another withheld relation.
         *
         * Reading the space is the whole cost of the item and it is paid once —
         * every object's position on every axis is stated, and a further
         * question re-uses all of it. So the map stays exactly as it is and
         * only the claims made *with* the operator are replaced, which is the
         * half being asked about.
         *
         * A different symbol each time, deliberately. The setup says the
         * operator means one relation "every time", which is true within a
         * question and would be a lie across them — a reader carrying ⊕ over
         * from the last claim would be answering the wrong question with the
         * right method.
         */
        if (seriesWanted(ctx)) {
            const mapLines = question.premises.slice(0, -claims.length);
            const spent = new Set([hidden]);

            extendWithSeries(question, buildSeries(() => {
                const free = axes.map((_, i) => i)
                    .filter(i => !spent.has(i) && !isCircular(axes[i]));
                if (!free.length) return null;

                const next = free[Math.floor(Math.random() * free.length)];
                const fits = pairs.filter(([a, b]) => compareOn(layout, next, a, b) === 1);
                if (fits.length < claimCount) return null;

                const drawn = pickUniqueItems(fits, claimCount).picked;
                // The same uniqueness the first claim is held to: an item where
                // two axes both fit has no answer.
                const alive = axes.map((_, i) => i).filter(i => !isCircular(axes[i])
                    && drawn.every(([a, b]) => compareOn(layout, i, a, b) === 1));
                if (alive.length !== 1 || alive[0] !== next) return null;

                spent.add(next);
                const symbol = OPERATORS[spent.size - 1] ?? OPERATOR;
                // The same two-option rule as the first claim.
                const rival = usable(axes)
                    .filter(a => a !== axes[next])
                    .map(a => ({
                        axis: a,
                        fits: drawn.filter(([x, y]) => compareOn(layout, axes.indexOf(a), x, y) === 1).length,
                    }))
                    .sort((p, q) => q.fits - p.fits)[0];
                if (!rival) return null;

                const shown = shuffle([axes[next], rival.axis]);

                return {
                    /*
                     * Named rather than blank. The claim replaces the premises,
                     * so History has no conclusion line to show for it and was
                     * printing the heading over nothing — while the question
                     * being asked, which is the *symbol*, appeared only in the
                     * prompt on the play card and nowhere afterwards.
                     */
                    text: `Which relation is ${hi(symbol)}?`,
                    isValid: true,
                    /*
                     * This claim's own derivation. The item's describes the
                     * first claim — different objects, different axis, and a
                     * different symbol — so leaving it in place produced a
                     * confident explanation of a pair the card does not mention.
                     */
                    explanation: explainInference(
                        layout, axes, colors, drawn, next, [], symbol),
                    premises: [
                        ...mapLines,
                        ...drawn.map(([a, b]) => `${subj(a)} ${hi(symbol)} ${subj(b)}`),
                    ],
                    choices: shown.map(a => rel(a.scale.above, colors[axes.indexOf(a)])),
                    correctChoice: shown.indexOf(axes[next]),
                    prompt: `Which relation is ${symbol}?`,
                    key: String(next),
                };
            }));
        }

        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why it is that relation and not another.
 *
 * Written as the elimination it is: each claim rules candidates out, and the
 * one left standing is the answer. A reader who got this wrong nearly always
 * stopped at the first axis that fit rather than checking the rest.
 */
function explainInference(
    layout: ReturnType<typeof buildNdLayout>,
    axes: AxisSpec[],
    colors: string[],
    claims: Array<[string, string]>,
    hidden: number,
    _survivors: number[],
    /*
     * The symbol this claim was actually printed with.
     *
     * It used to be hardcoded to the first one. Every claim after the first
     * prints a different symbol on purpose — carrying ⊕ over from the last
     * question would be answering the wrong question with the right method —
     * so the derivation was talking about ⊕ under a card that said ⊗.
     */
    symbol = OPERATOR,
): string[] {
    const lines: string[] = [];

    for (const [a, b] of claims) {
        const ruled = axes
            .map((axis, i) => ({ axis, i }))
            .filter(({ axis, i }) => !isCircular(axis) && compareOn(layout, i, a, b) !== 1);
        if (!ruled.length) continue;
        lines.push(
            `${subj(a)} ${hi(symbol)} ${subj(b)} rules out `
            + ruled.map(({ axis, i }) => rel(axis.scale.above, colors[i])).join(", ")
            + " — it does not hold between them.");
    }

    /*
     * "means", not "is": scale words are whole clauses ("is after"), so a
     * sentence that prefixes anything to them reads "⊕ is is after".
     */
    lines.push(
        `so ${hi(symbol)} means ${rel(axes[hidden].scale.above, colors[hidden])} — `
        + "the only relation every claim holds for.");
    return lines;
}
