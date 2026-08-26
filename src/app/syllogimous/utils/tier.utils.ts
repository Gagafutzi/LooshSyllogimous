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

/**
 * Which row of `TIERS_MATRIX` a player has earned, in levels rather than points.
 *
 * The matrix was indexed by the *tier*, and the tier by the score — and the
 * score is two different quantities depending on a setting. Accumulated, it is
 * unbounded and measures how much you have played. Derived, it is the ability
 * estimate times a hundred, so it stops at 2600 and measures how good you are.
 * Both were fed to thresholds written for the first, which is why unlocking
 * bore no relation to what a player could actually do: Space 3D wanted a score
 * of 1250, meaning either "played a long time" or "level 12.5", and nothing
 * connected either to having outgrown the modes already on offer.
 *
 * Ability decides it now, in the units the ability model already uses. And the
 * thresholds are deliberately low: the gate exists so a first session is not
 * thirty-three modes at once, not to be a months-long unlock treadmill. Every
 * mode is open by level 8, which is a competent player rather than an expert
 * one — and a mode opened early is not an unfair one, because
 * `priorForNewMode` places it against what the player has already shown.
 *
 * **Except the three widest composed spaces**, which continue past that.
 * Reported from play: a six-dimensional space was being offered by the same row
 * as a three-premise graph match, and no amount of per-mode difficulty aiming
 * makes those the same order of task — one is a mode you can be shown, the
 * other is a mode you have to be ready for. So 5D, 6D and 7D each wait two
 * further levels, which is two tiers apart on the badge as well.
 *
 * Two levels rather than some larger gap because of what happens on arrival:
 * these three open at their *own floor* rather than at the player's aggregate
 * (`FLOOR_START_MODES`), so the first 6D item is three premises whoever you
 * are. The threshold only has to be far enough above that floor — 5.7, 6.6 and
 * 7.2 levels for the three of them — that the opening items are comfortably
 * within reach and the mode climbs from there.
 */
export const TIER_UNLOCK_LEVELS = [0, 3, 4, 5, 6, 7, 8, 10, 12, 14];

/**
 * The furthest row exhaustion alone can reach.
 *
 * Running out of a mode is evidence that *that* mode has nothing left, which is
 * a good reason to be shown the rest of the app and a bad reason to be handed
 * seven axes: `anyExhausted` is true at aggregate level 1 in the case it was
 * written for. So it still opens everything the ramp opens, and the three
 * widest spaces stay behind the levels that price them.
 */
export const EXHAUSTION_ROW = 6;

export interface UnlockEvidence {
    /** Precision-weighted level across every mode with answers. */
    aggregateLevel: number;
    /** The best single mode's level. */
    bestLevel: number;
    /** True when some mode has every rung and its premise ceiling. */
    anyExhausted: boolean;
}

/**
 * The best of the evidence, not the average of it.
 *
 * A player who has genuinely reached seven premises with every modifier on one
 * mode has demonstrated that much reasoning, and gating the rest of the app on
 * their *average* is backwards twice over: it withholds the modes that would
 * raise the average, and it treats breadth as a prerequisite for depth when the
 * app itself has nothing left to offer in the mode they are deep in.
 *
 * `anyExhausted` is the floor under all of it. If some mode has run out of both
 * rungs and length, there is nothing left to serve there, and a system that
 * responds to that by offering nothing new is not pacing anything.
 */
export function unlockRow(evidence: UnlockEvidence): number {
    const level = Math.max(evidence.aggregateLevel, evidence.bestLevel);

    let row = 0;
    for (let i = 0; i < TIER_UNLOCK_LEVELS.length; i++) {
        if (level >= TIER_UNLOCK_LEVELS[i]) row = i;
    }
    if (evidence.anyExhausted) row = Math.max(row, EXHAUSTION_ROW);
    return Math.min(row, Object.keys(TIERS_MATRIX).length - 1);
}

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

/**
 * `row` is what has been *unlocked*; `tier` is only the name on the badge.
 *
 * They were the same number, which is what tied "which modes exist" to a score
 * that may mean either of two things. The badge can stay on the score — it is
 * flavour, and twenty-five names pacing themselves off play time is fine — but
 * nothing should be withheld on that basis.
 */
export function settingsForTier(tier: EnumTiers, options: TierOptions, row?: number): Settings {
    const tierIdx = row ?? ORDERED_TIERS.findIndex(t => t === tier);
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

    /*
     * Still granted, and still keyed on how far the player has got.
     *
     * When the ability model is running these are immediately overridden per
     * mode — `ProgressionService.applyTo` forces them off unless that mode's
     * ladder has earned them, or the whole ladder would be skipped. But it is
     * not the only thing that can be running: with the ability model off and
     * training units on, the row is all there is, and dropping the grant would
     * take negation and meta away from that path entirely.
     *
     * Read against the *unlocked* row, so it tracks what the player can do
     * rather than a score that means one of two things.
     */
    /*
     * Row numbers, not "one row after the other".
     *
     * These read `> 5` and `> 6` when row 6 was the last row anybody could
     * reach, so negation was granted at the top of the ramp and meta was never
     * granted at all. Adding rows 7 to 9 for the widest spaces would have
     * handed meta out as a side effect of a change about which spaces are
     * offered — so the two are pinned: negation where it already landed, meta
     * at the end of the ramp rather than at the first row past it. A row that
     * exists to say "you may see 5D now" is not a modifier reward.
     */
    if (tierIdx >= 6) settings.setEnable("negation", true);
    if (tierIdx >= 9) settings.setEnable("meta", true);

    return settings;
}
