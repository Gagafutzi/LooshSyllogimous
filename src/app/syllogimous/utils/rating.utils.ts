/**
 * Difficulty-weighted rating.
 *
 * The stock score moves by a flat ±10 regardless of what was answered, so eight
 * premises under a 15-second limit is worth exactly as much as two premises
 * untimed. That makes the number a measure of persistence rather than ability,
 * and it is why grinding easy items works.
 *
 * This is Elo against the *item* instead of an opponent, which is the same
 * principle the staircase runs on: an outcome is worth what it was unlikely to
 * be. Beating a hard item pays; beating an easy one barely moves you; failing an
 * easy one costs far more than failing a hard one. A rating therefore settles at
 * the difficulty you can actually sustain instead of climbing with volume.
 *
 * Pure — no Angular, no storage.
 */

export interface RatingConfig {
    /** Rating of the reference item: minimum premises, untimed, no modifiers. */
    baseDifficulty: number;
    /** Added per premise beyond the reference. */
    perPremise: number;
    /** Added per halving of the time limit. */
    perTimeHalving: number;
    /** Time limit the difficulty scale is anchored to. */
    referenceSeconds: number;
    /** Added per active modifier (each negation, meta relation, extra transform). */
    perModifier: number;
    /** Rating step for a wholly unexpected result, early on. */
    startK: number;
    /** Floor the step decays to as answers accumulate. */
    minK: number;
    /** Answers after which K has fallen roughly halfway to its floor. */
    kHalfLife: number;
}

export const DEFAULT_RATING: RatingConfig = {
    baseDifficulty: 1000,
    perPremise: 90,
    perTimeHalving: 120,
    referenceSeconds: 90,
    perModifier: 60,
    startK: 40,
    minK: 12,
    kHalfLife: 120,
};

export interface ItemFactors {
    premises: number;
    /** Seconds allowed; 0 or undefined means untimed. */
    timeLimit?: number;
    negations?: number;
    metaRelations?: number;
    transformDepth?: number;
}

/**
 * What an item is worth, on the rating scale.
 *
 * Time enters logarithmically: going 90s -> 45s is the same jump as 45s -> 22s,
 * because halving the budget is a comparable squeeze wherever you start. A
 * linear term would make the last few seconds absurdly valuable.
 */
export function itemDifficulty(item: ItemFactors, config = DEFAULT_RATING): number {
    const premises = Math.max(0, item.premises - 2);
    const modifiers = (item.negations ?? 0) + (item.metaRelations ?? 0) + (item.transformDepth ?? 0);

    let d = config.baseDifficulty
        + premises * config.perPremise
        + modifiers * config.perModifier;

    if (item.timeLimit && item.timeLimit > 0) {
        // Only credit pressure, never refund for a generous limit.
        const halvings = Math.log2(config.referenceSeconds / item.timeLimit);
        d += Math.max(0, halvings) * config.perTimeHalving;
    }

    return Math.round(d);
}

/** Chance a player of `rating` answers an item of `difficulty` correctly. */
export function expectedScore(rating: number, difficulty: number): number {
    return 1 / (1 + Math.pow(10, (difficulty - rating) / 400));
}

/**
 * Step size, shrinking as a rating becomes established.
 *
 * A new player should reach roughly the right place in a session rather than a
 * month; an established one should not swing on a single unlucky item. Same
 * trade-off the staircase makes between responsiveness and stability.
 */
export function stepFor(answered: number, config = DEFAULT_RATING): number {
    const decay = 1 / (1 + answered / config.kHalfLife);
    return config.minK + (config.startK - config.minK) * decay;
}

export interface RatingOutcome {
    rating: number;
    delta: number;
    difficulty: number;
    expected: number;
}

/**
 * Advance a rating by one answered item.
 *
 * A timeout counts as incorrect: the item was not solved inside the budget, and
 * the budget is part of what makes it hard. Treating it as neutral would let a
 * player farm rating by letting anything difficult expire.
 */
export function applyResult(
    rating: number,
    answered: number,
    item: ItemFactors,
    correct: boolean,
    config = DEFAULT_RATING,
): RatingOutcome {
    const difficulty = itemDifficulty(item, config);
    const expected = expectedScore(rating, difficulty);
    const delta = stepFor(answered, config) * ((correct ? 1 : 0) - expected);

    return {
        rating: Math.round(rating + delta),
        delta: Math.round(delta),
        difficulty,
        expected: +expected.toFixed(3),
    };
}

/**
 * The difficulty a rating can sustain at a given success rate.
 *
 * Useful for showing "you are rated for about N premises" rather than a bare
 * number, and for seeding a placement.
 */
export function sustainableDifficulty(rating: number, atAccuracy = 0.75): number {
    const p = Math.min(0.99, Math.max(0.01, atAccuracy));
    return Math.round(rating - 400 * Math.log10(p / (1 - p)));
}
