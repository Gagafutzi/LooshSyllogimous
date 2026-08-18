/**
 * Spread as a dial, per axis as well as in aggregate.
 *
 * Width is not really one quantity. It is spread on the east-west axis, height
 * on the vertical one, how long a span the temporal one covers — and a reader
 * feels those separately: six positions on one axis is a different demand from
 * two positions on three axes, even where the totals match.
 *
 * The dial is a **percentile of what the configuration produces**, not a number
 * of bits, and that is what lets it work without the missing bits-to-levels
 * coefficient: "as wide as the widest tenth of what this produces" is
 * meaningful for any axis stack, object count and tie chance, where "8.5 bits"
 * means nothing until you know what 8.5 is wide for.
 */

import { assert, seeded, test } from "./harness";
import {
    axesForDimensions, buildNdLayout, medianByWidth, ndAxisWidths, ndWidth, pickByWidth,
} from "../src/app/syllogimous/utils/ndspace.utils";
import {
    DEFAULT_ABILITY, Trial, fitWidthCoefficient, levelOf, pCorrect,
} from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const AXES = () => axesForDimensions(4).map(scale => ({ scale }));
const WORDS = ["Ash", "Bee", "Cat", "Dog", "Elk", "Fox"];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

test("per-axis widths add up to the total", () => {
    seeded(4231, () => {
        const axes = AXES();
        for (let run = 0; run < 40; run++) {
            const layout = buildNdLayout(WORDS, axes, {});
            const parts = ndAxisWidths(layout);
            assert(parts.length === axes.length, "one figure per axis");
            assert(Math.abs(parts.reduce((a, b) => a + b, 0) - ndWidth(layout)) < 1e-9,
                "the parts do not sum to the whole");

            // And naming a subset measures only that subset.
            assert(Math.abs(ndWidth(layout, [1]) - parts[1]) < 1e-9,
                "scoping to one axis measured something else");
            assert(Math.abs(ndWidth(layout, [0, 2]) - (parts[0] + parts[2])) < 1e-9,
                "scoping to two axes measured something else");
        }
    });
});

test("the percentile moves width in the direction asked, monotonically", () => {
    const axes = AXES();
    const batch = () => Array.from({ length: 9 }, () => buildNdLayout(WORDS, axes, {}));

    const at = (pct: number) => seeded(pct * 977 + 13, () => {
        const out: number[] = [];
        for (let i = 0; i < 600; i++) out.push(ndWidth(pickByWidth(batch(), pct)));
        return mean(out);
    });

    const [narrow, middle, wide] = [at(10), at(50), at(90)];

    assert(narrow < middle && middle < wide,
        `not monotonic: ${narrow.toFixed(2)}, ${middle.toFixed(2)}, ${wide.toFixed(2)}`);
    assert(wide - narrow > 0.8,
        `the dial barely moves anything: ${(wide - narrow).toFixed(2)} bits end to end`);

    // 50 is the calibrated middle the noise fix established, so it must not
    // have drifted while the dial was built around it.
    const legacy = seeded(50 * 977 + 13, () => {
        const out: number[] = [];
        for (let i = 0; i < 600; i++) out.push(ndWidth(medianByWidth(batch())));
        return mean(out);
    });
    assert(Math.abs(legacy - middle) < 1e-9, "the default is no longer the median");
});

test("a scoped dial moves that axis and leaves the others alone", () => {
    /*
     * The point of scoping. Without it, asking for a long time axis could be
     * satisfied by a tall vertical one, and "temporal width" would mean nothing
     * more than "width".
     */
    const axes = AXES();
    const target = 3;
    const batch = () => Array.from({ length: 9 }, () => buildNdLayout(WORDS, axes, {}));

    const at = (pct: number) => seeded(pct * 313 + 7, () => {
        const scoped: number[] = [], rest: number[] = [];
        for (let i = 0; i < 600; i++) {
            const parts = ndAxisWidths(pickByWidth(batch(), pct, [target]));
            scoped.push(parts[target]);
            rest.push(parts.reduce((a, b, i2) => (i2 === target ? a : a + b), 0));
        }
        return { scoped: mean(scoped), rest: mean(rest) };
    });

    const narrow = at(10), wide = at(90);

    assert(wide.scoped - narrow.scoped > 0.4,
        `the named axis barely moved: ${narrow.scoped.toFixed(2)} to ${wide.scoped.toFixed(2)}`);
    assert(Math.abs(wide.rest - narrow.rest) < 0.15,
        `the other axes moved too: ${narrow.rest.toFixed(2)} to ${wide.rest.toFixed(2)}`);
});

/* ---------------- the coefficient ---------------- */

/** Answers from a world where each bit of width really costs `perBit` levels. */
function syntheticTrials(perBit: number, count: number, spreadSd: number, ability = 8): Trial[] {
    const type = EnumQuestionType.Space4D;
    const out: Trial[] = [];

    for (let i = 0; i < count; i++) {
        const premises = 3 + (i % 4);
        // Deterministic ±spread, so the sample has known variation.
        const widthDelta = ((i % 5) - 2) / 2 * spreadSd;

        const truth = levelOf({ type, premises, rungs: [], seconds: null }, DEFAULT_ABILITY)
            + perBit * widthDelta;

        out.push({
            type, premises, rungs: [], seconds: null,
            estimate: ability, guess: 0.5,
            correct: Math.random() < pCorrect(DEFAULT_ABILITY, ability, truth, 0.5),
            widthDelta,
        });
    }
    return out;
}

test("the width fit recovers a coefficient it was never told", () => {
    for (const planted of [0.5, 2.0]) {
        const fit = seeded(planted * 7919 + 3, () =>
            fitWidthCoefficient(syntheticTrials(planted, 6000, 1.2), DEFAULT_ABILITY));

        assert(!!fit, "no fit was produced from six thousand varied answers");
        assert(Math.abs(fit!.levelsPerBit - planted) < 0.6,
            `planted ${planted}, fitted ${fit!.levelsPerBit.toFixed(2)}`);
    }
});

test("with every item at the calibrated middle, the fit declines to guess", () => {
    /*
     * The honest answer, and the common one. At the default dial every item is
     * drawn at the median, so `widthDelta` is ~0 throughout and any coefficient
     * fits equally well — a number produced from that would be noise wearing a
     * decimal point.
     */
    const flat = seeded(97, () => fitWidthCoefficient(syntheticTrials(1.5, 6000, 0), DEFAULT_ABILITY));
    assert(flat === null, "a coefficient was reported from answers with no spread in them");

    const thin = seeded(98, () => fitWidthCoefficient(syntheticTrials(1.5, 6000, 0.2), DEFAULT_ABILITY));
    assert(thin === null, "a coefficient was reported from barely any spread");

    const few = seeded(99, () => fitWidthCoefficient(syntheticTrials(1.5, 40, 1.2), DEFAULT_ABILITY));
    assert(few === null, "a coefficient was reported from forty answers");
});
