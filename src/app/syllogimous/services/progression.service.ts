import { Injectable } from "@angular/core";
import { EnumQuestionType } from "../constants/question.constants";
import { LS_TIMER } from "../constants/local-storage.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { Settings } from "../models/settings.models";
import { LadderEvent, LadderState, Outcome, ladderFor } from "../utils/progression.utils";
import {
    AbilityState, Aggregate, ConfigChoice, DEFAULT_ABILITY, abilityDecay, abilityEstimate,
    abilityUpdate, aggregate, chooseConfig, guessRateFor, initAbility, levelOf,
    priorForNewMode, targetLevel,
} from "../utils/ability.utils";

/**
 * One ability estimate per mode, and everything else derived from it.
 *
 * This replaced three overlapping systems: a tier driven by an accumulated
 * score, a per-mode staircase stepping over premises and a clock, and a
 * training-unit tracker with thresholds of its own. They never exchanged
 * information, and the number the player saw was a count of answers given.
 *
 * Now there is a single latent — ability, in linear-equivalent premises — with a
 * posterior per mode. Everything the rest of the app asks for is read off it:
 *
 *   `timeLimitFor`  the clock, as part of a chosen configuration
 *   `rungsFor`      which modifiers that configuration carries
 *   `applyTo`       the premise count, and the global negation/meta flags
 *   `skillPoints`   the aggregate across modes
 *
 * Three consequences worth stating, because they were separate features before
 * and are now the same mechanism:
 *
 *   - **A mode never played inherits the aggregate** as its prior, so being good
 *     elsewhere carries over instead of every mode starting from the floor.
 *   - **Idle time widens a posterior** rather than demoting anything. The
 *     estimate stays put and simply becomes less certain.
 *   - **The score cannot be farmed**, because it is recomputed from the
 *     posteriors rather than accumulated. Answering easy items adds evidence
 *     that ability is low.
 *
 * Precedence when enabled: tier → user overrides → progression.
 */

const LS_CONFIG = "syllogimous-progression-config";
const LS_ABILITY = "syllogimous-ability:";
/** Written by the pre-rework staircase; read once to migrate, never written. */
const LS_LEGACY_STATE = "syllogimous-progression-state:";

export interface ProgressionSettings {
    enabled: boolean;
    /** Accuracy item selection aims for. Training wants ~0.8, measurement lower. */
    targetAccuracy: number;
    /** Clock bounds when difficulty is made up with time. */
    floorSeconds: number;
    ceilingSeconds: number;
    /** Premises past which length may only rise once the ladder is exhausted. */
    structureBefore: number;
    /** How much ability in one mode is assumed to say about another, in levels. */
    crossModeSd: number;
    /** Posterior widening per idle day, in levels. */
    decayPerDay: number;
    /** Show ability-derived skill points instead of the accumulated score. */
    derivedScore: boolean;
}

const DEFAULT_SETTINGS: ProgressionSettings = {
    enabled: true,
    targetAccuracy: 0.8,
    floorSeconds: DEFAULT_ABILITY.minSeconds,
    ceilingSeconds: DEFAULT_ABILITY.maxSeconds,
    structureBefore: 5,
    crossModeSd: DEFAULT_ABILITY.crossModeSd,
    decayPerDay: DEFAULT_ABILITY.decayPerDay,
    derivedScore: true,
};

@Injectable({ providedIn: "root" })
export class ProgressionService {
    config: ProgressionSettings = { ...DEFAULT_SETTINGS };

    /** Surfaced for the UI so a difficulty change can be announced. */
    lastEvents: LadderEvent[] = [];

    /**
     * The type currently being generated, if any.
     *
     * negation and meta are single global flags in v4, so a rung claimed by one
     * mode would otherwise switch them on for every mode. The generators read
     * `settings` while they run, so narrowing this layer to the type in flight
     * makes the same global flag mean different things per mode.
     */
    private scopedType?: EnumQuestionType;

    scopeTo(type?: EnumQuestionType) { this.scopedType = type; }

    /**
     * Ignore the ladder while a block of code runs.
     *
     * The placement test needs it: MODE_SCALE describes each mode unmodified, so
     * measuring against items carrying earned rungs produces a level on a scale
     * that does not apply.
     */
    private suppressed = false;

    suppress<T>(fn: () => T): T {
        const before = this.suppressed;
        this.suppressed = true;
        try { return fn(); } finally { this.suppressed = before; }
    }

    private get live() { return this.config.enabled && !this.suppressed; }

    constructor() { this.loadConfig(); }

    /* ---------------- config ---------------- */

    loadConfig() {
        try {
            const raw = localStorage.getItem(LS_CONFIG);
            if (raw) this.config = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        } catch { this.config = { ...DEFAULT_SETTINGS }; }
    }

    saveConfig() {
        try { localStorage.setItem(LS_CONFIG, JSON.stringify(this.config)); } catch { /* private mode */ }
    }

    set<K extends keyof ProgressionSettings>(key: K, value: ProgressionSettings[K]) {
        this.config[key] = value;
        this.saveConfig();
        this.configCache = {};
        this.saveConfig();
    }

    /** Config for the ability model, with the user-tunable parts applied. */
    private get abilityConfig() {
        return {
            ...DEFAULT_ABILITY,
            minSeconds: this.config.floorSeconds,
            maxSeconds: this.config.ceilingSeconds,
            crossModeSd: this.config.crossModeSd,
            decayPerDay: this.config.decayPerDay,
        };
    }

    /* ---------------- per-mode posteriors ---------------- */

    abilityFor(type: EnumQuestionType): AbilityState {
        try {
            const raw = localStorage.getItem(LS_ABILITY + type);
            if (raw) {
                const p = JSON.parse(raw);
                if (Array.isArray(p?.logPost) && p.logPost.length === this.abilityConfig.bins) {
                    return { logPost: p.logPost, trials: p.trials ?? 0, lastSeen: p.lastSeen ?? Date.now() };
                }
            }
        } catch { /* fall through */ }
        return this.freshPrior(type);
    }

    /**
     * Starting posterior for a mode with no history.
     *
     * Centred on the aggregate rather than the floor — the cold-start fix. A
     * legacy staircase state, if one is lying around from before the rework, is
     * used as a rough hint instead: it is worse evidence than the aggregate but
     * better than nothing when the aggregate is empty too.
     */
    private freshPrior(type: EnumQuestionType): AbilityState {
        const agg = this.aggregateNow();
        if (agg.modes > 0) return priorForNewMode(agg, this.abilityConfig);

        try {
            const raw = localStorage.getItem(LS_LEGACY_STATE + type);
            if (raw) {
                const old = JSON.parse(raw);
                if (typeof old?.premises === "number") {
                    const seed = levelOf({
                        type, premises: old.premises,
                        rungs: Array.isArray(old.rungs) ? old.rungs : [],
                        seconds: null,
                    }, this.abilityConfig);
                    return initAbility(seed, 4, this.abilityConfig);
                }
            }
        } catch { /* ignore */ }

        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        return initAbility(
            levelOf({ type, premises: params.minNumOfPremises, rungs: [], seconds: null }, this.abilityConfig),
            6, this.abilityConfig);
    }

    private saveAbility(type: EnumQuestionType, s: AbilityState) {
        try {
            // Rounded: 80 full-precision floats per mode is needless in storage.
            const logPost = s.logPost.map(v => Math.round(v * 1000) / 1000);
            localStorage.setItem(LS_ABILITY + type,
                JSON.stringify({ logPost, trials: s.trials, lastSeen: s.lastSeen }));
        } catch { /* private mode */ }
        this.configCache = {};
    }

    estimateFor(type: EnumQuestionType) {
        return abilityEstimate(abilityDecay(this.abilityFor(type), this.abilityConfig), this.abilityConfig);
    }

    resetAll() {
        for (const type of Object.values(EnumQuestionType)) {
            try { localStorage.removeItem(LS_ABILITY + type); } catch { /* ignore */ }
        }
        this.configCache = {};
    }

    /* ---------------- the chosen configuration ---------------- */

    /**
     * Cached per mode, and invalidated whenever a posterior moves.
     *
     * One question asks for the clock, the premise count and the rung list
     * separately, and all three must describe the *same* item — recomputing per
     * call would let them disagree if a trial landed in between.
     */
    private configCache: Partial<Record<EnumQuestionType, ConfigChoice>> = {};

    /** The timer preference the cached choices were built under. */
    private cachedUntimed?: boolean;

    /**
     * Whether the player has turned the clock off.
     *
     * The ladder spends difficulty on time once a mode has no structure left to
     * add, and it used to do that whatever the timer preference said — so
     * "Timer disabled" still produced a countdown, on exactly the modes the
     * player was strongest in. That is where the report came from: the setting
     * looked mode-dependent because only the modes that had run out of rungs
     * reached for the clock.
     *
     * Read here rather than ignored at the screen, because the clock is part of
     * the configuration an item is *scored* at: `record` values an answer at the
     * level of the config it was built from, so an item that was never timed
     * must not be built as though it had been.
     */
    private get untimed() {
        // Unset reads as "0" everywhere else in the app, and unreadable is
        // treated the same: not knowing the preference is not a reason to
        // impose a clock.
        try { return (localStorage.getItem(LS_TIMER) || "0") === "0"; }
        catch { return true; }
    }

    configFor(type: EnumQuestionType): ConfigChoice {
        // Part of the choice, so a change of preference invalidates every
        // cached one. Nothing else observes that key, and the alternative —
        // having the settings screen call in — leaves the cache stale for
        // anyone who edits storage directly or lands mid-session.
        const untimed = this.untimed;
        if (untimed !== this.cachedUntimed) {
            this.cachedUntimed = untimed;
            this.configCache = {};
        }

        const hit = this.configCache[type];
        if (hit) return hit;

        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        const est = this.estimateFor(type);
        const cfg = this.abilityConfig;
        // Aimed at the accuracy wanted, using the *easiest* guess rate the mode
        // can serve; the answer mode is not known until the item is built.
        const target = targetLevel(est, this.config.targetAccuracy, 0.5, cfg);

        const choice = chooseConfig(type, {
            minPremises: params.minNumOfPremises,
            maxPremises: params.maxNumOfPremises,
            ladder: ladderFor(type),
            target,
            structureBefore: this.config.structureBefore,
            untimed,
        }, cfg);

        this.configCache[type] = choice;
        return choice;
    }

    /* ---------------- application ---------------- */

    /**
     * Countdown length for this question, or null when there is none: with
     * progression off, with the timer preference off, or when the configuration
     * is already at or past the target on structure alone.
     */
    timeLimitFor(type: EnumQuestionType): number | null {
        if (!this.config.enabled) return null;
        const seconds = this.configFor(type).seconds;
        return seconds == null ? null : Math.max(1, Math.round(seconds));
    }

    /**
     * Applies the chosen configuration on top of tier and overrides.
     *
     * Modifiers are forced *off* unless the configuration carries them — they
     * are earned here, so leaving a global toggle on would skip the ladder.
     */
    applyTo(settings: Settings): Settings {
        if (!this.live) return settings;

        try {
            for (const type of Object.values(EnumQuestionType)) {
                const qs = settings.question[type];
                if (!qs?.enabled) continue;
                qs.setNumOfPremises(qs.clampNumOfPremises(this.configFor(type).premises));
            }

            if (this.scopedType) {
                const rungs = this.rungsFor(this.scopedType);
                settings.setEnable("negation", rungs.includes("negation"));
                settings.setEnable("meta", rungs.includes("meta"));
            } else {
                // Unscoped reads are for display, so show the union rather than
                // implying nothing is unlocked.
                let anyNegation = false, anyMeta = false;
                for (const type of Object.values(EnumQuestionType)) {
                    if (!settings.question[type]?.enabled) continue;
                    const rungs = this.rungsFor(type);
                    anyNegation ||= rungs.includes("negation");
                    anyMeta ||= rungs.includes("meta");
                }
                settings.setEnable("negation", anyNegation);
                settings.setEnable("meta", anyMeta);
            }
        } catch {
            /* leave the incoming settings untouched */
        }

        return settings;
    }

    /** Rungs the current configuration carries, as a prefix of the mode's ladder. */
    rungsFor(type: EnumQuestionType): string[] {
        if (!this.live) return [];
        try { return ladderFor(type).slice(0, this.configFor(type).rungs); } catch { return []; }
    }

    hasRung(type: EnumQuestionType, rung: string): boolean {
        return this.rungsFor(type).includes(rung);
    }

    depthBonusFor(type: EnumQuestionType): number {
        if (!this.live) return 0;
        return this.rungsFor(type).filter(r => r.startsWith("transform-depth")).length;
    }

    /**
     * A ladder-shaped view of the current configuration, for the UI.
     *
     * Kept because Advanced Options and Diagnostics display it. `recent` is
     * always empty: there is no rolling window any more, and reporting a fake
     * one would be worse than reporting none.
     */
    stateFor(type: EnumQuestionType): LadderState {
        const choice = this.configFor(type);
        return {
            premises: choice.premises,
            timeLimit: choice.seconds ?? this.config.ceilingSeconds,
            rungs: ladderFor(type).slice(0, choice.rungs),
            recent: [],
        };
    }

    /* ---------------- the skill number ---------------- */

    private aggregateNow(): Aggregate {
        const states: Array<{ state: AbilityState; type: EnumQuestionType }> = [];
        for (const type of Object.values(EnumQuestionType)) {
            try {
                const raw = localStorage.getItem(LS_ABILITY + type);
                if (!raw) continue;
                const p = JSON.parse(raw);
                if (Array.isArray(p?.logPost) && p.logPost.length === this.abilityConfig.bins) {
                    states.push({ type, state: { logPost: p.logPost, trials: p.trials ?? 0, lastSeen: p.lastSeen ?? Date.now() } });
                }
            } catch { /* skip */ }
        }
        return aggregate(states, this.abilityConfig);
    }

    /** Precision-weighted ability across modes, and the number shown for it. */
    get skill(): Aggregate { return this.aggregateNow(); }

    get skillPoints(): number { return this.aggregateNow().points; }

    /* ---------------- recording ---------------- */

    /**
     * Write a placement result into every mode.
     *
     * Ability is already in linear-equivalent premises, which is the scale the
     * placement reports on — so the same number is written everywhere and the
     * per-mode weights convert it into premises at generation time. The old
     * version had to convert per mode on the way in and could not represent
     * "this player is at level 9" as a single fact.
     */
    applyCalibration(level: number, _seconds: number) {
        for (const type of Object.values(EnumQuestionType)) {
            this.saveAbility(type, initAbility(level, 2.0, this.abilityConfig));
        }
        this.configCache = {};
    }

    /**
     * One answered question.
     *
     * `guess` is the item's own guess rate, not the mode's: a construction
     * answered correctly is far stronger evidence than a true/false, and the
     * likelihood is where that difference belongs.
     */
    record(
        type: EnumQuestionType,
        outcome: Outcome,
        _answerSeconds: number,
        item?: { answerMode?: string; slots?: number; choices?: number; options?: number },
    ): LadderEvent[] {
        if (!this.config.enabled) { this.lastEvents = []; return []; }

        const before = this.configFor(type);
        const level = levelOf({
            type, premises: before.premises,
            rungs: ladderFor(type).slice(0, before.rungs),
            seconds: before.seconds,
        }, this.abilityConfig);

        const guess = guessRateFor(
            item?.answerMode ?? "boolean", item?.slots ?? 0, item?.choices ?? 0, item?.options ?? 3);

        // A timeout is a failure at this difficulty; the clock is part of it.
        const correct = outcome === "right";

        const next = abilityUpdate(
            abilityDecay(this.abilityFor(type), this.abilityConfig),
            level, guess, correct, this.abilityConfig);
        this.saveAbility(type, next);

        // Announce only a change the player would notice in the next item.
        const after = this.configFor(type);
        const events: LadderEvent[] = [];
        if (after.rungs > before.rungs) events.push("rung-up");
        else if (after.rungs < before.rungs) events.push("rung-down");
        if (after.premises > before.premises) events.push("premise-up");
        else if (after.premises < before.premises) events.push("premise-down");

        this.lastEvents = events;
        return events;
    }
}
