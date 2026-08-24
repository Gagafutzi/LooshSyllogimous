/**
 * A built conclusion, reported dimension by dimension.
 *
 * Construction exists because a binary answer cannot tell a lucky run from an
 * understood one -- a six-axis item has a one-in-729 guess floor against
 * true/false's one in two. The result screen then collapsed the answer back to
 * `Correct Answer: true / User Answer: false`, which is the same bit it was
 * built to escape. Six dimensions right and one wrong is a different event
 * from all seven wrong, and only one of them means the item was misread.
 */

import { assert, equal, test } from "./harness";
import { ConstructClaim } from "../src/app/syllogimous/models/question.models";
import { compareConstruction, dimensionBreakdown } from "../src/app/syllogimous/utils/construct.utils";

const slot = (label: string, dir: number, mag: number, extra: object = {}) => ({
    label,
    directions: ["east", "west", "same"],
    answerDirection: dir,
    answerMagnitude: mag,
    asksDistance: true,
    ...extra,
});

const claim = (...slots: any[]): ConstructClaim => ({ a: "A", b: "B", slots });

test("a construct result says which dimension went wrong", () => {
    const claims = [claim(slot("E-W", 0, 2), slot("N-S", 1, 3), slot("U-D", 2, 0))];
    const rows = compareConstruction(claims, [[
        { direction: 0, magnitude: 2 },   // right
        { direction: 1, magnitude: 5 },   // right way, wrong distance
        { direction: 0, magnitude: 1 },   // wrong way
    ]])[0];

    equal(rows.map(r => r.ok).join(","), "true,false,false", "the wrong slots are not the wrong ones");
    equal(rows[0].label, "E-W", "the row is not labelled with its dimension");

    // The distinction the screen exists to draw.
    assert(rows[1].directionOk, "right way and wrong distance is reported as a wrong direction");
    assert(!rows[2].directionOk, "a wrong direction is reported as merely a distance slip");

    equal(rows[1].entered, "west by 5", "what was entered is not worded back");
    equal(rows[1].correct, "west by 3", "the truth is not worded the same way");
});

test("an unanswered slot is not a wrong one", () => {
    const claims = [claim(slot("E-W", 0, 2))];
    const rows = compareConstruction(claims, [[{ direction: -1, magnitude: 1 }]])[0];
    equal(rows[0].entered, null, "an untouched slot reads as an answer");
    assert(!rows[0].ok, "an unanswered slot counts as correct");
    assert(!rows[0].directionOk, "an unanswered slot claims the right direction");

    // Missing entirely, which is what a timeout leaves behind.
    const none = compareConstruction(claims, undefined)[0];
    equal(none[0].entered, null, "a timed-out item invents an answer");
});

/**
 * On a ring the pair (direction, distance) means one thing.
 *
 * Two steps clockwise round a five-loop *is* three anticlockwise, so splitting
 * the answer into a direction that can be wrong and a distance that can be
 * wrong would report a correct answer as half wrong -- and `slotSatisfied`
 * already accepts it, so the two would disagree about the same answer.
 */
test("a circular slot is judged as one claim, not two", () => {
    const claims = [claim(slot("Ring", 0, 2, { modulus: 5 }))];
    const rows = compareConstruction(claims, [[{ direction: 1, magnitude: 3 }]])[0];
    assert(rows[0].ok, "the long way round a ring is marked wrong");
    assert(rows[0].directionOk, "a correct ring answer is reported as a wrong direction");
});

/** "Same" carries no distance, so the box must not be read. */
test("a same slot ignores whatever is in the distance box", () => {
    const claims = [claim(slot("E-W", 2, 0))];
    const rows = compareConstruction(claims, [[{ direction: 2, magnitude: 7 }]])[0];
    assert(rows[0].ok, "a correct \"same\" was failed on a distance it never asked for");
    equal(rows[0].entered, "same", "\"same\" was worded with a distance");
});

/* ------------------------------------------------------------------ *
 * Which dimension a player loses                                      *
 * ------------------------------------------------------------------ */

/**
 * The report that answers "which dimension am I actually bad at".
 *
 * Three things decide whether the number means anything, and all three are the
 * kind that look like presentation until they are wrong.
 */
const answered = (picks: Array<Array<{ direction: number; magnitude: number }>>) => ({
    answerMode: "construct",
    construct: [claim(slot("E-W", 0, 2), slot("N-S", 1, 3))],
    userConstruct: picks,
});

test("a dimension is scored by its label, across items", () => {
    const rows = dimensionBreakdown([
        // E-W right, N-S wrong way.
        answered([[{ direction: 0, magnitude: 2 }, { direction: 0, magnitude: 3 }]]),
        // E-W right, N-S right way and wrong distance.
        answered([[{ direction: 0, magnitude: 2 }, { direction: 1, magnitude: 9 }]]),
    ]);

    equal(rows.length, 2, "the two dimensions did not come out as two rows");

    const ns = rows.find(r => r.label === "N-S")!;
    const ew = rows.find(r => r.label === "E-W")!;

    equal(ns.attempts, 2, "attempts are not counted per slot filled in");
    equal(ns.wrong, 2, "both N-S answers should be wrong");
    equal(ns.misread, 1, "one N-S answer was the wrong way round");
    equal(ns.miscounted, 1, "one N-S answer was the right way and the wrong distance");
    equal(ew.wrong, 0, "E-W was answered correctly twice");

    // Worst first: the report is read for what to work on.
    equal(rows[0].label, "N-S", "the worst dimension is not listed first");
});

test("a slot nobody filled in is not a mistake", () => {
    /*
     * A timed-out construction leaves every slot blank. Counting those as
     * mistakes fills the report with dimensions the player never reached, and
     * reads as "you are bad at seven axes" when what happened is the clock.
     */
    const rows = dimensionBreakdown([
        answered([[{ direction: -1, magnitude: 1 }, { direction: -1, magnitude: 1 }]]),
    ]);

    equal(rows.length, 0, "unfilled slots were counted as attempts");
});

test("items answered some other way are not in the report", () => {
    const rows = dimensionBreakdown([
        { answerMode: "boolean" },
        { answerMode: "construct", construct: [], userConstruct: [] },
        answered([[{ direction: 0, magnitude: 2 }, { direction: 1, magnitude: 3 }]]),
    ]);

    equal(rows.length, 2, "a non-construct item reached the per-dimension report");
    equal(rows.every(r => r.wrong === 0), true, "a correct answer was counted wrong");
});
