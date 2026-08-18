/**
 * Syllogisms, from all three generators.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, isPremiseLikeConclusion, shuffle } from "../utils/question.utils";
import { generatePolysyllogism, formatSylPremise, getRandomRuleValid, getRandomRuleInvalid, getSyllogism } from "../utils/syllogism.utils";
import { SylPremise } from "../models/syllogism.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { SyllogismGenerator } from "../pages/settings/game-mode-choose/game-mode-choose.component";

export function createSyllogismAll(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismAll");
    if (coinFlip()) {
        return createSyllogismFredo(ctx, numOfPremises);
    } else {
        return createSyllogismCanyon(ctx, numOfPremises);
    }
}

export function createSyllogismFredo(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismFredo");

    const type = EnumQuestionType.Syllogism;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const length = numOfPremises + 1;
    const question = new Question(type);
    question.isValid = coinFlip();

    do {
        question.rule = question.isValid ? getRandomRuleValid() : getRandomRuleInvalid();
        question.bucket = getRandomSymbols(settings, length);
        question.premises = [];

        [
            question.premises[0],
            question.premises[1],
            question.conclusion
        ] = getSyllogism(
            settings,
            question.bucket[0],
            question.bucket[1],
            question.bucket[2],
            question.isValid ? getRandomRuleValid() : getRandomRuleInvalid()
        );
    } while (isPremiseLikeConclusion(question.premises, question.conclusion));

    for (let i = 3; i < length; i++) {
        const rnd = Math.floor(Math.random() * (i - 1));
        const flip = coinFlip();
        const [p, m] = flip ? [question.bucket[i], question.bucket[rnd]] : [question.bucket[rnd], question.bucket[i]];
        question.premises.push(getSyllogism(settings, "#####", p, m, getRandomRuleInvalid())[0]);
    }

    shuffle(question.premises);

    return question;
}

export function createSyllogismCanyon(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismCanyon");

    const type = EnumQuestionType.Syllogism;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);
    const minDepth = Math.min(2, numOfPremises);
    const maxDepth = numOfPremises;
    const chainDepth = Math.floor(Math.random() * (maxDepth - minDepth + 1)) + minDepth;
    const chainTermsNeeded = chainDepth + 1;
    const numDistractors = numOfPremises - chainDepth;
    const minExtra = Math.ceil(numDistractors / chainTermsNeeded);
    const maxExtra = numDistractors;
    const extra = Math.floor(Math.random() * (maxExtra - minExtra + 1)) + minExtra;
    const poolSize = chainTermsNeeded + extra;
    const termPool = getRandomSymbols(settings, poolSize);
    const wantTrue = coinFlip();
    const { premises, conclusion, conclusionIsTrue, trace, derived } = generatePolysyllogism({
        nPremises: numOfPremises,
        chainDepth,
        termPool,
        trueConclusion: wantTrue,
    });

    const negated = settings.enabled.negation && coinFlip();

    question.bucket = termPool;
    question.isValid = conclusionIsTrue;
    question.premises = premises.map(p => formatSylPremise(p, negated));
    question.conclusion = formatSylPremise(conclusion, negated);
    question.explanation = explainPolysyllogism(trace, derived, conclusionIsTrue);

    return question;
}

/**
 * The chain, one link at a time, with what each link licenses.
 *
 * A polysyllogism is assembled by composing syllogisms, and the intermediate
 * conclusions are both the method and the one part of the item a reader cannot
 * recover afterwards: the chain premises are shuffled in among distractors
 * chosen specifically to entail nothing, so which premises did the work is
 * invisible once the item is built.
 *
 * A false item ends on what the premises *do* entail rather than on "this does
 * not follow". Saying only that a claim fails leaves the reader knowing they
 * were wrong and not what was true, which is the same one bit the verdict
 * already gave them. The terms are the same either way — a false conclusion is
 * made by changing the relation between the same two terms, never by
 * introducing new ones — so this stays within what the item asked about.
 */
function explainPolysyllogism(
    trace: SylPremise[],
    derived: SylPremise,
    isTrue: boolean,
): string[] {
    if (!trace.length) return [];

    const lines = trace.slice(0, -1).map(step => `so far: ${formatSylPremise(step)}`);
    lines.push(isTrue
        ? `so ${formatSylPremise(derived)}`
        : `the premises give ${formatSylPremise(derived)}, which the claim contradicts`);
    return lines;
}

export function createSyllogism(ctx: GeneratorContext, numOfPremises: number) {
    switch (ctx.syllogismGenerator) {
        case SyllogismGenerator.All:
            return createSyllogismAll(ctx, numOfPremises);
        case SyllogismGenerator.Fredo:
            return createSyllogismFredo(ctx, numOfPremises);
        case SyllogismGenerator.Canyon:
            return createSyllogismCanyon(ctx, numOfPremises);
        default:
            return createSyllogismAll(ctx, numOfPremises);
    }
}
