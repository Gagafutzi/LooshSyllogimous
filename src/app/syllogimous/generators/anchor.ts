/**
 * Anchor space — positions stated against fixed landmarks.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { hi, subj } from "../utils/phrasing";
import { GeneratorContext, modifierOn, buildSeries, extendWithSeries, seriesWanted } from "./context";
import { extraTransforms } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { CoordMap, SPATIAL_VOCAB, Transform, TransformKind, describeConclusion, describeWideConclusion, describeOffset, describeTransform, replay } from "../utils/transformations.utils";
import { ANCHORS, anchorCoordMap } from "../utils/anchor.utils";
import { orderPremises, scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createAnchorSpace(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createAnchorSpace");

    const settings = ctx.settings;
    const type = EnumQuestionType.AnchorSpace;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const question = new Question(type);
    const objectCount = numOfPremises;
    /*
     * The mode's one rung, and it had never been read.
     *
     * `RUNG_LADDERS` has offered `negation` here since the table was written and
     * `RUNG_COST` prices it at 0.6, but nothing in this function looked — so
     * every item was a plain one sold at the negated price, and `chooseConfig`
     * additionally refused to raise the premise count past `structureBefore`
     * while the rung sat unclaimed. Per-mode override first, then the global
     * flag that `applyTo` has already folded the ladder into.
     */
    const negate = modifierOn(ctx, type, "negation", settings.enabled.negation);

    for (let attempt = 0; attempt < 400; attempt++) {
        const names = getRandomSymbols(settings, objectCount);
        const coords = anchorCoordMap();

        /*
         * Each object is stated against a parent — an anchor, or an object
         * already placed.
         *
         * Every object used to be pinned directly to an anchor, so **no premise
         * ever related two ordinary objects**, and that was reported from play.
         * It made the frame the only route between anything: every path was
         * object → anchor → anchor → object, two hops, the same two hops every
         * time.
         *
         * A parent that is another object adds the step the mode was missing.
         * The arrangement stays fully determined because a parent is always
         * placed before its child, and the chains are capped at two hops from
         * an anchor — past that the item stops being about a frame and becomes
         * a chain of offsets, which is what the composed spaces already are.
         *
         * The first two objects always take anchors, so there is something to
         * hang the rest on and the queried pair can still be made to route
         * through the frame.
         */
        const parentOf: Record<string, string> = {};
        const depthOf: Record<string, number> = {};
        const anchorOf: Record<string, string> = {};
        const taken = new Set(Object.values(coords).map(c => c.join(",")));

        for (const [i, n] of names.entries()) {
            // Only objects shallow enough to keep a chain within two hops.
            const hosts = names.slice(0, i).filter(h => depthOf[h] < 2);
            const host = i >= 2 && hosts.length && Math.random() < 0.45
                ? hosts[Math.floor(Math.random() * hosts.length)]
                : null;

            const base = host
                ? { token: host, coord: coords[host] }
                : ANCHORS[Math.floor(Math.random() * ANCHORS.length)];

            let c: number[];
            do {
                c = base.coord.map(v => v + Math.floor(Math.random() * 7) - 3);
            } while (taken.has(c.join(",")));
            taken.add(c.join(","));

            coords[n] = c;
            parentOf[n] = base.token;
            depthOf[n] = host ? depthOf[host] + 1 : 0;
            // The frame it ultimately hangs from, which is what decides whether
            // two objects are comparable without going through the anchors.
            anchorOf[n] = host ? anchorOf[host] : base.token;
        }

        const [x, y] = widestPair(names, coords);
        if (anchorOf[x] === anchorOf[y]) continue;

        const axisOrder = [0, 1];
        shuffle(axisOrder);
        const axes = axisOrder.filter(ax => coords[y][ax] !== coords[x][ax]);
        if (!axes.length) continue;

        /*
         * Both dimensions the pair differs on, not one of two. A frame stated
         * in two directions and answered about one asks half of what it said,
         * and which half was arbitrary — the same fix the composed spaces got.
         */
        const conclusion = describeWideConclusion(x, y, coords[x], coords[y], coinFlip());
        if (!conclusion) continue;

        const inverted = invertedPremises(negate, objectCount);

        question.bucket = names;
        question.premises = orderPremises(names.map((n, i) => describeOffset(
                parentOf[n], n, coords[parentOf[n]], coords[n], SPATIAL_VOCAB, inverted.has(i))), ctx.settingsOverrideService.scramble, ctx.mergeTarget());
        /*
         * Counted from the decision rather than from the rendered text, which is
         * what `renderRelation` returns its flag for: the rating scale charges
         * per negation and the answer budget pays three seconds for each, so
         * this number is spent, not merely displayed.
         */
        question.negations = inverted.size;
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;

        /*
         * More pairs of the same frame.
         *
         * Every object is placed against its anchor and the anchors against
         * each other, so the arrangement is settled once and answers any pair.
         * A second pair is usually reached through a different part of the
         * frame, which is the reason to ask twice rather than to add an object.
         */
        if (seriesWanted(ctx)) {
            extendWithSeries(question, buildSeries(want => {
                const a = names[Math.floor(Math.random() * names.length)];
                const b = names[Math.floor(Math.random() * names.length)];
                if (a === b) return null;

                const live = [0, 1].filter(ax => coords[b][ax] !== coords[a][ax]);
                if (!live.length) return null;
                const axis = live[Math.floor(Math.random() * live.length)];

                const claim = describeConclusion(a, b, coords[a], coords[b], axis, want);
                return claim && { text: claim.text, isValid: claim.isValid, key: `${a}:${b}:${axis}` };
            }));
        }

        // Anchors included: the frame is the thing being reasoned through, so a
        // map without it would leave out the half that made the item hard.
        question.wordCoordMap = { ...coords };
        question.axisNames = ["East-west", "North-south"];
        question.explanation = conclusion.axes.flatMap((ax: number) =>
            explainAnchor(x, y, parentOf, coords, ax));
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Which premises state their offsets in the inverted form.
 *
 * The rule is `renderPremises`' in `linear.utils`, and it is here for the same
 * reasons rather than by imitation. A per-premise coin flip inverts *every*
 * premise about one item in 2^n, and a uniformly inverted item is a different
 * and easier exercise — read the whole thing backwards once and the cue never
 * has to be tracked again. So the count is drawn between one and half the
 * premises: never all of them, and never none, which is what makes switching
 * the rung on show up in the item at all.
 *
 * Indices are into `names`, before the premises are scrambled. Which object is
 * inverted is what matters; where its premise lands is the scrambler's business.
 */
function invertedPremises(on: boolean, count: number): Set<number> {
    const chosen = new Set<number>();
    if (!on || count < 1) return chosen;

    const most = Math.max(1, Math.ceil(count / 2));
    const k = 1 + Math.floor(Math.random() * most);
    const pool = Array.from({ length: count }, (_, i) => i);
    for (let i = 0; i < k && pool.length; i++) {
        chosen.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return chosen;
}

/**
 * Why the two sit that way round, routed through the frame.
 *
 * The pair always hangs off *different* anchors — items where they share one
 * are rejected, because those are comparable directly and skip the skill.
 * So the derivation has to do what the player has to do: put each object on
 * the frame's own coordinates first, and only then compare. Stating the
 * anchors' positions is the step people leave out.
 *
 * Distances come from the coordinates rather than from the premises as
 * rendered, because negation states an offset by its opposite pole — so under
 * that rung the text a player reads is not the arithmetic being done, and the
 * derivation shows the recovered offset, which is the number they should have
 * arrived at.
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

/**
 * Both objects walked back to the frame, one step per premise.
 *
 * A parent is an anchor or another object, so a chain can be two steps long —
 * and a derivation that stated only the last step would explain the easy half
 * of exactly the items the chaining made hard. Each step is one premise the
 * reader was given, in the order they have to be composed.
 */
function explainAnchor(
    x: string,
    y: string,
    parentOf: Record<string, string>,
    coords: Record<string, number[]>,
    axis: number,
): string[] {
    const [pos, neg] = SPATIAL_VOCAB.axisWords[axis];

    const walk = (n: string): string[] => {
        // Anchor first, then down to the object, which is the order the reader
        // has to put the offsets together in.
        const chain: string[] = [];
        for (let at = n, guard = 0; parentOf[at] && guard < 8; at = parentOf[at], guard++) {
            chain.unshift(at);
        }
        return chain.map(step => {
            const p = parentOf[step];
            const delta = coords[step][axis] - coords[p][axis];
            const word = delta === 0 ? "level with" : `${Math.abs(delta)} ${delta > 0 ? pos : neg} of`;
            return `${subj(step)} sits ${hi(word)} ${subj(p)}, which is at`
                + ` ${hi(String(coords[p][axis]))} — so ${subj(step)} is at`
                + ` ${hi(String(coords[step][axis]))}`;
        });
    };

    const delta = coords[y][axis] - coords[x][axis];
    return [
        `On this dimension the anchors are what tie the two together.`,
        ...walk(x),
        ...walk(y),
        `so ${subj(y)} is ${hi(delta > 0 ? pos : neg)} of ${subj(x)}`
        + ` — ${Math.abs(delta)} apart.`,
    ];
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

        const [x, y] = widestPair(names, final);

        // Layout premises always pin to an anchor, so only a transform can name
        // both queried objects — and that would state their relation directly.
        if (transforms.some(t => (t.a === x && t.b === y) || (t.a === y && t.b === x))) continue;

        const axisOrder = [0, 1];
        shuffle(axisOrder);
        const axes = axisOrder.filter(ax => final[y][ax] !== final[x][ax]);
        if (!axes.length) continue;

        // Both dimensions, as in v1; see there.
        const conclusion = describeWideConclusion(x, y, final[x], final[y], coinFlip());
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
        /*
         * One walk per dimension the claim names, then what is actually true.
         * A walk down one axis explained half a two-axis claim — and for a
         * false one, possibly the half that was right.
         */
        question.explanation = [
            ...conclusion.axes.flatMap((ax: number) =>
                explainAnchorV2(x, y, anchorOf, initial, transforms, ax)),
            `so ${subj(y)} ends up `
            + hi(conclusion.axes
                .map((ax: number) => SPATIAL_VOCAB.axisWords[ax][final[y][ax] - final[x][ax] > 0 ? 0 : 1])
                .join(", "))
            + ` relative to ${subj(x)}.`,
        ];

        /*
         * More pairs of the result. Each carries the first claim's requirement:
         * the transforms have to have changed it, or it is answerable from the
         * placements alone and the operations become reading practice.
         */
        if (seriesWanted(ctx)) {
            extendWithSeries(question, buildSeries(want => {
                const a = names[Math.floor(Math.random() * names.length)];
                const b = names[Math.floor(Math.random() * names.length)];
                if (a === b) return null;

                const live = [0, 1].filter(ax => final[b][ax] !== final[a][ax]);
                if (!live.length) return null;
                const axis = live[Math.floor(Math.random() * live.length)];

                const was = describeConclusion(a, b, initial[a], initial[b], axis, true);
                const now = describeConclusion(a, b, final[a], final[b], axis, true);
                if (!was || !now || was.isValid === now.isValid) return null;

                const claim = describeConclusion(a, b, final[a], final[b], axis, want);
                return claim && { text: claim.text, isValid: claim.isValid, key: `${a}:${b}:${axis}` };
            }));
        }
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * A coordinate trace, because a path through the premises would be wrong here.
 *
 * Every other derivation in the app walks the stated relations. That works
 * while premises *describe* an arrangement; it breaks the moment some of them
 * *change* it, because the relation a premise states stops holding as soon as a
 * later transform moves one of its ends. The roadmap flagged this as needing a
 * different renderer, and this is it: positions are replayed from the stated
 * start, and only the steps that move one of the two queried objects are shown.
 *
 * Transforms that move neither are deliberately omitted. They are in the item
 * to be read and dismissed, and re-listing them would bury the two or three
 * lines that decide the answer.
 */
function explainAnchorV2(
    x: string,
    y: string,
    anchorOf: Record<string, string>,
    initial: CoordMap,
    transforms: Transform[],
    axis: number,
): string[] {
    const [pos, neg] = SPATIAL_VOCAB.axisWords[axis];
    const lines: string[] = [];

    const start = (n: string) => {
        const a = anchorOf[n];
        const delta = initial[n][axis] - initial[a][axis];
        const word = delta === 0 ? "level with" : `${Math.abs(delta)} ${delta > 0 ? pos : neg} of`;
        return `${subj(n)} starts ${hi(word)} ${subj(a)} \u2014 at ${hi(String(initial[n][axis]))}`;
    };

    lines.push(start(x));
    lines.push(start(y));

    let at = initial;
    for (let i = 0; i < transforms.length; i++) {
        const t = transforms[i];
        const next = replay(initial, transforms.slice(0, i + 1));
        const moved = [x, y].filter(n => next[n][axis] !== at[n][axis]);
        if (moved.length) {
            lines.push(`${describeTransform(t)} \u2014 `
                + moved.map(n => `${subj(n)} is now at ${hi(String(next[n][axis]))}`).join(", "));
        }
        at = next;
    }

    const delta = at[y][axis] - at[x][axis];
    lines.push(`so ${subj(y)} ends up ${hi(delta > 0 ? pos : neg)} of ${subj(x)}`
        + ` \u2014 ${Math.abs(delta)} apart.`);
    return lines;
}
