/**
 * How far apart two graphs are, and which of several does not belong.
 *
 * Graph edit distance is NP-hard in general and isomorphism is not known to be
 * in P, but neither fact bites at the sizes here: the distance is the minimum
 * over all vertex bijections of the number of disagreeing pairs, which is 5,040
 * bijections at seven nodes and 40,320 at eight. Past that it is unusable, so
 * the cap is explicit and enforced rather than assumed.
 *
 * **The trap worth stating in the code.** Applying *k* changes to a graph does
 * not mean the distance is *k*. Two changes can partially cancel — reverse an
 * edge, then reverse it back somewhere the relabelling makes equivalent — and a
 * bijection other than the one used to build the pair may line the graphs up
 * more cheaply. A generator that trusted the number of edits it made would
 * confidently mark correct answers wrong, so the distance is *searched for*
 * every time, never assumed.
 *
 * Pure — no Angular, no storage.
 */

export type GraphEdge = [string, "↔" | "→" | "←", string];

/** Past this, the factorial search stops being affordable. */
export const MAX_DISTANCE_NODES = 8;

/**
 * What holds between one unordered pair, as a single value.
 *
 * 0 nothing, 1 first to second, 2 second to first, 3 both ways. Collapsing a
 * pair to one state is what makes the distance a plain count of disagreements
 * rather than a sum over separately-directed slots, where reversing an edge
 * would cost two.
 */
export type PairState = 0 | 1 | 2 | 3;

export function nodesOf(edges: GraphEdge[]): string[] {
    const out = new Set<string>();
    for (const [a, , b] of edges) { out.add(a); out.add(b); }
    return [...out].sort();
}

/** Every pair's state, keyed by the two node *indices* in `nodes`. */
export function stateMap(edges: GraphEdge[], nodes: string[]): Map<string, PairState> {
    const index = new Map(nodes.map((n, i) => [n, i]));
    const out = new Map<string, PairState>();

    for (const [a, rel, b] of edges) {
        const [i, j] = [index.get(a)!, index.get(b)!];
        if (i === undefined || j === undefined || i === j) continue;

        const [lo, hi] = i < j ? [i, j] : [j, i];
        const key = `${lo}|${hi}`;
        const forward = i < j;

        let add: PairState;
        if (rel === "↔") add = 3;
        else if (rel === "→") add = forward ? 1 : 2;
        else add = forward ? 2 : 1;

        out.set(key, ((out.get(key) ?? 0) | add) as PairState);
    }
    return out;
}

/**
 * The fewest relation changes that would make the two identical.
 *
 * Null when either side is too big to search, which callers must handle rather
 * than treat as zero — a silent zero would be a claim of isomorphism.
 */
export function editDistance(a: GraphEdge[], b: GraphEdge[]): number | null {
    const nodesA = nodesOf(a);
    const nodesB = nodesOf(b);
    if (nodesA.length !== nodesB.length) return null;
    if (nodesA.length > MAX_DISTANCE_NODES) return null;

    const stateA = stateMap(a, nodesA);
    const stateB = stateMap(b, nodesB);

    let best = Infinity;

    // Every bijection from A's nodes to B's, as a permutation of indices.
    permutations(nodesA.length, perm => {
        let cost = 0;
        for (let i = 0; i < nodesA.length && cost < best; i++) {
            for (let j = i + 1; j < nodesA.length; j++) {
                const here = stateA.get(`${i}|${j}`) ?? 0;
                const [pi, pj] = [perm[i], perm[j]];
                const [lo, hi] = pi < pj ? [pi, pj] : [pj, pi];
                let there = stateB.get(`${lo}|${hi}`) ?? 0;

                // The pair's state is written low-index-first, so a bijection
                // that swaps their order flips the two one-way readings.
                if (pi > pj && (there === 1 || there === 2)) there = there === 1 ? 2 : 1;

                if (here !== there) {
                    cost++;
                    if (cost >= best) break;
                }
            }
        }
        if (cost < best) best = cost;
        // Nothing beats nought, so stop as soon as it is reached.
        return best > 0;
    });

    return best === Infinity ? null : best;
}

/** Isomorphic exactly when nothing has to change. */
export function isomorphicByDistance(a: GraphEdge[], b: GraphEdge[]): boolean {
    return editDistance(a, b) === 0;
}

/**
 * Which of several graphs is not isomorphic to the rest, or null.
 *
 * Null covers both "they all match" and "more than one differs", because either
 * makes "which one differs?" a question without an answer.
 */
export function oddGraphOut(graphs: GraphEdge[][]): number | null {
    const odd: number[] = [];

    for (let i = 0; i < graphs.length; i++) {
        const others = graphs.filter((_, j) => j !== i);
        const matchesNone = others.every(g => !isomorphicByDistance(graphs[i], g));
        if (matchesNone) odd.push(i);
    }

    if (odd.length !== 1) return null;

    // And the rest really do agree, or "the odd one" is just the loneliest of
    // several groups.
    const rest = graphs.filter((_, j) => j !== odd[0]);
    const allMatch = rest.every(g => isomorphicByDistance(g, rest[0]));
    return allMatch ? odd[0] : null;
}

/** Visit permutations of 0..n-1; `visit` returns false to stop early. */
function permutations(n: number, visit: (perm: number[]) => boolean) {
    const perm = [...Array(n).keys()];
    let running = true;

    const step = (k: number) => {
        if (!running) return;
        if (k === n) { running = visit(perm); return; }
        for (let i = k; i < n && running; i++) {
            [perm[k], perm[i]] = [perm[i], perm[k]];
            step(k + 1);
            [perm[k], perm[i]] = [perm[i], perm[k]];
        }
    };

    step(0);
}
