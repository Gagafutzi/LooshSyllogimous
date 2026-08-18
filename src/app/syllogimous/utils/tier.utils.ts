/**
 * What a tier offers, and what "no tier" offers instead.
 *
 * Pulled out of GameService so it can be tested without an injector and four
 * collaborators. It was worth pulling out for a second reason: the rule has a
 * branch that changes the whole shape of the app, and a rule like that should
 * be readable in one place rather than inferred from a method that also builds
 * questions.
 */

import { EnumTiers, ORDERED_QUESTION_TYPES, ORDERED_TIERS, TIERS_MATRIX } from "../constants/game.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { EnumQuestionType } from "../constants/question.constants";
import { Settings } from "../models/settings.models";

export interface TierOptions {
    /**
     * Whether any system is adapting difficulty.
     *
     * False when both the ability estimate and the training unit are off. The
     * tier is then a label on a score that no longer moves, and a tier that
     * cannot be climbed but still withholds half the app is not a progression
     * system, it is a lock — so the gating goes with it.
     */
    gated: boolean;
    /** Premise count per mode while gated; ignored otherwise. */
    premisesFor(type: EnumQuestionType): number;
}

export function settingsForTier(tier: EnumTiers, options: TierOptions): Settings {
    const tierIdx = ORDERED_TIERS.findIndex(t => t === tier);
    const settings = new Settings();

    settings.setEnable("negation", false);
    settings.setEnable("meta", false);

    for (let i = 0; i < TIERS_MATRIX[tierIdx].length; i++) {
        const type = ORDERED_QUESTION_TYPES[i];
        const enabled = options.gated ? !!TIERS_MATRIX[tierIdx][i] : true;
        const premises = options.gated
            ? options.premisesFor(type)
            // Its own floor, so every mode is playable and Customise is the
            // only thing left deciding what gets played.
            : QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;
        settings.setQuestionSettings(type, enabled, premises);
    }

    // Negation and meta are tier rewards. Ungated there is no tier to have
    // earned them from, so they start off like everything else.
    if (!options.gated) return settings;

    if (tierIdx > 5) settings.setEnable("negation", true);
    if (tierIdx > 6) settings.setEnable("meta", true);

    return settings;
}
