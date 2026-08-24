/**
 * Several conclusions, asked one at a time.
 *
 * The form this replaces put every claim on the card at once and scored them as
 * an AND. Two things were wrong with that, and both are asserted here.
 *
 * It was **one bit for two or three questions**, so the reader who settled the
 * first claim and guessed the rest scored the same as the reader who settled
 * all of them. And an AND **is not a coin**: a set of claims that must all hold
 * is false far more often than it is true, so "false" becomes the percentage
 * answer and the reasoning is optional.
 *
 * Asked one at a time, each claim is its own question at even odds, the
 * premises stay on screen, and answering one buys clock for the next.
 */

import { assert, equal, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { GameTimerService } from "../src/app/syllogimous/services/game-timer.service";
import { Question } from "../src/app/syllogimous/models/question.models";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** The three families that ask several conclusions. */
const FAMILIES: Array<[EnumQuestionType, number]> = [
    [EnumQuestionType.LinearVertical, 5],
    [EnumQuestionType.Space4D, 4],
    [EnumQuestionType.Hierarchy, 5],
];

test("several conclusions come as a series, not as one card of claims", () => {
    const ctx = context();
    let seen = 0;

    for (const [type, n] of FAMILIES) {
        seeded(1234, () => {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (q.series.length < 2) continue;
                seen++;

                // The card shows one claim, and it is the first of them.
                assert(typeof q.conclusion === "string",
                    `${type} put a list on the card instead of one claim`);
                equal(q.conclusion, q.series[0].text,
                    `${type} shows a claim that is not the first of the series`);
                equal(q.isValid, q.series[0].isValid,
                    `${type} is judged against a claim it is not showing`);
                equal(q.seriesAt, 0, `${type} starts partway through its series`);
            }
        });
    }

    assert(seen > 30, `only ${seen} series items across three families`);
});

/**
 * Each claim its own coin.
 *
 * The old set was all-true or exactly-one-false, because an AND answered from
 * several false claims can be settled from whichever you check first. Asked one
 * at a time that reasoning inverts: each claim is its own question, so each
 * wants its own even chance, and a reader who has learned that "false" is the
 * percentage answer has learned nothing worth having.
 */
test("a claim is as likely to hold as not, and the claims are independent", () => {
    const ctx = context();
    let holds = 0, total = 0, allTheSame = 0, items = 0;

    for (const [type, n] of FAMILIES) {
        seeded(8642, () => {
            for (let rep = 0; rep < 60; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (!q || q.series.length < 2) continue;

                items++;
                const claims = q.series;
                for (const c of claims) { total++; if (c.isValid) holds++; }
                if (claims.every(c => c.isValid === claims[0].isValid)) allTheSame++;
            }
        });
    }

    assert(total > 100, `only ${total} claims in the sample`);
    const rate = holds / total;
    assert(rate > 0.35 && rate < 0.65,
        `${(rate * 100).toFixed(0)}% of claims hold, which is not a coin`);

    // Independent, so a mixed item is the common case rather than the rare one.
    assert(allTheSame / items < 0.65,
        `${allTheSame} of ${items} items had every claim the same way, so the`
        + " first claim gives the rest away");
});

/**
 * The clock is handed seconds, not restarted.
 *
 * A series shares one arrangement and one countdown: answering a claim buys
 * time for the next, so the item stays one timed unit and the extra is visibly
 * what getting that far bought. Restarting it would make a three-claim item
 * three items long for the price of one.
 */
test("answering a claim adds to the clock without restarting it", () => {
    const timer = new GameTimerService();

    // Nothing running: extending is silent rather than an error.
    timer.extend(5);
    equal(timer.remainingSeconds, 0, "a stopped clock was given time");

    timer.start(30);
    timer.extend(5);
    equal(timer.remainingSeconds, 35, "the bonus was not added to what was left");

    timer.extend(0);
    equal(timer.remainingSeconds, 35, "a zero bonus moved the clock");

    // And it is still the same run, not a fresh one.
    assert(timer.running, "extending the clock restarted it");
    timer.stop();
});
