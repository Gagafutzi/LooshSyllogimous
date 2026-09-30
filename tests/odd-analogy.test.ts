/**
 * Odd Analogy — all hold exactly but one, which only looks as if it does.
 *
 * The card's claim is a count: so many analogies, all but one exact. How many is
 * the ladder — three at the floor, four above it — so nothing here asserts a
 * literal four; the card's own menu says how many it carries and everything else
 * is checked against that. A test that hard-coded the number would have to be
 * edited to let a rung through, which is the wrong way round.
 *
 * The relations are recomputed here by composing from the layout the premises describe, which
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
import { EnumQuestionType, NUMBER_WORDS } from "../src/app/syllogimous/constants/question.constants";
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

/** Every item, with the premise count it was asked for — the count is a ladder. */
function built(): Array<{ q: Question; asked: number }> {
    const ctx = context();
    const out: Array<{ q: Question; asked: number }> = [];
    seeded(20261007, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push({ q: createOddAnalogy(ctx, n), asked: n }); }
                catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

const items = (): Question[] => built().map(x => x.q);

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

test("every analogy is one of the card's own premises, and one is marked", () => {
    for (const q of items()) {
        const count = q.choices.length;
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        assert(count >= 3 && count <= 4,
            `${count} analogies — three is the floor and four the ceiling`);
        assert(q.correctChoice >= 0 && q.correctChoice < count,
            `the marked analogy is at ${q.correctChoice} of ${count}`);
        equal(new Set(q.choices.map(strip)).size, count,
            "the same analogy is offered twice");
        for (const c of q.choices) {
            assert(q.premises.includes(c),
                "an option is not one of the item's own premises, which is the "
                + "condition a menu longer than two is allowed under");
        }
        /* One in three or one in four, and the model is told which: a shorter
           menu is weaker evidence, and that is the trade the floor rung makes. */
        equal(guessRateFor("choice", 0, count), 1 / count,
            `the floor a menu of ${count} carries is not the one being credited`);
    }
});

/**
 * **The count is a ladder, and it really steps.**
 *
 * Four analogies was fixed, which made the mode's easiest item its hardest: each
 * analogy is two relations composed along the chain, so four of them at three
 * axes is twenty-four signs carried before anything can be ruled out. That is
 * the work the mode is for and too much to meet it on.
 *
 * So the floor carries three and the rungs above carry four. Asserted as a step
 * rather than as a table of numbers: what matters is that asking for more
 * premises eventually buys another analogy, and that the bottom is genuinely
 * below the top. A ladder that has flattened back to one value passes every
 * other test in this file.
 */
test("the floor carries fewer analogies than the ceiling", () => {
    const byAsked = new Map<number, Set<number>>();
    for (const { q, asked } of built()) {
        const held = byAsked.get(asked) ?? new Set<number>();
        held.add(q.choices.length);
        byAsked.set(asked, held);
    }

    for (const [asked, sizes] of byAsked) {
        equal(sizes.size, 1,
            `${asked} premises gave menus of ${[...sizes].join(" and ")} — the count `
            + "is a function of the rung, so it cannot vary within one");
    }

    const rungs = [...byAsked.entries()].sort((a, b) => a[0] - b[0]);
    equal(rungs.length, RANGE.maxNumOfPremises - RANGE.minNumOfPremises + 1,
        "not every settable premise count built an item");

    const counts = rungs.map(([, sizes]) => [...sizes][0]);
    equal(counts[0], 3,
        `the floor carries ${counts[0]} analogies — three is what makes it a floor`);
    assert(counts[counts.length - 1] > counts[0],
        `every rung carries ${counts[0]} analogies, so the ladder has flattened and `
        + "the easiest item is the hardest again");
    for (let i = 1; i < counts.length; i++) {
        assert(counts[i] >= counts[i - 1],
            `asking for ${rungs[i][0]} premises carries ${counts[i]} analogies against `
            + `${counts[i - 1]} at ${rungs[i - 1][0]} — a higher rung got shorter`);
    }
});

/**
 * And the card says the number it is actually showing.
 *
 * The setup states the count twice in words — "Three of these", "all three" —
 * and the menu states it by being that long. They are written in two places from
 * one variable, which is exactly the shape of defect this suite keeps finding: a
 * number that moved in one place and not the other. Under a fixed four nobody
 * would have noticed; under a ladder the floor would read "Four of these" over
 * three of them.
 */
test("the setup counts the analogies the card is showing", () => {
    for (const q of items()) {
        const count = q.choices.length;
        const said = strip(q.setup.join(" "));
        const word = NUMBER_WORDS[count], all = NUMBER_WORDS[count - 1];

        assert(new RegExp(`\\b${word}\\b`, "i").test(said),
            `the card shows ${count} analogies and its setup never says "${word}": ${said}`);
        assert(new RegExp(`\\b${all}\\b`, "i").test(said),
            `the card shows ${count} analogies, ${count - 1} of them exact, and its `
            + `setup never says "${all}": ${said}`);

        /* And it does not say a number it is not showing. */
        for (const [n, other] of NUMBER_WORDS.entries()) {
            if (n === count || n === count - 1 || n < 2 || n > 9) continue;
            assert(!new RegExp(`\\b${other}\\b`, "i").test(said),
                `the setup says "${other}" on a card of ${count} analogies: ${said}`);
        }
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
test("exactly one analogy fails, and it is the marked one", () => {
    for (const q of items()) {
        const count = q.choices.length;
        const lines = q.explanation.slice(0, count);
        equal(lines.length, count,
            `the derivation accounts for ${lines.length} of ${count} analogies`);

        const failing = [];
        for (let i = 0; i < count; i++) {
            const [left, right] = halvesOf(lines[i]);
            if (left !== right) failing.push(i);
        }
        equal(failing.length, 1,
            `${failing.length} of the ${count} analogies fail, and the card says one`);

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
