/**
 * Among items of the same difficulty, not always the same item.
 *
 * A settled posterior asks for the same target every time and the search is
 * deterministic, so it returns the same configuration every time — the same
 * rungs, the same dials, the same length, until the estimate moves. That is a
 * constant condition, and the argument for drawing the relation labels fresh
 * per item is the argument against it.
 *
 * The preference sits below structure and above everything else: it chooses
 * between arrangements of the *same* amount of structure, so it is never a
 * reason to serve less, and it never moves the difficulty.
 */

import { assert, equal, test } from "./harness";
import {
    DEFAULT_ABILITY, chooseConfig, dialSteps, leversOf,
} from "../src/app/syllogimous/utils/ability.utils";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const TYPE = EnumQuestionType.Space4D;

function optsFor(type: EnumQuestionType, target: number, recent?: Record<string, number>) {
    return {
        minPremises: 3, maxPremises: 9, ladder: ladderFor(type),
        target, structureBefore: 5, dials: dialsFor(type), recent,
    };
}

test("a lever carried by the recent items loses a tie", () => {
    const target = 12;
    const plain = chooseConfig(TYPE, optsFor(TYPE, target), DEFAULT_ABILITY);
    const carried = leversOf(plain, ladderFor(TYPE));
    assert(carried.length > 0, "nothing to prefer against: the choice carries no levers");

    // Say the last few items were all made of exactly this.
    const recent: Record<string, number> = {};
    for (const lever of carried) recent[lever] = 6;
    const next = chooseConfig(TYPE, optsFor(TYPE, target, recent), DEFAULT_ABILITY);

    assert(leversOf(next, ladderFor(TYPE)).join(",") !== carried.join(","),
        `the same arrangement came back after six of them: ${carried.join(", ")}`);
});

test("and it costs nothing in difficulty or in structure", () => {
    const target = 12;
    const plain = chooseConfig(TYPE, optsFor(TYPE, target), DEFAULT_ABILITY);
    const recent: Record<string, number> = {};
    for (const lever of leversOf(plain, ladderFor(TYPE))) recent[lever] = 6;
    const next = chooseConfig(TYPE, optsFor(TYPE, target, recent), DEFAULT_ABILITY);

    assert(Math.abs(next.level - plain.level) <= 0.5,
        `variety moved the difficulty from ${plain.level.toFixed(2)} to`
        + ` ${next.level.toFixed(2)}, which is more than the tolerance band`);
    equal(next.rungs + dialSteps(next.dials), plain.rungs + dialSteps(plain.dials),
        "variety was bought with less structure, which it must never be");
});

test("no recency means no preference, so a fresh session is unchanged", () => {
    const a = chooseConfig(TYPE, optsFor(TYPE, 12), DEFAULT_ABILITY);
    const b = chooseConfig(TYPE, optsFor(TYPE, 12, {}), DEFAULT_ABILITY);
    equal(JSON.stringify(a), JSON.stringify(b),
        "an empty window changed the choice");
});

test("levers are the gates and the dials, and never a tombstone", () => {
    const choice = chooseConfig(TYPE, optsFor(TYPE, 14), DEFAULT_ABILITY);
    const levers = leversOf(choice, ladderFor(TYPE));
    for (const lever of levers) {
        assert(!lever.startsWith("retired-"),
            `${lever} is wired to nothing and should not count as variety`);
    }
    for (const name of Object.keys(choice.dials ?? {})) {
        assert(levers.includes(name), `the ${name} dial was not counted as a lever`);
    }
});

/* ------------------------------------------------------------------ *
 * Through the service                                                 *
 * ------------------------------------------------------------------ */

test("a steady player is not served one arrangement forever", () => {
    localStorage.clear();
    const ov = new SettingsOverrideService();
    const prog = new ProgressionService(ov);
    prog.set("enabled", true);
    prog.applyCalibration(12, 60);

    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
        const c = prog.configFor(TYPE);
        seen.add(leversOf(c, ladderFor(TYPE)).sort().join(","));
        // Answered at the rate the model aims for, so the estimate barely moves.
        prog.record(TYPE, i % 5 === 0 ? "wrong" : "right", 8);
    }

    assert(seen.size > 1,
        "twenty-four items of a settled player were all the same arrangement");
});
