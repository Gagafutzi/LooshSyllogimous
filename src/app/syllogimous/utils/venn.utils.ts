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

/**
 * The diagram for a claim, or nothing if the item is not three circles.
 *
 * `support` is the premises that actually force the answer — everything else in
 * the item is a distractor, and shading from one would shade a region the
 * answer does not turn on. Callers that have already computed it pass it in;
 * the rest get the whole set and should not.
 */
export function vennDiagramFor(
    support: SylPremise[],
    claim: SylPremise,
): VennDiagram | undefined {
    const roles = rolesFor(support, claim);
    if (!roles) return undefined;
    const diagram = vennFor(support, roles);
    /*
     * All or nothing. A diagram missing one premise is not a weaker diagram, it
     * is a wrong one: the Venn test decides by what is *not* shaded, so an
     * un-drawn premise shows a region as open that the item closed.
     */
    return diagram.undrawn.length ? undefined : diagram;
}

/**
 * The syllogistic order, and the term that joins the two premises.
 *
 * A syllogism is read major premise, minor premise, conclusion, and the middle
 * term is what joins them. The derivation listed the load-bearing premises in
 * whatever order the search left them, so the reader had to find the middle
 * term before the argument could be followed at all — and nothing said which
 * term it was.
 *
 * Major first: the premise carrying the conclusion's predicate. That is the
 * convention, and it is the useful one, because the conclusion is read
 * subject-to-predicate and the argument then runs backwards through the middle
 * to meet it.
 */
export function inSyllogisticOrder(
    support: SylPremise[],
    roles: Record<Role, string>,
): SylPremise[] {
    const carries = (p: SylPremise, term: string) => p[0] === term || p[2] === term;
    const major = support.filter(p => carries(p, roles.p));
    const minor = support.filter(p => !carries(p, roles.p));
    return [...major, ...minor];
}

/**
 * What each premise does to the picture, and what the picture then shows.
 *
 * The first version of this was a mood table — one sentence per pair of
 * quantifiers — and it was wrong, quietly, in half the figures. "All X is M"
 * and "All M is X" carry the same pair of quantifiers and say different things,
 * so a sentence keyed on the quantifiers alone described whichever figure it
 * was written against and misdescribed the other three. It read plausibly,
 * which is the worst way for an explanation to be wrong.
 *
 * Read off the diagram instead. Each premise's effect is stated in its own
 * terms, and the conclusion is read by the same rule the Venn test uses:
 * the claim follows exactly when the picture already shows it. That is correct
 * in every figure by construction, and it teaches the method rather than a
 * result — someone who follows it once can work the next one out.
 */
export function nameTheInference(
    support: SylPremise[],
    diagram: VennDiagram,
    say: (term: string) => string,
): string[] {
    const lines = support.map(([a, kind, b]) => {
        const A = say(a), B = say(b);
        switch (kind) {
            case "all":
                return `<b>All ${A} is ${B}</b> empties every part of ${A} outside ${B}.`;
            case "no":
                return `<b>No ${A} is ${B}</b> empties the overlap of ${A} and ${B}.`;
            case "some":
                return `<b>Some ${A} is ${B}</b> puts something in the overlap of`
                    + ` ${A} and ${B}.`;
            default:
                return `<b>Some ${A} is not ${B}</b> puts something in ${A},`
                    + ` outside ${B}.`;
        }
    });

    const read = readOff(diagram, say);
    if (read) lines.push(read);
    return lines;
}

/** The overlap of the conclusion's two terms, and the part of S outside P. */
const OVERLAP = ["sp", "spm"];
const S_ONLY = ["s", "sm"];

/**
 * What the finished picture says about the conclusion's two terms.
 *
 * This is the Venn test itself: shading says a region is empty, a mark says
 * something is in it, and anything neither shaded nor marked is *open* — which
 * is the reading the mode had no way to express and reported as plain "false".
 */
function readOff(d: VennDiagram, say: (term: string) => string): string | null {
    const S = say(d.roles.s), P = say(d.roles.p);
    const shaded = new Set(d.shaded);
    const inside = (regions: string[], where: string[]) =>
        regions.length > 0 && regions.every(r => where.includes(r));

    if (OVERLAP.every(r => shaded.has(r))) {
        return `That leaves nothing at all in the overlap of ${S} and ${P}:`
            + ` <b>no ${S} is ${P}</b>.`;
    }
    if (S_ONLY.every(r => shaded.has(r))) {
        return `That leaves no part of ${S} outside ${P}:`
            + ` <b>all ${S} is ${P}</b>.`;
    }
    for (const mark of d.marks) {
        if (inside(mark.regions, OVERLAP)) {
            return `The thing that must exist lands in the overlap:`
                + ` <b>some ${S} is ${P}</b>.`;
        }
        if (inside(mark.regions, S_ONLY)) {
            return `The thing that must exist lands in ${S} and outside ${P}:`
                + ` <b>some ${S} is not ${P}</b>.`;
        }
    }
    /*
     * Neither settled. Worth saying outright, because "the premises leave this
     * open" and "the premises rule this out" both come back as a wrong answer
     * and are not the same mistake.
     */
    return `Nothing is shaded or marked across the whole of ${S} against ${P},`
        + ` so the premises leave it open either way.`;
}
