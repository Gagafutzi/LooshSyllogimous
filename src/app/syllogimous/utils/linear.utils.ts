/**
 * The linear-scale family — ported from Syllogimous v3 (`js/generators/linear.js`).
 *
 * A linear mode is one relation over one axis: more/less, before/after,
 * contains/within, above/below, left/right. v4 shipped two of them (the two
 * Comparisons) as bespoke generators; this is the shared engine, so a new
 * wording costs a five-line table entry instead of a copy of the generator.
 *
 * Three structures, in increasing difficulty, which is the point — the family
 * was fairly criticised as five reskins of one task, and the difference has to
 * come from structure rather than vocabulary:
 *
 *   chain      A–B–C–D in order. Read once, append as you go.
 *   branching  each object attaches to an *arbitrary* earlier one, in either
 *              direction. You cannot append; you have to backtrack and re-anchor.
 *              v3 tags these items `modifiers: ['180']`.
 *   transforms the layout is then mutated (see transformations.utils.ts), so the
 *              order you built is not the order you answer from.
 *
 * Branching is also what makes *overlapping positions* possible: objects reached
 * by different routes can land on the same coordinate, which is what licenses the
 * third relation ("is equal to" / "is at the same time as"). A chain can never
 * produce a tie, so on a chain that relation is unusable.
 *
 * Pure — no Angular, no settings, no storage. Positions are integers and every
 * claim is decided by comparing them, so an item is exactly verifiable.
 */

import { ConstructClaim } from "../models/question.models";
import { TransformVocab } from "./transformations.utils";
import { neg, subj } from "./phrasing";

/* ------------------------------------------------------------------ *
 * Scales                                                              *
 * ------------------------------------------------------------------ */

/**
 * One wording of the linear relation.
 *
 * Stated against the *numeric* position rather than against reading order:
 * `above` is the word for "a sits higher on this axis than b". Containment is
 * the one that catches people out — a container is the larger thing, so
 * "contains" is the `above` word and the axis measures size.
 */
export interface LinearScale {
    id: string;
    /** Human label, for pickers. Direction words alone are not unique. */
    name: string;
    /** Relation word when a's position is greater than b's. */
    above: string;
    /** Relation word when a's position is less than b's. */
    below: string;
    /** Relation word when the positions coincide. */
    same: string;
    /** Direction words for transformation offsets: [towards greater, towards less]. */
    direction: [string, string];
    /** Connector between a direction phrase and an anchor: "of", "than", "". */
    link: string;
    /** Unit noun for stated distances. */
    unit: string;
    /** Axis label; blank keeps one-axis phrasing free of pointless labels. */
    axisName: string;
    /**
     * Short noun phrase for "no difference on this axis", used when a scale is
     * one dimension of several: "east, same latitude, above" reads where a full
     * sentence like "is at the same latitude as" cannot be listed mid-clause.
     */
    tie: string;
    /**
     * Wording for when this axis is bent into a loop. Absent means it cannot be:
     * a ring of sizes or of quantities is not a thing anyone can reason about,
     * whereas a compass ring and a clock face both are.
     */
    cyclic?: {
        /** Direction of travel, positive first. */
        direction: [string, string];
        /** Counted noun, singular; pluralised at the point of use. */
        step: string;
        /** Connector to the anchor: "from" suits a dial, "than" a sequence. */
        link: string;
        same: string;
        opposite: string;
    };
}

export const LINEAR_SCALES: Record<string, LinearScale> = {
    quantity: {
        id: "quantity", name: "Quantity",
        above: "is more than", below: "is less than", same: "is equal to",
        direction: ["higher", "lower"], link: "than", unit: "unit", axisName: "",
        tie: "same amount",
    },
    temporal: {
        id: "temporal", name: "Time",
        above: "is after", below: "is before", same: "is at the same time as",
        direction: ["later", "earlier"], link: "than", unit: "step", axisName: "",
        tie: "same time",
        // A clock face is the everyday circular time scale, so the wording is
        // already familiar rather than invented for the mode.
        cyclic: {
            direction: ["later in the cycle", "earlier in the cycle"], step: "step", link: "than",
            same: "is at the same point of the cycle as",
            opposite: "is half a cycle from",
        },
    },
    contains: {
        id: "contains", name: "Containment",
        above: "contains", below: "is within", same: "is the same size as",
        direction: ["wider", "narrower"], link: "than", unit: "level", axisName: "",
        tie: "same size",
    },
    vertical: {
        id: "vertical", name: "Height",
        above: "is on top of", below: "is under", same: "is at the same height as",
        direction: ["higher", "lower"], link: "than", unit: "step", axisName: "",
        tie: "same height",
    },
    horizontal: {
        id: "horizontal", name: "Left-right",
        above: "is right of", below: "is left of", same: "is at the same place as",
        direction: ["right", "left"], link: "of", unit: "step", axisName: "",
        tie: "same place",
        cyclic: {
            direction: ["clockwise", "anticlockwise"], step: "step", link: "from",
            same: "is at the same position as",
            opposite: "is diametrically opposite to",
        },
    },
};

/**
 * The three axes of ordinary space, as scales.
 *
 * Written as LinearScales rather than hardcoded into a direction generator so
 * they compose with the rest of the family — a 5D item is these three plus
 * temporal plus containment, built by the same code.
 */
export const SPATIAL_SCALES: Record<string, LinearScale> = {
    east: {
        id: "east", name: "East-west",
        above: "is east of", below: "is west of", same: "is at the same longitude as",
        direction: ["east", "west"], link: "of", unit: "step", axisName: "X",
        tie: "same longitude",
        cyclic: {
            direction: ["clockwise", "anticlockwise"], step: "step", link: "from",
            same: "is at the same bearing as",
            opposite: "is diametrically opposite to",
        },
    },
    north: {
        id: "north", name: "North-south",
        above: "is north of", below: "is south of", same: "is at the same latitude as",
        direction: ["north", "south"], link: "of", unit: "step", axisName: "Y",
        tie: "same latitude",
    },
    up: {
        id: "up", name: "Up-down",
        above: "is above", below: "is below", same: "is at the same height as",
        direction: ["above", "below"], link: "", unit: "step", axisName: "Z",
        tie: "same height",
    },
};

/** The one-axis vocabulary this scale hands to the transformation stage. */
export function vocabFor(scale: LinearScale): TransformVocab {
    return {
        axisNames: [scale.axisName],
        axisWords: [scale.direction],
        link: [scale.link],
        unit: scale.unit,
    };
}

/* ------------------------------------------------------------------ *
 * Layouts                                                             *
 * ------------------------------------------------------------------ */

export interface LinearLayout {
    words: string[];
    /** Integer coordinate per word. Ties are possible only when branching. */
    pos: Record<string, number>;
    /** Stated pairs as [source, target], in a followable order. */
    edges: Array<[string, string]>;
    /** Undirected adjacency, for distance work. */
    neighbors: Record<string, string[]>;
    branching: boolean;
}

const flip = () => Math.random() > 0.5;
const oneIn = (n: number) => Math.random() * n < 1;

function pick<T>(xs: T[]): T {
    return xs[Math.floor(Math.random() * xs.length)];
}

/** Straight chain: positions are reading order, no ties possible. */
export function buildChain(words: string[]): LinearLayout {
    const pos: Record<string, number> = {};
    const neighbors: Record<string, string[]> = {};
    const edges: Array<[string, string]> = [];

    words.forEach((w, i) => { pos[w] = i; neighbors[w] = []; });
    for (let i = 0; i < words.length - 1; i++) {
        edges.push([words[i], words[i + 1]]);
        neighbors[words[i]].push(words[i + 1]);
        neighbors[words[i + 1]].push(words[i]);
    }

    return { words, pos, edges, neighbors, branching: false };
}

/**
 * Chance a new object hangs off an existing branch rather than extending the
 * end. v3's table: denser branching at small sizes, thinning out as the graph
 * grows, because a large graph is already hard enough to hold without also
 * being bushy.
 */
function branchChance(n: number): number {
    const table: Record<number, number> = { 5: 0.60, 6: 0.55, 7: 0.50, 8: 0.45, 9: 0.40, 10: 0.35 };
    return table[n] ?? (n > 10 ? 0.3 : 0.6);
}

/**
 * Pick the object a new one attaches to.
 *
 * Weighted towards the ends of what exists so far, and capped at two or three
 * connections, so the graph stays a readable tree rather than a hub with
 * everything hanging off one object. Ported from v3's `pickBaseWord`.
 */
function pickBase(neighbors: Record<string, string[]>, branchesAllowed: boolean): string {
    const options = Object.keys(neighbors);

    // Two objects with three connections each is already as bushy as this
    // stays readable; past that, extend instead of branching.
    if (Object.values(neighbors).filter(l => l.length >= 3).length >= 2) branchesAllowed = false;

    const limit = (!branchesAllowed || options.length <= 3) ? 1 : 2;
    const pool: string[] = [];

    for (const w of options) {
        if (neighbors[w].length > limit) continue;
        pool.push(w, w, w);
        if (neighbors[w].length === 1) {
            pool.push(w, w);
            if (options.length >= 6) pool.push(w, w, w, w, w);
        }
    }

    return pool.length ? pick(pool) : pick(options);
}

/**
 * Branching layout — the structure v3 marks as "180".
 *
 * Each object after the first attaches to an arbitrary earlier one and sits one
 * step either side of it. Two consequences, and both are the difficulty:
 * premises cannot be read as a running order, and two objects reached by
 * different routes can land on the same coordinate.
 */
export function buildBranching(words: string[]): LinearLayout {
    const first = words[0];
    const pos: Record<string, number> = { [first]: 0 };
    const neighbors: Record<string, string[]> = { [first]: [] };
    const edges: Array<[string, string]> = [];
    const chance = branchChance(words.length);

    for (let i = 1; i < words.length; i++) {
        const source = pickBase(neighbors, Math.random() < chance);
        const target = words[i];

        /*
         * Nudge away from doubling back on the direction this object was already
         * reached from, so a branch tends to fan out rather than fold onto
         * coordinates that are already occupied. A gentle bias, not a rule —
         * collisions are wanted, just not constantly.
         */
        let forwardChance = 0.5;
        const list = neighbors[source];
        const firstNeighbor = list[0];
        if (firstNeighbor && list.every(w => pos[w] === pos[firstNeighbor])) {
            forwardChance = pos[firstNeighbor] + 1 === pos[source] ? 0.6 : 0.4;
        }

        const forward = Math.random() < forwardChance;
        pos[target] = pos[source] + (forward ? 1 : -1);
        edges.push(forward ? [source, target] : [target, source]);

        neighbors[target] = neighbors[target] ?? [];
        neighbors[target].push(source);
        neighbors[source].push(target);
    }

    return { words, pos, edges: orderEdges(edges, neighbors), neighbors, branching: true };
}

/**
 * Reorder stated pairs so they mostly appear in connection order.
 *
 * Without this the premises arrive in the order the generator happened to build
 * them, which on a branching graph means jumping between unrelated parts of the
 * structure. Depth-first from an end, taking the least-connected branch first.
 * Callers scramble afterwards if they want to; this only establishes that a
 * followable order exists. Ported from v3's `orderPremises`.
 */
function orderEdges(
    edges: Array<[string, string]>,
    neighbors: Record<string, string[]>,
): Array<[string, string]> {
    const key = (a: string, b: string) => [a, b].slice().sort().join("\u0000");
    const byKey = new Map(edges.map(e => [key(e[0], e[1]), e]));
    const out: Array<[string, string]> = [];
    const seen = new Set<string>();

    const walk = (word: string, parent: string | null) => {
        if (seen.has(word)) return;
        seen.add(word);
        if (parent !== null) {
            const edge = byKey.get(key(word, parent));
            if (edge) out.push(edge);
        }
        const next = [...neighbors[word]].sort((a, b) => neighbors[a].length - neighbors[b].length);
        for (const n of next) walk(n, word);
    };

    const start = Object.keys(neighbors).find(w => neighbors[w].length === 1) ?? Object.keys(neighbors)[0];
    walk(start, null);

    // Anything the walk missed (it should not, on a tree) still has to be stated.
    for (const e of edges) if (!out.includes(e)) out.push(e);
    return out;
}

/* ------------------------------------------------------------------ *
 * Choosing what to ask about                                          *
 * ------------------------------------------------------------------ */

/** Whether any two objects share a coordinate. */
export function hasTies(layout: LinearLayout): boolean {
    const seen = new Set<number>();
    for (const w of layout.words) {
        if (seen.has(layout.pos[w])) return true;
        seen.add(layout.pos[w]);
    }
    return false;
}

/** Steps between two objects through the stated pairs; Infinity if unreachable. */
export function graphDistance(a: string, b: string, neighbors: Record<string, string[]>): number {
    if (a === b) return 0;
    const seen = new Set([a]);
    let layer = [a];
    let dist = 0;
    while (layer.length) {
        dist++;
        const next: string[] = [];
        for (const node of layer) {
            for (const n of neighbors[node] ?? []) {
                if (seen.has(n)) continue;
                if (n === b) return dist;
                seen.add(n);
                next.push(n);
            }
        }
        layer = next;
    }
    return Infinity;
}

/**
 * Pick the pair to ask about, biased towards pairs far apart in the graph.
 *
 * The whole difficulty of a linear item is how many premises have to be composed
 * to relate the two objects, so picking uniformly would spend most items on
 * adjacent pairs whose answer is a premise read back. Ported from v3's
 * `DirectionPairChooser`: rank candidate pairs by distance, then usually take
 * the furthest band and occasionally a nearer one, so the difficulty varies
 * without collapsing.
 */
export function pickDistantPair(layout: LinearLayout): [string, string] | null {
    const { neighbors } = layout;
    const words = Object.keys(neighbors);

    // Ends of the structure, and their neighbours, are what sit furthest apart.
    const poles = words.filter(w => neighbors[w].length === 1);
    const pool = new Set<string>(poles);
    for (const w of words) if (poles.some(p => neighbors[p].includes(w))) pool.add(w);
    for (const w of words) {
        if (pool.has(w)) continue;
        if ([...pool].some(n => neighbors[n].includes(w))) pool.add(w);
    }
    const candidates = pool.size >= 2 ? [...pool] : words;

    const bands = new Map<number, Array<[string, string]>>();
    for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
            const d = graphDistance(candidates[i], candidates[j], neighbors);
            // Distance 1 is a stated premise; asking it back tests nothing.
            if (!Number.isFinite(d) || d < 2) continue;
            if (!bands.has(d)) bands.set(d, []);
            bands.get(d)!.push([candidates[i], candidates[j]]);
        }
    }
    if (!bands.size) return null;

    const ranked = [...bands.entries()].sort((a, b) => b[0] - a[0]).map(e => e[1]);
    let band = ranked[0];
    if (ranked.length >= 4 && oneIn(15)) band = ranked[3];
    else if (ranked.length >= 3 && oneIn(6)) band = ranked[2];
    else if (ranked.length >= 2 && oneIn(2.5)) band = ranked[1];

    return pick(band);
}

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

const rel = (s: string) => `<span class="relation">${s}</span>`;
const negated = (s: string) => `<span class="relation">${neg(s)}</span>`;

/** -1 = a below b, 0 = same, 1 = a above b. */
export type Comparison = -1 | 0 | 1;

export function compare(layout: LinearLayout, a: string, b: string): Comparison {
    const d = layout.pos[a] - layout.pos[b];
    return d === 0 ? 0 : (d > 0 ? 1 : -1);
}

export function wordFor(scale: LinearScale, c: Comparison): string {
    return c === 0 ? scale.same : (c > 0 ? scale.above : scale.below);
}

export interface RenderOptions {
    /**
     * Allow a relation to be stated as the negation of a *different* one.
     *
     * Permission, not an instruction — each premise flips a coin, matching how
     * v4's own `getRelation` handles it. Negating every premise would be a
     * uniform relabelling of the vocabulary, which is no harder than the plain
     * form once you notice.
     *
     * Sound only because the negated relation is drawn against the truth: the
     * displayed relation is one the layout rules out, so the reader eliminates
     * rather than reads. Simply inverting would not be sound on a scale with
     * ties — "not more than" leaves both less and equal open.
     */
    negate?: boolean;
    /** Whether the third relation is reachable in this layout. */
    allowTies?: boolean;
}

/**
 * A premise stating how a stands to b.
 *
 * Returns the rendered text and whether it came out negated, because the rating
 * scale charges for negations and counting them back out of the HTML would tie
 * the difficulty model to the markup.
 */
export function renderRelation(
    scale: LinearScale,
    a: string,
    b: string,
    truth: Comparison,
    options: RenderOptions = {},
): { text: string; negated: boolean } {
    if (!options.negate || !flip()) {
        return { text: `${subj(a)} ${rel(wordFor(scale, truth))} ${subj(b)}`, negated: false };
    }

    const alternatives: Comparison[] = ([-1, 0, 1] as Comparison[])
        .filter(c => c !== truth)
        .filter(c => c !== 0 || options.allowTies);

    return {
        text: `${subj(a)} ${negated(wordFor(scale, pick(alternatives)))} ${subj(b)}`,
        negated: true,
    };
}

/** Every stated pair, rendered, with a count of how many came out negated. */
export function renderPremises(
    scale: LinearScale,
    layout: LinearLayout,
    options: RenderOptions = {},
): { premises: string[]; negations: number } {
    let negations = 0;
    const premises = layout.edges.map(([from, to]) => {
        // Edges are stored low-to-high; saying it the other way round half the
        // time stops the relation word from being a reliable direction cue.
        const [a, b] = flip() ? [from, to] : [to, from];
        const r = renderRelation(scale, a, b, compare(layout, a, b), options);
        if (r.negated) negations++;
        return r.text;
    });
    return { premises, negations };
}

export interface LinearConclusion {
    text: string;
    isValid: boolean;
    /** Graph distance between the two objects — how many steps it takes. */
    span: number;
}

/**
 * A conclusion about one pair, true or false by construction.
 *
 * A false conclusion names a relation the layout rules out. Which wrong relation
 * gets used matters: on a branching layout with ties available, claiming
 * equality when the two are one step apart is a genuinely different mistake from
 * claiming the wrong direction, and v3 weighted it by distance for that reason —
 * near-ties are plausible, far-ties are not.
 */
export function buildConclusion(
    scale: LinearScale,
    layout: LinearLayout,
    a: string,
    b: string,
    wantValid: boolean,
    options: RenderOptions = {},
): LinearConclusion {
    const truth = compare(layout, a, b);
    const span = graphDistance(a, b, layout.neighbors);

    // Conclusions are never negated: a negated conclusion asks the reader to
    // evaluate a claim about a claim, which is a different task from the one
    // being trained and makes "false" ambiguous to report.
    const plain = { ...options, negate: false };

    if (wantValid) {
        return { text: renderRelation(scale, a, b, truth, plain).text, isValid: true, span };
    }

    let wrong = ([-1, 0, 1] as Comparison[]).filter(c => c !== truth);
    if (!options.allowTies) {
        wrong = wrong.filter(c => c !== 0);
    } else {
        // Equality is only a tempting wrong answer when the two are close.
        const chance: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8 };
        const gap = Math.abs(layout.pos[a] - layout.pos[b]);
        if (gap !== 0 && !oneIn(chance[gap] ?? 12)) wrong = wrong.filter(c => c !== 0);
    }

    return {
        text: renderRelation(scale, a, b, pick(wrong.length ? wrong : [truth === 1 ? -1 : 1]), plain).text,
        isValid: false,
        span,
    };
}

/**
 * The relation between a pair, as a slot to be filled rather than judged.
 *
 * One axis, so one slot with three options. On its own that is a one-in-three
 * guess, which is already better than true/false, and the caller can ask for
 * several claims to compound it.
 */
export function buildConstructClaim(
    scale: LinearScale,
    layout: LinearLayout,
    a: string,
    b: string,
    withDistance: boolean,
): ConstructClaim {
    const delta = layout.pos[a] - layout.pos[b];
    return {
        a, b,
        slots: [{
            label: scale.name,
            directions: [scale.above, scale.below, scale.same],
            answerDirection: delta === 0 ? 2 : (delta > 0 ? 0 : 1),
            answerMagnitude: Math.abs(delta),
            asksDistance: withDistance,
        }],
    };
}

/**
 * Distinct conclusions about distinct pairs, for the multi-conclusion mode.
 *
 * Each is independently true or false; the caller decides what the set means.
 * Pairs are drawn without repetition so the reader is not asked the same
 * question twice in different words.
 */
export function buildConclusionSet(
    scale: LinearScale,
    layout: LinearLayout,
    count: number,
    wantValid: boolean[],
    options: RenderOptions = {},
): LinearConclusion[] {
    const used = new Set<string>();
    const out: LinearConclusion[] = [];

    for (let guard = 0; out.length < count && guard < count * 40; guard++) {
        const pair = pickDistantPair(layout);
        if (!pair) break;
        const key = [...pair].sort().join("\u0000");
        if (used.has(key)) continue;
        used.add(key);
        out.push(buildConclusion(scale, layout, pair[0], pair[1], wantValid[out.length], options));
    }

    return out;
}

/* ------------------------------------------------------------------ *
 * Explaining an answer                                                *
 * ------------------------------------------------------------------ */

/** The chain of stated pairs joining two objects, or null if none. */
function pathBetween(layout: LinearLayout, a: string, b: string): string[] | null {
    if (a === b) return [a];
    const prev: Record<string, string> = {};
    const seen = new Set([a]);
    const queue = [a];

    while (queue.length) {
        const cur = queue.shift()!;
        for (const n of layout.neighbors[cur] ?? []) {
            if (seen.has(n)) continue;
            seen.add(n);
            prev[n] = cur;
            if (n === b) {
                const out = [b];
                let step = b;
                while (step !== a) { step = prev[step]; out.unshift(step); }
                return out;
            }
            queue.push(n);
        }
    }
    return null;
}

/**
 * Why the answer is what it is, one stated relation at a time.
 *
 * Walks the premises joining the pair and accumulates position along them, so a
 * wrong answer is met with the derivation the reader was meant to perform rather
 * than a single word.
 *
 * The walk runs from the *second* named object to the first, because
 * `compare(a, b)` means "a relative to b" and accumulating a → b carries the
 * opposite sign. Getting that backwards produces a derivation with correct
 * arithmetic that states the exact opposite of the claim.
 *
 * Positions come straight from `layout.pos`, so this stays correct however the
 * layout was built — chain or branching, ties or none. It is *not* correct once
 * transformations have moved things, since those rewrite positions after the
 * premises were stated; callers gate on that.
 */
export function explainLinear(
    scale: LinearScale,
    layout: LinearLayout,
    a: string,
    b: string,
): string[] {
    const path = pathBetween(layout, b, a);
    if (!path || path.length < 2) return [];

    const lines: string[] = [];
    for (let i = 0; i < path.length - 1; i++) {
        const from = path[i], to = path[i + 1];
        const step = layout.pos[to] - layout.pos[from];
        const total = layout.pos[to] - layout.pos[path[0]];

        const word = step === 0 ? scale.tie : (step > 0 ? scale.direction[0] : scale.direction[1]);
        const running = `running total ${total > 0 ? "+" : ""}${total}`;
        lines.push(`${subj(to)} is ${rel(word)} relative to ${subj(from)} — ${running}`);
    }

    // Closed with the conclusion's own renderer, so the last line reads exactly
    // as the claim does rather than being a second wording of the same fact.
    lines.push(`so ${renderRelation(scale, a, b, compare(layout, a, b), { negate: false }).text}`);
    return lines;
}
