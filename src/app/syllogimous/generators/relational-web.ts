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
import { canGenerateQuestion } from "../models/settings.models";
import { shuffle } from "../utils/question.utils";
import { hi, subj } from "../utils/phrasing";
import {
    WEB_PROPERTIES, Web, edgesOf, isomorphic, nearMiss, orbitOf, permuteWeb,
    degreeTwins, randomPermutation, randomWeb, ringLayout,
} from "../utils/web.utils";
import { GeneratorContext } from "./context";

/** Node names, so an answer can be spoken rather than pointed at. */
const NODE_LABELS = "ABCDEFGHIJKL".split("");

export type WebTrial = "mapping" | "comparison" | "properties";

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
function pickTrial(): WebTrial {
    const roll = Math.random();
    return roll < 0.5 ? "mapping" : roll < 0.78 ? "comparison" : "properties";
}

export function createRelationalWeb(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createRelationalWeb");

    const type = EnumQuestionType.RelationalWeb;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) {
        throw new Error("Cannot generate.");
    }

    const n = nodeCount(numOfPremises);
    // Enough arrows to have structure, few enough to see it.
    const density = 0.22 + Math.random() * 0.12;

    for (let attempt = 0; attempt < 240; attempt++) {
        const trial = pickTrial();
        const left = randomWeb(n, density, trial === "properties");
        if (edgesOf(left).length < n) continue;

        const question = new Question(type);
        const built = trial === "mapping" ? buildMapping(ctx, question, left, n)
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
        { adj: left.adj, labels: NODE_LABELS.slice(0, left.n), layout: ringLayout(left.n), highlight },
        { adj: right.adj, labels: NODE_LABELS.slice(0, right.n), layout: ringLayout(right.n) },
    ];
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
    const structural = ctx.progressionService.hasRung(EnumQuestionType.RelationalWeb, "structural");

    const candidates = shuffle(Array.from({ length: n }, (_, i) => i));
    const v = candidates.find(node => {
        if (orbitOf(left, node).length !== 1) return false;
        return structural ? degreeTwins(left, node).length > 0 : true;
    });
    if (v === undefined) return false;

    const perm = randomPermutation(n);
    const right = permuteWeb(left, perm);
    attach(question, left, right, v);

    const order = shuffle(Array.from({ length: n }, (_, i) => i));
    question.choices = order.map(i => subj(NODE_LABELS[i]));
    question.correctChoice = order.indexOf(perm[v]);
    question.answerMode = "choice";
    question.isValid = true;
    question.conclusion = "";
    question.choicePrompt = `Which node of the second web is ${NODE_LABELS[v]}?`;
    question.setup = [
        "The second web is the first one relabelled and redrawn. Same arrows, "
        + "different names and positions.",
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
