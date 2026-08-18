/**
 * Composed spaces: colour assignment, clause order, and premise shape.
 *
 * These are the invariants the colour and axis-order work rests on, and all of
 * them are decidable from the strings the generator returns — no browser.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    AXIS_CHOICES, DIMENSION_AXES, axesForDimensions, buildNdLayout, medianByWidth,
    ndAxisColors, ndWidth, renderNdPremise, reorderAxisIds,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { AxisSpec } from "../src/app/syllogimous/utils/ndspace.utils";

const specs = (dims: number): AxisSpec[] =>
    axesForDimensions(dims).map(scale => ({ scale }));

test("every axis of a space gets its own colour slot", () => {
    for (const dims of [3, 4, 5, 6]) {
        const colors = ndAxisColors(specs(dims));
        equal(colors.length, dims, `${dims}D produced the wrong number of colours`);
        equal(new Set(colors).size, dims, `${dims}D repeated a colour`);
    }
});

test("a dimension keeps its colour across dimension counts", () => {
    // The point of assigning by identity: east is the same colour in a 3D item
    // and a 6D one, so the association survives between modes.
    const three = ndAxisColors(specs(3));
    const six = ndAxisColors(specs(6));
    equal(three[0], six[0], "east changed colour between 3D and 6D");
    equal(three[1], six[1], "north changed colour between 3D and 6D");
});

test("a dimension keeps its colour when the order changes", () => {
    const base = specs(6);
    const moved = reorderAxisIds(base.map(a => a.scale.id), "longitude-last")
        .map(id => ({ scale: AXIS_CHOICES.find(s => s.id === id)! }));

    const eastBefore = ndAxisColors(base)[base.findIndex(a => a.scale.id === "east")];
    const eastAfter = ndAxisColors(moved)[moved.findIndex(a => a.scale.id === "east")];
    equal(eastAfter, eastBefore, "east was repainted by being moved");
});

test("orderings rearrange without adding or dropping an axis", () => {
    const ids = DIMENSION_AXES[6].map(s => s.id);
    for (const how of ["spatial-first", "spatial-last", "longitude-last", "reverse"] as const) {
        const out = reorderAxisIds(ids, how);
        equal([...out].sort(), [...ids].sort(), `${how} changed the axis set`);
    }
});

test("longitude-last puts east at the end, spatial-last puts all three there", () => {
    const ids = DIMENSION_AXES[6].map(s => s.id);
    equal(reorderAxisIds(ids, "longitude-last").slice(-1), ["east"]);
    equal(reorderAxisIds(ids, "spatial-last").slice(-3).sort(), ["east", "north", "up"]);
    equal(reorderAxisIds(ids, "spatial-first"), ids, "spatial-first is not the preset order");
});

test("a full premise names every axis, each in its own colour", () => {
    seeded(7, () => {
        const axes = specs(6);
        const layout = buildNdLayout(["Ash", "Bell", "Cane", "Dune"], axes);
        const text = renderNdPremise(layout, layout.edges[0], false);

        const slots = [...text.matchAll(/dim-(\d)/g)].map(m => m[1]);
        equal(slots.length, 6, "a six-axis premise did not state six clauses");
        equal(new Set(slots).size, 6, "two clauses shared a colour");
        assert(text.includes('class="subject"'), "premise lost its subjects");
    });
});

test("a compact premise drops the no-difference clauses and keeps the rest coloured", () => {
    seeded(11, () => {
        const axes = specs(6);
        const layout = buildNdLayout(["Ash", "Bell", "Cane", "Dune"], axes);
        const full = renderNdPremise(layout, layout.edges[0], false);
        const compact = renderNdPremise(layout, layout.edges[0], false, { compact: true });

        const count = (s: string) => [...s.matchAll(/dim-\d/g)].length;
        assert(count(compact) <= count(full), "compact stated more clauses than full");
        assert(count(compact) > 0, "compact stated nothing at all");
    });
});

/**
 * Width variance, which was going straight into the ability posterior.
 *
 * Two composed-space items the model scores identically can differ twofold in
 * how much has to be held at once — six-dimensional items at six objects range
 * about 6.6 to 13.5 bits, sd near one. At roughly eleven levels for ten bits
 * that is about a level of noise against a psychometric slope of 1.6, so the
 * model is being told about difficulty its own scale does not represent.
 *
 * Keeping the median of a small batch cuts that without needing a bits-to-levels
 * coefficient: the coefficient is what a *dial* would need, and holding the
 * quantity steady is a different problem. What this checks is that it narrows
 * the spread *without moving the middle* — a fix that made items uniformly
 * easier would show the same reduced spread and would be wrong.
 */
test("keeping the median layout narrows width without shifting it", () => {
    const axes = axesForDimensions(6).map(scale => ({ scale }));
    const words = ["Ash", "Bee", "Cat", "Dog", "Elk", "Fox"];

    const spread = (xs: number[]) => {
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
        return { mean, sd };
    };

    const one = seeded(9137, () => {
        const out: number[] = [];
        for (let i = 0; i < 800; i++) out.push(ndWidth(buildNdLayout(words, axes, {})));
        return out;
    });

    const median = seeded(4451, () => {
        const out: number[] = [];
        for (let i = 0; i < 800; i++) {
            out.push(ndWidth(medianByWidth(
                Array.from({ length: 9 }, () => buildNdLayout(words, axes, {})))));
        }
        return out;
    });

    const a = spread(one), b = spread(median);

    assert(b.sd < a.sd * 0.65,
        `spread barely moved: sd ${a.sd.toFixed(2)} to ${b.sd.toFixed(2)}`);
    assert(Math.abs(b.mean - a.mean) < 0.3,
        `the middle moved as well as the spread: ${a.mean.toFixed(2)} to ${b.mean.toFixed(2)}`);
});
