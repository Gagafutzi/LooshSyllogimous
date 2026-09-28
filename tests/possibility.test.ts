/**
 * Possibility Sets, and the answer mode it needed.
 *
 * Two things are new and both are checked from the outside. The mode is the
 * first answered by selecting every option that applies, and the first built
 * over the relation systems rather than a layout of its own — so what the card
 * claims is not "this pair stands so" but "these outcomes are the ones the
 * premises still allow", which is a fact about a set of arrangements.
 *
 * So the answer is recomputed from the card. The system is identified by the
 * description the setup shows, the premises are read back into facts, the
 * arrangements consistent with them are enumerated, and the three outcomes are
 * decided by what survives. Nothing is taken from the generator but the item.
 */

import { readFileSync } from "fs";
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
import { selectionSatisfied } from "../src/app/syllogimous/utils/construct.utils";
import {
    ALL_SYSTEMS, consistentStates,
} from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createPossibilitySets } from "../src/app/syllogimous/generators/possibility";

const TYPE = EnumQuestionType.PossibilitySets;
const { minNumOfPremises: MIN, maxNumOfPremises: MAX } = QUESTION_TYPE_SETTING_PARAMS[TYPE];
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
    seeded(20260929, () => {
        for (let n = MIN; n <= MAX; n++) {
            for (let rep = 0; rep < 10; rep++) {
                try { out.push(createPossibilitySets(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 40, `only ${out.length} items were built`);
    return out;
}

/** The system the card says it is about, found by the description it shows. */
function systemOf(q: Question) {
    const setup = strip(q.setup[0]);
    const found = ALL_SYSTEMS.filter(s => setup.includes(s.meaning));
    equal(found.length, 1,
        `the setup names ${found.length} systems, so the reader is told which relation`
        + ` this is by nothing or by two things: ${setup}`);
    return found[0];
}

/** The premises, read back as facts about indices into the item's own bucket. */
function factsOf(q: Question) {
    const at = new Map(q.bucket.map((w, i) => [w, i]));
    return q.premises.map(line => {
        const [a, b] = extractSubjects(line);
        assert(at.has(a) && at.has(b), `a premise names something not in the bucket: ${strip(line)}`);
        return { a: at.get(a)!, b: at.get(b)!, holds: !/does not/.test(strip(line)) };
    });
}

/** The pair the options are about, taken off a directional option. */
function askedPair(q: Question): [number, number] {
    const at = new Map(q.bucket.map((w, i) => [w, i]));
    for (const option of q.choices) {
        const named = extractSubjects(option);
        if (named.length === 2) return [at.get(named[0])!, at.get(named[1])!];
    }
    throw new Error("no option names a pair");
}

/**
 * The whole mode in one assertion.
 *
 * An outcome is selectable exactly when some arrangement consistent with every
 * premise realises it. Recomputed here from the card rather than compared
 * against what the generator decided, which is the only way "the answer is
 * right" is a claim about the item rather than about how it was made.
 */
test("the marked outcomes are exactly the ones some surviving arrangement has", () => {
    for (const q of items()) {
        const system = systemOf(q);
        const n = q.bucket.length;
        const survivors = consistentStates(system, n, factsOf(q));
        assert(survivors.length > 0,
            "no arrangement fits the premises, so the item asks about nothing");

        const [x, y] = askedPair(q);
        const at = new Map(q.bucket.map((w, i) => [w, i]));

        q.choices.forEach((option, i) => {
            const named = extractSubjects(option);
            const possible = named.length === 2
                ? survivors.some(s => system.holds(s, at.get(named[0])!, at.get(named[1])!))
                : survivors.some(s => !system.holds(s, x, y) && !system.holds(s, y, x));

            equal(q.selectAnswer.includes(i), possible,
                `"${strip(option)}" is marked ${q.selectAnswer.includes(i) ? "" : "im"}possible`
                + ` and ${possible ? "some" : "no"} surviving arrangement has it`);
        });
    }
});

test("every item offers the three outcomes, distinctly, and at least one holds", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        assert(q.selectAsked, "the item does not say it is asking for a selection");
        equal(q.choices.length, 3, "an outcome is missing or repeated");
        equal(new Set(q.choices.map(strip)).size, 3, "two options read the same");
        assert(q.selectAnswer.length > 0,
            "nothing is possible, which no premise set drawn from a real arrangement can mean");
        assert(q.selectAnswer.every(i => i >= 0 && i < 3), "an answer points at no option");
    }
});

/**
 * The pair asked about is never one the premises state.
 *
 * Otherwise the surviving arrangements are answering a question they were
 * handed, and the item is a reading test.
 */
test("the asked pair is never one the premises state", () => {
    for (const q of items()) {
        const [x, y] = askedPair(q);
        for (const f of factsOf(q)) {
            assert(!(f.a === x && f.b === y) && !(f.a === y && f.b === x),
                `the premises state the pair the options are about`);
        }
    }
});

/**
 * Both kinds of item exist, which is the mode.
 *
 * If every item left all three open, "select everything" would answer them all
 * without reading; if every item settled the pair, the mode would be a choice
 * with extra steps. Telling those apart is the skill, so both have to occur.
 */
test("some items settle the pair and some leave it open", () => {
    const spread = new Map<number, number>();
    for (const q of items()) {
        spread.set(q.selectAnswer.length, (spread.get(q.selectAnswer.length) ?? 0) + 1);
    }
    for (const open of [1, 2, 3]) {
        assert((spread.get(open) ?? 0) > 0,
            `no item leaves ${open} of the three open: ${JSON.stringify([...spread])}`);
    }
    /* And "everything is open" is the uncommon one, or the item is answerable
       by selecting all of it. */
    const all = spread.get(3) ?? 0;
    const total = [...spread.values()].reduce((a, b) => a + b, 0);
    assert(all < total / 2,
        `${all} of ${total} items leave everything open, so selecting everything`
        + " answers most of them without reading");
});

/**
 * And the option that can never be selected is not offered.
 *
 * A strict total order puts every pair one way or the other, so "neither" is
 * false in every item it could build — an option that is never the answer is
 * one a reader stops reading. The generator picks its systems accordingly, and
 * this says so from the outside: across many items, each of the three positions
 * is selected sometimes.
 */
test("no outcome is dead, in any system the mode uses", () => {
    /*
     * Per system, not across the mode. Checked globally, one system whose
     * "neither" can never hold hides behind the others that can — which is
     * exactly the case this is about, since a strict total order puts every
     * pair one way or the other and would contribute only live directions.
     */
    const seen = new Map<string, { direction: number; neither: number; items: number }>();

    for (const q of items()) {
        const id = systemOf(q).id;
        const tally = seen.get(id) ?? { direction: 0, neither: 0, items: 0 };
        tally.items++;
        q.choices.forEach((option, i) => {
            if (!q.selectAnswer.includes(i)) return;
            if (extractSubjects(option).length === 2) tally.direction++;
            else tally.neither++;
        });
        seen.set(id, tally);
    }

    assert(seen.size > 1, `the mode only ever used ${seen.size} system`);
    for (const [id, tally] of seen) {
        assert(tally.direction > 0, `${id}: no direction is ever possible`);
        assert(tally.neither > 0,
            `${id}: "neither" is never possible across ${tally.items} items, so its third`
            + " option is decoration a reader learns to skip");
    }
});

/* ------------------------------------------------------------------ *
 * The answer mode itself                                              *
 * ------------------------------------------------------------------ */

/**
 * The guess floor is what earns the long menu.
 *
 * Every other mode here is held to two options, because a longer menu of claims
 * turns judging into searching. A selection inverts that — each option is its
 * own decision and dismissing one is answering it — and the arithmetic is the
 * evidence: one subset in `2^n`, so three options is one in eight against a
 * true-or-false's one in two.
 */
/**
 * The rule that decides a selection, which is the whole mode's scoring.
 *
 * Tested directly rather than through the service, so that "everything
 * selected" being wrong is asserted rather than assumed — it is the one
 * mistake a partial-credit rule would reward, and the guess floor above is
 * only honest if it is not rewarded.
 */
test("a selection is right only when it is exactly the answer", () => {
    equal(selectionSatisfied([0, 2], [0, 2]), true, "the exact answer was rejected");
    equal(selectionSatisfied([0, 2], [2, 0]), true, "a set was judged by its order");
    equal(selectionSatisfied([0, 2], [0, 1, 2]), false,
        "selecting everything passed, which is an item answered without reading");
    equal(selectionSatisfied([0, 2], [0]), false, "most of the answer passed as all of it");
    equal(selectionSatisfied([0, 2], [0, 3]), false, "a wrong option passed");
    equal(selectionSatisfied([0, 2], []), false, "selecting nothing passed");
    equal(selectionSatisfied([0, 2], undefined), false, "not answering passed");

    /* Empty is an answer, not an absence: premises can rule everything out. */
    equal(selectionSatisfied([], []), true, "\"none of these\" was rejected when it was right");
    equal(selectionSatisfied([], [1]), false, "picking something passed when nothing was possible");
});

test("a selection is priced as the subset it is", () => {
    equal(guessRateFor("select", 0, 3), 1 / 8, "three options is not one subset in eight");
    equal(guessRateFor("select", 0, 8), 1 / 256, "eight options is not one subset in 256");
    assert(guessRateFor("select", 0, 3) < guessRateFor("choice", 0, 3),
        "selecting from three is priced no better than picking one of three");
    assert(guessRateFor("select", 0, 3) < guessRateFor("boolean"),
        "selecting from three is priced no better than a coin flip");
});

/**
 * The screen can actually take a selection.
 *
 * The logic above is all checked, and none of it reaches the player if the
 * template has no way to give the answer. This is read off the shipped files
 * rather than driven in a browser: getting the app to one of these items needs
 * progression state, and what regresses here is not the rendering but the
 * wiring — a block deleted in a refactor, or a handler renamed, leaving a mode
 * that generates fine and cannot be answered.
 */
test("the game screen offers a way to answer a selection", () => {
    const html = readFileSync("src/app/syllogimous/pages/game/game.component.html", "utf8");
    const ts = readFileSync("src/app/syllogimous/pages/game/game.component.ts", "utf8");

    const at = html.indexOf("answerMode === 'select'");
    assert(at > 0, "the game screen has no block for a selection");
    const block = html.slice(at, at + 1400);

    assert(/\(click\)="toggleSelect\(i\)"/.test(block), "an option cannot be picked");
    assert(/\(click\)="submitSelection\(\)"/.test(block), "a selection cannot be submitted");
    assert(/\[class\.active\]="isSelected\(i\)"/.test(block),
        "a picked option is not drawn any differently, so the set is invisible");
    assert(/aria-pressed/.test(block), "a picked option says nothing to a screen reader");

    /* The submit is never disabled: "none of these" is an answer, and premises
       really can rule everything out. */
    assert(!/\[disabled\]/.test(block),
        "the submit is disabled, which makes \"none of these\" unsayable");

    for (const fn of ["toggleSelect(i: number)", "submitSelection()", "isSelected(i: number)"]) {
        assert(ts.includes(fn), `the component has no ${fn}`);
    }
    assert(/this\.selectPicks = \[\]/.test(ts),
        "the picks are not cleared between items, so the last answer carries over");
    assert(/checkSelection\(/.test(ts), "the screen never hands the selection to the service");
});
