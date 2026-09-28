/**
 * Possibility Sets — select everything that could still be true.
 *
 * The first mode in this app answered by a selection, and the first built over
 * the relation systems rather than over a layout of its own. Both of those are
 * the point: it is the shape the rest of the imported band is made in.
 *
 * Every other mode here builds one arrangement and asks about it, so the only
 * honest answers are "yes", "no" and "one of these". This builds the *set* of
 * arrangements the premises still allow, and asks which outcomes survive in it.
 * A pair every survivor agrees about is settled; a pair they differ on is
 * genuinely open — and "it could be either" stops being a way of not answering
 * and becomes the answer, which is the thing the band exists to train.
 *
 * ── Why only the relations that run one way ──
 *
 * Three outcomes are offered: the relation runs one way, the other way, or
 * neither. On a symmetric system — sameness of group, adjacency, opposition —
 * the first two are the same statement said twice, so one option could never be
 * selected and the reader would learn to ignore it rather than settle it. The
 * systems used here are the ones where all three are distinguishable, which is
 * also what Isomorph's own wording assumes: beats, is beaten by, or neither.
 *
 * ── What makes an item well-formed ──
 *
 * The premises are drawn from a real arrangement, so at least one survives and
 * the answer is never empty by accident. The pair asked about is never one the
 * premises state, or the surviving set would be answering a question it had
 * been handed. And the answer is checked by enumeration rather than by rule:
 * an outcome is offered as possible exactly when some surviving arrangement
 * realises it, which is a fact about the premise set rather than a claim about
 * how it was built.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates,
} from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";

/**
 * A made-up word for the relation, so nothing is carried in from elsewhere.
 *
 * The mode is about what the premises settle, and a relation the reader already
 * has intuitions about is a relation they can answer from those instead. The
 * system's description says what it does; the word says nothing at all.
 */
const INVENTED = [
    { stem: "glorp", third: "glorps" },
    { stem: "vex", third: "vexes" },
    { stem: "thrum", third: "thrums" },
    { stem: "quell", third: "quells" },
    { stem: "brand", third: "brands" },
];

/** The systems whose relation runs one way, so the two directions differ. */
const oneWay = (s: RelationSystem) => s.meaning.includes("one way only")
    || s.meaning.includes("never runs both ways");

/**
 * Whether "neither way" is ever true of a pair, at this size.
 *
 * Asymmetry is not enough on its own. A strict *total* order puts every pair in
 * one order or the other, so its third option is false in every item ever
 * built — and an option that is never the answer is one a reader stops reading,
 * which is worse than not offering it. Successor and ancestry leave pairs
 * unrelated all the time; a rock-paper-scissors circle does whenever two are
 * the same kind.
 *
 * Checked against the arrangements rather than assumed from the description,
 * because it is a fact about the relation *and the size*: it is the sort of
 * thing that would quietly stop being true if a system's enumeration changed.
 */
function everLeavesOpen(s: RelationSystem, n: number): boolean {
    return s.states(n).some(state =>
        !s.holds(state, 0, 1) && !s.holds(state, 1, 0));
}

export function createPossibilitySets(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createPossibilitySets");
    return buildPossibility(
        ctx, numOfPremises, EnumQuestionType.PossibilitySets, ALL_SYSTEMS.filter(oneWay));
}

/**
 * The question both possibility modes ask, over whichever systems it is given.
 *
 * Isomorph's arrangement, and the reason porting the band is cheap: the mode
 * says what is asked and the system says what the relation means, so a second
 * mode over the same question is a different pool of systems rather than a
 * second generator. Cyclic Dominance is this asked of the dominance circles;
 * Possibility Sets is this asked of everything that runs one way.
 */
export function buildPossibility(
    ctx: GeneratorContext,
    numOfPremises: number,
    type: EnumQuestionType,
    pool: RelationSystem[],
): Question {
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    if (!pool.length) throw new Error("Cannot generate.");

    for (let attempt = 0; attempt < 300; attempt++) {
        const system = pickUniqueItems(pool, 1).picked[0];
        /*
         * Entities are the width and premises are the reading. They are drawn
         * apart because the state space is what has to stay enumerable: four or
         * five entities is a few thousand arrangements to filter, and more
         * premises narrow that rather than growing it.
         */
        const n = Math.min(system.maxN, 4 + (numOfPremises > 5 ? 1 : 0));
        if (!everLeavesOpen(system, n)) continue;
        const words = getRandomSymbols(settings, n);
        if (new Set(words).size !== n) continue;

        const every = system.states(n);
        if (!every.length) continue;
        const truth = every[Math.floor(Math.random() * every.length)];

        /* Pairs the premises may speak about, and the one they may not. */
        const pairs: Array<[number, number]> = [];
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) pairs.push([a, b]);

        const asked = pickUniqueItems(pairs, 1).picked[0];
        const [x, y] = asked;
        const speakable = pairs.filter(([a, b]) =>
            !(a === x && b === y) && !(a === y && b === x));

        /*
         * Weighted towards pairs that touch the two being asked about.
         *
         * Drawn evenly, the premises are mostly about the other entities and
         * the asked pair stays wide open however many there are — every item
         * came out "all three still possible", which is an answer a reader can
         * give without reading. Two thirds of the premises bear on the pair, so
         * the premise count is what settles it, which is what the count is
         * supposed to mean.
         */
        const touching = speakable.filter(([a, b]) => a === x || b === x || a === y || b === y);
        const rest = speakable.filter(([a, b]) => !(a === x || b === x || a === y || b === y));
        const wanted = Math.min(numOfPremises, speakable.length);
        const near = Math.min(touching.length, Math.ceil(wanted * 2 / 3));
        const drawn = [
            ...pickUniqueItems(touching, near).picked,
            ...pickUniqueItems(rest, Math.min(rest.length, wanted - near)).picked,
        ];
        if (drawn.length < Math.min(3, wanted)) continue;
        const stated = drawn.map(([a, b]) => ({ a, b, holds: system.holds(truth, a, b) }));

        const survivors = consistentStates(system, n, stated);
        if (!survivors.length) continue;          // cannot happen: truth is one

        /*
         * An outcome is possible exactly when some survivor realises it. Read
         * off the survivors rather than reasoned about, which is what makes the
         * answer a fact about the premises.
         */
        const forward = survivors.some(s => system.holds(s, x, y));
        const backward = survivors.some(s => system.holds(s, y, x));
        const neither = survivors.some(s => !system.holds(s, x, y) && !system.holds(s, y, x));

        /*
         * An item where all three survive is a real one — the premises can
         * leave a pair wide open — but it is also the one a reader can answer
         * by selecting everything without reading anything. Most items have to
         * settle something, so the loose draw is kept occasionally rather than
         * usually.
         */
        const open = Number(forward) + Number(backward) + Number(neither);
        if (open === 3 && Math.random() > 0.25) continue;

        const word = INVENTED[Math.floor(Math.random() * INVENTED.length)];
        const options = [
            { text: `${subj(words[x])} ${rel(word.third)} ${subj(words[y])}`, possible: forward },
            { text: `${subj(words[y])} ${rel(word.third)} ${subj(words[x])}`, possible: backward },
            { text: `neither ${rel(word.third)} the other`, possible: neither },
        ];

        const shown = shuffle([...options]);
        const answer = shown.map((o, i) => o.possible ? i : -1).filter(i => i >= 0);
        if (!answer.length) continue;             // survivors always realise one

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            stated.map(p => p.holds
                ? `${subj(words[p.a])} ${rel(word.third)} ${subj(words[p.b])}`
                : `${subj(words[p.a])} does not ${rel(word.stem)} ${subj(words[p.b])}`),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        question.choices = shown.map(o => o.text);
        question.selectAnswer = answer;
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select everything that could still be true.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `<b>${hi(word.third)}</b> is ${system.meaning}.`,
            "Some of what holds is stated and the rest is not. Select <b>every</b> "
            + "outcome the premises still leave open — which may be more than one, "
            + "and may be only one.",
        ];

        question.explanation = explain(system, words, word.third, survivors.length, shown, [x, y]);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why those and not the others.
 *
 * Written as a count of what survives, because that is what the answer is: an
 * outcome is in because some arrangement consistent with every premise has it,
 * and out because none does. A derivation that argued the pair directly would
 * be reasoning the player cannot check against the premises they were given.
 */
function explain(
    system: RelationSystem,
    words: string[],
    word: string,
    survivors: number,
    shown: Array<{ text: string; possible: boolean }>,
    [x, y]: [number, number],
): string[] {
    const open = shown.filter(o => o.possible).length;
    return [
        `${hi(String(survivors))} arrangement${survivors === 1 ? "" : "s"} of these fit `
        + `every premise, since ${word} is ${system.meaning}`,
        ...shown.map(o => `${o.text}: ${o.possible
            ? "some of them have it, so it is still open"
            : "none of them has it, so the premises rule it out"}`),
        open === 1
            ? `so the premises settle ${subj(words[x])} and ${subj(words[y])} outright`
            : open === 3
            ? "so the premises leave all three open"
            : `so ${hi("two")} of the three are still open`,
    ];
}
