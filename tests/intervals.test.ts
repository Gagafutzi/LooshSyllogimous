/**
 * Interval Algebra — every relation still possible between two periods.
 *
 * The answer is a set of thirteen bits, and the expensive half to get right is
 * the zeroes. Marking a relation the premises rule out is loud — the player
 * works out that it cannot happen and is told they were wrong. *Failing* to mark
 * one that survives is quiet: the card reads sensibly, the explanation reads
 * sensibly, and a player who found the extra possibility is failed for finding
 * it. So both halves are recomputed here from the card as shown, by enumerating
 * the arrangements of endpoints the way a player would have to.
 *
 * The relations are read out of the markup rather than out of the prose: the
 * card marks each one with an own-rule span, and the rule's key *is* the
 * relation's index. That makes the parse exact, and it checks the keys are the
 * ones the phrasing table knows — a mode using `allen-13` would render nothing
 * and this would say so.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { OWN_RULES } from "../src/app/syllogimous/utils/phrasing";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import {
    ALLEN_DEFINITIONS, ALLEN_NAMES, IntervalFact,
    allenBetween, consistentIntervalStates,
} from "../src/app/syllogimous/utils/interval-algebra.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createIntervals } from "../src/app/syllogimous/generators/intervals";

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

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Intervals];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261006, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 14; rep++) {
                try { out.push(createIntervals(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/** The relation index a line states, read off its own-rule key. */
function relationOf(line: string): number {
    const keys = [...line.matchAll(/own--allen-(\d+)/g)].map(m => Number(m[1]));
    equal(keys.length, 1, `a line names ${keys.length} relations: ${strip(line)}`);
    assert(`allen-${keys[0]}` in OWN_RULES,
        `the line marks allen-${keys[0]}, which the phrasing table does not define — `
        + "it would render as nothing under the symbol switch");
    return keys[0];
}

function readCard(q: Question) {
    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const said: IntervalFact[] = q.premises.map(line => {
        const [a, b] = extractSubjects(line);
        return { a: at.get(a)!, b: at.get(b)!, options: [relationOf(line)] };
    });
    const asked = extractSubjects(q.setup[1]);
    equal(asked.length, 2, `the setup does not name one pair: ${strip(q.setup[1])}`);
    return { n: q.bucket.length, said, x: at.get(asked[0])!, y: at.get(asked[1])! };
}

test("all thirteen are offered, in Allen's order, each saying what it means", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        equal(q.choices.length, 13,
            "the options are a shortlist, which answers the question — the thirteen "
            + "are the answer space");
        q.choices.forEach((c, r) => {
            equal(relationOf(c), r,
                `option ${r} is not the ${r}th relation, so the ladder is out of order`);
            assert(strip(c).includes(ALLEN_DEFINITIONS[r]),
                `"${ALLEN_NAMES[r]}" is offered without saying what it means`);
        });
    }
});

test("the pair asked about is never one the premises state", () => {
    for (const q of items()) {
        const { said, x, y } = readCard(q);
        for (const f of said) {
            assert(!((f.a === x && f.b === y) || (f.a === y && f.b === x)),
                "a premise states the relation between the very pair being asked "
                + "about, so the answer is handed back a premise");
        }
    }
});

test("the premises can be laid out, so the answer is never empty", () => {
    for (const q of items()) {
        const { n, said } = readCard(q);
        assert(consistentIntervalStates(n, said).length > 0,
            "no arrangement of the periods fits every premise, so every relation is "
            + "impossible and the card asks for a selection from nothing");
        assert(q.selectAnswer.length > 0, "the item marks no relation as possible");
    }
});

/**
 * Not all thirteen, which is the item a reader answers without reading.
 *
 * A pair the premises say nothing about leaves every relation open, and that is
 * a true answer given by selecting everything. It is the one reading this mode
 * cannot afford to serve, since it is also the cheapest.
 */
test("the premises always rule something out", () => {
    for (const q of items()) {
        assert(q.selectAnswer.length < 13,
            "every relation is still possible, so the card is answered by selecting "
            + "all thirteen without reading a premise");
    }
});

test("every relation marked is one some arrangement realises", () => {
    for (const q of items()) {
        const { n, said, x, y } = readCard(q);
        const fits = consistentIntervalStates(n, said);
        for (const r of q.selectAnswer) {
            assert(fits.some(m => allenBetween(m, x, y) === r),
                `"${ALLEN_NAMES[r]}" is marked possible but no arrangement the premises `
                + "allow puts the two periods that way");
        }
    }
});

/**
 * And every relation left unmarked is one none realises, which is the quiet half.
 *
 * Marking too few produces a card that reads correctly and fails the player who
 * read it correctly. Nothing about the item looks wrong: the premises are true,
 * the marked relations are all possible, the explanation is coherent. Only the
 * enumeration finds it.
 */
test("every relation left unmarked is one no arrangement realises", () => {
    for (const q of items()) {
        const { n, said, x, y } = readCard(q);
        const fits = consistentIntervalStates(n, said);
        for (let r = 0; r < 13; r++) {
            if (q.selectAnswer.includes(r)) continue;
            assert(!fits.some(m => allenBetween(m, x, y) === r),
                `"${ALLEN_NAMES[r]}" is possible and is not marked, so a player who `
                + "worked it out is failed for it");
        }
    }
});
