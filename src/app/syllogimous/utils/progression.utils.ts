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
 * A mode with an empty ladder would otherwise climb to twenty premises on the
 * only axis it has. Capping it says the true thing: this mode has run out of
 * difficulty to offer, and the answer is to give it rungs rather than to make
 * its items longer.
 *
 * Graph Matching used to be the example here — it honours neither negation nor
 * meta, so it had nothing to claim. It has rungs now, which is the answer this
 * comment recommended.
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
    //
    // `retired-*` is a tombstone, and deleting one is not the same as leaving
    // it. A profile stores how many rungs it has earned, and `rungs[i]` is read
    // by position — so removing an entry renames every rung after it for every
    // existing player, silently. The tombstone holds the slot, matches no
    // `hasRung` call, and is filtered out of the settings UI. See fixes/6.
    "negation", "branching", "meta", "overlap", "retired-wide-premises",
    "transform-1", "transform-2", "multi-conclusion", "choose-conclusion",
    "construct-conclusion", "construct-distance", "checkpoint",
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
    // "compact" is retired rather than removed; see the note on LINEAR_LADDER.
    "branching", "retired-compact", "circular", "indeterminate", "facing", "speakers", "testimony", "transform-1", "edit-1",
    "circular-2", "transform-2", "edit-2", "analogy",
    "multi-conclusion", "choose-conclusion", "construct-conclusion", "construct-distance",
    // Appended, never inserted: a profile stores how many rungs it has earned
    // and reads them by position, so a new rung anywhere but the end renames
    // every rung after it for everyone who already has them.
    "checkpoint",
];

/**
 * Modes that are one skill wearing several vocabularies.
 *
 * The five scale modes are the same engine: identical weight, identical
 * ceiling, identical ladder, and a premise reads the same way in all of them
 * with the words swapped. Keeping a separate ability estimate for each meant a
 * player who spread thirty answers across the family had five estimates of six
 * answers apiece, none of them with enough evidence to move — so the family as
 * a whole crawled while each part looked individually reasonable.
 *
 * Ability is shared; *difficulty* still is not. Each mode keeps its own premise
 * bounds and its own scale entry, so sharing a posterior says "you are this
 * good at reading a scale", not "these items are interchangeable".
 *
 * Anything absent is its own family, which is the honest default: two modes
 * should only pool evidence when being good at one really does mean being good
 * at the other.
 */
export const MODE_FAMILIES: Record<string, string> = {
    "Comparison Numerical": "scale",
    "Comparison Chronological": "scale",
    "Vertical Order": "scale",
    "Horizontal Order": "scale",
    "Containment": "scale",
};

/** The ledger a mode's evidence goes in. */
export function familyOf(type: string): string {
    return MODE_FAMILIES[type] ?? type;
}

/** Every mode that shares a ledger with this one, including itself. */
export function familyMembers(type: string): string[] {
    const family = familyOf(type);
    if (family === type) return [type];
    return Object.keys(MODE_FAMILIES).filter(t => MODE_FAMILIES[t] === family);
}

export const RUNG_LADDERS: Record<string, string[]> = {
    // Ranking every candidate rather than picking the furthest one. Same
    // evidence, no guess floor to speak of — so it is earned, not given.
    "Oddest Relation":           ["state-rule", "rank"],
    /*
     * Verify is the base: you are given the map and check it. Each rung takes
     * away more of what was given — which map, then the map's effect on a
     * different structure, then two maps at once.
     */
    "Transformation Matching":   ["identify", "apply", "compose", "sequence"],
    /*
     * The only inductive mode in the app, and the widest ladder because of it.
     *
     * Substitution is in the *base*, not at the top. Mirroring, stretching and
     * shifting all leave a relation naming the same axis and only change it in
     * place, which is read off one example — so a base made of those was a base
     * of easy items however they were combined. Only substitution makes a
     * direction word stop meaning what it says.
     *
     *   offset      everything shifts, which says nothing about any one axis
     *               and so adds least on its own
     *   dim-N       the space widens, three axes to seven
     *   compose-N   more changes at once, up to five
     *   dense-examples  one example covering every axis at once instead of one
     *               per axis. Fewer lines and *more* work: the correspondence
     *               has to be solved rather than read off
     *   groups-N    several groups, each with its own change and its own
     *               marker — the reader keeps two or three dictionaries apart
     *               and applies each to the right chain
     *
     * Interleaved rather than stacked, so a player is never climbing one axis
     * for long.
     */
    /*
     * Widest Group. Three things open, and the margin is deliberately last.
     *
     *   dim-N     more directions to check before a group's widest is known
     *   groups-N  more groups to compare, three then four
     *   margin-1  the winner leads by one rather than two — a glance becomes a
     *             measurement
     *   rank      order every group rather than naming the top one. Naming the
     *             top needs only the top group's score; ordering needs every
     *             one of them, so a reader who spots the winner early cannot
     *             stop there
     *
     * The margin is last because a narrow lead hidden among six directions is
     * the hardest this mode gets, and tightening it before the directions exist
     * to hide it in makes an item fiddly rather than demanding.
     */
    "Widest Group":              [
        "dim-3", "groups-3", "dim-4", "margin-1", "dim-5", "groups-4", "dim-6", "rank",
    ],
    "Axis Maps":                 [
        "compose-2", "dim-4", "offset", "groups-2", "compose-3",
        "dim-5", "dense-examples", "compose-4", "groups-3", "dim-6",
        "compose-5", "dim-7",
    ],
    "Knights and Knaves":        ["compound", "undetermined"],
    /*
     * The vocabulary collision is the novel axis, so it is the whole ladder.
     * Without it the mode is two chains read separately; with it the words in
     * one space actively fight the other.
     */
    "Nested Spaces":             ["collide"],
    // Earned: until then in- and out-degree identify the node, which is
    // counting rather than seeing.
    /*
     * `structure-match` replaces the single-node mapping with a whole
     * correspondence, answered on the picture. `structural` then removes the
     * arrow-counting shortcut from underneath it.
     */
    "Relational Web":            ["structure-match", "structural"],
    "Distinction":               ["negation", "meta"],
    "Comparison Numerical":      LINEAR_LADDER,
    "Comparison Chronological":  LINEAR_LADDER,
    "Vertical Order":            LINEAR_LADDER,
    "Horizontal Order":          LINEAR_LADDER,
    "Containment":               LINEAR_LADDER,
    /*
     * `hierarchy` last: a branching premise network rather than a chain, so
     * some pairs are related only through a group they are both in and some are
     * not related at all — a demand a path can never make.
     */
    "Syllogism":                 ["negation", "meta", "hierarchy"],
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
     * Space 7D was missing from this table entirely, so `ladderFor` returned
     * nothing and the mode could never earn a single modifier — while being
     * built by the same generator as the other five, which honour all of them.
     * A strong player was served plain seven-axis items forever.
     */
    "Space 7D":                  ND_LADDER,

    /*
     * These three had no entry here at all, and `ladderFor` falls back to an
     * empty ladder — so they could never earn anything, and a player who
     * outgrew their premise ceiling was served the same item forever. Two of
     * them still have nothing to offer and say so; the third always could.
     *
     * Stimulus Function reads `settings.enabled.negation` when it renders its
     * relations, so it has been able to honour the rung all along and was
     * simply never offered one.
     */
    "Stimulus Function":         ["negation"],
    /*
     * Genuinely empty, and listed rather than omitted so the difference between
     * "nothing to claim" and "nobody wrote it down" is visible. Both need a
     * modifier of their own before they can go further than their premise
     * ceiling — which is the answer this file gives everywhere else, rather
     * than making the items longer.
     */
    "Infer the Relation":        [],
    "Shape and Rotation":        [],
    /*
     * Longer paths first — a small, continuous increase. Cycles are the
     * structural jump: in a hierarchy "reaches" is a partial order you can
     * reason about by level, and one loop destroys that.
     */
    "Hierarchy":                 ["min-span-3", "cycles", "multi-conclusion", "choose-conclusion"],
    /*
     * Naming the odd one out among several is a comparison; counting the
     * changes needed is a measurement, and strictly harder — you have to find
     * the best matching rather than establish that none exists.
     */
    "Graph Matching":            ["which-differs", "as-relations", "distance"],
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
