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

/**
 * Statements that are true exactly when their speaker is a knight.
 *
 * That biconditional is the whole constraint, so it is built in rather than
 * searched for: a claim is drawn, and kept only if its truth in the intended
 * world matches the speaker's type.
 *
 * Lives here rather than in the generator because the *modifier* needs it too —
 * wrapping another mode's premises in speakers is the same puzzle with a
 * spatial question hanging off the answer.
 */
export function drawClaims(world: boolean[], compound: boolean): Claim[] | null {
    const out: Claim[] = [];

    for (let i = 0; i < world.length; i++) {
        const claim = drawFor(i, world, compound);
        if (!claim) return null;
        out.push(claim);
    }
    return out;
}

function drawFor(i: number, world: boolean[], compound: boolean): Claim | null {
    const others = [...Array(world.length).keys()].filter(k => k !== i);

    for (let guard = 0; guard < 60; guard++) {
        const candidate = drawOne(i, others, compound);
        if (!candidate) continue;
        if (holds(candidate, world) === world[i]) return candidate;
    }
    return null;
}

const flip = () => Math.random() < 0.5;

function drawOne(i: number, others: number[], compound: boolean): Claim | null {
    if (!others.length) return null;
    const one = () => others[Math.floor(Math.random() * others.length)];

    const kinds = compound
        ? ["is", "self", "same", "differ", "any", "all"]
        : ["is", "self", "same", "differ"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];

    switch (kind) {
        case "self": return { kind: "is", who: i, knight: flip() };
        case "is":   return { kind: "is", who: one(), knight: flip() };
        case "same":
        case "differ": {
            /*
             * The pair may include the speaker. "X and I are different kinds"
             * is a legitimate and useful statement — a knave saying it claims
             * something false about a pair they are in — and excluding it would
             * drop the whole class of self-involving comparisons.
             */
            const pool = flip() ? [i, ...others] : others;
            if (pool.length < 2) return null;
            const shuffled = shuffleLocal(pool);
            const [a, b] = shuffled;
            return a === b ? null : { kind: kind as "same" | "differ", a, b };
        }
        default: {
            if (others.length < 2) return null;
            return {
                kind: kind as "any" | "all",
                who: shuffleLocal(others).slice(0, 2),
                knight: flip(),
            };
        }
    }
}

function shuffleLocal<T>(xs: T[]): T[] {
    const out = [...xs];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
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

export const TESTIMONY_NOTE =
    "Some facts are stated outright. The rest are <b>reported</b> by people, each"
    + " of whom is a <b>knight</b> who only says true things or a <b>knave</b> who"
    + " only says false ones. Some reports are about things the stated facts"
    + " already settle \u2014 those are the ones you can check. A knave's report"
    + " tells you nothing about the arrangement and must be set aside.";

export const SPEAKERS_NOTE =
    "The relations below are <b>reported</b> by people, and some of them are"
    + " <b>knaves</b> who only say false things. Work out who is lying from what"
    + " they say about each other; what a knave reports about the arrangement is"
    + " false, so it tells you nothing and must be set aside.";

export const KNAVES_NOTE =
    "Everyone here is a <b>knight</b>, who only ever says true things, or a"
    + " <b>knave</b>, who only ever says false ones. Nobody says which they are"
    + " unless it is in their statement, and a knave saying “I am a"
    + " knight” is still lying about everything else.";
