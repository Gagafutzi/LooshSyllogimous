/**
 * Context Shifts — a relation treated as an object and then operated on.
 *
 * Isomorph's guide: *"A context is a relation treated as an object: 'context A is
 * how X stands to Y' names a displacement, and later contexts transform it —
 * reversed, mirrored along one axis, turned a quarter, or counted only along the
 * directions another context moves in. Work each context out in order, then state
 * where the final point lands. Turns and mirrors do not commute: the order they
 * are applied in matters."*
 *
 * Second-Order compares two relations and asks what was done to one to get the
 * other. This *does* things to a relation, several in a row, and asks where it
 * ends up — so a relation stops being a fact about two entities and becomes a
 * value being carried through a computation. That is the step from reasoning about
 * a structure to reasoning about operations on structures, and nothing else in
 * this app asks for it.
 *
 * ── Order matters, and it is checked that it does ──
 *
 * A quarter turn and a mirror do not commute. That is the whole reason the
 * contexts are a *sequence* rather than a set, so an item where the order did not
 * matter would be teaching the opposite of the lesson. Every item is checked by
 * swapping two adjacent operations and confirming the answer changes — on the
 * shipped card, not in the construction.
 *
 * ── Doubling is left out, and why ──
 *
 * Isomorph also doubles a context. The answer here is a direction on each axis,
 * and doubling changes no direction — so a card that doubled would state an
 * operation the answer could not reflect, which is worse than not offering it.
 * Asking for magnitudes instead would need every premise to state distances, which
 * is a different mode. Everything kept changes the directions: reversal, a mirror
 * along one axis, a quarter turn, and counting only where another context moves.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, own, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, axesForDimensions, buildNdLayout, derivedPairs, ndAxisColors,
    renderNdPattern, renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";

type Vec = number[];
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/** One operation on a context, as the card names it and as it acts. */
interface Shift {
    /** How the card states it, given the letter of the context it is built from. */
    say: (from: string) => string;
    apply: (v: Vec) => Vec;
}

/** Contexts are named by letter, which is what makes them objects. */
const LETTERS = ["A", "B", "C", "D", "E", "F"];

const axisCount = (numOfPremises: number) =>
    Math.max(3, Math.min(4, numOfPremises - 5));

export function createContextShifts(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createContextShifts");

    const type = EnumQuestionType.ContextShifts;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));
    const pattern = (v: Vec) => renderNdPattern(axes, v.map(sign));
    /*
     * One axis, named by its pair of directions.
     *
     * Rendering a one-hot vector through `renderNdPattern` names it by printing
     * every axis — so "turned a quarter from east towards above" came out as
     * "turned a quarter, from east, same latitude, same height, same time towards
     * same longitude, same latitude, above, same time", which is unreadable and
     * says three things the operation has nothing to do with. The direction pair
     * is how Projection names an axis, and how `describeNdAxes` does.
     */
    const colors = ndAxisColors(axes);
    const axisWord = (i: number) => {
        const [pos, neg] = axes[i].scale.direction;
        return hi(`${pos}/${neg}`, colors[i]);
    };

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, Math.max(5, numOfPremises - 2));
        if (new Set(words).size !== words.length) continue;
        const layout = buildNdLayout(words, axes);

        /* Both base contexts are composed relations, never stated ones, so the
           first thing the reader does is work out what the context even is. */
        const pairs = derivedPairs(layout);
        if (pairs.length < 4) continue;
        const [first, second] = shuffle([...pairs]);
        if (!second || first.key === second.key) continue;

        const base = first.key.split(",").map(Number);
        const other = second.key.split(",").map(Number);
        if (base.every(v => v === 0) || other.every(v => v === 0)) continue;

        /*
         * The catalogue. Each is stated against the context it is built from, so
         * the card is a chain of definitions rather than a list of instructions —
         * which is what makes a context an object rather than a step.
         */
        const catalogue: Shift[] = [
            {
                say: from => `is context ${hi(from)} reversed`,
                apply: v => v.map(x => -x),
            },
            ...axes.map((_, i) => ({
                say: (from: string) =>
                    `is context ${hi(from)} ${own("cs-mirror")} ${axisWord(i)}`,
                apply: (v: Vec) => v.map((x, k) => (k === i ? -x : x)),
            })),
            ...axes.flatMap((_, i) => axes.map((__, j) => ({ i, j })))
                .filter(({ i, j }) => i < j)
                .map(({ i, j }) => ({
                    say: (from: string) =>
                        `is context ${hi(from)} turned a quarter, from ${axisWord(i)} `
                        + `towards ${axisWord(j)}`,
                    apply: (v: Vec) => {
                        const out = [...v];
                        out[i] = -v[j];
                        out[j] = v[i];
                        return out;
                    },
                })),
            {
                say: from => `is context ${hi(from)} counted only along the directions `
                    + `context ${hi(LETTERS[1])} moves in`,
                apply: v => v.map((x, k) => (other[k] === 0 ? 0 : x)),
            },
        ];

        /*
         * Two to four operations, each of which has to change the running value —
         * an operation that does nothing is a line the reader can skip, and the
         * mode is about carrying a value through all of them.
         */
        const howMany = Math.max(2, Math.min(4, numOfPremises - 5));
        const chain: Shift[] = [];
        let running = [...base];
        for (let step = 0; step < howMany; step++) {
            const choice = shuffle([...catalogue]).find(s =>
                s.apply(running).map(sign).join(",") !== running.map(sign).join(","));
            if (!choice) break;
            chain.push(choice);
            running = choice.apply(running);
        }
        if (chain.length < 2) continue;

        const answer = running.map(sign);
        if (answer.every(v => v === 0)) continue;
        if (answer.join(",") === base.map(sign).join(",")) continue;   // the chain undid itself

        /*
         * **Order has to matter.** Swapping the last two operations must change the
         * result, or the card presents a sequence whose sequence is decoration —
         * and "turns and mirrors do not commute" is the thing it is for.
         */
        const swapped = (() => {
            const order = [...chain];
            const last = order.length - 1;
            [order[last - 1], order[last]] = [order[last], order[last - 1]];
            return order.reduce((v, s) => s.apply(v), [...base]).map(sign);
        })();
        if (swapped.join(",") === answer.join(",")) continue;

        /* One axis apart, so neither candidate is obviously wrong. */
        const axis = Math.floor(Math.random() * dims);
        const off = [...answer];
        off[axis] = off[axis] === 0 ? 1 : 0;
        if (off.join(",") === answer.join(",")) continue;

        const shown = shuffle([
            { v: answer, right: true },
            { v: off, right: false },
        ]);

        /* Context A is the first relation, B the second, then the chain. */
        const names = LETTERS.slice(0, 2 + chain.length);
        const definitions = [
            `Context ${hi(names[0])} is how ${subj(first.b)} stands to ${subj(first.a)}.`,
            `Context ${hi(names[1])} is how ${subj(second.b)} stands to ${subj(second.a)}.`,
            ...chain.map((s, i) => `Context ${hi(names[i + 2])} ${s.say(names[i + 1])}.`),
        ];

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(renderNdPremises(layout), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            /* The definitions are never scrambled: each is built from the one
               before it, so their order is the computation. */
            ...definitions,
        ];
        question.choices = shown.map(c => pattern(c.v));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = `Which way does context ${names[names.length - 1]} point?`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            /* "In its own right" carries a relation word — "right" — which the
               label switch renames, so the sentence would tell the reader about a
               relation the card does not use. Said without it. */
            "A <b>context</b> is a relation treated as a thing itself: not where two "
            + "entities are, but the step from one to the other.",
            "Each context after the first two is built from the one before it, so work "
            + "them out <b>in order</b>. A turn and a mirror do not give the same result "
            + "in the other order.",
        ];

        question.explanation = [
            `context ${names[0]} is ${hi(pattern(base))}, worked out along the chain`,
            `context ${names[1]} is ${pattern(other)}`,
            ...chain.map((s, i) => {
                const upto = chain.slice(0, i + 1).reduce((v, t) => t.apply(v), [...base]);
                /* Not stripped: the operation's own-rule markup has to survive
                   into the derivation, or the line names a wording the card has
                   already converted. */
                return `context ${names[i + 2]} ${s.say(names[i + 1])}, which is `
                    + `${pattern(upto)}`;
            }),
            `taken in the other order the last two would give ${pattern(swapped)}, which `
            + "is why the order is the answer",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
