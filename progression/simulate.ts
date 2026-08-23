/**
 * The progression model, driven directly, so its behaviour can be *measured*
 * rather than argued about.
 *
 * Every number in README.md and diagnosis.md came from this file. It imports
 * the real functions — nothing is reimplemented — and simulates a player of
 * known true ability answering items the model chooses for them.
 *
 * To run it: copy to `tests/`, add the import to `tests/index.ts`, and
 * `npm run test:utils`. Kept out of the suite deliberately — it asserts
 * nothing and only prints, and a test that only prints is noise in a run that
 * is meant to be silent when things are well.
 */

import { test } from "./harness";
import {
    DEFAULT_ABILITY, abilityEstimate, abilityUpdate, chooseConfig, initAbility,
    levelOf, pCorrect, targetLevel,
} from "../src/app/syllogimous/utils/ability.utils";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";

const TYPE = EnumQuestionType.LinearVertical;
const cfg = DEFAULT_ABILITY;

function serve(est: ReturnType<typeof abilityEstimate>) {
    const cautious = { ...est, level: est.level - cfg.caution * est.sd };
    const target = targetLevel(cautious, 0.8, 0.5, cfg);
    const params = QUESTION_TYPE_SETTING_PARAMS[TYPE];
    return chooseConfig(TYPE, {
        minPremises: params.minNumOfPremises,
        maxPremises: params.maxNumOfPremises,
        ladder: ladderFor(TYPE),
        target,
        structureBefore: 5,
    }, cfg);
}

test("sim", () => {
    // A settled player: 200 trials answered at the target rate.
    let state = initAbility(6, 4, cfg);
    let rng = 12345;
    const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;

    for (let i = 0; i < 200; i++) {
        const est = abilityEstimate(state, cfg);
        const c = serve(est);
        const lvl = levelOf({ type: TYPE, premises: c.premises, rungs: ladderFor(TYPE).slice(0, c.rungs), seconds: c.seconds }, cfg);
        const p = pCorrect(cfg, 8, lvl, 0.5);       // true ability 8
        state = abilityUpdate(state, lvl, 0.5, rand() < p, cfg);
    }

    let est = abilityEstimate(state, cfg);
    let c = serve(est);
    console.log(`  settled: level ${est.level.toFixed(2)} sd ${est.sd.toFixed(2)} -> ${c.premises}p ${c.rungs}r ${c.seconds == null ? "no clock" : c.seconds.toFixed(0)+"s"} lvl ${c.level.toFixed(2)}`);

    // Now a perfect streak.
    const marks = new Set([1, 5, 10, 20, 30, 50, 70, 90]);
    for (let i = 1; i <= 90; i++) {
        const e = abilityEstimate(state, cfg);
        const k = serve(e);
        const lvl = levelOf({ type: TYPE, premises: k.premises, rungs: ladderFor(TYPE).slice(0, k.rungs), seconds: k.seconds }, cfg);
        state = abilityUpdate(state, lvl, 0.5, true, cfg);
        if (marks.has(i)) {
            const e2 = abilityEstimate(state, cfg);
            const k2 = serve(e2);
            console.log(`  +${String(i).padStart(2)} right: level ${e2.level.toFixed(2)} (${(e2.level-est.level>=0?"+":"")}${(e2.level-est.level).toFixed(2)}) sd ${e2.sd.toFixed(2)} -> ${k2.premises}p ${k2.rungs}r ${k2.seconds==null?"no clock":k2.seconds.toFixed(0)+"s"} | p(correct) served ${pCorrect(cfg, e2.level, lvl, 0.5).toFixed(3)}`);
        }
    }
});

test("sim2", () => {
    // Where does the width come from? Track the posterior's shape.
    let state = initAbility(6, 4, cfg);
    let rng = 999;
    const rand = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 200; i++) {
        const est = abilityEstimate(state, cfg);
        const c = serve(est);
        const lvl = levelOf({ type: TYPE, premises: c.premises, rungs: ladderFor(TYPE).slice(0, c.rungs), seconds: c.seconds }, cfg);
        state = abilityUpdate(state, lvl, 0.5, rand() < pCorrect(cfg, 8, lvl, 0.5), cfg);
    }
    const base = abilityEstimate(state, cfg);
    console.log(`  BASE level ${base.level.toFixed(2)} sd ${base.sd.toFixed(2)}`);

    // Streak, showing what caution does to the aim.
    let s = state;
    for (const n of [0, 10, 30, 60, 90]) {
        let t = state;
        for (let i = 0; i < n; i++) {
            const e = abilityEstimate(t, cfg);
            const c = serve(e);
            const lvl = levelOf({ type: TYPE, premises: c.premises, rungs: ladderFor(TYPE).slice(0, c.rungs), seconds: c.seconds }, cfg);
            t = abilityUpdate(t, lvl, 0.5, true, cfg);
        }
        const e = abilityEstimate(t, cfg);
        const cautious = e.level - cfg.caution * e.sd;
        const target = targetLevel({ ...e, level: cautious }, 0.8, 0.5, cfg);
        console.log(`  after ${String(n).padStart(2)}: mean ${e.level.toFixed(2)}  sd ${e.sd.toFixed(2)}  cautious ${cautious.toFixed(2)}  target ${target.toFixed(2)}`);
    }

    // Same streak, but on construct items (guess rate 1/729).
    let t2 = state;
    for (let i = 0; i < 30; i++) {
        const e = abilityEstimate(t2, cfg);
        const c = serve(e);
        const lvl = levelOf({ type: TYPE, premises: c.premises, rungs: ladderFor(TYPE).slice(0, c.rungs), seconds: c.seconds }, cfg);
        t2 = abilityUpdate(t2, lvl, 1 / 729, true, cfg);
    }
    const e2 = abilityEstimate(t2, cfg);
    console.log(`  30 right at guess=1/729: mean ${e2.level.toFixed(2)} sd ${e2.sd.toFixed(2)} (vs binary +30 above)`);
});
