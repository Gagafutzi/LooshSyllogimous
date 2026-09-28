/**
 * Odd Analogy — three of these hold exactly, and one only looks as if it does.
 *
 * Isomorph's guide: *"Four analogies over one system; three hold exactly and one
 * only looks as if it does — it holds the other way round, or only if the
 * operation it names is skipped. Compose each relation and find the one that
 * fails."*
 *
 * Analogy Completion asks which pair finishes an analogy, so one relation has to
 * be carried to one place. This asks which of four analogies is false, so all
 * four have to be worked out before any of them can be ruled out — and none of
 * them can be ruled out early, because the wrong one is wrong by a single axis
 * or by direction alone. A reader who checks three and stops has not answered
 * the question; they have guessed between the one they skipped and the one they
 * liked least.
 *
 * ── Every pair is composed, never stated ──
 *
 * The pairs come from `derivedPairs`, which offers only pairs at least two steps
 * apart in the premise graph. So no analogy names a relation any premise states:
 * both halves of all four have to be accumulated along a chain, which is the
 * work, and an analogy solvable by finding the premise that mentions its two
 * objects would not be.
 *
 * ── Why the wrong one is wrong by a hair ──
 *
 * A false analogy that is off on three axes is found by noticing that its
 * objects are nowhere near each other, which is a spatial impression rather than
 * a composition. The wrong one here either holds *the other way round* — every
 * direction reversed, so it is exactly as close as an analogy can be to true
 * while being false — or differs on one axis and agrees on the rest. Both are
 * cases where the only way to see it is to have composed both halves.
 *
 * ── What makes an item well-formed ──
 *
 * Exactly one of the four is false, checked by comparing composed relations
 * rather than by trusting the construction. Each analogy names four distinct
 * objects, or a pair standing to itself would be true by inspection. And the
 * four are shown among the premises, so the options are claims the card makes:
 * that is the condition `registries.test.ts` allows a menu of four under, and
 * the reason nothing on it can be dismissed at a glance.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { PAIR_RELATION_WORDS, hi, rel } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, NdLayout, axesForDimensions, buildNdLayout, derivedPairs,
    relationKey, renderNdPattern, renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";
import { pairText } from "./analogy-completion";

/** A pair of objects with the relation between them, as `derivedPairs` gives it. */
type Pair = { a: string; b: string; key: string };

/** One claim on the card: this pair stands as that one does. */
interface Analogy { left: Pair; right: Pair; holds: boolean; }

/** On how many axes two composed relations disagree. */
function keyDistance(one: string, other: string): number {
    const b = other.split(",");
    return one.split(",").reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);
}

/** Whether two pairs name four different objects. */
const disjoint = (one: Pair, other: Pair) =>
    one.a !== other.a && one.a !== other.b && one.b !== other.a && one.b !== other.b;

const line = (an: Analogy) =>
    `${pairText(an.left)} ${rel(PAIR_RELATION_WORDS.same)} ${pairText(an.right)}`;

/**
 * How wide the space is.
 *
 * Two is the floor: on one axis a relation has three values, so its only near
 * miss is its own reverse and the mode loses half of what makes it hard. Five is
 * the ceiling because five signs is as much as anyone carries along a chain —
 * and `DIMENSION_AXES` adds Distinction at seven, which has no direction to
 * carry and so could not be part of an analogy's relation at all.
 *
 * One less than Analogy Completion's for the same premise count, because this
 * needs eight distinct pairs two steps apart rather than three, and the layout
 * has to be wide enough to have them before it is deep enough to be hard.
 */
const axisCount = (numOfPremises: number) =>
    Math.max(2, Math.min(5, numOfPremises - 3));

export function createOddAnalogy(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createOddAnalogy");

    const type = EnumQuestionType.OddAnalogy;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);
        if (new Set(words).size !== words.length) continue;
        const layout = buildNdLayout(words, axes);

        const pairs = derivedPairs(layout);
        if (pairs.length < 8) continue;

        const drawn = drawAnalogies(layout, pairs);
        if (!drawn) continue;

        const shown = shuffle(drawn);
        const wrong = shown.findIndex(an => !an.holds);

        const question = new Question(type);
        question.bucket = [...words];
        /*
         * The layout first, then the four claims about it — and the claims are
         * not scrambled into the layout. They are a different half of the card:
         * the premises say where everything is, the analogies are what is being
         * judged, and interleaving them would make the reader sort the two
         * before starting.
         */
        question.premises = [
            ...orderPremises(
                renderNdPremises(layout),
                ctx.settingsOverrideService.scramble,
                ctx.mergeTarget()),
            ...shown.map(line),
        ];
        question.choices = shown.map(line);
        question.correctChoice = wrong;
        question.answerMode = "choice";
        question.choicePrompt = "Which analogy does not hold?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `Four of these claim one pair stands as another does. ${hi("Three")} are `
            + "exact on <b>every</b> axis; one is not — it may hold the other way "
            + "round, or agree everywhere but one.",
            "No pair is stated outright: both halves of all four have to be worked "
            + "out along the chain.",
        ];

        question.explanation = explain(layout, shown, wrong);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Three that hold and one that nearly does.
 *
 * The true three are drawn from keys with two disjoint pairs to spare. The false
 * one is drawn last, from the pairs left over, so it cannot accidentally be one
 * of the three said again — and it is required to be a near miss, since the
 * whole difficulty is that it cannot be seen without composing.
 */
function drawAnalogies(layout: NdLayout, pairs: Pair[]): Analogy[] | null {
    const byKey = new Map<string, Pair[]>();
    for (const p of pairs) {
        const held = byKey.get(p.key) ?? [];
        held.push(p);
        byKey.set(p.key, held);
    }

    const truths: Analogy[] = [];
    const used = new Set<string>();
    for (const group of shuffle([...byKey.values()])) {
        if (truths.length === 3) break;
        const free = group.filter(p => !used.has(`${p.a}>${p.b}`));
        for (const left of shuffle(free)) {
            const right = free.find(p => p !== left && disjoint(left, p));
            if (!right) continue;
            truths.push({ left, right, holds: true });
            used.add(`${left.a}>${left.b}`);
            used.add(`${right.a}>${right.b}`);
            break;
        }
    }
    if (truths.length < 3) return null;

    /*
     * The false one: the same pair the other way round, or one axis out.
     *
     * Reversal first, because it is the case Isomorph names and the hardest to
     * see — the relation is right on every axis and wrong in every direction.
     */
    const spare = pairs.filter(p => !used.has(`${p.a}>${p.b}`));
    for (const left of shuffle(spare)) {
        const reverse = relationKey(layout, left.b, left.a);
        const near = spare.filter(p => p !== left && disjoint(left, p)
            && p.key !== left.key
            && (p.key === reverse || keyDistance(left.key, p.key) === 1));
        if (!near.length) continue;
        const wrong = near.find(p => p.key === reverse) ?? near[0];
        return [...truths, { left, right: wrong, holds: false }];
    }
    return null;
}

/**
 * Which one failed and by how little.
 *
 * Each analogy's two composed relations are printed side by side, because that
 * is the comparison the player was asked to make and the only thing that
 * distinguishes the wrong one. Saying "this analogy is false" without them would
 * be an answer rather than a reason.
 */
function explain(layout: NdLayout, shown: Analogy[], wrong: number): string[] {
    const pattern = (key: string) =>
        renderNdPattern(layout.axes, key.split(",").map(Number));

    const out = shown.map((an, i) => {
        const same = an.left.key === an.right.key;
        return `${pairText(an.left)} is ${pattern(an.left.key)}; `
            + `${pairText(an.right)} is ${pattern(an.right.key)}`
            + (same ? " — the same on every axis" : `, which is ${hi("not")} the same`);
    });

    /* Named by what it says, not by where it sits: the options are shuffled, so
       "the third claim" would point at a different line every time. */
    const odd = shown[wrong];
    const reversed = odd.right.key === relationKey(layout, odd.left.b, odd.left.a);
    const off = keyDistance(odd.left.key, odd.right.key);
    out.push(reversed
        ? `so the claim that fails is ${hi(line(odd))} — and it fails by direction alone: `
            + "every axis is right and every one runs the other way"
        : `so the claim that fails is ${hi(line(odd))} — off on `
            + `${off === 1 ? "a single axis" : `${off} axes`} and right on the rest, `
            + "which is why it has to be composed rather than noticed");
    return out;
}
