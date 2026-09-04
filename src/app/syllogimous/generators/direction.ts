/**
 * Compass directions, flat and three-dimensional.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext, buildSeries, extendWithSeries, seriesWanted } from "./context";
import { IDirection3DProposition, IDirectionProposition, Question } from "../models/question.models";
import { isPremiseLikeConclusion, coinFlip, getSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { NUMBER_WORDS } from "../constants/question.constants";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { guid } from "src/app/utils/uuid";
import { EnumQuestionType } from "../constants/question.constants";
import { DIRECTION3D_WORDS as W, neg, subj } from "../utils/phrasing";

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
        "north": "south",
        "south": "north",
        "east": "west",
        "west": "east"
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
        // Recovered from, by redrawing on the next line — so a warning rather
        // than an error, but worth keeping: it means the pair-drawing loop is
        // running tight for this configuration.
        ctx.logger.warn("Pair search hit its iteration cap; redrawing");
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
            cardinals.push(["north", absdiffy]);
        } else if (diffy < 0) {
            cardinals.push(["south", absdiffy]);
        }

        if (diffx > 0) {
            cardinals.push(["east", absdiffx]);
        } else if (diffx < 0) {
            cardinals.push(["west", absdiffx]);
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
        /*
         * Logged as a rejected draw, not an error.
         *
         * It happens on perfectly ordinary generation — the pairing can leave
         * an object unmentioned, and the answer is to draw again, which the
         * next line does. Logging it at error level meant a healthy run printed
         * hundreds of them, which is how a log stops being read at all.
         */
        ctx.logger.info("Missing subject in premises; redrawing");
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
            ?? ctx.hasRung(type, "incorrect-directions");

        const rndIdx = Math.floor(Math.random() * conclusion.cardinals.length);
        const before = conclusion.cardinals.map(c => [c[0], c[1]] as [string, number]);

        /*
         * A replacement direction stays on its own axis.
         *
         * The cardinals are one entry per axis, so putting "east" where the
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

    /*
     * Case-sensitive, now that the cardinals are written in lower case.
     *
     * They used to be capitalised here and nowhere else, which put "two steps
     * North" beside "one level above" on the same card and left the compass
     * word untouched in minimal mode and under randomised labels — both tables
     * are lower case. With the flag on, a stray capital would have matched here
     * and then missed the opposite map, printing "undefined" where a direction
     * belongs; without it, one that ever comes back is left alone and the
     * symbol test says so.
     */
    const negateRelationship = (relationship: string) => {
        return relationship.replaceAll(/(north|south|east|west)/g, substr => {
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

    /*
     * A walk from one end of the claim to the other, adding up as it goes.
     *
     * Directions compose by vector addition, and the whole difficulty is that
     * two axes have to be carried at once while the premises arrive in a random
     * order and mention pairs that are nowhere near each other. Stating the
     * running total after each step is the method, so the derivation is the
     * method rather than a restatement of the answer.
     *
     * Distances come from the coordinates rather than by parsing the rendered
     * premises: negation rewords a premise into its opposite pole, so the text
     * a player reads is not always the arithmetic being done.
     */
    const at: Record<string, [number, number]> = {};
    for (const [w, x, y] of coords) at[w] = [x, y];

    const near: Record<string, string[]> = {};
    for (const p of premises) {
        const [x, y] = [p.pair[0][0], p.pair[1][0]];
        (near[x] ??= []).push(y);
        (near[y] ??= []).push(x);
    }

    const route = (from: string, to: string): string[] | null => {
        if (from === to) return [from];
        const prev: Record<string, string> = {};
        const seen = new Set([from]);
        const queue = [from];
        while (queue.length) {
            const cur = queue.shift()!;
            for (const n of near[cur] ?? []) {
                if (seen.has(n)) continue;
                seen.add(n);
                prev[n] = cur;
                if (n === to) {
                    const out = [to];
                    let step = to;
                    while (step !== from) { step = prev[step]; out.unshift(step); }
                    return out;
                }
                queue.push(n);
            }
        }
        return null;
    };

    /** Cardinal pairs for a displacement, in the order the premises state them. */
    const cardinalsFor = (dx: number, dy: number): [string, number][] => {
        const out: [string, number][] = [];
        if (dy > 0) out.push(["north", dy]); else if (dy < 0) out.push(["south", -dy]);
        if (dx > 0) out.push(["east", dx]); else if (dx < 0) out.push(["west", -dx]);
        return out;
    };

    const path = route(coordb[0], coorda[0]);
    if (path && path.length >= 2) {
        const lines: string[] = [];
        const origin = at[path[0]];

        for (let i = 0; i < path.length - 1; i++) {
            const [from, to] = [path[i], path[i + 1]];
            const step = cardinalsFor(at[to][0] - at[from][0], at[to][1] - at[from][1]);
            const total = cardinalsFor(at[to][0] - origin[0], at[to][1] - origin[1]);
            lines.push(`${subj(to)} is ${getRelationship(step)} of ${subj(from)}`
                + ` \u2014 running total from ${subj(path[0])}: `
                + (total.length ? getRelationship(total, true) : "no offset at all"));
        }

        const net = cardinalsFor(coorda[1] - coordb[1], coorda[2] - coordb[2]);
        lines.push(`so ${subj(coorda[0])} is ${net.length ? getRelationship(net) : "in the same place as"}`
            + ` of ${subj(coordb[0])}`);
        question.explanation = lines;
    }

    shuffle(premises);
    question.isValid = isValid;
    question.premises = premises.map(stringifyProposition);
    question.conclusion = stringifyProposition(conclusion);

    /*
     * More pairs, against the same map.
     *
     * The premises fix every object's position, so any pair has an answer the
     * moment the map is built — and a second pair is usually reached by a
     * different route through it, which is the reason to ask twice rather than
     * to state one more premise.
     */
    if (seriesWanted(ctx)) {
        const named = Object.keys(at);
        extendWithSeries(question, buildSeries(want => {
            if (named.length < 2) return null;
            const x = named[Math.floor(Math.random() * named.length)];
            const y = named[Math.floor(Math.random() * named.length)];
            if (x === y) return null;

            const truth = cardinalsFor(at[x][0] - at[y][0], at[x][1] - at[y][1]);
            if (!truth.length) return null;

            // A false claim moves a cardinal rather than inventing a direction:
            // off by one is the miss worth making the reader check.
            const said: [string, number][] = want
                ? truth
                : truth.map(([w, n], i) =>
                    [w, i === 0 ? (n > 1 && coinFlip() ? n - 1 : n + 1) : n] as [string, number]);

            const text = `${subj(x)} is ${getRelationship(said)} of ${subj(y)}`;
            // A pair some premise places directly is read, not composed.
            if (isPremiseLikeConclusion(question.premises, text)) return null;

            return { text, isValid: want, key: `${x}:${y}` };
        }));
    }
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
        "earlier": "later",
        "later": "earlier",
        "below": "above",
        "above": "below"
    };
    const cardinalOppositeMap: Record<string, string> = {
        "north": "south",
        "south": "north",
        "east": "west",
        "west": "east"
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
        // Recovered from, by redrawing on the next line — so a warning rather
        // than an error, but worth keeping: it means the pair-drawing loop is
        // running tight for this configuration.
        ctx.logger.warn("Pair search hit its iteration cap; redrawing");
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
                return W.sameLevel;
            } else if (tdiff < 0) {
                return `${n} level${s} ${W.below}`;
            } else {
                return `${n} level${s} ${W.above}`;
            }
        } else {
            if (tdiff === 0) {
                return W.sameTime;
            } else if (tdiff < 0) {
                return `${n} hour${s} ${W.earlier}`;
            } else {
                return `${n} hour${s} ${W.later}`;
            }
        }
    };

    const SAME_CARDINAL_DIRECTION = W.sameCardinal;
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
            cardinals.push(["north", absdiffy]);
        } else if (diffy < 0) {
            cardinals.push(["south", absdiffy]);
        } else {
            cardinals.push(["!", 0]);
        }

        if (diffx > 0) {
            cardinals.push(["east", absdiffx]);
        } else if (diffx < 0) {
            cardinals.push(["west", absdiffx]);
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
            .replaceAll(/(earlier|later|below|above)/g, substr => {
                if (coinFlip()) {
                    question.negations++;
                    return neg(trasversalOpposite[substr]);
                }
                return substr;
            })
            .replaceAll(/(north|south|east|west)/g, substr => {
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

    /*
     * The same walk as the flat mode, over three axes instead of two.
     *
     * Worth its own pass rather than sharing the 2D one: the third axis is not
     * a third cardinal but a separate vocabulary \u2014 levels above and below
     * when spatial, hours before and after when temporal \u2014 and it is
     * stated in its own clause. Carrying it alongside the compass pair is the
     * whole added difficulty of the mode, so the running total states both
     * parts at every step.
     */
    const at3: Record<string, [number, number, number]> = {};
    for (const [w, x, y, t] of coords) at3[w] = [x, y, t];

    const near3: Record<string, string[]> = {};
    for (const p of premises) {
        const [x, y] = [p.pair[0][0], p.pair[1][0]];
        (near3[x] ??= []).push(y);
        (near3[y] ??= []).push(x);
    }

    const route3 = (from: string, to: string): string[] | null => {
        if (from === to) return [from];
        const prev: Record<string, string> = {};
        const seen = new Set([from]);
        const queue = [from];
        while (queue.length) {
            const cur = queue.shift()!;
            for (const n of near3[cur] ?? []) {
                if (seen.has(n)) continue;
                seen.add(n);
                prev[n] = cur;
                if (n === to) {
                    const out = [to];
                    let step = to;
                    while (step !== from) { step = prev[step]; out.unshift(step); }
                    return out;
                }
                queue.push(n);
            }
        }
        return null;
    };

    /** Both clauses for a displacement, worded as the premises word them. */
    const phrase3 = (dx: number, dy: number, dt: number) => {
        const cardinals: [string, number][] = [
            dy > 0 ? ["north", dy] : dy < 0 ? ["south", -dy] : ["!", 0],
            dx > 0 ? ["east", dx] : dx < 0 ? ["west", -dx] : ["!", 0],
        ];
        const cardinal = getCardinalRelationship(cardinals);
        const connector = cardinal === SAME_CARDINAL_DIRECTION ? " and "
            : cardinal.indexOf(" and ") > -1 ? ", " : " and ";
        return getTrasversalRelationship(dt) + connector + cardinal;
    };

    const path3 = route3(coordb[0], coorda[0]);
    if (path3 && path3.length >= 2) {
        const lines: string[] = [];
        const origin = at3[path3[0]];

        for (let i = 0; i < path3.length - 1; i++) {
            const [from, to] = [path3[i], path3[i + 1]];
            const [fx, fy, ft] = at3[from];
            const [tx, ty, tt] = at3[to];
            lines.push(`${subj(to)} is ${phrase3(tx - fx, ty - fy, tt - ft)} of ${subj(from)}`
                + ` \u2014 running total from ${subj(path3[0])}: `
                + phrase3(tx - origin[0], ty - origin[1], tt - origin[2]));
        }

        lines.push(`so ${subj(coorda[0])} is `
            + phrase3(coorda[1] - coordb[1], coorda[2] - coordb[2], coorda[3] - coordb[3])
            + ` of ${subj(coordb[0])}`);
        question.explanation = lines;
    }

    shuffle(premises);
    question.isValid = isValid;
    question.premises = premises.map(stringifyProposition);
    question.conclusion = stringifyProposition(conclusion);

    /*
     * More pairs, against the same map. See the two-dimensional case; the only
     * difference is that a wrong claim here has three axes to be wrong on, and
     * it is wrong on exactly one — so it is not spotted from whichever axis the
     * reader checks first.
     */
    if (seriesWanted(ctx)) {
        const named = Object.keys(at3);
        extendWithSeries(question, buildSeries(want => {
            if (named.length < 2) return null;
            const x = named[Math.floor(Math.random() * named.length)];
            const y = named[Math.floor(Math.random() * named.length)];
            if (x === y) return null;

            const [dx, dy, dz] = [
                at3[x][0] - at3[y][0], at3[x][1] - at3[y][1], at3[x][2] - at3[y][2],
            ];
            if (!dx && !dy && !dz) return null;

            const text = `${subj(x)} is ${phrase3(dx + (want ? 0 : 1), dy, dz)} of ${subj(y)}`;
            if (isPremiseLikeConclusion(question.premises, text)) return null;

            return { text, isValid: want, key: `${x}:${y}` };
        }));
    }
    question.notes = [
        "Cardinal directions are strict and direct (e.g., \"north\" means exactly north, not \"north-east\" or \"north-west\")"
    ];

    // TODO: Create meta relationship

    return question;
}
