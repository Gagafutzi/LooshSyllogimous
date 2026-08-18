/**
 * Turning every progression system off, and what that has to mean.
 *
 * Two systems can adapt difficulty: the ability estimate and the older training
 * unit. The second used to be unconditional — merely outranked when the first
 * was on — so there was no way to have *nothing* adapting.
 *
 * With both off, a tier cannot be climbed. A tier that cannot be climbed but
 * still withholds half the app is not a progression system, it is a lock, so
 * the gating goes with it: every mode is offered, at its own shortest length,
 * and Customise becomes the only thing choosing what gets played.
 *
 * Tested against the settings layer rather than the screen, so a control that
 * stops being wired shows up as a failing assertion rather than as a checkbox
 * that does nothing.
 */

import { assert, equal, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import {
    EnumTiers, ORDERED_QUESTION_TYPES, ORDERED_TIERS,
} from "../src/app/syllogimous/constants/game.constants";
import { settingsForTier } from "../src/app/syllogimous/utils/tier.utils";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";

/** The rule itself, as GameService calls it — not a second copy of it. */
const settingsFor = (tier: EnumTiers, gated: boolean, premisesFor: (t: EnumQuestionType) => number) =>
    settingsForTier(tier, { gated, premisesFor });

test("the lowest tier withholds most modes while anything is adapting", () => {
    const gated = settingsFor(EnumTiers.Peasant, true, () => 3);
    const offered = ORDERED_QUESTION_TYPES.filter(t => gated.question[t].enabled);

    assert(offered.length < ORDERED_QUESTION_TYPES.length / 2,
        `Peasant already offers ${offered.length} of ${ORDERED_QUESTION_TYPES.length} modes,`
        + " so there is nothing for the gate to do");
});

test("with nothing adapting, every mode is offered at its shortest length", () => {
    const free = settingsFor(EnumTiers.Peasant, false, () => 99);

    for (const type of ORDERED_QUESTION_TYPES) {
        assert(free.question[type].enabled, `${type} is still withheld`);
        equal(free.question[type].getNumOfPremises(),
            QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises,
            `${type} did not fall back to its own minimum`);
    }
});

test("the tier stops granting modifiers too", () => {
    // Negation and meta are tier rewards past a threshold. Ungated, the tier
    // has not been climbed to, so it cannot be handing anything out.
    const topGated = settingsFor(ORDERED_TIERS[ORDERED_TIERS.length - 1], true, () => 3);
    assert(topGated.enabled.negation && topGated.enabled.meta,
        "a high tier should still grant these while the system is running");

    const topFree = settingsFor(ORDERED_TIERS[ORDERED_TIERS.length - 1], false, () => 3);
    assert(!topFree.enabled.negation && !topFree.enabled.meta,
        "the tier granted modifiers while no progression system was running");
});

test("ungating does not depend on which tier the frozen score happens to name", () => {
    // The score stops moving, so whatever tier it was left at is arbitrary.
    // Every one of them has to produce the same ungated settings.
    const first = settingsFor(ORDERED_TIERS[0], false, () => 3);

    for (const tier of ORDERED_TIERS) {
        const here = settingsFor(tier, false, () => 3);
        for (const type of ORDERED_QUESTION_TYPES) {
            equal(here.question[type].enabled, first.question[type].enabled,
                `${type} differs at ${tier}`);
            equal(here.question[type].getNumOfPremises(), first.question[type].getNumOfPremises(),
                `${type} length differs at ${tier}`);
        }
    }
});

test("every mode's minimum is a length it can actually be built at", () => {
    // The ungated fallback is the mode's own floor, so that floor has to be
    // honest — otherwise turning progression off would ask for items no
    // generator can make.
    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        assert(params.minNumOfPremises >= 1, `${type} has a minimum of ${params.minNumOfPremises}`);
        assert(params.minNumOfPremises <= params.maxNumOfPremises,
            `${type} has a minimum above its maximum`);
    }
});
