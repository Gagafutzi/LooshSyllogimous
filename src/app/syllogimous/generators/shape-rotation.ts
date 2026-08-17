/**
 * Shape and rotation — P6.
 *
 * A regular polygon carries objects on its corners. Some corners are named
 * outright, the rest are fixed by relation to those; then the shape is turned,
 * and the question is asked about where things ended up.
 *
 * ── It is already a circular axis ──
 *
 * An *n*-gon's rotations form a cyclic group of order *n*: positions are
 * integers mod *n*, a turn is addition mod *n*, and every claim is decided by
 * comparing two integers. That is `AxisSpec` with `modulus: n` — the same
 * arithmetic the circular-axis rung already runs, with the polygon's symmetry
 * order supplying the modulus instead of an arbitrary 4 or 5.
 *
 * ── The premise that makes it worth building ──
 *
 * Not every object's corner is stated. The rest are given by relation to one
 * that is, so the starting arrangement has to be *derived* before anything is
 * turned. Placement-by-constraint followed by transformation is a different
 * task from either half alone; without it the item is "you are told a position,
 * told an offset, add them", which is arithmetic with extra words. How many
 * corners are named outright falls as difficulty rises.
 *
 * ── Corners only, and only compass-nameable polygons ──
 *
 * Naming both corners and edges leaks the answer: a symmetry rotation maps a
 * corner to a corner and an edge to an edge, so an item that puts something on
 * a corner and asks about an edge is false without doing any work — the *type*
 * settles it. Corners only closes that.
 *
 * The square and the octagon are the polygons whose corners land on compass
 * points, so every position has an unambiguous name and every turn is a whole
 * number of them. A pentagon would need corners named "the one at 72°", which
 * is a coordinate wearing a hat.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { GeneratorContext } from "./context";

/** Positive remainder — JavaScript's % keeps the sign of the dividend. */
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The two polygons whose corners are compass points.
 *
 * Clockwise from north, so index arithmetic and the named direction agree:
 * turning clockwise adds.
 */
const SHAPES: Record<number, { name: string; corners: string[] }> = {
    4: { name: "square", corners: ["north", "east", "south", "west"] },
    8: {
        name: "octagon",
        corners: ["north", "north-east", "east", "south-east",
                  "south", "south-west", "west", "north-west"],
    },
};

/** Bigger shapes have more corners to keep straight, so they come later. */
function orderFor(numOfPremises: number): number {
    return numOfPremises >= 5 ? 8 : 4;
}

/** How many turns the shape takes. Each one is a fresh addition to carry. */
function turnCount(numOfPremises: number): number {
    return Math.max(1, Math.min(3, numOfPremises - 3));
}

interface Turn {
    /** Corners moved, always positive; direction is carried separately. */
    steps: number;
    clockwise: boolean;
}

const degrees = (steps: number, order: number) => (steps * 360) / order;

export function createShapeRotation(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createShapeRotation");

    const type = EnumQuestionType.ShapeRotation;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const order = orderFor(numOfPremises);
    const shape = SHAPES[order];

    // Objects sit on distinct corners, so the polygon caps how many there are.
    const objectCount = Math.max(2, Math.min(order - 1, numOfPremises - 1));

    for (let attempt = 0; attempt < 200; attempt++) {
        const words = getRandomSymbols(settings, objectCount);
        const corners = shuffle([...Array(order).keys()]).slice(0, objectCount);
        const start: Record<string, number> = {};
        words.forEach((w, i) => { start[w] = corners[i]; });

        /*
         * At least one corner has to be named outright or nothing is anchored
         * and the arrangement floats: every relative placement would be
         * satisfiable at any rotation, which is exactly the invariance this
         * mode teaches, and useless as a starting point.
         */
        const anchors = Math.max(1, objectCount - Math.min(objectCount - 1, turnCount(numOfPremises)));
        const named = words.slice(0, anchors);
        const derived = words.slice(anchors);

        const premises: string[] = [
            ...named.map(w => `${subj(w)} is on the ${hi(shape.corners[start[w]])} corner`),
            ...derived.map(w => {
                // Stated against an already-placed object, so the chain always
                // resolves; the reader may have to walk several links to get
                // there, which is the derivation being asked for.
                const anchor = words[Math.floor(Math.random() * words.indexOf(w))];
                const steps = mod(start[w] - start[anchor], order);
                const cw = steps <= order / 2;
                const n = cw ? steps : order - steps;
                return `${subj(w)} is ${hi(`${n} corner${n === 1 ? "" : "s"} `
                    + (cw ? "clockwise" : "anticlockwise"))} from ${subj(anchor)}`;
            }),
        ];

        const turns: Turn[] = [];
        for (let i = 0; i < turnCount(numOfPremises); i++) {
            turns.push({
                steps: 1 + Math.floor(Math.random() * (order - 1)),
                clockwise: Math.random() < 0.5,
            });
        }

        const total = turns.reduce((a, t) => a + (t.clockwise ? t.steps : -t.steps), 0);
        // A turn list that lands back where it started makes the turns
        // decorative: the answer would be readable off the opening premises.
        if (mod(total, order) === 0) continue;

        const final: Record<string, number> = {};
        for (const w of words) final[w] = mod(start[w] + total, order);

        for (const t of turns) {
            premises.push(
                `the ${shape.name} is turned ${hi(`${degrees(t.steps, order)}° `
                    + (t.clockwise ? "clockwise" : "anticlockwise"))}`);
        }

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = premises;
        question.setup = [
            `The ${shape.name}'s corners are `
            + shape.corners.map(c => hi(c)).join(", ")
            + ". Objects are carried round with it.",
        ];

        // Asking where something ended up, or what a turn left alone.
        if (words.length >= 2 && Math.random() < 0.4) {
            fillInvarianceQuestion(question, words, start, final, order, shape);
        } else {
            fillPositionQuestion(question, words, final, shape);
        }

        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * The prompt names the object, so it cannot carry markup: it is interpolated as
 * text rather than bound as HTML, and a stimulus may itself be a fragment.
 */
const plainName = (s: string) => s.replace(/<[^>]+>/g, "");

/** "Which corner is X on now?" — a choice among the corner names. */
function fillPositionQuestion(
    question: Question,
    words: string[],
    final: Record<string, number>,
    shape: { name: string; corners: string[] },
) {
    const asked = words[Math.floor(Math.random() * words.length)];
    const order = shuffle([...Array(shape.corners.length).keys()]);

    question.choices = order.map(i => rel(shape.corners[i]));
    question.correctChoice = order.indexOf(final[asked]);
    question.answerMode = "choice";
    question.isValid = true;
    question.conclusion = "";
    question.choicePrompt = `Which corner is ${plainName(asked)} on after the turns?`;

    question.explanation = [
        `${subj(asked)} ends on the ${hi(shape.corners[final[asked]])} corner.`,
    ];
}

/**
 * "Is X still north-east of Y?" — the best item in the family.
 *
 * A rotation moves every object by the same amount, so it cannot change how any
 * two of them sit *relative* to each other. Anyone who has understood that
 * answers without computing anything; anyone who has not recomputes both final
 * positions and gets there the long way, or gets lost. So the claim is stated
 * as a separation in corners, and it is true exactly when it was true before —
 * which makes a false one a genuine trap rather than a trick.
 */
function fillInvarianceQuestion(
    question: Question,
    words: string[],
    start: Record<string, number>,
    final: Record<string, number>,
    order: number,
    shape: { name: string; corners: string[] },
) {
    const [a, b] = shuffle([...words]).slice(0, 2);
    const truth = mod(final[a] - final[b], order);
    const claim = Math.random() < 0.5 ? truth : mod(truth + 1 + Math.floor(Math.random() * (order - 1)), order);

    const cw = claim <= order / 2;
    const n = cw ? claim : order - claim;
    const phrase = claim === 0
        ? "on the same corner as"
        : `${n} corner${n === 1 ? "" : "s"} ${cw ? "clockwise" : "anticlockwise"} from`;

    question.conclusion = `after the turns, ${subj(a)} is ${rel(phrase)} ${subj(b)}`;
    question.isValid = claim === truth;
    question.answerMode = "boolean";

    question.explanation = [
        `A turn moves every object by the same amount, so it cannot change how `
        + `two of them sit relative to each other.`,
        `${subj(a)} started ${hi(String(mod(start[a] - start[b], order)))} corner(s) `
        + `clockwise of ${subj(b)}, and still is — the turns did not need computing.`,
    ];
}
