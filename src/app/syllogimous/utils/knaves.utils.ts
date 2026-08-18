/**
 * Knights and knaves: speakers who always tell the truth or always lie.
 *
 * Structurally unlike everything else in the app. Every other mode composes
 * relations — read a chain, carry a total, answer. This is truth-functional and
 * self-referential: a speaker's *type* decides whether their statement holds,
 * and their statement is about types.
 *
 * The reason it belongs here is that it **generalises the negation modifier**.
 * Negation marks a premise as inverted, and you are told which. Knight/knave
 * makes inversion a hidden property of a speaker, so it has to be deduced first
 * and then applied to everything that speaker said. The same mechanic, one
 * level up.
 *
 * Solved by brute force over all 2^n assignments. That is not a compromise: at
 * six speakers it is sixty-four evaluations, and it is the *definition* of the
 * answer rather than a procedure that computes it, so the generator and the
 * checker cannot drift apart.
 *
 * Pure — no Angular, no storage.
 */

import { hi, subj } from "./phrasing";

/** A statement about who is which. `true` means knight throughout. */
export type Claim =
    | { kind: "is"; who: number; knight: boolean }
    | { kind: "same"; a: number; b: number }
    | { kind: "differ"; a: number; b: number }
    | { kind: "any"; who: number[]; knight: boolean }
    | { kind: "all"; who: number[]; knight: boolean };

/** Whether a claim holds under an assignment of types to speakers. */
export function holds(claim: Claim, world: boolean[]): boolean {
    switch (claim.kind) {
        case "is":     return world[claim.who] === claim.knight;
        case "same":   return world[claim.a] === world[claim.b];
        case "differ": return world[claim.a] !== world[claim.b];
        case "any":    return claim.who.some(i => world[i] === claim.knight);
        case "all":    return claim.who.every(i => world[i] === claim.knight);
    }
}

/**
 * Every assignment in which each speaker's statement matches their type.
 *
 * The whole puzzle in four lines: speaker *i* is a knight exactly when what
 * they said is true, so an assignment is a solution iff that biconditional
 * holds for all of them.
 */
export function solve(claims: Claim[]): boolean[][] {
    const n = claims.length;
    const out: boolean[][] = [];

    for (let mask = 0; mask < (1 << n); mask++) {
        const world = Array.from({ length: n }, (_, i) => (mask & (1 << i)) !== 0);
        if (claims.every((c, i) => world[i] === holds(c, world))) out.push(world);
    }
    return out;
}

/** Speakers whose type is the same in every solution, with that type. */
export function determined(solutions: boolean[][]): Map<number, boolean> {
    const out = new Map<number, boolean>();
    if (!solutions.length) return out;

    for (let i = 0; i < solutions[0].length; i++) {
        const first = solutions[0][i];
        if (solutions.every(s => s[i] === first)) out.set(i, first);
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * Wording                                                             *
 * ------------------------------------------------------------------ */

const KIND = (knight: boolean) => hi(knight ? "knight" : "knave");

/** What the claim says, without the speaker. */
export function describeClaim(claim: Claim, names: string[]): string {
    const name = (i: number) => subj(names[i]);
    const list = (xs: number[]) => xs.map(name).join(" and ");

    switch (claim.kind) {
        case "is":
            return `${name(claim.who)} is a ${KIND(claim.knight)}`;
        case "same":
            return `${name(claim.a)} and ${name(claim.b)} are the same kind`;
        case "differ":
            return `${name(claim.a)} and ${name(claim.b)} are different kinds`;
        case "any":
            return `at least one of ${list(claim.who)} is a ${KIND(claim.knight)}`;
        case "all":
            return `${list(claim.who)} are both ${KIND(claim.knight)}s`;
    }
}

/** "Ash says: Bee is a knave." A speaker talking about themselves says "I". */
export function describeStatement(speaker: number, claim: Claim, names: string[]): string {
    const selfish = claim.kind === "is" && claim.who === speaker;
    const body = selfish
        ? `I am a ${KIND((claim as { knight: boolean }).knight)}`
        : describeClaim(claim, names);
    return `${subj(names[speaker])} says: ${body}`;
}

export const KNAVES_NOTE =
    "Everyone here is a <b>knight</b>, who only ever says true things, or a"
    + " <b>knave</b>, who only ever says false ones. Nobody says which they are"
    + " unless it is in their statement, and a knave saying “I am a"
    + " knight” is still lying about everything else.";
