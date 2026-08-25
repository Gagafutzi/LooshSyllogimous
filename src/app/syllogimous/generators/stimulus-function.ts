/**
 * Transformation of stimulus function — P12.
 *
 * The third pillar of relational frame theory, and the one this project was
 * missing entirely. Mutual entailment and combinatorial entailment are
 * everywhere here: given A > B and B > C, derive A > C. This is the other
 * thing frames do — a *property* attached to one member spreads through the
 * network to the rest, transformed by the relation it travels along.
 *
 *   Zib is heavier than Kod. Mek is heavier than Zib. Zib is dangerous.
 *   Which is most dangerous?
 *
 * Nothing states that Mek is dangerous at all. It follows only if "heavier"
 * carries "more dangerous" along with it, which is a different operation from
 * deriving where Mek sits — the relation is being used as a conduit rather than
 * as a fact.
 *
 * ── Why the direction is stated and sometimes inverted ──
 *
 * The frame that carries the function is given with the item, and half the time
 * it runs *against* the scale: heavier means *less* dangerous. Without that, the
 * mode collapses into "find the extreme", answerable by ignoring the property
 * entirely. With it, the property has to actually be carried.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, isPremiseLikeConclusion, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { scrambleByFactor } from "../utils/premise-order.utils";
import { LINEAR_SCALES, LinearScale, buildChain, compare, renderPremises } from "../utils/linear.utils";
import { coordMapFromPositions } from "../utils/map.utils";
import { GeneratorContext } from "./context";

/**
 * Functions a stimulus can acquire.
 *
 * Deliberately evaluative rather than factual — "dangerous", not "tall". A
 * factual property is another dimension of the layout and the reader would
 * treat it as one; an evaluative one is plainly *attached* to a thing and has
 * to be carried somewhere by the relation.
 */
const FUNCTIONS = [
    { adjective: "dangerous", comparative: "more dangerous", superlative: "most dangerous", least: "least dangerous" },
    { adjective: "valuable", comparative: "more valuable", superlative: "most valuable", least: "least valuable" },
    { adjective: "fragile", comparative: "more fragile", superlative: "most fragile", least: "least fragile" },
    { adjective: "toxic", comparative: "more toxic", superlative: "most toxic", least: "least toxic" },
    { adjective: "sought after", comparative: "more sought after", superlative: "most sought after", least: "least sought after" },
];

/** The scales a function can travel along. */
const CARRIERS: LinearScale[] = [
    LINEAR_SCALES["quantity"], LINEAR_SCALES["vertical"],
    LINEAR_SCALES["contains"], LINEAR_SCALES["temporal"],
];

export function createStimulusFunction(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createStimulusFunction");

    const type = EnumQuestionType.StimulusFunction;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const scale = CARRIERS[Math.floor(Math.random() * CARRIERS.length)];
    const fn = FUNCTIONS[Math.floor(Math.random() * FUNCTIONS.length)];
    // Half the time the function runs against the scale, so "find the extreme"
    // is not a strategy.
    const alignedWithScale = Math.random() < 0.5;

    for (let attempt = 0; attempt < 200; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);
        const layout = buildChain(words);
        const rendered = renderPremises(scale, layout, {
            negate: settings.enabled.negation,
            allowTies: false,
        });

        // The anchor is the one told to have the function. A middle one, so
        // neither answer is the anchor itself and the property has to move.
        const byPosition = [...words].sort((a, b) => layout.pos[a] - layout.pos[b]);
        const anchor = byPosition[Math.floor(byPosition.length / 2)];

        /** How much of the function something carries: high is more. */
        const carried = (w: string) =>
            (alignedWithScale ? 1 : -1) * (layout.pos[w] - layout.pos[anchor]);

        const ranked = [...words].sort((a, b) => carried(b) - carried(a));
        const most = ranked[0];
        const least = ranked[ranked.length - 1];
        if (most === anchor || least === anchor) continue;

        const question = new Question(type);
        question.premises = scrambleByFactor(rendered.premises, ctx.settingsOverrideService.scramble);
        question.negations = rendered.negations;
        question.bucket = byPosition;
        question.wordCoordMap = coordMapFromPositions(layout.pos);
        question.axisNames = [scale.name];

        question.setup = [
            `${subj(anchor)} is ${hi(fn.adjective)}.`,
            `Being ${hi(scale.direction[0])} makes something `
            + `${hi(alignedWithScale ? fn.comparative : "less " + fn.adjective)}.`,
        ];

        /*
         * The first two lines are the transformation itself and hold whatever
         * is asked. The closing line is not: a pairwise item asks about two
         * named objects, and ending on "the most toxic is X" would be
         * explaining a claim the item never made — which is the one failure the
         * derivation invariant exists to catch, and did.
         */
        const groundwork = [
            `${subj(anchor)} is the one said to be ${hi(fn.adjective)}.`,
            alignedWithScale
                ? `${hi(scale.direction[0])} carries ${hi("more")} of it, so anything `
                  + `${scale.direction[0]} than ${subj(anchor)} has more and anything `
                  + `${scale.direction[1]} has less.`
                : `${hi(scale.direction[0])} carries ${hi("less")} of it, so the order is `
                  + `reversed: ${scale.direction[1]} means more.`,
        ];

        const asExtreme = Math.random() < 0.55;
        if (asExtreme) {
            const wantMost = Math.random() < 0.5;
            const answer = wantMost ? most : least;
            /*
             * Two options, the answer and the one nearest it.
             *
             * Every object used to be offered, which is a *scan*: eight names,
             * one of which is at the end of the line, and the seven that are
             * plainly not at the end cost nothing to dismiss. The question is
             * really between the extreme and whatever sits next to it, so that
             * is what it asks — and the guess floor is worse on paper while the
             * item is harder in fact, because there is no longer anything to
             * eliminate without working the order out.
             */
            const rival = wantMost ? ranked[1] : ranked[ranked.length - 2];
            if (!rival || carried(rival) === carried(answer)) continue;

            const order = shuffle([answer, rival]);
            question.choices = order.map(w => subj(w));
            question.correctChoice = order.indexOf(answer);
            question.answerMode = "choice";
            question.isValid = true;
            question.conclusion = "";
            /*
             * The rule, beside the options.
             *
             * Which way the scale runs is the one thing the item cannot be
             * answered without, and it is stated at the top of the card — where
             * it scrolls out of sight the moment the premises are long enough,
             * and in fullscreen it is not on screen at all when the options
             * are. Repeated here because a fact you must hold and cannot see is
             * not a difficulty, it is a defect.
             */
            question.choicePrompt = `Which is ${wantMost ? fn.superlative : fn.least}?`
                + ` \u2014 ${scale.direction[0]} means`
                + ` ${alignedWithScale ? fn.comparative : "less " + fn.adjective}`;
            question.explanation = [
                ...groundwork,
                `${subj(answer)} and ${subj(rival)} are the two it is between.`,
                `so the ${wantMost ? fn.superlative : fn.least} is ${subj(answer)}.`,
            ];
        } else {
            const [a, b] = shuffle([...words].filter(w => carried(w) !== 0)).slice(0, 2);
            if (!a || !b || carried(a) === carried(b)) continue;

            const claimTrue = Math.random() < 0.5;
            const [x, y] = (carried(a) > carried(b)) === claimTrue ? [a, b] : [b, a];
            question.conclusion = `${subj(x)} ${rel("is " + fn.comparative + " than")} ${subj(y)}`;
            question.isValid = claimTrue;
            if (isPremiseLikeConclusion(question.premises, question.conclusion)) continue;

            question.explanation = [
                ...groundwork,
                `${subj(x)} is ${hi(carried(x) > carried(y) ? "further" : "less far")} that way `
                + `than ${subj(y)}.`,
                `so ${subj(x)} ${hi(claimTrue ? "is" : "is not")} ${fn.comparative} than ${subj(y)}.`,
            ];
        }

        return question;
    }

    throw new Error("Cannot generate.");
}
