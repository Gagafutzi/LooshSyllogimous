/**
 * N-dimensional relational space.
 *
 * v4 had a 3D spatial mode and a 3D-plus-time mode, each written as its own
 * generator with its vocabulary baked in. This replaces that idea with a
 * composition: a space is a *list of axes*, each axis is a `LinearScale`, and
 * the dimension count is however many you name. Four dimensions is the three
 * spatial ones plus time; five adds containment; six adds quantity; nothing
 * stops it going further.
 *
 * That is the whole point of building it this way. "4D" is not a mode someone
 * wrote — it is a configuration, so the axes can be swapped, reordered or
 * extended without touching the generator.
 *
 * ── Structure ──
 *
 * One shared tree over the objects, with an independent step on every axis per
 * edge. So a premise fixes two objects' relationship on *all* axes at once —
 * "Ash is east, same latitude, above and later relative to Bell" — and the
 * difficulty is carrying several independent accumulations through the same
 * chain rather than reading several separate puzzles.
 *
 * Every axis is therefore fully determined by the premises, which is what makes
 * an item answerable. A premise that quietly left an axis out would leave the
 * reader unable to derive a relation the item then asks about.
 *
 * ── Circular axes ──
 *
 * An axis can be bent into a loop of size `modulus`. That changes the *kind* of
 * question it can answer, not just the arithmetic: on a ring nothing is
 * "greater" than anything else, because you can reach it going either way. So a
 * circular axis drops ordering and asks about displacement instead — how many
 * steps round, whether two things coincide, whether they sit opposite each
 * other. Wrap-around is what makes it worth having: positions accumulate mod
 * `modulus`, so a long chain comes back on itself.
 *
 * Pure — no Angular, no settings, no storage. Positions are integers and every
 * claim is decided by comparing them.
 */

import { ConstructClaim } from "../models/question.models";
import { LINEAR_SCALES, LinearLayout, LinearScale, SPATIAL_SCALES, buildBranching, buildChain } from "./linear.utils";
import { Transform, TransformVocab, drawTransforms, replay } from "./transformations.utils";
import { hi, rel, subj } from "./phrasing";

/* ------------------------------------------------------------------ *
 * Axes                                                                *
 * ------------------------------------------------------------------ */

export interface AxisSpec {
    scale: LinearScale;
    /**
     * Loop size. Absent or under 3 means a straight axis.
     *
     * Three is the floor because a loop of two has every pair both one step
     * forward and one step back, so no displacement claim distinguishes
     * anything.
     */
    modulus?: number;
}

export function isCircular(axis: AxisSpec): boolean {
    return !!axis.modulus && axis.modulus >= 3 && !!axis.scale.cyclic;
}

/**
 * Default axis stacks by dimension count.
 *
 * Three is ordinary space. Four adds time, which is the usual next dimension
 * and the one v4 already had. Five adds containment and six quantity — both
 * chosen because they are *not* spatial, so the extra load is holding a
 * different kind of relation rather than one more direction.
 */
export const DIMENSION_AXES: Record<number, LinearScale[]> = {
    3: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"]],
    4: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"]],
    5: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"]],
    6: [SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
        LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"], LINEAR_SCALES["quantity"]],
};

/** Every scale that can serve as an axis, for the configuration UI. */
export const AXIS_CHOICES: LinearScale[] = [
    SPATIAL_SCALES["east"], SPATIAL_SCALES["north"], SPATIAL_SCALES["up"],
    LINEAR_SCALES["temporal"], LINEAR_SCALES["contains"],
    LINEAR_SCALES["quantity"], LINEAR_SCALES["vertical"], LINEAR_SCALES["horizontal"],
];

export function axesForDimensions(dims: number): LinearScale[] {
    if (DIMENSION_AXES[dims]) return DIMENSION_AXES[dims];
    // Beyond the named presets, keep extending from the choice list so a
    // seven-dimensional space is a configuration rather than an error.
    const out = [...DIMENSION_AXES[6]];
    for (const s of AXIS_CHOICES) {
        if (out.length >= dims) break;
        if (!out.includes(s)) out.push(s);
    }
    return out.slice(0, Math.max(1, dims));
}

/* ------------------------------------------------------------------ *
 * Axis order                                                          *
 * ------------------------------------------------------------------ */

/**
 * Which end of a premise an axis is read at.
 *
 * A premise states every axis at once, in axis-list order, so that order is
 * the order the clauses are read in: "east, same latitude, above and later".
 * Which one comes first is not neutral — the first clause is the one that gets
 * a whole mind to itself, and the last is the one being held while the rest are
 * placed. Anyone who spatialises these has a habitual order, and an item that
 * states them the other way round is measurably harder for no reason connected
 * to the reasoning.
 *
 * So it is a setting rather than a constant. These are the orders worth having
 * as one click; anything else is reachable by moving axes individually.
 */
export type AxisOrdering = "spatial-first" | "spatial-last" | "longitude-last" | "reverse";

export const AXIS_ORDERINGS: Array<{ id: AxisOrdering; label: string; hint: string }> = [
    { id: "spatial-first", label: "Spatial first",
      hint: "The default: east–west, north–south, up–down, then the rest" },
    { id: "spatial-last", label: "Spatial last",
      hint: "The non-spatial dimensions first, the three spatial ones after them" },
    { id: "longitude-last", label: "Longitude last",
      hint: "East–west moved to the very end, wherever the others sit" },
    { id: "reverse", label: "Reverse", hint: "Flip the order end for end" },
];

/** The three axes of ordinary space, by id. */
const SPATIAL_IDS = new Set(["east", "north", "up"]);

/** Rank in the canonical stack, for restoring the preset order. */
const CANONICAL_RANK = new Map(AXIS_CHOICES.map((s, i) => [s.id, i]));

export function reorderAxisIds(ids: string[], how: AxisOrdering): string[] {
    const out = [...ids];
    switch (how) {
        case "spatial-first":
            // Stable on rank rather than a fixed list, so a stack containing
            // scales the presets never use still comes out in a sane order.
            return out.sort((a, b) =>
                (CANONICAL_RANK.get(a) ?? 99) - (CANONICAL_RANK.get(b) ?? 99));
        case "spatial-last":
            return [...out.filter(id => !SPATIAL_IDS.has(id)), ...out.filter(id => SPATIAL_IDS.has(id))];
        case "longitude-last":
            return [...out.filter(id => id !== "east"), ...out.filter(id => id === "east")];
        case "reverse":
            return out.reverse();
    }
}

/* ------------------------------------------------------------------ *
 * Axis colour                                                         *
 * ------------------------------------------------------------------ */

/**
 * Palette slot per axis, so a dimension keeps its colour between items.
 *
 * Assigned by *identity*, not by position. Position would be simpler, but it
 * would repaint every axis the moment the order is changed and would give east
 * one colour in a 4D item and another in a 6D one — and the whole value of the
 * colour is the association it builds up over many items. Time is violet
 * wherever it sits in the premise.
 *
 * The numbers are slots into `--th-dim-N`, which the theme resolves; nothing
 * here knows what colour anything actually is.
 */
const AXIS_COLOR_SLOT: Record<string, number> = {
    east: 1, north: 2, up: 3, temporal: 4, contains: 5, quantity: 6,
    vertical: 7, horizontal: 8,
};

/** How many slots the stylesheet defines. */
export const DIM_SLOTS = 8;

/**
 * A colour class per axis, distinct within the stack.
 *
 * Two passes for the same reason `ndAxisLabels` needs two: the preferred slot
 * may be taken by an axis this stack also contains, and two dimensions sharing
 * a colour is worse than either of them being off its usual one.
 */
export function ndAxisColors(axes: AxisSpec[]): string[] {
    const taken = new Set<number>();
    const preferred = axes.map(a => {
        const want = AXIS_COLOR_SLOT[a.scale.id];
        if (want && !taken.has(want)) { taken.add(want); return want; }
        return 0;
    });

    let next = 1;
    return preferred.map(slot => {
        if (slot) return dimClass(slot);
        while (next <= DIM_SLOTS && taken.has(next)) next++;
        const free = next <= DIM_SLOTS ? next : 1;
        taken.add(free);
        return dimClass(free);
    });
}

/** The class pair for a slot: the generic hook, then the slot itself. */
export function dimClass(slot: number): string {
    return `dim dim-${slot}`;
}

/* ------------------------------------------------------------------ *
 * Layout                                                              *
 * ------------------------------------------------------------------ */

export interface NdEdge {
    from: string;
    to: string;
    /** Step taken on each axis going from -> to; -1, 0 or +1. */
    deltas: number[];
}

export interface NdLayout {
    words: string[];
    axes: AxisSpec[];
    /** Position on every axis, already reduced mod modulus where circular. */
    coords: Record<string, number[]>;
    edges: NdEdge[];
    neighbors: Record<string, string[]>;
    branching: boolean;
}

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Positive remainder — JavaScript's % keeps the sign of the dividend. */
export function mod(n: number, m: number): number {
    return ((n % m) + m) % m;
}

export interface NdBuildOptions {
    branching?: boolean;
    /** Chance an axis takes no step on a given edge, producing ties. */
    tieChance?: number;
}

export function buildNdLayout(
    words: string[],
    axes: AxisSpec[],
    options: NdBuildOptions = {},
): NdLayout {
    const tieChance = options.tieChance ?? 0.22;
    const shape: LinearLayout = options.branching ? buildBranching(words) : buildChain(words);

    const edges: NdEdge[] = shape.edges.map(([from, to]) => {
        let deltas: number[];
        do {
            deltas = axes.map(() => (Math.random() < tieChance ? 0 : pick([-1, 1])));
            // All zero would put two objects at the same point on every axis,
            // which states nothing and cannot be asked about.
        } while (deltas.every(d => d === 0));
        return { from, to, deltas };
    });

    // Walk the tree from an arbitrary root, accumulating each axis.
    const coords: Record<string, number[]> = { [words[0]]: axes.map(() => 0) };
    const byNode = new Map<string, Array<{ other: string; deltas: number[]; sign: number }>>();
    for (const e of edges) {
        if (!byNode.has(e.from)) byNode.set(e.from, []);
        if (!byNode.has(e.to)) byNode.set(e.to, []);
        byNode.get(e.from)!.push({ other: e.to, deltas: e.deltas, sign: 1 });
        byNode.get(e.to)!.push({ other: e.from, deltas: e.deltas, sign: -1 });
    }

    const queue = [words[0]];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const step of byNode.get(cur) ?? []) {
            if (coords[step.other]) continue;
            coords[step.other] = coords[cur].map((v, i) => v + step.sign * step.deltas[i]);
            queue.push(step.other);
        }
    }

    // Reduce circular axes once, at the end: accumulating first and wrapping
    // after is the same result and keeps the walk above axis-agnostic.
    for (const w of words) {
        axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
        });
    }

    return { words, axes, coords, edges, neighbors: shape.neighbors, branching: !!options.branching };
}

/* ------------------------------------------------------------------ *
 * Editing the premises                                                *
 * ------------------------------------------------------------------ */

/**
 * Operations that rewrite a *stated relation* rather than move an object.
 *
 * Every other modifier in the app mutates the model: things change place and
 * you re-derive. These mutate the premise set itself, which is a different
 * task — you have to hold the statements as data and edit them, then read the
 * model off the result.
 *
 * All three are arithmetic on the delta vector an edge already carries, which
 * is what makes them cheap here:
 *
 *   reverse   negate one edge's vector
 *   swap      exchange two edges' vectors
 *   copy      overwrite one edge's vector with another's
 *
 * None can produce an unsatisfiable premise set. The stated pairs form a tree,
 * and *any* assignment of vectors to a tree's edges yields exactly one
 * consistent layout — so an edit always leaves something well-formed to answer
 * about. That is not obvious, and it is what makes premise-rewriting safe here
 * where an arbitrary mechanism would not be.
 */
export type NdEditKind = "reverse" | "swap" | "copy";

export interface NdEdit {
    kind: NdEditKind;
    /** Index into `layout.edges` of the relation being changed. */
    target: number;
    /** The other relation, for swap and copy. */
    other?: number;
}

/** Apply edits in order and re-derive the layout they describe. */
export function applyNdEdits(layout: NdLayout, edits: NdEdit[]): NdLayout {
    const edges = layout.edges.map(e => ({ ...e, deltas: [...e.deltas] }));

    for (const edit of edits) {
        const t = edges[edit.target];
        if (!t) continue;
        if (edit.kind === "reverse") {
            t.deltas = t.deltas.map(d => -d);
            continue;
        }
        const o = edges[edit.other!];
        if (!o) continue;
        if (edit.kind === "copy") {
            t.deltas = [...o.deltas];
        } else {
            const keep = t.deltas;
            t.deltas = o.deltas;
            o.deltas = keep;
        }
    }

    return { ...layout, edges, coords: coordsFromEdges(layout, edges) };
}

/** Walk the tree from an arbitrary root, accumulating each axis. */
function coordsFromEdges(layout: NdLayout, edges: NdEdge[]): Record<string, number[]> {
    const { words, axes } = layout;
    const coords: Record<string, number[]> = { [words[0]]: axes.map(() => 0) };
    const byNode = new Map<string, Array<{ other: string; deltas: number[]; sign: number }>>();

    for (const e of edges) {
        if (!byNode.has(e.from)) byNode.set(e.from, []);
        if (!byNode.has(e.to)) byNode.set(e.to, []);
        byNode.get(e.from)!.push({ other: e.to, deltas: e.deltas, sign: 1 });
        byNode.get(e.to)!.push({ other: e.from, deltas: e.deltas, sign: -1 });
    }

    const queue = [words[0]];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const step of byNode.get(cur) ?? []) {
            if (coords[step.other]) continue;
            coords[step.other] = coords[cur].map((v, i) => v + step.sign * step.deltas[i]);
            queue.push(step.other);
        }
    }

    for (const w of words) {
        axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
        });
    }
    return coords;
}

/**
 * Draw a list of edits.
 *
 * A relation is never edited twice: the second edit would silently undo or
 * mask the first, and the reader has no way to tell which of two statements
 * about the same pair is meant to win.
 */
export function drawNdEdits(layout: NdLayout, count: number): NdEdit[] {
    const n = layout.edges.length;
    if (n < 2 || count < 1) return [];

    const free = [...Array(n).keys()];
    const out: NdEdit[] = [];

    for (let guard = 0; out.length < count && free.length && guard < count * 20; guard++) {
        const kinds: NdEditKind[] = free.length >= 2
            ? ["reverse", "swap", "copy"]
            : ["reverse"];
        const kind = pick(kinds);

        const ti = Math.floor(Math.random() * free.length);
        const target = free.splice(ti, 1)[0];

        if (kind === "reverse") { out.push({ kind, target }); continue; }

        const oi = Math.floor(Math.random() * free.length);
        // Swap consumes both relations; copy only rewrites the target, so its
        // source stays editable — but not by a later edit, or the value copied
        // would no longer be the one the player was shown.
        const other = kind === "swap" ? free.splice(oi, 1)[0] : free[oi];
        if (kind === "copy") free.splice(oi, 1);
        out.push({ kind, target, other });
    }

    return out;
}

export function renderNdEdit(layout: NdLayout, edit: NdEdit): string {
    const t = layout.edges[edit.target];
    const pair = (e: NdEdge) => `${subj(e.from)} ${hi("→")} ${subj(e.to)}`;

    if (edit.kind === "reverse") {
        return `the relation ${pair(t)} is ${hi("reversed")}`;
    }
    const o = layout.edges[edit.other!];
    if (edit.kind === "swap") {
        return `the relations ${pair(t)} and ${pair(o)} are ${hi("exchanged")}`;
    }
    return `${pair(t)} becomes ${hi("the same relation as")} ${pair(o)}`;
}

/* ------------------------------------------------------------------ *
 * Transforming the space                                              *
 * ------------------------------------------------------------------ */

/**
 * Short axis labels, for operation names like "XT-rotated".
 *
 * The spatial scales carry their own ("X", "Y", "Z"); the rest deliberately do
 * not, because a one-axis mode labelling its only axis adds a word and no
 * information. Composed spaces need one per axis regardless, so the missing
 * ones are supplied here rather than by changing what a scale means elsewhere.
 */
const AXIS_LETTERS: Record<string, string> = {
    temporal: "T", contains: "C", quantity: "Q", vertical: "H", horizontal: "L",
};

export function ndAxisLabels(axes: AxisSpec[]): string[] {
    const used = new Set<string>();
    return axes.map(a => {
        const base = a.scale.axisName || AXIS_LETTERS[a.scale.id] || a.scale.id[0].toUpperCase();
        let label = base;
        for (let n = 2; used.has(label); n++) label = base + n;
        used.add(label);
        return label;
    });
}

/**
 * Words the transformation engine should use for this axis stack.
 *
 * Circular axes hand over their cyclic wording rather than their linear
 * wording. The premises already describe a looped east axis as
 * clockwise/anticlockwise, and a transformation premise saying "moves 2 east"
 * about the same axis would be describing a different space than the one being
 * reasoned about.
 */
export function ndTransformVocab(axes: AxisSpec[]): TransformVocab {
    return {
        axisNames: ndAxisLabels(axes),
        axisWords: axes.map(a => isCircular(a) ? a.scale.cyclic!.direction : a.scale.direction),
        link: axes.map(a => isCircular(a) ? a.scale.cyclic!.link : a.scale.link),
        // So an operation premise paints "2 east" the same as the relation
        // premises do. Without it the two halves of a transformed item would
        // use the same words in different colours, which is worse than none.
        axisClasses: ndAxisColors(axes),
    };
}

/**
 * Draw transformations over a composed space.
 *
 * The interesting operation here is `rotate`, and it is interesting for a
 * reason that only exists once axes stop being spatial: a quarter turn in the
 * XT plane exchanges displacement along east/west with displacement along
 * later/earlier, so *west becomes earlier*. There is no spatial intuition to
 * fall back on and no crystallised relation to recall — the mapping has to be
 * applied as a mapping. That is the whole argument for putting transformations
 * in here rather than leaving them in the 3D modes.
 *
 * Circular axes are excluded from rotation planes but not from anything else;
 * see `rotationAxes`.
 */
export function drawNdTransforms(layout: NdLayout, count: number): Transform[] {
    const straight = layout.axes
        .map((a, i) => (isCircular(a) ? -1 : i))
        .filter(i => i >= 0);

    return drawTransforms(layout.words, count, {
        dims: layout.axes.length,
        rotationAxes: straight,
        // Premise steps are one unit, so a stated jump of three reads as a
        // different order of magnitude from everything around it.
        maxOffset: 2,
        multiAxisChance: 0.3,
    }, ndTransformVocab(layout.axes));
}

/** Replay operations over the positions and re-derive the space. */
export function applyNdTransforms(layout: NdLayout, transforms: Transform[]): NdLayout {
    const coords = replay(layout.coords, transforms);

    // Operations are ordinary integer arithmetic and know nothing about loops,
    // so anything that wrapped is brought back onto the ring afterwards —
    // the same order buildNdLayout uses, and for the same reason.
    for (const w of layout.words) {
        layout.axes.forEach((axis, i) => {
            if (isCircular(axis)) coords[w][i] = mod(coords[w][i], axis.modulus!);
        });
    }

    return { ...layout, coords };
}

/**
 * The axis key, for the setup block.
 *
 * Required rather than decorative once rotation is in play: "XT-rotated" is
 * unreadable without knowing which axes X and T are, and unlike every other
 * operation name it cannot be inferred from the direction words in the
 * premises.
 */
export function describeNdAxes(axes: AxisSpec[]): string {
    const labels = ndAxisLabels(axes);
    const colors = ndAxisColors(axes);
    // Carries the colours too, which makes the same line a key for them —
    // free, since it is already a list with one entry per axis.
    const parts = axes.map((a, i) => {
        const [pos, neg] = isCircular(a) ? a.scale.cyclic!.direction : a.scale.direction;
        return hi(`<b>${labels[i]}</b> ${pos}/${neg}`, colors[i]);
    });
    return `Axis labels: ${parts.join(", ")}.`;
}

/* ------------------------------------------------------------------ *
 * Reading a layout                                                    *
 * ------------------------------------------------------------------ */

/** -1, 0 or 1 on a straight axis. Meaningless on a circular one. */
export function compareOn(layout: NdLayout, axis: number, a: string, b: string): -1 | 0 | 1 {
    const d = layout.coords[a][axis] - layout.coords[b][axis];
    return d === 0 ? 0 : (d > 0 ? 1 : -1);
}

/** Steps from b forward to a, on a circular axis. */
export function displacementOn(layout: NdLayout, axis: number, a: string, b: string): number {
    const m = layout.axes[axis].modulus!;
    return mod(layout.coords[a][axis] - layout.coords[b][axis], m);
}

/** Steps between two objects through the stated premises. */
export function graphDistance(a: string, b: string, neighbors: Record<string, string[]>): number {
    if (a === b) return 0;
    const seen = new Set([a]);
    let layer = [a], dist = 0;
    while (layer.length) {
        dist++;
        const next: string[] = [];
        for (const node of layer) {
            for (const n of neighbors[node] ?? []) {
                if (seen.has(n)) continue;
                if (n === b) return dist;
                seen.add(n);
                next.push(n);
            }
        }
        layer = next;
    }
    return Infinity;
}

/** A pair far enough apart that the answer has to be composed, not read off. */
export function pickDistantPair(layout: NdLayout, minSpan = 2): [string, string] | null {
    const pairs: Array<[string, string, number]> = [];
    for (let i = 0; i < layout.words.length; i++) {
        for (let j = i + 1; j < layout.words.length; j++) {
            const d = graphDistance(layout.words[i], layout.words[j], layout.neighbors);
            if (Number.isFinite(d) && d >= minSpan) pairs.push([layout.words[i], layout.words[j], d]);
        }
    }
    if (!pairs.length) return null;

    // Prefer the furthest, but not exclusively, so difficulty varies.
    const max = Math.max(...pairs.map(p => p[2]));
    const band = Math.random() < 0.7
        ? pairs.filter(p => p[2] === max)
        : pairs;
    const chosen = pick(band);
    return [chosen[0], chosen[1]];
}

/* ------------------------------------------------------------------ *
 * Phrasing                                                            *
 * ------------------------------------------------------------------ */

/** `color` is an axis colour class, for a phrase that belongs to one axis. */

/** The clause one axis contributes to a premise. */
function axisClause(axis: AxisSpec, delta: number): string {
    if (isCircular(axis)) {
        const c = axis.scale.cyclic!;
        if (delta === 0) return axis.scale.tie;
        return delta > 0 ? c.direction[0] : c.direction[1];
    }
    if (delta === 0) return axis.scale.tie;
    return delta > 0 ? axis.scale.direction[0] : axis.scale.direction[1];
}

export interface NdRenderOptions {
    /**
     * Leave out the axes with no difference.
     *
     * Sound only because the convention is stated with the item: an axis that
     * goes unmentioned means no difference on it, so the layout is still fully
     * determined. Without that line "not mentioned" and "no difference" are
     * indistinguishable and the axis the conclusion asks about may not be
     * derivable at all.
     *
     * Worth having because a six-axis premise naming every axis is six clauses
     * long, and most of them are usually "same". Shorter to read, and slightly
     * harder: you can no longer tick the axes off as you go.
     */
    compact?: boolean;
}

/** One premise, naming the axes this pair differs on. */
export function renderNdPremise(
    layout: NdLayout,
    edge: NdEdge,
    flip: boolean,
    options: NdRenderOptions = {},
): string {
    const [from, to] = flip ? [edge.to, edge.from] : [edge.from, edge.to];
    const sign = flip ? -1 : 1;
    const colors = ndAxisColors(layout.axes);

    /*
     * One span per axis rather than one around the lot.
     *
     * The clause list is the whole premise, and at five or six dimensions it is
     * a run of similar-looking phrases that have to be split apart before any
     * of them can be used. Colouring each by its axis does that splitting for
     * the reader, and does it the same way in every premise — so the three
     * mentions of the time axis across three premises are found by colour
     * instead of by re-reading. Position cannot do this job once the order is
     * configurable, and `compact` already removes clauses from the middle.
     */
    const clauses = layout.axes
        .map((axis, i) => ({ axis, i, delta: sign * edge.deltas[i] }))
        .filter(c => !options.compact || c.delta !== 0)
        .map(c => hi(axisClause(c.axis, c.delta), colors[c.i]));

    // Every edge moves on at least one axis, so this cannot be empty — but a
    // hand-built layout could be, and an empty clause list reads as a bug.
    if (!clauses.length) return `${subj(to)} is at the same point as ${subj(from)}`;

    return `${subj(to)} is ${clauses.join(", ")} relative to ${subj(from)}`;
}

export function renderNdPremises(layout: NdLayout, options: NdRenderOptions = {}): string[] {
    return layout.edges.map(e => renderNdPremise(layout, e, Math.random() > 0.5, options));
}

export interface NdConclusion {
    text: string;
    isValid: boolean;
    axis: number;
    /** The pair asked about, so callers can check an edit changed it. */
    a: string;
    b: string;
}

/**
 * A claim about one axis, true or false by construction.
 *
 * Straight axes get an ordering claim. Circular axes get a displacement claim,
 * because ordering has no meaning on a ring — asking whether one point is
 * "east of" another when you can travel either way round is not a question with
 * an answer, and generating it would produce items whose stated answer is
 * arbitrary.
 */
export function buildNdConclusion(
    layout: NdLayout,
    a: string,
    b: string,
    axisIndex: number,
    wantValid: boolean,
): NdConclusion {
    const axis = layout.axes[axisIndex];
    // The conclusion names one axis, so it is painted like that axis's clauses
    // — which says *which* dimension is being asked about before the sentence
    // is read, and matters most in the modes that ask about several.
    const color = ndAxisColors(layout.axes)[axisIndex];

    if (isCircular(axis)) {
        const c = axis.scale.cyclic!;
        const m = axis.modulus!;
        const truth = displacementOn(layout, axisIndex, a, b);

        const claim = wantValid ? truth : pickWrongDisplacement(truth, m);
        return { text: displacementText(a, b, claim, m, c, color), isValid: claim === truth, axis: axisIndex, a, b };
    }

    const truth = compareOn(layout, axisIndex, a, b);
    const kinds: Array<-1 | 0 | 1> = [-1, 0, 1];
    const claim = wantValid ? truth : pick(kinds.filter(k => k !== truth));
    const word = claim === 0 ? axis.scale.same : (claim > 0 ? axis.scale.above : axis.scale.below);

    return {
        text: `${subj(a)} ${rel(word, color)} ${subj(b)}`,
        isValid: claim === truth,
        axis: axisIndex,
        a, b,
    };
}

/** Wrong by a genuine amount — off by one is the interesting near miss. */
function pickWrongDisplacement(truth: number, m: number): number {
    const options: number[] = [];
    for (let d = 0; d < m; d++) if (d !== truth) options.push(d);
    if (!options.length) return truth;
    const near = options.filter(d => mod(d - truth, m) === 1 || mod(truth - d, m) === 1);
    return near.length && Math.random() < 0.6 ? pick(near) : pick(options);
}

function displacementText(
    a: string,
    b: string,
    steps: number,
    m: number,
    c: NonNullable<LinearScale["cyclic"]>,
    color = "",
): string {
    if (steps === 0) return `${subj(a)} ${rel(c.same, color)} ${subj(b)}`;
    if (m % 2 === 0 && steps === m / 2) return `${subj(a)} ${rel(c.opposite, color)} ${subj(b)}`;
    // Say it the short way round, which is how anyone reads a dial.
    const forward = steps <= m / 2;
    const n = forward ? steps : m - steps;
    const dir = forward ? c.direction[0] : c.direction[1];
    const noun = n === 1 ? c.step : c.step + "s";
    return `${subj(a)} ${rel(`is ${n} ${noun} ${dir} ${c.link}`, color)} ${subj(b)}`;
}

/* ------------------------------------------------------------------ *
 * Analogy — relations between relations                               *
 * ------------------------------------------------------------------ */

/**
 * "A to B is the same relation as C to D."
 *
 * Every other claim in this file is first-order: it names two objects and asks
 * where one sits relative to the other. This one takes two *relations* as its
 * terms, which is a different operation — the relation has to be held as an
 * object before it can be compared to another one. That is what analogy is, and
 * it is why this belongs as a question form available to every layout rather
 * than as a mode of its own.
 *
 * Matching is on **direction per axis, not distance**. Two reasons: the premises
 * state directions, so this is the sense of "same relation" the item's own
 * language establishes; and exact vector equality between derived pairs is rare
 * enough in six dimensions to be unusable. The convention is stated with the
 * item either way, because "same relation" is otherwise ambiguous.
 */
export interface NdAnalogy {
    text: string;
    isValid: boolean;
    /** a→b compared against c→d. */
    pairs: [string, string, string, string];
    claimSame: boolean;
}

/** Sign per axis, as a comparable key. Circular axes compare by displacement. */
function relationKey(layout: NdLayout, a: string, b: string): string {
    return layout.axes.map((axis, i) => isCircular(axis)
        ? displacementOn(layout, i, b, a)
        : Math.sign(layout.coords[b][i] - layout.coords[a][i])).join(",");
}

/** The key a relation would have if every direction were reversed. */
function reversedKey(layout: NdLayout, key: string): string {
    return key.split(",").map((v, i) => {
        const axis = layout.axes[i];
        // On a ring, reversing is going the other way round, which is not
        // negation of a signed step but the complement modulo the loop.
        if (isCircular(axis)) return mod(-Number(v), axis.modulus!);
        return -Number(v);
    }).join(",");
}

/**
 * Ordered pairs whose relation has to be derived rather than read.
 *
 * A pair stated as a premise makes the analogy a comparison of two sentences.
 * All-zero relations are dropped too: a relation with no direction on any axis
 * is its own reverse, so "same" and "opposite" stop being different claims.
 */
function derivedPairs(layout: NdLayout): Array<{ a: string; b: string; key: string }> {
    const out: Array<{ a: string; b: string; key: string }> = [];
    const zero = layout.axes.map(() => 0).join(",");
    for (const a of layout.words) {
        for (const b of layout.words) {
            if (a === b) continue;
            if (graphDistance(a, b, layout.neighbors) < 2) continue;
            const key = relationKey(layout, a, b);
            if (key === zero) continue;
            out.push({ a, b, key });
        }
    }
    return out;
}

export function buildNdAnalogy(
    layout: NdLayout,
    wantValid: boolean,
    claimSame = Math.random() < 0.5,
    /**
     * Extra condition every candidate must meet — used to require that the
     * item's operations actually change this claim's truth.
     *
     * A filter over the whole candidate set rather than a test applied to one
     * drawn claim, and the difference is not cosmetic. There are typically
     * dozens of matching pairs and only some are touched by an operation, so
     * drawing first and testing after fails almost always; filtering finds one
     * whenever one exists.
     */
    accept?: (candidate: { pairs: [string, string, string, string]; claimSame: boolean }) => boolean,
): NdAnalogy | null {
    const pairs = derivedPairs(layout);
    if (pairs.length < 2) return null;

    const candidates: Array<[typeof pairs[0], typeof pairs[0]]> = [];
    for (const first of pairs) {
        // What the second relation must be for the claim to hold.
        const target = claimSame ? first.key : reversedKey(layout, first.key);
        for (const second of pairs) {
            // Four distinct objects: sharing one makes the claim a statement
            // about two objects coinciding rather than about two relations.
            if (second.a === first.a || second.a === first.b) continue;
            if (second.b === first.a || second.b === first.b) continue;
            if ((second.key === target) !== wantValid) continue;
            if (accept && !accept({ pairs: [first.a, first.b, second.a, second.b], claimSame })) continue;
            candidates.push([first, second]);
        }
    }
    if (!candidates.length) return null;

    const [first, second] = pick(candidates);
    const word = claimSame ? "is the same relation as" : "is the opposite relation to";
    return {
        text: `${subj(first.a)} to ${subj(first.b)} ${rel(word)} ${subj(second.a)} to ${subj(second.b)}`,
        isValid: wantValid,
        pairs: [first.a, first.b, second.a, second.b],
        claimSame,
    };
}

/** Distinct analogy claims, for the multi-conclusion and choice modes. */
export function buildNdAnalogySet(
    layout: NdLayout,
    wantValid: boolean[],
    accept?: (candidate: { pairs: [string, string, string, string]; claimSame: boolean }) => boolean,
): NdAnalogy[] {
    const used = new Set<string>();
    const out: NdAnalogy[] = [];

    for (let guard = 0; out.length < wantValid.length && guard < wantValid.length * 60; guard++) {
        // Only the first claim carries the "operations must matter" condition:
        // requiring it of every claim in a set is a much stronger demand than
        // the item needs, and one that most layouts cannot meet.
        const claim = buildNdAnalogy(layout, wantValid[out.length], undefined,
            out.length === 0 ? accept : undefined);
        if (!claim) break;
        const key = claim.pairs.join(" ") + "#" + claim.claimSame;
        if (used.has(key)) continue;
        used.add(key);
        out.push(claim);
    }
    return out;
}

/**
 * The full relation between a pair, one slot per dimension.
 *
 * Every axis has to be filled, which is what makes this worth having: judging a
 * single claim tests one dimension and can be got right by luck, whereas
 * stating all of them tests whether the whole structure was actually carried.
 * A six-axis item has a one-in-729 guess floor.
 *
 * Circular axes offer every displacement rather than three orderings, since
 * ordering has no meaning on a ring — so they are harder slots, correctly.
 */
export function buildNdConstructClaim(
    layout: NdLayout,
    a: string,
    b: string,
    withDistance: boolean,
): ConstructClaim {
    const colors = ndAxisColors(layout.axes);

    const slots = layout.axes.map((axis, i) => {
        const scale = axis.scale;

        if (isCircular(axis)) {
            const c = scale.cyclic!;
            const m = axis.modulus!;
            const steps = displacementOn(layout, i, a, b);
            // Stated the short way round, which is how anyone reads a dial —
            // but judged modulo the loop, so the long way round also passes.
            const forward = steps <= m / 2;
            return {
                label: scale.name,
                colorClass: colors[i],
                directions: [c.direction[0], c.direction[1], c.same] as [string, string, string],
                answerDirection: (steps === 0 ? 2 : (forward ? 0 : 1)) as 0 | 1 | 2,
                answerMagnitude: steps === 0 ? 0 : (forward ? steps : m - steps),
                asksDistance: withDistance,
                modulus: m,
            };
        }

        const delta = layout.coords[a][i] - layout.coords[b][i];
        return {
            label: scale.name,
            colorClass: colors[i],
            directions: [scale.above, scale.below, scale.same] as [string, string, string],
            answerDirection: (delta === 0 ? 2 : (delta > 0 ? 0 : 1)) as 0 | 1 | 2,
            answerMagnitude: Math.abs(delta),
            asksDistance: withDistance,
        };
    });

    return { a, b, slots };
}

/** The bare relation phrase for a displacement, without the subjects. */
function displacementPhrase(steps: number, m: number, c: NonNullable<LinearScale["cyclic"]>): string {
    if (steps === 0) return c.same;
    if (m % 2 === 0 && steps === m / 2) return c.opposite;
    const forward = steps <= m / 2;
    const n = forward ? steps : m - steps;
    const dir = forward ? c.direction[0] : c.direction[1];
    return `is ${n} ${n === 1 ? c.step : c.step + "s"} ${dir} ${c.link}`;
}

/**
 * Distinct claims, for the multi-conclusion and choice modes.
 *
 * Distinct in *pair and axis together*, so a set can ask about the same two
 * objects along different dimensions — which is the interesting case in a space
 * with several, and the one that rewards having tracked all of them.
 */
export function buildNdConclusionSet(
    layout: NdLayout,
    count: number,
    wantValid: boolean[],
): NdConclusion[] {
    const used = new Set<string>();
    const out: NdConclusion[] = [];

    for (let guard = 0; out.length < count && guard < count * 60; guard++) {
        const pair = pickDistantPair(layout);
        if (!pair) break;
        const axisIndex = Math.floor(Math.random() * layout.axes.length);
        const key = [...pair].sort().join(" ") + "#" + axisIndex;
        if (used.has(key)) continue;
        used.add(key);
        out.push(buildNdConclusion(layout, pair[0], pair[1], axisIndex, wantValid[out.length]));
    }

    return out;
}

/**
 * Whether a set of axes can be told apart in a premise.
 *
 * Clauses are read by their words, not their position, so two axes sharing a
 * direction word ("higher" belongs to both quantity and vertical) would make a
 * premise ambiguous to a reader even though the generator knows what it meant.
 * The defaults are clean; this exists because the axis list is configurable.
 */
export function axisWordConflicts(scales: LinearScale[]): string[] {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of scales) {
        for (const w of [...s.direction, s.tie]) {
            const owner = seen.get(w);
            if (owner && owner !== s.id) clashes.push(`"${w}" is used by both ${owner} and ${s.id}`);
            else seen.set(w, s.id);
        }
    }
    return clashes;
}

/* ------------------------------------------------------------------ *
 * Explaining an answer                                                *
 * ------------------------------------------------------------------ */

/** Steps between two objects through the stated premises, as a path. */
function pathBetween(layout: NdLayout, a: string, b: string): string[] | null {
    if (a === b) return [a];
    const prev: Record<string, string> = {};
    const seen = new Set([a]);
    const queue = [a];

    while (queue.length) {
        const cur = queue.shift()!;
        for (const n of layout.neighbors[cur] ?? []) {
            if (seen.has(n)) continue;
            seen.add(n);
            prev[n] = cur;
            if (n === b) {
                const out = [b];
                let step = b;
                while (step !== a) { step = prev[step]; out.unshift(step); }
                return out;
            }
            queue.push(n);
        }
    }
    return null;
}

/** The edge joining two adjacent objects, and which way round it was stored. */
function edgeBetween(layout: NdLayout, u: string, v: string): { edge: NdEdge; sign: number } | null {
    for (const edge of layout.edges) {
        if (edge.from === u && edge.to === v) return { edge, sign: 1 };
        if (edge.from === v && edge.to === u) return { edge, sign: -1 };
    }
    return null;
}

/**
 * Why the answer is what it is, one premise at a time.
 *
 * Walks the chain of stated relations joining the pair and accumulates the
 * queried axis along it, so the reader sees the same derivation they were meant
 * to perform rather than just the verdict.
 *
 * Only sound while positions are the sum of the stated steps. Edits keep that
 * property — they rewrite an edge's vector and the layout is re-derived from
 * edges — but transformations set coordinates directly, so a path no longer
 * accounts for where something ended up. Those items get nothing rather than a
 * confident fiction.
 */
export function explainNdAxis(
    layout: NdLayout,
    a: string,
    b: string,
    axisIndex: number,
): string[] {
    const path = pathBetween(layout, a, b);
    if (!path || path.length < 2) return [];

    const axis = layout.axes[axisIndex];
    // Every line of a derivation is about the one axis being explained, so it
    // is painted like that axis throughout — the same cue the premises use.
    const color = ndAxisColors(layout.axes)[axisIndex];
    const lines: string[] = [];
    let total = 0;

    for (let i = 0; i < path.length - 1; i++) {
        const found = edgeBetween(layout, path[i], path[i + 1]);
        if (!found) return [];
        const delta = found.sign * found.edge.deltas[axisIndex];
        total += delta;

        const word = delta === 0 ? axis.scale.tie : axisClause(axis, delta);
        const running = isCircular(axis)
            ? `running total ${mod(total, axis.modulus!)}`
            : `running total ${total > 0 ? "+" : ""}${total}`;
        lines.push(
            `${subj(path[i + 1])} is ${hi(word, color)} relative to ${subj(path[i])}`
            + ` — ${rel(running)}`);
    }

    /*
     * Phrased exactly as the conclusion is, by the same rule — `scale.above` and
     * friends are whole clauses ("is south of"), not adjectives, so nothing may
     * be prefixed to them. The walk runs from the *second* named object to the
     * first because `compareOn(a, b)` means "a relative to b", and accumulating
     * a → b gives the opposite sign.
     */
    /*
     * Closed with the *same* phrase builder the conclusion uses. Writing a
     * second wording here produced derivations that were true but did not look
     * like the claim they were explaining — "2 steps round" against a claim of
     * "diametrically opposite" — which makes the reader check two things
     * instead of one.
     */
    const word = isCircular(axis)
        ? displacementPhrase(mod(total, axis.modulus!), axis.modulus!, axis.scale.cyclic!)
        : total === 0 ? axis.scale.same : (total > 0 ? axis.scale.above : axis.scale.below);

    lines.push(`so ${subj(b)} ${rel(word, color)} ${subj(a)}`);
    return lines;
}

/**
 * How much of the declared space an item actually uses, in bits.
 *
 * Two things vary between items the difficulty model treats as identical: how
 * many axes carry any difference at all, and how far apart things sit on the
 * ones that do. Both are "how much of this axis must be kept straight", and
 * summing log2 of the distinct positions per axis measures them as one quantity
 * — the bits needed to locate an object in the space. A dead axis contributes
 * nothing, three positions contribute 1.58, seven contribute 2.81.
 *
 * Measured over 3,000 layouts per configuration, six-dimensional items at six
 * objects range from 6.6 to 13.3 bits. That is a twofold spread in what the
 * player actually has to hold, and it currently lands in the ability posterior
 * as noise.
 *
 * Note this is *not* a substitute for premise count. Width grows logarithmically
 * with size while premises grow linearly: 3 to 7 premises at three dimensions
 * moves width 4.1 → 5.7 bits. Premises add chain to traverse, width adds state
 * to hold, and they are separate quantities.
 */
export function ndWidth(layout: NdLayout): number {
    return layout.axes.reduce((total, _, i) => {
        const values = new Set(layout.words.map(w => layout.coords[w][i]));
        return total + Math.log2(values.size);
    }, 0);
}

/** Axes carrying any difference at all; the rest are declared but inert. */
export function ndLiveAxes(layout: NdLayout): number {
    return layout.axes.filter((_, i) =>
        new Set(layout.words.map(w => layout.coords[w][i])).size > 1).length;
}
