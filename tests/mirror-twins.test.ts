/**
 * Mirror twins — the facing rung where left and right are exchanged.
 *
 * Isomorph's Frames mode is already here as the `facing` rung, and in a stronger
 * form: facings are stated relationally, so the facing itself has to be derived
 * before it can be used. The one thing it lacked is Frames' later twist — some
 * entities whose left and right are swapped.
 *
 * What makes it worth having is also what makes it easy to get wrong: everything
 * before the last step is unchanged. The bearing is worked out exactly as any
 * facing item's is, and only then is the answer said in a vocabulary where two of
 * the four words have traded places. A generator that applied the swap in the
 * wrong place — to the facing, or to the bearing — would produce items that look
 * identical and are wrong half the time.
 *
 * So the bearing is recomputed here from the two displacements the derivation
 * prints, by cross product, and the whole chain checked against it: the geometric
 * side, the twin's word for it, and the claim the card makes.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { MIRRORED, OPPOSITE } from "../src/app/syllogimous/utils/facing.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { BUILD } from "./modes";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

function context(held: string[]): GeneratorContext {
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
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: string, r: string) => held.includes(r),
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const isTwin = (q: Question) => q.premises.some(l => /mirror twin/.test(strip(l)));

function items(held: string[], seed: number): Question[] {
    const ctx = context(held);
    const out: Question[] = [];
    seeded(seed, () => {
        for (let rep = 0; rep < 250; rep++) {
            try { out.push(BUILD[EnumQuestionType.Space4D](ctx, 6)); } catch { /* skip */ }
        }
    });
    assert(out.length > 50, `only ${out.length} items were built`);
    return out;
}

/** "2 west and 1 north" as a vector in the bearing plane. */
function bearing(text: string): [number, number] {
    let x = 0, y = 0;
    for (const m of text.matchAll(/(\d+)\s+(east|west|north|south)/g)) {
        const size = Number(m[1]);
        if (m[2] === "east") x = size;
        else if (m[2] === "west") x = -size;
        else if (m[2] === "north") y = size;
        else y = -size;
    }
    return [x, y];
}

test("mirror twins appear only when the rung is held", () => {
    equal(items(["facing"], 3101).filter(isTwin).length, 0,
        "a card names a mirror twin without the rung, so the rule is stated to players "
        + "who were never given it");
    const withRung = items(["facing", "mirror-twins"], 3101);
    assert(withRung.filter(isTwin).length > withRung.length / 2,
        "the rung is held and hardly any card uses it, so the ladder charges for "
        + "something it does not deliver");
});

/**
 * A twin item always asks sideways, and about the twin.
 *
 * Ahead and behind are the same word either way, so an item asking one would state
 * the rule and never use it — the player could ignore the whole premise and be
 * right. And a twin who is not the viewer changes nothing, since the swap is about
 * whose vocabulary the claim is said in.
 */
test("a mirror-twin item asks left or right, of the twin", () => {
    for (const q of items(["facing", "mirror-twins"], 3102)) {
        if (!isTwin(q)) continue;
        const conclusion = strip(String(q.conclusion));
        assert(/\bleft\b|\bright\b/.test(conclusion),
            `a twin item asks "${conclusion}", where the swap makes no difference`);

        const named = q.premises.find(l => /mirror twin/.test(strip(l)))!;
        const twin = strip(named).replace(/ is a mirror twin.*$/, "").trim();
        assert(conclusion.includes(twin),
            `${twin} is the mirror twin and the question is not asked from their side`);
    }
});

/**
 * The swap happens last, and the card's claim follows from it.
 *
 * Recomputed from the two displacements the derivation prints: the cross product
 * of the facing and the target gives the geometric side, the twin's word for it is
 * that side exchanged, and the conclusion is that word when the item is true and
 * its opposite when it is false. A generator applying the swap to the facing or to
 * the bearing instead would disagree here while looking the same on the card.
 */
test("a mirror twin's answer is the geometric side, exchanged last", () => {
    let checked = 0;
    for (const q of items(["facing", "mirror-twins"], 3103)) {
        if (!isTwin(q)) continue;
        const lines = q.explanation.map(strip);
        assert(lines.length >= 4,
            "a twin item's derivation does not show the swap as its own step");

        const facing = bearing(lines[0]);
        const toTarget = bearing(lines[1]);
        assert(facing[0] !== 0 || facing[1] !== 0, `no facing in: ${lines[0]}`);
        assert(toTarget[0] !== 0 || toTarget[1] !== 0, `no bearing in: ${lines[1]}`);

        const cross = facing[0] * toTarget[1] - facing[1] * toTarget[0];
        assert(cross !== 0,
            "the target is dead ahead or behind, where the swap makes no difference");
        const geometric = cross > 0 ? "left" : "right";
        const spoken = MIRRORED[geometric];

        assert(new RegExp(`\\b${geometric}\\b`).test(lines[2]),
            `the geometry puts it on the ${geometric} and the derivation says otherwise: `
            + lines[2]);
        assert(new RegExp(`\\b${spoken}\\b`).test(lines[3]),
            `a twin should call that side ${spoken}, and the derivation says: ${lines[3]}`);

        const claimed = q.isValid ? spoken : OPPOSITE[spoken];
        assert(new RegExp(`\\b${claimed}\\b`).test(strip(String(q.conclusion))),
            `the card is marked ${q.isValid} and its claim is not ${claimed}: `
            + strip(String(q.conclusion)));
        checked++;
    }
    assert(checked > 20, `only ${checked} twin items were checked`);
});
