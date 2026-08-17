/**
 * Spatial transformations.
 *
 * Originally ported from Syllogimous v3 (`js/generators/space-hard-mode.js`) as
 * the engine behind one question type. It is now the engine behind a *modifier*
 * that any coordinate-backed mode can claim: premises fix a starting
 * arrangement, transformations mutate it, and the conclusion is about the final
 * state. What that buys is the same in every mode — you cannot answer by
 * ordering things, because the order changes underneath you.
 *
 * Every operation is a pure coordinate map, which is what makes an item exactly
 * verifiable: replaying the operation list from the initial layout must
 * reproduce the final layout, so generation and checking cannot disagree.
 *
 * Dimensionality is not baked in. A left/right scale is a one-axis space and a
 * 4D-temporal layout is a four-axis one; the same operations apply to both, and
 * `TransformVocab` supplies the words.
 */

export type Coord = number[];
export type CoordMap = Record<string, Coord>;

export type TransformKind =
    /** Reflect the mover across the anchor. */
    | "mirror"
    /** Copy the anchor's coordinate onto the mover. */
    | "set"
    /** Multiply the mover's offset from the anchor. */
    | "scale"
    /** Quarter turn about the anchor, within a plane. */
    | "rotate"
    /** Drop the mover at a stated offset from the anchor. */
    | "place"
    /** Shift the mover by a stated offset, with no anchor. */
    | "translate"
    /** Exchange the two objects' coordinates. */
    | "swap";

export interface Transform {
    kind: TransformKind;
    /** Anchor — never moves, except under `swap`. */
    a: string;
    /** Mover — the operation rewrites this one's coordinate. */
    b: string;
    /**
     * Axis index, single-axis form.
     *
     * Kept because the original three-dimensional generators emit it, and
     * because most transformations read better one axis at a time. `axesOf`
     * normalises the two forms so nothing downstream has to care.
     */
    dimension?: number;
    /** Axis indices, when the operation acts on several at once. */
    dimensions?: number[];
    /** Axis pair for rotate. */
    plane?: [number, number];
    /** Rotation direction; true = clockwise. */
    clockwise?: boolean;
    scale?: number;
    /** Displacement for place/translate, one entry per axis in `axesOf`. */
    offset?: number[];
}

/** Axes an operation acts on, whichever form it was written in. */
export function axesOf(t: Transform): number[] {
    if (t.dimensions?.length) return t.dimensions;
    return [t.dimension ?? 0];
}

export const DIMENSION_NAMES = ["X", "Y", "Z", "W"];

/**
 * Words a space uses to describe itself.
 *
 * Parameterised rather than hardcoded because the same operations now serve a
 * one-axis "is left of" scale and a four-axis spatiotemporal layout, and
 * "Y-mirrored" is meaningless in the first.
 *
 * `link` is the connector between a direction phrase and the anchor, per axis,
 * because English will not settle on one: compass words take "of" ("east of X"),
 * prepositions already carry it ("below X" — "below of X" is not English), and
 * comparatives take "than" ("higher than X"). Tracked per axis, so adding an
 * axis forces the decision to be made rather than inherited.
 */
export interface TransformVocab {
    /** Short axis labels used in operation names, e.g. "XY-rotated". */
    axisNames: string[];
    /** Direction word pairs, positive first. */
    axisWords: Array<[string, string]>;
    /** Connector to the anchor, per axis: "of", "than", or "". */
    link: string[];
    /** Unit noun for stated distances, e.g. "step". Omit for bare numbers. */
    unit?: string;
}

export const SPATIAL_VOCAB: TransformVocab = {
    axisNames: ["X", "Y", "Z"],
    axisWords: [["east", "west"], ["north", "south"], ["above", "below"]],
    link: ["of", "of", ""],
};

/** "east of A", "above A", "higher than A". */
function joinAnchor(phrase: string, axis: number, anchor: string, vocab: TransformVocab): string {
    const link = vocab.link[axis] ?? "";
    return `${phrase} ${link ? link + " " : ""}${anchor}`;
}

export const SCALE_FACTOR = 2;

/* ------------------------------------------------------------------ *
 * Operations — pure; each returns the mover's new coordinate          *
 * ------------------------------------------------------------------ */

/** Reflect b across a on one axis. */
export function mirrorPoint(p1: Coord, p2: Coord, i: number): Coord {
    const out = p2.slice();
    out[i] = p1[i] - (p2[i] - p1[i]);
    return out;
}

/** Copy a's coordinate on one axis onto b. */
export function setPoint(p1: Coord, p2: Coord, i: number): Coord {
    const out = p2.slice();
    out[i] = p1[i];
    return out;
}

/** Multiply b's offset from a on one axis. */
export function scalePoint(p1: Coord, p2: Coord, i: number, k = SCALE_FACTOR): Coord {
    const out = p2.slice();
    out[i] = p1[i] + k * (p2[i] - p1[i]);
    return out;
}

/**
 * Rotate b around a by 90° within a plane.
 *
 * Offsets are zeroed to the anchor first, rotated, then re-applied — so the
 * anchor is the pivot, not the origin.
 */
export function rotatePoint(p1: Coord, p2: Coord, plane: [number, number], clockwise: boolean): Coord {
    const [m, n] = plane;
    const diffM = p2[m] - p1[m];
    const diffN = p2[n] - p1[n];
    const out = p2.slice();
    out[m] = p1[m] + (clockwise ? diffN : -diffN);
    out[n] = p1[n] + (clockwise ? -diffM : diffM);
    return out;
}

/** Drop b at a stated offset from a, on the given axes. */
export function placePoint(p1: Coord, p2: Coord, axes: number[], offset: number[]): Coord {
    const out = p2.slice();
    axes.forEach((ax, i) => { out[ax] = p1[ax] + (offset[i] ?? 0); });
    return out;
}

/** Shift b by a stated offset; nothing anchors it. */
export function translatePoint(p2: Coord, axes: number[], offset: number[]): Coord {
    const out = p2.slice();
    axes.forEach((ax, i) => { out[ax] = p2[ax] + (offset[i] ?? 0); });
    return out;
}

/**
 * Dispatch. Returns the coordinates the operation writes.
 *
 * A result map rather than a single coordinate because `swap` moves both
 * objects — the earlier single-return signature could not express that, and
 * bolting it on at the call site would have put the semantics of one operation
 * outside the module that owns them.
 */
export function applyTransform(map: CoordMap, t: Transform): CoordMap {
    const p1 = map[t.a];
    const p2 = map[t.b];
    const axes = axesOf(t);

    switch (t.kind) {
        case "mirror":
            return { [t.b]: axes.reduce((p, ax) => mirrorPoint(p1, p, ax), p2) };
        case "set":
            return { [t.b]: axes.reduce((p, ax) => setPoint(p1, p, ax), p2) };
        case "scale":
            return { [t.b]: axes.reduce((p, ax) => scalePoint(p1, p, ax, t.scale ?? SCALE_FACTOR), p2) };
        case "rotate":
            return { [t.b]: rotatePoint(p1, p2, t.plane!, t.clockwise!) };
        case "place":
            return { [t.b]: placePoint(p1, p2, axes, t.offset ?? []) };
        case "translate":
            return { [t.b]: translatePoint(p2, axes, t.offset ?? []) };
        case "swap":
            return { [t.a]: p2.slice(), [t.b]: p1.slice() };
    }
}

/**
 * Replay a transform list from a starting layout.
 *
 * This is the verification path: generation and checking must agree, and because
 * every operation is pure this is exact rather than approximate.
 */
export function replay(initial: CoordMap, transforms: Transform[]): CoordMap {
    const map: CoordMap = {};
    for (const k of Object.keys(initial)) map[k] = initial[k].slice();
    for (const t of transforms) Object.assign(map, applyTransform(map, t));
    return map;
}

/* ------------------------------------------------------------------ *
 * Drawing a transform list                                            *
 * ------------------------------------------------------------------ */

export interface TransformDrawOptions {
    /** Number of axes the space has. */
    dims: number;
    /** Kinds allowed; defaults to everything the dimensionality supports. */
    kinds?: TransformKind[];
    /** Multipliers `scale` may use. */
    scaleFactors?: number[];
    /** Largest stated displacement for place/translate. */
    maxOffset?: number;
    /**
     * Chance an operation acts on more than one axis at once.
     *
     * Zero in a one-axis space by construction; elsewhere it is the main lever
     * on how much has to be tracked per premise.
     */
    multiAxisChance?: number;
    /**
     * Axes a rotation may turn within. Defaults to all of them.
     *
     * Exists because a quarter turn *exchanges* two axes' displacements, so the
     * pair has to be commensurable. Turning a bounded axis against an unbounded
     * one takes a wrapped value and writes it somewhere it has no meaning —
     * well-defined arithmetic describing nothing. Every other operation acts on
     * each axis independently and needs no such restriction.
     */
    rotationAxes?: number[];
}

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];
const flip = () => Math.random() > 0.5;

/** Kinds that make sense in a space of this many axes. */
export function kindsFor(dims: number): TransformKind[] {
    const kinds: TransformKind[] = ["mirror", "set", "scale", "place", "translate", "swap"];
    // A quarter turn needs a plane to turn in.
    if (dims >= 2) kinds.push("rotate");
    return kinds;
}

/**
 * Draw a list of distinct transformations over `names`.
 *
 * Distinctness is judged on the *rendered* operation, not the descriptor:
 * descriptors are drawn independently, so with few objects the same one recurs,
 * and a repeated `set` is a literal no-op because it is idempotent. Repeating a
 * pair with a different operation stays allowed — that is meaningful.
 */
export function drawTransforms(
    names: string[],
    count: number,
    options: TransformDrawOptions,
    vocab: TransformVocab = SPATIAL_VOCAB,
): Transform[] {
    const dims = options.dims;
    const rotationAxes = options.rotationAxes ?? [...Array(dims).keys()];
    const declared = options.kinds ?? kindsFor(dims);
    // A turn needs two axes it is allowed to turn within, which is not the same
    // as the space having two axes.
    const kinds = rotationAxes.length >= 2 ? declared : declared.filter(k => k !== "rotate");
    const factors = options.scaleFactors ?? [2, 3];
    const maxOffset = options.maxOffset ?? 3;
    const multiChance = dims >= 2 ? (options.multiAxisChance ?? 0.35) : 0;

    const out: Transform[] = [];
    const seen = new Set<string>();

    for (let guard = 0; out.length < count && guard < count * 30; guard++) {
        const [b, a] = pickTwo(names);
        const kind = pick(kinds);

        // How many axes this one touches. Single-axis stays the common case:
        // an all-axis mirror is easier to apply than to keep three separate
        // reflections straight, so multi-axis is variety, not difficulty.
        const axisCount = Math.random() < multiChance
            ? 1 + Math.floor(Math.random() * (dims - 1)) + 1
            : 1;
        const axes = pickN([...Array(dims).keys()], Math.min(axisCount, dims));

        let t: Transform;
        switch (kind) {
            case "rotate":
                t = {
                    kind, a, b,
                    plane: pickN(rotationAxes, 2).sort((x, y) => x - y) as [number, number],
                    clockwise: flip(),
                };
                break;
            case "scale":
                t = { kind, a, b, dimensions: axes, scale: pick(factors) };
                break;
            case "place":
            case "translate":
                t = { kind, a, b, dimensions: axes, offset: axes.map(() => nonZeroOffset(maxOffset)) };
                break;
            case "swap": {
                // Symmetric, so order the pair — otherwise "A and B swap" and
                // "B and A swap" are the same premise twice and the dedupe
                // below, which compares rendered text, would let both through.
                const [x, y] = [a, b].sort();
                t = { kind, a: x, b: y };
                break;
            }
            default:
                t = { kind, a, b, dimensions: axes };
        }

        const key = describeTransform(t, vocab);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
    }

    return out;
}

/** A displacement worth stating: zero would make the premise a no-op. */
function nonZeroOffset(max: number): number {
    const magnitude = 1 + Math.floor(Math.random() * max);
    return flip() ? magnitude : -magnitude;
}

function pickN<T>(xs: T[], n: number): T[] {
    const copy = [...xs];
    const out: T[] = [];
    while (out.length < n && copy.length) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
}

function pickTwo<T>(xs: T[]): [T, T] {
    const [p, q] = pickN(xs, 2);
    return [p, q];
}

/* ------------------------------------------------------------------ *
 * Phrasing                                                            *
 * ------------------------------------------------------------------ */

const subj = (s: string) => `<span class="subject">${s}</span>`;
const hi = (s: string) => `<span class="highlight">${s}</span>`;

/** "2 east and 1 above", or "" when the displacement is zero. */
function offsetWords(axes: number[], offset: number[], vocab: TransformVocab): string {
    const parts: string[] = [];
    axes.forEach((ax, i) => {
        const delta = offset[i] ?? 0;
        if (delta === 0) return;
        const [pos, neg] = vocab.axisWords[ax];
        const unit = vocab.unit ? ` ${vocab.unit}${Math.abs(delta) === 1 ? "" : "s"}` : "";
        parts.push(`${Math.abs(delta)}${unit} ${delta > 0 ? pos : neg}`);
    });
    return parts.join(" and ");
}

/**
 * Axis label for an operation name: "X", "XY", "all-axis", or nothing.
 *
 * Sorted, so the same pair of axes always reads the same way — "YX-mirrored"
 * and "XY-mirrored" are the same operation and should not look like two. Empty
 * in a one-axis space, where naming the only axis adds a word and no
 * information ("position-mirrored across Cat").
 */
function axisLabel(axes: number[], vocab: TransformVocab): string {
    if (vocab.axisNames.length <= 1) return "";
    if (axes.length >= vocab.axisNames.length) return "all-axis";
    return [...axes].sort((a, b) => a - b).map(ax => vocab.axisNames[ax]).join("");
}

/** "X-mirrored" in a space with axes to distinguish, plain "mirrored" in a line. */
function labelled(label: string, word: string): string {
    return label ? `${hi(label)}-${word}` : word;
}

export function describeTransform(t: Transform, vocab: TransformVocab = SPATIAL_VOCAB): string {
    const axes = axesOf(t);
    const label = axisLabel(axes, vocab);
    const allAxes = axes.length >= vocab.axisNames.length && vocab.axisNames.length > 1;

    switch (t.kind) {
        case "mirror":
            return `${subj(t.b)} is ${labelled(label, "mirrored")} across ${subj(t.a)}`;
        case "set":
            if (allAxes) return `every coordinate of ${subj(t.b)} is set to that of ${subj(t.a)}`;
            return label
                ? `${hi(label)} of ${subj(t.b)} is set to ${hi(label)} of ${subj(t.a)}`
                : `${subj(t.b)} is set to the position of ${subj(t.a)}`;
        case "scale":
            return `${subj(t.b)} is ${labelled(label, "scaled")} ${hi(formatFactor(t.scale ?? SCALE_FACTOR))} from ${subj(t.a)}`;
        case "rotate": {
            const [m, n] = t.plane!;
            const planeName = vocab.axisNames[m] + vocab.axisNames[n];
            const deg = t.clockwise ? "90°↷" : "-90°↺";
            return `${subj(t.b)} is ${hi(planeName)}-rotated ${deg} around ${subj(t.a)}`;
        }
        case "place": {
            const words = offsetWords(axes, t.offset ?? [], vocab);
            // Every drawn offset is non-zero, but a hand-built one need not be.
            if (!words) return `${subj(t.b)} is moved onto ${subj(t.a)}`;
            // One axis can borrow that axis's connector; a mix of axes ends on
            // whichever word came last, and "relative to" survives any of them.
            const tail = axes.length === 1
                ? joinAnchor(hi(words), axes[0], subj(t.a), vocab)
                : `${hi(words)} relative to ${subj(t.a)}`;
            return `${subj(t.b)} is moved to ${tail}`;
        }
        case "translate": {
            const words = offsetWords(axes, t.offset ?? [], vocab);
            if (!words) return `${subj(t.b)} stays where it is`;
            return `${subj(t.b)} moves ${hi(words)}`;
        }
        case "swap":
            return `${subj(t.a)} and ${subj(t.b)} swap places`;
    }
}

/** "2×", "3×", "½×" — a decimal point in the middle of a premise reads badly. */
function formatFactor(k: number): string {
    if (k === 0.5) return "½×";
    if (k === -1) return "−1×";
    return `${k}×`;
}

/** "B is 2 east and 1 above of A" — fully fixes b relative to a. */
export function describeOffset(
    a: string,
    b: string,
    pa: Coord,
    pb: Coord,
    vocab: TransformVocab = SPATIAL_VOCAB,
): string {
    const axes = pa.map((_, i) => i);
    const words = offsetWords(axes, axes.map(i => pb[i] - pa[i]), vocab);
    if (!words) return `${subj(b)} is at the same place as ${subj(a)}`;
    // "relative to" reads correctly whatever mix of compass and vertical terms
    // the list ends with, where a trailing "of" would not.
    return `${subj(b)} is ${words} relative to ${subj(a)}`;
}

/**
 * Conclusion about the final layout, on a single axis.
 * Returns null when the two objects tie on that axis — a tie has no direction
 * word, so it cannot be phrased as a true/false claim.
 */
export function describeConclusion(
    a: string,
    b: string,
    pa: Coord,
    pb: Coord,
    axis: number,
    claimPositive: boolean,
    vocab: TransformVocab = SPATIAL_VOCAB,
) {
    const delta = pb[axis] - pa[axis];
    if (delta === 0) return null;
    const [pos, neg] = vocab.axisWords[axis];
    const word = claimPositive ? pos : neg;
    return {
        text: `${subj(b)} is ${joinAnchor(word, axis, subj(a), vocab)}`,
        isValid: claimPositive ? delta > 0 : delta < 0,
    };
}
