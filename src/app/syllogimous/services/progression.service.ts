import { Injectable } from "@angular/core";
import { EnumQuestionType } from "../constants/question.constants";
import { LS_TIMER } from "../constants/local-storage.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { Settings } from "../models/settings.models";
import { LadderEvent, LadderState, Outcome, ladderFor } from "../utils/progression.utils";
import {
    AbilityState, Aggregate, ConfigChoice, DEFAULT_ABILITY, abilityDecay, abilityEstimate,
    abilityUpdate, aggregate, chooseConfig, guessRateFor, initAbility, levelOf,
    pCorrect, priorForNewMode, targetLevel,
    Trial, fitRungCosts, fitWidthCoefficient, referenceSecondsFrom,
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
/** The rolling residual window behind fatigue detection. */
const LS_RESIDUALS = "syllogimous-residuals";
const LS_ABILITY = "syllogimous-ability:";
/** Answered items, kept so the rung costs can be measured rather than argued. */
const LS_TRIALS = "syllogimous-trials";
/** Enough for a fit on the common rungs, small enough to keep in storage. */
const TRIAL_LOG = 1500;
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
    /** Answers the fatigue signal is averaged over. */
    fatigueWindow: number;
    /**
     * How far below prediction counts as a slump, in probability.
     *
     * Nought disables the whole mechanism. 0.15 means "getting fifteen points
     * fewer per hundred than the model expected of you", which is a large
     * effect — the point is to catch a real decline, not noise.
     */
    fatigueThreshold: number;
    /** Stop the posterior moving while a slump is detected. */
    pauseWhenTired: boolean;
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
    fatigueWindow: 15,
    fatigueThreshold: 0.15,
    pauseWhenTired: true,
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

    constructor() { this.loadConfig(); this.loadResiduals(); }

    /* ---------------- the trial log ---------------- */

    private pushTrial(trial: Trial) {
        try {
            const log = this.trials();
            log.push(trial);
            localStorage.setItem(LS_TRIALS,
                JSON.stringify(log.slice(-TRIAL_LOG)));
        } catch { /* private mode, or a full quota; the log is not load-bearing */ }
    }

    trials(): Trial[] {
        try {
            const raw = localStorage.getItem(LS_TRIALS);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    /**
     * What the answered items say the rung costs should be.
     *
     * Reported, never applied. A fit from a handful of trials is worse than the
     * guess it would replace, so the numbers and their sample sizes go on the
     * screen and the table stays hand-written until someone looks at them.
     */
    fittedRungCosts(minTrials = 60) {
        return fitRungCosts(this.trials(), this.abilityConfig, minTrials);
    }

    /**
     * What a bit of extra width is worth, or null if the answers cannot say.
     *
     * Null is the common case and the honest one: with the spread dial at its
     * default every item is drawn at the calibrated middle, so there is no
     * variation for a coefficient to explain.
     */
    fittedWidthCoefficient() {
        return fitWidthCoefficient(this.trials(), { ...this.abilityConfig, widthPerBit: 0 });
    }

    /** What the model is currently charging per bit — zero until fitted. */
    appliedWidthPerBit(): number {
        return this.widthPerBit;
    }

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

    /**
     * The ability config, with the clock anchored to this player's own pace.
     *
     * Without the mode, the default sixty seconds stands. With it, the anchor
     * comes from their answer times: a deadline only counts as difficulty when
     * it approaches what they actually need.
     */
    private configForMode(type?: EnumQuestionType) {
        const base = this.abilityConfig;
        if (!type) return base;

        const times = this.trials()
            .filter(t => t.type === type && typeof t.answerSeconds === "number")
            .slice(-40)
            .map(t => t.answerSeconds!);

        return { ...base, referenceSeconds: referenceSecondsFrom(times, base.referenceSeconds) };
    }

    /** Config for the ability model, with the user-tunable parts applied. */
    private get abilityConfig() {
        return {
            ...DEFAULT_ABILITY,
            minSeconds: this.config.floorSeconds,
            maxSeconds: this.config.ceilingSeconds,
            crossModeSd: this.config.crossModeSd,
            decayPerDay: this.config.decayPerDay,
            widthPerBit: this.widthPerBit,
        };
    }

    /* ---------------- what width is worth ---------------- */

    private widthFitCache: { at: number; value: number } | null = null;

    /**
     * Levels per bit of width, from the answers, or zero.
     *
     * Zero means *unpriced*, not *free*. Until the answered items carry enough
     * variation to fit against, the difficulty scale says nothing about width
     * rather than guessing — which is the same rule the rung costs follow, and
     * the reason this was the last number in the model with no basis.
     *
     * Refitted every fifty answers rather than on every one. The fit scans the
     * whole trial log against a grid, which is cheap in absolute terms and
     * pointless to repeat after a single new data point.
     */
    private get widthPerBit(): number {
        const trials = this.trialCount();
        if (this.widthFitCache && trials - this.widthFitCache.at < 50) {
            return this.widthFitCache.value;
        }

        const fit = fitWidthCoefficient(this.trials(), {
            // Fitted against a scale that does not already contain the term
            // being fitted, or the estimate chases its own tail.
            ...DEFAULT_ABILITY,
            minSeconds: this.config.floorSeconds,
            maxSeconds: this.config.ceilingSeconds,
            widthPerBit: 0,
        });

        /*
         * Clamped, and negative fits discarded. A fit that says wide items are
         * *easier* is telling you the sample is noise rather than telling you
         * something about width, and acting on it would make the model worse in
         * a way that compounds.
         */
        const value = fit ? Math.max(0, Math.min(6, fit.levelsPerBit)) : 0;
        this.widthFitCache = { at: trials, value };
        return value;
    }

    /** Cheap length probe, so the cache check does not parse the whole log. */
    private trialCount(): number {
        try {
            const raw = localStorage.getItem(LS_TRIALS);
            if (!raw) return 0;
            // One object per trial; counting braces beats parsing to find out
            // whether a refit is even due.
            return (raw.match(/\}/g) ?? []).length;
        } catch { return 0; }
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

        /*
         * Centred on the easiest item the mode has, and *narrow*.
         *
         * The width was 6, meant as "we know nothing". On a grid bounded below,
         * a Gaussian that wide centred near the floor has most of its mass
         * above the centre, so its mean lands mid-range — the prior said
         * "beginner" and the estimate read 6.1. Two and a half is wide enough
         * to be moved by a handful of answers and narrow enough to mean what it
         * says.
         */
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        return initAbility(
            levelOf({ type, premises: params.minNumOfPremises, rungs: [], seconds: null }, this.abilityConfig),
            2.5, this.abilityConfig);
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
        this.clearFatigue();
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
        const cfg = this.configForMode(type);

        /*
         * Aimed below the estimate by a fraction of its own uncertainty.
         *
         * Serving to the mean gives a brand-new player the same item it would
         * give someone measured at that level, on no evidence at all. Aiming at
         * a lower quantile makes "unsure" mean "easier", and the penalty
         * disappears by itself as the posterior narrows.
         */
        const cautious = { ...est, level: est.level - cfg.caution * est.sd };

        // Aimed at the accuracy wanted, using the *easiest* guess rate the mode
        // can serve; the answer mode is not known until the item is built.
        const target = targetLevel(cautious, this.config.targetAccuracy, 0.5, cfg);

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
    applyTo(settings: Settings, pinned?: { premises: Set<EnumQuestionType>; flags: boolean }): Settings {
        if (!this.live) return settings;

        try {
            for (const type of Object.values(EnumQuestionType)) {
                const qs = settings.question[type];
                if (!qs?.enabled) continue;
                // A count typed into Customise wins; this layer only fills gaps.
                if (pinned?.premises.has(type)) continue;
                qs.setNumOfPremises(qs.clampNumOfPremises(this.configFor(type).premises));
            }

            if (pinned?.flags) {
                // Same reasoning: an active profile states which modifiers it
                // wants, so the ladder does not get to add or remove them.
            } else if (this.scopedType) {
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
     * Kept because Customise and Diagnostics display it. `recent` is
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

    /* ---------------- fatigue ---------------- */

    /*
     * Observed minus predicted, over the last few answers.
     *
     * The model states a probability for every item before it is served, so the
     * gap between how often the player was right and how often the model
     * expected them to be is a *difficulty-adjusted* signal. Raw accuracy is
     * not: it falls when difficulty rises, which is exactly what the ladder
     * does when things are going well.
     *
     * This matters more than a status readout. The posterior cannot tell "too
     * hard" from "tired" — both look like wrong answers — so a fatigued session
     * is recorded as evidence of lower ability and sets *tomorrow* lower too.
     * Pausing the update during a detected slump is the cheapest way to stop a
     * bad hour becoming a worse week.
     */
    private residuals: number[] = [];

    private loadResiduals() {
        try {
            const raw = localStorage.getItem(LS_RESIDUALS);
            const parsed = raw ? JSON.parse(raw) : null;
            if (Array.isArray(parsed)) this.residuals = parsed.filter(v => typeof v === "number");
        } catch { this.residuals = []; }
    }

    private pushResidual(value: number) {
        this.residuals = [...this.residuals, value].slice(-Math.max(4, this.config.fatigueWindow));
        try { localStorage.setItem(LS_RESIDUALS, JSON.stringify(this.residuals)); } catch { /* private mode */ }
    }

    /**
     * Mean residual, or null until there is enough to mean anything.
     *
     * Half a window is the floor. Three answers below expectation is a normal
     * run of luck at any ability, and acting on it would pause the posterior
     * for everyone who started slowly.
     */
    get fatigue(): number | null {
        const need = Math.max(4, Math.ceil(this.config.fatigueWindow / 2));
        if (this.residuals.length < need) return null;
        return this.residuals.reduce((a, c) => a + c, 0) / this.residuals.length;
    }

    /** Whether the player is currently doing worse than the model expects. */
    get tired(): boolean {
        const f = this.fatigue;
        return this.config.fatigueThreshold > 0 && f !== null && f <= -this.config.fatigueThreshold;
    }

    /** Cleared when a session is deliberately restarted, and by a reset. */
    clearFatigue() {
        this.residuals = [];
        try { localStorage.removeItem(LS_RESIDUALS); } catch { /* private mode */ }
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
        answerSeconds: number,
        item?: { answerMode?: string; slots?: number; choices?: number; options?: number; widthDelta?: number },
    ): LadderEvent[] {
        if (!this.config.enabled) { this.lastEvents = []; return []; }

        /*
         * Scored against the item that actually arrived.
         *
         * The configuration says how hard the item was *asked* to be; its width
         * says how hard it came out. Reading the answer against the request
         * would credit a wide item as though it were typical, which is the
         * mismeasurement the width work exists to remove.
         */
        const before = this.configFor(type);
        const level = levelOf({
            type, premises: before.premises,
            rungs: ladderFor(type).slice(0, before.rungs),
            seconds: before.seconds,
            widthDelta: item?.widthDelta ?? 0,
        }, this.configForMode(type));

        const guess = guessRateFor(
            item?.answerMode ?? "boolean", item?.slots ?? 0, item?.choices ?? 0, item?.options ?? 3);

        // A timeout is a failure at this difficulty; the clock is part of it.
        const correct = outcome === "right";

        /*
         * Recorded before the update, so the prediction is the one the item was
         * actually chosen under. Doing it afterwards would measure the model
         * against a posterior that had already seen the answer.
         */
        const estimate = this.estimateFor(type).level;
        const expected = pCorrect(this.abilityConfig, estimate, level, guess);
        const tiredBefore = this.tired;
        this.pushResidual((correct ? 1 : 0) - expected);

        /*
         * Logged with the estimate the item was chosen under, for the same
         * reason the residual is taken here: afterwards the posterior has seen
         * the answer, and a fit against it would be scoring the model on
         * information the model did not have.
         */
        this.pushTrial({
            type,
            premises: before.premises,
            rungs: ladderFor(type).slice(0, before.rungs),
            seconds: before.seconds,
            estimate,
            guess,
            correct,
            widthDelta: item?.widthDelta ?? 0,
            answerSeconds,
        });

        /*
         * A slump already in progress stops the posterior moving. The trial is
         * still recorded in the window — that is what lets the slump end — but
         * it is not taken as evidence about ability, because during a slump it
         * is not evidence about ability.
         */
        if (this.config.pauseWhenTired && tiredBefore) {
            this.lastEvents = [];
            return [];
        }

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
