/**
 * Context Shifts and Cross-System Analogy — the last two, recomputed from the card.
 *
 * Each rests on one claim that is about the *item* rather than the answer, and each
 * claim is the reason the mode exists.
 *
 * Context Shifts says the order of the operations matters. A card whose operations
 * commuted would be teaching that a sequence is a set, which is the opposite of the
 * lesson — so every item is re-run with its last two operations swapped and the
 * answer required to change.
 *
 * Cross-System Analogy says the correspondences pin the dictionary, and only they
 * do. If two readings of the second group's words fitted, the card has two
 * defensible answers; if the answer's own counterpart were stated, no dictionary is
 * needed and the mode is a lookup. Both are checked by trying every signed
 * permutation of the axes against the card's own pairings.
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
import { permutations } from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createContextShifts } from "../src/app/syllogimous/generators/context-shifts";
import { createCrossAnalogy } from "../src/app/syllogimous/generators/cross-analogy";

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
            for (let rep = 0; rep < 10; rep++) {
                try { out.push(make(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `${type}: only ${out.length} items were built`);
    return out;
}

/** Clause to value, per axis — the conversion every pattern check needs. */
function clauseTable(dims: number) {
    const axes: AxisSpec[] = axesForDimensions(dims).map(scale => ({ scale }));
    const row = (v: number) =>
        strip(renderNdPattern(axes, Array(dims).fill(v))).split(", ").map(s => s.trim());
    const [minus, zero, plus] = [row(-1), row(0), row(1)];
    return [...Array(dims).keys()].map(i => ({ [minus[i]]: -1, [zero[i]]: 0, [plus[i]]: 1 }));
}

const toVector = (pattern: string, table: Array<Record<string, number>>) => {
    const parts = strip(pattern).split(", ").map(s => s.trim()).filter(Boolean);
    equal(parts.length, table.length, `"${strip(pattern)}" is not ${table.length} directions`);
    return parts.map((clause, i) => {
        const v = table[i][clause];
        assert(v !== undefined, `"${clause}" is not a value the ${i}th axis can show`);
        return v;
    });
};

/* ------------------------------------------------------------------ *
 * Context Shifts                                                      *
 * ------------------------------------------------------------------ */

const shiftItems = () =>
    itemsOf(EnumQuestionType.ContextShifts, createContextShifts, 20261401);

/** The context definitions, in the order the card states them. */
const definitionsOf = (q: Question) =>
    q.premises.filter(l => /^Context [A-F] /.test(strip(l)));

test("Context Shifts defines its contexts in order, each from the one before", () => {
    for (const q of shiftItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        const defs = definitionsOf(q).map(strip);
        assert(defs.length >= 4,
            `${defs.length} contexts — two base relations and at least two operations`);

        /* Named A, B, C… in order, and the two bases come first. */
        defs.forEach((line, i) => {
            const letter = String.fromCharCode("A".charCodeAt(0) + i);
            assert(line.startsWith(`Context ${letter} `),
                `the ${i}th definition is not context ${letter}: ${line}`);
        });
        for (const base of defs.slice(0, 2)) {
            assert(/ is how .* stands to /.test(base),
                `a base context is not a relation between two entities: ${base}`);
        }
        /* Every operation names the context directly before it, so the chain is a
           chain and not a set of instructions about one value. */
        defs.slice(2).forEach((line, i) => {
            const from = String.fromCharCode("A".charCodeAt(0) + 1 + i);
            assert(new RegExp(`context ${from}\\b`).test(line),
                `an operation does not build on context ${from}: ${line}`);
        });
        assert(q.choicePrompt.includes(
            String.fromCharCode("A".charCodeAt(0) + defs.length - 1)),
            "the question is not about the last context defined");
    }
});

/**
 * Order matters, checked on the card by re-running it the other way.
 *
 * The derivation prints the running value after each operation and, last, what the
 * final two would have given in the other order. Both are read here: the printed
 * chain has to end at the marked answer, and the swapped result has to differ from
 * it. An item where they agreed would present a sequence whose sequence is
 * decoration, which is the one thing this mode cannot be.
 */
test("Context Shifts is an item where the order of the operations changes the answer", () => {
    for (const q of shiftItems()) {
        const dims = strip(q.choices[0]).split(", ").length;
        const table = clauseTable(dims);
        const answer = toVector(q.choices[q.correctChoice], table);

        /*
         * The running-value lines only.
         *
         * Filtering on ", which is " also caught the closing line — "…, which is
         * why the order is the answer" — and reading the chain's end off that gave
         * a sentence where a pattern was expected. The operation lines all begin
         * "context X", so that is what identifies them.
         */
        const steps = q.explanation.filter(l =>
            /^context [A-F] /.test(strip(l)) && /, which is /.test(strip(l)));
        assert(steps.length >= 2, "the derivation does not print the running value");
        const last = strip(steps[steps.length - 1]);
        equal(toVector(last.slice(last.lastIndexOf(", which is ") + 11), table), answer,
            "the derivation's chain does not end at the marked answer");

        /*
         * Every operation moves the value.
         *
         * An operation that leaves the running context where it was is a line the
         * reader can skip, and a mode about carrying a value through a chain cannot
         * afford one — skipping is the habit it exists to prevent. Read off the
         * derivation, which prints the value after each step.
         */
        const running = steps.map(l => {
            const text = strip(l);
            return toVector(text.slice(text.lastIndexOf(", which is ") + 11), table);
        });
        const walk = [toVector(q.explanation[0].replace(/, worked out.*$/, "")
            .replace(/^[^]*?\bis\b /, ""), table), ...running];
        for (let i = 1; i < walk.length; i++) {
            assert(walk[i].join(",") !== walk[i - 1].join(","),
                `operation ${i} leaves the context exactly where it was, so its line can `
                + "be skipped");
        }

        const other = q.explanation.find(l => /in the other order/.test(strip(l)));
        assert(!!other, "the derivation does not say what the other order gives");
        const text = strip(other!);
        const m = text.match(/would give (.+?), which is why/);
        assert(!!m, `the other-order line does not name a result: ${text}`);
        const swapped = toVector(m![1], table);
        assert(swapped.join(",") !== answer.join(","),
            "the last two operations commute on this item, so its order is decoration");
    }
});

test("Context Shifts offers two candidates one direction apart", () => {
    for (const q of shiftItems()) {
        equal(q.choices.length, 2, "the item does not offer two candidates");
        const table = clauseTable(strip(q.choices[0]).split(", ").length);
        const a = toVector(q.choices[0], table);
        const b = toVector(q.choices[1], table);
        equal(a.filter((v, i) => v !== b[i]).length, 1,
            "the candidates differ on more than one direction, so one can be dismissed "
            + "without the chain being carried through");
    }
});

/* ------------------------------------------------------------------ *
 * Cross-System Analogy                                               *
 * ------------------------------------------------------------------ */

const crossItems = () =>
    itemsOf(EnumQuestionType.CrossAnalogy, createCrossAnalogy, 20261402);

/** Every signed permutation of the axes — every dictionary there could be. */
function allDictionaries(dims: number) {
    const out: Array<{ axis: number[]; flip: number[] }> = [];
    for (const axis of permutations(dims)) {
        for (let mask = 0; mask < (1 << dims); mask++) {
            out.push({ axis, flip: [...Array(dims).keys()].map(k => (mask & (1 << k) ? -1 : 1)) });
        }
    }
    return out;
}

/**
 * The card as: our arrangement, their arrangement in their words, the pairings.
 *
 * Their premises are told apart from ours by carrying none of our direction words —
 * which is exactly the property the mode rests on, so failing to parse one is a
 * finding rather than an inconvenience.
 */
function readCross(q: Question) {
    const pairings = q.premises
        .filter(l => /own--xa-counterpart/.test(l))
        .map(l => extractSubjects(l) as [string, string]);
    assert(pairings.length >= 2,
        `${pairings.length} pairings — a single one is satisfied by every dictionary`);

    const vocab = extractSubjects(q.setup[0]).length
        ? []
        : [];
    /* Their words are named in the setup between the dashes. */
    const named = strip(q.setup[0]);
    const words = named.slice(named.indexOf("—") + 1, named.lastIndexOf("—"))
        .split(",").map(s => s.trim()).filter(Boolean);
    assert(words.length >= 2, `the setup does not name their words: ${named}`);

    const dims = words.length;
    const table = clauseTable(dims);

    const ourLines = q.premises.filter(l => / relative to /.test(l)
        && !words.some(w => new RegExp(`\\b${w}\\b`).test(strip(l))));
    const theirLines = q.premises.filter(l => / relative to /.test(l)
        && words.some(w => new RegExp(`\\b${w}\\b`).test(strip(l))));
    assert(ourLines.length >= 3 && theirLines.length >= 3,
        `${ourLines.length} of ours and ${theirLines.length} of theirs — one side did `
        + "not parse, which means their words leaked into our premises or the reverse");

    /** Positions from a set of "A is <pattern> relative to B" lines. */
    const solve = (lines: string[], read: (line: string) => number[]) => {
        const at = new Map<string, number[]>();
        const parsed = lines.map(l => {
            const [a, b] = extractSubjects(l);
            return { a, b, delta: read(l) };
        });
        at.set(parsed[0].b, Array(dims).fill(0));
        for (let pass = 0; pass < parsed.length + 1; pass++) {
            for (const p of parsed) {
                if (at.has(p.b) && !at.has(p.a)) {
                    at.set(p.a, at.get(p.b)!.map((v, i) => v + p.delta[i]));
                } else if (at.has(p.a) && !at.has(p.b)) {
                    at.set(p.b, at.get(p.a)!.map((v, i) => v - p.delta[i]));
                }
            }
        }
        return at;
    };

    const ourDelta = (line: string) => {
        const text = strip(line);
        return toVector(text.slice(text.indexOf(" is ") + 4, text.indexOf(" relative to ")),
            table);
    };
    /* Their clauses are their own words, so they read as signs directly. */
    const theirDelta = (line: string) => {
        const text = strip(line);
        const said = text.slice(text.indexOf(" is ") + 4, text.indexOf(" relative to "))
            .split(",").map(s => s.trim());
        equal(said.length, dims, `their premise names ${said.length} directions: ${text}`);
        return words.map(w => {
            const clause = said.find(c => c.includes(w));
            assert(!!clause, `their premise says nothing about ${w}: ${text}`);
            if (/^level on/.test(clause!)) return 0;
            return /^counter-/.test(clause!) ? -1 : 1;
        });
    };

    return {
        words, dims, table, pairings,
        ours: solve(ourLines, ourDelta),
        theirs: solve(theirLines, theirDelta),
    };
}

test("Cross-System Analogy's pairings pin exactly one dictionary", () => {
    for (const q of crossItems()) {
        const { dims, pairings, ours, theirs } = readCross(q);
        for (const [mine, yours] of pairings) {
            assert(ours.has(mine) && theirs.has(yours),
                `${mine} and ${yours} are paired and at least one is not placed`);
        }

        const [anchorMine, anchorYours] = pairings[0];
        const fits = allDictionaries(dims).filter(d =>
            pairings.slice(1).every(([mine, yours]) => {
                const mineDelta = ours.get(mine)!.map((v, i) => v - ours.get(anchorMine)![i]);
                const yourDelta = theirs.get(yours)!.map(
                    (v, i) => v - theirs.get(anchorYours)![i]);
                return d.axis.map((a, k) => d.flip[k] * mineDelta[a])
                    .every((v, k) => sign(v) === sign(yourDelta[k]));
            }));
        equal(fits.length, 1,
            `${fits.length} readings of their words agree with the pairings, and the card `
            + "says the pairings fix one");
    }
});

/**
 * And the answer is not simply one of the pairings read off.
 *
 * If the entity asked about, or the one that answers, had its counterpart stated,
 * the dictionary would be unnecessary — the mode would be a lookup wearing two
 * vocabularies.
 */
test("Cross-System Analogy never states the counterpart of the answer", () => {
    for (const q of crossItems()) {
        const { pairings } = readCross(q);
        const stated = new Set(pairings.flat());
        const answer = strip(q.choices[q.correctChoice]).trim();
        assert(!stated.has(answer),
            `${answer} answers the analogy and its counterpart is stated, so no `
            + "dictionary is needed to find it");

        const asked = q.premises[q.premises.length - 1];
        const named = extractSubjects(asked);
        equal(named.length, 3, `the analogy line names ${named.length} entities`);
        assert(!stated.has(named[2]),
            `${named[2]} is where the analogy lands from and its counterpart is stated`);
    }
});
