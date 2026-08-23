/**
 * Widest Group — the reform of Oddest Relation. See fixes/5.2.
 *
 * Several groups of objects, each placed on the same set of dimensions. Within
 * a group, on any one dimension, the members spread out between an extreme at
 * each end; the group's **spread on that dimension** is the distance between
 * those two edge members. A group is scored by its **widest** dimension, and
 * the answer is the group scoring highest.
 *
 * ── Why this rather than the mode it replaces ──
 *
 * Oddest Relation decides every dimension by majority vote and then counts, per
 * candidate, how many dimensions depart from it. Six axes across four relations
 * is twenty-four comparisons in a fixed order with no decision anywhere in it —
 * arithmetic with reading attached, and difficulty that grows with axis count
 * rather than with structure, which is what the ground rules warn against.
 *
 * This does not decompose that way. Finding a group's score means ordering its
 * members along each dimension to find the extremes, and comparing groups means
 * knowing each one's *widest* dimension first — so the per-dimension work
 * cannot be finished before the cross-group work starts. Three nested steps
 * with a real decision in each, where the old mode had one flat count.
 *
 * ── Why it is decidable ──
 *
 * Two things have to hold or the item has no defensible answer, and both are
 * built rather than hoped for:
 *
 *   - **The winner is unique.** A tie for widest is unanswerable, so the
 *     margin between the best group and the next is drawn first and the
 *     coordinates are constructed to hit it.
 *   - **Every group's own widest dimension is unique too.** Otherwise "which
 *     dimension is this group's widest" has two answers, and a reader who
 *     checks the other one is right and marked wrong.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, subj, dimClass, dimSlot } from "../utils/phrasing";
import { axesForDimensions } from "../utils/ndspace.utils";
import { ANCHORS } from "../utils/anchor.utils";
import { GeneratorContext } from "./context";

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

interface Member { name: string; coord: number[]; }
interface Built { members: Member[]; spreads: number[]; score: number; widest: number; }

/**
 * One group whose widest dimension spans exactly `score`.
 *
 * Built from the answer backwards. Placing members at random and measuring
 * afterwards gives no control over the margin between groups, and the margin
 * *is* the difficulty: left to chance the winner is usually obvious, and
 * occasionally tied, which is worse than obvious.
 */
function buildGroup(names: string[], dims: number, score: number): Built | null {
    const widest = Math.floor(Math.random() * dims);
    const spreads: number[] = [];

    for (let d = 0; d < dims; d++) {
        if (d === widest) { spreads.push(score); continue; }
        /*
         * Strictly narrower, and by at least one. A second dimension equal to
         * the widest makes "this group's widest dimension" a question with two
         * answers, and a reader who picks the other is right and marked wrong.
         */
        if (score < 2) return null;
        spreads.push(1 + Math.floor(Math.random() * (score - 1)));
    }

    const members: Member[] = names.map(name => ({ name, coord: Array(dims).fill(0) }));

    for (let d = 0; d < dims; d++) {
        const lo = -Math.floor(spreads[d] / 2);
        // The two edges are placed outright; the rest land strictly between
        // them, so the spread is the one stated and not an accident of the draw.
        const inner = members.length - 2;
        const middles = Array.from({ length: inner }, () =>
            lo + 1 + Math.floor(Math.random() * Math.max(1, spreads[d] - 1)));
        const values = shuffle([lo, lo + spreads[d], ...middles]);
        members.forEach((m, i) => { m.coord[d] = values[i]; });
    }

    return { members, spreads, score, widest };
}

/** What the reader is asked to compute, done independently of how it was built. */
export function spreadsOf(members: Member[], dims: number): number[] {
    return Array.from({ length: dims }, (_, d) => {
        const values = members.map(m => m.coord[d]);
        return Math.max(...values) - Math.min(...values);
    });
}

function features(ctx: GeneratorContext, type: EnumQuestionType) {
    const has = (r: string) => ctx.hasRung(type, r);

    let dims = 2;
    for (const d of [3, 4, 5, 6]) if (has(`dim-${d}`)) dims = d;

    const groups = has("groups-4") ? 4 : has("groups-3") ? 3 : 2;

    /*
     * The margin is the difficulty, and it shrinks as it is earned.
     *
     * Two apart is a glance; one apart has to be measured. It is the last thing
     * to tighten because a narrow margin over many dimensions is the hardest
     * this mode gets, and there is no point reaching it before the dimensions
     * are there to hide it in.
     */
    const margin = has("margin-1") ? 1 : 2;

    return { dims, groups, margin, rank: has("rank") };
}

/**
 * A group as a table, one row per member and one column per dimension.
 *
 * Not sentences. Five members across six dimensions is thirty facts, and as
 * prose that is six clauses per line for five lines — the display problem the
 * composed spaces already hit, where the reader spends the item parsing rather
 * than comparing. A table is what the question actually is: the answer is found
 * by reading down columns, and a column is a thing you can read down.
 *
 * Classes rather than inline styles, because Angular's sanitizer strips styles
 * from `[innerHTML]` and keeps classes.
 */
function tableFor(g: Built, axes: Array<{ name: string }>, label: string, anchor: string): string {
    const head = axes
        .map((a, d) => `<th class="${dimClass(dimSlot(d))}">${a.name}</th>`)
        .join("");

    const rows = g.members.map(m =>
        `<tr><th>${subj(m.name)}</th>`
        + m.coord.map(v => `<td>${v > 0 ? "+" + v : v}</td>`).join("")
        + `</tr>`).join("");

    /*
     * The top-left cell names the marker everything is measured from.
     *
     * It is the one place a reader looks before reading a row, and a column of
     * signed numbers with nothing to be signed *against* is a column of
     * abstractions — "+2" means something once it means two east of ●.
     */
    return `<div class="group"><div class="group__name">${hi(label)}</div>`
        + `<table class="group__table"><thead><tr>`
        + `<th class="group__from">from ${anchor}</th>${head}</tr></thead>`
        + `<tbody>${rows}</tbody></table></div>`;
}

export function createWidestGroup(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createWidestGroup");

    const type = EnumQuestionType.WidestGroup;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    const feat = features(ctx, type);
    const axes = axesForDimensions(feat.dims).slice(0, feat.dims)
        .map(a => ({ name: a.name || a.axisName }));

    // Premises buy members per group: more rows is more ordering to do before
    // any group's own widest dimension is known.
    const size = Math.max(3, Math.min(6, numOfPremises));

    for (let attempt = 0; attempt < 300; attempt++) {
        /*
         * Scores drawn first, winner downwards.
         *
         * The gap between first and second is the margin; the rest sit below
         * the runner-up so no third group can be mistaken for the answer, and
         * so the item is not decided by a coincidence among the also-rans.
         */
        const top = 4 + Math.floor(Math.random() * 4);
        const scores = [top, top - feat.margin];
        for (let g = 2; g < feat.groups; g++) {
            const below = top - feat.margin - 1 - Math.floor(Math.random() * 2);
            if (below < 2) { scores.length = 0; break; }
            scores.push(below);
        }
        if (scores.length !== feat.groups) continue;

        const names = getRandomSymbols(settings, feat.groups * size);
        if (names.length < feat.groups * size) continue;

        const built: Built[] = [];
        for (let g = 0; g < feat.groups; g++) {
            const made = buildGroup(names.slice(g * size, (g + 1) * size), feat.dims, scores[g]);
            if (!made) break;
            built.push(made);
        }
        if (built.length !== feat.groups) continue;

        /*
         * Measured back off the finished coordinates, never trusted from the
         * construction. Placing the two edges and scattering the rest between
         * them should give the spread that was asked for, and "should" is not a
         * thing to ship: an item whose stated answer disagrees with its own
         * numbers is the one failure a trainer must not have.
         */
        const actual = built.map(g => spreadsOf(g.members, feat.dims));
        const measured = actual.map(s => Math.max(...s));
        const best = Math.max(...measured);
        if (measured.filter(v => v === best).length !== 1) continue;
        if (measured.some((v, i) => v !== built[i].score)) continue;
        /*
         * Under `rank` every group's score has to differ, or the order is not
         * one order — two groups tied for third make several answers right and
         * only one of them offered.
         */
        if (feat.rank && new Set(measured).size !== measured.length) continue;
        // Each group's own widest has to be its alone, or "which dimension is
        // widest here" has two answers.
        if (actual.some(s => s.filter(v => v === Math.max(...s)).length !== 1)) continue;

        const winner = measured.indexOf(best);
        const order = shuffle(built.map((_, i) => i));

        /*
         * One marker for the whole item, not one per group.
         *
         * Every group is measured from the same point, which is what makes the
         * tables comparable at all — a group read from its own marker would put
         * the same arrangement at different numbers, and the reader would be
         * comparing frames rather than spreads. It changes no answer, spreads
         * being differences within a group, and that is the point: the frame is
         * there to give the numbers a meaning, not to be part of the question.
         */
        const anchor = pick(ANCHORS).token;

        const question = new Question(type);
        question.bucket = names;
        question.buckets = order.map(i => built[i].members.map(m => m.name));
        question.setup = [
            `Everything is placed against ${anchor}, which never moves. Each group`
            + ` is placed on the same directions.`,
            `A group's <b>spread</b> on a direction is the distance between its two`
            + ` outermost members on it. Score a group by its <b>widest</b>`
            + ` direction — its largest spread.`,
        ];
        question.premises = order.map((i, k) =>
            tableFor(built[i], axes, `Group ${k + 1}`, anchor));

        /*
         * Naming the top group needs only the top group's score. Ordering them
         * all needs every score, so a reader who found the winner early cannot
         * stop — which is the difference the rung is for, rather than a smaller
         * guess floor.
         */
        const label = (i: number) => `Group ${order.indexOf(i) + 1}`;
        question.answerMode = "choice";

        if (feat.rank) {
            const ranking = [...built.map((_, i) => i)]
                .sort((a, b) => measured[b] - measured[a])
                .map(label).join(" > ");

            const wrong = new Set<string>();
            for (let i = 0; i < 60 && wrong.size < 3; i++) {
                const text = shuffle(built.map((_, k) => k)).map(label).join(" > ");
                if (text !== ranking) wrong.add(text);
            }
            if (wrong.size < 3) continue;

            const options = shuffle([ranking, ...wrong]);
            question.choicePrompt = "Widest first — which order?";
            question.choices = options;
            question.correctChoice = options.indexOf(ranking);
        } else {
            question.choicePrompt = "Which group is widest?";
            question.choices = order.map((_, k) => `Group ${k + 1}`);
            question.correctChoice = order.indexOf(winner);
        }
        question.conclusion = "";
        question.isValid = true;

        question.explanation = order.map((i, k) => {
            const s = actual[i];
            const w = s.indexOf(Math.max(...s));
            return `Group ${k + 1} is widest on ${hi(axes[w].name, dimClass(dimSlot(w)))}`
                + `, spanning ${hi(String(s[w]))}.`;
        }).concat([
            `so the widest is ${hi(`Group ${order.indexOf(winner) + 1}`)}`
            + `, by ${hi(String(best - Math.max(...measured.filter((_, i) => i !== winner))))}.`,
        ]);

        return question;
    }

    throw new Error("Cannot generate.");
}
