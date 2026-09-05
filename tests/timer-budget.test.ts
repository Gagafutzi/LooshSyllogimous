/**
 * A deadline inferred from how long answers took, and what it must not infer.
 *
 * The adaptive timer takes the mean of the last ten answers and multiplies it by
 * headroom. `dt` is wall-clock from the item appearing to it being answered, so
 * an item left on screen while the tab sits in the background logs however long
 * that was — and with no cap at either end, one walk-away armed a
 * seventeen-minute deadline and went on arming it for the next ten items of that
 * length.
 *
 * The visible symptom was a timer bar sitting at eight per cent with eighty
 * seconds on the clock, reported several times and looked for in the drawing
 * every time. The drawing was right: eighty seconds of a thousand *is* eight per
 * cent. What was wrong was the thousand.
 *
 * Five minutes is the same bound `MAX_REFERENCE_SECONDS` puts on the ability
 * model's own anchor, for the reason stated there: past it the tab was open and
 * nobody was reading.
 */

import { assert, equal, test } from "./harness";
import { StatsService } from "../src/app/syllogimous/services/stats.service";
import { DEFAULT_ABILITY } from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Question } from "../src/app/syllogimous/models/question.models";
import { GameService } from "../src/app/syllogimous/services/game.service";

const TYPE = EnumQuestionType.ComparisonNumerical;

/** One answered item that took `seconds` of wall-clock. */
function answered(seconds: number) {
    const q = new Question(TYPE);
    q.premises = ["a", "b", "c"];
    q.createdAt = 1_000_000;
    q.answeredAt = 1_000_000 + seconds * 1000;
    q.userAnswer = true;
    q.isValid = true;
    q.timerTypeOnAnswer = "2";
    return q;
}

/*
 * Only `questions` is read, so a stand-in for it is the whole dependency. The
 * alternative is constructing a GameService, which wants the injector.
 */
function statsFrom(items: Question[]) {
    const game = { questions: items } as unknown as GameService;
    return new StatsService(game).calcStats("2");
}

test("an answer cannot claim to have taken longer than a sitting", () => {
    const brisk = statsFrom([answered(20), answered(20), answered(20)]);
    const walked = statsFrom([answered(20), answered(20), answered(20 * 60)]);

    const of = (s: ReturnType<typeof statsFrom>) => {
        const st = (s.typeBasedStats[TYPE]?.stats as any)?.["3"];
        return st ? (st.last10Sum / 1000) / st.last10Count : null;
    };

    const briskMean = of(brisk)!;
    const walkedMean = of(walked)!;
    assert(briskMean != null && walkedMean != null, "no bucket to compare");

    assert(walkedMean <= 300 / 3 + briskMean,
        `a twenty-minute walk-away moved the mean to ${walkedMean.toFixed(0)}s —`
        + " it should count for five minutes at most");
    assert(walkedMean > briskMean,
        "a long answer should still count for more than a short one");
});

test("the raw extreme is still reported, since it decides nothing", () => {
    const s = statsFrom([answered(20), answered(20 * 60)]);
    const st = (s.typeBasedStats[TYPE]?.stats as any)?.["3"];
    assert(st.slowest >= 20 * 60 * 1000,
        `the slowest answer was clipped to ${st.slowest}ms — it is there to say`
        + " what happened, not to set a deadline");
});

/* ------------------------------------------------------------------ *
 * And the deadline itself                                             *
 * ------------------------------------------------------------------ */

/**
 * Read from the source rather than driven, because the adaptive branch lives in
 * the game screen and needs a component, a router and a live DOM to reach. What
 * went wrong is a missing clamp, which is exactly what a source scan can see.
 */
test("the adaptive deadline has a ceiling as well as a floor", () => {
    const src = require("fs").readFileSync(
        "src/app/syllogimous/pages/game/game.component.ts", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "");

    const armed = (src.match(/this\.timerTimeSeconds = Math\.floor\([^;]*\);/) || [""])[0];
    assert(/Math\.max\(\s*MIN_SECONDS/.test(armed),
        `the adaptive deadline lost its floor: ${armed || "(not found)"}`);
    assert(/Math\.min\(\s*MAX_SECONDS/.test(armed),
        `the adaptive deadline has no ceiling, so a long answer can arm any`
        + ` deadline at all: ${armed || "(not found)"}`);
});

test("the ceiling is the one the ladder holds itself to", () => {
    const src = require("fs").readFileSync(
        "src/app/syllogimous/pages/game/game.component.ts", "utf8");
    assert(/const MAX_SECONDS = this\.progressionService\.config\.ceilingSeconds;/.test(src),
        "the adaptive ceiling is a number of its own rather than the ladder's");
    equal(DEFAULT_ABILITY.maxSeconds, 180,
        "the ladder's own ceiling moved, so this test's premise needs revisiting");
});
