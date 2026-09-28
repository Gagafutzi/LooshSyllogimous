/**
 * Missing Premise — which further fact would settle it.
 *
 * Isomorph's guide: *"Premises name only some directions, so a pair can be
 * settled on one axis and open on another. Of four further true statements,
 * exactly one would settle the named pair in every direction: find it. The
 * others help somewhere, just not where it is needed."*
 *
 * The third question this family asks about the same material. Possibility Sets
 * asks what the premises leave open; Minimal Premises asks which of them did
 * the settling; this asks what is *absent* — what one more fact would have to
 * say for an open pair to close. Being able to name the gap is what tells
 * reading an argument apart from following one.
 *
 * ── Two candidates, not four ──
 *
 * Isomorph offers four. This offers two, because the reason for the house rule
 * lands squarely on four here rather than glancing off it: a menu of four
 * statements about four different pairs is exactly the case where three go
 * without being reasoned about, dismissed for not naming the entities in the
 * question. Two candidates that both name relevant entities have nothing to be
 * dismissed for, so the item is answered by working out what each would close
 * rather than by reading which is on topic. The floor is one in two instead of
 * one in four, which makes the item harder rather than easier.
 *
 * ── What makes an item well-formed ──
 *
 * The pair asked about is open on the premises alone, or there is no gap. Both
 * candidates are true of the arrangement the premises came from, so neither can
 * be rejected for being false — the question is what they *settle*, not whether
 * they hold. Adding the answer closes the pair; adding the other does not.
 *
 * And the other one is not inert: it closes some pair the premises had left
 * open, just not this one. Without that check a distractor could be a fact that
 * bears on nothing at all, and the item would be solved by finding the
 * statement that does anything rather than the statement that does this.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates, settledBy,
} from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { CHAINING } from "./contradiction";
import { INVENTED } from "./possibility";

type Fact = { a: number; b: number; holds: boolean };

/** Whether the facts, taken together, decide how `x` stands to `y`. */
const settles = (system: RelationSystem, n: number, facts: Fact[], x: number, y: number) =>
    settledBy(system, consistentStates(system, n, facts), x, y) !== null;

export function createMissingPremise(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createMissingPremise");

    const type = EnumQuestionType.MissingPremise;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    const usable = ALL_SYSTEMS.filter(CHAINING);

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

        /* Fewer premises than the count asks for: the rest of the budget is the
           two candidates, which are premises the player is offered rather than
           given. */
        const wanted = Math.min(Math.max(2, numOfPremises - 2), speakable.length - 2);
        const drawn = pickUniqueItems(speakable, wanted).picked;
        const facts: Fact[] = drawn.map(([a, b]) => ({ a, b, holds: system.holds(truth, a, b) }));

        /*
         * Open on the premises alone, or the item has no gap to name.
         *
         * Redundant rather than tested: a settled pair stays settled whatever is
         * added, so no candidate would pass the distractor filter below and the
         * draw would be rejected there. Kept as the cheap exit, and said here.
         */
        if (settles(system, n, facts, x, y)) continue;

        const spare = speakable.filter(([a, b]) =>
            !drawn.some(([c, d]) => c === a && d === b));
        const offers: Fact[] = spare.map(([a, b]) => ({ a, b, holds: system.holds(truth, a, b) }));

        /*
         * Any one of these would close the pair, and the card's "exactly one of
         * the two" is about the two offered rather than about the spares — so
         * there is nothing to reject here. Isomorph, offering four, does need
         * the stronger condition; requiring it of two candidates would only
         * narrow the draw to a rarer shape for no claim it makes true.
         */
        const closing = offers.filter(f => settles(system, n, [...facts, f], x, y));
        if (!closing.length) continue;
        const answer = closing[Math.floor(Math.random() * closing.length)];

        /* The distractor closes something, just not this. */
        const open = pairs.filter(([a, b]) =>
            !(a === x && b === y) && !settles(system, n, facts, a, b));
        const useful = offers.filter(f =>
            f !== answer
            && !settles(system, n, [...facts, f], x, y)
            && open.some(([a, b]) => settles(system, n, [...facts, f], a, b)));
        if (!useful.length) continue;
        const decoy = useful[Math.floor(Math.random() * useful.length)];

        const word = INVENTED[Math.floor(Math.random() * INVENTED.length)];
        const line = (f: Fact) => f.holds
            ? `${subj(words[f.a])} ${rel(word.third)} ${subj(words[f.b])}`
            : `${subj(words[f.a])} does not ${rel(word.stem)} ${subj(words[f.b])}`;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            facts.map(line), ctx.settingsOverrideService.scramble, ctx.mergeTarget());

        const shown = shuffle([answer, decoy]);
        question.choices = shown.map(line);
        question.correctChoice = shown.indexOf(answer);
        question.answerMode = "choice";
        question.choicePrompt = "Which one would settle it?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `<b>${hi(word.third)}</b> is ${system.meaning}.`,
            /* "below" is a relation word in some of this app's label sets, and
               minimal mode marks it away wherever it appears — so the two
               statements are referred to by what they are, not by where. */
            `These leave ${subj(words[x])} and ${subj(words[y])} open. Both of the two `
            + "statements offered are true; exactly <b>one</b> of them would settle the "
            + "pair. The other is useful somewhere else.",
        ];

        question.explanation = [
            `on the premises alone, ${subj(words[x])} and ${subj(words[y])} could still `
            + "go either way",
            `add ${hi(line(answer))} and they cannot: every arrangement left agrees about them`,
            `add ${line(decoy)} instead and the pair is as open as it was — it settles `
            + "a different pair, which is not the one that was asked",
        ];

        return question;
    }

    throw new Error("Cannot generate.");
}
