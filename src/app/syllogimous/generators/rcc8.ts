/**
 * Region Connection — every way two patches could still stand.
 *
 * Isomorph's guide: *"Regions, and the eight ways two of them can stand: apart,
 * touching from outside, partly overlapping, inside touching the edge, deep
 * inside, the two converses of those, or identical. Chaining two relations rarely
 * gives one answer — it gives a set. Select every relation that is still
 * possible; only the exact set counts. Later: premises that are themselves
 * disjunctions."*
 *
 * The same lesson Interval Algebra teaches, over a relation that is about
 * *containment and contact* rather than about order — and the harder version of
 * it. On a line, "A is before B and B is before C" settles A and C outright; here
 * almost nothing settles anything, because two regions apart from a third can
 * still stand any way at all to each other. The composed answer is a set of five
 * as often as a set of one.
 *
 * ── Rectangular patches, said on the card ──
 *
 * The domain is axis-aligned rectangles, and the card says so rather than saying
 * "regions". `interval-algebra.utils` records why at length: the answer has to be
 * the *exact* set, a composition table gives a superset, and blobs on a grid make
 * "touching the edge" ambiguous. Rectangles realise all eight relations, admit
 * three mutually touching patches — which a line does not, and which is why the
 * interval version cannot wear this name — and their relation is exactly a
 * function of the interval relation on each axis. What is given up is that the
 * rectangle algebra is a restriction of RCC8, so the card's claim is about what
 * the card says it is about.
 *
 * ── Three patches, and what makes the item grow ──
 *
 * Three, because the answer is read by walking every arrangement: 409 interval
 * arrangements per axis is 167,281 in all, and four patches would be 23,917
 * squared. So the size of the card cannot be what grows. What grows instead is
 * how much the premises *say*: at the smallest they state one relation each, and
 * above that one or both become disjunctions — true, but leaving the reader two
 * branches to carry rather than one. That is Isomorph's own later rung, and it is
 * the honest growth axis for a mode whose space is fixed.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    PatchFact, RCC8_DEFINITIONS, RCC8_NAMES, intervalStates, rcc8Between, rcc8Possible,
} from "../utils/interval-algebra.utils";
import { GeneratorContext } from "./context";

/** How the card states one relation, and how it offers one. */
const claim = (a: string, r: number, b: string) =>
    `${subj(a)} ${rel(RCC8_NAMES[r])} ${subj(b)}`;

/** A premise that names two or more relations, one of which holds. */
const disjunction = (a: string, options: number[], b: string) =>
    `${subj(a)} ${options.map(r => rel(RCC8_NAMES[r])).join(" or ")} ${subj(b)}`;

export function createRcc8(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createRcc8");

    const type = EnumQuestionType.Rcc8;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const n = 3;
    /* Above the floor, premises stop naming one relation and start naming two. */
    const vague = Math.max(0, Math.min(2, numOfPremises - 2));

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, n);
        if (new Set(words).size !== n) continue;

        const states = intervalStates(n);
        const truth = {
            alongX: states[Math.floor(Math.random() * states.length)],
            alongY: states[Math.floor(Math.random() * states.length)],
        };

        const pairs: Array<[number, number]> = [];
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
        const [x, y] = pickUniqueItems(pairs, 1).picked[0];
        const speakable = pairs.filter(([a, b]) => !(a === x && b === y));

        /* Each premise names the relation that holds, and sometimes one that does
           not — which keeps it true while telling the reader less. */
        const loosened = shuffle([...Array(speakable.length).keys()]).slice(0, vague);
        const said: PatchFact[] = speakable.map(([a, b], i) => {
            const held = rcc8Between(truth, a, b);
            if (!loosened.includes(i)) return { a, b, options: [held] };
            const extra = shuffle([...Array(8).keys()]).find(r => r !== held)!;
            return { a, b, options: [held, extra].sort((p, q) => p - q) };
        });
        if (said.length < 2) continue;

        const { possible, survivors } = rcc8Possible(n, said, x, y);
        if (!possible.length) continue;                 // cannot happen: truth is one
        /*
         * All eight is the answer to "these premises say nothing about that pair",
         * which a reader gives by selecting everything. Seven is the same problem
         * one button smaller.
         */
        if (possible.length > 6) continue;

        /*
         * **A disjunction has to cost something.** Widened premises that leave the
         * answer exactly where the exact ones did are premises the reader could
         * have read as exact — so the extra branch is decoration and the ladder's
         * larger number buys nothing.
         */
        if (vague > 0) {
            const tight = said.map(f => ({ ...f, options: [f.options.find(
                r => r === rcc8Between(truth, f.a, f.b))!] }));
            const narrow = rcc8Possible(n, tight, x, y).possible;
            if (narrow.join(",") === possible.join(",")) continue;
        }

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            said.map(f => f.options.length === 1
                ? claim(words[f.a], f.options[0], words[f.b])
                : disjunction(words[f.a], f.options, words[f.b])),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        /* All eight, in the order the guide names them, each saying what it means —
           the same reasoning Interval Algebra's thirteen follow. */
        question.choices = RCC8_NAMES.map((_, r) =>
            `${claim(words[x], r, words[y])}`
            + `<span class="d-block small text-muted">${RCC8_DEFINITIONS[r]}</span>`);
        question.selectAnswer = [...possible];
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select every relation that is still possible.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "These are <b>rectangular patches</b> of a surface, and there are eight ways "
            + "two of them can stand. Chaining two of those gives a <b>set</b> of "
            + "possibilities rather than one answer — usually a large one.",
            `Select <b>every</b> relation still possible between ${subj(words[x])} and `
            + `${subj(words[y])}.`,
        ];

        question.explanation = [
            `${hi(String(survivors))} ways of laying these patches out fit every premise`,
            `in them, ${subj(words[x])} stands to ${subj(words[y])} in `
            + `${hi(String(possible.length))} of the eight ways: `
            + possible.map(r => RCC8_NAMES[r]).join(", "),
            `the other ${8 - possible.length} would each need an arrangement no premise `
            + "allows",
            vague > 0
                ? "and the premises that name two relations each leave both open, so both "
                    + "branches had to be carried"
                : "chaining two relations of this kind rarely settles anything, which is "
                    + "what the set is for",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
