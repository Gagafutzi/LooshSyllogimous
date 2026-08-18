/**
 * The map layout, ported from Syllogimous v3's explanation grid.
 *
 * All of it is decidable without drawing anything: given coordinates, which
 * cell does a word land in, how many planes are there, and does the picture
 * still describe the item after the operations have moved things.
 */

import { assert, equal, seeded, test } from "./harness";
import { buildQuestionMap, coordMapFromPositions, coordMapFromTuples } from "../src/app/syllogimous/utils/map.utils";
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
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        random: () => { throw new Error("not needed"); },
    };
}

/** Every word drawn anywhere in the map. */
const drawn = (m: ReturnType<typeof buildQuestionMap>) =>
    (m?.slices ?? []).flatMap(s => s.planes.flatMap(p => p.rows.flat().flat()));

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

test("past three axes, the rest become labelled slices", () => {
    // v3 hardcoded "Time N" for the fourth. The composed spaces here go to six,
    // so any further axis is labelled with its own name and value.
    const m = buildQuestionMap(
        { Early: [0, 0, 0, 0], Late: [0, 0, 0, 1] },
        ["East-west", "North-south", "Up-down", "Time"]);
    equal(m!.slices.length, 2);
    assert(m!.slices[1].label.includes("Time"), `slice label was "${m!.slices[1].label}"`);
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
