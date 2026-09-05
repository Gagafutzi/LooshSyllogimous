/**
 * The way an item is answered has to match the way it is scored.
 *
 * Reported from play: *"occasionally a correct answer gives me feedback that it
 * was wrong"*. It was Analogy, and it was not occasional so much as conditional.
 *
 * Analogy has no relation of its own — it takes a finished item from one of
 * five other modes, keeps its premises and **reuses the object**, overwriting
 * the conclusion with a claim of its own. Everything the inner mode set about
 * answering came with it. When the inner item carried the `construct-conclusion`
 * rung, `answerMode` was still "construct", so the card showed the construction
 * builder for a question the item no longer asked, and `checkConstruction`
 * compared "did you build that arrangement" against whether the analogy held.
 * A right answer was scored wrong and a wrong one right.
 *
 * The series half of this was found and fixed once already, which is the reason
 * for a general test rather than a second specific one: the fix cleared the
 * series and left the rest of the same apparatus behind. So the invariant is
 * stated for every mode instead —
 *
 *   `answerMode` says how the item is answered, and nothing may be set that
 *   belongs to a different way of answering it.
 *
 * `tsc` cannot see any of this: every field is on every Question, and a stale
 * one is a value rather than a type error.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    hasNextClaim, judgeItem, takeSeriesAnswer,
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

function context(everyRung: boolean): GeneratorContext {
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
            hasRung: () => everyRung, depthBonusFor: () => 0,
            dialFor: () => (everyRung ? 2 : 0),
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => everyRung,
        // "Every rung" meant every dial too, back when they were rungs: two
        // turns each, which is as far as the ladder ever allowed.
        dialFor: () => (everyRung ? 2 : 0),
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/**
 * Every fault, checked against one item.
 *
 * Returned as sentences rather than thrown, so one run reports everything that
 * is wrong across every mode instead of the first thing it meets.
 */
function faultsIn(q: Question): string[] {
    const out: string[] = [];
    const mode = q.answerMode;

    const noChoices = () => {
        if (q.choices.length) out.push(`${mode}: carries ${q.choices.length} options`);
        if (q.correctChoice !== -1) out.push(`${mode}: carries a correct option`);
        if (q.choiceGrids?.length) out.push(`${mode}: carries option grids`);
    };
    const noConstruct = () => {
        if (q.construct.length) out.push(`${mode}: carries ${q.construct.length} build claims`);
    };
    const noMap = () => {
        if (q.mapTargets.length) out.push(`${mode}: carries ${q.mapTargets.length} map targets`);
    };

    /*
     * Everything but "boolean" is scored as "did you get it right", which
     * `checkQuestion` compares against `isValid` — so `isValid` has to be true
     * or a correct answer is scored wrong. The comment on `checkChoice` calls
     * this true by construction; this is the part that checks it.
     */
    if (mode !== "boolean" && q.isValid !== true) {
        out.push(`${mode}: isValid is false, so a correct answer scores wrong`);
    }

    if (mode === "boolean") {
        noChoices(); noConstruct(); noMap();
        if (!q.conclusion || (Array.isArray(q.conclusion) && !q.conclusion.length)) {
            out.push("boolean: nothing to judge");
        }
    }
    if (mode === "choice") {
        noConstruct(); noMap();
        if (q.choices.length < 2) out.push(`choice: ${q.choices.length} options to pick from`);
        if (!(q.correctChoice >= 0 && q.correctChoice < q.choices.length)) {
            out.push(`choice: correct option ${q.correctChoice} of ${q.choices.length}`);
        }
    }
    if (mode === "construct") {
        noChoices(); noMap();
        if (!q.construct.length) out.push("construct: nothing to build");
    }
    if (mode === "map") {
        noChoices(); noConstruct();
        if (!q.mapTargets.length) out.push("map: nothing to match");
        if (q.mapAnswer.length !== q.mapTargets.length) {
            out.push(`map: ${q.mapTargets.length} targets and ${q.mapAnswer.length} answers`);
        }
    }

    /*
     * A series is answered on one card, and advancing swaps the claim's text,
     * truth, options, prompt and premises — and nothing else. So every claim
     * has to be answerable the same way the item is, and the two modes whose
     * apparatus the advance cannot swap may not carry one at all.
     */
    if (q.series.length === 1) out.push("a series of one claim");
    for (const [i, claim] of q.series.entries()) {
        if (mode === "construct" || mode === "map") {
            out.push(`${mode}: a series the card cannot advance`);
            break;
        }
        if (mode === "choice") {
            if (!claim.choices?.length) out.push(`choice: claim ${i} has no options of its own`);
            else if (!(claim.correctChoice != null
                && claim.correctChoice >= 0 && claim.correctChoice < claim.choices.length)) {
                out.push(`choice: claim ${i} has correct option ${claim.correctChoice}`);
            }
            if (claim.isValid !== true) out.push(`choice: claim ${i} is scored as false`);
        }
        if (mode === "boolean") {
            if (claim.choices) out.push(`boolean: claim ${i} carries options the card cannot show`);
            if (!claim.text) out.push(`boolean: claim ${i} has nothing to judge`);
            if (typeof claim.isValid !== "boolean") out.push(`boolean: claim ${i} has no truth`);
        }
    }

    return out;
}

for (const everyRung of [false, true]) {
    test(`every mode is answered the way it is scored, rungs ${everyRung ? "on" : "off"}`, () => {
        const ctx = context(everyRung);
        const faults: string[] = [];
        const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };

        for (const type of Object.values(EnumQuestionType)) {
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            seeded(4242, () => {
                for (let rep = 0; rep < 60; rep++) {
                    let q: Question;
                    try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); }
                    catch { continue; }
                    for (const fault of faultsIn(q)) note(`${type} — ${fault}`);
                }
            });
        }

        equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
    });
}

/**
 * The mode the report came from, on its own, because it is the only mode that
 * can inherit an apparatus rather than build one.
 */
test("an analogy is answered as a true-or-false, whatever it borrowed", () => {
    for (const everyRung of [false, true]) {
        const ctx = context(everyRung);
        seeded(77, () => {
            for (let rep = 0; rep < 60; rep++) {
                let q: Question;
                try { q = BUILD[EnumQuestionType.Analogy](ctx, 3 + (rep % 3)); }
                catch { continue; }
                equal(q.answerMode, "boolean",
                    "an analogy inherited the way the borrowed item was answered");
                assert(!q.construct.length && !q.choices.length && !q.mapTargets.length,
                    "an analogy inherited an apparatus it does not use");
                assert(!q.series.length, "an analogy inherited a series");
            }
        });
    }
});

/**
 * The report itself, walked: answer every claim the way the item says is right,
 * and it has to come out right.
 *
 * This is the level above the invariants — those say the apparatus agrees with
 * the answer mode, this says the answer flow agrees with the item. It is what
 * makes the Analogy fault a *failing test* rather than a suspicious field: an
 * inherited "construct" mode is scored by `checkConstruction`, which passes
 * "did you build it", and the item was judged against whether the analogy held.
 *
 * How a right answer is produced is deliberately the item's own account of
 * itself — `isValid` for a judgement, `correctChoice` for a pick — because the
 * report is not that the truth was computed wrongly. It is that a player who
 * answered as the item intended was told otherwise, and every layer between
 * those two is what this walks.
 */
function answerRight(q: Question): boolean {
    /*
     * Picking, construction and matching are all scored the same way: the
     * player either produced what the item asked for or did not, and the
     * caller passes that as the boolean. So a right answer is `true` — the
     * "isValid is true by construction" the invariants above check.
     */
    return q.answerMode === "boolean" ? q.isValid : true;
}

for (const everyRung of [false, true]) {
    test(`answering every claim right scores the item right, rungs ${everyRung ? "on" : "off"}`, () => {
        const ctx = context(everyRung);
        const faults: string[] = [];
        const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };
        let walked = 0, withSeries = 0;

        for (const type of Object.values(EnumQuestionType)) {
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            seeded(31337, () => {
                for (let rep = 0; rep < 40; rep++) {
                    let q: Question;
                    try { q = BUILD[type](ctx, params.minNumOfPremises + (rep % 3)); }
                    catch { continue; }
                    walked++;
                    if (q.series.length) withSeries++;

                    // Every claim but the last, exactly as the screen does it.
                    let guard = 0;
                    while (hasNextClaim(q) && guard++ < 10) {
                        const right = takeSeriesAnswer(q, answerRight(q));
                        if (!right) note(`${type}: a claim answered as the item asked was marked wrong`);
                    }
                    if (!judgeItem(q, answerRight(q))) {
                        note(`${type}: every claim answered right and the item scored wrong`);
                    }
                }
            });
        }

        equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
        assert(walked > 500, `only ${walked} items walked`);
        assert(withSeries > 100, `only ${withSeries} of them asked more than one claim`);
    });
}

/** And the other way round, or "right" would be a word the scoring never uses. */
test("answering a claim wrongly scores the item wrong", () => {
    const ctx = context(true);
    let seen = 0;

    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        seeded(5150, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises); } catch { continue; }
                if (!q.series.length) continue;
                seen++;

                // Wrong on the first claim, right on every one after it.
                let first = true, guard = 0;
                while (hasNextClaim(q) && guard++ < 10) {
                    takeSeriesAnswer(q, first ? !answerRight(q) : answerRight(q));
                    first = false;
                }
                const verdict = judgeItem(q, first ? !answerRight(q) : answerRight(q));
                assert(!verdict, `${type}: a claim answered wrongly still scored the item right`);
            }
        });
    }

    assert(seen > 50, `only ${seen} series items to fail`);
});
