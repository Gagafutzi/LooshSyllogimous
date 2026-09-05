/**
 * Scramble as the schedule of merges, not as a fragment count.
 *
 * `scrambleByFactor` grades the load by how many adjacent pairs survive, which
 * is a proxy for how many unjoined fragments have to be carried. That is
 * storage, and maximising it is a way of reading working memory at full stretch
 * rather than of asking a harder question — at a hundred it is already at its
 * maximum and says nothing about what any single premise has to do.
 *
 * The demand worth grading is the seam: an item that builds two substantial
 * structures apart and then folds them into one settles every pair across the
 * join at once. That is almost entirely a function of the order, so the order
 * is where it should be set.
 */

import { assert, equal, seeded, test } from "./harness";
import { integrationLoad } from "../src/app/syllogimous/utils/integration.utils";
import {
    orderPremises, scheduleForMerge,
} from "../src/app/syllogimous/utils/premise-order.utils";

const s = (name: string) => `<span class="subject">${name}</span>`;
const p = (a: string, b: string) =>
    `${s(a)} <span class="relation">is above</span> ${s(b)}`;

/** A chain of eight objects, stated in order. */
const CHAIN = ["A", "B", "C", "D", "E", "F", "G", "H"]
    .slice(0, -1)
    .map((from, i) => p(from, ["A", "B", "C", "D", "E", "F", "G", "H"][i + 1]));

const settled = (order: string[]) => integrationLoad(order).pairsSettled;

test("a chain read in order settles no more than its own length", () => {
    equal(settled(CHAIN), CHAIN.length,
        "reading a chain end to end should settle one pair per object placed");
});

test("aiming high finds an order that folds two halves together", () => {
    const high = seeded(31, () =>
        scheduleForMerge(CHAIN, 100, settled));
    assert(settled(high) > settled(CHAIN) * 2,
        `the chain settles ${settled(CHAIN)} in order and the schedule only`
        + ` reached ${settled(high)}`);
});

test("aiming low leaves it near the sequential reading", () => {
    const low = seeded(31, () => scheduleForMerge(CHAIN, 0, settled));
    const high = seeded(31, () => scheduleForMerge(CHAIN, 100, settled));
    assert(settled(low) < settled(high),
        `low ${settled(low)} should be under high ${settled(high)}`);
    assert(settled(low) <= settled(CHAIN) + 2,
        `aiming at nothing should stay near the sequential ${settled(CHAIN)},`
        + ` and reached ${settled(low)}`);
});

test("the middle of the dial lands between the two ends", () => {
    seeded(77, () => {
        const low = settled(scheduleForMerge(CHAIN, 0, settled));
        const mid = settled(scheduleForMerge(CHAIN, 50, settled));
        const high = settled(scheduleForMerge(CHAIN, 100, settled));
        assert(mid >= low && mid <= high,
            `${mid} is outside the range ${low}..${high} the dial spans`);
    });
});

test("every premise is kept, and none is invented", () => {
    seeded(5, () => {
        const out = scheduleForMerge(CHAIN, 70, settled);
        equal(out.length, CHAIN.length, "the schedule changed how many premises there are");
        equal(out.slice().sort().join("|"), CHAIN.slice().sort().join("|"),
            "the schedule changed which premises there are");
    });
});

test("two premises are left alone, having no order worth choosing", () => {
    const two = CHAIN.slice(0, 2);
    equal(scheduleForMerge(two, 100, settled).join("|"), two.join("|"),
        "a pair was reordered for no reason");
});

/* ------------------------------------------------------------------ *
 * Which rule applies                                                  *
 * ------------------------------------------------------------------ */

test("the whole card keeps the adjacency grading it always had", () => {
    seeded(9, () => {
        const flat = orderPremises(CHAIN, 100, null);
        equal(flat.length, CHAIN.length, "premises were lost");
        // Nothing to assert about the order beyond it being a permutation: the
        // point is that the merge schedule was not applied.
        equal(flat.slice().sort().join("|"), CHAIN.slice().sort().join("|"),
            "the adjacency scramble changed which premises there are");
    });
});

test("one at a time schedules the merges instead", () => {
    const paged = seeded(9, () => orderPremises(CHAIN, 100, 100));
    const flat = seeded(9, () => orderPremises(CHAIN, 100, null));
    assert(settled(paged) > settled(flat),
        `paged settled ${settled(paged)} against ${settled(flat)} for the whole`
        + " card, so the schedule is not being chosen for the seam");
});
