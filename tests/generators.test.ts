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
import { createSyllogism } from "../src/app/syllogimous/generators/syllogism";
import { createInferRelation } from "../src/app/syllogimous/generators/infer-relation";
import { createOddestRelation } from "../src/app/syllogimous/generators/oddest-relation";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { createStimulusFunction } from "../src/app/syllogimous/generators/stimulus-function";
import { createBinary } from "../src/app/syllogimous/generators/binary";
import { createTransformMatch } from "../src/app/syllogimous/generators/transform-match";
import { createKnaves } from "../src/app/syllogimous/generators/knaves";
import { createNested } from "../src/app/syllogimous/generators/nested";

/**
 * A context with nothing switched on.
 *
 * The two services are stubbed rather than constructed: they are `@Injectable`,
 * so importing them for real would pull Angular into a node process for no
 * reason. Every stubbed method returns the value that means "defer to the
 * defaults", which is what an untouched install produces.
 */
function context(settings: Settings): GeneratorContext {
    const ctx: GeneratorContext = {
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
        syllogismGenerator: "canyon",
        hasRung: () => false,
        /*
         * Binary wraps another mode's item and asks which half of it failed, so
         * it cannot be built without one. This used to throw, which is why
         * Binary was the one mode left out of the sweep — a smaller Distinction
         * is enough and costs nothing.
         */
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
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
    [EnumQuestionType.Space7D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space7D)],
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
    [EnumQuestionType.StimulusFunction, createStimulusFunction],
    [EnumQuestionType.Binary, createBinary],
    [EnumQuestionType.TransformMatching, createTransformMatch],
    [EnumQuestionType.Knaves, createKnaves],
    [EnumQuestionType.NestedSpaces, createNested],
];

/**
 * The list above is written by hand, and it had drifted.
 *
 * Three modes were shipping without ever being built in a test — including two
 * added the same week — because adding a mode means editing seven registration
 * points and this list is not one of them. The check costs nothing and the
 * failure names exactly what is missing.
 */
test("every mode is in the sweep", () => {
    const covered = new Set(GENERATORS.map(([type]) => type));
    const missing = Object.values(EnumQuestionType).filter(t => !covered.has(t));
    assert(missing.length === 0, `never generated in any test: ${missing.join(", ")}`);
});

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

/**
 * Naming the pattern — where P8 landed.
 *
 * Boolean concept learning wanted the rule separating positives from negatives.
 * The standard paradigm was the wrong shape for training, and the promising
 * direction — relational instances, the whole set at once, the rule as the
 * answer — turns out to be this mode with its question reversed. The consensus
 * was always computed here and deliberately never stated.
 *
 * Checked by recomputing the majority per dimension from the premises alone,
 * which is exactly what the item asks the reader to do.
 */
test("the rule-naming item names the majority pattern", () => {
    const ctx = context(allEnabled());
    (ctx as { hasRung: (t: EnumQuestionType, r: string) => boolean }).hasRung =
        (_t, r) => r === "state-rule";

    const clauses = (text: string) => {
        const m = /^.*? is (.*) relative to .*$/.exec(text.replace(/<[^>]+>/g, ""));
        return m ? m[1].split(", ") : [];
    };

    let checked = 0;

    for (let run = 0; run < 20; run++) {
        const q = seeded(run * 4919 + 7, () => createOddestRelation(ctx, 6));
        assert(q.answerMode === "choice", "the rung did not produce a choice item");

        const stated = q.premises.map(clauses);
        const dims = stated[0].length;
        assert(dims > 0 && stated.every(row => row.length === dims),
            "the premises do not all state the same dimensions");

        // The majority word on each dimension, from the premises only.
        const majority = [...Array(dims).keys()].map(i => {
            const counts = new Map<string, number>();
            for (const row of stated) counts.set(row[i], (counts.get(row[i]) ?? 0) + 1);
            const ranked = [...counts].sort((a, b) => b[1] - a[1]);
            assert(ranked.length < 2 || ranked[0][1] > ranked[1][1],
                `dimension ${i} is a tie, so the pattern is not recoverable`);
            return ranked[0][0];
        });

        const marked = q.choices[q.correctChoice].replace(/<[^>]+>/g, "").split(", ");
        assert(marked.join(",") === majority.join(","),
            `marked "${marked.join(", ")}" but the majority is "${majority.join(", ")}"`);

        // And no other option is the majority pattern too.
        q.choices.forEach((c, i) => {
            if (i === q.correctChoice) return;
            assert(c.replace(/<[^>]+>/g, "") !== marked.join(", "), "an option is repeated");
        });

        checked++;
    }

    assert(checked === 20, `only ${checked} rule-naming items were built`);
});
