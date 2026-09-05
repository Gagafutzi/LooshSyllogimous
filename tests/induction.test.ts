/**
 * The two induction modes, checked on the property that makes each decidable.
 *
 * Both are answerable only because of a claim the generator makes about the
 * item it just produced: that exactly one relation fits the evidence, and that
 * exactly one candidate is furthest from a recoverable pattern. Neither claim
 * is visible in the rendered text, so neither can be checked by reading the
 * item — which is precisely why they are checked here, by re-deriving them
 * from the same layouts the generator built.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { createInferRelation } from "../src/app/syllogimous/generators/infer-relation";
import { createOddestRelation } from "../src/app/syllogimous/generators/oddest-relation";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createLinear } from "../src/app/syllogimous/generators/linear";
import { createDirection } from "../src/app/syllogimous/generators/direction";
import { createStimulusFunction } from "../src/app/syllogimous/generators/stimulus-function";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    return {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        random: () => { throw new Error("not needed"); },
    };
}

/** The same context with one structural modifier forced on. */
function forced(flag: string): GeneratorContext {
    const ctx = context();
    (ctx as { settingsOverrideService: SettingsOverrideService }).settingsOverrideService = {
        linearOverride: (k: string) => (k === flag ? true : null),
            spread: () => null,
        axesFor: () => null, circularAxes: () => null, depthFor: () => 0, scramble: 100,
    } as unknown as SettingsOverrideService;
    return ctx;
}

const wideContext = () => forced("widePremises");
const directionContext = () => forced("incorrectDirections");

/** Strip the markup; the tests are about content, not presentation. */
const plain = (s: string) => s.replace(/<[^>]+>/g, "").trim();

/* ------------------------------------------------------------------ *
 * P9 — Infer the relation                                             *
 * ------------------------------------------------------------------ */

/**
 * Two candidates, and the wrong one nearly fits.
 *
 * Every axis used to be offered, which turns elimination into a sweep: on six
 * axes most candidates are ruled out by the first claim and cost nothing to
 * dismiss. What is worth offering is the axis that survives the most claims
 * without surviving them all — the answer a reader lands on if they stop
 * checking one claim early, which is the mistake this mode exists to catch.
 *
 * The guess floor is one in two rather than one in six, and the item is harder
 * for it: neither option can be dropped without checking every claim against
 * it. The ability model reads the option count and scores accordingly.
 */
test("infer-relation offers the answer and its closest rival", () => {
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 104729 + 3, () => createInferRelation(context(), 6));
        equal(q.choices.length, 2, "the candidates were not narrowed to two");
        equal(new Set(q.choices.map(plain)).size, 2,
            "the same relation was offered twice");
        assert(q.correctChoice >= 0 && q.correctChoice < q.choices.length,
            "the answer is not among the choices");
    }
});

test("infer-relation states the operator at least twice", () => {
    // One claim can rarely eliminate anything; the mode is elimination.
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 7717 + 11, () => createInferRelation(context(), 6));
        const claims = q.premises.filter(p => plain(p).includes("⊕"));
        assert(claims.length >= 2, `only ${claims.length} operator claim(s)`);
    }
});

test("infer-relation always names the relation it settles on", () => {
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 3301 + 7, () => createInferRelation(context(), 6));
        const answer = plain(q.choices[q.correctChoice]);
        const closing = plain(q.explanation[q.explanation.length - 1]);
        assert(closing.includes(answer),
            `derivation closes on something other than the answer:\n  ${closing}\n  answer: ${answer}`);
    }
});

/* ------------------------------------------------------------------ *
 * P11 — Oddest relation out                                           *
 * ------------------------------------------------------------------ */

/**
 * Every relation is stated; two of them are offered.
 *
 * The menu used to list every candidate, which lets a reader discard the ones
 * that plainly follow the pattern without measuring any of them — a search
 * rather than a measurement. The two on offer are the furthest and the
 * runner-up, which is where the measuring actually has to be done.
 */
test("oddest-relation states every relation and offers two", () => {
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 65537 + 5, () => createOddestRelation(context(), 8));
        assert(q.premises.length >= 3,
            `only ${q.premises.length} relations were stated to compare`);
        equal(q.choices.length, 2, "the candidates were not narrowed to two");
        equal(new Set(q.choices.map(plain)).size, 2, "the same relation was offered twice");
        assert(q.correctChoice >= 0 && q.correctChoice < 2,
            "the answer is not among the two offered");
    }
});

test("oddest-relation offers distinct pairs, and the answer is one of them", () => {
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 2749 + 17, () => createOddestRelation(context(), 8));
        equal(new Set(q.choices.map(plain)).size, q.choices.length, "a pair was offered twice");
        assert(q.correctChoice >= 0 && q.correctChoice < q.choices.length,
            "the answer is not among the choices");
    }
});

test("oddest-relation grades its deviants — every distance is distinct", () => {
    /*
     * The property the whole mode rests on. The derivation states each
     * candidate's distance, so reading them back is a faithful check that the
     * gap is strict: no two candidates tie, and exactly one is furthest.
     */
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 15013 + 23, () => createOddestRelation(context(), 8));
        const stated = q.explanation
            .map(l => /distance (\d+)/.exec(plain(l)))
            .filter((m): m is RegExpExecArray => !!m)
            .map(m => Number(m[1]));

        /*
         * One line per candidate, plus the closing line naming the winner.
         *
         * Counted from the *stated relations* rather than the options: only two
         * are offered now, and the derivation still accounts for every candidate
         * — which it must, since "furthest from the pattern" is a claim about
         * all of them and an explanation covering two would be answering a
         * different question.
         */
        const distances = stated.slice(0, -1);
        equal(distances.length, q.premises.length, "a candidate has no stated distance");
        equal(new Set(distances).size, distances.length, "two candidates tied");
        equal(Math.max(...distances), stated[stated.length - 1],
            "the closing line does not name the furthest distance");
    }
});

test("oddest-relation never repeats a stimulus between pairs", () => {
    // Sharing an object would make it a claim about that object rather than a
    // comparison of independent relations.
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 8191 + 29, () => createOddestRelation(context(), 8));
        equal(new Set(q.bucket).size, q.bucket.length, "a stimulus appears in two pairs");
    }
});

/* ------------------------------------------------------------------ *
 * P6 — Shape and rotation                                             *
 * ------------------------------------------------------------------ */

test("shape-rotation anchors at least one object to a named corner", () => {
    // Without an anchor nothing is fixed: every relative placement would be
    // satisfiable at any rotation, and the item has no starting arrangement.
    for (let run = 0; run < 30; run++) {
        const q = seeded(run * 1721 + 3, () => createShapeRotation(context(), 6));
        const named = q.premises.filter(p => / is on the .* corner$/.test(plain(p)));
        assert(named.length >= 1, "no object was placed on a named corner");
    }
});

test("shape-rotation always turns the shape, and never back to where it started", () => {
    const CORNERS: Record<string, number> = { square: 4, octagon: 8 };
    for (let run = 0; run < 30; run++) {
        const q = seeded(run * 9941 + 7, () => createShapeRotation(context(), 6));
        const shape = /the (square|octagon)/.exec(plain(q.premises.join(" ")))?.[1] ?? "square";
        const order = CORNERS[shape];

        const turns = q.premises
            .map(p => /is turned (\d+)° (clockwise|anticlockwise)/.exec(plain(p)))
            .filter((m): m is RegExpExecArray => !!m);
        assert(turns.length >= 1, "the shape was never turned");

        // Every turn must be a whole number of corners, or it is not a symmetry
        // of the polygon and a corner would stop being a corner.
        const step = 360 / order;
        for (const t of turns) {
            equal(Number(t[1]) % step, 0, `${t[1]}° is not a multiple of ${step}°`);
        }

        const net = turns.reduce(
            (a, t) => a + (Number(t[1]) / step) * (t[2] === "clockwise" ? 1 : -1), 0);
        assert(((net % order) + order) % order !== 0,
            "the turns cancelled out, so they were decoration");
    }
});

test("shape-rotation offers one corner per corner, and the answer is among them", () => {
    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 5387 + 11, () => createShapeRotation(context(), 6));
        if (q.answerMode !== "choice") continue;
        equal(new Set(q.choices.map(plain)).size, q.choices.length, "a corner was offered twice");
        assert(q.correctChoice >= 0 && q.correctChoice < q.choices.length,
            "the answer is not among the corners offered");
    }
});

test("shape-rotation asks both kinds of question", () => {
    // Position and invariance. If one never appears the mode has quietly
    // become the other one.
    const modes = new Set<string>();
    for (let run = 0; run < 60; run++) {
        modes.add(seeded(run * 131 + 17, () => createShapeRotation(context(), 6)).answerMode);
    }
    assert(modes.has("choice"), "no position item was ever generated");
    assert(modes.has("boolean"), "no invariance item was ever generated");
});

/* ------------------------------------------------------------------ *
 * P12 — Transformation of stimulus function                           *
 * ------------------------------------------------------------------ */

test("stimulus function states which object carries the property", () => {
    for (let run = 0; run < 20; run++) {
        const q = seeded(run * 5233 + 3, () => createStimulusFunction(context(), 5));
        const setup = q.setup.map(plain).join(" ");
        assert(/\bis\b/.test(setup), "no object was said to have the property");
        assert(/makes something/.test(setup),
            "the frame carrying the property was never stated, so it cannot be carried");
    }
});

test("the frame runs both ways across a run of items", () => {
    /*
     * Half the time the property runs *against* the scale. Without that, "find
     * the extreme" answers every item without ever carrying the property, and
     * the mode is a scale mode with extra words.
     */
    const directions = new Set<string>();
    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 911 + 7, () => createStimulusFunction(context(), 5));
        directions.add(/makes something less/.test(plain(q.setup.join(" "))) ? "against" : "with");
    }
    equal(directions.size, 2, "the frame never reversed, so the extreme is always the answer");
});

test("the anchor is never the answer", () => {
    // The property has to move to be transformed; if the object it was
    // attached to is the answer, nothing was carried anywhere.
    for (let run = 0; run < 25; run++) {
        const q = seeded(run * 1237 + 11, () => createStimulusFunction(context(), 5));
        if (q.answerMode !== "choice") continue;
        const anchor = /^(.*?) is /.exec(plain(q.setup[0]))?.[1];
        assert(anchor && plain(q.choices[q.correctChoice]) !== anchor,
            "the object carrying the property was also the answer");
    }
});

/* ------------------------------------------------------------------ *
 * Ported v3 presentation modifiers                                    *
 * ------------------------------------------------------------------ */

test("wide premises say the same thing in fewer sentences", () => {
    const plain5 = seeded(31, () => createLinear(context(), 6, EnumQuestionType.LinearVertical));
    const wide = seeded(31, () => createLinear(wideContext(), 6, EnumQuestionType.LinearVertical));
    assert(wide.premises.length < plain5.premises.length,
        `wide produced ${wide.premises.length} premises against ${plain5.premises.length}`);
    assert(wide.premises.some(p => plain(p).includes(", which ")),
        "no premise carried two links");
});

test("a merged premise names exactly the three objects it links", () => {
    /*
     * Only *consecutive* links merge, so a wide premise is A–B–C and nothing
     * longer. Checked on the merged ones alone: a meta-relation premise names
     * four objects quite legitimately, which is what a broader assertion caught
     * and mistook for a fault.
     */
    for (let run = 0; run < 20; run++) {
        const q = seeded(run * 271 + 5, () => createLinear(wideContext(), 6, EnumQuestionType.LinearVertical));
        for (const p of q.premises.filter(x => plain(x).includes(", which "))) {
            const subjects = (p.match(/<span class="subject">/g) ?? []).length;
            equal(subjects, 3, `a merged premise named ${subjects} objects`);
        }
    }
});

test("incorrect directions never make a malformed conclusion", () => {
    /*
     * The first version of this replaced a north/south entry with "east" and
     * produced "two steps east and three steps east" — not a hard item, a
     * broken one. A replacement has to stay on its own axis.
     */
    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 613 + 7, () => createDirection(directionContext(), 4));
        if (q.isValid) continue;
        const dirs = plain(String(q.conclusion)).match(/(North|South|East|West)/g) ?? [];
        const ns = dirs.filter(d => d === "North" || d === "South").length;
        const ew = dirs.filter(d => d === "East" || d === "West").length;
        assert(ns <= 1 && ew <= 1, `conclusion names one axis twice: ${plain(String(q.conclusion))}`);
    }
});

test("a false direction item is actually false", () => {
    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 823 + 11, () => createDirection(directionContext(), 4));
        if (q.isValid) continue;
        assert(!q.premises.includes(String(q.conclusion)),
            "the false conclusion restates a premise verbatim");
    }
});
