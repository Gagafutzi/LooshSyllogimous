import { Injectable } from "@angular/core";
import { EnumQuestionType } from "../constants/question.constants";
import { LS_TIMER } from "../constants/local-storage.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { Settings } from "../models/settings.models";
import {
    LadderEvent, LadderState, Outcome, familyMembers, familyOf, ladderFor,
} from "../utils/progression.utils";
import { UnlockEvidence } from "../utils/tier.utils";
import {
    AbilityState, Aggregate, ConfigChoice, DEFAULT_ABILITY, abilityDecay, abilityEstimate,
    abilityUpdate, aggregate, cautionPenalty, chooseConfig, guessRateFor, guessRateForRungs, initAbility, levelOf,
    pCorrect, priorForNewMode, targetLevel,
    DepthFit, DepthReport, Trial, depthReport, fitDepthCoefficient, fitRungCosts,
    fitWidthCoefficient, referenceSecondsFrom,
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

/**
 * Answers of memory, as a geometric discount.
 *
 * Clamped rather than trusted: a stored value from an older build, or a hand
 * edit, must not be able to produce a discount of zero or one — one never
 * forgets and zero forgets everything, and both leave the posterior unable to
 * represent anything at all.
 */
function forgettingFor(answers: number): number {
    const n = Math.max(40, Math.min(1000, Math.round(answers) || 100));
    return 1 - 1 / n;
}

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
    /**
     * How many recent answers the estimate is effectively built from.
     *
     * Evidence is discounted geometrically, so this is a half-life rather than
     * a window with an edge — nothing is dropped, older answers simply weigh
     * less. It is the dial that decides how long a real improvement takes to be
     * believed, and it was previously fixed at about two hundred, which took
     * 168 answers to notice a four-level gain.
     *
     * Floored at forty in the UI because below about a hundred the estimate
     * stops being one: it settles two levels high with an sd of four, and the
     * caution term then reads that width as a reason to serve *easier* items.
     * Shorter is not more responsive past that point, it is broken.
     */
    memoryAnswers: number;
    /**
     * One item in this many is placed to *measure* rather than to train.
     *
     * A model that only ever asks questions it expects you to get right cannot
     * learn much: an item chosen for 80% success is well below ability, so a
     * correct answer on it is consistent with any ability above the item and
     * carries almost no information. That is the root of Finding 1 in
     * `progression/diagnosis.md`, and its two amplifiers have been removed
     * while the root has not.
     *
     * A probe aims at `probeAccuracy` instead of the training target, and
     * ignores caution — aiming below on account of uncertainty is exactly what
     * a measurement should not do.
     *
     * Zero turns it off.
     */
    probeEvery: number;
    /** Success rate a probe aims for. Lower measures harder and costs more. */
    probeAccuracy: number;
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
    /**
     * Score a graded item claim by claim rather than as one bit.
     *
     * A checkpoint item asks two questions and the model heard one answer:
     * right only if both were. That threw away the distinction the checkpoint
     * exists to produce — losing the thread late is not the same as never
     * having it — and it scored the easy claim at the hard claim's difficulty.
     *
     * On, each claim is its own piece of evidence, at its own level and its own
     * guess rate. Off, the item is one outcome, as it was.
     */
    perClaimCredit: boolean;
}

const DEFAULT_SETTINGS: ProgressionSettings = {
    enabled: true,
    targetAccuracy: 0.8,
    floorSeconds: DEFAULT_ABILITY.minSeconds,
    ceilingSeconds: DEFAULT_ABILITY.maxSeconds,
    structureBefore: 5,
    crossModeSd: DEFAULT_ABILITY.crossModeSd,
    decayPerDay: DEFAULT_ABILITY.decayPerDay,
    memoryAnswers: Math.round(1 / (1 - DEFAULT_ABILITY.forgetting)),
    probeEvery: 5,
    probeAccuracy: 0.65,
    derivedScore: true,
    fatigueWindow: 15,
    fatigueThreshold: 0.15,
    pauseWhenTired: true,
    perClaimCredit: true,
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

    /**
     * How much of an item its conclusion needed, per mode.
     *
     * Reported only. Depth is logged rather than charged — the coefficient that
     * would turn it into difficulty has to be fitted against answered items,
     * and this is the reading that says whether there is anything to fit.
     */
    depthByMode(): DepthReport[] {
        return depthReport(this.trials());
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

        // The family's answers, not just this mode's: they are the same task at
        // the same pace, and one mode alone rarely has enough to calibrate with.
        const kin = new Set(familyMembers(type));
        const times = this.trials()
            .filter(t => kin.has(t.type) && typeof t.answerSeconds === "number")
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
            forgetting: forgettingFor(this.config.memoryAnswers),
            widthPerBit: this.widthPerBit,
            levelsPerUnneededPremise: this.depthPerPremise,
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

    /* ---------------- what an unneeded premise is worth ---------------- */

    private depthFitCache: { at: number; value: number } | null = null;

    /**
     * Levels per premise the conclusion did not need, from the answers, or zero.
     *
     * Zero means unpriced, not free — the same rule as `widthPerBit`, refit on
     * the same schedule and for the same reason.
     *
     * **Negative fits are kept here, and positive ones discarded**, which is
     * the mirror image of the width clamp rather than an inconsistency. Width
     * was expected to make items harder, so a fit saying wide items are easier
     * was a statement about the sample; depth shortfall is expected to make
     * items *easier*, so a fit saying that premises nobody needs make an item
     * harder is the one that fails the same test.
     */
    private get depthPerPremise(): number {
        const trials = this.trialCount();
        if (this.depthFitCache && trials - this.depthFitCache.at < 50) {
            return this.depthFitCache.value;
        }

        const fit = fitDepthCoefficient(this.trials(), {
            // Fitted against a scale without the term being fitted, or the
            // estimate chases its own tail.
            ...DEFAULT_ABILITY,
            minSeconds: this.config.floorSeconds,
            maxSeconds: this.config.ceilingSeconds,
            widthPerBit: 0,
            levelsPerUnneededPremise: 0,
        });

        const value = fit ? Math.min(0, Math.max(-3, fit.levelsPerPremise)) : 0;
        this.depthFitCache = { at: trials, value };
        return value;
    }

    /** What the answers say an unneeded premise costs, reported not applied. */
    fittedDepthCoefficient(): DepthFit | null {
        return fitDepthCoefficient(this.trials(), {
            ...this.abilityConfig, levelsPerUnneededPremise: 0,
        });
    }

    /** What the model is currently charging, or zero until fitted. */
    appliedDepthPerPremise(): number {
        return this.depthPerPremise;
    }

    /** The same cheap probe, for callers outside this service. */
    trialCountPublic(): number { return this.trialCount(); }

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
        const key = familyOf(type);
        try {
            const raw = localStorage.getItem(LS_ABILITY + key);
            if (raw) {
                const p = JSON.parse(raw);
                if (Array.isArray(p?.logPost) && p.logPost.length === this.abilityConfig.bins) {
                    return { logPost: p.logPost, trials: p.trials ?? 0, lastSeen: p.lastSeen ?? Date.now() };
                }
            }
        } catch { /* fall through */ }

        // A family whose ledger does not exist yet, but whose members do: their
        // evidence was always about the same skill, so it is carried across
        // rather than discarded.
        const merged = this.mergeFamily(type);
        if (merged) { this.saveAbility(type, merged); return merged; }

        return this.freshPrior(type);
    }

    /**
     * Combine the members' separate posteriors into the family's one.
     *
     * Adding log-posteriors is what accumulating independent evidence about a
     * single quantity *is*. The prior is in each of them, though, so it would be
     * counted once per member; subtracting the surplus copies leaves the
     * evidence added once and the prior counted once, which is the whole point
     * of doing this rather than picking the best-evidenced member and throwing
     * the rest away.
     */
    private mergeFamily(type: EnumQuestionType): AbilityState | null {
        const members = familyMembers(type);
        if (members.length < 2) return null;

        const states: AbilityState[] = [];
        for (const member of members) {
            try {
                const raw = localStorage.getItem(LS_ABILITY + member);
                if (!raw) continue;
                const p = JSON.parse(raw);
                if (Array.isArray(p?.logPost) && p.logPost.length === this.abilityConfig.bins) {
                    states.push({ logPost: p.logPost, trials: p.trials ?? 0, lastSeen: p.lastSeen ?? Date.now() });
                }
            } catch { /* skip a member that will not parse */ }
        }
        if (!states.length) return null;

        const prior = this.freshPrior(type).logPost;
        const logPost = prior.map((_, i) =>
            states.reduce((sum, st) => sum + st.logPost[i], 0) - (states.length - 1) * prior[i]);

        return {
            logPost,
            trials: states.reduce((n, st) => n + st.trials, 0),
            lastSeen: Math.max(...states.map(st => st.lastSeen)),
        };
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
            localStorage.setItem(LS_ABILITY + familyOf(type),
                JSON.stringify({ logPost, trials: s.trials, lastSeen: s.lastSeen }));
        } catch { /* private mode */ }
        this.configCache = {};
    }

    estimateFor(type: EnumQuestionType) {
        return abilityEstimate(abilityDecay(this.abilityFor(type), this.abilityConfig), this.abilityConfig);
    }

    resetAll() {
        for (const type of Object.values(EnumQuestionType)) {
            try {
                localStorage.removeItem(LS_ABILITY + type);
                // And the shared ledger it may write to instead.
                localStorage.removeItem(LS_ABILITY + familyOf(type));
            } catch { /* ignore */ }
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

    /**
     * Whether the *next* item of this mode is a measurement rather than training.
     *
     * Counted per mode, from that mode's own posterior, so a mode played rarely
     * still gets probed at the same rate. Deterministic rather than random: the
     * rhythm is guessable, and that is a fair price for a schedule that can be
     * tested and reasoned about. Knowing an item is a probe does not help
     * anyone answer it.
     */
    isProbeTurn(type: EnumQuestionType): boolean {
        const every = this.config.probeEvery;
        if (!every || every < 2 || !this.config.enabled) return false;
        return this.abilityFor(type).trials % every === every - 1;
    }

    configFor(type: EnumQuestionType, probe = this.isProbeTurn(type)): ConfigChoice {
        // Part of the choice, so a change of preference invalidates every
        // cached one. Nothing else observes that key, and the alternative —
        // having the settings screen call in — leaves the cache stale for
        // anyone who edits storage directly or lands mid-session.
        const untimed = this.untimed;
        if (untimed !== this.cachedUntimed) {
            this.cachedUntimed = untimed;
            this.configCache = {};
        }

        // Only the training configuration is cached. A probe is computed on the
        // spot, which is once every `probeEvery` answers and costs nothing.
        const hit = probe ? undefined : this.configCache[type];
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
        /*
         * A probe aims at the estimate itself, with no caution and no training
         * discount. Caution turns uncertainty into an easier item, which is the
         * right instinct while training and precisely wrong while measuring:
         * the less sure the model is, the more it needs an informative answer.
         */
        const cautious = probe
            ? est
            : { ...est, level: est.level - cautionPenalty(est.sd, cfg, this.trials().length) };
        const wantAccuracy = probe ? this.config.probeAccuracy : this.config.targetAccuracy;

        const ladder = ladderFor(type);
        const opts = {
            minPremises: params.minNumOfPremises,
            maxPremises: params.maxNumOfPremises,
            ladder,
            target: 0,
            structureBefore: this.config.structureBefore,
            untimed,
        };

        /*
         * Aimed twice, because the aim depends on the answer mode and the
         * answer mode depends on the aim.
         *
         * The first pass uses the flat 0.5 this always used, which is enough to
         * settle how many rungs are claimed — and the answer mode *is* a rung,
         * so that settles the real guess rate. The second pass re-aims at it.
         *
         * Not iterated further: a change of guess rate moves the target by
         * about half a level, which almost never changes the rung count again,
         * and a loop that can oscillate is worse than one that is slightly off.
         */
        const first = chooseConfig(type, {
            ...opts,
            target: targetLevel(cautious, wantAccuracy, 0.5, cfg),
        }, cfg);

        const guess = guessRateForRungs(ladder.slice(0, first.rungs));
        const choice = guess === 0.5 ? first : chooseConfig(type, {
            ...opts,
            target: targetLevel(cautious, wantAccuracy, guess, cfg),
        }, cfg);

        if (!probe) this.configCache[type] = choice;
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
    applyTo(settings: Settings, pinned?: { premises: Set<EnumQuestionType>; negation: boolean; meta: boolean }): Settings {
        if (!this.live) return settings;

        try {
            for (const type of Object.values(EnumQuestionType)) {
                const qs = settings.question[type];
                if (!qs?.enabled) continue;
                // A count typed into Customise wins; this layer only fills gaps.
                if (pinned?.premises.has(type)) continue;
                qs.setNumOfPremises(qs.clampNumOfPremises(this.configFor(type).premises));
            }

            /*
             * Per flag. A player who has an opinion about one of these has not
             * thereby expressed one about the other, and treating the pair as a
             * unit meant any Customise setting at all silenced the ladder on
             * both.
             */
            if (this.scopedType) {
                const rungs = this.rungsFor(this.scopedType);
                if (!pinned?.negation) settings.setEnable("negation", rungs.includes("negation"));
                if (!pinned?.meta) settings.setEnable("meta", rungs.includes("meta"));
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

    /**
     * Ability at the moment each item was chosen, per mode, oldest first.
     *
     * The trial log carries the estimate the item was *served* under, which is
     * exactly what movement wants — and it carries no timestamps, which is why
     * this is ordinal rather than dated. Ordinal is enough: "up half a level
     * over your last few answers" needs an order, not a calendar.
     */
    estimateTrail(): Record<string, number[]> {
        const trail: Record<string, number[]> = {};
        for (const t of this.trials()) {
            (trail[t.type] ??= []).push(t.estimate);
        }
        return trail;
    }

    /**
     * Every mode the model has an opinion about, for the insight layer.
     *
     * Read through `estimateFor`, so it is the decayed estimate — the number
     * that actually decides what gets served, rather than the one before time
     * away was accounted for.
     */
    standings(): Array<{ type: string; level: number; trials: number }> {
        return Object.values(EnumQuestionType).map(type => {
            const est = this.estimateFor(type);
            return { type, level: est.level, trials: est.trials };
        }).filter(s => s.trials > 0);
    }

    /** Cleared when a session is deliberately restarted, and by a reset. */
    clearFatigue() {
        this.residuals = [];
        try { localStorage.removeItem(LS_RESIDUALS); } catch { /* private mode */ }
    }

    /* ---------------- the skill number ---------------- */

    private aggregateNow(): Aggregate {
        const states: Array<{ state: AbilityState; type: EnumQuestionType }> = [];
        // One entry per *ledger*. Counting a shared family once per member would
        // weight the scale modes five times over in the overall skill number.
        const counted = new Set<string>();

        for (const type of Object.values(EnumQuestionType)) {
            const key = familyOf(type);
            if (counted.has(key)) continue;
            counted.add(key);
            try {
                const raw = localStorage.getItem(LS_ABILITY + key);
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

    /**
     * What the player has shown they can do, for deciding what to unlock.
     *
     * The best single mode as well as the average, because a player deep in one
     * mode has demonstrated that much reasoning and cannot raise their average
     * without the modes being withheld from them. And whether anything has run
     * out entirely, which is the case that must never leave a player with
     * nothing new: every rung claimed and the premise ceiling reached means the
     * app has nothing left to serve there.
     */
    unlockEvidence(): UnlockEvidence {
        const agg = this.aggregateNow();
        let bestLevel = 0;
        let anyExhausted = false;

        for (const type of Object.values(EnumQuestionType)) {
            const state = this.abilityFor(type);
            if (!state.trials) continue;
            bestLevel = Math.max(bestLevel, abilityEstimate(state, this.abilityConfig).level);

            const choice = this.configFor(type, false);
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            if (choice.rungs >= ladderFor(type).length
                && choice.premises >= params.maxNumOfPremises) anyExhausted = true;
        }

        return { aggregateLevel: agg.level, bestLevel, anyExhausted };
    }

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
        item?: {
            answerMode?: string; slots?: number; choices?: number; options?: number;
            widthDelta?: number; depth?: number;
            /**
             * How each claim of a graded item went, when there was more than
             * one. Read only with `perClaimCredit` on.
             */
            claims?: Array<{ correct: boolean; slots: number; fromPremises?: number }>;
        },
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
        /*
         * Pinned across the update, so the announcement compares like with like.
         *
         * `before` is the item that was actually served and `after` is what the
         * next one will be, and the probe flag flips on exactly this answer —
         * so reading it twice would report a rung-up every fifth item and a
         * rung-down on the sixth, neither of which happened.
         */
        const wasProbe = this.isProbeTurn(type);
        const before = this.configFor(type, wasProbe);
        const level = levelOf({
            type, premises: before.premises,
            rungs: ladderFor(type).slice(0, before.rungs),
            seconds: before.seconds,
            widthDelta: item?.widthDelta ?? 0,
            // How much of the item the answer needed. Zero, and so no
            // correction, until a mode measures it and the coefficient has
            // been fitted from answers.
            depth: item?.depth ?? 0,
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
            depth: item?.depth ?? 0,
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

        /*
         * One update, or one per claim.
         *
         * A checkpoint item asks two questions, and the model heard "right only
         * if both were". That is wrong twice over: it discards the distinction
         * the checkpoint exists to produce, and it scores the halfway claim —
         * answerable from half the premises — at the whole item's difficulty,
         * so getting the easy one right walks the estimate upwards.
         *
         * Each claim now enters at its own level, taken from the premise count
         * it actually follows from, and its own guess rate, taken from its own
         * slots. `levelOf` already reads a premise count, so this needs no
         * coefficient — a fitted one for depth is a separate and better answer
         * to the same question, and this is what is honest without it.
         *
         * Timeouts stay binary. The clock is part of the difficulty, so a claim
         * that was right when the clock stopped was not answered at the
         * difficulty asked — and crediting it would make the deadline cheaper
         * the more claims an item has.
         */
        const graded = this.config.perClaimCredit && outcome !== "timeout"
            ? (item?.claims ?? [])
            : [];

        let state = abilityDecay(this.abilityFor(type), this.abilityConfig);
        if (graded.length > 1) {
            for (const claim of graded) {
                /*
                 * Forgetting and the trial count apply per update, which is the
                 * right way round: a graded item really is two pieces of
                 * evidence, so it should age the posterior like two and count
                 * like two.
                 */
                state = abilityUpdate(
                    state,
                    levelOf({
                        type,
                        premises: claim.fromPremises ?? before.premises,
                        rungs: ladderFor(type).slice(0, before.rungs),
                        seconds: before.seconds,
                        widthDelta: item?.widthDelta ?? 0,
                        /*
                         * No depth here, deliberately. `item.depth` belongs to
                         * the *final* claim, and pairing it with a checkpoint's
                         * premise count would state a shortfall nobody
                         * measured. The claim's own premise count is already
                         * the better-aimed number; a per-claim depth would be
                         * better still, and is what to record if this term ever
                         * turns out to be worth much.
                         */
                    }, this.configForMode(type)),
                    guessRateFor("construct", claim.slots, 0, item?.options ?? 3),
                    claim.correct,
                    this.abilityConfig);
            }
        } else {
            state = abilityUpdate(state, level, guess, correct, this.abilityConfig);
        }
        this.saveAbility(type, state);

        // Announce only a change the player would notice in the next item, and
        // judged at the same probe state as `before` — see `wasProbe`.
        const after = this.configFor(type, wasProbe);
        const events: LadderEvent[] = [];
        if (after.rungs > before.rungs) events.push("rung-up");
        else if (after.rungs < before.rungs) events.push("rung-down");
        if (after.premises > before.premises) events.push("premise-up");
        else if (after.premises < before.premises) events.push("premise-down");

        this.lastEvents = events;
        return events;
    }
}
