/**
 * Relation systems — what a relation *is*, as data.
 *
 * Ported from Isomorph, which is a second build of this codebase and where the
 * imported band comes from. The port is worth describing, because it is not a
 * generator moved across: Isomorph does not write one generator per mode the
 * way this app does. It keeps a handful of systems — a strict order, sameness
 * of group, a rock-paper-scissors circle, adjacency in a row — and parameterises
 * its modes over them. The mode says what is asked; the system says what the
 * relation means.
 *
 * That is why seven small objects are worth a file. Every mode in the imported
 * band that asks about "the relation" asks it of one of these, and a mode that
 * works for one works for all seven the day it is written.
 *
 * ── The two functions, and why both ──
 *
 * `holds` is the relation: given an arrangement, does it run from one entity to
 * another. That much any of this app's modes could have used.
 *
 * `states` is the part that is new here, and it is what the whole Incompleteness
 * family is built on. It enumerates *every* arrangement the system allows, so a
 * set of premises can be answered by keeping the arrangements consistent with
 * them and looking at what survives: a pair settled in every surviving
 * arrangement is settled, a pair that differs between them is genuinely open,
 * and "it could be either" stops being a dodge and becomes an answer. Nothing
 * in the base game can express that, because every mode here builds one
 * arrangement and asks about it.
 *
 * The enumeration is exhaustive and therefore small on purpose. `maxN` is how
 * many entities each one can be asked for: seven permutations is 5,040
 * arrangements and seven entities over a three-way circle is 2,187, which is
 * nothing to filter. Ancestry stops at six because it enumerates over parent
 * assignments and the candidate count is (n+1)^n before the cycles are thrown
 * out.
 *
 * ── What `meaning` is for, and what holds it honest ──
 *
 * It is shown with the item: an invented relation word is unanswerable without
 * it. It is also a set of claims — "it chains", "never runs both ways", "two
 * steps of it run back the other way" — and `tests/relation-systems.test.ts`
 * reads those claims and checks them against `holds` over every arrangement.
 * A description that drifts from the relation it describes is the one defect
 * here that would be invisible: the item would be consistent, the player would
 * be told the wrong rule, and nothing would fail.
 */

/**
 * Enumerations are pure and re-asked constantly, so they are kept.
 *
 * A mode filtering arrangements asks for the same state space on every item,
 * and the same one again for every claim in a series. Five thousand
 * permutations is cheap once and not cheap on every draw.
 */
const cache = new Map<string, number[][]>();
const kept = (key: string, build: () => number[][]): number[][] => {
    const found = cache.get(key);
    if (found) return found;
    const made = build();
    cache.set(key, made);
    return made;
};

/** Every ordering of `n` entities: `state[i]` is entity `i`'s place. */
export function permutations(n: number): number[][] {
    return kept(`perm:${n}`, () => {
        const out: number[][] = [];
        const state: number[] = [];
        const used = Array(n).fill(false);
        const walk = () => {
            if (state.length === n) { out.push([...state]); return; }
            for (let i = 0; i < n; i++) {
                if (used[i]) continue;
                used[i] = true;
                state.push(i);
                walk();
                state.pop();
                used[i] = false;
            }
        };
        if (n === 0) out.push([]); else walk();
        return out;
    });
}

/** Every way of giving `n` entities one of `k` values. */
export function assignments(n: number, k: number): number[][] {
    return kept(`tuple:${n}:${k}`, () => {
        const out: number[][] = [];
        const state = Array(n).fill(0);
        const walk = (at: number) => {
            if (at === n) { out.push([...state]); return; }
            for (let v = 0; v < k; v++) { state[at] = v; walk(at + 1); }
        };
        walk(0);
        return out;
    });
}

/**
 * Every way of splitting `n` entities into groups.
 *
 * As restricted growth strings: entity 0 is always in group 0, and each entity
 * after it joins a group already used or opens the next one. That counts each
 * partition once — the groups have no names, so "0,0,1" and "1,1,0" are the
 * same split and only the first is generated.
 */
export function partitions(n: number): number[][] {
    return kept(`part:${n}`, () => {
        const out: number[][] = [];
        const state = Array(n).fill(0);
        const walk = (at: number, highest: number) => {
            if (at === n) { out.push([...state]); return; }
            for (let group = 0; group <= highest + 1; group++) {
                state[at] = group;
                walk(at + 1, Math.max(highest, group));
            }
        };
        if (n === 0) out.push([]); else { state[0] = 0; walk(1, 0); }
        return out;
    });
}

/**
 * Every family tree over `n` entities: `state[i]` is `i`'s parent, or -1.
 *
 * Built by walking the parent assignments and throwing out the ones that are
 * not trees — an entity that is its own parent, or a loop of them. A loop is
 * what makes this different from the others: the relation is defined by
 * following parents upward, and a cycle makes that walk never end rather than
 * merely describing something odd.
 */
export function forests(n: number): number[][] {
    return kept(`forest:${n}`, () => {
        const out: number[][] = [];
        const state = Array(n).fill(-1);
        const walk = (at: number) => {
            if (at === n) { out.push([...state]); return; }
            for (let parent = -1; parent < n; parent++) {
                if (parent === at) continue;              // nobody is their own parent
                state[at] = parent;
                if (!loops(state, at)) walk(at + 1);
                state[at] = -1;
            }
        };
        if (n === 0) out.push([]); else walk(0);
        return out;
    });
}

/** Whether following parents up from `from` comes back round to it. */
function loops(parent: number[], from: number): boolean {
    let at = parent[from];
    for (let steps = 0; at !== -1 && steps <= parent.length; steps++) {
        if (at === from) return true;
        at = parent[at];
    }
    return false;
}

export interface RelationSystem {
    /** Stable, and what a stored rung or a saved item refers to. */
    id: string;
    /** How many entities its arrangements can be enumerated for. */
    maxN: number;
    /**
     * What the relation is, in words, and shown with the item.
     *
     * An invented relation word cannot be reasoned about without this, so it is
     * part of the item rather than documentation. It is also a set of claims
     * about `holds`, and the test file holds it to them.
     */
    meaning: string;
    /** Every arrangement of `n` entities this system allows. */
    states(n: number): number[][];
    /** Whether the relation runs from `a` to `b` in this arrangement. */
    holds(state: number[], a: number, b: number): boolean;
}

const ORDER: RelationSystem = {
    id: "order",
    maxN: 7,
    meaning: "a strict order: it chains (if A–B and B–C then A–C) and never runs both ways",
    states: permutations,
    holds: (state, a, b) => state[a] < state[b],
};

const EQUIVALENCE: RelationSystem = {
    id: "equivalence",
    maxN: 7,
    meaning: "sameness of group: it runs both ways and chains",
    states: partitions,
    holds: (state, a, b) => state[a] === state[b],
};

const OPPOSITION: RelationSystem = {
    id: "opposition",
    maxN: 7,
    meaning: "opposition between two sides: it runs both ways, and two steps of it bring you back to the same side",
    states: n => assignments(n, 2),
    holds: (state, a, b) => state[a] !== state[b],
};

const CYCLIC3: RelationSystem = {
    id: "cyclic3",
    maxN: 7,
    meaning: "rock-paper-scissors dominance: one way only, and two steps of it run back the other way",
    states: n => assignments(n, 3),
    holds: (state, a, b) => (state[a] - state[b] + 3) % 3 === 1,
};

const ADJACENCY: RelationSystem = {
    id: "adjacency",
    maxN: 7,
    meaning: "being next to each other in a row: it runs both ways and does not chain",
    states: permutations,
    holds: (state, a, b) => Math.abs(state[a] - state[b]) === 1,
};

const SUCCESSOR: RelationSystem = {
    id: "successor",
    maxN: 7,
    meaning: "coming directly after: one way only, and it does not chain",
    states: permutations,
    holds: (state, a, b) => state[a] === state[b] + 1,
};

const ANCESTRY: RelationSystem = {
    id: "ancestry",
    /* Enumerated over parent assignments, so the candidates are (n+1)^n before
       the loops are thrown out. Six is where that stays worth doing. */
    maxN: 6,
    meaning: "ancestry in a family tree: it chains, never runs both ways, and two things can share an ancestor without either descending from the other",
    states: forests,
    holds: (state, a, b) => {
        for (let at = state[b]; at !== -1; at = state[at]) {
            if (at === a) return true;
        }
        return false;
    },
};

/**
 * The four a mode starts with, and the seven it grows into.
 *
 * The starter set is the one every mode in the band can assume: an order, a
 * sameness, a circle and an adjacency are four genuinely different shapes — one
 * chains and one does not, one runs both ways and one does not — which is the
 * spread a first item needs. The other three arrive as rungs.
 */
export const STARTER_SYSTEMS: RelationSystem[] = [ORDER, EQUIVALENCE, CYCLIC3, ADJACENCY];

export const ALL_SYSTEMS: RelationSystem[] = [
    ORDER, EQUIVALENCE, OPPOSITION, CYCLIC3, ADJACENCY, SUCCESSOR, ANCESTRY,
];

export const systemById = (id: string): RelationSystem | undefined =>
    ALL_SYSTEMS.find(s => s.id === id);

/**
 * The arrangements still standing after what the premises said.
 *
 * The primitive the Incompleteness family is built on, and the reason `states`
 * exists. A claim is settled when every surviving arrangement agrees about it
 * and open when they do not — which is a fact about the premises rather than a
 * judgement about them, and is what lets "it could be either" be an answer.
 */
export function consistentStates(
    system: RelationSystem,
    n: number,
    premises: Array<{ a: number; b: number; holds: boolean }>,
): number[][] {
    return system.states(n).filter(state =>
        premises.every(p => system.holds(state, p.a, p.b) === p.holds));
}

/** Whether the surviving arrangements agree about a pair, and on what. */
export function settledBy(
    system: RelationSystem,
    states: number[][],
    a: number,
    b: number,
): boolean | null {
    if (!states.length) return null;
    const first = system.holds(states[0], a, b);
    return states.every(s => system.holds(s, a, b) === first) ? first : null;
}
