/**
 * Deictic relations — perspective taking.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { hi, subj } from "../utils/phrasing";
import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, isPremiseLikeConclusion, pickUniqueItems, shuffle } from "../utils/question.utils";
import { DeicticSpec, POLES, allCoords, answerFor, buildDeicticSpec, coordKey, reversalTextFor, statementFor, verifyAnswer } from "../utils/deictic.utils";
import { scrambleByFactor } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createDeictic(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createDeictic");

    const settings = ctx.settings;
    const type = EnumQuestionType.Deictic;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

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

        /*
         * The whole difficulty of this mode is that a reversed axis makes the
         * word mean its opposite, and the characteristic error is resolving one
         * axis and forgetting the other. So the derivation walks the axes one at
         * a time and says, for each, whether the word still points where it
         * says — then names the cell that lands on.
         */
        question.explanation = explainDeictic(spec, uttered, correct, claimed);
        return question;
    }

    throw new Error("Cannot generate.");
}

/** Which cell the utterance actually picks out, and why that one. */
function explainDeictic(
    spec: DeicticSpec,
    uttered: number[],
    correct: string,
    claimed: string,
): string[] {
    const resolved = uttered.map((v, axis) => (spec.reversals[axis] % 2 ? 1 - v : v));

    const lines = spec.axes.map((axis, i) => {
        const flipped = spec.reversals[i] % 2 === 1;
        const said = POLES[axis][uttered[i]];
        const meant = POLES[axis][resolved[i]];
        return flipped
            ? `${hi(axis)} is reversed, so "${said}" means ${hi(meant)}.`
            : `${hi(axis)} is not reversed, so "${said}" still means ${hi(meant)}.`;
    });

    /*
     * The right symbol is named, but not in the closing line.
     *
     * A false item claims some *other* cell's symbol, so a derivation that ends
     * "the cell holds X" ends on an object the conclusion never mentions — the
     * shape of the one dangerous bug this project has had, where a derivation
     * proved a claim the item did not make. Naming it a line earlier keeps the
     * correction and lets the closing line answer the question that was asked.
     */
    lines.push(`That cell holds ${subj(correct)}.`);
    lines.push(`so the claim about ${subj(claimed)} is ${hi(correct === claimed ? "true" : "false")}.`);
    return lines;
}
