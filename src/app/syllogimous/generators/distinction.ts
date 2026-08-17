/**
 * Distinction — same/different over two buckets.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, getRelation, isPremiseLikeConclusion, createMetaRelationships, shuffle } from "../utils/question.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { subj } from "../utils/phrasing";

export function createDistinction(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createDistinction");

    const type = EnumQuestionType.Distinction;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const length = numOfPremises + 1;
    const symbols = getRandomSymbols(settings, length);
    const question = new Question(type);

    do {
        const rnd = Math.floor(Math.random() * symbols.length);
        const first = symbols.splice(rnd, 1)
        let prev = first;
        let curr: string[] = [];

        question.buckets = [[prev], []];
        let prevBucket = 0;

        question.premises = [];

        for (let i = 0; i < length - 1; i++) {
            const rnd = Math.floor(Math.random() * symbols.length);
            curr = symbols.splice(rnd, 1);

            const isSameAs = coinFlip();
            const relation = getRelation(settings, type, isSameAs);

            question.premises.push(`${subj(prev)} is ${relation} ${subj(curr)}`);

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

    shuffle(question.premises);

    return question;
}
