/**
 * Syllogisms, from all three generators.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, isPremiseLikeConclusion, pickUniqueItems, shuffle } from "../utils/question.utils";
import { generatePolysyllogism, formatSylPremise, getRandomRuleValid, getRandomRuleInvalid, getSyllogism, sylEntails, sylIsConsistent, sylNegate } from "../utils/syllogism.utils";
import { SylKind, SylPremise } from "../models/syllogism.models";
import { subj } from "../utils/phrasing";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { SyllogismGenerator } from "../pages/settings/game-mode-choose/game-mode-choose.component";

export function createSyllogismAll(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismAll");
    if (coinFlip()) {
        return createSyllogismFredo(ctx, numOfPremises);
    } else {
        return createSyllogismCanyon(ctx, numOfPremises);
    }
}

export function createSyllogismFredo(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismFredo");

    const type = EnumQuestionType.Syllogism;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const length = numOfPremises + 1;
    const question = new Question(type);
    question.isValid = coinFlip();

    do {
        question.rule = question.isValid ? getRandomRuleValid() : getRandomRuleInvalid();
        question.bucket = getRandomSymbols(settings, length);
        question.premises = [];

        [
            question.premises[0],
            question.premises[1],
            question.conclusion
        ] = getSyllogism(
            settings,
            question.bucket[0],
            question.bucket[1],
            question.bucket[2],
            question.isValid ? getRandomRuleValid() : getRandomRuleInvalid()
        );
    } while (isPremiseLikeConclusion(question.premises, question.conclusion));

    for (let i = 3; i < length; i++) {
        const rnd = Math.floor(Math.random() * (i - 1));
        const flip = coinFlip();
        const [p, m] = flip ? [question.bucket[i], question.bucket[rnd]] : [question.bucket[rnd], question.bucket[i]];
        question.premises.push(getSyllogism(settings, "#####", p, m, getRandomRuleInvalid())[0]);
    }

    shuffle(question.premises);

    return question;
}

export function createSyllogismCanyon(ctx: GeneratorContext, numOfPremises: number) {
    ctx.logger.info("createSyllogismCanyon");

    const type = EnumQuestionType.Syllogism;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    const question = new Question(type);
    const minDepth = Math.min(2, numOfPremises);
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
    question.premises = premises.map(p => formatSylPremise(p, negated));
    question.conclusion = formatSylPremise(conclusion, negated);
    question.explanation = explainPolysyllogism(trace, derived, conclusionIsTrue);

    return question;
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

    switch (ctx.syllogismGenerator) {
        case SyllogismGenerator.All:
            return createSyllogismAll(ctx, numOfPremises);
        case SyllogismGenerator.Fredo:
            return createSyllogismFredo(ctx, numOfPremises);
        case SyllogismGenerator.Canyon:
            return createSyllogismCanyon(ctx, numOfPremises);
        default:
            return createSyllogismAll(ctx, numOfPremises);
    }
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
        question.setup = [
            "These describe how the groups nest and overlap. They branch rather"
            + " than forming a single line, so some pairs are related only through"
            + " a group they are both in \u2014 and some are not related at all.",
        ];
        /*
         * Worded exactly as the item words it. A negated rendering says the same
         * thing in the opposite form — "some X is not Y" becomes "Some X is Y"
         * with the verb struck through — so a derivation using the plain form
         * beside a negated conclusion reads as a flat contradiction.
         */
        question.explanation = wantTrue
            ? [
                ...support.map(p => `${formatSylPremise(p, negated)} \u2014 needed.`),
                `Those alone force it; the rest can be dropped without changing`
                + ` the answer.`,
                `so ${formatSylPremise(claim, negated)}`,
            ]
            : ruledOut
            ? [
                ...support.map(p => `${formatSylPremise(p, negated)} \u2014 needed.`),
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