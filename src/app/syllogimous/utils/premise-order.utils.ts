import { integrationLoad } from "./integration.utils";
/**
 * Graded premise scrambling — ported in concept from Syllogimous v3
 * (`js/generators/premise-reorder.js`).
 *
 * Presenting premises in chain order lets you build the model in one pass.
 * Fully shuffling them forces you to hold fragments and join them later. v3
 * exposes that as a percentage rather than a switch, which makes it a genuine
 * difficulty dial — and a natural progression rung, since it raises load without
 * adding material.
 *
 * **Order can be semantic.** Layout premises describe a fixed arrangement and
 * read the same in any order, but a transformation sequence does not: `replay`
 * applies transforms in array order, so displaying them shuffled would describe
 * a different final state than the one the answer was computed from. Callers
 * must scramble only the order-independent portion — see `scrambleLeading`.
 */

/** 0 = leave in order, 100 = shuffle freely. */
export const DEFAULT_SCRAMBLE = 100;

function shuffled<T>(items: T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** How many adjacent pairs survived the reordering. */
function adjacencyCount(order: number[]) {
    let n = 0;
    for (let i = 0; i < order.length - 1; i++) {
        if (order[i + 1] - order[i] === 1) n++;
    }
    return n;
}

/**
 * Reorder `premises` so roughly `(100 - factor)%` of adjacent pairs stay together.
 *
 * Chosen adjacencies are welded into blocks and the blocks are shuffled, so the
 * kept pairs survive by construction. Shuffling can re-create adjacencies by
 * chance, so the result is resampled until the realised count is close to the
 * target — bounded, since an exact hit is not always reachable.
 */
export function scrambleByFactor<T>(premises: T[], factor: number): T[] {
    const n = premises.length;
    if (n < 3) return premises.slice();

    const clamped = Math.max(0, Math.min(100, factor));
    if (clamped === 0) return premises.slice();

    const divisions = n - 1;
    const keep = Math.round((100 - clamped) * divisions / 100);
    if (keep >= divisions) return premises.slice();

    // Which adjacencies (i, i+1) to preserve.
    const welded = new Set(shuffled([...Array(divisions).keys()]).slice(0, keep));

    const blocks: number[][] = [];
    for (let i = 0; i < n; i++) {
        if (i > 0 && welded.has(i - 1)) blocks[blocks.length - 1].push(i);
        else blocks.push([i]);
    }

    let best: number[] = blocks.flat();
    let bestGap = Infinity;
    for (let attempt = 0; attempt < 60; attempt++) {
        const order = shuffled(blocks).flat();
        const gap = Math.abs(adjacencyCount(order) - keep);
        if (gap < bestGap) { best = order; bestGap = gap; }
        // Small sets rarely hit the target exactly; near enough is the point.
        if (gap <= (n <= 5 ? 2 : 1)) break;
    }

    return best.map(i => premises[i]);
}

/**
 * Scramble only the first `orderedFrom` premises, leaving the tail untouched.
 *
 * Used where a trailing block must keep its sequence — transformation steps are
 * applied in order, so they have to be *read* in order too.
 */
export function scrambleLeading<T>(premises: T[], orderedFrom: number, factor: number): T[] {
    const head = premises.slice(0, orderedFrom);
    const tail = premises.slice(orderedFrom);
    return [...scrambleByFactor(head, factor), ...tail];
}

/**
 * Scramble within each block, never across the boundary between them.
 *
 * `scrambleLeading` shuffles a head and pins a tail, which is what a
 * transformation needs — its steps are a sequence. A checkpoint needs something
 * else: both halves may be shuffled, but a premise must not cross from one to
 * the other, because the claim placed at the boundary is answerable from what
 * comes *before* it and a premise that moved is a premise the reader did not
 * have.
 */
export function scrambleBlocks<T>(premises: T[], boundary: number, factor: number): T[] {
    return [
        ...scrambleByFactor(premises.slice(0, boundary), factor),
        ...scrambleByFactor(premises.slice(boundary), factor),
    ];
}

/* ------------------------------------------------------------------ *
 * Ordering for the merge, rather than against the adjacency           *
 * ------------------------------------------------------------------ */

/**
 * An order chosen for how much of the map one premise settles.
 *
 * `scrambleByFactor` grades the load by how many adjacent pairs survive, which
 * is a proxy for how many unjoined fragments have to be carried. That is
 * storage — how many partial results you hold — and maximising it is a way of
 * reading working memory at full stretch rather than of asking a harder
 * question. At a hundred it is already at its maximum and says nothing about
 * what any single premise has to do.
 *
 * The demand worth grading is the seam: an item that builds two or more
 * substantial structures apart and then folds them into one map settles every
 * pair across the join at once, and both sides have to be held entire while it
 * happens. `pairsSettled` counts exactly that, and it is almost entirely a
 * function of the order — the same premises read in sequence never settle more
 * than the chain's own length, and read as two halves that meet can settle
 * several times that.
 *
 * **Sampled rather than solved.** The orderings are `n!` and the score is not
 * separable, so this draws candidates and keeps the one nearest the wanted
 * point of the range it found. A few hundred draws on a handful of premises is
 * nothing, and the alternative — a partitioning heuristic — would be a second
 * implementation of a quantity that is already measured.
 *
 * `target` is 0–100 of the range *this item can reach*, not an absolute: what
 * counts as a big merge depends on how many objects there are, and a fixed
 * number would mean something different in every mode.
 */
export function scheduleForMerge<T>(
    premises: T[],
    target: number,
    score: (order: T[]) => number,
    draws = 240,
): T[] {
    if (premises.length < 3) return premises.slice();

    const candidates: Array<{ order: T[]; value: number }> = [];
    // The order it came in, which is the low end of the range by construction.
    candidates.push({ order: premises.slice(), value: score(premises) });
    for (let i = 0; i < draws; i++) {
        const order = shuffled(premises);
        candidates.push({ order, value: score(order) });
    }

    const values = candidates.map(c => c.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    if (high === low) return candidates[0].order;

    const wanted = low + (high - low) * Math.max(0, Math.min(100, target)) / 100;
    let best = candidates[0];
    for (const c of candidates) {
        if (Math.abs(c.value - wanted) < Math.abs(best.value - wanted)) best = c;
    }
    return best.order;
}

/**
 * The order a mode's premises are shown in, whichever rule applies.
 *
 * One place, so no generator has to know which it is. With the whole card
 * visible the adjacency grading is right — order there is a search cost, and
 * the reader can re-read in whatever order they like. One premise at a time is
 * a memory schedule, and then the seam is what to grade.
 */
export function orderPremises(
    premises: string[],
    factor: number,
    mergeTarget: number | null,
): string[] {
    if (mergeTarget == null) return scrambleByFactor(premises, factor);
    return scheduleForMerge(premises, mergeTarget,
        order => integrationLoad(order).pairsSettled);
}
