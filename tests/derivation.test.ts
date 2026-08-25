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
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
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
    [EnumQuestionType.Space7D, (c, n) => createNdSpace(c, n, EnumQuestionType.Space7D)],
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
    const conclusion = [
        Array.isArray(q.conclusion) ? q.conclusion.join(" ") : q.conclusion,
        // A series asks every one of its claims, one after another, and the
        // derivation is shown once at the end — so all of them are fair game
        // for the closing line, not only the one the card opened on.
        ...q.series.map(c => c.text),
    ].join(" ");
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
    // Every mode now does. The floor is the full set rather than a number to
    // beat, so losing one is a failure instead of a quietly smaller log line.
    assert(covered.length === MODES.length,
        `${MODES.length - covered.length} modes explain nothing: `
        + MODES.map(([t]) => t).filter(t => !covered.includes(t)).join(", "));
});

/**
 * The coordinate traces have to agree with the answer, not just avoid naming
 * the wrong objects.
 *
 * Transformation and Anchor Space v2 are the two modes whose premises *change*
 * the arrangement rather than describe it, so their derivations replay
 * positions instead of walking premises. That is a second implementation of the
 * same arithmetic the generator used to decide the answer, and two
 * implementations are exactly the thing that drifts. If the trace ends on a
 * direction the conclusion contradicts, one of them is wrong.
 */
test("a replayed trace ends where the answer says it does", () => {
    /*
     * Which axis each word belongs to, so a claim naming several can be
     * compared to the trace one dimension at a time.
     *
     * Comparing a single word used to be enough, because a claim named a single
     * axis. It names every axis the pair differs on now — a three-dimensional
     * item answered about one dimension asked a third of what it stated — so a
     * check that found the *first* direction word in each and compared them was
     * comparing whichever axis happened to come first in two different orders.
     */
    const AXIS: Record<string, [number, boolean]> = {
        east: [0, true], west: [0, false],
        north: [1, true], south: [1, false],
        above: [2, true], below: [2, false],
    };

    /** Which way each named axis runs, as the sentence states it. */
    const readAxes = (text: string) => {
        const found = new Map<number, boolean>();
        for (const [word, [axis, positive]] of Object.entries(AXIS)) {
            if (new RegExp(`\\b${word}\\b`).test(text) && !found.has(axis)) {
                found.set(axis, positive);
            }
        }
        return found;
    };

    const traced: Array<[EnumQuestionType, (c: GeneratorContext, n: number) => Question]> = [
        [EnumQuestionType.Transformation, createTransformation],
        [EnumQuestionType.AnchorSpaceV2, createAnchorSpaceV2],
    ];

    for (const [type, make] of traced) {
        const premises = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises + 1;
        let checked = 0;

        for (let run = 0; run < 30; run++) {
            const q = seeded(run * 3307 + 41, () => make(context(), premises));
            if (!q.explanation.length) continue;

            const plain = (s: string) => s.replace(/<[^>]+>/g, "");
            const claimed = readAxes(plain(String(q.conclusion)));
            const derived = readAxes(plain(q.explanation[q.explanation.length - 1]));
            if (!claimed.size || !derived.size) continue;

            /*
             * The closing line says what is *true*. A true claim agrees with it
             * on every axis it names; a false one differs on exactly one —
             * wrong on two of three would be spotted from whichever the reader
             * checked first, which is the thing the wide claim exists to stop.
             */
            let wrong = 0, compared = 0;
            for (const [axis, positive] of claimed) {
                if (!derived.has(axis)) continue;
                compared++;
                if (derived.get(axis) !== positive) wrong++;
            }
            if (!compared) continue;

            assert(q.isValid ? wrong === 0 : wrong === 1,
                `${type}: the item is ${q.isValid ? "true" : "false"} and differs from`
                + ` the trace on ${wrong} of ${compared} axes\n  `
                + plain(String(q.conclusion)) + `\n  `
                + plain(q.explanation[q.explanation.length - 1]));
            checked++;
        }

        assert(checked > 5, `${type}: only ${checked} traces were checkable`);
    }
});

/**
 * Analogy's verdict, across all five layouts it can be built on.
 *
 * It has no relation of its own — it takes a finished item from another mode
 * and asks whether one pair stands to each other as another pair does — so the
 * derivation is five independent descriptions, one per layout, each computing
 * the comparison a second time. Five chances to disagree with the answer.
 *
 * The claim is read off the rendered conclusion because negation flips it:
 * a negated item shows the *opposite* word inside an `is-negated` span, so
 * "not unlike" is a claim that the pairs are alike.
 */
test("Analogy's derivation agrees with its answer, whatever it was built on", () => {
    let checked = 0;

    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 5171 + 7, () => createAnalogy(context(), 4));
        if (!q.explanation.length) continue;

        const conclusion = String(q.conclusion);
        const shown = /class="analogy-conclusion[^"]*">is (alike|unlike)</.exec(conclusion);
        if (!shown) continue;

        const flipped = conclusion.includes("analogy-conclusion is-negated");
        const claimsAlike = flipped ? shown[1] === "unlike" : shown[1] === "alike";

        const closing = q.explanation[q.explanation.length - 1];
        const derivedAlike = /are alike$/.test(closing);

        assert(derivedAlike === (q.isValid ? claimsAlike : !claimsAlike),
            `the item is ${q.isValid ? "true" : "false"} and claims the pairs are`
            + ` ${claimsAlike ? "alike" : "unlike"}, but the derivation found them`
            + ` ${derivedAlike ? "alike" : "unlike"}\n  ${closing.replace(/<[^>]+>/g, "")}`);
        checked++;
    }

    assert(checked > 20, `only ${checked} analogies were checkable`);
});
