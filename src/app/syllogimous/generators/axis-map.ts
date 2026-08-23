/**
 * Axis Maps — the inductive mode. See roadmap P13.
 *
 * Two descriptions of the same objects. The second is the first with an **axis
 * map** applied, and the task is to induce the map from worked examples and
 * then use it on a chain that was not shown mapped.
 *
 * Relational and anchored throughout. It replaces Transformation Matching,
 * whose objection was the grid itself — a grid is two-dimensional and this has
 * no reason to be, reading two pictures side by side is a visual diff where
 * reading two descriptions is an inference, and a grid cannot state a shift
 * without restating everything.
 *
 * **The anchors are the frame, not participants.** Anchor Space's markers sit
 * at fixed coordinates and the map moves objects *within* that frame, so ● stays
 * where it is and Ring moves. Nothing is pinned, every axis is free, and an
 * offset becomes visible at all: a shift is invisible between objects and
 * obvious against a frame that does not move.
 *
 * **Examples put each object on one axis.** An object displaced along a single
 * axis shows directly where that axis went and by how much; an object displaced
 * along several would leave the reader unable to say which component came from
 * where, and the map underdetermined. Axes the examples do not cover are
 * unchanged, which is stated with the item.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { EnumQuestionType } from "../constants/question.constants";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, rel, subj, dimClass, dimSlot } from "../utils/phrasing";
import { ANCHORS } from "../utils/anchor.utils";
import { axesForDimensions } from "../utils/ndspace.utils";
import { LinearScale } from "../utils/linear.utils";

/** What one elementary change does to a single axis. */
export type MapKind = "mirror" | "scale" | "offset" | "substitute";

export interface AxisMap {
    /** Source axis i lands on axis `perm[i]`. */
    perm: number[];
    /** Multiplier on source axis i's component. Negative is a mirror. */
    factor: number[];
    /** Added on target axis j, after the permutation. */
    offset: number[];
    /** For the derivation: what was actually done, in order. */
    steps: string[];
}

const identity = (d: number): AxisMap => ({
    perm: Array.from({ length: d }, (_, i) => i),
    factor: Array(d).fill(1),
    offset: Array(d).fill(0),
    steps: [],
});

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Coordinates, mapped. Anchors never go through here. */
export function applyAxisMap(coord: number[], m: AxisMap): number[] {
    const out = Array(coord.length).fill(0);
    for (let i = 0; i < coord.length; i++) out[m.perm[i]] += m.factor[i] * coord[i];
    for (let j = 0; j < coord.length; j++) out[j] += m.offset[j];
    return out;
}

/**
 * One elementary change, applied on top of what is already there.
 *
 * Composed by mutation rather than by building a second map and multiplying:
 * the steps have to read in the order they were applied, and a composition of
 * matrices has no order left in it to read.
 */
function extend(m: AxisMap, kind: MapKind, axes: LinearScale[], covered: number[]): boolean {
    const d = m.perm.length;
    /*
     * The axis by the name the premises use, not its internal label. Several
     * scales carry an `axisName` like "Y", which is what the composed spaces
     * print beside a grid — and naming an axis "Y" in a step whose premises all
     * say north and south leaves the reader matching up two vocabularies before
     * they can start.
     */
    const say = (i: number) => hi(axes[i].name || axes[i].axisName, dimClass(dimSlot(i)));

    if (kind === "mirror") {
        const free = covered.filter(i => m.factor[i] > 0);
        if (!free.length) return false;
        const i = pick(free);
        m.factor[i] *= -1;
        m.steps.push(`${say(i)} runs the other way`);
        return true;
    }
    if (kind === "scale") {
        const free = covered.filter(i => Math.abs(m.factor[i]) === 1);
        if (!free.length) return false;
        const i = pick(free);
        const k = pick([2, 3]);
        m.factor[i] *= k;
        m.steps.push(`${say(i)} stretches ${hi(`${k}×`)}`);
        return true;
    }
    if (kind === "offset") {
        const free = covered.filter(i => m.offset[i] === 0);
        if (!free.length) return false;
        const i = pick(free);
        const k = pick([-2, -1, 1, 2]);
        m.offset[i] += k;
        const word = k > 0 ? axes[i].direction[0] : axes[i].direction[1];
        m.steps.push(`everything shifts ${hi(`${Math.abs(k)} ${word}`)}`);
        return true;
    }

    // substitute: two covered axes trade places.
    if (covered.length < 2) return false;
    const [a, b] = shuffle([...covered]).slice(0, 2);
    [m.perm[a], m.perm[b]] = [m.perm[b], m.perm[a]];
    m.steps.push(`${say(a)} and ${say(b)} trade places`);
    return true;
}

function buildMap(axes: LinearScale[], covered: number[], kinds: MapKind[], count: number): AxisMap | null {
    const m = identity(axes.length);
    for (let i = 0; i < count; i++) {
        // Tried a few times: an elementary change can find nothing left to act
        // on once earlier ones have used the free axes up.
        let done = false;
        for (let attempt = 0; attempt < 8 && !done; attempt++) {
            done = extend(m, pick(kinds), axes, covered);
        }
        if (!done) return null;
    }
    return m.steps.length ? m : null;
}

/* ------------------------------------------------------------------ *
 * Phrasing                                                            *
 * ------------------------------------------------------------------ */

/** "2 east, 1 above" — only the axes this displacement actually uses. */
function clauses(delta: number[], axes: LinearScale[]): string {
    const parts: string[] = [];
    for (let i = 0; i < delta.length; i++) {
        if (!delta[i]) continue;
        const word = delta[i] > 0 ? axes[i].direction[0] : axes[i].direction[1];
        parts.push(rel(`${Math.abs(delta[i])} ${word}`, dimClass(dimSlot(i))));
    }
    return parts.join(", ");
}

function relationLine(from: string, to: string, delta: number[], axes: LinearScale[]): string {
    const body = clauses(delta, axes);
    if (!body) return `${subj(from)} is at the same point as ${subj(to)}`;
    /*
     * "relative to", not "of". Each axis carries its own connector — "east
     * *of*", "later *than*", "above" with none at all — and a displacement
     * names several axes at once, so no single one of them can be borrowed for
     * the whole phrase. The composed spaces settled on this for the same
     * reason.
     */
    return `${subj(from)} is ${body} relative to ${subj(to)}`;
}

const minus = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);

/* ------------------------------------------------------------------ *
 * The item                                                            *
 * ------------------------------------------------------------------ */

/**
 * How wide, how many changes, and which changes — all from the ladder.
 *
 * This is the only inductive mode in the app, so it carries the widest
 * difficulty range of any of them deliberately: two axes to seven, one
 * elementary change to three, and a vocabulary of changes that opens as it is
 * earned. Mirroring first because a reversed axis is the change you can see
 * without holding anything; substitution last because it is the one where a
 * direction word stops meaning what it says.
 */
function features(ctx: GeneratorContext, type: EnumQuestionType) {
    const has = (r: string) => ctx.hasRung(type, r);

    let dims = 2;
    for (const d of [3, 4, 5, 6, 7]) if (has(`dim-${d}`)) dims = d;

    /*
     * Mirroring *and* stretching from the start.
     *
     * Not generosity: with one axis-reversal available on a two-axis space
     * there are exactly two maps in the world, so an item cannot field four
     * distinct options and the mode fails to build at its own base state.
     * Stretching is the other change readable off a single example, and the two
     * together give six.
     */
    const kinds: MapKind[] = ["mirror", "scale"];
    if (has("offset")) kinds.push("offset");
    if (has("substitute")) kinds.push("substitute");

    // Low on purpose: three elementary changes is already a dictionary the
    // reader has to hold whole, and a fourth adds length rather than demand.
    const count = has("compose-3") ? 3 : has("compose-2") ? 2 : 1;

    return { dims, kinds, count };
}

export function createAxisMap(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createAxisMap");

    const type = EnumQuestionType.AxisMap;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    const feat = features(ctx, type);
    const axes = axesForDimensions(feat.dims).slice(0, feat.dims);

    /*
     * Four covered axes at most, however wide the space.
     *
     * One worked example per covered axis is what makes the map readable, and
     * seven of them is a wall of text before the question starts. The rest are
     * left unchanged and the item says so, which keeps a wide space wide
     * without making it long.
     */
    const covered = shuffle(axes.map((_, i) => i)).slice(0, Math.min(feat.dims, 4)).sort((a, b) => a - b);

    for (let attempt = 0; attempt < 200; attempt++) {
        const map = buildMap(axes, covered, feat.kinds, feat.count);
        if (!map) continue;

        const chainLen = Math.max(2, Math.min(5, numOfPremises));
        const names = getRandomSymbols(settings, covered.length + chainLen);
        const anchor = pick(ANCHORS);

        /*
         * Each example sits on one axis, which is what makes the map readable
         * rather than merely stated: an object displaced along two axes leaves
         * the reader unable to say which component came from where.
         */
        const examples = covered.map((axis, k) => {
            const coord = Array(feat.dims).fill(0);
            coord[axis] = pick([1, 2, 3]);
            return { name: names[k], coord };
        });

        const question = new Question(type);
        question.bucket = names;
        question.setup = [
            `The markers ${ANCHORS.map(a => a.token).join(" ")} never move — everything`
            + ` else is placed against them.`,
            `The same change is applied to every object at once.`
            + (covered.length < feat.dims
                ? ` Any direction not shown below is unchanged.`
                : ""),
        ];

        const lines: string[] = [];
        for (const ex of examples) {
            const after = applyAxisMap(ex.coord, map);
            lines.push(
                `${relationLine(ex.name, anchor.token, ex.coord, axes)}`
                + ` ${hi("→")} ${relationLine(ex.name, anchor.token, after, axes)}`);
        }

        /*
         * The chain. First link against the anchor so an offset can show at
         * all; the rest against the previous object, which is what the claim
         * that chains survive the map intact is actually about.
         */
        const chain = names.slice(covered.length);
        const coords: number[][] = [];
        for (let i = 0; i < chainLen; i++) {
            const step = Array(feat.dims).fill(0);
            const used = shuffle(axes.map((_, k) => k)).slice(0, Math.min(2, feat.dims));
            for (const k of used) step[k] = pick([-3, -2, -1, 1, 2, 3]);
            coords.push(i === 0 ? step : coords[i - 1].map((v, k) => v + step[k]));
        }

        const before = chain.map((n, i) =>
            i === 0
                ? relationLine(n, anchor.token, coords[0], axes)
                : relationLine(n, chain[i - 1], minus(coords[i], coords[i - 1]), axes));

        question.premises = [...lines, ...before];

        const render = (m: AxisMap) => {
            const after = coords.map(c => applyAxisMap(c, m));
            return chain.map((n, i) =>
                i === 0
                    ? relationLine(n, anchor.token, after[0], axes)
                    : relationLine(n, chain[i - 1], minus(after[i], after[i - 1]), axes))
                .join("; ");
        };

        const truth = render(map);

        /*
         * Distractors are the same chain under a *different* map, so every one
         * of them is a near miss by construction: they agree wherever the two
         * maps agree, and a reader who has induced the map wrongly on one axis
         * lands on one of them rather than on nothing.
         */
        const wrong = new Set<string>();
        for (let i = 0; i < 60 && wrong.size < 3; i++) {
            const other = buildMap(axes, covered, feat.kinds, feat.count);
            if (!other) continue;
            const text = render(other);
            if (text !== truth) wrong.add(text);
        }
        if (wrong.size < 3) continue;

        const options = shuffle([truth, ...wrong]);
        question.answerMode = "choice";
        question.choicePrompt = "After the same change, which describes them?";
        question.choices = options;
        question.correctChoice = options.indexOf(truth);
        question.conclusion = "";
        question.isValid = true;
        question.explanation = [
            ...map.steps.map(s => `Reading the examples: ${s}.`),
            covered.length < feat.dims
                ? `Everything else is unchanged.`
                : `That is every direction.`,
            `Applying it to the chain, in order, gives ${hi(truth)}.`,
        ];

        return question;
    }

    throw new Error("Cannot generate.");
}
