/**
 * The progression model, driven by players who are not the model's idea of one.
 *
 * `progression/simulate.ts` already drives the real functions, but its player is
 * a constant: one true ability, the same on every item, no learning and no
 * weaknesses. A model that tracks *that* is not yet known to track anybody.
 *
 * These are archetypes the model will actually meet — someone improving,
 * someone erratic, someone fine everywhere except one modifier, someone having
 * a bad week. Nothing here is reimplemented: it calls `chooseConfig`,
 * `levelOf`, `pCorrect` and `abilityUpdate` exactly as the app does.
 */

import { assert, test } from "./harness";
import {
    DEFAULT_ABILITY, abilityEstimate, abilityUpdate, chooseConfig, initAbility,
    levelOf, pCorrect, targetLevel,
} from "../src/app/syllogimous/utils/ability.utils";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";

const cfg = DEFAULT_ABILITY;
const TYPE = EnumQuestionType.LinearVertical;
const LADDER = ladderFor(TYPE);
const TARGET_P = 0.8;
const GUESS = 0.5;

/* ------------------------------------------------------------------ *
 * Players                                                             *
 * ------------------------------------------------------------------ */

interface Player {
    name: string;
    /** True ability in levels at the first item. */
    ability: number;
    /** Levels gained per item answered, until the ceiling. */
    learnPerItem?: number;
    ceiling?: number;
    /** Per-item jitter: attention, guessing, how the reading went. */
    noise?: number;
    /** Extra levels of difficulty when the item carries this modifier. */
    weakAt?: Record<string, number>;
    /** A bad patch: how often one starts, how deep, how long. */
    slump?: { chance: number; depth: number; length: number };
}

const PLAYERS: Player[] = [
    { name: "beginner, steady", ability: 3, noise: 0.4 },
    { name: "middling, steady", ability: 8, noise: 0.5 },
    { name: "strong, steady", ability: 15, noise: 0.5 },
    { name: "fast learner", ability: 4, learnPerItem: 0.05, ceiling: 16, noise: 0.5 },
    { name: "slow learner", ability: 4, learnPerItem: 0.01, ceiling: 10, noise: 0.5 },
    { name: "erratic", ability: 9, noise: 2.0 },
    { name: "weak at negation", ability: 10, noise: 0.5, weakAt: { negation: 4 } },
    { name: "weak at meta", ability: 12, noise: 0.5, weakAt: { meta: 5 } },
    {
        name: "prone to slumps", ability: 10, noise: 0.5,
        slump: { chance: 0.02, depth: 4, length: 15 },
    },
];

/* ------------------------------------------------------------------ *
 * Running one                                                         *
 * ------------------------------------------------------------------ */

function lcg(seed: number) {
    let s = seed;
    return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Box-Muller, so the jitter is a real distribution rather than a uniform. */
function gauss(rand: () => number) {
    const u = Math.max(1e-9, rand());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

interface Run {
    /** Where the model ended up, against where the player actually was. */
    estimate: number;
    sd: number;
    truth: number;
    /** Fraction correct over the second half, against the target it aimed at. */
    accuracy: number;
    /** Mean served level over the second half. */
    served: number;
    /** How often the ladder's prefix forced a rung the player is weak at. */
    weakShare: number;
}

function run(player: Player, seed: number, items = 400): Run {
    const rand = lcg(seed);
    const params = QUESTION_TYPE_SETTING_PARAMS[TYPE];

    let state = initAbility(6, 4, cfg);
    let learned = 0;
    let slumpLeft = 0;
    let right = 0, asked = 0, servedSum = 0, weak = 0;

    for (let i = 0; i < items; i++) {
        const est = abilityEstimate(state, cfg);
        // Exactly what the service does: aim below the estimate while unsure.
        const cautious = { ...est, level: est.level - cfg.caution * est.sd };
        const target = targetLevel(cautious, TARGET_P, GUESS, cfg);
        const choice = chooseConfig(TYPE, {
            minPremises: params.minNumOfPremises,
            maxPremises: params.maxNumOfPremises,
            ladder: LADDER,
            target,
            structureBefore: 5,
        }, cfg);

        const rungs = LADDER.slice(0, choice.rungs);
        const level = levelOf(
            { type: TYPE, premises: choice.premises, rungs, seconds: choice.seconds }, cfg);

        // What the player brings to this item.
        if (slumpLeft > 0) slumpLeft--;
        else if (player.slump && rand() < player.slump.chance) slumpLeft = player.slump.length;

        const penalty = rungs.reduce((a, r) => a + (player.weakAt?.[r] ?? 0), 0);
        if (penalty > 0) weak++;

        const truth = Math.min(player.ceiling ?? Infinity, player.ability + learned)
            - penalty
            - (slumpLeft > 0 ? player.slump!.depth : 0)
            + gauss(rand) * (player.noise ?? 0);

        const correct = rand() < pCorrect(cfg, truth, level, GUESS);
        state = abilityUpdate(state, level, GUESS, correct, cfg);
        learned += player.learnPerItem ?? 0;

        if (i >= items / 2) {
            asked++; servedSum += level;
            if (correct) right++;
        }
    }

    const est = abilityEstimate(state, cfg);
    return {
        estimate: est.level, sd: est.sd,
        truth: Math.min(player.ceiling ?? Infinity, player.ability + learned),
        accuracy: right / asked,
        served: servedSum / asked,
        weakShare: weak / items,
    };
}

/** Several seeds, so a verdict is not one lucky draw. */
function runs(player: Player, seeds = [11, 29, 71, 113, 257]): Run[] {
    return seeds.map(s => run(player, s));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/* ------------------------------------------------------------------ *
 * What holds                                                          *
 * ------------------------------------------------------------------ */

const STEADY = ["beginner, steady", "middling, steady", "strong, steady"];

test("a steady player is tracked, wherever they sit", () => {
    for (const name of STEADY) {
        const player = PLAYERS.find(p => p.name === name)!;
        const rs = runs(player);
        const off = Math.abs(mean(rs.map(r => r.estimate)) - player.ability);
        assert(off < 1.0, `${name}: settled ${off.toFixed(2)} levels off true ability`);
        assert(mean(rs.map(r => r.sd)) < 1.0, `${name}: the posterior never settled`);
    }
});

test("a steady player is served at about the rate the model aims for", () => {
    for (const name of STEADY) {
        const player = PLAYERS.find(p => p.name === name)!;
        const acc = mean(runs(player).map(r => r.accuracy));
        assert(Math.abs(acc - TARGET_P) < 0.08,
            `${name}: answered ${(acc * 100).toFixed(0)}% against a ${TARGET_P * 100}% aim`);
    }
});

test("a learner is followed rather than left behind", () => {
    const player = PLAYERS.find(p => p.name === "fast learner")!;
    const rs = runs(player);
    const off = Math.abs(mean(rs.map(r => r.estimate)) - mean(rs.map(r => r.truth)));
    assert(off < 1.5, `the estimate ended ${off.toFixed(2)} levels from where they got to`);
});

/* ------------------------------------------------------------------ *
 * What does not — measured, guarded, unfixed                          *
 * ------------------------------------------------------------------ */

/**
 * A single weak modifier drags down the whole mode.
 *
 * Rungs are a prefix of an ordered ladder, so a player weak at one of them
 * cannot be given the others without it. `negation` is first on the linear
 * ladder and lands on 99% of items; `meta` is third and lands on 89%. Neither
 * can be dropped without dropping everything after it, and `chooseConfig`
 * prefers *more* rungs on a tie, so it never tries.
 *
 * Someone strong everywhere except one modifier is therefore estimated three to
 * five levels low, and served items that easy on everything else. The right
 * number here is nearly zero. The guard is that it must not get worse; the fix
 * is the gates-and-dials split, which lets a dial be turned down on its own.
 */
test("known defect: one weak modifier costs the whole-mode estimate", () => {
    for (const name of ["weak at negation", "weak at meta"]) {
        const player = PLAYERS.find(p => p.name === name)!;
        const rs = runs(player);
        const under = player.ability - mean(rs.map(r => r.estimate));
        assert(under < 5.5,
            `${name}: estimated ${under.toFixed(1)} levels low — worse than when measured`);
        assert(mean(rs.map(r => r.weakShare)) > 0.5,
            `${name}: the prefix stopped forcing the weak rung, so this defect may be fixed`);
    }
});

/**
 * A posterior that has been widened does not always come back.
 *
 * The aim is `estimate − caution × sd`, and then further below that for the
 * success target. When sd is large the item served is far below the player, who
 * answers it correctly, and a correct answer well below your ability is almost
 * no evidence — so sd stays large and the aim stays low. The loop sustains
 * itself.
 *
 * It is reached by anything that widens the posterior legitimately: a player
 * whose ability is moving, or one whose accuracy is noisy. Traced on one run,
 * the served level sat at the mode's floor of 3.0 from item 50 to item 200
 * while true ability rose from 4.5 to 6.0 and p(correct) climbed to 0.94.
 *
 * The outcome is bimodal rather than average: most seeds settle at sd 0.4, some
 * sit at 4–6 indefinitely. Guarded on the share that ends wide.
 */
test("known defect: a widened posterior can fail to recover", () => {
    const wide: string[] = [];
    for (const name of ["slow learner", "erratic"]) {
        const player = PLAYERS.find(p => p.name === name)!;
        const rs = runs(player);
        const share = rs.filter(r => r.sd > 2).length / rs.length;
        if (share > 0) wide.push(`${name} ${(share * 100).toFixed(0)}%`);
        assert(share <= 0.8,
            `${name}: ${(share * 100).toFixed(0)}% of runs ended with a posterior that`
            + " never settled — worse than when measured");
    }
    assert(wide.length > 0,
        "no run ended wide, so the caution trap may be fixed and this guard is stale");
});

/* ------------------------------------------------------------------ *
 * The table, which is the point of having archetypes at all           *
 * ------------------------------------------------------------------ */

test("what the model does with each kind of player", () => {
    console.log("");
    console.log("  player                 truth   est     sd    acc    served  weak%");
    for (const player of PLAYERS) {
        const rs = runs(player);
        console.log("  " + player.name.padEnd(22)
            + mean(rs.map(r => r.truth)).toFixed(1).padStart(5)
            + mean(rs.map(r => r.estimate)).toFixed(1).padStart(8)
            + mean(rs.map(r => r.sd)).toFixed(2).padStart(7)
            + mean(rs.map(r => r.accuracy)).toFixed(2).padStart(7)
            + mean(rs.map(r => r.served)).toFixed(1).padStart(8)
            + (100 * mean(rs.map(r => r.weakShare))).toFixed(0).padStart(6));
    }
    assert(true, "the assertions above are the test; this is the picture");
});
