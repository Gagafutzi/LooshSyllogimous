/**
 * How much of an item has to be held together at once.
 *
 * The difficulty model prices premise count and, once fitted, width and depth.
 * Those are three different things and none of them is a fourth: how many
 * separate pieces of structure the reader is carrying, and how many of them one
 * premise joins in a single step.
 *
 * Both are properties of the *order the premises are shown in*, not of the
 * layout behind them, which is why they belong here rather than in any one
 * generator. Scramble decides them and currently measures neither.
 *
 * Pure. Reads the rendered card, because that is what the reader sees — a
 * measurement taken from the layout would describe an item nobody was shown.
 */

/**
 * Objects are wrapped by `subj`, and the span shape is a contract several other
 * readers already depend on. Matched here rather than imported so this file
 * stays free of the generator machinery.
 */
const SUBJECT = /<span class="subject">([\s\S]*?)<\/span>/g;

export function subjectsOf(html: string): string[] {
    SUBJECT.lastIndex = 0;
    return [...html.matchAll(SUBJECT)].map(m => m[1]);
}

export interface IntegrationLoad {
    /**
     * Distinct groups the heaviest premise welds together.
     *
     * Bounded by how many objects a premise names: two for every ordinary
     * relation, three for a wide premise, four for a meta one. This is the
     * naive count, and it says what the premise *form* allows.
     */
    arity: number;
    /**
     * Of those, how many were already structures rather than single objects.
     *
     * The distinction the naive count misses. A premise naming three objects
     * welds three groups when all three are new — which is an introduction, and
     * nothing was integrated — and welds three when each was already part of
     * something held, which is the demand worth measuring. Order decides which,
     * so `arity` alone can be satisfied by scheduling the easy case.
     */
    integration: number;
    /**
     * Peak number of part-built structures carried at once.
     *
     * Counted as components of two or more objects: a name you have been told
     * nothing about yet is not something you are holding. A chain read in order
     * never exceeds one; a scrambled one opens fragments that cannot be joined
     * until a later premise bridges them.
     */
    openGroups: number;
}

/**
 * Walk the premises in the order they are shown, joining as we go.
 *
 * Premises naming fewer than two objects are skipped rather than counted as
 * nothing: a setup line, a transformation applied to the whole space, or a
 * report about a speaker states no relation between two named things and has no
 * groups to weld.
 */
export function integrationLoad(premises: string[]): IntegrationLoad {
    const parent = new Map<string, string>();
    const size = new Map<string, number>();

    const find = (x: string): string => {
        if (!parent.has(x)) { parent.set(x, x); size.set(x, 1); return x; }
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r)!;
        // Path compression, so a long chain of premises does not make this
        // quadratic on the modes that state the most of them.
        let n = x;
        while (parent.get(n) !== r) { const up = parent.get(n)!; parent.set(n, r); n = up; }
        return r;
    };

    let arity = 0, integration = 0, openGroups = 0;

    for (const premise of premises) {
        const names = subjectsOf(premise);
        if (names.length < 2) continue;

        const roots = [...new Set(names.map(find))];
        // Nothing is welded when a premise restates a pair already connected.
        if (roots.length < 2) continue;

        arity = Math.max(arity, roots.length);
        integration = Math.max(integration,
            roots.filter(r => (size.get(r) ?? 1) > 1).length);

        const into = roots[0];
        for (const r of roots.slice(1)) {
            parent.set(r, into);
            size.set(into, (size.get(into) ?? 1) + (size.get(r) ?? 1));
        }

        let open = 0;
        for (const [node, root] of parent) {
            if (node === root && (size.get(root) ?? 1) > 1) open++;
        }
        openGroups = Math.max(openGroups, open);
    }

    return { arity, integration, openGroups };
}
