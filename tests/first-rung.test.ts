/**
 * What a mode asks of you the first time you meet it.
 *
 * A mode's floor is the card a player sees when they have just unlocked it and
 * know nothing about it. Several of the imported modes had floors that were not
 * first cards at all: Partial Analogy stated two systems and a complete kind
 * pairing — sixteen and a half lines — while its ladder said six, Partial
 * Isomorphism offered a menu of ten to select from, Odd Analogy carried four
 * analogies at every rung it had, and Cross-System Analogy started at nine
 * premises, the highest first rung in the app.
 *
 * None of that was a bug in the sense of a wrong answer. Each mode was correct,
 * generated reliably, and its ladder printed honest numbers. They were simply
 * modes whose easiest item was close to their hardest — no bottom step — and
 * that is invisible to every other test here, because every other test asks
 * whether an item is *right* rather than whether it can be *met*.
 *
 * So this measures the floor card, and it measures what the reader has to hold
 * rather than how many lines it takes to say it: eighteen arrow statements at
 * twenty characters each is a shorter read than twelve composed-space premises at
 * forty-five, and the count of lines says the opposite.
 *
 * **When this fails, the fix is not a bigger number here.** It is to find the
 * count inside the mode that the rung can step — the analogies, the entities a
 * side, the axes — and let the floor take the smaller one. That is what every one
 * of the modes named above did.
 */

import { assert, test, seeded } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { BUILD } from "./modes";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

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
            hasRung: () => false, depthBonusFor: () => 0, dialFor: () => 0,
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** What one rung of a mode puts in front of the reader. */
function weigh(type: EnumQuestionType, n: number, draws: number) {
    const ctx = context();
    let built = 0, chars = 0, worst = 0, lines = 0;
    for (let i = 0; i < draws; i++) {
        let q;
        try { q = BUILD[type](ctx, n); } catch { continue; }
        built++;
        const size = q.premises.reduce((s, l) => s + strip(l).length, 0);
        chars += size;
        lines += q.premises.length;
        worst = Math.max(worst, size);
    }
    return built
        ? { built, mean: chars / built, worst, lines: lines / built }
        : null;
}

/**
 * The worst first card, measured.
 *
 * **This is a backstop, not a proof.** It catches a mode shipping a first card
 * far outside what every other mode manages; it cannot tell whether any
 * particular floor is as small as it could be, because that is a judgement about
 * the mode rather than a property of it. Each of the modes this file's header
 * names is held to its own step by its own test — Odd Analogy's analogy count,
 * Partial Analogy's and Partial Isomorphism's entities a side — and those are the
 * checks that go red when a floor is put back.
 *
 * Six hundred and fifty, against a measured worst of 551 over four hundred draws:
 * Cross-System Analogy, which states two whole arrangements before it asks
 * anything and is the one mode here that cannot be made much smaller without
 * becoming a different question. The margin is for the randomness, not for a new
 * mode to grow into.
 */
const FLOOR_CAP = 650;

test("no mode's first rung is a wall", () => {
    const over: string[] = [];
    seeded(20261901, () => {
        for (const type of ORDERED_QUESTION_TYPES) {
            if (!BUILD[type]) continue;
            const n = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;
            const w = weigh(type, n, 25);
            if (!w) continue;
            if (w.worst > FLOOR_CAP) {
                over.push(`${type} at ${n} premises: ${Math.round(w.worst)} characters`);
            }
        }
    });

    assert(over.length === 0,
        "a mode's easiest item is more reading than a first card should be — step a "
        + "count inside the mode rather than raising the cap:\n  " + over.join("\n  "));
});

/**
 * And the floor really is the bottom of the ladder.
 *
 * A mode whose internal counts are clamped from below can have a floor that is
 * the same size as everything above it, which is the "same item, larger number"
 * failure several of these files already record — and a mode whose ladder runs
 * *backwards* is worse, because the rung a player is served as they improve is
 * the shorter one. Compared on the mean, since a single draw of a randomised
 * generator says nothing.
 */
test("the floor is no heavier than the ceiling, in every mode", () => {
    const wrong: string[] = [];
    seeded(20261902, () => {
        for (const type of ORDERED_QUESTION_TYPES) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            if (params.minNumOfPremises === params.maxNumOfPremises) continue;

            const low = weigh(type, params.minNumOfPremises, 20);
            const high = weigh(type, params.maxNumOfPremises, 20);
            if (!low || !high) continue;

            /* A tenth of slack: some modes are flat by design — the count is the
               menu or the space rather than the card — and randomness moves a
               mean by a few per cent either way. */
            if (low.mean > high.mean * 1.1) {
                wrong.push(`${type}: ${Math.round(low.mean)} characters at `
                    + `${params.minNumOfPremises} premises against ${Math.round(high.mean)} `
                    + `at ${params.maxNumOfPremises}`);
            }
        }
    });

    assert(wrong.length === 0,
        "a mode's easiest rung reads longer than its hardest, so improving serves a "
        + "smaller card:\n  " + wrong.join("\n  "));
});
