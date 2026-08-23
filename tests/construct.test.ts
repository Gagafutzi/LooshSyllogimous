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
import { compareConstruction } from "../src/app/syllogimous/utils/construct.utils";

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
