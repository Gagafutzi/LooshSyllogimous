/**
 * The progression system against what it is *for*, rather than against itself.
 *
 * Every other test here checks a mechanism. These check the handful of things
 * the whole rework was undertaken to achieve, so that a change which quietly
 * gives one of them up fails loudly rather than passing every unit test around
 * it. They are deliberately coarse: each one is a sentence somebody said out
 * loud about what this should do.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    DEFAULT_ABILITY, DIALS, abilityEstimate, abilityUpdate, capDials, chooseConfig,
    dialSteps, dialsCost, initAbility, leversOf, needsAt, pCorrect,
} from "../src/app/syllogimous/utils/ability.utils";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";

const cfg = DEFAULT_ABILITY;
const TYPES = ORDERED_QUESTION_TYPES as EnumQuestionType[];

function optsFor(type: EnumQuestionType, target: number) {
    const p = QUESTION_TYPE_SETTING_PARAMS[type];
    return {
        minPremises: p.minNumOfPremises, maxPremises: p.maxNumOfPremises,
        ladder: ladderFor(type), target, structureBefore: 5, dials: dialsFor(type),
    };
}

/* ------------------------------------------------------------------ *
 * "Comfortable at any level means advance"                            *
 * ------------------------------------------------------------------ */

test("a player far past the old ceiling is measured where they are", () => {
    seeded(4242, () => {
        let state = initAbility(6, 4, cfg);
        const truth = 40;
        for (let i = 0; i < 500; i++) {
            const est = abilityEstimate(state, cfg);
            const level = est.level;
            state = abilityUpdate(
                state, level, 0.5, Math.random() < pCorrect(cfg, truth, level, 0.5), cfg);
        }
        const est = abilityEstimate(state, cfg);
        assert(Math.abs(est.level - truth) < 4,
            `true ability ${truth}, measured ${est.level.toFixed(1)} — the grid used to`
            + ` stop at ${cfg.maxLevel} and this is what that cost`);
    });
});

test("no counted lever is still an ordinal rung", () => {
    const counted = new Set(Object.values(DIALS).flatMap(d => d.was));
    const stale: string[] = [];
    for (const type of TYPES) {
        for (const rung of ladderFor(type)) {
            if (counted.has(rung)) stale.push(`${type}: ${rung}`);
        }
    }
    equal(stale.length, 0, `a counter is still a gate: ${stale.join(", ")}`);
});

test("every dial goes on costing past where its ladder slots stopped", () => {
    for (const [name, dial] of Object.entries(DIALS)) {
        const beyond = dial.steps.length + 3;
        assert(dialsCost({ [name]: beyond }) > dialsCost({ [name]: beyond - 1 }),
            `${name} stops costing after ${dial.steps.length} turns, which is the`
            + " ladder's ceiling wearing a dial's clothes");
    }
});

/* ------------------------------------------------------------------ *
 * "…but the model never asks for what cannot be built"                *
 * ------------------------------------------------------------------ */

/**
 * The other half, and the one that has broken twice. Removing the ladder's
 * ceiling was right; leaving the model with none at all had it ask for
 * fifty-six transformations on a five-premise item, and then — once the premise
 * cost per turn was fixed — six transformations *and* six edits on a
 * nine-premise item, which the generator builds as six edits and none.
 */
test("an unreachable target does not invent turns the item cannot carry", () => {
    for (const type of TYPES) {
        const choice = chooseConfig(type, optsFor(type, 500), cfg);
        const p = QUESTION_TYPE_SETTING_PARAMS[type];

        for (const [name, turns] of Object.entries(choice.dials ?? {})) {
            const dial = DIALS[name];
            assert(needsAt(dial, turns - 1) <= choice.premises,
                `${type}: ${turns} turns of ${name} needs`
                + ` ${needsAt(dial, turns - 1)} premises and the item has ${choice.premises}`);
            if (dial.max != null) {
                assert(turns <= dial.max, `${type}: ${name} went past its own ceiling`);
            }
        }

        // Dials drawing on one budget cannot exceed it between them.
        const shared: Record<string, number> = {};
        for (const [name, turns] of Object.entries(choice.dials ?? {})) {
            const key = DIALS[name]?.shares;
            if (key) shared[key] = (shared[key] ?? 0) + turns;
        }
        for (const [key, spent] of Object.entries(shared)) {
            assert(spent <= choice.premises - 3,
                `${type}: ${spent} turns drawn on "${key}" from a budget of`
                + ` ${choice.premises - 3}`);
        }

        assert(choice.premises <= p.maxNumOfPremises,
            `${type}: asked for more premises than the mode can state`);
    }
});

test("a shared budget is shared, not counted twice", () => {
    // Nine premises leaves six turns between edits and transformations.
    const both = capDials({ edits: 6, transforms: 6 }, 9);
    equal((both.edits ?? 0) + (both.transforms ?? 0), 6,
        `edits and transformations drew ${(both.edits ?? 0) + (both.transforms ?? 0)}`
        + " turns from a budget of six");
});

/* ------------------------------------------------------------------ *
 * "Nothing is priced by a guess"                                      *
 * ------------------------------------------------------------------ */

test("the unfitted coefficients are still nothing", () => {
    equal(cfg.widthPerBit, 0, "width was priced without a fit");
    equal(cfg.levelsPerUnneededPremise, 0, "depth shortfall was priced without a fit");
    equal(cfg.levelsPerCarousel, 0, "the carousel was priced without a fit");
});

/* ------------------------------------------------------------------ *
 * "Every mode can be stretched"                                       *
 * ------------------------------------------------------------------ */

test("aiming higher gives a harder item, in every mode", () => {
    const stuck: string[] = [];
    for (const type of TYPES) {
        const easy = chooseConfig(type, optsFor(type, 4), cfg);
        const hard = chooseConfig(type, optsFor(type, 30), cfg);
        if (!(hard.level > easy.level + 1)) {
            stuck.push(`${type} (${easy.level.toFixed(1)} -> ${hard.level.toFixed(1)})`);
        }
    }
    equal(stuck.length, 0, `\n  ${stuck.join("\n  ")}`);
});

/* ------------------------------------------------------------------ *
 * "Not always the same item"                                          *
 * ------------------------------------------------------------------ */

test("a settled player is not served one arrangement forever", () => {
    const type = EnumQuestionType.Space4D;
    const base = chooseConfig(type, optsFor(type, 12), cfg);
    const recent: Record<string, number> = {};
    for (const lever of leversOf(base, ladderFor(type))) recent[lever] = 6;
    const next = chooseConfig(type, { ...optsFor(type, 12), recent }, cfg);

    assert(leversOf(next, ladderFor(type)).join(",")
        !== leversOf(base, ladderFor(type)).join(","),
        "the same arrangement came back after six of them");
    equal(next.rungs + dialSteps(next.dials), base.rungs + dialSteps(base.dials),
        "variety was bought with less structure, which it must never be");
});
