/**
 * Fluid progression ladder — pure state machine (see ROADMAP.md).
 *
 * Difficulty moves along the finest axis available and only escalates to a
 * coarser one when the finer is exhausted:
 *
 *   time limit  (continuous, every trial)
 *     └─ rungs  (small discrete: negation, meta, transform depth …)
 *          └─ premises (large discrete, last resort)
 *
 * Nothing here touches Angular or storage, so the arithmetic is verifiable in
 * isolation — the same approach used for the mode generators.
 */

export type Outcome = "right" | "wrong" | "timeout";

export interface ProgressionConfig {
    /** Reset point after a promotion. */
    ceilingSeconds: number;
    /** The user's "premise up at" threshold — promotion fires at or below this. */
    promotionSeconds: number;
    /** Never shrink past this. */
    floorSeconds: number;
    /** Accuracy the staircase converges on; also sets the step ratio. */
    targetAccuracy: number;
    /** Trials in the rolling window. */
    windowSize: number;
    /** Below this, difficulty comes back down. */
    demotionAccuracy: number;
    /** A win only counts as "comfortable" under this fraction of the limit. */
    fastFraction: number;
    /** Base shrink per comfortable win, as a fraction of the current limit. */
    shrink: number;
    /**
     * The premise count past which length stops being allowed to substitute for
     * structure.
     *
     * Two rules hang off it, and both exist because premise count was doing all
     * the work while the interesting modifiers sat unearned:
     *
     *   1. A premise increase above it no longer wipes the claimed rungs.
     *      Re-walking the ladder is right at small sizes — six premises with
     *      negation really is harder than five with negation and meta — but past
     *      this point it produced ten-premise items carrying nothing at all,
     *      which is a longer read rather than a harder problem.
     *   2. A mode with no rungs left to give does not climb past it. If there is
     *      nothing to add but length, adding length is not progress.
     */
    structureBefore: number;
}

export const DEFAULT_PROGRESSION: ProgressionConfig = {
    ceilingSeconds: 90,
    promotionSeconds: 20,
    floorSeconds: 8,
    targetAccuracy: 0.8,
    windowSize: 10,
    demotionAccuracy: 0.5,
    fastFraction: 0.7,
    shrink: 0.03,
    structureBefore: 5,
};

export interface LadderState {
    premises: number;
    timeLimit: number;
    /** Claimed modifier ids, in ladder order. */
    rungs: string[];
    /** Rolling outcome window, most recent last. */
    recent: Outcome[];
}

export type LadderEvent = "rung-up" | "premise-up" | "rung-down" | "premise-down";

export interface LadderResult {
    state: LadderState;
    events: LadderEvent[];
}

/**
 * Step sizes from the target accuracy.
 *
 * An asymmetric up/down staircase converges where gains and losses balance:
 * shrink * p == grow * (1 - p). So grow = shrink * p / (1 - p), and picking the
 * two independently would silently converge somewhere the player never asked
 * for. Deriving it keeps `targetAccuracy` the single honest dial.
 */
export function stepSizes(config: ProgressionConfig) {
    const p = Math.min(0.95, Math.max(0.05, config.targetAccuracy));
    return { shrink: config.shrink, grow: config.shrink * p / (1 - p) };
}

/**
 * Whether length is still an honest way to add difficulty here.
 *
 * A mode with an empty ladder — Graph Matching honours neither negation nor
 * meta, so it has nothing to claim — would otherwise climb to twenty premises
 * on the only axis it has. Capping it says the true thing: this mode has run
 * out of difficulty to offer, and the answer is to give it rungs, not to make
 * its items longer.
 */
export function premisesMayRise(premises: number, ladder: string[], config: ProgressionConfig): boolean {
    if (premises < config.structureBefore) return true;
    return ladder.length > 0;
}

export function accuracyOf(recent: Outcome[]) {
    if (!recent.length) return 0;
    return recent.filter(o => o === "right").length / recent.length;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function initialState(premises: number, config = DEFAULT_PROGRESSION): LadderState {
    return { premises, timeLimit: config.ceilingSeconds, rungs: [], recent: [] };
}

/**
 * Advance the ladder by one answered question.
 *
 * `ladder` is the ordered list of modifier ids this mode supports; when a
 * promotion is due, an unclaimed rung is taken in preference to a premise, so
 * the coarse axis moves as rarely as possible.
 */
export function update(
    state: LadderState,
    config: ProgressionConfig,
    outcome: Outcome,
    answerSeconds: number,
    ladder: string[],
    limits: { min: number; max: number },
): LadderResult {
    const { shrink, grow } = stepSizes(config);
    const events: LadderEvent[] = [];

    const recent = [...state.recent, outcome].slice(-config.windowSize);
    let { premises, timeLimit } = state;
    let rungs = [...state.rungs];

    if (outcome === "right") {
        // Only a comfortable win tightens the screw. Without this, guessing on a
        // binary question would be rewarded half the time and drag the limit down.
        if (answerSeconds <= timeLimit * config.fastFraction) {
            timeLimit *= 1 - shrink;
        }
    } else {
        // A timeout means the limit itself was binding, which a wrong answer does
        // not establish — so it gives back more.
        timeLimit *= 1 + grow * (outcome === "timeout" ? 1.5 : 1);
    }

    timeLimit = clamp(timeLimit, config.floorSeconds, config.ceilingSeconds);

    const windowFull = recent.length >= config.windowSize;
    const accuracy = accuracyOf(recent);

    if (windowFull && timeLimit <= config.promotionSeconds && accuracy >= config.targetAccuracy) {
        if (rungs.length < ladder.length) {
            rungs.push(ladder[rungs.length]);
            events.push("rung-up");
        } else if (premises < limits.max && premisesMayRise(premises, ladder, config)) {
            premises += 1;
            // Below the cap, re-walking the ladder at the new size is the
            // point. Above it, wiping the modifiers leaves a long item with no
            // structure in it — see `structureBefore`.
            if (premises <= config.structureBefore) rungs = [];
            events.push("premise-up");
        }
        // Reset the clock so the next climb starts from slack, producing the
        // sawtooth rather than pinning at the floor.
        timeLimit = config.ceilingSeconds;
        recent.length = 0;
    } else if (windowFull && timeLimit >= config.ceilingSeconds && accuracy < config.demotionAccuracy) {
        if (rungs.length) {
            rungs.pop();
            events.push("rung-down");
        } else if (premises > limits.min) {
            premises -= 1;
            events.push("premise-down");
        }
        recent.length = 0;
    }

    return { state: { premises, timeLimit, rungs, recent }, events };
}

/**
 * Modifier ladders per mode family. Only rungs a mode actually supports appear,
 * so a promotion never claims something the generator ignores.
 *
 * The linear scales carry the long ladder, because a scale question is only as
 * hard as its structure and the structure is the thing being unlocked. In order:
 *
 *   negation           the relation is stated as one the truth rules out
 *   branching          premises stop forming a chain — each object attaches to
 *                      an arbitrary earlier one, in either direction, so you
 *                      have to backtrack instead of appending ("180")
 *   meta               relations about relations
 *   overlap            two objects may share a coordinate, which is what makes
 *                      the third relation ("is equal to") a real answer
 *   transform-1        the layout is mutated once after being described
 *   transform-2        mutated twice, so the order of operations matters
 *   multi-conclusion   several claims, all of which must hold
 *   choose-conclusion  pick which claim follows, with no true/false to guess at
 *   construct-conclusion state the relation yourself, every dimension of it
 *   construct-distance   and how far, not only which way
 *
 * Deliberately ordered by how much it changes rather than by how novel it is:
 * branching before transformations because losing the chain is the bigger jump,
 * and the two conclusion modes last because they change what answering *is*.
 *
 * meta sits ahead of overlap for a mechanical reason, not a difficulty one: a
 * meta premise compares two relations with `<`, which has no honest reading when
 * the pair is tied. Claiming it before ties exist means it is always available;
 * after overlap it applies only to the layouts that happen not to tie.
 */
const LINEAR_LADDER = [
    // Appended mid-ladder rather than at the front: putting a new rung first
    // would shift every rung already earned by one.
    "negation", "branching", "meta", "overlap", "wide-premises",
    "transform-1", "transform-2", "multi-conclusion", "choose-conclusion",
    "construct-conclusion", "construct-distance",
];

/**
 * Composed spaces climb structure rather than vocabulary.
 *
 * branching first, for the same reason as the scales: losing the chain is the
 * biggest single jump.
 *
 *   compact  axes with no difference stop being mentioned, so an unstated axis
 *            has to be read as "the same" rather than ticked off the list
 *   edit-N   premises that rewrite earlier *relations* rather than moving
 *            objects — the premise set becomes the thing you mutate
 *
 * Then the axes start bending into loops, which changes
 * the *kind* of claim the axis can carry — on a ring nothing is greater than
 * anything else, so the question becomes displacement instead of order.
 */
/*
 * Two families of mutation, interleaved rather than stacked.
 *
 * A transformation moves objects: every premise stays true of the arrangement
 * it described, and the arrangement then changes. An edit rewrites what a
 * premise said, so the original arrangement never existed. They are close
 * enough to be confused and far enough apart to be worth telling apart, which
 * is why the first of each arrives before the second of either.
 *
 * `transform-1` is the rung that first turns a composed space into something
 * with no spatial intuition behind it — a quarter turn in the XT plane maps
 * west onto earlier — so it sits after the reading-level rungs and before the
 * answer-mode ones.
 */
const ND_LADDER = [
    "branching", "compact", "circular", "indeterminate", "transform-1", "edit-1",
    "circular-2", "transform-2", "edit-2", "analogy",
    "multi-conclusion", "choose-conclusion", "construct-conclusion", "construct-distance",
];

export const RUNG_LADDERS: Record<string, string[]> = {
    // Ranking every candidate rather than picking the furthest one. Same
    // evidence, no guess floor to speak of — so it is earned, not given.
    "Oddest Relation":           ["rank"],
    /*
     * Verify is the base: you are given the map and check it. Each rung takes
     * away more of what was given — which map, then the map's effect on a
     * different structure, then two maps at once.
     */
    "Transformation Matching":   ["identify", "apply", "compose"],
    // Earned: until then in- and out-degree identify the node, which is
    // counting rather than seeing.
    "Relational Web":            ["structural"],
    "Distinction":               ["negation", "meta"],
    "Comparison Numerical":      LINEAR_LADDER,
    "Comparison Chronological":  LINEAR_LADDER,
    "Vertical Order":            LINEAR_LADDER,
    "Horizontal Order":          LINEAR_LADDER,
    "Containment":               LINEAR_LADDER,
    "Syllogism":                 ["negation", "meta"],
    "Linear Arrangement":        ["negation", "meta"],
    "Circular Arrangement":      ["negation", "meta"],
    "Direction":                 ["negation", "meta", "incorrect-directions"],
    "Direction3D Spatial":       ["negation", "meta"],
    "Direction3D Temporal":      ["negation", "meta"],
    "Space 3D":                  ND_LADDER,
    "Space 4D":                  ND_LADDER,
    "Space 5D":                  ND_LADDER,
    "Space 6D":                  ND_LADDER,
    /*
     * Longer paths first — a small, continuous increase. Cycles are the
     * structural jump: in a hierarchy "reaches" is a partial order you can
     * reason about by level, and one loop destroys that.
     */
    "Hierarchy":                 ["min-span-3", "cycles", "multi-conclusion", "choose-conclusion"],
    "Graph Matching":            [],
    "Analogy":                   ["negation", "meta"],
    "Binary":                    ["negation", "meta"],
    "Deictic Relations":         ["extra-reversal", "third-axis"],
    "Transformation":            ["transform-depth-1", "transform-depth-2"],
    "Anchor Space":              ["negation"],
    "Anchor Space v2":           ["transform-depth-1", "transform-depth-2"],
};

export function ladderFor(type: string) {
    return RUNG_LADDERS[type] ?? [];
}
