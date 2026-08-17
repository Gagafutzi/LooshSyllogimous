/**
 * Deictic relational framing (I/you, here/there, now/then).
 *
 * Every other mode in this app resolves by chaining a transitive relation:
 * you build an ordering and read a pair off it. Deictic items resolve by
 * *perspective transformation* instead — the premises fix a grid of facts, and
 * the reversals remap which deictic term points at which cell. Nothing is
 * ordered, so chaining does not help.
 *
 * This is the core construct in Relational Frame Theory's deictic protocols
 * (simple / reversed / double-reversed), which is what the app's own intro
 * text points at when it cites RFT.
 *
 * Resolution is parity, not sequence: reversing an axis twice restores it, so
 * only the count of reversals per axis matters, never their order.
 */

export type DeicticAxis = "person" | "place" | "time";

export const DEICTIC_AXES: DeicticAxis[] = ["person", "place", "time"];

/** Word for each pole of each axis; index 0 is the self/proximal pole. */
const POLES: Record<DeicticAxis, [string, string]> = {
    person: ["I", "you"],
    place: ["here", "there"],
    time: ["now", "then"],
};

const REVERSAL_TEXT: Record<DeicticAxis, string> = {
    person: "I am you and you are me",
    place: "here is there and there is here",
    time: "now is then and then is now",
};

/** A cell is one coordinate per active axis, each 0 or 1. */
export type DeicticCoord = number[];

export interface DeicticSpec {
    axes: DeicticAxis[];
    /** Symbol held at each cell, keyed by coordinate. */
    grid: Record<string, string>;
    /** Reversal count per axis index; only parity matters. */
    reversals: number[];
}

export const coordKey = (c: DeicticCoord) => c.join("");

/** Enumerate every cell of a 2^n grid. */
export function allCoords(n: number): DeicticCoord[] {
    const out: DeicticCoord[] = [];
    for (let i = 0; i < (1 << n); i++) {
        const c: DeicticCoord = [];
        for (let a = 0; a < n; a++) c.push((i >> a) & 1);
        out.push(c);
    }
    return out;
}

/**
 * Apply the reversals to a coordinate the speaker *uttered*, yielding the cell
 * it actually refers to. Odd reversal count on an axis flips that axis.
 */
export function resolve(coord: DeicticCoord, reversals: number[]): DeicticCoord {
    return coord.map((v, i) => (reversals[i] % 2 === 1 ? 1 - v : v));
}

/** "When I am here now, I hold X" — phrased so person agreement stays correct. */
export function statementFor(axes: DeicticAxis[], coord: DeicticCoord, symbol: string) {
    const personIdx = axes.indexOf("person");
    const isSelf = personIdx === -1 ? true : coord[personIdx] === 0;
    const subject = isSelf ? "I" : "you";
    const verb = isSelf ? "am" : "are";

    // Non-person axes become the setting: "here", "now", "here now".
    const setting = axes
        .map((ax, i) => (ax === "person" ? null : POLES[ax][coord[i]]))
        .filter(Boolean)
        .join(" ");

    const wrapped = `<span class="subject">${symbol}</span>`;
    return setting
        ? `When ${subject} ${verb} ${setting}, ${subject} hold ${wrapped}`
        : `${subject} hold ${wrapped}`;
}

export function reversalTextFor(axis: DeicticAxis) {
    const t = REVERSAL_TEXT[axis];
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Build a fully determined item: one premise per cell, then the reversals.
 *
 * `numOfPremises` splits into grid statements plus reversals. Three axes need
 * eight statements, so the grid only widens once there is room for it.
 */
export function buildDeicticSpec(numOfPremises: number, symbols: string[]): DeicticSpec {
    const axisCount = numOfPremises >= 10 ? 3 : 2;
    const axes = DEICTIC_AXES.slice(0, axisCount);
    const cells = allCoords(axisCount);

    const grid: Record<string, string> = {};
    cells.forEach((c, i) => { grid[coordKey(c)] = symbols[i]; });

    // Whatever premises remain after stating the grid become reversals, always
    // at least one — a zero-reversal item is pure recall, not perspective work.
    const spare = Math.max(1, numOfPremises - cells.length);
    const reversals = new Array(axisCount).fill(0);
    for (let i = 0; i < Math.min(spare, 6); i++) {
        reversals[Math.floor(Math.random() * axisCount)]++;
    }
    // Guard against every axis cancelling to even parity, which would make the
    // reversals decorative and the item solvable by ignoring them.
    if (reversals.every(r => r % 2 === 0)) {
        reversals[Math.floor(Math.random() * axisCount)]++;
    }

    return { axes, grid, reversals };
}

/** The symbol truly held at an uttered coordinate, after transformation. */
export function answerFor(spec: DeicticSpec, uttered: DeicticCoord) {
    return spec.grid[coordKey(resolve(uttered, spec.reversals))];
}

/**
 * Independent re-derivation used to verify a generated item, deliberately
 * written without reusing `resolve` so a bug there cannot validate itself.
 */
export function verifyAnswer(spec: DeicticSpec, uttered: DeicticCoord, claimed: string) {
    let cell = uttered.slice();
    spec.reversals.forEach((count, axis) => {
        for (let i = 0; i < count; i++) cell[axis] = 1 - cell[axis];
    });
    return spec.grid[coordKey(cell)] === claimed;
}
