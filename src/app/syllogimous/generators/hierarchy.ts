/**
 * Hierarchy — reachability along stated links.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { hi } from "../utils/phrasing";
import { coinFlip, getRandomSymbols, shuffle } from "../utils/question.utils";
import { HierarchyLayout, HierarchyQuery, buildHierarchy, buildHierarchyQuerySet, explainHierarchy, pickHierarchyQuery, renderHierarchyConclusion, renderHierarchyPremise } from "../utils/hierarchy.utils";
import { orderPremises, scrambleByFactor } from "../utils/premise-order.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { LinearFeatureFlags } from "../services/settings-override.service";
import { EnumQuestionType } from "../constants/question.constants";
import { HIERARCHY_NOTE } from "./notes";

/**
 * Directed reachability (engine in `utils/hierarchy.utils.ts`).
 *
 * Premises are direct links; the question is whether one thing reaches
 * another along any number of steps. The only mode in the app about
 * connectivity rather than position, and the only one where the answer does
 * not compose by arithmetic.
 */
export function createHierarchy(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createHierarchy");

    const settings = ctx.settings;
    const type = EnumQuestionType.Hierarchy;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const feat = hierarchyFeatures(ctx);

    /*
     * Fewer nodes than links, so the spanning structure leaves room for the
     * extra routes. With one link per node the graph is a bare tree, every
     * pair has exactly one path, and there is nothing to weigh up.
     */
    const nodeCount = Math.max(4, Math.ceil(numOfPremises * 0.75) + 1);

    for (let attempt = 0; attempt < 300; attempt++) {
        const nodes = getRandomSymbols(settings, nodeCount);
        const layout = buildHierarchy(nodes, {
            cycles: feat.cycles,
            edgeCount: numOfPremises,
        });
        // The premise count is a promise; a graph that could not take the
        // requested number of links is discarded rather than shipped short.
        if (layout.edges.length !== numOfPremises) continue;

        const question = new Question(type);
        if (!fillHierarchyConclusion(ctx, question, layout, feat)) continue;

        question.premises = orderPremises(layout.edges.map(renderHierarchyPremise), ctx.settingsOverrideService.scramble, ctx.mergeTarget());
        question.bucket = [...nodes];
        question.setup = [HIERARCHY_NOTE];
        return question;
    }

    throw new Error("Cannot generate.");
}

/** Which structural modifiers this mode's ladder has earned. */
export function hierarchyFeatures(ctx: GeneratorContext) {
    const type = EnumQuestionType.Hierarchy;
    const ladder = (r: string) => ctx.hasRung(type, r);
    const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
        ctx.settingsOverrideService.linearOverride(k);

    /**
     * A modifier's state: an explicit setting wins, otherwise the ladder — or,
     * for the ones that are simply how the mode works now, `byDefault`.
     */
    const pick = (key: "multiConclusion" | "chooseConclusion", rung: string, byDefault = false) => {
        const f = forced(key);
        return f === null ? (byDefault || ladder(rung)) : !!f;
    };

    return {
        // Two links is a stated premise plus one hop; three is where you
        // have to hold a route rather than a pair.
        minSpan: ladder("min-span-3") ? 3 : 2,
        cycles: ladder("cycles"),
        // On for everybody, not earned. Several claims about different
        // pairs is what makes a whole arrangement load-bearing rather than one
        // corner of it, so it is what the mode asks unless it is switched off.
        multiConclusion: pick("multiConclusion", "retired-multi-conclusion", true),
        chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
    };
}

export function fillHierarchyConclusion(ctx: GeneratorContext, 
    question: Question,
    layout: HierarchyLayout,
    feat: ReturnType<typeof hierarchyFeatures>,
): boolean {
    /*
     * Links along the claimed path, or the whole set when there is no path.
     *
     * A false hierarchy claim is false because nothing joins the two, and
     * establishing that means having looked everywhere — so its cost is every
     * premise, not the nought an infinite span would otherwise record.
     */
    const cost = (span: number) => Number.isFinite(span) ? span : layout.edges.length;

    if (feat.chooseConclusion) {
        /*
         * Two options about one pair, differing by direction.
         *
         * Four claims about four different pairs is a search — three can be
         * dismissed for not being about the pair that matters. What a hierarchy
         * item is *about* is which way a route runs, so that is what the two
         * options differ on: the same two nodes, the arrow the other way, and
         * nothing to eliminate without following the links.
         */
        const right = pickHierarchyQuery(layout, true, feat.minSpan);
        if (!right) return false;

        const reversed: HierarchyQuery = {
            ...right,
            direction: right.direction === "to" ? "from" : "to",
            isValid: false,
        };

        const shown = shuffle([right, reversed]);
        question.depth = cost(right.span);
        question.choices = shown.map(renderHierarchyConclusion);
        question.correctChoice = shown.indexOf(right);
        question.answerMode = "choice";
        question.isValid = true;
        question.conclusion = "";
        question.explanation = explainHierarchy(layout, right);
        return true;
    }

    if (feat.multiConclusion) {
        // Each claim on its own coin; see the scale family for why.
        const count = 2 + Math.floor(Math.random() * 2);
        const wants = Array.from({ length: count }, () => coinFlip());

        const set = buildHierarchyQuerySet(layout, count, wants, feat.minSpan);
        if (set.length < count) return false;

        question.depth = Math.min(...set.map(q => cost(q.span)));
        question.series = set.map(q => ({
            text: renderHierarchyConclusion(q), isValid: q.isValid,
        }));
        question.conclusion = question.series[0].text;
        question.isValid = question.series[0].isValid;
        /*
         * One derivation per claim. Nothing mutates a hierarchy after it is
         * stated, so every one of these is safe to walk — which is why this
         * needs no guard where the scale family and the composed spaces do.
         */
        question.explanation = set.flatMap((q, i) => [
            ...explainHierarchy(layout, q),
            q.isValid ? `so claim ${i + 1} holds.`
                : `so claim ${i + 1} does ${hi("not")} hold.`,
        ]);
        return true;
    }

    const q = pickHierarchyQuery(layout, coinFlip(), feat.minSpan);
    if (!q) return false;
    question.conclusion = renderHierarchyConclusion(q);
    question.isValid = q.isValid;
    question.depth = cost(q.span);
    // Nothing mutates a hierarchy after it is stated, so this is always safe.
    question.explanation = explainHierarchy(layout, q);
    return true;
}
