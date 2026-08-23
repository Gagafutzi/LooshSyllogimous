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

/**
 * The properties worth asking about.
 *
 * **Reflexivity and symmetry are gone.** Both are answered by looking rather
 * than by reasoning — "does every node have a loop on it" and "is every arrow
 * paired" are counted off the picture in a glance, and a question answered by
 * glancing is not what a mode built on seeing structure should spend a fifth of
 * its items on. Node assignment and shape comparison are the demands here.
 *
 * Their negations stay, and it is worth being straight about why that is not
 * quite consistent: irreflexivity is the same glance as reflexivity. What keeps
 * it is that a *false* item needs a property that fails interestingly, and the
 * negations fail on one node where the positives fail on all of them — so they
 * survive as the easy end of a pool that has to have one, while transitivity
 * carries the other end.
 */
export const WEB_PROPERTIES: WebProperty[] = [
    {
        id: "irreflexive", name: "Irreflexivity", gloss: "no node points at itself",
        holds: w => w.adj.every((row, i) => !row[i]),
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
export function scatterLayout(n: number, margin = 0.12): Array<[number, number]> {
    const lo = margin, hi = 1 - margin;
    const out: Array<[number, number]> = [];

    /*
     * How far apart two nodes want to be, given how many there are.
     *
     * There is no separation that works at every size: twelve nodes a fifth of
     * the box apart do not fit in the box, and demanding it only means the
     * sampler starves. What scales instead is the *drawing* — the renderer
     * shrinks its circles as the count rises — so the target here can come down
     * with it rather than fighting geometry.
     */
    let floor = Math.max(0.15, 0.82 / Math.sqrt(n));

    for (let guard = 0; out.length < n && guard < n * 600; guard++) {
        const p: [number, number] = [lo + Math.random() * (hi - lo), lo + Math.random() * (hi - lo)];
        if (out.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) >= floor)) {
            out.push(p);
            continue;
        }
        if (guard % (n * 20) === (n * 20) - 1) floor *= 0.92;
    }

    // Never a ring, even when the sampler cannot finish: falling back to one
    // would reinstate the regular picture this exists to avoid, at exactly the
    // sizes where the graph is most likely to have a symmetry worth hiding.
    return out.length === n ? out : jitteredGrid(n, margin);
}

/**
 * Cells, shuffled, each node placed loosely inside one.
 *
 * Always terminates and always separates, which rejection sampling does
 * neither of at the tighter sizes. Irregular enough to serve: the jitter is
 * large enough that nodes are not at equal distances from the centre, which is
 * the property that would let a symmetry be read off the picture.
 */
function jitteredGrid(n: number, margin: number): Array<[number, number]> {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const span = 1 - 2 * margin;
    const cw = span / cols, ch = span / rows;

    const cells: Array<[number, number]> = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) cells.push([c, r]);
    }
    for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    // A quarter of a cell each way: enough to look unplanned, little enough
    // that two neighbours cannot close more than half the gap between them.
    const jitter = 0.25;
    return cells.slice(0, n).map(([c, r]) => [
        margin + (c + 0.5 + (Math.random() - 0.5) * 2 * jitter) * cw,
        margin + (r + 0.5 + (Math.random() - 0.5) * 2 * jitter) * ch,
    ] as [number, number]);
}


/**
 * How much a given edge bows, and which way.
 *
 * A *uniform* bow does not solve the problem it was introduced for. Two edges
 * leaving one node at similar angles curve by the same proportion in the same
 * direction, so both arcs shift together and the gap between them is what it
 * always was — measured, 20.3 units apart straight and 20.4 bowed.
 *
 * The magnitude has to differ per edge. Derived from the two node indices so it
 * is stable across redraws, spread over a range wide enough to separate a fan
 * of edges leaving one node, and never zero — a straight edge among curved ones
 * reads as a different kind of thing.
 */
export function bowFor(i: number, j: number): number {
    /*
     * Both signs, not one. Curving every edge the same way moves a fan of them
     * together and leaves the gaps where they were — measured, 20.3 units apart
     * straight and 21.0 bowed. Curving them in opposite directions is what
     * actually opens a fan out.
     */
    const CURVES = [-0.26, 0.13, -0.13, 0.26];
    return CURVES[(i * 5 + j * 11) % CURVES.length];
}

/** Points along an arrow's curve, for measuring how near two of them pass. */
export function samplePath(p: ArrowPath, steps = 24): Array<[number, number]> {
    const [, cx, cy] = /Q ([-\d.]+) ([-\d.]+)/.exec(p.d)!.map(Number);
    return Array.from({ length: steps + 1 }, (_, k) => {
        const t = k / steps, u = 1 - t;
        return [
            u * u * p.from[0] + 2 * u * t * cx + t * t * p.to[0],
            u * u * p.from[1] + 2 * u * t * cy + t * t * p.to[1],
        ] as [number, number];
    });
}

export interface ArrowPath {
    d: string;
    /** Where the line starts and ends after trimming, for checking. */
    from: [number, number];
    to: [number, number];
}

/**
 * One arrow, trimmed clear of both nodes and bowed away from its neighbours.
 *
 * Lives here rather than in the component because it is geometry, and geometry
 * is the part that can be wrong in ways nobody notices by looking — an arrow
 * that points backwards still looks like an arrow.
 *
 * Two things it has to guarantee. The trim is **clamped**: nodes closer
 * together than twice the gap would otherwise leave a segment running
 * backwards, so the arrowhead would sit at the wrong end. And the line **bows**,
 * because straight lines between scattered nodes routinely lie almost on top of
 * one another — three edges leaving a node at similar angles read as one thick
 * line, and which head belongs to which is then unrecoverable. Each edge bows by
 * a fraction of its own length, so near-parallel neighbours separate.
 */
export function arrowPath(
    a: [number, number],
    b: [number, number],
    radius: number,
    headRoom: number,
    bow: number,
): ArrowPath {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;

    const wanted = radius + 3;
    // Leave a shaft even when the two are nearly touching.
    const gap = Math.min(wanted, Math.max(0, (len - headRoom) / 2));

    const from: [number, number] = [a[0] + (dx / len) * gap, a[1] + (dy / len) * gap];
    const to: [number, number] = [b[0] - (dx / len) * gap, b[1] - (dy / len) * gap];

    // Perpendicular to the chord, a fixed fraction of its length.
    const cx = (from[0] + to[0]) / 2 - (to[1] - from[1]) * bow;
    const cy = (from[1] + to[1]) / 2 + (to[0] - from[0]) * bow;

    return { d: `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`, from, to };
}

/**
 * Every arrow of a drawing, curved until no two of them read as one line.
 *
 * Three things had to be got right, and the first two were got wrong first.
 *
 * **A fixed bow does not work.** Two edges leaving one node at similar angles
 * curve by similar amounts in whatever direction their formula gives, and where
 * that direction matches they stay exactly as merged — measured, 20.3 units
 * apart straight and 21.0 bowed. Curvature has to answer to where the *other*
 * edges are, which a formula cannot do.
 *
 * **Not every close pair is a problem.** Arrows that cross at a steep angle are
 * perfectly legible; it is near-parallel ones that fuse into a single thick
 * line with an ambiguous head at each end. Chasing every close approach spends
 * the curvature budget on crossings that never needed it and leaves the real
 * cases uncorrected — which is what the first attempt did, moving 14% of pairs
 * to 12%.
 *
 * So: for each arrow in turn, pick the curvature that best separates it from
 * the ones already placed, counting only near-parallel neighbours. Greedy and
 * deterministic, and it terminates because each edge is decided once.
 */
export function layoutArrows(
    edges: Array<{ from: number; to: number; both: boolean }>,
    at: Array<[number, number]>,
    radius: number,
    headRoom: number,
    minGap = 10,
): Array<{ d: string; both: boolean }> {
    /** Candidate curvatures, nearest to the default first. */
    const CANDIDATES = [0, 0.12, -0.12, 0.2, -0.2, 0.3, -0.3, 0.42, -0.42];

    const chord = (e: { from: number; to: number }) =>
        [at[e.to][0] - at[e.from][0], at[e.to][1] - at[e.from][1]] as [number, number];

    /** Within about twenty-five degrees of parallel, either way round. */
    const nearParallel = (a: [number, number], b: [number, number]) => {
        const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
        return Math.abs((a[0] * b[0] + a[1] * b[1]) / (la * lb)) > 0.9;
    };

    const placed: Array<{ path: ArrowPath; chord: [number, number]; edge: typeof edges[0] }> = [];

    for (const edge of edges) {
        const mine = chord(edge);
        const rivals = placed.filter(p => nearParallel(mine, p.chord));

        let best: ArrowPath | null = null;
        let bestGap = -Infinity;

        for (const extra of CANDIDATES) {
            const path = arrowPath(at[edge.from], at[edge.to], radius, headRoom,
                bowFor(edge.from, edge.to) + extra);

            let gap = Infinity;
            for (const rival of rivals) {
                // Edges sharing a node must meet there, in any drawing; only
                // the rest of their length is worth measuring.
                const shares = edge.from === rival.edge.from || edge.from === rival.edge.to
                    || edge.to === rival.edge.from || edge.to === rival.edge.to;
                gap = Math.min(gap, nearest(path, rival.path, shares ? 8 : 4));
            }

            if (gap > bestGap) { bestGap = gap; best = path; }
            // Good enough: stop before bending further than the crowding costs.
            if (gap >= minGap) break;
        }

        placed.push({ path: best!, chord: mine, edge });
    }

    return placed.map((p, i) => ({ d: p.path.d, both: edges[i].both }));
}

/** How close two arrows pass, ignoring `skip` samples at each end. */
function nearest(a: ArrowPath, b: ArrowPath, skip: number): number {
    const pa = samplePath(a).slice(skip, -skip || undefined);
    const pb = samplePath(b).slice(skip, -skip || undefined);

    let min = Infinity;
    for (const p of pa) {
        for (const q of pb) min = Math.min(min, Math.hypot(p[0] - q[0], p[1] - q[1]));
    }
    return min;
}

/**
 * The clearest of several scatters, judged by what the drawing will look like.
 *
 * `scatterLayout` is structure-blind on purpose: a ring made a rotational
 * symmetry visible as a turn of the picture, and a force-directed layout
 * settles into regular arrangements, both of which hand over structure the mode
 * exists to make you derive from the arrows. That reasoning is sound and this
 * does not undo it — the scatters are still random, and this only picks among
 * them.
 *
 * What it picks on is the one legibility fault a random scatter has: an arrow
 * running under a node it has nothing to do with reads as ending there, and
 * measured over the drawable pairs that was happening to nearly one arrow in
 * five. Scoring only the edges that are actually drawn leaks nothing about the
 * structure into the *positions* — every arrangement remains one the sampler
 * could have produced first time.
 */
export function clearestScatter(
    n: number,
    adj: boolean[][],
    tries = 80,
    margin = 0.12,
): Array<[number, number]> {
    let best = scatterLayout(n, margin);
    let bestScore = obstructions(best, adj);

    /*
     * Eighty rather than a handful, and it stops the moment nothing is
     * obstructed. A scatter costs a few dozen random points, so this is
     * cheap next to generating the item — and the difference is not marginal:
     * measured over real webs it takes obstructed arrows from about 18% to
     * under 3%, where a handful of tries left it at 5%.
     */
    for (let i = 1; i < tries && bestScore > 0; i++) {
        const candidate = scatterLayout(n, margin);
        const score = obstructions(candidate, adj);
        if (score < bestScore) { best = candidate; bestScore = score; }
    }
    return best;
}

/**
 * Arrows that pass under a node which is neither of their ends.
 *
 * Measured in the same units the component draws in, since the radius it uses
 * depends on the node count — a separation that is generous for four nodes is
 * an overlap for twelve.
 */
export function obstructions(layout: Array<[number, number]>, adj: boolean[][]): number {
    const n = layout.length;
    // Mirrors the component's own sizing; see `radius` there.
    const radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(n)))) / 200;
    let count = 0;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (i === j || !adj[i]?.[j]) continue;
            for (let k = 0; k < n; k++) {
                if (k === i || k === j) continue;
                if (pointToSegment(layout[k], layout[i], layout[j]) < radius) { count++; break; }
            }
        }
    }
    return count;
}

/** Perpendicular distance from a point to a segment, clamped to its ends. */
function pointToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
