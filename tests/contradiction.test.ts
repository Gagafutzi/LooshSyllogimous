/**
 * Contradiction — the premises cannot all be true, and exactly one is wrong.
 *
 * The card makes three claims, and only the first is obvious: no arrangement
 * fits every premise, withdrawing the marked one leaves a set that does, and
 * withdrawing any *other* premise leaves the clash where it was. The third is
 * the one worth checking. A flipped fact usually lands in a cycle where any of
 * three premises would have done just as well, and an item like that tells the
 * player "exactly one of them is wrong" while marking one of several — so the
 * generator rejects those, and this recomputes the rejection from the card as
 * shown rather than trusting the code that wrote it.
 *
 * Also checked: the exemption the two-option rule grants this mode. The options
 * are allowed to be a long menu *because* they are the premises verbatim, which
 * is a property of the output and so belongs in a test rather than in a comment.
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
    ALL_SYSTEMS, RelationSystem, consistentStates,
} from "../src/app/syllogimous/utils/relation-systems.utils";
import { guessRateFor } from "../src/app/syllogimous/utils/ability.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createContradiction } from "../src/app/syllogimous/generators/contradiction";

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
const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Contradiction];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261002, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createContradiction(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

type Fact = { a: number; b: number; holds: boolean };

/** The relation the setup names, and the premises as the card states them. */
function readCard(q: Question): {
    system: RelationSystem; n: number; facts: Fact[];
} {
    const setup = strip(q.setup[0]);
    const found = ALL_SYSTEMS.filter(s => setup.includes(s.meaning));
    equal(found.length, 1, `the setup names ${found.length} relations: ${setup}`);

    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const facts = q.choices.map(line => {
        const [a, b] = extractSubjects(line);
        return { a: at.get(a)!, b: at.get(b)!, holds: !/does not/.test(strip(line)) };
    });
    return { system: found[0], n: q.bucket.length, facts };
}

const fits = (system: RelationSystem, n: number, facts: Fact[]) =>
    consistentStates(system, n, facts).length > 0;

test("the premises are the options, and neither is stated twice", () => {
    for (const q of items()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.map(strip), q.premises.map(strip),
            "the options are not the premises they are meant to be");
        assert(q.correctChoice >= 0 && q.correctChoice < q.choices.length,
            `the marked premise is at ${q.correctChoice}, which is not an option`);
    }
});

/**
 * The exemption is earned, not granted.
 *
 * `registries.test.ts` lets a menu run past two options only where the options
 * are the premises verbatim, and that is the whole of the argument for allowing
 * it here — nothing can be dismissed at a glance because every option is a
 * sentence of the same shape about the same entities. If the premises and the
 * options ever drift apart, this mode is offering an authored menu of five and
 * the rule should stop it, so the property is asserted where it is produced.
 */
test("the long menu is the premise list, and priced as one", () => {
    for (const q of items()) {
        assert(q.choices.length > 2,
            "the menu is short enough not to need the exemption, which makes the "
            + "exemption untested rather than unnecessary");
        /* The options being one sentence with different names in it is now a
           condition of the exemption itself, checked in `registries.test.ts`
           for every mode that claims it rather than here for this one. */
        // A fifth of a level's worth of evidence, not a half — the model is told.
        equal(guessRateFor("choice", 0, q.choices.length), 1 / q.choices.length,
            "the floor a menu this long carries is not the one being credited");
    }
});

/**
 * The wrong premise is not the odd sentence out.
 *
 * One fact is flipped to build the item, so on a relation that mostly holds the
 * wrong premise reads as the sole negative and on a sparse one as the sole
 * positive. Either way the item is then answered by looking at the shape of the
 * sentences, which is the same failure the two-option rule exists to prevent —
 * and the exemption this mode claims rests on the options being
 * indistinguishable by form.
 */
test("the wrong premise shares its polarity with at least one other", () => {
    for (const q of items()) {
        const negated = q.choices.map(c => /does not/.test(strip(c)));
        const alike = negated.filter(v => v === negated[q.correctChoice]).length;
        assert(alike >= 2,
            "the premise the item marks is the only affirmative, or the only "
            + "negative, so it can be picked out without reading what it says");
    }
});

test("nothing can be arranged so that every premise holds", () => {
    for (const q of items()) {
        const { system, n, facts } = readCard(q);
        assert(!fits(system, n, facts),
            "the premises are consistent, so the item asks which of them is wrong "
            + "when none of them is");
    }
});

test("withdrawing the marked premise makes the rest agree", () => {
    for (const q of items()) {
        const { system, n, facts } = readCard(q);
        const rest = facts.filter((_, i) => i !== q.correctChoice);
        assert(fits(system, n, rest),
            "the premises still clash without the one the item marks, so it is not "
            + "the premise the conflict runs through");
    }
});

/**
 * And withdrawing any other leaves the clash, which is the claim worth checking.
 *
 * "Exactly one of them is wrong" is printed on the card. Where a second premise
 * would have done, the player who picks it has been marked wrong for giving an
 * answer the card's own wording allows — and that is the common case, not the
 * rare one: a three-premise cycle is fixed by dropping any of the three.
 */
test("withdrawing any other premise leaves the clash where it was", () => {
    for (const q of items()) {
        const { system, n, facts } = readCard(q);
        for (let i = 0; i < facts.length; i++) {
            if (i === q.correctChoice) continue;
            assert(!fits(system, n, facts.filter((_, j) => j !== i)),
                `withdrawing "${strip(q.choices[i])}" also resolves the clash, so the `
                + "card's \"exactly one\" is false and a right answer is marked wrong");
        }
    }
});
