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

/* ---------------- the loop, closed ---------------- */

import { ProgressionService } from "../src/app/syllogimous/services/progression.service";

/**
 * Measure, fit, apply — checked as one loop rather than three parts.
 *
 * Each piece passing on its own says nothing about whether the thing works: the
 * jitter could produce variation the fit cannot use, or the fit could produce a
 * coefficient nothing reads. What matters is whether a player's ability comes
 * out *right* in a world where width genuinely costs something, and that is
 * only visible end to end.
 *
 * So this plays a synthetic player through the real service. Their ability is
 * fixed and known; each item's true difficulty includes a width term the
 * service has never been told about; answers are drawn from the psychometric
 * function at that difficulty. If width goes unpriced, the posterior has to
 * explain the width-driven variation as ability and lands wide of the mark.
 */
function play(service: ProgressionService, opts: {
    trueWidthCost: number;
    ability: number;
    items: number;
    spreadSd: number;
}) {
    const type = EnumQuestionType.Space4D;

    for (let i = 0; i < opts.items; i++) {
        const chosen = service.configFor(type);
        // Deterministic sweep of the band, standing in for the jittered draw.
        const widthDelta = ((i % 7) - 3) / 3 * opts.spreadSd;

        const asked = levelOf({
            type, premises: chosen.premises,
            rungs: [], seconds: chosen.seconds,
        }, DEFAULT_ABILITY);
        const actual = asked + opts.trueWidthCost * widthDelta;

        const correct = Math.random() < pCorrect(DEFAULT_ABILITY, opts.ability, actual, 0.5);
        service.record(type, correct ? "right" : "wrong", 10, { widthDelta });
    }

    return service.estimateFor(type).level;
}

test("width priced from play, and the estimate is better for it", () => {
    const TRUE_COST = 2.5;
    const ABILITY = 9;

    const withWidth = seeded(20261, () => {
        localStorage.clear();
        const service = new ProgressionService();
        const level = play(service, {
            trueWidthCost: TRUE_COST, ability: ABILITY, items: 700, spreadSd: 0.45,
        });
        return { level, perBit: service.appliedWidthPerBit() };
    });

    assert(withWidth.perBit > 0,
        "seven hundred varied answers produced no coefficient at all");
    assert(Math.abs(withWidth.perBit - TRUE_COST) < 1.5,
        `charged ${withWidth.perBit.toFixed(2)} per bit against a true ${TRUE_COST}`);

    // The point of pricing it: the ability estimate stops absorbing width.
    const blind = seeded(20261, () => {
        localStorage.clear();
        const service = new ProgressionService();
        // Same world, but the width is never reported, so nothing can price it.
        const type = EnumQuestionType.Space4D;
        for (let i = 0; i < 700; i++) {
            const chosen = service.configFor(type);
            const widthDelta = ((i % 7) - 3) / 3 * 0.45;
            const asked = levelOf({
                type, premises: chosen.premises, rungs: [], seconds: chosen.seconds,
            }, DEFAULT_ABILITY);
            const correct = Math.random()
                < pCorrect(DEFAULT_ABILITY, ABILITY, asked + TRUE_COST * widthDelta, 0.5);
            service.record(type, correct ? "right" : "wrong", 10, {});
        }
        return service.estimateFor(type).level;
    });

    localStorage.clear();

    assert(Math.abs(withWidth.level - ABILITY) <= Math.abs(blind - ABILITY) + 0.5,
        `pricing width made the estimate worse: ${withWidth.level.toFixed(2)}`
        + ` against ${blind.toFixed(2)}, true ${ABILITY}`);
});

test("an unmeasured world is charged nothing, not something", () => {
    /*
     * The rule the rest of the difficulty table follows. A blank is honest; a
     * number nobody measured is not, and would compound — every answer would
     * then be read against a scale containing a guess.
     */
    const perBit = seeded(4001, () => {
        localStorage.clear();
        const service = new ProgressionService();
        // Every item at the calibrated middle, so there is nothing to learn.
        play(service, { trueWidthCost: 2.5, ability: 9, items: 400, spreadSd: 0 });
        return service.appliedWidthPerBit();
    });
    localStorage.clear();

    assert(perBit === 0, `charged ${perBit} per bit with no variation to learn from`);
});

test("a nonsensical fit is discarded rather than applied", () => {
    // A fit saying wide items are *easier* is a statement about the sample, not
    // about width, and acting on it would make the model worse as it went.
    const perBit = seeded(919, () => {
        localStorage.clear();
        const service = new ProgressionService();
        play(service, { trueWidthCost: -3, ability: 9, items: 500, spreadSd: 0.45 });
        return service.appliedWidthPerBit();
    });
    localStorage.clear();

    assert(perBit === 0, `charged ${perBit} per bit from a fit that ran backwards`);
});
