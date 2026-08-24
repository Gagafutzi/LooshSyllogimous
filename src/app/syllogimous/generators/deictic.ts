/**
 * Deictic relations — perspective taking.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { hi, subj } from "../utils/phrasing";
import { GeneratorContext, deepConclusions, buildSeries, extendWithSeries, seriesWanted } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, isPremiseLikeConclusion, pickUniqueItems, shuffle } from "../utils/question.utils";
import { DeicticSpec, POLES, allCoords, answerFor, buildDeicticSpec, coordKey, resolve, reversalTextFor, statementFor, verifyAnswer } from "../utils/deictic.utils";
import { scrambleLeading } from "../utils/premise-order.utils";
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
    const deep = deepConclusions(ctx);

    for (let attempt = 0; attempt < 200; attempt++) {
        // 3 axes need 8 grid symbols; ask for the max so either width fits.
        const symbols = getRandomSymbols(settings, 8);
        /*
         * One more than was asked for, because one statement is about to be
         * withheld. Without it a deep item is a premise short of the count the
         * ability model was told it would get, and the model would be crediting
         * a longer item than the player saw.
         *
         * It also moves the two-to-three axis boundary down by one, which is
         * the right way round: a frame that has to give a statement up needs
         * room to give it up in.
         */
        const spec = buildDeicticSpec(numOfPremises + (deep ? 1 : 0), symbols);
        const cells = allCoords(spec.axes.length);

        question.bucket = cells.map(c => spec.grid[coordKey(c)]);

        const uttered = cells[Math.floor(Math.random() * cells.length)];
        const landed = coordKey(resolve(uttered, spec.reversals));

        /*
         * The cell the answer is at is the one nobody states.
         *
         * Four grid premises and a reversal, and the answer read off exactly
         * one of the four: that was the reported item, and no count of
         * reversals repairs it, because the grid statements are independent
         * facts and a conclusion can only ever need one of them.
         *
         * So the grid is stated one short and the missing entry is the one
         * asked about. Every position holds a different one of the listed
         * things, so each statement rules one out, and what is left over is
         * what the unstated position holds. Now every premise is load-bearing:
         * drop any of them and the answer is two things at once.
         *
         * The item comes out one premise shorter and considerably harder,
         * which is the trade this whole section is about — depth is structure,
         * not length. And the position the utterance *names* is still stated,
         * which makes it the trap it should always have been: it is the answer
         * for anyone who read past the reversal.
         */
        const shown = deep ? cells.filter(c => coordKey(c) !== landed) : cells;

        const gridPremises = shown.map(c =>
            statementFor(spec.axes, c, spec.grid[coordKey(c)])
        );

        question.setup = deep ? [ELIMINATION_NOTE(question.bucket)] : [];

        /*
         * Reversals are stated after the grid, and the scramble is not allowed
         * to move them.
         *
         * They operate on facts already fixed, so presenting them first reads
         * as nonsense — and worse, it turns the mode into a different exercise.
         * Read last, a reversal is an operation applied to a structure that has
         * to be held whole. Read first, it is a substitution rule: every
         * premise after it can be rewritten on sight and forgotten, and the
         * conclusion then follows from that one premise and whichever cell it
         * names. That is two premises out of five, which is the shallow
         * conclusion the depth work exists to remove.
         *
         * The order was already built this way and then handed to
         * `scrambleByFactor`, which shuffles the lot — so the intent was in the
         * code and undone one line later. `scrambleLeading` scrambles the grid
         * among itself and leaves the tail alone, which is the same thing
         * transformation premises already needed.
         *
         * One premise per reversed axis, so no two of them say the same thing.
         */
        const reversalPremises = spec.reversals
            .flatMap((parity, axis) => parity ? [reversalTextFor(spec.axes[axis])] : []);
        shuffle(gridPremises);
        shuffle(reversalPremises);
        question.premises = scrambleLeading(
            [...gridPremises, ...reversalPremises],
            gridPremises.length,
            ctx.settingsOverrideService.scramble);

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
        // Grid statements plus the reversals that had to be applied: under
        // elimination that is the whole premise set, and it is what the item
        // reports rather than what the generator hoped for.
        question.depth = gridPremises.length
            + spec.reversals.filter(r => r % 2 === 1).length;
        question.explanation = explainDeictic(spec, uttered, correct, claimed, deep);

        /*
         * More utterances against the same grid and the same reversals.
         *
         * The reversals are the expensive part and they are read once; a second
         * utterance asks the reader to apply them again to a different cell,
         * which is the thing the mode is for. Under elimination the withheld
         * position is a further trap: most cells are stated, so a claim about
         * one of those is answered by reading, and a claim about the gap is not.
         */
        if (seriesWanted(ctx)) {
            extendWithSeries(question, buildSeries(want => {
                const cell = cells[Math.floor(Math.random() * cells.length)];
                const right = answerFor(spec, cell);
                if (!right) return null;

                const said = want
                    ? right
                    : pickUniqueItems(question.bucket.filter(s => s !== right), 1).picked[0];
                if (!said) return null;

                const text = statementFor(spec.axes, cell, said);
                if (question.premises.includes(text)) return null;

                return {
                    text,
                    isValid: verifyAnswer(spec, cell, said),
                    key: coordKey(cell) + "|" + said,
                };
            }));
        }
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * The list of things, and the rule that makes leaving one out answerable.
 *
 * Stated with the item rather than assumed: without it, an unstated position
 * holds anything at all and the conclusion is not derivable but merely likely.
 */
const ELIMINATION_NOTE = (symbols: string[]) =>
    "Each position holds a different one of these: "
    // Marked up as subjects, not merely highlighted: these are the item's
    // objects, and the guard against a conclusion naming something unstated
    // reads the setup the same way it reads a premise.
    + symbols.map(s => subj(s)).join(", ")
    + ". One position is not stated, so what it holds is whatever the others"
    + " leave over.";

/** Which cell the utterance actually picks out, and why that one. */
function explainDeictic(
    spec: DeicticSpec,
    uttered: number[],
    correct: string,
    claimed: string,
    deep: boolean,
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
    /*
     * Where the answer comes from, and it is not the same place in the two
     * models. Stated, it is read off; left out, it is what the others do not
     * account for — and that second sentence is the whole exercise, so a
     * derivation that skipped it would explain the easy half.
     */
    lines.push(deep
        ? `No statement names that position, and every other one accounts for`
        + ` a different thing, so what is left over is ${subj(correct)}.`
        : `That cell holds ${subj(correct)}.`);
    lines.push(`so the claim about ${subj(claimed)} is ${hi(correct === claimed ? "true" : "false")}.`);
    return lines;
}
