/**
 * Minimal Premises — which of these did the settling.
 *
 * The card makes two claims that are not the same as "the answer is right":
 * that the set it marks settles the pair on its own, and that no smaller set
 * does. Both are recomputed here from the premises as shown, by filtering the
 * arrangements the way a player would have to — so "there is exactly one
 * smallest set", which the setup states outright, is checked rather than taken
 * from the generator that wrote it.
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
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import {
    ALL_SYSTEMS, consistentStates, settledBy,
} from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createMinimalPremises } from "../src/app/syllogimous/generators/minimal-premises";

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

/**
 * The premise counts this mode actually ships, read rather than repeated.
 *
 * Written out as a range, these tests exercised five to nine whatever the
 * settings said — so lowering the floor, which is the change that makes an item
 * ambiguous, left the suite green while the app served the items the floor had
 * been protecting against. Reading the range means a floor moved in
 * `settings.constants` is a floor this checks at.
 */
const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.MinimalPremises];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261001, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createMinimalPremises(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/** The relation the setup names, and the pair it says is settled. */
function readCard(q: Question) {
    const setup = strip(q.setup[0]);
    const found = ALL_SYSTEMS.filter(s => setup.includes(s.meaning));
    equal(found.length, 1, `the setup names ${found.length} relations: ${setup}`);

    const asked = extractSubjects(q.setup[1]);
    equal(asked.length, 2, "the setup does not name the pair being settled");

    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const facts = q.choices.map(line => {
        const [a, b] = extractSubjects(line);
        return { a: at.get(a)!, b: at.get(b)!, holds: !/does not/.test(strip(line)) };
    });
    return {
        system: found[0],
        x: at.get(asked[0])!,
        y: at.get(asked[1])!,
        facts,
        n: q.bucket.length,
    };
}

test("the premises are the options, and neither is stated twice", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        equal(q.choices.length, q.premises.length,
            "the options and the premises are different lists");
        equal(q.choices.map(strip), q.premises.map(strip),
            "the options are not the premises they are meant to be");
        assert(q.selectAnswer.length > 0, "no premise is needed, which cannot be");
        assert(q.selectAnswer.length < q.choices.length,
            "every premise is needed, so there was nothing to pare down");
    }
});

/**
 * The marked set settles the pair on its own.
 *
 * The first half of what the card claims, and the cheaper half: filter the
 * arrangements by the marked premises alone and the pair has to come out the
 * same way in all of them.
 */
test("the marked set settles the pair by itself", () => {
    for (const q of items()) {
        const { system, x, y, facts, n } = readCard(q);
        const kept = q.selectAnswer.map(i => facts[i]);
        assert(settledBy(system, consistentStates(system, n, kept), x, y) !== null,
            "the premises the item marks do not settle the pair between them");
    }
});

/**
 * And nothing smaller does, which is the claim worth checking.
 *
 * "There is exactly one smallest set" is printed on the card, so a player who
 * finds a smaller one has been told something false — and an item with two
 * smallest sets marks one of them wrong for no reason the player can see.
 * Every subset below the marked size is tried, which is what the generator
 * does and what a reader would have to.
 */
test("no smaller set settles it, and no other set of the same size does", () => {
    for (const q of items()) {
        const { system, x, y, facts, n } = readCard(q);
        const size = q.selectAnswer.length;

        const settles = (chosen: number[]) =>
            settledBy(system, consistentStates(system, n, chosen.map(i => facts[i])), x, y) !== null;

        const sufficient: number[][] = [];
        const walk = (at: number, chosen: number[], want: number) => {
            if (chosen.length === want) {
                if (settles(chosen)) sufficient.push([...chosen]);
                return;
            }
            for (let i = at; i < facts.length; i++) walk(i + 1, [...chosen, i], want);
        };

        for (let smaller = 1; smaller < size; smaller++) {
            sufficient.length = 0;
            walk(0, [], smaller);
            equal(sufficient.length, 0,
                `${sufficient.length} set(s) of ${smaller} settle it, so the marked ${size}`
                + " is not the smallest");
        }

        sufficient.length = 0;
        walk(0, [], size);
        equal(sufficient.length, 1,
            `${sufficient.length} sets of ${size} settle it, so "there is exactly one" is`
            + " false on the card");
        equal(sufficient[0], [...q.selectAnswer].sort((a, b) => a - b),
            "the one smallest set is not the one the item marked");
    }
});

/**
 * The spare premises are real premises, not filler.
 *
 * A mode that padded with statements about objects nobody asks about would be
 * asking the player to spot the topic rather than to work out the reason. The
 * ones left out have to be about the same entities, so that being relevant and
 * being necessary come apart — which is the whole distinction.
 */
test("the premises left out are about the same entities", () => {
    let overlapping = 0, total = 0;

    for (const q of items()) {
        const { facts } = readCard(q);
        const needed = new Set(q.selectAnswer);
        const named = new Set<number>();
        for (const i of q.selectAnswer) { named.add(facts[i].a); named.add(facts[i].b); }

        for (let i = 0; i < facts.length; i++) {
            if (needed.has(i)) continue;
            total++;
            if (named.has(facts[i].a) || named.has(facts[i].b)) overlapping++;
        }
    }

    assert(total > 0, "no item had a spare premise");
    assert(overlapping > total / 2,
        `only ${overlapping} of ${total} spare premises mention an entity the answer does —`
        + " the item can be solved by looking at which names appear");
});
