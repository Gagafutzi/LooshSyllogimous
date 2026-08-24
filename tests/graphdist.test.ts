/**
 * Graph edit distance, and the trap that makes it worth computing.
 *
 * **Applying k changes does not mean the distance is k.** Changes can partially
 * cancel, and a bijection other than the one used to build the pair may line
 * the graphs up more cheaply. A generator that trusted its own edit count would
 * confidently mark correct answers wrong — so the first test here does not
 * check that the search is fast or elegant, it checks that the search is
 * *necessary*, by finding real cases where the edit count overstates the
 * distance.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    GraphEdge, MAX_DISTANCE_NODES, editDistance, isomorphicByDistance, nodesOf, oddGraphOut,
} from "../src/app/syllogimous/utils/graphdist.utils";

const g = (...edges: Array<[string, "↔" | "→" | "←", string]>): GraphEdge[] => edges;

test("a graph is nought from itself, relabelled or not", () => {
    const a = g(["A", "→", "B"], ["B", "→", "C"], ["C", "↔", "D"]);
    equal(editDistance(a, a), 0, "a graph differs from itself");

    // Same shape, different names, edges stated in another order and the
    // one-way ones written back to front.
    const relabelled = g(["Z", "←", "Y"], ["W", "↔", "Z"], ["X", "→", "Y"]);
    equal(editDistance(a, relabelled), 0, "a relabelling was counted as a difference");
});

test("one changed relation costs one, whichever way it changed", () => {
    const base = g(["A", "→", "B"], ["B", "→", "C"], ["C", "→", "D"]);

    // Reversed, not removed and re-added: a pair holds one state, so flipping
    // it is a single change rather than two.
    equal(editDistance(base, g(["A", "←", "B"], ["B", "→", "C"], ["C", "→", "D"])), 1,
        "reversing one edge");
    equal(editDistance(base, g(["A", "↔", "B"], ["B", "→", "C"], ["C", "→", "D"])), 1,
        "making one edge two-way");
    equal(editDistance(base, g(["A", "→", "B"], ["B", "→", "C"], ["C", "→", "D"], ["A", "→", "D"])), 1,
        "adding an edge");
});

test("the edit count overstates the distance often enough to matter", () => {
    /*
     * The whole reason the generator must search. Random edits are applied to a
     * copy, and the true distance is compared against how many were made — if
     * the two always agreed, assuming the count would be safe and this module
     * would be pointless.
     */
    const names = ["A", "B", "C", "D", "E"];
    let overstated = 0, tried = 0;

    seeded(6151, () => {
        for (let run = 0; run < 300; run++) {
            const base: GraphEdge[] = [];
            for (let i = 0; i < names.length - 1; i++) {
                base.push([names[i], pick(["→", "←", "↔"]), names[i + 1]]);
            }
            // One extra chord, so the shape has some symmetry to exploit.
            base.push([names[0], pick(["→", "←", "↔"]), names[names.length - 1]]);

            const edits = 2;
            const copy: GraphEdge[] = base.map(e => [...e] as GraphEdge);
            for (let k = 0; k < edits; k++) {
                const at = Math.floor(Math.random() * copy.length);
                copy[at] = [copy[at][0], pick(["→", "←", "↔"]), copy[at][2]];
            }

            const truth = editDistance(base, copy);
            assert(truth !== null, "the search declined a graph inside the cap");
            tried++;
            if (truth! < edits) overstated++;
        }
    });

    assert(tried === 300, "the sample did not run");
    assert(overstated > 20,
        `only ${overstated} of 300 pairs had a distance below the edit count`
        + " — if that were zero, the search would be unnecessary");
});

function pick<T>(xs: T[]): T {
    return xs[Math.floor(Math.random() * xs.length)];
}

test("the distance is symmetric and obeys the triangle inequality", () => {
    // Not decoration: a metric that failed either would be measuring something
    // other than what the question claims.
    seeded(773, () => {
        const names = ["A", "B", "C", "D"];
        const draw = (): GraphEdge[] => {
            const out: GraphEdge[] = [];
            for (let i = 0; i < names.length; i++) {
                for (let j = i + 1; j < names.length; j++) {
                    if (Math.random() < 0.6) out.push([names[i], pick(["→", "←", "↔"]), names[j]]);
                }
            }
            return out.length ? out : [[names[0], "→", names[1]]];
        };

        for (let run = 0; run < 60; run++) {
            const [a, b, c] = [draw(), draw(), draw()];
            if (nodesOf(a).length !== 4 || nodesOf(b).length !== 4 || nodesOf(c).length !== 4) continue;

            const ab = editDistance(a, b), ba = editDistance(b, a);
            equal(ab, ba, "the distance depends on which graph is named first");

            const bc = editDistance(b, c), ac = editDistance(a, c);
            assert(ac! <= ab! + bc!,
                `triangle inequality broken: ${ac} > ${ab} + ${bc}`);
        }
    });
});

test("too big to search is null, never nought", () => {
    // A silent zero would read as a claim of isomorphism, which is the one
    // wrong answer a cap must not produce.
    const many = [...Array(MAX_DISTANCE_NODES + 2).keys()].map(i => `N${i}`);
    const big: GraphEdge[] = many.slice(1).map((n, i) => [many[i], "→", n]);

    equal(editDistance(big, big), null, "an oversized pair was measured anyway");
    assert(!isomorphicByDistance(big, big), "an unmeasurable pair was called isomorphic");
});

test("the odd one out is only named when there is exactly one", () => {
    const a = g(["A", "→", "B"], ["B", "→", "C"]);
    const b = g(["X", "→", "Y"], ["Y", "→", "Z"]);
    const different = g(["P", "↔", "Q"], ["Q", "→", "R"]);

    equal(oddGraphOut([a, b, different]), 2, "the one that differs");
    equal(oddGraphOut([a, different, b]), 1, "position is not assumed");
    equal(oddGraphOut([a, b, b]), null, "all alike has no odd one out");

    const alsoDifferent = g(["P", "↔", "Q"], ["Q", "↔", "R"]);
    equal(oddGraphOut([a, b, different, alsoDifferent]), null,
        "two that differ is not a question with one answer");
});

/* ---------------- the two item forms built on it ---------------- */

import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createGraphMatching } from "../src/app/syllogimous/generators/graph-matching";
import { LINEAR_SCALES } from "../src/app/syllogimous/utils/linear.utils";

function context(rung: string): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === rung,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Premises back into graphs, split on the group headings. */
function readGroups(premises: string[]): GraphEdge[][] {
    const groups: GraphEdge[][] = [];
    const strip = (s: string) => s.replace(/<[^>]+>/g, "");

    for (const raw of premises) {
        const line = strip(raw).trim();
        if (line.endsWith(":")) { groups.push([]); continue; }
        if (!groups.length) continue;

        let m: RegExpExecArray | null;
        if ((m = /^(.+) goes to (.+)$/.exec(line))) groups[groups.length - 1].push([m[1], "→", m[2]]);
        else if ((m = /^(.+) comes from (.+)$/.exec(line))) groups[groups.length - 1].push([m[1], "←", m[2]]);
        else if ((m = /^(.+) is connected to (.+)$/.exec(line))) groups[groups.length - 1].push([m[1], "↔", m[2]]);
    }
    return groups;
}

test("the group named as odd really is the only one that differs", () => {
    const ctx = context("which-differs");
    let checked = 0;

    for (let run = 0; run < 40 && checked < 20; run++) {
        const q = seeded(run * 1237 + 3, () => createGraphMatching(ctx, 5));
        if (q.answerMode !== "choice" || !String(q.choicePrompt).includes("not the same shape")) continue;

        const groups = readGroups(q.premises);
        assert(groups.length >= 3, `only ${groups.length} groups were stated`);

        // Recomputed from the premises, not from what the generator intended.
        equal(oddGraphOut(groups), q.correctChoice,
            "the marked group is not the one the premises single out");
        checked++;
    }

    assert(checked >= 20, `only ${checked} odd-one-out items appeared`);
});

test("the stated distance is the true minimum, not the number of edits made", () => {
    /*
     * The trap, checked on real items. The generator perturbs one to three
     * links and then searches; if it reported its own edit count instead, this
     * would fail on the pairs where changes partially cancel — which the test
     * above shows are common.
     */
    const ctx = context("distance");
    let checked = 0;

    for (let run = 0; run < 40 && checked < 20; run++) {
        const q = seeded(run * 6949 + 11, () => createGraphMatching(ctx, 5));
        if (q.answerMode !== "choice" || !String(q.choicePrompt).includes("Fewest links")) continue;

        const groups = readGroups(q.premises);
        assert(groups.length === 2, `expected two graphs, got ${groups.length}`);

        const truth = editDistance(groups[0], groups[1]);
        assert(truth !== null, "the stated graphs are too big to measure");
        equal(q.choices[q.correctChoice].replace(/<[^>]+>/g, ""), String(truth),
            "the marked option is not the true minimum");

        // And no other option is also right.
        q.choices.forEach((c, i) => {
            if (i === q.correctChoice) return;
            assert(c.replace(/<[^>]+>/g, "") !== String(truth), "the answer is offered twice");
        });
        checked++;
    }

    assert(checked >= 20, `only ${checked} distance items appeared`);
});

/**
 * The same comparison, stated in two different vocabularies.
 *
 * With both graphs drawn as arrows the two premise sets are written in the same
 * words, so they can be lined up by eye — match the text, match the structure.
 * One spatial vocabulary and one temporal closes that route: nothing can be
 * compared until both have been abstracted out of what they say into what shape
 * they are.
 *
 * Checked by reading both halves back into graphs through the scale
 * vocabularies and re-deciding isomorphism, which is the same search the arrow
 * forms use — so if the wording ever stopped mapping onto the structure
 * faithfully, this would disagree with the item.
 */
test("relational phrasing preserves the structure it is stating", () => {
    const ctx = context("as-relations");
    let checked = 0, matching = 0;

    for (let run = 0; run < 60 && checked < 25; run++) {
        const q = seeded(run * 4547 + 17, () => createGraphMatching(ctx, 5));
        if (!String(q.conclusion).includes("same structure")) continue;

        const groups = readRelationGroups(q.premises);
        assert(groups.length === 2, `expected two sets, got ${groups.length}`);
        assert(groups[0].length >= 4 && groups[1].length >= 4, "a set was nearly empty");

        const same = isomorphicByDistance(groups[0], groups[1]);
        assert(same === q.isValid,
            `the structures ${same ? "match" : "differ"} but the item says ${q.isValid}`);

        if (q.isValid) matching++;
        checked++;
    }

    assert(checked >= 25, `only ${checked} relational items appeared`);
    assert(matching > 5 && matching < checked - 5,
        `${matching} of ${checked} matched — the answer should not be guessable`);
});

test("the two vocabularies never share a phrase", () => {
    /*
     * The whole point of the form. Quantity and Height say exactly the same
     * things, so a reader could only tell which set a statement belonged to by
     * where it sat on the page — which is the text-matching shortcut this form
     * exists to close, reopened.
     */
    const ctx = context("as-relations");

    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 971 + 29, () => createGraphMatching(ctx, 5));
        if (!String(q.conclusion).includes("same structure")) continue;

        const [first, second] = q.premises
            .map(p => p.replace(/<[^>]+>/g, "").trim())
            .filter(p => p.endsWith(":"))
            .map(p => p.slice(0, -1));

        const scaleOf = (name: string) => Object.values(LINEAR_SCALES).find(s => s.name === name)!;
        const a = scaleOf(first), b = scaleOf(second);
        assert(!!a && !!b, `unknown scale heading: ${first} / ${second}`);

        const words = (s: typeof a) => new Set([s.above, s.below, s.same]);
        for (const w of words(b)) {
            assert(!words(a).has(w), `both sets can say "${w}"`);
        }
    }
});

/** Both halves back into graphs, read through whichever scale each uses. */
function readRelationGroups(premises: string[]): GraphEdge[][] {
    const groups: GraphEdge[][] = [];

    for (const raw of premises) {
        const line = raw.replace(/<[^>]+>/g, "").trim();
        if (line.endsWith(":")) { groups.push([]); continue; }
        if (!groups.length) continue;

        // Longest phrase first: "is at the same time as" contains no other
        // phrase, but short ones can sit inside longer ones in principle.
        const phrases = Object.values(LINEAR_SCALES).flatMap(s => [
            { text: s.above, rel: "→" as const },
            { text: s.below, rel: "←" as const },
            { text: s.same, rel: "↔" as const },
        ]).sort((x, y) => y.text.length - x.text.length);

        const hit = phrases.find(p => line.includes(` ${p.text} `));
        assert(!!hit, `no known relation in: ${line}`);

        const [a, b] = line.split(` ${hit!.text} `);
        groups[groups.length - 1].push([a.trim(), hit!.rel, b.trim()]);
    }

    return groups;
}
