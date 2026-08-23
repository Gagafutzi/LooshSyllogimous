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
import { axesForDimensions } from "../src/app/syllogimous/utils/ndspace.utils";

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
 * The positions off the rendered premises, as a reader would take them.
 *
 * Nothing about how the item was built is used: the direction words are decoded
 * the way the reader decodes them, from the axis vocabulary the premises are
 * written in, and the axis a clause belongs to comes from the colour class the
 * premise paints it with. What comes out is the coordinates, re-derived.
 */
const spreads = (rows: number[][]) =>
    rows[0].map((_, d) => {
        const values = rows.map(r => r[d]);
        return Math.max(...values) - Math.min(...values);
    });

function readGroups(premises: string[]): number[][][] {
    const scales = axesForDimensions(7);
    const groups: number[][][] = [];

    for (const line of premises) {
        if (!line.includes('class="subject"')) { groups.push([]); continue; }

        const coord = Array(7).fill(0);
        for (const [, slot, size, word] of line.matchAll(
            /<span class="relation dim dim-(\d+)">(\d+) ([^<]+)<\/span>/g)) {
            const axis = Number(slot) - 1;
            const scale = scales[axis];
            const sign = word === scale.direction[0] ? 1
                : word === scale.direction[1] ? -1 : 0;
            assert(sign !== 0, `"${word}" is not a direction of ${scale.name}`);
            coord[axis] = sign * Number(size);
        }
        groups[groups.length - 1].push(coord);
    }
    return groups.filter(g => g.length > 0);
}

test("a solver reading the premises agrees with the answer", () => {
    for (const rungs of [[], FULL.slice(0, 4), FULL]) {
        seeded(2024, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 25; rep++) {
                const q = createWidestGroup(ctx, 4);
                const scores = readGroups(q.premises).map(g => Math.max(...spreads(g)));

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
            for (const g of readGroups(q.premises)) {
                const s = spreads(g);
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
                const scores = readGroups(q.premises).map(g => Math.max(...spreads(g))).sort((a, b) => b - a);
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
                const read = readGroups(q.premises);
                groups = Math.max(groups, read.length);
                dims = Math.max(dims, spreads(read[0]).filter((_, d) =>
                    read.some(g => g.some(m => m[d] !== 0))).length);
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
            equal(named, readGroups(q.premises).length,
                `${named} groups explained of ${q.premises.length}`);
        }
    });
});

/**
 * One marker for the whole item, not one per group.
 *
 * Every group is stated against the same point, which is what makes them
 * comparable at all: a group read from its own marker would put the same
 * arrangement at different numbers, and the reader would be comparing frames
 * rather than spreads.
 */
test("every group is stated against the same marker", () => {
    seeded(606, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 25; rep++) {
            const q = createWidestGroup(ctx, 4);

            /*
             * Everything after "relative to", markup and all. The marker is a
             * glyph in a span of its own and `subj` wraps that, so the token is
             * nested markup rather than a bare word -- which is exactly why the
             * markers are *visual* in this family of modes.
             */
            const markers = new Set(q.premises
                .filter(p => p.includes("relative to"))
                .map(p => /relative to (.+)$/.exec(p)?.[1]));
            equal(markers.size, 1,
                `groups are stated against ${markers.size} different markers`);

            const marker = [...markers][0];
            assert(!!marker, "a premise does not say what it is stated against");
            const bare = marker!.replace(/<[^>]+>/g, "");
            assert(q.setup.join(" ").includes(bare),
                "the marker is used in the premises but never introduced");
            assert(/never moves/.test(q.setup.join(" ")),
                "the item does not say the marker is fixed");
        }
    });
});

/**
 * The marker frames the positions; it is not a member of any group.
 *
 * If it were, it would enter its group's minimum and maximum and change the
 * answer -- and a frame that is also a participant is not a frame.
 */
test("the marker is not one of the members", () => {
    seeded(707, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 20; rep++) {
            const q = createWidestGroup(ctx, 4);
            const marker = /relative to (.+)$/
                .exec(q.premises.find(p => p.includes("relative to"))!)![1]
                .replace(/<[^>]+>/g, "");
            for (const p of q.premises) {
                const named = /^<span class="subject">([^<]*)<\/span>/.exec(p)?.[1];
                assert(named !== marker, "the marker is stated as a member of a group");
            }
        }
    });
});
