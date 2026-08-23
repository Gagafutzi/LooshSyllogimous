/**
 * How much of the premise set a conclusion needs.
 *
 * The complaint this file exists for: *"you didn't have to relate the whole
 * relation or near whole relation to reach the conclusion"*. Both pair pickers
 * were ported with v3's "usually the furthest, occasionally nearer" rule — a
 * 40% chance of dropping a band in the scale family, a flat 30% draw from every
 * pair in the composed spaces — on the reasoning that difficulty should vary.
 * It varies the wrong thing: a conclusion short of the diameter is reachable
 * without composing everything, and the premises that do not carry it are there
 * to be read and discarded.
 *
 * Tested on the pickers rather than on rendered items because the property is
 * about the *layout*, and a rendered premise list has already lost it — the
 * scramble means displayed order says nothing about graph distance.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    buildBranching, buildChain, graphDistance, pickDistantPair,
} from "../src/app/syllogimous/utils/linear.utils";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

/** Nothing switched on: no circular axes, no under-specification. */
function ndContext(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** The longest shortest path: what a full-depth conclusion has to span. */
function diameter(neighbors: Record<string, string[]>): number {
    const words = Object.keys(neighbors);
    let max = 0;
    for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
            const d = graphDistance(words[i], words[j], neighbors);
            if (Number.isFinite(d)) max = Math.max(max, d);
        }
    }
    return max;
}

test("a conclusion pair spans the whole layout, not part of it", () => {
    seeded(20260823, () => {
        for (let n = 3; n <= 9; n++) {
            const words = Array.from({ length: n + 1 }, (_, i) => `w${i}`);

            for (const layout of [buildChain(words), buildBranching(words)]) {
                const far = diameter(layout.neighbors);
                if (far < 2) continue;

                for (let rep = 0; rep < 60; rep++) {
                    const pair = pickDistantPair(layout);
                    assert(!!pair, `no pair at all on a ${n}-premise layout`);
                    equal(graphDistance(pair![0], pair![1], layout.neighbors), far,
                        `asked about a pair ${far} apart at most, got a shallower one`);
                }
            }
        }
    });
});

/**
 * Slack is for callers that need several distinct pairs, and nothing else.
 *
 * A layout usually holds one or two pairs at the diameter, so a second claim
 * demanding the same depth fails to generate rather than coming out slightly
 * shallower. Widening is bounded so "could not find a deep pair" can never
 * quietly become "asked about two adjacent objects".
 */
test("slack widens by exactly as much as it is asked to", () => {
    seeded(915, () => {
        const words = Array.from({ length: 9 }, (_, i) => `w${i}`);
        const layout = buildChain(words);
        const far = diameter(layout.neighbors);

        for (const slack of [0, 1, 2, 3]) {
            for (let rep = 0; rep < 80; rep++) {
                const pair = pickDistantPair(layout, slack);
                if (!pair) continue;
                const d = graphDistance(pair[0], pair[1], layout.neighbors);
                assert(d <= far, `a pair further apart than the diameter: ${d} > ${far}`);
                assert(d >= far - slack,
                    `slack ${slack} reached ${far - d} bands down, which is further than asked`);
            }
        }
    });
});

/**
 * The floor cannot be met by refusing to build.
 *
 * The first cut of this change made five configurations throw `Cannot
 * generate` — the depth was honoured by producing nothing, which is the one
 * outcome worse than a shallow conclusion.
 */
test("every layout that has a distant pair yields one", () => {
    seeded(3311, () => {
        for (let n = 2; n <= 12; n++) {
            const words = Array.from({ length: n + 1 }, (_, i) => `w${i}`);
            for (const layout of [buildChain(words), buildBranching(words)]) {
                if (diameter(layout.neighbors) < 2) continue;
                assert(!!pickDistantPair(layout),
                    `a ${n}-premise layout with a distant pair returned none`);
            }
        }
    });
});

/**
 * Width: an N-dimensional map deserves an N-dimensional conclusion.
 *
 * Seven premises' worth of relations and a conclusion naming one axis was the
 * other half of the same complaint, and it is a separate failure from depth —
 * that item was at full depth and one-seventh width. `buildNdConclusion` asked
 * about a single axis whatever the item was built on, and *which* axis had no
 * good answer, because any choice makes the rest of every premise decoration.
 *
 * Counted by axis colour rather than by parsing relation words: every clause is
 * painted with its axis's `dim-N` class, in the conclusion exactly as in the
 * premises, so the two are comparable without knowing any mode's vocabulary.
 */
const dims = (html: string) =>
    new Set([...html.matchAll(/\bdim-(\d+)\b/g)].map(m => m[1]));

test("a composed space asks about every axis it is built on", () => {
    const ctx = ndContext();
    let checked = 0;

    seeded(4242, () => {
        for (const type of [
            EnumQuestionType.Space3D, EnumQuestionType.Space4D,
            EnumQuestionType.Space5D, EnumQuestionType.Space6D,
            EnumQuestionType.Space7D,
        ]) {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = createNdSpace(ctx, 3, type); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                if (!conclusion || q.answerMode !== "boolean") continue;

                const stated = new Set<string>();
                for (const p of q.premises) for (const d of dims(p)) stated.add(d);
                if (stated.size < 2) continue;

                const asked = dims(conclusion);
                // The single-axis fallback is legitimate for the layouts that
                // cannot carry a wide claim, and there is no circular axis and
                // no under-specification here, so none of them should be.
                equal(asked.size, stated.size,
                    `${type}: premises name ${stated.size} axes, conclusion names ${asked.size}`);
                checked++;
            }
        }
    });

    assert(checked > 20, `only ${checked} items were wide enough to check`);
});

/**
 * Shape Rotation must not ask back a separation a premise stated.
 *
 * The reported item read: *Cord is 2 corners clockwise from Hostess* ... *the
 * square is turned 180 degrees* => *after the turns, Hostess is 2 corners
 * clockwise from Cord*. Two failures at once. The pair was one a premise
 * related directly, so the conclusion was that premise read back; and on a
 * square a separation of two is its own reverse, so naming either direction is
 * the same claim and the reversal in the wording changed nothing.
 *
 * The invariance the mode teaches is real -- a turn cannot change how two
 * objects sit relative to each other -- but it has to be applied to a relation
 * that took work to establish, or the item asks nothing.
 */
test("a rotation conclusion is not a premise read back", () => {
    const ctx = ndContext();
    let checked = 0;
    const subjectsOf = (html: string) =>
        [...html.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);

    seeded(6006, () => {
        for (let n = 4; n <= 8; n++) {
            for (let rep = 0; rep < 40; rep++) {
                let q;
                try { q = createShapeRotation(ctx, n); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                // The other form is a choice among corner names, and has none.
                if (!conclusion.includes("after the turns")) continue;

                const asked = subjectsOf(conclusion);
                if (asked.length !== 2) continue;
                const key = [...asked].sort().join(" ");

                for (const premise of q.premises) {
                    const named = subjectsOf(premise);
                    if (named.length !== 2) continue;   // an absolute placement
                    assert([...named].sort().join(" ") !== key,
                        `asked about ${asked.join(" / ")}, which a premise states outright`);
                }
                checked++;
            }
        }
    });

    assert(checked > 15, `only ${checked} relative-form items were produced`);
});
