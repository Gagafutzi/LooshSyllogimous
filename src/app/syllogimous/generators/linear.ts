/**
 * The linear-scale family, and the shared engine behind all five of them.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { coordMapFromPositions } from "../utils/map.utils";
import { GeneratorContext, modifierOn } from "./context";
import { buildConstructClaims } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, getRelation, isPremiseLikeConclusion, createMetaRelationships, shuffle } from "../utils/question.utils";
import { CoordMap, Transform, describeTransform, drawTransforms, replay } from "../utils/transformations.utils";
import { LINEAR_SCALES, LinearLayout, LinearScale, buildBranching, buildChain, buildConclusion, buildConclusionSet, buildConstructClaim, compare, explainLinear, hasTies, pickDistantPair, prefixLayout, renderPremises, vocabFor } from "../utils/linear.utils";
import { scrambleBlocks, scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { LinearFeatureFlags } from "../services/settings-override.service";
import { EnumQuestionType } from "../constants/question.constants";
import { subj } from "../utils/phrasing";
import { ONE_STEP_NOTE } from "./notes";

/**
 * Which linear scale a mode reads on, if any.
 *
 * The two Comparisons predate the shared engine and keep their original
 * generator while nothing structural is switched on, so a player who has not
 * unlocked anything sees exactly the v4 item they always saw.
 */
export function linearScaleFor(ctx: GeneratorContext, type: EnumQuestionType): LinearScale | undefined {
    return {
        [EnumQuestionType.ComparisonNumerical]: LINEAR_SCALES["quantity"],
        [EnumQuestionType.ComparisonChronological]: LINEAR_SCALES["temporal"],
        [EnumQuestionType.LinearVertical]: LINEAR_SCALES["vertical"],
        [EnumQuestionType.LinearHorizontal]: LINEAR_SCALES["horizontal"],
        [EnumQuestionType.LinearContains]: LINEAR_SCALES["contains"],
    }[type as string];
}

/**
 * Which structural modifiers are live for this mode right now.
 *
 * Two sources, in that order: what the ladder has earned, then anything
 * Customise forces. Forcing wins because it is an explicit choice,
 * and because there is otherwise no way to see these without climbing.
 */
export function linearFeatures(ctx: GeneratorContext, type: EnumQuestionType) {
    const ladder = (r: string) => ctx.hasRung(type, r);
    const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
        ctx.settingsOverrideService.linearOverride(k);

    const pick = (key: "branching" | "overlap" | "multiConclusion" | "chooseConclusion" | "constructConclusion" | "constructDistance" | "widePremises", rung: string) => {
        const f = forced(key);
        return f === null ? ladder(rung) : !!f;
    };

    const forcedTransforms = forced("transforms");
    const transforms = forcedTransforms === null
        ? (ladder("transform-1") ? 1 : 0) + (ladder("transform-2") ? 1 : 0)
        : Math.max(0, Math.min(4, forcedTransforms));

    const branching = pick("branching", "branching");

    return {
        branching,
        wide: pick("widePremises", "wide-premises"),
        // A chain cannot produce a tie however the flag is set, so overlap
        // is only meaningful once premises branch.
        overlap: branching && pick("overlap", "overlap"),
        transforms,
        /*
         * A claim answerable halfway through the reading, beside the one that
         * needs everything. See the branch in `fillLinearConclusion`.
         */
        checkpoint: ladder("checkpoint"),
        multiConclusion: pick("multiConclusion", "multi-conclusion"),
        chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
        constructConclusion: ctx.forceConstruction !== "off" || pick("constructConclusion", "construct-conclusion"),
        constructDistance: ctx.forceConstruction !== "off"
            ? ctx.forceConstruction === "distance"
            : pick("constructDistance", "construct-distance"),
    };
}

/** True when anything beyond a plain chain is in play. */
export function hasLinearModifiers(ctx: GeneratorContext, type: EnumQuestionType) {
    const f = linearFeatures(ctx, type);
    return f.branching || f.transforms > 0 || f.multiConclusion || f.chooseConclusion || f.constructConclusion;
}

export function createComparison(ctx: GeneratorContext, numOfPremises: number, type: EnumQuestionType.ComparisonNumerical | EnumQuestionType.ComparisonChronological) {
    ctx.logger.info("createComparison:", type);

    // Structural modifiers are only implemented in the shared engine, so
    // hand over as soon as one is live and otherwise leave v4 alone.
    if (hasLinearModifiers(ctx, type)) {
        return createLinear(ctx, numOfPremises, type);
    }

    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const length = numOfPremises + 1;
    const question = new Question(type);

    // Hoisted out of the loop so the derivation below can read the layout the
    // accepted attempt settled on.
    let sign = 1;
    let a = 0, b = 0;

    do {
        question.bucket = getRandomSymbols(settings, length);
        question.premises = [];
        sign = [-1, 1][Math.floor(Math.random() * 2)];

        let next = "";

        for (let i = 0; i < length - 1; i++) {
            const curr = question.bucket[i];
            next = question.bucket[i + 1];

            const isMoreOrAfter = coinFlip();
            const [first, last] = ((sign === 1) === isMoreOrAfter) ? [next, curr] : [curr, next];
            const relation = getRelation(settings, type, isMoreOrAfter);

            question.premises.push(`${subj(first)} is ${relation} ${subj(last)}`);
        }

        createMetaRelationships(settings, question, length, modifierOn(ctx, type, "meta", settings.enabled.meta));

        a = Math.floor(Math.random() * question.bucket.length);
        b = Math.floor(Math.random() * question.bucket.length);
        while (a === b) {
            b = Math.floor(Math.random() * question.bucket.length);
        }

        const isMoreOrAfter = coinFlip();
        const relation = getRelation(settings, type, isMoreOrAfter);

        question.conclusion = `${subj(question.bucket[a])} is ${relation} ${subj(question.bucket[b])}`;
        question.isValid = isMoreOrAfter
            ? sign === 1 && a > b || sign === -1 && a < b
            : sign === 1 && a < b || sign === -1 && a > b;
    } while (isPremiseLikeConclusion(question.premises, question.conclusion));

    /*
     * The chain this path built, recovered rather than tracked.
     *
     * This is the legacy generator — it never builds a layout, it emits
     * sentences directly — so the two covered scale modes explained themselves
     * while the Comparisons did not, purely because of which code path ran.
     *
     * Nothing needs tracking, though: `bucket` *is* the chain in order, and
     * `sign` is which way it runs, so positions are recoverable exactly.
     * Negation only rewords a relation and meta only rewrites premises into
     * claims about premises; neither moves anything, so the recovered layout is
     * the same layout the answer was decided from.
     */
    const scale = linearScaleFor(ctx, type);
    if (scale) {
        const pos: Record<string, number> = {};
        const neighbors: Record<string, string[]> = {};
        question.bucket.forEach((w, i) => { pos[w] = sign * i; neighbors[w] = []; });

        const edges: Array<[string, string]> = [];
        for (let i = 0; i < question.bucket.length - 1; i++) {
            const [x, y] = [question.bucket[i], question.bucket[i + 1]];
            edges.push([x, y]);
            neighbors[x].push(y);
            neighbors[y].push(x);
        }

        question.positions = pos;
        const layout: LinearLayout = { words: [...question.bucket], pos, edges, neighbors, branching: false };
        question.explanation = explainLinear(
            scale, layout, question.bucket[a], question.bucket[b]);
    }

    shuffle(question.premises);

    return question;
}

/**
 * The shared linear-scale generator (engine in `utils/linear.utils.ts`).
 *
 * Serves all five scale modes, and every structural modifier the family has:
 * branching premises, overlapping positions, transformations over the
 * one-axis space, multiple conclusions and choice answering. Which of those
 * are live comes from `linearFeatures`, so the same code path produces a
 * two-premise chain and an eight-premise branching layout under two
 * transformations.
 *
 * Verification is by construction: positions are integers, transformations
 * are pure maps replayed from the stated start, and every claim is decided
 * by comparing final positions. Generation and checking cannot drift.
 */
export function createLinear(ctx: GeneratorContext, numOfPremises: number, type: EnumQuestionType): Question {
    ctx.logger.info("createLinear:", type);

    const settings = ctx.settings;
    const scale = linearScaleFor(ctx, type);

    if (!scale || !canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const feat = linearFeatures(ctx, type);
    const vocab = vocabFor(scale);

    /*
     * The premise budget is shared: transformation premises come out of the
     * object count rather than being added on top, so claiming a rung never
     * smuggles in a premise increase — that is the one step the ladder is
     * supposed to ration. Four objects is the floor; below that a chain
     * states every pair outright and there is nothing left to infer.
     */
    const transformCount = Math.min(feat.transforms, Math.max(0, numOfPremises - 3));
    const objectCount = Math.max(4, numOfPremises + 1 - transformCount);

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, objectCount);
        const layout = feat.branching ? buildBranching(words) : buildChain(words);

        // Until overlap is earned, a layout that happens to tie is thrown
        // away rather than asked about — the third relation should appear
        // when the player unlocks it, not by accident.
        const ties = hasTies(layout);
        if (ties && !feat.overlap) continue;

        /*
         * Negation and overlap cannot both be on, and this is the reason.
         *
         * A negated premise names a relation the truth rules out, which
         * pins the layout only when one option is left: with two relations,
         * "not less than" means "more than". Once equality is on the table
         * there are three, so "not less than" leaves both more and equal
         * open, the premises stop determining the layout, and the item's
         * own answer no longer follows from what the player was shown.
         *
         * Dropping negation is the honest fix. The alternative — telling the
         * reader that stated pairs are never equal — would leak the
         * structure the overlap rung exists to hide.
         */
        const rendered = renderPremises(scale, layout, {
            negate: modifierOn(ctx, type, "negation", settings.enabled.negation) && !feat.overlap,
            allowTies: false,
            wide: feat.wide,
        });
        const premises = rendered.premises;

        // One axis, so the whole layout is a coordinate map of singletons.
        const initial: CoordMap = {};
        for (const w of words) initial[w] = [layout.pos[w]];

        let transforms: Transform[] = [];
        let finalPos = initial;
        if (transformCount > 0) {
            transforms = drawTransforms(words, transformCount, { dims: 1 }, vocab);
            if (transforms.length < transformCount) continue;
            finalPos = replay(initial, transforms);
        }

        const finalLayout: LinearLayout = {
            ...layout,
            pos: Object.fromEntries(words.map(w => [w, finalPos[w][0]])),
        };

        const question = new Question(type);
        question.negations = rendered.negations;
        /*
         * Transformations can push two objects onto the same coordinate
         * whatever the overlap rung says, so once they are on, the third
         * relation has to be available to describe the result honestly.
         */
        const options = { negate: false, allowTies: feat.overlap || transformCount > 0 };

        if (!fillLinearConclusion(ctx, question, scale, layout, finalLayout, feat, options, transformCount > 0, numOfPremises)) {
            continue;
        }

        /*
         * Meta relations go in before the transformations are appended, and
         * are judged against the *starting* layout, because that is what the
         * layout premises describe — a meta premise reporting the end state
         * would be describing something the reader has not been told yet.
         * Doing it first also keeps `createMetaRelationships` from replacing
         * a transformation premise, which would delete an operation the
         * conclusion depends on.
         *
         * Skipped when the starting layout ties, because the helper compares
         * with `<` and would call a tie "the opposite way" rather than equal.
         * Ties only happen once overlap is unlocked, so up to that rung meta
         * is always available.
         */
        question.bucket = [...words].sort((a, b) => layout.pos[b] - layout.pos[a]);
        question.premises = premises;

        /*
         * Where the first half stops, when there is a checkpoint.
         *
         * The premises are rendered from `layout.edges` in order, so the first
         * `half` of them are exactly the edges the checkpoint claim was built
         * from. That correspondence is the whole mechanism and it is fragile:
         * anything that reorders or replaces premises breaks it.
         */
        const boundary = question.construct.length === 2
            ? Math.floor(numOfPremises / 2)
            : 0;

        /*
         * Meta and checkpoints do not combine, and the reason is structural
         * rather than fussy. A meta premise *replaces* one or more premises
         * with a claim about a different pair, so after it runs there is no
         * longer a prefix of premises that determines what the checkpoint asks.
         * Skipped rather than worked around: a checkpoint the reader cannot
         * answer at the checkpoint is not one.
         */
        if (!ties && !boundary) {
            createMetaRelationships(settings, question, premises.length + 1,
                modifierOn(ctx, type, "meta", settings.enabled.meta));
        }

        if (boundary) {
            /*
             * Shuffled within each half and never across. Both halves may be
             * reordered — the claim follows from the *set* before the boundary,
             * not from a particular order within it — but a premise that
             * crossed the line would be one the reader did not have when the
             * first claim became answerable.
             */
            question.premises = scrambleBlocks(
                question.premises, boundary, ctx.settingsOverrideService.scramble);
            if (transformCount > 0) {
                question.premises.push(...transforms.map(t => describeTransform(t, vocab)));
            }
            question.wordCoordMap = coordMapFromPositions(finalLayout.pos);
            question.axisNames = [scale.name];
            question.setup = linearSetup(ctx, transformCount, feat.constructDistance);
            return question;
        }

        question.premises = transformCount > 0
            // Transformations are applied in sequence, so their order is
            // semantic and must not be shuffled into the layout premises.
            ? scrambleLeading(
                [...question.premises, ...transforms.map(t => describeTransform(t, vocab))],
                question.premises.length,
                ctx.settingsOverrideService.scramble)
            : scrambleByFactor(question.premises, ctx.settingsOverrideService.scramble);

        question.wordCoordMap = coordMapFromPositions(finalLayout.pos);
        question.axisNames = [scale.name];
        question.setup = linearSetup(ctx, transformCount, feat.constructDistance);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Attach the conclusion, in whichever answering mode is live.
 *
 * Returns false when this layout cannot be asked about — no pair far enough
 * apart, or transformations that left the queried pair where they found it,
 * which would make the transformation premises decorative.
 */
export function fillLinearConclusion(ctx: GeneratorContext, 
    question: Question,
    scale: LinearScale,
    initial: LinearLayout,
    final: LinearLayout,
    feat: ReturnType<typeof linearFeatures>,
    options: { negate: boolean; allowTies: boolean },
    transformed: boolean,
    numOfPremises: number,
): boolean {
    /*
     * Transformations have to matter. A set of claims whose truth is the
     * same before and after is answerable from the layout premises alone,
     * which turns the transformation premises into reading practice.
     */
    const transformsBite = (pairs: Array<[string, string]>) =>
        !transformed || pairs.some(([a, b]) => compare(initial, a, b) !== compare(final, a, b));

    const pairsOf = (texts: string[]) => texts
        .map(t => (t.match(/<span class="subject">(.*?)<\/span>/g) ?? [])
            .map(s => s.replace(/<[^>]+>/g, "")))
        .filter(p => p.length === 2) as Array<[string, string]>;

    /*
     * A checkpoint, and then the whole thing.
     *
     * The complaint this answers is that a wrong answer says only "you did not
     * get to the end". With the depth floor requiring the *whole* premise set,
     * that is all a single conclusion can say — so one claim is placed at the
     * halfway mark and one at the end, and the result screen reports them
     * separately.
     *
     * "Halfway" means halfway through the *reading*, not half the depth: the
     * first claim has to follow from the premises as displayed up to that
     * point, because a claim needing any half of them is not answerable
     * halfway down the page. `prefixLayout` is what that costs — the pair is
     * chosen inside what the first half determines, not inside the finished
     * arrangement.
     *
     * Only above four premises. Below that the midpoint is one or two premises
     * deep, which is the shallow conclusion the rest of this exists to prevent,
     * and serving one deliberately would teach the habit being removed.
     */
    if (feat.checkpoint && numOfPremises > 4) {
        const half = Math.floor(numOfPremises / 2);
        const early = prefixLayout(final, half);
        const earlyPair = pickDistantPair(early);
        const latePair = pickDistantPair(final);

        if (earlyPair && latePair && transformsBite([latePair])) {
            const first = buildConstructClaim(scale, early, earlyPair[0], earlyPair[1], false);
            const last = buildConstructClaim(scale, final, latePair[0], latePair[1], feat.constructDistance);
            if (first && last) {
                /*
                 * Labelled by where they are answerable from, not numbered.
                 * "Slot 1" says where it sits; "from the first half" says what
                 * to do with it, and the per-slot result screen then reports a
                 * reader who lost the thread late differently from one who
                 * never had it.
                 */
                first.slots[0] = { ...first.slots[0], label: `From the first ${half}` };
                last.slots[0] = { ...last.slots[0], label: "From all of them" };

                question.construct = [first, last];
                question.answerMode = "construct";
                question.isValid = true;
                question.conclusion = "";
                return true;
            }
        }
    }

    if (feat.constructConclusion) {
        const claims = buildConstructClaims(ctx, 
            slack => {
                const pair = pickDistantPair(final, slack);
                return pair && buildConstructClaim(scale, final, pair[0], pair[1], feat.constructDistance);
            },
            numOfPremises);
        if (!claims.length) return false;
        question.construct = claims;
        question.answerMode = "construct";
        question.isValid = true;
        question.conclusion = "";
        return true;
    }

    if (feat.chooseConclusion) {
        /*
         * Exactly one of four claims follows. The distractors are about
         * *other* pairs rather than other relations on the same pair —
         * otherwise three of the four options share two subjects and the
         * answer can be found by looking for the odd one out.
         */
        const set = buildConclusionSet(scale, final, 4, [true, false, false, false], options);
        if (set.length < 4) return false;
        // Only the true one has to move; the distractors are false either way.
        if (!transformsBite(pairsOf([set[0].text]))) return false;

        const order = shuffle(set.map((c, i) => i));
        question.choices = order.map(i => set[i].text);
        question.correctChoice = order.indexOf(0);
        question.answerMode = "choice";
        // Scored as "did they pick the right one", so the item itself is
        // always the valid side of the comparison in checkQuestion.
        question.isValid = true;
        question.conclusion = "";
        return true;
    }

    if (feat.multiConclusion) {
        // All must hold, so a false item needs exactly one false claim —
        // several would let it be spotted from any of them.
        const count = 2 + Math.floor(Math.random() * 2);
        const allTrue = coinFlip();
        const wants = Array(count).fill(true);
        if (!allTrue) wants[Math.floor(Math.random() * count)] = false;

        const set = buildConclusionSet(scale, final, count, wants, options);
        if (set.length < count) return false;
        if (!transformsBite(pairsOf(set.map(c => c.text)))) return false;

        question.conclusion = set.map(c => c.text);
        question.isValid = allTrue;
        return true;
    }

    const pair = pickDistantPair(final);
    if (!pair) return false;

    // A transformation list that does not change the answer is decoration:
    // the item would be solvable from the layout premises alone.
    if (transformed && compare(initial, pair[0], pair[1]) === compare(final, pair[0], pair[1])) {
        return false;
    }

    const conclusion = buildConclusion(scale, final, pair[0], pair[1], coinFlip(), options);
    question.conclusion = conclusion.text;
    question.isValid = conclusion.isValid;
    /*
     * Only when nothing moved. `final` is the post-transformation layout, so
     * its positions no longer decompose into the stated steps, and walking
     * the premises would produce a derivation that is confidently wrong.
     */
    if (!transformed) {
        question.explanation = explainLinear(scale, final, pair[0], pair[1]);
    }
    return true;
}

/**
 * The one thing about a scale item that the premises cannot convey.
 *
 * Only transformations qualify. That some premises rewrite the layout rather
 * than describe it is not visible from a premise read on its own, and
 * reading them all as descriptions gives a confidently wrong answer.
 *
 * Everything else that used to be here is carried by the conclusion labels
 * instead — "all must follow" for a conclusion set, "which of the statements
 * below follows?" for choice — so it sits next to what it qualifies rather
 * than as a preamble above the premises.
 */
export function linearSetup(ctx: GeneratorContext, transformCount: number, constructing: boolean): string[] {
    const lines: string[] = [];
    if (transformCount > 0) {
        lines.push("Later premises <b>change</b> the arrangement, in order.");
    }
    if (constructing) lines.push(ONE_STEP_NOTE);
    return lines;
}
