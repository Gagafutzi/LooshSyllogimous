/**
 * Egocentric relations: left and right instead of north and south.
 *
 * "B is west of A" is a fact about the world. "B is on A's left" is a fact
 * about the world *and* about which way A is turned, so it cannot be read off
 * the layout — the layout has to be re-expressed from somewhere inside it.
 * That is perspective-taking, and it is the hardest kind of spatial reasoning
 * there is.
 *
 * **Facings are stated relationally**: "A faces C", never "A faces north". That
 * is the version worth having, because the facing itself has to be derived —
 * where *is* C? — before it can be applied, so one premise costs two steps.
 *
 * **And they are fixed at statement.** A facing resolves to a bearing the
 * moment it is stated and stops tracking its target. The alternative, where
 * the facing follows the object, is a constraint rather than a value: it needs
 * re-solving after every change and a later premise can make it unsatisfiable.
 *
 * No compass quantisation anywhere. An eight-point ring would have to round
 * bearings, and a bearing exactly between two points has no honest answer —
 * whereas the sign of a cross product is exact for any integers, and is the
 * computation being tested rather than an approximation of it.
 *
 * Pure — no Angular, no storage.
 */

import { hi, subj } from "./phrasing";
import { AxisSpec, isCircular, isParity } from "./ndspace.utils";

export type Egocentric = "left" | "right" | "ahead" | "behind";

export const EGOCENTRIC_WORDS: Record<Egocentric, string> = {
    left: "on {a}'s left",
    right: "on {a}'s right",
    ahead: "straight ahead of {a}",
    behind: "directly behind {a}",
};

/**
 * The two axes left and right are judged in.
 *
 * Straight axes only: a ring has no consistent left, and a parity axis has no
 * distance to take a bearing along. Returns null when the space has fewer than
 * two of them, which is the case a caller has to handle rather than force.
 */
export function bearingPlane(axes: AxisSpec[]): [number, number] | null {
    const usable = axes
        .map((axis, i) => ({ axis, i }))
        .filter(({ axis }) => !isCircular(axis) && !isParity(axis))
        .map(({ i }) => i);
    return usable.length >= 2 ? [usable[0], usable[1]] : null;
}

/**
 * Where `v` falls relative to someone facing along `f`.
 *
 * The cross product's sign separates left from right; the dot product then
 * separates ahead from behind for the points that lie on the line of sight.
 * Null when the target is exactly where the viewer is, which has no answer and
 * must not be asked.
 */
export function egocentric(f: [number, number], v: [number, number]): Egocentric | null {
    if (v[0] === 0 && v[1] === 0) return null;
    if (f[0] === 0 && f[1] === 0) return null;

    const cross = f[0] * v[1] - f[1] * v[0];
    if (cross > 0) return "left";
    if (cross < 0) return "right";
    return f[0] * v[0] + f[1] * v[1] > 0 ? "ahead" : "behind";
}

export const OPPOSITE: Record<Egocentric, Egocentric> = {
    left: "right", right: "left", ahead: "behind", behind: "ahead",
};

/** "B is on A's left", with the pronoun slot filled. */
export function describeEgocentric(target: string, viewer: string, rel: Egocentric): string {
    return `${subj(target)} is ${hi(EGOCENTRIC_WORDS[rel].replace("{a}", viewer))}`;
}

/** "A faces C." */
export function describeFacing(viewer: string, faced: string): string {
    return `${subj(viewer)} ${hi("faces")} ${subj(faced)}`;
}

/** "2 east and 1 north", for a displacement in the bearing plane. */
export function describeBearing(v: [number, number], axes: AxisSpec[], plane: [number, number]): string {
    const parts: string[] = [];
    const word = (value: number, axis: AxisSpec) =>
        `${Math.abs(value)} ${value > 0 ? axis.scale.direction[0] : axis.scale.direction[1]}`;
    if (v[0]) parts.push(word(v[0], axes[plane[0]]));
    if (v[1]) parts.push(word(v[1], axes[plane[1]]));
    return parts.join(" and ") || "nowhere";
}

export const FACING_NOTE =
    "Some premises say which way something is <b>facing</b>. A facing is fixed"
    + " when it is stated — it points where the other thing was at that moment,"
    + " and does not follow it afterwards. <b>Left</b> and <b>right</b> are judged"
    + " from that facing.";
