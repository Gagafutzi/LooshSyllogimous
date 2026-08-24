/**
 * Binary — boolean operators composed over two other questions.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { hi } from "../utils/phrasing";
import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, shuffle, fixBinaryInstructions } from "../utils/question.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

/** The sub-question's own claim, however it phrased it. */
const asClaim = (q: Question) =>
    Array.isArray(q.conclusion) ? q.conclusion[0] : q.conclusion;

const truth = (v: boolean) => hi(v ? "true" : "false");

export function createBinary(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createBinary");

    const topType = EnumQuestionType.Binary;
    const settings = ctx.settings;

    if (!canGenerateQuestion(topType, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(topType, numOfPremises);

    const operands = [];
    const operandNames = [];
    const operandTemplates = [];

    if (settings.enabled.binary.and) {
        operands.push("a&&b");
        operandNames.push("AND");
        operandTemplates.push('$a <div class="is-connector">and</div> $b');
    }
    if (settings.enabled.binary.nand) {
        operands.push("!(a&&b)");
        operandNames.push("NAND");
        operandTemplates.push('$a <div class="is-connector">and</div> $b <div class="is-connector">are not both true</div>');
    }
    if (settings.enabled.binary.or) {
        operands.push("a||b");
        operandNames.push("OR");
        operandTemplates.push('$a <div class="is-connector">or</div> $b');
    }
    if (settings.enabled.binary.nor) {
        operands.push("!(a||b)");
        operandNames.push("NOR");
        operandTemplates.push('$a <div class="is-connector">and</div> $b <div class="is-connector">are both false</div>');
    }
    if (settings.enabled.binary.xor) {
        operands.push("!(a&&b)&&(a||b)");
        operandNames.push("XOR");
        operandTemplates.push('$a <div class="is-connector">differs from</div> $b');
    }
    if (settings.enabled.binary.xnor) {
        operands.push("!(!(a&&b)&&(a||b))");
        operandNames.push("XNOR");
        operandTemplates.push('$a <div class="is-connector">is equal to</div> $b');
    }

    /*
     * Binary composes two other questions into one claim, so neither inner
     * item's series survives: the operands are read for their conclusions, and
     * the compound is a single true-or-false about both.
     */
    const question = new Question(topType);
    const flip = coinFlip();
    const operandIndex = Math.floor(Math.random() * operands.length);
    const operand = operands[operandIndex];

    let safe = 1e2;
    do {
        const a = ctx.random(Math.floor(numOfPremises / 2), true);
        const b = ctx.random(Math.ceil(numOfPremises / 2), true);
        const choices = [a, b];

        // Per-item: which sub-questions this one was composed from. Without
        // it there is nothing to apply the operator to.
        question.setup = [fixBinaryInstructions(a), fixBinaryInstructions(b)].filter(instr => !!instr);

        question.premises = [...choices[0].premises, ...choices[1].premises];
        shuffle(question.premises);

        question.conclusion = operandTemplates[operandIndex]
            .replace("$a", Array.isArray(choices[0].conclusion) ? choices[0].conclusion[0] : choices[0].conclusion)
            .replace("$b", Array.isArray(choices[1].conclusion) ? choices[1].conclusion[0] : choices[1].conclusion);

        question.isValid = eval(
            operand
                .replaceAll("a", String(choices[0].isValid))
                .replaceAll("b", String(choices[1].isValid))
        );

        /*
         * Which half failed.
         *
         * This mode's characteristic error is not misreading the operator, it
         * is losing track of one of the two sub-questions while working the
         * other — and a bare "wrong" leaves the player unable to tell which
         * happened. Stating each half's truth separately before combining them
         * says exactly where it went, and costs nothing: both truths were just
         * computed to decide the item.
         */
        question.explanation = [
            `The first part — ${asClaim(choices[0])} — is ${truth(choices[0].isValid)}.`,
            `The second part — ${asClaim(choices[1])} — is ${truth(choices[1].isValid)}.`,
            `so the whole statement is ${truth(question.isValid)}.`,
        ];
    } while (safe-- && flip !== question.isValid);

    if (safe <= 0) {
        throw new Error("MAXIMUM NUMBER OF ITERATIONS REACHED!");
    }

    return question;
}
