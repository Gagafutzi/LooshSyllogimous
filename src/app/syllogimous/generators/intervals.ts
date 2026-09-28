/**
 * Interval Algebra — every relation still possible between two periods.
 *
 * Isomorph's guide: *"Periods of time, and the thirteen ways two of them can
 * stand (Allen's relations): before, meets, overlaps, starts, during, finishes,
 * equals, and their converses. Periods have length, so chaining two relations
 * gives a set, not a point on a line. Select every relation still possible
 * between the two periods asked about."*
 *
 * The mode exists for one fact, and the fact is not an opinion: a relation
 * composed from two others is usually a *set*. Every other mode in this app is
 * built on relations that compose to a point — A above B and B above C gives A
 * above C, full stop — and a reader who has only met those has been trained to
 * expect an answer. Here, "A overlaps B and B is during C" leaves five relations
 * open between A and C, and the correct answer is the five. That is the thing
 * transitive reasoning does not prepare anybody for.
 *
 * ── Why the options are all thirteen ──
 *
 * The thirteen are exclusive and exhaustive, so they are the answer space, and
 * offering a shortlist would be answering the question. They are shown in
 * Allen's order — wholly earlier, through the overlaps and containments, to
 * wholly later — which makes the menu a ladder that can be walked rather than
 * thirteen unrelated words to be hunted. Each option carries what it means, so
 * the vocabulary is at the point of use instead of in a legend above.
 *
 * The floor is one subset in `2^13`, and `guessRateFor("select", …)` prices it,
 * which is right: naming the exact possible set is strong evidence and naming
 * twelve of thirteen is not credited as nearly right, because it is not.
 *
 * ── What makes an item well-formed ──
 *
 * Premises are read off one real arrangement, so at least one survives and the
 * answer is never empty. The asked pair is never stated, or the card would be
 * handing back a premise. The answer is enumerated rather than composed from a
 * table: a relation is offered as possible exactly when some surviving
 * arrangement of the endpoints realises it, which is a fact about the premises
 * and not a claim about how they were built. And an item leaving all thirteen
 * open is rejected — it is a true reading, but one a player can answer by
 * selecting everything.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems } from "../utils/question.utils";
import { hi, own, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    ALLEN_DEFINITIONS, ALLEN_NAMES, ALLEN_WEIGHTS, IntervalFact,
    allenBetween, consistentIntervalStates, intervalStates, possibleBetween,
} from "../utils/interval-algebra.utils";
import { GeneratorContext } from "./context";

/** How the card states one relation, and how it offers one. */
const claim = (a: string, r: number, b: string) =>
    `${subj(a)} ${own(`allen-${r}`)} ${subj(b)}`;

export function createIntervals(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createIntervals");

    const type = EnumQuestionType.Intervals;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    for (let attempt = 0; attempt < 400; attempt++) {
        /*
         * Three periods, or four once there are premises enough to constrain
         * them. Four is 23,917 arrangements of eight endpoints, enumerated once
         * and kept; five would be two orders of magnitude more for a card that
         * already asks for a thirteen-way selection.
         */
        const n = numOfPremises >= 4 ? 4 : 3;
        const words = getRandomSymbols(settings, n);
        if (new Set(words).size !== n) continue;

        const every = intervalStates(n);
        const truth = every[Math.floor(Math.random() * every.length)];

        const pairs: Array<[number, number]> = [];
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);

        const [x, y] = pickUniqueItems(pairs, 1).picked[0];
        const speakable = pairs.filter(([a, b]) => !(a === x && b === y));
        if (!speakable.length) continue;

        const drawn = pickUniqueItems(
            speakable, Math.min(numOfPremises, speakable.length)).picked;
        const said: IntervalFact[] = drawn.map(([a, b]) =>
            ({ a, b, options: [allenBetween(truth, a, b)] }));

        /*
         * Isomorph's weights, applied where they belong — to which premises are
         * worth stating. "Is before" and "is after" say least: two periods with
         * no moment in common barely constrain the others, so a card made of
         * them leaves everything open. "Equals" says too much the other way, by
         * collapsing two periods into one and taking the reading with them.
         * Kept at the stated rate rather than banned, since both are relations a
         * player has to be able to reason from.
         */
        if (said.some(f => Math.random() > ALLEN_WEIGHTS[f.options[0]])) continue;

        const survivors = consistentIntervalStates(n, said);
        if (!survivors.length) continue;            // cannot happen: truth is one

        const possible = possibleBetween(survivors, x, y);
        if (!possible.length) continue;             // nor can this
        /*
         * All thirteen is a true reading and a useless card: it is the answer to
         * "these premises tell you nothing about that pair", which a player
         * gives by selecting everything without reading. Twelve is the same
         * problem one button smaller.
         */
        if (possible.length > 11) continue;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            said.map(f => claim(words[f.a], f.options[0], words[f.b])),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        /*
         * Every relation, in Allen's order, each with what it means.
         *
         * The definition rides on the option rather than sitting in a legend
         * above the card: it is needed exactly when the option is being weighed,
         * and thirteen definitions stacked over the premises would be the
         * largest thing on the screen. Styled with the utilities already loaded,
         * since `game.component.css` has no room for a rule of its own.
         */
        question.choices = ALLEN_NAMES.map((_, r) =>
            `${claim(words[x], r, words[y])}`
            + `<span class="d-block small text-muted">${ALLEN_DEFINITIONS[r]}</span>`);
        question.selectAnswer = [...possible];
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select every relation that is still possible.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "These are <b>periods of time</b>, and they have length, so there are "
            + "thirteen ways two of them can stand. Chaining two of those gives a "
            + "<b>set</b> of possibilities rather than one answer.",
            `Select <b>every</b> relation still possible between ${subj(words[x])} `
            + `and ${subj(words[y])} — which may be one, and is usually several.`,
        ];

        question.explanation = explain(words, survivors.length, possible, x, y);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why those and not the others.
 *
 * Counted over the arrangements, because that is what the answer is: a relation
 * is in because some way of laying the periods out consistently with every
 * premise realises it, and out because none does. A derivation through a
 * composition table would be reasoning the player has not been given the table
 * for.
 */
function explain(
    words: string[],
    survivors: number,
    possible: number[],
    x: number,
    y: number,
): string[] {
    const ruled = ALLEN_NAMES.map((_, r) => r).filter(r => !possible.includes(r));
    return [
        `${hi(String(survivors))} way${survivors === 1 ? "" : "s"} of laying these `
        + `periods out fit${survivors === 1 ? "s" : ""} every premise`,
        `in ${possible.length === 1 ? "all of them" : "them"}, `
        + `${subj(words[x])} stands to ${subj(words[y])} in `
        + `${hi(String(possible.length))} of the thirteen ways: `
        + possible.map(r => ALLEN_NAMES[r]).join(", "),
        ruled.length
            ? `the other ${ruled.length} would each need an arrangement no premise allows`
            : "no arrangement is ruled out, so every relation survives",
        possible.length === 1
            ? "so the premises settle the pair outright, which the algebra does "
                + "sometimes do"
            : "so the premises narrow the pair without settling it — which is what "
                + "composing interval relations does",
    ];
}
