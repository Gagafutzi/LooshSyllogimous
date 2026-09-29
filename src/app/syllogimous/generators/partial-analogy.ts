/**
 * Partial Analogy — the correspondence that keeps the most relations.
 *
 * Isomorph's guide: *"The two systems agree in most of their relations, not all,
 * and every entity has a colour. Under the correspondence that keeps the most
 * relations, what does the named entity correspond to? Colour is not a relation:
 * the entity that shares its colour is a lure."*
 *
 * Structure Match asks whether two systems are the same, which has a yes or a no.
 * This asks what to do when they are *nearly* the same, which has no yes — the
 * systems disagree somewhere and the answer is the lining-up that survives the
 * most of them. That is a different skill and the more useful one: two things
 * worth comparing are rarely isomorphic, and the question is almost always which
 * correspondence to prefer rather than whether one exists.
 *
 * ── Kind, where Isomorph says colour ──
 *
 * The lure is an attribute the entities carry that plays no part in the
 * structure. This app already has one — "is the same kind as", the Distinction
 * scale's own relation — so that is what it uses, rather than introducing a
 * second vocabulary for the same idea. It converts under the symbol switch and
 * renames with the fresh-labels feature like every other relation here, which a
 * colour written into this file would not.
 *
 * Kind is stated as a *complete* pairing across the two systems, not as one hint.
 * A single kind premise would be visibly the trap; a pairing that covers
 * everybody is a second, plausible, wrong answer to the whole question — which is
 * what a lure is supposed to be. The reader has two bijections in front of them
 * and has to know which one the question is about.
 *
 * ── What makes an item well-formed ──
 *
 * The best correspondence is found by trying every one, and the item is kept only
 * if exactly one achieves the maximum — otherwise "the correspondence that keeps
 * the most" names several and the card marks one of them. The systems must
 * disagree somewhere, or the analogy is total and this is Structure Match. And the
 * kind pairing must disagree with the best correspondence *at the entity asked
 * about*, or the lure is the answer.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { EDGE_WORDS, hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import { permutations } from "../utils/relation-systems.utils";
import {
    Web, cloneWeb, edgesOf, permuteWeb, randomPermutation, randomWeb,
} from "../utils/web.utils";
import { GeneratorContext } from "./context";

/** The relation the Distinction scale uses for an attribute with no order. */
const SAME_KIND = "is the same kind as";

const arrow = (a: string, b: string) => `${subj(a)} ${rel(EDGE_WORDS["→"])} ${subj(b)}`;
const kindLine = (a: string, b: string) => `${subj(a)} ${rel(SAME_KIND)} ${subj(b)}`;

const systemLines = (w: Web, names: string[]) =>
    edgesOf(w).map(([i, j]) => arrow(names[i], names[j]));

/**
 * How many of `a`'s arrows survive being read through `perm` into `b`.
 *
 * Counted over every ordered pair rather than over the arrows, so an arrow `b`
 * has where `a` has none counts against the correspondence too. Counting only
 * `a`'s arrows would let a correspondence that mapped everything into a densely
 * connected corner of `b` score perfectly.
 */
function agreement(a: Web, b: Web, perm: number[]): number {
    let kept = 0;
    for (let i = 0; i < a.n; i++) {
        for (let j = 0; j < a.n; j++) {
            if (i === j) continue;
            if (a.adj[i][j] === b.adj[perm[i]][perm[j]]) kept++;
        }
    }
    return kept;
}

/** The correspondences that keep the most, and how much that is. */
function bestCorrespondences(a: Web, b: Web): { best: number; perms: number[][] } {
    let best = -1;
    let perms: number[][] = [];
    for (const perm of permutations(a.n)) {
        const kept = agreement(a, b, perm);
        if (kept > best) { best = kept; perms = [perm]; } else if (kept === best) perms.push(perm);
    }
    return { best, perms };
}

export function createPartialAnalogy(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createPartialAnalogy");

    const type = EnumQuestionType.PartialAnalogy;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    /* Five a side. Four leaves too few correspondences for exactly one to be
       best; six is 720 to try per attempt, and the card is already two systems
       plus a pairing. */
    const n = 5;
    const wanted = Math.max(4, Math.min(n * (n - 1) - 2, numOfPremises - 2));

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, 2 * n);
        if (new Set(words).size !== 2 * n) continue;
        const left = words.slice(0, n);
        const right = words.slice(n);

        const a = randomWeb(n, 0.3);
        if (edgesOf(a).length < wanted || edgesOf(a).length > wanted + 2) continue;
        /* Nobody unconnected: an entity with no arrow appears in no arrow premise
           and its correspondence is decided by nothing. */
        const touched = (w: Web, v: number) => w.adj[v].some(Boolean) || w.adj.some(r => r[v]);
        if (![...Array(n).keys()].every(v => touched(a, v))) continue;

        /*
         * The second system is the first re-labelled and then disagreed with.
         *
         * One or two arrows changed, which is what "agree in most of their
         * relations, not all" means. Nought would make the analogy total; more
         * than two and the best correspondence stops being better than its
         * rivals by enough to be the only one.
         */
        const truth = randomPermutation(n);
        const b = permuteWeb(a, truth);
        const flips = 1 + Math.floor(Math.random() * 2);
        for (let k = 0; k < flips; k++) {
            const i = Math.floor(Math.random() * n);
            let j = Math.floor(Math.random() * n);
            if (i === j) j = (j + 1) % n;
            b.adj[i][j] = !b.adj[i][j];
        }
        if (![...Array(n).keys()].every(v => touched(b, v))) continue;

        const { best, perms } = bestCorrespondences(a, b);
        if (perms.length !== 1) continue;            // "the correspondence that keeps the most"
        if (best === n * (n - 1)) continue;           // then they agree on everything
        const correspondence = perms[0];

        /*
         * The kind pairing: a bijection of its own, disagreeing with the
         * structural one somewhere. Drawn rather than derived, and then the
         * asked entity is chosen from where the two differ — so the lure is a
         * real alternative answer rather than a marked one.
         */
        const kinds = randomPermutation(n);
        const differ = [...Array(n).keys()].filter(i => kinds[i] !== correspondence[i]);
        if (!differ.length) continue;
        const asked = differ[Math.floor(Math.random() * differ.length)];

        const shown = shuffle([
            { word: right[correspondence[asked]], right: true },
            { word: right[kinds[asked]], right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(a, left), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(systemLines(b, right), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(
                left.map((w, i) => kindLine(w, right[kinds[i]])),
                ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
        ];
        question.choices = shown.map(c => subj(c.word));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = `Which one does ${left[asked]} correspond to?`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "Two systems that agree in <b>most</b> of their arrows and not all, so no "
            + "lining-up of the names keeps every one.",
            /*
             * The kind relation is named through `rel`, not spelled out in prose.
             *
             * "Same kind" is a relation word in this app's own tables, so written
             * as plain text the line named a relation the card had already
             * converted to a symbol or renamed — the setup would tell the reader
             * to ignore something by a name that appears nowhere on the card.
             * Through `rel` it is written in whatever the relation is called here,
             * which is the same reason the ring note names its axis that way.
             */
            `Under the correspondence that keeps the ${hi("most")} of them, which entity `
            + `does ${subj(left[asked])} correspond to? A premise saying one thing `
            + `${rel(SAME_KIND)} another is not an arrow, and counts for nothing here.`,
        ];

        const total = n * (n - 1);
        question.explanation = [
            `one lining-up of the names keeps ${hi(String(best))} of the ${total} possible `
            + "arrows and disagreements, and no other keeps as many",
            `under it, ${subj(left[asked])} goes to `
            + `${hi(right[correspondence[asked]])}`,
            `${subj(right[kinds[asked]])} is the one that ${rel(SAME_KIND)} it, which is `
            + "why it is offered — that pairs every entity off and has nothing to do with "
            + "the arrows",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
