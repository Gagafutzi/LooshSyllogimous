/**
 * What you did today, and what you did this week.
 *
 * The arithmetic is easy and the *boundaries* are not, which is what this file
 * is mostly about: a summary that miscounts a day is worse than no summary,
 * because it is confidently wrong about something the reader can check.
 */

import { assert, equal, test } from "./harness";
import {
    dayKey, daySummary, itemsOnDay, weekSummary,
} from "../src/app/syllogimous/utils/session.utils";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);      // midday, so nothing straddles

/** An answered item, with only the fields a summary reads. */
const item = (opts: {
    at: number; type?: string; right?: boolean; timeout?: boolean; seconds?: number;
}) => ({
    type: opts.type ?? "Distinction",
    answered: true,
    answeredAt: opts.at,
    createdAt: opts.at - (opts.seconds ?? 10) * 1000,
    isValid: true,
    userAnswer: opts.timeout ? undefined : (opts.right ?? true),
});

test("a day holds the items answered on it and no others", () => {
    const items = [
        item({ at: NOW }),
        item({ at: NOW - DAY }),
        item({ at: NOW + DAY }),
    ];

    equal(itemsOnDay(items, NOW).length, 1, "a neighbouring day leaked in");
    equal(daySummary(items, NOW).answered, 1, "the day counted more than its own items");
});

test("an item is counted on the day the goal tracker would count it on", () => {
    /*
     * The goal tracker has keyed days by `toISOString()` since long before this
     * page, and the summary shares that key deliberately — a card that counted
     * items by local day beside minutes counted by UTC day would disagree with
     * itself for an hour or two every night. What must hold is that the two
     * agree, not that either is the ideal boundary.
     */
    const justBefore = Date.UTC(2026, 7, 24, 23, 59, 59);
    const justAfter = Date.UTC(2026, 7, 25, 0, 0, 1);

    equal(dayKey(justBefore), "2026-08-24", "the last second of a day fell into the next");
    equal(dayKey(justAfter), "2026-08-25", "the first second of a day fell into the last");

    const items = [item({ at: justBefore }), item({ at: justAfter })];
    equal(daySummary(items, justBefore).answered, 1, "the two seconds landed on one day");
    equal(daySummary(items, justAfter).answered, 1, "the two seconds landed on one day");
});

test("right, wrong and out-of-clock are told apart", () => {
    const day = daySummary([
        item({ at: NOW, right: true }),
        item({ at: NOW, right: false }),
        item({ at: NOW, timeout: true }),
    ], NOW);

    equal(day.answered, 3, "not everything answered was counted");
    equal(day.correct, 1, "a wrong or timed-out item was counted as right");
    equal(day.timeouts, 1, "the clock running out was counted as a wrong answer");
});

test("time on task is per item, and a forgotten tab is not training", () => {
    /*
     * Elapsed time would make a lunch break part of the session. Per item it
     * cannot — but one item left open all afternoon still could, so the clamp
     * is what keeps the least checkable number on the card trustworthy.
     */
    const day = daySummary([
        item({ at: NOW, seconds: 30 }),
        item({ at: NOW, seconds: 20 }),
        item({ at: NOW, seconds: 7200 }),   // walked away
    ], NOW);

    equal(day.seconds, 30 + 20 + 300, `time on task came out at ${day.seconds}s`);
});

test("an unanswered item is not part of any day", () => {
    const items = [{ type: "Distinction", answered: false, answeredAt: NOW, createdAt: NOW }];
    equal(daySummary(items, NOW).answered, 0, "an unanswered item was counted");
});

test("the week is seven days ending today, oldest first", () => {
    const week = weekSummary([], NOW);

    equal(week.days.length, 7, "the week is not seven days");
    equal(week.days[6].key, dayKey(NOW), "today is not the last day of the strip");
    equal(week.days[0].key, dayKey(NOW - 6 * DAY), "the strip does not start six days back");

    for (let i = 1; i < week.days.length; i++) {
        assert(week.days[i - 1].at < week.days[i].at, "the strip is not in order");
    }
});

test("a mode played only before this week is reported as stale", () => {
    /*
     * The point of the line: the ability model decays an estimate by the day,
     * so the app already knows what has gone cold and has never said so.
     */
    const week = weekSummary([
        item({ at: NOW, type: "Distinction" }),
        item({ at: NOW - 3 * DAY, type: "Syllogism" }),
        item({ at: NOW - 30 * DAY, type: "Deictic" }),
        // Played long ago *and* recently: not stale.
        item({ at: NOW - 40 * DAY, type: "Distinction" }),
    ], NOW);

    equal(week.stale.join(","), "Deictic", `stale came out as [${week.stale.join(", ")}]`);
    equal(week.answered, 2, "the window counted items outside it");
    equal(week.modes.length, 2, "the mode tally counted items outside the window");
});

test("the busiest mode is named first", () => {
    const day = daySummary([
        item({ at: NOW, type: "Syllogism" }),
        item({ at: NOW, type: "Distinction" }),
        item({ at: NOW, type: "Distinction" }),
    ], NOW);

    equal(day.modes[0].type, "Distinction", "the most played mode is not listed first");
    equal(day.modes[0].answered, 2, "the tally is wrong");
});
