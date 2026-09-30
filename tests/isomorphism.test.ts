/**
 * The Isomorphism family — recomputed from the cards, not from the generators.
 *
 * Every one of these four cards makes a claim no answer key can carry: *no other
 * group matches*, *no larger group does*, *the other candidate is one arrow off*.
 * Those are statements about the whole system, and a generator that got them
 * wrong would ship an item where a reader who found the second group is failed
 * for finding it — with the premises true, the marked answer valid, and the
 * derivation reading perfectly.
 *
 * So the webs are rebuilt from the premises. Each system has its own vocabulary,
 * the card names which entities belong to which group, and every premise is one
 * arrow — so a web per group falls out of the text. Then every claim is checked
 * by exhaustive search over that web, which is what the player would have to do.
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
    Web, edgesOf, emptyWeb, induced, isomorphic, subsets,
} from "../src/app/syllogimous/utils/web.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import {
    createCommonSubsystem, createMotifSearch, createPartialIsomorphism,
    createStructureMatch,
} from "../src/app/syllogimous/generators/isomorphism";

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
            for (let rep = 0; rep < 8; rep++) {
                try { out.push(make(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `${type}: only ${out.length} items were built`);
    return out;
}

/** Every premise as the one arrow it states. */
function arrows(q: Question): Array<[string, string]> {
    return q.premises.map(line => {
        const names = extractSubjects(line);
        equal(names.length, 2, `a premise is not one arrow: ${strip(line)}`);
        return [names[0], names[1]] as [string, string];
    });
}

/**
 * The web over one group, from the premises that stay inside it.
 *
 * Arrows leaving the group are dropped, which is the induced reading and the one
 * these modes are about. That is also why the check is worth doing on the text: a
 * mode that built its answer from arrows the card does not state, or that counted
 * an outgoing arrow as part of a group's structure, would pass any check written
 * against its own layout.
 */
function webOf(q: Question, group: string[]): Web {
    const at = new Map(group.map((w, i) => [w, i]));
    const w = emptyWeb(group.length);
    for (const [a, b] of arrows(q)) {
        const i = at.get(a), j = at.get(b);
        if (i !== undefined && j !== undefined) w.adj[i][j] = true;
    }
    return w;
}

/** The names an option lists, which is how these cards name a group. */
const groupOf = (option: string) => extractSubjects(option);

/* ------------------------------------------------------------------ *
 * Structure Match                                                     *
 * ------------------------------------------------------------------ */

const structureItems = () =>
    itemsOf(EnumQuestionType.StructureMatch, createStructureMatch, 20261101);

test("Structure Match offers two groups and marks the one that matches", () => {
    for (const q of structureItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 2,
            `${q.choices.length} candidates — this app holds a choice to two unless the `
            + "options are the card's own premises, and these are groups");
        const reference = extractSubjects(q.setup[0]);
        assert(reference.length >= 3, "the setup does not name the reference system");

        const ref = webOf(q, reference);
        const groups = q.choices.map(groupOf);
        for (const g of groups) {
            equal(g.length, reference.length,
                "a candidate group is a different size from the reference");
            equal(g.filter(w => reference.includes(w)), [],
                "a candidate group shares an entity with the reference system");
        }

        const right = webOf(q, groups[q.correctChoice]);
        const wrong = webOf(q, groups[1 - q.correctChoice]);
        assert(isomorphic(right, ref),
            "the group the item marks is not the reference system renamed");
        assert(!isomorphic(wrong, ref),
            "the other group is also the reference system renamed, so both answers are "
            + "right and one is marked wrong");
    }
});

/**
 * Counting the arrows must not answer it.
 *
 * The whole of the construction. A candidate one arrow short is told apart by
 * counting, which is not comparing structures — so a reader who learned to count
 * would never have to line the two systems up, and the mode would be training
 * arithmetic.
 */
test("Structure Match candidates carry as many arrows as the reference", () => {
    for (const q of structureItems()) {
        const ref = edgesOf(webOf(q, extractSubjects(q.setup[0]))).length;
        for (const option of q.choices) {
            equal(edgesOf(webOf(q, groupOf(option))).length, ref,
                "a candidate has a different number of arrows from the reference, so "
                + "counting them answers the item without comparing anything");
        }
    }
});

/* ------------------------------------------------------------------ *
 * Motif Search                                                        *
 * ------------------------------------------------------------------ */

const motifItems = () => itemsOf(EnumQuestionType.MotifSearch, createMotifSearch, 20261102);

/**
 * The pattern sits in exactly one group of the host, and it is the marked one.
 *
 * "Exactly one" is checked over *every* group of the host rather than over the two
 * offered, because that is what the card claims. Checked only against the menu, a
 * reader who found a third group would be right and have nowhere to say so.
 */
test("Motif Search marks the one group of the host that fits the pattern", () => {
    for (const q of motifItems()) {
        equal(q.answerMode, "choice", "the item is not answered by choosing");
        equal(q.choices.length, 2, `${q.choices.length} groups offered, not two`);

        const patternNames = extractSubjects(q.setup[0]);
        const pattern = webOf(q, patternNames);
        const hostNames = q.bucket.filter(w => !patternNames.includes(w));
        const host = webOf(q, hostNames);

        const sites = subsets(hostNames.length, patternNames.length)
            .filter(pick => isomorphic(induced(host, pick), pattern));
        equal(sites.length, 1,
            `${sites.length} groups of the host fit the pattern, and the card says one`);

        const marked = groupOf(q.choices[q.correctChoice]);
        const site = sites[0].map(i => hostNames[i]);
        equal([...marked].sort(), [...site].sort(),
            "the group the item marks is not the one that fits the pattern");

        const other = groupOf(q.choices[1 - q.correctChoice]);
        const otherWeb = induced(host, other.map(w => hostNames.indexOf(w)));
        assert(!isomorphic(otherWeb, pattern),
            "the other group fits the pattern too, so both answers are right");
        equal(edgesOf(otherWeb).length, edgesOf(pattern).length,
            "the other group has a different number of internal arrows, so counting "
            + "them answers the item");
    }
});

/* ------------------------------------------------------------------ *
 * Partial Isomorphism                                                 *
 * ------------------------------------------------------------------ */

const partialItems = () =>
    itemsOf(EnumQuestionType.PartialIsomorphism, createPartialIsomorphism, 20261103);

/** The two systems, as the setup names them. */
function twoSystems(q: Question) {
    const parts = strip(q.setup[0]).split(";");
    equal(parts.length, 2, `the setup does not name two systems: ${strip(q.setup[0])}`);
    const left = extractSubjects(q.setup[0].split(";")[0]);
    const right = extractSubjects(q.setup[0].split(";")[1]);
    assert(left.length >= 3 && right.length === left.length,
        "the two systems are not both named, at the same size");
    return { left, right };
}

test("Partial Isomorphism marks one entity from each system", () => {
    for (const q of partialItems()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        const { left, right } = twoSystems(q);
        equal(q.choices.length, left.length + right.length,
            "the candidates are not both systems' entities");
        equal(q.selectAnswer.length, 2, "the item does not mark exactly two entities");

        const marked = q.selectAnswer.map(i => strip(q.choices[i]).trim());
        equal(marked.filter(w => left.includes(w)).length, 1,
            "the two marked entities are not one from each system");
        equal(marked.filter(w => right.includes(w)).length, 1,
            "the two marked entities are not one from each system");
    }
});

/**
 * Drop those two and the rest line up — and no other pair does.
 *
 * The second half is the claim worth checking. A system with a symmetry offers
 * several entities that could equally be the odd one out, and an item like that
 * marks one of several right answers wrong with nothing about it looking amiss.
 */
/**
 * **The floor is a smaller pair of systems than the ceiling.**
 *
 * Five a side was fixed, which made the first rung of this mode two systems of
 * five, sixteen arrow statements, and a menu of ten to select from — the heaviest
 * shape in the family offered as the way into it. Four a side is thirteen
 * statements and a menu of eight.
 *
 * Four only at the floor, and the reason is in the generator: a four-a-side
 * shared core saturates at six arrows, so from eight premises up it would build
 * the same item while the ladder printed a larger number. Asserted as a step,
 * read off the menu — every entity of both systems is offered, so the menu is
 * twice the size of a side.
 */
test("Partial Isomorphism's floor is a smaller pair of systems than its ceiling", () => {
    const ctx = context();
    const range = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.PartialIsomorphism];
    const sides = new Map<number, Set<number>>();

    seeded(20261903, () => {
        for (let n = range.minNumOfPremises; n <= range.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 8; rep++) {
                let q: Question;
                try { q = createPartialIsomorphism(ctx, n); } catch { continue; }
                const held = sides.get(n) ?? new Set<number>();
                held.add(q.choices.length / 2);
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
        `every rung is ${floor} entities a side, so the first card of this mode is a `
        + `menu of ${floor * 2} and there is no bottom step`);
});

test("Partial Isomorphism leaves exactly one pair whose removal lines the rest up", () => {
    for (const q of partialItems()) {
        const { left, right } = twoSystems(q);
        const a = webOf(q, left), b = webOf(q, right);
        const without = (w: Web, drop: number) =>
            induced(w, [...Array(w.n).keys()].filter(i => i !== drop));

        const works: string[] = [];
        for (let i = 0; i < a.n; i++) {
            for (let j = 0; j < b.n; j++) {
                if (isomorphic(without(a, i), without(b, j))) works.push(`${left[i]}+${right[j]}`);
            }
        }
        equal(works.length, 1,
            `${works.length} pairs can be left out and leave the rest lining up `
            + `(${works.join(", ")}), and the card says one`);

        const marked = q.selectAnswer.map(i => strip(q.choices[i]).trim());
        const asPair = marked.filter(w => left.includes(w))[0]
            + "+" + marked.filter(w => right.includes(w))[0];
        equal(asPair, works[0], "the pair the item marks is not the pair that works");
    }
});

/* ------------------------------------------------------------------ *
 * Common Sub-System                                                   *
 * ------------------------------------------------------------------ */

const commonItems = () =>
    itemsOf(EnumQuestionType.CommonSubsystem, createCommonSubsystem, 20261104);

/**
 * The marked group is shared, is the largest shared, and is the only one.
 *
 * All three are printed on the card and all three are about the whole of both
 * systems, so all three are walked. "No larger group does" is the one a
 * generator is most likely to get wrong by searching upwards from small.
 */
test("Common Sub-System marks the largest group the two systems share", () => {
    for (const q of commonItems()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        const { left, right } = twoSystems(q);
        equal(q.choices.length, left.length,
            "the candidates are not the first system's entities");

        const a = webOf(q, left), b = webOf(q, right);
        const marked = q.selectAnswer.map(i => strip(q.choices[i]).trim());
        const size = marked.length;
        assert(size >= 3, `the item marks ${size} entities, which is too few to be a group`);
        assert(size <= left.length - 2,
            `the item marks ${size} of ${left.length}, which asks which entities are left `
            + "out rather than which form the group");

        const shape = induced(a, marked.map(w => left.indexOf(w)));
        const fitsIn = (w: Web, k: number, target: Web) =>
            subsets(w.n, k).some(pick => isomorphic(induced(w, pick), target));
        assert(fitsIn(b, size, shape),
            "the marked group does not stand to itself as any group of the other system "
            + "does, so the card's shared structure is not shared");

        /* Nothing larger, on either side — the card says so outright. */
        for (let bigger = size + 1; bigger <= Math.min(a.n, b.n); bigger++) {
            for (const inA of subsets(a.n, bigger)) {
                const target = induced(a, inA);
                assert(!fitsIn(b, bigger, target),
                    `a group of ${bigger} is shared as well, so "no larger group does" is `
                    + "false and a reader who found it is failed for it");
            }
        }

        /* And no other group of the same size in the first system. */
        const others = subsets(a.n, size)
            .filter(pick => pick.map(i => left[i]).sort().join(",") !== [...marked].sort().join(","))
            .filter(pick => fitsIn(b, size, induced(a, pick)));
        equal(others.map(p => p.map(i => left[i]).join("+")), [],
            "another group of the first system matches a group of the second, so the "
            + "item marks one of several right answers");
    }
});
