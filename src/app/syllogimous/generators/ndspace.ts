/**
 * Composed N-dimensional space: 3D, 4D, 5D and 6D from one code path.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { buildConstructClaims } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, shuffle } from "../utils/question.utils";
import { describeTransform } from "../utils/transformations.utils";
import { AxisSpec, NdLayout, applyNdEdits, applyNdTransforms, axesForDimensions, buildNdAnalogy, buildNdAnalogySet, buildNdConclusion, buildNdConclusionSet, buildNdConstructClaim, buildNdLayout, describeNdAxes, displacementOn, drawNdEdits, drawNdTransforms, explainNdAxis, isCircular, mod, ndTransformVocab, pickDistantPair as pickDistantPairNd, renderNdEdit, renderNdPremises } from "../utils/ndspace.utils";
import { scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { LinearFeatureFlags } from "../services/settings-override.service";
import { EnumQuestionType } from "../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { COMPACT_NOTE, EDIT_NOTE, ND_ANALOGY_NOTE, ND_TRANSFORM_NOTE, ONE_STEP_NOTE } from "./notes";

/** How many dimensions each composed-space mode asks for. */
export function dimensionsOf(ctx: GeneratorContext, type: EnumQuestionType): number {
    return {
        [EnumQuestionType.Space3D]: 3,
        [EnumQuestionType.Space4D]: 4,
        [EnumQuestionType.Space5D]: 5,
        [EnumQuestionType.Space6D]: 6,
    }[type as string] ?? 4;
}

/**
 * Composed N-dimensional space (engine in `utils/ndspace.utils.ts`).
 *
 * Serves 4D, 5D and 6D from one code path, because the only difference
 * between them is how many axes are on the list. Which axes, and whether any
 * of them wrap into a loop, comes from the progression ladder and Advanced
 * Options rather than from the mode.
 */
export function createNdSpace(ctx: GeneratorContext, numOfPremises: number, type: EnumQuestionType): Question {
    ctx.logger.info("createNdSpace:", type);

    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    /*
     * This generator enforces its own ceiling rather than trusting the
     * caller. `canGenerateQuestion` only checks the floor, and every real
     * call site happens to clamp first — but the cap here is a claim about
     * what is answerable at this width, not a preference, and a claim worth
     * making is worth not depending on three unrelated call sites to keep.
     */
    numOfPremises = Math.min(
        numOfPremises,
        QUESTION_TYPE_SETTING_PARAMS[type].maxNumOfPremises);

    const dims = dimensionsOf(ctx, type);
    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const feat = ndFeatures(ctx, type);

    /*
     * Loops are applied to the axes that have cyclic wording — a ring of
     * sizes or of quantities is not something anyone can reason about, so
     * those stay straight however many the rung has earned.
     */
    const circularCapable = scales
        .map((s, i) => (s.cyclic ? i : -1))
        .filter(i => i >= 0);
    const loops = new Set(circularCapable.slice(0, feat.circular));

    const axes: AxisSpec[] = scales.map((scale, i) => ({
        scale,
        // An odd modulus never lets a pair sit exactly opposite, an even one
        // does; alternating keeps both kinds of claim in circulation.
        modulus: loops.has(i) ? (coinFlip() ? 4 : 5) : undefined,
    }));

    /*
     * Edit and transformation premises come out of the object count rather
     * than being added on top, so claiming a rung never smuggles in a
     * premise increase. Two relations are needed before one can be swapped
     * with another.
     */
    const editCount = Math.min(feat.edits, Math.max(0, numOfPremises - 3));

    /*
     * Analogy needs objects, and operations eat them.
     *
     * An analogy claim is about two derived relations that happen to match,
     * so it can only be built if the layout has enough pairs to find a match
     * among. Six premises carrying two operations leaves five objects, which
     * is thin enough that a quarter of items could not be built at all — and
     * a generator that throws is not a graceful degradation, it stops the
     * session. Operations are what gives way, because they are the thing an
     * item can have fewer of and still be the item it was meant to be.
     */
    const objectFloor = feat.analogy ? 6 : 4;
    const transformCount = Math.min(
        feat.transforms,
        Math.max(0, numOfPremises - 3 - editCount),
        Math.max(0, numOfPremises + 1 - objectFloor - editCount));
    const objectCount = Math.max(4, numOfPremises + 1 - editCount - transformCount);
    const vocab = ndTransformVocab(axes);

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, objectCount);
        const layout = buildNdLayout(words, axes, { branching: feat.branching });

        /*
         * Edits rewrite the stated relations; transformations move objects
         * around the space those relations describe. So the edits land
         * first and the transformations act on what they produce — the
         * other order would have operations moving objects that a later
         * premise then relocates by rewriting how they were placed.
         */
        const edits = editCount ? drawNdEdits(layout, editCount) : [];
        if (edits.length < editCount) continue;
        const edited = edits.length ? applyNdEdits(layout, edits) : layout;

        const transforms = transformCount ? drawNdTransforms(edited, transformCount) : [];
        if (transforms.length < transformCount) continue;
        const final = transforms.length ? applyNdTransforms(edited, transforms) : edited;

        const question = new Question(type);
        if (!fillNdConclusion(ctx, question, layout, final, feat, numOfPremises, attempt >= 250)) continue;

        const stated = renderNdPremises(layout, { compact: feat.compact });
        const mutations = [
            ...edits.map(e => renderNdEdit(layout, e)),
            ...transforms.map(t => describeTransform(t, vocab)),
        ];
        question.premises = mutations.length
            // Mutations are applied in sequence, so their order is semantic
            // and must not be shuffled in among the relations they act on.
            ? scrambleLeading(
                [...stated, ...mutations],
                stated.length,
                ctx.settingsOverrideService.scramble)
            : scrambleByFactor(stated, ctx.settingsOverrideService.scramble);
        question.bucket = [...words];
        question.setup = [
            ...ndSetup(ctx, axes, feat, edits.length > 0, transforms.length > 0),
            ...question.setup,
        ];
        return question;
    }

    throw new Error("Cannot generate.");
}

/** Which structural modifiers are live for a composed space. */
export function ndFeatures(ctx: GeneratorContext, type: EnumQuestionType) {
    const ladder = (r: string) => ctx.progressionService.hasRung(type, r);
    const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
        ctx.settingsOverrideService.linearOverride(k);

    const pick = (key: "branching" | "multiConclusion" | "chooseConclusion" | "constructConclusion" | "constructDistance" | "analogy", rung: string) => {
        const f = forced(key);
        return f === null ? ladder(rung) : !!f;
    };

    const forcedLoops = ctx.settingsOverrideService.circularAxes();
    const circular = forcedLoops === null
        ? (ladder("circular") ? 1 : 0) + (ladder("circular-2") ? 1 : 0)
        : forcedLoops;

    const forcedEdits = ctx.settingsOverrideService.linearOverride("edits");
    const edits = forcedEdits === null
        ? (ladder("edit-1") ? 1 : 0) + (ladder("edit-2") ? 1 : 0)
        : Math.max(0, Math.min(4, forcedEdits));

    const forcedCompact = ctx.settingsOverrideService.linearOverride("compact");

    const forcedTransforms = forced("transforms");
    const transforms = forcedTransforms === null
        ? (ladder("transform-1") ? 1 : 0) + (ladder("transform-2") ? 1 : 0)
        : Math.max(0, Math.min(4, forcedTransforms));

    return {
        branching: pick("branching", "branching"),
        compact: forcedCompact === null ? ladder("compact") : !!forcedCompact,
        edits,
        transforms,
        circular,
        analogy: pick("analogy", "analogy"),
        multiConclusion: pick("multiConclusion", "multi-conclusion"),
        chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
        constructConclusion: ctx.forceConstruction !== "off" || pick("constructConclusion", "construct-conclusion"),
        constructDistance: ctx.forceConstruction !== "off"
            ? ctx.forceConstruction === "distance"
            : pick("constructDistance", "construct-distance"),
    };
}

export function fillNdConclusion(ctx: GeneratorContext, 
    question: Question,
    initial: NdLayout,
    layout: NdLayout,
    feat: ReturnType<typeof ndFeatures>,
    numOfPremises: number,
    /** Near the end of the attempt budget: take what can be built. */
    lastChance = false,
): boolean {
    /*
     * Mutations have to matter. A conclusion whose truth survives the edits
     * and transformations is answerable from the relations as first stated,
     * which turns those premises into reading practice.
     *
     * Compared as the answer would be *stated*, not as raw coordinates: an
     * ordering claim only notices the sign, a circular axis has no ordering
     * to notice, and a construction that asks distance notices the
     * magnitude too. Testing the coordinates directly would accept items
     * where something moved but nothing the player is asked about changed.
     */
    const mutated = initial !== layout;
    const axisAnswer = (l: NdLayout, a: string, b: string, i: number) => {
        if (isCircular(l.axes[i])) return displacementOn(l, i, a, b);
        const delta = l.coords[a][i] - l.coords[b][i];
        return feat.constructDistance ? delta : Math.sign(delta);
    };

    /*
     * Per axis, because a claim is about one axis and the pair moving is not
     * enough. A single-axis mirror changes one of six coordinates, so a pair
     * that "changed" is still five-sixths likely to be asked about an axis
     * the operations never touched — and that item is answerable by ignoring
     * them. Operations can also cancel on an axis, which the pair-level test
     * cannot see either.
     */
    const axisBites = (a: string, b: string, i: number) => !mutated
        || axisAnswer(initial, a, b, i) !== axisAnswer(layout, a, b, i);

    /** Construction states every axis at once, so the pair is the right unit. */
    const pairBites = (a: string, b: string) => !mutated
        || layout.axes.some((_, i) => axisBites(a, b, i));

    /*
     * An analogy is about two relations at once, so neither of the tests
     * above applies: the claim can survive both pairs moving, as long as
     * they moved the same way. The only honest question is whether the
     * claim's truth value is different before and after.
     */
    const analogyBites = (c: { pairs: [string, string, string, string]; claimSame: boolean }) => {
        if (!mutated) return true;
        const held = (l: NdLayout) => {
            const key = (x: string, y: string) => l.axes.map((axis, i) => isCircular(axis)
                ? displacementOn(l, i, y, x)
                : Math.sign(l.coords[y][i] - l.coords[x][i])).join(",");
            const [a, b, x, y] = c.pairs;
            const first = key(a, b);
            const second = key(x, y);
            const wanted = c.claimSame ? first : first.split(",").map((v, i) =>
                isCircular(l.axes[i]) ? mod(-Number(v), l.axes[i].modulus!) : -Number(v)).join(",");
            return second === wanted;
        };
        return held(initial) !== held(layout);
    };

    /*
     * Analogy stands in for the axis claim rather than replacing an answer
     * mode, so it composes with choice and multi. Construction is the one
     * it cannot share an item with — you cannot build a relation and judge
     * an identity between two of them in the same answer — so when both are
     * live they alternate instead of construction silently winning forever.
     */
    const useAnalogy = feat.analogy && (!feat.constructConclusion || coinFlip());

    /*
     * Returns false when this layout cannot carry an analogy, and the
     * ordinary axis claim is used instead.
     *
     * Falling through rather than failing the item: a layout with no
     * matching pair of relations is a fact about the layout, not an error,
     * and the alternative — throwing — ends the session, because
     * `getRandomQuestion` calls a generator once. An occasional plain item
     * at the analogy rung is a much smaller cost, and it leaves the analogy
     * items that *are* produced exactly as balanced as before.
     */
    const tryAnalogy = (): boolean => {
        // Which conclusion form an item ended up with is decided here, not
        // by the feature flags, so the note that explains it is added here
        // too; createNdSpace appends the mode-level lines in front.
        question.setup.push(ND_ANALOGY_NOTE);
        if (feat.chooseConclusion) {
            const set = buildNdAnalogySet(layout, [true, false, false, false], analogyBites);
            if (set.length < 4) return false;
            const order = shuffle(set.map((_, i) => i));
            question.choices = order.map(i => set[i].text);
            question.correctChoice = order.indexOf(0);
            question.answerMode = "choice";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        /*
         * Both answers must be constructible from this layout before either
         * is used, and the coin is tossed only afterwards.
         *
         * Not fussiness. A true analogy needs two disjoint pairs whose
         * relations actually match, and in six dimensions many layouts have
         * none; a false one is always available. Asking for a random
         * validity and discarding the failures therefore filters out true
         * claims specifically — measured at 40% true in 6D and 21% with two
         * loops, so answering "false" every time scored 79%. Deciding
         * whether the layout is usable *before* deciding the answer is what
         * removes the correlation. Which layouts get used is skewed by this,
         * which is harmless: knowing a match exists somewhere says nothing
         * about whether the claim on screen is the one.
         */
        if (feat.multiConclusion) {
            const count = 2 + Math.floor(Math.random() * 2);
            const buildSet = (allTrue: boolean) => {
                const wants = Array(count).fill(true);
                if (!allTrue) wants[Math.floor(Math.random() * count)] = false;
                const set = buildNdAnalogySet(layout, wants, analogyBites);
                return set.length === count ? set : null;
            };
            const yes = buildSet(true), no = buildSet(false);
            if (!yes || !no) return false;

            const allTrue = coinFlip();
            question.conclusion = (allTrue ? yes : no).map(c => c.text);
            question.isValid = allTrue;
            return true;
        }

        const options = [
            buildNdAnalogy(layout, true, undefined, analogyBites),
            buildNdAnalogy(layout, false, undefined, analogyBites),
        ];
        if (!options[0] || !options[1]) return false;
        const claim = options[coinFlip() ? 0 : 1]!;
        question.conclusion = claim.text;
        question.isValid = claim.isValid;
        return true;
    };

    if (useAnalogy && tryAnalogy()) return true;
    // The note belongs to the analogy form only; drop it if we fell through.
    question.setup = question.setup.filter(l => l !== ND_ANALOGY_NOTE);
    /*
     * Ask for a different layout rather than settling immediately. Roughly
     * half of six-dimensional layouts have no disjoint matching pair, so
     * giving up on the first one turns the analogy rung into an occasional
     * analogy; spending the attempt budget first turns it back into the
     * rung it is meant to be, and the fallback still catches the
     * configurations where no layout works at all.
     */
    if (useAnalogy && !lastChance) return false;

    if (feat.constructConclusion) {
        const claims = buildConstructClaims(ctx, () => {
            const pair = pickDistantPairNd(layout);
            if (!pair || !pairBites(pair[0], pair[1])) return null;
            return buildNdConstructClaim(layout, pair[0], pair[1], feat.constructDistance);
        }, numOfPremises);
        if (!claims.length) return false;
        question.construct = claims;
        question.answerMode = "construct";
        question.isValid = true;
        question.conclusion = "";
        return true;
    }

    if (feat.chooseConclusion) {
        const set = buildNdConclusionSet(layout, 4, [true, false, false, false]);
        if (set.length < 4) return false;
        // set[0] is the one that follows, so it is the one that has to need
        // the operations; the distractors are false either way.
        if (!axisBites(set[0].a, set[0].b, set[0].axis)) return false;
        const order = shuffle(set.map((_, i) => i));
        question.choices = order.map(i => set[i].text);
        question.correctChoice = order.indexOf(0);
        question.answerMode = "choice";
        question.isValid = true;
        question.conclusion = "";
        return true;
    }

    if (feat.multiConclusion) {
        const count = 2 + Math.floor(Math.random() * 2);
        const allTrue = coinFlip();
        const wants = Array(count).fill(true);
        if (!allTrue) wants[Math.floor(Math.random() * count)] = false;

        const set = buildNdConclusionSet(layout, count, wants);
        if (set.length < count) return false;
        if (!set.some(c => axisBites(c.a, c.b, c.axis))) return false;
        question.conclusion = set.map(c => c.text);
        question.isValid = allTrue;
        return true;
    }

    const pair = pickDistantPairNd(layout);
    if (!pair) return false;
    /*
     * Draw the axis from the ones the operations actually reached, rather
     * than drawing at random and hoping. With one axis touched out of six,
     * hoping is wrong five times in six.
     */
    const live = layout.axes.map((_, i) => i).filter(i => axisBites(pair[0], pair[1], i));
    if (!live.length) return false;
    const axisIndex = live[Math.floor(Math.random() * live.length)];
    const c = buildNdConclusion(layout, pair[0], pair[1], axisIndex, coinFlip());
    question.conclusion = c.text;
    question.isValid = c.isValid;
    /*
     * Only when nothing moved. A path through the premises accounts for a
     * position exactly while positions are the sum of the stated steps;
     * transformations set coordinates directly, so the same walk would
     * produce a confident and wrong derivation. Silence beats that.
     */
    if (!mutated) question.explanation = explainNdAxis(layout, c.b, c.a, axisIndex);
    return true;
}

/**
 * Naming the loops is not decoration.
 *
 * A circular axis is the one thing about the item the premises cannot
 * convey: the clauses read the same whether the axis wraps or not, and a
 * reader who assumes a straight line will derive a confidently wrong
 * position the moment the chain runs past the end.
 */
export function ndSetup(ctx: GeneratorContext, 
    axes: AxisSpec[],
    feat: ReturnType<typeof ndFeatures>,
    edited: boolean,
    transformed: boolean,
): string[] {
    const loops = axes.filter(a => isCircular(a));
    const lines: string[] = [];
    if (feat.constructDistance) lines.push(ONE_STEP_NOTE);
    /*
     * The compact convention has to be stated or the item is not derivable:
     * without it, an axis left out is indistinguishable from an axis with
     * no difference, and the conclusion may ask about exactly that axis.
     */
    if (feat.compact) lines.push(COMPACT_NOTE);
    if (edited) lines.push(EDIT_NOTE);
    /*
     * Same argument as the loop note below: the axis key is the one thing
     * an operation name depends on that the premises never state. "XT-
     * rotated" is guessable only if X and T have been identified.
     */
    if (transformed) {
        lines.push(ND_TRANSFORM_NOTE);
        lines.push(describeNdAxes(axes));
    }
    if (!loops.length) return lines;
    lines.push(loops.length === 1
        ? `The <b>${loops[0].scale.direction[0]}/${loops[0].scale.direction[1]}</b> axis is a loop of <b>${loops[0].modulus}</b>; it wraps around.`
        : `Two axes are loops that wrap around: `
          + loops.map(l => `<b>${l.scale.direction[0]}/${l.scale.direction[1]}</b> (${l.modulus})`).join(" and ") + ".");
    return lines;
}
