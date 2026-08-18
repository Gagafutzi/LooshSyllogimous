import { Component, Input } from "@angular/core";
import { LinearFeatureFlags, SettingsOverrideService } from "../../services/settings-override.service";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { ladderFor } from "../../utils/progression.utils";
import {
    AXIS_CHOICES, AXIS_ORDERINGS, AxisOrdering, axesForDimensions, axisWordConflicts,
    ndAxisColors, reorderAxisIds,
} from "../../utils/ndspace.utils";

/** The boolean members of LinearFeatureFlags; `transforms` is a count. */
type LinearToggle = Exclude<keyof LinearFeatureFlags, "transforms" | "edits">;

/**
 * How an item is built, as opposed to which items appear.
 *
 * Lifted out of the Customise page because it was only reachable from
 * there, while the settings it writes are read by the generators directly — so
 * they were already in force during Free Play, with no way to see or change
 * them from the screen that is *about* configuring a session. Two pages, one
 * control surface, one place to change the wording.
 *
 * `enabled` greys the controls without hiding them: a disabled control still
 * says the option exists, where a hidden one says the app cannot do it.
 */
@Component({
    selector: "app-mode-modifiers",
    templateUrl: "./mode-modifiers.component.html",
    styleUrls: ["./mode-modifiers.component.css"],
})
export class ModeModifiersComponent {
    @Input() enabled = true;

    /* ---- per-mode rungs ---- */

    /**
     * Rungs the family flags above do not already cover.
     *
     * Listing every rung would put two controls on one setting for the scale
     * modes, where "branching" is both a rung and a family flag. These are the
     * ones that had no control at all: earned or nothing.
     */
    private static readonly COVERED = new Set([
        "negation", "meta", "branching", "overlap", "compact", "analogy",
        "multi-conclusion", "choose-conclusion", "construct-conclusion",
        "construct-distance", "wide-premises", "incorrect-directions",
        "transform-1", "transform-2", "edit-1", "edit-2", "circular", "circular-2",
    ]);

    /** Every mode that has a rung worth showing, with those rungs. */
    rungRows = ORDERED_QUESTION_TYPES
        .map(type => ({
            type,
            rungs: ladderFor(type).filter(r => !ModeModifiersComponent.COVERED.has(r)),
        }))
        .filter(row => row.rungs.length > 0);

    rungOf(type: string, rung: string): boolean | null {
        return this.overrides.state.rungs?.[type]?.[rung] ?? null;
    }

    setRung(type: string, rung: string, value: boolean | null) {
        this.overrides.setRung(type, rung, value);
    }

    /** Rung names are kebab ids; this is what they are called out loud. */
    rungLabel(rung: string) {
        return ({
            "structural": "Structural matching — no counting arrows",
            "rank": "Rank every candidate, not just the furthest",
            "extra-reversal": "A second reversal",
            "third-axis": "A third axis",
            "min-span-3": "Longer routes",
            "cycles": "Cycles in the hierarchy",
            "180": "Backtracking arrangements",
            "reaches": "Reachability, not just direct links",
            "transform-depth-1": "One extra transformation",
            "transform-depth-2": "Two extra transformations",
        } as Record<string, string>)[rung] ?? rung;
    }

    get scramble() { return this.overrides.state.scrambleFactor ?? 100; }

    setScramble(raw: string) { this.overrides.setScramble(Number(raw)); }

    constructor(public overrides: SettingsOverrideService) { }

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
            hint: "Not a chain: A–B, A–C, B–D",
        },
        {
            key: "overlap",
            label: "Overlapping positions",
            hint: "Two things can share a place, so “same” becomes a real answer. Needs branching",
        },
        {
            key: "multiConclusion",
            label: "Multiple conclusions",
            hint: "Two or three claims; true only if all of them follow",
        },
        {
            key: "chooseConclusion",
            label: "Choose the conclusion",
            hint: "Four claims, one follows. No coin to flip",
        },
        {
            key: "constructConclusion",
            label: "Build the conclusion",
            hint: "State the relation yourself, one dimension at a time",
        },
        {
            key: "constructDistance",
            label: "…and the distance",
            hint: "How far as well as which way",
        },
        {
            key: "widePremises",
            label: "Wide premises",
            hint: "Two links per sentence: “A is above B, which is above C”",
        },
        {
            key: "compact",
            label: "Compact relations",
            hint: "Leave out the dimensions a pair does not differ on, so an unmentioned one means \u201csame\u201d. Composed spaces only",
        },
        {
            key: "incorrectDirections",
            label: "Plausible wrong answers",
            hint: "A false direction the item used elsewhere, so “I never saw that” stops working. Direction modes",
        },
        {
            key: "analogy",
            label: "Analogy conclusions",
            hint: "Does A→B match C→D? Direction only, not distance",
        },
    ];

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
}
