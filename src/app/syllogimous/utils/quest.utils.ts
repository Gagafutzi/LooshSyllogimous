/**
 * Bayesian threshold estimation on the time axis (QUEST / ZEST family).
 *
 * The simple staircase in `progression.utils.ts` tracks a threshold by stepping
 * up and down. It works, but it only ever uses the last few trials, reports a
 * point value with no uncertainty, and needs ~30–40 trials to settle. This keeps
 * a posterior over the threshold instead: every trial contributes, the estimate
 * comes with a credible interval, and promotion can require *confidence* rather
 * than a lucky window.
 *
 * The model is the standard psychometric function, with time as intensity —
 * more time means higher accuracy, saturating once you have more than you need:
 *
 *     P(correct | t) = γ + (1 − γ − λ) · Φ( (ln t − τ) / σ )
 *
 *   τ  threshold, in ln(seconds) — the quantity being estimated
 *   σ  slope; held fixed (QUEST-style). Estimating it too (psi-style) costs
 *      roughly 3× the trials for little gain at this sample size.
 *   γ  guess rate: 0.5 for true/false, far lower when the answer is constructed.
 *      This is why construction mode makes every trial worth much more.
 *   λ  lapse rate: errors that happen regardless of how long you are given.
 *
 * Represented as a grid over τ rather than analytically — 60 bins, multiply and
 * normalise. Nothing here touches Angular or storage, so it is verifiable in
 * isolation.
 */

export interface QuestConfig {
    /** Grid bounds, in seconds. */
    minSeconds: number;
    maxSeconds: number;
    bins: number;
    /** Slope of the psychometric function, in ln-seconds. */
    slope: number;
    /** Chance of a correct answer with no knowledge. */
    guessRate: number;
    /** Chance of an error despite knowing it. */
    lapseRate: number;
    /**
     * Geometric discount applied to accumulated evidence each trial.
     *
     * A learner's threshold moves, and plain Bayes assumes it does not — without
     * this the estimate lags further behind the longer you train. 1 disables it.
     */
    forgetting: number;
}

export const DEFAULT_QUEST: QuestConfig = {
    minSeconds: 3,
    maxSeconds: 240,
    bins: 60,
    slope: 0.45,
    guessRate: 0.5,
    lapseRate: 0.03,
    forgetting: 0.99,
};

export interface QuestState {
    /** Log-posterior over the τ grid, unnormalised. */
    logPost: number[];
    trials: number;
}

/* ---------------- normal distribution ---------------- */

function erf(x: number) {
    // Abramowitz & Stegun 7.1.26 — ~1e-7 absolute error, ample here.
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
        - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
}

const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Inverse normal CDF by bisection — slower than a rational fit, but obviously correct. */
function probit(p: number) {
    let lo = -8, hi = 8;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (Phi(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

/* ---------------- grid ---------------- */

/** τ grid points, evenly spaced in ln(seconds). */
export function grid(config: QuestConfig): number[] {
    const lo = Math.log(config.minSeconds);
    const hi = Math.log(config.maxSeconds);
    return Array.from({ length: config.bins }, (_, i) =>
        lo + (hi - lo) * i / (config.bins - 1));
}

/** P(correct) for a deadline of `seconds` if the true threshold were `tau`. */
export function pCorrect(config: QuestConfig, tau: number, seconds: number) {
    const z = (Math.log(Math.max(1e-6, seconds)) - tau) / config.slope;
    return config.guessRate + (1 - config.guessRate - config.lapseRate) * Phi(z);
}

/**
 * Gaussian prior on τ. A broad prior costs a couple of early trials; a confidently
 * wrong one costs far more, so err wide.
 */
export function initQuest(config: QuestConfig, priorMeanSeconds: number, priorSdLog = 1.0): QuestState {
    const mean = Math.log(priorMeanSeconds);
    const logPost = grid(config).map(tau => {
        const z = (tau - mean) / priorSdLog;
        return -0.5 * z * z;
    });
    return { logPost, trials: 0 };
}

/* ---------------- inference ---------------- */

function normalise(logPost: number[]) {
    const max = Math.max(...logPost);
    const w = logPost.map(v => Math.exp(v - max));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map(v => v / sum);
}

/** One trial: a deadline of `seconds`, and whether the answer was right. */
export function questUpdate(
    state: QuestState,
    config: QuestConfig,
    seconds: number,
    correct: boolean,
): QuestState {
    const taus = grid(config);
    const logPost = state.logPost.map((lp, i) => {
        const p = pCorrect(config, taus[i], seconds);
        const like = correct ? p : 1 - p;
        // Discount before adding, so old evidence decays geometrically.
        return lp * config.forgetting + Math.log(Math.max(1e-12, like));
    });

    // Re-centre to keep the numbers small; the posterior is scale-free.
    const max = Math.max(...logPost);
    return { logPost: logPost.map(v => v - max), trials: state.trials + 1 };
}

export interface QuestEstimate {
    /** Posterior mean threshold, in seconds. */
    seconds: number;
    /** Posterior sd, in ln-seconds — dimensionless spread. */
    sdLog: number;
    /** Central credible interval, in seconds. */
    ci: [number, number];
    trials: number;
}

export function questEstimate(state: QuestState, config: QuestConfig, mass = 0.9): QuestEstimate {
    const taus = grid(config);
    const w = normalise(state.logPost);

    const mean = taus.reduce((a, tau, i) => a + tau * w[i], 0);
    const varLog = taus.reduce((a, tau, i) => a + w[i] * (tau - mean) ** 2, 0);

    const tail = (1 - mass) / 2;
    let cum = 0, lo = taus[0], hi = taus[taus.length - 1];
    for (let i = 0; i < taus.length; i++) {
        const prev = cum;
        cum += w[i];
        if (prev < tail && cum >= tail) lo = taus[i];
        if (prev < 1 - tail && cum >= 1 - tail) { hi = taus[i]; break; }
    }

    return {
        seconds: Math.exp(mean),
        sdLog: Math.sqrt(varLog),
        ci: [Math.exp(lo), Math.exp(hi)],
        trials: state.trials,
    };
}

/**
 * Where to set the next deadline so the expected chance of success is `targetP`.
 *
 * Placement at the current threshold estimate (ZEST) rather than by minimising
 * expected entropy: the entropy-optimal choice buys little once the posterior is
 * reasonably tight, and it can park trials at difficulties that feel arbitrary
 * to a human — this is training, not only measurement.
 */
export function questNext(state: QuestState, config: QuestConfig, targetP: number) {
    const { seconds } = questEstimate(state, config);
    const span = 1 - config.guessRate - config.lapseRate;
    const q = (targetP - config.guessRate) / span;

    // Outside the reachable range the target says nothing; sit at the threshold.
    if (!(q > 0 && q < 1)) return seconds;

    const t = Math.exp(Math.log(seconds) + config.slope * probit(q));
    return Math.min(config.maxSeconds, Math.max(config.minSeconds, t));
}

/**
 * Broaden the posterior to admit that the threshold may have moved — between
 * sessions, or when the configuration itself just got harder.
 *
 * Convolving with a Gaussian is the standard random-walk step: it keeps the
 * shape and location but adds uncertainty, so new evidence outweighs old.
 */
export function questDiffuse(state: QuestState, config: QuestConfig, sdLog: number): QuestState {
    if (sdLog <= 0) return state;
    const taus = grid(config);
    const step = taus[1] - taus[0];
    const radius = Math.max(1, Math.ceil(3 * sdLog / step));
    const w = normalise(state.logPost);

    const out = taus.map((_, i) => {
        let acc = 0;
        for (let d = -radius; d <= radius; d++) {
            const j = i + d;
            if (j < 0 || j >= taus.length) continue;
            const z = (d * step) / sdLog;
            acc += w[j] * Math.exp(-0.5 * z * z);
        }
        return Math.log(Math.max(1e-12, acc));
    });

    const max = Math.max(...out);
    return { logPost: out.map(v => v - max), trials: state.trials };
}

/**
 * Carry a posterior onto a harder configuration after a promotion.
 *
 * The threshold genuinely just moved — more premises need more time — so the
 * mean is shifted and the spread widened rather than starting from scratch.
 * Keeping the shape is what makes promotions cheap in trials.
 */
export function questPromote(state: QuestState, config: QuestConfig, shiftLog = 0.25): QuestState {
    const taus = grid(config);
    const step = taus[1] - taus[0];
    const bins = Math.round(shiftLog / step);
    const w = normalise(state.logPost);

    const shifted = taus.map((_, i) => {
        const j = i - bins;
        return Math.log(Math.max(1e-12, j >= 0 && j < taus.length ? w[j] : 1e-12));
    });

    const max = Math.max(...shifted);
    return questDiffuse({ logPost: shifted.map(v => v - max), trials: state.trials }, config, 0.3);
}
