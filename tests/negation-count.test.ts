/**
 * An item that negates a premise says how many times it did.
 *
 * `question.negations` is what the CSV export reports and what any later
 * analysis of negation would read. Every generator increments its own — except
 * the arrangement path, which negated relations through a shared helper and
 * left the count at zero, so Linear and Circular Arrangement items came out
 * carrying negated text and claiming no negations.
 *
 * Nothing noticed because the count is only ever *written*: the app does not
 * read it back, so a wrong value costs nothing until somebody analyses the
 * archive and finds a mode that apparently never negates.
 */

import { assert, equal, seeded, test } from "./harness";
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
import { countNegations } from "../src/app/syllogimous/utils/phrasing";

function ctxOf(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("negation", true);
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => true, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => true,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/*
 * The mark negation leaves on the rendered text, read by the helper that lives
 * beside the one that writes it.
 *
 * This test used to match `class="is-negated"` literally, which is not the only
 * way that class is written: Analogy's conclusion carries a layout class beside
 * it. So the one mode whose count this test was reporting on was the one mode
 * whose negations it could not see.
 */
function textsOf(q: Question): string[] {
    return [...q.premises, String(q.conclusion ?? ""), ...q.choices,
            ...q.series.flatMap(c => [c.text, ...(c.premises ?? [])])];
}

const isNegated = (q: Question) => countNegations(textsOf(q)) > 0;

test("a mode that renders a negation counts it", () => {
    const ctx = ctxOf();
    const faults: string[] = [];
    const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };

    for (const type of Object.values(EnumQuestionType)) {
        if (!BUILD[type]) continue;
        let negatedItems = 0, counted = 0;
        seeded(808, () => {
            const p = QUESTION_TYPE_SETTING_PARAMS[type];
            for (let r = 0; r < 60; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, p.minNumOfPremises + (r % 3)); } catch { continue; }
                if (!isNegated(q)) continue;
                negatedItems++;
                if (q.negations > 0) counted++;
            }
        });
        if (!negatedItems) continue;
        if (counted < negatedItems) {
            note(`${type}: ${negatedItems - negatedItems + (negatedItems - counted)} of ${negatedItems} `
                + `negated items reported no negations`);
        }
    }

    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("an item with no negation does not claim one", () => {
    const ctx = ctxOf();
    const faults: string[] = [];
    seeded(909, () => {
        for (const type of Object.values(EnumQuestionType)) {
        if (!BUILD[type]) continue;
            const p = QUESTION_TYPE_SETTING_PARAMS[type];
            for (let r = 0; r < 40; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, p.minNumOfPremises); } catch { continue; }
                if (isNegated(q)) continue;
                if (q.negations > 0) {
                    faults.push(`${type}: counted ${q.negations} with nothing negated on the card`);
                }
            }
        }
    });
    assert(faults.length === 0, faults.slice(0, 4).join("; "));
});
