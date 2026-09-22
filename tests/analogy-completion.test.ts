/**
 * Analogy Completion — the pair that finishes "A is to B as ? is to ?".
 *
 * The mode is only sound if exactly one of the two pairs it offers really does
 * stand to each other as the stem does, and only worth having if neither pair
 * can be read straight off a premise. Both are checked here, and the first is
 * checked the hard way: the relation is recomputed from the item's own
 * coordinates, one sign per axis, rather than by asking the generator what it
 * decided. A test that re-used `relationKey` would agree with the generator
 * about a mistake they both made.
 *
 * Everything is read back off the finished card — the stem out of the last
 * premise, the candidates out of the options — because the failures this mode
 * can have are failures of what was *written*: a decoy that quietly matches, a
 * candidate that shares an object with the stem, a marked-correct index that
 * survived a shuffle pointing at the wrong option.
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
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createAnalogyCompletion } from "../src/app/syllogimous/generators/analogy-completion";

const TYPE = EnumQuestionType.AnalogyCompletion;
const { minNumOfPremises: MIN } = QUESTION_TYPE_SETTING_PARAMS[TYPE];

function context(rung = ""): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0,
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === rung,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

type Pair = [string, string];

/** The pair the stem names, read off the line that states it. */
function stemOf(q: Question): Pair {
    const named = extractSubjects(q.premises[q.premises.length - 1]);
    equal(named.length, 2, "the stem line does not name exactly two objects");
    return [named[0], named[1]];
}

/** The pair an option names, in the order it names them. */
function pairOf(choice: string): Pair {
    const named = extractSubjects(choice);
    equal(named.length, 2, "an option does not name exactly two objects");
    return [named[0], named[1]];
}

/**
 * The relation between a pair, recomputed from the item's own coordinates.
 *
 * One sign per axis, which is the definition the mode is built on, written out
 * here rather than imported so that the generator and its test are not two
 * calls to the same function.
 */
function relation(q: Question, [a, b]: Pair): string {
    const at = q.wordCoordMap!;
    assert(!!at[a] && !!at[b], `the item kept no coordinates for ${a} or ${b}`);
    return at[a].map((v, i) => Math.sign(at[b][i] - v)).join(",");
}

/** Every item this sweep looks at: each length, several draws apiece. */
function items(rung = ""): Question[] {
    const ctx = context(rung);
    const out: Question[] = [];
    seeded(20260922, () => {
        for (let n = MIN; n <= MIN + 6; n++) {
            for (let rep = 0; rep < 8; rep++) {
                try { out.push(createAnalogyCompletion(ctx, n)); } catch { /* an undrawable layout */ }
            }
        }
    });
    assert(out.length > 40, `only ${out.length} items were built`);
    return out;
}

/**
 * The whole mode in one assertion.
 *
 * Two options, one of them the stem's relation and the other not, and the
 * marked index pointing at the first of those. Split into three failures rather
 * than one so a break says which of the three it is: a decoy that matches is a
 * broken item, and a correct index off by one is a broken *score* on an item
 * that was fine.
 */
test("exactly one option completes the analogy, and it is the one marked", () => {
    for (const q of items()) {
        equal(q.choices.length, 2, "a completion has to be a choice between two pairs");

        const want = relation(q, stemOf(q));
        const matching = q.choices
            .map((c, i) => ({ i, same: relation(q, pairOf(c)) === want }))
            .filter(c => c.same);

        equal(matching.length, 1,
            `${matching.length} of the two options carry the stem's relation`);
        equal(q.correctChoice, matching[0].i,
            "the option marked correct is not the one that completes it");
    }
});

/**
 * Four objects, as in Analogy and for the same reason.
 *
 * A candidate sharing an object with the stem can be picked by noticing the
 * shared name, which is a question about the *words* — and it would be
 * answerable before the space had been read at all.
 */
test("no candidate shares an object with the stem", () => {
    for (const q of items()) {
        const stem = stemOf(q);
        for (const choice of q.choices) {
            for (const object of pairOf(choice)) {
                assert(!stem.includes(object),
                    `${object} is in the stem and in an option`);
            }
        }
    }
});

/**
 * Every pair on the card is one that has to be derived.
 *
 * A pair stated outright by a premise turns the item into a comparison of two
 * sentences: read the premise, read the stem, match the words. `derivedPairs`
 * drops directly linked pairs for exactly this reason, and this is the check
 * that says it is still doing so — including for the stem, which is drawn from
 * the same pool and would be the more damaging of the two to leave stated.
 */
test("no pair on the card is one a premise states outright", () => {
    for (const q of items()) {
        const map = q.premises.slice(0, -1);
        const pairs = [stemOf(q), ...q.choices.map(pairOf)];

        for (const [a, b] of pairs) {
            for (const premise of map) {
                const named = extractSubjects(premise);
                assert(!(named.includes(a) && named.includes(b)),
                    `${a} and ${b} are related by a premise, so the pair is read rather than derived`);
            }
        }
    }
});

/**
 * The rung, delivered rather than merely charged.
 *
 * `near-miss` is priced at 1.2 and its whole claim is that the wrong pair
 * agrees with the stem everywhere but one axis. Off the rung a decoy usually
 * disagrees on more than one and can be dismissed at a glance, which is the
 * shortcut the rung removes — so both halves are asserted: on the rung it is
 * always one, and off it, it is sometimes more than one.
 */
test("the near-miss rung puts the wrong pair exactly one axis away", () => {
    const distance = (q: Question) => {
        const want = relation(q, stemOf(q)).split(",");
        const decoy = q.choices.find((_, i) => i !== q.correctChoice)!;
        const got = relation(q, pairOf(decoy)).split(",");
        return want.reduce((n, v, i) => n + (v === got[i] ? 0 : 1), 0);
    };

    for (const q of items("near-miss")) {
        equal(distance(q), 1, "the decoy on the rung disagrees on more than one axis");
    }

    const loose = items().map(distance);
    assert(loose.some(d => d > 1),
        "off the rung every decoy was a near miss anyway, so the rung changes nothing");
});

/**
 * The derivation closes on what the item asks.
 *
 * `tests/derivation.test.ts` checks the general form of this across every mode;
 * what it cannot check is that the closing line names the *right* pair rather
 * than merely an offered one, since both options are fair game as far as it
 * knows. A derivation that confidently closes on the decoy is the worst output
 * this mode could produce, and it would pass everything else.
 */
test("the derivation closes on the pair that completes it", () => {
    for (const q of items()) {
        const closing = q.explanation[q.explanation.length - 1];
        equal(extractSubjects(closing), pairOf(q.choices[q.correctChoice]),
            "the closing line names a pair other than the answer");
    }
});

/**
 * A series claim is a question about the same space, and carries its own half.
 *
 * The map is stated once and the stem is replaced, which is the trade Infer the
 * Relation makes — so each claim has to bring its own premises, its own
 * options, and its own derivation. Inheriting any of the three leaves a claim
 * being scored against, or explained by, the one before it.
 */
test("each further claim brings its own stem, options and derivation", () => {
    let seen = 0;

    for (const q of items()) {
        for (const claim of q.series.slice(1)) {
            seen++;
            assert(!!claim.premises?.length, "a claim swapped the stem and kept no premises");
            equal(claim.choices?.length, 2, "a claim offers something other than two pairs");
            assert((claim.explanation?.length ?? 0) >= 2, "a claim carries no derivation of its own");
            equal(claim.premises![claim.premises!.length - 1], claim.text,
                "the claim's own stem is not the last premise it shows");

            const shown = { ...q, premises: claim.premises!, choices: claim.choices! } as Question;
            const want = relation(q, stemOf(shown));
            const matching = claim.choices!
                .map((c, i) => ({ i, same: relation(q, pairOf(c)) === want }))
                .filter(c => c.same);
            equal(matching.length, 1, "a further claim has other than one answer");
            equal(claim.correctChoice, matching[0].i,
                "a further claim marks the wrong option correct");
        }
    }

    assert(seen > 10, `only ${seen} further claims were built`);
});
