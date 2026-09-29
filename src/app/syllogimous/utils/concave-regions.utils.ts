/**
 * Concave regions: the distinctions RCC8 cannot make.
 *
 * RCC8 asks how two regions stand, and over convex regions that is the whole
 * story. Over a region with a hollow in it, it stops being the whole story in one
 * specific and interesting way: a patch nestling *inside* another's bay, touching
 * nothing, and a patch lying somewhere else entirely are both `apart` — RCC8 has
 * one word for two situations that could not be less alike. Cohn's RCC23 and its
 * refinements exist to name the difference.
 *
 * ── What this is, and what it is not ──
 *
 * It is not RCC23 and it is not RCC62. Both are defined by relation *lists*, and
 * the paper that describes them gives those lists as figures — images, which
 * cannot be read out of the file. Transcribing sixty-two intersection matrices
 * from a picture is not something to do by guesswork.
 *
 * So the relations here are *derived from named predicates* rather than matched to
 * a list. Each is a product of three things that can each be written down and
 * checked: how the two regions stand as regions (the RCC8 relation), where the
 * second sits with respect to the first's bay, and where the first sits with
 * respect to the second's. That makes every relation nameable, which a list of
 * matrices is not — and a card has to name the relation it asks about.
 *
 * The domain is stated rather than implied: a rectangular patch with a rectangular
 * bay cut into one edge. That is Cohn's "simple concave region" — exactly one
 * concavity — in the simplest form that can be computed exactly.
 *
 * ── Why sampling is exact here ──
 *
 * Every part of every region is a union or difference of axis-aligned rectangles
 * with integer corners. Doubling the coordinates puts every boundary on an even
 * grid point and leaves every interior containing an odd one, so a sweep of the
 * doubled lattice meets every non-empty part of every region. It is not an
 * approximation of the intersection tests; it is a complete enumeration of them,
 * and it is far harder to get wrong than the case analysis it replaces.
 */

/** A rectangle with a rectangular bay cut into exactly one of its edges. */
export interface Patch {
    x1: number; x2: number; y1: number; y2: number;
    /** The bay, flush with one edge of the rectangle and clear of the other three. */
    bx1: number; bx2: number; by1: number; by2: number;
}

/** The four parts the concave calculus is built on. */
export const OUTSIDE = 0;   // beyond the convex hull
export const EDGE = 1;      // the patch's own outline
export const BODY = 2;      // its interior
export const BAY = 3;       // the concavity: hull minus patch

/**
 * How far the lattice runs. Region coordinates live in `0..SPAN`.
 *
 * Ten, and the number is forced rather than chosen. On integers a bay flush with
 * exactly one edge needs its host at least two across and three deep — the other
 * three sides have to have room to be *clear* of it — so the smallest patch is
 * 2 x 3. Nesting one strictly inside another's bay therefore needs a bay of about
 * 4 x 5 and a host of about 5 x 8.
 *
 * At five, that did not fit, and the consequence was not a smaller set of
 * relations: it was the absence of *the* relation the whole calculus exists for.
 * "Apart, and lying in the other's bay" is the case RCC8 cannot tell from "apart,
 * somewhere else entirely", and the first sweep realised twenty-five relations
 * without it. A domain too small to express the distinction being taught is worse
 * than no domain.
 */
export const SPAN = 10;
const LOW = -2;
const HIGH = 2 * SPAN + 2;

/** Whether a patch is well formed: a bay on one edge only, clear of the rest. */
export function isPatch(p: Patch): boolean {
    if (p.x1 >= p.x2 || p.y1 >= p.y2) return false;
    if (p.bx1 >= p.bx2 || p.by1 >= p.by2) return false;
    if (p.bx1 < p.x1 || p.bx2 > p.x2 || p.by1 < p.y1 || p.by2 > p.y2) return false;
    const flush = [p.bx1 === p.x1, p.bx2 === p.x2, p.by1 === p.y1, p.by2 === p.y2]
        .filter(Boolean).length;
    /*
     * Exactly one edge. None makes the bay a hole rather than a bay — a region with
     * a hole is not simply connected and is a different calculus. Two or more cuts
     * the patch in half or leaves it with more than one concavity, which is what
     * "simple" excludes.
     */
    return flush === 1;
}

/** Which part of `p` a doubled-lattice point falls in. */
export function partAt(p: Patch, px: number, py: number): number {
    const X1 = 2 * p.x1, X2 = 2 * p.x2, Y1 = 2 * p.y1, Y2 = 2 * p.y2;
    const B1 = 2 * p.bx1, B2 = 2 * p.bx2, C1 = 2 * p.by1, C2 = 2 * p.by2;

    if (px < X1 || px > X2 || py < Y1 || py > Y2) return OUTSIDE;
    if (px > B1 && px < B2 && py > C1 && py < C2) return BAY;

    const insideHull = px > X1 && px < X2 && py > Y1 && py < Y2;
    const onBay = px >= B1 && px <= B2 && py >= C1 && py <= C2;
    return insideHull && !onBay ? BODY : EDGE;
}

/** Which pairs of parts meet, as a 16-bit mask over `partAt(a) * 4 + partAt(b)`. */
export function meetings(a: Patch, b: Patch): number {
    let mask = 0;
    for (let px = LOW; px <= HIGH; px++) {
        for (let py = LOW; py <= HIGH; py++) {
            mask |= 1 << (partAt(a, px, py) * 4 + partAt(b, px, py));
        }
    }
    return mask;
}

const meet = (mask: number, i: number, j: number) => (mask & (1 << (i * 4 + j))) !== 0;

/* ------------------------------------------------------------------ *
 * The three named components                                          *
 * ------------------------------------------------------------------ */

/** How two patches stand as regions, ignoring their bays. RCC8's eight. */
export const STANDING = [
    "apart from", "touching", "overlapping", "inside, edge to edge with",
    "deep inside", "holding, edge to edge,", "holding deep inside", "identical to",
] as const;

/**
 * The RCC8 relation between the patches themselves.
 *
 * Worked out from which parts meet rather than from coordinates: the patch is its
 * edge and its body together, so two patches meet where any of those four
 * combinations do, and their interiors meet only where body meets body.
 */
export function standing(mask: number): number {
    const bodies = [EDGE, BODY];
    const touches = bodies.some(i => bodies.some(j => meet(mask, i, j)));
    if (!touches) return 0;                                  // apart
    if (!meet(mask, BODY, BODY)) return 1;                   // touching, interiors clear

    /* Containment: `a` is inside `b` when no part of `a`'s patch reaches outside
       `b`'s patch — that is, never meets `b`'s outside or `b`'s bay. */
    const aOut = bodies.some(i => meet(mask, i, OUTSIDE) || meet(mask, i, BAY));
    const bOut = bodies.some(j => meet(mask, OUTSIDE, j) || meet(mask, BAY, j));

    if (!aOut && !bOut) return 7;                            // identical
    if (!aOut) return meet(mask, EDGE, EDGE) ? 3 : 4;        // a inside b
    if (!bOut) return meet(mask, EDGE, EDGE) ? 5 : 6;        // a holds b
    return 2;                                                // overlapping
}

/** Where one patch sits with respect to the other's bay. */
export const BAY_STANDING = [
    "clear of", "reaching into", "lying in",
] as const;

/**
 * How `b` stands to `a`'s bay: clear of it, reaching into it, or lying in it.
 *
 * The distinction RCC8 throws away. `lying in` means every part of `b` that is
 * anywhere near `a` is within the concavity and none of it is beyond the hull;
 * `reaching into` means it straddles the mouth. Both are `apart from` as regions,
 * and telling them apart is the whole reason for a concave calculus.
 */
export function bayStanding(mask: number, swap = false): number {
    const at = (i: number, j: number) => (swap ? meet(mask, j, i) : meet(mask, i, j));
    const inBay = [EDGE, BODY].some(i => at(i, BAY));
    if (!inBay) return 0;                                      // clear of the bay
    const beyond = [EDGE, BODY].some(i => at(i, OUTSIDE));
    return beyond ? 1 : 2;                                     // reaching in / lying in
}

/** A relation: how they stand, and how each sits in the other's bay. */
export interface ConcaveRelation {
    stands: number;
    inTheirBay: number;
    theyInMine: number;
}

export const relationOf = (mask: number): ConcaveRelation => ({
    stands: standing(mask),
    inTheirBay: bayStanding(mask, false),
    theyInMine: bayStanding(mask, true),
});

export const relationKey = (r: ConcaveRelation) =>
    `${r.stands}:${r.inTheirBay}:${r.theyInMine}`;

/**
 * The relation in words, with the two patches named.
 *
 * Built from the components rather than looked up, so a relation cannot exist
 * without a name and a name cannot drift from what it means. The bay clauses are
 * left out when both are `clear of`, because "apart from B, clear of B's bay,
 * with B clear of A's bay" says one thing three times.
 */
export function describeRelation(r: ConcaveRelation, a: string, b: string): string {
    const parts = [`${a} is ${STANDING[r.stands]} ${b}`];
    if (r.inTheirBay > 0) parts.push(`${BAY_STANDING[r.inTheirBay]} ${b}'s bay`);
    if (r.theyInMine > 0) parts.push(`with ${b} ${BAY_STANDING[r.theyInMine]} ${a}'s bay`);
    return parts.join(", ");
}

/* ------------------------------------------------------------------ *
 * Which relations exist, and which are near each other                *
 * ------------------------------------------------------------------ */

/**
 * A patch drawn at random, no larger than asked for.
 *
 * Enumerating every patch was fine on a five-wide lattice and is not on a
 * ten-wide one: the count goes as the fourth power of the spans, and every pair of
 * them needs a lattice sweep. Drawing them is also what the generator has to do
 * anyway, so the same placer serves both.
 */
export function randomPatch(
    random: () => number,
    span = SPAN,
    minWidth = 2,
    minHeight = 3,
): Patch | null {
    for (let attempt = 0; attempt < 60; attempt++) {
        const pick = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
        const x1 = pick(0, span - minWidth), y1 = pick(0, span - minHeight);
        const x2 = pick(x1 + minWidth, span), y2 = pick(y1 + minHeight, span);
        /* The bay is flush with one edge and clear of the other three, so which
           edge decides which of its four sides is pinned. */
        const edge = Math.floor(random() * 4);
        const bx1 = edge === 0 ? x1 : pick(x1 + 1, x2 - 1);
        const bx2 = edge === 1 ? x2 : pick(bx1 + 1, x2 - (edge === 0 ? 1 : 0));
        const by1 = edge === 2 ? y1 : pick(y1 + 1, y2 - 1);
        const by2 = edge === 3 ? y2 : pick(by1 + 1, y2 - (edge === 2 ? 1 : 0));
        const p = { x1, x2, y1, y2, bx1, bx2, by1, by2 };
        if (isPatch(p)) return p;
    }
    return null;
}

/**
 * A patch whose bay has room for another patch inside it.
 *
 * Built to fit rather than drawn and hoped over. A patch needs 2 x 3, and one
 * clear cell on every side of it — the mouth included, since reaching the mouth
 * puts part of it beyond the hull — so the bay must be at least 4 x 5 and the host
 * at least 5 x 7 around it. Drawn freely, a host with that much room came up twice
 * in four hundred attempts, which is fine for a sweep that runs forty thousand
 * rounds and useless for a generator that has to build one card.
 */
export function roomyPatch(random: () => number, span = SPAN): Patch | null {
    for (let attempt = 0; attempt < 60; attempt++) {
        const pick = (lo: number, hi: number) =>
            hi < lo ? null : lo + Math.floor(random() * (hi - lo + 1));

        /* The bay first, then a host that clears it on three sides. */
        const bw = pick(4, Math.min(8, span - 1));
        const bh = pick(5, Math.min(8, span - 2));
        if (bw === null || bh === null) continue;

        const edge = Math.floor(random() * 4);
        const alongX = edge === 0 || edge === 1;
        const width = bw + (alongX ? 1 : 2);
        const height = bh + (alongX ? 2 : 1);
        const x1 = pick(0, span - width), y1 = pick(0, span - height);
        if (x1 === null || y1 === null) continue;
        const x2 = x1 + width, y2 = y1 + height;

        /* Flush with the chosen edge, one clear cell on each of the others. */
        const bx1 = edge === 0 ? x1 : edge === 1 ? x2 - bw : x1 + 1;
        const by1 = edge === 2 ? y1 : edge === 3 ? y2 - bh : y1 + 1;
        const p = { x1, x2, y1, y2, bx1, bx2: bx1 + bw, by1, by2: by1 + bh };
        if (isPatch(p)) return p;
    }
    return null;
}

/**
 * A patch lying strictly inside `host`'s bay, if one fits.
 *
 * Constructed rather than hoped for. The relation it produces — apart as regions,
 * yet lying in the other's concavity — is the one RCC8 cannot express, so leaving
 * it to a random draw to stumble on is leaving the point of the exercise to luck.
 * It fitted nowhere on the first lattice and would be rare on this one.
 */
export function patchInBay(host: Patch, random: () => number): Patch | null {
    /* One clear cell inside the bay on every side, the mouth included: touching a
       wall would make them `touching` and reaching the mouth would put part of it
       beyond the hull. */
    const lo = { x: host.bx1 + 1, y: host.by1 + 1 };
    const hi = { x: host.bx2 - 1, y: host.by2 - 1 };
    if (hi.x - lo.x < 2 || hi.y - lo.y < 3) return null;

    for (let attempt = 0; attempt < 40; attempt++) {
        const pick = (l: number, h: number) => l + Math.floor(random() * (h - l + 1));
        const x1 = pick(lo.x, hi.x - 2), y1 = pick(lo.y, hi.y - 3);
        const x2 = pick(x1 + 2, hi.x), y2 = pick(y1 + 3, hi.y);
        const edge = Math.floor(random() * 4);
        const bx1 = edge === 0 ? x1 : pick(x1 + 1, x2 - 1);
        const bx2 = edge === 1 ? x2 : pick(bx1 + 1, x2 - (edge === 0 ? 1 : 0));
        const by1 = edge === 2 ? y1 : pick(y1 + 1, y2 - 1);
        const by2 = edge === 3 ? y2 : pick(by1 + 1, y2 - (edge === 2 ? 1 : 0));
        const p = { x1, x2, y1, y2, bx1, bx2, by1, by2 };
        if (isPatch(p)) return p;
    }
    return null;
}

let realisedCache: Map<string, number[]> | null = null;

/**
 * The relations this domain actually realises, and the masks that realise each.
 *
 * Discovered rather than declared. A relation that no pair of patches can be in is
 * one a card would offer and never be able to mark, and a relation the code cannot
 * name is one a card could never ask about — so the set of relations *is* whatever
 * the sweep finds, and nothing else is offered anywhere.
 *
 * Every ordered pair of patches, which is a few million mask computations on a
 * lattice of fourteen by fourteen. Done once, the first time anything asks.
 */
export function realised(): Map<string, number[]> {
    if (realisedCache) return realisedCache;

    /* Its own generator, so the set does not depend on when it is first asked for
       or on what else has been drawing from Math.random. */
    let seed = 0x9e3779b9;
    const random = () => {
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >> 17;
        seed ^= seed << 5; seed >>>= 0;
        return seed / 0x100000000;
    };

    const found = new Map<string, number[]>();
    const note = (a: Patch, b: Patch) => {
        const mask = meetings(a, b);
        const key = relationKey(relationOf(mask));
        const held = found.get(key);
        if (held) { if (held.length < 24) held.push(mask); }
        else found.set(key, [mask]);
    };

    for (let round = 0; round < 40000; round++) {
        const a = randomPatch(random);
        const b = randomPatch(random);
        if (!a || !b) continue;
        note(a, b);
        note(b, a);
        /* And the nested case both ways round, over a host built with room for it:
           drawn freely, a host whose bay can hold a patch turns up twice in four
           hundred, so the relations that matter most here would be the rarest. */
        const host = roomyPatch(random);
        if (host) {
            const inner = patchInBay(host, random);
            if (inner) { note(inner, host); note(host, inner); }
        }
    }

    realisedCache = found;
    return found;
}

/** Differing cells between two 16-bit meeting masks: the topological distance. */
export function maskDistance(one: number, other: number): number {
    let n = 0, diff = one ^ other;
    while (diff) { n += diff & 1; diff >>>= 1; }
    return n;
}

/**
 * How far apart two relations are, as the closest their realisations come.
 *
 * The paper's Closest Topological Relation Graph, over relations rather than over
 * matrices: topological distance is the number of cells two intersection matrices
 * differ in, and two relations are as close as their nearest realisations. Purely
 * combinatorial — no continuity argument, and nothing read off a figure.
 */
export function relationDistance(one: string, other: string): number {
    const found = realised();
    const a = found.get(one) ?? [], b = found.get(other) ?? [];
    let best = 17;
    for (const p of a) for (const q of b) best = Math.min(best, maskDistance(p, q));
    return best;
}

/**
 * The relations nearest a given one, closest first.
 *
 * This is the option-limiting mechanism, and the reason a calculus with dozens of
 * relations can be put on a card at all: the answer plus its nearest neighbours is
 * a short menu of exactly the relations hardest to tell it from, chosen by
 * measurement rather than by anybody's judgement of what looks confusable.
 */
export function nearestRelations(key: string, count: number): string[] {
    return [...realised().keys()]
        .filter(other => other !== key)
        .map(other => ({ other, d: relationDistance(key, other) }))
        .sort((p, q) => p.d - q.d || (p.other < q.other ? -1 : 1))
        .slice(0, count)
        .map(x => x.other);
}

export const parseKey = (key: string): ConcaveRelation => {
    const [stands, inTheirBay, theyInMine] = key.split(":").map(Number);
    return { stands, inTheirBay, theyInMine };
};
