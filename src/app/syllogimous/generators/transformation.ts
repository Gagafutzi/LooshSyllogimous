/**
 * Transformation — operations replayed over a coordinate map.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext, buildSeries, extendWithSeries, seriesWanted } from "./context";
import { extraTransforms } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { CoordMap, SPATIAL_VOCAB, Transform, TransformKind, describeConclusion, describeOffset, describeTransform, replay, describeWideConclusion } from "../utils/transformations.utils";
import { scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { hi, subj } from "../utils/phrasing";

export function createTransformation(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createTransformation");

    const settings = ctx.settings;
    const type = EnumQuestionType.Transformation;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

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
        const [x, y] = widestPair(names, final);

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

        /*
         * Every dimension the pair differs on, not one of three.
         *
         * A three-dimensional item answered by a claim about one dimension asks
         * about a third of what it stated, and which third was arbitrary. The
         * composed spaces were fixed years of work ago and this family was
         * missed, because it words its claims through its own helper.
         */
        const conclusion = describeWideConclusion(x, y, final[x], final[y], coinFlip());
        if (!conclusion) continue;

        /*
         * The transforms have to change the answer, on some axis the claim
         * actually names — otherwise the item is answerable from the layout
         * premises alone and the operations are reading practice.
         */
        const moved = conclusion.axes.some((ax: number) => {
            const was = describeConclusion(x, y, initial[x], initial[y], ax, true);
            const now = describeConclusion(x, y, final[x], final[y], ax, true);
            return !was || !now || was.isValid !== now.isValid;
        });
        if (!moved) continue;

        question.bucket = names;
        question.premises = scrambleLeading(
            [...layoutPremises, ...transforms.map(t => describeTransform(t))],
            layoutPremises.length,
            ctx.settingsOverrideService.scramble);
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;
        question.explanation = explainWide(
            x, y, names, initial, transforms, conclusion.axes, final);

        /*
         * More pairs of the arrangement the transforms left behind.
         *
         * The replay is the expensive part and it is done once; a second pair
         * asks the reader to read the *result* again somewhere else rather than
         * to replay a second set of operations. Each extra claim carries the
         * same requirement as the first — the transforms have to have changed
         * it — or it is answerable from the layout premises alone and the
         * operations become reading practice.
         */
        /*
         * Another pair, and never the one already asked about.
         *
         * The first version keyed a claim on its pair and axis but never told
         * the drawer which pair the item's *own* conclusion had taken — so the
         * second claim could be the first one over again, same objects and same
         * dimension. Which is what happened.
         */
        if (seriesWanted(ctx)) {
            const askedPair = [x, y].sort().join("\u0000");
            extendWithSeries(question, buildSeries(want => {
                const a = names[Math.floor(Math.random() * names.length)];
                const b = names[Math.floor(Math.random() * names.length)];
                if (a === b) return null;

                const key = [a, b].sort().join("\u0000");
                if (key === askedPair) return null;

                const claim = describeWideConclusion(a, b, final[a], final[b], want);
                if (!claim) return null;

                const bites = claim.axes.some((ax: number) => {
                    const was = describeConclusion(a, b, initial[a], initial[b], ax, true);
                    const now = describeConclusion(a, b, final[a], final[b], ax, true);
                    return !was || !now || was.isValid !== now.isValid;
                });
                if (!bites) return null;

                return { text: claim.text, isValid: claim.isValid, key };
            }));
        }
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * A coordinate trace, the same shape as Anchor Space v2's.
 *
 * A path through the premises cannot work in a mode whose premises rewrite the
 * arrangement: the offset a layout premise states stops holding the moment a
 * transform moves one of its ends, so a walk would derive the starting relation
 * and present it as the answer. Positions are replayed instead, and only the
 * steps that actually move one of the two queried objects are shown — the rest
 * are there to be read and dismissed.
 *
 * Coordinates are stated relative to the first object, since that is all the
 * premises determine: they chain offsets, so the arrangement is fixed only up
 * to where the chain is pinned. Shifting the whole frame is safe because every
 * operation here is defined against a pivot that shifts with it — a mirror, a
 * scaling or a rotation about a moved pivot gives the same result moved by the
 * same amount — so the trace is the same arrangement in readable numbers.
 */
/**
 * The pair that differs on the most dimensions.
 *
 * A pair drawn at random coincides on some axis often enough to matter — a
 * fifth of them on a two-axis frame — and a claim can only name the axes a pair
 * actually differs on. So a random draw produced one-dimensional claims in a
 * multi-dimensional item, which is the defect the wide claim exists to remove,
 * arriving by the other door.
 *
 * Drawn among the widest rather than fixed on one, so the item does not always
 * ask about the same extreme pair.
 */
function widestPair(names: string[], at: Record<string, number[]>): [string, string] {
    const pairs: Array<{ pair: [string, string]; spread: number }> = [];
    for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
            const [a, b] = [names[i], names[j]];
            const spread = at[a].filter((_, k) => at[b][k] !== at[a][k]).length;
            if (spread) pairs.push({ pair: [a, b], spread });
        }
    }
    if (!pairs.length) return [names[0], names[1]];

    const most = Math.max(...pairs.map(p => p.spread));
    const best = pairs.filter(p => p.spread === most);
    return best[Math.floor(Math.random() * best.length)].pair;
}

function explainTransformation(
    x: string,
    y: string,
    names: string[],
    initial: CoordMap,
    transforms: Transform[],
    axis: number,
): string[] {
    const root = names[0];
    const origin = initial[root];
    const zeroed: CoordMap = {};
    for (const n of names) zeroed[n] = initial[n].map((v, i) => v - origin[i]);

    const [pos, neg] = SPATIAL_VOCAB.axisWords[axis];
    const place = (v: number) =>
        v === 0 ? `level with ${subj(root)}` : `${Math.abs(v)} ${v > 0 ? pos : neg} of ${subj(root)}`;

    const lines: string[] = [
        `${subj(x)} starts ${hi(place(zeroed[x][axis]))}`,
        `${subj(y)} starts ${hi(place(zeroed[y][axis]))}`,
    ];

    let at = zeroed;
    for (let i = 0; i < transforms.length; i++) {
        const next = replay(zeroed, transforms.slice(0, i + 1));
        const moved = [x, y].filter(n => next[n][axis] !== at[n][axis]);
        if (moved.length) {
            lines.push(`${describeTransform(transforms[i])} \u2014 `
                + moved.map(n => `${subj(n)} is now ${hi(place(next[n][axis]))}`).join(", "));
        }
        at = next;
    }

    const delta = at[y][axis] - at[x][axis];
    lines.push(`so ${subj(y)} ends up ${hi(delta > 0 ? pos : neg)} of ${subj(x)}`
        + ` \u2014 ${Math.abs(delta)} apart.`);
    return lines;
}

/**
 * The trace, once per dimension the claim names.
 *
 * A wide claim is several statements at once, so a derivation that walked one
 * axis explained a third of it — and worse, explained a *different* third from
 * the one a false claim was wrong about, which is a derivation proving
 * something the item never said.
 *
 * Walked in the order the claim states them, so the reader can follow the two
 * side by side, and closed on the whole relation as it actually ended up. That
 * closing line is what a false claim has to be checked against: it says what is
 * true, and the claim differs from it on exactly one axis.
 */
function explainWide(
    x: string,
    y: string,
    names: string[],
    initial: CoordMap,
    transforms: Transform[],
    axes: number[],
    final: CoordMap,
): string[] {
    const lines = axes.flatMap(axis =>
        explainTransformation(x, y, names, initial, transforms, axis));

    const truth = axes.map(axis => {
        const [pos, neg] = SPATIAL_VOCAB.axisWords[axis];
        return final[y][axis] - final[x][axis] > 0 ? pos : neg;
    });

    lines.push(`so ${subj(y)} ends up ${hi(truth.join(", "))} relative to ${subj(x)}.`);
    return lines;
}
