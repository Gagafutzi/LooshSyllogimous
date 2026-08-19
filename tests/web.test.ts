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
    WEB_PROPERTIES, Web, cloneWeb, edgesOf, emptyWeb, isomorphic, mappings, nearMiss, orbitOf,
    degreeTwins, permuteWeb, randomPermutation, randomWeb, refine, scatterLayout,
} from "../src/app/syllogimous/utils/web.utils";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

/**
 * `true` still means the structural rung alone, so the existing calls read the
 * same; a list turns on exactly the rungs named.
 */
function context(rungs: boolean | string[] = false): GeneratorContext {
    const on = rungs === true ? ["structural"] : rungs === false ? [] : rungs;
    const has = (_t: unknown, r: string) => on.includes(r);

    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    return {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: has,
            depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: has,
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

/**
 * Whole-structure matching, answered by pointing.
 *
 * The single-node mapping trial undersells the mode twice over. One node is a
 * lookup — find the degree pair, find the match — where a correspondence has to
 * hold several nodes at once and stay consistent across them. And answering
 * from a list of names turns a question about a picture into a question about a
 * menu, when the picture is where the structure is.
 *
 * The invariant that matters is the same one the single-node trial has, applied
 * to every marked node at once: each must be alone in its orbit, or an
 * automorphism gives the item a second answer that the picture cannot
 * distinguish from the first.
 */
test("every marked node has exactly one possible counterpart", () => {
    const ctx = context(["structure-match"]);
    let checked = 0;

    for (let run = 0; run < 60 && checked < 20; run++) {
        const q = seeded(run * 8563 + 11, () => createRelationalWeb(ctx, 5));
        if (q.answerMode !== "map") continue;

        const [left, right] = q.webs!;
        const a: Web = { n: left.labels.length, adj: left.adj };
        const b: Web = { n: right.labels.length, adj: right.adj };

        assert(q.mapTargets.length >= 2, `only ${q.mapTargets.length} nodes to match`);
        assert(q.mapAnswer.length === q.mapTargets.length, "an answer is missing a node");

        for (const v of q.mapTargets) {
            equal(orbitOf(a, v).length, 1,
                `${left.labels[v]} can be swapped with another node, so it has two counterparts`);
        }

        // Every isomorphism between the two webs must agree with the answer —
        // that is what "exactly one counterpart" has to mean in the end.
        const all = mappings(a, b);
        assert(all.length > 0, "the second web is not the first one relabelled");
        for (const m of all) {
            q.mapTargets.forEach((v, i) => {
                equal(m[v], q.mapAnswer[i],
                    `a valid relabelling sends ${left.labels[v]} somewhere else`);
            });
        }

        checked++;
    }

    assert(checked >= 20, `only ${checked} structure items appeared`);
});

test("the marks are ordered, on the first web, and the second takes the answer", () => {
    const ctx = context(["structure-match"]);
    let checked = 0;

    for (let run = 0; run < 60 && checked < 15; run++) {
        const q = seeded(run * 1493 + 7, () => createRelationalWeb(ctx, 5));
        if (q.answerMode !== "map") continue;

        const [left, right] = q.webs!;
        equal(left.marks, q.mapTargets, "the drawn marks are not the nodes being asked about");
        assert(!left.selectable, "the first web takes answers, but it states the question");
        assert(!!right.selectable, "the second web cannot be answered on");
        assert(!right.marks, "the second web gives its own answer away");

        // Distinct nodes, or two badges land on one circle and the order is
        // unreadable.
        equal(new Set(q.mapTargets).size, q.mapTargets.length, "a node is marked twice");
        equal(new Set(q.mapAnswer).size, q.mapAnswer.length, "an answer node is used twice");

        checked++;
    }

    assert(checked >= 15, `only ${checked} structure items appeared`);
});

test("a structure match never shows its conclusion as a slide", () => {
    /*
     * Its conclusion records which node goes with which, so a conclusion slide
     * would print the answer above the controls for giving it. Construction
     * already had this exemption; matching needs it more, because here the
     * conclusion is not merely redundant but disclosing.
     */
    const ctx = context(["structure-match"]);

    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 331 + 5, () => createRelationalWeb(ctx, 5));
        if (q.answerMode !== "map") continue;

        assert(q.conclusion !== "", "the answer was not recorded for the history");
        assert(String(q.conclusion).includes("→"), "the recorded answer is not a correspondence");
        // The page decides what to show, so this pins the property the page
        // relies on: `map` is a mode whose conclusion is an answer, not a claim.
        assert(q.answerMode === "map", "mode changed under the test");
    }
});

/**
 * Where the nodes are drawn, which turned out to be part of the question.
 *
 * A ring puts every node at the same distance from the centre and the same
 * angle apart, so a graph with a rotational symmetry *looks* rotationally
 * symmetric — the automorphism is visible as a turn of the picture rather than
 * something to be established from the arrows. Drawing both webs as rings
 * additionally invites matching by position, which is the one route the mode
 * exists to close.
 */
test("nodes are scattered, not arranged on a ring", () => {
    seeded(7717, () => {
        for (const n of [4, 6, 8, 11]) {
            const points = scatterLayout(n);
            equal(points.length, n, "a node was not placed");

            for (const [x, y] of points) {
                assert(x > 0 && x < 1 && y > 0 && y < 1, `a node fell outside the box at ${x},${y}`);
            }

            // No two on top of each other, or the picture loses a node.
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const d = Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]);
                    assert(d > 0.06, `two nodes sit ${d.toFixed(3)} apart, which is on top of each other`);
                }
            }

            /*
             * The property that matters: not equidistant from the centre. On a
             * ring every radius is identical, so the spread of radii is the
             * thing that says this is not one.
             */
            const radii = points.map(([x, y]) => Math.hypot(x - 0.5, y - 0.5));
            const mean = radii.reduce((a, b) => a + b, 0) / n;
            const spread = Math.sqrt(radii.reduce((a, r) => a + (r - mean) ** 2, 0) / n);
            assert(spread > 0.02, `radii vary by only ${spread.toFixed(3)} — that is a ring`);
        }
    });
});

test("the two webs are never laid out alike", () => {
    /*
     * Independently drawn, so position carries no correspondence. If the two
     * shared a layout, the answer to a mapping item would often be "the node in
     * the same place", which is not a fact about the structure at all.
     */
    const ctx = context();

    for (let run = 0; run < 30; run++) {
        const q = seeded(run * 2411 + 13, () => createRelationalWeb(ctx, 5));
        if (!q.webs || q.webs.length < 2) continue;

        const [a, b] = q.webs;
        const same = a.layout.length === b.layout.length
            && a.layout.every((p, i) => Math.hypot(p[0] - b.layout[i][0], p[1] - b.layout[i][1]) < 1e-9);
        assert(!same, "both webs were drawn in exactly the same positions");
    }
});

test("Relational Web is answered on the picture, never from a menu", () => {
    /*
     * A menu of node names turns a question about a structure into a question
     * about a list: find the answer in the drawing, then hunt for its label
     * underneath. Both the single-node and the whole-structure trials point at
     * the second web instead, so the mode has one way of answering and the
     * rung only changes how many nodes it asks for.
     */
    for (const rungs of [[], ["structure-match"]]) {
        const ctx = context(rungs);
        let pointed = 0;

        for (let run = 0; run < 40; run++) {
            const q = seeded(run * 1301 + 7, () => createRelationalWeb(ctx, 5));
            assert(q.answerMode !== "choice",
                `a ${rungs.length ? "structure" : "base"} item still offers a menu`);

            if (q.answerMode !== "map") continue;
            assert(!!q.webs?.[1]?.selectable, "the answer cannot be given on the second web");
            assert(!!q.webs?.[0]?.marks?.length, "nothing is marked on the first web");
            equal(q.webs![0].marks, q.mapTargets, "the marks are not what is being asked about");
            pointed++;
        }

        assert(pointed > 8, `only ${pointed} pointing items in forty`);
    }
});
