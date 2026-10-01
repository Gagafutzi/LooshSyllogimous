/**
 * Hidden Algebra, and the claim the whole mode rests on.
 *
 * The card says the first list is complete and that one reading fits it. If two
 * did, the second half would be marked against whichever the generator happened
 * to pick — an item that is wrong rather than hard, and wrong in a way a player
 * could never tell from a card they had read correctly.
 *
 * So the uniqueness is recomputed here from the list as shown: every system is
 * asked whether any of its arrangements over those entities produces exactly
 * that table, and exactly one must be able to. Nothing is taken from the
 * generator.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import {
    ALL_SYSTEMS, RelationSystem, consistentStates,
} from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createHiddenAlgebra } from "../src/app/syllogimous/generators/hidden-algebra";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

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

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20260930, () => {
        for (let n = 3; n <= 8; n++) {
            for (let rep = 0; rep < 8; rep++) {
                try { out.push(createHiddenAlgebra(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 30, `only ${out.length} items were built`);
    return out;
}

/** The two halves, split at the line that announces the second group. */
function halves(q: Question) {
    const at = q.premises.findIndex(p => /A second group/.test(strip(p)));
    assert(at > 0, "the card does not separate the complete list from the second group");
    return { first: q.premises.slice(1, at), second: q.premises.slice(at + 1) };
}

/** The complete list, as the pairs it states over the first group's names. */
function firstTable(q: Question) {
    const { first } = halves(q);
    const names: string[] = [];
    const pairs: Array<[string, string]> = [];
    for (const line of first) {
        const [a, b] = extractSubjects(line);
        assert(!!a && !!b, `a line of the complete list names one thing: ${strip(line)}`);
        for (const w of [a, b]) if (!names.includes(w)) names.push(w);
        pairs.push([a, b]);
    }
    return { pairs, names };
}

/** Which systems could have produced that table over those entities. */
function readingsOf(pairs: Array<[string, string]>, names: string[]): RelationSystem[] {
    /* The entity order is the one the header announces, which is the order the
       generator drew — recovered here from the first list plus any name that
       only appears in the header. */
    const index = new Map(names.map((w, i) => [w, i]));
    const want = new Set(pairs.map(([a, b]) => `${index.get(a)}>${index.get(b)}`));
    const n = names.length;

    return ALL_SYSTEMS.filter(system => {
        if (n > system.maxN) return false;
        return system.states(n).some(state => {
            let seen = 0;
            for (let a = 0; a < n; a++) {
                for (let b = 0; b < n; b++) {
                    if (a === b) continue;
                    const holds = system.holds(state, a, b);
                    if (holds !== want.has(`${a}>${b}`)) return false;
                    if (holds) seen++;
                }
            }
            return seen === want.size;
        });
    });
}

test("the complete list has exactly one reading", () => {
    for (const q of items()) {
        const { pairs, names } = firstTable(q);
        /* Every name in the header, not only the ones that happen to appear in
           a stated pair — an entity that stands in no relation at all is part
           of what the list says. */
        const header = extractSubjects(q.premises[0]);
        for (const w of header) if (!names.includes(w)) names.push(w);

        const fits = readingsOf(pairs, names);
        equal(fits.length, 1,
            `${fits.length} relations produce this list, so the second half is marked`
            + ` against a guess: ${fits.map(s => s.id).join(", ") || "none"}`);
    }
});

/**
 * And the reading the card explains is the one that fits.
 *
 * The uniqueness above says a reader can get there; this says the item agrees
 * with where they get to. The two come apart if the derivation is written from
 * the system the generator drew rather than from the list it printed.
 */
/**
 * **The list has to show whether it chains, not merely be consistent with it.**
 *
 * The uniqueness check says one reading fits. It does not say the reader can see
 * which, and those are different claims. A complete list of "Glass brands Onion,
 * Onion brands Glass" among four names is produced by sameness-of-group and by
 * nothing else — but there is no two-step path anywhere in it, so whether the
 * relation chains is never put to the test. The only route left is eliminating
 * the seven other readings from memory, and the card gives no such catalogue.
 *
 * So the list must contain `A` to `B` and `B` to `C` with `C` not `A`. Then the
 * induction is one the evidence supports: either `A` to `C` is in the list and it
 * chains, or it is absent and it does not. `C !== A` is the point of the shape —
 * `A` to `B` and `B` back to `A` is the relation running both ways, a different
 * property, and one that is visible without any of this.
 *
 * Reported as a count rather than per item so a failure says how wide it is.
 */
test("the complete list shows a two-step path, so chaining can be read off it", () => {
    const flat: string[] = [];
    let seen = 0;

    for (const q of items()) {
        seen++;
        const { pairs } = firstTable(q);
        const chains = pairs.some(([a, b]) => pairs.some(([c, d]) => b === c && d !== a));
        if (!chains) {
            flat.push(pairs.map(([a, b]) => `${a}>${b}`).join(", "));
        }
    }

    assert(seen > 10, `only ${seen} items were built`);
    assert(flat.length === 0,
        `${flat.length} of ${seen} lists never put two steps together, so whether the `
        + "relation chains cannot be read off them and the reader is left eliminating "
        + `readings the card never names:\n  ${flat.slice(0, 4).join("\n  ")}`);
});

test("the derivation names the relation the list identifies", () => {
    for (const q of items()) {
        const { pairs, names } = firstTable(q);
        for (const w of extractSubjects(q.premises[0])) if (!names.includes(w)) names.push(w);
        const [fits] = readingsOf(pairs, names);
        assert(strip(q.explanation[0]).includes(fits.meaning),
            `the derivation explains a different relation from the one the list fits`);
    }
});

/**
 * The second half is the possibility question over the relation just induced.
 *
 * Recomputed the same way Possibility Sets is, but with the system taken from
 * the *list* rather than from the item — so a card whose halves disagree fails
 * here even though each half is internally fine.
 */
test("the outcomes follow from the second group under that same relation", () => {
    for (const q of items()) {
        const { pairs, names } = firstTable(q);
        for (const w of extractSubjects(q.premises[0])) if (!names.includes(w)) names.push(w);
        const [system] = readingsOf(pairs, names);

        const { second } = halves(q);
        const at = new Map(q.bucket.map((w, i) => [w, i]));
        const facts = second.map(line => {
            const [a, b] = extractSubjects(line);
            return { a: at.get(a)!, b: at.get(b)!, holds: !/does not/.test(strip(line)) };
        });

        const survivors = consistentStates(system, q.bucket.length, facts);
        assert(survivors.length > 0, "nothing fits the second group under the induced relation");

        const [x, y] = (() => {
            for (const option of q.choices) {
                const named = extractSubjects(option);
                if (named.length === 2) return [at.get(named[0])!, at.get(named[1])!] as const;
            }
            throw new Error("no option names a pair");
        })();

        q.choices.forEach((option, i) => {
            const named = extractSubjects(option);
            const possible = named.length === 2
                ? survivors.some(s => system.holds(s, at.get(named[0])!, at.get(named[1])!))
                : survivors.some(s => !system.holds(s, x, y) && !system.holds(s, y, x));
            equal(q.selectAnswer.includes(i), possible,
                `"${strip(option)}" does not follow from the second group under ${system.id}`);
        });
    }
});

/**
 * The three questions the setup asks are all live.
 *
 * "Does it run both ways? Does it chain? Do two steps come back round?" is the
 * induction, and it is only an induction if the answers vary. Drawn from one
 * kind of relation the mode would be a lookup with extra reading.
 *
 * A symmetric relation makes the two directional options agree, and that is not
 * a flaw: the options agreeing *is* what "it runs both ways" means, and a reader
 * only knows they agree once they have done the first half.
 */
test("the algebra to be found actually varies", () => {
    const found = new Set<string>();
    let symmetric = 0, asymmetric = 0;

    for (const q of items()) {
        const { pairs, names } = firstTable(q);
        for (const w of extractSubjects(q.premises[0])) if (!names.includes(w)) names.push(w);
        const [system] = readingsOf(pairs, names);
        found.add(system.id);

        const runsBothWays = pairs.some(([a, b]) =>
            pairs.some(([c, d]) => c === b && d === a));
        if (runsBothWays) symmetric++; else asymmetric++;
    }

    assert(found.size >= 3,
        `only ${found.size} relations are ever the answer: ${[...found].join(", ")}`);
    assert(symmetric > 0, "no item's relation ever runs both ways");
    assert(asymmetric > 0, "every item's relation runs both ways");
});
