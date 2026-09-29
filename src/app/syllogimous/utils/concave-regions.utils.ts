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

import { RCC8_NAMES } from "./interval-algebra.utils";

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

/**
 * Which part of `p` a doubled-lattice point falls in.
 *
 * ── The mouth belongs to the bay, and getting that wrong broke the algebra ──
 *
 * The bay is an open rectangle and its walls are part of the patch's outline, so
 * the obvious rule is "in the hull, not strictly in the bay, on the hull boundary
 * or the bay's — that's EDGE". It is wrong at exactly one place: the *mouth*, the
 * segment where the bay meets the edge it is flush with. That segment is not on
 * the patch at all — the patch is on neither side of it — and calling it EDGE gave
 * every patch a one-dimensional whisker across the opening of its own bay.
 *
 * A whisker is not a harmless inaccuracy. It made the region something other than
 * the closure of its own interior, and RCC8's laws hold only for regions that are.
 * A patch sitting in front of another's bay, touching nothing, came out as
 * `touching` because its edge landed on the whisker; and `A deep inside B` with
 * `B touching C` then came out with `A touching C`, which no arrangement of
 * regions permits. Sixteen violations of provable composition rules, all of them
 * this.
 *
 * So the mouth is BAY, and the bay's other three walls are EDGE. With that, eight
 * thousand witnessed compositions violate no rule — and five relations appear that
 * the whisker had been hiding, because "apart, but reaching into the other's bay"
 * had been getting counted as contact.
 */
export function partAt(p: Patch, px: number, py: number): number {
    const X1 = 2 * p.x1, X2 = 2 * p.x2, Y1 = 2 * p.y1, Y2 = 2 * p.y2;
    const B1 = 2 * p.bx1, B2 = 2 * p.bx2, C1 = 2 * p.by1, C2 = 2 * p.by2;

    if (px < X1 || px > X2 || py < Y1 || py > Y2) return OUTSIDE;

    if (px >= B1 && px <= B2 && py >= C1 && py <= C2) {
        /* A side of the bay that is not the one it is flush with is a wall, and a
           wall is the patch's own boundary. What is left is the bay and its mouth. */
        const wall = (p.bx1 !== p.x1 && px === B1) || (p.bx2 !== p.x2 && px === B2)
            || (p.by1 !== p.y1 && py === C1) || (p.by2 !== p.y2 && py === C2);
        return wall ? EDGE : BAY;
    }

    return px > X1 && px < X2 && py > Y1 && py < Y2 ? BODY : EDGE;
}

/**
 * Which pairs of parts meet, as a 16-bit mask over `partAt(a) * 4 + partAt(b)`.
 *
 * Swept over the two patches' shared bounding box **grown by one**, and that is the
 * whole lattice as far as the answer goes. Every part of either patch is inside the
 * ungrown box, so the only combination the box itself could miss is
 * outside-meets-outside — and the extra ring is outside both patches at every point,
 * so it supplies exactly that and nothing is lost.
 *
 * The one is the whole argument, which is why it is worth saying twice: without it
 * two patches that between them fill their bounding box would come out as having no
 * shared exterior, and `apart from` would stop being expressible at all. A first
 * version added a far-off point as well, on the theory that the ring might not be
 * clear of both — it always is, and the point was dead. Held to a sweep of the full
 * lattice, which is the check that says so.
 */
export function meetings(a: Patch, b: Patch): number {
    let mask = 0;
    const x1 = Math.min(2 * a.x1, 2 * b.x1) - 1, x2 = Math.max(2 * a.x2, 2 * b.x2) + 1;
    const y1 = Math.min(2 * a.y1, 2 * b.y1) - 1, y2 = Math.max(2 * a.y2, 2 * b.y2) + 1;
    for (let px = x1; px <= x2; px++) {
        for (let py = y1; py <= y2; py++) {
            mask |= 1 << (partAt(a, px, py) * 4 + partAt(b, px, py));
        }
    }
    return mask;
}

/** The full-lattice sweep, kept so a test can hold the bounded one to it. */
export function meetingsOverLattice(a: Patch, b: Patch): number {
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

/**
 * How two patches stand as regions, ignoring their bays. RCC8's eight.
 *
 * The app's own wording for them, not a second set. `interval-algebra.utils` already
 * names these eight for the rectangle mode, and a player who has met "is deep
 * inside" there is owed the same words here — the relation is the same relation, and
 * this calculus is that one with the bays added back. Two tables would also drift,
 * which is the failure this project keeps finding.
 */
export const STANDING = RCC8_NAMES;

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
    const parts = [`${a} ${STANDING[r.stands]} ${b}`];
    if (r.inTheirBay > 0) parts.push(`${BAY_STANDING[r.inTheirBay]} ${b}'s bay`);
    if (r.theyInMine > 0) parts.push(`with ${b} ${BAY_STANDING[r.theyInMine]} ${a}'s bay`);
    return parts.join(", ");
}

/**
 * The same relation with nothing left out, clause by clause.
 *
 * `describeRelation` drops a bay clause that says `clear of`, on the grounds that
 * "apart from B, clear of B's bay, with B clear of A's bay" says one thing three
 * times. That is right for prose about a relation already established and wrong for
 * a premise, and wrong twice over.
 *
 * As a premise, `clear of` is not redundant but *load-bearing*: half the rules below
 * turn on it, and a sentence that leaves it unsaid leaves the reader unable to tell
 * "clear of" from "not mentioned". As an option, it is worse — "A partly overlaps C"
 * would stand for four different relations on the same menu, so two options could be
 * the same words with different answers.
 *
 * Returned as clauses rather than a sentence because the card marks the relation
 * words and the names separately, and a caller that has to split a sentence back up
 * will split it wrongly.
 */
export function relationClauses(r: ConcaveRelation, a: string, b: string): string[] {
    return [
        `${a} ${STANDING[r.stands]} ${b}`,
        `${BAY_STANDING[r.inTheirBay]} ${b}'s bay`,
        `with ${b} ${BAY_STANDING[r.theyInMine]} ${a}'s bay`,
    ];
}

/** The relation in full, as one sentence. */
export const spellOutRelation = (r: ConcaveRelation, a: string, b: string) =>
    relationClauses(r, a, b).join(", ");

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
        const p = cutBay(random, x1, x2, y1, y2);
        if (p) return p;
    }
    return null;
}

/**
 * A bay cut into a random edge of a given rectangle.
 *
 * Shared, because three placers all need it and all three had their own copy of
 * the same four-way case analysis: the bay is flush with one edge and clear of the
 * other three, so which edge is chosen decides which of its four sides is pinned
 * and which are drawn.
 */
export function cutBay(
    random: () => number,
    x1: number, x2: number, y1: number, y2: number,
): Patch | null {
    const pick = (lo: number, hi: number) =>
        hi < lo ? null : lo + Math.floor(random() * (hi - lo + 1));
    const edge = Math.floor(random() * 4);

    const bx1 = edge === 0 ? x1 : pick(x1 + 1, x2 - 1);
    if (bx1 === null) return null;
    const bx2 = edge === 1 ? x2 : pick(bx1 + 1, x2 - (edge === 0 ? 1 : 0));
    const by1 = edge === 2 ? y1 : pick(y1 + 1, y2 - 1);
    if (by1 === null) return null;
    const by2 = edge === 3 ? y2 : pick(by1 + 1, y2 - (edge === 2 ? 1 : 0));
    if (bx2 === null || by2 === null) return null;

    const p = { x1, x2, y1, y2, bx1, bx2, by1, by2 };
    return isPatch(p) ? p : null;
}

/** A patch somewhere inside a box, held `margin` clear of its sides. */
function patchInBox(
    random: () => number,
    box: [number, number, number, number],
    margin: number,
): Patch | null {
    const [bx1, bx2, by1, by2] = box;
    const lo = { x: bx1 + margin, y: by1 + margin };
    const hi = { x: bx2 - margin, y: by2 - margin };
    if (hi.x - lo.x < 2 || hi.y - lo.y < 3) return null;

    for (let attempt = 0; attempt < 30; attempt++) {
        const pick = (l: number, h: number) => l + Math.floor(random() * (h - l + 1));
        const x1 = pick(lo.x, hi.x - 2), y1 = pick(lo.y, hi.y - 3);
        const x2 = pick(x1 + 2, hi.x), y2 = pick(y1 + 3, hi.y);
        const p = cutBay(random, x1, x2, y1, y2);
        if (p) return p;
    }
    return null;
}

/**
 * The rectangles inside a patch that miss its bay.
 *
 * A patch is an L or a T: its hull less a bay flush with one edge. Two rectangles
 * always cover the ways to sit in what is left — the part beyond the bay along the
 * bay's own axis, and the strips to either side of it across that axis — and
 * anything that fits in the region at all fits in one of them. Needed because
 * `inside` is the half of the calculus a random draw never produces: two patches
 * drawn independently are apart or overlapping, essentially never nested.
 */
export function freeBoxes(h: Patch): Array<[number, number, number, number]> {
    const out: Array<[number, number, number, number]> = [];
    const alongX = h.bx1 === h.x1 || h.bx2 === h.x2;
    if (alongX) {
        /* Beyond the mouth, then the strips above and below the bay. */
        out.push(h.bx1 === h.x1 ? [h.bx2, h.x2, h.y1, h.y2] : [h.x1, h.bx1, h.y1, h.y2]);
        out.push([h.x1, h.x2, h.y1, h.by1]);
        out.push([h.x1, h.x2, h.by2, h.y2]);
    } else {
        out.push(h.by1 === h.y1 ? [h.x1, h.x2, h.by2, h.y2] : [h.x1, h.x2, h.y1, h.by1]);
        out.push([h.x1, h.bx1, h.y1, h.y2]);
        out.push([h.bx2, h.x2, h.y1, h.y2]);
    }
    return out.filter(([a, b, c, d]) => b - a >= 2 && d - c >= 3);
}

/**
 * A patch inside `host`'s own region — `deep` for clear of its outline as well.
 *
 * `deep` is the difference between `inside, edge to edge with` and `deep inside`,
 * which is the pair of relations the containment rules below turn on: one step of
 * `deep inside` anywhere in a chain settles the whole chain.
 */
export function patchInsideBody(
    host: Patch,
    random: () => number,
    deep: boolean,
): Patch | null {
    const boxes = freeBoxes(host);
    for (let attempt = 0; attempt < boxes.length * 3; attempt++) {
        const box = boxes[Math.floor(random() * boxes.length)];
        if (!box) return null;
        const p = patchInBox(random, box, deep ? 1 : 0);
        if (p) return p;
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
    return patchInBox(random, [host.bx1, host.bx2, host.by1, host.by2], 1);
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

    /*
     * The witness pool first, because the two have to agree.
     *
     * The pool is what the composition work offers on a card, and this is what
     * measures how nearly alike two relations are. A relation in one and not the
     * other would be offered with no distance to anything, or measured and never
     * offered — so the pool's pairs are swept here as well, and
     * `concave-regions.test.ts` asserts the two sets are equal.
     */
    const pool = concavePool();
    for (const a of pool) for (const b of pool) note(a, b);

    /*
     * Then free draws, for the *variety* of masks rather than for the relations.
     * Distance is taken between the nearest realisations of two relations, so a
     * relation known by one arrangement is measured too far from everything.
     */
    for (let round = 0; round < 8000; round++) {
        const a = randomPatch(random);
        const b = randomPatch(random);
        if (!a || !b) continue;
        note(a, b);
        note(b, a);
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

/* ------------------------------------------------------------------ *
 * Composition: what two relations in a row leave open                 *
 * ------------------------------------------------------------------ *
 *
 * The interesting question over any region calculus is what chaining does: `A`
 * stands thus to `B`, `B` thus to `C`, so what is still possible between `A` and
 * `C`? RCC8 answers it with a published composition table. This calculus has no
 * table, and cannot be given one the way the rectangle modes are: `rcc8.ts` gets
 * its exact answer by enumerating every qualitative arrangement of three
 * rectangles — 167,281 of them — and the same enumeration over three patches would
 * have to run over the interleavings of twelve x-coordinates and twelve y's, which
 * is not a number anything finishes.
 *
 * ── So each direction is proved its own way ──
 *
 * The temptation is to sample: build a lot of triples, record what comes out, call
 * that the answer. That fails, and it fails in the direction that matters. A
 * sample can only ever be too *small*, so the card would omit a relation that is
 * genuinely possible and mark a reader wrong for finding it — the worst thing an
 * item can do.
 *
 * The two directions are not symmetrical, though, and that is the way out:
 *
 *   **Possible** is proved by a *witness*. One actual triple of patches settles it
 *   forever, so sampling is sound here by construction — every relation the sweep
 *   finds really is achievable, and a relation it misses is simply not claimed.
 *
 *   **Impossible** is proved by a *rule* about regions. "A is part of B and B is
 *   apart from C, so nothing of A can reach C" holds over every region there is,
 *   not just over the pool — so it excludes soundly, and it can be printed in the
 *   explanation, which a table entry cannot.
 *
 * A relation that is neither witnessed nor excluded is not offered. That is the
 * whole trick: the card never asks a question the code cannot answer, and the menu
 * shrinks to exactly the relations something can be proved about — which is also
 * the answer to "there are far too many of these to display".
 */

/** How many patches the witness pool holds. */
const POOL_SIZE = 240;

/** Patches drawn to cover the calculus, including the nestings a draw never gives. */
let poolCache: Patch[] | null = null;

/**
 * A pool of patches wide enough to witness the whole calculus.
 *
 * Two patches drawn independently are apart or overlapping — nested is a measure-
 * zero accident, and the first sweep of this domain found none at all. So half the
 * pool is *built* from the other half: for each host, a patch inside its body, one
 * deep inside it, and one lying in its bay. Those are the relations the containment
 * rules turn on and the ones the card is most worth asking about.
 *
 * Two hundred and forty, which realises every relation the domain has and puts the
 * pairwise table at fifty-eight thousand masks — a fifth of a second, once.
 */
export function concavePool(): Patch[] {
    if (poolCache) return poolCache;

    /* Its own generator: the pool is a fact about the domain, so it must not depend
       on when it is first asked for or on what else has drawn from Math.random. */
    let seed = 0x2545f491;
    const random = () => {
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >> 17;
        seed ^= seed << 5; seed >>>= 0;
        return seed / 0x100000000;
    };

    const seen = new Set<string>();
    const out: Patch[] = [];
    const add = (p: Patch | null) => {
        if (!p || !isPatch(p)) return;
        const k = [p.x1, p.x2, p.y1, p.y2, p.bx1, p.bx2, p.by1, p.by2].join(",");
        if (seen.has(k)) return;
        seen.add(k);
        out.push(p);
    };

    for (let round = 0; out.length < POOL_SIZE && round < POOL_SIZE * 40; round++) {
        add(randomPatch(random));

        const host = randomPatch(random);
        if (host) {
            add(host);
            add(patchInsideBody(host, random, false));
            add(patchInsideBody(host, random, true));
        }
        /* A host with room in its bay, and the patch that sits in it: the relation
           RCC8 cannot express, which nothing else here produces. */
        const roomy = roomyPatch(random);
        if (roomy) {
            add(roomy);
            add(patchInBay(roomy, random));
            add(patchInsideBody(roomy, random, true));
        }
    }

    poolCache = out.slice(0, POOL_SIZE);
    return poolCache;
}

interface PoolTable {
    /** How many patches. */
    n: number;
    /** Relation keys, in the order the table numbers them. */
    keys: string[];
    /** `rel[i * n + j]` is the index into `keys` of the relation from `i` to `j`. */
    rel: Int16Array;
    /** For each relation index, one witnessing ordered pair. */
    example: Array<[number, number]>;
}

let tableCache: PoolTable | null = null;

/** Every ordered pair of the pool, and the relation each is in. */
function poolTable(): PoolTable {
    if (tableCache) return tableCache;

    const pool = concavePool();
    const n = pool.length;
    const index = new Map<string, number>();
    const keys: string[] = [];
    const example: Array<[number, number]> = [];
    const rel = new Int16Array(n * n);

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const key = relationKey(relationOf(meetings(pool[i], pool[j])));
            let at = index.get(key);
            if (at === undefined) {
                at = keys.length;
                index.set(key, at);
                keys.push(key);
                example.push([i, j]);
            }
            rel[i * n + j] = at;
        }
    }

    tableCache = { n, keys, rel, example };
    return tableCache;
}

/** The relations the pool realises, in the order the composition table numbers them. */
export const poolRelations = (): string[] => [...poolTable().keys];

let compositionCache: Int32Array | null = null;

/**
 * Every composition the pool witnesses, as one bitmask per ordered pair of relations.
 *
 * Computed in a single pass rather than per question: for every middle patch, every
 * first and every third, set the bit for what came out. That is the pool cubed —
 * fourteen million steps, a tenth of a second with the relations already tabulated —
 * against a lattice sweep per triple, which is three hours.
 *
 * One word per entry because the calculus has thirty-two relations and a 32-bit
 * integer holds them all, which keeps the sweep's inner statement a single `|=`.
 */
function compositionTable(): Int32Array {
    if (compositionCache) return compositionCache;

    const { n, keys, rel } = poolTable();
    const width = keys.length;
    const table = new Int32Array(width * width);

    for (let b = 0; b < n; b++) {
        const fromB = b * n;
        for (let a = 0; a < n; a++) {
            const row = rel[a * n + b] * width;
            const fromA = a * n;
            for (let c = 0; c < n; c++) {
                table[row + rel[fromB + c]] |= 1 << rel[fromA + c];
            }
        }
    }

    compositionCache = table;
    return table;
}

/**
 * The relations a triple is *witnessed* to allow, given the first two.
 *
 * Sound in the possible direction and only in that direction: every key returned
 * has an actual triple of patches behind it, and the list may be short of the truth.
 * So it is used to say "this one is possible" and never to say "these are all".
 */
export function witnessedComposition(first: string, second: string): string[] {
    const { keys } = poolTable();
    const i = keys.indexOf(first), j = keys.indexOf(second);
    if (i < 0 || j < 0) return [];

    const bits = compositionTable()[i * keys.length + j];
    return keys.filter((_, t) => (bits & (1 << t)) !== 0);
}

/** The patches behind a witnessed composition, for a test or a picture. */
export function witnessTriple(
    first: string, second: string, third: string,
): [Patch, Patch, Patch] | null {
    const { n, keys, rel } = poolTable();
    const pool = concavePool();
    const i = keys.indexOf(first), j = keys.indexOf(second), k = keys.indexOf(third);
    if (i < 0 || j < 0 || k < 0) return null;

    for (let b = 0; b < n; b++) {
        for (let a = 0; a < n; a++) {
            if (rel[a * n + b] !== i) continue;
            for (let c = 0; c < n; c++) {
                if (rel[b * n + c] === j && rel[a * n + c] === k) {
                    return [pool[a], pool[b], pool[c]];
                }
            }
        }
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * The rules: what a chain provably rules out                          *
 * ------------------------------------------------------------------ */

/** `A` is part of `B` — inside it either way, or the same region. */
const INSIDE = [3, 4, 7];
/** `A` holds `B`. */
const HOLDS = [5, 6, 7];
/** `A` is a *proper* part of `B`, which is the case that composes. */
const PROPER_PART = [3, 4];
/** `A` properly holds `B`. */
const PROPER_HOLD = [5, 6];
const IDENTICAL = 7;

/**
 * What a chain provably limits each component of the answer to.
 *
 * `null` means nothing is claimed — not that everything is possible, just that this
 * file will not say. Every entry below is a one-line argument about regions and so
 * holds over the whole domain, which is what makes it usable to *exclude*: the pool
 * cannot prove a negative, and these can.
 *
 * `because` is the argument in words, and the explanation prints it. That is the
 * point of proving rather than tabulating — a composition table can say a relation
 * is impossible but cannot say why, and "why" is the only part worth reading.
 */
export interface Constraint {
    stands: number[] | null;
    inTheirBay: number[] | null;
    theyInMine: number[] | null;
    because: string[];
}

export function provableConstraint(
    first: string,
    second: string,
    a = "the first",
    b = "the second",
    c = "the third",
): Constraint {
    const one = parseKey(first), two = parseKey(second);
    const s1 = one.stands, s2 = two.stands;
    const out: Constraint = { stands: null, inTheirBay: null, theyInMine: null, because: [] };
    const say = (line: string) => out.because.push(line);

    const partOf = (s: number) => INSIDE.includes(s);
    const holdsIt = (s: number) => HOLDS.includes(s);

    if (s1 === IDENTICAL) {
        /* Which is why identical is never a premise: it hands the answer over. */
        out.stands = [s2];
        out.inTheirBay = [two.inTheirBay];
        out.theyInMine = [two.theyInMine];
        say(`${a} and ${b} are the same region, so ${a} stands to ${c} exactly as ${b} does`);
    } else if (s2 === IDENTICAL) {
        out.stands = [s1];
        out.inTheirBay = [one.inTheirBay];
        out.theyInMine = [one.theyInMine];
        say(`${b} and ${c} are the same region, so ${a} stands to ${c} as it stands to ${b}`);
    } else if (PROPER_PART.includes(s1) && PROPER_PART.includes(s2)) {
        /* Part of a part is a part, and one deep step makes the whole chain deep:
           if A lies in B's interior, and B in C, then A lies in C's interior. */
        const deep = s1 === 4 || s2 === 4;
        out.stands = deep ? [4] : [3, 4];
        say(`${a} is within ${b} and ${b} within ${c}, so ${a} is within ${c}`);
        if (deep) say("and one of those steps is <b>deep</b> within, which carries the whole chain");
    } else if (PROPER_HOLD.includes(s1) && PROPER_HOLD.includes(s2)) {
        const deep = s1 === 6 || s2 === 6;
        out.stands = deep ? [6] : [5, 6];
        say(`${a} holds ${b} and ${b} holds ${c}, so ${a} holds ${c}`);
        if (deep) say("and one of those steps holds <b>deep</b>, which carries the whole chain");
    } else if (partOf(s1) && s2 === 0) {
        out.stands = [0];
        say(`${a} is within ${b}, and ${b} shares no point with ${c}, so neither does ${a}`);
    } else if (holdsIt(s2) && s1 === 0) {
        out.stands = [0];
        say(`${c} is within ${b}, and ${a} shares no point with ${b}, so neither does ${c}`);
    } else if (s1 === 4 && s2 === 1) {
        /* Touching leaves the interiors disjoint, and a region is the closure of its
           interior — so C reaches no part of B's interior, and A is inside it. */
        out.stands = [0];
        say(`${a} lies in ${b}'s interior, and ${c} meets ${b} only at its boundary, `
            + `so ${c} never reaches ${a}`);
    } else if (s1 === 3 && s2 === 1) {
        out.stands = [0, 1];
        say(`${a} lies within ${b} but reaches its boundary, and ${c} meets ${b} only `
            + `there — so ${a} and ${c} can meet at that boundary and nowhere else`);
    } else if (s1 === 1 && s2 === 6) {
        out.stands = [0];
        say(`${c} lies in ${b}'s interior, and ${a} meets ${b} only at its boundary, `
            + `so ${a} never reaches ${c}`);
    } else if (s1 === 1 && s2 === 5) {
        out.stands = [0, 1];
        say(`${c} lies within ${b} but reaches its boundary, and ${a} meets ${b} only `
            + `there — so they can meet at that boundary and nowhere else`);
    } else if (PROPER_HOLD.includes(s1) && PROPER_PART.includes(s2)) {
        /* Both contain B, so both contain its interior, so their interiors meet:
           whatever else they do, they are not apart and not merely touching. */
        out.stands = [2, 3, 4, 5, 6, 7];
        say(`${b} lies within both ${a} and ${c}, so their interiors overlap — `
            + "they cannot be apart, nor meet only at a boundary");
    }

    /*
     * The bays, which are where this calculus says more than RCC8 does.
     *
     * Same argument each time, and it is the only one available: anything true of
     * the whole of `B` is true of every part of `B`. So a part of `B` inherits `B`'s
     * standing to a bay when that standing is "clear of" — and inherits "lying in"
     * too, but only when `B` is nowhere near the other patch itself, since otherwise
     * the part might sit in the patch rather than in its bay.
     */
    if (partOf(s1) && two.inTheirBay === 0) {
        out.inTheirBay = [0];
        say(`${b} is clear of ${c}'s bay and ${a} is within ${b}, so ${a} is clear of it too`);
    }
    if (partOf(s1) && s2 === 0 && two.inTheirBay === 2) {
        out.inTheirBay = [2];
        say(`${b} lies wholly in ${c}'s bay and ${a} is within ${b}, so ${a} lies in it too`);
    }
    if (holdsIt(s2) && one.theyInMine === 0) {
        out.theyInMine = [0];
        say(`${b} is clear of ${a}'s bay and ${c} is within ${b}, so ${c} is clear of it too`);
    }
    if (holdsIt(s2) && s1 === 0 && one.theyInMine === 2) {
        out.theyInMine = [2];
        say(`${b} lies wholly in ${a}'s bay and ${c} is within ${b}, so ${c} lies in it too`);
    }

    /* And a region's own parts are never in its bay: the bay is what the region is
       not. Implied by the standing already established, so it needs no premise. */
    if (out.stands && out.stands.every(partOf)) out.inTheirBay = [0];
    if (out.stands && out.stands.every(holdsIt)) out.theyInMine = [0];

    return out;
}

/** Whether a relation survives what the chain provably limits. */
export function constraintAllows(c: Constraint, key: string): boolean {
    const r = parseKey(key);
    return (!c.stands || c.stands.includes(r.stands))
        && (!c.inTheirBay || c.inTheirBay.includes(r.inTheirBay))
        && (!c.theyInMine || c.theyInMine.includes(r.theyInMine));
}

/** Whether a chain is one the rules say anything at all about. */
export const constrains = (c: Constraint) =>
    c.stands !== null || c.inTheirBay !== null || c.theyInMine !== null;

/* ------------------------------------------------------------------ *
 * The menu: a short list of exactly the hard cases                    *
 * ------------------------------------------------------------------ */

/**
 * One composition question: the options to offer, and which of them hold.
 *
 * ── Why the reader and the marker agree ──
 *
 * The task the card sets is "rule out every relation these two premises forbid,
 * and select what is left". Every option is either witnessed by an actual triple of
 * patches or excluded by a rule, and nothing else is offered — so the reader's
 * reading of the item and the marked answer are the same set, with no gap for a
 * relation that is neither provably out nor demonstrably in. A reader who rules out
 * a witnessed option has made a mistake, because the patches exist; a reader who
 * keeps an excluded one has missed an argument the explanation then gives them.
 *
 * ── The menu is the answer's neighbourhood ──
 *
 * Thirty-two relations is far more than a card can show, and showing a sample of
 * them would make most items easy for the wrong reason — an option about
 * containment when the premises are about contact is dismissed without being
 * thought about. So the menu is the closest relations to one of the answers by
 * topological distance: the number of cells two intersection matrices differ in,
 * which is the paper's own measure of how nearly alike two relations are. Every
 * option is then a relation that very nearly holds, and none of them can be
 * dropped at a glance.
 */
export interface CompositionItem {
    /** The relations to offer, nearest the focus first. */
    options: string[];
    /** Those of them a triple of patches witnesses. */
    possible: string[];
    /** What the rules prove about the chain, and why. */
    constraint: Constraint;
}

/** Candidates ordered by how nearly alike they are to `focus`. */
function byNearness(focus: string, candidates: string[]): string[] {
    return [...candidates]
        .map(key => ({ key, d: key === focus ? -1 : relationDistance(focus, key) }))
        .sort((p, q) => p.d - q.d || (p.key < q.key ? -1 : 1))
        .map(x => x.key);
}

/**
 * The item for one chain, or null when this chain cannot make one.
 *
 * A chain is unusable when the rules say nothing about it — then every relation on
 * the menu would be one the card has no argument against — or when the neighbourhood
 * of the answer happens to hold no excluded relation, which makes "select every one
 * still possible" mean "select all of them".
 */
export function compositionItem(
    first: string,
    second: string,
    size: number,
    /**
     * Which of the witnessed answers the menu is drawn around.
     *
     * A parameter rather than always the first, because it is the one place the
     * mode's supply of items widens for free: the same chain has a different
     * neighbourhood around each of its answers, so a chain with three of them makes
     * three different questions out of one piece of reasoning.
     */
    focusAt = 0,
): CompositionItem | null {
    const constraint = provableConstraint(first, second);
    if (!constrains(constraint)) return null;

    const witnessed = witnessedComposition(first, second);
    const focus = witnessed[focusAt];
    if (!focus) return null;

    /* Only relations something can be proved about. The rest are left out rather
       than guessed at — that is what keeps the marked answer honest. */
    const excluded = poolRelations().filter(k => !constraintAllows(constraint, k));
    if (excluded.length < 1) return null;

    const options = byNearness(focus, [...witnessed, ...excluded]).slice(0, size);
    const possible = options.filter(k => witnessed.includes(k));

    /* Both halves have to be on the menu, or the item is "select all" or "select
       none" — which is one bit of evidence dressed up as several. */
    if (!possible.length || possible.length === options.length) return null;
    if (options.length < 3) return null;

    return { options, possible, constraint };
}

/** A chain, and which of its answers the menu is built around. */
export interface Chain { first: string; second: string; focusAt: number; }

const chainCache = new Map<number, Chain[]>();

/**
 * Every chain that makes a well-formed item of this size.
 *
 * Worked out once rather than searched per question: the generator would otherwise
 * draw pairs of relations at random and throw most of them away, and the count is
 * worth having anyway — a mode whose supply of items is forty is a different mode
 * from one whose supply is four hundred, and only a sweep says which this is.
 *
 * `identical to` is barred from both premises. It is not that the composition is
 * wrong — it is that the answer is then the *other* premise copied out, which is a
 * card that looks like composition and is transcription.
 */
export function usableChains(size: number): Chain[] {
    const held = chainCache.get(size);
    if (held) return held;

    const keys = poolRelations().filter(k => parseKey(k).stands !== IDENTICAL);
    const found: Chain[] = [];
    for (const first of keys) {
        for (const second of keys) {
            const answers = witnessedComposition(first, second).length;
            for (let focusAt = 0; focusAt < answers; focusAt++) {
                if (compositionItem(first, second, size, focusAt)) {
                    found.push({ first, second, focusAt });
                }
            }
        }
    }

    chainCache.set(size, found);
    return found;
}
