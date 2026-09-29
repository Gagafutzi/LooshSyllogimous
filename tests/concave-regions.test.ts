/**
 * Concave regions — the distinctions RCC8 cannot make, and their limiter.
 *
 * The relations here are not transcribed from a list; they are *derived* from three
 * named components and then discovered by sweeping the domain. So the checks are
 * not "does this match the paper" — the paper's relation lists are figures this
 * file cannot read — but the two things that make a derived calculus trustworthy:
 * that the components mean what they say, and that the set really contains the
 * distinction the whole exercise is for.
 *
 * That last one is not decoration. The first version of this substrate realised
 * twenty-five relations and *not* "apart, lying in the other's bay" — the one case
 * RCC8 cannot express — because an integer bay flush with one edge needs its host
 * at least two across and three deep, so nesting needed more room than the lattice
 * had. A domain too small to express the thing being taught is worse than no
 * domain, and it looked entirely healthy from the outside.
 */

import { assert, equal, test } from "./harness";
import {
    BAY, BAY_STANDING, BODY, EDGE, OUTSIDE, Patch, SPAN, STANDING, describeRelation,
    isPatch, maskDistance, meetings, nearestRelations, parseKey, partAt, patchInBay,
    randomPatch, realised, relationDistance, relationKey, relationOf, roomyPatch,
    standing,
} from "../src/app/syllogimous/utils/concave-regions.utils";

/** A deterministic generator, so a failure here is a failure every time. */
function rng(seed: number) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 0x100000000;
    };
}

const sample = (count: number, seed = 20261601) => {
    const random = rng(seed);
    const out: Patch[] = [];
    while (out.length < count) {
        const p = randomPatch(random);
        if (p) out.push(p);
    }
    return out;
};

/**
 * A bay on exactly one edge, which is what "simple concave" means.
 *
 * None makes it a hole, and a region with a hole is not simply connected — a
 * different calculus. Two or more either cuts the patch in half or gives it a
 * second concavity, which is the case "simple" excludes.
 */
test("a patch has a bay on one edge and only one", () => {
    const base = { x1: 0, x2: 4, y1: 0, y2: 6 };
    /* Flush with the left edge only: well formed. */
    assert(isPatch({ ...base, bx1: 0, bx2: 2, by1: 2, by2: 4 }),
        "a bay flush with one edge and clear of the others was rejected");
    /* Clear of every edge: a hole. */
    assert(!isPatch({ ...base, bx1: 1, bx2: 3, by1: 2, by2: 4 }),
        "a bay touching no edge is a hole, and was accepted as a bay");
    /* Flush with two: cuts across, or leaves two concavities. */
    assert(!isPatch({ ...base, bx1: 0, bx2: 4, by1: 2, by2: 4 }),
        "a bay spanning the whole width cuts the patch in two, and was accepted");
    assert(!isPatch({ ...base, bx1: 0, bx2: 2, by1: 0, by2: 4 }),
        "a bay flush with two edges was accepted");
    /* Degenerate extents. */
    assert(!isPatch({ ...base, bx1: 2, bx2: 2, by1: 2, by2: 4 }),
        "a bay of no width was accepted");
});

test("every patch really has all four parts", () => {
    for (const p of sample(200)) {
        const seen = new Set<number>();
        for (let px = -2; px <= 2 * SPAN + 2; px++) {
            for (let py = -2; py <= 2 * SPAN + 2; py++) seen.add(partAt(p, px, py));
        }
        equal([...seen].sort(), [OUTSIDE, EDGE, BODY, BAY].sort(),
            `a patch is missing a part: ${JSON.stringify(p)} — a bay with no inside, or `
            + "a body with no room, is not a concave region");
    }
});

/**
 * Read backwards, a relation is its own converse.
 *
 * `inside` and `holds` trade places, everything else stays put. This is the check
 * that catches a containment test written the wrong way round, which is otherwise
 * invisible: the relation is still one of the eight and still plausible.
 */
test("the standing of two patches reverses when they are swapped", () => {
    const CONVERSE = [0, 1, 2, 5, 6, 3, 4, 7];
    const all = sample(90, 20261602);
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            const there = standing(meetings(all[i], all[j]));
            const back = standing(meetings(all[j], all[i]));
            equal(STANDING[CONVERSE[there]], STANDING[back],
                `"${STANDING[there]}" read the other way round is not "${STANDING[back]}"`);
        }
    }
});

/**
 * And the bay components swap with them.
 *
 * `bayStanding` takes a flag rather than swapped arguments, which is exactly the
 * kind of shortcut that ends up reading the same side twice.
 */
test("each patch's place in the other's bay reverses too", () => {
    const all = sample(90, 20261603);
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            const there = relationOf(meetings(all[i], all[j]));
            const back = relationOf(meetings(all[j], all[i]));
            equal(BAY_STANDING[there.inTheirBay], BAY_STANDING[back.theyInMine],
                "where the first sits in the second's bay is not where the second is "
                + "reported to see it");
            equal(BAY_STANDING[there.theyInMine], BAY_STANDING[back.inTheirBay],
                "the two bay components are not each other's mirror");
        }
    }
});

/**
 * The domain expresses the thing it exists to express.
 *
 * Three relations are `apart` as regions, and RCC8 has one word for all three. A
 * patch nestling in another's hollow and a patch on the far side of the plane are
 * the same relation to RCC8 and could not be less alike. If only one of the three
 * is realisable the calculus has nothing to teach that RCC8 does not.
 */
test("the domain realises the distinction RCC8 cannot make", () => {
    const found = realised();
    for (const key of ["0:0:0", "0:2:0", "0:0:2"]) {
        assert(found.has(key),
            `${key} — ${describeRelation(parseKey(key), "A", "B")} — is not realisable, so `
            + "the domain cannot express what RCC8 misses");
    }
    const apart = [...found.keys()].filter(k => k.startsWith("0:"));
    assert(apart.length >= 3,
        `only ${apart.length} of the relations are "apart" as regions, and RCC8 has one `
        + "word for all of them");

    /* And they really are indistinguishable without the bay components. */
    const stands = new Set(apart.map(k => parseKey(k).stands));
    equal([...stands], [0],
        "the three are not all the same RCC8 relation, so the example is not the one");
});

/**
 * A law the sweep found rather than one anybody wrote down.
 *
 * A patch deep inside another cannot be clear of its bay: being strictly within the
 * other's body means the other's body fills its hollow. So `deep inside, clear of
 * the bay` is not a relation that exists, and a card offering it could never mark
 * it. Worth pinning because it is the kind of thing a later change to the
 * containment test would quietly break.
 */
test("a patch deep inside another is never clear of its bay", () => {
    const found = realised();
    assert(!found.has("4:0:0"),
        "`deep inside, clear of the bay` is reported realisable — a patch strictly "
        + "within another's body has that body filling its own hollow");
    assert(found.has("4:0:1") || found.has("4:0:2"),
        "no `deep inside` relation is realisable at all, so containment is broken "
        + "rather than merely constrained");
});

test("every relation is named, and no two share a name", () => {
    const found = realised();
    assert(found.size > 20, `only ${found.size} relations — the domain has collapsed`);
    const names = new Map<string, string>();
    for (const key of found.keys()) {
        const r = parseKey(key);
        equal(relationKey(r), key, `${key} does not survive being parsed and rebuilt`);
        const said = describeRelation(r, "A", "B");
        assert(!!said && said.includes("A") && said.includes("B"),
            `${key} has no readable name: ${said}`);
        assert(!names.has(said),
            `${key} and ${names.get(said)} are both called "${said}"`);
        names.set(said, key);
    }
});

/* ------------------------------------------------------------------ *
 * The limiter                                                         *
 * ------------------------------------------------------------------ */

/**
 * The shortlist is the nearest relations, and it is short.
 *
 * This is the whole reason a calculus of thirty-two relations can go on a card:
 * the answer plus its nearest neighbours, where "nearest" is the number of cells
 * two intersection matrices differ in. Chosen by measurement, not by anybody's
 * judgement of what looks confusable — which is what makes it scale to a
 * refinement with sixty of them.
 */
test("the option shortlist is the nearest relations, closest first", () => {
    const keys = [...realised().keys()];
    for (const key of keys) {
        const near = nearestRelations(key, 3);
        equal(near.length, 3, `${key} cannot fill a shortlist of three`);
        assert(!near.includes(key), `${key} is offered as its own neighbour`);
        equal(new Set(near).size, near.length, `${key}'s shortlist repeats a relation`);

        const ds = near.map(other => relationDistance(key, other));
        equal(ds, [...ds].sort((a, b) => a - b),
            `${key}'s shortlist is not ordered by distance: ${ds.join(", ")}`);

        /* Nothing left out that is nearer than something taken. */
        const worst = ds[ds.length - 1];
        for (const other of keys) {
            if (other === key || near.includes(other)) continue;
            assert(relationDistance(key, other) >= worst,
                `${other} is nearer to ${key} than one of the three offered`);
        }
    }
});

test("distance is symmetric, zero only for a relation and itself", () => {
    const keys = [...realised().keys()];
    for (const a of keys) {
        equal(relationDistance(a, a), 0, `${a} is not at distance nought from itself`);
        for (const b of keys) {
            equal(relationDistance(a, b), relationDistance(b, a),
                `${a} and ${b} are different distances apart depending which is asked`);
            if (a !== b) {
                assert(relationDistance(a, b) > 0,
                    `${a} and ${b} are distinct relations with no matrix between them`);
            }
        }
    }
    equal(maskDistance(0b0101, 0b0011), 2, "the cell count itself is wrong");
});

test("a patch placed in a bay really lies in it", () => {
    const random = rng(20261604);
    let placed = 0;
    for (let attempt = 0; attempt < 400; attempt++) {
        /* A host built with room, not one drawn and hoped over — see `roomyPatch`. */
        const host = roomyPatch(random);
        if (!host) continue;
        const inner = patchInBay(host, random);
        if (!inner) continue;
        placed++;
        equal(relationKey(relationOf(meetings(inner, host))), "0:2:0",
            `a patch built to lie in ${JSON.stringify(host)}'s bay came out as `
            + describeRelation(relationOf(meetings(inner, host)), "inner", "host"));
    }
    assert(placed > 200,
        `only ${placed} of 400 patches were placed in a bay — a generator cannot build `
        + "a card at that rate, which is what `roomyPatch` exists to fix");
});
