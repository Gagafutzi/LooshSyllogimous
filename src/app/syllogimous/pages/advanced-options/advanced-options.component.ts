import { Component } from "@angular/core";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../../constants/settings.constants";
import { ModeOverride, SettingsOverrideService } from "../../services/settings-override.service";

import { ProgressionService } from "../../services/progression.service";
import { GameService } from "../../services/game.service";
import { EnumTiers, ORDERED_TIERS, TIER_SCORE_RANGES } from "../../constants/game.constants";
import { ladderFor } from "../../utils/progression.utils";

interface Row {
    type: EnumQuestionType;
    min: number;
    max: number;
    basic: boolean;
    group: string;
}

@Component({
    selector: "app-advanced-options",
    templateUrl: "./advanced-options.component.html",
    styleUrls: ["./advanced-options.component.css"],
})
export class AdvancedOptionsComponent {
    rows: Row[] = ORDERED_QUESTION_TYPES.map(type => {
        const p = QUESTION_TYPE_SETTING_PARAMS[type];
        return {
            type,
            min: p.minNumOfPremises,
            max: p.maxNumOfPremises,
            basic: p.basic,
            group: p.group ?? (p.basic ? "Basic" : "Advanced"),
        };
    });

    constructor(
        public overrides: SettingsOverrideService,
        public progression: ProgressionService,
        public game: GameService,
    ) { }

    /* ---- tier cheat (testing) ---- */

    tiers = ORDERED_TIERS;

    get currentTier() { return this.game.tier; }
    get currentScore() { return this.game.score; }

    /**
     * Jump to a tier, by seeding the ability estimate.
     *
     * Setting the score used to do this. It stopped working when tier began
     * following ability rather than an accumulated total: the number moved and
     * the tier did not, so the control silently did nothing. Tier is now a
     * *reading* of ability, so the only way to move it is to move that — which
     * is what the placement test does, and this reuses it.
     */
    jumpToTier(name: string) {
        const index = ORDERED_TIERS.indexOf(name as EnumTiers);
        if (index < 0) return;

        // Mid-band, so a wobble in the estimate does not immediately fall out
        // of the tier that was asked for.
        const min = TIER_SCORE_RANGES[name as EnumTiers].minScore;
        this.game.score = Number.isFinite(min) ? min + 120 : 0;
        this.progression.applyCalibration(this.levelForTier(index), 0);
    }

    /**
     * A level that lands in the requested tier.
     *
     * Tier bands are 250 points wide and skill points come from the aggregate
     * ability, so this inverts that roughly rather than exactly — close enough
     * for a testing control, and honest about being approximate.
     */
    private levelForTier(index: number) {
        return 2 + index * 0.9;
    }

    nudgeScore(delta: number) { this.game.score = this.game.score + delta; }

    get prog() { return this.progression.config; }

    /** The residual as points per hundred, or a dash before there is one. */
    get fatigueReading() {
        const f = this.progression.fatigue;
        if (f === null) return "—";
        const points = Math.round(f * 100);
        return `${points > 0 ? "+" : ""}${points}`;
    }

    setProg(key: string, raw: string | boolean) {
        const value = typeof raw === "boolean" ? raw : Number(raw);
        this.progression.set(key as any, value as any);
    }

    ladderState(row: Row) {
        const s = this.progression.stateFor(row.type);
        const ladder = ladderFor(row.type);
        return {
            premises: s.premises,
            time: Math.round(s.timeLimit),
            rungs: s.rungs.length,
            ofRungs: ladder.length,
            claimed: s.rungs.join(", ") || "none",
        };
    }

    resetLadders() { this.progression.resetAll(); }

    /* ---- profiles ---- */

    newProfileName = "";

    get profiles() { return this.overrides.profiles; }
    get activeProfileId() { return this.overrides.state.activeProfile; }

    saveCurrent() {
        const name = this.newProfileName.trim() || `Profile ${this.profiles.length + 1}`;
        this.overrides.saveProfile(name);
        this.newProfileName = "";
    }

    use(id: string) { this.overrides.useProfile(id); }
    stopUsing() { this.overrides.clearProfile(); }
    duplicate(id: string) { this.overrides.duplicateProfile(id); }
    rename(id: string, name: string) { this.overrides.renameProfile(id, name.trim() || "Untitled"); }
    setPractice(id: string, on: boolean) { this.overrides.setProfilePractice(id, on); }

    /** Deleting is the one destructive control here, so it asks. */
    remove(id: string) {
        const profile = this.profiles.find(p => p.id === id);
        if (profile && confirm(`Delete "${profile.name}"?`)) this.overrides.deleteProfile(id);
    }

    get active() { return this.overrides.state.active; }
    get flags() { return this.overrides.state.flags; }

    /** Tier defaults stand in until the user actually touches a mode. */
    private fallback(row: Row): ModeOverride {
        return {
            enabled: QUESTION_TYPE_SETTING_PARAMS[row.type].enabled,
            numOfPremises: row.min,
        };
    }

    modeOf(row: Row) { return this.overrides.modeOf(row.type, this.fallback(row)); }

    setActive(value: boolean) { this.overrides.setActive(value); }

    toggleMode(row: Row, enabled: boolean) {
        this.overrides.setMode(row.type, { enabled }, this.fallback(row));
    }

    /** Only these two build items out of transformations. */
    hasDepth(row: Row) {
        return row.type === EnumQuestionType.Transformation
            || row.type === EnumQuestionType.AnchorSpaceV2;
    }

    depthOf(row: Row) {
        return this.overrides.state.modes[row.type]?.transformDepth ?? 0;
    }

    setDepth(row: Row, raw: string) {
        const n = Math.max(0, Math.min(6, Number(raw) || 0));
        this.overrides.setMode(row.type, { transformDepth: n }, this.fallback(row));
    }

    setPremises(row: Row, raw: string) {
        const n = Math.max(row.min, Math.min(row.max, Number(raw) || row.min));
        this.overrides.setMode(row.type, { numOfPremises: n }, this.fallback(row));
    }

    setFlag(key: "meta" | "negation" | "useEmojis" | "meaningfulWords" | "visualNoise" | "useText", value: boolean) {
        this.overrides.setFlag(key, value);
    }

    enabledCount() {
        return this.rows.filter(r => this.modeOf(r).enabled).length;
    }

    reset() { this.overrides.reset(); }
}
