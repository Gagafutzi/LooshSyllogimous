/**
 * Relational webs, and the property that makes a mapping item answerable.
 *
 * The trap is not hypothetical: a random directed graph on seven nodes has a
 * non-trivial symmetry often enough that an unguarded generator would serve
 * broken items regularly — several nodes equally correct, one of them marked
 * right. So the orbit check is tested directly, and then again through the
 * generator, on the graphs it actually produces.
 */

import { readFileSync } from "fs";
import { assert, equal, seeded, test } from "./harness";
import {
    WEB_PROPERTIES, Web, cloneWeb, edgesOf, emptyWeb, isomorphic, mappings, nearMiss, orbitOf,
    degreeTwins, permuteWeb, randomPermutation, randomWeb, refine, scatterLayout, clearestScatter, obstructions, edgeList, nodeClearance, arrowPath, bowFor, layoutArrows, portsFor, samplePath,
} from "../src/app/syllogimous/utils/web.utils";
import { createRelationalWeb } from "../src/app/syllogimous/generators/relational-web";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { DIM_SLOTS, dimSlot } from "../src/app/syllogimous/utils/phrasing";
import { RelationalWebComponent } from "../src/app/syllogimous/components/relational-web/relational-web.component";

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

/**
 * Every glanceable property is gone, not just the positive half.
 *
 * Reflexivity and symmetry went first — "does every node have a loop" and "is
 * every arrow paired" are counted off the picture. Their negations were kept on
 * the argument that a false item needs a property that fails interestingly.
 * That was wrong: the glance is the same glance either way, which is what play
 * reported. Transitivity is the only one that has to be composed.
 */
test("the glanceable properties are not offered", () => {
    for (const gone of ["reflexive", "symmetric", "irreflexive", "antisymmetric", "asymmetric"]) {
        assert(!WEB_PROPERTIES.some(p => p.id === gone),
            `${gone} is still in the pool`);
    }
    assert(WEB_PROPERTIES.some(p => p.id === "transitive"),
        "the one property that needs composing is missing");
});

test("the properties agree with worked examples", () => {
    const prop = (id: string) => WEB_PROPERTIES.find(p => p.id === id)!;

    const chain = emptyWeb(3);
    chain.adj[0][1] = true; chain.adj[1][2] = true;
    assert(!prop("transitive").holds(chain), "a two-step with no shortcut is not transitive");
    chain.adj[0][2] = true;
    assert(prop("transitive").holds(chain), "the shortcut did not make it transitive");

    // A loop and a mutual pair are both transitive, which is the point of
    // keeping this one: it is not answered by looking for either.
    const loops = emptyWeb(2);
    loops.adj[0][0] = true;
    assert(prop("transitive").holds(loops), "a self-arrow was read as a two-step");

    const mutual = emptyWeb(2);
    mutual.adj[0][1] = true; mutual.adj[1][0] = true;
    assert(!prop("transitive").holds(mutual),
        "a mutual pair has two-steps back to itself and needs the loops");
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

/**
 * Arrow geometry, which is the part that can be wrong invisibly.
 *
 * An arrow pointing backwards still looks like an arrow. The ring layout kept
 * every pair far enough apart that trimming a line to both rims could never
 * overshoot; scattering the nodes made it reachable, and a reversed arrow is a
 * worse failure than a hard-to-see one because it reads as a confident claim
 * about the opposite relation.
 */
test("an arrow always runs from its source to its target", () => {
    const radius = 13, headRoom = 14;

    seeded(3313, () => {
        for (let run = 0; run < 400; run++) {
            // Deliberately includes pairs far closer than two node radii.
            const a: [number, number] = [Math.random() * 200, Math.random() * 200];
            const b: [number, number] = [a[0] + (Math.random() - 0.5) * 60,
                                         a[1] + (Math.random() - 0.5) * 60];
            if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) continue;

            const { from, to } = arrowPath(a, b, radius, headRoom, 0.14);

            // The trimmed segment must point the same way as the pair does.
            const along = (to[0] - from[0]) * (b[0] - a[0]) + (to[1] - from[1]) * (b[1] - a[1]);
            assert(along > 0,
                `the arrow runs backwards for a pair `
                + `${Math.hypot(b[0] - a[0], b[1] - a[1]).toFixed(1)} units apart`);

            // And it must be long enough to carry a head that means something.
            const shaft = Math.hypot(to[0] - from[0], to[1] - from[1]);
            assert(shaft >= Math.min(headRoom, Math.hypot(b[0] - a[0], b[1] - a[1])) - 0.001,
                `only ${shaft.toFixed(1)} units of shaft`);
        }
    });
});

test("arrows bow, so near-parallel ones do not merge", () => {
    /*
     * The failure this fixes, from the screenshot: several edges leaving one
     * node at similar angles draw as one thick line, and which arrowhead
     * belongs to which cannot be recovered.
     *
     * Measured as the closest the two *curves* pass, sampled along their
     * lengths — not as the distance between their midpoints, which was the
     * first attempt and measured nothing: two arcs of different lengths have
     * distant midpoints whether or not they overlap. The near end is skipped
     * because both edges leave the same node and must be close there.
     */
    const radius = 13, headRoom = 14;

    const origin: [number, number] = [20, 100];
    const far = (deg: number, len: number): [number, number] =>
        [origin[0] + Math.cos(deg * Math.PI / 180) * len,
         origin[1] + Math.sin(deg * Math.PI / 180) * len];

    const closest = (bowA: number, bowB: number) => {
        // The first quarter is skipped: both edges leave the same node and
        // have to be close there, in any drawing.
        const a = samplePath(arrowPath(origin, far(0, 150), radius, headRoom, bowA)).slice(6);
        const b = samplePath(arrowPath(origin, far(4, 110), radius, headRoom, bowB)).slice(6);
        let min = Infinity;
        for (const p of a) for (const q of b) {
            min = Math.min(min, Math.hypot(p[0] - q[0], p[1] - q[1]));
        }
        return min;
    };

    const straight = closest(0, 0);
    const bowed = closest(bowFor(0, 1), bowFor(0, 2));

    /*
     * Thresholds from measurement, not from taste. On this deliberately harsh
     * case — two edges four degrees apart — straight lines pass 3.2 units from
     * each other and bowed ones 7.1, on a 200-unit picture drawn with a
     * 1.7-unit stroke. Four stroke widths of clear gap is the difference
     * between two lines and one thick one.
     */
    assert(straight < 4.5,
        `the straight case was already ${straight.toFixed(1)} apart, so this proves nothing`);
    assert(bowed > 6,
        `two near-parallel arrows still pass within ${bowed.toFixed(1)} units,`
        + " which is close to one stroke width of separation");
    assert(bowed > straight * 1.8,
        `bowing barely helped: ${straight.toFixed(1)} straight, ${bowed.toFixed(1)} bowed`);
});

test("the same pair always bows the same way", () => {
    // Sign taken from the node indices rather than from geometry, so a redraw
    // does not reshuffle the picture under a reader mid-item.
    const a: [number, number] = [30, 40], b: [number, number] = [170, 150];
    equal(arrowPath(a, b, 13, 14, bowFor(2, 5)).d, arrowPath(a, b, 13, 14, bowFor(2, 5)).d,
        "the same edge drew two different paths");
    assert(bowFor(0, 1) !== bowFor(0, 2),
        "two edges out of one node curve identically, which is what merged them");

    // And a fan out of one node must curve *both* ways. All one way moves the
    // whole fan together and leaves the gaps exactly where they were.
    const fan = [1, 2, 3, 4].map(j => bowFor(0, j));
    assert(fan.some(b => b > 0) && fan.some(b => b < 0),
        "every edge out of a node bows the same way, which does not open a fan");
});

/**
 * Near-parallel arrows, which are the ones that actually merge.
 *
 * Arrows crossing at a steep angle are perfectly legible — you can see they
 * cross. It is the near-parallel ones that fuse into a single thick line with
 * an ambiguous head at each end, and the first two attempts at this failed by
 * not making that distinction: a fixed bow moved every edge the same way, and
 * chasing *every* close approach spent the curvature on crossings that never
 * needed it, moving 14% of pairs to 12%.
 *
 * Measured only over near-parallel pairs, which is what the drawing is now
 * asked to keep apart.
 */
test("no two near-parallel arrows are drawn on top of each other", () => {
    const size = 200;

    const parse = (d: string) => {
        const m = /M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/.exec(d)!
            .map(Number);
        return { d, from: [m[1], m[2]] as [number, number], to: [m[5], m[6]] as [number, number] };
    };

    const merged = (useLayout: boolean) => seeded(useLayout ? 8101 : 8101, () => {
        let bad = 0, pairs = 0;

        for (let trial = 0; trial < 120; trial++) {
            const n = 5 + (trial % 6);
            const w = randomWeb(n, 0.28, false);
            const pts = scatterLayout(n).map(([x, y]) => [x * size, y * size] as [number, number]);
            const radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(n))));

            const edges: Array<{ from: number; to: number; both: boolean }> = [];
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (!w.adj[i][j] || i === j) continue;
                    if (w.adj[j][i] && j < i) continue;
                    edges.push({ from: i, to: j, both: w.adj[j][i] });
                }
            }
            if (edges.length < 2) continue;

            const paths = useLayout
                ? layoutArrows(edges, pts, radius, radius + 1)
                : edges.map(e => ({
                    d: arrowPath(pts[e.from], pts[e.to], radius, radius + 1,
                        bowFor(e.from, e.to)).d,
                }));
            const samples = paths.map(p => samplePath(parse(p.d)));

            for (let i = 0; i < edges.length; i++) {
                for (let j = i + 1; j < edges.length; j++) {
                    const ca = [pts[edges[i].to][0] - pts[edges[i].from][0],
                                pts[edges[i].to][1] - pts[edges[i].from][1]];
                    const cb = [pts[edges[j].to][0] - pts[edges[j].from][0],
                                pts[edges[j].to][1] - pts[edges[j].from][1]];
                    const cos = Math.abs((ca[0] * cb[0] + ca[1] * cb[1])
                        / ((Math.hypot(ca[0], ca[1]) || 1) * (Math.hypot(cb[0], cb[1]) || 1)));
                    if (cos <= 0.9) continue;

                    const shares = edges[i].from === edges[j].from || edges[i].from === edges[j].to
                        || edges[i].to === edges[j].from || edges[i].to === edges[j].to;
                    const k = shares ? 8 : 4;
                    const a = samples[i].slice(k, -k), b = samples[j].slice(k, -k);

                    let min = Infinity;
                    for (const p of a) for (const q of b) {
                        min = Math.min(min, Math.hypot(p[0] - q[0], p[1] - q[1]));
                    }
                    pairs++;
                    if (min < 10) bad++;
                }
            }
        }

        return { rate: pairs ? bad / pairs : 0, pairs };
    });

    const before = merged(false);
    const after = merged(true);

    assert(before.pairs > 200, `only ${before.pairs} near-parallel pairs to judge on`);
    assert(before.rate > 0.04,
        `a fixed bow already merged only ${(100 * before.rate).toFixed(1)}%, so this proves nothing`);
    assert(after.rate < 0.035,
        `${(100 * after.rate).toFixed(1)}% of near-parallel arrows still merge`);
    assert(after.rate < before.rate / 2.5,
        `barely better: ${(100 * before.rate).toFixed(1)}% to ${(100 * after.rate).toFixed(1)}%`);
});

test("every web draws its arrowheads from a marker of its own", () => {
    /*
     * The reason the heads never appeared, through three attempts at making
     * them bigger and brighter. Every instance defined `id="web-head"`, and a
     * page holds up to four: two webs, drawn twice because the carousel and the
     * all-at-once view both sit in the DOM with one hidden. `url(#web-head)`
     * resolves to the *first* match in the document — inside the hidden half —
     * and a marker in a `display: none` subtree does not render.
     */
    const template = readFileSync(
        "src/app/syllogimous/components/relational-web/relational-web.component.html", "utf8");

    assert(!/id="web-head"/.test(template),
        "the marker id is hardcoded, so every drawing on the page shares one");
    assert(/\[attr\.id\]="headId"/.test(template), "the marker does not take a per-instance id");
    assert(!/url\(#web-head\)/.test(template),
        "an arrow still points at the shared marker id");

    const component = readFileSync(
        "src/app/syllogimous/components/relational-web/relational-web.component.ts", "utf8");
    assert(/headId = `web-head-\$\{\+\+webInstance\}`/.test(component),
        "the id is not unique per instance");
});

/**
 * The palette is numbered from one, and counters start at zero.
 *
 * `--th-dim-0` is not defined by ThemeService, so asking for it produces a
 * declaration that is invalid at computed-value time. The browser drops it, and
 * because `fill` inherits in SVG the element falls through to the initial value
 * and is drawn black — which is what happened to the first marked node, and why
 * every other marker was one colour along from where it should have been.
 *
 * Checked at the source rather than only through `dimSlot`, because the bug was
 * never in a helper: it was an open-coded `% DIM_SLOTS` at the one call site
 * that had a zero-based counter, and the next one written that way would fail
 * in exactly the same silent fashion.
 */
test("no drawing asks for a dimension colour outside the defined range", () => {
    for (let i = 0; i < 40; i++) {
        const slot = dimSlot(i);
        assert(slot >= 1 && slot <= DIM_SLOTS,
            `dimSlot(${i}) gave ${slot}, outside --th-dim-1..${DIM_SLOTS}`);
    }

    const component = new RelationalWebComponent();
    for (let i = 0; i < 12; i++) {
        for (const css of [component.markColor(i), component.markFill(i)]) {
            for (const [, n] of css.matchAll(/--th-dim-(\d+)/g)) {
                assert(Number(n) >= 1 && Number(n) <= DIM_SLOTS,
                    `mark colour for slot ${i} names --th-dim-${n}, which no theme defines`);
            }
        }
    }

    /*
     * A literal zero can only come from a modulo on a zero-based counter, and
     * the fix for that is `dimSlot`, not a wider palette.
     */
    for (const path of [
        "src/app/syllogimous/components/relational-web/relational-web.component.ts",
        "src/app/syllogimous/utils/phrasing.ts",
    ]) {
        const source = readFileSync(path, "utf8");
        assert(!/--th-dim-\$\{[^}]*%[^}]*\}/.test(source),
            `${path} builds a dimension variable with a raw modulo; use dimSlot`);
    }
});

/**
 * The drawing has to be readable, and two of the reasons it was not are
 * properties of the layout rather than matters of taste.
 *
 * Appearance is checked by eye. These are not appearance: a node drawn on top
 * of another and an arrow passing through a node it has nothing to do with are
 * both wrong pictures, and both are computable from the numbers the component
 * already has.
 */
test("no two nodes are drawn on top of each other", () => {
    seeded(4711, () => {
        for (let n = 3; n <= 12; n++) {
            const radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(n))));
            const size = 200;
            for (let rep = 0; rep < 20; rep++) {
                const pts = scatterLayout(n).map(([x, y]) => [x * size, y * size] as [number, number]);
                for (let i = 0; i < pts.length; i++) {
                    for (let j = i + 1; j < pts.length; j++) {
                        const gap = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
                        assert(gap >= radius * 2,
                            `${n} nodes: two circles ${gap.toFixed(1)} apart with radius ${radius}`);
                    }
                }
            }
        }
    });
});

/**
 * An arrow that runs under an unrelated node reads as ending there.
 *
 * Measured on the edges that are actually drawn, over real generated webs,
 * because that is the picture -- scoring every possible pair counts arrows the
 * item does not have. A plain scatter leaves this at roughly one arrow in five;
 * `clearestScatter` picks among scatters on exactly this measure, which changes
 * nothing about how a layout is produced and only which of several is used.
 */
test("arrows rarely run through a node they have nothing to do with", () => {
    let plain = 0, chosen = 0, edges = 0;

    seeded(1234, () => {
        for (let n = 4; n <= 10; n++) {
            for (let rep = 0; rep < 25; rep++) {
                const web = randomWeb(n);
                // Once per *drawn* arrow, as `obstructions` counts them: a
                // mutual pair is one path with a head at each end, and counting
                // it twice quietly halves the reported rate.
                const drawn = edgeList(web.adj).length;
                if (!drawn) continue;
                edges += drawn;
                plain += obstructions(scatterLayout(n), web.adj);
                chosen += obstructions(clearestScatter(n, web.adj), web.adj);
            }
        }
    });

    const rate = chosen / edges;
    assert(chosen < plain,
        `choosing among scatters did not help: ${chosen} against ${plain}`);
    /*
     * The bar is set where a regression shows rather than where the number sits.
     *
     * It has been wrong once, and worth recording how: this measured the
     * straight segment between two centres, which an arrow has not been for a
     * long time — it bows, and since ports it leaves and arrives somewhere else
     * again. So the layout was chosen to clear nodes on a path nobody draws,
     * the reported figure was about 3%, and the arrows *drawn* were at 10.6%.
     * A measure that does not measure the thing shipped is worse than none: it
     * reports success while the fault is visible on screen.
     */
    assert(rate < 0.05,
        `${(rate * 100).toFixed(1)}% of drawn arrows still pass under an unrelated node`);
});

/**
 * The arrows must not be the faintest thing in a picture that is about arrows.
 *
 * They were `--th-text-dim`, the colour reserved for what should recede, while
 * every node label used `--th-text`. Checked at the stylesheet because that is
 * where it was decided and where it would be undone.
 */
test("arrows are drawn in the foreground colour", () => {
    const css = readFileSync(
        "src/app/syllogimous/components/relational-web/relational-web.component.css", "utf8");
    const rule = (name: string) =>
        css.slice(css.indexOf(`.${name} {`), css.indexOf("}", css.indexOf(`.${name} {`)));

    for (const name of ["web__arrow", "web__head", "web__loop"]) {
        assert(!/--th-text-dim/.test(rule(name)),
            `.${name} recedes, in a drawing whose whole content is its arrows`);
    }
    assert(!/transparent/.test(rule("web__node")),
        "a node is translucent, so an arrow behind it reads as running into it");
});

/**
 * The mode's weight sits where its demand is.
 *
 * Property items ask a yes-or-no about a definition; assignment and comparison
 * ask which node is which and whether two shapes are the same at all, and both
 * need the picture read rather than scanned. Measured over two hundred items so
 * a reweighting that drifts shows up rather than being argued about.
 */
test("property items are a small minority of the mode", () => {
    for (const rungs of [[], ["structural", "structure-match"]]) {
        const seen: Record<string, number> = {};
        seeded(31, () => {
            const ctx = context(rungs);
            for (let i = 0; i < 200; i++) {
                let q;
                try { q = createRelationalWeb(ctx, 5); } catch { continue; }
                const kind = q.answerMode === "map" ? "assignment"
                    : String(q.conclusion).includes("agree about") ? "properties"
                    : "comparison";
                seen[kind] = (seen[kind] ?? 0) + 1;
            }
        });
        const total = Object.values(seen).reduce((a, b) => a + b, 0);
        assert(total > 100, `only ${total} items built`);

        const share = (seen["properties"] ?? 0) / total;
        assert(share < 0.18, `properties are ${(share * 100).toFixed(0)}% of the mode`);

        const good = ((seen["assignment"] ?? 0) + (seen["comparison"] ?? 0)) / total;
        assert(good > 0.8, `assignment and comparison are only ${(good * 100).toFixed(0)}%`);
    }
});

/* ------------------------------------------------------------------ *
 * Where an arrow meets a node                                         *
 * ------------------------------------------------------------------ */

/**
 * The thing bowing could not fix.
 *
 * An arrow used to leave a node along the straight line to the other node's
 * centre, so two arrows heading roughly the same way left along roughly the
 * same line — and a bow bends the middle of a curve while leaving both ends
 * exactly where they were. Three arrows converging on a node arrived as one
 * thick stroke and which head belonged to which was unrecoverable.
 */
test("arrows leaving one node leave at different angles", () => {
    seeded(4242, () => {
        for (let trial = 0; trial < 120; trial++) {
            const n = 5 + (trial % 6);
            const pts = scatterLayout(n).map(([x, y]) => [x * 200, y * 200] as [number, number]);
            const w = randomWeb(n, 0.32, false);

            const edges: Array<{ from: number; to: number }> = [];
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (!w.adj[i][j] || i === j) continue;
                    if (w.adj[j][i] && j < i) continue;
                    edges.push({ from: i, to: j });
                }
            }
            if (edges.length < 2) continue;

            const gap = Math.PI / 4;
            const ports = portsFor(edges, pts, gap);

            // Every arrow end at each node, as a bearing.
            const atNode: number[][] = pts.map(() => []);
            edges.forEach((e, i) => {
                atNode[e.from].push(ports[i].from);
                atNode[e.to].push(ports[i].to);
            });

            for (const [node, bearings] of atNode.entries()) {
                if (bearings.length < 2) continue;
                const sorted = [...bearings].sort((a, b) => a - b);
                for (let i = 1; i < sorted.length; i++) {
                    const between = sorted[i] - sorted[i - 1];
                    /*
                     * The even-spread fallback: a node with nine arrows cannot
                     * give each of them an eighth of a turn, so the circle is
                     * shared out rather than the overflow piling onto the last.
                     */
                    const floor = Math.min(gap, (2 * Math.PI - gap) / bearings.length);
                    assert(between >= floor - 1e-9,
                        `node ${node} has two arrows ${between.toFixed(2)} radians apart`
                        + ` with ${bearings.length} on it`);
                }
            }
        }
    });
});

/**
 * The fan must come from the drawing, never from the structure.
 *
 * This is the property the whole mode rests on. If ports were assigned from
 * node indices, degrees or colours, two isomorphic webs would grow *identical*
 * fans and the answer would be readable straight off the picture without a
 * single arrow being followed. Sorting by bearing ties the arrangement to the
 * scatter, and the two scatters are drawn independently.
 */
test("the same shape laid out twice does not grow the same fans", () => {
    let compared = 0, alike = 0;

    seeded(31337, () => {
        for (let trial = 0; trial < 60; trial++) {
            const n = 6 + (trial % 4);
            const left = randomWeb(n, 0.3, false);
            const perm = randomPermutation(n);
            const right = permuteWeb(left, perm);

            const edgesFor = (w: typeof left) => {
                const out: Array<{ from: number; to: number }> = [];
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) {
                        if (!w.adj[i][j] || i === j) continue;
                        if (w.adj[j][i] && j < i) continue;
                        out.push({ from: i, to: j });
                    }
                }
                return out;
            };

            const le = edgesFor(left), re = edgesFor(right);
            if (le.length < 3) continue;

            const lp = scatterLayout(n).map(([x, y]) => [x * 200, y * 200] as [number, number]);
            const rp = scatterLayout(n).map(([x, y]) => [x * 200, y * 200] as [number, number]);

            const lports = portsFor(le, lp, Math.PI / 4);
            const rports = portsFor(re, rp, Math.PI / 4);

            /*
             * A node's fan, as the sorted gaps between its arrows — which is
             * what survives turning the picture, and so what a reader could
             * match on if the two webs shared it.
             */
            const fans = (edges: typeof le, ports: typeof lports) => {
                const at: number[][] = Array.from({ length: n }, () => []);
                edges.forEach((e, i) => { at[e.from].push(ports[i].from); at[e.to].push(ports[i].to); });
                return at.map(bs => {
                    const s = [...bs].sort((a, b) => a - b);
                    return s.map((v, i) => (i ? v - s[i - 1] : 0)).slice(1)
                        .map(g => g.toFixed(2)).join(",");
                });
            };

            const lf = fans(le, lports), rf = fans(re, rports);

            // Compared through the isomorphism: node v on the left is perm[v]
            // on the right, so those are the two a reader would be matching.
            for (let v = 0; v < n; v++) {
                if (lf[v].length < 3) continue;   // one arrow has no fan
                compared++;
                if (lf[v] === rf[perm[v]]) alike++;
            }
        }
    });

    assert(compared > 100, `only ${compared} fans were comparable`);
    assert(alike / compared < 0.05,
        `${alike} of ${compared} matched fans were drawn identically, so the`
        + " mapping is readable off the picture without following an arrow");
});

/**
 * How often two arrows sharing a node still read as one line.
 *
 * The bar is set where a regression shows rather than where the number happens
 * to sit. Measured over three hundred generated webs: straight chords put 17.4%
 * of same-node pairs within six units of each other, and ports with the
 * curvature search on top put 3.4%. Zero is not reachable — a node with six
 * arrows on a small canvas has no arrangement in which none of them crowd.
 */
test("arrows sharing a node rarely read as one line", () => {
    const size = 200;
    let merged = 0, pairs = 0;

    const parse = (d: string) => {
        const m = /M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/.exec(d)!
            .map(Number);
        return { d, from: [m[1], m[2]] as [number, number], to: [m[5], m[6]] as [number, number] };
    };

    seeded(9001, () => {
        for (let trial = 0; trial < 150; trial++) {
            const n = 5 + (trial % 6);
            const w = randomWeb(n, 0.28, false);
            const pts = scatterLayout(n).map(([x, y]) => [x * size, y * size] as [number, number]);
            const radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(n))));

            const edges: Array<{ from: number; to: number; both: boolean }> = [];
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (!w.adj[i][j] || i === j) continue;
                    if (w.adj[j][i] && j < i) continue;
                    edges.push({ from: i, to: j, both: w.adj[j][i] });
                }
            }
            if (edges.length < 2) continue;

            const drawn = layoutArrows(edges, pts, radius, radius + 1).map(a => parse(a.d));

            for (let i = 0; i < edges.length; i++) {
                for (let k = i + 1; k < edges.length; k++) {
                    const a = edges[i], b = edges[k];
                    const shares = a.from === b.from || a.from === b.to
                        || a.to === b.from || a.to === b.to;
                    if (!shares) continue;
                    pairs++;

                    const pa = samplePath(drawn[i]), pb = samplePath(drawn[k]);
                    let closest = Infinity;
                    for (const p of pa) {
                        for (const q of pb) {
                            closest = Math.min(closest, Math.hypot(p[0] - q[0], p[1] - q[1]));
                        }
                    }
                    if (closest < 6) merged++;
                }
            }
        }
    });

    assert(pairs > 2000, `only ${pairs} same-node pairs in the sample`);
    const rate = merged / pairs;
    assert(rate < 0.07,
        `${(rate * 100).toFixed(1)}% of arrows sharing a node read as one line`);
});

/**
 * The curvature search avoids nodes, not only other arrows.
 *
 * It scored a candidate purely on how near it passed to its neighbours, so an
 * arrow with no near-parallel rival took the first curvature offered however
 * squarely it crossed a node. An arrow passing under a node reads as ending
 * there, which in a mode whose whole content is which way each arrow runs is
 * not a cosmetic problem.
 *
 * Asserted on the paths `layoutArrows` actually returns, because the fault this
 * replaces was a measure that scored something else.
 */
test("a drawn arrow keeps clear of nodes it has nothing to do with", () => {
    const size = 200;
    let through = 0, drawn = 0;

    const parse = (d: string) => {
        const m = /M ([-\d.]+) ([-\d.]+) Q ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)/.exec(d)!
            .map(Number);
        return { d, from: [m[1], m[2]] as [number, number], to: [m[5], m[6]] as [number, number] };
    };

    seeded(2468, () => {
        for (let trial = 0; trial < 150; trial++) {
            const n = 5 + (trial % 6);
            const web = randomWeb(n, 0.28, false);
            const pts = clearestScatter(n, web.adj)
                .map(([x, y]) => [x * size, y * size] as [number, number]);
            const radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(n))));

            const edges = edgeList(web.adj);
            if (!edges.length) continue;

            const paths = layoutArrows(edges, pts, radius, radius + 1).map(a => parse(a.d));
            edges.forEach((e, i) => {
                drawn++;
                if (nodeClearance(paths[i], pts, [e.from, e.to]) < radius) through++;
            });
        }
    });

    assert(drawn > 500, `only ${drawn} arrows in the sample`);
    const rate = through / drawn;
    assert(rate < 0.05,
        `${(rate * 100).toFixed(1)}% of drawn arrows pass under an unrelated node`);
});
