/**
 * A conclusion is reported as it was answered, whatever the ones before it did.
 *
 * Reported from play: *"even a correct conclusion was shown as incorrect after
 * a previous incorrect answer"*.
 *
 * Every conclusion is counted on its own -- `perClaimCredit` hands the ability
 * model one update per claim, at that claim's own difficulty and guess rate.
 * The screens were the part that had not caught up, and they collapsed an item
 * two different ways, both of them able to report a right conclusion as wrong:
 *
 *   `judgeItem`              every conclusion or nothing. Right for the tier
 *                            score, which is about clearing an item -- and it
 *                            was also the word shown after the *last*
 *                            conclusion, where it reads as a verdict on the one
 *                            just answered. That is the reported fault: answer
 *                            the third of three correctly after missing the
 *                            first, and the card says "Wrong".
 *   `userAnswer === isValid` the last conclusion, since `takeSeriesAnswer`
 *                            moves `isValid` onto each claim as the card
 *                            advances. Seven display sites used it, so a
 *                            three-conclusion item was drawn, counted and
 *                            exported by its last conclusion alone.
 *
 * `tsc` sees none of this: both expressions are booleans over fields that exist
 * on every question.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    hasNextClaim, itemTally, itemWasRight, judgeItem, takeSeriesAnswer,
} from "../src/app/syllogimous/utils/answer.utils";
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
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => true, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => true,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** What the item calls a right answer, and its opposite. */
const rightFor = (q: Question) => q.answerMode === "boolean" ? q.isValid : true;
const wrongFor = (q: Question) => q.answerMode === "boolean" ? !q.isValid : false;

/**
 * Answer every conclusion of an item to a pattern, the way the card does.
 *
 * `pattern(i)` says whether conclusion `i` is answered the way the item asks.
 * Returns what the screen would show for the last conclusion -- the word in the
 * verdict box -- alongside what was actually recorded for each.
 */
function play(q: Question, pattern: (i: number) => boolean) {
    const flashed: boolean[] = [];
    let i = 0, guard = 0;
    while (hasNextClaim(q) && guard++ < 500) {
        // Every conclusion but the last: `GameService.flashClaim` shows this.
        flashed.push(takeSeriesAnswer(q, pattern(i) ? rightFor(q) : wrongFor(q)));
        i++;
    }
    const last = pattern(i) ? rightFor(q) : wrongFor(q);
    const cleared = judgeItem(q, last);
    q.userAnswer = last;

    /*
     * What `GameService.showVerdict` is handed for the final conclusion. It is
     * the last conclusion's own result, not `judgeItem` -- which is the fix.
     */
    const lastVerdict = q.series.length
        ? q.seriesAnswers[q.seriesAt] === true
        : cleared;
    flashed.push(lastVerdict);

    return { flashed, cleared, tally: itemTally(q), asked: i + 1 };
}

function sweep(name: string, pattern: (i: number) => boolean) {
    test(name, () => {
        const ctx = context();
        const faults: string[] = [];
        const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };
        let walked = 0, multi = 0;

        for (const type of Object.values(EnumQuestionType)) {
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            seeded(9001, () => {
                for (let rep = 0; rep < 30; rep++) {
                    let q: Question;
                    try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); }
                    catch { continue; }
                    walked++;
                    const { flashed, cleared, tally, asked } = play(q, pattern);
                    if (asked > 1) multi++;

                    // The reported fault, stated directly: what the screen says
                    // about a conclusion is what the player did with it.
                    flashed.forEach((shown, at) => {
                        if (shown !== pattern(at)) {
                            note(`${type}: conclusion ${at + 1} of ${asked} answered `
                                + `${pattern(at) ? "right" : "wrong"} and shown `
                                + `${shown ? "right" : "wrong"}`);
                        }
                    });

                    // And the tally the screens colour and count from.
                    const expected = flashed.filter(Boolean).length;
                    if (tally.right !== expected || tally.asked !== asked) {
                        note(`${type}: ${expected} of ${asked} right, tallied `
                            + `${tally.right} of ${tally.asked}`);
                    }
                    if (itemWasRight(q) !== cleared) {
                        note(`${type}: itemWasRight disagrees with judgeItem`);
                    }
                }
            });
        }

        equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
        assert(walked > 400, `only ${walked} items walked`);
        assert(multi > 80, `only ${multi} of them asked more than one conclusion`);
    });
}

sweep("every conclusion right is shown right", () => true);
sweep("every conclusion wrong is shown wrong", () => false);
// The report itself: a miss first, then a conclusion answered correctly.
sweep("a right conclusion after a wrong one is still shown right", i => i > 0);
sweep("a wrong conclusion after a right one is still shown wrong", i => i > 0 ? false : true);
sweep("alternating conclusions are each shown as they went", i => i % 2 === 0);

/**
 * The other collapse: `userAnswer === isValid` is the last conclusion, and the
 * seven display sites used it as though it were the item.
 */
test("an item is not reported by its last conclusion alone", () => {
    const ctx = context();
    const faults: string[] = [];
    const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };
    let caught = 0;

    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        seeded(555, () => {
            for (let rep = 0; rep < 30; rep++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); }
                catch { continue; }
                // Miss the first, take the rest: the case where the old
                // expression drew the whole card green.
                const { cleared, tally } = play(q, i => i > 0);
                const byLastConclusion = q.userAnswer !== undefined && q.userAnswer === q.isValid;

                if (tally.asked > 1) {
                    caught++;
                    if (cleared) note(`${type}: a missed conclusion still cleared the item`);
                    if (itemWasRight(q)) note(`${type}: a missed conclusion still read as all right`);
                    if (!byLastConclusion) {
                        note(`${type}: the old expression did not disagree, so this proves nothing`);
                    }
                    if (tally.right !== tally.asked - 1) {
                        note(`${type}: ${tally.right} of ${tally.asked} counted after one miss`);
                    }
                }
            }
        });
    }

    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
    assert(caught > 80, `only ${caught} multi-conclusion items reached the check`);
});

test("a timeout is not a wrong answer, and does not erase what was answered", () => {
    const ctx = context();
    const faults: string[] = [];
    let withEarlier = 0;

    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        seeded(4242, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); }
                catch { continue; }

                // Take the first conclusion, then let the clock run out.
                const answeredEarlier = hasNextClaim(q);
                if (answeredEarlier) takeSeriesAnswer(q, rightFor(q));
                q.userAnswer = undefined;
                judgeItem(q, undefined);

                const t = itemTally(q);
                if (!t.timedOut) faults.push(`${type}: a timeout was not marked as one`);
                if (itemWasRight(q)) faults.push(`${type}: a timeout read as all right`);
                if (answeredEarlier) {
                    withEarlier++;
                    if (t.right < 1) {
                        faults.push(`${type}: a conclusion answered before the clock stopped was discarded`);
                    }
                }
            }
        });
    }

    equal(faults.length, 0, `\n  ${faults.slice(0, 8).join("\n  ")}`);
    assert(withEarlier > 40, `only ${withEarlier} timeouts had an earlier conclusion`);
});
