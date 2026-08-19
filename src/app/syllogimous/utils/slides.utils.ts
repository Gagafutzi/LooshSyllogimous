/**
 * What a question shows, and in what order.
 *
 * Lived inside the game page, where nothing could check it — and display has
 * now broken invisibly three times: Relational Web stated itself in pictures a
 * slide never rendered, a structure match printed its own answer on a
 * conclusion slide, and Transformation Matching listed coordinates beside the
 * grids that replaced them. Each was found by someone looking at the screen,
 * which is the most expensive way to find anything.
 *
 * So it is a pure function over the question, and the contract it has to meet
 * is a test rather than a habit:
 *
 *   - everything the item *states* is reachable;
 *   - nothing that would give the answer away is shown;
 *   - there is always at least one slide, or the carousel has nothing to show.
 *
 * Pure — no Angular.
 */

/** Just enough of a question to lay out. */
export interface SlideSource {
    setup?: string[];
    premises: string[];
    conclusion: string | string[];
    answerMode: "boolean" | "choice" | "construct" | "map";
    webs?: unknown[];
    grids?: unknown[];
    choices?: string[];
    construct?: unknown[];
}

/**
 * Whether the item's own body is a picture rather than sentences.
 *
 * Both picture modes leave something in `premises` — Transformation Matching
 * keeps its coordinates for the history list — so "has premises" is not the
 * question. The question is whether the premises are a second rendering of
 * something already on screen.
 */
export function drawsItself(q: SlideSource): boolean {
    return !!q.grids?.length || !!q.webs?.length;
}

/**
 * Whether showing the conclusion would hand over the answer.
 *
 * A construction builds its conclusion, and a match *is* a correspondence, so
 * in both the conclusion field holds the answer rather than a claim to judge.
 */
export function concealsConclusion(q: SlideSource): boolean {
    return q.answerMode === "construct" || q.answerMode === "map";
}

export function slideNames(q: SlideSource): string[] {
    const ids: string[] = [];

    if (q.setup?.length) ids.push("setup");
    if (q.grids?.length) ids.push("grids");
    if (q.webs?.length) ids.push("webs");

    // Premises are the body only when the item has no picture standing in for
    // them; otherwise they are the same content in the form the picture
    // replaced.
    if (!drawsItself(q)) {
        q.premises.forEach((_, i) => ids.push("premise-" + i));
    }

    if (q.answerMode === "choice") {
        ids.push("choices");
    } else if (!concealsConclusion(q)) {
        const count = Array.isArray(q.conclusion) ? q.conclusion.length : 1;
        for (let i = 0; i < count; i++) ids.push("conclusion-" + i);
    }

    return ids;
}


/**
 * Move by one slide, clamped at both ends.
 *
 * Deliberately not wrapping: reaching the end is what unlocks answering, and
 * wrapping round to the first premise again made that a lap counter rather than
 * a position.
 *
 * Trivial, and here rather than in the page because "advancing does not work"
 * has been the report three times running. A clamp is easy to get right and
 * easier to check than to argue about.
 */
export function stepSlide(order: string[], current: string, delta: number): string {
    if (!order.length) return "";
    const at = order.indexOf(current);
    const from = at < 0 ? 0 : at;
    return order[Math.min(order.length - 1, Math.max(0, from + delta))];
}
