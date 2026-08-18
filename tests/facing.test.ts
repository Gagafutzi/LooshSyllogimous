/**
 * Egocentric relations, and the one thing they must never do: disagree with the
 * layout they were read off.
 *
 * "B is west of A" is a fact about the world; "B is on A's left" is a fact about
 * the world *and* about which way A is turned. The second cannot be read off
 * the premises directly — the layout has to be re-expressed from a point inside
 * it — which is the whole value of the modifier and also the whole risk, since
 * a generator and a reader now have two chances to disagree.
 *
 * So the generated items are checked by recomputing the answer from the
 * coordinates the item is actually built on, using only what the player can
 * see: who faces whom, and who is being asked about.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { axesForDimensions } from "../src/app/syllogimous/utils/ndspace.utils";
import { Egocentric, bearingPlane, egocentric } from "../src/app/syllogimous/utils/facing.utils";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: (k: string) => (k === "facing" ? true : null),
            axesFor: () => null, circularAxes: () => 0, depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

test("left and right are worked out the way a person would", () => {
    // Facing east. North is on your left, south on your right, and the two
    // points on the line of sight are ahead and behind.
    const east: [number, number] = [1, 0];
    equal(egocentric(east, [0, 1]), "left" as Egocentric, "north of someone facing east");
    equal(egocentric(east, [0, -1]), "right" as Egocentric, "south of someone facing east");
    equal(egocentric(east, [3, 0]), "ahead" as Egocentric, "further east");
    equal(egocentric(east, [-2, 0]), "behind" as Egocentric, "back west");

    // Turn the viewer and everything turns with them.
    const north: [number, number] = [0, 1];
    equal(egocentric(north, [1, 0]), "right" as Egocentric, "east of someone facing north");
    equal(egocentric(north, [-1, 0]), "left" as Egocentric, "west of someone facing north");

    // Diagonals are not a special case; the sign of the cross product decides.
    equal(egocentric([1, 1], [-1, 1]), "left" as Egocentric, "north-west of a north-east facing");
    equal(egocentric([1, 1], [1, -1]), "right" as Egocentric, "south-east of a north-east facing");

    // Two cases with no answer, which must never reach an item.
    equal(egocentric(east, [0, 0]), null, "the viewer's own position");
    equal(egocentric([0, 0], [1, 1]), null, "a viewer facing nowhere");
});

test("the bearing plane skips axes that have no left", () => {
    const straight = axesForDimensions(4).map(scale => ({ scale }));
    equal(bearingPlane(straight), [0, 1], "the first two straight axes");

    // A ring has no consistent left and a parity axis has no distance to take a
    // bearing along, so both are passed over rather than used.
    const looped = straight.map((a, i) => i === 0 ? { ...a, modulus: 4 } : a);
    equal(bearingPlane(looped), [1, 2], "the loop was used as a bearing axis");

    equal(bearingPlane(straight.slice(0, 1)), null, "a single axis cannot carry a bearing");
});

/** Every subject named in a fragment, in order. */
function subjects(html: string): string[] {
    return [...html.matchAll(/<span class="subject">([^<]+)<\/span>/g)].map(m => m[1]);
}

test("a facing item states its facing and agrees with its own layout", () => {
    const ctx = context();
    let checked = 0;

    for (const type of [EnumQuestionType.Space3D, EnumQuestionType.Space4D, EnumQuestionType.Space6D]) {
        for (let run = 0; run < 30; run++) {
            const q = seeded(run * 6829 + 31, () => createNdSpace(ctx, 4, type));

            const facingPremise = q.premises.find(p => p.includes(">faces<"));
            if (!facingPremise) continue;

            const [viewer, faced] = subjects(facingPremise);
            const target = subjects(String(q.conclusion))[0];
            assert(!!viewer && !!faced && !!target, "the item did not name all three parties");
            assert(target !== viewer && target !== faced,
                "the claim is about one of the two the facing already relates");

            const claim = /(left|right|ahead|behind)/.exec(String(q.conclusion).replace(/<[^>]+>/g, ""));
            assert(!!claim, `no egocentric word in the claim: ${q.conclusion}`);

            /*
             * Recomputed from the coordinates the item is built on, through the
             * same two axes the generator judges by — with no loops and no
             * parity axis in these three modes, that is the first two.
             */
            const coords = q.wordCoordMap!;
            const at = (n: string): [number, number] => [coords[n][0], coords[n][1]];
            const sub = (a: [number, number], b: [number, number]): [number, number] =>
                [a[0] - b[0], a[1] - b[1]];

            const truth = egocentric(sub(at(faced), at(viewer)), sub(at(target), at(viewer)));
            assert(!!truth, "the item asked something with no answer");

            const claimed = claim![1] as Egocentric;
            assert((claimed === truth) === q.isValid,
                `${type}: claim "${claimed}" against truth "${truth}", item says ${q.isValid}`);

            checked++;
        }
    }

    assert(checked > 40, `only ${checked} facing items were produced`);
});
