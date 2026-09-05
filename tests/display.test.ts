/**
 * What every mode shows, checked rather than looked at.
 *
 * Display has broken invisibly three times: Relational Web stated itself in
 * pictures a slide never rendered, a structure match printed its own answer on
 * a conclusion slide, and Transformation Matching listed coordinates beside the
 * grids that replaced them. Each was found by someone looking at the screen,
 * which is the most expensive way to find anything and the least reliable.
 *
 * The layout is a pure function now, so the contract can be a test: everything
 * an item states is reachable, nothing that gives the answer away is shown, and
 * there is always something to read before answering.
 */

import { assert, equal, seeded, test } from "./harness";
import { getEmojis } from "../src/app/syllogimous/constants/question.constants";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import {
    concealsConclusion, drawsItself, slideNames, stepSlide,
} from "../src/app/syllogimous/utils/slides.utils";
import { BUILD } from "./modes";

function context(everyRung: boolean): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    settings.setEnable("negation", true);
    settings.setEnable("meta", true);

    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, spread: () => null, axesFor: () => null,
            circularAxes: () => 0, depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => everyRung, depthBonusFor: () => 0,
            dialFor: () => (everyRung ? 2 : 0),
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => everyRung,
        // "Every rung" meant every dial too, back when they were rungs: two
        // turns each, which is as far as the ladder ever allowed.
        dialFor: () => (everyRung ? 2 : 0),
        mergeTarget: () => null,
        random: (n?: number) => BUILD[EnumQuestionType.Distinction](ctx, n ?? 2),
    };
    return ctx;
}

const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "").trim();

for (const everyRung of [false, true]) {
    test(`every mode is readable and gives nothing away, rungs ${everyRung ? "on" : "off"}`, () => {
        const ctx = context(everyRung);
        const faults: string[] = [];
        const note = (m: string) => { if (!faults.includes(m)) faults.push(m); };

        for (const type of ORDERED_QUESTION_TYPES) {
            const make = BUILD[type];
            if (!make) { note(`${type}: not in the mode table`); continue; }

            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            const top = Math.min(params.maxNumOfPremises, params.minNumOfPremises + 2);

            for (let n = params.minNumOfPremises; n <= top; n++) {
                for (let rep = 0; rep < 12; rep++) {
                    let q: Question;
                    try { q = seeded(n * 3121 + rep * 17 + 5, () => make(ctx, n)); }
                    catch (e) { note(`${type}: ${(e as Error).message}`); continue; }

                    const ids = slideNames(q);

                    if (!ids.length) note(`${type}: nothing to show at all`);
                    if (new Set(ids).size !== ids.length) note(`${type}: a slide appears twice`);

                    // Something has to be readable before the question.
                    const body = ids.filter(i =>
                        i.startsWith("premise-") || i === "webs" || i === "grids");
                    if (!body.length) note(`${type}: no premises, picture or grid to read`);

                    // Nothing stated may go unshown.
                    if (q.premises.length && !drawsItself(q)
                        && !ids.some(i => i.startsWith("premise-"))) {
                        note(`${type}: states premises that are never shown`);
                    }
                    if (q.webs?.length && !ids.includes("webs")) note(`${type}: webs never shown`);
                    if (q.grids?.length && !ids.includes("grids")) note(`${type}: grids never shown`);

                    // Nothing shown may give the answer away.
                    if (concealsConclusion(q) && ids.some(i => i.startsWith("conclusion-"))) {
                        note(`${type}: shows a conclusion that is the answer`);
                    }
                    if (q.answerMode === "choice" && ids.some(i => i.startsWith("conclusion-"))) {
                        note(`${type}: a choice item also shows a conclusion`);
                    }

                    // The page needs a well-formed answer to offer.
                    if (q.answerMode === "boolean" && !strip(
                        Array.isArray(q.conclusion) ? q.conclusion.join(" ") : q.conclusion)) {
                        note(`${type}: a true/false item with no claim to judge`);
                    }
                    if (q.answerMode === "choice"
                        && (q.correctChoice < 0 || q.correctChoice >= (q.choices?.length ?? 0))) {
                        note(`${type}: a choice item with no valid answer`);
                    }
                    if (q.answerMode === "map"
                        && (!q.mapTargets.length || q.mapTargets.length !== q.mapAnswer.length)) {
                        note(`${type}: a match with a malformed answer`);
                    }
                    if (q.answerMode === "construct" && !q.construct.length) {
                        note(`${type}: a construction with nothing to build`);
                    }

                    // Nothing may render blank.
                    q.premises.forEach((p, i) => {
                        if (!strip(p)) note(`${type}: premise ${i} renders empty`);
                    });
                    (q.choices ?? []).forEach((c, i) => {
                        if (!strip(c)) note(`${type}: option ${i} renders empty`);
                    });
                    if ((q.setup ?? []).some(l => !strip(l))) note(`${type}: a blank setup line`);
                }
            }
        }

        assert(faults.length === 0, `\n  ${faults.join("\n  ")}`);
    });
}

test("an item that draws itself never lists the same content as text", () => {
    /*
     * The picture modes keep their text form for the history list, which has no
     * room for a grid. Showing both puts the column of numbers back beside the
     * picture it was introduced to replace.
     */
    const ctx = context(true);

    for (const type of [EnumQuestionType.RelationalWeb, EnumQuestionType.TransformMatching]) {
        for (let rep = 0; rep < 20; rep++) {
            const q = seeded(rep * 613 + 11, () => BUILD[type](ctx, 5));
            if (!drawsItself(q)) continue;

            const ids = slideNames(q);
            assert(!ids.some(i => i.startsWith("premise-")),
                `${type} shows its premises as text as well as drawing them`);
        }
    }
});

/**
 * Advancing, which is the part that kept not working.
 *
 * It was an `ngb-carousel` driven by a bound `activeId`, which meant two state
 * machines with their own ideas of the active slide — and every fix that made
 * one agree broke the other. The page renders the active slide itself now, so
 * stepping is an index clamp, and an index clamp is easier to check than to
 * argue about.
 */
test("stepping forward visits every slide once and stops at the end", () => {
    const ctx = context(true);

    for (const type of ORDERED_QUESTION_TYPES) {
        const make = BUILD[type];
        if (!make) continue;

        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        const q = seeded(7717, () => make(ctx, params.minNumOfPremises + 1));
        const order = slideNames(q);
        assert(order.length > 0, `${type}: nothing to step through`);

        // Forward from the first slide, one step at a time.
        const seen: string[] = [order[0]];
        let at = order[0];
        for (let i = 0; i < order.length + 4; i++) {
            const next = stepSlide(order, at, 1);
            if (next !== at) seen.push(next);
            at = next;
        }

        assert(seen.join(",") === order.join(","),
            `${type}: stepping visited ${seen.join(",")} for an order of ${order.join(",")}`);
        assert(at === order[order.length - 1],
            `${type}: stepping did not finish on the last slide`);

        // And back again, without wrapping past the start.
        for (let i = 0; i < order.length + 4; i++) at = stepSlide(order, at, -1);
        assert(at === order[0], `${type}: stepping back did not stop at the first slide`);
    }
});

test("stepping copes with a slide name that is no longer in the order", () => {
    // Happens for one change-detection pass when a question is replaced: the
    // active name is the old question's, the order is the new one's.
    equal(stepSlide(["setup", "premise-0"], "conclusion-0", 1), "premise-0",
        "a stale name should step from the start rather than nowhere");
    equal(stepSlide([], "setup", 1), "", "an empty order has no slide to show");
    equal(stepSlide(["webs"], "webs", 1), "webs", "a single slide has nowhere to go");
});

/* ------------------------------------------------------------------ *
 * Stimuli that actually draw                                          *
 * ------------------------------------------------------------------ */

/**
 * Every emoji stimulus renders as something.
 *
 * The pool was built by walking whole Unicode *blocks*, and a block is a range
 * of addresses rather than a list of emoji — so one in four entries drew
 * nothing at all: 209 of 848. Two kinds got through. Unassigned code points,
 * which no font has a glyph for; and text-presentation emoji like U+1F321,
 * assigned but drawn as an emoji only when followed by a variation selector,
 * which nothing here appends.
 *
 * A stimulus that renders as nothing is worse than a bad one. The premise still
 * reads as a sentence, with a hole where a subject should be, and the reader
 * cannot tell whether the hole is the thing they are meant to be tracking or a
 * word they failed to see.
 *
 * Checked against the platform's own Unicode data rather than a list written
 * here, which would be the same drift one layer down.
 */
test("every emoji stimulus is one that draws", () => {
    const pool = getEmojis();
    assert(pool.length > 300, `only ${pool.length} emoji left in the pool`);

    const blank = pool.filter(s => !/^\p{Emoji_Presentation}$/u.test(s));
    assert(blank.length === 0,
        `${blank.length} stimuli render as nothing, starting with `
        + blank.slice(0, 8).map(s => "U+" + s.codePointAt(0)!.toString(16)).join(", "));

    // One code point each, so nothing depends on a variation selector or a
    // zero-width joiner surviving however the stimulus is stored and redrawn.
    const compound = pool.filter(s => [...s].length !== 1);
    assert(compound.length === 0,
        `${compound.length} stimuli are more than one code point`);

    // And distinct, or two objects in one item could look identical.
    equal(new Set(pool).size, pool.length, "the pool repeats a stimulus");
});
