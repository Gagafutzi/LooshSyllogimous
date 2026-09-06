/**
 * "Negation isn't checked, and I'm still seeing struck-through premises."
 *
 * Negation and meta are three-state and always were: *leave it to the ladder*,
 * *off*, and *on*. `pinned` reads the third state to decide whether progression
 * may set the flag at all, so the difference is not cosmetic — with no opinion
 * recorded the ladder decides, which is what it is supposed to do.
 *
 * The control was a checkbox. `null` and `false` both drew as an empty box and
 * behaved completely differently: one meant "the ladder decides" and produced
 * negated premises, the other meant "off" and did not. Nothing about the screen
 * distinguished them, so an unchecked box that still negated looked like a bug
 * in the generator, and was looked for there.
 */

import { assert, equal, test } from "./harness";
import { readFileSync } from "fs";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";

function fresh() {
    localStorage.clear();
    const ov = new SettingsOverrideService();
    ov.setActive(true);
    return ov;
}

test("no opinion is a state of its own, and it is the starting one", () => {
    const ov = fresh();
    equal(ov.state.flags.negation, null, "negation starts with an opinion nobody gave");
    equal(ov.pinned().negation, false, "an unset flag should leave the ladder in charge");
});

test("off is pinned, and no-opinion is not", () => {
    const ov = fresh();

    ov.setFlag("negation", false);
    equal(ov.state.flags.negation, false, "switching it off did not record off");
    equal(ov.pinned().negation, true,
        "off was not pinned, so progression may still switch negation back on —"
        + " which is the report: unchecked, and still negating");

    ov.setFlag("negation", null);
    equal(ov.state.flags.negation, null, "there is no way back to letting the ladder decide");
    equal(ov.pinned().negation, false, "no opinion should not pin anything");
});

test("on is pinned too, so the ladder cannot take it away", () => {
    const ov = fresh();
    ov.setFlag("negation", true);
    equal(ov.pinned().negation, true, "an explicit on was not pinned");
});

test("meta has the same three states, and they are independent", () => {
    const ov = fresh();
    ov.setFlag("negation", false);
    equal(ov.pinned().meta, false,
        "an opinion about negation was read as an opinion about meta");
    ov.setFlag("meta", true);
    equal(ov.pinned().negation, true, "the two flags are sharing one opinion");
    equal(ov.pinned().meta, true, "meta's own opinion was not recorded");
});

/**
 * A checkbox cannot show three states. The rung rows on the same screen already
 * use a Ladder / Off / On group, and these now match them.
 */
test("the control offers all three states, not two", () => {
    const html = readFileSync(
        "src/app/syllogimous/pages/advanced-options/advanced-options.component.html", "utf8");

    for (const flag of ["negation", "meta"]) {
        for (const value of ["null", "false", "true"]) {
            assert(html.includes(`setFlag('${flag}', ${value})`),
                `${flag} has no way to be set to ${value}, so two of its three states`
                + " are indistinguishable on screen");
        }
        assert(!new RegExp(`checkbox[^>]*setFlag\\('${flag}'`).test(html),
            `${flag} is still a checkbox, which cannot show "leave it to the ladder"`);
    }
});
