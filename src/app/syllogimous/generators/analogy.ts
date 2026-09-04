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
import { createComparison, linearScaleFor } from "./linear";
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

    /*
     * Whatever this borrows, it does not borrow the other mode's questions —
     * nor the way they were answered.
     *
     * Analogy takes a finished item from one of five other modes and *reuses
     * the object*, overwriting the conclusion with one of its own. Anything the
     * inner mode set about answering is still on it and is about a question
     * this item no longer asks: a series would step the player through claims
     * the card never shows, and an inherited `answerMode` put the construction
     * builder or a set of options on an item whose only claim is "alike or
     * unlike". Both were reported from play, the second as a correct answer
     * marked wrong — which it was, since the scoring then compared "did you
     * build the inner arrangement" against whether the analogy held.
     *
     * Analogy's own ladder is `["negation", "meta"]`: it has no construction or
     * picking rung and was never meant to serve one. Cleared where the takeover
     * happens rather than in five branches.
     */
    const takeOver = (q: Question) => q.askAsTrueOrFalse();

    let question = new Question(topType);
    let isValidSame;
    // Definite: every branch of the switch below assigns all four, and the
    // `isValidSame === undefined` guard rejects the case where none ran.
    let a!: string, b!: string, c!: string, d!: string;
    let indexOfA, indexOfB, indexOfC, indexOfD;

    /*
     * How each of the two pairs relates, in that layout's own terms.
     *
     * Analogy has no relation of its own: it takes a finished item from one of
     * five other modes and asks whether one pair stands to each other as
     * another pair does. So a derivation has to be written per layout — there
     * is no shared quantity to fall back on — and it is filled in by whichever
     * branch ran.
     */
    let describe: ((x: string, y: string) => string) | null = null;

    const flip = coinFlip();

    switch (choiceIndex) {
        case 0:
            question = takeOver(createDistinction(ctx, length));
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
            {
                const side = (n: string) => Number(question.buckets[0].indexOf(n) !== -1);
                describe = (x, y) => side(x) === side(y) ? "on the same side" : "on opposite sides";
            }
            break;
        case 1:
        case 2:
            const type = (choiceIndex === 1)
                ? EnumQuestionType.ComparisonNumerical
                : EnumQuestionType.ComparisonChronological;
            question = takeOver(createComparison(ctx, length, type));
            question.type = topType;
            question.conclusion = "";

            [a, b, c, d] = pickUniqueItems(question.bucket, 4).picked;
            question.conclusion += `${subj(a)} to ${subj(b)}`;

            [indexOfA, indexOfB] = [question.bucket.indexOf(a), question.bucket.indexOf(b)];
            [indexOfC, indexOfD] = [question.bucket.indexOf(c), question.bucket.indexOf(d)];
            isValidSame = (indexOfA > indexOfB && indexOfC > indexOfD) || (indexOfA < indexOfB && indexOfC < indexOfD);
            {
                // Positions rather than premise text: negation rewords a
                // relation into its opposite pole, so the sentences shown do
                // not always read the way the ordering runs.
                const scale = linearScaleFor(ctx, type);
                const at = question.positions;
                describe = (x, y) => {
                    const d = (at[x] ?? 0) - (at[y] ?? 0);
                    const word = d === 0 ? scale?.tie ?? "level with"
                        : d > 0 ? scale?.direction[0] ?? "above" : scale?.direction[1] ?? "below";
                    return `${word} \u2014 ${Math.abs(d)} apart`;
                };
            }
            break;
        case 3:
            while (flip !== isValidSame) {
                /*
                 * The 2D generator, deliberately, even though the Direction
                 * mode itself is served by the composed engine now.
                 *
                 * This branch reads `coords` as [word, x, y] tuples and
                 * describes the pair with `offset2D`, which is a compass
                 * offset — so it needs a plane with a fixed meaning. A composed
                 * space hands back a coordinate map over whichever axes are
                 * configured, and those need not be spatial at all: an analogy
                 * over a temporal and a quantity axis would be described as a
                 * direction on a map.
                 *
                 * The cost is that an axis chosen in Customise applies to
                 * Direction and not to an analogy built out of one.
                 */
                question = takeOver(createDirection(ctx, length));
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
            {
                const at: Record<string, [number, number]> = {};
                for (const [w, x, y] of question.coords) at[w] = [x, y];
                describe = (p, q) => offset2D(at[p][0] - at[q][0], at[p][1] - at[q][1]);
            }
            break;
        case 4:
        case 5: {
            const type = (choiceIndex === 4)
                ? EnumQuestionType.Direction3DSpatial
                : EnumQuestionType.Direction3DTemporal;
            while (flip !== isValidSame) {
                question = takeOver(createDirection3D(ctx, length, type));
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
            {
                const at: Record<string, [number, number, number]> = {};
                for (const [w, x, y, t] of question.coords3D) at[w] = [x, y, t];
                const third = type === EnumQuestionType.Direction3DSpatial
                    ? ["above", "below"] : ["after", "before"];
                describe = (p, q) => {
                    const dt = at[p][2] - at[q][2];
                    const flat = offset2D(at[p][0] - at[q][0], at[p][1] - at[q][1]);
                    const level = dt === 0 ? "level" : `${Math.abs(dt)} ${dt > 0 ? third[0] : third[1]}`;
                    return `${flat}, ${level}`;
                };
            }
            break;
        }
        case 6:
        case 7: {
            const type = (choiceIndex === 6)
                ? EnumQuestionType.LinearArrangement
                : EnumQuestionType.CircularArrangement;
            const isLinear = type === EnumQuestionType.LinearArrangement;
            question = takeOver(createArrangement(ctx, length, type));
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

            {
                const seats = subjects.length;
                describe = (p, q) => {
                    const gap = subjects.indexOf(p) - subjects.indexOf(q);
                    const round = isLinear
                        ? Math.abs(gap)
                        : Math.min(Math.abs(gap), seats - Math.abs(gap));
                    const way = isLinear ? (gap > 0 ? "to the right of" : "to the left of") : "away from";
                    return `${round} place${round === 1 ? "" : "s"} ${way}`;
                };
            }

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
     * Its own derivation, not the layout's.
     *
     * Whatever the underlying generator attached explains a pair this item
     * never asks about — left in place it rendered a confident, correct-looking
     * proof of an unrelated claim, which is worse than showing nothing. So the
     * two relations being compared are stated instead, in the terms of the
     * layout they came from, and the closing line says whether they match.
     *
     * It names only the four objects the conclusion names, which is what the
     * derivation test checks across every mode — and is exactly the invariant
     * that caught the stale-explanation bug in the first place.
     */
    question.explanation = describe
        ? [
            `${subj(a)} to ${subj(b)}: ${describe(a!, b!)}`,
            `${subj(c)} to ${subj(d)}: ${describe(c!, d!)}`,
            `so the two are ${isValidSame ? "alike" : "unlike"}`,
        ]
        : [];

    return question;
}

/** A flat displacement, worded as the direction modes word it. */
function offset2D(dx: number, dy: number): string {
    const parts: string[] = [];
    if (dy !== 0) parts.push(`${Math.abs(dy)} ${dy > 0 ? "north" : "south"}`);
    if (dx !== 0) parts.push(`${Math.abs(dx)} ${dx > 0 ? "east" : "west"}`);
    return parts.length ? parts.join(" and ") : "in the same place";
}
