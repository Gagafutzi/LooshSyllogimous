/**
 * Derivations, and the invariant that caught the one dangerous bug.
 *
 * Adding derivations to the linear family silently gave one to Analogy, which
 * builds on a scale layout and then asks a *different* question of it. The
 * explanation attached while the layout was being made survived, so an item
 * asking "Dog to Diary is alike Lizard to Blender" rendered a confident, correct
 * proof that "Diary is more than Lightning" — a claim it never made.
 *
 * That is worse than showing nothing, and invisible to the obvious check, which
 * only compares a derivation against its own conclusion. The invariant that
 * catches it is different:
 *
 *   **every subject named in the closing line must appear in what the item
 *   actually asks about.**
 *
 * For a true/false item that is the conclusion, and the test is strict. For a
 * choice or construction item the question lives in the options or the claim
 * pairs, so those count too — but nothing else does, and in particular the
 * premises do not: naming an object from the premises that the question never
 * mentions is exactly the failure above.
 */

import { assert, seeded, test } from "./harness";
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
import { createComparison, createLinear } from "../src/app/syllogimous/generators/linear";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { createHierarchy } from "../src/app/syllogimous/generators/hierarchy";
import { createAnchorSpace, createAnchorSpaceV2 } from "../src/app/syllogimous/generators/anchor";
import { createTransformation } from "../src/app/syllogimous/generators/transformation";
import { createDeictic } from "../src/app/syllogimous/generators/deictic";
import { createArrangement } from "../src/app/syllogimous/generators/arrangement";
import { createDirection, createDirection3D } from "../src/app/syllogimous/generators/direction";
import { createGraphMatching } from "../src/app/syllogimous/generators/graph-matching";
import { createAnalogy } from "../src/app/syllogimous/generators/analogy";
import { createBinary } from "../src/app/syllogimous/generators/binary";
import { createSyllogism } from "../src/app/syllogimous/generators/syllogism";
import { createInferRelation } from "../src/app/syllogimous/generators/infer-relation";
import { createOddestRelation } from "../src/app/syllogimous/generators/oddest-relation";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { createStimulusFunction } from "../src/app/syllogimous/generators/stimulus-function";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const MODES: Array<[EnumQuestionType, (c: GeneratorContext, n: number) => Question]> = [
    [EnumQuestionType.Distinction, createDistinction],
    [EnumQuestionType.ComparisonNumerical, (c, n) => createComparison(c, n, EnumQuestionType.ComparisonNumerical)],
    [EnumQuestionType.LinearVertical, (c, n) => createLinear(c, n, EnumQuestionType.LinearVertical)],
    [EnumQuestionType.LinearContains, (c, n) => createLinear(c, n, EnumQuestionType.LinearContains)],
    [EnumQuestionType.Syllogism, createSyllogism],
    [EnumQuestionType.LinearArrangement, (c, n) => createArrangement(c, n, EnumQuestionType.LinearArrangement)],
    [EnumQuestionType.CircularArrangement, (c, n) => createArrangement(c, n, EnumQuestionType.CircularArrangement)],
    [EnumQuestionType.Direction, createDirection],
    [EnumQuestionType.Direction3DSpatial, (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DSpatial)],
    [EnumQuestionType.Space3D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space3D)],
    [EnumQuestionType.Space6D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space6D)],
    [EnumQuestionType.GraphMatching, createGraphMatching],
    [EnumQuestionType.Hierarchy, createHierarchy],
    [EnumQuestionType.Analogy, createAnalogy],
    [EnumQuestionType.Deictic, createDeictic],
    [EnumQuestionType.Transformation, createTransformation],
    [EnumQuestionType.AnchorSpace, createAnchorSpace],
    [EnumQuestionType.AnchorSpaceV2, createAnchorSpaceV2],
    [EnumQuestionType.Binary, createBinary],
    [EnumQuestionType.InferRelation, createInferRelation],
    [EnumQuestionType.OddestRelation, createOddestRelation],
    [EnumQuestionType.ShapeRotation, createShapeRotation],
    [EnumQuestionType.RelationalWeb, createRelationalWeb],
    [EnumQuestionType.StimulusFunction, createStimulusFunction],
];

/** Everything the item actually asks about. */
function asked(q: Question): string {
    const conclusion = Array.isArray(q.conclusion) ? q.conclusion.join(" ") : q.conclusion;
    if (q.answerMode === "boolean") return conclusion;
    return [
        conclusion,
        q.choicePrompt,
        ...q.choices,
        ...q.construct.map(c => `${c.a} ${c.b}`),
    ].join(" ");
}

for (const [type, make] of MODES) {
    test(`${type} never explains a claim it did not make`, () => {
        const premises = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises + 1;

        for (let run = 0; run < 12; run++) {
            const q = seeded(run * 6421 + 19, () => make(context(), premises));
            if (!q.explanation.length) continue;

            const closing = q.explanation[q.explanation.length - 1];
            const named = extractSubjects(closing);
            const target = asked(q);

            for (const subject of named) {
                assert(target.includes(subject),
                    `closing line names "${subject}", which the question never asks about\n`
                    + `  closing: ${closing.replace(/<[^>]+>/g, "")}\n`
                    + `  asked:   ${target.replace(/<[^>]+>/g, "")}`);
            }
        }
    });
}

test("a derivation never just restates the conclusion", () => {
    /*
     * A derivation that repeats the claim adds nothing and costs the reader a
     * screen. One *line* is fine — Hierarchy's "no route leads from X to Y" is
     * the entire answer, since a claim there is false exactly when no route
     * exists — but it has to say something the conclusion did not.
     */
    const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/[^a-z0-9 ]/gi, "").trim();
    for (const [type, make] of MODES) {
        const premises = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises + 1;
        for (let run = 0; run < 6; run++) {
            const q = seeded(run * 811 + 5, () => make(context(), premises));
            if (!q.explanation.length) continue;
            const conclusion = strip(Array.isArray(q.conclusion) ? q.conclusion.join(" ") : q.conclusion);
            if (!conclusion) continue;
            const whole = q.explanation.map(strip).join(" ");
            assert(whole !== conclusion,
                `${type} explained its conclusion by repeating it: ${conclusion}`);
        }
    }
});

test("how many modes explain themselves", () => {
    // Not an assertion so much as a record: this number is the roadmap item,
    // and a regression in it should be visible rather than silent.
    const covered: string[] = [];
    for (const [type, make] of MODES) {
        const premises = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises + 1;
        let any = false;
        for (let run = 0; run < 8 && !any; run++) {
            any = seeded(run * 977 + 13, () => make(context(), premises)).explanation.length > 0;
        }
        if (any) covered.push(type);
    }
    console.log(`       ${covered.length}/${MODES.length} modes derive: ${covered.join(", ")}`);
    assert(covered.length >= 14, `only ${covered.length} modes explain themselves`);
});
