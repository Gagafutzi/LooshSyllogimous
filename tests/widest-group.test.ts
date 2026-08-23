/**
 * Widest Group — the reform of Oddest Relation. See fixes/5.2.
 *
 * The verification that matters is a solver reading only the rendered tables:
 * it re-derives every spread from the numbers on screen and has to agree with
 * the answer the generator marked. That is a second implementation of the whole
 * question, which is the point — the generator builds the item backwards from
 * the answer it wants, and a construction that is wrong about its own output is
 * exactly what nobody would notice.
 */

import { assert, equal, seeded, test } from "./harness";
import { createWidestGroup } from "../src/app/syllogimous/generators/widest-group";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const FULL = ladderFor(EnumQuestionType.WidestGroup);

function context(rungs: string[]): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: (_t: string, r: string) => rungs.includes(r),
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/**
 * The numbers off one rendered group table, as a solver would read them.
 *
 * Rows after the header, cells after the row's name — nothing about how the
 * item was built is used, which is the whole value of reading it back.
 */
function readGroup(html: string): number[][] {
    const body = html.slice(html.indexOf("<tbody>"));
    return [...body.matchAll(/<tr>[\s\S]*?<\/tr>/g)].map(([row]) =>
        [...row.matchAll(/<td>(-?\+?\d+)<\/td>/g)].map(m => Number(m[1].replace("+", ""))));
}

const spreads = (rows: number[][]) =>
    rows[0].map((_, d) => {
        const values = rows.map(r => r[d]);
        return Math.max(...values) - Math.min(...values);
    });

test("a solver reading the tables agrees with the answer", () => {
    for (const rungs of [[], FULL.slice(0, 4), FULL]) {
        seeded(2024, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 25; rep++) {
                const q = createWidestGroup(ctx, 4);
                const scores = q.premises.map(p => Math.max(...spreads(readGroup(p))));

                const best = Math.max(...scores);
                equal(scores.filter(v => v === best).length, 1,
                    `two groups tie for widest: ${scores.join(", ")}`);

                const answer = q.choices[q.correctChoice];
                if (answer.includes(">")) {
                    // Ranked: the stated order has to be the order of the scores.
                    const order = answer.split(">").map(s => Number(/\d+/.exec(s)![0]) - 1);
                    const sorted = [...order].sort((a, b) => scores[b] - scores[a]);
                    equal(order.join(","), sorted.join(","),
                        `the marked order is not the order of the spreads: ${answer}`);
                } else {
                    equal(answer, `Group ${scores.indexOf(best) + 1}`,
                        `the marked group is not the widest: ${answer} against ${scores.join(", ")}`);
                }
            }
        });
    }
});

/**
 * A group's own widest direction has to be its alone.
 *
 * Otherwise "which direction is this group widest on" has two answers, and a
 * reader who checks the other one is right and marked wrong — the failure a
 * trainer must not have.
 */
test("no group is tied with itself for widest", () => {
    seeded(77, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 30; rep++) {
            const q = createWidestGroup(ctx, 5);
            for (const p of q.premises) {
                const s = spreads(readGroup(p));
                const top = Math.max(...s);
                equal(s.filter(v => v === top).length, 1,
                    `a group is equally wide on two directions: ${s.join(", ")}`);
            }
        }
    });
});

/**
 * The margin is the difficulty, so it is drawn rather than left to chance.
 *
 * Left to chance the winner is usually obvious and occasionally tied, and tied
 * is worse than obvious.
 */
test("the lead over the runner-up is the one the rung asked for", () => {
    for (const [rungs, want] of [[[], 2], [["margin-1"], 1]] as Array<[string[], number]>) {
        seeded(313, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 30; rep++) {
                const q = createWidestGroup(ctx, 4);
                const scores = q.premises.map(p => Math.max(...spreads(readGroup(p)))).sort((a, b) => b - a);
                equal(scores[0] - scores[1], want,
                    `lead of ${scores[0] - scores[1]} where the rung asks for ${want}`);
            }
        });
    }
});

/** The ladder has to widen the item, or the rungs are decoration. */
test("the rungs add directions and groups", () => {
    const shape = (rungs: string[]) => {
        let dims = 0, groups = 0;
        seeded(9, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 15; rep++) {
                const q = createWidestGroup(ctx, 4);
                groups = Math.max(groups, q.premises.length);
                dims = Math.max(dims, spreads(readGroup(q.premises[0])).length);
            }
        });
        return { dims, groups };
    };

    const base = shape([]);
    const top = shape(FULL);
    equal(base.groups, 2, `the base state shows ${base.groups} groups, not two`);
    equal(base.dims, 2, `the base state uses ${base.dims} directions, not two`);
    assert(top.groups >= 4, `the full ladder reaches only ${top.groups} groups`);
    assert(top.dims >= 6, `the full ladder reaches only ${top.dims} directions`);
});

/**
 * The derivation has to name each group's widest direction, not just the
 * winner: the reader who got it wrong usually found one group's widest and not
 * another's, and that is the line they need.
 */
test("the derivation accounts for every group", () => {
    seeded(45, () => {
        const ctx = context(FULL.slice(0, 3));
        for (let rep = 0; rep < 20; rep++) {
            const q = createWidestGroup(ctx, 4);
            const named = q.explanation.filter(l => /is widest on/.test(l)).length;
            equal(named, q.premises.length,
                `${named} groups explained of ${q.premises.length}`);
        }
    });
});

/**
 * One marker for the whole item, not one per group.
 *
 * Every group is measured from the same point, which is what makes the tables
 * comparable at all: a group read from its own marker would put the same
 * arrangement at different numbers, and the reader would be comparing frames
 * rather than spreads.
 */
test("every group is measured from the same marker", () => {
    seeded(606, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 25; rep++) {
            const q = createWidestGroup(ctx, 4);

            const from = q.premises.map(p => /class="group__from">from (.*?)<\/th>/.exec(p)?.[1]);
            assert(from.every(Boolean), "a group's table does not say what it is measured from");
            equal(new Set(from).size, 1,
                `groups are measured from different markers: ${from.join(", ")}`);

            const marker = from[0]!;
            assert(q.setup.join(" ").includes(marker),
                "the marker is used in the tables but never introduced");
            assert(/never moves/.test(q.setup.join(" ")),
                "the item does not say the marker is fixed");
        }
    });
});

/**
 * The marker frames the numbers; it is not a member of any group.
 *
 * If it were, it would enter its group's minimum and maximum and change the
 * answer -- and a frame that is also a participant is not a frame.
 */
test("the marker is not one of the members", () => {
    seeded(707, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 20; rep++) {
            const q = createWidestGroup(ctx, 4);
            const marker = /class="group__from">from (.*?)<\/th>/.exec(q.premises[0])![1];
            for (const p of q.premises) {
                const body = p.slice(p.indexOf("<tbody>"));
                assert(!body.includes(marker),
                    "the marker appears as a row, so it counts towards a spread");
            }
        }
    });
});
