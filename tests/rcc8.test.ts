/**
 * Region Connection — the eight relations, and the exact set.
 *
 * The domain is rectangular patches, which is a *restriction* of RCC8, so the first
 * thing worth checking is that the restriction still carries the eight relations
 * and that they mean what they are called. That is done twice over: once against a
 * second derivation of the relation from the four corners of two rectangles, and
 * once against the composition RCC8 itself gives for a known pair — if those agree,
 * the mapping from two interval relations to a region relation is the right one.
 *
 * Then the card: the marked set has to be exactly the relations some allowed
 * arrangement realises, both halves. Marking one too many is loud; marking one too
 * few fails the reader who found it, and nothing about the item looks wrong.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import {
    PatchFact, RCC8_CONVERSE, RCC8_DEFINITIONS, RCC8_NAMES, intervalStates,
    rcc8Between, rcc8FromAllen, rcc8Possible,
} from "../src/app/syllogimous/utils/interval-algebra.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createRcc8 } from "../src/app/syllogimous/generators/rcc8";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/**
 * The region relation of two rectangles, from their corners.
 *
 * The second opinion, and deliberately built the other way round: `rcc8FromAllen`
 * reasons from the interval relation on each axis, this reasons from the numbers.
 * Two rectangles are apart when their shadows miss on either axis, touching when
 * the interiors miss but the closures meet, and otherwise the question is only
 * which closure contains which.
 */
function fromCorners(
    a: { x1: number; x2: number; y1: number; y2: number },
    b: { x1: number; x2: number; y1: number; y2: number },
): number {
    const meet = (p1: number, p2: number, q1: number, q2: number) =>
        Math.max(p1, q1) <= Math.min(p2, q2);
    const overlap = (p1: number, p2: number, q1: number, q2: number) =>
        Math.max(p1, q1) < Math.min(p2, q2);

    if (!meet(a.x1, a.x2, b.x1, b.x2) || !meet(a.y1, a.y2, b.y1, b.y2)) return 0;
    const insideOut = overlap(a.x1, a.x2, b.x1, b.x2) && overlap(a.y1, a.y2, b.y1, b.y2);
    if (!insideOut) return 1;

    const same = a.x1 === b.x1 && a.x2 === b.x2 && a.y1 === b.y1 && a.y2 === b.y2;
    if (same) return 7;

    const aInB = a.x1 >= b.x1 && a.x2 <= b.x2 && a.y1 >= b.y1 && a.y2 <= b.y2;
    const bInA = b.x1 >= a.x1 && b.x2 <= a.x2 && b.y1 >= a.y1 && b.y2 <= a.y2;
    if (aInB) {
        const strict = a.x1 > b.x1 && a.x2 < b.x2 && a.y1 > b.y1 && a.y2 < b.y2;
        return strict ? 4 : 3;
    }
    if (bInA) {
        const strict = b.x1 > a.x1 && b.x2 < a.x2 && b.y1 > a.y1 && b.y2 < a.y2;
        return strict ? 6 : 5;
    }
    return 2;
}

test("the eight relations line up with what two rectangles' corners say", () => {
    /* Every pair of rectangles on a small grid, which covers every relation many
       times over and every near-miss between them. */
    const spans: Array<[number, number]> = [];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b <= 5; b++) spans.push([a, b]);

    let seen = new Set<number>();
    for (const [ax1, ax2] of spans) {
        for (const [ay1, ay2] of spans) {
            for (const [bx1, bx2] of spans) {
                for (const [by1, by2] of spans) {
                    const A = { x1: ax1, x2: ax2, y1: ay1, y2: ay2 };
                    const B = { x1: bx1, x2: bx2, y1: by1, y2: by2 };
                    /* The interval relation on each axis, from the same numbers. */
                    const allen = (p1: number, p2: number, q1: number, q2: number) => {
                        if (p2 < q1) return 0;
                        if (p2 === q1) return 1;
                        if (q2 < p1) return 12;
                        if (q2 === p1) return 11;
                        if (p1 === q1 && p2 === q2) return 6;
                        if (p1 === q1) return p2 < q2 ? 3 : 9;
                        if (p2 === q2) return p1 > q1 ? 5 : 7;
                        if (p1 > q1 && p2 < q2) return 4;
                        if (p1 < q1 && p2 > q2) return 8;
                        return p1 < q1 ? 2 : 10;
                    };
                    const mine = rcc8FromAllen(
                        allen(ax1, ax2, bx1, bx2), allen(ay1, ay2, by1, by2));
                    equal(RCC8_NAMES[mine], RCC8_NAMES[fromCorners(A, B)],
                        `two rectangles are called "${RCC8_NAMES[mine]}" by the axis `
                        + `reading and "${RCC8_NAMES[fromCorners(A, B)]}" by their corners`);
                    seen.add(mine);
                }
            }
        }
    }
    equal([...seen].sort((a, b) => a - b), [...Array(8).keys()],
        "the rectangles do not realise all eight relations, so the restriction has "
        + "dropped one of them");
});

/**
 * And the composition matches RCC8's own.
 *
 * "Apart" composed with "inside, touching the edge" gives, in RCC8 proper, exactly
 * {apart, touching, partly overlapping, inside-edge, deep inside}. That this comes
 * out of a walk over rectangle arrangements is the strongest evidence the mapping
 * is right — it is a fact about the algebra being modelled, not about the model.
 */
test("a known RCC8 composition comes out of the arrangements", () => {
    const { possible } = rcc8Possible(3, [
        { a: 0, b: 1, options: [0] },     // A apart from B
        { a: 1, b: 2, options: [3] },     // B inside C, touching the edge
    ], 0, 2);
    equal(possible.map(r => RCC8_NAMES[r]), [
        RCC8_NAMES[0], RCC8_NAMES[1], RCC8_NAMES[2], RCC8_NAMES[3], RCC8_NAMES[4],
    ], "apart composed with inside-edge is not the set RCC8 gives for it");
});

test("two patches stand in every one of the eight ways, and the converses agree", () => {
    const states = intervalStates(2);
    const seen = new Set<number>();
    for (const alongX of states) {
        for (const alongY of states) {
            const at = { alongX, alongY };
            const r = rcc8Between(at, 0, 1);
            seen.add(r);
            equal(RCC8_NAMES[RCC8_CONVERSE[r]], RCC8_NAMES[rcc8Between(at, 1, 0)],
                `"${RCC8_NAMES[r]}" read the other way round is not `
                + `"${RCC8_NAMES[RCC8_CONVERSE[r]]}"`);
        }
    }
    equal([...seen].sort((a, b) => a - b), [...Array(8).keys()],
        "two patches cannot be arranged every one of the eight ways");
});

/* ------------------------------------------------------------------ *
 * The mode                                                            *
 * ------------------------------------------------------------------ */

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Rcc8];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261501, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 6; rep++) {
                try { out.push(createRcc8(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 10, `only ${out.length} items were built`);
    return out;
}

/** The premises as facts, and the pair asked about. */
function readCard(q: Question) {
    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const said: PatchFact[] = q.premises.map(line => {
        const [a, b] = extractSubjects(line);
        const text = strip(line);
        const options = RCC8_NAMES
            .map((name, r) => (text.includes(name) ? r : -1))
            .filter(r => r >= 0);
        assert(options.length >= 1, `a premise names no relation: ${text}`);
        return { a: at.get(a)!, b: at.get(b)!, options };
    });
    const asked = extractSubjects(q.setup[1]);
    equal(asked.length, 2, `the setup does not name one pair: ${strip(q.setup[1])}`);
    return { said, x: at.get(asked[0])!, y: at.get(asked[1])! };
}

test("all eight are offered, in order, each saying what it means", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        equal(q.choices.length, 8,
            "the options are a shortlist, which answers the question — the eight are "
            + "the answer space");
        q.choices.forEach((c, r) => {
            assert(strip(c).includes(RCC8_NAMES[r]),
                `option ${r} is not "${RCC8_NAMES[r]}", so the ladder is out of order`);
            assert(strip(c).includes(RCC8_DEFINITIONS[r]),
                `"${RCC8_NAMES[r]}" is offered without saying what it means`);
        });
    }
});

test("the premises never speak about the pair asked about", () => {
    for (const q of items()) {
        const { said, x, y } = readCard(q);
        equal(said.length, 2, `${said.length} premises — three patches leave two pairs`);
        for (const f of said) {
            assert(!((f.a === x && f.b === y) || (f.a === y && f.b === x)),
                "a premise states the relation between the very pair asked about");
        }
    }
});

test("the marked set is exactly what the arrangements allow", () => {
    for (const q of items()) {
        const { said, x, y } = readCard(q);
        const { possible } = rcc8Possible(q.bucket.length, said, x, y);
        equal(q.selectAnswer.slice().sort((a, b) => a - b), possible,
            "the marked relations are not exactly the ones some arrangement allowed by "
            + "the premises realises");
        assert(possible.length < 8,
            "every relation is still possible, so the card is answered by selecting all "
            + "eight without reading a premise");
    }
});

/**
 * A premise naming two relations has to leave more open than one naming one.
 *
 * Above the floor the mode widens its premises instead of growing its card, so the
 * ladder's larger number buys a wider reading — and if the wider premise left the
 * answer where the narrow one did, it bought nothing and the number overstates the
 * item.
 */
test("a disjunctive premise leaves more open than the exact one would", () => {
    for (const q of items()) {
        const { said, x, y } = readCard(q);
        const loose = said.filter(f => f.options.length > 1);
        if (!loose.length) continue;

        const answer = q.selectAnswer.slice().sort((a, b) => a - b);
        /* Narrowed to each single branch in turn: at least one has to give a
           smaller set, or the extra branch changed nothing. */
        const narrowed = loose.flatMap(f => f.options.map(only =>
            rcc8Possible(q.bucket.length,
                said.map(g => (g === f ? { ...g, options: [only] } : g)), x, y).possible));
        assert(narrowed.some(set => set.length < answer.length),
            "widening the premise left the answer exactly where an exact premise would, "
            + "so the disjunction is decoration");
    }
});
