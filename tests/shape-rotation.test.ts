/**
 * Shape and Rotation — objects that move on their own.
 *
 * Reported from play: *"currently only the whole shape is spinning"*. Every
 * object's answer was one shared addition applied to a different starting
 * corner, and the setup line said as much — "objects turn with the shape" was
 * the whole movement model.
 *
 * The `solo-turns` rung adds the one offset that is *not* shared. That is the
 * difficulty, and it is also the hazard: this mode's other question form is
 * about rotational invariance, and its derivation states outright that "a turn
 * moves every object by the same amount, so it cannot change how two of them
 * sit relative to each other". A solo step falsifies exactly that sentence.
 *
 * So the interesting test here is not that the feature works. It is that the
 * form which contradicts it is never asked about a pair the contradiction
 * applies to — a confident derivation of a false claim being the one failure
 * this mode could produce that a player would have no way to tell from a
 * correct one.
 */

import { assert, equal, seeded, test } from "./harness";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

function context(solo: boolean): GeneratorContext {
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
            hasRung: () => solo, depthBonusFor: () => 0,
            dialFor: () => 0,
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: unknown, rung: string) => solo && rung === "solo-turns",
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (s: unknown) => String(s ?? "").replace(/<[^>]+>/g, "");
const subjectsOf = (html: string) =>
    [...html.matchAll(/<span class="subject">(.*?)<\/span>/g)].map(m => strip(m[1]));

/** The premises that move one object rather than the whole shape. */
const soloPremises = (premises: string[]) => premises.filter(p => /on its own/.test(p));

test("without the rung the shape is the only thing that moves", () => {
    seeded(808, () => {
        for (let rep = 0; rep < 60; rep++) {
            const q = createShapeRotation(context(false), 4 + (rep % 4));
            equal(soloPremises(q.premises).length, 0,
                "an object moved on its own without the rung being claimed");
            assert(/turn with the shape\.$/.test(strip(q.setup[0])),
                `the setup promises something else: ${strip(q.setup[0])}`);
        }
    });
});

test("with the rung, objects step round the shape on their own", () => {
    let items = 0, withSolo = 0, movers = 0, objects = 0;

    seeded(808, () => {
        for (let rep = 0; rep < 120; rep++) {
            const q = createShapeRotation(context(true), 4 + (rep % 4));
            items++;
            const solo = soloPremises(q.premises);
            if (solo.length) {
                withSolo++;
                movers += solo.length;
                objects += q.bucket.length;
                // The card has to say the model changed, or the reader applies
                // the old one and is wrong for a reason nothing showed them.
                assert(/on its own/.test(strip(q.setup[0])),
                    `the setup still says objects only turn with the shape`);
            }
        }
    });

    assert(withSolo > items / 2, `only ${withSolo} of ${items} items had one`);
    assert(movers < objects, "every object moved alone, which makes the shape's turn dead weight");
});

/**
 * The whole point of the guard.
 *
 * An invariance item claims the pair is unchanged by the turns and explains
 * that a turn moves everything equally. That is true of a pair which either
 * both stepped alone by the same amount or neither did, and false otherwise —
 * and it is false in a way no player could catch, since the derivation reads
 * exactly as it does when it is right.
 */
test("an invariance item is never asked about a pair one of them stepped out of", () => {
    let invariance = 0;

    seeded(4242, () => {
        for (let rep = 0; rep < 200; rep++) {
            const q = createShapeRotation(context(true), 4 + (rep % 4));
            if (q.answerMode !== "boolean") continue;
            invariance++;

            const pair = subjectsOf(String(q.conclusion));
            equal(pair.length, 2, `an invariance conclusion naming ${pair.length} objects`);

            // How far each of the two was moved on its own, as the premises say.
            const stepOf = (who: string) => {
                const line = soloPremises(q.premises)
                    .find(p => subjectsOf(p)[0] === who);
                if (!line) return "0";
                const m = /(\d+) corners? (clockwise|anticlockwise)/.exec(strip(line));
                return m ? `${m[1]} ${m[2]}` : "?";
            };

            equal(stepOf(pair[0]), stepOf(pair[1]),
                `"${strip(q.conclusion)}" is asked about a pair that moved differently,`
                + ` and its derivation says a turn cannot separate them`);
        }
    });

    assert(invariance > 20, `only ${invariance} invariance items to check`);
});

/** A solo step is part of the answer, so it has to be part of the working. */
test("the derivation accounts for a solo step rather than folding it in", () => {
    let checked = 0;

    seeded(99, () => {
        for (let rep = 0; rep < 200; rep++) {
            const q = createShapeRotation(context(true), 4 + (rep % 4));
            if (q.answerMode !== "choice" || !soloPremises(q.premises).length) continue;

            const asked = q.choicePrompt.replace(/^Which corner is /, "").replace(/ on after.*$/, "");
            const moved = soloPremises(q.premises).some(p => subjectsOf(p)[0] === asked);
            if (!moved) continue;
            checked++;

            assert(q.explanation.some(line => /on its own/.test(strip(line))),
                `${asked} moved alone and the working never says so:\n`
                + q.explanation.map(strip).join("\n"));
        }
    });

    assert(checked > 10, `only ${checked} items asked about an object that moved alone`);
});
