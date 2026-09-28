/**
 * Cyclic Dominance — a result that orders nothing.
 *
 * The first of the modes brought over from Isomorph, and chosen first because
 * of what the rest of this app is made of. Every relation here is an ordering:
 * north of, bigger than, before, contains, above. They differ in vocabulary and
 * in how many of them you carry at once, and in one respect they are all the
 * same — from "A is above B" and "B is above C" it follows that A is above C,
 * and every item in every one of those modes is solved by leaning on that.
 *
 * A dominance cycle is the relation that withholds it. Objects sit on a ring;
 * each beats the few that follow it and loses to the few before it, so A beats
 * B, B beats C, and far enough round, C beats A. Nothing about the premises
 * announces this — they read exactly like the orderings elsewhere — which is
 * the point. The habit the rest of the app builds is the thing this mode is
 * built to catch, and a reader who chains is not slightly wrong but wrong in
 * the one direction the mode is about.
 *
 * ── What makes an item well-formed ──
 *
 * The ring is odd, so no pair is ever tied: with `n` objects each beats the
 * `d = (n-1)/2` that follow it and loses to the `d` before it, and every
 * ordered pair falls on exactly one side of that. An even ring has a pair at
 * exactly half the loop with no answer, which is a question the premises do
 * not settle rather than a hard one.
 *
 * The premises are the `n` adjacent results and nothing else, which determine
 * the ring exactly — each object wins once and loses once, so the cycle is
 * forced — and the pair asked about is never one of them. So the answer is
 * derived rather than read, and deriving it means assembling the ring and
 * counting round it.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, own, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import { GeneratorContext, buildSeries, extendWithSeries, seriesWanted } from "./context";

/**
 * How many objects the ring holds, always odd.
 *
 * One premise per adjacent pair, so the premise count *is* the ring size. An
 * even count is rounded down rather than up: the setting is a ceiling on how
 * much is on the card, and rounding up would print more premises than the
 * player asked to be shown.
 */
function ringSize(numOfPremises: number): number {
    const n = numOfPremises % 2 === 0 ? numOfPremises - 1 : numOfPremises;
    return Math.max(5, n);
}

/** "X beats Y", the only thing this mode ever states. */
const beats = (winner: string, loser: string) =>
    `${subj(winner)} ${own("cyc-beats")} ${subj(loser)}`;

export function createCyclicDominance(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createCyclicDominance");

    const type = EnumQuestionType.CyclicDominance;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    numOfPremises = clampPremises(type, numOfPremises);

    const n = ringSize(numOfPremises);
    const reach = (n - 1) / 2;

    for (let attempt = 0; attempt < 200; attempt++) {
        /* The ring is the draw order: which object follows which is the whole
           arrangement, and a shuffle of the names is a different ring. */
        const ring = getRandomSymbols(settings, n);
        if (new Set(ring).size !== n) continue;

        const at: Record<string, number> = {};
        ring.forEach((w, i) => { at[w] = i; });

        /** Steps from one to the other, going the way the ring runs. */
        const steps = (from: string, to: string) => (at[to] - at[from] + n) % n;
        /** Who wins, by the rule the setup states. */
        const winnerOf = (a: string, b: string) => steps(a, b) <= reach ? a : b;

        const question = new Question(type);
        question.bucket = [...ring];
        question.premises = orderPremises(
            ring.map((w, i) => beats(w, ring[(i + 1) % n])),
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        const asked = drawPair(ring, steps, reach);
        if (!asked) continue;

        fillClaim(question, asked, winnerOf, steps, reach);

        question.setup = [
            `Each of these <b>${own("cyc-beats")}</b> the <b>${reach}</b> that follow it `
            + `round a ring of <b>${n}</b>, and loses to the <b>${reach}</b> before it. `
            + `The ring is what the premises are for — they do not say where it starts.`,
        ];

        /*
         * Further claims about the same ring, which is the cheap half.
         *
         * Assembling the ring out of the premises is the whole cost of the item
         * and it is paid once; another pair re-uses all of it. Drawn from pairs
         * this item has not asked about, so a second claim is a second question
         * rather than the first one again.
         */
        if (seriesWanted(ctx)) {
            const spent = new Set([asked.join(" ")]);
            extendWithSeries(question, buildSeries(() => {
                const next = drawPair(ring, steps, reach, spent);
                if (!next) return null;
                spent.add(next.join(" "));

                const claim = new Question(type);
                fillClaim(claim, next, winnerOf, steps, reach);
                return {
                    text: String(claim.conclusion),
                    isValid: claim.isValid,
                    choices: [...claim.choices],
                    correctChoice: claim.correctChoice,
                    prompt: claim.choicePrompt,
                    explanation: claim.explanation,
                    key: next.join(" "),
                };
            }));
        }

        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * A pair whose result has to be counted for rather than read.
 *
 * Never adjacent, because an adjacent pair is a premise said back. Drawn from
 * the boundary — exactly at the edge of the reach, or exactly past it — half
 * the time, because that is where chaining and counting disagree and the rest
 * of the ring is where they happen to coincide.
 */
function drawPair(
    ring: string[],
    steps: (a: string, b: string) => number,
    reach: number,
    spent = new Set<string>(),
): [string, string] | null {
    const n = ring.length;
    const all: Array<[string, string]> = [];
    const edge: Array<[string, string]> = [];

    for (const a of ring) {
        for (const b of ring) {
            if (a === b) continue;
            const k = steps(a, b);
            if (k < 2 || k > n - 2) continue;      // adjacent either way round
            if (spent.has(`${a} ${b}`) || spent.has(`${b} ${a}`)) continue;
            all.push([a, b]);
            if (k === reach || k === reach + 1) edge.push([a, b]);
        }
    }

    const pool = (edge.length && Math.random() < 0.5) ? edge : all;
    if (!pool.length) return null;
    return pickUniqueItems(pool, 1).picked[0];
}

/** The question this pair asks, and how it is answered. */
function fillClaim(
    question: Question,
    [a, b]: [string, string],
    winnerOf: (a: string, b: string) => string,
    steps: (a: string, b: string) => number,
    reach: number,
) {
    const winner = winnerOf(a, b);
    const loser = winner === a ? b : a;

    /*
     * Both directions offered, rather than one claim to judge.
     *
     * The guess floor is the same either way, and the question is not. "Does A
     * beat B" invites the chain that produced it — the reader looks for a route
     * from A to B and finds one, because on a ring there is always one. Put as
     * a choice, the question is which way round it comes out, which is the
     * thing the ring decides and the chain does not.
     */
    const shown = shuffle([[a, b], [b, a]] as Array<[string, string]>);
    question.choices = shown.map(([x, y]) => beats(x, y));
    question.correctChoice = shown.findIndex(([x]) => x === winner);
    question.answerMode = "choice";
    question.choicePrompt = "Which way round does this one go?";
    question.isValid = true;
    question.conclusion = "";

    /*
     * Both directions, because one of them is the whole lesson.
     *
     * The winning direction is always within the reach — the ring is odd, so
     * whichever way is short is the way that wins — and a derivation that says
     * only that explains an answer nobody got wrong for an interesting reason.
     * What a reader who chained needs to see is the other count: the route they
     * followed exists, it is simply the long way round, and going the long way
     * is what losing *is* here.
     */
    const k = steps(winner, loser);
    const back = steps(loser, winner);
    const plural = (n: number) => `${hi(String(n))} step${n === 1 ? "" : "s"}`;
    question.explanation = [
        `${subj(winner)} to ${subj(loser)} is ${plural(k)} round the ring, `
        + `within the ${hi(String(reach))} each one beats`,
        `${subj(loser)} to ${subj(winner)} is ${plural(back)}, which is past it — `
        + `that is the way a chain of premises leads, and it is the losing way`,
        `so ${beats(winner, loser)}`,
    ];
}
