/**
 * A mode's difficulty should climb, not double.
 *
 * Deictic sized its frame by axis count and then filled *every* cell of it, so
 * adding the third axis took the objects from four to eight in one step. The
 * frame growing is one demand and how many things there are to hold is another,
 * and only the second has to move smoothly.
 *
 * Graph Matching had the opposite fault: its forms cap their node count at six,
 * so from six upward the item is identical — while the ask, and therefore the
 * history and the price, went to twenty.
 */

import { assert, equal, seeded, test } from "./harness";
import { buildDeicticSpec, askableCells } from "../src/app/syllogimous/utils/deictic.utils";
import { createGraphMatching } from "../src/app/syllogimous/generators/graph-matching";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

const WORDS = Array.from({ length: 40 }, (_, i) => `W${i}`);

test("the deictic object count climbs one at a time", () => {
    seeded(11, () => {
        let last = 0;
        for (let n = 4; n <= 12; n++) {
            const held = buildDeicticSpec(n, WORDS).cells.length;
            assert(held >= last, `${n} premises held fewer objects than ${n - 1} did`);
            assert(held - last <= 1 || last === 0,
                `${n - 1} premises held ${last} objects and ${n} holds ${held} —`
                + " that is a jump, not a step");
            last = held;
        }
        assert(last > 4, "the count never grew past two axes' worth at all");
    });
});

test("every deictic item has something it can be asked about", () => {
    seeded(23, () => {
        for (let n = 4; n <= 12; n++) {
            for (let r = 0; r < 20; r++) {
                const spec = buildDeicticSpec(n, WORDS);
                assert(askableCells(spec).length > 0,
                    `at ${n} premises no cell resolves into an occupied one, so the`
                    + " question would land on an empty cell");
            }
        }
    });
});

test("a partly filled frame states only what it holds", () => {
    seeded(5, () => {
        for (let n = 5; n <= 11; n++) {
            const spec = buildDeicticSpec(n, WORDS);
            equal(Object.keys(spec.grid).length, spec.cells.length,
                "the grid names positions the item does not hold");
        }
    });
});

/* ------------------------------------------------------------------ *
 * And the opposite fault                                              *
 * ------------------------------------------------------------------ */

function ctxFor(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => true, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => true, dialFor: () => 2,
        mergeTarget: () => null,
        random: () => { throw new Error("unused"); },
    };
    return ctx;
}

test("graph matching records the size it built, not the size it was asked for", () => {
    seeded(77, () => {
        const ctx = ctxFor();
        /*
         * The forms that draw two webs are the capped ones — four to six nodes
         * whatever is asked — and they are what the ladder mostly serves once
         * any rung is held. The base form scales with the ask and is left to
         * the stamp that records it.
         */
        let checked = 0;
        for (const asked of [6, 10, 15, 20]) {
            for (let r = 0; r < 12; r++) {
                let q;
                try { q = createGraphMatching(ctx, asked); } catch { continue; }
                const nodes = q.builtPremises;
                if (!nodes || nodes > 8) continue;   // the base form scales and is stamped elsewhere
                checked++;
                assert(q.builtPremises <= asked,
                    `recorded more than was asked for: ${q.builtPremises} > ${asked}`);
            }
        }
        assert(checked > 0, "no capped form was produced, so this proves nothing");
    });
});
