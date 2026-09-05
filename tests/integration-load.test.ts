/**
 * How much of an item has to be held at once.
 *
 * Three numbers the difficulty model has never seen, all of them properties of
 * the *order* the premises are shown in rather than of the layout behind them.
 * Scramble decides all three and measures none.
 *
 * The one worth being careful about is `integration`. Counting the groups a
 * premise welds conflates two different things: a premise naming three objects
 * welds three groups when all three are new, which introduces them and
 * integrates nothing, and welds three when each was already part of something
 * held, which is the demand worth training. Order decides which — so a dial
 * that targeted the naive count could be satisfied by scheduling the easy case,
 * which is the cheapest possible way to hit it.
 */

import { assert, equal, test } from "./harness";
import { integrationLoad, subjectsOf } from "../src/app/syllogimous/utils/integration.utils";
import { pricedPremises } from "../src/app/syllogimous/utils/ability.utils";

const s = (name: string) => `<span class="subject">${name}</span>`;
/** A premise as the card renders one: subjects, with relation text between. */
const p = (...names: string[]) =>
    names.map(n => s(n)).join(` <span class="relation">is above</span> `);

test("a chain read in order carries one structure and welds two groups", () => {
    const load = integrationLoad([p("A", "B"), p("B", "C"), p("C", "D")]);
    equal(load.arity, 2, "a two-object premise welded more than two groups");
    equal(load.openGroups, 1, "reading a chain in order should carry one structure");
    equal(load.integration, 1,
        "each step joins one held structure to a new name, not two structures");
});

test("a scrambled chain carries several structures and joins two of them", () => {
    // A-B and C-D are built apart, then B-C bridges them.
    const load = integrationLoad([p("A", "B"), p("C", "D"), p("B", "C")]);
    equal(load.openGroups, 2, "two fragments were open before the bridge");
    equal(load.integration, 2, "the bridge joined two structures already held");
    equal(load.arity, 2, "still a two-object premise");
});

/* ------------------------------------------------------------------ *
 * The distinction the naive count misses                              *
 * ------------------------------------------------------------------ */

test("three fresh names are an introduction, not an integration", () => {
    // One premise naming three objects, arriving first.
    const load = integrationLoad([p("A", "B", "C")]);
    equal(load.arity, 3, "three objects should weld three groups");
    equal(load.integration, 0,
        "nothing was held yet, so nothing was integrated — this is the case a"
        + " dial on the naive count would be satisfied by");
});

test("the same premise late joins structures already held", () => {
    const load = integrationLoad([
        p("A", "W"), p("B", "X"), p("C", "Y"),   // three fragments
        p("A", "B", "C"),                        // and one premise joining them
    ]);
    equal(load.arity, 3, "three objects, three groups");
    equal(load.integration, 3, "all three were structures, not fresh names");
    equal(load.openGroups, 3, "three fragments were open before the join");
});

/**
 * One is an extension — a held structure gaining a name — and two or more is a
 * join. That threshold is where the measure earns its keep, and it moves under
 * reordering alone while `arity` does not move at all.
 */
test("order alone moves integration without moving arity", () => {
    const early = integrationLoad([p("A", "B", "C"), p("A", "W"), p("B", "X")]);
    const late = integrationLoad([p("A", "W"), p("B", "X"), p("A", "B", "C")]);
    equal(early.arity, late.arity, "the premises are the same, so arity is");
    equal(early.integration, 1,
        "arriving first it introduced three names; everything after it only"
        + " extended the one structure that made");
    equal(late.integration, 2,
        "arriving last, the same premise joined two structures already held");
});

/* ------------------------------------------------------------------ *
 * What must not be counted                                            *
 * ------------------------------------------------------------------ */

test("a premise restating a settled pair welds nothing", () => {
    const load = integrationLoad([p("A", "B"), p("B", "C"), p("A", "C")]);
    equal(load.arity, 2, "the closing premise should not raise arity");
    equal(load.openGroups, 1, "and it should not open a structure either");
});

test("a line naming fewer than two objects is skipped", () => {
    const load = integrationLoad([
        `every coordinate of ${s("A")} is set to that of it`.replace(/ it$/, ""),
        p("A", "B"),
    ]);
    equal(load.arity, 2, "a one-object line was counted as a weld");
});

test("subjects are read from the span the card actually uses", () => {
    equal(subjectsOf(p("Kiwi", "Doll")).join(","), "Kiwi,Doll",
        "the subject span shape is a contract and this reader missed it");
    equal(subjectsOf("no spans here").length, 0, "text with no subjects named some");
});

/* ------------------------------------------------------------------ *
 * Which premise count describes the item                              *
 * ------------------------------------------------------------------ */

/**
 * Wide premises merge two consecutive links into one sentence, so a seven-link
 * item prints about four. Pricing the printed count prices a different item —
 * and because the posterior and the next configuration both read the same
 * number, the error never surfaces as a wrong answer. It settles at roughly
 * half true ability and serves items to match, quietly, for as long as it runs.
 */
test("an item is priced by what it was built from, not what it printed", () => {
    equal(pricedPremises({ builtPremises: 7, premises: new Array(4) }), 7,
        "a wide item was priced at its printed length");
    equal(pricedPremises({ builtPremises: 5, premises: new Array(5) }), 5,
        "an ordinary item should price the same either way");
});

test("an item from before the count was recorded falls back to the printed one", () => {
    equal(pricedPremises({ premises: new Array(4) }), 4,
        "history written before this field lost its premise count");
    equal(pricedPremises({ builtPremises: 0, premises: new Array(4) }), 4,
        "zero means unrecorded, not an item with no premises");
});

/* ------------------------------------------------------------------ *
 * How much of the map one premise settles                             *
 * ------------------------------------------------------------------ */

/**
 * The count of groups joined is blind to their size, and size is most of the
 * demand. Joining two pairs and joining two six-object structures both weld two
 * groups, and they are nothing like the same thing to hold: the hard case is
 * several *large* structures meeting, where everything across the seam becomes
 * determined at once.
 */
test("a chain read in order settles no more than its own length", () => {
    const load = integrationLoad([p("A", "B"), p("B", "C"), p("C", "D"), p("D", "E")]);
    equal(load.pairsSettled, 4,
        "extending a four-object chain by one settles four pairs, one per object"
        + " already placed");
    equal(load.integration, 1, "and joins one structure to a fresh name");
});

test("joining two structures settles the whole seam between them", () => {
    // Two chains of three built apart, then bridged.
    const load = integrationLoad([
        p("A", "B"), p("B", "C"),
        p("X", "Y"), p("Y", "Z"),
        p("C", "X"),
    ]);
    equal(load.integration, 2, "the bridge joins two structures already held");
    equal(load.pairsSettled, 9,
        "three against three is nine pairs settled by one premise");
});

test("the same number of groups can be worth very different amounts", () => {
    const small = integrationLoad([p("A", "B"), p("X", "Y"), p("B", "X")]);
    const large = integrationLoad([
        p("A", "B"), p("B", "C"), p("C", "D"),
        p("W", "X"), p("X", "Y"), p("Y", "Z"),
        p("D", "W"),
    ]);
    equal(small.integration, large.integration,
        "both join two structures, which is why the count alone is not enough");
    assert(large.pairsSettled > small.pairsSettled * 3,
        `four against four should dwarf two against two:`
        + ` ${large.pairsSettled} vs ${small.pairsSettled}`);
});

test("three structures meeting at once settles more than two", () => {
    const two = integrationLoad([
        p("A", "B"), p("B", "C"), p("X", "Y"), p("Y", "Z"), p("C", "X"),
    ]);
    const three = integrationLoad([
        p("A", "B"), p("B", "C"),
        p("X", "Y"), p("Y", "Z"),
        p("P", "Q"), p("Q", "R"),
        p("C", "X", "P"),
    ]);
    assert(three.pairsSettled > two.pairsSettled,
        `three threes should settle more than two threes:`
        + ` ${three.pairsSettled} vs ${two.pairsSettled}`);
    equal(three.pairsSettled, 27, "three groups of three settle twenty-seven pairs");
});

test("a premise that settles nothing new counts nothing", () => {
    const load = integrationLoad([p("A", "B"), p("B", "C"), p("A", "C")]);
    equal(load.pairsSettled, 2,
        "the closing premise settles nothing, so the peak stays where it was");
});
