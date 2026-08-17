import { Component } from "@angular/core";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../../constants/settings.constants";
import { LinearFeatureFlags, ModeOverride, SettingsOverrideService } from "../../services/settings-override.service";

/** The boolean members of LinearFeatureFlags; `transforms` is a count. */
type LinearToggle = Exclude<keyof LinearFeatureFlags, "transforms" | "edits">;
import { ProgressionService } from "../../services/progression.service";
import { GameService } from "../../services/game.service";
import { EnumTiers, ORDERED_TIERS, TIER_SCORE_RANGES } from "../../constants/game.constants";
import { ladderFor } from "../../utils/progression.utils";
import {
    AXIS_CHOICES, AXIS_ORDERINGS, AxisOrdering, axesForDimensions, axisWordConflicts,
    ndAxisColors, reorderAxisIds,
} from "../../utils/ndspace.utils";

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

    get active() { return this.overrides.state.active; }
    get flags() { return this.overrides.state.flags; }

    /* ---- structural modifiers for the linear scales ---- */

    /**
     * Tri-state, not a checkbox: "ladder" defers to what the mode has earned,
     * which is the default and the only setting that leaves progression
     * meaningful. On and off are for trying something out, or for a player who
     * already works at this level elsewhere and should not have to climb to it.
     */
    linearRows: Array<{ key: LinearToggle; label: string; hint: string }> = [
        {
            key: "branching",
            label: "Branching premises (180)",
            hint: "Each object attaches to an arbitrary earlier one, either way round, so the premises stop forming a chain",
        },
        {
            key: "overlap",
            label: "Overlapping positions",
            hint: "Two things can land in the same place, which makes the third relation a real answer. Needs branching",
        },
        {
            key: "multiConclusion",
            label: "Multiple conclusions",
            hint: "Two or three claims; answer true only if every one of them follows",
        },
        {
            key: "chooseConclusion",
            label: "Choose the conclusion",
            hint: "Four claims, exactly one follows. No true/false to guess at",
        },
        {
            key: "constructConclusion",
            label: "Build the conclusion",
            hint: "State the relation yourself, one dimension at a time, instead of judging one",
        },
        {
            key: "constructDistance",
            label: "…and the distance",
            hint: "Also ask how far, not only which way. Off is the easy form — direction alone",
        },
        {
            key: "compact",
            label: "Compact relations",
            hint: "Leave out the dimensions a pair does not differ on, so an unmentioned one means \u201csame\u201d. Composed spaces only",
        },
        {
            key: "analogy",
            label: "Analogy conclusions",
            hint: "Judge whether two relations match instead of naming one. Matches on direction, not distance. Composed spaces only",
        },
    ];

    /* ---- premise editing ---- */

    get editCount(): number | null {
        return this.overrides.state.linear?.edits ?? null;
    }

    setEditCount(raw: string) {
        if (raw === "" || raw == null) return this.overrides.setLinear("edits", null);
        this.overrides.setLinear("edits", Math.max(0, Math.min(4, Number(raw) || 0)));
    }

    linearOf(key: LinearToggle): boolean | null {
        return this.overrides.state.linear?.[key] ?? null;
    }

    setLinear(key: LinearToggle, value: boolean | null) {
        this.overrides.setLinear(key, value);
    }

    /* ---- composed spaces ---- */

    spaceDims = [3, 4, 5, 6];

    axisChoices = AXIS_CHOICES.map(s => ({
        id: s.id,
        label: s.name,
        words: `${s.direction[0]}/${s.direction[1]}`,
        canLoop: !!s.cyclic,
    }));

    /** Current stack for a dimension count: the override if set, else the preset. */
    axesOf(dims: number): string[] {
        const saved = this.overrides.state.space?.axes?.[dims];
        if (saved?.length) return saved;
        return axesForDimensions(dims).map(s => s.id);
    }

    toggleAxis(dims: number, id: string) {
        const current = this.axesOf(dims);
        const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
        this.overrides.setAxes(dims, next);
    }

    resetAxes(dims: number) { this.overrides.setAxes(dims, []); }

    /* ---- axis order ---- */

    orderings = AXIS_ORDERINGS;

    /**
     * The stack in reading order, carrying the colour each axis is painted in.
     *
     * Colours come from the same function the generator uses, so the strip is
     * a legend for the premises rather than a second opinion about them.
     */
    orderedAxes(dims: number) {
        const scales = this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter((s): s is typeof AXIS_CHOICES[number] => !!s);
        const colors = ndAxisColors(scales.map(scale => ({ scale })));
        return scales.map((s, i) => ({ id: s.id, label: s.name, color: colors[i] }));
    }

    /**
     * Move one axis one place through the premise.
     *
     * Saves the whole list, including when nothing was overridden yet — the
     * preset order is a perfectly good starting point to nudge, and there is
     * no other way to express "the default, but time first".
     */
    moveAxis(dims: number, index: number, delta: number) {
        const ids = [...this.axesOf(dims)];
        const to = index + delta;
        if (to < 0 || to >= ids.length) return;
        [ids[index], ids[to]] = [ids[to], ids[index]];
        this.overrides.setAxes(dims, ids);
    }

    applyOrdering(dims: number, how: AxisOrdering) {
        this.overrides.setAxes(dims, reorderAxisIds(this.axesOf(dims), how));
    }

    isPreset(dims: number) {
        return !this.overrides.state.space?.axes?.[dims]?.length;
    }

    /**
     * Why a stack will be ignored, if it will be.
     *
     * Silently falling back to the preset would look like the setting does
     * nothing, so the reason is stated: too few axes to be a space, or two axes
     * that use the same word and so cannot be told apart in a premise.
     */
    axisWarning(dims: number): string {
        const chosen = this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter((s): s is typeof AXIS_CHOICES[number] => !!s);

        if (chosen.length < 2) return "Needs at least two axes — using the default.";
        const clash = axisWordConflicts(chosen);
        if (clash.length) return clash[0] + " — using the default.";
        if (chosen.length !== dims) {
            return `${chosen.length} axes selected for a ${dims}D mode; the mode uses however many you pick.`;
        }
        return "";
    }

    get circularAxes(): number | null {
        return this.overrides.state.space?.circularAxes ?? null;
    }

    setCircularAxes(value: number | null) { this.overrides.setCircularAxes(value); }

    /** How many of the current axes could actually be looped. */
    loopableCount(dims: number): number {
        return this.axesOf(dims)
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter(s => s?.cyclic).length;
    }

    get linearTransforms(): number | null {
        return this.overrides.state.linear?.transforms ?? null;
    }

    setLinearTransforms(raw: string) {
        // Empty means "defer to the ladder"; a number forces that many.
        if (raw === "" || raw == null) return this.overrides.setLinear("transforms", null);
        this.overrides.setLinear("transforms", Math.max(0, Math.min(4, Number(raw) || 0)));
    }

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

    get scramble() { return this.overrides.state.scrambleFactor ?? 100; }
    setScramble(raw: string) { this.overrides.setScramble(Number(raw) || 0); }

    reset() { this.overrides.reset(); }
}
