import { Injectable } from "@angular/core";
import { EnumQuestionType } from "../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
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
    /**
     * Whether the premise count below was *chosen*, or merely defaulted in.
     *
     * Toggling a mode on writes a whole override, and the fallback it is built
     * from carries the mode's minimum — so a stored count is no evidence that
     * anybody asked for it. Treating it as evidence pinned every toggled mode
     * at its minimum and locked progression out of it entirely, silently, for
     * the rest of the account's life.
     */
    premisesChosen?: boolean;
    /**
     * Undefined means *leave it alone* — the tier and progression decide, as
     * they would with no profile at all.
     *
     * Everything in this layer used to be a value that was always applied, so
     * switching Customise on replaced the adaptive system wholesale even for
     * settings nobody had touched. The tri-state modifier rows had the right
     * idea all along: an override should say what you changed, and stay silent
     * about the rest.
     */
    enabled?: boolean;
    numOfPremises?: number;
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
    /**
     * Withhold clauses so the premises no longer pin every relation down.
     *
     * Not the same as `compact`, which omits a clause to *state* that a pair is
     * level. This omits clauses that carry a real difference and says nothing
     * in their place, so several arrangements fit and the claim becomes one of
     * necessity.
     */
    indeterminate: boolean | null;
    /**
     * Relations judged from inside the layout: left and right, not north and
     * south. A facing is stated relationally ("A faces C") and fixed at the
     * moment it is stated.
     */
    facing: boolean | null;
    /** State two links per sentence: "A is above B, which is above C". */
    widePremises: boolean | null;
    /** Draw a false direction from ones the item actually used. */
    incorrectDirections: boolean | null;
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
    facing: null,
    indeterminate: null,
    widePremises: null,
    incorrectDirections: null,
    edits: null,
    analogy: null,
};

/**
 * How far apart things sit, as a percentile of what this configuration produces.
 *
 * Not a number of bits. "8.5 bits" is meaningless until you know what 8.5 is
 * wide *for* — it depends on the axis stack, the object count and the tie
 * chance — whereas "the widest tenth of what this produces" is meaningful for
 * any of them, with no table to keep in step.
 *
 * `axis` narrows it to one dimension by scale id, which is what makes it a dial
 * for *height*, or for *temporal* width, rather than only for the aggregate.
 * Null means all of them together.
 */
export interface SpreadSetting {
    percentile: number;
    axis: string | null;
}

/** Axis composition for the composed-space modes, keyed by dimension count. */
export interface SpaceOverrides {
    /** Null leaves it at the median, which is the noise-reducing default. */
    spread?: SpreadSetting | null;
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
        /**
         * Tri-state, like every other modifier: null leaves it to progression.
         *
         * These two were plain booleans defaulting to *true*, so switching
         * Customise on — or merely saving a profile, which now switches it on —
         * forced negation and meta onto every mode at once, whatever any of
         * them had earned. Nobody chose that; it was the default value of a
         * field that had no way to say "no opinion".
         */
        meta: boolean | null;
        negation: boolean | null;
        useText: boolean;
        useEmojis: boolean;
        meaningfulWords: boolean;
        visualNoise: boolean;
        junkEmojis: boolean;
        stimulusMix: Record<string, number>;
    };
    linear: LinearFeatureFlags;
    space: SpaceOverrides;
    /**
     * Per-mode rung forcing: `rungs[type][rung]` true, false, or absent.
     *
     * The family flags above cover the scale modes, where a modifier means the
     * same thing in all five. Everything else earned its modifiers one mode at
     * a time and could only *earn* them — a Relational Web mapping item that
     * cannot be identified by counting arrows, or a Deictic item on three axes,
     * existed but was unreachable without grinding to the rung. This is the
     * general form of the tri-state, and it is what the orphans use.
     */
    rungs: Record<string, Record<string, boolean>>;
    /** Saved configurations, in the order they were made. */
    profiles: Profile[];
    /** Which one is loaded, or "" for the unsaved working state. */
    activeProfile: string;
}

const LS_OVERRIDES = "syllogimous-advanced-options";

/**
 * Decide, for state saved before the marker existed, whether a premise count
 * was chosen or defaulted.
 *
 * The data cannot say outright, so it is read the only way it can be: a count
 * equal to the mode's own minimum is what the fallback writes when a mode is
 * merely toggled, and anything else is a number somebody typed. That leaves one
 * misreading — a player who deliberately pinned a mode *at* its minimum is
 * unpinned — and it is the right way round, because the alternative leaves
 * every player who ever toggled a mode frozen at that minimum forever with no
 * way to discover why.
 */
/**
 * Decide, for state saved before these were tri-state, whether negation and
 * meta were *chosen* or merely the old defaults.
 *
 * Both defaulted to true, so a stored `true` is indistinguishable from a
 * decision — the same ambiguity the premise counts had, resolved the same way
 * and for the same reason: leaving everyone who ever switched Customise on with
 * both modifiers forced everywhere is the worse mistake, and "on" is what
 * progression grants anyway once a mode has earned it.
 */
function adoptChosenFlags(flags: Record<string, unknown>): OverrideState["flags"] {
    const merged = { ...DEFAULT_STATE.flags, ...flags } as OverrideState["flags"];
    if (flags["meta"] === true) merged.meta = null;
    if (flags["negation"] === true) merged.negation = null;
    return merged;
}

function adoptChosenPremises(
    modes: Partial<Record<EnumQuestionType, ModeOverride>>,
): Partial<Record<EnumQuestionType, ModeOverride>> {
    const out: Partial<Record<EnumQuestionType, ModeOverride>> = {};

    for (const [type, ov] of Object.entries(modes)) {
        if (!ov) continue;
        if (ov.premisesChosen !== undefined) { out[type as EnumQuestionType] = ov; continue; }

        const floor = QUESTION_TYPE_SETTING_PARAMS[type as EnumQuestionType]?.minNumOfPremises;
        out[type as EnumQuestionType] = {
            ...ov,
            premisesChosen: !!ov.numOfPremises && ov.numOfPremises !== floor,
        };
    }
    return out;
}

const DEFAULT_STATE: OverrideState = {
    active: false,
    scrambleFactor: 100,
    modes: {},
    flags: { meta: null, negation: null, useText: true, useEmojis: false, meaningfulWords: true, visualNoise: false, junkEmojis: false, stimulusMix: {} },
    linear: { ...DEFAULT_LINEAR_FEATURES },
    space: { axes: {}, circularAxes: null, spread: null },
    rungs: {},
    profiles: [],
    activeProfile: "",
};

@Injectable({ providedIn: "root" })
export class SettingsOverrideService {
    state: OverrideState = JSON.parse(JSON.stringify(DEFAULT_STATE));

    constructor() { this.load(); }

    /**
     * What the user has fixed by hand, for the layer that runs after this one.
     *
     * Progression writes premise counts and the negation/meta flags too, and it
     * runs last, so without this it silently overwrites whatever Customise
     * shows — the panel reads "2 premises" and the item arrives with five.
     * A number typed into Customise is a decision, not a suggestion, so
     * progression is told to leave those alone.
     */
    pinned(): { premises: Set<EnumQuestionType>; negation: boolean; meta: boolean } {
        const premises = new Set<EnumQuestionType>();
        if (!this.live) return { premises, negation: false, meta: false };

        for (const [type, ov] of Object.entries(this.state.modes)) {
            if (ov?.premisesChosen && ov.numOfPremises !== undefined) premises.add(type as EnumQuestionType);
        }
        // Per flag rather than all-or-nothing: an opinion about negation is not
        // an opinion about meta, and it was silencing progression on both.
        return {
            premises,
            negation: this.state.flags.negation !== null,
            meta: this.state.flags.meta !== null,
        };
    }

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
                // Only what was actually chosen; silence means "as it would be".
                if (ov.enabled !== undefined) qs.enabled = ov.enabled;
                if (ov.numOfPremises !== undefined) {
                    qs.setNumOfPremises(qs.clampNumOfPremises(ov.numOfPremises));
                }
            }

            // At least one type must survive or generation has nothing to pick.
            const anyEnabled = Object.values(settings.question).some(q => q.enabled);
            if (!anyEnabled) settings.question[EnumQuestionType.Distinction].enabled = true;

            // Only when the player has an opinion; otherwise progression keeps
            // deciding, which is what an untouched profile should change least.
            if (this.state.flags.meta !== null) settings.setEnable("meta", this.state.flags.meta);
            if (this.state.flags.negation !== null) settings.setEnable("negation", this.state.flags.negation);
            settings.setEnable("useText", this.state.flags.useText);
            settings.setEnable("useEmojis", this.state.flags.useEmojis);
            settings.setEnable("meaningfulWords", this.state.flags.meaningfulWords);
            settings.setEnable("visualNoise", this.state.flags.visualNoise);
            settings.setEnable("junkEmojis", this.state.flags.junkEmojis);
            for (const [kind, weight] of Object.entries(this.state.flags.stimulusMix ?? {})) {
                settings.setMix(kind, weight);
            }
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
    /**
     * What a profile stores: the settings, not whether they are switched on.
     *
     * `active` used to be captured too, which made a profile record the state of
     * the master switch at the moment it was saved — so a profile saved while
     * Customise was off carried "off" around with it forever.
     */
    private snapshot(): ProfileConfig {
        const { profiles, activeProfile, active, ...rest } = this.state;
        return JSON.parse(JSON.stringify({ ...rest, active: true }));
    }

    saveProfile(name: string, practice = false): string {
        const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
        this.state.profiles = [...this.profiles, { id, name, practice, config: this.snapshot() }];
        this.state.activeProfile = id;
        /*
         * Saving a profile and marking it the current one is asking to use it.
         *
         * This used to set `activeProfile` and stop there, leaving the master
         * switch off. The panel reads "In use" off `activeProfile` alone, so a
         * profile saved from a fresh install announced itself as in use while
         * none of its settings were applied to anything — and there was no
         * reason for anyone to press "Use" on a profile already claiming to be
         * in use.
         */
        this.state.active = true;
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

    /**
     * Whether a profile is not merely loaded but actually in force.
     *
     * Two flags decide it — which profile is loaded, and whether the overrides
     * are switched on at all — and the panel showed only the first. A loaded
     * profile with the switch off changes nothing, which is the one state the
     * label must not describe as "in use".
     */
    profileApplied(id: string): boolean {
        return this.state.activeProfile === id && this.state.active;
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
    /**
     * The spread dial, or null for the median.
     *
     * Only when overrides are active: this is a deliberate departure from the
     * calibrated middle, so it should not apply to someone who never asked.
     */
    spread(): SpreadSetting | null {
        if (!this.live) return null;
        const s = this.state.space?.spread;
        if (!s || typeof s.percentile !== "number") return null;
        return { percentile: Math.min(100, Math.max(0, s.percentile)), axis: s.axis ?? null };
    }

    setSpread(next: SpreadSetting | null) {
        this.state.space = { ...this.state.space, spread: next };
        this.save();
    }

    get scramble(): number {
        return this.live ? (this.state.scrambleFactor ?? 100) : 100;
    }

    setScramble(value: number) {
        this.state.scrambleFactor = Math.max(0, Math.min(100, value));
        this.save();
    }

    /** Hand a setting back to the tier and the ladder. */
    clearModeSetting(type: EnumQuestionType, key: "enabled" | "numOfPremises") {
        const current = this.state.modes[type];
        if (!current) return;

        const next = { ...current };
        delete next[key];
        if (key === "numOfPremises") delete next.premisesChosen;

        // An override that says nothing is not an override.
        if (next.enabled === undefined && next.numOfPremises === undefined
            && next.transformDepth === undefined) {
            const { [type]: _drop, ...rest } = this.state.modes;
            this.state.modes = rest;
        } else {
            this.state.modes[type] = next;
        }
        this.save();
    }

    setMode(type: EnumQuestionType, patch: Partial<ModeOverride>, _fallback?: ModeOverride) {
        // No fallback seeding: an override carries what was chosen and nothing
        // else, so writing one setting cannot quietly pin another.
        const current = this.state.modes[type] ?? {};
        // A patch that names a premise count is somebody choosing one; a patch
        // that happens to carry the fallback's is not.
        const chosen = current.premisesChosen || patch.numOfPremises !== undefined;
        this.state.modes[type] = { ...current, ...patch, premisesChosen: chosen };
        this.save();
    }

    setMix(kind: string, weight: number) {
        this.state.flags.stimulusMix = { ...(this.state.flags.stimulusMix ?? {}), [kind]: weight };
        this.save();
    }

    setFlag(key: Exclude<keyof OverrideState["flags"], "stimulusMix">, value: boolean) {
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

    /* ---------------- per-mode rungs ---------------- */

    /** Forced value for one mode's rung, or null to defer to the ladder. */
    rungOverride(type: string, rung: string): boolean | null {
        if (!this.live) return null;
        const forced = this.state.rungs?.[type]?.[rung];
        return forced === undefined ? null : forced;
    }

    setRung(type: string, rung: string, value: boolean | null) {
        const all = { ...(this.state.rungs ?? {}) };
        const mode = { ...(all[type] ?? {}) };
        if (value === null) delete mode[rung];
        else mode[rung] = value;
        all[type] = mode;
        this.state.rungs = all;
        this.save();
    }

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
                    flags: adoptChosenFlags(parsed.flags ?? {}),
                    linear: { ...DEFAULT_LINEAR_FEATURES, ...(parsed.linear ?? {}) },
                    space: { ...DEFAULT_SPACE, ...(parsed.space ?? {}), axes: parsed.space?.axes ?? {} },
                    rungs: parsed.rungs ?? {},
                    modes: adoptChosenPremises(parsed.modes ?? {}),
                    scrambleFactor: parsed.scrambleFactor ?? 100,
                    // Absent in states saved before profiles existed.
                    profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
                    activeProfile: parsed.activeProfile ?? "",
                };
            }
        } catch { this.state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }
    }
}
