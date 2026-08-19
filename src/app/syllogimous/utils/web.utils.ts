/**
 * Relational webs: directed graphs, and the questions you can ask about two of
 * them.
 *
 * The marquee feature of the original Phase 2, specced from the Vercel
 * snapshot and never built. A web is a random directed graph; a second web is
 * the same graph under a random relabelling, laid out afresh so it is
 * unrecognisable by eye. What can then be asked is: which node is which, are
 * these the same shape at all, and do they share a structural property.
 *
 * ── The trap this mode lives or dies on ──
 *
 * "Which node of G′ matches this one?" has a single answer only if the
 * highlighted node is distinguishable from every other node *by structure
 * alone*. If the graph has a non-trivial automorphism moving v, then several
 * nodes of G′ are equally valid answers and the item is broken — not hard,
 * broken, because the stated answer is one of several correct ones and the
 * player is marked wrong for finding a different one.
 *
 * So `orbitOf` is not an optimisation here, it is the correctness condition,
 * and every mapping item is checked against it before being served.
 *
 * Pure: no Angular, no randomness beyond Math.random, and every claim decided
 * by looking at an adjacency matrix.
 */

/** A directed graph. `adj[i][j]` means an arrow from i to j. */
export interface Web {
    n: number;
    adj: boolean[][];
}

export const emptyWeb = (n: number): Web => ({
    n,
    adj: Array.from({ length: n }, () => Array(n).fill(false)),
});

export function cloneWeb(w: Web): Web {
    return { n: w.n, adj: w.adj.map(r => [...r]) };
}

export function edgesOf(w: Web): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < w.n; i++) for (let j = 0; j < w.n; j++) if (w.adj[i][j]) out.push([i, j]);
    return out;
}

export function randomWeb(n: number, density = 0.28, loops = false): Web {
    const w = emptyWeb(n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j && !loops) continue;
            if (Math.random() < density) w.adj[i][j] = true;
        }
    }
    return w;
}

/** `perm[i]` is where node i ends up. */
export function permuteWeb(w: Web, perm: number[]): Web {
    const out = emptyWeb(w.n);
    for (let i = 0; i < w.n; i++) {
        for (let j = 0; j < w.n; j++) {
            if (w.adj[i][j]) out.adj[perm[i]][perm[j]] = true;
        }
    }
    return out;
}

export function randomPermutation(n: number): number[] {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
}

export const inDegree = (w: Web, v: number) => w.adj.reduce((a, row) => a + (row[v] ? 1 : 0), 0);
export const outDegree = (w: Web, v: number) => w.adj[v].filter(Boolean).length;

/** What in- and out-degree alone can tell you about a node. */
export const degreeSignature = (w: Web, v: number) => `${inDegree(w, v)}/${outDegree(w, v)}`;

/**
 * Colour refinement, the 1-dimensional Weisfeiler-Leman colouring.
 *
 * Start every node on its degree pair, then repeatedly recolour by the multiset
 * of neighbour colours until nothing changes. Two nodes the same colour cannot
 * be told apart by any amount of local counting — which is exactly the
 * condition the `structural` difficulty wants to force, and a sound prune for
 * the automorphism search below.
 */
export function refine(w: Web): number[] {
    let colour = Array.from({ length: w.n }, (_, v) => degreeSignature(w, v));

    /*
     * Renumbered by *sorted* signature each round, not by first appearance.
     *
     * This is the whole correctness of the function. Numbering in encounter
     * order makes a colour depend on where a node happens to sit in the array,
     * so two relabellings of one graph come out with different numbers, and
     * `mappings` — which prunes on colour equality across the two — rejects
     * every valid mapping. The symptom was that no graph was isomorphic to
     * itself relabelled.
     */
    const renumber = (values: string[]) => {
        const canon = new Map([...new Set(values)].sort().map((c, i) => [c, String(i)]));
        return values.map(c => canon.get(c)!);
    };

    colour = renumber(colour);

    for (let round = 0; round < w.n; round++) {
        const before = new Set(colour).size;
        const next = renumber(colour.map((c, v) => {
            const outs = colour.filter((_, u) => w.adj[v][u]).sort();
            const ins = colour.filter((_, u) => w.adj[u][v]).sort();
            return `${c}|${outs.join(",")}|${ins.join(",")}`;
        }));
        colour = next;
        if (new Set(colour).size === before) break;
    }

    return colour.map(Number);
}

/**
 * Every mapping of `a` onto `b` that preserves the arrows.
 *
 * Backtracking over nodes in order, pruned by refinement colour and by
 * consistency with what has already been assigned. n is at most twelve here, so
 * the pruning does all the work that is needed and none of the sophistication
 * of a real isomorphism solver is warranted.
 *
 * `limit` stops the search early — the callers only ever need "is there one"
 * or "all of them" on a small graph.
 */
export function mappings(a: Web, b: Web, limit = Infinity): number[][] {
    if (a.n !== b.n) return [];
    const ca = refine(a), cb = refine(b);

    // A quick necessary condition: the colour multisets have to agree.
    const tally = (c: number[]) => c.slice().sort().join(",");
    if (tally(ca) !== tally(cb)) return [];

    const found: number[][] = [];
    const perm: number[] = Array(a.n).fill(-1);
    const used: boolean[] = Array(a.n).fill(false);

    const consistent = (i: number, j: number) => {
        for (let k = 0; k < i; k++) {
            const l = perm[k];
            if (a.adj[i][k] !== b.adj[j][l]) return false;
            if (a.adj[k][i] !== b.adj[l][j]) return false;
        }
        return a.adj[i][i] === b.adj[j][j];
    };

    const step = (i: number): void => {
        if (found.length >= limit) return;
        if (i === a.n) { found.push([...perm]); return; }
        for (let j = 0; j < b.n; j++) {
            if (used[j] || ca[i] !== cb[j] || !consistent(i, j)) continue;
            used[j] = true; perm[i] = j;
            step(i + 1);
            used[j] = false; perm[i] = -1;
            if (found.length >= limit) return;
        }
    };

    step(0);
    return found;
}

export const isomorphic = (a: Web, b: Web) => mappings(a, b, 1).length > 0;

/** Where a node can be sent by a symmetry of the graph, itself included. */
export function orbitOf(w: Web, v: number): number[] {
    const seen = new Set<number>();
    for (const auto of mappings(w, w)) seen.add(auto[v]);
    return [...seen].sort((x, y) => x - y);
}

/**
 * Nodes with the same arrow counts as `v`.
 *
 * What the `structural` difficulty actually requires. The spec asked for a
 * refinement twin "ideally", and that turns out to be close to unusable: on
 * graphs this small, colour refinement is almost always complete, so two nodes
 * sharing a colour share an *orbit* — and a node in a shared orbit has no
 * unique answer, which is the one thing a mapping item may not have. Asking for
 * a refinement twin therefore asks for an item that cannot exist.
 *
 * A degree twin is the version that both exists and does the job: in- and
 * out-degree stop identifying the node, so the match has to come from where its
 * neighbours sit, while refinement still separates it and the answer stays
 * unique.
 */
export function degreeTwins(w: Web, v: number): number[] {
    const sig = degreeSignature(w, v);
    return Array.from({ length: w.n }, (_, u) => u)
        .filter(u => u !== v && degreeSignature(w, u) === sig);
}

/** Nodes colour refinement cannot separate from `v`; see `degreeTwins`. */
export function structuralTwins(w: Web, v: number): number[] {
    const colour = refine(w);
    return colour
        .map((c, u) => (u !== v && c === colour[v] ? u : -1))
        .filter(u => u >= 0);
}

/**
 * A graph with the same degree sequence that is not the same graph.
 *
 * A false comparison item has to survive the obvious shortcut. Counting arrows
 * per node settles most randomly-altered graphs instantly, so the alteration is
 * a two-swap: take arrows u₁→v₁ and u₂→v₂, replace them with u₁→v₂ and u₂→v₁.
 * Every in- and out-degree is untouched, and the shape usually is not.
 */
export function nearMiss(w: Web, attempts = 400): Web | null {
    const edges = edgesOf(w);
    for (let i = 0; i < attempts; i++) {
        const [u1, v1] = edges[Math.floor(Math.random() * edges.length)];
        const [u2, v2] = edges[Math.floor(Math.random() * edges.length)];
        if (u1 === u2 || v1 === v2 || u1 === v2 || u2 === v1) continue;
        if (w.adj[u1][v2] || w.adj[u2][v1]) continue;

        const candidate = cloneWeb(w);
        candidate.adj[u1][v1] = false;
        candidate.adj[u2][v2] = false;
        candidate.adj[u1][v2] = true;
        candidate.adj[u2][v1] = true;

        // The swap preserves degrees by construction; it does not always
        // change the shape, so that is checked rather than assumed.
        if (!isomorphic(w, candidate)) return candidate;
    }
    return null;
}

/* ------------------------------------------------------------------ *
 * Properties                                                          *
 * ------------------------------------------------------------------ */

export interface WebProperty {
    id: string;
    name: string;
    /** Stated with the item, since the whole question is whether it holds. */
    gloss: string;
    holds: (w: Web) => boolean;
}

const pairs = (w: Web) => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < w.n; i++) for (let j = 0; j < w.n; j++) out.push([i, j]);
    return out;
};

export const WEB_PROPERTIES: WebProperty[] = [
    {
        id: "reflexive", name: "Reflexivity", gloss: "every node points at itself",
        holds: w => w.adj.every((row, i) => row[i]),
    },
    {
        id: "irreflexive", name: "Irreflexivity", gloss: "no node points at itself",
        holds: w => w.adj.every((row, i) => !row[i]),
    },
    {
        id: "symmetric", name: "Symmetry", gloss: "every arrow has one coming back",
        holds: w => pairs(w).every(([i, j]) => w.adj[i][j] === w.adj[j][i]),
    },
    {
        id: "antisymmetric", name: "Antisymmetry", gloss: "no two nodes point at each other",
        holds: w => pairs(w).every(([i, j]) => !(w.adj[i][j] && w.adj[j][i]) || i === j),
    },
    {
        id: "asymmetric", name: "Asymmetry", gloss: "antisymmetry, and no self-arrows either",
        holds: w => pairs(w).every(([i, j]) => !w.adj[i][j] || !w.adj[j][i]),
    },
    {
        id: "transitive", name: "Transitivity", gloss: "wherever you can go in two steps, you can go in one",
        holds: w => {
            for (let i = 0; i < w.n; i++)
                for (let j = 0; j < w.n; j++)
                    if (w.adj[i][j])
                        for (let k = 0; k < w.n; k++)
                            if (w.adj[j][k] && !w.adj[i][k]) return false;
            return true;
        },
    },
];

/**
 * Node positions on a circle, as fractions of the viewport.
 *
 * Laid out here rather than in the component because the *point* of the second
 * web is that it looks nothing like the first: a fresh rotation and a fresh
 * ordering around the ring is what makes the match structural rather than
 * visual, and that is a property of the item, not of how it is drawn.
 */
export function ringLayout(n: number, rotation = Math.random()): Array<[number, number]> {
    return Array.from({ length: n }, (_, i) => {
        const angle = 2 * Math.PI * ((i / n) + rotation);
        return [0.5 + 0.38 * Math.cos(angle), 0.5 + 0.38 * Math.sin(angle)] as [number, number];
    });
}

/**
 * Positions that say nothing about the structure.
 *
 * A ring was the wrong picture for this mode, and wrong in a way that undercut
 * it. Every node sits at the same distance from the centre and the same angle
 * apart, so a graph with a rotational symmetry *looks* rotationally symmetric —
 * the automorphism is visible as a turn of the picture rather than something to
 * be established from the arrows. And drawing both webs as rings invites
 * matching by position, which is the one route the mode is meant to close.
 *
 * Scattered instead, independently for each web, with a floor on how close two
 * nodes may sit: crossing arrows cost some legibility, and overlapping nodes
 * would cost more than that.
 *
 * Rejection sampling with a relaxing floor rather than a force-directed layout,
 * because a force-directed one settles into *regular* arrangements — which is
 * the problem being fixed.
 */
export function scatterLayout(n: number, margin = 0.14): Array<[number, number]> {
    const lo = margin, hi = 1 - margin;
    const out: Array<[number, number]> = [];

    // Starts above what n points can comfortably manage and eases off, so a
    // small graph gets a well-spread picture and a large one still terminates.
    let floor = 0.9 / Math.sqrt(n);

    for (let guard = 0; out.length < n && guard < n * 400; guard++) {
        const p: [number, number] = [lo + Math.random() * (hi - lo), lo + Math.random() * (hi - lo)];
        if (out.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= floor)) {
            out.push(p);
            continue;
        }
        // Nothing fits: loosen rather than spin.
        if (guard % (n * 20) === (n * 20) - 1) floor *= 0.85;
    }

    // A ring is still better than nothing if the sampler somehow starves.
    return out.length === n ? out : ringLayout(n);
}
