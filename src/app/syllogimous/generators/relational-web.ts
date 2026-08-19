/**
 * Relational Web — the marquee feature of the original Phase 2.
 *
 * Two directed graphs, the second a relabelling of the first laid out afresh,
 * and three things worth asking about them:
 *
 *   mapping     which node of the second web is this node of the first?
 *   comparison  are these two the same shape at all?
 *   properties  do they agree on a structural property?
 *
 * What makes it different from everything else here is that nothing is stated
 * in words. Every other mode gives you premises and asks you to compose them;
 * this one gives you a picture and asks you to see structure in it. The reading
 * load is nil and the structural load is everything.
 *
 * ── Validity is not free ──
 *
 * A mapping item has one answer only if the highlighted node is distinguishable
 * from every other node by structure alone. Where the graph has a symmetry that
 * moves it, several nodes of the second web are equally correct and the player
 * is marked wrong for finding one of them. So the orbit is computed and the
 * draw retried — see `orbitOf`. This is the whole reason the mode needs real
 * graph machinery rather than a shuffle.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { shuffle } from "../utils/question.utils";
import { hi, subj } from "../utils/phrasing";
import {
    WEB_PROPERTIES, Web, edgesOf, isomorphic, nearMiss, orbitOf, permuteWeb,
    degreeTwins, randomPermutation, randomWeb, scatterLayout,
} from "../utils/web.utils";
import { GeneratorContext } from "./context";

/** Node names, so an answer can be spoken rather than pointed at. */
const NODE_LABELS = "ABCDEFGHIJKL".split("");

export type WebTrial = "mapping" | "structure" | "comparison" | "properties";

/**
 * Nodes scale with the premise budget, and stop at twelve.
 *
 * Past that the picture is a hairball rather than a structure, and the
 * automorphism search stops being free.
 */
function nodeCount(numOfPremises: number): number {
    return Math.max(4, Math.min(12, numOfPremises + 2));
}

/**
 * Which trial to run.
 *
 * Mapping is the mode's centre and stays the commonest; the other two exist so
 * that "look for the one node with three arrows out" stops being a strategy
 * that survives the whole session.
 */
function pickTrial(structure: boolean): WebTrial {
    const roll = Math.random();
    if (structure) {
        // Structure takes over from mapping as the centre once it is earned:
        // it is the same question asked properly, so running both would mean
        // asking the easier version half the time for no reason.
        return roll < 0.5 ? "structure" : roll < 0.78 ? "comparison" : "properties";
    }
    return roll < 0.5 ? "mapping" : roll < 0.78 ? "comparison" : "properties";
}

export function createRelationalWeb(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createRelationalWeb");

    const type = EnumQuestionType.RelationalWeb;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const n = nodeCount(numOfPremises);
    // Enough arrows to have structure, few enough to see it.
    const density = 0.22 + Math.random() * 0.12;

    for (let attempt = 0; attempt < 240; attempt++) {
        const trial = pickTrial(ctx.hasRung(type, "structure-match"));
        const left = randomWeb(n, density, trial === "properties");
        if (edgesOf(left).length < n) continue;

        const question = new Question(type);
        const built = trial === "mapping" ? buildMapping(ctx, question, left, n)
            : trial === "structure" ? buildStructure(ctx, question, left, n)
            : trial === "comparison" ? buildComparison(question, left, n)
            : buildProperties(question, left, n);
        if (!built) continue;

        return question;
    }

    throw new Error("Cannot generate.");
}

/** Both webs, laid out, ready to draw. */
function attach(question: Question, left: Web, right: Web, highlight?: number) {
    question.webs = [
        /*
         * Drawn independently, and scattered rather than ringed. A ring makes a
         * rotational symmetry visible as a turn of the picture, and two rings
         * invite matching by position — both of which answer the question
         * without looking at the arrows.
         */
        { adj: left.adj, labels: NODE_LABELS.slice(0, left.n), layout: scatterLayout(left.n), highlight },
        { adj: right.adj, labels: NODE_LABELS.slice(0, right.n), layout: scatterLayout(right.n) },
    ];
}

/**
 * Match the structure, not one node of it.
 *
 * `mapping` asks where a single node went and takes the answer from a list.
 * Both halves of that undersell the mode. One node is a lookup — find the
 * degree pair, find the match — where a correspondence has to hold several
 * nodes at once and stay consistent across them. And a list of names turns a
 * question about a picture into a question about a menu: the picture is where
 * the structure is, so the picture is where the answer belongs.
 *
 * So several nodes are marked, in order and by colour, and the answer is given
 * by pointing at their counterparts in the second web. Same palette on both
 * sides, because the colour *is* the correspondence being asserted.
 *
 * Each marked node must be alone in its orbit. An automorphism that moved one
 * would give the item a second answer, and unlike the single-node case a reader
 * cannot tell from the picture which of the two was wanted.
 */
function buildStructure(ctx: GeneratorContext, question: Question, left: Web, n: number): boolean {
    const structural = ctx.hasRung(EnumQuestionType.RelationalWeb, "structural");

    const rigid = shuffle(Array.from({ length: n }, (_, i) => i))
        .filter(node => orbitOf(left, node).length === 1);

    /*
     * Three where the web allows it, two at a minimum. Beyond three the item
     * stops being harder and starts being longer — the fourth node is the same
     * act again, and the picture only has so much room for badges.
     */
    const wanted = Math.min(3, rigid.length);
    if (wanted < 2) return false;

    // Under the structural rung at least one target must have a degree twin,
    // or counting arrows answers the whole thing without seeing the shape.
    const targets = rigid.slice(0, wanted);
    if (structural && !targets.some(v => degreeTwins(left, v).length > 0)) return false;

    const perm = randomPermutation(n);
    const right = permuteWeb(left, perm);
    attach(question, left, right);

    question.webs![0].marks = targets;
    question.webs![1].selectable = true;

    question.answerMode = "map";
    question.mapTargets = targets;
    question.mapAnswer = targets.map(v => perm[v]);
    question.isValid = true;
    question.conclusion = targets
        .map((v, i) => `${i + 1}. ${subj(NODE_LABELS[v])} \u2192 ${subj(NODE_LABELS[perm[v]])}`)
        .join(", ");
    question.choicePrompt =
        `Point out the ${wanted} matching nodes in the second web, in the numbered order.`;
    question.setup = [
        "The second web is the first one relabelled and redrawn. Same arrows, "
        + "different names and positions.",
        "The numbered, coloured nodes on the left are the ones to find. "
        + "Tap their counterparts on the right in the same order.",
    ];
    question.explanation = [
        ...targets.map((v, i) => {
            const out = left.adj[v].filter(Boolean).length;
            const into = left.adj.filter(r => r[v]).length;
            const arrows = (k: number) => `${hi(String(k))} arrow${k === 1 ? "" : "s"}`;
            return `${i + 1}. ${subj(NODE_LABELS[v])} has ${arrows(out)} out and `
                + `${arrows(into)} in, and is the only node of the first web that `
                + `nothing can be swapped with \u2014 so it has exactly one counterpart.`;
        }),
        `Following the arrows from each in turn lands on `
        + targets.map(v => subj(NODE_LABELS[perm[v]])).join(", ") + ".",
        `so the match is ` + targets
            .map(v => `${subj(NODE_LABELS[v])} \u2192 ${subj(NODE_LABELS[perm[v]])}`)
            .join(", "),
    ];
    return true;
}

/**
 * "Which node over there is this node over here?"
 *
 * Two conditions, and the item is thrown away if either fails. The node must be
 * alone in its orbit, or the question has several right answers. And under the
 * structural difficulty it must have a refinement twin, or counting arrows
 * answers it without looking at the shape.
 */
function buildMapping(ctx: GeneratorContext, question: Question, left: Web, n: number): boolean {
    const structural = ctx.hasRung(EnumQuestionType.RelationalWeb, "structural");

    const candidates = shuffle(Array.from({ length: n }, (_, i) => i));
    const v = candidates.find(node => {
        if (orbitOf(left, node).length !== 1) return false;
        return structural ? degreeTwins(left, node).length > 0 : true;
    });
    if (v === undefined) return false;

    const perm = randomPermutation(n);
    const right = permuteWeb(left, perm);
    attach(question, left, right, v);

    /*
     * Answered on the picture, not from a list of names.
     *
     * A menu of labels turns a question about a structure into a question about
     * a menu: the reader finds the answer in the drawing and then hunts for its
     * name underneath. The drawing is where the structure is, so the drawing is
     * where the answer belongs — and this way the mode has one way of
     * answering, with `structure-match` simply asking for more nodes.
     */
    question.webs![0].marks = [v];
    question.webs![1].selectable = true;

    question.answerMode = "map";
    question.mapTargets = [v];
    question.mapAnswer = [perm[v]];
    question.isValid = true;
    question.conclusion = `${subj(NODE_LABELS[v])} \u2192 ${subj(NODE_LABELS[perm[v]])}`;
    question.choicePrompt = `Point out the node of the second web that is ${NODE_LABELS[v]}.`;
    question.setup = [
        "The second web is the first one relabelled and redrawn. Same arrows, "
        + "different names, different positions.",
        "The coloured node on the left is the one to find. Tap its counterpart "
        + "on the right.",
    ];
    question.explanation = [
        `${subj(NODE_LABELS[v])} has ${hi(String(left.adj[v].filter(Boolean).length))} arrows out `
        + `and ${hi(String(left.adj.filter(r => r[v]).length))} in.`,
        structural
            ? "Another node has the same counts, so the arrows alone do not settle it — "
              + "the answer is the one whose neighbours match as well."
            : "Only one node of the second web has that pattern.",
        `so it is ${subj(NODE_LABELS[perm[v]])}.`,
    ];
    return true;
}

/** "Same shape or not?" — with a false case that survives counting. */
function buildComparison(question: Question, left: Web, n: number): boolean {
    const same = Math.random() < 0.5;
    const right = same
        ? permuteWeb(left, randomPermutation(n))
        : nearMiss(permuteWeb(left, randomPermutation(n)));
    if (!right) return false;

    attach(question, left, right);
    question.answerMode = "boolean";
    question.isValid = same;
    question.conclusion = "these two webs are the same shape, relabelled";
    question.setup = [
        "Same shape means every node can be paired up so the arrows match.",
    ];
    question.explanation = same
        ? ["Every node pairs up with one whose arrows match.",
           "so they are the same web, drawn differently."]
        : ["Every node has the same count of arrows in and out as before — that much was kept.",
           "But no pairing makes all the arrows line up.",
           "so they are different shapes."];
    return true;
}

/** "Do both webs agree about this property?" */
function buildProperties(question: Question, left: Web, n: number): boolean {
    const property = WEB_PROPERTIES[Math.floor(Math.random() * WEB_PROPERTIES.length)];

    /*
     * The second web is independent here, not a relabelling: the question is
     * whether the two agree, and a relabelling always agrees, which would make
     * every item true.
     */
    const right = randomWeb(n, 0.22 + Math.random() * 0.16, true);
    if (edgesOf(right).length < n) return false;

    const l = property.holds(left);
    const r = property.holds(right);

    attach(question, left, right);
    question.answerMode = "boolean";
    // The stated rule: true when both satisfy it or both violate it.
    question.isValid = l === r;
    question.conclusion = `both webs agree about <b>${property.name}</b>`;
    question.setup = [
        `<b>${property.name}</b>: ${property.gloss}.`,
        "They agree when both have it, or neither does.",
    ];
    question.explanation = [
        `The first web ${l ? "has" : "does not have"} it.`,
        `The second ${r ? "has" : "does not have"} it.`,
        `so they ${l === r ? "agree" : "disagree"}.`,
    ];
    return true;
}

/** Whether two webs are the same shape — exported for the tests. */
export const websMatch = isomorphic;
