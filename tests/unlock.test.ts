
/**
 * Which modes exist, decided by ability rather than by a score.
 *
 * The matrix was indexed by the tier and the tier by the score -- and the score
 * is two different quantities depending on a setting. Accumulated it is
 * unbounded and measures how much you have played; derived it is the ability
 * estimate times a hundred, stopping at 2600. Both were compared against
 * thresholds written for the first, so unlocking bore no relation to what a
 * player could do: seven premises with every modifier on one mode, and Space 3D
 * still withheld.
 */

import { assert, equal, test } from "./harness";
import { TIER_UNLOCK_LEVELS, unlockRow } from "../src/app/syllogimous/utils/tier.utils";
import {
    EnumTiers, IMPORTED_MODES, ORDERED_QUESTION_TYPES, ORDERED_TIERS, TIERS_MATRIX,
    TIER_SCORE_RANGES,
} from "../src/app/syllogimous/constants/game.constants";
import { DEFAULT_ABILITY, levelOf } from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";

const modesAt = (row: number) => TIERS_MATRIX[row].filter(v => v).length;

/*
 * Every mode the matrix ever offers, which is not every column.
 *
 * A mode can be retired -- Transformation Matching is off at every tier, being
 * superseded by Axis Maps -- and comparing against the column count would then
 * assert that the ramp never finishes. What "finished" means is that nothing
 * further is being withheld.
 */
const EVERY_MODE = Math.max(
    ...Object.values(TIERS_MATRIX).map(row => row.filter(v => v).length));

/** Where the general ramp finishes — everything but the late arrivals. */
const RAMP_END = 6;
const TOP_ROW = Object.keys(TIERS_MATRIX).length - 1;

/**
 * The modes the general ramp does not finish with, read off the matrix.
 *
 * "Everything is open by level 8" was true of the app as built, and the tests
 * below said so by name. Two things have made it false since, and they are
 * different things: the three widest composed spaces, which continue past the
 * ramp because width has no substitute; and the band imported from Isomorph,
 * which assumes the base game rather than extending it.
 *
 * Derived rather than listed, so an import does not need this file edited —
 * and so the claim stays "the *general* ramp finishes by level 8", which is
 * what was actually being guarded.
 */
const LATE = ORDERED_QUESTION_TYPES.filter((_, i) =>
    TIERS_MATRIX[TOP_ROW][i] === 1 && TIERS_MATRIX[RAMP_END][i] === 0);

/** What the general ramp itself finishes with. */
const RAMP_TOTAL = EVERY_MODE - LATE.length;

test("more ability never means fewer modes", () => {
    let last = -1;
    for (let level = 0; level <= 20; level += 0.5) {
        const row = unlockRow({ aggregateLevel: level, bestLevel: level, anyExhausted: false });
        const open = modesAt(row);
        assert(open >= last, `level ${level} opened ${open} modes after ${last}`);
        last = open;
    }
    equal(last, EVERY_MODE, "the ramp never reaches every mode it offers");
});

/**
 * The best evidence, not the average of it.
 *
 * A player deep in one mode has demonstrated that much reasoning, and cannot
 * raise their average without the modes being withheld from them -- which is
 * the trap the old rule set: breadth was a prerequisite for depth, in an app
 * where depth is what the ability model measures.
 */
test("being strong at one mode is enough to unlock", () => {
    const broad = unlockRow({ aggregateLevel: 8, bestLevel: 8, anyExhausted: false });
    const deep = unlockRow({ aggregateLevel: 3, bestLevel: 8, anyExhausted: false });
    equal(deep, broad, "a player strong in one mode was gated on their average");
});

/**
 * Running out is the case that must never leave a player with nothing new.
 *
 * Every rung claimed and the premise ceiling reached means the app has nothing
 * left to serve in that mode. A pacing system that answers that by offering
 * nothing else is not pacing anything.
 */
test("a mode with nothing left to give unlocks the rest", () => {
    const stuck = unlockRow({ aggregateLevel: 1, bestLevel: 1, anyExhausted: true });
    /* `RAMP_TOTAL` already leaves out everything that arrives after the ramp,
       the three widest spaces included, so there is nothing further to take
       off — subtracting them again counted them twice. */
    equal(modesAt(stuck), RAMP_TOTAL,
        "a player who has exhausted a mode was still being held back");

    /*
     * But not the widest spaces, and this is the case that says why.
     *
     * `anyExhausted` is true at aggregate level 1 here — running out of
     * Distinction is evidence about Distinction. Handing that player six axes
     * would be reading "this mode has nothing left" as "this player is ready
     * for anything".
     */
    for (const type of DEEP) {
        equal(TIERS_MATRIX[stuck][ORDERED_QUESTION_TYPES.indexOf(type)], 0,
            `exhausting one mode handed out ${type}`);
    }
});

test("a first session is not thirty-three modes at once", () => {
    const fresh = unlockRow({ aggregateLevel: 0, bestLevel: 0, anyExhausted: false });
    equal(fresh, 0, "an unmeasured player did not start at the first row");
    assert(modesAt(fresh) <= 6, `a first session offers ${modesAt(fresh)} modes`);
});

/**
 * The three the ramp does not finish with.
 *
 * Reported from play: a six-dimensional space was being offered by the same row
 * as a three-premise graph match. Width is the one difficulty with no
 * substitute elsewhere in the app, so it is the one thing a general level does
 * not buy.
 */
const DEEP = [
    EnumQuestionType.Space5D,
    EnumQuestionType.Space6D,
    EnumQuestionType.Space7D,
];

const offers = (level: number, type: EnumQuestionType) =>
    TIERS_MATRIX[unlockRow({ aggregateLevel: level, bestLevel: level, anyExhausted: false })]
        [ORDERED_QUESTION_TYPES.indexOf(type)] === 1;

/**
 * The gate is an onboarding ramp, not a treadmill — for everything but three,
 * and for everything the app was built with.
 *
 * The imported band is the exception that is not an exception to this: it is
 * not part of the ramp at all. What is guarded here is that the ramp itself
 * still finishes early, and that a competent player is not being made to climb
 * for the modes this app is made of.
 */
test("everything but the widest spaces is open to a competent player", () => {
    const ordinary = 8;
    const row = unlockRow({ aggregateLevel: ordinary, bestLevel: ordinary, anyExhausted: false });
    equal(modesAt(row), RAMP_TOTAL,
        "level 8 does not open everything the general ramp offers");

    // And the late arrivals really are above it, or the line above measures
    // nothing.
    assert(LATE.length > 0, "nothing at all waits above the ramp");
    for (const type of LATE) {
        assert(!offers(ordinary, type),
            `${type} arrives after the ramp and is open to a level-8 player`);
    }

    // The mode the original complaint named, specifically.
    assert(offers(7, EnumQuestionType.Space3D), "a level-7 player still cannot see Space 3D");
});

test("each extra axis is its own unlock, in order", () => {
    let previous = 0;
    for (const type of DEEP) {
        // Somewhere above the general ramp, and after the axis below it.
        let at = 0;
        for (let level = 8; level <= 20; level += 0.5) {
            if (offers(level, type)) { at = level; break; }
        }
        assert(at > 8, `${type} is open to a level-8 player`);
        assert(at > previous, `${type} opens no later than the axis below it`);
        previous = at;
    }
});

/**
 * The threshold has to leave room above the mode's own opening item, because
 * these open at their floor rather than at what the player can already do.
 * A gate you clear on the same day the first item is beyond you is not pacing.
 */
test("a widest space opens well above the level of its own first item", () => {
    for (const type of DEEP) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        const floor = levelOf(
            { type, premises: params.minNumOfPremises, rungs: [], seconds: null });
        let at = 0;
        for (let level = 0; level <= 20; level += 0.5) {
            if (offers(level, type)) { at = level; break; }
        }
        assert(at >= floor + 2,
            `${type} opens at level ${at} for a floor item worth ${floor.toFixed(1)}`);
    }
});

/**
 * The badge has to track something the player can see.
 *
 * The bands were 250 points wide running to 6000, written when the score was
 * the accumulated one -- unbounded, and a measure of how much you had played.
 * The score is the ability estimate times a hundred by default, which stops at
 * 2600, so fourteen of the twenty-five names could never be earned by anybody:
 * every mode unlocked, and still Apprentice.
 */
test("every tier can actually be earned", () => {
    const ceiling = DEFAULT_ABILITY.maxLevel * 100;
    const unreachable = ORDERED_TIERS.filter(t => TIER_SCORE_RANGES[t].minScore > ceiling);
    equal(unreachable.length, 0,
        `${unreachable.length} tiers are past the ${ceiling}-point ceiling: ${unreachable.slice(0, 3).join(", ")}`);

    // And the top one is actually held at the top, not merely reachable.
    const top = ORDERED_TIERS[ORDERED_TIERS.length - 1];
    assert(ceiling >= TIER_SCORE_RANGES[top].minScore,
        "the highest tier begins above the highest possible score");
});

test("the tier bands cover every score, with no gaps or overlaps", () => {
    let previousMax = -Infinity;
    for (const tier of ORDERED_TIERS) {
        const { minScore, maxScore } = TIER_SCORE_RANGES[tier];
        assert(minScore <= maxScore, `${tier} has an empty band`);
        if (Number.isFinite(previousMax)) {
            equal(minScore, previousMax + 1, `${tier} does not start where the last one ended`);
        }
        previousMax = maxScore;
    }
    assert(!Number.isFinite(previousMax), "the last tier does not run to the top");
});

/**
 * A tier is a level, which is what makes the badge mean something: unlocking is
 * decided by ability, so the name beside it has to be too or they disagree in
 * front of the player.
 */
test("a tier is one level of measured ability", () => {
    const at = (points: number) =>
        ORDERED_TIERS.findIndex(t =>
            points >= TIER_SCORE_RANGES[t].minScore && points <= TIER_SCORE_RANGES[t].maxScore);

    // One band per level, so a level apart is a tier apart.
    for (let level = 3; level <= 20; level++) {
        equal(at(level * 100) - at((level - 1) * 100), 1,
            `level ${level - 1} to ${level} did not move exactly one tier`);
    }
});

/**
 * A retired mode stays retired.
 *
 * Two modes are superseded rather than deleted -- Transformation Matching by
 * Axis Maps, which asks the same question relationally and in more than two
 * dimensions, and Oddest Relation by Widest Group, which measures each
 * dimension's spread between the members at its edges instead of deciding every
 * dimension by majority vote. Both are kept because the ability history is real
 * and a player who liked one can switch it back on in Customise.
 *
 * What must not happen is either coming back by default because a column was
 * inserted beside it and everything shifted -- which the positional matrix
 * makes easy and `tsc` cannot see.
 *
 * Retirement is **two** edits, and this asserts both. `enabled: false` in the
 * settings params is what a fresh install reads; the tier matrix is what every
 * tier offers, and a mode zeroed in one and not the other comes back the moment
 * the tier is reached. Oddest Relation was turned off in the params first and
 * still offered at twenty tiers.
 */
const RETIRED: Array<[EnumQuestionType, EnumQuestionType]> = [
    [EnumQuestionType.TransformMatching, EnumQuestionType.AxisMap],
    [EnumQuestionType.OddestRelation, EnumQuestionType.WidestGroup],
];

test("a retired mode is not offered at any tier", () => {
    for (const [retired, heir] of RETIRED) {
        const idx = ORDERED_QUESTION_TYPES.indexOf(retired);
        assert(idx >= 0, `${retired} has left the order entirely`);

        for (const [row, offered] of Object.entries(TIERS_MATRIX)) {
            equal(offered[idx], 0, `tier ${row} still offers ${retired}`);
        }

        equal(QUESTION_TYPE_SETTING_PARAMS[retired].enabled, false,
            `${retired} is off at every tier but still on for a fresh install`);

        // And its replacement is offered, or the retirement removed a mode
        // rather than replacing one.
        const heirIdx = ORDERED_QUESTION_TYPES.indexOf(heir);
        assert(Object.values(TIERS_MATRIX).some(row => row[heirIdx] === 1),
            `${heir} is not offered at any tier, so retiring ${retired} lost a mode`);
    }
});

/* ------------------------------------------------------------------ *
 * The ramp reaches every row it has                                   *
 * ------------------------------------------------------------------ *
 *
 * `TIERS_MATRIX` had twenty-five rows and `TIER_UNLOCK_LEVELS` had ten
 * thresholds, so `unlockRow` could never return past nine. Fifteen rows —
 * Oracle upward, three fifths of the badge ladder — were not merely empty but
 * unreachable: a row could have been filled in and still granted nothing to
 * anybody, and nothing would have said so.
 *
 * That is a shape of failure rather than a one-off, so what is asserted is the
 * agreement between the two tables and not the numbers in them.
 */

test("every row of the matrix has a level that reaches it", () => {
    equal(TIER_UNLOCK_LEVELS.length, Object.keys(TIERS_MATRIX).length,
        "the unlock ramp and the tier matrix are different lengths, so either"
        + " some rows can never be reached or some levels point at no row");

    for (let i = 1; i < TIER_UNLOCK_LEVELS.length; i++) {
        assert(TIER_UNLOCK_LEVELS[i] > TIER_UNLOCK_LEVELS[i - 1],
            `row ${i} opens at level ${TIER_UNLOCK_LEVELS[i]}, which is not above`
            + ` row ${i - 1}'s ${TIER_UNLOCK_LEVELS[i - 1]} — one of them is dead`);
    }

    // The ramp is walked rather than indexed, so the last threshold has to be
    // the one that returns the last row.
    equal(unlockRow({ aggregateLevel: 0, bestLevel: 1e6, anyExhausted: false }),
        Object.keys(TIERS_MATRIX).length - 1,
        "no amount of ability reaches the top row");
});

/**
 * And the ranks above the base game's ramp are not a flat tail.
 *
 * Everything this app was built with is open by level 8, deliberately — the
 * gate is there so a first session is not thirty-three modes at once, not to be
 * a treadmill. What sits above is the band imported from Isomorph, and a band
 * that grants nothing is a rank with no reward behind it.
 *
 * Asserted as "something arrives up there" rather than row by row, because they
 * arrive one or two at a time and which row each lands on is a pacing decision
 * that should stay free to move.
 */
test("the ranks above the base game's ramp grant something", () => {
    const beyond = ORDERED_QUESTION_TYPES.filter((_, i) =>
        TIERS_MATRIX[TOP_ROW][i] === 1 && TIERS_MATRIX[9][i] === 0);

    assert(beyond.length > 0,
        "nothing is unlocked above row 9, so fifteen ranks are a badge and no more");
});

/**
 * And nothing imported arrives before Genius.
 *
 * The band opened uniformly at Oracle to begin with; two of its modes have
 * since been brought forward to Genius, which is a pacing decision and should
 * stay one. What is not a pacing decision is a mode that assumes the base game
 * turning up while a player is still being shown the base game — so the floor
 * is asserted and the rest is left free to move.
 *
 * The three widest spaces are excluded by name because they are late for the
 * other reason: they are this app's own, continuing past the ramp because
 * width has no substitute elsewhere in it.
 */
test("no imported mode is offered before Genius", () => {
    const GENIUS = ORDERED_TIERS.indexOf(EnumTiers.Genius);
    equal(GENIUS, 8, "Genius has moved on the ladder, so this floor names the wrong row");

    /*
     * Read from the list that says where a mode came from, not from where it
     * sits. Deriving it from the matrix — "the ones that arrive late" — was how
     * this started, and it cannot fail: a mode moved too early stops matching
     * the derivation and so escapes the check meant to catch it, which a
     * mutation moving one to row 6 duly proved.
     */
    assert(IMPORTED_MODES.length > 0, "nothing is imported, so this guards nothing");

    for (const type of IMPORTED_MODES) {
        const i = ORDERED_QUESTION_TYPES.indexOf(type);
        for (let row = 0; row < GENIUS; row++) {
            equal(TIERS_MATRIX[row][i], 0,
                `${type} is imported and offered at row ${row}, below Genius`);
        }
    }
});
