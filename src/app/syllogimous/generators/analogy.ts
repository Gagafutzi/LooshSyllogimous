/**
 * Analogy — a relation between two relations, over any basic mode.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { createArrangement } from "./arrangement";
import { createDirection, createDirection3D } from "./direction";
import { createDistinction } from "./distinction";
import { createComparison } from "./linear";
import { Question } from "../models/question.models";
import { coinFlip, getCircularWays, getLinearWays, pickUniqueItems } from "../utils/question.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { subj } from "../utils/phrasing";

export function createAnalogy(ctx: GeneratorContext, length: number) {
    ctx.logger.info("createAnalogy");

    const topType = EnumQuestionType.Analogy;
    const settings = ctx.settings;

    if (!canGenerateQuestion(topType, length, settings)) {
        throw new Error("Cannot generate.");
    }

    const choiceIndices = [];
    if (settings.question[EnumQuestionType.Distinction].enabled) {
        choiceIndices.push(0);
    }

    // Randomly pick one comparison question from the comparison questions enabled
    const comparisonChoices = [];
    if (settings.question[EnumQuestionType.ComparisonNumerical].enabled) {
        comparisonChoices.push(1);
    }
    if (settings.question[EnumQuestionType.ComparisonChronological].enabled) {
        comparisonChoices.push(2);
    }
    if (comparisonChoices.length) {
        choiceIndices.push(pickUniqueItems(comparisonChoices, 1).picked[0]);
    }

    // Randomly pick one direction question from the direction questions enabled
    const directionsChoices = [];
    if (settings.question[EnumQuestionType.Direction].enabled) {
        directionsChoices.push(3);
    }
    if (settings.question[EnumQuestionType.Direction3DSpatial].enabled) {
        directionsChoices.push(4);
    }
    if (settings.question[EnumQuestionType.Direction3DTemporal].enabled) {
        directionsChoices.push(5);
    }
    if (directionsChoices.length) {
        choiceIndices.push(pickUniqueItems(directionsChoices, 1).picked[0]);
    }

    // Randomly pick one arrangement from enabled arrangements
    const arrangementChoices = [];
    if (settings.question[EnumQuestionType.LinearArrangement].enabled) {
        arrangementChoices.push(6);
    }
    if (settings.question[EnumQuestionType.CircularArrangement].enabled) {
        arrangementChoices.push(7);
    }
    if (arrangementChoices.length) {
        choiceIndices.push(pickUniqueItems(arrangementChoices, 1).picked[0]);
    }

    const choiceIndex = pickUniqueItems(choiceIndices, 1).picked[0];

    let question = new Question(topType);
    let isValidSame;
    let a, b, c, d;
    let indexOfA, indexOfB, indexOfC, indexOfD;

    const flip = coinFlip();

    switch (choiceIndex) {
        case 0:
            question = createDistinction(ctx, length);
            question.type = topType;
            question.conclusion = "";

            [a, b, c, d] = pickUniqueItems([...question.buckets[0], ...question.buckets[1]], 4).picked;
            question.conclusion += `${subj(a)} to ${subj(b)}`;

            [
                indexOfA,
                indexOfB,
                indexOfC,
                indexOfD
            ] = [
                    Number(question.buckets[0].indexOf(a) !== -1),
                    Number(question.buckets[0].indexOf(b) !== -1),
                    Number(question.buckets[0].indexOf(c) !== -1),
                    Number(question.buckets[0].indexOf(d) !== -1)
                ];
            isValidSame = (indexOfA === indexOfB && indexOfC === indexOfD) || (indexOfA !== indexOfB && indexOfC !== indexOfD);
            break;
        case 1:
        case 2:
            const type = (choiceIndex === 1)
                ? EnumQuestionType.ComparisonNumerical
                : EnumQuestionType.ComparisonChronological;
            question = createComparison(ctx, length, type);
            question.type = topType;
            question.conclusion = "";

            [a, b, c, d] = pickUniqueItems(question.bucket, 4).picked;
            question.conclusion += `${subj(a)} to ${subj(b)}`;

            [indexOfA, indexOfB] = [question.bucket.indexOf(a), question.bucket.indexOf(b)];
            [indexOfC, indexOfD] = [question.bucket.indexOf(c), question.bucket.indexOf(d)];
            isValidSame = (indexOfA > indexOfB && indexOfC > indexOfD) || (indexOfA < indexOfB && indexOfC < indexOfD);
            break;
        case 3:
            while (flip !== isValidSame) {
                question = createDirection(ctx, length);
                question.type = topType;
                question.conclusion = "";

                const [coordsa, coordsb, coordsc, coordsd] = pickUniqueItems(question.coords, 4).picked;
                [a, b, c, d] = [coordsa[0], coordsb[0], coordsc[0], coordsd[0]];
                question.conclusion += `${subj(a)} to ${subj(b)}`;

                const dxatob = coordsa[1] - coordsb[1];
                const dyatob = coordsa[2] - coordsb[2];

                const dxctod = coordsc[1] - coordsd[1];
                const dyctod = coordsc[2] - coordsd[2];

                isValidSame = (dxatob === dxctod) && (dyatob === dyctod);
            }
            break;
        case 4:
        case 5: {
            const type = (choiceIndex === 4)
                ? EnumQuestionType.Direction3DSpatial
                : EnumQuestionType.Direction3DTemporal;
            while (flip !== isValidSame) {
                question = createDirection3D(ctx, length, type);
                question.type = topType;
                question.conclusion = "";

                const [coordsa, coordsb, coordsc, coordsd] = pickUniqueItems(question.coords3D, 4).picked;
                [a, b, c, d] = [coordsa[0], coordsb[0], coordsc[0], coordsd[0]];
                question.conclusion += `${subj(a)} to ${subj(b)}`;

                const dxatob = coordsa[1] - coordsb[1];
                const dyatob = coordsa[2] - coordsb[2];
                const dtatob = coordsa[3] - coordsb[3];

                const dxctod = coordsc[1] - coordsd[1];
                const dyctod = coordsc[2] - coordsd[2];
                const dtctod = coordsc[3] - coordsd[3];

                isValidSame = (dxatob === dxctod) && (dyatob === dyctod) && (dtatob === dtctod);
            }
            break;
        }
        case 6:
        case 7: {
            const type = (choiceIndex === 6)
                ? EnumQuestionType.LinearArrangement
                : EnumQuestionType.CircularArrangement;
            const isLinear = type === EnumQuestionType.LinearArrangement;
            question = createArrangement(ctx, length, type);
            question.type = topType;
            question.conclusion = "";
            question.notes = [];
            if (isLinear) {
                question.notes.push("Proximity makes the relationship alike.");
            } else {
                question.notes.push("Proximity and diametrical opposition makes the relationship alike.");
            }

            const subjects = question.rule.split(", ");
            [a, b, c, d] = pickUniqueItems(subjects, 4).picked;
            question.conclusion += `${subj(a)} to ${subj(b)}`;

            const [idxA, idxB, idxC, idxD] = [
                subjects.indexOf(a),
                subjects.indexOf(b),
                subjects.indexOf(c),
                subjects.indexOf(d)
            ];

            const getWays = isLinear ? getLinearWays : getCircularWays;

            const waysA2B = getWays(idxA, idxB, length + 1, true, true);
            const waysC2D = getWays(idxC, idxD, length + 1, true, true);

            ctx.logger.info("Ways A2B", waysA2B);
            ctx.logger.info("Ways C2D", waysC2D);

            isValidSame = false;
            for (const key in waysA2B) {
                if (waysA2B[key].possible && waysC2D[key].possible && waysA2B[key].steps === waysC2D[key].steps) {
                    isValidSame = true;
                }
            }
            ctx.logger.info('Is a valid "same" relationship?', isValidSame);

            break;
        }
    }

    if (isValidSame === undefined) {
        throw new Error("Shouldn't be here...");
    }

    const isSameRelationship = coinFlip();
    question.isValid = isSameRelationship ? isValidSame : !isValidSame;

    if (settings.enabled.negation && coinFlip()) {
        question.negations++;
        question.conclusion += `<div class="analogy-conclusion is-negated">is ${isSameRelationship ? 'unlike' : 'alike'}</div>`;
    } else {
        question.conclusion += `<div class="analogy-conclusion">is ${isSameRelationship ? 'alike' : 'unlike'}</div>`;
    }

    question.conclusion += `${subj(c)} to ${subj(d)}`;

    /*
     * Analogy builds on a scale layout and then asks a different question of
     * it, so any derivation attached while that layout was being made
     * explains a pair this item never asks about. Left in place it rendered
     * a confident, correct-looking proof of an unrelated claim — worse than
     * showing nothing. An analogy needs its own explanation of the two
     * relations being compared; until it has one, it has none.
     */
    question.explanation = [];

    return question;
}
