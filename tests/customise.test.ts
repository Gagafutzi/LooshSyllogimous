/**
 * The settings that had no controls, and now do.
 *
 * Each of these is a behaviour someone can now ask for. Tested at the layer
 * that decides, so a control that stops being wired shows up as a failing
 * assertion rather than as a slider that does nothing.
 */

import { readdirSync, readFileSync } from "fs";
import { assert, equal, test } from "./harness";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { getSymbols } from "../src/app/syllogimous/utils/question.utils";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { allStorageKeys } from "../src/app/syllogimous/constants/local-storage.constants";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { ThemeService } from "../src/app/syllogimous/services/theme.service";

function fresh() {
    localStorage.clear();
    const o = new SettingsOverrideService();
    o.setActive(true);
    return o;
}

test("a rung can be forced on or off per mode", () => {
    const o = fresh();
    equal(o.rungOverride("Relational Web", "structural"), null, "should start on the ladder");

    o.setRung("Relational Web", "structural", true);
    equal(o.rungOverride("Relational Web", "structural"), true);

    o.setRung("Relational Web", "structural", false);
    equal(o.rungOverride("Relational Web", "structural"), false,
        "off must be distinguishable from ladder, or it cannot be switched off");

    o.setRung("Relational Web", "structural", null);
    equal(o.rungOverride("Relational Web", "structural"), null);
});

test("rung overrides are per mode, not global", () => {
    const o = fresh();
    o.setRung("Hierarchy", "cycles", true);
    equal(o.rungOverride("Deictic Relations", "cycles"), null,
        "a rung forced on one mode leaked into another");
});

test("rung overrides go quiet when the layer is off", () => {
    const o = fresh();
    o.setRung("Hierarchy", "cycles", true);
    o.setActive(false);
    equal(o.rungOverride("Hierarchy", "cycles"), null,
        "the master switch did not release the rung");
});

test("every rung with no family flag is reachable from the panel", () => {
    /*
     * The gap this closed: ten modifiers existed that no amount of configuring
     * could switch on. If a new mode adds a rung and forgets a control, this
     * fails rather than shipping another unreachable feature.
     */
    /*
     * Read from the component rather than copied, because a copy drifts.
     *
     * This list is the component's claim that a rung already has a control of
     * its own, and everything *not* on it falls through to the per-mode rung
     * panel. A second copy here would let the two disagree silently — and did:
     * two rungs were added with dedicated controls while this list still called
     * them orphans.
     */
    const component = readFileSync(
        "src/app/syllogimous/components/mode-modifiers/mode-modifiers.component.ts", "utf8");
    const block = /COVERED = new Set\(\[([\s\S]*?)\]\)/.exec(component);
    assert(!!block, "the component's covered-rung list could not be read");
    const COVERED = new Set([...block![1].matchAll(/"([^"]+)"/g)].map(m => m[1]));
    assert(COVERED.size > 10, `only ${COVERED.size} rungs claim a dedicated control`);

    const o = fresh();
    const orphans = ORDERED_QUESTION_TYPES.flatMap(
        t => ladderFor(t).filter(r => !COVERED.has(r)).map(r => [t, r] as const));

    assert(orphans.length > 0, "no per-mode rungs found at all");
    for (const [type, rung] of orphans) {
        o.setRung(type, rung, true);
        equal(o.rungOverride(type, rung), true, `${type}/${rung} could not be forced`);
    }
});

test("the stimulus mix is proportional, not equal shares", () => {
    const s = new Settings();
    s.setEnable("useText", true);
    s.setEnable("useEmojis", true);

    const share = (weightText: number) => {
        s.setMix("useText", weightText);
        s.setMix("useEmojis", 1);
        const pool = getSymbols(s);
        // Emoji are surrogate pairs or symbols; text is ASCII letters.
        const text = pool.filter(x => /^[A-Za-z]+$/.test(x)).length;
        return text / pool.length;
    };

    const even = share(1);
    const heavy = share(4);
    assert(heavy > even + 0.1,
        `weighting text 4x did not shift the mix: ${even.toFixed(2)} -> ${heavy.toFixed(2)}`);
});

test("a zero weight is the same as switching the kind off", () => {
    const s = new Settings();
    s.setEnable("useText", true);
    s.setEnable("useEmojis", true);
    s.setMix("useEmojis", 0);

    const pool = getSymbols(s);
    assert(pool.every(x => /^[A-Za-z]+$/.test(x)),
        "a kind weighted at zero still contributed stimuli");
});

/* ------------------------------------------------------------------ *
 * Dimension colours                                                   *
 * ------------------------------------------------------------------ */

test("dimension colours resolve to plain colours the stylesheet can use", () => {
    /*
     * The regression this pins. The strength dial was applied in CSS with
     * `color-mix(in srgb, var(--th-dim-N) var(--th-dim-strength), …)`, which
     * puts a `var()` in a colour function's percentage slot; when that fails to
     * substitute the whole declaration is dropped and the clause silently takes
     * the body colour. The dial is applied here instead, so what reaches the
     * stylesheet is always a plain hex.
     */
    const theme = new ThemeService();
    const varsFor = (strength: number) => {
        theme.set("dimStrength", strength);
        const raw = localStorage.getItem("syllogimous-theme-vars");
        return JSON.parse(raw ?? "{}") as Record<string, string>;
    };

    const full = varsFor(100);
    for (let i = 1; i <= 8; i++) {
        const value = full[`--th-dim-${i}`];
        assert(/^#[0-9a-f]{6}$/i.test(value ?? ""), `--th-dim-${i} was "${value}"`);
    }
});

test("zero strength paints a clause in the body colour", () => {
    const theme = new ThemeService();
    theme.set("dimStrength", 0);
    const vars = JSON.parse(localStorage.getItem("syllogimous-theme-vars") ?? "{}");
    equal(vars["--th-dim-1"].toLowerCase(), String(theme.theme.text).toLowerCase(),
        "off should be indistinguishable from ordinary text");
});

test("half strength lands between the palette and the text", () => {
    const theme = new ThemeService();
    theme.set("dimStrength", 100);
    const full = JSON.parse(localStorage.getItem("syllogimous-theme-vars") ?? "{}")["--th-dim-1"];
    theme.set("dimStrength", 50);
    const half = JSON.parse(localStorage.getItem("syllogimous-theme-vars") ?? "{}")["--th-dim-1"];

    assert(half !== full, "the dial did nothing");
    assert(half.toLowerCase() !== String(theme.theme.text).toLowerCase(),
        "half strength washed the colour out entirely");
});

/**
 * Every mode says what it is before you play it.
 *
 * The game routes to a tutorial before the first play of a mode, and the
 * fallback component exists because a missing one used to make the mode
 * unplayable outright. That fallback is only useful if it has something to say
 * — otherwise a new mode ships with "not written yet" and nothing else, which
 * is how the last four arrived. Cheaper to fail here than to notice in play.
 */
test("no mode ships without an explanation", () => {
    const src = readFileSync(
        "src/app/syllogimous/pages/tutorial/tutorial-generic/tutorial-generic.component.ts",
        "utf8");
    const blurbs = new Set([...src.matchAll(/^    "([^"]+)":/gm)].map(m => m[1]));

    const own = readdirSync("src/app/syllogimous/pages/tutorial")
        .filter(entry => !entry.includes("."));
    const slug = (t: string) => t.toLowerCase().replace(/ /g, "-");

    const missing = ORDERED_QUESTION_TYPES.filter(
        t => !blurbs.has(t) && !own.includes(slug(t)));

    assert(missing.length === 0,
        `no tutorial and no blurb: ${missing.join(", ")}`);
});

/**
 * A backup that contains the account, and a reset that clears it.
 *
 * `export` and `clearAllData` both walked a hand-written list of keys, and it
 * had drifted badly: the ability model, the Customise overrides and their
 * profiles, the residual window, the trial log and the theme were all being
 * written and none of them were on it.
 *
 * Two consequences, and the second is worse. A backup silently omitted
 * everything the current progression system knows. And "wipe all save data"
 * left exactly that state behind — so a player resetting to escape a problem
 * kept the part causing it, and could not tell.
 *
 * It also cost a diagnosis: an exported account looked as though progression
 * had never run, because none of its keys were in the file.
 */
test("export and reset cover every key the app writes", () => {
    localStorage.clear();

    // One key from each family the code writes under.
    const written = [
        "SYL_SCORE",
        "SYL_TRAINING_UNIT:Distinction",
        "syllogimous-ability:Distinction",
        "syllogimous-advanced-options",
        "syllogimous-progression-config",
        "syllogimous-residuals",
        "syllogimous-trials",
        "syllogimous-theme",
        "syllogimous-theme-vars",
        "darkmode",
    ];
    for (const k of written) localStorage.setItem(k, "x");

    const seen = allStorageKeys();
    for (const k of written) {
        assert(seen.includes(k), `${k} would be left out of a backup and survive a reset`);
    }

    localStorage.clear();
});

test("the key list is read from storage, not maintained by hand", () => {
    /*
     * The property that stops it drifting again. A key nobody predicted still
     * gets exported and cleared, so adding one to the app cannot silently
     * create a gap — which is how this list came to be missing nine families.
     */
    localStorage.clear();
    localStorage.setItem("syllogimous-something-invented-later", "x");
    assert(allStorageKeys().includes("syllogimous-something-invented-later"),
        "an unforeseen key is missed, so the list is still effectively hand-written");

    // And nothing that is not ours.
    localStorage.setItem("unrelated-app-key", "x");
    assert(!allStorageKeys().includes("unrelated-app-key"),
        "a reset would delete another app's data");

    localStorage.clear();
});
