/**
 * Relational webs, and the property that makes a mapping item answerable.
 *
 * The trap is not hypothetical: a random directed graph on seven nodes has a
 * non-trivial symmetry often enough that an unguarded generator would serve
 * broken items regularly — several nodes equally correct, one of them marked
 * right. So the orbit check is tested directly, and then again through the
 * generator, on the graphs it actually produces.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    WEB_PROPERTIES, Web, cloneWeb, edgesOf, emptyWeb, isomorphic, nearMiss, orbitOf,
    degreeTwins, permuteWeb, randomPermutation, randomWeb, refine,
} from "../src/app/syllogimous/utils/web.utils";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

function context(structural = false): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    return {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: (_t: unknown, r: string) => structural && r === "structural",
            depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: (_t: string, r: string) => structural && r === "structural",
        random: () => { throw new Error("not needed"); },
    };
}

/** A directed triangle: every node looks like every other. */
function cycle(n: number): Web {
    const w = emptyWeb(n);
    for (let i = 0; i < n; i++) w.adj[i][(i + 1) % n] = true;
    return w;
}

test("relabelling never changes the shape", () => {
    for (let run = 0; run < 20; run++) {
        seeded(run * 8191 + 3, () => {
            const w = randomWeb(7, 0.3);
            const p = randomPermutation(7);
            assert(isomorphic(w, permuteWeb(w, p)), "a relabelling was called a different shape");
        });
    }
});

test("a symmetric graph has orbits bigger than one", () => {
    // Every node of a directed cycle is interchangeable, so no node of it can
    // ever be the subject of a mapping question.
    const c = cycle(6);
    equal(orbitOf(c, 0).length, 6, "the cycle's symmetry was not found");
});

test("a node with a unique neighbourhood is alone in its orbit", () => {
    const w = cycle(5);
    w.adj[0][2] = true;              // one extra arrow, breaking the symmetry
    equal(orbitOf(w, 0).length, 1, "the broken symmetry was not noticed");
});

test("refinement separates what degrees alone cannot", () => {
    const w = emptyWeb(4);
    w.adj[0][1] = true; w.adj[1][2] = true; w.adj[2][3] = true; w.adj[3][0] = true;
    // A 4-cycle: every node is 1-in 1-out and genuinely interchangeable.
    equal(new Set(refine(w)).size, 1, "a cycle's nodes were told apart");
});

test("a near miss keeps every degree and changes the shape", () => {
    for (let run = 0; run < 20; run++) {
        const w = seeded(run * 2311 + 7, () => randomWeb(8, 0.3));
        const m = seeded(run * 2311 + 8, () => nearMiss(w));
        if (!m) continue;

        assert(!isomorphic(w, m), "the near miss was the same shape after all");
        for (let v = 0; v < w.n; v++) {
            equal(m.adj[v].filter(Boolean).length, w.adj[v].filter(Boolean).length,
                `out-degree of node ${v} changed, so counting arrows would solve it`);
            equal(m.adj.filter(r => r[v]).length, w.adj.filter(r => r[v]).length,
                `in-degree of node ${v} changed`);
        }
    }
});

test("the properties agree with worked examples", () => {
    const prop = (id: string) => WEB_PROPERTIES.find(p => p.id === id)!;

    const loops = emptyWeb(3);
    for (let i = 0; i < 3; i++) loops.adj[i][i] = true;
    assert(prop("reflexive").holds(loops), "all self-arrows is not reflexive");
    assert(!prop("irreflexive").holds(loops), "all self-arrows counted as irreflexive");

    const mutual = emptyWeb(2);
    mutual.adj[0][1] = true; mutual.adj[1][0] = true;
    assert(prop("symmetric").holds(mutual), "a mutual pair is not symmetric");
    assert(!prop("antisymmetric").holds(mutual), "a mutual pair counted as antisymmetric");
    assert(!prop("asymmetric").holds(mutual), "a mutual pair counted as asymmetric");

    const chain = emptyWeb(3);
    chain.adj[0][1] = true; chain.adj[1][2] = true;
    assert(!prop("transitive").holds(chain), "a two-step with no shortcut is not transitive");
    chain.adj[0][2] = true;
    assert(prop("transitive").holds(chain), "the shortcut did not make it transitive");
});

test("every mapping item has exactly one right answer", () => {
    /*
     * The correctness condition. Without it the generator serves items where
     * several nodes are equally valid and one of them is arbitrarily "the"
     * answer — the player is then marked wrong for being right.
     */
    let mappings = 0;
    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 6607 + 11, () => createRelationalWeb(context(), 5));
        if (!q.webs || q.webs[0].highlight === undefined) continue;
        mappings++;

        const left: Web = { n: q.webs[0].adj.length, adj: q.webs[0].adj };
        equal(orbitOf(left, q.webs[0].highlight!).length, 1,
            "the highlighted node shares its orbit, so the item has several answers");
    }
    assert(mappings > 5, `only ${mappings} mapping items in 60 draws`);
});

test("the structural rung removes the counting shortcut", () => {
    /*
     * A degree twin, not a refinement twin. Refinement is essentially complete
     * on graphs this small, so two nodes of the same colour share an orbit and
     * the item would have no unique answer — the rung would ask for something
     * that cannot exist. Degree twins remove the counting shortcut and leave
     * the answer unique, which is what the rung is for.
     */
    let checked = 0;
    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 4441 + 13, () => createRelationalWeb(context(true), 6));
        const highlight = q.webs?.[0].highlight;
        if (highlight === undefined) continue;
        checked++;

        const left: Web = { n: q.webs![0].adj.length, adj: q.webs![0].adj };
        assert(degreeTwins(left, highlight).length > 0,
            "the highlighted node was identifiable by counting arrows alone");
        equal(orbitOf(left, highlight).length, 1, "and it still has to have one answer");
    }
    assert(checked > 3, `only ${checked} structural mapping items`);
});

test("a comparison item's verdict matches the graphs it drew", () => {
    let checked = 0;
    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 977 + 5, () => createRelationalWeb(context(), 5));
        if (!q.webs || q.webs[0].highlight !== undefined) continue;
        if (!String(q.conclusion).includes("same shape")) continue;
        checked++;

        const a: Web = { n: q.webs[0].adj.length, adj: q.webs[0].adj };
        const b: Web = { n: q.webs[1].adj.length, adj: q.webs[1].adj };
        equal(isomorphic(a, b), q.isValid, "the stated answer disagrees with the pictures");
    }
    assert(checked > 3, `only ${checked} comparison items`);
});

test("a properties item's verdict matches the graphs it drew", () => {
    let checked = 0;
    for (let run = 0; run < 80; run++) {
        const q = seeded(run * 3121 + 17, () => createRelationalWeb(context(), 5));
        const named = WEB_PROPERTIES.find(p => String(q.conclusion).includes(p.name));
        if (!q.webs || !named) continue;
        checked++;

        const a: Web = { n: q.webs[0].adj.length, adj: q.webs[0].adj };
        const b: Web = { n: q.webs[1].adj.length, adj: q.webs[1].adj };
        equal(named.holds(a) === named.holds(b), q.isValid,
            `the ${named.name} verdict disagrees with the pictures`);
    }
    assert(checked > 3, `only ${checked} properties items`);
});
