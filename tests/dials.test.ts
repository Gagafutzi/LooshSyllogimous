/**
 * Counted levers, and what having them lets the model do.
 *
 * Eight ladder entries were never eight unlocks. `circular` and `circular-2`
 * are one integer allowed to reach two, and so are the transform, edit and
 * transform-depth pairs — two, because two is how many list positions were
 * spent on them.
 *
 * Two properties follow from the split and neither held before it: a dial keeps
 * going past where the ladder stopped, and a dial can be turned without its
 * neighbours. The second is the one the simulation cared about — a player weak
 * at one lever could not be given the others without it.
 */

import { assert, equal, test } from "./harness";
import {
    DEFAULT_ABILITY, DIALS, allocateDials, capDials, chooseConfig, dialCost,
    dialSteps, levelOf, needsAt,
} from "../src/app/syllogimous/utils/ability.utils";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

/* ------------------------------------------------------------------ *
 * Pricing                                                             *
 * ------------------------------------------------------------------ */

test("the first two turns cost exactly what the two rungs cost", () => {
    // The prices the ladder charged, before the split moved them.
    equal(dialCost("circular", 1), 1.2, "the first loop changed price");
    equal(dialCost("circular", 2), 1.2 + 0.8, "the second loop changed price");
    equal(dialCost("edits", 2), 1.5 + 1.2, "an edit changed price");
    equal(dialCost("transforms", 2), 1.5 + 1.2, "a transformation changed price");
    equal(dialCost("transform-depth", 2), 1.2 + 1.0, "a depth step changed price");
});

test("a turn past the priced list costs what the last priced one did", () => {
    const dial = DIALS.edits;
    const last = dial.steps[dial.steps.length - 1];
    // Summed in floating point, so compared as money rather than as integers.
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
    assert(near(dialCost("edits", 3) - dialCost("edits", 2), last),
        "the third turn was free, or priced by a guess");
    assert(near(dialCost("edits", 6) - dialCost("edits", 5), last), "and the sixth");
});

test("a dial nobody has heard of costs nothing rather than guessing", () => {
    equal(dialCost("no-such-dial", 3), 0, "an unknown dial was priced anyway");
});

/* ------------------------------------------------------------------ *
 * Which modes have which                                              *
 * ------------------------------------------------------------------ */

/**
 * Read off the tombstones rather than from a table beside the ladders, so the
 * ladder stays the only statement of what a mode has.
 */
test("a mode has the dials its ladder used to carry as rungs", () => {
    const nd = dialsFor(EnumQuestionType.Space4D).sort();
    equal(nd.join(","), "circular,edits,transforms",
        "the composed spaces lost or gained a dial");

    equal(dialsFor(EnumQuestionType.Transformation).join(","), "transform-depth",
        "Transformation lost its only lever");

    const scale = dialsFor(EnumQuestionType.LinearVertical);
    equal(scale.join(","), "transforms", "a scale mode's dial is not what it was");

    equal(dialsFor(EnumQuestionType.Syllogism).length, 0,
        "a mode with no counted rungs was given a dial");
});

test("no mode still offers a counted rung as a gate", () => {
    const stale: string[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        for (const dial of Object.values(DIALS)) {
            for (const was of dial.was) {
                if (ladderFor(type).includes(was)) stale.push(`${type}: ${was}`);
            }
        }
    }
    equal(stale.length, 0,
        `a counted lever is still an ordinal rung: ${stale.join(", ")}`);
});

/* ------------------------------------------------------------------ *
 * What the split is for                                               *
 * ------------------------------------------------------------------ */

test("a dial can be turned without its neighbours", () => {
    const type = EnumQuestionType.Space4D;
    const only = { edits: 2 };
    const level = levelOf({ type, premises: 6, rungs: [], dials: only, seconds: null });
    const plain = levelOf({ type, premises: 6, rungs: [], seconds: null });
    assert(level > plain, "turning one dial alone added nothing");

    // The thing a prefix could not do: the same difficulty, reached without the
    // lever a player might be weak at.
    const other = levelOf({
        type, premises: 6, rungs: [], dials: { transforms: 2 }, seconds: null,
    });
    equal(other, level,
        "two dials priced the same at the same turns should be interchangeable"
        + " — which is what lets one be avoided");
});

test("a dial goes past the two turns the ladder allowed", () => {
    const type = EnumQuestionType.Space4D;
    const at = (n: number) => levelOf(
        { type, premises: 8, rungs: [], dials: { edits: n }, seconds: null });
    for (let n = 1; n <= 5; n++) {
        assert(at(n) > at(n - 1), `turn ${n} of the dial cost nothing`);
    }
});

/* ------------------------------------------------------------------ *
 * Allocation                                                          *
 * ------------------------------------------------------------------ */

/**
 * Round-robin, which is not arbitrary: the ladder these came from interleaved
 * them — `circular`, `transform-1`, `edit-1`, then the seconds — so one step of
 * each before a second of any is the order a player used to climb them in.
 */
test("a budget is spread across the dials before it deepens one", () => {
    const spread = allocateDials(["circular", "edits", "transforms"], 4.5);
    equal(dialSteps(spread), 3, "three dials at 1.2/1.5/1.5 should take one turn each");
    for (const name of ["circular", "edits", "transforms"]) {
        equal(spread[name], 1, `${name} was skipped or deepened before the others`);
    }
});

test("a budget that buys nothing turns nothing", () => {
    equal(dialSteps(allocateDials(["edits"], 0.5)), 0,
        "a turn was taken on a budget that could not pay for it");
    equal(dialSteps(allocateDials([], 100)), 0, "a mode with no dials turned one");
});

test("a turn a premise count cannot carry is dropped", () => {
    // Edits need four premises for the first turn and five for the second.
    equal(capDials({ edits: 2 }, 5).edits, 2, "five premises should carry two edits");
    equal(capDials({ edits: 2 }, 4).edits, 1, "four premises should carry only one");
    equal(capDials({ edits: 2 }, 3).edits, undefined,
        "three premises should carry none, and none means absent");
    equal(capDials({ circular: 3 }, 3).circular, 3,
        "a loop needs no premises and should not have been trimmed");
});

/* ------------------------------------------------------------------ *
 * Choosing a configuration                                            *
 * ------------------------------------------------------------------ */

test("a mode whose ladder is all tombstones still gets harder", () => {
    const type = EnumQuestionType.Transformation;
    const opts = {
        minPremises: 3, maxPremises: 9, ladder: ladderFor(type),
        structureBefore: 5, dials: dialsFor(type),
    };
    const easy = chooseConfig(type, { ...opts, target: 6 }, DEFAULT_ABILITY);
    const hard = chooseConfig(type, { ...opts, target: 16 }, DEFAULT_ABILITY);
    assert(hard.level > easy.level, "aiming higher produced no harder item");
    assert(dialSteps(hard.dials) > dialSteps(easy.dials),
        "the harder item reached for length or the clock rather than the dial,"
        + " which is the only structure this mode has");
});

/**
 * Retired entries cost nothing, and `better` prefers more rungs — so a free
 * rung was strictly better than not having it, and a new player was handed the
 * whole of `Transformation`'s ladder before answering anything.
 */
test("a prefix never stops on a tombstone", () => {
    for (const type of Object.values(EnumQuestionType)) {
        const ladder = ladderFor(type);
        const choice = chooseConfig(type, {
            minPremises: 2, maxPremises: 9, ladder, target: 3,
            structureBefore: 5, dials: dialsFor(type),
        }, DEFAULT_ABILITY);
        if (choice.rungs === 0) continue;
        assert(!ladder[choice.rungs - 1].startsWith("retired-"),
            `${type} claimed up to ${ladder[choice.rungs - 1]}, which is wired to nothing`);
    }
});

/* ------------------------------------------------------------------ *
 * What the item can actually carry                                    *
 * ------------------------------------------------------------------ */

/**
 * A dial has no ceiling on the *ladder*, which is what the split was for. It
 * still has one on the item: `editCount = min(feat.edits, premises - 3)` in the
 * generator, so the fourth turn wants a seventh premise.
 *
 * Repeating the last value instead of continuing the last increment let the
 * model turn a dial as far as it liked on a fixed premise count. Aiming past
 * what structure could reach, it asked for fifty-six transformations on a
 * five-premise item and priced the ask — the generator would have clamped that
 * to one, so the level was a fiction and the mode could never run out.
 */
test("each further turn wants one more premise, as the generator does", () => {
    const edits = DIALS.edits;
    equal(needsAt(edits, 0), 4, "the first turn's premise floor moved");
    equal(needsAt(edits, 1), 5, "the second turn's premise floor moved");
    equal(needsAt(edits, 2), 6, "the third turn repeats instead of continuing");
    equal(needsAt(edits, 5), 9, "and the sixth");
});

test("a budget cannot buy a turn the premises cannot carry", () => {
    // A budget large enough for many turns, against five premises.
    const spread = allocateDials(["edits"], 100, 5);
    equal(spread.edits, 2, `five premises should carry two edits, got ${spread.edits}`);
    equal(allocateDials(["edits"], 100, 3).edits, undefined,
        "three premises should carry no edits at all");
});

test("loops stop at the axes that can loop, however many premises there are", () => {
    const many = allocateDials(["circular"], 100, 40);
    equal(many.circular, DIALS.circular.max,
        `loops should stop at ${DIALS.circular.max}, got ${many.circular}`);
    equal(capDials({ circular: 9 }, 40).circular, DIALS.circular.max,
        "a hand-built configuration was not trimmed to the cap");
});

test("a mode reaches a ceiling again, so running out means something", () => {
    const type = EnumQuestionType.LinearVertical;
    const opts = {
        minPremises: 3, maxPremises: 7, ladder: ladderFor(type),
        structureBefore: 5, dials: dialsFor(type),
    };
    const far = chooseConfig(type, { ...opts, target: 200 }, DEFAULT_ABILITY);
    assert(far.level < 60,
        `aiming at 200 produced a level of ${far.level.toFixed(1)} — the dial went`
        + " as far as the target asked rather than as far as the item allows");
});
