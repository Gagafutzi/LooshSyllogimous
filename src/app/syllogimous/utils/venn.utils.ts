/**
 * A syllogism as three circles.
 *
 * The mode's premises are served in the same stacked list every other mode
 * uses — subject, relation, object, one per line — and that layout *is* a
 * chain. It is how the scale modes state "A is above B, B is above C", so the
 * eye walks it expecting each premise to compose onto the last. A syllogism is
 * not a chain: it is two statements about class membership sharing a middle
 * term, and no amount of reordering the sentences makes a list stop looking
 * like one.
 *
 * Overlap, exclusion and the existential dot are the entire content of a
 * syllogism, and they are exactly what a sentence list cannot show. This is the
 * standard Venn test, which is a decision procedure rather than an
 * illustration: shade what the universal premises say is empty, mark what the
 * particular ones say exists, and the conclusion follows exactly when the
 * picture already shows it.
 *
 * Pure geometry-free set arithmetic. The component turns regions into shapes.
 */

import { SylKind, SylPremise } from "../models/syllogism.models";

/** The three roles a term can play. `m` is the middle: in both premises. */
export type Role = "s" | "p" | "m";

/**
 * One of the seven regions, named by which circles contain it.
 *
 * The eighth — outside all three — is the rest of the world and is never drawn:
 * nothing a syllogism says constrains it.
 */
export interface Region {
    s: boolean;
    p: boolean;
    m: boolean;
    /** "spm", "sp", "m" … the circles this region is inside, in fixed order. */
    key: string;
}

export const REGIONS: Region[] = [
    { s: true, p: false, m: false, key: "s" },
    { s: false, p: true, m: false, key: "p" },
    { s: false, p: false, m: true, key: "m" },
    { s: true, p: true, m: false, key: "sp" },
    { s: true, p: false, m: true, key: "sm" },
    { s: false, p: true, m: true, key: "pm" },
    { s: true, p: true, m: true, key: "spm" },
];

export interface VennMark {
    /**
     * Where the thing that exists could be.
     *
     * One region means the premises pin it down. Two means they do not, and the
     * mark sits on the boundary between them — which is the standard notation
     * and not a cosmetic choice: a dot placed in one of the two would assert
     * something the premises never said, and the whole use of the diagram is
     * that it says exactly as much as they do.
     */
    regions: string[];
}

export interface VennDiagram {
    /** Regions the universal premises say are empty. */
    shaded: string[];
    /** Things the particular premises say exist. */
    marks: VennMark[];
    /** Which term took which role, for the labels. */
    roles: Record<Role, string>;
    /**
     * Premises that could not be drawn.
     *
     * Empty in every case the generator produces. A term outside the three
     * roles would mean this is not a syllogism, and silently dropping the
     * premise would draw a picture that says less than the item does — the one
     * failure a decision procedure must not have.
     */
    undrawn: SylPremise[];
}

const has = (region: Region, role: Role) => region[role];

/**
 * Build the diagram.
 *
 * Universals are applied before particulars, which is the standard order and is
 * load-bearing rather than conventional: shading can close off one of the two
 * places a particular might go, and applying them the other way round would
 * leave a mark straddling a region already known to be empty.
 */
export function vennFor(
    premises: SylPremise[],
    roles: Record<Role, string>,
): VennDiagram {
    const roleOf = (term: string): Role | null =>
        (Object.keys(roles) as Role[]).find(r => roles[r] === term) ?? null;

    const shaded = new Set<string>();
    const marks: VennMark[] = [];
    const undrawn: SylPremise[] = [];

    const drawable: Array<{ a: Role; kind: SylKind; b: Role }> = [];
    for (const [aTerm, kind, bTerm] of premises) {
        const a = roleOf(aTerm), b = roleOf(bTerm);
        if (!a || !b) { undrawn.push([aTerm, kind, bTerm]); continue; }
        drawable.push({ a, kind, b });
    }

    for (const { a, kind, b } of drawable) {
        if (kind === "all") {
            // Everything in A is in B, so A outside B is empty.
            for (const r of REGIONS) if (has(r, a) && !has(r, b)) shaded.add(r.key);
        } else if (kind === "no") {
            for (const r of REGIONS) if (has(r, a) && has(r, b)) shaded.add(r.key);
        }
    }

    for (const { a, kind, b } of drawable) {
        if (kind !== "some" && kind !== "some_not") continue;
        const wanted = REGIONS.filter(r =>
            has(r, a) && (kind === "some" ? has(r, b) : !has(r, b)));
        const open = wanted.filter(r => !shaded.has(r.key)).map(r => r.key);
        /*
         * Nowhere left to put it means the premises contradict each other. The
         * generator does not build those, and drawing nothing is the honest
         * response if one ever arrives — an empty diagram is visibly wrong,
         * where a mark in a shaded region is quietly wrong.
         */
        if (open.length) marks.push({ regions: open });
    }

    return { shaded: [...shaded], marks, roles, undrawn };
}

/**
 * Which term is the middle, given what the conclusion asks about.
 *
 * The middle term is the one the premises share and the conclusion never
 * mentions — that is the definition, and it is also the thing a reader has to
 * find before the item can be started. Naming it is half the explanation.
 */
export function rolesFor(
    premises: SylPremise[],
    conclusion: SylPremise,
): Record<Role, string> | null {
    const [s, , p] = conclusion;
    const others = new Set<string>();
    for (const [a, , b] of premises) for (const t of [a, b]) {
        if (t !== s && t !== p) others.add(t);
    }
    if (others.size !== 1) return null;
    return { s, p, m: [...others][0] };
}
