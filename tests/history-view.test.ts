/**
 * History shows every conclusion's derivation, and answering is not held up by
 * writing the history down.
 *
 * Two reports. *"Make a slider for each conclusion explanation in history, not
 * just one"* — History rendered `question.explanation`, and `takeSeriesAnswer`
 * overwrites that as the card advances, so what reached storage was the *last*
 * conclusion's. The earlier ones, which are the ones somebody opens History to
 * understand, were on `series[i].explanation` the whole time and never shown.
 *
 * And *"the game feels rather laggy than snappy"*. `get questions` parsed the
 * whole of storage on every read, and `pushIntoHistory` read it before writing
 * it all back — on every answer, on the keypress.
 */

import { assert, equal, seeded, test } from "./harness";
import { hasNextClaim, takeSeriesAnswer } from "../src/app/syllogimous/utils/answer.utils";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("negation", true);
    settings.setEnable("meta", true);
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => true, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => true,
        dialFor: () => 2,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/**
 * What History can render for an item, mirroring `HistoryComponent.claims`.
 *
 * Deliberately reading only fields that reach storage: a stored question is
 * plain JSON, so anything the view needs has to have survived the write.
 */
function claimsFor(q: Question) {
    const series = q.series ?? [];
    if (series.length <= 1) return null;
    return series.map((claim, i) => ({
        index: i,
        text: claim.text || claim.prompt || q.choicePrompt || "",
        choices: claim.choices ?? (i === series.length - 1 ? q.choices : undefined),
        premises: claim.premises ?? q.premises,
        explanation: claim.explanation?.length ? claim.explanation : q.explanation,
    }));
}

test("every conclusion of an item can be shown with its own derivation", () => {
    const ctx = context();
    const faults: string[] = [];
    const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };
    let multi = 0;

    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        seeded(4242, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); } catch { continue; }
                if ((q.series?.length ?? 0) <= 1) continue;

                // Play it through, exactly as the card does — this is what
                // overwrites `question.explanation` on the way past.
                let guard = 0;
                while (hasNextClaim(q) && guard++ < 200) {
                    takeSeriesAnswer(q, q.answerMode === "boolean" ? q.isValid : true);
                }

                // Only what a stored question keeps.
                const stored: Question = JSON.parse(JSON.stringify(q));
                const list = claimsFor(stored);
                if (!list) { note(`${type}: a multi-conclusion item offered no list`); continue; }
                multi++;

                equal(list.length, stored.series.length,
                    `${type}: ${list.length} views for ${stored.series.length} conclusions`);
                list.forEach(c => {
                    // A sentence, or a prompt over a set of options: either is
                    // a question. Neither is a blank card.
                    if (!c.text && !c.choices?.length) {
                        note(`${type}: conclusion ${c.index + 1} shows neither a claim nor options`);
                    }
                    if (!c.explanation || !c.explanation.length) {
                        note(`${type}: conclusion ${c.index + 1} has no derivation to show`);
                    }
                    if (!c.premises || !c.premises.length) {
                        note(`${type}: conclusion ${c.index + 1} has no premises to show`);
                    }
                });
            }
        });
    }

    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
    assert(multi > 80, `only ${multi} multi-conclusion items reached the check`);
});

test("an early conclusion's derivation is not the last one's", () => {
    /*
     * The fault itself. If every claim carried the same text this test would
     * pass against the old single-explanation view, so it asserts that the
     * views actually differ somewhere.
     */
    const ctx = context();
    let differing = 0, checked = 0;

    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        seeded(31337, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); } catch { continue; }
                if ((q.series?.length ?? 0) <= 1) continue;
                let guard = 0;
                while (hasNextClaim(q) && guard++ < 200) {
                    takeSeriesAnswer(q, q.answerMode === "boolean" ? q.isValid : true);
                }
                const stored: Question = JSON.parse(JSON.stringify(q));
                const list = claimsFor(stored)!;
                checked++;
                const first = JSON.stringify(list[0]?.explanation) + "|" + list[0]?.text;
                const last = JSON.stringify(list[list.length - 1]?.explanation)
                    + "|" + list[list.length - 1]?.text;
                if (first !== last) differing++;
            }
        });
    }

    assert(checked > 80, `only ${checked} items checked`);
    assert(differing > checked * 0.8,
        `only ${differing} of ${checked} items had a first conclusion that differs from the last — `
        + "the per-conclusion view would be showing the same thing every time");
});

/* ---------------- and the lag ---------------- */

/**
 * Writing the history down must not be on the answer's critical path.
 *
 * `get questions` parsed the whole of storage on every read and
 * `pushIntoHistory` read it before writing it all back — so every answer paid
 * a full parse and a full serialise of up to a thousand questions, measured at
 * 24ms on a full history before the synchronous `setItem` even begins.
 *
 * Exercised through the service, because the property is about what the caller
 * waits for rather than about any one function.
 */
import { GameService } from "../src/app/syllogimous/services/game.service";

function fakeQuestion(i: number): Question {
    const q = new Question(EnumQuestionType.Distinction);
    q.premises = ["a is not b", "b is not c"];
    q.conclusion = "a is not c";
    q.answeredAt = 1000 + i;
    q.createdAt = 1;
    q.userAnswer = true;
    q.isValid = true;
    return q;
}

/** Only the history keys, and only through the public surface. */
function historyService(): GameService {
    localStorage.clear();
    return new (GameService as unknown as new (...a: unknown[]) => GameService)(
        {} as never, {} as never, { getToday: () => "2026-01-01", calcDailyProgress: () => 0,
            setDailyProgress: () => {}, getTrainingUnit: () => ({ premises: 2 }),
            getAllTrainingUnits: () => ({}) } as never,
        new SettingsOverrideService(), new ProgressionService(), {} as never, {} as never);
}

test("an answer is recorded in memory before it is written to storage", () => {
    const g = historyService();
    equal(g.questions.length, 0, "expected an empty history");

    g.pushIntoHistory(fakeQuestion(1));
    equal(g.questions.length, 1, "the answer was not visible until it had been written");
    equal(localStorage.getItem("SYL_HISTORY"), null,
        "the write happened on the answer rather than after it");

    g.flushHistory();
    const stored = JSON.parse(localStorage.getItem("SYL_HISTORY") || "[]");
    equal(stored.length, 1, "flushing did not write the answer");
});

test("reading the history repeatedly does not re-parse storage", () => {
    const g = historyService();
    g.pushIntoHistory(fakeQuestion(1));
    g.flushHistory();
    const first = g.questions;
    const second = g.questions;
    assert(first === second,
        "each read produced a fresh array — storage is being parsed every time");
});

test("the stored history is capped, not merely read as capped", () => {
    const g = historyService();
    // Well past the cap, which the old write path never applied at all: the
    // read sliced to a thousand and the array on disk grew without bound.
    for (let i = 0; i < 1005; i++) g.pushIntoHistory(fakeQuestion(i));
    g.flushHistory();
    const stored = JSON.parse(localStorage.getItem("SYL_HISTORY") || "[]");
    assert(stored.length <= 1000, `${stored.length} questions written past a cap of 1000`);
    equal(stored[0].answeredAt, 1000 + 1004, "the newest answer is not first");
});

test("a dropped cache abandons the write it was going to make", () => {
    const g = historyService();
    g.pushIntoHistory(fakeQuestion(1));
    g.forgetHistoryCache();
    g.flushHistory();
    equal(localStorage.getItem("SYL_HISTORY"), null,
        "a write landed after the cache was dropped — that is the import race");
});
