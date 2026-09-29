/**
 * Pivot Transforms — the arrangement moves while it is being described.
 *
 * Isomorph's guide: *"After some premises, everything is mirrored through one
 * entity, or everything turns a quarter turn about it; later premises describe the
 * new positions. State where two entities stand at the end. The early premises are
 * no longer true: carry them through the move."*
 *
 * This app already has a Transformation mode, and it is not this one. There, each
 * transformation moves *one* object relative to an anchor and every other premise
 * stays true. Here the move takes the whole space with it, and the premises that
 * came before it stop describing anything — they described where things were. A
 * reader who keeps reading them as current facts will get a consistent, wrong
 * answer, which is the failure worth provoking: it is what happens to anybody
 * reasoning from a model they have not updated.
 *
 * ── Two moves, not three ──
 *
 * Isomorph also has everyone but the pivot taking the next one's place along a
 * line. That needs the entities to *be* in a line, which a layout in three
 * directions does not give you, and faking one would make the premises describe a
 * different space from the one being reasoned about. Mirroring through an entity
 * and turning a quarter about it both work on any axis stack, so those are the two.
 *
 * ── What makes an item well-formed ──
 *
 * The answer is required to *differ* from what it would be if the move were
 * ignored. That is the whole item: a move a reader could skip and still get right
 * is a move that trains nothing, and it is the easy accident here — a mirror
 * through a pivot leaves anything collinear with it looking much as it did. The
 * check is on the shipped answer, not on the construction.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, own, subj } from "../utils/phrasing";
import {
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";

type Point = number[];

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const sub = (a: Point, b: Point) => a.map((v, i) => v - b[i]);

/** The move, as the card names it and as it acts on a position. */
interface Move {
    label: string;
    apply: (p: Point, pivot: Point) => Point;
}

const axisCount = (numOfPremises: number) =>
    Math.max(2, Math.min(4, numOfPremises - 4));

export function createPivotTransforms(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createPivotTransforms");

    const type = EnumQuestionType.PivotTransforms;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));

    const pattern = (v: Point) => renderNdPattern(axes, v.map(sign));
    const placement = (a: string, b: string, delta: Point) =>
        `${subj(a)} is ${pattern(delta)} relative to ${subj(b)}`;

    /** The axis pair a quarter turn happens in, named by its two directions. */
    const planeName = (i: number, j: number) =>
        `${renderNdPattern(axes, axes.map((_, k) => (k === i ? 1 : 0)))} and `
        + `${renderNdPattern(axes, axes.map((_, k) => (k === j ? 1 : 0)))}`;

    for (let attempt = 0; attempt < 400; attempt++) {
        /* Enough before the move to be worth carrying, and at least two after it
           so the new positions are described rather than merely asserted. */
        const before = Math.max(3, Math.floor((numOfPremises - 1) / 2));
        const after = Math.max(2, numOfPremises - 1 - before);
        const words = getRandomSymbols(settings, before + after + 1);
        if (new Set(words).size !== words.length) continue;

        /*
         * The early arrangement, as a chain of unit steps. Written here rather
         * than taken from `buildNdLayout` because the phases have to be kept
         * apart: what the premises fix before the move and what they fix after
         * are two different layouts, and the layout builder knows only one.
         */
        const early = words.slice(0, before + 1);
        const place = new Map<string, Point>([[early[0], Array(dims).fill(0)]]);
        const earlyLines: string[] = [];
        for (let i = 1; i < early.length; i++) {
            const from = early[Math.floor(Math.random() * i)];
            const delta: Point = axes.map(() =>
                Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? 1 : -1));
            if (delta.every(v => v === 0)) delta[Math.floor(Math.random() * dims)] = 1;
            place.set(early[i], place.get(from)!.map((v, k) => v + delta[k]));
            earlyLines.push(placement(early[i], from, delta));
        }

        const pivot = early[Math.floor(Math.random() * early.length)];
        const pivotAt = place.get(pivot)!;

        const plane = (() => {
            const pairs: Array<[number, number]> = [];
            for (let i = 0; i < dims; i++) for (let j = i + 1; j < dims; j++) pairs.push([i, j]);
            return pairs[Math.floor(Math.random() * pairs.length)];
        })();

        /*
         * Both moves are named by their own rules, so the line converts with the
         * premises around it. Written as plain words it stayed English under the
         * symbol switch while everything else on the card converted — and worse,
         * "mirrored" is already Transformation's own-rule word, so the check that
         * guards those wordings saw this mode using one it had not marked.
         */
        const moves: Move[] = [
            {
                label: `everything is ${own("pv-mirror")} ${subj(pivot)}`,
                apply: (p, at) => p.map((v, i) => 2 * at[i] - v),
            },
            {
                label: `everything ${own("pv-turn")} ${subj(pivot)}, `
                    + `in ${planeName(plane[0], plane[1])}`,
                apply: (p, at) => {
                    const out = [...p];
                    const [i, j] = plane;
                    const di = p[i] - at[i], dj = p[j] - at[j];
                    out[i] = at[i] - dj;
                    out[j] = at[j] + di;
                    return out;
                },
            },
        ];
        const move = moves[Math.floor(Math.random() * moves.length)];

        /* Where everything ends up, and where a reader who ignored the move
           would think it was. */
        const moved = new Map<string, Point>();
        for (const [w, p] of place) moved.set(w, move.apply(p, pivotAt));

        /* The late entities, placed against the moved arrangement. */
        const lateLines: string[] = [];
        const late = words.slice(before + 1);
        for (const w of late) {
            const anchor = early[Math.floor(Math.random() * early.length)];
            const delta: Point = axes.map(() =>
                Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? 1 : -1));
            if (delta.every(v => v === 0)) delta[Math.floor(Math.random() * dims)] = 1;
            moved.set(w, moved.get(anchor)!.map((v, k) => v + delta[k]));
            lateLines.push(placement(w, anchor, delta));
        }

        /*
         * Asked between an entity that moved and one placed afterwards, because
         * that is the pair the move actually bears on.
         */
        const from = early.filter(w => w !== pivot)[
            Math.floor(Math.random() * Math.max(1, early.length - 1))];
        const to = late[Math.floor(Math.random() * late.length)];
        if (!from || !to) continue;

        const answer = sub(moved.get(to)!, moved.get(from)!).map(sign);
        if (answer.every(v => v === 0)) continue;

        /*
         * **The move has to matter.** A reader who never applied it would place
         * `from` where it started, so the answer they would reach is the one
         * below — and if that is the same answer, the item is passed by ignoring
         * the move, which is the one thing it exists to punish.
         */
        const naive = sub(moved.get(to)!, place.get(from)!).map(sign);
        if (naive.join(",") === answer.join(",")) continue;

        const shown = shuffle([
            { v: answer, right: true },
            { v: naive, right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        /*
         * Never scrambled. The premises are in two phases and the move sits
         * between them, so their order *is* information — shuffled, the card
         * would not say which placements were before the move and which after,
         * and nothing about it could be worked out.
         */
        question.premises = [
            ...earlyLines,
            `Then ${move.label}.`,
            ...lateLines,
        ];
        question.choices = shown.map(c => pattern(c.v));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = `At the end, how does ${to} stand to ${from}?`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "These are <b>in order</b>. Partway through, the whole arrangement moves — "
            + "and the placements stated before the move describe where things "
            + `${hi("were")}, not where they are.`,
            "Everything after the move describes the new positions. Carry the early "
            + "placements through it before answering.",
        ];

        question.explanation = [
            `before the move, ${subj(from)} was ${pattern(sub(place.get(from)!, pivotAt))} `
            + `of ${subj(pivot)}`,
            `${move.label}, which puts it `
            + `${pattern(sub(moved.get(from)!, pivotAt))} of ${subj(pivot)} instead`,
            `${subj(to)} is placed against the moved arrangement, so from `
            + `${subj(from)} it ends up ${hi(pattern(answer))}`,
            `read without carrying ${subj(from)} through the move it would look `
            + `${pattern(naive)}, which is the other candidate`,
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
