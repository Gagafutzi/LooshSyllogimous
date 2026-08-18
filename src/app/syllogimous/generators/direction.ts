/**
 * Compass directions, flat and three-dimensional.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { IDirection3DProposition, IDirectionProposition, Question } from "../models/question.models";
import { coinFlip, getSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { NUMBER_WORDS } from "../constants/question.constants";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { guid } from "src/app/utils/uuid";
import { EnumQuestionType } from "../constants/question.constants";
import { neg, subj } from "../utils/phrasing";

export function createDirection(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createDirection");

    const type = EnumQuestionType.Direction;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const numOfEls = numOfPremises + 1;
    const symbols = getSymbols(settings);
    const words = pickUniqueItems(symbols, numOfEls).picked;
    const question = new Question(type);

    const sideSize = 1 + Math.round(Math.sqrt(numOfEls));

    const cardinalOppositeMap: Record<string, string> = {
        "North": "South",
        "South": "North",
        "East": "West",
        "West": "East"
    };

    // Give random coords to each subject
    const coords: [string, number, number][] = [];
    let pool = [...words];
    while (pool.length) {
        let ri: number | undefined;
        let rj: number | undefined;
        while (ri == null || rj == null || coords.find(([_, x, y]) => ri === x && rj === y)) {
            ri = Math.floor(Math.random() * sideSize);
            rj = Math.floor(Math.random() * sideSize);
        }
        const { picked, remaining } = pickUniqueItems(pool, 1);
        coords.push([picked[0], ri, rj]);
        pool = remaining;
    }
    question.coords = coords;
    ctx.logger.info("Coords", coords);

    // Create pairs of subjects
    let copyOfCoords = [...coords];
    const pairs: [typeof coords[0], typeof coords[0]][] = [];
    const pairAlreadyEstablished = (a: string, b: string) =>
        pairs.find(([x, y]) => (x[0] === a && y[0] === b) || (x[0] === b && y[0] === a));
    for (let i = 0; i < numOfEls - 1; i++) {
        const { picked, remaining } = pickUniqueItems(copyOfCoords, 1);
        const subject = i === 0
            ? pickUniqueItems(remaining, 1).picked[0]
            : pickUniqueItems(pairs, 1).picked[0][Math.floor(Math.random() * 2)];
        const a = picked[0][0];
        const b = subject[0];
        if (a === b || pairAlreadyEstablished(a, b)) {
            i--;
            continue;
        }
        pairs.push([picked[0], subject]);
        copyOfCoords = remaining;
    }

    const usedCoords = Object.values(
        pairs.reduce((a, c) => {
            a[c[0][0]] = c[0];
            a[c[1][0]] = c[1];
            return a;
        }, {} as Record<string, typeof coords[0]>)
    );

    // Add one more pair that will represent the conclusion
    let coorda!: typeof coords[0];
    let coordb!: typeof coords[0];
    let safe = 1e2;
    while (safe-- && (!coorda || !coordb || pairAlreadyEstablished(coorda[0], coordb[0]))) {
        [coorda, coordb] = pickUniqueItems(usedCoords, 2).picked;
    }

    if (safe < 1) {
        ctx.logger.error("MAXIMUM ITERATION COUNT REACHED!");
        return createDirection(ctx, numOfPremises);
    }

    pairs.push([coorda, coordb]);
    ctx.logger.info("Pairs", pairs);

    // Calculate cardinals and relationship of each pair
    const premises: IDirectionProposition[] = [];

    const getRelationship = (cardinals: [string, number][], tweaked = false) => {
        let relationship = "";

        if (!tweaked && cardinals.every(c => c[1] === 1)) {
            relationship = "adjacent and " + cardinals[0][0];

            if (cardinals.length === 2) {
                relationship += "-" + cardinals[1][0];
            }
        } else {
            const numStepsVertical = NUMBER_WORDS[cardinals[0][1]] || cardinals[0][1];
            relationship = numStepsVertical + " step" + (cardinals[0][1] > 1 ? "s" : "") + " " + cardinals[0][0];

            if (cardinals.length === 2) {
                const numStepsHorizontal = NUMBER_WORDS[cardinals[1][1]] || cardinals[1][1];
                relationship += " and " + numStepsHorizontal + " step" + (cardinals[1][1] > 1 ? "s" : "") + " " + cardinals[1][0];
            }
        }

        return relationship;
    };

    for (const pair of pairs) {
        const [subja, subjb] = pair;
        const [a, ax, ay] = subja;
        const [b, bx, by] = subjb;

        const cardinals: [string, number][] = [];
        const diffy = ay - by;
        const absdiffy = Math.abs(diffy);
        const diffx = ax - bx;
        const absdiffx = Math.abs(diffx);

        if (diffy > 0) {
            cardinals.push(["North", absdiffy]);
        } else if (diffy < 0) {
            cardinals.push(["South", absdiffy]);
        }

        if (diffx > 0) {
            cardinals.push(["East", absdiffx]);
        } else if (diffx < 0) {
            cardinals.push(["West", absdiffx]);
        }

        premises.push({
            pair,
            cardinals,
            relationship: getRelationship(cardinals),
            uid: guid()
        })
    }
    ctx.logger.info("Premises", premises);

    // Sanity check, this fixes a bug with analogy questions
    if (new Set(premises.map(x => x.pair[0][0])).size !== coords.length) {
        ctx.logger.error("Missing subject in premises");
        return createDirection(ctx, numOfPremises);
    }

    // Extract the last premise and say it's the conclusion
    // Flip a coin and either keep or tweak the conclusion
    let conclusion = premises.pop()!;
    let tweaked = false;
    const isValid = coinFlip();
    if (isValid) {
        ctx.logger.info("Keep conclusion");
    } else {
        ctx.logger.info("Tweak conclusion");

        /*
         * How a false conclusion is made wrong.
         *
         * v4 flipped a coin between "add one step" and "flip that cardinal to
         * its opposite", which is two error types out of the several a reasoner
         * actually makes — and never a *perpendicular* direction, the commonest
         * slip of all when tracking two axes at once.
         *
         * v3 drew from a weighted pool instead, and that is what this ports:
         * wrong in one attribute at a time, with the near-misses weighted
         * highest, because a distractor is only doing its job if getting it
         * wrong looks like the mistake you would actually have made.
         *
         *   right direction, wrong distance    weight 3
         *   right distance, wrong direction    weight 2
         *   both wrong                         weight 1
         */
        const deliberate = ctx.settingsOverrideService.linearOverride("incorrectDirections")
            ?? ctx.progressionService.hasRung(type, "incorrect-directions");

        const rndIdx = Math.floor(Math.random() * conclusion.cardinals.length);
        const before = conclusion.cardinals.map(c => [c[0], c[1]] as [string, number]);

        /*
         * A replacement direction stays on its own axis.
         *
         * The cardinals are one entry per axis, so putting "East" where the
         * north/south entry goes produces "two steps east and three steps
         * east", or worse a claim naming both poles of one axis. That is not a
         * hard item, it is a malformed one — the first version of this did
         * exactly that, and measuring it is what showed it up.
         *
         * Which leaves three well-formed ways to be wrong, weighted as v3
         * weighted them: a near-miss on distance most often, the reversal next,
         * and the cross-axis slip — the magnitudes swapped between the two axes
         * — least. That last one is the error a reasoner tracking two axes at
         * once actually makes, and v4 could not previously produce it.
         */
        const swappable = conclusion.cardinals.length === 2
            && conclusion.cardinals.every(c => c[0] !== "!" && c[1] > 0)
            && conclusion.cardinals[0][1] !== conclusion.cardinals[1][1];

        if (deliberate) {
            const roll = Math.random();
            if (roll < 0.5 || (!swappable && roll < 0.83)) {
                // Right way, wrong distance.
                const [w, n] = conclusion.cardinals[rndIdx];
                conclusion.cardinals[rndIdx] = [w, n > 1 && coinFlip() ? n - 1 : n + 1];
            } else if (roll < 0.83) {
                // Right distances, exchanged between the axes.
                const [a, b] = conclusion.cardinals;
                conclusion.cardinals = [[a[0], b[1]], [b[0], a[1]]];
            } else {
                conclusion.cardinals[rndIdx][0] =
                    cardinalOppositeMap[conclusion.cardinals[rndIdx][0]] ?? conclusion.cardinals[rndIdx][0];
            }
        } else if (coinFlip()) {
            ctx.logger.info("Add one to one cardinal");
            conclusion.cardinals[rndIdx][1]++;
        } else {
            ctx.logger.info("One cardinal flipped");
            conclusion.cardinals[rndIdx][0] = cardinalOppositeMap[conclusion.cardinals[rndIdx][0]];
        }

        // A "false" item that came out true is worse than no modifier at all.
        const unchanged = conclusion.cardinals.every(
            (c, i) => c[0] === before[i][0] && c[1] === before[i][1]);
        if (unchanged) conclusion.cardinals[rndIdx][1]++;

        tweaked = true;
    }
    // Regenerate conclusion relationship
    conclusion.relationship = getRelationship(conclusion.cardinals, tweaked);
    ctx.logger.info("Conclusion", conclusion);

    const negateRelationship = (relationship: string) => {
        return relationship.replaceAll(/(north|south|east|west)/gi, substr => {
            if (coinFlip()) {
                question.negations++;
                return neg(cardinalOppositeMap[substr]);
            }
            return substr;
        });
    };

    const stringifyProposition = (p: IDirectionProposition) => {
        const relationship = settings.enabled.negation ? negateRelationship(p.relationship) : p.relationship;
        return `${subj(p.pair[0][0])} is ${relationship} of ${subj(p.pair[1][0])}`;
    };

    shuffle(premises);
    question.isValid = isValid;
    question.premises = premises.map(stringifyProposition);
    question.conclusion = stringifyProposition(conclusion);
    question.notes = [
        "Cardinal directions are strict and direct (e.g., \"north\" means exactly north, not \"north-east\" or \"north-west\")"
    ];

    // TODO: Create meta relationship

    return question;
}

export function createDirection3D(ctx: GeneratorContext, numOfPremises: number, type: EnumQuestionType.Direction3DSpatial | EnumQuestionType.Direction3DTemporal): Question {
    ctx.logger.info("createDirection3D");

    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const numOfEls = numOfPremises + 1;
    const symbols = getSymbols(settings);
    const words = pickUniqueItems(symbols, numOfEls).picked;
    const question = new Question(type);
    const isSpatial = type === EnumQuestionType.Direction3DSpatial;

    const sideSize = 1 + Math.round(Math.cbrt(numOfEls));

    const trasversalOpposite: Record<string, string> = {
        "before": "after",
        "after": "before",
        "below": "above",
        "above": "below"
    };
    const cardinalOppositeMap: Record<string, string> = {
        "North": "South",
        "South": "North",
        "East": "West",
        "West": "East"
    };

    // Give random coords to each subject
    const coords: [string, number, number, number][] = [];
    const alreadyHasCoords = (ri: number, rj: number, rk: number) => {
        return coords.find(([_, x, y, k]) =>
            ri === x && rj === y && rk === k
        );
    };
    let pool = [...words];
    while (pool.length) {
        let ri: number | undefined;
        let rj: number | undefined;
        let rt: number | undefined;
        while (ri == null || rj == null || rt == null || alreadyHasCoords(ri, rj, rt)) {
            ri = Math.floor(Math.random() * sideSize);
            rj = Math.floor(Math.random() * sideSize);
            rt = Math.floor(Math.random() * sideSize);
        }
        const { picked, remaining } = pickUniqueItems(pool, 1);
        coords.push([picked[0], ri, rj, rt]);
        pool = remaining;
    }
    ctx.logger.info("All coords", coords);

    // Create pairs of subjects
    let copyOfCoords = [...coords];
    const pairs: [typeof coords[0], typeof coords[0]][] = [];
    const subjectsAlreadyIncluded = (a: string, b: string) =>
        pairs.find(([x, y]) => (x[0] === a && y[0] === b) || (x[0] === b && y[0] === a));
    for (let i = 0; i < numOfEls - 1; i++) {
        const { picked, remaining } = pickUniqueItems(copyOfCoords, 1);
        const subject = i === 0
            ? pickUniqueItems(remaining, 1).picked[0]
            : pickUniqueItems(pairs, 1).picked[0][Math.floor(Math.random() * 2)];
        const a = picked[0][0];
        const b = subject[0];
        if (a === b || subjectsAlreadyIncluded(a, b)) {
            i--;
            continue;
        }
        pairs.push([picked[0], subject]);
        copyOfCoords = remaining;
    }

    const usedCoords = Object.values(
        pairs.reduce((a, c) => {
            a[c[0][0]] = c[0];
            a[c[1][0]] = c[1];
            return a;
        }, {} as Record<string, typeof coords[0]>)
    );
    question.coords3D = usedCoords;
    ctx.logger.info("Used coords", usedCoords);

    // Add one more pair that will represent the conclusion
    let coorda!: typeof coords[0];
    let coordb!: typeof coords[0];
    let safe = 1e2;
    while (safe-- && (!coorda || !coordb || subjectsAlreadyIncluded(coorda[0], coordb[0]))) {
        [coorda, coordb] = pickUniqueItems(usedCoords, 2).picked;
    }

    if (safe < 1) {
        ctx.logger.error("MAXIMUM ITERATION COUNT REACHED!");
        return createDirection3D(ctx, numOfPremises, type);
    }

    pairs.push([coorda, coordb]);
    ctx.logger.info("Pairs", pairs);

    // Calculate relationship of each pair
    const premises: IDirection3DProposition[] = [];

    const getTrasversalRelationship = (tdiff: number) => {
        const absdiff = Math.abs(tdiff);
        const s = (absdiff > 1) ? "s" : "";
        const n = NUMBER_WORDS[absdiff] || absdiff;
        if (isSpatial) {
            if (tdiff === 0) {
                return "on the same level";
            } else if (tdiff < 0) {
                return `${n} level${s} below`;
            } else {
                return `${n} level${s} above`;
            }
        } else {
            if (tdiff === 0) {
                return "at the same time";
            } else if (tdiff < 0) {
                return `${n} hour${s} before`;
            } else {
                return `${n} hour${s} after`;
            }
        }
    };

    const SAME_CARDINAL_DIRECTION = "in the same cardinal position";
    const getCardinalRelationship = (_cardinals: [string, number][]) => {
        if (_cardinals.every(c => c[1] === 0)) {
            return SAME_CARDINAL_DIRECTION;
        }

        const cardinals = _cardinals.filter(c => c[1] !== 0);

        let relationship = "";
        const numStepsVertical = NUMBER_WORDS[cardinals[0][1]] || cardinals[0][1];
        const s = cardinals[0][1] > 1 ? "s" : "";

        relationship = `${numStepsVertical} step${s} ${cardinals[0][0]}`;

        if (cardinals.length === 2) {
            const numStepsHorizontal = NUMBER_WORDS[cardinals[1][1]] || cardinals[1][1];
            const s = cardinals[1][1] > 1 ? "s" : "";

            relationship += ` and ${numStepsHorizontal} step${s} ${cardinals[1][0]}`;
        }

        return relationship;
    };

    for (const pair of pairs) {
        const [subja, subjb] = pair;
        const [a, ax, ay, at] = subja;
        const [b, bx, by, bt] = subjb;

        const trasversalDifference = at - bt;

        const cardinals: [string, number][] = [];
        const diffy = ay - by;
        const absdiffy = Math.abs(diffy);
        const diffx = ax - bx;
        const absdiffx = Math.abs(diffx);

        if (diffy > 0) {
            cardinals.push(["North", absdiffy]);
        } else if (diffy < 0) {
            cardinals.push(["South", absdiffy]);
        } else {
            cardinals.push(["!", 0]);
        }

        if (diffx > 0) {
            cardinals.push(["East", absdiffx]);
        } else if (diffx < 0) {
            cardinals.push(["West", absdiffx]);
        } else {
            cardinals.push(["!", 0]);
        }

        const trasversalRelationship = getTrasversalRelationship(trasversalDifference);
        const cardinalRelationship = getCardinalRelationship(cardinals);
        const connector = (cardinalRelationship === SAME_CARDINAL_DIRECTION) ? " and " : (cardinalRelationship.indexOf(" and ") > -1) ? ", " : " and ";
        const relationship = trasversalRelationship + connector + cardinalRelationship;

        premises.push({
            pair,
            trasversalDifference,
            cardinals,
            relationship,
            uid: guid()
        })
    }
    ctx.logger.info("Premises", premises);

    // Extract the last premise and say it's the conclusion
    // Flip a coin and either keep or tweak the conclusion
    let conclusion = premises.pop()!;
    const isValid = coinFlip();
    if (isValid) {
        ctx.logger.info("Keep conclusion");

        // Filter out collinear cardinals
        conclusion.cardinals = conclusion.cardinals.filter(c => c[0] !== "!");
    } else {
        ctx.logger.info("Tweak conclusion");

        if (coinFlip()) {
            ctx.logger.info("Invert trasversal difference");
            conclusion.trasversalDifference = conclusion.trasversalDifference * -1;
        }

        // Filter out collinear cardinals and zero cardinals
        conclusion.cardinals = conclusion.cardinals.filter(c => c[0] !== "!" && c[1] !== 0);

        if (!conclusion.cardinals.length) {
            return createDirection3D(ctx, numOfPremises, type);
        }

        const rndIdx = Math.floor(Math.random() * conclusion.cardinals.length);

        if (coinFlip()) {
            ctx.logger.info("One cardinal flipped");
            conclusion.cardinals[rndIdx][0] = cardinalOppositeMap[conclusion.cardinals[rndIdx][0]];
        } else {
            ctx.logger.info("Add one to one cardinal");
            conclusion.cardinals[rndIdx][1]++;
        }
    }

    // Regenerate conclusion relationship
    conclusion.trasversalDifference = conclusion.pair[0][3] - conclusion.pair[1][3];
    const trasversalRelationship = getTrasversalRelationship(conclusion.trasversalDifference);
    const cardinalRelationship = getCardinalRelationship(conclusion.cardinals);
    const connector = (cardinalRelationship === SAME_CARDINAL_DIRECTION) ? " and " : (cardinalRelationship.indexOf(" and ") > -1) ? ", " : " and ";
    conclusion.relationship = trasversalRelationship + connector + cardinalRelationship;
    ctx.logger.info("Conclusion", conclusion);

    const negateRelationship = (relationship: string) => {
        return relationship
            .replaceAll(/(before|after|below|above)/gi, substr => {
                if (coinFlip()) {
                    question.negations++;
                    return neg(trasversalOpposite[substr]);
                }
                return substr;
            })
            .replaceAll(/(north|south|east|west)/gi, substr => {
                if (coinFlip()) {
                    question.negations++;
                    return neg(cardinalOppositeMap[substr]);
                }
                return substr;
            });
    };

    const stringifyProposition = (p: IDirection3DProposition) => {
        const relationship = settings.enabled.negation ? negateRelationship(p.relationship) : p.relationship;
        return `${subj(p.pair[0][0])} is ${relationship} of ${subj(p.pair[1][0])}`;
    };

    shuffle(premises);
    question.isValid = isValid;
    question.premises = premises.map(stringifyProposition);
    question.conclusion = stringifyProposition(conclusion);
    question.notes = [
        "Cardinal directions are strict and direct (e.g., \"north\" means exactly north, not \"north-east\" or \"north-west\")"
    ];

    // TODO: Create meta relationship

    return question;
}
