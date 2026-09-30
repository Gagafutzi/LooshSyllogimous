/**
 * Partial Analogy and Second-Order — the two imported analogy modes.
 *
 * Both make a claim about a *best* or a *unique* thing, which is the kind of
 * claim a generator can get wrong while every visible part of the item stays
 * plausible. Partial Analogy says one correspondence keeps more relations than
 * any other; Second-Order says one change in its catalogue relates the example's
 * two relations. Where either is false the card marks one of several right
 * answers wrong, and nothing on it looks amiss.
 *
 * So both are recomputed from the card. Partial Analogy's correspondence is
 * re-derived by trying all of them against webs rebuilt from the premises;
 * Second-Order's relations are read out of its own derivation, which is what the
 * player is shown and therefore what has to be true.
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
import { permutations } from "../src/app/syllogimous/utils/relation-systems.utils";
import {
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { Web, emptyWeb } from "../src/app/syllogimous/utils/web.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createPartialAnalogy } from "../src/app/syllogimous/generators/partial-analogy";
import { createSecondOrder } from "../src/app/syllogimous/generators/second-order";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/**
 * The value, or a failure naming what was missing.
 *
 * `assert` is a plain function, so it does not narrow a nullable type for the
 * compiler — and writing `!` instead would turn a derivation that stopped
 * printing what this reads into a crash rather than into a named failure.
 */
function must<T>(value: T | null | undefined, why: string): T {
    assert(value !== null && value !== undefined, why);
    return value as T;
}

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

/* ------------------------------------------------------------------ *
 * Partial Analogy                                                     *
 * ------------------------------------------------------------------ */

const partialItems = () =>
    itemsOf(EnumQuestionType.PartialAnalogy, createPartialAnalogy, 20261201);

/**
 * The card as two webs and a kind pairing, told apart by the premise's wording.
 *
 * Arrow premises and kind premises use different relations, so which is which is
 * read off the sentence rather than off the order they were written in — a card
 * whose premises were scrambled together still parses.
 */
function readPartial(q: Question) {
    const arrows: Array<[string, string]> = [];
    const kinds: Array<[string, string]> = [];
    for (const line of q.premises) {
        const [a, b] = extractSubjects(line);
        assert(!!a && !!b, `a premise does not name two things: ${strip(line)}`);
        (/same kind|≐/.test(strip(line)) ? kinds : arrows).push([a, b]);
    }

    /* The two systems are the two sides of the kind pairing, which covers
       everybody exactly once — that is what makes it a plausible rival answer. */
    const left = kinds.map(([a]) => a);
    const right = kinds.map(([, b]) => b);
    equal(new Set(left).size, left.length, "the kind pairing names an entity twice on the left");
    equal(new Set(right).size, right.length, "the kind pairing names an entity twice on the right");
    equal(new Set([...left, ...right]).size, q.bucket.length,
        "the kind pairing does not cover every entity exactly once, so it is not a "
        + "rival correspondence but a hint");

    const webFor = (names: string[]) => {
        const at = new Map(names.map((w, i) => [w, i]));
        const w = emptyWeb(names.length);
        for (const [a, b] of arrows) {
            const i = at.get(a), j = at.get(b);
            if (i !== undefined && j !== undefined) w.adj[i][j] = true;
        }
        return w;
    };
    return { left, right, a: webFor(left), b: webFor(right), kinds };
}

const agreement = (a: Web, b: Web, perm: number[]) => {
    let kept = 0;
    for (let i = 0; i < a.n; i++) {
        for (let j = 0; j < a.n; j++) {
            if (i === j) continue;
            if (a.adj[i][j] === b.adj[perm[i]][perm[j]]) kept++;
        }
    }
    return kept;
};

test("Partial Analogy offers the best correspondence and the kind pairing", () => {
    for (const q of partialItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 2, `${q.choices.length} options, not two`);

        const { left, right, kinds } = readPartial(q);
        const asked = extractSubjects(q.setup[1])[0];
        assert(left.includes(asked),
            "the entity asked about is not in the first system");

        const options = q.choices.map(c => strip(c).trim());
        for (const o of options) {
            assert(right.includes(o), `${o} is offered and is not in the second system`);
        }
        const lure = kinds.find(([a]) => a === asked)![1];
        assert(options.includes(lure),
            "the entity of the same kind is not offered, so there is no lure");
        assert(options[q.correctChoice] !== lure,
            "the item marks the entity of the same kind, which the setup says counts "
            + "for nothing");
    }
});

/**
 * **The floor is a smaller system than the ceiling.**
 *
 * Five a side was fixed, and it made this mode's easiest item a card of two
 * systems plus a complete kind pairing — sixteen and a half statements, while the
 * ladder said six. Four a side at the floor is fourteen, and it draws a
 * well-formed item about as often.
 *
 * Asserted as a step rather than as the number four, so the check is about the
 * mode having a bottom rather than about a constant. It is read off the card —
 * the entities of the first system are however many names its arrows use — which
 * is also what a player would count.
 */
test("Partial Analogy's floor is fewer entities a side than its ceiling", () => {
    const ctx = context();
    const range = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.PartialAnalogy];
    const sides = new Map<number, Set<number>>();

    seeded(20261203, () => {
        for (let n = range.minNumOfPremises; n <= range.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 8; rep++) {
                let q: Question;
                try { q = createPartialAnalogy(ctx, n); } catch { continue; }
                const held = sides.get(n) ?? new Set<number>();
                held.add(readPartial(q).left.length);
                sides.set(n, held);
            }
        }
    });

    const rungs = [...sides.entries()].sort((a, b) => a[0] - b[0]);
    assert(rungs.length >= 2, "not enough rungs built to compare");
    for (const [n, held] of rungs) {
        equal(held.size, 1,
            `${n} premises gave systems of ${[...held].join(" and ")} a side — the size `
            + "is a function of the rung, so it cannot vary within one");
    }

    const floor = [...rungs[0][1]][0];
    const ceiling = [...rungs[rungs.length - 1][1]][0];
    assert(floor < ceiling,
        `every rung is ${floor} entities a side, so the easiest item of this mode is `
        + "its hardest and there is no bottom step");
});

/**
 * One correspondence keeps more than every other, and it is the marked one.
 *
 * Re-derived by trying all of them. "The correspondence that keeps the most" is
 * printed on the card, so a tie makes the card's own wording name two answers —
 * and a tie is the common accident here, not the rare one, since the systems are
 * built to be nearly alike.
 */
test("Partial Analogy's best correspondence is unique and is the one marked", () => {
    for (const q of partialItems()) {
        const { left, right, a, b } = readPartial(q);
        const asked = extractSubjects(q.setup[1])[0];

        let best = -1;
        let winners: number[][] = [];
        for (const perm of permutations(a.n)) {
            const kept = agreement(a, b, perm);
            if (kept > best) { best = kept; winners = [perm]; }
            else if (kept === best) winners.push(perm);
        }
        equal(winners.length, 1,
            `${winners.length} correspondences keep ${best} relations each, and the card `
            + "says one keeps the most");
        assert(best < a.n * (a.n - 1),
            "the best correspondence keeps everything, so the two systems are the same "
            + "and the analogy is not partial");

        const marked = strip(q.choices[q.correctChoice]).trim();
        equal(right[winners[0][left.indexOf(asked)]], marked,
            "the entity the item marks is not where the best correspondence sends the "
            + "one asked about");
    }
});

/* ------------------------------------------------------------------ *
 * Second-Order                                                        *
 * ------------------------------------------------------------------ */

const secondItems = () => itemsOf(EnumQuestionType.SecondOrder, createSecondOrder, 20261202);

/**
 * One axis pattern out of a derivation line, by the phrase that introduces it.
 *
 * Written per line rather than as one splitter. A generic parse of "the patterns
 * in this sentence" read the wrong half of two of these four lines and reported
 * a missing derivation — the lines genuinely differ, so what each says is worth
 * naming here instead of guessed at.
 */
function patternAfter(line: string, marker: string): string[] | null {
    const text = strip(line);
    const at = text.indexOf(marker);
    if (at < 0) return null;
    return text.slice(at + marker.length)
        .replace(/,? (?:which is that with|so the same change makes it|from it) .*$/, "")
        .replace(/ — .*$/, "")
        .split(", ")
        .map(s => s.trim())
        .filter(Boolean);
}

test("Second-Order asks about four distinct names, so nothing answers itself", () => {
    for (const q of secondItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 2, `${q.choices.length} options, not two`);

        /* The last premise is the question: "A to B is the same relation as C to ?" */
        const question = q.premises[q.premises.length - 1];
        const named = extractSubjects(question);
        equal(named.length, 3,
            `the asked line names ${named.length} entities, not three and a gap`);

        const answer = strip(q.choices[q.correctChoice]).trim();
        equal(new Set([...named, answer]).size, 4,
            "the answer is a name already on the asked line, so the item is solved by "
            + "swapping two of them rather than by composing anything");
    }
});

/**
 * Per-axis clause to number, so the change can be checked as arithmetic.
 *
 * Needed because the clauses are *not* interchangeable between axes: axis 0's
 * `+1` reads "east" and axis 1's reads "north", so exchanging the two axes'
 * values does not reshuffle the words — it produces words neither axis showed
 * before. An earlier version of this test assumed otherwise and asserted that an
 * exchange leaves the multiset of clauses alone, which is false of every item the
 * mode builds. Converting to numbers first makes the assertion about the
 * operation rather than about the prose.
 *
 * The axes are rebuilt the way the generator builds them: the context above
 * overrides nothing, so both take the preset for this many dimensions.
 */
function clauseValues(dims: number): Array<Record<string, number>> {
    const axes: AxisSpec[] = axesForDimensions(dims).map(scale => ({ scale }));
    const row = (v: number) =>
        strip(renderNdPattern(axes, Array(dims).fill(v))).split(", ").map(s => s.trim());
    const [minus, zero, plus] = [row(-1), row(0), row(1)];
    return [...Array(dims).keys()].map(i =>
        ({ [minus[i]]: -1, [zero[i]]: 0, [plus[i]]: 1 }));
}

const asNumbers = (pattern: string[], table: Array<Record<string, number>>) =>
    pattern.map((clause, i) => {
        const v = table[i][clause];
        assert(v !== undefined,
            `"${clause}" is not a value the ${i}th axis can show`);
        return v;
    });

/**
 * The change the card claims is the change the example shows.
 *
 * Read off the derivation, which prints both of the example's relations and names
 * the change between them — then checked as arithmetic on the axis values. A
 * reversal must negate every axis; an exchange must leave the values alone as a
 * multiset while moving exactly two of them. Neither is checkable from the words,
 * which is the whole reason for the conversion above.
 */
test("Second-Order's example really shows the change it names", () => {
    for (const q of secondItems()) {
        const first = must(patternAfter(q.explanation[0], " is "),
            "the derivation does not print the example's first relation");
        const second = must(patternAfter(q.explanation[1], " is "),
            "the derivation does not print the example's second relation");
        equal(first.length, second.length, "the two relations are on different axes");

        const named = strip(q.explanation[1]);
        const reversed = /every direction reversed/.test(named);
        const exchanged = /directions exchanged/.test(named);
        assert(reversed !== exchanged,
            `the derivation names neither change or both: ${named}`);

        const table = clauseValues(first.length);
        const a = asNumbers(first, table);
        const b = asNumbers(second, table);

        if (reversed) {
            equal(b, a.map(v => -v),
                "the change is called a reversal and is not the negation of the first "
                + "relation on every axis");
        } else {
            equal([...b].sort(), [...a].sort(),
                "the change is called an exchange and the two relations do not carry the "
                + "same values between them");
            const moved = a.filter((v, i) => v !== b[i]).length;
            equal(moved, 2,
                `an exchange should move exactly two axes, this moved ${moved}`);
        }

        /*
         * And only one change in the catalogue fits, or the reader cannot tell
         * which to apply next.
         *
         * The card names the catalogue — reversed, or two directions exchanged —
         * precisely so the change is identifiable from one example. Where two
         * members of it map the first relation to the second, the example pins
         * nothing and the item has two defensible answers; and it would still
         * pass the checks above, because the change the card *named* does fit.
         */
        const catalogue: Array<(v: number[]) => number[]> = [v => v.map(x => -x)];
        for (let i = 0; i < a.length; i++) {
            for (let j = i + 1; j < a.length; j++) {
                catalogue.push(v => {
                    const out = [...v];
                    [out[i], out[j]] = [out[j], out[i]];
                    return out;
                });
            }
        }
        const fits = catalogue.filter(f => f(a).join(",") === b.join(","));
        equal(fits.length, 1,
            `${fits.length} of the changes the card offers turn the first relation into `
            + "the second, so the example does not pin down which one to apply");
    }
});

/**
 * And the decoy is one direction away from the answer.
 *
 * A decoy anywhere else is dismissed for being nowhere near, which needs no
 * change to have been identified and no relation to have been composed. The
 * derivation says it is right on every direction but one, so that is checked.
 */
test("Second-Order's decoy stands one direction from the answer", () => {
    for (const q of secondItems()) {
        const wanted = must(patternAfter(q.explanation[2], "so the same change makes it "),
            "the derivation does not print the relation the change asks for");
        const decoy = must(patternAfter(q.explanation[q.explanation.length - 1], " is "),
            "the derivation does not print where the decoy stands");
        equal(wanted.length, decoy.length, "the two are described on different axes");
        const off = wanted.filter((v, i) => v !== decoy[i]).length;
        equal(off, 1,
            `the decoy is ${off} directions from the answer, so it can be dismissed `
            + "without the change having been worked out");
    }
});
