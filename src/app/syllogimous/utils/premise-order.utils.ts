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
