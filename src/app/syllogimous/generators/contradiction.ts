/**
 * Contradiction — the premises cannot all be true, and exactly one is wrong.
 *
 * Isomorph's guide: *"The premises cannot all be true: exactly one is wrong.
 * Find the premise that is on every conflict — withdraw it and the rest agree;
 * withdraw any other and a clash remains."*
 *
 * The rest of the app hands the player a consistent world and asks what follows
 * in it. This hands them one that has no arrangement at all and asks where it
 * broke, which is a different skill and the one that transfers: a real argument
 * that has gone wrong does not announce it, and finding the step that did it
 * means holding the whole thing at once rather than reading forward.
 *
 * ── Why the menu is the premise list ──
 *
 * Every other choice mode here offers two options, because a longer menu can be
 * shortened by looking — three of four claims are about the wrong pair and go
 * without being reasoned about. That argument inverts here, in the same way it
 * does for selections.
 *
 * The options *are* the premises: every one is a sentence of the same shape,
 * about the same entities, under the same invented relation, and none of them
 * carries a surface feature the others lack. Nothing can be dismissed at a
 * glance because there is nothing to glance at — a candidate is ruled out by
 * withdrawing it and finding the rest still clash, which is the work the mode
 * is for. Shortening the menu would not make the item harder either; it would
 * do the finding *for* the player, which is the whole task.
 *
 * `guessRateFor("choice", 0, n)` is exactly `1/n`, so the weaker floor a long
 * menu does carry is already priced. `tests/registries.test.ts` allows the menu
 * on the condition that makes the argument hold — the options are the premises,
 * verbatim — rather than by naming the mode.
 *
 * ── What makes an item well-formed ──
 *
 * Built from a real arrangement and then broken on purpose: one drawn fact is
 * flipped, and the item is kept only if all three of the claims on the card are
 * true of what came out. No arrangement fits the whole set; withdrawing the
 * flipped premise leaves one that does; withdrawing any *other* single premise
 * leaves none. That last check is what "exactly one is wrong" means, and it is
 * checked rather than assumed — a flip can easily leave a second premise that
 * would have done just as well, and the card would then be telling the player
 * something false.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates,
} from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { INVENTED } from "./possibility";

type Fact = { a: number; b: number; holds: boolean };

/** Relations that chain, so a set of facts about them can clash at all. */
export const CHAINING = (s: RelationSystem) => s.meaning.includes("chains")
    && !s.meaning.includes("does not chain");

const fits = (system: RelationSystem, n: number, facts: Fact[]) =>
    consistentStates(system, n, facts).length > 0;

export function createContradiction(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createContradiction");

    const type = EnumQuestionType.Contradiction;
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

        const drawn = pickUniqueItems(pairs, Math.min(numOfPremises, pairs.length)).picked;
        if (drawn.length < 3) continue;

        const facts: Fact[] = shuffle(
            drawn.map(([a, b]) => ({ a, b, holds: system.holds(truth, a, b) })));

        const wrong = Math.floor(Math.random() * facts.length);
        facts[wrong] = { ...facts[wrong], holds: !facts[wrong].holds };

        const without = (i: number) => facts.filter((_, j) => j !== i);

        /*
         * The three claims the card makes, checked against what came out.
         *
         * Only the third has teeth: a consistent set, or one no single
         * withdrawal repairs, is rejected by the third line anyway — mutating
         * either of the first two away leaves the suite green. They are kept as
         * the cheap exits, since the third walks every premise, and are said
         * here to be redundant rather than tested.
         */
        if (fits(system, n, facts)) continue;                  // it must clash
        if (!fits(system, n, without(wrong))) continue;        // withdrawing it must fix it
        if (facts.some((_, i) => i !== wrong && fits(system, n, without(i)))) continue;

        /*
         * Not the only negative among positives, or the only positive among
         * negatives.
         *
         * The flip inverts one fact's polarity, so on a relation that mostly
         * holds the wrong premise comes out negative and on a sparse one
         * positive — and where it is the *only* one of its kind, the item is
         * answered by noticing the odd sentence rather than by withdrawing
         * anything. It happens in about one item in fifty, which is rare enough
         * to drop and far too common to leave: a free answer that turns up once
         * an hour is one a player learns to look for.
         */
        const alike = facts.filter(f => f.holds === facts[wrong].holds).length;
        if (alike < 2) continue;

        const word = INVENTED[Math.floor(Math.random() * INVENTED.length)];
        const line = (f: Fact) => f.holds
            ? `${subj(words[f.a])} ${rel(word.third)} ${subj(words[f.b])}`
            : `${subj(words[f.a])} does not ${rel(word.stem)} ${subj(words[f.b])}`;

        const question = new Question(type);
        question.bucket = [...words];
        /*
         * Shown once, as both the premises and the buttons. Repeating the list
         * above the options doubles the card and adds nothing — the same
         * reasoning Minimal Premises follows, and here it is load-bearing:
         * the option and the premise have to be recognisably the same sentence
         * or the player is matching text instead of withdrawing a claim.
         */
        question.premises = facts.map(line);
        question.choices = facts.map(line);
        question.correctChoice = wrong;
        question.answerMode = "choice";
        question.choicePrompt = "Which premise is the wrong one?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `<b>${hi(word.third)}</b> is ${system.meaning}.`,
            "These cannot all be true: exactly <b>one</b> of them is wrong. Withdraw it "
            + "and the rest agree; withdraw any other and a clash remains.",
        ];

        question.explanation = [
            `nothing can be arranged so that all ${facts.length} hold, since `
            + `${word.third} is ${system.meaning}`,
            `without ${hi(line(facts[wrong]))} the rest fit together`,
            "withdrawing any other one instead leaves the clash where it was, so that "
            + "is the premise every conflict runs through",
        ];

        return question;
    }

    throw new Error("Cannot generate.");
}
