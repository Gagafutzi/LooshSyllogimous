/**
 * One difficulty scale, one ability estimate, one number.
 *
 * The progression system grew three adaptive mechanisms that never spoke to each
 * other: a tier driven by an accumulated score, a per-mode staircase over
 * premises and a clock, and a training-unit tracker with its own thresholds.
 * Each moved difficulty on its own axis, none of them knew what the others had
 * concluded, and the visible number — the score — was a running total of answers
 * given rather than a statement about ability.
 *
 * This replaces all of it with the standard psychometric arrangement:
 *
 *   1. Every configuration an item can have maps to a single **difficulty**,
 *      in linear-equivalent premises. Premises, claimed rungs and the clock all
 *      contribute to the same number.
 *   2. Each mode carries a **posterior over ability** on that same scale.
 *   3. Item selection asks for the configuration nearest the ability estimate,
 *      offset to whatever accuracy is wanted.
 *   4. The **skill number is the aggregate of those posteriors**, recomputed
 *      rather than accumulated — so it can fall, and cannot be farmed.
 *
 * Two of the harder requirements then come for free rather than needing
 * machinery of their own:
 *
 *   - **Cold start.** A mode never played has no evidence, so its prior is the
 *     aggregate. Being good elsewhere is exactly what a prior is for, and the
 *     240-question warm-up disappears.
 *   - **Decay.** Time since last played widens the posterior. The estimate drifts
 *     back toward the aggregate and item selection backs off on its own; nothing
 *     has to be un-claimed.
 *
 * The inference machinery is `quest.utils.ts`, which already does grid-posterior
 * updating, diffusion and promotion correctly. What changes is the latent: that
 * module estimates a threshold on the *time* axis, where more intensity means a
 * higher chance of success. Here the latent is ability against *difficulty*,
 * where more intensity means a lower one. Same arithmetic, opposite sign.
 *
 * Pure — no Angular, no storage.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { MODE_SCALE } from "./calibration.utils";

/* ------------------------------------------------------------------ *
 * The difficulty scale                                                *
 * ------------------------------------------------------------------ */

/**
 * What one claimed rung is worth, in linear-equivalent premises.
 *
 * These are estimates, and they are wrong in detail. The point is that they are
 * wrong *in one table*, explicitly, where they can be corrected from data —
 * rather than being implicit in the order of a ladder and invisible to the
 * number the player is shown. A rung that costs nothing to claim but changes the
 * task is exactly the case the old system could not represent.
 *
 * Second instances of a repeated modifier cost less than the first: the step from
 * no transformations to one is learning that the arrangement moves at all; the
 * step from one to two is doing a familiar thing twice.
 */
export const RUNG_COST: Record<string, number> = {
    negation: 0.6,
    meta: 1.0,

    branching: 0.8,
    overlap: 0.7,
    /*
     * Dearer than the other premise-shape modifiers because it changes what is
     * being asked, not how it is worded: the claim becomes one of necessity,
     * and "the premises never settled this" is a conclusion propagation cannot
     * reach by finishing — it is reached by noticing that it cannot finish.
     */
    indeterminate: 1.3,
    /*
     * The dearest modifier in the table, and it should be. Every other one
     * changes what the premises say; this changes where they are read from, and
     * the facing has to be derived before it can be used — so one premise costs
     * two steps and the layout has to be held twice, once absolutely and once
     * from inside.
     */
    facing: 1.8,
    /*
     * Two puzzles stacked: work out who is lying, then work out the
     * arrangement from what is left. Dearer than either alone because the
     * second cannot start until the first is finished.
     */
    speakers: 2.2,
    /*
     * Dearer again: the liars have to be found *from the arrangement* rather
     * than only from what they say about each other, and the item then asks for
     * both answers instead of one.
     */
    testimony: 2.6,


    /*
     * Axis Maps. Marginal costs over a prefix, like the transform pair above:
     * each extra axis is one more entry to induce and carry, and it gets a
     * little cheaper as the reader learns what the examples are for.
     */
    "dim-3": 0.6, "dim-4": 0.6, "dim-5": 0.6, "dim-6": 0.5, "dim-7": 0.5,
    // A shift needs the frame to be visible at all, and says nothing about any
    // one axis, so it adds least of the four.
    offset: 0.6,
    /*
     * Composition, marginal over a prefix: the second change is the jump, and
     * each after it is one more entry in a dictionary already being held.
     */
    "compose-2": 1.1, "compose-3": 0.9, "compose-4": 0.8, "compose-5": 0.7,
    /*
     * A second dictionary, kept apart from the first and applied to the right
     * chain. Dearer than another change within one map, which is why it is
     * separated from compose at all -- two changes is a longer rule, two groups
     * is two rules and the question of which is which.
     */
    "groups-2": 1.6, "groups-3": 1.2, "groups-4": 1.0,
    /*
     * The examples stop handing the map over an axis at a time. Fewer lines to
     * read and a correspondence to solve instead, which is the mode's own
     * skill asked more directly.
     */
    "dense-examples": 1.5,
    /*
     * Mutual Moves. Each of these multiplies the space of rules the reader
     * has to rule out, and they are priced by how much: an operation or a
     * role doubles it outright, an axis only widens what each move is
     * measured in.
     */
    "op-join": 1.0,
    "op-follow": 1.1,
    "op-mirror": 1.2,
    "role-next": 1.0,
    /* Two roles at once, and the only two under which one object stands
       still while everything else moves against it. */
    "role-extremes": 1.6,
    "axes-3": 0.9,
    "axes-4": 1.0,
    /*
     * A one-point lead instead of two. The comparison stops being a glance and
     * has to be measured, which is the whole difficulty of the mode in a single
     * rung.
     */
    "margin-1": 1.3,
    /*
     * A second claim, answerable earlier. Priced low: it adds a question rather
     * than difficulty to the one already there, and its value is diagnostic --
     * it says *where* a reader lost the thread, which a single verdict cannot.
     */
    checkpoint: 0.5,

    analogy: 2.0,

    "choose-conclusion": 0.8,
    "construct-conclusion": 1.8,
    "construct-distance": 1.2,

    identify: 1.0,
    apply: 1.6,
    compose: 1.4,
    sequence: 1.8,

    collide: 1.5,
    "state-rule": 1.1,
    /*
     * A per-object offset on top of the shared one. Priced above a plain extra
     * turn because it cannot be folded into the running total — every other
     * turn in the mode applies to everything at once, and this is the one that
     * has to be kept separately and applied to one object.
     */
    "solo-turns": 1.2,
    "which-differs": 1.2,
    /*
     * Not a modifier on the base task — a different task with the same answer.
     *
     * Priced at 1.3, a tenth above naming the odd group out, on the reasoning
     * that "the comparison itself is the base mode's". That reasoning skips the
     * step it names in its own next clause: with the graphs drawn you compare
     * two pictures, and with them stated as relations you must **build** each
     * graph in memory before there is anything to compare. Building a structure
     * out of sentences is the whole of what the composed spaces charge their
     * weight for.
     *
     * Reported from play — *"the progression system overestimates the
     * difficulty of graph matching, not the linear one which is quite difficult
     * but the og one"* — and one account's trials say the same thing loudly.
     * Same mode, same window, two premises apiece:
     *
     *     drawn, no rungs        14 answers   93% right   median  10s
     *     stated as relations     6 answers   33% right   median 131s
     *
     * A thirteen-fold gap in time and a sixty-point gap in accuracy, for 1.3
     * levels. Sharing one estimate between them leaves it parked where the
     * drawn form is trivial and the relational form is out of reach, which is
     * exactly where that account sits.
     *
     * **Priced by kind rather than fitted.** Six answers cannot carry a
     * coefficient, and that log spans several versions besides. 2.4 puts it
     * between `speakers` and `testimony` — the other two rungs that stop the
     * arrangement being something you read and make it something you have to
     * reconstruct first. The next export can check it.
     */
    "as-relations": 2.4,
    hierarchy: 1.5,
    distance: 2.0,
    compound: 1.2,
    undetermined: 1.4,

    "min-span-3": 0.8,
    cycles: 1.5,

    /*
     * These two were reaching the 0.8 fallback rather than being priced.
     *
     * The fallback exists so a new rung is never a crash, not so it can stand
     * in for a decision — and several of them silently sharing one number is
     * how a difficulty model stops meaning anything. Estimates like the rest of
     * this table, and wrong in the same explicit way, which is what
     * `fitRungCosts` is for.
     *
     * Deictic Relations' `extra-reversal` (0.8) and `third-axis` (1.0) sat here
     * too, and are gone rather than tombstoned: the mode's premise count is
     * already a bijection onto its (axes, reversals) frames, so both rungs
     * priced a difficulty the item was carrying anyway. See the note on its
     * now-empty ladder in `progression.utils.ts`.
     */

    /*
     * Tombstones, priced at zero and priced deliberately.
     *
     * These held the ladder slots that `wide-premises` (0.7) and `compact`
     * (0.5) used to occupy, and the prices went with the names — see fixes/6
     * for why both features left the ladder. The slots stay filled so existing
     * profiles keep their earned rungs aligned by position; the price is zero
     * because the item no longer carries the feature. Falling through to the
     * 0.8 fallback would charge every player who had climbed past that slot for
     * a difficulty their items do not contain.
     *
     * Both features are still reachable from Customise, and — like every other
     * forced flag — are not priced when forced.
     */
    "retired-wide-premises": 0,
    "retired-compact": 0,
    "retired-meta": 0,
    /*
     * The counted entries, which are dials now. Held at nothing rather than
     * removed so a ladder keeps its length and its later entries keep meaning
     * what they meant.
     */
    "retired-circular": 0, "retired-circular-2": 0,
    "retired-transform-1": 0, "retired-transform-2": 0,
    "retired-edit-1": 0, "retired-edit-2": 0,
    "retired-transform-depth-1": 0, "retired-transform-depth-2": 0,
    "retired-groups-3": 0,
    "retired-groups-4": 0,
    "retired-rank": 0,
    "retired-multi-conclusion": 0,
    "retired-groups-2": 0,
    "match-3": 0.5,

    // A false direction drawn from ones the item used. It removes a shortcut
    // rather than adding work — measured at 79% against 75% when it went in,
    // which is roughly a quarter of a level.

    // Every distance rather than the furthest. One in five by luck becomes one
    // in three thousand, and the task changes from an argmax to a measurement.
    rank: 1.6,

    // Relational Web without the counting shortcut: in- and out-degree stop
    // identifying a node, so the structure has to be seen rather than tallied.
    structural: 1.4,
    /*
     * Several nodes held at once and kept consistent, rather than one looked
     * up. The guess rate collapses too — an ordered three-from-eight is one in
     * 336 — so a correct answer is worth far more evidence than the menu
     * version, and the difficulty has to say so.
     */
    "structure-match": 1.7,
};

/**
 * Premises a rung needs before it can mean anything.
 *
 * Not a preference — a feasibility constraint the generators already impose and
 * that the difficulty scale would otherwise be blind to. Branching needs a
 * branch point; edits need two relations to exchange; analogy needs enough
 * objects for two disjoint pairs to match, which `createNdSpace` enforces as an
 * object floor; transformations come out of the object budget.
 *
 * Without this, "prefer structure over length" collapses into stacking every
 * rung onto the shortest possible item, where half of them have nothing to act
 * on. Encoding it here is what makes premises and rungs grow *together* rather
 * than one after the other.
 */
export const RUNG_MIN_PREMISES: Record<string, number> = {
    branching: 4,
    overlap: 4,
    analogy: 5,
    "choose-conclusion": 5,
    "construct-conclusion": 4,
    // The halfway claim only exists above four premises, so granting the rung
    // below that hands out something that silently does nothing.
    checkpoint: 5,
    // Three objects at least: one that moves alone, and a pair that does not,
    // or the invariance form has nothing left to be invariant about.
    "solo-turns": 4,
    cycles: 4,
    "min-span-3": 4,
    // Three badges need three nodes the web holds rigid, which a small web
    // rarely has.
    "match-3": 5,
};

/** Fewest premises at which a prefix of the ladder is all meaningful. */
/* ------------------------------------------------------------------ *
 * Dials                                                               *
 * ------------------------------------------------------------------ */

/**
 * A lever that counts rather than one that opens.
 *
 * Eight ladder entries were never eight unlocks. `circular` and `circular-2`
 * are one integer allowed to reach two, and so are the transform, edit and
 * transform-depth pairs — two, because two is how many list positions were
 * spent on them. Nothing stopped edits at two except that nobody wrote
 * `edit-3`.
 *
 * As a dial the same quantity has no ceiling in the model. What a mode can
 * actually build is a feasibility limit and stays in the generator, where it
 * belongs; the difficulty scale simply prices whatever was asked for.
 *
 * **Steps are priced individually and the last price repeats.** Each of these
 * costs less than the one before it — 1.5 then 1.2, 1.6 then 1.2 then 1.0 —
 * which is a real property of them and would be lost by a flat `cost × n`.
 * Keeping the priced list and extending it at the last value means every
 * configuration the ladder could reach costs exactly what it used to, and the
 * ones past it are priced by the most recent evidence rather than by a guess.
 */
export interface Dial {
    /** What each step costs, in levels. Steps past the end cost the last one. */
    steps: number[];
    /**
     * Premises each step needs before it can mean anything.
     *
     * The feasibility constraint the ladder carried as `RUNG_MIN_PREMISES`, kept
     * with the dial it belongs to. Steps past the end need what the last one
     * did: an operation that needs four premises to be worth stating does not
     * stop needing them at the third turn of the dial.
     */
    needs: number[];
    /** The ladder entries this replaces, in order. */
    was: string[];
}

export const DIALS: Record<string, Dial> = {
    circular: { steps: [1.2, 0.8], needs: [0, 0], was: ["circular", "circular-2"] },
    transforms: {
        steps: [1.5, 1.2], needs: [4, 5], was: ["transform-1", "transform-2"],
    },
    edits: { steps: [1.5, 1.2], needs: [4, 5], was: ["edit-1", "edit-2"] },
    "transform-depth": {
        steps: [1.2, 1.0], needs: [4, 5],
        was: ["transform-depth-1", "transform-depth-2"],
    },
};

/** Premises a dial turned this far needs, which is what its last step needs. */
export function dialNeeds(dials: Record<string, number> | undefined): number {
    if (!dials) return 0;
    let most = 0;
    for (const [name, n] of Object.entries(dials)) {
        const dial = DIALS[name];
        if (!dial || n <= 0) continue;
        most = Math.max(most, dial.needs[Math.min(n - 1, dial.needs.length - 1)] ?? 0);
    }
    return most;
}

/** What `steps` turns of a dial cost, together. */
export function dialCost(name: string, steps: number): number {
    const dial = DIALS[name];
    if (!dial || steps <= 0) return 0;
    let total = 0;
    for (let i = 0; i < steps; i++) {
        total += dial.steps[Math.min(i, dial.steps.length - 1)];
    }
    return total;
}

export function dialsCost(dials: Record<string, number> | undefined): number {
    if (!dials) return 0;
    return Object.entries(dials).reduce((a, [name, n]) => a + dialCost(name, n), 0);
}

/**
 * Spend a level budget across the dials a mode has, one step at a time.
 *
 * Round-robin, and that is not arbitrary: the ladder these came from
 * interleaved them — `circular`, `transform-1`, `edit-1`, then `circular-2`,
 * `transform-2`, `edit-2` — so taking one step of each before a second of any
 * reproduces the order a player used to climb them in. What changes is that a
 * dial can now be turned without its neighbours, and that none of them stops at
 * two.
 *
 * Stops when no dial's next step fits what is left, rather than when a list runs
 * out.
 */
export function allocateDials(names: string[], budget: number): Record<string, number> {
    const out: Record<string, number> = {};
    if (!names.length || budget <= 0) return out;

    let left = budget;
    for (let round = 0; round < 64; round++) {
        let spent = false;
        for (const name of names) {
            const next = dialCost(name, (out[name] ?? 0) + 1) - dialCost(name, out[name] ?? 0);
            if (next > left) continue;
            out[name] = (out[name] ?? 0) + 1;
            left -= next;
            spent = true;
        }
        if (!spent) break;
    }
    return out;
}

/** The same allocation, with any step the premise count cannot support removed. */
export function capDials(
    dials: Record<string, number>, premises: number,
): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [name, n] of Object.entries(dials)) {
        const dial = DIALS[name];
        if (!dial) continue;
        let kept = 0;
        for (let i = 0; i < n; i++) {
            if ((dial.needs[Math.min(i, dial.needs.length - 1)] ?? 0) > premises) break;
            kept++;
        }
        if (kept > 0) out[name] = kept;
    }
    return out;
}

/** Total turns across every dial, which is structure the same way a gate is. */
export function dialSteps(dials: Record<string, number> | undefined): number {
    return dials ? Object.values(dials).reduce((a, n) => a + n, 0) : 0;
}

export function premisesNeededFor(rungs: string[]): number {
    return rungs.reduce((a, r) => Math.max(a, RUNG_MIN_PREMISES[r] ?? 0), 0);
}

export interface AbilityConfig {
    /**
     * How many standard deviations below the mean to aim while unsure.
     *
     * Without this the item is chosen from the posterior *mean*, which treats a
     * wild guess and a settled measurement identically. A new player's
     * posterior is deliberately wide, so its mean sits mid-range and the first
     * item arrives with four premises and two modifiers — long before anything
     * is known about them.
     *
     * Aiming at a lower quantile makes uncertainty cost difficulty rather than
     * add it, and it is self-correcting: as evidence narrows the posterior, the
     * penalty shrinks to nothing.
     */
    caution: number;

    /**
     * Most levels uncertainty may cost, however unsure the model is.
     *
     * Caution turns width into difficulty loss, and it is indifferent to *why*
     * the posterior is wide. That is the single mechanism behind most of what
     * felt wrong (see `progression/diagnosis.md`): a streak widens it, time
     * away widens it, and a cross-mode prior is born wide — so the model
     * answers "I am no longer sure you are this good" by serving items well
     * below a mean nothing has contradicted, which teaches it nothing and keeps
     * it unsure.
     *
     * Bounding it keeps the part that was wanted — an unmeasured player is not
     * handed a mid-range item — and removes the part that was a demotion in all
     * but name. Measured across the failure cases:
     *
     *   cap    steady acc   answers to track +4   after 15 days idle   fresh mode P
     *   none        0.880                    80          7.10 levels          0.956
     *   0.6         0.860                    64          9.17                 0.876
     *   1.0         0.856                    67          8.86                 0.906
     *   0 (off)     0.828                    75          9.99                 0.804
     *
     * 0.6 is better than uncapped on every column. Off is better still on two,
     * but caution has a job on the first item of a mode nobody has played and
     * that is not a job worth abolishing for a tenth of a level elsewhere.
     */
    cautionCap: number;

    /**
     * Answers, across all modes, before the cap is fully in force.
     *
     * Ramped rather than switched: a step change would move every mode's
     * difficulty on one answer. Before this many, the app has no basis for
     * believing anything about the player and full caution is right.
     */
    cautionCapAfter: number;

    /** Ability grid, in linear-equivalent premises. */
    minLevel: number;
    maxLevel: number;
    bins: number;
    /**
     * Spread of the psychometric function, in levels.
     *
     * How much harder an item has to get before the chance of success falls
     * appreciably. Held fixed rather than estimated — fitting it too costs
     * roughly three times the trials for very little at this sample size.
     */
    slope: number;
    /** Errors that happen regardless of how easy the item was. */
    lapseRate: number;
    /**
     * Geometric discount on accumulated evidence, since ability moves.
     *
     * Effective memory is about `1 / (1 - forgetting)` answers, and that is the
     * dial that decides how long a genuine improvement takes to be believed.
     * Measured against a simulated player who really does improve by four
     * levels (see `progression/`):
     *
     *   memory   settled estimate   answers to track the jump   drift when steady
     *      200        8.30 / 0.36                        168                 0.38
     *      100        8.38 / 0.47                         67                 0.69
     *       50       10.18 / 4.40                          6                 5.09
     *       20       11.06 / 5.34                          1                 8.05
     *
     * True ability was 8. Below about a hundred the estimate stops being an
     * estimate — it settles two levels high with an sd of four, which is worse
     * than useless because the caution term then reads that width as a reason
     * to serve easier items. A hundred is the shortest memory that still
     * measures anything, and it is two and a half times more responsive than
     * two hundred.
     */
    forgetting: number;

    /**
     * The clock at which a deadline stops being a constraint.
     *
     * A fixed sixty seconds is the wrong anchor for anybody, and badly wrong for
     * a fast player: someone answering a two-premise item in three seconds is
     * charged nearly two levels for an eighteen-second limit they will never
     * come near. Half the difficulty budget then goes on a clock that changes
     * nothing, and the item itself never grows.
     *
     * `ProgressionService` replaces this per mode with what the player's own
     * answers say, so the axis measures time pressure rather than the presence
     * of a number.
     */
    referenceSeconds: number;
    /** Levels added per halving of the time limit. */
    perTimeHalving: number;
    /** Clock bounds when difficulty is being made up with time. */
    minSeconds: number;
    maxSeconds: number;

    /**
     * How strongly modes are assumed to move together, as a prior sd in levels.
     *
     * Small means being good at one mode says a lot about the next; large means
     * each is its own skill. This is the only number governing transfer *inside*
     * the app, and it should be conservative — a wrong confident prior costs
     * more trials than a wide one.
     */
    crossModeSd: number;
    /** Posterior widening per day since a mode was last played, in levels. */
    decayPerDay: number;
    /** How much of a wrong answer a timeout is worth, as evidence about ability. */
    timeoutWeight: number;
    /** Never widen past this; total ignorance is still bounded. */
    maxDecaySd: number;

    /**
     * Levels of difficulty per bit of width above a configuration's typical.
     *
     * Zero by default, which means *unpriced* rather than *free*: nothing in
     * this table is allowed to be a guess about a quantity nobody has measured.
     * `ProgressionService` replaces it with a fitted value once enough answered
     * items carry enough variation to fit against, and leaves it at zero until
     * then — so an item that came out wide is scored as wide only when there is
     * evidence for how much that is worth.
     */
    widthPerBit: number;
    /**
     * Levels per premise the conclusion did *not* need.
     *
     * The depth twin of `widthPerBit`, and zero for the same reason: unpriced,
     * not free. `weight * premises` already prices an item as though its answer
     * used all of them, so what is left to price is the *shortfall* — a
     * six-premise item whose conclusion needs four has two premises there to be
     * read and dismissed, and whether that makes it easier, harder or neither
     * is an empirical question rather than one to settle by argument.
     *
     * Expected to come out negative: a premise the answer does not need is one
     * fewer thing to compose. It is fitted rather than assumed because the
     * opposite is arguable — an irrelevant premise still has to be read, and
     * deciding it is irrelevant is work.
     */
    levelsPerUnneededPremise: number;
    /**
     * What showing the premises one at a time is worth, in levels.
     *
     * The third of these, and zero for the same reason as the other two. A
     * carousel is plainly harder than the whole arrangement on one card — you
     * have to hold what has scrolled past instead of re-reading it — but *how
     * much* harder is a number nobody has measured, and inventing one here
     * would silently rescale every ability estimate in the app against a guess.
     *
     * `gameModeOnAnswer` has been recorded on every answered item for exactly
     * this: the coefficient is meant to be fitted from those, the way
     * `RUNG_COST` was, and until it is this term is a no-op.
     */
    levelsPerCarousel: number;
}

export const DEFAULT_ABILITY: AbilityConfig = {
    minLevel: 1,
    maxLevel: 26,
    bins: 80,
    slope: 1.6,
    lapseRate: 0.03,
    /* ~100 answers. See the note on the field: 200 took 168 answers to notice a
     * four-level improvement, which is most of a month of play. */
    forgetting: 0.99,

    referenceSeconds: 60,
    perTimeHalving: 1.1,
    minSeconds: 8,
    maxSeconds: 180,

    caution: 0.9,
    cautionCap: 0.6,
    // Twenty answers anywhere. Below that the app genuinely does not know you.
    cautionCapAfter: 20,
    widthPerBit: 0,
    levelsPerUnneededPremise: 0,
    levelsPerCarousel: 0,
    crossModeSd: 2.5,
    /*
     * ~5 weeks from a settled estimate to knowing very little. The mean is
     * preserved throughout, so a returning player is served items at the same
     * difficulty and simply re-measured, rather than demoted.
     *
     * **Slowed from 0.2 because the modes transfer.** Fifteen days was priced
     * as though a mode not played were a skill not practised, and it is not:
     * with thirty-odd modes in rotation any one of them surfaces every few
     * days, while everything adjacent to it is being trained the whole time.
     * The app already believes this elsewhere — `crossModeSd` sets the prior
     * for an unplayed mode from the played ones, and `cautionCapAfter` counts
     * evidence across every mode rather than within one — so decaying each mode
     * as an island contradicted the two settings either side of it.
     *
     * The cost of it being too fast is not a wrong difficulty but a wandering
     * one: a posterior rewidened between visits is re-measured on arrival, so a
     * mode seen twice a week never converges and its items swing for reasons
     * the player cannot see.
     */
    decayPerDay: 0.07,
    /*
     * A timeout says much more about the clock than about the reasoning.
     *
     * Running out of time is not the same event as being wrong: the item may
     * have been on its way to a right answer, and the only thing certainly
     * established is that it needed longer than it got. Counted whole, a timed
     * session teaches the model that the player is *less able*, when what it
     * observed is that they are slower than the deadline being set — and the
     * correction for "less able" is a shorter item, which does not help
     * somebody who ran out of time.
     *
     * So a third of an answer's weight here, and the full observation goes to
     * the clock instead, where it belongs: `configForMode` feeds timeouts into
     * the reference time as the censored evidence they are.
     */
    timeoutWeight: 0.33,
    maxDecaySd: 3.0,
};

/** Everything about an item that bears on how hard it is. */
export interface ItemSpec {
    type: EnumQuestionType;
    premises: number;
    /** Claimed rungs, as a prefix of the mode's ladder. */
    rungs: string[];
    /** How far each counted lever is turned, priced by `DIALS`. */
    dials?: Record<string, number>;
    /** Deadline in seconds, or null for untimed. */
    seconds: number | null;
    /**
     * How the premises were shown: all at once, or one at a time.
     *
     * Absent when choosing a configuration — the display is the player's
     * setting, not something the ladder picks — and present when scoring, where
     * it is part of what the item actually was. Same standing as `widthDelta`.
     */
    carousel?: boolean;
    /**
     * Bits wider or narrower than typical for this configuration.
     *
     * Absent when choosing a configuration, because the layout has not been
     * drawn yet and there is nothing to know. Present when *scoring* one, which
     * is where it matters: the item that arrived was harder or easier than the
     * one that was asked for, and the answer should be read against what
     * actually turned up.
     */
    widthDelta?: number;
    /**
     * Relations the conclusion needed, where the mode measures it.
     *
     * Same standing as `widthDelta`: absent when choosing a configuration,
     * because the layout has not been drawn and the pair not yet picked;
     * present when scoring one, where the answer should be read against how
     * much of the item it actually took.
     */
    depth?: number;
}

/**
 * Premises the conclusion did not need, or zero where nobody measured.
 *
 * Depth 0 means *unmeasured*, and treating it as a conclusion that needed
 * nothing would price every unmeasured mode as the easiest thing in the app.
 * Absent, zero and "needed everything" all come out the same here, which is the
 * right way round: the term says nothing until something says something.
 */
export function unneededPremises(spec: { premises: number; depth?: number }): number {
    if (!spec.depth || !spec.premises) return 0;
    return Math.max(0, spec.premises - spec.depth);
}

/**
 * Which premise count describes the item: the one asked for, not the one shown.
 *
 * Wide premises merge two consecutive links into one sentence, so a seven-link
 * item prints about four. Pricing the printed count prices a different item —
 * and because the posterior and the next configuration both read the same
 * number, the error does not show up as a wrong answer. It settles at roughly
 * half true ability and serves items to match, quietly, for as long as it runs.
 *
 * Falls back to the printed count for items built before this was recorded,
 * which is what every reader used to do.
 */
export function pricedPremises(
    item: { builtPremises?: number; premises: unknown[] },
): number {
    return item.builtPremises || item.premises.length;
}

export function levelOf(spec: ItemSpec, config = DEFAULT_ABILITY): number {
    const weight = MODE_SCALE[spec.type]?.weight ?? 1;
    const structural = weight * spec.premises
        + spec.rungs.reduce((a, r) => a + (RUNG_COST[r] ?? 0.8), 0)
        + dialsCost(spec.dials);
    /*
     * Width, once it has been measured. Zero until then, and zero for every
     * mode that has no such quantity, so this is a no-op rather than a guess
     * wherever it has nothing to say.
     */
    const width = config.widthPerBit * (spec.widthDelta ?? 0);
    /*
     * Premises the conclusion did not need, once they have been priced.
     *
     * `structural` above charges for every premise, which assumes the answer
     * uses every premise. Where it does not, this is the correction — and it is
     * zero until the answered items say what it should be, so an unpriced model
     * behaves exactly as it did before this term existed.
     */
    const shortfall = config.levelsPerUnneededPremise * unneededPremises(spec);
    /*
     * And how it was shown. Seven premises read one at a time is not the same
     * item as seven premises on one card, which is the whole reason difficulty
     * cannot be a premise count.
     */
    const shown = spec.carousel ? config.levelsPerCarousel : 0;
    return structural + width + shortfall + shown + timeCost(spec.seconds, config);
}

/**
 * What a deadline is worth.
 *
 * Time belongs on the same scale as everything else, and putting it there is
 * what lets the two be traded: a mode that has run out of rungs can be made
 * harder by tightening the clock instead, and the difficulty number says the
 * same thing either way. The old ladder had to special-case this ordering
 * because the axes were incommensurable.
 */
/**
 * The longest "unhurried answer" a log may claim.
 *
 * Five minutes is what `session.utils` treats as the most one item can be worth
 * — past it the tab was open and nobody was reading. Bounding the reference the
 * same way keeps an idle log from making every deadline look impossible.
 */
export const MAX_REFERENCE_SECONDS = 300;

export function timeCost(seconds: number | null, config = DEFAULT_ABILITY): number {
    if (seconds == null || seconds <= 0) return 0;
    /*
     * Never negative. A limit more generous than the reference is not *easier*
     * than having no limit at all — it is simply not a constraint, and letting
     * it subtract difficulty would let a loose clock pay for a longer item.
     */
    return Math.max(0, config.perTimeHalving * Math.log2(config.referenceSeconds / seconds));
}

/** The deadline that contributes exactly `levels` of difficulty. */
export function secondsForCost(levels: number, config = DEFAULT_ABILITY): number {
    const raw = config.referenceSeconds / Math.pow(2, levels / config.perTimeHalving);
    return Math.min(config.maxSeconds, Math.max(config.minSeconds, Math.round(raw)));
}

/**
 * Chance of a correct answer with no knowledge at all.
 *
 * This is why the answer mode matters so much to how fast the estimate settles,
 * and it is the one quantity the old staircase ignored entirely: a true/false
 * item answered correctly is barely evidence, while a six-axis construction
 * answered correctly is decisive. Feeding the real guess rate into the
 * likelihood is what makes those two trials count differently.
 */
export function guessRateFor(answerMode: string, slots = 0, choices = 0, options = 3): number {
    if (answerMode === "choice") return choices > 0 ? 1 / choices : 0.25;
    // Options per slot are no longer always three: a mode that asks for a rank
    // offers one per candidate, and crediting it at a third would understate
    // how decisive a correct answer is by orders of magnitude.
    if (answerMode === "construct") {
        return slots > 0 ? Math.pow(1 / Math.max(2, options), slots) : 0.05;
    }
    /*
     * An ordered pick of `slots` nodes out of `options`, without repeats — so
     * the denominator falls as the picks are made. Treating it as `options`
     * choices per slot would credit a correct match at rather less than it is
     * worth, and treating it as a single choice at rather more.
     */
    if (answerMode === "map") {
        if (slots <= 0 || options <= 1) return 0.25;
        let ways = 1;
        for (let i = 0; i < slots; i++) ways *= Math.max(1, options - i);
        return 1 / ways;
    }
    return 0.5;
}

/* ------------------------------------------------------------------ *
 * Posterior over ability                                              *
 * ------------------------------------------------------------------ */

export interface AbilityState {
    /** Log-posterior over the ability grid, unnormalised. */
    logPost: number[];
    trials: number;
    /** Epoch ms of the last update, for decay. */
    lastSeen: number;
}

function erf(x: number) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t
        - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
}
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Spacing between grid points, which stays fixed however far the grid runs. */
export function levelStep(config = DEFAULT_ABILITY): number {
    return (config.maxLevel - config.minLevel) / (config.bins - 1);
}

/**
 * The ability grid, as far as this posterior actually runs.
 *
 * `maxLevel` used to be the end of it, which made 26 a ceiling on what anybody
 * could be measured at: a player past it had their posterior pile up in the top
 * bin and could not be estimated any higher, so no configuration was ever
 * chosen for where they were. That is a limit of the machinery reading as a
 * claim about the player, and it contradicts the rule the ladder work is built
 * on — comfortable at any level means advance.
 *
 * The grid grows instead, and the array's own length is how far it has grown.
 * Nothing is stored for it: the spacing and the floor are fixed, so extending
 * only ever *appends* points and an old posterior is a prefix of a longer one.
 */
export function abilityGrid(config = DEFAULT_ABILITY, bins = config.bins): number[] {
    const step = levelStep(config);
    return Array.from({ length: Math.max(2, bins) }, (_, i) => config.minLevel + step * i);
}

/**
 * How close the mean may come to the top before the grid is extended.
 *
 * Two slopes, which is where the psychometric function still has room to
 * distinguish one level from another. Closer than that and the posterior is
 * being shaped by the edge rather than by the answers.
 */
const HEADROOM_SLOPES = 2;

/** Points added each time, enough that it is not extended every other answer. */
const EXTEND_SLOPES = 4;

/**
 * A guard on array size, not on ability.
 *
 * Six hundred points is past level one hundred and eighty at the default
 * spacing, which no mode can state and no configuration can reach — it is here
 * so a fault that made every answer look correct grows an array rather than
 * forever.
 */
const MAX_BINS = 600;

/**
 * Extend the grid if the estimate has come near its top.
 *
 * Padded with the last log-density rather than with zero. The tail is where the
 * mass piled up while the grid was too short, and continuing it flat says "at
 * least this good, and no idea how much better" — which is what is actually
 * known. A zero tail would assert the opposite.
 */
/**
 * A posterior's density at a grid point, past its own top as well.
 *
 * Grids grow per posterior now, so two of them need not be the same length —
 * and anything combining them indexes past the end of the shorter one. A
 * shorter posterior says nothing above its top, so its last value continues,
 * which is the same statement `growGrid` makes when it extends one.
 *
 * Reading `undefined` instead put a NaN into the arithmetic, and a NaN estimate
 * makes every comparison in `chooseConfig` false — so the mode fell back to its
 * very first candidate, which is the minimum. A strong player's mode collapsed
 * to two premises and no clock.
 */
export function densityAt(logPost: number[], i: number): number {
    return logPost[Math.min(i, logPost.length - 1)];
}

export function growGrid(state: AbilityState, config = DEFAULT_ABILITY): AbilityState {
    const step = levelStep(config);
    let logPost = state.logPost;

    for (let guard = 0; guard < 16; guard++) {
        const bins = logPost.length;
        if (bins >= MAX_BINS) break;
        const top = config.minLevel + step * (bins - 1);
        const { level } = abilityEstimate({ ...state, logPost }, config);
        if (level < top - HEADROOM_SLOPES * config.slope) break;

        const add = Math.min(MAX_BINS - bins, Math.ceil(EXTEND_SLOPES * config.slope / step));
        const tail = densityAt(logPost, bins - 1);
        logPost = logPost.concat(new Array(add).fill(tail));
    }

    return logPost === state.logPost ? state : { ...state, logPost };
}

/** P(correct) for an item of `level` if true ability were `theta`. */
export function pCorrect(config: AbilityConfig, theta: number, level: number, guess: number) {
    const z = (theta - level) / config.slope;
    return guess + (1 - guess - config.lapseRate) * Phi(z);
}

export function initAbility(
    priorMean: number,
    priorSd = 4,
    config = DEFAULT_ABILITY,
    now = Date.now(),
): AbilityState {
    /*
     * Wide enough for the prior it was given. A returning player whose
     * aggregate is already past the initial grid would otherwise start a new
     * mode with a posterior centred outside its own grid.
     */
    const step = levelStep(config);
    const wanted = Math.ceil(
        (priorMean + HEADROOM_SLOPES * config.slope + 2 * priorSd - config.minLevel) / step) + 1;
    const logPost = abilityGrid(config, Math.max(config.bins, wanted)).map(theta => {
        const z = (theta - priorMean) / priorSd;
        return -0.5 * z * z;
    });
    return { logPost, trials: 0, lastSeen: now };
}

function normalise(logPost: number[]) {
    const max = Math.max(...logPost);
    const w = logPost.map(v => Math.exp(v - max));
    const sum = w.reduce((a, b) => a + b, 0);
    return w.map(v => v / sum);
}

/** One answered item. `guess` is the item's own guess rate, not the mode's. */
export function abilityUpdate(
    state: AbilityState,
    level: number,
    guess: number,
    correct: boolean,
    config = DEFAULT_ABILITY,
    now = Date.now(),
    /**
     * How much of an observation this is. One is an answer; less is a partial.
     *
     * Applied as a power on the likelihood, which is the standard way to take
     * an observation less than whole and is still a proper update — it widens
     * the posterior towards the prior rather than shifting it somewhere a
     * different rule would put it. Fudging the level or the guess rate instead
     * would move the *mean*, which is the opposite of the intent: a partial
     * observation should say less, not say something else.
     */
    weight = 1,
): AbilityState {
    const thetas = abilityGrid(config, state.logPost.length);
    const logPost = state.logPost.map((lp, i) => {
        const p = pCorrect(config, thetas[i], level, guess);
        const like = correct ? p : 1 - p;
        return lp * config.forgetting + weight * Math.log(Math.max(1e-12, like));
    });
    const max = Math.max(...logPost);
    /*
     * Grown after the update rather than before, so the answer that pushed the
     * estimate to the edge is the one that buys the room. Almost always a no-op.
     */
    return growGrid({
        logPost: logPost.map(v => v - max),
        trials: state.trials + 1,
        lastSeen: now,
    }, config);
}

export interface AbilityEstimate {
    /** Posterior mean ability, in linear-equivalent premises. */
    level: number;
    sd: number;
    ci: [number, number];
    trials: number;
}

export function abilityEstimate(
    state: AbilityState,
    config = DEFAULT_ABILITY,
    mass = 0.9,
): AbilityEstimate {
    const thetas = abilityGrid(config, state.logPost.length);
    const w = normalise(state.logPost);

    const mean = thetas.reduce((a, t, i) => a + t * w[i], 0);
    const varr = thetas.reduce((a, t, i) => a + w[i] * (t - mean) ** 2, 0);

    const tail = (1 - mass) / 2;
    let cum = 0, lo = thetas[0], hi = thetas[thetas.length - 1];
    for (let i = 0; i < thetas.length; i++) {
        const prev = cum;
        cum += w[i];
        if (prev < tail && cum >= tail) lo = thetas[i];
        if (prev < 1 - tail && cum >= 1 - tail) { hi = thetas[i]; break; }
    }

    return { level: mean, sd: Math.sqrt(varr), ci: [lo, hi], trials: state.trials };
}

/**
 * Widen the posterior to admit the estimate may have gone stale.
 *
 * This is the whole of skill decay. Nothing is taken away and no rung is
 * un-claimed — the estimate simply becomes less certain, which makes selection
 * fall back toward easier items and makes the next few answers count for more.
 * A player returning after a month is re-measured rather than demoted, which is
 * both kinder and more accurate.
 */
export function abilityDecay(
    state: AbilityState,
    config = DEFAULT_ABILITY,
    now = Date.now(),
): AbilityState {
    const days = Math.max(0, (now - state.lastSeen) / 86_400_000);
    const sd = Math.min(config.maxDecaySd, days * config.decayPerDay);
    if (sd < 0.05) return state;

    const thetas = abilityGrid(config, state.logPost.length);
    const step = thetas[1] - thetas[0];
    const radius = Math.max(1, Math.ceil(3 * sd / step));
    const w = normalise(state.logPost);

    const out = thetas.map((_, i) => {
        let acc = 0;
        for (let d = -radius; d <= radius; d++) {
            const j = i + d;
            if (j < 0 || j >= thetas.length) continue;
            const z = (d * step) / sd;
            acc += w[j] * Math.exp(-0.5 * z * z);
        }
        return Math.log(Math.max(1e-12, acc));
    });

    const max = Math.max(...out);
    // lastSeen is not advanced: decay is applied on read, and re-reading without
    // playing must not compound it.
    return { logPost: out.map(v => v - max), trials: state.trials, lastSeen: state.lastSeen };
}

/* ------------------------------------------------------------------ *
 * Aggregate — the skill number, and the prior for unplayed modes      *
 * ------------------------------------------------------------------ */

export interface Aggregate {
    /** Precision-weighted mean ability across modes, in levels. */
    level: number;
    /** What the player is shown. */
    points: number;
    /** Modes with any evidence at all. */
    modes: number;
    trials: number;
}

/**
 * Combine per-mode posteriors into one number.
 *
 * Weighted by precision, so a mode answered three times contributes far less
 * than one answered three hundred. A plain mean would let a single unlucky trial
 * in an untouched mode drag the headline number around, which is exactly the
 * complaint about the old score in the opposite direction.
 */
export function aggregate(
    states: Array<{ state: AbilityState; type: EnumQuestionType }>,
    config = DEFAULT_ABILITY,
    now = Date.now(),
): Aggregate {
    let wsum = 0, acc = 0, trials = 0, modes = 0;

    for (const { state } of states) {
        if (!state.trials) continue;
        const est = abilityEstimate(abilityDecay(state, config, now), config);
        const precision = 1 / Math.max(0.25, est.sd * est.sd);
        acc += est.level * precision;
        wsum += precision;
        trials += est.trials;
        modes++;
    }

    const level = wsum > 0 ? acc / wsum : config.minLevel;
    return { level, points: Math.round(level * 100), modes, trials };
}

/**
 * Prior for a mode with no evidence of its own.
 *
 * Centred on the aggregate rather than on the floor, which is the cold-start
 * fix: someone who has earned twelve rungs elsewhere should not be handed
 * two-premise items in a mode they have simply not met yet. `crossModeSd` is how
 * much that generalisation is trusted, and it is deliberately wide.
 */
export function priorForNewMode(
    agg: Aggregate,
    config = DEFAULT_ABILITY,
    now = Date.now(),
): AbilityState {
    const sd = agg.modes > 0 ? config.crossModeSd : 6;
    return initAbility(agg.level, sd, config, now);
}

/* ------------------------------------------------------------------ *
 * Choosing the next item                                              *
 * ------------------------------------------------------------------ */

export interface ConfigChoice {
    premises: number;
    rungs: number;
    /**
     * How far each counted lever is turned.
     *
     * Separate from `rungs` because they are a different kind of thing: a gate
     * opens and a dial counts. A gate's order encodes a teaching sequence, so it
     * stays a prefix; a dial has no ceiling in the model and can be turned
     * without its neighbours — which is the whole point, since a player weak at
     * one lever could not previously be given the others without it.
     */
    dials: Record<string, number>;
    seconds: number | null;
    level: number;
}

export interface ChooseOptions {
    minPremises: number;
    maxPremises: number;
    /** The mode's ladder, in order; rungs are always a prefix of it. */
    ladder: string[];
    /** Difficulty aimed at, in levels. */
    target: number;
    /** Past this many premises, length may only rise if rungs are exhausted. */
    structureBefore: number;
    /** Leave the clock off entirely. */
    untimed?: boolean;
    /** The counted levers this mode has, from `dialsFor`. */
    dials?: string[];
}

/**
 * Pick the configuration closest to a target difficulty.
 *
 * Ordering matters and is the point of the whole rework: among configurations of
 * *equal* difficulty, the one with more rungs and fewer premises is preferred.
 * The old ladder tried to express this by moving along a fixed axis order —
 * clock, then rungs, then length — which meant length was always available as a
 * last resort even when it was the wrong thing to add. Here length and structure
 * are commensurable, so "prefer structure" becomes a tie-break rather than a
 * special case, and a mode that has run out of rungs tightens the clock instead
 * of growing.
 */
export function chooseConfig(
    type: EnumQuestionType,
    opts: ChooseOptions,
    config = DEFAULT_ABILITY,
): ConfigChoice {
    const scale = MODE_SCALE[type];
    const weight = scale?.weight ?? 1;

    let best: ConfigChoice | null = null;

    /*
     * The last position worth claiming.
     *
     * Tombstones cost nothing, so a ladder ending in them can never reach its
     * own length — and "length may not stand in for structure while structure
     * remains" was reading the raw length, which left two modes refusing to add
     * a premise on the strength of structure that had been retired.
     */
    const claimable = opts.ladder.reduce(
        (last, r, i) => ((RUNG_COST[r] ?? 0.8) > 0 ? i + 1 : last), 0);

    for (let rungs = 0; rungs <= opts.ladder.length; rungs++) {
        /*
         * A prefix never ends on a tombstone.
         *
         * Retired entries hold their slot and cost nothing, so claiming one adds
         * no difficulty — and `better` prefers more rungs, which made a free
         * rung strictly better than not having it. A new player was handed the
         * whole of `Transformation`'s ladder before answering anything, because
         * every entry on it had become free.
         *
         * Skipping those counts does not skip the entries: a prefix reaching
         * past them still contains them, which is what holding the slot is for.
         */
        if (rungs > 0 && (RUNG_COST[opts.ladder[rungs - 1]] ?? 0.8) === 0) continue;

        const claimed = opts.ladder.slice(0, rungs);
        const rungCost = claimed.reduce((a, r) => a + (RUNG_COST[r] ?? 0.8), 0);
        const floor = Math.max(opts.minPremises, premisesNeededFor(claimed));

        /*
         * The cap applies to length this selection *chose* to add.
         *
         * A few modes cannot be stated in five premises — Oddest Relation needs
         * six to have an odd one out — and comparing against the bare cap threw
         * away every rung-free candidate for them, so a player who had answered
         * nothing was handed a modifier on their first item because it was the
         * only configuration left. Below its own floor a mode is not standing
         * length in for structure; it is just being itself.
         */
        const lengthCap = Math.max(opts.structureBefore, floor);

        for (let p = floor; p <= opts.maxPremises; p++) {
            // Length may not stand in for structure past the cap unless there is
            // no structure left to add.
            if (p > lengthCap && rungs < claimable) continue;

            const gates = weight * p + rungCost;

            /*
             * Dials before the clock, because they are structure and the clock
             * is not. Allocated to whatever the gates left of the target, then
             * trimmed to what this many premises can actually carry — an
             * operation that needs four premises to mean anything does not stop
             * needing them at the third turn of the dial.
             */
            const dials = capDials(
                allocateDials(opts.dials ?? [], Math.max(0, opts.target - gates)), p);
            const structural = gates + dialsCost(dials);
            const gap = opts.target - structural;

            // The clock can only add difficulty, never remove it, so a
            // configuration already past the target is judged as it stands.
            const seconds = opts.untimed || gap <= 0 ? null : secondsForCost(gap, config);
            const level = structural + timeCost(seconds, config);

            const candidate: ConfigChoice = { premises: p, rungs, dials, seconds, level };
            if (!best || better(candidate, best, opts.target)) best = candidate;
        }
    }

    return best ?? { premises: opts.minPremises, rungs: 0, dials: {}, seconds: null, level: 0 };
}

/** Difficulties this close are treated as equal, letting the preference decide. */
const TOLERANCE = 0.5;

function better(a: ConfigChoice, b: ConfigChoice, target: number) {
    const da = Math.abs(a.level - target);
    const db = Math.abs(b.level - target);
    /*
     * Half a linear premise is below what anyone could feel — the psychometric
     * slope is 1.6 levels, so it moves the chance of success by a couple of
     * points. Matching the target exactly is worth less than choosing the right
     * *kind* of difficulty, so anything inside the band is a tie and the
     * preference decides. A tighter band silently reinstates the old behaviour:
     * an exact match by clock pressure beats a near match with real structure.
     */
    if (Math.abs(da - db) > TOLERANCE) return da < db;
    // Structure is gates opened plus dials turned: both are the item being a
    // different shape, where length and the clock are the same item stretched.
    const sa = a.rungs + dialSteps(a.dials);
    const sb = b.rungs + dialSteps(b.dials);
    if (sa !== sb) return sa > sb;
    /*
     * Equal rungs: take the closer to target, not the shorter.
     *
     * "Fewer premises" is here to stop length standing in for structure, and
     * between candidates with the *same* rungs there is no structure to prefer
     * — one is simply easier. A mode with an empty or exhausted ladder has
     * length as its only axis, so the rule fired on every choice it ever made
     * and always picked the easier of two options inside the tolerance band.
     *
     * Infer the Relation is the case that showed it: a player measured at 15.5
     * was served six premises where seven was nearer the target, answered 95%
     * of them correctly, and could not be stretched further because the
     * selection preferred the shorter item every time. The band is half a
     * level, so this was worth up to half a level of permanent handicap on
     * every mode with no rungs.
     */
    if (da !== db) return da < db;
    return a.premises < b.premises;
}

/**
 * Difficulty to aim at for a wanted success rate.
 *
 * Below ability for training, at it for measurement. The two want different
 * things and the old system conflated them: a staircase converging on 80% is
 * placing items where learning happens, one converging on threshold is placing
 * them where the estimate sharpens fastest.
 */
/**
 * How far below the mean to aim, given how unsure the estimate is.
 *
 * Was `caution * sd` at every call site, which is where the width-becomes-
 * demotion fault lived. One function so the bound cannot be forgotten by a
 * caller that reimplements the multiply.
 */
/**
 * The guess rate a configuration will actually serve.
 *
 * The aim was computed at a flat 0.5 — the easiest rate any mode can serve —
 * because the answer mode is not known until the item is built. But it *is*
 * known: the answer mode is a rung, so the chosen configuration already
 * determines it. Measured at a player level of 10 aiming for 80%, the flat 0.5
 * delivered 0.838 on a true/false item and 0.698 on a six-axis construction —
 * a fourteen-point spread, with the mode whose whole purpose is removing the
 * guess floor served hardest of all.
 *
 * `slots` is unknown here — it depends on the item's axis count, which the
 * generator picks — so a construction is priced at the shallow end. Being
 * approximately right about the answer mode beats being exactly right about
 * a rate the item never had.
 */
export function guessRateForRungs(claimed: string[]): number {
    if (claimed.includes("construct-conclusion")) return guessRateFor("construct", 3);
    if (claimed.includes("choose-conclusion")) return guessRateFor("choice", 0, 4);
    return 0.5;
}

export function cautionPenalty(
    sd: number,
    config = DEFAULT_ABILITY,
    /** Answers this account has given anywhere. Not this mode's — see below. */
    evidence = Infinity,
): number {
    const full = config.caution * Math.max(0, sd);
    /*
     * The cap arrives as evidence does.
     *
     * Uncapped caution is right for a player the app has never seen: their
     * posterior is wide because *nothing is known*, and handing them a
     * mid-range item on that basis is the thing caution was written to stop.
     * Capped is right for everyone else, where the width comes from a prior,
     * from time away, or from a run of answers too easy to be informative —
     * none of which is a reason to serve below a mean nothing has contradicted.
     *
     * Counted across every mode, not this one. A player with six hundred
     * answers opening a mode they have never played is not an unknown player,
     * and treating them as one is exactly the fault this bounds.
     */
    const t = Math.min(1, evidence / config.cautionCapAfter);
    return Math.min(full, full * (1 - t) + config.cautionCap * t);
}

export function targetLevel(
    est: AbilityEstimate,
    targetP: number,
    guess: number,
    config = DEFAULT_ABILITY,
): number {
    const span = 1 - guess - config.lapseRate;
    const q = (targetP - guess) / span;
    if (!(q > 0 && q < 1)) return est.level;
    return est.level - config.slope * probit(q);
}

function probit(p: number) {
    let lo = -8, hi = 8;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (Phi(mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}


/* ------------------------------------------------------------------ *
 * Fitting the rung costs                                              *
 * ------------------------------------------------------------------ */

/**
 * One answered item, as much of it as a fit needs.
 *
 * `estimate` is the ability the item was *chosen* under, not the posterior
 * afterwards — using the updated one would be scoring the model against a
 * belief that had already seen the answer.
 */
export interface Trial {
    type: EnumQuestionType;
    premises: number;
    rungs: string[];
    /** How far each counted lever was turned, priced by `DIALS`. */
    dials?: Record<string, number>;
    seconds: number | null;
    estimate: number;
    guess: number;
    correct: boolean;
    /** How long the answer took, for calibrating the clock to this player. */
    answerSeconds?: number;
    /**
     * The clock ran out, rather than an answer being given and being wrong.
     *
     * Kept apart because the two are different evidence and want to be read
     * differently: a wrong answer is about the reasoning, a timeout is mostly
     * about the pace. Inferring it later from `correct` and the deadline nearly
     * works and is exactly the kind of nearly that goes wrong on the day
     * somebody answers on the final tick.
     */
    timedOut?: boolean;
    /** Bits wider or narrower than typical for the configuration, or 0. */
    widthDelta?: number;
    /**
     * How much had to be held at once, and how much one premise joined.
     *
     * Logged so the coefficients can be fitted rather than guessed; nothing
     * reads them for difficulty yet. `arity` says what the premise form
     * allowed, `integration` how much of that was joining structures already
     * held rather than introducing names, and `openGroups` how many part-built
     * structures were carried at the peak.
     */
    arity?: number;
    integration?: number;
    openGroups?: number;
    /**
     * Relations the conclusion needed, or 0 where the mode does not measure it.
     *
     * Logged only. Nothing reads it for difficulty, and the reason it is here
     * is that the claim it would settle — that conclusion depth is unrelated to
     * premise count — cannot be settled from items nobody recorded.
     */
    depth?: number;
}

/**
 * What answered items say about conclusion depth, per mode.
 *
 * The claim this exists to settle is the author's own: *"conclusion depth is
 * often unrelated to the premise depth of logic"*. It was made from
 * screenshots, which is the only evidence available when nothing measures it,
 * and screenshots cannot say whether a shallow item was typical or unlucky.
 *
 * `share` is the answer in one number — how much of the premise set a
 * conclusion needed, averaged. One means the whole thing. `worst` is the
 * shallowest item actually served, and it is the one worth looking at: a floor
 * is a promise about the minimum, so a good mean with a bad minimum means the
 * floor is not holding.
 */
export interface DepthReport {
    type: EnumQuestionType;
    /** Answers with a measured depth. Modes that do not measure it are absent. */
    trials: number;
    meanPremises: number;
    meanDepth: number;
    /** Mean of depth ÷ premises. Not meanDepth ÷ meanPremises — see below. */
    share: number;
    /** The smallest share seen, which is what a floor is a claim about. */
    worst: number;
}

/**
 * Per-mode depth against premise count.
 *
 * Depth 0 means *not measured*, not *shallow*, so those trials are dropped
 * rather than averaged in — counting them would report every unmeasured mode as
 * maximally broken and bury the ones that are.
 *
 * The share is averaged per item rather than taken between the two means. The
 * two differ whenever premise counts vary within a mode, which they always do,
 * and only the per-item version answers "what fraction of a typical item does
 * its conclusion need" — the other answers a question about aggregates that
 * nobody asked.
 */
export function depthReport(trials: Trial[]): DepthReport[] {
    const byType = new Map<EnumQuestionType, Trial[]>();
    for (const t of trials) {
        if (!t.depth || !t.premises) continue;
        if (!byType.has(t.type)) byType.set(t.type, []);
        byType.get(t.type)!.push(t);
    }

    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    return [...byType.entries()]
        .map(([type, ts]) => {
            const shares = ts.map(t => t.depth! / t.premises);
            return {
                type,
                trials: ts.length,
                meanPremises: mean(ts.map(t => t.premises)),
                meanDepth: mean(ts.map(t => t.depth!)),
                share: mean(shares),
                worst: Math.min(...shares),
            };
        })
        .sort((a, b) => a.share - b.share);
}

export interface RungFit {
    rung: string;
    /** What the table says now. */
    current: number;
    /** What these trials say it should be. */
    fitted: number;
    trials: number;
    /** Observed minus predicted accuracy, before refitting. */
    residual: number;
}

/**
 * What the answered items say each rung is worth.
 *
 * `RUNG_COST` is a hand-written table, and it is wrong in detail — the comment
 * on it says so. The fix is not to argue about the numbers but to measure them,
 * and the measurement is simple once the trials are logged: a rung whose items
 * are answered *better* than the model predicted is one the model is charging
 * too much for.
 *
 * Fitted by bisection on the cost rather than by differentiating the
 * psychometric function. Slower and completely uninteresting, which is the
 * point: there is no derivative to get wrong, and the objective — make mean
 * predicted accuracy equal mean observed — is the thing actually wanted rather
 * than a proxy for it.
 *
 * **Deliberately not applied automatically.** A fit from forty trials is worse
 * than the guess it would replace, so this reports the numbers and their sample
 * sizes and leaves the table alone. `minTrials` is the honesty threshold, not a
 * performance one.
 */
export function fitRungCosts(
    trials: Trial[],
    config = DEFAULT_ABILITY,
    minTrials = 60,
): RungFit[] {
    const byRung = new Map<string, Trial[]>();
    for (const t of trials) {
        for (const r of t.rungs) {
            if (!byRung.has(r)) byRung.set(r, []);
            byRung.get(r)!.push(t);
        }
    }

    const out: RungFit[] = [];

    for (const [rung, ts] of byRung) {
        if (ts.length < minTrials) continue;

        const observed = ts.filter(t => t.correct).length / ts.length;

        /** Mean predicted accuracy if this rung cost `cost`. */
        const predictedAt = (cost: number) => {
            const table = { ...RUNG_COST, [rung]: cost };
            let total = 0;
            for (const t of ts) {
                total += pCorrect(config, t.estimate, levelWith(t, table, config), t.guess);
            }
            return total / ts.length;
        };

        const current = RUNG_COST[rung] ?? 0.8;
        const residual = observed - predictedAt(current);

        /*
         * Bracket wide, then halve. Cost and predicted accuracy move in
         * opposite directions — a dearer rung means a harder item means fewer
         * right — so the bisection tests that ordering rather than assuming it.
         */
        let lo = 0, hi = 6;
        if (predictedAt(lo) < observed) { out.push({ rung, current, fitted: lo, trials: ts.length, residual }); continue; }
        if (predictedAt(hi) > observed) { out.push({ rung, current, fitted: hi, trials: ts.length, residual }); continue; }

        for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2;
            if (predictedAt(mid) > observed) lo = mid; else hi = mid;
        }

        out.push({ rung, current, fitted: (lo + hi) / 2, trials: ts.length, residual });
    }

    return out.sort((a, b) => Math.abs(b.fitted - b.current) - Math.abs(a.fitted - a.current));
}

/** `levelOf` against a substituted cost table. */
function levelWith(t: Trial, table: Record<string, number>, config: AbilityConfig): number {
    const scale = MODE_SCALE[t.type];
    const weight = scale?.weight ?? 1;
    const rungCost = t.rungs.reduce((a, r) => a + (table[r] ?? 0.8), 0);
    return weight * t.premises + rungCost + timeCost(t.seconds, config);
}

export interface WidthFit {
    /** Levels of difficulty per bit of extra width. */
    levelsPerBit: number;
    trials: number;
    /** Spread of `widthDelta` in the sample; the fit is only as good as this. */
    sd: number;
}

/**
 * What a bit of extra width is worth, in levels.
 *
 * The last number in the difficulty model with no basis. Premises, rungs and
 * the clock all convert to levels through values that are at least written
 * down; width has never converted at all, so an item drawn wide has been scored
 * as though it were typical.
 *
 * **Not fitted the way the rung costs are**, and the difference is the point.
 * That fit matches mean predicted accuracy to mean observed, which identifies a
 * rung's cost because every item in its subsample carries it — raise the cost
 * and every prediction falls. Width is a *signed* quantity averaging zero, so
 * raising the coefficient makes the wide items harder and the narrow ones
 * easier and the mean barely moves: the objective is flat in the parameter and
 * the answer comes back pinned to whichever bracket bound it drifted into.
 *
 * Maximum likelihood instead, which uses the association between width and
 * outcome rather than the average of either. Coarse grid then local refinement,
 * because the likelihood is smooth and unimodal here and anything cleverer
 * would be harder to check than to run.
 *
 * Reported rather than applied, like the rung costs.
 *
 * **Returns null when the sample has no spread to learn from**, which is the
 * common case and the honest answer. With the dial at its default every item is
 * drawn at the median, so `widthDelta` is ~0 throughout and any coefficient
 * fits equally well. A number produced from that would be noise wearing a
 * decimal point.
 */
export function fitWidthCoefficient(
    trials: Trial[],
    config = DEFAULT_ABILITY,
    minTrials = 80,
    minSd = 0.25,
): WidthFit | null {
    const usable = trials.filter(t => typeof t.widthDelta === "number");
    if (usable.length < minTrials) return null;

    const deltas = usable.map(t => t.widthDelta!);
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sd = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length);
    if (sd < minSd) return null;

    const base = usable.map(t => levelOf(
        { type: t.type, premises: t.premises, rungs: t.rungs, seconds: t.seconds }, config));

    const logLikelihood = (k: number) => {
        let total = 0;
        for (let i = 0; i < usable.length; i++) {
            const t = usable[i];
            const p = pCorrect(config, t.estimate, base[i] + k * t.widthDelta!, t.guess);
            // Clamped so a confident miss costs a large number rather than
            // negative infinity, which would make the search discontinuous.
            const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
            total += t.correct ? Math.log(q) : Math.log(1 - q);
        }
        return total;
    };

    let best = -4, bestScore = -Infinity;
    for (let k = -4; k <= 8; k += 0.05) {
        const score = logLikelihood(k);
        if (score > bestScore) { bestScore = score; best = k; }
    }

    // Refine inside the winning cell.
    for (let step = 0.025; step > 0.001; step /= 2) {
        for (const k of [best - step, best + step]) {
            const score = logLikelihood(k);
            if (score > bestScore) { bestScore = score; best = k; }
        }
    }

    return { levelsPerBit: best, trials: usable.length, sd };
}

export interface DepthFit {
    /** Levels per premise the conclusion did not need. Expected negative. */
    levelsPerPremise: number;
    trials: number;
    /** Spread of the shortfall in the sample; the fit is only as good as this. */
    sd: number;
}

/**
 * What a premise the answer did not need is worth, from the answers.
 *
 * The same search as `fitWidthCoefficient` against the same likelihood, and it
 * returns null for the same honest reason: **a sample with no spread cannot
 * say.** Once the floors are in, most items sit at or near full depth, so the
 * shortfall is ~0 throughout and every coefficient fits equally well. A number
 * from that would be noise wearing a decimal point.
 *
 * The spread it needs comes from the modes that legitimately cannot reach full
 * depth — Fredo used to be the extreme case and is gone; Canyon's chain, drawn
 * from the top two bands, still varies by one. Turning the deep conclusions off
 * produces a great deal of it, which makes the switch a way to *measure* the
 * thing it turns off.
 *
 * The search runs downward as well as up, because the expected answer is
 * negative — a premise the conclusion does not need is one fewer thing to
 * compose — and a range that could only return zero or more would confirm the
 * expectation by construction.
 */
export function fitDepthCoefficient(
    trials: Trial[],
    config = DEFAULT_ABILITY,
    minTrials = 80,
    minSd = 0.5,
): DepthFit | null {
    const usable = trials.filter(t => !!t.depth && !!t.premises);
    if (usable.length < minTrials) return null;

    const shortfalls = usable.map(t => unneededPremises(t));
    const mean = shortfalls.reduce((a, b) => a + b, 0) / shortfalls.length;
    const sd = Math.sqrt(
        shortfalls.reduce((a, b) => a + (b - mean) ** 2, 0) / shortfalls.length);
    if (sd < minSd) return null;

    const base = usable.map(t => levelOf(
        { type: t.type, premises: t.premises, rungs: t.rungs, seconds: t.seconds,
          widthDelta: t.widthDelta }, config));

    const logLikelihood = (k: number) => {
        let total = 0;
        for (let i = 0; i < usable.length; i++) {
            const t = usable[i];
            const p = pCorrect(config, t.estimate, base[i] + k * shortfalls[i], t.guess);
            const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
            total += t.correct ? Math.log(q) : Math.log(1 - q);
        }
        return total;
    };

    let best = -3, bestScore = -Infinity;
    for (let k = -3; k <= 3; k += 0.05) {
        const score = logLikelihood(k);
        if (score > bestScore) { bestScore = score; best = k; }
    }
    for (let step = 0.025; step > 0.001; step /= 2) {
        for (const k of [best - step, best + step]) {
            const score = logLikelihood(k);
            if (score > bestScore) { bestScore = score; best = k; }
        }
    }

    return { levelsPerPremise: best, trials: usable.length, sd };
}

/**
 * The deadline at which this player stops being under time pressure.
 *
 * Taken from what they actually do: a high quantile of their recent answer
 * times, with headroom. Below it a clock bites; at or above it there is nothing
 * to feel, whatever the number says.
 *
 * Falls back to the configured default until there is enough evidence, and
 * never returns something so tight that the scale would price every deadline as
 * enormous — a player having one very fast run should not make the next
 * ordinary answer count as a crisis.
 */
export function referenceSecondsFrom(
    times: number[],
    fallback: number,
    minSamples = 8,
    ceiling = MAX_REFERENCE_SECONDS,
): number {
    const usable = times.filter(t => Number.isFinite(t) && t > 0).sort((a, b) => a - b);
    if (usable.length < minSamples) return fallback;

    const at = (q: number) => usable[Math.min(usable.length - 1, Math.floor(q * usable.length))];
    // Comfortably above their slower answers, so an unhurried item is unhurried.
    const unhurried = at(0.85) * 1.6;

    /*
     * A **lower** bound, which is all the guard above was ever meant to be.
     *
     * It read `Math.min(fallback, unhurried)`, so the reference could fall below
     * the default but never rise above it — and the justification written beside
     * it is entirely about the low side: "a player having one very fast run
     * should not make the next ordinary answer count as a crisis". Nothing
     * argued for the ceiling; it came along with the clamp.
     *
     * The cost of that, measured on a real account: 215 untimed answers with a
     * median of 37s and an 85th percentile of 96s, so their own unhurried
     * reference is about 153 seconds — and it was being held at 60. A 44-second
     * deadline was therefore priced at 0.6 levels instead of 2.0, and every
     * timed item was that much harder than the model thought it was.
     *
     * It showed up exactly where you would predict. **Untimed residual +0.006**
     * — the model is as calibrated as it gets when there is no clock. **Timed
     * residual −0.297**: they answered 55% of items the model gave them an 80%
     * chance on. Same player, same modes, same week; on 25 August, both, either
     * side of switching the timer on.
     *
     * Restoring the reference to what their answers say closes most of it: the
     * timed residual goes to −0.146, and to −0.079 over the items that were
     * actually answered rather than timed out.
     *
     * The upper bound is still there, because a log full of tabs left open
     * would otherwise drag the reference up with it. Five minutes is the same
     * line `session.utils` draws for time on task, and for the same reason: past
     * it, an item was not being worked on.
     */
    return Math.max(6, Math.min(ceiling, unhurried));
}