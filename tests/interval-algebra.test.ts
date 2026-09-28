/**
 * Allen's thirteen relations, and whether this app's table is Allen's.
 *
 * The names, definitions, weights and converses were transcribed from
 * Isomorph's shipped build, and a transcription is exactly the kind of thing
 * that is 12/13 right and looks entirely fine: one row out of step pairs a name
 * with somebody else's meaning, the card explains the wrong thing, and every
 * item built from it is quietly wrong in a way no arrangement count reveals.
 *
 * So the table is checked against the geometry twice over. `allenBetween` reads
 * the relation off four endpoint comparisons; `fromDefinition` below reads it
 * off the *printed definition* of each relation, written out as a predicate. The
 * two derivations share nothing but the arrangement, so agreeing on every pair
 * of every arrangement means the names, the definitions and the comparisons all
 * say the same thing — and a row out of step makes them disagree.
 */

import { assert, equal, test } from "./harness";
import {
    ALLEN_CONVERSE, ALLEN_DEFINITIONS, ALLEN_NAMES, ALLEN_WEIGHTS, Moments,
    allenBetween, intervalStates, possibleBetween,
} from "../src/app/syllogimous/utils/interval-algebra.utils";

/**
 * What each printed definition means, keyed by the definition itself.
 *
 * Keyed by the text and not by position, which is the difference between
 * checking the table and checking a copy of it. Written by position first, this
 * looked thorough and validated nothing about the definitions: swapping two of
 * them in `ALLEN_DEFINITIONS` left the suite green, because the predicates were
 * a parallel list that moved with the index rather than with the meaning. A card
 * would have explained "starts" by saying "lies strictly within the other" and
 * nothing would have said so.
 *
 * Read from the definition text and nothing else — "ends before the other
 * begins" is `ae < bs` — so this shares no structure with `allenBetween`, and
 * agreeing with it means the names, the definitions and the comparisons all say
 * the same thing.
 */
type Pred = (as: number, ae: number, bs: number, be: number) => boolean;

const MEANS: Record<string, Pred> = {
    "ends before the other begins": (as, ae, bs) => ae < bs,
    "ends exactly as the other begins": (as, ae, bs) => ae === bs,
    "starts first and ends during the other": (as, ae, bs, be) =>
        as < bs && bs < ae && ae < be,
    "starts with the other and ends first": (as, ae, bs, be) => as === bs && ae < be,
    "lies strictly within the other": (as, ae, bs, be) => bs < as && ae < be,
    "starts after the other and ends with it": (as, ae, bs, be) => bs < as && ae === be,
    "starts and ends with the other": (as, ae, bs, be) => as === bs && ae === be,
    "starts first and ends with the other": (as, ae, bs, be) => as < bs && ae === be,
    "starts before the other and ends after it": (as, ae, bs, be) => as < bs && be < ae,
    "starts with the other and ends after it": (as, ae, bs, be) => as === bs && be < ae,
    "starts during the other and ends after it": (as, ae, bs, be) =>
        bs < as && as < be && be < ae,
    "begins exactly as the other ends": (as, ae, bs, be) => as === be,
    "begins after the other has ended": (as, ae, bs, be) => be < as,
};

/**
 * The relations whose *printed* definition fits this pair, by table index.
 *
 * A definition the table carries but this file does not know is a failure of its
 * own: the wording was changed and the meaning behind it was not re-checked, so
 * the check has quietly stopped covering that row.
 */
function fromDefinition(moment: Moments, a: number, b: number): number[] {
    const as = moment[2 * a], ae = moment[2 * a + 1];
    const bs = moment[2 * b], be = moment[2 * b + 1];
    const out: number[] = [];
    ALLEN_DEFINITIONS.forEach((text, r) => {
        const fits = MEANS[text];
        assert(!!fits, `the table defines "${ALLEN_NAMES[r]}" as "${text}", which this `
            + "check has no meaning written for — add it rather than leaving the row "
            + "uncovered");
        if (fits(as, ae, bs, be)) out.push(r);
    });
    return out;
}

test("the four tables are the same length and line up", () => {
    equal(ALLEN_NAMES.length, 13, "there are not thirteen relations");
    equal(ALLEN_DEFINITIONS.length, 13, "a relation has no definition, or one has two");
    equal(ALLEN_WEIGHTS.length, 13, "the weights do not cover the relations");
    equal(ALLEN_CONVERSE.length, 13, "the converses do not cover the relations");
    equal(new Set(ALLEN_NAMES).size, 13, "two relations share a name");
    equal(new Set(ALLEN_DEFINITIONS).size, 13, "two relations share a definition");
});

/**
 * `equals` is the only relation that is its own converse.
 *
 * Which is a fact about the algebra and a check on the table's order at once:
 * the converse of index `r` is `12 - r`, so the self-converse row is the middle
 * one, and `equals` sitting anywhere else would mean the ladder is not in
 * Allen's order.
 */
test("the converse table is an involution with one fixed point", () => {
    const fixed = [];
    for (let r = 0; r < 13; r++) {
        equal(ALLEN_CONVERSE[ALLEN_CONVERSE[r]], r,
            `the converse of the converse of ${ALLEN_NAMES[r]} is not itself`);
        if (ALLEN_CONVERSE[r] === r) fixed.push(ALLEN_NAMES[r]);
    }
    equal(fixed, ["equals"],
        "the relations that are their own converse are not exactly 'equals', so the "
        + "ladder is not in Allen's order");
});

/**
 * Two periods stand in thirteen ways, and each of them exactly once.
 *
 * The sharpest check the substrate has. Enumerating the arrangements of two
 * periods must produce thirteen, and `allenBetween` must map them one-to-one
 * onto the thirteen names — so a missed arrangement, a double-counted one, or a
 * comparison that lumps two relations together all fail here rather than
 * somewhere downstream.
 */
test("two periods stand in thirteen ways, each exactly once", () => {
    const states = intervalStates(2);
    equal(states.length, 13,
        "the arrangements of two periods are not the thirteen relations");
    const seen = states.map(m => allenBetween(m, 0, 1));
    equal(new Set(seen).size, 13, "two arrangements give the same relation");
    equal([...seen].sort((a, b) => a - b), [...Array(13).keys()],
        "the arrangements do not cover every relation");
});

test("every arrangement really is an arrangement", () => {
    for (const n of [2, 3, 4]) {
        const states = intervalStates(n);
        equal(new Set(states.map(m => m.join(","))).size, states.length,
            `the arrangements of ${n} periods are not all distinct`);
        for (const moment of states) {
            for (let k = 0; k < n; k++) {
                assert(moment[2 * k] < moment[2 * k + 1],
                    `a period ends before or when it starts: ${moment.join(",")}`);
            }
            /* Moments are ranks, so they run 0..k-1 with nothing skipped — a gap
               would mean the same ordering was generated twice under two names. */
            const used = [...new Set(moment)].sort((a, b) => a - b);
            equal(used, [...Array(used.length).keys()],
                `an arrangement skips a moment: ${moment.join(",")}`);
        }
    }
});

/**
 * The names, the definitions and the comparisons all say the same thing.
 *
 * Exactly one definition fits any ordered pair of periods — the relations are
 * exclusive and exhaustive, which is the property the whole mode rests on — and
 * the one that fits is the one `allenBetween` names. Checked on every ordered
 * pair of every arrangement of two, three and four periods.
 */
test("each relation's definition is the relation it is named for", () => {
    for (const n of [2, 3, 4]) {
        for (const moment of intervalStates(n)) {
            for (let a = 0; a < n; a++) {
                for (let b = 0; b < n; b++) {
                    if (a === b) continue;
                    const byDefinition = fromDefinition(moment, a, b);
                    equal(byDefinition.length, 1,
                        `${byDefinition.length} definitions fit one pair `
                        + `(${byDefinition.map(r => ALLEN_NAMES[r]).join(", ") || "none"}), `
                        + "so the thirteen are not exclusive and exhaustive");
                    equal(ALLEN_NAMES[byDefinition[0]], ALLEN_NAMES[allenBetween(moment, a, b)],
                        `"${ALLEN_DEFINITIONS[byDefinition[0]]}" is printed against `
                        + `"${ALLEN_NAMES[byDefinition[0]]}" but describes what the code `
                        + `calls "${ALLEN_NAMES[allenBetween(moment, a, b)]}"`);
                }
            }
        }
    }
});

test("the converse table is the relation read the other way round", () => {
    for (const n of [2, 3, 4]) {
        for (const moment of intervalStates(n)) {
            for (let a = 0; a < n; a++) {
                for (let b = a + 1; b < n; b++) {
                    equal(ALLEN_CONVERSE[allenBetween(moment, a, b)], allenBetween(moment, b, a),
                        `${ALLEN_NAMES[allenBetween(moment, a, b)]} read backwards is not `
                        + `${ALLEN_NAMES[ALLEN_CONVERSE[allenBetween(moment, a, b)]]}`);
                }
            }
        }
    }
});

test("what is possible is read off the arrangements given, and nothing else", () => {
    const states = intervalStates(3);
    const some = states.slice(0, 40);
    const possible = possibleBetween(some, 0, 1);
    for (const r of possible) {
        assert(some.some(m => allenBetween(m, 0, 1) === r),
            `${ALLEN_NAMES[r]} is offered but no arrangement given realises it`);
    }
    for (let r = 0; r < 13; r++) {
        if (possible.includes(r)) continue;
        assert(!some.some(m => allenBetween(m, 0, 1) === r),
            `${ALLEN_NAMES[r]} is realised by one of the arrangements and left out`);
    }
});
