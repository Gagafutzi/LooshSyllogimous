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

/** Questions per run, by default. The setting has no small ceiling. */
export const DEFAULT_CHECKPOINTS = 4;

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
    /**
     * How many questions the run asks before it ends.
     *
     * Deliberately not capped at anything small. A stream is the one mode with
     * no natural stopping point — the next premise arrives while the last
     * question is still being resolved, so the beats where quitting is a
     * decision are gone — and the length is therefore the *only* thing that
     * decides when it ends. That belongs to the player, at four or at four
     * hundred.
     */
    checkpoints = DEFAULT_CHECKPOINTS,
    /**
     * Ask analogies instead of positions, at the same frequency.
     *
     * "A is to B as C is to D" over the live window: both halves are
     * displacements that have to be composed out of the relations still in
     * mind, and the question is whether they are the same move. It asks more of
     * the same window rather than a bigger one — you cannot answer it by
     * recalling a relation, only by comparing two you built.
     */
    analogy = false,
): Question {
    const axes = (STREAM_SCALES[type] ?? STREAM_SCALES[EnumQuestionType.ComparisonNumerical])!();
    const n = Math.max(2, Math.min(6, window));
    const step = Math.max(1, Math.floor(n / 2));

    const links = n + step * (Math.max(1, checkpoints) - 1);

    /*
     * Objects come back, and that is the point rather than a compromise.
     *
     * A long stream needs more objects than any symbol pool holds — a hundred
     * checkpoints is a hundred-odd links — so names have to repeat. Which is
     * the difficulty that was wanted anyway: an object returning later carrying
     * a *different* relation puts the stale binding in direct competition with
     * the live one, and that measures whether you can let go, where a bigger
     * window only measures how much you can hold.
     *
     * The one rule is that a name may not appear twice inside a single window.
     * Two positions for one object inside the live set makes the chain
     * ambiguous rather than hard, and there would be no right answer to give.
     */
    const pool = getRandomSymbols(ctx.settings, links + 1);
    if (pool.length < n + 2) throw new Error("Cannot generate.");

    const names: string[] = [];
    for (let i = 0; i <= links; i++) {
        const recent = names.slice(-(n + 1));
        const free = pool.filter(x => recent.indexOf(x) < 0);
        names.push(pick(free.length ? free : pool));
    }

    /*
     * The chain, as coordinates: every object's position on every axis.
     *
     * Built checkpoint by checkpoint rather than all at once, because an
     * analogy question has to be *made* true rather than found true. Two random
     * displacements are equal about never, so when a checkpoint wants a true
     * analogy the newest relations are solved for instead of drawn — and they
     * can only be solved for if they have not been shown yet, which is why this
     * walks forward with the run instead of laying the whole chain down first.
     */
    const at: number[][] = [axes.map(() => 0)];
    const deltas: number[][] = [];
    /*
     * Single steps under an analogy, wider otherwise.
     *
     * A true analogy needs the newest link to come out equal to a displacement
     * built from several earlier ones, and that is only possible when the sum
     * is small. Drawn from ±3 across four axes it rarely was — the run came out
     * true 35% of the time at the wide end, which is a mode that rewards
     * answering "false" and reading nothing. Single steps keep the sums inside
     * reach, so the balance holds at every width.
     */
    const draw = () => axes.map(() => pick(analogy ? [-1, 1] : [-3, -2, -1, 1, 2, 3]));

    const extend = (count: number) => {
        for (let i = 0; i < count; i++) {
            deltas.push(draw());
            at.push(at[at.length - 1].map((v, k) => v + deltas[deltas.length - 1][k]));
        }
    };

    /** Re-walk the positions from `from`, after a delta there was rewritten. */
    const rewalk = (from: number) => {
        for (let i = from; i < deltas.length; i++) {
            at[i + 1] = at[i].map((v, k) => v + deltas[i][k]);
        }
    };

    const question = new Question(type);
    question.bucket = names;
    question.setup = [
        `Premises arrive one at a time and <b>do not come back</b>.`,
        `Every question follows from the <b>last ${n}</b> of them — nothing`
        + ` before that is ever needed, so there is nothing to keep.`,
        ...(analogy
            ? [`Each question asks whether one move is <b>the same move</b> as`
               + ` another, both of them built from the relations still live.`]
            : []),
    ];

    /*
     * A conclusion across the whole live window.
     *
     * From the object the window opens on to the one it ends on, so every live
     * relation is composed to answer. Half are made false by moving one axis,
     * which is the same near-miss rule the composed spaces use — a wrong answer
     * that differs everywhere is dismissed without reading.
     */
    const positionClaim = (endLink: number) => {
        const from = endLink - n;
        const truth = at[endLink].map((v, k) => v - at[from][k]);
        const wantValid = Math.random() < 0.5;

        const shown = [...truth];
        if (!wantValid) {
            const axis = Math.floor(Math.random() * axes.length);
            shown[axis] = -shown[axis] || 1;
        }
        return { text: line(names[from], names[endLink], shown, axes), isValid: wantValid };
    };

    /*
     * "A is to B as C is to D", over the same window.
     *
     * The split is `n - step` links in, which puts the second pair entirely
     * inside the relations that have just arrived — and those are the only ones
     * still free to be rewritten. A true analogy is made, not found: two random
     * displacements match about never, so the newest deltas are solved backwards
     * from the answer, and everything after them is re-walked.
     *
     * A false one is the same construction moved on one axis, so it cannot be
     * dismissed on shape. It has to be built and compared like the true one.
     */
    /*
     * The largest step an analogy is allowed to require.
     *
     * Without it the construction compounds: at a window of three the solved
     * link *is* the whole second pair, so each checkpoint's target is the
     * previous solved link plus one — a doubling, which reached 5 × 10^20 by
     * the hundredth question. Numbers that size are not a hard item, they are a
     * broken one.
     */
    const STEP_LIMIT = 4;

    /*
     * How many of the run's analogies have come out true so far.
     *
     * The first version flipped a coin whenever a true claim was *possible* and
     * asked a false one whenever it was not — which sounds fair and is not: a
     * true analogy has to be constructible, that only holds about two thirds of
     * the time, so a third of the run went false for free and the answer came
     * out true 33% of the time. At that rate answering "false" to everything
     * scores 67%, and the mode is a coin the player has seen both sides of.
     *
     * Balanced instead: whenever true is possible and true is behind, take it.
     * The rate converges on half without ever forcing a claim the chain cannot
     * actually support.
     */
    let madeTrue = 0;
    let madeFalse = 0;

    const analogyClaim = (endLink: number) => {
        const from = endLink - n;
        const split = from + Math.max(1, n - step);
        const target = at[split].map((v, k) => v - at[from][k]);
        const before = at[endLink - 1].map((v, k) => v - at[split][k]);
        const needed = target.map((v, k) => v - before[k]);

        /*
         * True is *made*, false is drawn — and the asymmetry is what bounds it.
         *
         * Two random displacements match about never, so a true analogy has to
         * be solved for on the newest link. When that solution would be larger
         * than a reader can hold, the checkpoint simply asks a false one
         * instead, which needs no construction at all. Half the run stays true
         * on average and nothing compounds, because a solved link is only ever
         * accepted while it is small.
         */
        const canBeTrue = needed.every(v => Math.abs(v) <= STEP_LIMIT)
            && needed.some(v => v !== 0);

        if (canBeTrue && (madeTrue <= madeFalse || Math.random() < 0.5)) {
            deltas[endLink - 1] = needed;
        } else {
            // Redrawn until the two halves genuinely differ, rather than assumed
            // to: on a one-axis scale a random draw lands on the target often
            // enough to matter.
            for (let attempt = 0; attempt < 24; attempt++) {
                deltas[endLink - 1] = draw();
                rewalk(endLink - 1);
                const second = at[endLink].map((v, k) => v - at[split][k]);
                if (!second.every((v, k) => v === target[k])) break;
            }
        }
        rewalk(endLink - 1);

        // Read off the finished chain rather than from the intent, so the label
        // cannot disagree with the card.
        const second = at[endLink].map((v, k) => v - at[split][k]);
        const isValid = second.every((v, k) => v === target[k]);
        if (isValid) madeTrue++; else madeFalse++;

        return {
            text: `${subj(names[from])} ${rel("is to")} ${subj(names[split])}`
                + ` ${hi("as")} ${subj(names[split])} ${rel("is to")} ${subj(names[endLink])}`,
            isValid,
        };
    };

    const claimAt = analogy ? analogyClaim : positionClaim;

    /*
     * Each checkpoint extends the chain, then asks. Later ones show only what
     * has arrived since the last — the rest of the window is not on the card,
     * which is the whole mode.
     */
    const runs: Array<{ text: string; isValid: boolean; premises: string[] }> = [];
    for (let c = 0; c < Math.max(1, checkpoints); c++) {
        const fresh = c === 0 ? n : step;
        const shownFrom = deltas.length;
        extend(fresh);
        const endLink = deltas.length;

        const claim = claimAt(endLink);
        runs.push({
            text: claim.text,
            isValid: claim.isValid,
            premises: deltas.slice(shownFrom, endLink)
                .map((d, i) => line(names[shownFrom + i], names[shownFrom + i + 1], d, axes)),
        });
    }

    question.premises = [...runs[0].premises];
    question.conclusion = runs[0].text;
    question.isValid = runs[0].isValid;
    question.series = runs.map(r => ({
        text: r.text, isValid: r.isValid, premises: [...r.premises],
    }));
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
