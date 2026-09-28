/**
 * Allen's interval algebra — the thirteen ways two periods of time can stand.
 *
 * Ported from Isomorph, names and definitions verbatim from its shipped build,
 * because they are the vocabulary the mode is *about* and a paraphrase would be
 * a different mode. The order is Allen's own, `is before` through `is after`,
 * which is also the order the card offers them in: it reads as one ladder from
 * "wholly earlier" to "wholly later", and a reader can walk it rather than
 * hunting a list of thirteen unrelated words.
 *
 * ── Why this is not a relation system ──
 *
 * Every other relation here is a predicate on a pair: it holds or it does not,
 * and `RelationSystem.holds` is the whole interface. Allen's relations are
 * *exclusive and exhaustive* — exactly one of the thirteen holds of any ordered
 * pair of periods — so the question stops being "does this hold" and becomes
 * "which one is it", and a premise names one of thirteen rather than asserting
 * or denying one thing. That does not fit the existing interface and should not
 * be bent into it.
 *
 * ── What an arrangement is ──
 *
 * A period is two endpoints with the start before the end, so an arrangement of
 * `n` periods is an ordering of `2n` endpoints *with ties allowed* — ties are
 * not a degenerate case here, they are what distinguishes `meets` from
 * `is before` and `equals` from everything. Enumerated as ordered set
 * partitions of the endpoints: choose which endpoints share the earliest moment,
 * then the next, and so on.
 *
 * This is what makes the mode's central fact true rather than asserted: periods
 * have length, so composing two relations gives a *set* and not a point. The
 * card's answer is read off the arrangements that survive, so "still possible"
 * means some arrangement has it.
 */

/** The thirteen relations, in Allen's order. Index is the relation. */
export const ALLEN_NAMES = [
    "is before", "meets", "overlaps", "starts", "is during", "finishes", "equals",
    "is finished by", "contains", "is started by", "is overlapped by", "is met by",
    "is after",
] as const;

/** What each one says, for the legend the card shows. Same indices. */
export const ALLEN_DEFINITIONS = [
    "ends before the other begins",
    "ends exactly as the other begins",
    "starts first and ends during the other",
    "starts with the other and ends first",
    "lies strictly within the other",
    "starts after the other and ends with it",
    "starts and ends with the other",
    "starts first and ends with the other",
    "starts before the other and ends after it",
    "starts with the other and ends after it",
    "starts during the other and ends after it",
    "begins exactly as the other ends",
    "begins after the other has ended",
] as const;

/**
 * How often each is worth stating, from Isomorph's own table.
 *
 * `is before` and `is after` are damped because they are the relations that say
 * least — two periods with no moment in common constrain the others hardly at
 * all — and `equals` hardest of all, because a premise that two periods are the
 * same collapses them and takes most of the reading with it.
 */
export const ALLEN_WEIGHTS = [
    0.4, 1, 1, 1, 1, 1, 0.15, 1, 1, 1, 1, 1, 0.4,
] as const;

/** The relation that holds the other way round, by index. */
export const ALLEN_CONVERSE = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

/**
 * An arrangement: `moment[i]` is when endpoint `i` happens.
 *
 * Endpoint `2k` is period `k`'s start and `2k + 1` is its end. Moments are
 * ranks rather than times — only the order and the ties carry meaning.
 */
export type Moments = number[];

const cache = new Map<number, Moments[]>();

/**
 * Every arrangement of `n` periods, as orderings of their endpoints with ties.
 *
 * Built by choosing the set of endpoints sharing the earliest moment, then the
 * next, and so on — which enumerates each ordering once, in contrast to
 * assigning ranks independently and discarding the ones that skip a rank.
 *
 * Pruned as it goes: a moment that ends a period whose start has not happened
 * is unreachable, and so is every ordering below it. Without the pruning four
 * periods is 545,835 orderings of eight endpoints to generate and then throw
 * most of away; with it, only the arrangements that are arrangements are ever
 * built.
 */
export function intervalStates(n: number): Moments[] {
    const found = cache.get(n);
    if (found) return found;

    const points = 2 * n;
    const out: Moments[] = [];
    const moment: Moments = Array(points).fill(-1);

    const walk = (placed: number, at: number) => {
        if (placed === points) { out.push([...moment]); return; }
        /*
         * The next moment is a non-empty set of the endpoints not yet placed.
         * Enumerated as a bitmask over those, which keeps the choice a plain
         * subset rather than a combination of sizes.
         */
        const free: number[] = [];
        for (let i = 0; i < points; i++) if (moment[i] < 0) free.push(i);

        for (let mask = 1; mask < (1 << free.length); mask++) {
            const taking: number[] = [];
            let ok = true;
            for (let b = 0; b < free.length; b++) {
                if (!(mask & (1 << b))) continue;
                const point = free[b];
                // An end cannot happen before, or at, its own start.
                if (point % 2 === 1 && moment[point - 1] < 0) { ok = false; break; }
                taking.push(point);
            }
            if (!ok) continue;

            for (const point of taking) moment[point] = at;
            walk(placed + taking.length, at + 1);
            for (const point of taking) moment[point] = -1;
        }
    };
    walk(0, 0);

    cache.set(n, out);
    return out;
}

/**
 * Which of the thirteen holds between periods `a` and `b` in an arrangement.
 *
 * Read off the four endpoint comparisons rather than looked up: the relation is
 * *defined* by how the starts and ends fall against each other, and a table
 * would be a second statement of the same thing to keep in step with the names.
 */
export function allenBetween(moment: Moments, a: number, b: number): number {
    const as = moment[2 * a], ae = moment[2 * a + 1];
    const bs = moment[2 * b], be = moment[2 * b + 1];

    if (ae < bs) return 0;                        // is before
    if (ae === bs) return 1;                      // meets
    if (be < as) return 12;                       // is after
    if (be === as) return 11;                     // is met by

    if (as === bs && ae === be) return 6;         // equals
    if (as === bs) return ae < be ? 3 : 9;        // starts / is started by
    if (ae === be) return as > bs ? 5 : 7;        // finishes / is finished by
    if (as > bs && ae < be) return 4;             // is during
    if (as < bs && ae > be) return 8;             // contains
    return as < bs ? 2 : 10;                      // overlaps / is overlapped by
}

/** One premise: `a` stands to `b` in one of `options` (a disjunction of one or more). */
export interface IntervalFact { a: number; b: number; options: number[]; }

/** The arrangements every premise allows. */
export function consistentIntervalStates(n: number, said: IntervalFact[]): Moments[] {
    return intervalStates(n).filter(moment =>
        said.every(f => f.options.includes(allenBetween(moment, f.a, f.b))));
}

/** The relations some surviving arrangement gives between `a` and `b`. */
export function possibleBetween(states: Moments[], a: number, b: number): number[] {
    const seen = new Set<number>();
    for (const moment of states) seen.add(allenBetween(moment, a, b));
    return [...seen].sort((p, q) => p - q);
}
