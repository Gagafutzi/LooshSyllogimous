/**
 * Linear and circular arrangements.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { IArrangementPremise, Question } from "../models/question.models";
import { coinFlip, getCircularWays, getLinearWays, getSymbols, metarelateArrangement, pickUniqueItems, horizontalShuffleArrangement, shuffle, interpolateArrangementRelationship } from "../utils/question.utils";
import { NUMBER_WORDS } from "../constants/question.constants";
import { canGenerateQuestion } from "../models/settings.models";
import { guid } from "src/app/utils/uuid";
import { EnumArrangements, EnumQuestionType } from "../constants/question.constants";
import { subj } from "../utils/phrasing";

export function createArrangement(ctx: GeneratorContext, numOfPremises: number, type: EnumQuestionType.LinearArrangement | EnumQuestionType.CircularArrangement): Question {
    ctx.logger.info("createArrangement:", type);

    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const numOfEls = numOfPremises + 1;
    const isLinear = type === EnumQuestionType.LinearArrangement;
    const getWays = isLinear ? getLinearWays : getCircularWays;
    const symbols = getSymbols(settings);
    const words = pickUniqueItems(symbols, numOfEls).picked;
    const question = new Question(type);
    // Per-item, not a rule: the count varies and the premises never state it.
    question.setup = [`<b>${NUMBER_WORDS[numOfEls] || numOfEls} subjects</b> along a <b>${isLinear ? "linear" : "circular"}</b> path.`];

    const relationshipAlreadyExistent = (a: string, b: string) =>
        premises.find(({ a: pA, b: pB }) => (pA === a && pB === b) || (pA === b && pB === a));

    let premises: IArrangementPremise[] = [];
    let subjects = [...words];
    let a: string | undefined = undefined;
    let safe = 1e2;
    while (safe-- && premises.length < numOfEls - 1) {
        let premise: IArrangementPremise | undefined = undefined;
        let safe = 1e2;
        while (safe-- && premise == undefined) {
            // Pick A
            a = a || pickUniqueItems(subjects, 1).picked[0];
            ctx.logger.info("a", a);
            const aid = words.indexOf(a);

            // Pick B
            const b = pickUniqueItems(subjects.filter(sub => sub !== a), 1).picked[0];
            ctx.logger.info("b", b);
            const bid = words.indexOf(b);

            // Pick a way between A and B and check there are no connections already established between A and B
            const [wayDescription, wayData] = pickUniqueItems(Object.entries(getWays(aid, bid, numOfEls)), 1).picked[0];
            if (wayData.possible && !relationshipAlreadyExistent(a, b)) {
                premise = {
                    a,
                    b,
                    relationship: {
                        description: wayDescription as EnumArrangements,
                        steps: wayData.steps
                    },
                    metaRelationships: [],
                    uid: guid()
                };
                subjects = subjects.filter(s => s !== a && s !== b)
                a = b;
            }
        }
        if (safe <= 0) {
            throw new Error("MAXIMUM ITERATION COUNT REACHED!");
        }
        premises.push(premise!);
    }
    if (safe <= 0) {
        throw new Error("MAXIMUM ITERATION COUNT REACHED!");
    }

    horizontalShuffleArrangement(premises);
    shuffle(premises);
    metarelateArrangement(premises);

    let b: string | undefined = undefined;
    safe = 1e2;
    while (safe-- && b == undefined) {
        const subject = pickUniqueItems(words, 1).picked[0];
        if (subject !== a && !relationshipAlreadyExistent(a!, subject)) {
            b = subject;
        }
    }
    if (safe <= 0) {
        throw new Error("MAXIMUM ITERATION COUNT REACHED!");
    }

    const [aid, bid] = [words.indexOf(a!), words.indexOf(b!)];
    const ways = getWays(aid, bid, numOfEls, true);
    ctx.logger.info("a", a);
    ctx.logger.info("a", b);
    ctx.logger.info("ways", ways);

    question.isValid = coinFlip();
    const conclusions = Object.entries(ways).filter(([description, data]) => data.possible === question.isValid);
    const picked = pickUniqueItems(conclusions, 1).picked[0];
    const description = picked[0] as EnumArrangements;
    const steps = picked[1].steps;
    const interpolated = interpolateArrangementRelationship({ description, steps }, settings);
    question.conclusion = `${subj(a)} ${interpolated} ${subj(b)}`;

    // Next to relationship with 3 elements are useless, in that case regenerate
    if (!isLinear && numOfEls === 3 && interpolated === EnumArrangements.Next) {
        return createArrangement(ctx, numOfPremises, type);
    }

    question.rule = words.join(", ");
    const metaRelationshipLookupMap: Record<string, boolean> = {};
    question.premises = premises.map(({ a, b, relationship, metaRelationships, uid }) => {
        if (settings.enabled.meta && coinFlip() && metaRelationships.length && !metaRelationshipLookupMap[uid]) {
            const premise = pickUniqueItems(metaRelationships, 1).picked[0];
            metaRelationshipLookupMap[premise.uid] = true;
            return `${subj(a)} to ${subj(b)} has the same relation as ${subj(premise.a)} to ${subj(premise.b)}`;
        }

        const { description, steps } = relationship;
        const interpolated = interpolateArrangementRelationship({ description, steps }, settings);
        return `${subj(a)} ${interpolated} ${subj(b)}`;
    });

    return question;
}
