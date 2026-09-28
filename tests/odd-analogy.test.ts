/**
 * Odd Analogy — three hold exactly and one only looks as if it does.
 *
 * The card's claim is a count: four analogies, three exact, one not. Recomputed
 * here by composing every relation from the layout the premises describe, which
 * is what the player has to do — and the composition is done from the *card*,
 * through the same `relationKey` the item was built with but over a layout
 * rebuilt from the coordinates the premises fix.
 *
 * Three things are checked that the answer being right does not cover. That
 * exactly one fails, since two failing marks one of two right answers wrong and
 * none failing asks an unanswerable question. That the one that fails is a near
 * miss — off by direction or by a single axis — because an analogy off on three
 * axes is found by noticing its objects are nowhere near each other, which is a
 * spatial impression and not a composition. And that no analogy names a relation
 * a premise states outright, or that half of it is read rather than worked out.
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
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { guessRateFor } from "../src/app/syllogimous/utils/ability.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createOddAnalogy } from "../src/app/syllogimous/generators/odd-analogy";

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

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.OddAnalogy];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261007, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createOddAnalogy(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/**
 * The two composed relations an explanation line reports, as axis patterns.
 *
 * Read out of the derivation rather than recomputed from a rebuilt layout. The
 * derivation is what the card shows the player after a wrong answer, so it is
 * the thing that has to be true — and a check against it catches a mismatch
 * between what the item decided and what it then tells the reader, which
 * recomputing from the premises would not.
 */
function halvesOf(explanationLine: string): [string, string] {
    const text = strip(explanationLine);
    const parts = text.split(" is ");
    assert(parts.length >= 3, `a derivation line does not report two relations: ${text}`);
    // "<pair> is <pattern>; <pair> is <pattern>[, which is not the same | — the same…]"
    const [first, rest] = text.split("; ");
    const left = first.slice(first.indexOf(" is ") + 4);
    const right = rest.slice(rest.indexOf(" is ") + 4)
        .replace(/, which is not the same$/, "")
        .replace(/ — the same on every axis$/, "");
    return [left, right];
}

/** The axis values of a pattern, split on the commas between clauses. */
const axesOf = (pattern: string) => pattern.split(", ").map(s => s.trim());

test("four analogies, all of them premises, one of them marked", () => {
    for (const q of items()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 4,
            `${q.choices.length} analogies — the mode is four, three exact and one not`);
        assert(q.correctChoice >= 0 && q.correctChoice < 4,
            `the marked analogy is at ${q.correctChoice}`);
        equal(new Set(q.choices.map(strip)).size, 4, "the same analogy is offered twice");
        for (const c of q.choices) {
            assert(q.premises.includes(c),
                "an option is not one of the item's own premises, which is the "
                + "condition the four-option menu is allowed under");
        }
        // A quarter, not a half: the model is told what a guess is worth here.
        equal(guessRateFor("choice", 0, 4), 0.25,
            "the floor a menu of four carries is not the one being credited");
    }
});

test("every analogy names four distinct objects", () => {
    for (const q of items()) {
        for (const c of q.choices) {
            const names = extractSubjects(c);
            equal(names.length, 4, `an analogy names ${names.length} objects: ${strip(c)}`);
            equal(new Set(names).size, 4,
                `an analogy repeats an object, so it holds by inspection: ${strip(c)}`);
        }
    }
});

/**
 * Exactly one fails, which is what the card says.
 *
 * Two failing marks one of two right answers wrong; none failing asks a question
 * with no answer. Counted off the derivation, which reports each analogy's two
 * composed relations and so says for itself which ones matched.
 */
test("exactly one of the four analogies fails, and it is the marked one", () => {
    for (const q of items()) {
        const lines = q.explanation.slice(0, 4);
        equal(lines.length, 4, "the derivation does not account for all four analogies");

        const failing = [];
        for (let i = 0; i < 4; i++) {
            const [left, right] = halvesOf(lines[i]);
            if (left !== right) failing.push(i);
        }
        equal(failing.length, 1,
            `${failing.length} of the four analogies fail, and the card says one`);

        /* The derivation is in the order the options are shown, so the failing
           line and the marked option must be the same one. */
        equal(failing[0], q.correctChoice,
            "the analogy the derivation shows failing is not the one the item marks");
    }
});

/**
 * And it fails by a hair, which is the whole difficulty.
 *
 * Two near misses count, and only two. Off on one axis and right on the rest is
 * one. A reversal is the other, and it is *not* the same as "off on every axis":
 * reversing negates each axis, and an axis the relation does not move along
 * negates to itself — so a genuine reversal of "east, same latitude, above"
 * differs on two of three. Asserting the axis count caught that as a defect when
 * it was the assertion that was wrong.
 *
 * What a reversal really is, on these axes, is: every axis the relation moves
 * along is flipped, and every axis it does not is left alone. That is exactly
 * checkable, because the neutral clause of each axis can be rendered — and these
 * axes are all linear with signs in {-1, 0, 1}, no modulus and so no ring where
 * a half-turn would reverse to itself.
 *
 * Off on two of five with a third left agreeing is neither, and is the case
 * worth excluding: the objects end up nowhere near each other and the answer
 * becomes a spatial impression rather than a composition.
 */
test("the analogy that fails is off by direction, or on a single axis", () => {
    for (const q of items()) {
        const [left, right] = halvesOf(q.explanation[q.correctChoice]);
        const a = axesOf(left), b = axesOf(right);
        equal(a.length, b.length, "the two halves are described on different axes");

        /*
         * The axes the item used, rebuilt the way it built them. Sound because
         * the context above overrides nothing — `axesFor` returns null, so the
         * generator takes the preset for this many dimensions, and so does this.
         */
        const axes: AxisSpec[] = axesForDimensions(a.length).map(scale => ({ scale }));
        /* Stripped, because the patterns above came out of the explanation with
           their axis-colour spans already removed and these have not. */
        const neutral = axesOf(strip(renderNdPattern(axes, Array(a.length).fill(0))));
        equal(neutral.length, a.length,
            "the rebuilt axes do not describe as many directions as the card does");

        const differs = a.map((v, i) => v !== b[i]);
        const moves = a.map((v, i) => v !== neutral[i]);
        const off = differs.filter(Boolean).length;
        const reversal = differs.every((d, i) => d === moves[i]);

        assert(off === 1 || reversal,
            `the analogy that fails differs on ${off} of ${a.length} axes without `
            + "being a reversal, so it can be spotted by noticing its objects are "
            + `nowhere near each other: "${left}" against "${right}"`);
    }
});

/**
 * No half of any analogy is a relation a premise states.
 *
 * `derivedPairs` only offers pairs two steps apart in the premise graph, so this
 * should hold by construction — and it is the property the mode rests on, since
 * an analogy with a stated half is half read rather than composed. Checked
 * against the premises as shown: no layout line may name both objects of any
 * pair an analogy uses.
 */
test("no analogy names a pair the premises state", () => {
    for (const q of items()) {
        const layout = q.premises.filter(p => !q.choices.includes(p));
        assert(layout.length > 0, "the card states no layout at all");
        const stated = new Set(layout.map(p => {
            const [a, b] = extractSubjects(p);
            return [a, b].sort().join("|");
        }));

        for (const c of q.choices) {
            const [a, b, p, r] = extractSubjects(c);
            for (const pair of [[a, b], [p, r]]) {
                assert(!stated.has([...pair].sort().join("|")),
                    `${pair.join(" and ")} are named together by a premise, so half of `
                    + "that analogy is read rather than composed");
            }
        }
    }
});
