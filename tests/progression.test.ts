/**
 * Difficulty selection, including the rule that "Timer disabled" means it.
 *
 * `chooseConfig` is where the timer bug lived: the clock is one of the things
 * difficulty can be spent on, and the `untimed` option that suppresses it was
 * accepted but never passed. Pinning it here means the fix cannot silently come
 * undone — and this is exactly the kind of check that used to need the app.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    RUNG_COST, chooseConfig, DEFAULT_ABILITY, levelOf, pCorrect, timeCost,
} from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { RUNG_LADDERS, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";

const opts = (target: number, untimed = false) => ({
    minPremises: 2,
    maxPremises: 18,
    ladder: ladderFor(EnumQuestionType.Distinction),
    target,
    structureBefore: 5,
    untimed,
});

test("a target beyond the structural ceiling reaches for the clock", () => {
    const choice = chooseConfig(EnumQuestionType.Distinction, opts(40), DEFAULT_ABILITY);
    assert(choice.seconds != null, "no clock was armed for an unreachable target");
});

test("untimed never arms a clock, however high the target", () => {
    for (const target of [5, 12, 20, 40, 100]) {
        const choice = chooseConfig(EnumQuestionType.Distinction, opts(target, true), DEFAULT_ABILITY);
        equal(choice.seconds, null, `a clock was armed at target ${target} with untimed set`);
    }
});

test("difficulty goes into structure when the clock is off, not away", () => {
    const timed = chooseConfig(EnumQuestionType.Distinction, opts(40), DEFAULT_ABILITY);
    const untimed = chooseConfig(EnumQuestionType.Distinction, opts(40, true), DEFAULT_ABILITY);
    assert(untimed.premises >= timed.premises,
        "turning the clock off produced a structurally easier item");
});

test("an untimed configuration is scored at its own level, with no time cost", () => {
    const choice = chooseConfig(EnumQuestionType.Distinction, opts(40, true), DEFAULT_ABILITY);
    equal(timeCost(choice.seconds, DEFAULT_ABILITY), 0,
        "an untimed item was credited with time difficulty");
});

/*
 * Written the other way round first — "a modest target needs no clock" — which
 * is false, and the test said so. Two premises is the floor, so a *low* target
 * overshoots downwards just as a high one overshoots up, and the clock is
 * reached for at both ends. Worth knowing: it means a beginner can be given a
 * countdown, and that is by design rather than the bug that was just fixed.
 */
test("a clock is armed exactly when structure alone cannot reach the target", () => {
    for (const target of [2, 4, 8, 12, 20, 40]) {
        const timed = chooseConfig(EnumQuestionType.Distinction, opts(target), DEFAULT_ABILITY);
        const bare = chooseConfig(EnumQuestionType.Distinction, opts(target, true), DEFAULT_ABILITY);
        if (timed.seconds != null) {
            assert(bare.level < target,
                `a clock was armed at target ${target} although structure reached ${bare.level}`);
        }
    }
});

/**
 * Every rung a ladder can hand out has a price of its own.
 *
 * `RUNG_COST` falls back to 0.8 for anything absent, which exists so that
 * adding a rung is never a crash — not so it can stand in for a decision. Four
 * rungs were quietly sharing that number, which is how a difficulty model stops
 * meaning anything: the estimate is only as honest as the scale it is measured
 * on, and a scale with silent defaults in it is measuring something else.
 */
test("no rung is priced by accident", () => {
    const priced = new Set(Object.keys(RUNG_COST));
    const handed = new Set(ORDERED_QUESTION_TYPES.flatMap(t => ladderFor(t)));

    const unpriced = [...handed].filter(r => !priced.has(r));
    assert(unpriced.length === 0,
        `reaching the fallback instead of a considered value: ${unpriced.join(", ")}`);

    // And nothing is priced that no ladder can give out, which would be a rung
    // renamed in one place and not the other.
    const unreachable = [...priced].filter(r => !handed.has(r));
    assert(unreachable.length === 0,
        `priced but unreachable, so probably a stale name: ${unreachable.join(", ")}`);
});

/**
 * Every mode is listed in the ladder table, and a mode that runs out of
 * difficulty has genuinely run out.
 *
 * `ladderFor` falls back to an empty ladder for a mode it has no entry for, so
 * forgetting one is silent: the mode can never earn a modifier, and a player
 * who outgrows its premise ceiling is served the same item forever. Three modes
 * were in that state — Infer the Relation, Shape and Rotation and Stimulus
 * Function — and Space 7D had been left out while the five other composed
 * spaces shared a ladder, despite being built by the same generator.
 *
 * The absent entry and the deliberate empty one are indistinguishable at the
 * lookup, which is exactly why the table has to list both.
 */
test("no mode is missing from the ladder table", () => {
    const missing = ORDERED_QUESTION_TYPES.filter(t => !(t in RUNG_LADDERS));
    assert(missing.length === 0,
        `these fall back to an empty ladder rather than declaring one: ${missing.join(", ")}`);
});

test("the composed spaces all share a ladder", () => {
    // They are one generator. A rung any of them honours, all of them honour.
    const spaces = ORDERED_QUESTION_TYPES.filter(t => /^Space \d+D$/.test(t));
    assert(spaces.length >= 5, `only found ${spaces.length} composed spaces`);

    const first = ladderFor(spaces[0]).join(",");
    for (const s of spaces) {
        equal(ladderFor(s).join(","), first, `${s} has a different ladder from ${spaces[0]}`);
    }
});

test("a mode only serves easy items when it has actually run out", () => {
    /*
     * A strong player should be stretched. Where they are not — where the mode
     * serves items they get right more than nineteen times in twenty — it must
     * be because the mode has *nothing left*: every rung claimed and the premise
     * ceiling reached. Anything else is a wiring fault wearing the appearance of
     * a design limit, which is what the missing ladder entries were.
     */
    const ABLE = 16;
    const complaints: string[] = [];

    for (const type of ORDERED_QUESTION_TYPES) {
        const outcome = seeded(4177, () => {
            localStorage.clear();
            const service = new ProgressionService();

            for (let i = 0; i < 250; i++) {
                const c = service.configFor(type);
                const level = levelOf({
                    type, premises: c.premises,
                    rungs: ladderFor(type).slice(0, c.rungs), seconds: c.seconds,
                }, DEFAULT_ABILITY);
                const p = pCorrect(DEFAULT_ABILITY, ABLE, level, 0.5);
                service.record(type, Math.random() < p ? "right" : "wrong", 8);
            }

            const c = service.configFor(type);
            const level = levelOf({
                type, premises: c.premises,
                rungs: ladderFor(type).slice(0, c.rungs), seconds: c.seconds,
            }, DEFAULT_ABILITY);
            return { c, served: pCorrect(DEFAULT_ABILITY, ABLE, level, 0.5) };
        });

        if (outcome.served <= 0.95) continue;

        const ladder = ladderFor(type);
        const ceiling = QUESTION_TYPE_SETTING_PARAMS[type].maxNumOfPremises;
        const exhausted = outcome.c.rungs >= ladder.length && outcome.c.premises >= ceiling;

        if (!exhausted) {
            complaints.push(`${type}: serves ${(100 * outcome.served).toFixed(0)}% items at`
                + ` ${outcome.c.premises}/${ceiling} premises and ${outcome.c.rungs}/${ladder.length}`
                + ` rungs — it has more to give and is not giving it`);
        }
    }

    localStorage.clear();
    assert(complaints.length === 0, `\n  ${complaints.join("\n  ")}`);
});
