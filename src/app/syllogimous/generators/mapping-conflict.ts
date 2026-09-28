/**
 * Mapping Conflict — the analogy that breaks the pairing.
 *
 * Isomorph's guide: *"Each analogy 'A is to B as P is to Q' pairs A with P and
 * B with Q. Together the analogies must give every entity one counterpart and no
 * counterpart two entities. One of them breaks the pairing the rest agree on:
 * find it."*
 *
 * The cheapest mode in the imported band and not the shallowest, because it
 * needs no relation at all. Every other mode here asks what some relation
 * settles; this asks what a set of *correspondences* settles, and the only rule
 * in play is that a counterpart is one thing. What the analogies say about their
 * entities never comes into it — an analogy is read here purely as the pairing
 * it implies, which is why an item can be built and checked without a single
 * arrangement being enumerated.
 *
 * The skill is the one a translation, a schema migration or a merge needs: two
 * vocabularies, a pile of local claims about which term answers to which, and
 * one of them quietly disagreeing with the rest.
 *
 * ── The same shape as Contradiction, over pairings ──
 *
 * The premises are the options, for the same reason and under the same
 * exemption: every one is a sentence of identical form over the same two
 * vocabularies, so nothing can be dismissed at a glance, and narrowing the menu
 * would do the finding the mode exists for. `guessRateFor("choice", 0, n)` is
 * `1/n` and prices it.
 *
 * ── What makes an item well-formed ──
 *
 * Built from a real bijection, then one analogy is re-pointed at the wrong
 * counterpart. Three claims, all checked against what came out: the pairings
 * cannot all hold, withdrawing the marked analogy leaves a set that can, and
 * withdrawing any *other* one leaves the clash. The third is the one that needs
 * checking — a disagreement between exactly two analogies is repaired by
 * dropping either of them, and the card would then be marking one of two right
 * answers wrong.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { PAIR_RELATION_WORDS, hi, own, rel, subj } from "../utils/phrasing";
import { GeneratorContext } from "./context";

/** One analogy: `a` is to `b` as `p` is to `q`, over the two vocabularies. */
interface Claim { a: number; b: number; p: number; q: number; }

/** A pairing an analogy implies: this name on the left answers to that one. */
type Link = [number, number];

const linksOf = (c: Claim): Link[] => [[c.a, c.p], [c.b, c.q]];

/**
 * Whether a set of pairings can all hold at once.
 *
 * The only rule the mode has: a name has one counterpart, and a counterpart
 * answers to one name. Stated as both directions rather than one, because a
 * single map keyed by the left name would accept two names claiming the same
 * counterpart — which is half the conflicts the mode produces, and the half
 * that reads as "these two both say they are the same thing".
 */
function pairs(claims: Claim[]): boolean {
    const right = new Map<number, number>();
    const left = new Map<number, number>();
    for (const c of claims) {
        for (const [l, r] of linksOf(c)) {
            const already = right.get(l);
            if (already !== undefined && already !== r) return false;
            const claimed = left.get(r);
            if (claimed !== undefined && claimed !== l) return false;
            right.set(l, r);
            left.set(r, l);
        }
    }
    return true;
}

export function createMappingConflict(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createMappingConflict");

    const type = EnumQuestionType.MappingConflict;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    for (let attempt = 0; attempt < 300; attempt++) {
        /*
         * Four names a side. Three leaves only six ordered pairs to draw
         * analogies from, so the premises repeat themselves before the count is
         * met; five is twenty, and the pairings then spread so thin that most
         * draws have nothing to clash with.
         */
        const k = 4;
        const words = getRandomSymbols(settings, 2 * k);
        if (new Set(words).size !== 2 * k) continue;

        const left = words.slice(0, k).map((_, i) => i);
        const right = words.slice(k).map((_, i) => k + i);

        /* The pairing the item is built from, and the one the player recovers. */
        const shuffled = shuffle([...right]);
        const counterpart = new Map(left.map((l, i) => [l, shuffled[i]]));

        const ordered: Array<[number, number]> = [];
        for (const a of left) for (const b of left) if (a !== b) ordered.push([a, b]);

        const wanted = Math.min(numOfPremises, ordered.length);
        const drawn = pickUniqueItems(ordered, wanted).picked;
        if (drawn.length < 4) continue;

        const claims: Claim[] = drawn.map(([a, b]) => ({
            a, b, p: counterpart.get(a)!, q: counterpart.get(b)!,
        }));

        /* One analogy re-pointed: its second half now names somebody else's
           counterpart, so that name answers to two things at once. */
        const wrong = Math.floor(Math.random() * claims.length);
        const others = right.filter(r => r !== claims[wrong].q && r !== claims[wrong].p);
        if (!others.length) continue;
        claims[wrong] = {
            ...claims[wrong],
            q: others[Math.floor(Math.random() * others.length)],
        };

        const without = (i: number) => claims.filter((_, j) => j !== i);

        /*
         * The three claims the card makes.
         *
         * Only the third has teeth — a set that still pairs, or one no single
         * withdrawal repairs, is caught by it anyway. Kept as the cheap exits
         * before the walk, and said here rather than claimed as tested.
         */
        if (pairs(claims)) continue;
        if (!pairs(without(wrong))) continue;
        if (claims.some((_, i) => i !== wrong && pairs(without(i)))) continue;

        const line = (c: Claim) =>
            `${subj(words[c.a])} ${own("pair-to")} ${subj(words[c.b])} `
            + `${rel(PAIR_RELATION_WORDS.same)} `
            + `${subj(words[c.p])} ${own("pair-to")} ${subj(words[c.q])}`;

        const question = new Question(type);
        question.bucket = [...words];
        /* Shown once, as the premises and the buttons both — and here the
           option has to be recognisably the same sentence as the premise, since
           answering means withdrawing that premise rather than picking a claim
           about something else. */
        const shown = shuffle([...claims.keys()]);
        const lines = shown.map(i => line(claims[i]));
        /* Not run through `orderPremises`: the shuffle above is the ordering,
           and scrambling the premises again would leave the buttons in a
           different order from the list they are meant to be. */
        question.premises = lines;
        question.choices = [...lines];
        question.correctChoice = shown.indexOf(wrong);
        question.answerMode = "choice";
        question.choicePrompt = "Which analogy breaks the pairing?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "Each of these says one pair stands as another does, which makes the first "
            + "name answer to the third and the second to the fourth.",
            `Together they must give every name <b>one</b> counterpart, and no counterpart `
            + `two names. Exactly ${hi("one")} of them breaks the pairing the rest agree on.`,
        ];

        question.explanation = explain(claims, words, wrong);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why that analogy and not another.
 *
 * Written as the disagreement itself — what the rest make of a name, and what
 * this one makes of it — because that is what a player who found it would have
 * found. Naming the withdrawal instead would describe the test rather than the
 * answer.
 */
function explain(claims: Claim[], words: string[], wrong: number): string[] {
    const rest = claims.filter((_, i) => i !== wrong);
    const agreed = new Map<number, number>();
    for (const c of rest) for (const [l, r] of linksOf(c)) agreed.set(l, r);

    const broken = linksOf(claims[wrong]).filter(([l, r]) => {
        const settled = agreed.get(l);
        return settled !== undefined && settled !== r;
    });
    const claimed = linksOf(claims[wrong]).filter(([l, r]) =>
        [...agreed].some(([l2, r2]) => r2 === r && l2 !== l));

    const lines = [
        `the other ${rest.length} agree with each other throughout`,
    ];
    for (const [l, r] of broken) {
        lines.push(`they make ${subj(words[l])} answer to `
            + `${subj(words[agreed.get(l)!])}, and this one makes it answer to `
            + `${hi(words[r])}`);
    }
    for (const [l, r] of claimed) {
        const rival = [...agreed].find(([l2, r2]) => r2 === r && l2 !== l)!;
        lines.push(`and ${subj(words[r])} is already ${subj(words[rival[0]])}'s `
            + `counterpart, so it cannot be ${subj(words[l])}'s as well`);
    }
    lines.push("withdrawing any other one instead leaves the clash where it was");
    return lines;
}
