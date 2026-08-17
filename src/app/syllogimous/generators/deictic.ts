/**
 * Deictic relations — perspective taking.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, isPremiseLikeConclusion, pickUniqueItems, shuffle } from "../utils/question.utils";
import { allCoords, answerFor, buildDeicticSpec, coordKey, reversalTextFor, statementFor, verifyAnswer } from "../utils/deictic.utils";
import { scrambleByFactor } from "../utils/premise-order.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createDeictic(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createDeictic");

    const settings = ctx.settings;
    const type = EnumQuestionType.Deictic;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);

    /*
     * Bounded, and deliberately NOT using isPremiseLikeConclusion: that helper
     * compares subjects[0] + subjects[1] and so assumes two-subject premises.
     * Deictic statements carry a single subject, so both sides stringify with a
     * trailing "undefined" and the claimed symbol always comes from the grid —
     * it matched every time and span forever. An exact restatement check is what
     * is actually wanted here.
     */
    for (let attempt = 0; attempt < 200; attempt++) {
        // 3 axes need 8 grid symbols; ask for the max so either width fits.
        const symbols = getRandomSymbols(settings, 8);
        const spec = buildDeicticSpec(numOfPremises, symbols);
        const cells = allCoords(spec.axes.length);

        question.bucket = cells.map(c => spec.grid[coordKey(c)]);

        const gridPremises = cells.map(c =>
            statementFor(spec.axes, c, spec.grid[coordKey(c)])
        );

        // Reversals are stated after the grid: they operate on facts already
        // fixed, so presenting them first would read as nonsense. One premise
        // per reversed axis, so no two of them say the same thing.
        const reversalPremises = spec.reversals
            .flatMap((parity, axis) => parity ? [reversalTextFor(spec.axes[axis])] : []);
        shuffle(gridPremises);
        shuffle(reversalPremises);
        question.premises = scrambleByFactor(
            [...gridPremises, ...reversalPremises],
            ctx.settingsOverrideService.scramble);

        const uttered = cells[Math.floor(Math.random() * cells.length)];
        const correct = answerFor(spec, uttered);

        // A false conclusion names some other cell's symbol, so rejecting it
        // still requires resolving the perspective rather than spotting a
        // symbol that never appeared.
        const claimed = coinFlip()
            ? correct
            : pickUniqueItems(question.bucket.filter(s => s !== correct), 1).picked[0];

        question.conclusion = statementFor(spec.axes, uttered, claimed);
        question.isValid = verifyAnswer(spec, uttered, claimed);

        if (question.premises.includes(question.conclusion as string)) continue;
        return question;
    }

    throw new Error("Cannot generate.");
}
