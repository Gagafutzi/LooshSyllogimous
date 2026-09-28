/**
 * The dashboard that replaced the stats page.
 *
 * Every figure on it exists somewhere else in the app already — the ability
 * model has the levels, `itemTally` decides what counts as right, the items
 * carry their own reading load. The whole risk of the screen is therefore that
 * it answers one of those questions a second time and differently, which is the
 * defect this project keeps producing: a count taken from the wrong place.
 *
 * So these do not check that the numbers are pretty. They check that the four
 * places where a shortcut would be tempting — Free Play, part-right items, a
 * tab left open, and a streak read against the clock rather than against the
 * training — still resolve the way the rest of the app resolves them.
 */

import { readFileSync } from "fs";
import { assert, equal, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Question } from "../src/app/syllogimous/models/question.models";
import { GameService } from "../src/app/syllogimous/services/game.service";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { StatsExportService } from "../src/app/syllogimous/services/stats-export.service";
import {
    ProgressDashboardComponent,
} from "../src/app/syllogimous/pages/progress-dashboard/progress-dashboard.component";

const TYPE = EnumQuestionType.ComparisonNumerical;
const DAY = 24 * 60 * 60 * 1000;
const TEMPLATE =
    "src/app/syllogimous/pages/progress-dashboard/progress-dashboard.component.html";

/** One answered item, right unless told otherwise. */
function item(opts: {
    at?: number; took?: number; right?: boolean; free?: boolean;
    series?: boolean[];
} = {}) {
    const q = new Question(TYPE);
    q.premises = ["a", "b", "c"];
    q.createdAt = opts.at ?? 1_000_000;
    q.answeredAt = q.createdAt + (opts.took ?? 5_000);
    q.isValid = true;
    q.userAnswer = opts.right === false ? false : true;
    q.playgroundMode = !!opts.free;
    if (opts.series) {
        // What a series item is: one conclusion per screen, each scored on its
        // own. The item's own claim is series[0], as extendWithSeries builds it.
        q.series = opts.series.map(() => ({ conclusion: "x" })) as never;
        q.seriesAnswers = opts.series;
    }
    return q;
}

/**
 * Only `questions` is read off the game, and only the two estimates off the
 * progression — a stand-in for each is the whole dependency, and building the
 * real ones wants the injector.
 */
function dashboard(items: Question[]) {
    return new ProgressDashboardComponent(
        {} as never,
        { questions: items } as unknown as GameService,
        {
            unlockEvidence: () => ({ aggregateLevel: 4, bestLevel: 6, anyExhausted: false }),
            estimateFor: () => ({ level: 5, sd: 1.25, trials: 12 }),
        } as unknown as ProgressionService,
        {} as unknown as StatsExportService,
    );
}

const tile = (tiles: { label: string; value: string }[], label: string) =>
    tiles.find(t => t.label === label)!.value;

test("Free Play is not training, and the dashboard does not count it as any", () => {
    const d = dashboard([item(), item({ free: true }), item({ free: true })]);

    equal(tile(d.model, "Items answered"), "1",
        "items built from settings the player wrote were counted as training");
    equal(d.modes.length, 1, "the per-mode table counted Free Play items");
    equal(d.modes[0].items, 1, "the per-mode row counted Free Play items");
});

test("a dashboard with nothing but Free Play on it reports itself empty", () => {
    assert(dashboard([item({ free: true })]).empty,
        "an account that has only ever used Free Play would show figures "
        + "derived from no training at all");
});

test("accuracy is per conclusion, so a part-right item is part right", () => {
    // Two of three conclusions answered, which is neither nought nor a hundred.
    const d = dashboard([item({ series: [true, false, true] })]);

    equal(tile(d.outcomes, "Overall accuracy"), "67%",
        "a series item was scored whole rather than per conclusion");
    equal(d.modes[0].accuracy, "67%",
        "the per-mode row scored a series item whole rather than per conclusion");
});

test("a tab left open is not a question thought about", () => {
    const brisk = dashboard([item({ took: 4_000 }), item({ took: 6_000 })]);
    const walked = dashboard([
        item({ took: 4_000 }), item({ took: 6_000 }), item({ took: 45 * 60_000 })]);

    equal(tile(brisk.outcomes, "Avg. time to answer"), "5.0s", "the plain mean is wrong");
    equal(tile(walked.outcomes, "Avg. time to answer"), "5.0s",
        "three quarters of an hour of an open tab was billed as thinking time");
});

/**
 * Counted back from the last day trained, not from today.
 *
 * Read against the clock, a streak breaks at midnight and stays broken until
 * the first item of the new day — so opening the dashboard over breakfast
 * reports yesterday's run as lost, which is both false and the one thing a
 * streak is for.
 */
test("a streak is counted back from the last day trained", () => {
    const today = Date.now();
    const d = dashboard([
        item({ at: today - 3 * DAY }), item({ at: today - 2 * DAY }),
        item({ at: today - 1 * DAY }),
    ]);

    equal(tile(d.model, "Current streak"), "3 days", "the streak was read against the clock");
    equal(tile(d.outcomes, "Days played"), "3", "distinct days were miscounted");
});

test("a gap breaks the streak but not the longest run", () => {
    const today = Date.now();
    const d = dashboard([
        item({ at: today - 9 * DAY }), item({ at: today - 8 * DAY }),
        item({ at: today - 7 * DAY }), item({ at: today - 6 * DAY }),
        item({ at: today - 1 * DAY }),
    ]);

    const streak = d.model.find(t => t.label === "Current streak")!;
    equal(streak.value, "1 day", "a five-day gap did not break the streak");
    equal(streak.note, "longest 4", "the earlier run was not remembered");
});

/**
 * Computed and then never shown.
 *
 * Each row of tiles is a getter, and a getter nothing reads is a measurement
 * taken for nobody — which renders as an absent section rather than as an
 * error, the same way the dropped card slot did.
 */
test("every row the dashboard computes is one the template shows", () => {
    const html = readFileSync(TEMPLATE, "utf8");
    for (const row of ["model", "outcomes", "load", "modes"]) {
        assert(new RegExp(`\\*ngFor="let \\w+ of ${row}"`).test(html),
            `the ${row} row is computed but never rendered`);
    }
    // And the export buttons the page exists to carry over from the stats page.
    for (const call of ["exportStats()", "buildShare()", "copyShare()"]) {
        assert(html.includes(call), `${call} has no button on the dashboard`);
    }
});
