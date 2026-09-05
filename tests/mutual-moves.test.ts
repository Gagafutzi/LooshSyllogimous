/**
 * Mutual Moves — objects moving against each other rather than against the frame.
 *
 * The property the mode rests on is the one Axis Maps rests on: the worked
 * example must leave exactly **one** rule standing. A rule is a small tuple
 * here rather than a linear map, so the check is an enumeration of the whole
 * vocabulary — which is the point of keeping the vocabulary small.
 *
 * The second thing tested is the mode's own reason to exist. `in-turn` and
 * `at-once` have to actually differ on the items being shipped: an order nobody
 * can detect is a question with no evidence behind it, and it would be one the
 * card asks anyway.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    applyRule, createMutualMoves, MoveOrder, MoveRole, MoveOp,
} from "../src/app/syllogimous/generators/mutual-moves";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const FULL = ladderFor(EnumQuestionType.MutualMoves);

function context(rungs: string[]): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: string, r: string) => rungs.includes(r),
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

test("an item states a worked example, a second group, and two readings", () => {
    for (const rungs of [[], FULL.slice(0, 3), FULL]) {
        seeded(4242, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 12; rep++) {
                const q = createMutualMoves(ctx, 4);
                assert(q.premises.some(p => strip(p).includes("→")),
                    "no worked example to induce from");
                equal(q.choices.length, 2, "the group was offered among more than two readings");
                equal(new Set(q.choices).size, 2, "the two options say the same thing");
                assert(q.isValid, "a choice item that scores its own right answer wrong");
                assert(q.explanation.length > 0, "no derivation");
            }
        });
    }
});

/**
 * Positions a reader can picture.
 *
 * A mirror lands at `2r - x`, and under `in-turn` those doublings compound down
 * the list — the first draft shipped an object 28 steps east, which is a number
 * rather than a place. Nothing on a card should need counting past a handful.
 */
test("no object ends up somewhere unpicturable", () => {
    seeded(31, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 30; rep++) {
            for (const text of createMutualMoves(ctx, 5).premises.concat(
                createMutualMoves(ctx, 5).choices)) {
                for (const [, n] of strip(text).matchAll(/(\d+) /g)) {
                    assert(Number(n) <= 6, `an object stands ${n} steps out`);
                }
            }
        }
    });
});

/**
 * The order is the mode's own question, so it has to be a question the shipped
 * item can answer — and one that bites on more than the last line.
 *
 * `previous` is the base role for exactly this: references pointing back down
 * the list while the sweep runs forward means every object but the first reads
 * one that has just moved. Pointing forward, only the object that wraps round
 * would ever notice, and the order would be settled by a single line.
 */
test("the two orders disagree, and not only about the last object", () => {
    seeded(77, () => {
        const before = [[1, 0], [0, 1], [-1, 0], [0, -1]];
        for (const op of ["step", "mirror", "join", "follow"] as MoveOp[]) {
            const rule = { op, role: "previous" as MoveRole };
            const atOnce = applyRule(before, { ...rule, order: "at-once" as MoveOrder })!;
            const inTurn = applyRule(before, { ...rule, order: "in-turn" as MoveOrder })!;

            const differ = atOnce.filter((c, i) => !c.every((v, k) => v === inTurn[i][k]));
            assert(differ.length >= 2,
                `${op} over the previous object: the two orders differ on `
                + `${differ.length} object(s), so the order is a spot-check`);
        }
    });
});

/** An item whose objects all end in one place is recognisable without a rule. */
test("no item collapses its objects onto one point", () => {
    seeded(909, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 30; rep++) {
            const q = createMutualMoves(ctx, 4);
            const answer = strip(q.choices[q.correctChoice]).split("·").map(s => s.split(":")[1]);
            assert(new Set(answer.map(s => s.trim())).size > 1,
                "every object ended in the same place");
        }
    });
});
