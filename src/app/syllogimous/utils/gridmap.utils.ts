/**
 * Whole-structure maps on labelled points, and the four ways to ask about one.
 *
 * Every other mode in the app *states* a relation and asks you to apply it.
 * None asks you to work out which relation is operating, which is the one
 * cognitive operation the app omits and the thing matrix tests measure. This is
 * the engine for that: a structure S, its image S', and questions about the map
 * between them.
 *
 * The reason this is tractable where "find the transformation" usually is not:
 * **the points are labelled**. Verification is `apply(S, T)` compared against S'
 * point by point — exact, linear, no isomorphism search, none of the
 * NP-hardness that sinks the unlabelled version.
 *
 * The maps are deliberately *global*: they act on the whole structure at once,
 * unlike `transformations.utils.ts`, whose operations move one object relative
 * to an anchor. A map that moved a single point would make "which map is this?"
 * a question about that point rather than about the structure.
 *
 * Pure — no Angular, no storage.
 */

import { hi, subj } from "./phrasing";

export type GridPoint = [number, number];

/** A labelled structure: name to position. Order never matters. */
export type Structure = Record<string, GridPoint>;

export type GridMapKind = "translate" | "reflect" | "rotate" | "scale" | "swap";

export interface GridMap {
    kind: GridMapKind;
    /** translate: the shift. */
    by?: GridPoint;
    /** reflect: 0 flips east/west, 1 flips north/south. */
    axis?: number;
    /** rotate: quarter turns anticlockwise, 1..3. */
    turns?: number;
    /** scale: the factor, 2 or 3. */
    factor?: number;
}

/* ------------------------------------------------------------------ *
 * Applying                                                            *
 * ------------------------------------------------------------------ */

export function applyPoint(p: GridPoint, m: GridMap): GridPoint {
    const [x, y] = p;
    switch (m.kind) {
        case "translate": return [x + m.by![0], y + m.by![1]];
        case "reflect":   return m.axis === 0 ? [-x, y] : [x, -y];
        case "scale":     return [x * m.factor!, y * m.factor!];
        case "swap":      return [y, x];
        case "rotate": {
            // Anticlockwise quarter turns about the origin.
            let [cx, cy] = [x, y];
            for (let i = 0; i < (m.turns ?? 1); i++) [cx, cy] = [-cy, cx];
            return [cx, cy];
        }
    }
}

export function applyMap(s: Structure, m: GridMap): Structure {
    const out: Structure = {};
    for (const k of Object.keys(s)) out[k] = applyPoint(s[k], m);
    return out;
}

/** Left to right: the first map runs first. */
export function composeMaps(s: Structure, ms: GridMap[]): Structure {
    return ms.reduce((acc, m) => applyMap(acc, m), s);
}

export function sameStructure(a: Structure, b: Structure): boolean {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(k => b[k] && a[k][0] === b[k][0] && a[k][1] === b[k][1]);
}

/* ------------------------------------------------------------------ *
 * Wording                                                             *
 * ------------------------------------------------------------------ */

const AXIS_WORDS = ["east", "north"];

/**
 * Named as a *thing*, not as an instruction.
 *
 * It has to read correctly in four places: as the claim ("the change is …"), as
 * an option in a list, inside a derivation line, and after "the claim was …".
 * An imperative works in none of them but the first.
 */
export function describeMap(m: GridMap): string {
    switch (m.kind) {
        case "translate": {
            const parts: string[] = [];
            const [dx, dy] = m.by!;
            if (dx) parts.push(`${Math.abs(dx)} ${dx > 0 ? "east" : "west"}`);
            if (dy) parts.push(`${Math.abs(dy)} ${dy > 0 ? "north" : "south"}`);
            return `a shift of ${parts.join(" and ") || "nothing"}`;
        }
        case "reflect": return `a mirror across the ${AXIS_WORDS[m.axis === 0 ? 1 : 0]} line`;
        case "scale":   return `a move ${m.factor}× further out from the centre`;
        case "swap":    return `a swap of the two axes`;
        case "rotate":  return `a turn of ${(m.turns ?? 1) * 90}° anticlockwise about the centre`;
    }
}

/** "Ash (2, 1), Bee (0, −3)", in a stable order so two structures compare by eye. */
export function describeStructure(s: Structure, order: string[]): string {
    return order
        .map(n => `${subj(n)} ${hi(`(${fmt(s[n][0])}, ${fmt(s[n][1])})`)}`)
        .join(", ");
}

const fmt = (n: number) => n < 0 ? `−${Math.abs(n)}` : String(n);

/* ------------------------------------------------------------------ *
 * Drawing candidates                                                  *
 * ------------------------------------------------------------------ */

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** Every map worth offering, as a fixed pool the distractors are drawn from. */
export function mapPool(): GridMap[] {
    const out: GridMap[] = [
        { kind: "swap" },
        { kind: "reflect", axis: 0 },
        { kind: "reflect", axis: 1 },
        { kind: "scale", factor: 2 },
        { kind: "scale", factor: 3 },
    ];
    for (const turns of [1, 2, 3]) out.push({ kind: "rotate", turns });
    for (const dx of [-2, -1, 1, 2]) out.push({ kind: "translate", by: [dx, 0] });
    for (const dy of [-2, -1, 1, 2]) out.push({ kind: "translate", by: [0, dy] });
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) out.push({ kind: "translate", by: [dx, dy] });
    return out;
}

export function randomMap(): GridMap {
    return pick(mapPool());
}

/**
 * A structure that no two maps in the pool send to the same place.
 *
 * The point of the mode is that the image identifies the map, and on a
 * symmetric structure it does not: a shape symmetric about the origin is fixed
 * by a half turn, so "which map is this?" would have two right answers and the
 * item would be unanswerable however carefully the distractors were chosen.
 * Cheaper to reject the structure than to reason about which pairs collide.
 */
export function distinguishing(s: Structure, pool: GridMap[]): boolean {
    const seen = new Set<string>();
    for (const m of pool) {
        const key = signature(applyMap(s, m));
        if (seen.has(key)) return false;
        seen.add(key);
    }
    return !seen.has(signature(s));
}

export function signature(s: Structure): string {
    return Object.keys(s).sort().map(k => `${k}:${s[k][0]},${s[k][1]}`).join("|");
}
