/**
 * Under-specified composed spaces.
 *
 * Every composed-space item until now was fully determined by construction,
 * which means propagation solves it: scan the premises, intersect what they
 * allow, repeat, and it closes. Withholding a clause leaves several
 * arrangements satisfying the premises, and the claim becomes one of necessity.
 *
 * The claim this makes is strong — "no arrangement the premises allow is ruled
 * out either way" — and it is made from a cheap structural test rather than by
 * enumerating models. So the test here does not check the structural test
 * against itself. It builds the counter-arrangement explicitly: take everything
 * on one side of the break, slide it along the axis, and check that every
 * stated clause still holds while the claim's truth flips. If that
 * construction works, the item really is open.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace, ndFeatures } from "../src/app/syllogimous/generators/ndspace";
import {
    NdLayout, axesForDimensions, buildNdLayout, determinedOn, indeterminatePairs, withholdClauses,
} from "../src/app/syllogimous/utils/ndspace.utils";

function context(force: Record<string, unknown> = {}): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k in force ? force[k] : null),
            spread: () => null,
            axesFor: () => null, circularAxes: () => 0, depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0,
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

/** A layout with one clause withheld, built directly rather than via a mode. */
function openLayout(seed: number): NdLayout | null {
    return seeded(seed, () => {
        const axes = axesForDimensions(4).map(scale => ({ scale }));
        const layout = buildNdLayout(["Ash", "Bee", "Cat", "Dog", "Elk"], axes, {});
        const withheld = withholdClauses(layout, 2);
        return indeterminatePairs(withheld).length ? withheld : null;
    });
}

test("a withheld clause really does leave the relation open", () => {
    let proved = 0;

    for (let seed = 1; seed < 120 && proved < 25; seed++) {
        const layout = openLayout(seed * 131);
        if (!layout) continue;

        for (const { a, b, axis } of indeterminatePairs(layout)) {
            /*
             * The counter-arrangement: everything reachable from `a` using only
             * premises that mention this axis, slid a long way along it. Nothing
             * stated can notice, because every stated clause on this axis joins
             * two objects that moved together.
             */
            const near: Record<string, string[]> = {};
            for (const e of layout.edges) {
                if (e.stated && !e.stated[axis]) continue;
                (near[e.from] ??= []).push(e.to);
                (near[e.to] ??= []).push(e.from);
            }
            const group = new Set([a]);
            const queue = [a];
            while (queue.length) {
                const cur = queue.shift()!;
                for (const n of near[cur] ?? []) {
                    if (group.has(n)) continue;
                    group.add(n);
                    queue.push(n);
                }
            }

            assert(!group.has(b), `${a} and ${b} were called open but are connected`);

            for (const shift of [-40, 40]) {
                const moved: Record<string, number[]> = {};
                for (const w of layout.words) {
                    moved[w] = [...layout.coords[w]];
                    if (group.has(w)) moved[w][axis] += shift;
                }

                // Every stated clause still holds: this is a different
                // arrangement of the same premises, not a different item.
                for (const e of layout.edges) {
                    layout.axes.forEach((_, i) => {
                        if (e.stated && !e.stated[i]) return;
                        const before = layout.coords[e.to][i] - layout.coords[e.from][i];
                        const after = moved[e.to][i] - moved[e.from][i];
                        assert(before === after,
                            `sliding the group broke a stated clause on axis ${i}`);
                    });
                }
            }

            // And the two orders are both reachable, which is what "open" means.
            const low = layout.coords[a][axis] - 40 - layout.coords[b][axis];
            const high = layout.coords[a][axis] + 40 - layout.coords[b][axis];
            assert(Math.sign(low) !== Math.sign(high),
                `${a} sits the same side of ${b} in both arrangements`);
            proved++;
        }
    }

    assert(proved >= 25, `only ${proved} open pairs were proved open`);
});

test("a determined relation stays determined", () => {
    for (let seed = 1; seed < 60; seed++) {
        const layout = openLayout(seed * 977);
        if (!layout) continue;

        for (const w of layout.words) {
            layout.axes.forEach((_, ax) => {
                assert(determinedOn(layout, ax, w, w), "an object is open against itself");
            });
        }

        // Whatever is left connected on an axis is still pinned by the sum
        // along the path, so it must not be reported as open.
        const open = new Set(indeterminatePairs(layout).map(o => `${o.a}|${o.b}|${o.axis}`));
        for (const e of layout.edges) {
            layout.axes.forEach((_, ax) => {
                if (e.stated && !e.stated[ax]) return;
                assert(!open.has(`${e.from}|${e.to}|${ax}`) && !open.has(`${e.to}|${e.from}|${ax}`),
                    "a directly stated relation was called open");
            });
        }
    }
});

test("under-specification never runs alongside compact", () => {
    // Compact omits a clause to *state* levelness. Both live at once would give
    // one omission two incompatible meanings in the same sentence.
    const feat = ndFeatures(context({ indeterminate: true, compact: true }), EnumQuestionType.Space4D);
    assert(!feat.indeterminate, "both modifiers were live at once");
});

test("under-specified items say so, and are asked as necessity claims", () => {
    const ctx = context({ indeterminate: true });
    let open = 0, settled = 0;

    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 4441 + 3, () => createNdSpace(ctx, 4, EnumQuestionType.Space4D));

        assert(String(q.conclusion).includes("It must be true that"),
            `the claim was not asked as one of necessity: ${q.conclusion}`);
        assert(q.setup.some(l => l.includes("every")),
            "the rule was never stated to the player");

        if (q.explanation.some(l => l.includes("no route from"))) {
            assert(!q.isValid, "an open claim was marked true");
            open++;
        } else {
            settled++;
        }
    }

    // Both kinds have to be common, or the wording alone gives the answer away.
    assert(open >= 8 && settled >= 8, `${open} open and ${settled} settled out of 40`);
});
