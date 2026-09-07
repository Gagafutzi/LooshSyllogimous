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

import { subj } from "./phrasing";
import { shuffle } from "./question.utils";

export type DeicticAxis = "person" | "place" | "time";

export const DEICTIC_AXES: DeicticAxis[] = ["person", "place", "time"];

/** Word for each pole of each axis; index 0 is the self/proximal pole. */
export const POLES: Record<DeicticAxis, [string, string]> = {
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
    /**
     * Reversal parity per axis index, 0 or 1.
     *
     * Parity rather than a count, because a count is what the premises can no
     * longer say: an axis is reversed once or not at all, so there is nothing
     * for a second reversal to record. `resolve` and `verifyAnswer` still read
     * this as a count, which costs nothing and keeps them true to the maths.
     */
    reversals: number[];
    /**
     * The cells that hold something, which need not be all of them.
     *
     * A third axis doubles the grid, and filling it doubled the objects: four
     * to eight in one step, with nothing in between. The frame growing is one
     * demand and the number of things to hold is another, and only the second
     * has to move smoothly — so occupancy is a count now and the axis is added
     * when the count outgrows two axes' worth of cells.
     */
    cells: DeicticCoord[];
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

    const wrapped = subj(symbol);
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
 *
 * An axis reverses once or not at all. Reversing the same axis twice restores
 * it, so a second "I am you and you are me" states nothing the first did not —
 * it lengthens the item without deepening it, which makes the item easier than
 * its premise count claims and misreports the work to the ability estimate.
 *
 * That bounds an item at 2^k + k premises: six on two axes, eleven on three.
 * The mode's maxNumOfPremises is one below that rather than equal to it,
 * because a deep conclusion withholds a grid statement and `createDeictic`
 * adds one to the request to pay for it — so the eleven arrives here from a
 * request of ten. Asking for more than the frame can carry yields a shorter
 * item rather than a padded one.
 */
/** The cell a reversal maps this one onto, which is its own inverse. */
export function partnerOf(cell: DeicticCoord, reversals: number[]): DeicticCoord {
    return cell.map((v, i) => (reversals[i] % 2 ? 1 - v : v));
}

/**
 * Cells that can be asked about: both the cell and what it resolves to are
 * occupied. With every cell filled that is all of them; with a partly filled
 * grid it is the ones whose partner is there too.
 */
export function askableCells(spec: DeicticSpec): DeicticCoord[] {
    const held = new Set(spec.cells.map(coordKey));
    return spec.cells.filter(c => held.has(coordKey(partnerOf(c, spec.reversals))));
}

export function buildDeicticSpec(numOfPremises: number, symbols: string[]): DeicticSpec {
    /*
     * How many things there are to hold, which is the thing that should climb
     * one at a time. It used to be every cell of the grid, so adding the third
     * axis took it from four objects to eight in a single step — a doubling
     * nobody asked for and no ladder rung to spread it over.
     *
     * One premise is always a reversal, so the rest state occupied cells.
     */
    const wanted = Math.max(4, Math.min(8, numOfPremises - 1));
    // The frame grows only when the count has outgrown two axes' four cells.
    const axisCount = wanted > 4 ? 3 : 2;
    const axes = DEICTIC_AXES.slice(0, axisCount);
    const every = allCoords(axisCount);

    // Whatever premises remain after stating the cells become reversals, always
    // at least one — a zero-reversal item is pure recall, not perspective work.
    const spare = Math.max(1, numOfPremises - wanted);
    const reversals = new Array(axisCount).fill(0);
    /*
     * Reversed axes are drawn rather than counted out, which is also what
     * retires the old even-parity guard: every drawn axis lands on parity 1 and
     * at least one is always drawn, so the reversals can never all cancel and
     * leave an item solvable by ignoring them.
     */
    const reversed = shuffle(axes.map((_, i) => i)).slice(0, Math.min(spare, axisCount));
    for (const axis of reversed) {
        reversals[axis] = 1;
    }

    /*
     * Filled in partner pairs, so an occupied cell has somewhere to resolve to.
     * An odd count leaves one cell with its partner empty; it is stated like
     * any other and simply never asked about, which is what `askableCells` is
     * for. Taking cells at random instead would produce items whose question
     * resolves into an empty cell — unanswerable rather than hard.
     */
    const pool = shuffle(every.slice());
    const chosen: DeicticCoord[] = [];
    const taken = new Set<string>();
    for (const cell of pool) {
        if (chosen.length >= wanted || taken.has(coordKey(cell))) continue;
        const partner = partnerOf(cell, reversals);
        const asPair = coordKey(partner) !== coordKey(cell)
            && !taken.has(coordKey(partner))
            && chosen.length + 2 <= wanted;
        if (asPair) {
            chosen.push(cell, partner);
            taken.add(coordKey(cell));
            taken.add(coordKey(partner));
        }
    }
    // Then anything still needed, which can only be the odd one out.
    for (const cell of pool) {
        if (chosen.length >= wanted) break;
        if (taken.has(coordKey(cell))) continue;
        chosen.push(cell);
        taken.add(coordKey(cell));
    }

    const cells = chosen;
    const grid: Record<string, string> = {};
    cells.forEach((c, i) => { grid[coordKey(c)] = symbols[i]; });

    return { axes, grid, reversals, cells };
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
