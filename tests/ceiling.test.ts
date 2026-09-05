/**
 * There is no level at which the model stops being able to measure you.
 *
 * The posterior is a discrete grid, and it ran from `minLevel` to `maxLevel` —
 * so twenty-six was a ceiling on what anybody could be estimated at. A player
 * past it had their mass pile up in the top bin and could be measured no
 * higher, which meant no configuration was ever chosen for where they were.
 * That is a limit of the machinery reading as a claim about the player.
 *
 * The grid grows instead, and the array's own length is how far it has grown:
 * the floor and the spacing are fixed, so extending only appends and an old
 * posterior is a prefix of a longer one. Nothing is stored for it.
 */

import { assert, equal, test } from "./harness";
import {
    DEFAULT_ABILITY, abilityEstimate, abilityGrid, abilityUpdate, densityAt,
    growGrid, initAbility, levelStep, pCorrect,
} from "../src/app/syllogimous/utils/ability.utils";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const cfg = DEFAULT_ABILITY;

test("the grid keeps its floor and spacing however far it runs", () => {
    const short = abilityGrid(cfg);
    const long = abilityGrid(cfg, cfg.bins + 40);
    equal(long[0], short[0], "the floor moved when the grid grew");
    equal(long[1] - long[0], short[1] - short[0], "the spacing changed when it grew");
    for (let i = 0; i < short.length; i++) {
        equal(long[i], short[i], `point ${i} moved, so an old posterior is misread`);
    }
});

test("a player past the old ceiling is measured past it", () => {
    let state = initAbility(6, 4, cfg);
    // Someone far beyond where the grid used to stop, answering accordingly.
    const truth = 40;
    for (let i = 0; i < 300; i++) {
        const est = abilityEstimate(state, cfg);
        // Serve at the estimate, which is what a settled model does.
        const level = est.level;
        state = abilityUpdate(state, level, 0.5, pCorrect(cfg, truth, level, 0.5) > 0.5, cfg);
    }
    const est = abilityEstimate(state, cfg);
    assert(est.level > cfg.maxLevel + 5,
        `settled at ${est.level.toFixed(1)}, which is still inside the old ceiling`
        + ` of ${cfg.maxLevel}`);
});

test("growing pads with the tail, not with nothing", () => {
    /*
     * Built at the starting width with its mass against the top, which is the
     * shape a posterior took when the grid was too short for the player.
     * `initAbility` no longer produces one — it sizes the grid to the prior it
     * is given — so the case has to be constructed to be tested.
     */
    const state = {
        logPost: Array.from({ length: cfg.bins }, (_, i) => i * 0.5),
        trials: 40, lastSeen: Date.now(),
    };
    const grown = growGrid(state, cfg);
    assert(grown.logPost.length > state.logPost.length, "a prior at the top did not grow");
    equal(grown.logPost[grown.logPost.length - 1], state.logPost[state.logPost.length - 1],
        "the new tail is not a continuation of the old one");
    for (let i = 0; i < state.logPost.length; i++) {
        equal(grown.logPost[i], state.logPost[i], `growing changed point ${i}`);
    }
});

test("a settled posterior well inside the grid is left alone", () => {
    const state = initAbility(6, 2, cfg);
    equal(growGrid(state, cfg), state, "a posterior nowhere near the top was grown anyway");
});

/**
 * Reading past a posterior's own top is a flat continuation of its tail, which
 * is what `growGrid` says when it extends one. Reading `undefined` instead put
 * a NaN into the arithmetic, and a NaN estimate makes every comparison in
 * `chooseConfig` false — so the mode fell back to its first candidate, which is
 * the minimum.
 */
test("a shorter posterior is read past its top, not off the end", () => {
    const short = [-3, -2, -1];
    equal(densityAt(short, 2), -1, "the top point was misread");
    equal(densityAt(short, 99), -1, "past the top should continue the tail");
    assert(isFinite(densityAt(short, 99)), "reading past the top produced a NaN");
});

/* ------------------------------------------------------------------ *
 * And the way it is stored                                            *
 * ------------------------------------------------------------------ */

/**
 * The load guard demanded exactly `bins`, which was right while every grid was
 * that long. It discarded precisely the states belonging to the strongest
 * players and handed them the cold-start prior instead, so a mode of theirs
 * opened at two premises with no clock.
 */
test("a grown posterior survives being saved and loaded", () => {
    for (const level of [14, 20, 30, 45]) {
        localStorage.clear();
        const ov = new SettingsOverrideService();
        const prog = new ProgressionService(ov);
        prog.set("enabled", true);
        prog.applyCalibration(level, 60);

        const est = prog.estimateFor(EnumQuestionType.Distinction);
        assert(Math.abs(est.level - level) < 0.5,
            `calibrated to ${level} and read back ${est.level.toFixed(2)} — the`
            + " stored posterior was discarded");

        const choice = prog.configFor(EnumQuestionType.Distinction);
        assert(choice.premises > 2,
            `at level ${level} the mode opened at ${choice.premises} premises,`
            + " which is its floor");
    }
});

test("the starting grid is still what a new player gets", () => {
    const fresh = initAbility(6, 4, cfg);
    equal(fresh.logPost.length, cfg.bins,
        "a new player's grid is no longer the configured one");
    equal(levelStep(cfg), (cfg.maxLevel - cfg.minLevel) / (cfg.bins - 1),
        "the spacing is no longer derived from the configured grid");
});
