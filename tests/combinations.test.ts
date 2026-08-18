/**
 * Every mode, at every premise count it offers, with every rung switched on.
 *
 * The per-mode tests each build one configuration. Rungs interact, though —
 * under-specification with facing, speakers with branching, compact with
 * everything — and the combinations are where a generator loops forever or
 * emits an item with nothing in it. Those failures are invisible to a test that
 * only ever builds the default shape, and there are now enough rungs that
 * checking them by hand is not a plan.
 *
 * Deliberately shallow: it asserts an item was produced and that it states
 * something and asks something. Whether the answer is right is every other
 * test's job.
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
import { createTransformMatch } from "../src/app/syllogimous/generators/transform-match";
import { createKnaves } from "../src/app/syllogimous/generators/knaves";
import { createNested } from "../src/app/syllogimous/generators/nested";

type Build = (ctx: GeneratorContext, n: number) => Question;

const BUILD: Record<string, Build> = {
    [EnumQuestionType.Distinction]: createDistinction,
    [EnumQuestionType.ComparisonNumerical]: (c, n) => createComparison(c, n, EnumQuestionType.ComparisonNumerical),
    [EnumQuestionType.ComparisonChronological]: (c, n) => createComparison(c, n, EnumQuestionType.ComparisonChronological),
    [EnumQuestionType.LinearVertical]: (c, n) => createLinear(c, n, EnumQuestionType.LinearVertical),
    [EnumQuestionType.LinearHorizontal]: (c, n) => createLinear(c, n, EnumQuestionType.LinearHorizontal),
    [EnumQuestionType.LinearContains]: (c, n) => createLinear(c, n, EnumQuestionType.LinearContains),
    [EnumQuestionType.Syllogism]: createSyllogism,
    [EnumQuestionType.LinearArrangement]: (c, n) => createArrangement(c, n, EnumQuestionType.LinearArrangement),
    [EnumQuestionType.CircularArrangement]: (c, n) => createArrangement(c, n, EnumQuestionType.CircularArrangement),
    [EnumQuestionType.Direction]: createDirection,
    [EnumQuestionType.Direction3DSpatial]: (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DSpatial),
    [EnumQuestionType.Direction3DTemporal]: (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DTemporal),
    [EnumQuestionType.Space3D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space3D),
    [EnumQuestionType.Space4D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space4D),
    [EnumQuestionType.Space5D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space5D),
    [EnumQuestionType.Space6D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space6D),
    [EnumQuestionType.Space7D]: (c, n) => createNdSpace(c, n, EnumQuestionType.Space7D),
    [EnumQuestionType.GraphMatching]: createGraphMatching,
    [EnumQuestionType.Hierarchy]: createHierarchy,
    [EnumQuestionType.Analogy]: createAnalogy,
    [EnumQuestionType.Deictic]: createDeictic,
    [EnumQuestionType.Transformation]: createTransformation,
    [EnumQuestionType.AnchorSpace]: createAnchorSpace,
    [EnumQuestionType.AnchorSpaceV2]: createAnchorSpaceV2,
    [EnumQuestionType.Binary]: createBinary,
    [EnumQuestionType.InferRelation]: createInferRelation,
    [EnumQuestionType.OddestRelation]: createOddestRelation,
    [EnumQuestionType.ShapeRotation]: createShapeRotation,
    [EnumQuestionType.RelationalWeb]: createRelationalWeb,
    [EnumQuestionType.StimulusFunction]: createStimulusFunction,
    [EnumQuestionType.TransformMatching]: createTransformMatch,
    [EnumQuestionType.Knaves]: createKnaves,
    [EnumQuestionType.NestedSpaces]: createNested,
};

function context(everyRung: boolean): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    settings.setEnable("negation", true);
    settings.setEnable("meta", true);

    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => everyRung, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => everyRung,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

test("every mode covered by the combination sweep", () => {
    const missing = ORDERED_QUESTION_TYPES.filter(t => !BUILD[t]);
    assert(missing.length === 0, `not swept: ${missing.join(", ")}`);
});

for (const everyRung of [false, true]) {
    test(`every mode builds at every length, rungs ${everyRung ? "on" : "off"}`, () => {
        const ctx = context(everyRung);
        const failures: string[] = [];
        let built = 0;

        for (const type of ORDERED_QUESTION_TYPES) {
            const make = BUILD[type];
            if (!make) continue;

            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            const top = Math.min(params.maxNumOfPremises, params.minNumOfPremises + 3);

            for (let n = params.minNumOfPremises; n <= top; n++) {
                for (let rep = 0; rep < 6; rep++) {
                    try {
                        const q = seeded(n * 7717 + rep * 131 + 5, () => make(ctx, n));

                        const states = q.premises.length > 0 || (q.webs?.length ?? 0) > 0;
                        const asks = q.answerMode === "choice"
                            ? q.choices.length > 0
                            : String(q.conclusion ?? "").length > 0 || q.construct.length > 0;

                        if (!states) failures.push(`${type} n=${n}: states nothing`);
                        else if (!asks) failures.push(`${type} n=${n}: asks nothing`);
                        else built++;
                    } catch (e) {
                        failures.push(`${type} n=${n}: ${(e as Error).message}`);
                    }
                }
            }
        }

        const unique = [...new Set(failures)];
        assert(unique.length === 0,
            `${unique.length} configurations failed:\n  ${unique.slice(0, 12).join("\n  ")}`);
        assert(built > 400, `only ${built} items were built`);
    });
}
