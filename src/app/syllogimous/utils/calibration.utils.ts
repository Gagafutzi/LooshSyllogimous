/**
 * Quick ability placement.
 *
 * The ladder in `progression.utils.ts` climbs one rung at a time, which is right
 * for training but wrong for a first session: someone already working at eight
 * premises should not answer their way up from two. This finds roughly the right
 * starting level in a dozen items.
 *
 * It is a classic staircase with reversal averaging — the same family as the
 * time staircase, but stepping over *premise count*, and tuned for speed rather
 * than for sitting at a target accuracy:
 *
 *   - correct  -> harder by `step`
 *   - wrong    -> easier by `step`
 *   - halve `step` at every reversal, floor 1
 *   - estimate = mean of the levels where direction changed
 *
 * Averaging reversals rather than taking the final level is what makes a short
 * run usable: the reversals bracket the threshold from both sides, so noise in
 * any single answer is averaged out instead of being inherited.
 *
 * Three things make the number mean something, and the first version had none
 * of them:
 *
 *   1. Premises arrive one at a time and cannot be revisited. With the whole
 *      set on screen there is nothing to hold, so premise count measured
 *      reading stamina rather than working memory and the staircase ran to the
 *      ceiling for anyone patient.
 *   2. Every item carries a deadline. Untimed, "how many premises can you
 *      handle" has no upper bound short of boredom.
 *   3. The scale is *linear-equivalent* premises, not raw premise count, and
 *      each mode stops being offered once it has run out of discrimination —
 *      a twelve-premise left/right chain is long, not hard. See MODE_SCALE.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { ISettingParams } from "../constants/settings.constants";

export interface CalibrationConfig {
    minLevel: number;
    maxLevel: number;
    startLevel: number;
    /** First jump size; halves at each reversal. */
    initialStep: number;
    /** Hard stop, so a wandering run still terminates. */
    maxTrials: number;
    /** Never stop before this, however tidy the early answers look. */
    minTrials: number;
    /** Enough direction changes to average over. */
    targetReversals: number;
    /**
     * Stop once the mean of the reversals is known to about this many premises.
     *
     * Length is driven by precision rather than a fixed count: a consistent
     * player finishes early, an erratic one earns more items, and the cap stops
     * it running forever either way.
     */
    targetStandardError: number;
    /** Fixed part of every item's deadline, in seconds. */
    baseSeconds: number;
    /** Added per premise actually shown — reading time, not thinking time. */
    readSecondsPerPremise: number;
    /** Added per linear-equivalent level — the thinking budget. */
    solveSecondsPerLevel: number;
    /** Deadline bounds, so neither end becomes absurd. */
    minSeconds: number;
    maxSeconds: number;
}

export const DEFAULT_CALIBRATION: CalibrationConfig = {
    minLevel: 2,
    maxLevel: 20,
    startLevel: 5,
    initialStep: 4,
    maxTrials: 20,
    minTrials: 10,
    targetReversals: 4,
    targetStandardError: 0.6,
    /*
     * Deliberately more generous than the trained steady state. The deadline is
     * here to stop the level running away from anyone willing to sit and
     * re-read, not to measure speed — tightened by a third, simulation places a
     * slow-but-capable player at 7 whatever their real level, which is the same
     * failure as the untimed version in the other direction.
     */
    baseSeconds: 8,
    readSecondsPerPremise: 4,
    solveSecondsPerLevel: 5.5,
    minSeconds: 25,
    maxSeconds: 180,
};

/**
 * How each mode sits on the linear-equivalent scale.
 *
 * `weight` is how many linear premises one premise of this mode is worth, so a
 * level is converted to a real premise count by dividing. The anchor is the
 * player's own report: three to four premises of 4D-space-with-a-transformation
 * felt like eight to ten linear premises, which is a factor of about 2.5.
 *
 * `ceiling` is the highest level at which the mode still tells you anything.
 * Past it, extra premises add length rather than difficulty — a fifteen-premise
 * left/right chain is a clerical task, and letting the staircase keep climbing
 * inside one placed everybody at the maximum. Above a mode's ceiling it simply
 * stops being offered and the harder modes carry the run.
 */
export interface ModeScale {
    weight: number;
    ceiling: number;
}

export const MODE_SCALE: Record<EnumQuestionType, ModeScale> = {
    // One-dimensional transitive chains: nothing new appears after a handful.
    [EnumQuestionType.Distinction]: { weight: 1.0, ceiling: 6 },
    [EnumQuestionType.ComparisonNumerical]: { weight: 1.0, ceiling: 6 },
    [EnumQuestionType.ComparisonChronological]: { weight: 1.0, ceiling: 6 },
    [EnumQuestionType.LinearArrangement]: { weight: 1.0, ceiling: 6 },
    // Calibration clears every rung, so these are measured as plain chains —
    // the same task as the comparisons in different words. Branching, overlap
    // and transformations are what separates them in play, and none of that is
    // on during a placement.
    [EnumQuestionType.LinearVertical]: { weight: 1.0, ceiling: 6 },
    [EnumQuestionType.LinearHorizontal]: { weight: 1.0, ceiling: 6 },
    [EnumQuestionType.LinearContains]: { weight: 1.0, ceiling: 6 },
    // Two axes to keep straight, but still a plane.
    [EnumQuestionType.Direction]: { weight: 1.15, ceiling: 7 },
    [EnumQuestionType.Syllogism]: { weight: 1.3, ceiling: 8 },
    [EnumQuestionType.Direction3DSpatial]: { weight: 1.3, ceiling: 9 },
    [EnumQuestionType.GraphMatching]: { weight: 1.2, ceiling: 9 },
    [EnumQuestionType.CircularArrangement]: { weight: 1.4, ceiling: 10 },
    [EnumQuestionType.Direction3DTemporal]: { weight: 1.45, ceiling: 11 },
    /*
     * Composed spaces. Each extra axis is another independent accumulation to
     * carry through the same chain, so the weight climbs faster than premise
     * count would suggest.
     *
     * The ceilings are their own premise caps expressed on this scale — eight
     * premises at 1.6, seven at 1.9 and six at 2.2 all land at about thirteen.
     * That agreement is the point: the three modes reach the same real
     * difficulty by trading length against width, and past it a placement would
     * be clamping the premise count while continuing to credit the level, which
     * is precisely the "answered a level-13 item, scored as level 20" failure
     * `ceiling` exists to prevent.
     *
     * What carries the range above thirteen is therefore relational order —
     * Analogy, Transformation, Anchor Space v2 — rather than any amount of
     * width. Composed spaces do go further in play, but only by claiming rungs,
     * and a placement measures every mode with its rungs cleared.
     */
    /*
     * Three axes sits just above the 3D direction modes it supersedes: same
     * arrangement to build, but every premise fixes all three axes at once
     * rather than naming one, so a premise carries more and there are fewer of
     * them for the same work. Ten premises at 1.35 reaches level 13, the same
     * place the wider spaces reach by trading length for breadth.
     */
    [EnumQuestionType.Space3D]: { weight: 1.35, ceiling: 13 },
    [EnumQuestionType.Space4D]: { weight: 1.6, ceiling: 13 },
    [EnumQuestionType.Space5D]: { weight: 1.9, ceiling: 13 },
    [EnumQuestionType.Space6D]: { weight: 2.2, ceiling: 13 },
    // Composite and frame-shifting modes: these keep biting all the way up.
    // Connectivity rather than position. Keeps discriminating well past the
    // scale modes, but a very large graph becomes clerical rather than harder.
    [EnumQuestionType.Hierarchy]: { weight: 1.35, ceiling: 14 },
    [EnumQuestionType.Analogy]: { weight: 1.5, ceiling: 20 },
    [EnumQuestionType.Binary]: { weight: 1.5, ceiling: 20 },
    [EnumQuestionType.Deictic]: { weight: 1.6, ceiling: 20 },
    [EnumQuestionType.AnchorSpace]: { weight: 1.8, ceiling: 20 },
    [EnumQuestionType.Transformation]: { weight: 2.2, ceiling: 20 },
    [EnumQuestionType.AnchorSpaceV2]: { weight: 2.5, ceiling: 20 },
    /*
     * The induction pair. Weighted high because their premise count buys
     * candidates to eliminate and relations to compare rather than chain to
     * walk — a sixth candidate is a whole extra hypothesis to hold, where a
     * sixth link in a chain is one more step of the same kind. Low ceilings for
     * the same reason: past these the item is wider, not deeper.
     */
    [EnumQuestionType.InferRelation]: { weight: 2.2, ceiling: 8 },
    [EnumQuestionType.OddestRelation]: { weight: 2.4, ceiling: 8 },
    // Modular arithmetic over a small ring, with a derivation before it. Harder
    // than a chain of the same length, nowhere near the composed spaces.
    [EnumQuestionType.ShapeRotation]: { weight: 1.6, ceiling: 9 },
};

/** Real premise count for a linear-equivalent level, clamped to the mode's range. */
export function premisesForLevel(
    type: EnumQuestionType,
    level: number,
    params: Pick<ISettingParams, "minNumOfPremises" | "maxNumOfPremises">,
): number {
    const weight = MODE_SCALE[type]?.weight ?? 1;
    return clamp(Math.round(level / weight), params.minNumOfPremises, params.maxNumOfPremises);
}

/**
 * Lowest level at which a mode can be asked honestly.
 *
 * A mode cannot go below its own minimum premise count, so offering it beneath
 * that would hand out an item harder than the level claims — which is how a
 * four-premise Transformation used to turn up at level 5 and knock the
 * staircase down for a reason that had nothing to do with the player.
 */
export function minLevelFor(
    type: EnumQuestionType,
    params: Pick<ISettingParams, "minNumOfPremises">,
): number {
    const weight = MODE_SCALE[type]?.weight ?? 1;
    return Math.ceil(params.minNumOfPremises * weight);
}

/** Whether a mode is worth asking at this level. */
export function modeFitsLevel(
    type: EnumQuestionType,
    level: number,
    params: Pick<ISettingParams, "minNumOfPremises">,
): boolean {
    const scale = MODE_SCALE[type];
    if (!scale) return false;
    return level >= minLevelFor(type, params) && level <= scale.ceiling;
}

/**
 * Deadline for one item.
 *
 * Split into reading and thinking because the two scale differently: reading
 * follows the premises actually shown, thinking follows the level. A
 * four-premise Transformation at level 10 is quick to read and slow to solve,
 * and a single per-premise budget would get it badly wrong in both directions.
 */
export function secondsForItem(
    level: number,
    premises: number,
    config = DEFAULT_CALIBRATION,
): number {
    const raw = config.baseSeconds
        + config.readSecondsPerPremise * premises
        + config.solveSecondsPerLevel * level;
    return Math.round(clamp(raw, config.minSeconds, config.maxSeconds));
}

export interface CalibrationTrial {
    level: number;
    correct: boolean;
    seconds: number;
}

export interface CalibrationState {
    level: number;
    step: number;
    trials: CalibrationTrial[];
    /** Levels at which the direction of travel changed. */
    reversals: number[];
    lastDirection: 0 | 1 | -1;
    done: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function initCalibration(config = DEFAULT_CALIBRATION): CalibrationState {
    return {
        level: clamp(config.startLevel, config.minLevel, config.maxLevel),
        step: config.initialStep,
        trials: [],
        reversals: [],
        lastDirection: 0,
        done: false,
    };
}

/** Advance the staircase by one answered item. */
export function recordAnswer(
    state: CalibrationState,
    config: CalibrationConfig,
    correct: boolean,
    seconds: number,
): CalibrationState {
    if (state.done) return state;

    const trials = [...state.trials, { level: state.level, correct, seconds }];
    const direction: 1 | -1 = correct ? 1 : -1;

    // A reversal is a change of travel direction; the first answer sets the
    // direction rather than reversing it.
    const reversed = state.lastDirection !== 0 && direction !== state.lastDirection;
    const reversals = reversed ? [...state.reversals, state.level] : state.reversals;
    const step = reversed ? Math.max(1, Math.floor(state.step / 2)) : state.step;

    const level = clamp(state.level + direction * step, config.minLevel, config.maxLevel);

    /*
     * Precision-gated: stop when the reversal mean has settled to within
     * targetStandardError, but never before minTrials and never past maxTrials.
     * Reversal count alone was the old rule, and it let a lucky early run finish
     * on almost no evidence.
     */
    const enough = trials.length >= config.minTrials
        && reversals.length >= config.targetReversals
        && standardErrorOf(reversals) <= config.targetStandardError;

    const done = enough || trials.length >= config.maxTrials;

    return { level, step, trials, reversals, lastDirection: direction, done };
}

/** Standard error of the mean: spread shrunk by how many samples support it. */
function standardErrorOf(samples: number[]): number {
    if (samples.length < 2) return Infinity;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, v) => a + (v - mean) ** 2, 0) / (samples.length - 1);
    return Math.sqrt(variance / samples.length);
}

export interface AbilityEstimate {
    /**
     * Placement level in linear-equivalent premises.
     *
     * Not a raw premise count: each mode divides it by its own weight before
     * generating, so level 10 is four premises of Transformation and ten of a
     * left/right chain. Reporting the equivalent rather than the raw count is
     * what lets a run that crossed several modes produce one number.
     */
    level: number;
    /**
     * How tightly the level is pinned, in premises.
     *
     * Reported directly because "±0.6 premises" is a claim a player can check,
     * where a bare 0–1 confidence is not. The earlier version divided spread by
     * the range, which barely separated a consistent player from an erratic one.
     */
    standardError: number;
    /** 0–1, derived from the standard error against the target. */
    confidence: number;
    /** Median time on correct answers, for seeding the time threshold. */
    medianSeconds: number;
    trials: number;
}

export function estimateAbility(
    state: CalibrationState,
    config = DEFAULT_CALIBRATION,
): AbilityEstimate {
    const { reversals, trials } = state;

    // Prefer reversals; fall back to the levels seen if the run ended early.
    const sample = reversals.length >= 2 ? reversals : trials.map(t => t.level);
    const mean = sample.length
        ? sample.reduce((a, b) => a + b, 0) / sample.length
        : config.startLevel;

    const se = standardErrorOf(sample);
    // 1 when at or inside the target precision, falling off beyond it.
    const confidence = Number.isFinite(se)
        ? clamp(config.targetStandardError / Math.max(se, config.targetStandardError * 0.5), 0, 1)
        : 0;

    const times = trials.filter(t => t.correct).map(t => t.seconds).sort((a, b) => a - b);
    const medianSeconds = times.length ? times[Math.floor(times.length / 2)] : 0;

    return {
        level: clamp(Math.round(mean), config.minLevel, config.maxLevel),
        standardError: Number.isFinite(se) ? +se.toFixed(2) : 99,
        confidence: +confidence.toFixed(2),
        medianSeconds: +medianSeconds.toFixed(1),
        trials: trials.length,
    };
}

/**
 * Starting time limit for the estimated level.
 *
 * The observed times now come from items that carried a deadline, so they are a
 * real solve time rather than however long someone chose to linger. Only a
 * small margin is added — enough that the first session does not open already
 * failing, not so much that the ladder has to spend a hundred trials tightening
 * it back down.
 */
export function suggestedSeconds(estimate: AbilityEstimate, ceiling: number) {
    if (!estimate.medianSeconds) return ceiling;
    // Same floor the score uses: a median that fast came from guessing, and
    // opening the first session on a ten-second clock would be unplayable.
    const seconds = creditableSeconds(estimate.medianSeconds, estimate.level);
    return clamp(Math.round(seconds * 1.25), 10, ceiling);
}

/**
 * Starting rating from a placement.
 *
 * Runs the estimate through the same difficulty scale the live rating uses, so
 * the number a player starts with means exactly what it will mean afterwards:
 * the difficulty they can sustain. Their own solve time stands in for the time
 * limit, which is how speed enters — two players placed at the same level are
 * separated by how quickly they got there.
 */
export function calibrationScore(
    estimate: AbilityEstimate,
    difficultyOf: (item: { premises: number; timeLimit?: number }) => number,
): number {
    return difficultyOf({
        premises: estimate.level,
        // No recorded time means nothing to credit; fall back to untimed.
        timeLimit: estimate.medianSeconds > 0
            ? creditableSeconds(estimate.medianSeconds, estimate.level)
            : undefined,
    });
}

/**
 * Solve time worth crediting, floored by what the level plausibly takes.
 *
 * The rating's time term grows without bound as the limit shrinks, so an
 * unfloored median hands out a fortune for times that cannot represent
 * reasoning — a lucky guess answered in two seconds was scoring higher than a
 * genuine solve. Below roughly a second and a half per equivalent premise the
 * answer was not derived from the premises, whatever it was, so that is where
 * the credit stops.
 */
const MIN_CREDITED_SECONDS_PER_LEVEL = 1.5;

export function creditableSeconds(medianSeconds: number, level: number): number {
    return Math.max(medianSeconds, MIN_CREDITED_SECONDS_PER_LEVEL * level);
}
