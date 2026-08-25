/**
 * Whether the explanation overlay opens, and what it carries.
 *
 * The overlay is the one deliberate interruption in a screen built to avoid
 * them: a wrong answer returns one bit about an item that took a minute to
 * read, and an error only teaches if the correction is read. That is the case
 * for showing it, and it is not everybody's case. Somebody drilling for speed
 * is stopped twice a minute by a panel they already understand, and the honest
 * answer to that is a switch rather than an argument.
 *
 * **A whole overlay, not a paragraph.** `game.review` is what the panel is
 * shown by, so emptying it takes the derivation, the map, the Venn, the stages
 * and the dimension breakdown with it. That is deliberate — those are the
 * explanation, in the modes where a picture explains better than prose — and it
 * is also already the behaviour of every mode that derives nothing, which shows
 * no panel and moves straight on. Turning this off makes every mode behave the
 * way those ones always have.
 *
 * **Nothing is discarded.** Only the interruption is suppressed. `explanation`
 * is still stored on the question and History still renders it for every item,
 * right or wrong, which is where it can be read without a clock running.
 *
 * Split out of the service so the rule can be tested. It is three lines that
 * decide whether a panel ever opens, which is exactly the kind of thing that
 * gets found by looking at the screen otherwise.
 */

import { LS_EXPLANATIONS_OFF } from "../constants/local-storage.constants";

/** Absence means shown, so an existing player is not migrated onto anything. */
export function explanationsOn(): boolean {
    try {
        return localStorage.getItem(LS_EXPLANATIONS_OFF) !== "1";
    } catch {
        // Private mode: the default stands rather than the feature vanishing.
        return true;
    }
}

export function setExplanationsOn(on: boolean): void {
    try {
        if (on) localStorage.removeItem(LS_EXPLANATIONS_OFF);
        else localStorage.setItem(LS_EXPLANATIONS_OFF, "1");
    } catch { /* private mode; the default stands */ }
}

/**
 * The steps the overlay should show, or none to move straight on.
 *
 * A correct answer never opens it — that has always been true and is not what
 * the switch is about. A timeout does: the clock ran out on an item that was
 * being worked on, which is the case the derivation is most use for.
 */
export function reviewSteps(
    kind: "correct" | "wrong" | "timeout",
    explanation: string[] | undefined,
    shown = explanationsOn(),
): string[] {
    if (kind === "correct" || !shown) return [];
    return explanation ?? [];
}
