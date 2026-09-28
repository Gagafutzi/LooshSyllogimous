/**
 * Missing Premise — which further fact would settle it.
 *
 * Three claims on the card, none of which is "the answer is right": the pair is
 * open on the premises alone, both statements offered are true, and exactly one
 * of them closes the pair. All three are recomputed here from the card as shown.
 *
 * The fourth check is the one that keeps the mode honest rather than correct.
 * Isomorph's guide says the wrong statement "helps somewhere, just not where it
 * is needed" — and a distractor that bears on nothing at all would make the item
 * answerable by finding the statement that does *something*, which is a
 * different and much easier question than the one asked.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates, settledBy,
} from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createMissingPremise } from "../src/app/syllogimous/generators/missing-premise";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261003, () => {
        for (let n = 5; n <= 8; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createMissingPremise(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

type Fact = { a: number; b: number; holds: boolean };

/** The relation, the pair asked about, the premises and the two candidates. */
function readCard(q: Question): {
    system: RelationSystem; n: number; x: number; y: number;
    facts: Fact[]; offered: Fact[];
} {
    const setup = strip(q.setup[0]);
    const found = ALL_SYSTEMS.filter(s => setup.includes(s.meaning));
    equal(found.length, 1, `the setup names ${found.length} relations: ${setup}`);

    const asked = extractSubjects(q.setup[1]);
    equal(asked.length, 2, "the setup does not name the pair left open");

    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const read = (line: string): Fact => {
        const [a, b] = extractSubjects(line);
        return { a: at.get(a)!, b: at.get(b)!, holds: !/does not/.test(strip(line)) };
    };
    return {
        system: found[0], n: q.bucket.length,
        x: at.get(asked[0])!, y: at.get(asked[1])!,
        facts: q.premises.map(read), offered: q.choices.map(read),
    };
}

const decides = (system: RelationSystem, n: number, facts: Fact[], a: number, b: number) =>
    settledBy(system, consistentStates(system, n, facts), a, b) !== null;

test("two candidates, one of them marked", () => {
    for (const q of items()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 2,
            `${q.choices.length} candidates — the house rule is two, and four is the `
            + "case the rule was written about");
        assert(q.correctChoice === 0 || q.correctChoice === 1,
            `the marked candidate is at ${q.correctChoice}`);
        assert(strip(q.choices[0]) !== strip(q.choices[1]),
            "the same statement is offered twice");
    }
});

test("the pair is open before either candidate is added", () => {
    for (const q of items()) {
        const { system, n, x, y, facts } = readCard(q);
        assert(!decides(system, n, facts, x, y),
            "the premises already settle the pair, so nothing is missing");
    }
});

/**
 * Both candidates are true — of the same world, and of one the premises allow.
 *
 * The card says so outright, and it is what makes the question "what would this
 * settle" rather than "which of these is a lie". Asserted jointly rather than
 * one at a time: two statements can each be consistent with the premises and
 * still not hold together, and then "both are true" is false of every world
 * there is, however each of them reads on its own.
 */
test("both candidates hold in some world the premises allow", () => {
    for (const q of items()) {
        const { system, n, facts, offered } = readCard(q);
        for (const [i, cand] of offered.entries()) {
            assert(consistentStates(system, n, [...facts, cand]).length > 0,
                `"${strip(q.choices[i])}" contradicts the premises, so the card's `
                + "\"both are true\" is false and the item is solved by spotting it");
        }
        assert(consistentStates(system, n, [...facts, ...offered]).length > 0,
            "the two candidates cannot both hold, so whichever is picked the card "
            + "has said something false about the other");
    }
});

test("the marked candidate settles the pair and the other does not", () => {
    for (const q of items()) {
        const { system, n, x, y, facts, offered } = readCard(q);
        assert(decides(system, n, [...facts, offered[q.correctChoice]], x, y),
            "the candidate the item marks does not settle the pair");
        const other = offered[1 - q.correctChoice];
        assert(!decides(system, n, [...facts, other], x, y),
            "the other candidate settles the pair too, so both answers are right "
            + "and one of them is marked wrong");
    }
});

/**
 * The wrong one is useful somewhere, which is what stops the item being free.
 *
 * Without this the distractor could be a fact that bears on nothing — and then
 * the item is answered by finding the statement that does anything at all, which
 * needs no reading of the pair that was asked about.
 */
test("the wrong candidate settles some other pair", () => {
    for (const q of items()) {
        const { system, n, x, y, facts, offered } = readCard(q);
        const other = offered[1 - q.correctChoice];
        const closed = [];
        for (let a = 0; a < n; a++) {
            for (let b = 0; b < n; b++) {
                if (a === b || (a === x && b === y)) continue;
                if (!decides(system, n, facts, a, b)
                    && decides(system, n, [...facts, other], a, b)) closed.push([a, b]);
            }
        }
        assert(closed.length > 0,
            `"${strip(q.choices[1 - q.correctChoice])}" settles nothing at all, so the `
            + "item is solved by finding the candidate that does something");
    }
});
