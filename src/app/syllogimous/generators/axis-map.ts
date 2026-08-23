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
    /**
     * What was done, in order — for building only, never for explaining.
     *
     * Composed changes can cancel: two swaps of the same pair leave the axes
     * where they started, and a derivation replaying the steps then claims two
     * changes an item does not contain. `describeMap` reads the finished map
     * instead, so the explanation describes what the reader is looking at.
     */
    steps: string[];
}

/** A map's state, copied — for keeping the stages on the way to it. */
const snapshot = (m: AxisMap): AxisMap => ({
    perm: [...m.perm], factor: [...m.factor], offset: [...m.offset], steps: [...m.steps],
});

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

/**
 * The map, and the map at every point on the way to it.
 *
 * Kept because the finished map alone cannot be *shown* being applied: a reader
 * who got the item wrong is usually wrong about one of the changes, and a
 * picture of the end state tells them only that they are wrong. The stages let
 * the change be watched happening a step at a time.
 */
function buildMap(
    axes: LinearScale[],
    covered: number[],
    kinds: MapKind[],
    count: number,
    trail?: AxisMap[],
): AxisMap | null {
    const m = identity(axes.length);
    if (trail) { trail.length = 0; trail.push(snapshot(m)); }
    for (let i = 0; i < count; i++) {
        // Tried a few times: an elementary change can find nothing left to act
        // on once earlier ones have used the free axes up.
        let done = false;
        for (let attempt = 0; attempt < 8 && !done; attempt++) {
            done = extend(m, pick(kinds), axes, covered);
        }
        if (!done) return null;
        if (trail) trail.push(snapshot(m));
    }
    /*
     * Judged by what it does, not by how many times something was done to it.
     *
     * Changes compose and can cancel — two swaps of one pair put the axes back
     * — so a map built from three steps may be a map of one change, or of none.
     * Rejecting those keeps the count honest: an item said to carry three
     * changes has to carry three.
     */
    return describeMap(m, axes).length >= count ? m : null;
}

/**
 * The finished map, in words, read off the map itself.
 *
 * **One line per axis that changes, saying everything about that axis.** The
 * first version listed the parts separately — "East-west and North-south trade
 * places", then "East-west stretches 2×" — and that is ambiguous in a way that
 * matters: it does not say whether the stretch happens before the swap or
 * after, and those give different answers. Saying where an axis ends up and by
 * how much, in one clause, has no order left in it to get wrong.
 *
 * Offsets stay separate because they genuinely are: a shift is about the whole
 * arrangement rather than about any one axis's contribution.
 */
export function describeMap(m: AxisMap, axes: LinearScale[]): string[] {
    const say = (i: number) => hi(axes[i].name || axes[i].axisName, dimClass(dimSlot(i)));
    const out: string[] = [];

    for (let i = 0; i < m.perm.length; i++) {
        const j = m.perm[i];
        const f = m.factor[i];
        if (j === i && f === 1) continue;

        const size = Math.abs(f) === 1 ? "" : `, ${hi(`${Math.abs(f)}×`)} as far`;
        if (j === i) {
            out.push(f < 0
                ? `${say(i)} runs the other way${size}`
                : `${say(i)} stays put${size}`);
        } else {
            out.push(f < 0
                ? `${say(i)} becomes ${say(j)}, reversed${size}`
                : `${say(i)} becomes ${say(j)}${size}`);
        }
    }

    for (let j = 0; j < m.offset.length; j++) {
        const k = m.offset[j];
        if (!k) continue;
        const word = k > 0 ? axes[j].direction[0] : axes[j].direction[1];
        out.push(`everything shifts ${hi(`${Math.abs(k)} ${word}`)}`);
    }
    return out;
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

    let dims = 3;
    for (const d of [4, 5, 6, 7]) if (has(`dim-${d}`)) dims = d;

    /*
     * Substitution is in from the start, and that is the whole shape of the
     * difficulty here.
     *
     * Mirroring, stretching and shifting all leave a relation naming the *same*
     * axis and only change it in place — read one example and you have it. Only
     * substitution makes a direction word stop meaning what it says, so a
     * vocabulary without it is a vocabulary of easy changes however many of
     * them are composed. It was the last rung; it is the base.
     *
     * Shifting is the rung instead, being the one change that says nothing
     * about any particular axis and so adds least on its own.
     */
    const kinds: MapKind[] = ["mirror", "scale", "substitute"];
    if (has("offset")) kinds.push("offset");

    let count = 1;
    for (const n of [2, 3, 4, 5]) if (has(`compose-${n}`)) count = n;

    /*
     * Independent groups, each with its own map.
     *
     * Not one map applied to more objects — that is the same puzzle longer.
     * Each group is its own chain against its own marker with its own change,
     * so the reader has to keep several dictionaries apart and apply each to
     * the right chain. Three is the ceiling: a fourth adds a dictionary rather
     * than a kind of demand.
     */
    const groups = has("groups-3") ? 3 : has("groups-2") ? 2 : 1;

    return { dims, kinds, count, groups };
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
     * One worked example per covered axis is what makes a map readable, and
     * seven of them is a wall of text before the question starts. The rest are
     * left unchanged and the item says so, which keeps a wide space wide
     * without making it long.
     */
    const covered = shuffle(axes.map((_, i) => i))
        .slice(0, Math.min(feat.dims, 4)).sort((a, b) => a - b);

    const chainLen = Math.max(2, Math.min(7, numOfPremises));

    for (let attempt = 0; attempt < 300; attempt++) {
        const built = buildGroups(ctx, feat, axes, covered, chainLen);
        if (built) return built;
    }

    throw new Error("Cannot generate.");
}

/** One group: its own marker, its own objects, its own map. */
interface Group {
    label: string;
    anchor: string;
    map: AxisMap;
    /** Worked examples, already filtered to the ones that show a change. */
    shown: Array<{ name: string; coord: number[]; after: number[] }>;
    chain: string[];
    coords: number[][];
    /** The map after each change, starting from no change at all. */
    trail: AxisMap[];
}

function buildGroups(
    ctx: GeneratorContext,
    feat: ReturnType<typeof features>,
    axes: LinearScale[],
    covered: number[],
    chainLen: number,
): Question | null {
    const settings = ctx.settings;
    const d = axes.length;

    // Every group needs its own marker, so a reader can tell whose chain is
    // whose without being told.
    const markers = shuffle([...ANCHORS]).slice(0, feat.groups);
    if (markers.length < feat.groups) return null;

    const need = feat.groups * (covered.length + chainLen);
    const names = getRandomSymbols(settings, need);
    if (names.length < need) return null;

    const groups: Group[] = [];
    let cursor = 0;

    for (let g = 0; g < feat.groups; g++) {
        const trail: AxisMap[] = [];
        const map = buildMap(axes, covered, feat.kinds, feat.count, trail);
        if (!map) return null;

        const anchor = markers[g].token;
        const exampleNames = names.slice(cursor, cursor + covered.length);
        cursor += covered.length;

        const shown = covered
            .map((axis, k) => {
                const coord = Array(d).fill(0);
                coord[axis] = pick([1, 2, 3]);
                return { name: exampleNames[k], coord, after: applyAxisMap(coord, map) };
            })
            .filter(ex => relationLine(ex.name, anchor, ex.coord, axes)
                !== relationLine(ex.name, anchor, ex.after, axes));
        if (!shown.length) return null;

        const chain = names.slice(cursor, cursor + chainLen);
        cursor += chainLen;

        const coords: number[][] = [];
        for (let i = 0; i < chainLen; i++) {
            const step = Array(d).fill(0);
            for (const k of shuffle(axes.map((_, j) => j)).slice(0, Math.min(2, d))) {
                step[k] = pick([-3, -2, -1, 1, 2, 3]);
            }
            coords.push(i === 0 ? step : coords[i - 1].map((v, k) => v + step[k]));
        }

        groups.push({
            label: feat.groups > 1 ? `Group ${g + 1}` : "",
            anchor, map, shown, chain, coords, trail,
        });
    }

    /*
     * Two groups given the same map is one group in two halves: the reader
     * induces once and applies twice, which is the mode without the demand the
     * rung was added for.
     */
    if (feat.groups > 1) {
        const signatures = groups.map(g => describeMap(g.map, axes).sort().join("|"));
        if (new Set(signatures).size < groups.length) return null;
    }

    const question = new Question(EnumQuestionType.AxisMap);
    question.bucket = names;
    question.setup = [
        `The markers ${ANCHORS.map(a => a.token).join(" ")} never move — everything`
        + ` else is placed against them.`,
        feat.groups > 1
            ? `Each group has its own change, and <b>every change it makes is shown</b>`
            + ` in that group's examples. What the examples leave alone stays as it is.`
            : `The same change is applied to every object at once, and`
            + ` <b>every change it makes is shown below</b> — anything the`
            + ` examples leave alone stays as it is.`,
    ];

    const premises: string[] = [];
    for (const g of groups) {
        premises.push(hi(g.label ? `${g.label} — worked examples:` : "Worked examples:"));
        for (const ex of g.shown) {
            premises.push(`${relationLine(ex.name, g.anchor, ex.coord, axes)}`
                + ` ${hi("→")} ${relationLine(ex.name, g.anchor, ex.after, axes)}`);
        }
        premises.push(hi(g.label ? `${g.label} — now these:` : "Now these:"));
        premises.push(...g.chain.map((n, i) =>
            i === 0
                ? relationLine(n, g.anchor, g.coords[0], axes)
                : relationLine(n, g.chain[i - 1], minus(g.coords[i], g.coords[i - 1]), axes)));
    }
    question.premises = premises;

    /** One group's chain under a given map, rendered. */
    const renderGroup = (g: Group, m: AxisMap) => {
        const after = g.coords.map(c => applyAxisMap(c, m));
        return g.chain.map((n, i) =>
            i === 0
                ? relationLine(n, g.anchor, after[0], axes)
                : relationLine(n, g.chain[i - 1], minus(after[i], after[i - 1]), axes))
            .join("; ");
    };

    const render = (maps: AxisMap[]) => groups
        .map((g, i) => (g.label ? `${g.label}: ` : "") + renderGroup(g, maps[i]))
        .join(" · ");

    const truth = render(groups.map(g => g.map));

    /*
     * A distractor changes *one* group's map and keeps the rest.
     *
     * Changing them all at once gives an option wrong everywhere, which is
     * eliminated by checking whichever group the reader looked at first — the
     * same fault the mode this replaces had with its four options. Wrong in one
     * place means finding that place.
     */
    const wrong = new Set<string>();
    for (let i = 0; i < 120 && wrong.size < 3; i++) {
        const swap = Math.floor(Math.random() * groups.length);
        const other = buildMap(axes, covered, feat.kinds, feat.count);
        if (!other) continue;
        const maps = groups.map((g, k) => k === swap ? other : g.map);
        const text = render(maps);
        if (text !== truth) wrong.add(text);
    }
    if (wrong.size < 3) return null;

    const options = shuffle([truth, ...wrong]);
    question.answerMode = "choice";
    question.choicePrompt = "After the change, which describes them?";
    question.choices = options;
    question.correctChoice = options.indexOf(truth);
    question.conclusion = "";
    question.isValid = true;

    /*
     * One stage per step of the change, covering every group at once.
     *
     * Drawn in a single frame, which means the markers have to be at their real
     * positions rather than all at the origin: each group states its chain
     * against its own marker, so plotting the relative coordinates together
     * would pile every group on top of the others and show the frame as one
     * point. The markers carry the same coordinates in every stage, because not
     * moving is the whole of what they do.
     *
     * A group with fewer changes than another simply stops moving, which is the
     * honest picture — its change was finished earlier.
     */
    const anchorAt = (token: string) => {
        const found = ANCHORS.find(a => a.token === token);
        return Array.from({ length: d }, (_, i) => found?.coord[i] ?? 0);
    };

    const stageCount = Math.max(...groups.map(g => g.trail.length));
    question.axisNames = axes.map(a => a.name || a.axisName);
    question.stages = Array.from({ length: stageCount }, (_, step) => {
        const plot: Record<string, number[]> = {};
        for (const a of ANCHORS) plot[a.token] = anchorAt(a.token);
        for (const g of groups) {
            const at = g.trail[Math.min(step, g.trail.length - 1)];
            const base = anchorAt(g.anchor);
            g.chain.forEach((name, i) => {
                plot[name] = applyAxisMap(g.coords[i], at).map((v, k) => v + base[k]);
            });
        }

        if (step === 0) return { label: "Before any change", map: plot };

        /*
         * Captioned with what changed *at this step*, per group. With several
         * groups more than one may move at once, and naming only the first
         * leaves the rest of the picture unexplained — which is worse than a
         * longer caption, because the reader cannot tell it is incomplete.
         */
        const said = groups
            .map(g => {
                if (step >= g.trail.length) return "";
                const words = describeMap(diffBetween(g.trail[step - 1], g.trail[step]), axes);
                if (!words.length) return "";
                return (g.label ? `${g.label}: ` : "") + words.join(", ");
            })
            .filter(Boolean);

        return { label: `Then — ${said.join(" · ") || `step ${step}`}`, map: plot };
    });

    question.explanation = groups.flatMap(g => {
        const told = describeMap(g.map, axes);
        const who = g.label ? `${g.label}: ` : "";
        return told.length === 1
            ? [`${who}one change — ${told[0]}.`]
            : [`${who}${told.length} changes together:`, ...told.map(t => `— ${t}.`)];
    }).concat([
        `Nothing else moves.`,
        `Each link maps on its own, because a group's change is the same`
        + ` throughout it — so the chains come through as ${hi(truth)}.`,
    ]);

    return question;
}

/**
 * The part of `after` that `before` did not already have.
 *
 * Read as the difference between two snapshots rather than from the step text,
 * for the same reason the whole map is described from the map: the words beside
 * a picture have to describe what the picture shows.
 */
function diffBetween(before: AxisMap, after: AxisMap): AxisMap {
    const d = before.perm.length;
    const changed: AxisMap = {
        perm: [...after.perm], factor: [...after.factor], offset: [...after.offset], steps: [],
    };
    for (let i = 0; i < d; i++) {
        if (before.perm[i] === after.perm[i]) changed.perm[i] = i;
        if (before.factor[i] === after.factor[i]) changed.factor[i] = 1;
        if (before.offset[i] === after.offset[i]) changed.offset[i] = 0;
    }
    return changed;
}
