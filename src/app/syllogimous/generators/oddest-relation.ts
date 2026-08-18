/**
 * Oddest relation out — P11.
 *
 * Four or more relations are stated in full. All but one agree, dimension by
 * dimension, on a pattern that is never named; each departs from it by a
 * different amount. Name the one that departs furthest.
 *
 * ── Why graded deviants ──
 *
 * Ordinary odd-one-out has a shortcut that defeats its own purpose: find the
 * three that match, take the leftover, and never articulate what they share.
 * Grading the deviations closes it. When every candidate departs from the
 * pattern — by one dimension, by two, by three — there is no matching set to
 * find, and the only way through is to reconstruct the rule and measure each
 * relation against it. That reconstruction step is the point of the mode.
 *
 * ── Why it is decidable ──
 *
 * Two things have to hold or the item has no defensible answer, and both are
 * enforced by construction rather than hoped for:
 *
 *   - **The pattern is recoverable.** Every dimension is decided by a strict
 *     majority, so no axis is a tie and the consensus is a fact about the item
 *     rather than a judgement call.
 *   - **The gap is strict.** Distances are 0, 1, 2, … with no repeats, so the
 *     furthest is furthest by a clear margin and no ordering is arguable.
 *
 * The metric is stated with the item and the pattern is not — the same move the
 * compact-premise convention makes. Telling the reader how distance is measured
 * costs nothing; telling them what the pattern is would be the whole question.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { ConstructClaim } from "../models/question.models";
import { hi, subj } from "../utils/phrasing";
import {
    AxisSpec, NdEdge, NdLayout, axesForDimensions, ndAxisColors, renderNdPattern,
    renderNdPremise,
} from "../utils/ndspace.utils";
import { GeneratorContext } from "./context";

/**
 * How many relations to compare.
 *
 * Four is the floor: with three, distances 0/1/2 leave a single pair agreeing
 * and the consensus stops being a majority. The ceiling is what the axis count
 * can carry — see `capacity` below.
 */
function relationCount(numOfPremises: number): number {
    return Math.max(4, Math.min(MAX_RELATIONS, numOfPremises - 2));
}

/**
 * Six axes, and five relations at most.
 *
 * The stack is capped at the six-axis preset because past it `axesForDimensions`
 * extends from the choice list and draws axes that share direction words —
 * quantity and vertical both say "higher"/"lower". A premise then states
 * "higher" twice with no way to tell which dimension either belongs to, which
 * is ambiguous to *read*, never mind to solve. It is the exact failure
 * `axisWordConflicts` exists to name, and it showed up the first time this mode
 * was run.
 *
 * Five relations is then what six axes can carry: distances 0..4 need ten
 * deviations and six axes hold two apiece.
 */
const MAX_AXES = 6;
const MAX_RELATIONS = 5;

/**
 * Deviations an axis can absorb while still deciding by majority.
 *
 * With `n` relations an axis stays decided as long as the minority is smaller
 * than the majority, so it can hold at most `ceil(n / 2) - 1` deviants. Four
 * relations allow one per axis, six allow two.
 */
const capacity = (n: number) => Math.ceil(n / 2) - 1;

/**
 * Whether the item asks for every distance rather than just the furthest.
 *
 * Earned on the mode's own ladder, or forced from Customise through the
 * same flag the other families use for construction answering — so the one
 * control means the same thing everywhere.
 */
function ranking(ctx: GeneratorContext): boolean {
    /*
     * Its own rung, not the scale family's "build the conclusion" flag.
     *
     * Borrowing that flag was the only way to force this before rungs could be
     * set per mode, and it meant the control for ranking was a tickbox named
     * for a different family — findable only by reading the source.
     */
    return ctx.hasRung(EnumQuestionType.OddestRelation, "rank");
}

/**
 * Name the pattern instead of measuring against it.
 *
 * This is where P8 landed. Boolean concept learning wanted the rule separating
 * positives from negatives, and the standard paradigm — one exemplar at a time,
 * feedback, many trials per concept — is the wrong shape for training: most
 * trials carry little information, three binary dimensions is eight objects and
 * memorable, and it is categorisation over attributes rather than over
 * relations.
 *
 * The promising direction was relational instances, the whole set at once, and
 * the rule as the answer. That is this mode with the question turned round. The
 * consensus was always computed here and deliberately never stated; asking for
 * it costs one presentation rather than a generator, and the two really are one
 * mode with two presentations rather than neighbours.
 */
function naming(ctx: GeneratorContext): boolean {
    return ctx.hasRung(EnumQuestionType.OddestRelation, "state-rule");
}

export function createOddestRelation(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createOddestRelation");

    const type = EnumQuestionType.OddestRelation;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const count = relationCount(numOfPremises);
    // Distances 0..count-1 need that many deviations in total, and every one
    // has to land on an axis with room left.
    const needed = (count * (count - 1)) / 2;
    const dims = MAX_AXES;
    if (needed > dims * capacity(count)) throw new Error("Cannot generate.");

    const scales = ctx.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
    const axes: AxisSpec[] = scales.map(scale => ({ scale }));
    const colors = ndAxisColors(axes);

    for (let attempt = 0; attempt < 200; attempt++) {
        // The rule, which is never stated. No zeroes: an axis that says "no
        // difference" is one the reader cannot tell agreement from silence on.
        const rule = axes.map(() => (Math.random() < 0.5 ? -1 : 1));

        // One relation per distance, so the ordering is total and strict.
        const distances = shuffle([...Array(count).keys()]);
        const room = axes.map(() => capacity(count));
        const vectors: number[][] = [];
        let ok = true;

        for (const distance of distances) {
            const free = axes.map((_, i) => i).filter(i => room[i] > 0);
            if (free.length < distance) { ok = false; break; }

            const flip = new Set(shuffle(free).slice(0, distance));
            flip.forEach(i => room[i]--);
            vectors.push(rule.map((v, i) => (flip.has(i) ? -v : v)));
        }
        if (!ok) continue;

        /*
         * The consensus has to survive the draw. Capacity keeps every axis
         * decidable in principle, but the check is cheap and the alternative is
         * an item whose pattern the reader cannot reconstruct — so it is
         * verified rather than argued.
         */
        const consensus = axes.map((_, i) => {
            const plus = vectors.filter(v => v[i] > 0).length;
            return plus * 2 === count ? 0 : (plus * 2 > count ? 1 : -1);
        });
        if (consensus.some(v => v === 0)) continue;
        if (consensus.some((v, i) => v !== rule[i])) continue;

        const question = new Question(type);
        const words = getRandomSymbols(settings, count * 2);

        // A layout per relation, built rather than grown: these pairs are
        // deliberately unconnected, so there is nothing to compose and the
        // whole task is comparison.
        const premises: string[] = [];
        const labels: string[] = [];
        for (let i = 0; i < count; i++) {
            const [a, b] = [words[i * 2], words[i * 2 + 1]];
            const edge: NdEdge = { from: b, to: a, deltas: vectors[i] };
            const layout: NdLayout = {
                words: [a, b],
                axes,
                coords: { [a]: vectors[i], [b]: axes.map(() => 0) },
                edges: [edge],
                neighbors: { [a]: [b], [b]: [a] },
                branching: false,
            };
            premises.push(renderNdPremise(layout, edge, false));
            labels.push(`${subj(a)} &rarr; ${subj(b)}`);
        }

        const furthest = distances.indexOf(count - 1);

        question.bucket = [...words];
        question.premises = premises;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "On each dimension, <b>most</b> of these point the same way. That is the "
            + "pattern — it is never stated.",
            "Distance = <b>how many dimensions</b> a relation departs from it on.",
        ];

        if (naming(ctx)) {
            /*
             * Distractors differ from the pattern on one or two dimensions, so
             * each is strictly less supported than the consensus rather than
             * merely different from it — every axis is decided by a strict
             * majority, so flipping any one of them loses that majority. A
             * distractor that were equally supported would make the item
             * unanswerable rather than hard.
             */
            const wrong: number[][] = [];
            const seen = new Set([consensus.join(",")]);
            for (let guard = 0; wrong.length < 3 && guard < 200; guard++) {
                const flips = 1 + Math.floor(Math.random() * 2);
                const which = shuffle(axes.map((_, i) => i)).slice(0, flips);
                const candidate = consensus.map((v, i) => (which.includes(i) ? -v : v));
                const key = candidate.join(",");
                if (seen.has(key)) continue;
                seen.add(key);
                wrong.push(candidate);
            }
            if (wrong.length < 3) continue;

            const options = shuffle([consensus, ...wrong]);
            question.answerMode = "choice";
            question.choicePrompt = "Which pattern do most of these follow?";
            question.choices = options.map(v => renderNdPattern(axes, v));
            question.correctChoice = options.findIndex(v => v.join(",") === consensus.join(","));
            question.conclusion = renderNdPattern(axes, consensus);
            question.setup = [
                "On each dimension, <b>most</b> of these point the same way.",
                "Name that pattern \u2014 it is the one every dimension agrees on by"
                + " majority, not the one any single relation states.",
            ];
            question.explanation = axes.map((axis, i) => {
                const plus = vectors.filter(v => v[i] > 0).length;
                const side = consensus[i] > 0 ? plus : count - plus;
                return `On ${hi(axis.scale.name)}, ${side} of ${count} point one way`
                    + ` \u2014 ${renderNdPattern([axis], [consensus[i]])}.`;
            }).concat(`so the pattern is ${renderNdPattern(axes, consensus)}`);
            return question;
        }

        if (ranking(ctx)) {
            /*
             * Every distance, not just the furthest.
             *
             * Picking one of five is right one time in five by luck, which is
             * most of what a short run measures. Stating all five distances is
             * right one time in three thousand — the same evidence, read for
             * what it is worth. It is also the more honest question: the metric
             * is stated, so "how far is each" is exactly the task, where
             * "which is furthest" only asks for the argmax of it.
             */
            question.construct = words.reduce<ConstructClaim[]>((claims, _, i) => {
                if (i % 2) return claims;
                const pair = i / 2;
                claims.push({
                    a: words[i],
                    b: words[i + 1],
                    slots: [{
                        label: "Distance",
                        directions: [...Array(count).keys()].map(
                            d => `${d} dimension${d === 1 ? "" : "s"} away`),
                        answerDirection: distances[pair],
                        answerMagnitude: 0,
                        asksDistance: false,
                    }],
                });
                return claims;
            }, []);
            question.answerMode = "construct";
            question.setup.push("State how far <b>each</b> one is.");
        } else {
            const order = shuffle([...Array(count).keys()]);
            question.choices = order.map(i => labels[i]);
            question.correctChoice = order.indexOf(furthest);
            question.answerMode = "choice";
            question.choicePrompt = "Which is furthest from the pattern?";
        }

        question.explanation = explainOddest(
            axes, colors, labels, vectors, consensus, distances, furthest);

        return question;
    }

    throw new Error("Cannot generate.");
}

/** The pattern, then each relation's distance from it. */
function explainOddest(
    axes: AxisSpec[],
    colors: string[],
    labels: string[],
    vectors: number[][],
    consensus: number[],
    distances: number[],
    furthest: number,
): string[] {
    const word = (i: number, v: number) =>
        hi(v > 0 ? axes[i].scale.direction[0] : axes[i].scale.direction[1], colors[i]);

    const lines = [
        "The pattern, taken dimension by dimension from what most of them say: "
        + consensus.map((v, i) => word(i, v)).join(", ") + ".",
    ];

    for (let i = 0; i < labels.length; i++) {
        const off = vectors[i]
            .map((v, ax) => (v !== consensus[ax] ? ax : -1))
            .filter(ax => ax >= 0);
        lines.push(off.length === 0
            ? `${labels[i]} matches the pattern on every dimension — distance 0.`
            : `${labels[i]} departs on ${off.map(ax => word(ax, vectors[i][ax])).join(", ")}`
              + ` — distance ${distances[i]}.`);
    }

    lines.push(`so ${labels[furthest]} is furthest, at distance ${distances[furthest]}.`);
    return lines;
}
