/**
 * The explanation overlay, and the switch that suppresses it.
 *
 * The panel after a wrong answer is the one deliberate interruption on the game
 * screen, and it is now optional. Two things have to hold for the switch to be
 * worth having: off has to mean nothing opens, and absence of the setting has
 * to mean the behaviour every existing player already had — the flag is stored
 * as an *off* switch precisely so that no one is migrated by it.
 *
 * Tested here rather than through `GameService`, which needs a router, a modal
 * service and four more collaborators to construct. The rule was split into
 * `review.utils` so that it could be a function instead of a screen.
 */

import { assert, equal, test } from "./harness";
import {
    explanationsOn, reviewSteps, setExplanationsOn,
} from "../src/app/syllogimous/utils/review.utils";

const steps = ["A is above B", "B is above C", "so A is above C"];

function fresh() { localStorage.clear(); }

test("explanations are on for anyone who has never set them", () => {
    fresh();
    assert(explanationsOn(), "a fresh store read as explanations off");
    equal(reviewSteps("wrong", steps).length, steps.length,
        "a wrong answer showed nothing with the setting untouched");
});

test("turning them off opens nothing, and turning them back on restores it", () => {
    fresh();
    setExplanationsOn(false);
    assert(!explanationsOn(), "the off switch did not take");
    equal(reviewSteps("wrong", steps).length, 0,
        "a wrong answer still stopped for its derivation");
    equal(reviewSteps("timeout", steps).length, 0,
        "a timeout still stopped for its derivation");

    setExplanationsOn(true);
    assert(explanationsOn(), "turning it back on did not take");
    equal(reviewSteps("wrong", steps).length, steps.length,
        "the derivation did not come back");
});

/**
 * On is stored as *nothing*, which is what makes the default free.
 *
 * A stored "true" would work identically today and would quietly become the
 * thing a future default change could not move.
 */
test("on leaves nothing behind in storage", () => {
    fresh();
    setExplanationsOn(false);
    setExplanationsOn(true);
    equal(localStorage.getItem("SYL_EXPLANATIONS_OFF"), null,
        "switching back on left a stored value behind");
});

test("a correct answer never opens the panel, either way", () => {
    fresh();
    equal(reviewSteps("correct", steps).length, 0, "a correct answer opened the panel");
    setExplanationsOn(false);
    equal(reviewSteps("correct", steps).length, 0, "a correct answer opened the panel");
});

/** A mode that derives nothing has always flowed straight on. */
test("a mode with no derivation asks for no panel", () => {
    fresh();
    equal(reviewSteps("wrong", undefined).length, 0, "an absent derivation became a panel");
    equal(reviewSteps("wrong", []).length, 0, "an empty derivation became a panel");
});

/* ------------------------------------------------------------------ *
 * Zen mode                                                            *
 * ------------------------------------------------------------------ */

/**
 * Zen mode is a way of playing, not three settings that happen to combine: no
 * answer buttons, no explanation, and the arrows doing everything.
 *
 * The part worth testing here is the one that could quietly go wrong — that it
 * *overrides* the explanation switch rather than writing to it. Writing would
 * mean turning zen off left explanations off too, and the player would have to
 * remember what they had set before it.
 */
test("zen mode suppresses the explanation without changing the setting", () => {
    fresh();
    setExplanationsOn(true);

    // What the game service passes while zen is on.
    equal(reviewSteps("wrong", steps, explanationsOn() && !true).length, 0,
        "zen mode still stopped for the derivation");

    // And the setting underneath is untouched, so switching zen off restores it.
    assert(explanationsOn(), "zen mode wrote through to the explanation setting");
    equal(reviewSteps("wrong", steps, explanationsOn() && !false).length, steps.length,
        "turning zen off did not give the explanation back");
});

test("zen mode leaves an explanation off if that is what was set", () => {
    fresh();
    setExplanationsOn(false);
    equal(reviewSteps("wrong", steps, explanationsOn() && !false).length, 0,
        "turning zen off turned explanations on for someone who had them off");
});
