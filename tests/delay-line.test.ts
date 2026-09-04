/**
 * Delay line — read an arrangement now, judge it several screens later.
 *
 * The one demand the app did not have. Ordinary modes hand over the premises
 * and the conclusion together, so the holding is free; the stream keeps only a
 * handful of live relations. Neither asks you to keep a *whole finished
 * arrangement* intact while building another on top of it, which is what makes
 * this n-back over relational models rather than over letters.
 *
 * The properties below are what separate that from a long item with pauses.
 */

import { assert, equal, seeded, test } from "./harness";
import { composeDelayLine, HOLD_TEXT, DELAY_TYPES } from "../src/app/syllogimous/generators/delay-line";
import { advanceHold, hasNextClaim, isHoldClaim, itemTally, judgeItem, takeSeriesAnswer } from "../src/app/syllogimous/utils/answer.utils";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** `rounds + delay` arrangements of one mode, as the service supplies them. */
function sets(type: EnumQuestionType, count: number): Question[] {
    const ctx = context();
    const params = QUESTION_TYPE_SETTING_PARAMS[type];
    const out: Question[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 8) {
        try { out.push(BUILD[type](ctx, params.minNumOfPremises)); } catch { /* try again */ }
    }
    return out;
}

test("a run is the conclusions asked plus the screens it takes to fill and drain", () => {
    seeded(101, () => {
        for (const delay of [1, 2, 3, 4]) {
            for (const rounds of [1, 4, 9]) {
                const q = composeDelayLine(sets(EnumQuestionType.Distinction, rounds + delay), delay);
                equal(q.series.length, rounds + delay,
                    `delay ${delay}, ${rounds} conclusions`);
                const asks = q.series.filter(c => !c.holdOnly).length;
                equal(asks, rounds, `delay ${delay}: ${asks} conclusions for ${rounds} asked`);
                equal(q.series.slice(0, delay).every(c => c.holdOnly === true), true,
                    "the opening screens must ask nothing — there is nothing old enough yet");
            }
        }
    });
});

test("the arrangement being asked about is never the one on screen", () => {
    seeded(202, () => {
        const delay = 2, rounds = 6;
        const built = sets(EnumQuestionType.Distinction, rounds + delay);
        const q = composeDelayLine(built, delay);

        q.series.forEach((claim, i) => {
            if (claim.holdOnly) return;
            const asked = built[i - delay];
            equal(claim.text, asked.conclusion as string,
                `screen ${i} asked about the wrong arrangement`);
            equal(claim.isValid, asked.isValid, `screen ${i} carried the wrong truth`);

            const shown = i < rounds ? built[i] : null;
            if (shown) {
                assert(JSON.stringify(claim.premises) === JSON.stringify(shown.premises),
                    `screen ${i} shows the wrong arrangement`);
                assert(JSON.stringify(claim.premises) !== JSON.stringify(asked.premises),
                    `screen ${i} re-showed the arrangement it is asking about — `
                    + "which removes the entire demand while looking identical");
            } else {
                equal(claim.premises?.length, 0,
                    `screen ${i} showed a new arrangement after the last one was dealt`);
            }
        });
    });
});

test("a held screen is not a conclusion, and cannot be got wrong", () => {
    seeded(303, () => {
        const delay = 3, rounds = 5;
        const q = composeDelayLine(sets(EnumQuestionType.Distinction, rounds + delay), delay);

        // Play it exactly as the card does: hold the openers, answer the rest.
        let guard = 0;
        while (hasNextClaim(q) && guard++ < 100) {
            if (isHoldClaim(q)) advanceHold(q);
            else takeSeriesAnswer(q, q.isValid);
        }
        const cleared = judgeItem(q, q.isValid);
        assert(cleared, "every conclusion answered right and the run scored wrong");

        const t = itemTally(q);
        equal(t.asked, rounds, `${t.asked} conclusions counted for ${rounds} asked`);
        equal(t.right, rounds, "held screens were counted as answers");
    });
});

test("holding does not silently pass a conclusion", () => {
    seeded(404, () => {
        const delay = 2, rounds = 4;
        const q = composeDelayLine(sets(EnumQuestionType.Distinction, rounds + delay), delay);
        while (isHoldClaim(q)) advanceHold(q);
        equal(q.seriesAt, delay, "holding walked past a screen that was asking something");
        // Miss the first real conclusion; the run must not clear.
        takeSeriesAnswer(q, !q.isValid);
        let guard = 0;
        while (hasNextClaim(q) && guard++ < 100) takeSeriesAnswer(q, q.isValid);
        assert(!judgeItem(q, q.isValid), "a missed conclusion still cleared the run");
        equal(itemTally(q).right, rounds - 1, "the miss was not counted");
    });
});

test("every mode a delay line offers can actually build one", () => {
    const faults: string[] = [];
    seeded(505, () => {
        for (const type of DELAY_TYPES) {
            const built = sets(type, 5);
            if (built.length < 5) { faults.push(`${type}: only ${built.length} of 5 arrangements`); continue; }
            const q = composeDelayLine(built, 2);
            if (q.type !== type) faults.push(`${type}: composed as ${q.type}`);
            if (q.answerMode !== "boolean") faults.push(`${type}: answered as ${q.answerMode}`);
            q.series.forEach((c, i) => {
                if (!c.text) faults.push(`${type}: screen ${i} has nothing on it`);
                if (!c.holdOnly && c.text === HOLD_TEXT) {
                    faults.push(`${type}: screen ${i} asks the hold text as a question`);
                }
            });
        }
    });
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("a run is practice, not evidence", () => {
    seeded(606, () => {
        const q = composeDelayLine(sets(EnumQuestionType.Distinction, 6), 2);
        // The ability model prices premises and rungs; the delay is neither, so
        // feeding a run in would move the estimate on evidence it cannot read.
        equal(q.playgroundMode, true, "a delay line would teach the ability model");
    });
});
