/**
 * Anchor space — positions stated against fixed landmarks.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { extraTransforms } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { Transform, TransformKind, describeConclusion, describeOffset, describeTransform, replay } from "../utils/transformations.utils";
import { ANCHORS, anchorCoordMap } from "../utils/anchor.utils";
import { scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createAnchorSpace(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createAnchorSpace");

    const settings = ctx.settings;
    const type = EnumQuestionType.AnchorSpace;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);
    const objectCount = numOfPremises;

    for (let attempt = 0; attempt < 400; attempt++) {
        const names = getRandomSymbols(settings, objectCount);
        const coords = anchorCoordMap();

        // Each object is pinned to one anchor. Recording which anchor lets us
        // reject pairs that share one — those are comparable directly, without
        // routing through the frame, which is the skill being trained.
        const anchorOf: Record<string, string> = {};
        const taken = new Set(Object.values(coords).map(c => c.join(",")));

        for (const n of names) {
            const anchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
            let c: number[];
            do {
                c = anchor.coord.map(v => v + Math.floor(Math.random() * 7) - 3);
            } while (taken.has(c.join(",")));
            taken.add(c.join(","));
            coords[n] = c;
            anchorOf[n] = anchor.token;
        }

        const [x, y] = pickUniqueItems(names, 2).picked;
        if (anchorOf[x] === anchorOf[y]) continue;

        const axisOrder = [0, 1];
        shuffle(axisOrder);
        const axes = axisOrder.filter(ax => coords[y][ax] !== coords[x][ax]);
        if (!axes.length) continue;

        const conclusion = describeConclusion(x, y, coords[x], coords[y], axes[0], coinFlip());
        if (!conclusion) continue;

        question.bucket = names;
        question.premises = scrambleByFactor(
            names.map(n => describeOffset(anchorOf[n], n, coords[anchorOf[n]], coords[n])),
            ctx.settingsOverrideService.scramble);
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;
        return question;
    }

    throw new Error("Cannot generate.");
}

export function createAnchorSpaceV2(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createAnchorSpaceV2");

    const settings = ctx.settings;
    const type = EnumQuestionType.AnchorSpaceV2;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);
    const extra = extraTransforms(ctx, type);
    const objectCount = Math.max(2, Math.ceil(numOfPremises / 2) - extra);
    const transformCount = Math.max(1, numOfPremises - objectCount);

    for (let attempt = 0; attempt < 400; attempt++) {
        const names = getRandomSymbols(settings, objectCount);
        const initial = anchorCoordMap();
        const anchorOf: Record<string, string> = {};
        const taken = new Set(Object.values(initial).map(c => c.join(",")));

        for (const n of names) {
            const anchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
            let c: number[];
            do {
                c = anchor.coord.map(v => v + Math.floor(Math.random() * 7) - 3);
            } while (taken.has(c.join(",")));
            taken.add(c.join(","));
            initial[n] = c;
            anchorOf[n] = anchor.token;
        }

        // Markers are pivots, never movers — that is what keeps the frame
        // fixed while everything measured against it moves.
        const pivots = [...ANCHORS.map(a => a.token), ...names];
        // Same dedupe as Transformation; 2D has a smaller descriptor space, so
        // collisions are correspondingly more likely here.
        const transforms: Transform[] = [];
        const seenTransforms = new Set<string>();
        for (let guard = 0; transforms.length < transformCount && guard < transformCount * 25; guard++) {
            const b = names[Math.floor(Math.random() * names.length)];
            const candidates = pivots.filter(p => p !== b);
            const a = candidates[Math.floor(Math.random() * candidates.length)];
            const kind = pickUniqueItems<TransformKind>(["mirror", "set", "scale", "rotate"], 1).picked[0];
            const t: Transform = kind === "rotate"
                ? { kind, a, b, plane: [0, 1], clockwise: coinFlip() }
                : { kind, a, b, dimension: Math.floor(Math.random() * 2) };
            const key = describeTransform(t);
            if (seenTransforms.has(key)) continue;
            seenTransforms.add(key);
            transforms.push(t);
        }
        if (transforms.length < transformCount) continue;

        const final = replay(initial, transforms);

        // The frame must survive intact; a moved marker would invalidate every
        // premise stated against it.
        if (ANCHORS.some(a => final[a.token].join(",") !== a.coord.join(","))) continue;

        const [x, y] = pickUniqueItems(names, 2).picked;

        // Layout premises always pin to an anchor, so only a transform can name
        // both queried objects — and that would state their relation directly.
        if (transforms.some(t => (t.a === x && t.b === y) || (t.a === y && t.b === x))) continue;

        const axisOrder = [0, 1];
        shuffle(axisOrder);
        const axes = axisOrder.filter(ax => final[y][ax] !== final[x][ax]);
        if (!axes.length) continue;

        const conclusion = describeConclusion(x, y, final[x], final[y], axes[0], coinFlip());
        if (!conclusion) continue;

        // Reject items the transforms did not actually change at the queried
        // pair — those are answerable from the layout premises alone.
        const before = describeConclusion(x, y, initial[x], initial[y], axes[0], true);
        const after = describeConclusion(x, y, final[x], final[y], axes[0], true);
        if (before && after && before.isValid === after.isValid) continue;

        question.bucket = names;
        question.premises = scrambleLeading(
            [
                ...names.map(n => describeOffset(anchorOf[n], n, initial[anchorOf[n]], initial[n])),
                ...transforms.map(t => describeTransform(t)),
            ],
            names.length,
            ctx.settingsOverrideService.scramble);
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;
        return question;
    }

    throw new Error("Cannot generate.");
}
