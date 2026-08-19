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
    RUNG_COST, chooseConfig, DEFAULT_ABILITY, levelOf, pCorrect, referenceSecondsFrom, timeCost,
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

/**
 * The clock has to be a clock, not a number.
 *
 * From a playtest: eighty-one answers, seventy-nine correct, and seventy-four
 * of the items had two premises. Progression was working — rungs climbed from
 * none to three and a limit was armed on most items — but the limits were
 * eighteen to fifty-seven seconds for a player answering in three to nine.
 *
 * The scale anchored every deadline to a fixed sixty seconds, so an eighteen
 * second limit was priced at nearly two levels: about two extra premises' worth
 * of difficulty, for a constraint that never once bit. Half the budget went on
 * a clock that changed nothing, and the item never grew.
 *
 * The answer time was being passed to `record` and thrown away — the parameter
 * was named `_answerSeconds`.
 */
test("a deadline nobody could hit is worth nothing", () => {
    const fast = { ...DEFAULT_ABILITY, referenceSeconds: 6 };

    // Someone who answers in three seconds is not troubled by eighteen.
    equal(timeCost(18, fast), 0, "a loose limit was still priced as difficulty");
    equal(timeCost(60, fast), 0, "a limit far beyond the player was priced as difficulty");
    assert(timeCost(4, fast) > 0.5, "a limit that genuinely bites should cost something");

    // And a generous limit is never *easier* than no limit, which would let a
    // loose clock pay for a longer item.
    assert(timeCost(600, DEFAULT_ABILITY) >= 0, "a very loose clock subtracted difficulty");
});

test("the clock is anchored to what the player actually does", () => {
    const fallback = DEFAULT_ABILITY.referenceSeconds;

    // Too little evidence: keep the default rather than guess from a handful.
    equal(referenceSecondsFrom([3, 4, 3], fallback), fallback,
        "three answers were enough to re-anchor the whole scale");

    // A fast player: the anchor comes down to near their own pace.
    const quick = referenceSecondsFrom([2.4, 3.1, 2.8, 4.4, 3.2, 2.9, 3.7, 3.0, 4.1, 2.6], fallback);
    assert(quick < 12, `anchor stayed at ${quick.toFixed(1)}s for a player answering in three`);
    assert(quick >= 6, `anchor fell to ${quick.toFixed(1)}s, which would price every clock as a crisis`);

    // A slow player is not punished: the anchor never exceeds the default.
    const slow = referenceSecondsFrom(Array(20).fill(80), fallback);
    equal(slow, fallback, "the anchor drifted above the configured ceiling");
});

test("a fast player's difficulty goes into the item, not into a slack clock", () => {
    /*
     * The end-to-end version. Answers are fast and correct, the timer is on, and
     * what matters is that the item grows rather than the limit hovering at a
     * number the player never approaches.
     */
    const type = EnumQuestionType.Distinction;

    const outcome = seeded(2029, () => {
        localStorage.clear();
        localStorage.setItem("SYL_TIMER_TYPE", "2");
        const service = new ProgressionService();
        for (let i = 0; i < 60; i++) service.record(type, "right", 3 + Math.random() * 2);
        return service.configFor(type);
    });
    localStorage.clear();

    const floor = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;
    assert(outcome.premises > floor || (outcome.seconds != null && outcome.seconds <= 10),
        `sixty fast correct answers left ${outcome.premises} premises and a`
        + ` ${outcome.seconds == null ? "nonexistent" : Math.round(outcome.seconds) + "s"} clock —`
        + " neither the item nor the deadline became demanding");
});

/**
 * The scale modes are one skill, and now share one ledger.
 *
 * Reported from play: the five scale modes each crawled while looking
 * individually reasonable. They are the same engine — identical weight,
 * identical ceiling, identical ladder, a premise reading the same way with the
 * words swapped — but each kept its own ability estimate. Thirty answers spread
 * across the family were five estimates of six answers apiece, none with enough
 * evidence to move.
 *
 * Ability is shared; difficulty is not. Each mode keeps its own premise bounds,
 * so this says "you are this good at reading a scale", not "these items are
 * interchangeable".
 */
test("answers anywhere in the scale family move all of it", () => {
    localStorage.clear();
    const service = new ProgressionService();

    const family = [
        EnumQuestionType.ComparisonNumerical,
        EnumQuestionType.ComparisonChronological,
        EnumQuestionType.LinearVertical,
        EnumQuestionType.LinearHorizontal,
        EnumQuestionType.LinearContains,
    ];

    const before = service.estimateFor(EnumQuestionType.LinearContains).level;

    // Thirty answers spread across the family, none of them on Containment.
    for (let i = 0; i < 30; i++) {
        service.record(family[i % 4], "right", 6);
    }

    const after = service.estimateFor(EnumQuestionType.LinearContains).level;
    assert(after > before + 1.5,
        `a mode nobody played sat at ${after.toFixed(1)}, up only`
        + ` ${(after - before).toFixed(1)} from ${before.toFixed(1)}`);

    // Every member reads the same, because there is one ledger.
    for (const mode of family) {
        equal(service.estimateFor(mode).level.toFixed(3), after.toFixed(3),
            `${mode} disagrees with the rest of its family`);
    }

    localStorage.clear();
});

test("sharing a ledger does not make the modes interchangeable", () => {
    // Difficulty is still per mode: they have different premise floors, and a
    // shared estimate must not paper over that.
    localStorage.clear();
    const service = new ProgressionService();
    for (let i = 0; i < 20; i++) service.record(EnumQuestionType.ComparisonNumerical, "right", 5);

    const numeric = service.configFor(EnumQuestionType.ComparisonNumerical);
    const vertical = service.configFor(EnumQuestionType.LinearVertical);

    assert(numeric.premises >= QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.ComparisonNumerical].minNumOfPremises,
        "a shared estimate broke a mode's own floor");
    assert(vertical.premises >= QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.LinearVertical].minNumOfPremises,
        "a shared estimate broke a mode's own floor");

    localStorage.clear();
});

test("evidence already earned per mode is carried into the shared ledger", () => {
    /*
     * Existing accounts have five separate posteriors that were always about
     * the same skill. Adding log-posteriors is what accumulating independent
     * evidence *is*; the prior sits in each of them, so the surplus copies come
     * back out, leaving the evidence added once and the prior counted once.
     * Picking the best-evidenced member and discarding the rest would throw
     * away most of what the player had done.
     */
    localStorage.clear();

    /*
     * Built through a mode with a ledger of its own, then filed under two scale
     * modes — which is the shape an older build left behind. Recording on a
     * scale mode now writes to the shared ledger directly, so it cannot produce
     * the state being migrated.
     */
    const seed = new ProgressionService();
    for (let i = 0; i < 15; i++) seed.record(EnumQuestionType.Distinction, "right", 5);
    const earned = localStorage.getItem("syllogimous-ability:Distinction")!;

    localStorage.clear();
    localStorage.setItem("syllogimous-ability:Comparison Numerical", earned);
    localStorage.setItem("syllogimous-ability:Vertical Order", earned);

    const migrated = new ProgressionService();
    const est = migrated.estimateFor(EnumQuestionType.LinearContains);

    assert(est.trials >= 30,
        `only ${est.trials} trials survived the move to a shared ledger, of thirty`);

    // And the family now reads from one place, so it was written down.
    assert(!!localStorage.getItem("syllogimous-ability:scale"),
        "the merged ledger was never saved, so it would be recomputed forever");

    localStorage.clear();
});
