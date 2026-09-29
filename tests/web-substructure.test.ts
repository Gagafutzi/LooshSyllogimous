/**
 * Sub-structure over the arrow webs: induced subgraphs, motifs, common parts.
 *
 * Four imported modes rest on these four functions, so a defect here is a defect
 * in four cards at once and in the kind of way that reads as plausible: a group
 * that nearly stands to itself as the pattern does, a "largest" common part that
 * is merely *a* common part. Both would produce items that look right and mark a
 * correct reader wrong.
 *
 * The checks are therefore about the words on the cards rather than about the
 * code. "Induced" means every arrow between the chosen nodes and no others.
 * "Largest" means no bigger group matches anywhere. "Exactly one" means the
 * search found one, not that the first one found was kept.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    Web, cloneWeb, edgesOf, emptyWeb, induced, isomorphic, largestCommon, mappings,
    motifSites, oddPairs, permuteWeb, randomPermutation, randomWeb, subsets,
} from "../src/app/syllogimous/utils/web.utils";

const choose = (n: number, k: number) => {
    let out = 1;
    for (let i = 0; i < k; i++) out = (out * (n - i)) / (i + 1);
    return Math.round(out);
};

test("the subsets of a web are every group of that size, once each", () => {
    for (let n = 1; n <= 8; n++) {
        for (let k = 1; k <= n; k++) {
            const all = subsets(n, k);
            equal(all.length, choose(n, k), `subsets(${n}, ${k}) is not C(${n}, ${k})`);
            equal(new Set(all.map(s => s.join(","))).size, all.length,
                "a group is listed twice");
            for (const s of all) {
                equal(s.length, k, "a group is the wrong size");
                equal([...s].sort((a, b) => a - b), s, "a group is not in ascending order");
                equal(new Set(s).size, k, "a group repeats a node");
            }
        }
    }
});

/**
 * Induced means every arrow between them, and none that is not.
 *
 * The half that matters is "and none that is not". A sub-structure that only had
 * to *contain* the pattern's arrows would let a group carry extra arrows among
 * its own members and still be reported as standing to itself the way the
 * pattern does — so a card would name three entities whose relations are not the
 * pattern's, and be right about nothing.
 */
test("an induced web carries exactly the arrows between its own nodes", () => {
    seeded(4242, () => {
        for (let rep = 0; rep < 200; rep++) {
            const host = randomWeb(6, 0.35);
            const pick = subsets(6, 3)[Math.floor(Math.random() * choose(6, 3))];
            const sub = induced(host, pick);
            equal(sub.n, pick.length, "the induced web is the wrong size");
            for (let i = 0; i < pick.length; i++) {
                for (let j = 0; j < pick.length; j++) {
                    equal(sub.adj[i][j], host.adj[pick[i]][pick[j]],
                        `arrow ${i}->${j} does not match the host's ${pick[i]}->${pick[j]}`);
                }
            }
        }
    });
});

test("inducing on every node gives the web back", () => {
    seeded(4243, () => {
        for (let rep = 0; rep < 50; rep++) {
            const w = randomWeb(5, 0.4);
            const same = induced(w, [...Array(5).keys()]);
            equal(same.adj, w.adj, "a web is not its own induced sub-web on every node");
        }
    });
});

/**
 * A group really does stand to itself the way the pattern does.
 *
 * Checked both ways round: a group cut out of the host is found as a site of its
 * own shape, and every site reported is isomorphic to the pattern. The first
 * direction catches a search that prunes too hard, the second one that prunes
 * too little.
 */
test("every group cut from a web is a site of its own shape, and every site fits", () => {
    seeded(4244, () => {
        for (let rep = 0; rep < 120; rep++) {
            const host = randomWeb(6, 0.3);
            const pick = subsets(6, 3)[Math.floor(Math.random() * choose(6, 3))];
            const pattern = induced(host, pick);

            const sites = motifSites(host, pattern);
            assert(sites.some(s => s.join(",") === pick.join(",")),
                `the group ${pick} was cut out of the host and is not found in it`);
            for (const site of sites) {
                assert(isomorphic(induced(host, site), pattern),
                    `${site} is reported as a site and does not fit the pattern`);
            }
            equal(new Set(sites.map(s => s.join(","))).size, sites.length,
                "a site is reported twice, so a pattern's own symmetry is being counted");
        }
    });
});

/**
 * The common part is the largest one, not merely a shared one.
 *
 * "No larger group does" is printed on the card the mode builds, so it is
 * checked here by looking: every group one larger, on both sides, must fail.
 */
test("the largest common part leaves nothing larger to find", () => {
    seeded(4245, () => {
        for (let rep = 0; rep < 60; rep++) {
            const a = randomWeb(5, 0.3);
            const b = randomWeb(5, 0.3);
            const found = largestCommon(a, b);
            if (!found.length) continue;

            const size = found[0].inA.length;
            for (const pair of found) {
                equal(pair.inA.length, size, "the pairs found are not all the same size");
                equal(pair.inB.length, size, "the two sides of a pair differ in size");
                assert(isomorphic(induced(a, pair.inA), induced(b, pair.inB)),
                    "a reported pair is not the same shape on both sides");
            }

            const bigger = size + 1;
            if (bigger > Math.min(a.n, b.n) - 1) continue;
            for (const inA of subsets(a.n, bigger)) {
                for (const inB of subsets(b.n, bigger)) {
                    assert(!isomorphic(induced(a, inA), induced(b, inB)),
                        `${inA} and ${inB} share a larger structure than the ${size} `
                        + "reported, so the card's \"no larger group\" is false");
                }
            }
        }
    });
});

/**
 * Leave one out of each and the rest match — *every* such pair, not one of them.
 *
 * Returning all of them is the point rather than a convenience. The mode built on
 * this asks "which entity has no counterpart", so it can only ship an item where
 * exactly one pair works; a search that stopped at the first would report one
 * pair for a web with a symmetry and the mode would mark one of several right
 * answers wrong, with nothing in the item looking amiss.
 *
 * So this does not check the pairs found are valid — it checks the list is the
 * whole list, against an independent walk over every pair. Asserting validity
 * alone passed against a search truncated to its first hit.
 */
test("the odd pairs are every pair whose removal leaves the same shape", () => {
    seeded(4246, () => {
        let withAny = 0, withSeveral = 0;
        for (let rep = 0; rep < 150; rep++) {
            const base = randomWeb(6, 0.3);
            const a = cloneWeb(base);
            const b = permuteWeb(base, randomPermutation(6));

            /* One node on each side rewired, so the rest of both webs is still
               the same structure and at least that pair must work. */
            const i = Math.floor(Math.random() * 6);
            const j = Math.floor(Math.random() * 6);
            for (let k = 0; k < 6; k++) if (k !== i) a.adj[i][k] = Math.random() < 0.5;
            for (let k = 0; k < 6; k++) if (k !== j) b.adj[j][k] = Math.random() < 0.5;

            const keep = (w: Web, drop: number) =>
                induced(w, [...Array(w.n).keys()].filter(k => k !== drop));

            /* The whole truth, walked here rather than asked for. */
            const expected: string[] = [];
            for (let x = 0; x < 6; x++) {
                for (let y = 0; y < 6; y++) {
                    if (isomorphic(keep(a, x), keep(b, y))) expected.push(`${x},${y}`);
                }
            }

            const got = oddPairs(a, b).map(([x, y]) => `${x},${y}`);
            equal(got.slice().sort(), expected.slice().sort(),
                "the odd pairs found are not every pair whose removal leaves the same "
                + "shape — an item with several would be shipped as though it had one");

            if (expected.length) withAny++;
            if (expected.length > 1) withSeveral++;
        }
        assert(withAny > 30,
            `only ${withAny} of 150 rewired webs had any odd pair at all, so the walk `
            + "is not exercising the search");
        assert(withSeveral > 5,
            `only ${withSeveral} of 150 had more than one odd pair, so "every pair" is `
            + "never actually tested against a case with several");
    });
});

/**
 * An empty web and a full one are the extremes, and both behave.
 *
 * Not a hypothetical: `randomWeb` with a low density produces webs with no
 * arrows at all, and every group of the same size in an arrowless web is a site.
 * A search that special-cased "no arrows" as "no match" would make those items
 * silently unbuildable rather than wrong.
 */
test("a web with no arrows has every group as a site", () => {
    const host = emptyWeb(5);
    equal(edgesOf(host).length, 0, "the empty web has an arrow");
    equal(motifSites(host, emptyWeb(3)).length, choose(5, 3),
        "an arrowless pattern does not sit on every group of an arrowless web");
    equal(mappings(emptyWeb(3), emptyWeb(3)).length, 6,
        "the arrowless triangle does not have all six relabellings as symmetries");
});
