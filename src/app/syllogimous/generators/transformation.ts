/**
 * Transformation — operations replayed over a coordinate map.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { extraTransforms } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { CoordMap, Transform, TransformKind, describeConclusion, describeOffset, describeTransform, replay } from "../utils/transformations.utils";
import { scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createTransformation(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createTransformation");

    const settings = ctx.settings;
    const type = EnumQuestionType.Transformation;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);

    // Premises split between fixing the starting layout (objects - 1) and
    // mutating it (the rest), so both halves scale with the requested count.
    const baseObjects = Math.max(3, Math.min(6,
        numOfPremises - Math.max(1, Math.round(numOfPremises / 2)) + 1));

    /*
     * Depth trades objects for transforms, but only down to four objects.
     * Below that the layout chain states almost every pair outright, so the
     * "not directly related" and "transforms must change the pair" guards
     * leave nothing to ask about and generation fails. Applying only the
     * affordable share keeps low premise counts generatable.
     */
    const affordableExtra = Math.max(0, baseObjects - 4);
    const objectCount = baseObjects - Math.min(extraTransforms(ctx, type), affordableExtra);
    const transformCount = Math.max(1, numOfPremises - objectCount + 1);

    for (let attempt = 0; attempt < 400; attempt++) {
        const names = getRandomSymbols(settings, objectCount);

        // Distinct starting positions; a duplicate would make an offset
        // premise ambiguous about which object it pins.
        const initial: CoordMap = {};
        const taken = new Set<string>();
        for (const n of names) {
            let c: number[];
            do {
                c = [0, 0, 0].map(() => Math.floor(Math.random() * 7) - 3);
            } while (taken.has(c.join(",")));
            taken.add(c.join(","));
            initial[n] = c;
        }

        // Chain the layout premises so every object is pinned to the previous.
        const layoutPremises = names.slice(1).map((n, i) =>
            describeOffset(names[i], n, initial[names[i]], initial[n]));

        /*
         * Descriptors are drawn independently, so with few objects the same one
         * can come up twice and render as two identical premise lines. A repeated
         * "set" is a literal no-op (it is idempotent), so dedupe on the rendered
         * text. Repeating a *pair* with a different operation stays allowed —
         * that is meaningful.
         */
        const transforms: Transform[] = [];
        const seenTransforms = new Set<string>();
        for (let guard = 0; transforms.length < transformCount && guard < transformCount * 25; guard++) {
            const [b, a] = pickUniqueItems(names, 2).picked;
            const kind = pickUniqueItems<TransformKind>(["mirror", "set", "scale", "rotate"], 1).picked[0];
            const t: Transform = kind === "rotate"
                ? { kind, a, b, plane: pickUniqueItems([0, 1, 2], 2).picked.sort((x, y) => x - y) as [number, number], clockwise: coinFlip() }
                : { kind, a, b, dimension: Math.floor(Math.random() * 3) };
            const key = describeTransform(t);
            if (seenTransforms.has(key)) continue;
            seenTransforms.add(key);
            transforms.push(t);
        }
        if (transforms.length < transformCount) continue;

        const final = replay(initial, transforms);

        // Ask about an axis the two objects actually differ on; a tie has no
        // direction word and cannot be phrased as a true/false claim.
        const [x, y] = pickUniqueItems(names, 2).picked;

        /*
         * A single premise relating both queried objects hands over the answer
         * (or its starting value) directly, so the item tests reading rather
         * than tracking. Layout premises chain consecutive objects and a
         * transform names its own pair, so both are checked. Compared
         * structurally, not by substring — one stimulus name can contain
         * another ("Ant" inside "Antlers").
         */
        const statedTogether = (p: string, q: string) =>
            names.some((n, i) => i > 0 && ((names[i - 1] === p && n === q) || (names[i - 1] === q && n === p)))
            || transforms.some(t => (t.a === p && t.b === q) || (t.a === q && t.b === p));
        if (statedTogether(x, y)) continue;

        const axisOrder = [0, 1, 2];
        shuffle(axisOrder);
        const axes = axisOrder.filter(ax => final[y][ax] !== final[x][ax]);
        if (!axes.length) continue;

        const conclusion = describeConclusion(x, y, final[x], final[y], axes[0], coinFlip());
        if (!conclusion) continue;

        // Reject items the transforms left untouched at the queried pair —
        // those are answerable from the layout premises alone.
        const before = describeConclusion(x, y, initial[x], initial[y], axes[0], true);
        const after = describeConclusion(x, y, final[x], final[y], axes[0], true);
        if (before && after && before.isValid === after.isValid) continue;

        question.bucket = names;
        question.premises = scrambleLeading(
            [...layoutPremises, ...transforms.map(t => describeTransform(t))],
            layoutPremises.length,
            ctx.settingsOverrideService.scramble);
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;
        return question;
    }

    throw new Error("Cannot generate.");
}
