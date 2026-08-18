/**
 * Measuring the rung costs instead of arguing about them.
 *
 * `RUNG_COST` is hand-written and wrong in detail — the comment on it says so.
 * The point of a fit is not that it is clever but that it is *checkable*, so
 * this test does the only check that matters: generate answers from a world
 * where a rung's true cost is some number the fitter has never been told, and
 * see whether it comes back with that number.
 *
 * A fit that cannot recover a planted value has nothing to say about a real
 * one, however reasonable its output looks.
 */

import { assert, seeded, test } from "./harness";
import {
    DEFAULT_ABILITY, RUNG_COST, Trial, fitRungCosts, levelOf, pCorrect,
} from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

/**
 * Answers from a world where `branching` really costs `trueCost`.
 *
 * The player's ability is fixed and known; each item's difficulty is computed
 * with the planted cost, and the answer is drawn from the psychometric function
 * at that difficulty. Nothing else differs from what the app records.
 */
function syntheticTrials(trueCost: number, count: number, ability = 8): Trial[] {
    const type = EnumQuestionType.Space4D;
    const out: Trial[] = [];

    for (let i = 0; i < count; i++) {
        const premises = 3 + (i % 4);
        const carries = i % 2 === 0;
        const rungs = carries ? ["branching"] : [];

        const truth = levelOf({ type, premises, rungs: [], seconds: null }, DEFAULT_ABILITY)
            + (carries ? trueCost : 0);
        const p = pCorrect(DEFAULT_ABILITY, ability, truth, 0.5);

        out.push({
            type, premises, rungs, seconds: null,
            estimate: ability, guess: 0.5,
            correct: Math.random() < p,
        });
    }
    return out;
}

test("the fit recovers a cost it was never told", () => {
    for (const planted of [0.3, 1.4, 2.6]) {
        const fits = seeded(planted * 10000 + 7, () =>
            fitRungCosts(syntheticTrials(planted, 4000), DEFAULT_ABILITY));

        const branching = fits.find(f => f.rung === "branching");
        assert(!!branching, "the rung the trials were about was not fitted");
        assert(Math.abs(branching!.fitted - planted) < 0.35,
            `planted ${planted}, fitted ${branching!.fitted.toFixed(2)}`);
    }
});

test("a rung with too little evidence is not reported at all", () => {
    // Silence is the right answer below the threshold. Reporting a number from
    // forty trials would be worse than the guess it claims to replace.
    const fits = seeded(31, () => fitRungCosts(syntheticTrials(1.0, 80), DEFAULT_ABILITY, 60));
    assert(!fits.some(f => f.rung === "branching"),
        "a fit was reported from forty items carrying the rung");

    const enough = seeded(31, () => fitRungCosts(syntheticTrials(1.0, 400), DEFAULT_ABILITY, 60));
    assert(enough.some(f => f.rung === "branching"), "a well-evidenced rung was skipped");
});

test("the fit says nothing about rungs the trials never carried", () => {
    const fits = seeded(77, () => fitRungCosts(syntheticTrials(1.0, 2000), DEFAULT_ABILITY));
    for (const f of fits) {
        assert(f.rung === "branching",
            `${f.rung} was fitted, but no trial carried it`);
    }
});

test("the residual points the same way as the correction", () => {
    /*
     * A rung answered better than predicted is one the model overcharges for,
     * so a positive residual must come with a fitted cost *below* the table.
     * Getting this backwards would produce a fit that walks the wrong way,
     * which no amount of data would fix.
     */
    const planted = 0.2;
    const fits = seeded(4099, () => fitRungCosts(syntheticTrials(planted, 4000), DEFAULT_ABILITY));
    const f = fits.find(x => x.rung === "branching")!;

    assert(f.current === RUNG_COST["branching"], "the fit misreported the current value");
    assert(f.residual > 0, `expected an easy rung to read easy, got ${f.residual.toFixed(3)}`);
    assert(f.fitted < f.current, "an easier-than-modelled rung was not made cheaper");
});
