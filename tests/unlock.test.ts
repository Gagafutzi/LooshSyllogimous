
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
    ORDERED_QUESTION_TYPES, ORDERED_TIERS, TIERS_MATRIX, TIER_SCORE_RANGES,
} from "../src/app/syllogimous/constants/game.constants";
import { DEFAULT_ABILITY } from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

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
    equal(modesAt(stuck), EVERY_MODE,
        "a player who has exhausted a mode was still being held back");
});

test("a first session is not thirty-three modes at once", () => {
    const fresh = unlockRow({ aggregateLevel: 0, bestLevel: 0, anyExhausted: false });
    equal(fresh, 0, "an unmeasured player did not start at the first row");
    assert(modesAt(fresh) <= 6, `a first session offers ${modesAt(fresh)} modes`);
});

/** The gate is an onboarding ramp, not a treadmill. */
test("everything is open to a competent player", () => {
    const top = TIER_UNLOCK_LEVELS[TIER_UNLOCK_LEVELS.length - 1];
    assert(top <= 10, `the last unlock waits for level ${top}, which is an expert`);
    const row = unlockRow({ aggregateLevel: top, bestLevel: top, anyExhausted: false });
    equal(modesAt(row), EVERY_MODE, "the top threshold does not open everything");

    // The mode the complaint named, specifically.
    const idx = ORDERED_QUESTION_TYPES.indexOf(EnumQuestionType.Space3D);
    const at7 = unlockRow({ aggregateLevel: 7, bestLevel: 7, anyExhausted: false });
    assert(TIERS_MATRIX[at7][idx] === 1,
        "a level-7 player still cannot see Space 3D");
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
 * Transformation Matching is superseded by Axis Maps, which asks the same
 * question relationally and in more than two dimensions. It is off at every
 * tier rather than deleted: the ability history is real, and a player who liked
 * it can switch it back on in Customise. What must not happen is its coming
 * back by default because a column was inserted beside it and everything
 * shifted -- which the positional matrix makes easy and `tsc` cannot see.
 */
test("a retired mode is not offered at any tier", () => {
    const idx = ORDERED_QUESTION_TYPES.indexOf(EnumQuestionType.TransformMatching);
    assert(idx >= 0, "the retired mode has left the order entirely");

    for (const [row, offered] of Object.entries(TIERS_MATRIX)) {
        equal(offered[idx], 0, `tier ${row} still offers Transformation Matching`);
    }

    // And its replacement is offered, or the retirement removed a mode rather
    // than replacing one.
    const heir = ORDERED_QUESTION_TYPES.indexOf(EnumQuestionType.AxisMap);
    assert(Object.values(TIERS_MATRIX).some(row => row[heir] === 1),
        "Axis Maps is not offered at any tier, so the retirement lost a mode");
});
