import { Injectable } from "@angular/core";
import { EnumQuestionType } from "../constants/question.constants";
import { Settings } from "../models/settings.models";
import { LinearScale } from "../utils/linear.utils";
import { AXIS_CHOICES, axisWordConflicts } from "../utils/ndspace.utils";

/**
 * User overrides on top of tier-derived settings.
 *
 * v4 derives which modes are active, and how many premises each gets, purely
 * from the current tier — there is no way to tune it. This layer sits on top:
 * `GameService.settings` applies it after building the tier settings, so no
 * generator or tier logic changes.
 *
 * Off by default. With `active` false the app behaves exactly as stock v4,
 * which keeps tier progression meaningful for anyone who does not opt in.
 */

export interface ModeOverride {
    enabled: boolean;
    numOfPremises: number;
    /** Extra transformations, for the modes that have any. Premise-neutral. */
    transformDepth?: number;
}

/**
 * Structural modifiers for the linear-scale family.
 *
 * These are normally earned rung by rung (see RUNG_LADDERS), which is the right
 * default — they are the difficulty, so handing them out at level two makes the
 * ladder meaningless. This layer exists so they can be switched on directly:
 * someone who already plays with branching premises elsewhere should not have to
 * climb to them, and none of it is testable otherwise.
 *
 * `null` means "whatever the ladder says"; true and false force it.
 */
export interface LinearFeatureFlags {
    /** Premises form a branching graph rather than a chain — v3 calls this 180. */
    branching: boolean | null;
    /** Objects may share a coordinate, making "is equal to" a real answer. */
    overlap: boolean | null;
    /** Transformation premises applied after the layout is described. */
    transforms: number | null;
    /** Several conclusions, all of which must hold. */
    multiConclusion: boolean | null;
    /** Pick which conclusion follows instead of judging one. */
    chooseConclusion: boolean | null;
    /** State the conclusion yourself, one relation per dimension. */
    constructConclusion: boolean | null;
    /** Ask for the exact distance too, not just the direction. */
    constructDistance: boolean | null;
    /** Leave out the axes a pair does not differ on. */
    compact: boolean | null;
    /** Premises that rewrite earlier relations. */
    edits: number | null;
    /** Conclusions that compare two relations instead of naming one. */
    analogy: boolean | null;
}

export const DEFAULT_LINEAR_FEATURES: LinearFeatureFlags = {
    branching: null,
    overlap: null,
    transforms: null,
    multiConclusion: null,
    chooseConclusion: null,
    constructConclusion: null,
    constructDistance: null,
    compact: null,
    edits: null,
    analogy: null,
};

/** Axis composition for the composed-space modes, keyed by dimension count. */
export interface SpaceOverrides {
    /** Scale ids per dimension count; empty or missing means use the preset. */
    axes: Record<number, string[]>;
    /** How many axes wrap into a loop; null defers to the ladder. */
    circularAxes: number | null;
}

export const DEFAULT_SPACE: SpaceOverrides = { axes: {}, circularAxes: null };

/**
 * A named configuration, saved so it can be come back to.
 *
 * This is what replaced Free Play. That page let you configure a session and
 * play it unscored, but the configuration lived nowhere — every visit started
 * from the last one, there was no way to keep two of them, and the settings it
 * could reach were a subset of what the generators actually read. A profile is
 * the same idea made durable: the whole override state, under a name, with the
 * unscored flag as a property of the profile rather than of a separate mode.
 */
export interface Profile {
    id: string;
    name: string;
    /**
     * Answers do not count towards score, stats or the ability estimate.
     *
     * Free Play's one genuinely distinct behaviour, kept because it is worth
     * keeping: somewhere to try a punishing configuration without teaching the
     * model that you are worse than you are.
     */
    practice: boolean;
    /** The saved settings. Everything in OverrideState except the profile list. */
    config: ProfileConfig;
}

export type ProfileConfig = Omit<OverrideState, "profiles" | "activeProfile">;

export interface OverrideState {
    active: boolean;
    /** 0 = premises in chain order, 100 = freely shuffled. */
    scrambleFactor: number;
    modes: Partial<Record<EnumQuestionType, ModeOverride>>;
    flags: {
        meta: boolean;
        negation: boolean;
        useText: boolean;
        useEmojis: boolean;
        meaningfulWords: boolean;
        visualNoise: boolean;
    };
    linear: LinearFeatureFlags;
    space: SpaceOverrides;
    /** Saved configurations, in the order they were made. */
    profiles: Profile[];
    /** Which one is loaded, or "" for the unsaved working state. */
    activeProfile: string;
}

const LS_OVERRIDES = "syllogimous-advanced-options";

const DEFAULT_STATE: OverrideState = {
    active: false,
    scrambleFactor: 100,
    modes: {},
    flags: { meta: true, negation: true, useText: true, useEmojis: false, meaningfulWords: true, visualNoise: false },
    linear: { ...DEFAULT_LINEAR_FEATURES },
    space: { axes: {}, circularAxes: null },
    profiles: [],
    activeProfile: "",
};

@Injectable({ providedIn: "root" })
export class SettingsOverrideService {
    state: OverrideState = JSON.parse(JSON.stringify(DEFAULT_STATE));

    constructor() { this.load(); }

    /**
     * Mutates a tier-built Settings in place. Called from the settings getter,
     * so it must stay cheap and must never throw — a bad saved override should
     * degrade to stock behaviour, not break question generation.
     */
    applyTo(settings: Settings): Settings {
        if (!this.live) return settings;

        try {
            for (const [type, ov] of Object.entries(this.state.modes)) {
                const qs = settings.question[type as EnumQuestionType];
                if (!qs || !ov) continue;
                qs.enabled = ov.enabled;
                if (ov.numOfPremises) qs.setNumOfPremises(qs.clampNumOfPremises(ov.numOfPremises));
            }

            // At least one type must survive or generation has nothing to pick.
            const anyEnabled = Object.values(settings.question).some(q => q.enabled);
            if (!anyEnabled) settings.question[EnumQuestionType.Distinction].enabled = true;

            settings.setEnable("meta", this.state.flags.meta);
            settings.setEnable("negation", this.state.flags.negation);
            settings.setEnable("useText", this.state.flags.useText);
            settings.setEnable("useEmojis", this.state.flags.useEmojis);
            settings.setEnable("meaningfulWords", this.state.flags.meaningfulWords);
            settings.setEnable("visualNoise", this.state.flags.visualNoise);
        } catch {
            /* fall through to whatever the tier produced */
        }

        return settings;
    }

    setActive(active: boolean) { this.state.active = active; this.save(); }

    /**
     * Ignore this layer entirely while a block of code runs.
     *
     * Calibration needs it. MODE_SCALE's weights describe each mode in its
     * *unmodified* form, so a placement run against items carrying forced
     * branching, transformations and looping axes produces a level number that
     * does not mean what the result screen says it means. Suppressing rather
     * than reading around it keeps the rule in one place: a placement measures
     * the mode, not the mode plus whatever is currently switched on.
     */
    private suppressed = false;

    suppress<T>(fn: () => T): T {
        const before = this.suppressed;
        this.suppressed = true;
        try { return fn(); } finally { this.suppressed = before; }
    }

    /** Whether this layer should be consulted at all right now. */
    private get live() {
        return this.state.active && !this.suppressed;
    }

    /* ---------------- profiles ---------------- */

    get profiles() { return this.state.profiles ?? []; }

    get activeProfile(): Profile | undefined {
        return this.profiles.find(p => p.id === this.state.activeProfile);
    }

    /**
     * Whether the active profile is unscored.
     *
     * False when nothing is loaded, so the working state always counts — a
     * player who never opens this page is never quietly practising.
     */
    get practice(): boolean {
        return !!this.activeProfile?.practice && this.state.active;
    }

    /** The part of the state a profile carries. */
    private snapshot(): ProfileConfig {
        const { profiles, activeProfile, ...config } = this.state;
        return JSON.parse(JSON.stringify(config));
    }

    saveProfile(name: string, practice = false): string {
        const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
        this.state.profiles = [...this.profiles, { id, name, practice, config: this.snapshot() }];
        this.state.activeProfile = id;
        this.save();
        return id;
    }

    /**
     * Load a profile into the working state.
     *
     * Switching also turns the layer on: choosing a profile is choosing to use
     * it, and leaving the master switch off would make the click do nothing
     * visible — the commonest way a settings screen loses someone's trust.
     */
    useProfile(id: string) {
        const profile = this.profiles.find(p => p.id === id);
        if (!profile) return;
        const profiles = this.profiles;
        this.state = {
            ...JSON.parse(JSON.stringify(profile.config)),
            profiles,
            activeProfile: id,
            active: true,
        };
        this.save();
    }

    /** Stop using any profile, leaving its settings in place to edit freely. */
    clearProfile() {
        this.state.activeProfile = "";
        this.save();
    }

    renameProfile(id: string, name: string) {
        this.state.profiles = this.profiles.map(p => p.id === id ? { ...p, name } : p);
        this.save();
    }

    setProfilePractice(id: string, practice: boolean) {
        this.state.profiles = this.profiles.map(p => p.id === id ? { ...p, practice } : p);
        this.save();
    }

    duplicateProfile(id: string) {
        const source = this.profiles.find(p => p.id === id);
        if (!source) return;
        const copy: Profile = {
            ...JSON.parse(JSON.stringify(source)),
            id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
            name: `${source.name} copy`,
        };
        this.state.profiles = [...this.profiles, copy];
        this.save();
    }

    deleteProfile(id: string) {
        this.state.profiles = this.profiles.filter(p => p.id !== id);
        if (this.state.activeProfile === id) this.state.activeProfile = "";
        this.save();
    }

    /** Full shuffle unless the user has opted in, matching prior behaviour. */
    get scramble(): number {
        return this.live ? (this.state.scrambleFactor ?? 100) : 100;
    }

    setScramble(value: number) {
        this.state.scrambleFactor = Math.max(0, Math.min(100, value));
        this.save();
    }

    setMode(type: EnumQuestionType, patch: Partial<ModeOverride>, fallback: ModeOverride) {
        const current = this.state.modes[type] ?? { ...fallback };
        this.state.modes[type] = { ...current, ...patch };
        this.save();
    }

    setFlag(key: keyof OverrideState["flags"], value: boolean) {
        this.state.flags[key] = value;
        this.save();
    }

    setLinear<K extends keyof LinearFeatureFlags>(key: K, value: LinearFeatureFlags[K]) {
        this.state.linear = { ...this.state.linear, [key]: value };
        this.save();
    }

    /**
     * Forced value for one structural modifier, or null to defer to the ladder.
     *
     * Reads null when the override layer is switched off entirely, so turning
     * Customise off restores ladder control rather than pinning whatever
     * was last set.
     */
    linearOverride<K extends keyof LinearFeatureFlags>(key: K): LinearFeatureFlags[K] | null {
        if (!this.live) return null;
        return this.state.linear?.[key] ?? null;
    }

    /* ---- composed spaces ---- */

    /** Forced loop count for N-D modes, or null to defer to the ladder. */
    circularAxes(): number | null {
        if (!this.live) return null;
        return this.state.space?.circularAxes ?? null;
    }

    /**
     * The axis stack for a dimension count, or null for the preset.
     *
     * Stored as scale ids so a saved configuration survives a scale being
     * reworded, and filtered against the current catalogue so one that no longer
     * exists is dropped rather than crashing generation.
     */
    axesFor(dims: number): LinearScale[] | null {
        if (!this.live) return null;
        const ids = this.state.space?.axes?.[dims];
        if (!ids?.length) return null;

        const chosen = ids
            .map(id => AXIS_CHOICES.find(s => s.id === id))
            .filter((s): s is LinearScale => !!s);

        // A stack whose axes cannot be told apart in a premise is unreadable,
        // so fall back rather than generate something ambiguous.
        if (chosen.length < 2 || axisWordConflicts(chosen).length) return null;
        return chosen;
    }

    setAxes(dims: number, ids: string[]) {
        const space = this.state.space ?? { axes: {}, circularAxes: null };
        this.state.space = { ...space, axes: { ...space.axes, [dims]: ids } };
        this.save();
    }

    setCircularAxes(value: number | null) {
        const space = this.state.space ?? { axes: {}, circularAxes: null };
        this.state.space = { ...space, circularAxes: value };
        this.save();
    }

    /** Manual depth, independent of the ladder; the two add together. */
    depthFor(type: EnumQuestionType): number {
        if (!this.live) return 0;
        return this.state.modes[type]?.transformDepth ?? 0;
    }

    modeOf(type: EnumQuestionType, fallback: ModeOverride): ModeOverride {
        return this.state.modes[type] ?? fallback;
    }

    reset() {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this.save();
    }

    /**
     * Persist, and keep the loaded profile in step.
     *
     * Editing with a profile active writes through to it rather than silently
     * diverging — a settings page that forgets what you just changed the moment
     * you leave it is worse than one with no profiles at all. Explicit "save"
     * buttons were the alternative, and they are the thing people forget.
     */
    save() {
        const active = this.state.activeProfile;
        if (active && this.profiles.some(p => p.id === active)) {
            const config = this.snapshot();
            this.state.profiles = this.profiles.map(
                p => p.id === active ? { ...p, config } : p);
        }
        try { localStorage.setItem(LS_OVERRIDES, JSON.stringify(this.state)); } catch { /* private mode */ }
    }

    load() {
        try {
            const raw = localStorage.getItem(LS_OVERRIDES);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.state = {
                    ...DEFAULT_STATE,
                    ...parsed,
                    flags: { ...DEFAULT_STATE.flags, ...(parsed.flags ?? {}) },
                    linear: { ...DEFAULT_LINEAR_FEATURES, ...(parsed.linear ?? {}) },
                    space: { ...DEFAULT_SPACE, ...(parsed.space ?? {}), axes: parsed.space?.axes ?? {} },
                    modes: parsed.modes ?? {},
                    scrambleFactor: parsed.scrambleFactor ?? 100,
                    // Absent in states saved before profiles existed.
                    profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
                    activeProfile: parsed.activeProfile ?? "",
                };
            }
        } catch { this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
    }
}
