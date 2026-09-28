/**
 * Mapping Conflict — the analogy that breaks the pairing.
 *
 * Read off the card, an analogy here is two pairings and nothing else, so the
 * whole item can be recomputed without a relation being interpreted: parse each
 * line into its four names, take the pairings they imply, and see which single
 * withdrawal repairs the set.
 *
 * Three claims are checked that way, and the third is the one that matters. A
 * disagreement between exactly two analogies is repaired by dropping either of
 * them, and an item like that marks one of two right answers wrong while the
 * card says "exactly one". That is the common accident, not the rare one — which
 * is why the generator walks every withdrawal, and why this walks it again.
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
import { guessRateFor } from "../src/app/syllogimous/utils/ability.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createMappingConflict } from "../src/app/syllogimous/generators/mapping-conflict";

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
const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.MappingConflict];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261004, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createMappingConflict(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/** The pairings one analogy implies: first to third, second to fourth. */
function linksOf(line: string): Array<[string, string]> {
    const names = extractSubjects(line);
    equal(names.length, 4, `an analogy names ${names.length} entities: ${strip(line)}`);
    return [[names[0], names[2]], [names[1], names[3]]];
}

/**
 * Whether a set of analogies gives every name one counterpart and no
 * counterpart two names.
 *
 * Written out here rather than imported, so the test is a second opinion on the
 * rule and not a restatement of it.
 */
function pairs(lines: string[]): boolean {
    const forward = new Map<string, string>();
    const backward = new Map<string, string>();
    for (const line of lines) {
        for (const [l, r] of linksOf(line)) {
            if ((forward.get(l) ?? r) !== r) return false;
            if ((backward.get(r) ?? l) !== l) return false;
            forward.set(l, r);
            backward.set(r, l);
        }
    }
    return true;
}

const without = (lines: string[], i: number) => lines.filter((_, j) => j !== i);

test("the analogies are the options, and neither is stated twice", () => {
    for (const q of items()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.map(strip), q.premises.map(strip),
            "the options are not the premises they are meant to be");
        assert(q.correctChoice >= 0 && q.correctChoice < q.choices.length,
            `the marked analogy is at ${q.correctChoice}, which is not an option`);
        equal(new Set(q.choices.map(strip)).size, q.choices.length,
            "the same analogy is offered twice");
    }
});

/**
 * The exemption is earned, not granted.
 *
 * `registries.test.ts` lets a menu run past two options only where the options
 * are the premises verbatim, which is the whole argument for allowing one here:
 * every option is a sentence of identical form over the same two vocabularies,
 * so none can be dismissed at a glance, and a shorter menu would do the finding
 * the mode exists for. If the two lists ever drift apart this is an authored
 * menu of six and the rule should stop it, so the property is asserted where it
 * is produced.
 */
test("the long menu is the analogy list, and priced as one", () => {
    for (const q of items()) {
        assert(q.choices.length > 2,
            "the menu is short enough not to need the exemption, which makes the "
            + "exemption untested rather than unnecessary");
        equal(guessRateFor("choice", 0, q.choices.length), 1 / q.choices.length,
            "the floor a menu this long carries is not the one being credited");
    }
});

test("the analogies cannot all give one counterpart each", () => {
    for (const q of items()) {
        assert(!pairs(q.choices),
            "the analogies pair up perfectly well, so the item asks which of them "
            + "breaks the pairing when none of them does");
    }
});

test("withdrawing the marked analogy makes the rest agree", () => {
    for (const q of items()) {
        assert(pairs(without(q.choices, q.correctChoice)),
            "the rest still clash without the one the item marks, so it is not the "
            + "analogy the conflict runs through");
    }
});

/**
 * And withdrawing any other leaves the clash, which is the claim worth checking.
 *
 * "Exactly one of them breaks the pairing" is printed on the card. Where a
 * second analogy would have done, the player who picks it has been marked wrong
 * for an answer the card's own wording allows.
 */
test("withdrawing any other analogy leaves the clash where it was", () => {
    for (const q of items()) {
        for (let i = 0; i < q.choices.length; i++) {
            if (i === q.correctChoice) continue;
            assert(!pairs(without(q.choices, i)),
                `withdrawing "${strip(q.choices[i])}" also repairs the pairing, so the `
                + "card's \"exactly one\" is false and a right answer is marked wrong");
        }
    }
});

/**
 * The two vocabularies do not overlap.
 *
 * A name that appeared on both sides could be its own counterpart, and then a
 * pairing conflict would read as a name disagreeing with itself — which is a
 * different puzzle, and not one the card explains.
 */
test("no name appears on both sides of an analogy", () => {
    for (const q of items()) {
        const left = new Set<string>();
        const right = new Set<string>();
        for (const line of q.choices) {
            const names = extractSubjects(line);
            left.add(names[0]); left.add(names[1]);
            right.add(names[2]); right.add(names[3]);
        }
        for (const name of left) {
            assert(!right.has(name),
                `${name} is named on both sides, so it could be its own counterpart`);
        }
    }
});
