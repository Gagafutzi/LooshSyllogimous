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

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { concealsConclusion, drawsItself, slideNames } from "../src/app/syllogimous/utils/slides.utils";
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
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => everyRung,
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
