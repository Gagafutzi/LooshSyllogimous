/**
 * Distinction — same/different over two buckets.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, getRelation, isPremiseLikeConclusion, createMetaRelationships, shuffle } from "../utils/question.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { rel, subj } from "../utils/phrasing";

export function createDistinction(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createDistinction");

    const type = EnumQuestionType.Distinction;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const length = numOfPremises + 1;
    const symbols = getRandomSymbols(settings, length);
    const question = new Question(type);

    /*
     * The chain as it was walked, for the derivation.
     *
     * Distinction folds to a parity — every "opposite of" flips a side and
     * every "same as" holds it — so the whole item is one bit accumulated over
     * the chain. That is also exactly what makes it hard to check by eye: a
     * single misread step inverts the answer and nothing downstream shows it.
     * Worth stating step by step, which needs the order the premises were
     * *built* in rather than the shuffled order they are read in.
     */
    let walk: Array<{ word: string; same: boolean }> = [];
    let start = "";

    do {
        const rnd = Math.floor(Math.random() * symbols.length);
        // splice returns an array; take the element, so what reaches subj()
        // is the word it claims to be rather than an array coerced to one.
        const first = symbols.splice(rnd, 1)[0];
        let prev = first;
        let curr = "";

        question.buckets = [[prev], []];
        let prevBucket = 0;

        question.premises = [];
        walk = [];
        start = first;

        for (let i = 0; i < length - 1; i++) {
            const rnd = Math.floor(Math.random() * symbols.length);
            curr = symbols.splice(rnd, 1)[0];

            const isSameAs = coinFlip();
            const relation = getRelation(settings, type, isSameAs);

            question.premises.push(`${subj(prev)} is ${relation} ${subj(curr)}`);
            walk.push({ word: curr, same: isSameAs });

            if (!isSameAs) {
                prevBucket = (prevBucket + 1) % 2;
            }

            question.buckets[prevBucket].push(curr);

            prev = curr;
        }

        // All same is useless, in that case repeat
        if (!question.buckets[0].length || !question.buckets[1].length) {
            return createDistinction(ctx, numOfPremises);
        }

        createMetaRelationships(settings, question, length);

        const isSameAs = coinFlip();
        const relation = getRelation(settings, type, isSameAs);

        question.conclusion = `${subj(first)} is ${relation} ${subj(curr)}`;
        question.isValid = isSameAs
            ? question.buckets[0].includes(curr)
            : question.buckets[1].includes(curr);
    } while (isPremiseLikeConclusion(question.premises, question.conclusion));

    question.explanation = explainDistinction(start, walk);

    shuffle(question.premises);

    return question;
}

/**
 * The chain, one step at a time, with the side carried along.
 *
 * Written against the walk rather than the premises because the premises are
 * shuffled before they are shown and a derivation that follows the displayed
 * order would be following a random order. The closing line names only the two
 * things the conclusion names, which is the invariant the derivation test
 * enforces across every mode.
 */
function explainDistinction(start: string, walk: Array<{ word: string; same: boolean }>): string[] {
    if (!walk.length) return [];

    const lines: string[] = [];
    let flipped = false;

    for (const step of walk) {
        flipped = step.same ? flipped : !flipped;
        const side = flipped ? "the opposite side from" : "the same side as";
        lines.push(`${subj(step.word)} is ${rel(step.same ? "same as" : "opposite of")} the one before`
            + ` \u2014 so far, ${side} ${subj(start)}`);
    }

    const last = walk[walk.length - 1].word;
    lines.push(`so ${subj(start)} is ${rel(flipped ? "opposite of" : "same as")} ${subj(last)}`);
    return lines;
}
