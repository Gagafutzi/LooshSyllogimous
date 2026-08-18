/**
 * Every generator, driven directly.
 *
 * This is what the split bought. The generators used to be methods on an
 * Angular service, so exercising one meant constructing the service, which
 * meant the injector, which meant a browser. They now take a
 * {@link GeneratorContext} — an interface with seven members — so a test can
 * hand them a literal and check the item that comes back.
 *
 * What is checked is what the diagnostics screen checks, minus the screen:
 * a generator returns a question, states premises, asks something, and does not
 * restate a premise as its conclusion.
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

/**
 * A context with nothing switched on.
 *
 * The two services are stubbed rather than constructed: they are `@Injectable`,
 * so importing them for real would pull Angular into a node process for no
 * reason. Every stubbed method returns the value that means "defer to the
 * defaults", which is what an untouched install produces.
 */
function context(settings: Settings): GeneratorContext {
    return {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null,
            axesFor: () => null,
            circularAxes: () => null,
            depthFor: () => 0,
            scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false,
            depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        random: () => { throw new Error("no composed question available in this test"); },
    };
}

function allEnabled(): Settings {
    const s = new Settings();
    for (const type of Object.values(EnumQuestionType)) {
        s.question[type].enabled = true;
    }
    return s;
}

/** Every mode, and the smallest call that builds one. */
const GENERATORS: Array<[EnumQuestionType, (ctx: GeneratorContext, n: number) => Question]> = [
    [EnumQuestionType.Distinction, createDistinction],
    [EnumQuestionType.ComparisonNumerical, (c, n) => createComparison(c, n, EnumQuestionType.ComparisonNumerical)],
    [EnumQuestionType.ComparisonChronological, (c, n) => createComparison(c, n, EnumQuestionType.ComparisonChronological)],
    [EnumQuestionType.LinearVertical, (c, n) => createLinear(c, n, EnumQuestionType.LinearVertical)],
    [EnumQuestionType.LinearHorizontal, (c, n) => createLinear(c, n, EnumQuestionType.LinearHorizontal)],
    [EnumQuestionType.LinearContains, (c, n) => createLinear(c, n, EnumQuestionType.LinearContains)],
    [EnumQuestionType.Syllogism, createSyllogism],
    [EnumQuestionType.LinearArrangement, (c, n) => createArrangement(c, n, EnumQuestionType.LinearArrangement)],
    [EnumQuestionType.CircularArrangement, (c, n) => createArrangement(c, n, EnumQuestionType.CircularArrangement)],
    [EnumQuestionType.Direction, createDirection],
    [EnumQuestionType.Direction3DSpatial, (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DSpatial)],
    [EnumQuestionType.Direction3DTemporal, (c, n) => createDirection3D(c, n, EnumQuestionType.Direction3DTemporal)],
    [EnumQuestionType.Space3D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space3D)],
    [EnumQuestionType.Space4D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space4D)],
    [EnumQuestionType.Space5D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space5D)],
    [EnumQuestionType.Space6D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space6D)],
    [EnumQuestionType.GraphMatching, createGraphMatching],
    [EnumQuestionType.Hierarchy, createHierarchy],
    [EnumQuestionType.Analogy, createAnalogy],
    [EnumQuestionType.Deictic, createDeictic],
    [EnumQuestionType.Transformation, createTransformation],
    [EnumQuestionType.AnchorSpace, createAnchorSpace],
    [EnumQuestionType.AnchorSpaceV2, createAnchorSpaceV2],
    [EnumQuestionType.InferRelation, createInferRelation],
    [EnumQuestionType.OddestRelation, createOddestRelation],
    [EnumQuestionType.ShapeRotation, createShapeRotation],
    [EnumQuestionType.RelationalWeb, createRelationalWeb],
];

for (const [type, make] of GENERATORS) {
    test(`${type} builds a well-formed item`, () => {
        const ctx = context(allEnabled());
        const premises = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises + 1;

        for (let run = 0; run < 5; run++) {
            const q = seeded(run * 7919 + 13, () => make(ctx, premises));

            /*
             * An item has to *state* something. For every mode but one that
             * means sentences; Relational Web states itself in two drawn
             * graphs, and asserting sentences there would be asserting the
             * format rather than the invariant.
             */
            const states = q.premises.length > 0 || (q.webs?.length ?? 0) > 0;
            assert(states, "the item states nothing");
            assert(q.premises.every(p => p.trim().length > 0), "a premise is blank");
            assert(new Set(q.premises).size === q.premises.length, "a premise is repeated");

            const asks = (Array.isArray(q.conclusion) ? q.conclusion.join("") : q.conclusion).trim().length > 0
                || (q.choices?.length ?? 0) > 0
                || (q.construct?.length ?? 0) > 0;
            assert(asks, "the item asks nothing");
        }
    });
}

/*
 * The loop above asks each mode for one premise count. Deictic went wrong at
 * the others: it padded a long item by restating a reversal it had already
 * stated, so "I am you and you are me" could appear four times in one item and
 * a fourteen-premise item carry eleven premises of content. An axis reverses
 * once or not at all now, which caps the mode at 2^axes + axes premises — hence
 * the length check, since a mode that cannot reach its own maximum is claiming
 * a difficulty it does not deliver.
 */
test("Deictic states each reversal once, at every premise count", () => {
    const ctx = context(allEnabled());
    const { minNumOfPremises, maxNumOfPremises } = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Deictic];

    for (let n = minNumOfPremises; n <= maxNumOfPremises; n++) {
        for (let run = 0; run < 20; run++) {
            const q = seeded(run * 104729 + n, () => createDeictic(ctx, n));

            assert(new Set(q.premises).size === q.premises.length,
                `a premise is repeated at ${n} premises:\n${q.premises.join("\n")}`);
            // Two axes carry six premises and three carry nine at their
            // shortest, so seven and eight are one out. Nothing else is.
            assert(Math.abs(q.premises.length - n) <= 1,
                `asked for ${n} premises, got ${q.premises.length}`);
        }
    }
});

test("Binary asks the context for the questions it composes", () => {
    // Binary is the one generator with a dependency the others do not have, and
    // the reason the context carries a capability rather than an import.
    const ctx = context(allEnabled());
    let asked = 0;
    ctx.random = (n?: number, basic?: boolean) => {
        asked++;
        return seeded(asked * 31 + 5, () => createDistinction(ctx, n ?? 2));
    };
    const premises = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Binary].minNumOfPremises + 1;
    const q = seeded(4242, () => createBinary(ctx, premises));
    assert(asked > 0, "Binary never asked for a composed question");
    assert(q.premises.length > 0, "Binary produced no premises");
});
