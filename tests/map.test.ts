/**
 * The map layout, ported from Syllogimous v3's explanation grid.
 *
 * All of it is decidable without drawing anything: given coordinates, which
 * cell does a word land in, how many planes are there, and does the picture
 * still describe the item after the operations have moved things.
 */

import { assert, equal, seeded, test } from "./harness";
import { buildQuestionMap, coordMapFromPositions, coordMapFromTuples } from "../src/app/syllogimous/utils/map.utils";
import {
    axesForDimensions, axisWordConflicts, buildNdConclusion, buildNdLayout, drawNdTransforms,
    isParity, mod, renderNdPremise, sameClass,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { createLinear } from "../src/app/syllogimous/generators/linear";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    return {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        random: () => { throw new Error("not needed"); },
    };
}

/** Every word drawn anywhere in the map. */
/**
 * Everything the map shows, whichever form it took.
 *
 * Above three axes the grid is replaced by a coordinate table, so a helper that
 * only reads slices would report an empty picture for exactly the maps that
 * needed replacing.
 */
const drawn = (m: ReturnType<typeof buildQuestionMap>) => [
    ...(m?.slices ?? []).flatMap(s => s.planes.flatMap(p => p.rows.flat().flat())),
    ...(m?.table?.rows ?? []).map(r => r.word),
];

test("a one-axis layout draws as a single row, in order", () => {
    const m = buildQuestionMap(coordMapFromPositions({ A: 2, B: 0, C: 1 }), ["Height"]);
    equal(m!.dims, 1);
    equal(m!.slices.length, 1);
    equal(m!.slices[0].planes.length, 1);
    equal(m!.slices[0].planes[0].rows.length, 1);
    equal(m!.slices[0].planes[0].rows[0], [["B"], ["C"], ["A"]], "not laid out low to high");
});

test("two axes draw as a grid, with up meaning up", () => {
    // Row order is reversed on purpose: the highest coordinate is drawn first,
    // because a map with north at the bottom is a map nobody can read.
    const m = buildQuestionMap({ Top: [0, 1], Bottom: [0, 0] }, ["East-west", "North-south"]);
    equal(m!.dims, 2);
    equal(m!.slices[0].planes[0].rows[0][0], ["Top"], "the higher coordinate is not the top row");
    equal(m!.slices[0].planes[0].rows[1][0], ["Bottom"]);
});

test("three axes stack into planes", () => {
    const m = buildQuestionMap({ Near: [0, 0, 0], Far: [0, 0, 2] }, ["X", "Y", "Z"]);
    equal(m!.slices.length, 1);
    equal(m!.slices[0].planes.length, 3, "the empty middle plane was dropped");
    assert(m!.slices[0].planes[0].label.includes("Z"), "planes are not labelled by their axis");
});

/**
 * Past three axes the map stops being a picture.
 *
 * It used to become labelled *slices* — one small grid per combination of the
 * axes past the third — which is a Cartesian product and unreadable by five
 * axes, let alone six. It is a table now, and the axis keeps its own name as a
 * column heading rather than appearing in a panel caption. See maptable.test.
 */
test("past three axes, the map becomes a table with a column per axis", () => {
    const m = buildQuestionMap(
        { Early: [0, 0, 0, 0], Late: [0, 0, 0, 1] },
        ["East-west", "North-south", "Up-down", "Time"]);
    equal(m!.slices.length, 0, "it still draws a stack of grids");
    assert(m!.table!.axes.includes("Time"), "the fourth axis lost its name");
    equal(drawn(m).sort(), ["Early", "Late"]);
});

test("two things at one coordinate share a cell", () => {
    const m = buildQuestionMap({ A: [1, 1], B: [1, 1] }, ["X", "Y"]);
    equal(m!.slices[0].planes[0].rows[0][0].sort(), ["A", "B"]);
});

test("an empty map draws nothing rather than an empty grid", () => {
    equal(buildQuestionMap({}), null);
    equal(buildQuestionMap({ A: [] }), null);
});

test("tuples from the older 3D modes convert cleanly", () => {
    const m = buildQuestionMap(coordMapFromTuples([["A", 0, 0, 0], ["B", 1, 1, 1]]), ["X", "Y", "Z"]);
    equal(m!.dims, 3);
    equal(drawn(m).sort(), ["A", "B"]);
});

test("a generated composed space plots every object exactly once", () => {
    for (let run = 0; run < 10; run++) {
        const q = seeded(run * 3319 + 7, () => createNdSpace(context(), 6, EnumQuestionType.Space4D));
        assert(!!q.wordCoordMap, "the generator kept no coordinates");
        const m = buildQuestionMap(q.wordCoordMap!, q.axisNames);
        const words = drawn(m).sort();
        equal(words, [...q.bucket].sort(), "the map and the item disagree about what is in it");
    }
});

test("a scale item plots on one axis, named after the scale", () => {
    for (let run = 0; run < 10; run++) {
        const q = seeded(run * 787 + 3, () => createLinear(context(), 5, EnumQuestionType.LinearVertical));
        const m = buildQuestionMap(q.wordCoordMap!, q.axisNames);
        equal(m!.dims, 1);
        equal(m!.across, "Height", "the axis was not named after its scale");
    }
});

test("every preset axis stack is readable", () => {
    /*
     * Two axes sharing a direction word make a premise that cannot be read at
     * all — "higher" twice, with nothing to say which dimension either belongs
     * to. Extending the preset past six pulls `vertical` off the choice list,
     * whose words are `quantity`'s exactly, which is why 7D needed a new scale
     * rather than the next spare.
     */
    for (const dims of [3, 4, 5, 6, 7]) {
        const clashes = axisWordConflicts(axesForDimensions(dims));
        equal(clashes, [], `${dims}D: ${clashes[0] ?? ""}`);
    }
});

test("a 7D item states seven clauses, each its own colour", () => {
    seeded(97, () => {
        const axes = axesForDimensions(7).map(scale => ({ scale }));
        const layout = buildNdLayout(["Ash", "Bell", "Cane", "Dune"], axes);
        const text = renderNdPremise(layout, layout.edges[0], false);
        const slots = [...text.matchAll(/dim-(\d)/g)].map(m => m[1]);
        equal(slots.length, 7, "a seven-axis premise did not state seven clauses");
        equal(new Set(slots).size, 7, "two of the seven shared a colour");
    });
});

/* ------------------------------------------------------------------ *
 * The parity axis — Distinction as a dimension                        *
 * ------------------------------------------------------------------ */

test("a parity axis has two classes and no distance", () => {
    const axes = axesForDimensions(7).map(scale => ({ scale }));
    const parity = axes.filter(a => isParity(a));
    equal(parity.length, 1, "7D should carry exactly one unordered axis");
    equal(parity[0].scale.name, "Distinction");
});

test("distinction folds to a class, however long the chain", () => {
    /*
     * The whole arithmetic of the axis: a step flips the class, an even number
     * of steps returns to it. Positions are reduced, so a ten-premise chain
     * still leaves every object in one of two classes rather than at ten
     * different places.
     */
    seeded(41, () => {
        const axes = axesForDimensions(7).map(scale => ({ scale }));
        const k = axes.findIndex(a => isParity(a));
        const words = ["A", "B", "C", "D", "E", "F"];
        const layout = buildNdLayout(words, axes);
        const classes = new Set(words.map(w => layout.coords[w][k]));
        assert([...classes].every(c => c === 0 || c === 1),
            `positions on the parity axis were ${[...classes].join(",")}`);
    });
});

test("same and opposite are the only claims it makes", () => {
    seeded(53, () => {
        const axes = axesForDimensions(7).map(scale => ({ scale }));
        const k = axes.findIndex(a => isParity(a));
        const layout = buildNdLayout(["A", "B", "C", "D"], axes);

        for (const want of [true, false]) {
            const c = buildNdConclusion(layout, "A", "C", k, want);
            const text = c.text.replace(/<[^>]+>/g, "");
            assert(/same kind|opposite kind/.test(text), `unexpected claim: ${text}`);
            equal(c.isValid, want, "the claim did not carry the truth it was asked for");
        }

        // And the truth is the parity of the difference, not a comparison.
        const truth = sameClass(layout, k, "A", "C");
        equal(truth, mod(layout.coords["A"][k] - layout.coords["C"][k], 2) === 0);
    });
});

test("nothing tries to move things along an axis with no distance", () => {
    // "moves 2 opposite kind" is not a sentence; parity axes are excluded from
    // the operations entirely.
    seeded(67, () => {
        const axes = axesForDimensions(7).map(scale => ({ scale }));
        const k = axes.findIndex(a => isParity(a));
        const layout = buildNdLayout(["A", "B", "C", "D", "E"], axes);
        for (const t of drawNdTransforms(layout, 6)) {
            const touched = t.dimensions ?? [t.dimension ?? 0];
            assert(!touched.includes(k), "a transformation acted on the parity axis");
            if (t.plane) assert(!t.plane.includes(k), "a rotation turned in the parity axis");
        }
    });
});
