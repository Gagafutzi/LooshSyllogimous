/**
 * Judging a built conclusion.
 *
 * Kept apart from the generators because both the game screen and the placement
 * test have to score construction answers, and two copies of "is this right"
 * would eventually disagree — which on this mode means marking a correct answer
 * wrong, the worst failure a trainer has.
 */

import { ConstructClaim, ConstructSlot } from "../models/question.models";

/** What the player entered for one slot. `direction` is -1 until they choose. */
export interface SlotAnswer {
    direction: number;
    magnitude: number;
}

export function emptyAnswer(): SlotAnswer {
    // Distance defaults to one: it is by far the commonest value, and an empty
    // box would make every "same" row look unfinished.
    return { direction: -1, magnitude: 1 };
}

/** Positive remainder — JavaScript's % keeps the sign of the dividend. */
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Whether one slot is answered correctly.
 *
 * On a straight axis: the direction must match, and so must the distance —
 * except under "same", where there is no distance to state.
 *
 * On a circular axis: only the *signed displacement* matters, taken modulo the
 * loop. Two steps clockwise round a five-loop is three steps anticlockwise, and
 * both are the same claim about the same pair. Insisting on the shorter way
 * round would fail an answer that is exactly right.
 */
export function slotSatisfied(slot: ConstructSlot, answer: SlotAnswer | undefined): boolean {
    if (!answer || answer.direction < 0) return false;

    // Direction-only slots never look at the box, on either kind of axis.
    if (!slot.asksDistance) return answer.direction === slot.answerDirection;

    if (slot.modulus) {
        const signed = (a: SlotAnswer) =>
            a.direction === 2 ? 0 : (a.direction === 0 ? a.magnitude : -a.magnitude);
        const truth = slot.answerDirection === 2
            ? 0
            : (slot.answerDirection === 0 ? slot.answerMagnitude : -slot.answerMagnitude);
        return mod(signed(answer), slot.modulus) === mod(truth, slot.modulus);
    }

    if (answer.direction !== slot.answerDirection) return false;
    // "Same" carries no distance, so whatever is in the box is irrelevant.
    if (slot.answerDirection === 2) return true;
    return answer.magnitude === slot.answerMagnitude;
}

/**
 * Whether the whole conclusion is right.
 *
 * Every slot of every claim, with no partial credit: half a relation is not a
 * relation, and crediting a near miss hands back the guess floor this mode
 * exists to create.
 */
export function constructionSatisfied(
    claims: ConstructClaim[],
    picks: SlotAnswer[][],
): boolean {
    return claims.every((claim, i) =>
        claim.slots.every((slot, j) => slotSatisfied(slot, picks[i]?.[j])));
}

/** Blank answers shaped to a question's claims. */
export function blankPicks(claims: ConstructClaim[]): SlotAnswer[][] {
    return claims.map(c => c.slots.map(() => emptyAnswer()));
}

/** How many slots are still unanswered, for the progress hint. */
export function slotsRemaining(picks: SlotAnswer[][]): number {
    return picks.reduce((a, c) => a + c.filter(s => s.direction < 0).length, 0);
}

/** One dimension of a construct answer, as the result screen shows it. */
export interface SlotComparison {
    /** The dimension's name, as the premises painted it. */
    label: string;
    /** Axis colour class, so the row matches the clause it is about. */
    colorClass?: string;
    /** What the truth was, worded. */
    correct: string;
    /** What was entered, worded, or null if the slot was left blank. */
    entered: string | null;
    ok: boolean;
    /**
     * Right way, wrong distance.
     *
     * Worth telling apart from a wrong direction, because they are different
     * mistakes: one is a slip in arithmetic and the other is a slip in reading,
     * and a screen that reports both as "wrong" cannot say which was made.
     */
    directionOk: boolean;
}

/** How a slot's answer reads out loud. */
function wordSlot(slot: ConstructSlot, direction: number, magnitude: number): string {
    const word = slot.directions[direction] ?? "—";
    if (!slot.asksDistance || direction === 2) return word;
    return `${word} by ${magnitude}`;
}

/**
 * A construct answer, dimension by dimension.
 *
 * The result screen collapsed a seven-dimension answer to `true` or `false`,
 * which throws away the reason construction exists: its own justification is
 * that a binary answer cannot tell a lucky run from an understood one, and then
 * the result was reported as a binary. Six dimensions right and one wrong is a
 * different event from all seven wrong, and only one of them means the item was
 * misread.
 *
 * Pure, and beside `slotSatisfied` rather than in a component, because the
 * screen and the placement test both have to say the same thing about the same
 * answer — and a second opinion about what "correct" means is how a trainer
 * ends up marking a right answer wrong.
 */
export function compareConstruction(
    claims: ConstructClaim[],
    picks: SlotAnswer[][] | undefined,
): SlotComparison[][] {
    return claims.map((claim, i) => claim.slots.map((slot, j) => {
        const answer = picks?.[i]?.[j];
        const answered = !!answer && answer.direction >= 0;
        return {
            label: slot.label,
            colorClass: slot.colorClass,
            correct: wordSlot(slot, slot.answerDirection, slot.answerMagnitude),
            entered: answered ? wordSlot(slot, answer!.direction, answer!.magnitude) : null,
            ok: slotSatisfied(slot, answer),
            /*
             * On a circular axis there is no separate direction to be right
             * about: two steps clockwise round a five-loop *is* three steps
             * anticlockwise, so the pair (direction, distance) means one thing
             * and splitting it would report a correct answer as half wrong.
             */
            directionOk: slot.modulus
                ? slotSatisfied(slot, answer)
                : answered && answer!.direction === slot.answerDirection,
        };
    }));
}

/* ------------------------------------------------------------------ *
 * Which dimension a player loses                                      *
 * ------------------------------------------------------------------ */

/**
 * One dimension's record across every construction answered.
 *
 * `misread` and `miscounted` are the split `SlotComparison.directionOk` exists
 * for, carried up to where it can be acted on: getting the direction wrong is a
 * slip in *reading* the premises, and getting the distance wrong having read
 * them correctly is a slip in *arithmetic*. They are different problems with
 * different remedies, and a report that called both "wrong" would be the same
 * one-bit summary construction was built to replace, one level up.
 */
export interface DimensionRecord {
    label: string;
    /** Slots of this dimension the player actually filled in. */
    attempts: number;
    wrong: number;
    /** Wrong about which side of the axis the pair sits on. */
    misread: number;
    /** Right about the direction, wrong about how far. */
    miscounted: number;
    /** Filled-in slots answered correctly, as a fraction. */
    accuracy: number;
}

/**
 * Per-dimension accuracy over answered construction items.
 *
 * Derived from the history rather than tallied as answers come in, deliberately.
 * The questions already carry what was asked and what was entered, and
 * `compareConstruction` is the same function the result screen and the ability
 * model read — so there is no third place for the three to disagree, and the
 * report covers history recorded before it was written.
 *
 * **Unfilled slots are skipped rather than counted wrong.** A timed-out item
 * leaves every slot blank, and counting those as mistakes would fill the report
 * with dimensions the player never reached — which reads as "you are bad at
 * time" wearing the labels of seven axes.
 */
export function dimensionBreakdown(
    questions: Array<{
        answerMode?: string;
        construct?: ConstructClaim[];
        userConstruct?: SlotAnswer[][];
    }>,
): DimensionRecord[] {
    const byLabel = new Map<string, DimensionRecord>();

    for (const q of questions) {
        if (q.answerMode !== "construct" || !q.construct?.length) continue;

        for (const claim of compareConstruction(q.construct, q.userConstruct)) {
            for (const slot of claim) {
                if (slot.entered === null) continue;

                const row = byLabel.get(slot.label) ?? {
                    label: slot.label, attempts: 0, wrong: 0,
                    misread: 0, miscounted: 0, accuracy: 0,
                };
                row.attempts++;
                if (!slot.ok) {
                    row.wrong++;
                    if (slot.directionOk) row.miscounted++; else row.misread++;
                }
                byLabel.set(slot.label, row);
            }
        }
    }

    // Worst first, and a dimension with more attempts behind it breaks a tie:
    // two wrong out of three is a worse *reading* than two out of two.
    return [...byLabel.values()]
        .map(r => ({ ...r, accuracy: r.attempts ? (r.attempts - r.wrong) / r.attempts : 0 }))
        .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}
