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

    /** Jumps the score to the bottom of the chosen tier. */
    jumpToTier(name: string) {
        const min = TIER_SCORE_RANGES[name as EnumTiers]?.minScore;
        if (min == null) return;
        // The lowest tier opens at -Infinity, which is not a usable score.
        this.game.score = Number.isFinite(min) ? min : 0;
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
