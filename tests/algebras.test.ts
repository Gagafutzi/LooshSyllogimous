/**
 * Oblique Basis and Pivot Transforms — recomputed from the cards.
 *
 * Both are arithmetic modes, and both make one claim that is about the *item*
 * rather than about the answer. Oblique Basis says the chain's sum is not any
 * single word of its codex — otherwise one premise and a lookup answers it, with
 * nothing added. Pivot Transforms says the move matters: the answer has to differ
 * from what a reader who never applied it would reach, or the mode's whole point
 * is optional.
 *
 * Both are checked by rebuilding the arithmetic out of the card: the codex gives
 * the vectors, the premises say which word each step used, the move line says what
 * happened and to what. Nothing is taken from the generators.
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
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createObliqueBasis } from "../src/app/syllogimous/generators/oblique-basis";
import { createPivotTransforms } from "../src/app/syllogimous/generators/pivot-transforms";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

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

function itemsOf(
    type: EnumQuestionType,
    make: (c: GeneratorContext, n: number) => Question,
    seed: number,
): Question[] {
    const ctx = context();
    const range = QUESTION_TYPE_SETTING_PARAMS[type];
    const out: Question[] = [];
    seeded(seed, () => {
        for (let n = range.minNumOfPremises; n <= range.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(make(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `${type}: only ${out.length} items were built`);
    return out;
}

/**
 * Clause to value, per axis — the same conversion the analogy tests need.
 *
 * The clauses are not interchangeable between axes, so a pattern can only be read
 * as numbers with a table built from the axes it was rendered against. Rebuilt the
 * way the generators build them, which is sound because the context overrides
 * nothing.
 */
function clauseTable(dims: number) {
    const axes: AxisSpec[] = axesForDimensions(dims).map(scale => ({ scale }));
    const row = (v: number) =>
        strip(renderNdPattern(axes, Array(dims).fill(v))).split(", ").map(s => s.trim());
    const [minus, zero, plus] = [row(-1), row(0), row(1)];
    return [...Array(dims).keys()].map(i => ({ [minus[i]]: -1, [zero[i]]: 0, [plus[i]]: 1 }));
}

function toVector(pattern: string, table: Array<Record<string, number>>): number[] {
    const parts = strip(pattern).split(", ").map(s => s.trim()).filter(Boolean);
    equal(parts.length, table.length, `"${strip(pattern)}" is not ${table.length} directions`);
    return parts.map((clause, i) => {
        const v = table[i][clause];
        assert(v !== undefined, `"${clause}" is not a value the ${i}th axis can show`);
        return v;
    });
}

/* ------------------------------------------------------------------ *
 * Oblique Basis                                                       *
 * ------------------------------------------------------------------ */

const obliqueItems = () =>
    itemsOf(EnumQuestionType.ObliqueBasis, createObliqueBasis, 20261301);

/** The codex as word to step, and which word each premise used. */
function readOblique(q: Question) {
    const codex = new Map<string, string>();
    for (const line of q.setup.slice(1)) {
        const m = strip(line).match(/^One (\S+) is (.+)\.$/);
        assert(!!m, `a codex line does not define a word: ${strip(line)}`);
        codex.set(m![1], m![2]);
    }
    assert(codex.size >= 3, `the codex defines ${codex.size} words, which is too few`);

    const dims = strip(q.choices[0]).split(", ").length;
    const table = clauseTable(dims);
    const steps = new Map([...codex].map(([w, p]) => [w, toVector(p, table)]));

    const used = q.premises.map(line => {
        const m = strip(line).match(/ is one (\S+) from /);
        assert(!!m, `a premise does not use a codex word: ${strip(line)}`);
        assert(steps.has(m![1]), `${m![1]} is used and not in the codex`);
        return m![1];
    });
    return { steps, used, table, dims };
}

test("every codex word moves exactly two directions, and all of them are used", () => {
    for (const q of obliqueItems()) {
        const { steps, used } = readOblique(q);
        for (const [word, step] of steps) {
            equal(step.filter(v => v !== 0).length, 2,
                `${word} moves ${step.filter(v => v !== 0).length} directions — one is an `
                + "axis, and three leaves a word the codex's others cannot check");
        }
        equal(new Set(used).size, steps.size,
            "the codex explains a word the chain never uses, so the reader learns to "
            + "skip it");
        assert(used.length >= 3,
            `the chain is ${used.length} steps, which is a lookup rather than a sum`);
    }
});

test("the answer is the words of the chain added up", () => {
    for (const q of obliqueItems()) {
        const { steps, used, table, dims } = readOblique(q);
        const total = used.reduce(
            (sum, w) => sum.map((v, i) => v + steps.get(w)![i]),
            Array(dims).fill(0) as number[]);
        equal(toVector(q.choices[q.correctChoice], table), total.map(sign),
            "the marked answer is not the chain's words added together");
    }
});

/**
 * And the sum is not one of the codex's own entries.
 *
 * Otherwise a reader who read a single premise and looked its word up has the
 * answer, which is the one thing a mode about adding cannot allow.
 */
test("the answer is never a single codex entry", () => {
    for (const q of obliqueItems()) {
        const { steps, table } = readOblique(q);
        const answer = toVector(q.choices[q.correctChoice], table).join(",");
        for (const [word, step] of steps) {
            assert(step.map(sign).join(",") !== answer,
                `the answer is exactly what one ${word} does, so one premise and a `
                + "lookup gives it without anything being added");
        }
    }
});

test("the two candidates differ on exactly one direction", () => {
    for (const q of obliqueItems()) {
        const { table } = readOblique(q);
        equal(q.choices.length, 2, "the item does not offer two candidates");
        const a = toVector(q.choices[0], table);
        const b = toVector(q.choices[1], table);
        equal(a.filter((v, i) => v !== b[i]).length, 1,
            "the candidates differ on more than one direction, so one can be dismissed "
            + "without the sum being worked out");
    }
});

/* ------------------------------------------------------------------ *
 * Pivot Transforms                                                    *
 * ------------------------------------------------------------------ */

const pivotItems = () =>
    itemsOf(EnumQuestionType.PivotTransforms, createPivotTransforms, 20261302);

/**
 * The card as two phases and the move between them.
 *
 * The move is found by its own-rule key rather than by its wording, so the parse
 * does not depend on prose that the symbol switch rewrites.
 */
function readPivot(q: Question) {
    const at = q.premises.findIndex(l => /own--pv-(mirror|turn)/.test(l));
    assert(at > 0, "the card has no move line, or it comes before any placement");
    assert(at < q.premises.length - 1, "nothing is placed after the move");
    const only = q.premises.filter(l => /own--pv-(mirror|turn)/.test(l)).length;
    equal(only, 1, `${only} move lines — the mode states one`);

    const kind = /own--pv-mirror/.test(q.premises[at]) ? "mirror" : "turn";
    const pivot = extractSubjects(q.premises[at])[0];
    assert(!!pivot, "the move line does not name a pivot");

    const dims = strip(q.choices[0]).split(", ").length;
    const table = clauseTable(dims);

    /** "A is <pattern> relative to B" */
    const parse = (line: string) => {
        const [a, b] = extractSubjects(line);
        const text = strip(line);
        const from = text.indexOf(" is ") + 4;
        const to = text.indexOf(" relative to ");
        assert(from > 3 && to > from, `not a placement: ${text}`);
        return { a, b, delta: toVector(text.slice(from, to), table) };
    };

    return {
        kind, pivot, dims, table,
        early: q.premises.slice(0, at).map(parse),
        late: q.premises.slice(at + 1).map(parse),
        moveLine: q.premises[at],
    };
}

test("Pivot Transforms states one move, with placements either side of it", () => {
    for (const q of pivotItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        const { early, late } = readPivot(q);
        assert(early.length >= 3,
            `${early.length} placements before the move, which is too few to be worth `
            + "carrying through it");
        assert(late.length >= 2,
            `${late.length} placements after the move, so the new positions are asserted `
            + "rather than described");
    }
});

/**
 * The answer is what the move leaves, and the other candidate is what ignoring it
 * leaves — which is the pair the card's own derivation claims.
 *
 * Rebuilt from the text: the early placements fix a layout, the move acts on all
 * of it, the late placements hang off the result. A reader who never applied the
 * move would place the early entity where it started, and that is the other
 * option — so the item cannot be passed by skipping the move, and cannot be
 * failed by applying it.
 */
test("Pivot Transforms marks the carried answer and offers the uncarried one", () => {
    for (const q of pivotItems()) {
        const { kind, pivot, dims, table, early, late } = readPivot(q);

        /* The early layout, from whichever placement can be anchored next. */
        const place = new Map<string, number[]>();
        place.set(early[0].b, Array(dims).fill(0));
        for (let pass = 0; pass < early.length + 1; pass++) {
            for (const p of early) {
                if (place.has(p.b) && !place.has(p.a)) {
                    place.set(p.a, place.get(p.b)!.map((v, i) => v + p.delta[i]));
                } else if (place.has(p.a) && !place.has(p.b)) {
                    place.set(p.b, place.get(p.a)!.map((v, i) => v - p.delta[i]));
                }
            }
        }
        assert(place.has(pivot), "the pivot is not placed by the early premises");

        const pivotAt = place.get(pivot)!;
        /* The plane a quarter turn happens in, read off the move line's own
           clauses — two directions named, each one axis's positive word. */
        const plane: number[] = [];
        if (kind === "turn") {
            const named = strip(q.premises[q.premises.findIndex(
                l => /own--pv-turn/.test(l))]);
            for (let i = 0; i < dims; i++) {
                const word = Object.keys(table[i]).find(k => table[i][k] === 1)!;
                if (new RegExp(`\\b${word}\\b`).test(named.split(" in ")[1] ?? "")) plane.push(i);
            }
            equal(plane.length, 2,
                `the turn names ${plane.length} directions for its plane, not two`);
        }

        const apply = (p: number[]) => {
            if (kind === "mirror") return p.map((v, i) => 2 * pivotAt[i] - v);
            const out = [...p];
            const [i, j] = plane;
            const di = p[i] - pivotAt[i], dj = p[j] - pivotAt[j];
            out[i] = pivotAt[i] - dj;
            out[j] = pivotAt[j] + di;
            return out;
        };

        const moved = new Map<string, number[]>();
        for (const [w, p] of place) moved.set(w, apply(p));
        for (let pass = 0; pass < late.length + 1; pass++) {
            for (const p of late) {
                if (moved.has(p.b) && !moved.has(p.a)) {
                    moved.set(p.a, moved.get(p.b)!.map((v, i) => v + p.delta[i]));
                }
            }
        }

        const asked = extractSubjects(q.choicePrompt.replace(/^[^A-Z]*/, ""));
        /* The prompt is plain text, so the two names are read from the setup's
           own wording instead when it carries no subject spans. */
        const [to, from] = asked.length === 2
            ? asked
            : (() => {
                const m = q.choicePrompt.match(/how does (\S+) stand to (\S+)\?$/i);
                assert(!!m, `the prompt does not name two things: ${q.choicePrompt}`);
                return [m![1], m![2]];
            })();

        assert(moved.has(to) && moved.has(from) && place.has(from),
            "the two things asked about cannot both be placed from the card");

        const carried = moved.get(to)!.map((v, i) => sign(v - moved.get(from)![i]));
        const naive = moved.get(to)!.map((v, i) => sign(v - place.get(from)![i]));

        equal(toVector(q.choices[q.correctChoice], table), carried,
            "the marked answer is not what the move leaves");
        equal(toVector(q.choices[1 - q.correctChoice], table), naive,
            "the other candidate is not what ignoring the move leaves, so the item does "
            + "not punish the mistake it exists for");
        assert(carried.join(",") !== naive.join(","),
            "carrying the placement through the move changes nothing, so the move is "
            + "decoration and the item passes without it");
    }
});
