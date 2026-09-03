/**
 * Three settings that say what you want to *practise*, not how hard it should be.
 *
 * Which modes come up, whether a mode is timed, and what the stimuli are made of
 * are answers to a different question from "how difficult should this item be" —
 * and the page had them wired to the switch that answers the second one.
 *
 * The reports, in order:
 *
 *   · *"to use a specific mode I have to unselect all other modes manually, turn
 *     off fluid progression and cheat points"* — and later, *"make it so you can
 *     still turn off modes in fluid progression"*. Switching a mode off went
 *     through the override layer, which is gated on "use my settings instead of
 *     the tier"; turning that on to silence one mode also handed the premise
 *     count, the clock and the modifiers to Customise. Nobody wants the second,
 *     so it gets switched back, and the mode comes back with it.
 *
 *   · *"make it so you can disable the timer for certain modes only"*. The
 *     preference was global. The ladder only spends difficulty on time once a
 *     mode has run out of structure to add, so the timed modes are the ones you
 *     are strongest in — which a single switch cannot express.
 *
 *   · *"add options for random letters as stimuli, currently its possible by
 *     turning off meaningful words but I dont like that way"*. That switch is on
 *     the text kind, so it *replaced* words rather than joining them.
 *
 * Stated at the layer that decides, so a control that stops being wired fails
 * here rather than looking live and doing nothing.
 */

import { assert, equal, test } from "./harness";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { settingsForTier } from "../src/app/syllogimous/utils/tier.utils";
import { getSymbols } from "../src/app/syllogimous/utils/question.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { EnumTiers } from "../src/app/syllogimous/constants/game.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { getStrings, NOUNS } from "../src/app/syllogimous/constants/question.constants";

/** The layering the game service does: tier → user overrides → progression. */
function played(ov: SettingsOverrideService, prog: ProgressionService) {
    const tier = settingsForTier(EnumTiers.Archon, {
        gated: prog.config.enabled,
        premisesFor: (t: EnumQuestionType) => QUESTION_TYPE_SETTING_PARAMS[t].minNumOfPremises,
    });
    return prog.applyTo(ov.applyTo(tier), ov.pinned());
}

function fresh(fluid: boolean) {
    localStorage.clear();
    const ov = new SettingsOverrideService();
    const prog = new ProgressionService(ov);
    prog.set("enabled", fluid);
    return { ov, prog };
}

const A = EnumQuestionType.Distinction;
const B = EnumQuestionType.Direction;

/* ---------------- which modes come up ---------------- */

for (const fluid of [true, false]) {
    test(`a mode switched off stays off without the master switch, fluid ${fluid ? "on" : "off"}`, () => {
        const { ov, prog } = fresh(fluid);
        assert(!ov.state.active, "the master switch should start off");
        assert(played(ov, prog).question[A].enabled, "the mode should start on");

        ov.setMode(A, { enabled: false });
        equal(played(ov, prog).question[A].enabled, false,
            "switching a mode off needed Customise turned on as well");
        equal(played(ov, prog).question[B].enabled, true,
            "switching one mode off took another with it");
    });
}

test("a mode nobody has decided about is left to the tier", () => {
    const { ov, prog } = fresh(true);
    ov.setMode(A, { enabled: false });
    const s = played(ov, prog);
    // Silence still means "as it would be", which is what keeps an untouched
    // profile behaving exactly as it did before any of this.
    equal(s.question[B].enabled, true);
    assert(Object.values(EnumQuestionType).filter(t => s.question[t]?.enabled).length > 1,
        "only the mode that was named should have moved");
});

test("switching a mode back on takes without the master switch too", () => {
    const { ov, prog } = fresh(true);
    ov.setMode(A, { enabled: false });
    equal(played(ov, prog).question[A].enabled, false);
    ov.setMode(A, { enabled: true });
    equal(played(ov, prog).question[A].enabled, true);
});

test("something always survives, however many modes are switched off", () => {
    const { ov, prog } = fresh(true);
    for (const t of Object.values(EnumQuestionType)) ov.setMode(t, { enabled: false });
    const on = Object.values(EnumQuestionType).filter(t => played(ov, prog).question[t]?.enabled);
    assert(on.length >= 1, "every mode off leaves the generator nothing to pick");
});

test("the premise count is still the master switch's to give", () => {
    const { ov, prog } = fresh(false);
    const params = QUESTION_TYPE_SETTING_PARAMS[A];
    const want = params.maxNumOfPremises;
    ov.setMode(A, { numOfPremises: want, premisesChosen: true });
    const off = played(ov, prog).question[A].getNumOfPremises();
    ov.setActive(true);
    const on = played(ov, prog).question[A].getNumOfPremises();
    equal(on, want, "a chosen premise count did not apply with Customise on");
    assert(off !== want,
        "the premise count applied with Customise off — it is a difficulty override and should wait for the switch");
});

/* ---------------- the clock, per mode ---------------- */

test("a mode can be played with no clock while others keep theirs", () => {
    const { ov, prog } = fresh(true);
    localStorage.setItem("SYL_TIMER_TYPE", "2");     // a clock is wanted in general

    assert(!ov.untimedFor(A), "should start with no opinion");
    ov.setMode(A, { untimed: true });
    equal(ov.untimedFor(A), true);
    equal(ov.untimedFor(B), false, "taking the clock off one mode took it off another");
});

test("the per-mode clock does not wait for the master switch either", () => {
    const { ov, prog } = fresh(true);
    ov.setMode(A, { untimed: true });
    assert(!ov.state.active, "this is the case worth checking");
    equal(ov.untimedFor(A), true, "needed Customise turned on to take a clock off");
});

/*
 * The ladder only reaches for the clock once a mode has run out of structure to
 * add, so a fresh player has no countdown on anything and "the countdown went
 * away" is true before the setting is touched. These place the player high
 * enough that a clock is actually armed, and *assert that first* -- without it
 * the test passes against a build that ignores the setting entirely, which is
 * how the first version of it went green against exactly that mutation.
 */
function timedPlayer() {
    const { ov, prog } = fresh(true);
    localStorage.setItem("SYL_TIMER_TYPE", "2");
    prog.applyCalibration(20, 60);
    return { ov, prog };
}

test("an untimed mode is built and scored without a time component", () => {
    const { ov, prog } = timedPlayer();
    const before = prog.timeLimitFor(A);
    assert(before != null && before > 0,
        `nothing to take away: the ladder armed no clock on ${A} to begin with`);
    const other = prog.timeLimitFor(B);
    assert(other != null, `nothing to compare against: ${B} was untimed too`);

    ov.setMode(A, { untimed: true });
    equal(prog.timeLimitFor(A), null,
        "the ladder still armed a countdown on a mode set to have none");
    equal(prog.timeLimitFor(B), other, "one mode's clock setting changed another's");
});

test("the cached configuration notices the clock going away", () => {
    const { ov, prog } = timedPlayer();
    const before = prog.timeLimitFor(A);      // warms the cache on the way past
    assert(before != null && before > 0, "nothing to take away");
    ov.setMode(A, { untimed: true });
    equal(prog.timeLimitFor(A), null, "a stale cached choice kept the clock alive");
});

test("an item that lost its clock is valued at what it was actually worth", () => {
    /*
     * The clock is part of the configuration an item is *scored* at, and this is
     * the property that makes the setting a preference rather than a cheat.
     *
     * `chooseConfig` takes structure first and only reaches for the clock with
     * the gap that is left, so at the top of a mode's ladder the countdown is
     * the *only* difficulty still available — take it away and the item really
     * is easier. What must not happen is the model going on valuing it as
     * though it were not: `level` is computed from the configuration that was
     * actually built, so the answer enters the posterior at the lower level and
     * a mode played untimed simply stops earning the top of its range.
     */
    const { ov, prog } = timedPlayer();
    const timed = prog.configFor(A);
    assert(timed.seconds != null, "nothing to take away");

    ov.setMode(A, { untimed: true });
    const free = prog.configFor(A);
    equal(free.seconds ?? null, null, "the choice still carried a time limit");
    assert(free.premises >= timed.premises && free.rungs >= timed.rungs,
        "the search gave up structure as well as the clock");
    assert(free.level < timed.level,
        `an untimed item is still being valued as a timed one:`
        + ` ${timed.level.toFixed(2)} timed vs ${free.level.toFixed(2)} untimed`);
});

test("a per-mode switch can only take a clock away, never add one", () => {
    const { ov, prog } = fresh(true);
    localStorage.setItem("SYL_TIMER_TYPE", "0");   // player wants no clock at all
    ov.setMode(A, { untimed: false });
    equal(prog.timeLimitFor(A), null, "the global preference was overridden into a clock");
});

/* ---------------- random letters ---------------- */

test("random letters are a kind of their own, mixable with words", () => {
    const { ov, prog } = fresh(false);
    ov.setFlag("useText", true);
    ov.setFlag("meaningfulWords", true);
    ov.setFlag("randomLetters", true);

    const pool = getSymbols(played(ov, prog));
    const nouns = new Set(NOUNS), letters = new Set(getStrings());
    assert(pool.some(s => nouns.has(s)), "the words went away when letters came on");
    assert(pool.some(s => letters.has(s)), "letters were asked for and did not arrive");
});

test("letters without turning the words into nonsense", () => {
    const { ov, prog } = fresh(false);
    ov.setFlag("randomLetters", true);
    // The old route, for contrast: it *replaces* the text pool.
    ov.setFlag("meaningfulWords", false);
    const replaced = getSymbols(played(ov, prog));
    assert(!replaced.some(s => NOUNS.includes(s)),
        "the old switch is supposed to replace the words — if it does not, this test is not testing the difference");
});

test("random letters are off until asked for", () => {
    const { ov, prog } = fresh(false);
    const pool = getSymbols(played(ov, prog));
    const letters = new Set(getStrings());
    const nouns = new Set(NOUNS);
    assert(pool.some(s => nouns.has(s)), "the stock pool should still be words");
    assert(!pool.some(s => letters.has(s)),
        "letters turned up in a profile that never asked for them");
});
