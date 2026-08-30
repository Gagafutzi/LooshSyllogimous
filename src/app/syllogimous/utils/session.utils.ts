/**
 * What you did today, and what you did this week.
 *
 * The app launches straight into an endless stream and never stops, so nothing
 * has ever marked *that you did something*. A goal gives the loop a shape and
 * the two summaries give it a payoff — and the payoff is the thing this app is
 * unusually well placed to provide, because it already measures far more about
 * a player than it has ever told them.
 *
 * **Derived from the answered history, never tallied as answers come in.** The
 * same rule the per-dimension report follows and for the same reason: a running
 * counter is a second source of truth that drifts, needs migrating, and is
 * wrong for everyone whose history predates it. The history already carries
 * when each item was answered and how it went.
 *
 * Pure — no Angular, no storage, no clock of its own. `now` is passed in, which
 * is what makes a day boundary testable rather than a thing you can only
 * observe by waiting.
 */

import { DimensionRecord, dimensionBreakdown } from "./construct.utils";

/** Just enough of a Question to summarise it; the history holds whole ones. */
export interface AnsweredItem {
    type?: string;
    answered?: boolean;
    answeredAt?: number;
    createdAt?: number;
    isValid?: boolean;
    userAnswer?: boolean;
    answerMode?: string;
    construct?: any[];
    userConstruct?: any[];
}

export interface ModeTally {
    type: string;
    answered: number;
    correct: number;
}

export interface DaySummary {
    /** The day this describes, keyed as the goal tracker keys it. */
    key: string;
    /** When that day started, for labelling. */
    at: number;
    answered: number;
    correct: number;
    /** Answered items that ran out of clock rather than being got wrong. */
    timeouts: number;
    /** Time with an item actually in front of you, in seconds. */
    seconds: number;
    /** Most played first. */
    modes: ModeTally[];
    dimensions: DimensionRecord[];
}

export interface WeekSummary {
    /** Seven days, oldest first, today last. */
    days: DaySummary[];
    answered: number;
    correct: number;
    modes: ModeTally[];
    /**
     * Modes played before this week and not since.
     *
     * The ability model already decays an estimate by the day, so the app knows
     * which modes have gone stale — it has simply never said so. This is that,
     * and it is a reason to come back that is derived from a real forgetting
     * model rather than manufactured from a streak.
     */
    stale: string[];
}

/**
 * Which day a moment belongs to, keyed exactly as the goal tracker keys it.
 *
 * `ProgressAndPerformanceService` has recorded minutes per day since long
 * before this file, under `new Date().toISOString().split("T")[0]` — a **UTC**
 * date. That is arguably wrong east or west of Greenwich, where the day turns
 * over at some hour that is not midnight, but it is what is *stored*, and a
 * summary that counted items by local day beside minutes counted by UTC day
 * would have its two halves disagree with each other for an hour or two every
 * night.
 *
 * So the wart is shared rather than fixed here, and it is shared through one
 * function: correcting it later is a change to this and a migration of the
 * stored keys, rather than an archaeology of everywhere a date was formatted.
 */
export function dayKey(at: number): string {
    return new Date(at).toISOString().split("T")[0];
}

const DAY = 24 * 60 * 60 * 1000;

/** The moment a day key starts, for labelling and for stepping backwards. */
export function dayStart(key: string): number {
    return new Date(key + "T00:00:00.000Z").getTime();
}

/**
 * An item that was actually answered.
 *
 * `answeredAt` cannot do this on its own — it is initialised when the question
 * is *built*, so it is truthy from the start, which is the same trap the
 * `answered` flag was added to the model to close. History written before that
 * flag existed is read as answered, since an item only reaches the history by
 * being answered.
 */
const wasAnswered = (q: AnsweredItem) => q.answered !== false && !!q.answeredAt;

const isCorrect = (q: AnsweredItem) => q.userAnswer === q.isValid;
const isTimeout = (q: AnsweredItem) => q.userAnswer === undefined;

/** Answered items that fall on the same day as `at`. */
export function itemsOnDay(items: AnsweredItem[], at: number): AnsweredItem[] {
    const key = dayKey(at);
    return items.filter(q => wasAnswered(q) && dayKey(q.answeredAt!) === key);
}

function tallyModes(items: AnsweredItem[]): ModeTally[] {
    const by = new Map<string, ModeTally>();
    for (const q of items) {
        const type = q.type ?? "unknown";
        const row = by.get(type) ?? { type, answered: 0, correct: 0 };
        row.answered++;
        if (isCorrect(q)) row.correct++;
        by.set(type, row);
    }
    return [...by.values()].sort((a, b) => b.answered - a.answered);
}

/**
 * Seconds with an item in front of you, not seconds elapsed.
 *
 * Taken per item from when it was built to when it was answered, so a break in
 * the middle of a session does not become time on task. Clamped at five minutes
 * an item: leaving the tab open over lunch is not two hours of training, and a
 * summary that claimed it would be the least trustworthy number on the card.
 *
 * The daily goal counts the same item and used to count it *unclamped*, which
 * is how the two came to disagree by hours — see `LOGGED_ITEM_MS`.
 */
export const MAX_ITEM_SECONDS = 300;

function timeOnTask(items: AnsweredItem[]): number {
    let total = 0;
    for (const q of items) {
        if (!q.createdAt || !q.answeredAt) continue;
        const seconds = (q.answeredAt - q.createdAt) / 1000;
        if (seconds > 0) total += Math.min(seconds, MAX_ITEM_SECONDS);
    }
    return Math.round(total);
}

export function daySummary(items: AnsweredItem[], now = Date.now()): DaySummary {
    const today = itemsOnDay(items, now);
    const key = dayKey(now);
    return {
        key,
        at: dayStart(key),
        answered: today.length,
        correct: today.filter(isCorrect).length,
        timeouts: today.filter(isTimeout).length,
        seconds: timeOnTask(today),
        modes: tallyModes(today),
        dimensions: dimensionBreakdown(today as any),
    };
}

/**
 * The last seven days including today, rather than a calendar week.
 *
 * A calendar week resets on Monday and shows an empty card to anyone who opens
 * it on Monday morning — which is the moment a weekly summary is least useful
 * and most likely to read as "you have done nothing". A rolling window always
 * describes a full week of behaviour.
 */
export function weekSummary(items: AnsweredItem[], now = Date.now()): WeekSummary {
    const days: DaySummary[] = [];
    for (let back = 6; back >= 0; back--) {
        days.push(daySummary(items, now - back * DAY));
    }

    const keys = new Set(days.map(d => d.key));
    const within = items.filter(q => wasAnswered(q) && keys.has(dayKey(q.answeredAt!)));
    const before = items.filter(q => wasAnswered(q) && !keys.has(dayKey(q.answeredAt!))
        && q.answeredAt! < days[0].at);

    const touched = new Set(within.map(q => q.type));
    const stale = [...new Set(before.map(q => q.type ?? "unknown"))]
        .filter(type => !touched.has(type))
        .sort();

    return {
        days,
        answered: within.length,
        correct: within.filter(isCorrect).length,
        modes: tallyModes(within),
        stale,
    };
}
