/**
 * Second-Order — an analogy between relations rather than between things.
 *
 * Isomorph's guide: *"An analogy between relations. X→Y is how X stands to Y,
 * composed from the premises. The first two relations are linked by a change;
 * apply the same change to the third and name who stands so to the given entity.
 * … it is an operation to identify from one example — a reversal, a mirror, a
 * quarter turn, two verbs swapped."*
 *
 * Analogy Completion asks which pair stands as another pair does, so the answer
 * is a relation. This asks what happens to a relation when something is *done* to
 * it, so the answer is an operation — and the operation has to be identified from
 * a single example before it can be applied. Two levels: compose the relations,
 * then compare them to each other.
 *
 * ── Why the catalogue is on the card ──
 *
 * From one example, infinitely many operations map the first relation to the
 * second, so the change cannot be identified at all unless the reader knows what
 * kind of thing it might be. Isomorph names the catalogue in its guide and so
 * does the card here: the change either reverses every direction or exchanges two
 * of them. Naming it is not a hint, it is what makes the question well posed —
 * and the item is only kept when exactly one member of that catalogue fits the
 * example, so "identify the change" has one answer.
 *
 * ── Everything is composed, nothing is stated ──
 *
 * All three relations come from `derivedPairs`, which offers only pairs at least
 * two steps apart in the premise graph. So no relation on the card can be read
 * off a premise: each is accumulated along a chain, and the operation is applied
 * to something the reader worked out rather than to something they were given.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { PAIR_RELATION_WORDS, hi, own, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, NdLayout, axesForDimensions, buildNdLayout, derivedPairs, ndAxisColors,
    relationKey, renderNdPattern, renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";
import { pairText } from "./analogy-completion";

type Pair = { a: string; b: string; key: string };

/**
 * A change a relation can undergo, from the catalogue the card names.
 *
 * Kept to two kinds on purpose. Reversal and an exchange of two directions are
 * the two that are meaningful on every axis stack here and that a single example
 * can distinguish; a scaling would need magnitudes the premises do not state, and
 * a rotation on a straight axis is an exchange of two directions said in a way
 * that suggests it is something else.
 */
interface Change {
    id: string;
    /** How the card names it, once the reader has to identify it. */
    label: string;
    apply: (key: string) => string;
}

const CHANGES = (dims: number): Change[] => {
    const out: Change[] = [{
        id: "reverse",
        label: "every direction reversed",
        apply: key => key.split(",").map(v => String(-Number(v))).join(","),
    }];
    for (let i = 0; i < dims; i++) {
        for (let j = i + 1; j < dims; j++) {
            out.push({
                id: `swap:${i}:${j}`,
                label: "two directions exchanged",
                apply: key => {
                    const v = key.split(",");
                    [v[i], v[j]] = [v[j], v[i]];
                    return v.join(",");
                },
            });
        }
    }
    return out;
};

const keyDistance = (one: string, other: string) => {
    const b = other.split(",");
    return one.split(",").reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);
};

const disjoint = (one: Pair, other: Pair) =>
    one.a !== other.a && one.a !== other.b && one.b !== other.a && one.b !== other.b;

/** "A to B is the same relation as C to D", the app's own analogy wording. */
const analogy = (one: Pair, other: Pair) =>
    `${pairText(one)} ${rel(PAIR_RELATION_WORDS.same)} ${pairText(other)}`;

const axisCount = (numOfPremises: number) =>
    Math.max(2, Math.min(4, numOfPremises - 4));

export function createSecondOrder(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createSecondOrder");

    const type = EnumQuestionType.SecondOrder;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));
    const catalogue = CHANGES(dims);

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);
        if (new Set(words).size !== words.length) continue;
        const layout = buildNdLayout(words, axes);

        const pairs = derivedPairs(layout);
        if (pairs.length < 6) continue;
        const byKey = new Map<string, Pair[]>();
        for (const p of pairs) {
            const held = byKey.get(p.key) ?? [];
            held.push(p);
            byKey.set(p.key, held);
        }

        /*
         * The example: two composed relations, the second the first changed.
         *
         * Drawn by taking a pair, applying each change in the catalogue, and
         * looking for a pair with the result — so the change is real rather than
         * asserted, and it is *identifiable* because only one change in the
         * catalogue relates the two.
         */
        const example = shuffle([...pairs]).flatMap(from =>
            shuffle([...catalogue]).map(change => {
                const want = change.apply(from.key);
                if (want === from.key) return null;             // the change did nothing
                const to = (byKey.get(want) ?? []).find(p => disjoint(from, p));
                if (!to) return null;
                /* Only one change in the catalogue may relate the two, or the
                   reader cannot tell which change to apply next. */
                const fits = catalogue.filter(c => c.apply(from.key) === to.key);
                if (fits.length !== 1) return null;
                return { from, to, change };
            })).find(x => !!x);
        if (!example) continue;
        const { from, to, change } = example;

        /*
         * The third relation, and who stands to the given entity in the changed
         * way. Required to be a different relation from the example's, or the
         * answer is the example's second half said again.
         */
        const asked = shuffle([...pairs]).find(p => {
            if (p.key === from.key || p.key === to.key) return false;
            if (!disjoint(p, from) || !disjoint(p, to)) return false;
            return (byKey.get(change.apply(p.key)) ?? []).length > 0;
        });
        if (!asked) continue;

        const want = change.apply(asked.key);
        /*
         * The answer must not be the asked pair read backwards.
         *
         * Taking the first pair with the wanted relation shipped items whose
         * answer was the pair just stated with its two names swapped — because
         * reversing every direction is exactly what swapping them does, so "Tin
         * to Swan is the same relation as Swan to ?" answers itself without any
         * relation being composed. Requiring four distinct names makes the
         * landing pair somewhere else in the layout.
         */
        const landing = (byKey.get(want) ?? []).find(p => disjoint(p, asked));
        if (!landing) continue;

        /*
         * The decoy stands to the same entity one axis away from the answer.
         *
         * A decoy drawn at random is dismissed for being nowhere near; one axis
         * off can only be told apart by having applied the change correctly,
         * which is the step the mode is about.
         */
        const decoy = shuffle(layout.words)
            .filter(w => w !== landing.a && w !== landing.b)
            .map(w => ({ w, key: relationKey(layout, landing.a, w) }))
            .find(({ key }) => keyDistance(key, want) === 1);
        if (!decoy) continue;

        const shown = shuffle([
            { word: landing.b, right: true },
            { word: decoy.w, right: false },
        ]);

        const pattern = (key: string) =>
            renderNdPattern(axes, key.split(",").map(Number));

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(renderNdPremises(layout), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            analogy(from, to),
            `${pairText(asked)} ${rel(PAIR_RELATION_WORDS.same)} `
            + `${subj(landing.a)} ${own("pair-to")} ${hi("?")}`,
        ];
        question.choices = shown.map(c => subj(c.word));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = "Who completes the second pair?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "The last two lines are about <b>relations</b>, not about places. Work each "
            + "relation out along the chain first — none of them is stated outright.",
            "The first of them links two relations by a <b>change</b>: either every "
            + "direction reversed, or two of the directions exchanged. Identify which, "
            + "then apply the same change to the last relation.",
        ];

        question.explanation = [
            `${pairText(from)} is ${pattern(from.key)}`,
            `${pairText(to)} is ${pattern(to.key)}, which is that with `
            + `${hi(change.label)} — and no other change in the catalogue turns the first `
            + "into the second",
            `${pairText(asked)} is ${pattern(asked.key)}, so the same change makes it `
            + `${hi(pattern(want))}`,
            `from ${subj(landing.a)}, that is ${hi(landing.b)}`,
            `${subj(decoy.w)} is ${pattern(decoy.key)} from it — right on every direction `
            + "but one",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
