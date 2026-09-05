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
import { createAxisMap } from "../src/app/syllogimous/generators/axis-map";
import { createMutualMoves } from "../src/app/syllogimous/generators/mutual-moves";
import { createWidestGroup } from "../src/app/syllogimous/generators/widest-group";
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
    [EnumQuestionType.AxisMap]: createAxisMap,
    [EnumQuestionType.MutualMoves]: createMutualMoves,
    [EnumQuestionType.WidestGroup]: createWidestGroup,
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
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => everyRung, depthBonusFor: () => 0,
            dialFor: () => (everyRung ? 2 : 0),
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => everyRung,
        // The stub's "every rung" meant every dial too, back when they were
        // rungs: two turns each, which is as far as the ladder ever allowed.
        dialFor: () => (everyRung ? 2 : 0),
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

/**
 * A conclusion may only name objects the premises name.
 *
 * An item was found in the wild whose conclusion asked about `Grass` while no
 * premise mentioned it — the word was in the stimulus bank, which is
 * deliberately larger than the layout needs, and the conclusion picker reached
 * into the bank rather than into what had been stated. The item was not hard,
 * it was unanswerable, and it was graded `true`.
 *
 * `isPremiseLikeConclusion` does not cover this and was never meant to: it
 * rejects a conclusion whose subject *pair* repeats a premise's, which is the
 * opposite failure — too little distance from the premises rather than too
 * much.
 *
 * Reads only rendered HTML, so it holds for any generator however it works
 * inside, and it sweeps the same matrix the build check does because a bank two
 * words too large shows up at one premise count and not at another.
 */
/**
 * Graph Matching is the one honest exception, and it is not a loophole.
 *
 * Its premises describe one structure and its conclusion describes a *second*
 * one, deliberately relabelled — the question is whether the two match, so
 * disjoint names are the entire mechanism rather than a leak. Every other mode
 * asks about the objects it told you about.
 */
const EXEMPT = new Set<string>([EnumQuestionType.GraphMatching]);

const SUBJECTS = /<span class="subject">([^<]*)<\/span>/g;
const subjectsIn = (html: string) => [...html.matchAll(SUBJECTS)].map(m => m[1]);

for (const everyRung of [false, true]) {
    test(`a conclusion names only what the premises name, rungs ${everyRung ? "on" : "off"}`, () => {
        const ctx = context(everyRung);
        const failures: string[] = [];

        for (const type of ORDERED_QUESTION_TYPES) {
            const make = BUILD[type];
            if (!make || EXEMPT.has(type)) continue;

            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            const top = Math.min(params.maxNumOfPremises, params.minNumOfPremises + 3);

            for (let n = params.minNumOfPremises; n <= top; n++) {
                for (let rep = 0; rep < 40; rep++) {
                    let q: Question;
                    try {
                        q = seeded(n * 7717 + rep * 131 + 5, () => make(ctx, n));
                    } catch {
                        continue; // the build sweep above is what reports these
                    }

                    /*
                     * Everything the reader is shown before answering. `setup`
                     * counts: it exists precisely for facts the premises do not
                     * state but the answer needs.
                     */
                    const stated = new Set([
                        ...q.premises.flatMap(subjectsIn),
                        ...q.setup.flatMap(subjectsIn),
                        ...(q.webs ?? []).flatMap(w => w.labels),
                        ...Object.keys(q.wordCoordMap ?? {}),
                    ]);
                    if (!stated.size) continue; // drawn modes state nothing as text

                    /*
                     * The correct answer only. A distractor that names an
                     * unmentioned object is a separate complaint — it gives
                     * itself away — and not this invariant.
                     */
                    const asked = [
                        ...(Array.isArray(q.conclusion) ? q.conclusion : [q.conclusion ?? ""]),
                        ...(q.answerMode === "choice" && q.correctChoice >= 0
                            ? [q.choices[q.correctChoice] ?? ""] : []),
                        ...q.construct.flatMap(c => [c.a, c.b].map(s => `<span class="subject">${s}</span>`)),
                    ];

                    for (const word of asked.flatMap(subjectsIn)) {
                        if (!stated.has(word)) {
                            failures.push(`${type} n=${n}: conclusion names "${word}", no premise does`);
                        }
                    }
                }
            }
        }

        const unique = [...new Set(failures)];
        assert(unique.length === 0,
            `${unique.length} unanswerable items:\n  ${unique.slice(0, 20).join("\n  ")}`);
    });
}

/**
 * Wide premises and meta relations, together, on the boolean conclusion.
 *
 * This is the configuration that produced the reported item — a Vertical Order
 * conclusion asking about `Grass` while no premise mentioned it — and the sweep
 * above could not have found it. The sweep runs all rungs on or all rungs off,
 * and with all of them on `constructConclusion` wins, so the boolean conclusion
 * path never executes. The bug lived in the gap between the two settings, which
 * is where a two-state sweep has no coverage by construction.
 *
 * Eight items in a hundred were unanswerable before the fix, so a few hundred
 * per configuration is ample; the value of the case is that it pins the pair of
 * rungs rather than the count.
 */
test("a wide premise's third object survives a meta rewrite", () => {
    for (const wide of [false, true]) {
        for (const meta of [false, true]) {
            const settings = new Settings();
            for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
            settings.setEnable("meta", meta);
            settings.setEnable("negation", true);

            const ctx: GeneratorContext = {
                settings,
                logger: new Logger("error", false),
                settingsOverrideService: {
                    linearOverride: (k: string) => k === "widePremises" ? wide : null,
                    axesFor: () => null, circularAxes: () => 0, spread: () => null,
                    depthFor: () => 0, scramble: 100, rungOverride: () => null,
                } as unknown as SettingsOverrideService,
                progressionService: {
                    hasRung: () => false, depthBonusFor: () => 0,
                    dialFor: () => 0,
                } as unknown as ProgressionService,
                forceConstruction: "off",
                hasRung: () => false,
                dialFor: () => 0,
                random: (n?: number) => createDistinction(ctx, n ?? 2),
            };

            const failures: string[] = [];
            for (let n = 2; n <= 7; n++) {
                for (let rep = 0; rep < 60; rep++) {
                    let q: Question;
                    try {
                        q = seeded(n * 1000 + rep, () => createLinear(ctx, n, EnumQuestionType.LinearVertical));
                    } catch { continue; }

                    const stated = new Set(q.premises.flatMap(subjectsIn));
                    for (const word of subjectsIn(String(q.conclusion ?? ""))) {
                        if (!stated.has(word)) {
                            failures.push(`wide=${wide} meta=${meta} n=${n}: asks about "${word}"`);
                        }
                    }
                }
            }

            const unique = [...new Set(failures)];
            assert(unique.length === 0,
                `${unique.length} unanswerable:\n  ${unique.slice(0, 6).join("\n  ")}`);
        }
    }
});
