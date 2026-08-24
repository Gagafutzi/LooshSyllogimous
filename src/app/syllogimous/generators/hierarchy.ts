/**
 * Hierarchy — reachability along stated links.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols, shuffle } from "../utils/question.utils";
import { HierarchyLayout, buildHierarchy, buildHierarchyQuerySet, explainHierarchy, pickHierarchyQuery, renderHierarchyConclusion, renderHierarchyPremise } from "../utils/hierarchy.utils";
import { scrambleByFactor } from "../utils/premise-order.utils";
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

        question.premises = scrambleByFactor(
            layout.edges.map(renderHierarchyPremise),
            ctx.settingsOverrideService.scramble);
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

    const pick = (key: "multiConclusion" | "chooseConclusion", rung: string) => {
        const f = forced(key);
        return f === null ? ladder(rung) : !!f;
    };

    return {
        // Two links is a stated premise plus one hop; three is where you
        // have to hold a route rather than a pair.
        minSpan: ladder("min-span-3") ? 3 : 2,
        cycles: ladder("cycles"),
        multiConclusion: pick("multiConclusion", "multi-conclusion"),
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
        const set = buildHierarchyQuerySet(layout, 4, [true, false, false, false], feat.minSpan);
        if (set.length < 4) return false;
        // Only the true claim is on the path to the answer; the distractors
        // are about other pairs by construction.
        question.depth = cost(set[0].span);
        const order = shuffle(set.map((_, i) => i));
        question.choices = order.map(i => renderHierarchyConclusion(set[i]));
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

        const set = buildHierarchyQuerySet(layout, count, wants, feat.minSpan);
        if (set.length < count) return false;
        // Every claim has to be checked, so the cheapest is what the item can
        // be answered from when one of them is false.
        question.depth = Math.min(...set.map(q => cost(q.span)));
        question.conclusion = set.map(renderHierarchyConclusion);
        question.isValid = allTrue;
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
