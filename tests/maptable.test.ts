
/**
 * Above three axes the map is a table, not a stack of grids.
 *
 * The grid form draws the fourth axis and beyond as slices -- one small picture
 * per combination of the remaining axes. That is a Cartesian product: sixteen
 * panels at five axes and dozens at six, and the reader has to find the one
 * that matters before reading anything in it. Not a rendering bug to tidy;
 * fixing the label collisions would produce a legible version of a picture that
 * should not be drawn.
 *
 * The threshold is three because three is where the axes can still be *seen* --
 * two as a grid, the third as stacked planes, which is the v3 drawing and works.
 */

import { assert, equal, test } from "./harness";
import { buildQuestionMap } from "../src/app/syllogimous/utils/map.utils";

const axes = (n: number) => Array.from({ length: n }, (_, i) => `axis ${i + 1}`);

/** Two objects differing on every axis, so nothing is degenerate. */
function coords(n: number) {
    return {
        Anchor: Array(n).fill(0),
        Far: Array.from({ length: n }, (_, i) => i + 1),
        Near: Array.from({ length: n }, (_, i) => (i % 2 ? -1 : 1)),
    };
}

test("three axes and under keep the grid", () => {
    for (const n of [1, 2, 3]) {
        const map = buildQuestionMap(coords(n), axes(n))!;
        equal(map.table, null, `${n} axes fell back to a table`);
        assert(map.slices.length > 0, `${n} axes drew nothing`);
    }
});

test("four axes and over become a table", () => {
    for (const n of [4, 5, 6, 7]) {
        const map = buildQuestionMap(coords(n), axes(n))!;
        assert(!!map.table, `${n} axes still drew a stack of grids`);
        equal(map.slices.length, 0,
            `${n} axes drew a table and the grids as well, which replaces nothing`);
        equal(map.table!.axes.length, n, "a column went missing");
        equal(map.table!.rows.length, 3, "an object went missing");
    }
});

/**
 * The frame has to be marked, or the numbers are measured from somewhere the
 * reader has to work out.
 */
test("the table is measured from a named object, which comes first", () => {
    const map = buildQuestionMap(coords(5), axes(5))!;
    const t = map.table!;

    equal(t.origin, "Anchor", "the object already at the origin was not chosen");
    equal(t.rows[0].word, "Anchor", "the frame is not the first row");
    equal(t.rows[0].coords.join(","), "0,0,0,0,0", "the origin is not at zero");

    // Relative, since the premises chain offsets and fix the arrangement only
    // up to where it is pinned.
    equal(t.rows.find(r => r.word === "Far")!.coords.join(","), "1,2,3,4,5",
        "positions are not stated relative to the frame");
});

test("with nothing at the origin the frame is still stable", () => {
    const shifted = { A: [3, 3, 3, 3], B: [4, 5, 6, 7] };
    const t = buildQuestionMap(shifted, axes(4))!.table!;

    equal(t.origin, "A", "the frame was not pinned to the first object");
    equal(t.rows[0].coords.join(","), "0,0,0,0", "the frame is not at zero");
    equal(t.rows[1].coords.join(","), "1,2,3,4", "the shift was not taken out");
});
