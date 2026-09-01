import { Component } from "@angular/core";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../../constants/settings.constants";
import { ModeOverride, SettingsOverrideService } from "../../services/settings-override.service";

import { ProgressionService } from "../../services/progression.service";
import { GameService } from "../../services/game.service";
import { ProgressAndPerformanceService } from "../../services/progress-and-performance.service";
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
        public progress: ProgressAndPerformanceService,
    ) { }

    /* ---- conclusions ---- */

    get deepConclusions() { return this.overrides.deepConclusions; }

    setDeepConclusions(on: boolean) { this.overrides.setDeepConclusions(on); }

    get seriesBonus() { return this.game.seriesBonusSeconds; }

    setSeriesBonus(raw: string) { this.game.setSeriesBonusSeconds(Number(raw)); }

    get curateSession() { return this.overrides.curateSession; }

    setCurateSession(on: boolean) { this.overrides.setCurateSession(on); }

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

    /**
     * How often a mode comes up, relative to the others.
     *
     * Named rather than numbered: "×0.5" invites the question "half of what?",
     * where the answer is "half as often as a mode set to normal" and nobody
     * reads that off a multiplier. Rarely is a quarter rather than a half so
     * that it is worth choosing — half is barely a change over a session.
     */
    weights = [
        { value: 0.25, label: "Rarely" },
        { value: 0.5, label: "Less often" },
        { value: 1, label: "Normal" },
        { value: 2, label: "More often" },
        { value: 4, label: "A lot" },
    ];

    weightOf(row: Row): number {
        return this.overrides.weightFor(row.type);
    }

    setWeight(row: Row, raw: string) {
        this.overrides.setWeight(row.type, Number(raw) || 1);
    }

    setProg(key: string, raw: string | boolean) {
        const value = typeof raw === "boolean" ? raw : Number(raw);
        this.progression.set(key as any, value as any);
    }

    /**
     * What the model currently believes about this mode, in one line.
     *
     * The estimate moves on every answer and the *item* only changes when it
     * crosses a step — a premise is worth about a level, a rung half of one, so
     * most of a level can be earned with nothing to show for it. That is
     * Finding 3 in `progression/diagnosis.md`, and the complaint it produces is
     * "I am not advancing" when the honest answer is "you advanced 0.4 and the
     * next thing costs 0.6".
     *
     * A number that goes up is the cheapest possible answer to that, and an
     * honest one: it really did go up.
     */
    abilityOf(row: Row) {
        const est = this.progression.estimateFor(row.type);
        const choice = this.progression.configFor(row.type);
        const ladder = ladderFor(row.type);
        return {
            level: est.level,
            // Shown because a wide estimate is why items feel easy, and it is
            // the thing that shrinks as a mode is played rather than climbed.
            sure: est.sd,
            trials: est.trials,
            premises: choice.premises,
            rungs: choice.rungs,
            ofRungs: ladder.length,
        };
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

    /* ---- training units (the pre-progression adaptive system) ---- */

    /**
     * The older adaptive system, now switchable.
     *
     * It was unconditional and merely outranked by fluid progression, so there
     * was no way to have *nothing* adapting. With both off the tier stops
     * moving and stops gating, which is what `game.progressionActive` reports.
     */
    get unitsOn() { return this.progress.trainingUnitsEnabled; }

    setUnitsOn(on: boolean) { this.progress.trainingUnitsEnabled = on; }

    /** True when neither adaptive system is running. */
    get nothingAdapts() { return !this.game.progressionActive; }

    get unit() {
        const s = this.progress.getTrainingUnitSettings();
        return { length: s.trainingUnitLength, up: s.premisesUpThreshold, down: s.premisesDownThreshold };
    }

    setUnit(key: "length" | "up" | "down", raw: string) {
        const n = Number(raw);
        if (!Number.isFinite(n)) return;
        this.progress.setTrainingUnitSettings(
            key === "length" ? { trainingUnitLength: Math.round(n) }
            : key === "up" ? { premisesUpThreshold: n }
            : { premisesDownThreshold: n });
    }

    /* ---- profiles ---- */

    newProfileName = "";

    get profiles() { return this.overrides.profiles; }
    get activeProfileId() { return this.overrides.state.activeProfile; }

    /**
     * In force, rather than merely loaded.
     *
     * The row used to key off `activeProfileId` alone, so a profile could
     * announce itself as in use while the master switch was off and none of its
     * settings reached a question.
     */
    applied(id: string) { return this.overrides.profileApplied(id); }

    /** Loaded, but doing nothing — the state the label used to hide. */
    loadedButOff(id: string) {
        return id === this.activeProfileId && !this.overrides.state.active;
    }

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
    /**
     * An empty override. Nothing is seeded, because a seeded value is
     * indistinguishable from a chosen one once it is written down — which is
     * how toggling a mode came to pin its premise count at the minimum for good.
     */
    private fallback(_row: Row): ModeOverride { return {}; }

    /* ---- what this profile actually says, versus what it leaves alone ---- */

    /** Whether the row overrides its enabled state at all. */
    enabledSet(row: Row) { return this.overrides.state.modes[row.type]?.enabled !== undefined; }

    /** Whether the row fixes a premise count, rather than letting play decide. */
    premisesSet(row: Row) {
        return this.overrides.state.modes[row.type]?.numOfPremises !== undefined;
    }

    /** What the mode would be doing with no override: what "auto" means here. */
    autoPremises(row: Row) {
        try { return this.progression.configFor(row.type).premises; }
        catch { return row.min; }
    }

    autoEnabled(row: Row) { return QUESTION_TYPE_SETTING_PARAMS[row.type].enabled; }

    /** Give a setting back to the tier and the ladder. */
    clearEnabled(row: Row) { this.overrides.clearModeSetting(row.type, "enabled"); }
    clearPremises(row: Row) { this.overrides.clearModeSetting(row.type, "numOfPremises"); }

    modeOf(row: Row) { return this.overrides.modeOf(row.type, this.fallback(row)); }

    /** The value to show: the override if there is one, else what play gives. */
    shownEnabled(row: Row) {
        return this.enabledSet(row) ? !!this.modeOf(row).enabled : this.autoEnabled(row);
    }

    shownPremises(row: Row) {
        return this.premisesSet(row) ? this.modeOf(row).numOfPremises : this.autoPremises(row);
    }

    setActive(value: boolean) { this.overrides.setActive(value); }

    toggleMode(row: Row, enabled: boolean) {
        this.overrides.setMode(row.type, { enabled }, this.fallback(row));
    }

    /**
     * One mode on, every other off — in one click rather than thirty-five.
     *
     * Drilling a single mode is a thing people do constantly and the page made
     * it clerical: unticking every other box by hand, and then unticking them
     * back afterwards, which nobody does, so the setting quietly stays narrow
     * long after the drill ended. A button that states the intent can also be
     * undone by the button beside it.
     */
    soloMode(row: Row) {
        for (const other of this.rows) {
            this.overrides.setMode(other.type,
                { enabled: other.type === row.type }, this.fallback(other));
        }
    }

    /** The way back, which is the half that makes solo safe to press. */
    allModes(enabled: boolean) {
        for (const row of this.rows) {
            this.overrides.setMode(row.type, { enabled }, this.fallback(row));
        }
    }

    /** Whether this row is already the only one on, so the button can say so. */
    isSolo(row: Row) {
        return this.shownEnabled(row)
            && this.rows.every(r => r.type === row.type || !this.shownEnabled(r));
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

    setFlag(key: "meta" | "negation" | "useEmojis" | "meaningfulWords" | "visualNoise" | "junkEmojis" | "useText", value: boolean) {
        this.overrides.setFlag(key, value);
    }

    /* ---- stimulus mix ---- */

    mixRows = [
        { key: "useText", label: "Text" },
        { key: "useEmojis", label: "Emoji" },
        { key: "junkEmojis", label: "Junk shapes" },
        { key: "visualNoise", label: "Visual noise" },
        { key: "pharmaStimuli", label: "Pharmacy" },
    ];

    /** Whether more than one kind is on, so a mix means anything. */
    get mixMatters() {
        return this.mixRows.filter(r => (this.flags as any)[r.key]).length > 1;
    }

    mixOf(kind: string) { return this.overrides.state.flags.stimulusMix?.[kind] ?? 1; }

    setMix(kind: string, raw: string) {
        this.overrides.setMix(kind, Math.max(0, Math.min(5, Number(raw) || 0)));
    }

    enabledCount() {
        return this.rows.filter(r => this.modeOf(r).enabled).length;
    }

    reset() { this.overrides.reset(); }
}
