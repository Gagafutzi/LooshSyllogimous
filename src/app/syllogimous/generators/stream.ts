/**
 * Continuous stream — premises arrive one at a time and old ones expire.
 *
 * Every other mode hands over a **bounded, complete** set: read all the
 * premises, then integrate. Nothing in the app asks you to *maintain and
 * discard*. A stream does — the live relations are the last few, older ones
 * have gone, and a conclusion can arrive at any checkpoint. That is the
 * updating demand, and it is the one thing the app has never had.
 *
 * **Three properties make it that rather than a long item with interruptions.**
 *
 * *The window is self-sufficient, and the card promises it.* Every conclusion
 * follows from the last `window` relations and never reaches past them. Without
 * that promise a reader rationally hoards everything, and hoarding turns this
 * back into a capacity task on a long list — which is what the app already has.
 *
 * *Only the new premises are shown at each checkpoint.* The retained ones are
 * gone from the screen, so they have to be in your head. Re-displaying the whole
 * window would remove the entire demand while looking identical.
 *
 * *A conclusion spans the window rather than restating one premise of it.* Its
 * two objects sit at opposite ends of the live relations, so answering composes
 * every one of them. A conclusion answerable from a single remembered premise
 * would make this a recall task with relational decoration, and `window` would
 * be measuring span.
 *
 * Difficulty is meant to come from *recurrence* rather than from a bigger
 * window: an object that comes back later carrying a different relation puts the
 * stale binding in direct competition with the live one. Raising the window
 * measures how much you can hold; bringing objects back measures whether you can
 * let go.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { EnumQuestionType } from "../constants/question.constants";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, rel, subj, dimClass, dimSlot } from "../utils/phrasing";
import { LinearScale, LINEAR_SCALES } from "../utils/linear.utils";
import { axesForDimensions } from "../utils/ndspace.utils";

/** The modes a stream can be built from, and the axes each one runs on. */
export const STREAM_SCALES: Partial<Record<EnumQuestionType, () => LinearScale[]>> = {
    [EnumQuestionType.ComparisonNumerical]: () => [LINEAR_SCALES["quantity"]],
    [EnumQuestionType.ComparisonChronological]: () => [LINEAR_SCALES["temporal"]],
    [EnumQuestionType.LinearVertical]: () => [LINEAR_SCALES["vertical"]],
    [EnumQuestionType.LinearHorizontal]: () => [LINEAR_SCALES["horizontal"]],
    [EnumQuestionType.LinearContains]: () => [LINEAR_SCALES["contains"]],
    [EnumQuestionType.Direction]: () => axesForDimensions(2).slice(0, 2),
    [EnumQuestionType.Direction3DSpatial]: () => axesForDimensions(3).slice(0, 3),
    [EnumQuestionType.Space3D]: () => axesForDimensions(3).slice(0, 3),
    [EnumQuestionType.Space4D]: () => axesForDimensions(4).slice(0, 4),
};

export const STREAM_TYPES = Object.keys(STREAM_SCALES) as EnumQuestionType[];

/** Default live window, in relations. */
export const DEFAULT_WINDOW = 3;

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** One axis's clause for a step of `delta`. */
function clause(axis: LinearScale, delta: number, slot: number): string {
    if (!delta) return rel(axis.tie, dimClass(dimSlot(slot)));
    const word = delta > 0 ? axis.direction[0] : axis.direction[1];
    return rel(`${Math.abs(delta)} ${word}`, dimClass(dimSlot(slot)));
}

const line = (from: string, to: string, deltas: number[], axes: LinearScale[]) =>
    `${subj(to)} is ${deltas.map((d, i) => clause(axes[i], d, i)).join(", ")}`
    + ` ${rel("from")} ${subj(from)}`;

/**
 * A stream item, as a series of checkpoints over one running chain.
 *
 * Built on the series machinery rather than beside it: a claim may replace the
 * premises shown, which is exactly "here are the new ones, the old ones are
 * gone". Nothing in the carousel or the answering flow needs to know this mode
 * exists.
 */
export function createStream(
    ctx: GeneratorContext,
    type: EnumQuestionType,
    window = DEFAULT_WINDOW,
    checkpoints = 4,
): Question {
    const axes = (STREAM_SCALES[type] ?? STREAM_SCALES[EnumQuestionType.ComparisonNumerical])!();
    const n = Math.max(2, Math.min(6, window));
    const step = Math.max(1, Math.floor(n / 2));

    // One object per relation, plus the one the chain starts on.
    const links = n + step * (checkpoints - 1);
    const names = getRandomSymbols(ctx.settings, links + 1);
    if (names.length < links + 1) throw new Error("Cannot generate.");

    /* The chain, as coordinates: every object's position on every axis. */
    const at: number[][] = [axes.map(() => 0)];
    const deltas: number[][] = [];
    for (let i = 0; i < links; i++) {
        const d = axes.map(() => pick([-3, -2, -1, 1, 2, 3]));
        deltas.push(d);
        at.push(at[i].map((v, k) => v + d[k]));
    }

    const question = new Question(type);
    question.bucket = names;
    question.setup = [
        `Premises arrive one at a time and <b>do not come back</b>.`,
        `Every question follows from the <b>last ${n}</b> of them — nothing`
        + ` before that is ever needed, so there is nothing to keep.`,
    ];

    /*
     * A conclusion across the whole live window.
     *
     * From the object the window opens on to the one it ends on, so every live
     * relation is composed to answer. Half of them are made false by moving one
     * axis, which is the same near-miss rule the composed spaces use — a wrong
     * answer that differs everywhere is dismissed without reading.
     */
    const claimAt = (endLink: number) => {
        const from = endLink - n;
        const truth = at[endLink].map((v, k) => v - at[from][k]);
        const wantValid = Math.random() < 0.5;

        const shown = [...truth];
        if (!wantValid) {
            const axis = Math.floor(Math.random() * axes.length);
            shown[axis] = -shown[axis] || 1;
        }
        return {
            text: line(names[from], names[endLink], shown, axes),
            isValid: wantValid,
        };
    };

    const first = claimAt(n);
    question.premises = deltas.slice(0, n)
        .map((d, i) => line(names[i], names[i + 1], d, axes));
    question.conclusion = first.text;
    question.isValid = first.isValid;

    /*
     * Each later checkpoint shows only what has arrived since the last one. The
     * rest of the window is not on the card, which is the whole mode.
     */
    const rest = [];
    for (let c = 1; c < checkpoints; c++) {
        const endLink = n + step * c;
        const claim = claimAt(endLink);
        rest.push({
            text: claim.text,
            isValid: claim.isValid,
            premises: deltas.slice(endLink - step, endLink)
                .map((d, i) => line(names[endLink - step + i], names[endLink - step + i + 1], d, axes)),
        });
    }

    question.series = [
        { text: first.text, isValid: first.isValid, premises: [...question.premises] },
        ...rest,
    ];
    question.seriesAnswers = [];
    question.seriesAt = 0;

    /*
     * Not scored against the mode it borrows.
     *
     * A stream item is a different task from the mode whose relations it uses —
     * far harder at the same premise count — so feeding it to that mode's
     * ability estimate would teach the model that four-premise comparisons are
     * beyond you and shorten every ordinary item you are served afterwards.
     * Until there is a price for it, it teaches nothing.
     */
    question.playgroundMode = true;

    return question;
}
