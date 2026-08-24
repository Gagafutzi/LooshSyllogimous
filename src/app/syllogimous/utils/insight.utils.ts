/**
 * What the app already knows about you, said out loud — and acted on.
 *
 * This app measures a great deal and has never told anybody any of it. There is
 * an ability estimate per mode with an uncertainty attached, a fatigue signal
 * that is difficulty-adjusted, per-dimension accuracy split into misreading and
 * miscounting, conclusion depth, and a decay model that knows which modes have
 * gone cold. All of it sits on pages you have to go and look for.
 *
 * **One analysis, two faces.** The feed says the findings; the curator acts on
 * them. Splitting those into two systems would have produced the usual failure
 * — a page telling you your 6-D is weak while the draw kept serving you 3-D —
 * so a finding carries both its sentence and its `nudge`, and the two can only
 * disagree by someone deleting one of them.
 *
 * Pure: no Angular, no storage, no clock. Everything it needs is passed in,
 * which is what lets a finding be tested rather than waited for.
 */

import { DimensionRecord, dimensionBreakdown } from "./construct.utils";
import { AnsweredItem, dayKey } from "./session.utils";

export type FindingKind =
    | "weak-mode"
    | "stale-mode"
    | "improving-mode"
    | "weak-dimension"
    | "fatigue";

export interface Finding {
    kind: FindingKind;
    /** The mode this is about, where it is about one. */
    type?: string;
    /** One sentence, already worded, for the feed. */
    text: string;
    /**
     * How to weight this mode in the draw: 1 is no change, 2 is twice as often.
     *
     * Absent where a finding has nothing actionable behind it. A dimension is
     * the clearest case — no mode *is* the time axis, several carry it, and
     * nudging all of them would be a guess wearing the appearance of a plan.
     */
    nudge?: number;
}

/** One mode's standing, as the ability model has it. */
export interface ModeStanding {
    type: string;
    level: number;
    /** Answers the estimate rests on. A number from three trials is not one. */
    trials: number;
}

export interface InsightInput {
    /** Answered history, newest first, as the game service stores it. */
    history: AnsweredItem[];
    /** Every mode with an estimate worth reading. */
    standings: ModeStanding[];
    /**
     * Ability at the moment each item was *chosen*, per mode, oldest first.
     *
     * The trial log has no timestamps, which is what makes this ordinal rather
     * than dated — and ordinal is all that movement needs.
     */
    estimateTrail: Record<string, number[]>;
    /** Observed minus predicted over the recent window, or null if too early. */
    fatigue: number | null;
    /** Below this, the fatigue reading is worth reporting. */
    fatigueThreshold: number;
    now: number;
}

/**
 * Thresholds, in one place and deliberately conservative.
 *
 * A feed that says something after every session is one nobody reads, and a
 * finding produced from four answers is a horoscope. Everything here is set so
 * that a finding appearing means something actually stood out.
 */
const MIN_TRIALS_FOR_STANDING = 8;
/** Levels below your own average before a mode is worth naming. */
const WEAK_GAP = 1.5;
/** Days untouched before a mode counts as gone cold. */
const STALE_DAYS = 7;
/** Slots of a dimension answered before its accuracy means anything. */
const MIN_DIMENSION_ATTEMPTS = 6;
const WEAK_DIMENSION_ACCURACY = 0.7;
/** Trials either side of the comparison when reading movement. */
const TRAIL_WINDOW = 5;
/** Levels gained across that window before it is worth mentioning. */
const IMPROVED_BY = 0.5;

const DAY = 24 * 60 * 60 * 1000;

/**
 * The mode furthest below your own average, if one is.
 *
 * Against *your* average rather than an absolute, because the levels are not
 * comparable across modes in the first place — `MODE_SCALE` weights them — and
 * because "worst" is only useful relative to what you can otherwise do.
 */
function weakMode(standings: ModeStanding[]): Finding | null {
    const solid = standings.filter(s => s.trials >= MIN_TRIALS_FOR_STANDING);
    if (solid.length < 3) return null;

    const mean = solid.reduce((a, s) => a + s.level, 0) / solid.length;
    const worst = solid.reduce((a, b) => (a.level < b.level ? a : b));
    const gap = mean - worst.level;
    if (gap < WEAK_GAP) return null;

    return {
        kind: "weak-mode",
        type: worst.type,
        text: `${worst.type} sits ${gap.toFixed(1)} levels below your average.`
            + " It will come up more often.",
        nudge: 2,
    };
}

/** How many days since a mode was last answered, or null if never. */
function daysSince(history: AnsweredItem[], type: string, now: number): number | null {
    let latest = 0;
    for (const q of history) {
        if (q.type !== type || !q.answeredAt || q.answered === false) continue;
        if (q.answeredAt > latest) latest = q.answeredAt;
    }
    if (!latest) return null;
    // Whole days between the two calendar days, so "yesterday" is one rather
    // than a fraction that rounds to nought.
    const a = Date.parse(dayKey(latest)), b = Date.parse(dayKey(now));
    return Math.round((b - a) / DAY);
}

/**
 * A mode with a real estimate that has not been played lately.
 *
 * The ability model decays an estimate by the day, so this is not a nag — the
 * number really is drifting back towards the prior, and the mode really will
 * come back easier than you left it and then climb again.
 */
function staleModes(input: InsightInput): Finding[] {
    const out: Finding[] = [];

    for (const standing of input.standings) {
        if (standing.trials < MIN_TRIALS_FOR_STANDING) continue;
        const days = daysSince(input.history, standing.type, input.now);
        if (days === null || days < STALE_DAYS) continue;
        out.push({
            kind: "stale-mode",
            type: standing.type,
            text: `${standing.type} has not come up for ${days} days, so its`
                + " estimate is drifting back towards a guess.",
            nudge: 2,
        });
    }

    // Two at most. A list of everything you have not played lately is a list of
    // everything, and reads as an accusation rather than a finding.
    return out.slice(0, 2);
}

/**
 * A mode whose estimate has moved up over its recent answers.
 *
 * The one finding here that is purely good news, and it is the one Finding 3 in
 * `progression/diagnosis.md` asks for: most of a level can be earned with
 * nothing visible to show for it, because the *item* only changes on a whole
 * premise or a whole rung. A number that went up is the cheapest honest answer
 * to "am I actually getting anywhere".
 */
function improvingModes(input: InsightInput): Finding[] {
    const out: Finding[] = [];

    for (const [type, trail] of Object.entries(input.estimateTrail)) {
        if (trail.length < TRAIL_WINDOW * 2) continue;
        const recent = trail.slice(-TRAIL_WINDOW);
        const before = trail.slice(-TRAIL_WINDOW * 2, -TRAIL_WINDOW);
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        const gain = mean(recent) - mean(before);
        if (gain < IMPROVED_BY) continue;

        out.push({
            kind: "improving-mode",
            type,
            text: `${type} is up ${gain.toFixed(1)} levels over your last few`
                + " answers, even if the items have not visibly changed yet.",
        });
    }

    return out.sort((a, b) => a.type!.localeCompare(b.type!)).slice(0, 2);
}

/**
 * The dimension costing the most, and which kind of mistake it costs.
 *
 * No `nudge`: no mode *is* the time axis. Several carry it, and weighting all
 * of them up would be a guess wearing the appearance of a plan — so this one
 * tells you something and leaves the acting to you.
 */
function weakDimension(dimensions: DimensionRecord[]): Finding | null {
    const worst = dimensions.find(d =>
        d.attempts >= MIN_DIMENSION_ATTEMPTS && d.accuracy < WEAK_DIMENSION_ACCURACY);
    if (!worst) return null;

    const lean = worst.misread > worst.miscounted
        ? "usually the direction rather than the distance — that is a reading slip"
        : worst.miscounted > worst.misread
        ? "usually the distance with the direction right — that is arithmetic"
        : "in both directions and distances about equally";

    return {
        kind: "weak-dimension",
        text: `You lose ${worst.label} more than any other dimension`
            + ` (${worst.wrong} of ${worst.attempts}), ${lean}.`,
    };
}

/** Doing worse than the model expects, which is not the same as being stuck. */
function fatigueFinding(input: InsightInput): Finding | null {
    if (input.fatigue === null || input.fatigueThreshold <= 0) return null;
    if (input.fatigue > -input.fatigueThreshold) return null;

    const points = Math.round(-input.fatigue * 100);
    return {
        kind: "fatigue",
        text: `You are answering about ${points} points below what the model`
            + " expects of you. That reads as tiredness rather than difficulty —"
            + " it may be a good moment to stop.",
    };
}

/**
 * Everything worth saying, most useful first.
 *
 * Fatigue leads when it is present, because it is the only finding that is
 * about *now* and the only one whose advice is to stop — putting it under three
 * lines about which mode to practise would be advice arriving after the reader
 * had already decided to carry on.
 */
export function findings(input: InsightInput): Finding[] {
    const recent = input.history.filter(q =>
        q.answeredAt && q.answeredAt >= input.now - 14 * DAY);

    return [
        fatigueFinding(input),
        weakMode(input.standings),
        weakDimension(dimensionBreakdown(recent as any)),
        ...staleModes(input),
        ...improvingModes(input),
    ].filter((f): f is Finding => !!f);
}

/**
 * How often each mode should come up, given what was found.
 *
 * Returned as a multiplier on the ticket count, which is how frequency is
 * already expressed — so curation is one more term beside the manual weight
 * rather than a second selection system arguing with the first.
 *
 * **Deliberately a lean, not a takeover.** Doubling two modes out of thirty is
 * a session that noticeably leans somewhere; replacing the draw with "your
 * three worst" is a session that stops teaching the rest and stops measuring
 * them, which sends them stale — the very thing half these findings are about.
 */
export function sessionWeights(found: Finding[]): Record<string, number> {
    const weights: Record<string, number> = {};

    for (const finding of found) {
        if (!finding.type || !finding.nudge) continue;
        // A mode that is both weak and stale is still only doubled: two
        // findings about one mode are one reason to see it, not two.
        weights[finding.type] = Math.max(weights[finding.type] ?? 1, finding.nudge);
    }

    return weights;
}
