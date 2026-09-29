/**
 * Oblique Basis — the relation words are not the axes.
 *
 * Isomorph's guide: *"The relation words are not axes: each one moves two
 * directions at once (the codex says how). Add up the words along the chain, then
 * convert — or, later, the reverse. Tracking one axis at a time does not work
 * here."*
 *
 * Every spatial mode in this app can be done one axis at a time. "A is east and
 * above B, B is west and above C" — take the east column, take the up column, add
 * each separately, and the axes never interact. That is a real economy and it is
 * also a habit, and this is the mode that breaks it: each relation word moves two
 * directions together, so there is no column to add. A reader who tracks one axis
 * at a time cannot even *read* a premise, because no premise is about one axis.
 *
 * ── Why the words are invented ──
 *
 * A word that means "east and above" and is called something suggestive would be
 * decomposed by its name rather than by the codex. The words here mean nothing at
 * all, so the only way to know what one does is to look it up — which is the step
 * the mode is about, and the step a familiar vocabulary would let a reader skip.
 *
 * ── What makes an item well-formed ──
 *
 * The chain is at least three steps, so the answer is a sum rather than a lookup.
 * The answer's direction on each axis must differ from every single word's, or one
 * premise read alone gives it away. And the two candidate answers differ on one
 * axis only, so the item cannot be settled by noticing that one of them is nowhere
 * near.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";
import { INVENTED } from "./possibility";

/** One word of the basis: what it is called, and the step it makes. */
interface Oblique { word: string; step: number[]; }

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * How wide the space is.
 *
 * Three axes is the floor and the point: on two, a word moving both of them is
 * the whole space and there is nothing it fails to mention, so "tracking one axis
 * at a time does not work" has no bite. Four is the ceiling because the codex is
 * already four lines and every one of them has to be held.
 */
const axisCount = (numOfPremises: number) =>
    Math.max(3, Math.min(4, numOfPremises - 4));

export function createObliqueBasis(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createObliqueBasis");

    const type = EnumQuestionType.ObliqueBasis;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));

    /** The pattern, and the same pattern with one axis changed. */
    const pattern = (v: number[]) => renderNdPattern(axes, v.map(sign));

    for (let attempt = 0; attempt < 400; attempt++) {
        /*
         * The basis: three words, each moving exactly two of the directions.
         *
         * Exactly two rather than at least two. A word moving all three would be
         * usable as a whole-space step and the codex would have one entry that
         * does not need the others; a word moving one *is* an axis, which is the
         * thing this mode exists not to have.
         */
        const pairs: Array<[number, number]> = [];
        for (let i = 0; i < dims; i++) for (let j = i + 1; j < dims; j++) pairs.push([i, j]);
        const chosen = pickUniqueItems(pairs, Math.min(3, pairs.length)).picked;
        if (chosen.length < 3) continue;

        const names = pickUniqueItems(INVENTED, chosen.length).picked;
        const basis: Oblique[] = chosen.map(([i, j], k) => {
            const step = Array(dims).fill(0);
            step[i] = Math.random() < 0.5 ? 1 : -1;
            step[j] = Math.random() < 0.5 ? 1 : -1;
            return { word: names[k].stem, step };
        });
        if (new Set(basis.map(b => b.word)).size !== basis.length) continue;

        /* The chain: each entity a step from the last, by one of the words. */
        const steps = Math.max(3, Math.min(6, numOfPremises - 2));
        const words = getRandomSymbols(settings, steps + 1);
        if (new Set(words).size !== words.length) continue;

        const used = Array.from({ length: steps }, () =>
            basis[Math.floor(Math.random() * basis.length)]);
        /* Every word of the codex has to be used, or the card explains a word the
           item never needs and the reader learns to skip the codex. */
        if (new Set(used.map(u => u.word)).size !== basis.length) continue;

        const total = used.reduce(
            (sum, u) => sum.map((v, i) => v + u.step[i]), Array(dims).fill(0) as number[]);
        const answer = total.map(sign);
        if (answer.every(v => v === 0)) continue;       // the chain came back to where it began

        /*
         * The sum must not be any one word's step.
         *
         * Otherwise the answer is a codex entry, and a reader who read one premise
         * and looked it up has it — without adding anything.
         */
        if (basis.some(b => b.step.map(sign).join(",") === answer.join(","))) continue;

        /* The decoy is one axis away, so neither candidate is obviously wrong. */
        const axis = Math.floor(Math.random() * dims);
        const off = [...answer];
        off[axis] = off[axis] === 0 ? (Math.random() < 0.5 ? 1 : -1) : 0;
        if (off.join(",") === answer.join(",")) continue;

        const shown = shuffle([
            { v: answer, right: true },
            { v: off, right: false },
        ]);

        const codex = basis.map(b =>
            `One <b>${hi(b.word)}</b> is ${renderNdPattern(axes, b.step)}.`);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            used.map((u, i) =>
                `${subj(words[i + 1])} is one ${rel(u.word)} from ${subj(words[i])}`),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        question.choices = shown.map(c => pattern(c.v));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt =
            `How does ${words[steps]} stand to ${words[0]}?`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "The relation words here are <b>not</b> directions. Each one moves two of "
            + "them at once, so no premise is about a single direction and there is no "
            + "column to add up on its own.",
            ...codex,
        ];

        question.explanation = [
            ...basis.map(b => {
                const count = used.filter(u => u.word === b.word).length;
                return `${hi(b.word)} is used ${count} time${count === 1 ? "" : "s"}, `
                    + `each one ${renderNdPattern(axes, b.step)}`;
            }),
            `added along the chain that comes to ${hi(pattern(total))}`,
            `the other candidate differs on one direction only, so the sum is what tells `
            + "them apart",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
