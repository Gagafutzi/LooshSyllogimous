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
