/**
 * Projection — who coincides with this, seen through a lens.
 *
 * Isomorph's guide: *"A lens counts some directions and ignores the rest;
 * through it, entities that differ only in ignored directions coincide. Select
 * everyone who coincides with the named entity."*
 *
 * Every other mode over these spaces asks how two things *stand* to each other.
 * This asks who becomes the *same thing* once some of the directions stop
 * counting — so the answer is an equivalence class rather than a relation, and
 * the work is not composing a chain but composing it and then deliberately
 * discarding part of the result.
 *
 * Which is the harder half. Carrying four signs down a chain is what the space
 * modes already train; carrying four and then ignoring two without ignoring the
 * wrong two is what this adds. The failure it provokes is specific and worth
 * provoking: a reader who works out the full relation correctly and then reads
 * "coincides" off all of it will mark nobody, every time.
 *
 * ── Why a selection ──
 *
 * "Everyone who" is a set. Asking for one name would need the class to have
 * exactly one other member, which throws away the items where three things
 * collapse together — and those are the ones where the lens is doing the most
 * work. It also keeps "nobody coincides" available, which is a real reading of a
 * lens that separates everything.
 *
 * ── What makes an item well-formed ──
 *
 * The lens is a strict, non-empty subset of the axes: counting every direction
 * makes coincidence mean identity and the answer is always nobody, and counting
 * none makes everyone coincide. The premises fix every position on every axis,
 * so the class is computable rather than guessable. And an item where the lens
 * collapses *everybody* is rejected — that is a true reading and one a player
 * gives by selecting the whole list without reading it.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, NdLayout, axesForDimensions, buildNdLayout, ndAxisColors,
    renderNdPremises,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";

/**
 * How wide the space is.
 *
 * Three is the floor, because a lens has to leave something out and still count
 * something: on two axes the only lenses are one axis each, and "ignore the other
 * one" is a single comparison rather than a projection. Five is the ceiling for
 * the reason the other space modes cap there — five signs is as many as anyone
 * carries along a chain.
 */
const axisCount = (numOfPremises: number) =>
    Math.max(3, Math.min(5, numOfPremises - 2));

/**
 * What the card calls one axis: the pair of directions along it.
 *
 * Named by its directions rather than by its label, because the label is a
 * letter the premises never use — the reader knows this axis as the one the
 * premises call east and west. Through `hi`, so the switch that turns relations
 * into symbols converts the lens with them and the fresh-labels feature renames
 * it to match the premises.
 */
const axisName = (axes: AxisSpec[], i: number) => {
    const [pos, neg] = axes[i].scale.direction;
    return hi(`${pos}/${neg}`, ndAxisColors(axes)[i]);
};

const listed = (parts: string[]) => parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/** Whether two entities sit at the same place once only `lens` counts. */
const coincide = (layout: NdLayout, lens: number[], a: string, b: string) =>
    lens.every(i => layout.coords[a][i] === layout.coords[b][i]);

export function createProjection(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createProjection");

    const type = EnumQuestionType.Projection;
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

        /* A strict, non-empty subset: every direction makes coincidence mean
           identity, and none makes everybody coincide. */
        const size = 1 + Math.floor(Math.random() * (dims - 1));
        const lens = pickUniqueItems([...Array(dims).keys()], size).picked
            .sort((a, b) => a - b);

        const named = words[Math.floor(Math.random() * words.length)];
        const candidates = shuffle(words.filter(w => w !== named));
        const answer = candidates
            .map((w, i) => coincide(layout, lens, named, w) ? i : -1)
            .filter(i => i >= 0);

        /*
         * Everybody coinciding is answered by selecting the whole list. Nobody
         * is answered by submitting an empty one — and that is the one to watch,
         * because it is *not* rejected for being easy. Checking that nothing
         * coincides means checking every candidate, so the reader does all the
         * work either way.
         *
         * It is rejected for being likely. `guessRateFor("select", …)` prices a
         * selection at one subset in `2^n`, which assumes no single subset is
         * much likelier than another — and left alone the empty one came out
         * right in a quarter of items, so a player who submitted nothing without
         * reading would be credited as though they had named one subset in
         * thirty-two. Held near a tenth, the assumption holds and the reading
         * stays available, because a lens that separates everything is worth
         * meeting.
         */
        /* Defensive rather than tested: with a lens that always ignores an axis
           and positions that differ, a whole card collapsing did not occur once
           in six hundred items, so deleting this line leaves the suite green. */
        if (answer.length === candidates.length) continue;
        if (!answer.length && Math.random() > 0.06) continue;

        const ignored = [...Array(dims).keys()].filter(i => !lens.includes(i));

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            renderNdPremises(layout),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        question.choices = candidates.map(w => subj(w));
        question.selectAnswer = answer;
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = `Select everyone who coincides with ${named}.`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `Seen through this lens, only ${listed(lens.map(i => axisName(axes, i)))} `
            + `count${lens.length === 1 ? "s" : ""}. `
            + `${listed(ignored.map(i => axisName(axes, i)))} `
            + `${ignored.length === 1 ? "is" : "are"} <b>ignored</b>.`,
            `Two things coincide when nothing but the ignored directions separates `
            + `them. Select <b>everyone</b> who coincides with ${subj(named)} — which `
            + "may be nobody.",
        ];

        question.explanation = explain(layout, axes, lens, named, candidates, answer);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why those and not the others.
 *
 * Said per candidate and only about the axes that count, because that is the
 * discipline the mode is training: a derivation that reported the full relation
 * would be showing the reader the thing they were asked to look past, and the
 * one place a wrong answer comes from is looking at it.
 */
function explain(
    layout: NdLayout,
    axes: AxisSpec[],
    lens: number[],
    named: string,
    candidates: string[],
    answer: number[],
): string[] {
    const on = (w: string, i: number) => {
        const delta = layout.coords[w][i] - layout.coords[named][i];
        const [pos, neg] = axes[i].scale.direction;
        return delta === 0
            ? `level on ${axisName(axes, i)}`
            : `${delta > 0 ? pos : neg} of it`;
    };

    return [
        `Only ${listed(lens.map(i => axisName(axes, i)))} count, so everything the `
        + "premises say about the rest is beside the question",
        ...candidates.map((w, i) => answer.includes(i)
            ? `${subj(w)}: ${listed(lens.map(j => on(w, j)))} — nothing that counts `
                + "separates them, so they coincide"
            : `${subj(w)}: ${listed(lens.map(j => on(w, j)))} — separated on a `
                + "direction that counts"),
        answer.length === 0
            ? "so this lens separates everyone from it"
            : answer.length === 1
            ? "so exactly one thing collapses onto it"
            : `so ${hi(String(answer.length))} things collapse onto it`,
    ];
}
