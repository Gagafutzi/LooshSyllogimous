/**
 * Relation systems, and the one defect here that would be invisible.
 *
 * Each system carries a `meaning` shown with the item — an invented relation
 * word cannot be reasoned about without it. So the description is not
 * documentation; it is the rule the player is given, and the only rule they
 * have. If it drifts from what `holds` does, every item built on that system is
 * consistent, answerable, and answers a different question from the one the
 * card states. Nothing else in the suite could see that.
 *
 * So the descriptions are read as claims and checked against the relation over
 * every arrangement the system allows. "It chains" is transitivity; "never runs
 * both ways" is asymmetry; "does not chain" is a promise that a counterexample
 * exists, which is a claim in the other direction and is checked that way.
 */

import { assert, equal, test } from "./harness";
import {
    ALL_SYSTEMS, RelationSystem, STARTER_SYSTEMS, assignments, consistentStates,
    forests, partitions, permutations, settledBy, systemById,
} from "../src/app/syllogimous/utils/relation-systems.utils";

/** A size every system can be asked for, small enough to sweep exhaustively. */
const N = 4;

const pairs = (n: number) => {
    const out: Array<[number, number]> = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) out.push([a, b]);
    return out;
};

const triples = (n: number) => {
    const out: Array<[number, number, number]> = [];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
        if (a !== b && b !== c && a !== c) out.push([a, b, c]);
    }
    return out;
};

/** Whether the relation ever runs both ways between a pair. */
function everSymmetric(s: RelationSystem, n: number): boolean {
    return s.states(n).some(st => pairs(n).some(([a, b]) => s.holds(st, a, b) && s.holds(st, b, a)));
}

/** Whether a chain of two ever fails to give the third. */
function everBreaksChain(s: RelationSystem, n: number): boolean {
    return s.states(n).some(st => triples(n).some(([a, b, c]) =>
        s.holds(st, a, b) && s.holds(st, b, c) && !s.holds(st, a, c)));
}

test("every system's state space is non-empty and holds no duplicates", () => {
    for (const s of ALL_SYSTEMS) {
        for (let n = 2; n <= Math.min(5, s.maxN); n++) {
            const states = s.states(n);
            assert(states.length > 0, `${s.id} allows no arrangement of ${n}`);
            equal(new Set(states.map(x => x.join(","))).size, states.length,
                `${s.id} enumerates the same arrangement of ${n} twice`);
            for (const state of states) {
                equal(state.length, n, `${s.id} built an arrangement of the wrong size`);
            }
        }
    }
});

/**
 * The enumerations are the ones they claim to be, by count.
 *
 * Each is a known sequence, and a count is the cheapest thing that catches an
 * enumeration which is subtly short — a partition generator that misses the
 * all-separate case still produces plausible output.
 */
test("the enumerations are the sequences they are meant to be", () => {
    equal(permutations(4).length, 24, "orderings of four");
    equal(assignments(4, 3).length, 81, "three-way assignments of four");
    // Bell numbers: the ways of splitting n things into groups.
    equal([0, 1, 2, 3, 4, 5, 6].map(n => partitions(n).length), [1, 1, 2, 5, 15, 52, 203],
        "partition counts are not the Bell numbers");
    /*
     * Forests of rooted trees on n labelled nodes, which Cayley gives as
     * (n+1)^(n-1) — 1, 3, 16, 125, 1296. Written as the formula rather than as
     * five numbers, because the numbers are the thing being checked and a
     * list of them is only a record of what the code did the day it was
     * written. This expectation was wrong first: a nearby sequence for
     * *unrooted* forests, which this enumeration is not.
     */
    equal([1, 2, 3, 4, 5].map(n => forests(n).length),
        [1, 2, 3, 4, 5].map(n => (n + 1) ** (n - 1)),
        "forest counts are not the rooted-labelled-forest sequence");
});

/**
 * Every claim a description makes is true of the relation it describes.
 *
 * Read off `meaning` rather than listed here, so a system added later is
 * checked by the same words that will be shown to the player — and a system
 * whose description claims nothing checkable fails too, since a rule nobody can
 * state is not a rule the player can use.
 */
test("each system does what its description says", () => {
    for (const s of ALL_SYSTEMS) {
        const n = Math.min(N, s.maxN);
        const says = s.meaning.toLowerCase();
        let checked = 0;

        if (says.includes("never runs both ways")) {
            checked++;
            assert(!everSymmetric(s, n),
                `${s.id} says it never runs both ways, and it does`);
        }
        if (says.includes("runs both ways") && !says.includes("never runs both ways")) {
            checked++;
            /* Symmetric everywhere, not merely somewhere: "it runs both ways"
               is a property of the relation, not of some of its pairs. */
            for (const st of s.states(n)) {
                for (const [a, b] of pairs(n)) {
                    equal(s.holds(st, a, b), s.holds(st, b, a),
                        `${s.id} says it runs both ways and does not, between ${a} and ${b}`);
                }
            }
        }
        if (says.includes("does not chain")) {
            checked++;
            assert(everBreaksChain(s, n),
                `${s.id} says it does not chain, and no arrangement breaks a chain —`
                + " the description promises a trap the relation does not lay");
        } else if (says.includes("chains")) {
            checked++;
            assert(!everBreaksChain(s, n),
                `${s.id} says it chains, and some arrangement breaks one`);
        }
        if (says.includes("two steps of it run back the other way")) {
            checked++;
            for (const st of s.states(n)) {
                for (const [a, b, c] of triples(n)) {
                    if (!s.holds(st, a, b) || !s.holds(st, b, c)) continue;
                    assert(s.holds(st, c, a),
                        `${s.id} says two steps run back the other way, and ${a}→${b}→${c}`
                        + " does not come back");
                }
            }
        }
        if (says.includes("bring you back to the same side")) {
            checked++;
            for (const st of s.states(n)) {
                for (const [a, b, c] of triples(n)) {
                    if (!s.holds(st, a, b) || !s.holds(st, b, c)) continue;
                    assert(!s.holds(st, a, c),
                        `${s.id} says two steps come back to the same side, and ${a} is still`
                        + ` opposite ${c}`);
                }
            }
        }

        assert(checked > 0,
            `${s.id}'s description makes no claim this can check, so nothing holds it`
            + ` to the relation: "${s.meaning}"`);
    }
});

/** A relation nothing ever satisfies would pass every claim above vacuously. */
test("every system's relation actually happens", () => {
    for (const s of ALL_SYSTEMS) {
        const n = Math.min(N, s.maxN);
        const holds = s.states(n).some(st => pairs(n).some(([a, b]) => s.holds(st, a, b)));
        const fails = s.states(n).some(st => pairs(n).some(([a, b]) => !s.holds(st, a, b)));
        assert(holds, `${s.id} never holds between anything, so it states nothing`);
        assert(fails, `${s.id} holds between everything, so it distinguishes nothing`);
    }
});

test("the starter systems are four genuinely different shapes", () => {
    equal(STARTER_SYSTEMS.length, 4, "the starter set changed size");
    for (const s of STARTER_SYSTEMS) {
        assert(ALL_SYSTEMS.includes(s), `${s.id} starts a player off and is not in the full set`);
    }
    /* One that chains and one that does not, one that runs both ways and one
       that does not — a first item needs the spread, not four orders. */
    const shapes = new Set(STARTER_SYSTEMS.map(s =>
        `${everBreaksChain(s, 4)}/${everSymmetric(s, 4)}`));
    equal(shapes.size, 4, "two of the starter systems are the same shape");
});

test("a system can be found by the id an item would store", () => {
    for (const s of ALL_SYSTEMS) equal(systemById(s.id), s, `${s.id} cannot be looked up`);
    equal(systemById("no-such-system"), undefined, "an unknown id found something");
    equal(new Set(ALL_SYSTEMS.map(s => s.id)).size, ALL_SYSTEMS.length, "two systems share an id");
});

/**
 * The primitive the Incompleteness family is built on.
 *
 * Filtering arrangements by what the premises said is what lets a pair be
 * *open* rather than merely unknown — and "it could be either" is an answer in
 * that band rather than a dodge, so this has to mean what it says.
 */
test("premises narrow the arrangements, and what survives decides a pair", () => {
    const order = systemById("order")!;

    /* Nothing said: a pair is open, because some ordering has it each way. */
    equal(settledBy(order, consistentStates(order, 3, []), 0, 2), null,
        "a pair was settled before anything was said about it");

    /* Said outright. */
    const stated = consistentStates(order, 3, [{ a: 0, b: 2, holds: true }]);
    assert(stated.length > 0, "a statable premise ruled out every arrangement");
    equal(settledBy(order, stated, 0, 2), true, "what a premise stated was not settled");

    /* Derived: two steps of a chaining relation settle the third, and the pair
       in the middle is what makes it a derivation rather than a restatement. */
    const chained = consistentStates(order, 3, [
        { a: 0, b: 1, holds: true },
        { a: 1, b: 2, holds: true },
    ]);
    equal(settledBy(order, chained, 0, 2), true, "a chain did not settle its ends");

    /* And a relation that does not chain leaves the same pair open, which is
       the whole reason the system is a parameter rather than a constant. */
    const next = systemById("adjacency")!;
    const adjacent = consistentStates(next, 4, [
        { a: 0, b: 1, holds: true },
        { a: 1, b: 2, holds: true },
    ]);
    assert(adjacent.length > 0, "no row puts those three next to each other");
    equal(settledBy(next, adjacent, 0, 2), false,
        "adjacency chained, which is the one thing it does not do");

    /* Premises that cannot all hold leave nothing, and nothing settles nothing. */
    equal(settledBy(order, consistentStates(order, 3, [
        { a: 0, b: 1, holds: true },
        { a: 1, b: 0, holds: true },
    ]), 0, 1), null, "contradictory premises settled a pair");
});
