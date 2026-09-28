/**
 * Minimal Premises — which of these were actually needed.
 *
 * Isomorph's guide: *"The premises settle how two entities stand, and most of
 * them are not needed for it. Select the smallest set of premises that on its
 * own still settles the pair in every direction — one route per direction,
 * sharing premises where it can. There is exactly one smallest set."*
 *
 * Every other mode in this app asks what the premises settle. This asks which
 * of them did the settling, which is a different question about the same
 * material and a harder one: a premise that is consistent with the answer is
 * not thereby part of the reason for it, and telling those apart means working
 * out what would still follow without each one.
 *
 * ── Why the floor is honest here ──
 *
 * The other two Incompleteness modes say "exactly one", which makes a guess one
 * in `n` rather than one in `2^n` — the answer space a reader can actually
 * search is the premises, not the subsets of them. This one says "the smallest
 * set", and a set is what the player picks: knowing it is minimal does not
 * narrow which subset it is, so `guessRateFor("select", …)` prices it right
 * without help.
 *
 * ── What makes an item well-formed ──
 *
 * The full premise set settles the pair, or there is nothing to pare down. The
 * smallest sufficient subset is unique — found by trying every subset from the
 * smallest up, which is what makes "there is exactly one smallest set" a
 * checked claim rather than a hope — and it is strictly smaller than the whole,
 * or the item asks the player to select everything.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates, settledBy,
} from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { INVENTED } from "./possibility";

type Fact = { a: number; b: number; holds: boolean };

/**
 * The smallest subsets of `facts` that still settle the pair, smallest first.
 *
 * Every subset, in size order, stopping at the first size that works — so the
 * result is either one subset (the item is usable) or several (it is not, and
 * "there is exactly one smallest set" would be a lie on the card).
 */
function smallestSufficient(
    system: RelationSystem,
    n: number,
    facts: Fact[],
    x: number,
    y: number,
): number[][] {
    const total = facts.length;
    for (let size = 1; size <= total; size++) {
        const found: number[][] = [];
        const walk = (at: number, chosen: number[]) => {
            if (chosen.length === size) {
                const kept = chosen.map(i => facts[i]);
                if (settledBy(system, consistentStates(system, n, kept), x, y) !== null) {
                    found.push([...chosen]);
                }
                return;
            }
            for (let i = at; i < total; i++) walk(i + 1, [...chosen, i]);
        };
        walk(0, []);
        if (found.length) return found;
    }
    return [];
}

export function createMinimalPremises(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createMinimalPremises");

    const type = EnumQuestionType.MinimalPremises;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    /* Relations that chain, so a route through the premises is what settles a
       pair. On one that does not chain, every pair is settled by the premise
       that names it and there is nothing to pare down. */
    const usable = ALL_SYSTEMS.filter(s => s.meaning.includes("chains")
        && !s.meaning.includes("does not chain"));

    for (let attempt = 0; attempt < 300; attempt++) {
        const system = pickUniqueItems(usable, 1).picked[0];
        const n = Math.min(system.maxN, 5);
        const words = getRandomSymbols(settings, n);
        if (new Set(words).size !== n) continue;

        const every = system.states(n);
        if (!every.length) continue;
        const truth = every[Math.floor(Math.random() * every.length)];

        const pairs: Array<[number, number]> = [];
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) pairs.push([a, b]);

        const [x, y] = pickUniqueItems(pairs, 1).picked[0];
        const speakable = pairs.filter(([a, b]) =>
            !(a === x && b === y) && !(a === y && b === x));

        const drawn = pickUniqueItems(speakable, Math.min(numOfPremises, speakable.length)).picked;
        const facts: Fact[] = drawn.map(([a, b]) => ({ a, b, holds: system.holds(truth, a, b) }));

        /* The whole set has to settle it, or there is nothing to pare down. */
        if (settledBy(system, consistentStates(system, n, facts), x, y) === null) continue;

        const smallest = smallestSufficient(system, n, facts, x, y);
        if (smallest.length !== 1) continue;            // "exactly one smallest set"
        const answer = smallest[0];
        if (answer.length >= facts.length) continue;    // nothing was spare

        const word = INVENTED[Math.floor(Math.random() * INVENTED.length)];
        const line = (f: Fact) => f.holds
            ? `${subj(words[f.a])} ${rel(word.third)} ${subj(words[f.b])}`
            : `${subj(words[f.a])} does not ${rel(word.stem)} ${subj(words[f.b])}`;

        const question = new Question(type);
        question.bucket = [...words];
        /*
         * The premises are the options, so they are not shown twice. Listing
         * them above the buttons that repeat them doubles the height of the
         * card for nothing — the same reasoning the choice modes already
         * follow.
         */
        question.premises = facts.map(line);
        question.choices = facts.map(line);
        question.selectAnswer = [...answer].sort((p, q) => p - q);
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select the smallest set that still settles it.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `<b>${hi(word.third)}</b> is ${system.meaning}.`,
            `Together these settle how ${subj(words[x])} and ${subj(words[y])} stand, and `
            + "most of them are not needed for it. Select the <b>smallest</b> set that still "
            + "settles the pair on its own. There is exactly one.",
        ];

        question.explanation = [
            `${hi(String(answer.length))} of the ${facts.length} settle it between them:`,
            ...answer.map(i => line(facts[i])),
            `every smaller set leaves ${subj(words[x])} and ${subj(words[y])} open, and the `
            + `rest of the premises are true without bearing on them`,
        ];

        return question;
    }

    throw new Error("Cannot generate.");
}
