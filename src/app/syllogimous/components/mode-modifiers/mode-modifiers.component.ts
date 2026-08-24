import { Component, Input } from "@angular/core";
import { LinearFeatureFlags, SettingsOverrideService } from "../../services/settings-override.service";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { settableRungsFor } from "../../utils/progression.utils";
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
        // Tombstones. They hold a ladder slot so existing profiles keep their
        // earned rungs lined up, and no generator asks for them — so showing a
        // control would be offering a switch wired to nothing. The features
        // themselves are still reachable, as ordinary rows above.
        "retired-wide-premises", "retired-compact",
        "branching", "overlap", "compact", "indeterminate", "facing", "analogy",
        "multi-conclusion", "choose-conclusion", "construct-conclusion",
        "construct-distance", "wide-premises", "incorrect-directions",
        "transform-1", "transform-2", "edit-1", "edit-2", "circular", "circular-2",
    ]);

    /** Every mode that has a rung worth showing, with those rungs. */
    rungRows = ORDERED_QUESTION_TYPES
        .map(type => ({
            type,
            // Off-ladder rungs included: they cannot be earned, so a row here
            // is the only way to reach them at all.
            rungs: settableRungsFor(type)
                .filter(r => !ModeModifiersComponent.COVERED.has(r)),
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
            "negation": "Negated premises — “is not above”, here only",
            "meta": "Relations about relations, here only",
            "structural": "Structural matching — no counting arrows",
            "rank": "Rank every candidate, not just the furthest",
            "min-span-3": "Longer routes",
            "cycles": "Cycles in the hierarchy",
            "180": "Backtracking arrangements",
            "reaches": "Reachability, not just direct links",
            "transform-depth-1": "One extra transformation",
            "transform-depth-2": "Two extra transformations",
            "groups-3": "Three groups to compare, not two",
            "groups-4": "Four groups to compare, not two",
        } as Record<string, string>)[rung] ?? rung;
    }

    get scramble() { return this.overrides.state.scrambleFactor ?? 100; }

    setScramble(raw: string) { this.overrides.setScramble(Number(raw)); }

    /* ---------------- how far apart things sit ---------------- */

    /**
     * A percentile of what the current configuration produces, not a number of
     * bits — "8.5 bits" means nothing until you know what 8.5 is wide *for*,
     * since it depends on the axis stack, the object count and the tie chance.
     *
     * Scoped to one dimension when asked, because spread is not one quantity: a
     * long time axis is a different demand from a tall vertical one, and
     * pooling them lets a narrow axis be paid for by a wide one.
     */
    get spread() { return this.overrides.state.space?.spread?.percentile ?? 50; }
    get spreadAxis() { return this.overrides.state.space?.spread?.axis ?? ""; }

    setSpread(raw: string) {
        this.overrides.setSpread({
            percentile: Math.max(0, Math.min(100, Number(raw) || 0)),
            axis: this.spreadAxis || null,
        });
    }

    setSpreadAxis(id: string) {
        this.overrides.setSpread({ percentile: this.spread, axis: id || null });
    }

    /** Every axis a composed space can be built on, for the scope picker. */
    spreadAxes = AXIS_CHOICES.map(s => ({ id: s.id, label: s.name }));

    constructor(public overrides: SettingsOverrideService) { }

    /**
     * Tri-state, not a checkbox: "ladder" defers to what the mode has earned,
     * which is the default and the only setting that leaves progression
     * meaningful. On and off are for trying something out, or for a player who
     * already works at this level elsewhere and should not have to climb to it.
     */
    /*
     * Wide premises and compact relations are not here.
     *
     * Everything else on this list changes what has to be worked out; those two
     * change only how the same facts are worded, which makes them a display
     * choice. They live on Display & timer, and write to the same store.
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
            key: "facing",
            label: "Left and right",
            hint: "Someone in the layout faces something else, and the claim is judged from there. Composed spaces only",
        },
        {
            key: "indeterminate",
            label: "Under-specified premises",
            hint: "Leave some relations unstated, and ask whether a claim *must* hold. Composed spaces only",
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
        /*
         * Off the ladder as of fixes/6, and here so they are still reachable.
         *
         * Both were being handed out by progression while only sometimes doing
         * anything — wide premises merge only when two consecutive stored edges
         * share an endpoint, which branching makes rare, and branching is
         * earned first. A rung that the item does not visibly honour is worse
         * than no rung, because the player is told they climbed.
         */
        {
            key: "widePremises",
            label: "Two relations per premise",
            hint: "“A is above B, which is above C”. Merges only where the chain allows it, so some items are unaffected",
        },
        {
            key: "compact",
            label: "Skip the axes that match",
            hint: "An unmentioned axis means “the same” rather than one less thing to read. Composed spaces only",
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
