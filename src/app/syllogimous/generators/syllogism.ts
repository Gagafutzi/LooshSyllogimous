/**
 * Syllogisms.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 *
 * There were three generators and there is one. Fredo built a single syllogism
 * and padded it with distractors drawn from invalid rules, so its conclusion
 * needed **two** premises whatever the item's length — a six-premise item was a
 * two-premise argument with four lines of noise. That is not a variant of the
 * depth complaint, it is the complaint. Canyon draws the same shape when its
 * chain is short and controls how short, so nothing was lost by dropping it;
 * `createSyllogismAll`, which flipped a coin between the two, went with it.
 */

import { GeneratorContext, buildSeries, deepConclusions, extendWithSeries, seriesWanted } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, shuffle } from "../utils/question.utils";
import { inSyllogisticOrder, nameTheInference, vennDiagramFor } from "../utils/venn.utils";
import { generatePolysyllogism, formatSylPremise, sylEntails, sylIsConsistent, sylNegate } from "../utils/syllogism.utils";
import { SylKind, SylPremise } from "../models/syllogism.models";
import { hi, subj } from "../utils/phrasing";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";

export function createSyllogismCanyon(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismCanyon");

    const type = EnumQuestionType.Syllogism;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);
    /*
     * How much of the item the conclusion composes.
     *
     * Drawn anywhere from two to the whole premise set, which means a
     * six-premise item could be a two-premise argument with four lines of
     * padding — reachable without composing the chain, and the padding there to
     * be read and discarded. That is the defect this section is named for,
     * sitting in a variable that already had the right name.
     *
     * The deep model draws from the top two bands instead. Not the top band
     * alone: a syllogism with *no* discardable premise stops asking the
     * question of whether a premise is relevant, and noticing that one is not
     * is a real part of the skill. That is exactly the deliberate case `slack`
     * exists for — one premise meant to be discardable — rather than a
     * tolerance drifted into.
     */
    const floor = deepConclusions(ctx)
        ? Math.max(Math.min(2, numOfPremises), numOfPremises - 1)
        : Math.min(2, numOfPremises);
    const minDepth = floor;
    const maxDepth = numOfPremises;
    const chainDepth = Math.floor(Math.random() * (maxDepth - minDepth + 1)) + minDepth;
    const chainTermsNeeded = chainDepth + 1;
    const numDistractors = numOfPremises - chainDepth;
    const minExtra = Math.ceil(numDistractors / chainTermsNeeded);
    const maxExtra = numDistractors;
    const extra = Math.floor(Math.random() * (maxExtra - minExtra + 1)) + minExtra;
    const poolSize = chainTermsNeeded + extra;
    const termPool = getRandomSymbols(settings, poolSize);
    const wantTrue = coinFlip();
    const { premises, conclusion, conclusionIsTrue, trace, derived } = generatePolysyllogism({
        nPremises: numOfPremises,
        chainDepth,
        termPool,
        trueConclusion: wantTrue,
    });

    const negated = settings.enabled.negation && coinFlip();

    question.bucket = termPool;
    question.isValid = conclusionIsTrue;
    /*
     * The chain is the answer and the rest are distractors, so the chain's
     * length is exactly how much of the item the conclusion needs. Drawn
     * anywhere from two to the whole premise set, which makes this the one
     * generator whose depth already varied — and the one where a report of it
     * says something the premise count does not.
     */
    question.depth = chainDepth;
    question.premises = premises.map(p => formatSylPremise(p, negated));
    question.conclusion = formatSylPremise(conclusion, negated);
    /*
     * A polysyllogism is a chain, and three circles hold one link. Drawn when
     * the load-bearing premises come to a single syllogism — which is every
     * two-premise item, the shape the complaint was about — and skipped when
     * the chain is longer, where a picture of the last link alone would explain
     * a step the reader has not been shown how to reach.
     */
    const support = minimalSupport(premises, derived);
    if (support.length === 2) question.venn = vennDiagramFor(support, derived);

    /*
     * A chain of one link is a syllogism, so it is explained as one.
     *
     * `explainPolysyllogism` walks the intermediate conclusions, and a two-step
     * chain has none — so its whole derivation was the single line `so <the
     * answer>`, which restates the conclusion and shows no work. That was
     * invisible while Fredo existed, because Fredo owned the short items and
     * named the middle term and the move; removing it left the shortest and
     * commonest shape with the thinnest explanation in the mode.
     *
     * So the short case now reads as a syllogism — the two premises in
     * syllogistic order, the shared term, the move — and the long case keeps
     * the chain walk, which is the right account of it.
     */
    question.explanation = question.venn
        ? syllogismLines(question.venn, support, derived, negated, conclusionIsTrue)
        : explainPolysyllogism(trace, derived, conclusionIsTrue);

    extendSyllogism(ctx, question, premises, negated);
    return question;
}

/**
 * One link, read the way a syllogism is read.
 *
 * Shares its wording with the Set Hierarchy derivation deliberately: they are
 * the same argument in the same mode, and a reader who met one form should not
 * have to learn the other.
 */
function syllogismLines(
    venn: NonNullable<Question["venn"]>,
    support: SylPremise[],
    derived: SylPremise,
    negated: boolean,
    isTrue: boolean,
): string[] {
    const ordered = inSyllogisticOrder(support, venn.roles);
    return [
        ...ordered.map(p => formatSylPremise(p, negated)),
        `The two share ${hi(venn.roles.m)}, and the claim never mentions it`
        + ` — that is the term the argument runs through.`,
        ...nameTheInference(ordered, venn, t => hi(t)),
        isTrue
            ? `so ${formatSylPremise(derived, negated)}`
            : `the premises give ${formatSylPremise(derived, negated)}, which the`
              + ` claim contradicts`,
    ];
}

/**
 * The chain, one link at a time, with what each link licenses.
 *
 * A polysyllogism is assembled by composing syllogisms, and the intermediate
 * conclusions are both the method and the one part of the item a reader cannot
 * recover afterwards: the chain premises are shuffled in among distractors
 * chosen specifically to entail nothing, so which premises did the work is
 * invisible once the item is built.
 *
 * A false item ends on what the premises *do* entail rather than on "this does
 * not follow". Saying only that a claim fails leaves the reader knowing they
 * were wrong and not what was true, which is the same one bit the verdict
 * already gave them. The terms are the same either way — a false conclusion is
 * made by changing the relation between the same two terms, never by
 * introducing new ones — so this stays within what the item asked about.
 */
function explainPolysyllogism(
    trace: SylPremise[],
    derived: SylPremise,
    isTrue: boolean,
): string[] {
    if (!trace.length) return [];

    const lines = trace.slice(0, -1).map(step => `so far: ${formatSylPremise(step)}`);
    lines.push(isTrue
        ? `so ${formatSylPremise(derived)}`
        : `the premises give ${formatSylPremise(derived)}, which the claim contradicts`);
    return lines;
}

/**
 * More claims about the same premise set.
 *
 * `sylEntails` decides any claim over any premises, so a second question costs
 * a scan rather than a second argument — and it is a different pair, usually
 * running through a different part of the chain. Which is the point of asking
 * twice: the first claim can be settled by following one thread, and the second
 * usually cannot be settled from that same thread.
 *
 * **Pairs a premise states outright are skipped**, the same rule the conclusion
 * picker follows: a directly stated pair is read rather than reasoned about,
 * and a series is a poor place to hide a free answer because the reader has
 * already paid the reading cost.
 */
function extendSyllogism(
    ctx: GeneratorContext,
    question: Question,
    premises: SylPremise[],
    negated: boolean,
) {
    if (!seriesWanted(ctx)) return;

    const words = [...new Set(premises.flatMap(([a, , b]) => [a, b]))];
    const kinds: SylKind[] = ["all", "no", "some", "some_not"];

    extendWithSeries(question, buildSeries(want => {
        const a = words[Math.floor(Math.random() * words.length)];
        const b = words[Math.floor(Math.random() * words.length)];
        if (a === b) return null;
        if (premises.some(([x, , y]) => (x === a && y === b) || (x === b && y === a))) return null;

        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const claim: SylPremise = [a, kind, b];
        if (sylEntails(premises, claim) !== want) return null;

        return {
            text: formatSylPremise(claim, negated),
            isValid: want,
            key: `${a}:${kind}:${b}`,
        };
    }));
}

export function createSyllogism(ctx: GeneratorContext, numOfPremises: number) {
    /*
     * A hierarchy rather than a chain, when earned.
     *
     * Every syllogism this mode has produced is a *path*: each premise composes
     * onto the running conclusion. Real taxonomic reasoning branches — two
     * categories both inside a third, with nothing said about each other — and
     * a branch is what lets a pair be genuinely undecided rather than merely
     * false. That is a different demand, and the one this mode never made.
     *
     * It needed no new solver. `sylEntails` refutes rather than derives, so it
     * was never chain-specific, and the premise network can be any shape.
     */
    if (ctx.hasRung(EnumQuestionType.Syllogism, "hierarchy")) {
        const built = buildSetHierarchy(ctx, numOfPremises);
        if (built) return built;
    }

    return createSyllogismCanyon(ctx, numOfPremises);
}


/**
 * Quantified set logic over a branching network.
 *
 * Terms are attached to a randomly chosen earlier term, so the premises form a
 * tree rather than a path. Two consequences, and they are the point:
 *
 *   - some pairs are connected only through a common ancestor, so deciding them
 *     needs more than following a line;
 *   - some pairs are not decided at all, and noticing that is the answer rather
 *     than a failure to find one.
 *
 * Everything is checked by the existing solver. The tree is *drawn* and then
 * *asked about* — never assumed to entail what it was built to entail — because
 * a quantifier chosen at random can make the whole set inconsistent, and an
 * inconsistent set entails everything.
 */
function buildSetHierarchy(ctx: GeneratorContext, numOfPremises: number): Question | null {
    const settings = ctx.settings;
    const type = EnumQuestionType.Syllogism;

    if (!canGenerateQuestion(type, numOfPremises, settings)) return null;
    numOfPremises = clampPremises(type, numOfPremises);

    const terms = numOfPremises + 1;

    /*
     * Drawn once, outside the loop.
     *
     * Redrawing per attempt biases the mode towards whichever answer is easier
     * to find, and in a sparse tree that is emphatically "does not follow" —
     * it produced one true item in twenty before the scan below, and would
     * still lean that way with it. Fixing the target first means a failure to
     * build is a failure, not a quiet substitution.
     */
    const wantTrue = coinFlip();

    /*
     * And, when false, *which kind* of false.
     *
     * Left to chance it is not a coin at all: most pairs and quantifiers are
     * simply unentailed, so scanning for any false claim found one the premises
     * merely fail to settle roughly seven times in eight. A player would learn
     * that "false" means "not stated" and stop checking whether it was actually
     * ruled out — which is the distinction the mode is for.
     */
    const wantRuledOut = !wantTrue && coinFlip();

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, terms);
        const premises: SylPremise[] = [];

        for (let i = 1; i < terms; i++) {
            const parent = words[Math.floor(Math.random() * i)];
            /*
             * Weighted towards "all", which is what actually builds a hierarchy.
             * Drawing uniformly gives a set of scattered claims rather than a
             * nesting, and nothing has a route to anything.
             */
            // A premise is [subject, quantifier, predicate]. Stating it either
            // way round is what makes the tree branch in both directions —
            // "all X are Y" nests X inside Y, "all Y are X" the reverse.
            const kind = pickKind();
            premises.push(coinFlip()
                ? [parent, kind, words[i]]
                : [words[i], kind, parent]);
        }

        // A quantifier drawn at random can contradict an earlier one, and an
        // inconsistent set entails every conclusion including its own denial.
        if (!sylIsConsistent(premises)) continue;

        /*
         * Every pair and quantifier, not one drawn at random.
         *
         * Entailed conclusions are far rarer than unentailed ones in a sparse
         * tree, so drawing a single pair and hoping produced roughly one true
         * item in twenty — the answer was guessable without reading anything.
         * Scanning finds a true claim when one exists and keeps the two kinds
         * of item at the same rate.
         */
        const candidates: SylPremise[] = [];

        for (const a of words) {
            for (const b of words) {
                if (a === b) continue;
                // Directly stated pairs are read, not reasoned about.
                if (premises.some(([x, , y]) => (x === a && y === b) || (x === b && y === a))) continue;
                for (const k of ["all", "no", "some", "some_not"] as SylKind[]) {
                    candidates.push([a, k, b]);
                }
            }
        }
        shuffle(candidates);

        const claim = candidates.find(c =>
            sylEntails(premises, c) === wantTrue
            && (wantTrue || sylEntails(premises, sylNegate(c)) === wantRuledOut));
        if (!claim) continue;
        const [a, b] = [claim[0], claim[2]];

        /*
         * Two ways to be false, and they are not the same thing.
         *
         * The premises may *rule the claim out*, or may simply not settle it.
         * Telling those apart is most of what this mode is for, so the
         * derivation has to as well — the first version called both "does not
         * follow", which is true of each and a description of neither.
         */
        const ruledOut = !wantTrue && sylEntails(premises, sylNegate(claim));
        if (!wantTrue && ruledOut !== wantRuledOut) continue;
        const support = wantTrue ? minimalSupport(premises, claim)
            : ruledOut ? minimalSupport(premises, sylNegate(claim))
            : [];
        // A conclusion one premise gives on its own is a restatement.
        if (wantTrue && support.length < 2) continue;

        const negated = settings.enabled.negation && coinFlip();
        const question = new Question(type);
        question.bucket = [...words];
        question.premises = shuffle(premises.map(p => formatSylPremise(p, negated)));
        question.conclusion = formatSylPremise(claim, negated);
        question.isValid = wantTrue;
        /*
         * The premises that actually do the work — already found, for the
         * derivation, by dropping the ones that do not.
         *
         * An item the premises leave *undecided* has no support set at all, and
         * recording nought would say "this mode does not measure depth" when
         * what happened is the opposite. Establishing that nothing settles a
         * pair means having failed to find a derivation, which takes the whole
         * premise set — so that is the number, and it is the reader's cost
         * rather than the prover's.
         */
        question.depth = support.length || premises.length;
        question.setup = [
            "These describe how the groups nest and overlap. They branch rather"
            + " than forming a single line, so some pairs are related only through"
            + " a group they are both in \u2014 and some are not related at all.",
        ];
        /*
         * The picture, when the item is a syllogism shaped like one.
         *
         * Built from the load-bearing premises rather than all of them: the
         * diagram is a decision procedure, and drawing the premises that were
         * shown not to matter would shade regions the answer does not turn on.
         * `rolesFor` returns null when the support does not resolve to exactly
         * one middle term — a longer chain, or a pair the premises never
         * relate — and then there is no three-circle picture to draw and the
         * words stand alone.
         */
        question.venn = vennDiagramFor(
            support.length ? support : premises,
            wantTrue || !ruledOut ? claim : sylNegate(claim));

        /*
         * Worded exactly as the item words it. A negated rendering says the same
         * thing in the opposite form — "some X is not Y" becomes "Some X is Y"
         * with the verb struck through — so a derivation using the plain form
         * beside a negated conclusion reads as a flat contradiction.
         */
        /*
         * Read in syllogistic order, with the move named.
         *
         * Three things were wrong with listing the load-bearing premises and
         * jumping to `so <conclusion>`. They came out in whatever order the
         * search left them, so the reader had to find the middle term before
         * the argument could be followed. The line about the other premises
         * being droppable is bookkeeping about the *search*, and sat between
         * the premises and the conclusion, interrupting the argument to talk
         * about how it was found. And nothing named the inference — the one
         * step someone who got the item wrong actually needs.
         */
        const ordered = question.venn
            ? inSyllogisticOrder(support, question.venn.roles)
            : support;
        const move = question.venn
            ? nameTheInference(ordered, question.venn, t => hi(t))
            : [];
        const middleNote = question.venn && support.length === 2
            ? [`The two share ${hi(question.venn.roles.m)}, and the claim never`
                + ` mentions it — that is the term the argument runs through.`]
            : [];

        question.explanation = wantTrue
            ? [
                ...ordered.map(p => formatSylPremise(p, negated)),
                ...middleNote,
                ...move,
                `so ${formatSylPremise(claim, negated)}`,
                `The other premises can be dropped without changing the answer.`,
            ]
            : ruledOut
            ? [
                ...ordered.map(p => formatSylPremise(p, negated)),
                ...middleNote,
                ...move,
                `Those force the opposite of the claim, so it is not merely`
                + ` unsupported \u2014 it is ruled out.`,
                `so ${formatSylPremise(sylNegate(claim), negated)}`,
            ]
            : [
                `Nothing the premises say settles ${subj(a)} against ${subj(b)}.`,
                `They stay consistent with the claim and with its opposite, so it`
                + ` does not follow \u2014 which is not the same as being ruled out.`,
                `so ${formatSylPremise(claim, negated)} does not follow`,
            ];
        return question;
    }

    return null;
}

/** "all" three times in four; the rest build a nesting far too slowly. */
function pickKind(): SylKind {
    const roll = Math.random();
    if (roll < 0.6) return "all";
    if (roll < 0.8) return "no";
    return roll < 0.9 ? "some" : "some_not";
}

/**
 * The premises that actually do the work, found by removing the ones that do not.
 *
 * A derivation that lists everything stated says only "it follows from all of
 * this", which the verdict already said. Greedy removal is not guaranteed to
 * find the smallest such set, and does not claim to — what it does guarantee is
 * that every premise left is load-bearing, since dropping it was tried and the
 * conclusion stopped following.
 */
function minimalSupport(premises: SylPremise[], claim: SylPremise): SylPremise[] {
    let kept = [...premises];

    for (const p of premises) {
        const without = kept.filter(q => q !== p);
        if (sylEntails(without, claim)) kept = without;
    }
    return kept;
}