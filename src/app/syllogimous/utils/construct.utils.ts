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
