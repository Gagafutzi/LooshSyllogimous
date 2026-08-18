/**
 * The settings that had no controls, and now do.
 *
 * Each of these is a behaviour someone can now ask for. Tested at the layer
 * that decides, so a control that stops being wired shows up as a failing
 * assertion rather than as a slider that does nothing.
 */

import { assert, equal, test } from "./harness";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { getSymbols } from "../src/app/syllogimous/utils/question.utils";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
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
    const COVERED = new Set([
        "negation", "meta", "branching", "overlap", "compact", "analogy",
        "multi-conclusion", "choose-conclusion", "construct-conclusion",
        "construct-distance", "wide-premises", "incorrect-directions",
        "transform-1", "transform-2", "edit-1", "edit-2", "circular", "circular-2",
    ]);
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
