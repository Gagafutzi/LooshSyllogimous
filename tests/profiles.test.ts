/**
 * Profiles — what Free Play became.
 *
 * The page it replaced kept nothing: every visit started from the last
 * configuration, there was no way to hold two of them, and its form reached
 * only a fraction of what the generators actually read. These tests pin the
 * behaviour that made the replacement worth making.
 */

import { assert, equal, test } from "./harness";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Settings } from "../src/app/syllogimous/models/settings.models";

function fresh() {
    localStorage.clear();
    return new SettingsOverrideService();
}

test("a saved profile captures the settings as they stand", () => {
    /*
     * Stop using it before fiddling, or the fiddling belongs to it.
     *
     * That is the contract — edits write through to the loaded profile, so
     * there is nothing to remember to press — and this test originally assumed
     * the opposite and failed, which is the check working. The escape hatch is
     * "Stop using", exercised here.
     */
    const o = fresh();
    o.setScramble(30);
    o.setLinear("branching", true);
    const id = o.saveProfile("Wide");

    o.clearProfile();
    o.setScramble(90);
    o.setLinear("branching", false);
    o.useProfile(id);

    equal(o.state.scrambleFactor, 30, "scramble was not restored");
    equal(o.state.linear.branching, true, "a modifier was not restored");
});

test("edits made after stopping do not reach the profile", () => {
    const o = fresh();
    o.setScramble(30);
    const id = o.saveProfile("Fixed");
    o.clearProfile();
    o.setScramble(99);

    const reloaded = new SettingsOverrideService();
    reloaded.useProfile(id);
    equal(reloaded.state.scrambleFactor, 30, "an edit leaked into an unloaded profile");
});

test("using a profile switches the layer on", () => {
    // Choosing a profile is choosing to use it; leaving the master switch off
    // would make the click do nothing visible.
    const o = fresh();
    const id = o.saveProfile("Anything");
    o.setActive(false);
    o.useProfile(id);
    assert(o.state.active, "using a profile left the override layer off");
});

test("editing while a profile is loaded writes into it", () => {
    const o = fresh();
    const id = o.saveProfile("Live");
    o.setScramble(15);

    const reloaded = new SettingsOverrideService();
    reloaded.useProfile(id);
    equal(reloaded.state.scrambleFactor, 15, "the edit did not reach the profile");
});

test("profiles are independent of each other", () => {
    const o = fresh();
    o.setScramble(10);
    const a = o.saveProfile("A");
    o.clearProfile();
    o.setScramble(80);
    const b = o.saveProfile("B");

    o.useProfile(a);
    equal(o.state.scrambleFactor, 10, "profile A picked up profile B's edit");
    o.useProfile(b);
    equal(o.state.scrambleFactor, 80, "profile B lost its own setting");
});

test("practice is off unless a practice profile is in use", () => {
    const o = fresh();
    assert(!o.practice, "the working state counted as practice");

    const id = o.saveProfile("Scratch");
    o.setProfilePractice(id, true);
    o.useProfile(id);
    assert(o.practice, "a practice profile did not report practice");

    o.clearProfile();
    assert(!o.practice, "practice survived leaving the profile");
});

test("a copy does not share state with its original", () => {
    const o = fresh();
    o.setScramble(25);
    const id = o.saveProfile("Original");
    o.duplicateProfile(id);
    const copy = o.profiles.find(p => p.id !== id)!;

    o.useProfile(copy.id);
    o.setScramble(75);
    o.useProfile(id);
    equal(o.state.scrambleFactor, 25, "editing the copy changed the original");
});

test("deleting the profile in use falls back to the working state", () => {
    const o = fresh();
    const id = o.saveProfile("Doomed");
    o.setProfilePractice(id, true);
    o.useProfile(id);
    o.deleteProfile(id);

    equal(o.state.activeProfile, "", "a deleted profile stayed selected");
    assert(!o.practice, "practice outlived the profile that set it");
});

test("profiles survive a reload", () => {
    const o = fresh();
    o.setScramble(45);
    o.saveProfile("Kept");
    const carried = new SettingsOverrideService();
    equal(carried.profiles.length, 1, "the profile list did not persist");
    equal(carried.profiles[0].name, "Kept", "the profile name did not persist");
});

/**
 * A profile that says it is in use has to be in use.
 *
 * Reported with a screenshot: a profile named "playthrough" showing "IN USE",
 * while the saved state had `active: false` — so none of its settings reached a
 * single question. The panel read the label off `activeProfile` alone, and
 * whether the overrides applied at all lived in a second flag it never
 * consulted.
 *
 * `saveProfile` is how the state arose: it marked the new profile as the
 * current one and left the master switch alone. So a profile saved on a fresh
 * install announced itself as in use and did nothing, and nobody had reason to
 * press "Use" on a profile already claiming to be in use.
 */
test("saving a profile puts it in force, not just in the list", () => {
    localStorage.clear();
    const o = new SettingsOverrideService();

    assert(!o.state.active, "overrides start switched off");
    const id = o.saveProfile("playthrough");

    assert(o.state.activeProfile === id, "the new profile is not the current one");
    assert(o.state.active, "the profile was saved as current while switched off");
    assert(o.profileApplied(id), "a saved profile reports itself as not applied");

    localStorage.clear();
});

test("a loaded profile with the switch off is not reported as in use", () => {
    localStorage.clear();
    const o = new SettingsOverrideService();
    const id = o.saveProfile("playthrough");

    o.setActive(false);
    assert(o.state.activeProfile === id, "turning the switch off should not unload the profile");
    assert(!o.profileApplied(id),
        "a profile whose settings reach nothing still reports itself as in use");

    // And pressing Use puts it back in force, which is the way out of that state.
    o.useProfile(id);
    assert(o.profileApplied(id), "pressing Use on a switched-off profile did not switch it on");

    localStorage.clear();
});

test("a profile does not carry the master switch around with it", () => {
    /*
     * `snapshot` captured `active`, so a profile saved while Customise was off
     * stored "off" as part of its settings — and every later load of it
     * reinstated that. A profile describes what the settings are, not whether
     * they are switched on.
     */
    localStorage.clear();
    const o = new SettingsOverrideService();
    o.setActive(false);
    const id = o.saveProfile("saved while off");

    const stored = o.profiles.find(p => p.id === id)!;
    assert((stored.config as { active?: boolean }).active !== false,
        "the profile stored the master switch as part of its settings");

    o.setActive(false);
    o.useProfile(id);
    assert(o.state.active, "loading the profile reinstated the switched-off state");

    localStorage.clear();
});

/**
 * A profile says what you changed and stays silent about the rest.
 *
 * The complaint, in its general form: switching a profile on replaced the whole
 * adaptive system with fixed settings, and there was no way to hand any of it
 * back. The tri-state modifier rows had the right shape all along — Ladder, Off,
 * On — while the mode list had only values, every one of which was applied
 * whether or not anybody had touched it.
 *
 * So the ladder could never run under a profile: premises were pinned, negation
 * and meta were forced on by fields that defaulted to true, and which modes
 * appear was decided by the profile rather than by the tier.
 */
test("an untouched profile changes nothing about how play adapts", () => {
    localStorage.clear();
    const o = new SettingsOverrideService();
    o.saveProfile("playthrough");

    assert(o.state.active, "the profile should be in force");

    const pins = o.pinned();
    equal(pins.premises.size, 0, "a profile nobody edited still pins premise counts");
    assert(!pins.negation, "a profile nobody edited still dictates negation");
    assert(!pins.meta, "a profile nobody edited still dictates meta");

    // And it does not seize control of which modes appear.
    const settings = new Settings();
    const before = Object.fromEntries(
        Object.entries(settings.question).map(([t, q]) => [t, q.enabled]));
    o.applyTo(settings);
    for (const [t, was] of Object.entries(before)) {
        equal(settings.question[t as EnumQuestionType].enabled, was,
            `${t} had its availability decided by an untouched profile`);
    }

    localStorage.clear();
});

test("a setting can be given back after it has been changed", () => {
    /*
     * The half that was missing entirely. Fixing a premise count was possible;
     * un-fixing it was not, at any point, by any control — so one edit removed
     * the premise ladder from that mode permanently.
     */
    const type = EnumQuestionType.Distinction;

    localStorage.clear();
    const o = new SettingsOverrideService();
    o.saveProfile("playthrough");

    o.setMode(type, { numOfPremises: 7 });
    assert(o.pinned().premises.has(type), "a chosen premise count was not honoured");

    o.clearModeSetting(type, "numOfPremises");
    assert(!o.pinned().premises.has(type), "a premise count could not be handed back");

    // Same for whether the mode appears at all.
    o.setMode(type, { enabled: false });
    const off = new Settings();
    o.applyTo(off);
    assert(!off.question[type].enabled, "a mode switched off was not switched off");

    o.clearModeSetting(type, "enabled");
    const back = new Settings();
    const was = back.question[type].enabled;
    o.applyTo(back);
    equal(back.question[type].enabled, was, "the tier did not get its say back");

    localStorage.clear();
});

test("choosing one setting does not quietly choose its neighbours", () => {
    // Overrides used to be seeded from a fallback carrying values for every
    // field, so writing one wrote them all.
    const type = EnumQuestionType.Distinction;

    localStorage.clear();
    const o = new SettingsOverrideService();
    o.saveProfile("playthrough");
    o.setMode(type, { enabled: true });

    assert(!o.pinned().premises.has(type),
        "switching a mode on also fixed its premise count");
    equal(o.state.modes[type]?.numOfPremises, undefined,
        "an unrelated setting was written alongside the one that was chosen");

    localStorage.clear();
});
