/**
 * Cross-System Analogy — two systems, two vocabularies, one dictionary.
 *
 * Isomorph's guide: *"Two systems with the same structure, described in different
 * words: yours, and the second system's own. The correspondences say which entities
 * play the same part in both; line them up and the dictionary between the two
 * vocabularies follows (which word is north, which is east, which way round). Then
 * complete an analogy that starts in the first system and ends in the second."*
 *
 * Every other mode here is read in one vocabulary. This one is read in two, and the
 * translation between them is not given — it is the thing to be worked out, from
 * nothing but a handful of entities said to play the same part in both. That is what
 * makes it the last of the imported band: the reader has to build the dictionary
 * before a single relation can be carried across, and the dictionary is what most
 * real transfer of an idea actually needs.
 *
 * ── Why the correspondences cannot cover the answer ──
 *
 * If the two entities in the first half of the analogy both had their counterparts
 * stated, the answer would be one of them read off — no dictionary needed, and the
 * mode would be a lookup. So the correspondences are checked to pin the dictionary
 * *and* to leave the answer out of reach: the second system's entity asked about is
 * not the counterpart of the first half's, and the answer's counterpart is never
 * stated.
 *
 * ── The dictionary has to be the only one ──
 *
 * The second system's directions are its own invented words, and the dictionary is
 * which invented word is which direction and which way round — a signed permutation
 * of the axes. The item is kept only when exactly one such map agrees with every
 * stated correspondence. That is what makes "line them up and the dictionary
 * follows" true rather than hopeful, and it is checked by trying all of them.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { PAIR_RELATION_WORDS, hi, own, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    AxisSpec, axesForDimensions, buildNdLayout, derivedPairs, ndAxisColors,
    renderNdPattern, renderNdPremises,
} from "../utils/ndspace.utils";
import { permutations } from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { INVENTED } from "./possibility";
import { pairText } from "./analogy-completion";

type Vec = number[];
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

/**
 * A dictionary: which of our axes each of their words is, and which way round.
 *
 * `axis[k]` is the axis of ours that their `k`th word names, and `flip[k]` is -1
 * when their positive direction is our negative one. So a displacement of ours
 * reads, in their words, as `their[k] = flip[k] * ours[axis[k]]`.
 */
interface Dictionary { axis: number[]; flip: number[]; }

const translate = (d: Dictionary, ours: Vec): Vec =>
    d.axis.map((a, k) => d.flip[k] * ours[a]);

/** Every signed permutation of `dims` axes. */
function dictionaries(dims: number): Dictionary[] {
    const out: Dictionary[] = [];
    for (const axis of permutations(dims)) {
        for (let mask = 0; mask < (1 << dims); mask++) {
            out.push({
                axis,
                flip: [...Array(dims).keys()].map(k => (mask & (1 << k) ? -1 : 1)),
            });
        }
    }
    return out;
}

const axisCount = (numOfPremises: number) =>
    Math.max(2, Math.min(3, numOfPremises - 6));

export function createCrossAnalogy(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createCrossAnalogy");

    const type = EnumQuestionType.CrossAnalogy;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const dims = axisCount(numOfPremises);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));
    const all = dictionaries(dims);
    const colors = ndAxisColors(axes);

    for (let attempt = 0; attempt < 400; attempt++) {
        /*
         * The count has to change the item, and this did not: drawn from
         * `numOfPremises - 3` and clamped at six, every count from nine to twelve
         * built a six-entity pair of systems — fourteen lines whatever was asked
         * for. Measured across the range, as the ladder prints it.
         */
        const n = Math.max(5, Math.min(7, numOfPremises - 4));
        const words = getRandomSymbols(settings, 2 * n);
        if (new Set(words).size !== 2 * n) continue;
        const ours = words.slice(0, n);
        const theirs = words.slice(n);

        const layout = buildNdLayout(ours, axes);
        const pairs = derivedPairs(layout);
        if (pairs.length < 3) continue;

        /* Their words for their directions, meaning nothing until the dictionary
           is worked out. */
        const vocab = pickUniqueItems(INVENTED, dims).picked.map(w => w.stem);
        if (new Set(vocab).size !== dims) continue;

        /* The truth: which of ours each of their entities is, and the dictionary. */
        const who = shuffle([...Array(n).keys()]);          // theirs[i] is ours[who[i]]
        const truth = all[Math.floor(Math.random() * all.length)];

        /*
         * Their premises, in their words: the same structure, said their way. Two
         * entities of theirs stand as the entities of ours they answer to, read
         * through the dictionary.
         */
        const theirCoords = theirs.map((_, i) =>
            translate(truth, layout.coords[ours[who[i]]]));

        const theirLine = (i: number, j: number) => {
            const delta = theirCoords[i].map((v, k) => sign(v - theirCoords[j][k]));
            const said = delta
                .map((v, k) => v === 0
                    ? `level on ${rel(vocab[k])}`
                    : `${v > 0 ? "" : "counter-"}${rel(vocab[k])}`)
                .join(", ");
            return `${subj(theirs[i])} is ${said} relative to ${subj(theirs[j])}`;
        };

        /*
         * Their premises run along *our* layout's own edges.
         *
         * Stated between arbitrary pairs instead, a premise gives the direction of a
         * difference that may be several steps wide — and since the premises say only
         * direction, their layout stops being reconstructible from them. The card
         * would be under-determined: not hard, unanswerable, with the reader unable
         * to fix their arrangement at all. Along the edges of the layout every
         * difference is one step, so its direction *is* the step, exactly as our own
         * premises work.
         */
        const theirOf = (ourWord: string) => who.indexOf(ours.indexOf(ourWord));
        const theirLines = layout.edges.map(e => theirLine(theirOf(e.to), theirOf(e.from)));
        if (theirLines.length < n - 1) continue;

        /*
         * The correspondences: enough to pin the dictionary and no more. Grown one
         * at a time and stopped as soon as exactly one dictionary agrees with all
         * of them, so the card never states more than the reader needs.
         */
        const order = shuffle([...Array(n).keys()]);
        /*
         * The dictionaries still consistent with the correspondences stated so far.
         *
         * A single correspondence says nothing about the dictionary — one entity
         * matched to one entity is satisfied by every reading of their words. It
         * takes two before there is a displacement on each side to compare, which
         * is why everything here is measured from the first one stated.
         */
        const fits = (said: number[]) => said.length < 2 ? all : all.filter(d =>
            said.slice(1).every(i => {
                const anchor = layout.coords[ours[who[said[0]]]];
                const mine = layout.coords[ours[who[i]]].map((v, k) => v - anchor[k]);
                const theirs2 = theirCoords[i].map((v, k) => v - theirCoords[said[0]][k]);
                /*
                 * Compared as *signs*, not as exact steps.
                 *
                 * The card states directions — "quell" or "counter-quell" — so a
                 * reader reasoning in directions is the reader the item has to be
                 * unambiguous for. Compared exactly, one dictionary fitted while two
                 * agreed on every direction, and the second would have led to a
                 * different answer with nothing on the card to rule it out. The
                 * weaker comparison is the safer requirement: it admits fewer items
                 * and every item it admits has one reading at the level the answer
                 * depends on.
                 */
                return translate(d, mine).every((v, k) => sign(v) === sign(theirs2[k]));
            }));

        let said: number[] = [];
        let pinned: Dictionary[] = [];
        for (const i of order) {
            said = [...said, i];
            pinned = fits(said);
            if (said.length >= 2 && pinned.length === 1) break;
        }
        /* Defensive rather than tested: the loop stops the moment one dictionary
           is left, and a draw that never gets there has named every entity, which
           the next line rejects. Deleting this leaves the suite green. */
        if (pinned.length !== 1) continue;
        if (said.length >= n - 1) continue;      // nearly every entity named is a lookup

        /*
         * The analogy: a composed relation of ours, and one of their entities to
         * carry it from. The entity it lands on must not be one whose
         * correspondence was stated, or the answer is read off the card.
         */
        const stated = new Set(said);
        const from = shuffle([...pairs])[0];
        const target = shuffle([...Array(n).keys()]).find(i => !stated.has(i));
        if (target === undefined) continue;

        const wanted = translate(pinned[0], from.key.split(",").map(Number)).map(sign);
        const landing = [...Array(n).keys()].find(i =>
            i !== target && !stated.has(i)
            && theirCoords[i].every((v, k) => sign(v - theirCoords[target][k]) === wanted[k]));
        if (landing === undefined) continue;

        /* One direction away, so neither candidate is dismissible on sight. */
        const decoy = shuffle([...Array(n).keys()]).find(i => {
            if (i === landing || i === target) return false;
            const d = theirCoords[i].map((v, k) => sign(v - theirCoords[target][k]));
            return d.filter((v, k) => v !== wanted[k]).length === 1;
        });
        if (decoy === undefined) continue;

        const shown = shuffle([
            { word: theirs[landing], right: true },
            { word: theirs[decoy], right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(renderNdPremises(layout), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(theirLines, ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...said.map(i =>
                `${subj(ours[who[i]])} ${own("xa-counterpart")} ${subj(theirs[i])}`),
            `${pairText(from)} ${rel(PAIR_RELATION_WORDS.same)} `
            + `${subj(theirs[target])} ${own("pair-to")} ${hi("?")}`,
        ];
        question.choices = shown.map(c => subj(c.word));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = "Who completes the analogy?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `The second group describes its own arrangement in its own words — `
            + `${vocab.map(v => `<b>${hi(v)}</b>`).join(", ")} — and none of them means `
            + "what it sounds like.",
            "The lines pairing one entity with another say which play the same part in "
            + "both. From those, work out which of their words is which direction, and "
            + "which way round — then carry the last relation across.",
        ];

        question.explanation = [
            `${pairText(from)} is ${renderNdPattern(axes, from.key.split(",").map(Number))}`,
            /*
             * One direction per word, not a whole pattern.
             *
             * Rendering a one-hot vector names every axis, so the dictionary read
             * "quell is east, same latitude, same height" — three clauses where the
             * entry is one, two of them about axes the word has nothing to do with.
             */
            `the pairings fix one reading of their words, and only one: `
            + vocab.map((v, k) => {
                const axis = pinned[0].axis[k];
                const [pos, neg] = axes[axis].scale.direction;
                return `${hi(v)} is ${hi(pinned[0].flip[k] > 0 ? pos : neg, colors[axis])}`;
            }).join(", "),
            `so the relation reads, their way, as the step to ${hi(theirs[landing])} from `
            + `${subj(theirs[target])}`,
            `${subj(theirs[decoy])} is one direction off it`,
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
