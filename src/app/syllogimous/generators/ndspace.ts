/**
 * Composed N-dimensional space: 3D, 4D, 5D and 6D from one code path.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext, deepConclusions } from "./context";
import { buildConstructClaims } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { describeTransform } from "../utils/transformations.utils";
import { AxisSpec, NdLayout, applyNdEdits, applyNdTransforms, axesForDimensions, buildNdAnalogy, buildNdAnalogySet, buildNdConclusion, buildNdConclusionSet, buildNdWideConclusion, buildNdConstructClaim, NdEdge, buildNdLayout, describeNdAxes, determinedOn, graphDistance, ndPrefixLayout, ndWidth, pickByWidth, displacementOn, drawNdEdits, drawNdTransforms, explainNdAxis, indeterminatePairs, isCircular, mod, ndTransformVocab, pickDistantPair as pickDistantPairNd, renderNdEdit, renderNdPremise, renderNdPremises, withholdClauses } from "../utils/ndspace.utils";
import { scrambleBlocks, scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { LinearFeatureFlags } from "../services/settings-override.service";
import { EnumQuestionType } from "../constants/question.constants";
import { hi, subj } from "../utils/phrasing";
import { SPEAKERS_NOTE, TESTIMONY_NOTE, describeStatement, drawClaims, solve } from "../utils/knaves.utils";
import {
    Egocentric, FACING_NOTE, OPPOSITE, bearingPlane, describeBearing, describeEgocentric,
    describeFacing, egocentric,
} from "../utils/facing.utils";
import { QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { COMPACT_NOTE, EDIT_NOTE, INDETERMINATE_NOTE, ND_ANALOGY_NOTE, ND_TRANSFORM_NOTE, ONE_STEP_NOTE } from "./notes";

/** How many dimensions each composed-space mode asks for. */
export function dimensionsOf(ctx: GeneratorContext, type: EnumQuestionType): number {
    return {
        [EnumQuestionType.Space3D]: 3,
        [EnumQuestionType.Space4D]: 4,
        [EnumQuestionType.Space5D]: 5,
        [EnumQuestionType.Space6D]: 6,
        [EnumQuestionType.Space7D]: 7,
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

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

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

        /*
         * Nine draws, and keep one by width.
         *
         * Width — the bits needed to locate an object, summed over axes — varies
         * about twofold between items the difficulty model scores identically,
         * which is roughly a level of noise in the posterior. Keeping the middle
         * of a batch removes the tails without moving the centre, and nine is
         * enough for the median to sit reliably in the body of the distribution
         * while costing nothing anyone would notice.
         *
         * A requested percentile moves that choice deliberately. Scoped to one
         * axis when asked, because spread is not really one quantity: a wide
         * time axis is a different demand from a tall vertical one, and pooling
         * them lets a narrow axis be paid for by a wide one.
         */
        const spread = ctx.settingsOverrideService.spread();
        const scoped = spread?.axis
            ? axes.map((a, i) => (a.scale.id === spread.axis ? i : -1)).filter(i => i >= 0)
            : undefined;

        const batch = Array.from({ length: 9 }, () =>
            buildNdLayout(words, axes, { branching: feat.branching }));
        const scope = scoped?.length ? scoped : undefined;

        /*
         * Jittered around the middle when nobody has asked for anything else.
         *
         * Always taking the median is the tightest possible item stream and
         * also an unfittable one: with every draw at the same percentile the
         * width of an item never varies, so no amount of play can say what
         * width is worth and the difficulty model is stuck with a blank where
         * that term should be.
         *
         * A twenty-to-eighty band is the trade. Measured at 4D with six
         * objects, width sd goes 0.34 → 0.48 against 0.80 for the unmanaged
         * draw this replaced, and the departure from the median — the quantity
         * a fit actually sees — lands at 0.28–0.49 across dimensions, which is
         * enough to fit against.
         *
         * And the trade reverses once it pays off: variation the model can
         * account for is information, where variation it cannot is noise. The
         * moment `widthPerBit` is fitted, this band stops costing anything and
         * starts being read.
         */
        const percentile = spread?.percentile ?? 20 + Math.random() * 60;
        const drawn = pickByWidth(batch, percentile, scope);
        // Against the batch's own middle, so it says "wider than this
        // configuration usually is" rather than an absolute figure.
        const widthDelta = ndWidth(drawn, scope) - ndWidth(pickByWidth(batch, 50, scope), scope);

        const layout = feat.indeterminate
            ? withholdClauses(drawn, 1 + Math.floor(Math.random() * 2))
            : drawn;

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

        /*
         * Who reports what, decided before the conclusion is.
         *
         * A knave's report is false, so it tells the reader nothing — which
         * means the queried pair has to be pinned down by the honest reports
         * alone. Marking the lied-about edges as unstated is exactly the
         * machinery under-specification already uses, so the conclusion picker
         * refuses anything the truthful premises leave open without needing to
         * know that liars are the reason.
         */
        const reported = feat.speakers ? assignSpeakers(ctx, layout) : null;
        if (feat.speakers && !reported) continue;

        const told = feat.testimony ? assignTestimony(ctx, layout) : null;
        if (feat.testimony && !told) continue;

        const question = new Question(type);
        const extraPremises: string[] = [];
        const asked: { a?: string; b?: string; axis?: number } = {};
        /*
         * A checkpoint needs the displayed premises to have a prefix that
         * determines what it asks, and four things break that.
         *
         * Edits and transformations *rewrite* the arrangement, so a relation
         * stated before one of them may not hold after it — the prefix
         * describes a state the reader is later told to abandon. Reports and
         * testimony *replace* the premises with claims that may be false, so
         * there is no prefix that determines anything until the liars have been
         * found, which is the whole of the item rather than half of it.
         *
         * Skipped rather than worked around, as the scale family skips it
         * alongside meta: a checkpoint the reader cannot answer at the
         * checkpoint is not one.
         */
        const canCheckpoint = !editCount && !transformCount && !reported && !told;
        if (!fillNdConclusion(
            ctx, question, layout, final, feat, numOfPremises, attempt >= 250,
            extraPremises, asked, canCheckpoint)) continue;

        /*
         * The testimony has to be load-bearing.
         *
         * Nothing stops the conclusion picker choosing a pair the plain facts
         * already settle, and such an item is answerable without working out
         * who lied — the reports become decoration and the mode collapses into
         * the base one with extra reading.
         */
        if (told && asked.a && asked.b && asked.axis != null
            && determinedOn(told.plainOnly, asked.axis, asked.a, asked.b)) continue;

        // Order-independent like the relations themselves, so scrambled in with
        // them rather than pinned to the end where it would stand out.
        const stated = told
            ? [...told.premises, ...extraPremises]
            : reported
            ? [...reported.premises, ...extraPremises]
            : [
                ...renderNdPremises(layout, { compact: feat.compact }),
                ...extraPremises,
            ];
        const mutations = [
            ...edits.map(e => renderNdEdit(layout, e)),
            ...transforms.map(t => describeTransform(t, vocab)),
        ];
        /*
         * Where the first half stops, when there is a checkpoint.
         *
         * `stated` is `layout.edges` rendered in order, so its first `half`
         * entries are exactly the edges the checkpoint claim was built from.
         * That correspondence is the whole mechanism and it is fragile — which
         * is why `canCheckpoint` above rules out everything that reorders or
         * replaces premises rather than trying to track them through it.
         */
        const boundary = question.construct.length === 2 && canCheckpoint
            ? Math.floor(numOfPremises / 2)
            : 0;

        question.premises = boundary
            // Shuffled within each half and never across. Both halves may be
            // reordered — the claim follows from the *set* before the boundary,
            // not from an order within it — but a premise that crossed the line
            // would be one the reader did not have when the claim became
            // answerable.
            ? scrambleBlocks(stated, boundary, ctx.settingsOverrideService.scramble)
            : mutations.length
            // Mutations are applied in sequence, so their order is semantic
            // and must not be shuffled in among the relations they act on.
            ? scrambleLeading(
                [...stated, ...mutations],
                stated.length,
                ctx.settingsOverrideService.scramble)
            : scrambleByFactor(stated, ctx.settingsOverrideService.scramble);
        /*
         * Who was lying comes first in the derivation, because it comes first
         * in the work: the arrangement cannot be read at all until the false
         * reports are set aside. Without these lines the explanation would show
         * a tidy walk through premises and never say why the other ones were
         * ignored.
         */
        if (reported) {
            const kind = (i: number) => reported.world[i] ? "knight" : "knave";
            question.explanation = [
                `Only one reading fits what they say about each other: `
                + reported.names.map((n, i) => `${subj(n)} a ${hi(kind(i))}`).join(", ") + ".",
                `So the reports from `
                + reported.names.filter((_, i) => !reported.world[i]).map(n => subj(n)).join(" and ")
                + ` are false and say nothing about where anything is.`,
                ...question.explanation,
            ];
        }

        /*
         * Two conclusions, because the item has two answers.
         *
         * Who is lying is not scaffolding for the relational question, it is
         * half of what was worked out — and stating only the relation would let
         * a reader who guessed the types right for the wrong reason look
         * indistinguishable from one who did it properly. Both are claimed, and
         * the item is true only if both hold, which is the existing
         * multi-conclusion idiom.
         */
        if (told) {
            /*
             * Two conclusions, because the item has two answers.
             *
             * Who is lying is not scaffolding for the relational question, it
             * is half of what was worked out. Stating only the relation would
             * let a reader who happened to guess the types right look
             * indistinguishable from one who established them.
             *
             * Built the way the multi-conclusion idiom builds elsewhere: decide
             * whether the set is all true, and if not, make exactly *one* of
             * them false. Either half can be the culprit, so neither can be
             * skipped — and the attempt is discarded when the relational claim
             * came out the wrong way round, rather than papered over by letting
             * both halves fail at once.
             */
            const relationHolds = question.isValid;
            const wantAllTrue = coinFlip();
            const blameTypes = coinFlip();

            if (wantAllTrue && !relationHolds) continue;
            if (!wantAllTrue && blameTypes && !relationHolds) continue;
            if (!wantAllTrue && !blameTypes && relationHolds) continue;

            const typesHold = wantAllTrue || !blameTypes;
            question.conclusion = [
                typesHold ? told.typeClaim : told.wrongTypeClaim,
                String(question.conclusion),
            ];
            question.isValid = wantAllTrue;
            question.explanation = [...told.explanation, ...question.explanation];
        }

        question.bucket = [...words];
        question.widthDelta = widthDelta;
        // Post-operation, so the picture matches the question asked.
        question.wordCoordMap = { ...final.coords };
        question.axisNames = axes.map(a => a.scale.name);
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
    const ladder = (r: string) => ctx.hasRung(type, r);
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

    const forcedOpen = ctx.settingsOverrideService.linearOverride("indeterminate");
    /*
     * Under-specification does not mix with premises that rewrite or move
     * things. Both are answered by replaying what the premises did, and
     * "the premises never said" is a claim about the premise set as stated —
     * put together, an item would be asking whether something is pinned down
     * while also moving it, and neither reading is the one being tested.
     */
    const compact = forcedCompact === null ? ladder("compact") : !!forcedCompact;

    /*
     * Facing is fixed at statement, so a later transform moving the faced
     * object is *meant* to leave the bearing alone. Excluded anyway for now:
     * the item would then turn on a rule stated in one line of the setup, and
     * getting that rule wrong looks identical to getting the geometry wrong.
     */
    const forcedFacing = ctx.settingsOverrideService.linearOverride("facing");
    const facing = (forcedFacing === null ? ladder("facing") : !!forcedFacing)
        && edits === 0 && transforms === 0;

    /*
     * Reported relations, some of them by liars. Same exclusions as
     * under-specification and for the same reason: it is a claim about the
     * premise set as stated, and operations that rewrite or move things make
     * "as stated" a moving target.
     */
    const speakers = ladder("speakers") && edits === 0 && transforms === 0;

    /*
     * The richer form: some reports can be *checked* against facts the item
     * states outright, so who is lying is worked out from the arrangement
     * rather than only from what the speakers say about each other — and the
     * item then asks for both answers.
     *
     * Outranks `speakers` when both are live; it is the same idea with more in
     * it, and running both would just be the weaker one half the time.
     */
    const testimony = ladder("testimony") && edits === 0 && transforms === 0;

    const indeterminate = (forcedOpen === null ? ladder("indeterminate") : !!forcedOpen)
        && edits === 0 && transforms === 0
        /*
         * And never alongside `compact`, which is the sharper of the two
         * conflicts. Compact omits a clause to *say* the pair is level, so with
         * both live an omission would carry two incompatible meanings in the
         * same sentence and the reader could not tell which was meant. That is
         * not a harder item, it is an unfair one.
         */
        && !compact;

    return {
        testimony,
        speakers: speakers && !testimony,
        facing,
        indeterminate,
        branching: pick("branching", "branching"),
        compact,
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
        // Straight off the ladder, with no Customise override, exactly as the
        // scale family reads it: there is no `checkpoint` among the linear
        // feature flags to force, and inventing one here would make the same
        // rung forceable in one family and not the other.
        checkpoint: ladder("checkpoint"),
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
    /**
     * Premises the conclusion needs that the layout does not state.
     *
     * Only facings so far. `question.premises` is written by the caller *after*
     * this runs, from the rendered layout, so anything added to it here is
     * simply overwritten — which is exactly what happened, leaving items whose
     * derivation reasoned from a facing the player was never told.
     */
    extraPremises: string[] = [],
    /** The pair and axis the boolean form settled on, for callers that care. */
    asked: { a?: string; b?: string; axis?: number } = {},
    /**
     * Whether a checkpoint is structurally possible for this item.
     *
     * Decided by the caller, because the things that rule it out — mutations,
     * reports, testimony — are premises the caller assembles and this function
     * never sees. Each of them breaks the same property: a checkpoint needs the
     * premises as displayed to have a prefix that determines what it asks, and
     * a premise that rewrites, replaces or may be lying is not part of any such
     * prefix.
     */
    canCheckpoint = false,
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

    /*
     * Which conclusion model this item is built under. Read once, so the pair's
     * distance and the claim's width cannot disagree — a wide claim about an
     * adjacent pair is neither model.
     */
    const legacy = !deepConclusions(ctx);

    /*
     * A checkpoint, then the whole thing — the composed-space twin of the one
     * the scale family already has, and it answers the same complaint. With the
     * depth floor requiring the whole premise set, a single conclusion can only
     * ever report "you did not get to the end"; a claim placed at the halfway
     * mark says *where* the thread was lost, and the per-slot result screen
     * reports the two separately.
     *
     * "Halfway" is halfway through the *reading*, not half the depth. The
     * premises are rendered from `layout.edges` in order, so the first `half`
     * of them are exactly the edges `ndPrefixLayout` is given — the claim then
     * follows from what a reader has actually got at that point. Choosing the
     * final claim first and hoping some prefix entails something is the same
     * "pick and hope" the floor exists to remove.
     *
     * Only above four premises. Below that the midpoint is one or two premises
     * deep, which is the shallow conclusion the rest of this exists to prevent.
     *
     * A composed space asks for both claims across every axis, which is where
     * this differs from the scale family's version in effect if not in shape:
     * the halfway claim is already an N-slot construction, so losing the thread
     * on one axis and losing it altogether are told apart without the second
     * claim being reached.
     */
    if (feat.checkpoint && canCheckpoint && numOfPremises > 4) {
        const half = Math.floor(numOfPremises / 2);
        const early = ndPrefixLayout(layout, half);
        const earlyPair = pickDistantPairNd(early, 2, 0, legacy);
        const latePair = pickDistantPairNd(layout, 2, 0, legacy);

        if (earlyPair && latePair && pairBites(latePair[0], latePair[1])) {
            const first = buildNdConstructClaim(early, earlyPair[0], earlyPair[1], false);
            const last = buildNdConstructClaim(
                layout, latePair[0], latePair[1], feat.constructDistance);

            // Labelled by where they are answerable from rather than numbered:
            // "slot 1" says where it sits, "from the first four" says what to
            // do with it.
            first.slots[0] = { ...first.slots[0], label: `From the first ${half}` };
            last.slots[0] = { ...last.slots[0], label: "From all of them" };

            question.depth = graphDistance(latePair[0], latePair[1], layout.neighbors);
            question.construct = [first, last];
            question.answerMode = "construct";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }
    }

    if (feat.constructConclusion) {
        // The claim that needed least of the item; see the linear generator for
        // why the minimum rather than the maximum.
        let shallowest = Infinity;
        const claims = buildConstructClaims(ctx, slack => {
            const pair = pickDistantPairNd(layout, 2, slack, legacy);
            if (!pair || !pairBites(pair[0], pair[1])) return null;
            shallowest = Math.min(
                shallowest, graphDistance(pair[0], pair[1], layout.neighbors));
            return buildNdConstructClaim(layout, pair[0], pair[1], feat.constructDistance);
        }, numOfPremises);
        if (!claims.length) return false;
        question.depth = Number.isFinite(shallowest) ? shallowest : 0;
        question.construct = claims;
        question.answerMode = "construct";
        question.isValid = true;
        question.conclusion = "";
        return true;
    }

    if (feat.chooseConclusion) {
        const set = buildNdConclusionSet(layout, 4, [true, false, false, false], legacy);
        if (set.length < 4) return false;
        question.depth = graphDistance(set[0].a, set[0].b, layout.neighbors);
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

        const set = buildNdConclusionSet(layout, count, wants, legacy);
        if (set.length < count) return false;
        question.depth = Math.min(
            ...set.map(c => graphDistance(c.a, c.b, layout.neighbors)));
        if (!set.some(c => axisBites(c.a, c.b, c.axis))) return false;
        question.conclusion = set.map(c => c.text);
        question.isValid = allTrue;
        return true;
    }

    /*
     * Egocentric items re-express the layout from inside it, so they are their
     * own branch: the claim is not about an axis at all.
     */
    if (feat.facing) {
        const built = fillFacingConclusion(question, layout, extraPremises);
        if (built) return true;
        // Falling through rather than failing: a layout can simply have no
        // pair the bearing plane separates, and that is not an error.
    }

    /*
     * Under-specified items ask a different question, so they are built first.
     *
     * Every composed-space item until now was fully determined by
     * construction, which means it can be solved by propagation — scan,
     * intersect, repeat — and that closes. Withholding a clause leaves several
     * arrangements satisfying the premises, and the claim becomes one of
     * necessity: true only if it holds in all of them. Propagation no longer
     * finishes the job, because the thing to notice is that it *cannot*.
     *
     * Roughly half of these items are asked about a pair the premises do pin
     * down, so the wording alone gives nothing away — "not stated" has to be
     * established rather than guessed from the fact that the mode is on.
     */
    if (feat.indeterminate) {
        const open = indeterminatePairs(layout);
        if (open.length && coinFlip()) {
            const o = open[Math.floor(Math.random() * open.length)];
            const c = buildNdConclusion(layout, o.a, o.b, o.axis, coinFlip());
            question.conclusion = mustBe(c.text);
            // A necessity claim over an undetermined pair is false whichever
            // direction it names, which is the whole point of the item.
            question.isValid = false;
            question.explanation = explainIndeterminate(layout, o.a, o.b, o.axis);
            return true;
        }
    }

    /*
     * The furthest pair that can actually carry a question, widening only if
     * the furthest cannot.
     *
     * Two conditions have to hold at once and they are not independent: the
     * pair must be far enough that answering composes the whole premise set,
     * *and* it must have an axis the operations reached and the premises
     * settle. Asking for the diameter and giving up when that one pair has no
     * usable axis threw away perfectly good items — and asking for any pair at
     * all, which is what a flat 30% wide draw amounted to, throws away the
     * depth. So: try the diameter, then one band in, then two, and stop at the
     * first that works.
     */
    let pair: [string, string] | null = null;
    let axisIndex = -1;
    for (let slack = 0; slack <= 2 && axisIndex < 0; slack++) {
        for (let attempt = 0; attempt < 8 && axisIndex < 0; attempt++) {
            const candidate = pickDistantPairNd(layout, 2, slack, legacy);
            if (!candidate) break;
            /*
             * Draw the axis from the ones the operations actually reached,
             * rather than drawing at random and hoping. With one axis touched
             * out of six, hoping is wrong five times in six.
             */
            const live = layout.axes.map((_, i) => i).filter(i => axisBites(candidate[0], candidate[1], i));
            if (!live.length) continue;
            const settled = feat.indeterminate || feat.speakers || feat.testimony
                ? live.filter(i => determinedOn(layout, i, candidate[0], candidate[1]))
                : live;
            if (!settled.length) continue;
            pair = candidate;
            axisIndex = settled[Math.floor(Math.random() * settled.length)];
        }
    }
    if (!pair || axisIndex < 0) return false;

    /*
     * The whole relation where the item can carry one.
     *
     * A conclusion naming a single axis of a seven-axis item asks about
     * one-seventh of what the premises stated, and which seventh was arbitrary.
     * The wide claim names every axis, so the answer needs all of them.
     *
     * It declines on a circular axis, whose relation is a displacement in steps
     * rather than a direction word, and on a pair the premises leave unsettled
     * anywhere — under-specification makes those on purpose, and a claim about
     * an axis nobody stated is unanswerable rather than hard. Both fall back to
     * the single-axis claim, which is what those items were already getting.
     */
    const strict = feat.indeterminate || feat.speakers || feat.testimony;
    // Off, the claim names one axis of however many — which is the other half
    // of what the switch turns off, and the half a player would notice first.
    const c = (legacy ? null : buildNdWideConclusion(layout, pair[0], pair[1], coinFlip(), strict))
        ?? buildNdConclusion(layout, pair[0], pair[1], axisIndex, coinFlip());
    question.depth = graphDistance(pair[0], pair[1], layout.neighbors);
    asked.a = c.a;
    asked.b = c.b;
    // A wide claim turns on the axis it lies about; a true one turns on all of
    // them, and reports the axis the pair was chosen for.
    if (c.axis >= 0) axisIndex = c.axis;
    asked.axis = axisIndex;
    question.conclusion = feat.indeterminate ? mustBe(c.text) : c.text;
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
    if (feat.indeterminate) lines.push(INDETERMINATE_NOTE);
    if (feat.facing) lines.push(FACING_NOTE);
    if (feat.speakers) lines.push(SPEAKERS_NOTE);
    if (feat.testimony) lines.push(TESTIMONY_NOTE);
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


/** A claim of necessity rather than of fact. */
function mustBe(text: string): string {
    return `It must be true that ${text}`;
}

/**
 * Why an under-specified claim fails: the premises never join the two up.
 *
 * Stated as the break in the chain rather than as "several arrangements are
 * possible", because the break is what a reader can check. On this axis the
 * premises that mention it form separate groups, and nothing relates one group
 * to another — so the two can sit either way round, and a claim that one *must*
 * be on a particular side of the other cannot hold.
 */
function explainIndeterminate(layout: NdLayout, a: string, b: string, axis: number): string[] {
    const name = layout.axes[axis].scale.name;
    const mentions = layout.edges.filter(e => !e.stated || e.stated[axis]).length;

    return [
        `Only ${mentions} of the ${layout.edges.length} premises say anything about ${hi(name)}.`,
        `Following just those, there is no route from ${subj(a)} to ${subj(b)}`
        + ` \u2014 they fall in groups nothing ties together on this axis.`,
        isCircular(layout.axes[axis])
            // A ring has no sides to be on; what is open there is the offset.
            ? `so ${subj(a)} could sit anywhere on this loop relative to ${subj(b)},`
              + ` and the claim does not have to hold`
            : `so ${subj(a)} could sit either side of ${subj(b)}, and the claim does not have to hold`,
    ];
}

/**
 * "B is on A's left", with the facing that licenses it stated as a premise.
 *
 * Every part is drawn from the layout the item already built: the facing is the
 * bearing from the viewer to some third object, and the claim is where a fourth
 * falls relative to that. So nothing here can disagree with the premises — the
 * only new information is which way someone is turned, and that is stated.
 */
function fillFacingConclusion(
    question: Question,
    layout: NdLayout,
    extraPremises: string[],
): boolean {
    const plane = bearingPlane(layout.axes);
    if (!plane || layout.words.length < 3) return false;

    const at = (w: string): [number, number] =>
        [layout.coords[w][plane[0]], layout.coords[w][plane[1]]];

    // Every viewer/faced/target triple the plane actually separates, then one
    // at random — drawing first and rejecting would fail most of the time on a
    // space where the plane is nearly flat.
    const options: Array<{ viewer: string; faced: string; target: string; rel: Egocentric }> = [];
    for (const viewer of layout.words) {
        for (const faced of layout.words) {
            if (faced === viewer) continue;
            const f = sub(at(faced), at(viewer));
            if (!f[0] && !f[1]) continue;
            for (const target of layout.words) {
                if (target === viewer || target === faced) continue;
                const rel = egocentric(f, sub(at(target), at(viewer)));
                if (rel) options.push({ viewer, faced, target, rel });
            }
        }
    }
    if (!options.length) return false;

    const chosen = options[Math.floor(Math.random() * options.length)];
    const claimTrue = coinFlip();
    const claimed = claimTrue ? chosen.rel : OPPOSITE[chosen.rel];

    const f = sub(at(chosen.faced), at(chosen.viewer));
    const v = sub(at(chosen.target), at(chosen.viewer));

    extraPremises.push(describeFacing(chosen.viewer, chosen.faced));
    question.conclusion = describeEgocentric(chosen.target, chosen.viewer, claimed);
    question.isValid = claimTrue;
    question.explanation = [
        `From ${subj(chosen.viewer)}, ${subj(chosen.faced)} lies`
        + ` ${hi(describeBearing(f, layout.axes, plane))} \u2014 that is the way`
        + ` ${subj(chosen.viewer)} is turned.`,
        `From ${subj(chosen.viewer)}, ${subj(chosen.target)} lies`
        + ` ${hi(describeBearing(v, layout.axes, plane))}.`,
        `so ${describeEgocentric(chosen.target, chosen.viewer, chosen.rel)}`,
    ];
    return true;
}

const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];

/**
 * Attribute the relations to speakers, some of whom lie.
 *
 * This is the modifier half of Knights and Knaves, and it generalises the
 * negation modifier exactly as intended: negation marks a premise inverted and
 * tells you which, while a knave makes inversion a hidden property of a person
 * that must be deduced first and then applied to everything they said.
 *
 * A knave's report is falsified by flipping a *subset* of its axes rather than
 * all of them. Flipping all of them would make it recoverable — reverse it and
 * read on — and "says false things" does not mean "says the exact opposite".
 * So a lie carries no information, which is why the edges it covers are marked
 * unstated and the conclusion picker then refuses any pair they were holding
 * together.
 *
 * Mutates `layout.edges` to record that, which is deliberate: the conclusion is
 * chosen afterwards and has to see the same premise set the reader will.
 */
function assignSpeakers(ctx: GeneratorContext, layout: NdLayout) {
    const settings = ctx.settings;
    const count = Math.max(2, Math.min(3, layout.edges.length - 1));
    if (count < 2) return null;

    for (let attempt = 0; attempt < 60; attempt++) {
        const world = Array.from({ length: count }, () => coinFlip());
        // Both kinds must appear, or the puzzle half of the item is inert.
        if (world.every(w => w) || world.every(w => !w)) continue;

        const claims = drawClaims(world, false);
        if (!claims) continue;
        if (solve(claims).length !== 1) continue;

        // Speaker names must not be objects in the arrangement, or "Ash says
        // Ash is north of Bee" reads as a claim about the speaker's position.
        const names = getRandomSymbols(settings, count + layout.words.length)
            .filter(n => !layout.words.includes(n))
            .slice(0, count);
        if (names.length < count) continue;

        const order = layout.edges.map((_, i) => i);
        shuffle(order);
        const who = new Map<number, number>();
        order.forEach((edge, i) => who.set(edge, i % count));

        // Every speaker has to say something about the arrangement, or their
        // type is deducible and useless.
        if (new Set(who.values()).size < count) continue;

        const premises: string[] = claims.map((c, i) => describeStatement(i, c, names));

        layout.edges.forEach((edge, i) => {
            const speaker = who.get(i)!;
            const honest = world[speaker];

            if (honest) {
                premises.push(`${subj(names[speaker])} says: ${renderNdPremise(layout, edge, false)}`);
                return;
            }

            // A non-empty proper subset, so the report is wrong but not simply
            // reversed. `stated` records that it is unusable either way.
            const flip = layout.axes.map(() => coinFlip());
            if (flip.every(f => !f)) flip[Math.floor(Math.random() * flip.length)] = true;

            const lie: NdEdge = {
                ...edge,
                deltas: edge.deltas.map((d, ax) => (flip[ax] ? -d : d)),
            };
            premises.push(`${subj(names[speaker])} says: ${renderNdPremise(layout, lie, false)}`);
            edge.stated = layout.axes.map(() => false);
        });

        shuffle(premises);
        return { premises, world, names };
    }

    return null;
}

/**
 * Testimony that can be checked against facts the item states outright.
 *
 * The `speakers` rung leaves a knave's report worthless *and* unidentifiable
 * from the arrangement: who lied is settled purely by what the speakers say
 * about each other. This is the richer form. A few relations are stated plainly
 * and are simply true; the speakers then report more, and some of those reports
 * are about pairs the plain facts already determine. Those can be checked, and
 * a contradiction names a knave directly.
 *
 * That gives the item its shape: a **checkable report pins one speaker**, their
 * claims about the others pin the rest, and only then can the *extending*
 * reports — about objects the plain facts never reached — be sorted into
 * usable and worthless. The relational answer lives out there, so it cannot be
 * reached until the liars are known.
 *
 * Everything is verified rather than assumed. The type assignment is required
 * to be the only one consistent with both the inter-speaker claims and the
 * checkable reports; the relational conclusion is required to be settled by the
 * plain facts plus the honest extensions, and *not* by the plain facts alone —
 * otherwise the testimony is decoration.
 */
function assignTestimony(ctx: GeneratorContext, layout: NdLayout) {
    const settings = ctx.settings;
    const words = layout.words;
    if (words.length < 5) return null;

    /*
     * The core is the part the plain facts pin down. Everything outside it is
     * reachable only through a report, which is what gives an extending report
     * something to be worth.
     */
    /*
     * Sized from the far end: one to three objects sit outside the core, so
     * there are one to three extending reports and one speaker each. Sizing it
     * from the near end instead left five extensions on an eight-object item
     * and nothing ever generated.
     */
    const outside = 1 + Math.floor(Math.random() * Math.min(3, words.length - 4));
    const core = new Set(words.slice(0, words.length - outside));

    const plain: number[] = [];
    const extending: number[] = [];
    layout.edges.forEach((e, i) => {
        (core.has(e.from) && core.has(e.to) ? plain : extending).push(i);
    });
    if (plain.length < 2 || extending.length < 1 || extending.length > 3) return null;

    /*
     * Determined by the plain facts, checked rather than assumed.
     *
     * "Both ends are in the core" is not the same as "the plain facts settle
     * it" — with branching premises the core need not be connected by the edges
     * that stayed plain. A pair that is not actually determined would be a
     * report the reader cannot check, which is the one thing this form needs.
     */
    const plainOnly: NdLayout = {
        ...layout,
        edges: layout.edges.map((e, i) => ({
            ...e,
            stated: plain.includes(i) ? undefined : layout.axes.map(() => false),
        })),
    };

    const checkablePairs: Array<[string, string]> = [];
    const inCore = [...core];
    for (let i = 0; i < inCore.length; i++) {
        for (let j = i + 1; j < inCore.length; j++) {
            const [a, b] = [inCore[i], inCore[j]];
            // Not a stated pair: repeating a premise is checkable but trivial.
            if (layout.edges.some(e => (e.from === a && e.to === b) || (e.from === b && e.to === a))) continue;
            if (!layout.axes.every((_, ax) => determinedOn(plainOnly, ax, a, b))) continue;
            checkablePairs.push([a, b]);
        }
    }
    if (!checkablePairs.length) return null;

    for (let attempt = 0; attempt < 80; attempt++) {
        const checkableCount = 1 + Math.floor(Math.random() * Math.min(2, checkablePairs.length));
        const speakerCount = extending.length + checkableCount;
        if (speakerCount < 2 || speakerCount > 4) continue;

        const world = Array.from({ length: speakerCount }, () => coinFlip());
        if (world.every(w => w) || world.every(w => !w)) continue;

        const claims = drawClaims(world, false);
        if (!claims) continue;

        // Assignments the *reader* could reach: consistent with what the
        // speakers say about each other, and with the reports they can check.
        const checkers = [...Array(checkableCount).keys()];
        const consistent = solve(claims).filter(w => checkers.every(i => w[i] === world[i]));
        if (consistent.length !== 1) continue;

        const names = getRandomSymbols(settings, speakerCount + words.length)
            .filter(n => !words.includes(n))
            .slice(0, speakerCount);
        if (names.length < speakerCount) continue;

        /** A relation, falsified so that at least one clause actually changes. */
        const lieAbout = (deltas: number[]): number[] | null => {
            const movable = deltas.map((d, i) => (d === 0 ? -1 : i)).filter(i => i >= 0);
            if (!movable.length) return null;
            const flip = new Set<number>([movable[Math.floor(Math.random() * movable.length)]]);
            for (const i of movable) if (coinFlip()) flip.add(i);
            return deltas.map((d, i) => (flip.has(i) ? -d : d));
        };

        const premises: string[] = plain.map(i => renderNdPremise(layout, layout.edges[i], false));
        const checkedPairs = pickUniqueItems(checkablePairs, checkableCount).picked;
        let malformed = false;

        checkedPairs.forEach(([a, b], i) => {
            const truth = layout.axes.map((_, ax) => layout.coords[a][ax] - layout.coords[b][ax]);
            const deltas = world[i] ? truth : lieAbout(truth);
            if (!deltas) { malformed = true; return; }
            const edge: NdEdge = { from: b, to: a, deltas };
            premises.push(`${subj(names[i])} says: ${renderNdPremise(layout, edge, false)}`);
        });
        if (malformed) return null;

        extending.forEach((edgeIndex, k) => {
            const speaker = checkableCount + k;
            const edge = layout.edges[edgeIndex];
            const deltas = world[speaker] ? edge.deltas : lieAbout(edge.deltas);
            if (!deltas) { malformed = true; return; }
            premises.push(`${subj(names[speaker])} says: `
                + renderNdPremise(layout, { ...edge, deltas, stated: undefined }, false));
            // A lie carries no information, so the relation it covers is not
            // available to the reader at all.
            if (!world[speaker]) edge.stated = layout.axes.map(() => false);
        });
        if (malformed) return null;

        claims.forEach((c, i) => premises.push(describeStatement(i, c, names)));
        shuffle(premises);

        const kind = (i: number) => (world[i] ? "knight" : "knave");
        const listed = (pick: (i: number) => boolean) =>
            names.filter((_, i) => pick(i)).map(n => subj(n)).join(" and ");

        const typeClaim = names.map((n, i) => `${subj(n)} is a ${hi(kind(i))}`).join(", ");
        // Wrong in one place only: a claim wrong about everyone is rejectable
        // by noticing a single speaker, which is less than the item asks.
        const wrongAt = Math.floor(Math.random() * speakerCount);
        const wrongTypeClaim = names
            .map((n, i) => `${subj(n)} is a ${hi(i === wrongAt ? kind(i) === "knight" ? "knave" : "knight" : kind(i))}`)
            .join(", ");

        return {
            premises,
            plainOnly,
            typeClaim,
            wrongTypeClaim,
            explanation: [
                `${listed(i => i < checkableCount)} report${checkableCount === 1 ? "s" : ""} something`
                + ` the stated facts already settle \u2014 that is what makes their kind checkable.`,
                `Their claims about the others then leave one reading: `
                + names.map((n, i) => `${subj(n)} a ${hi(kind(i))}`).join(", ") + ".",
                world.some(w => !w)
                    ? `So what ${listed(i => !world[i])} said about the arrangement is false and`
                      + ` tells you nothing; the rest holds.`
                    : `Every report holds.`,
            ],
        };
    }

    return null;
}