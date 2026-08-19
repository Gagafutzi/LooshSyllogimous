/**
 * What a brand-new player is actually served, and who wins when two layers
 * both want to set the premise count.
 *
 * Both were reported from play: Peasant opened on five linear premises with
 * negation on, while Customise sat there saying two. They turned out to be
 * separate faults that happened to point the same way — a prior so wide its
 * mean landed mid-scale, and a progression layer that ran last and overwrote
 * whatever the user had typed.
 */

import { assert, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { buildChain, LINEAR_SCALES, renderPremises } from "../src/app/syllogimous/utils/linear.utils";

/** A service with no saved history, whatever earlier tests left behind. */
function fresh() {
    localStorage.clear();
    return new ProgressionService();
}

test("a new player starts at the shortest item every mode has", () => {
    const p = fresh();
    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        if (!params) continue;
        const chosen = p.configFor(type).premises;
        assert(chosen <= params.minNumOfPremises + 1,
            `${type} opens at ${chosen} premises, minimum is ${params.minNumOfPremises}`);
    }
});

test("a new player is given no modifiers before answering anything", () => {
    const p = fresh();
    for (const type of Object.values(EnumQuestionType)) {
        const rungs = p.rungsFor(type);
        assert(rungs.length === 0, `${type} opens carrying ${rungs.join(", ")}`);
    }
});

test("answering correctly is what raises difficulty", () => {
    const p = fresh();
    const before = p.estimateFor(EnumQuestionType.Distinction).level;
    for (let i = 0; i < 12; i++) p.record(EnumQuestionType.Distinction, "right", 8);
    const after = p.estimateFor(EnumQuestionType.Distinction);
    assert(after.level > before, "twelve correct answers did not move the estimate");
    assert(after.sd < 2.5, "twelve answers left the posterior as wide as the prior");
    assert(p.rungsFor(EnumQuestionType.Distinction).length > 0,
        "twelve correct answers unlocked nothing");
});

test("uncertainty makes items easier, not harder", () => {
    // The cold-start fault in one line: an unmeasured player must never be
    // served a harder item than a measured one sitting at the same estimate.
    const p = fresh();
    const cold = p.configFor(EnumQuestionType.Distinction).premises;
    for (let i = 0; i < 12; i++) p.record(EnumQuestionType.Distinction, "right", 8);
    const warm = p.configFor(EnumQuestionType.Distinction);
    assert(warm.premises + p.rungsFor(EnumQuestionType.Distinction).length >= cold,
        "the guess outranked the measurement");
});

test("a premise count set in Customise is not overwritten by progression", () => {
    const p = fresh();
    const type = EnumQuestionType.Distinction;
    for (let i = 0; i < 20; i++) p.record(type, "right", 4);

    const set = (n: number) => {
        let value = n;
        return {
            question: {
                [type]: {
                    enabled: true,
                    get numOfPremises() { return value; },
                    clampNumOfPremises: (v: number) => v,
                    setNumOfPremises: (v: number) => { value = v; },
                },
            },
            setEnable: () => {},
        } as any;
    };

    const free = set(2);
    p.applyTo(free);
    assert(free.question[type].numOfPremises > 2,
        "progression should raise an unpinned count for a strong player");

    const pinned = set(2);
    p.applyTo(pinned, { premises: new Set([type]), flags: true });
    assert(pinned.question[type].numOfPremises === 2,
        `Customise said 2, play got ${pinned.question[type].numOfPremises}`);
});

test("negation never takes every premise at once", () => {
    const layout = buildChain(["A", "B", "C", "D", "E"]);
    const scale = Object.values(LINEAR_SCALES)[0];
    let sawSome = false;

    for (let i = 0; i < 300; i++) {
        const { premises, negations } = renderPremises(scale, layout, { negate: true });
        assert(negations >= 1, "negation was on and nothing came out negated");
        assert(negations < premises.length,
            `all ${premises.length} premises were negated, which is the same item read backwards`);
        if (negations > 1) sawSome = true;
    }

    assert(sawSome, "the count never varied, so negation is now fixed at one");
});

/**
 * Toggling a mode on must not freeze its difficulty forever.
 *
 * Reported from play: eighty answers, almost all correct, and the premise count
 * never moved off each mode's minimum. The posterior was climbing the whole
 * time — a replay of the session has Distinction reaching four premises with
 * two rungs — so the model was right and the item never heard about it.
 *
 * The cause was the pin that makes a *chosen* premise count outrank
 * progression. Turning a mode on in Customise writes a whole override, built
 * from a fallback that carries the mode's minimum, so every toggled mode
 * arrived with a stored count that nobody had asked for. The pin took it for a
 * decision and locked progression out of that mode for good, silently.
 */
test("a mode toggled on in Customise is not pinned at its minimum", () => {
    const type = EnumQuestionType.Distinction;
    const floor = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;

    localStorage.clear();
    const overrides = new SettingsOverrideService();
    overrides.setActive(true);
    // Exactly what the panel does when a mode is switched on.
    overrides.setMode(type, { enabled: true }, { enabled: true, numOfPremises: floor });

    assert(!overrides.pinned().premises.has(type),
        "merely enabling a mode pinned its premise count");

    // A number actually typed in still wins, which is the point of the pin.
    overrides.setMode(type, { numOfPremises: floor + 3 }, { enabled: true, numOfPremises: floor });
    assert(overrides.pinned().premises.has(type),
        "a premise count the player chose was not honoured");

    localStorage.clear();
});

test("an account already frozen by the old pin is released", () => {
    /*
     * The marker did not exist when these were written, so the state cannot say
     * outright. A count equal to the mode's minimum is what the fallback writes
     * for a toggle; anything else is a number somebody typed. That misreads a
     * player who deliberately pinned a mode *at* its minimum, which is the right
     * way round — the alternative leaves everyone who toggled a mode frozen
     * with no way to find out why.
     */
    const type = EnumQuestionType.Distinction;
    const floor = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;

    const saved = (n: number) => JSON.stringify({
        active: true,
        modes: { [type]: { enabled: true, numOfPremises: n } },
    });

    localStorage.clear();
    localStorage.setItem("syllogimous-advanced-options", saved(floor));
    assert(!new SettingsOverrideService().pinned().premises.has(type),
        "a legacy default-shaped count is still treated as a decision");

    localStorage.setItem("syllogimous-advanced-options", saved(floor + 4));
    assert(new SettingsOverrideService().pinned().premises.has(type),
        "a legacy count that was clearly typed was discarded");

    localStorage.clear();
});

test("play advances the item, not only the estimate", () => {
    /*
     * The end-to-end version of the report, through the layer that actually
     * hands a premise count to a generator. An estimate that climbs while the
     * item stands still is the failure that was seen, and it is invisible to
     * any test of the model alone.
     */
    const type = EnumQuestionType.Distinction;
    const floor = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;

    localStorage.clear();
    const overrides = new SettingsOverrideService();
    overrides.setActive(true);
    overrides.setMode(type, { enabled: true }, { enabled: true, numOfPremises: floor });

    const progression = new ProgressionService();
    for (let i = 0; i < 40; i++) progression.record(type, "right", 5);

    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    progression.applyTo(overrides.applyTo(settings), overrides.pinned());

    const served = settings.question[type].getNumOfPremises();
    assert(served > floor,
        `forty correct answers and the item is still ${served} premises, the mode's minimum`);

    localStorage.clear();
});
