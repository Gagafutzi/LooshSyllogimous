/**
 * How much of the premise set a conclusion needs.
 *
 * The complaint this file exists for: *"you didn't have to relate the whole
 * relation or near whole relation to reach the conclusion"*. Both pair pickers
 * were ported with v3's "usually the furthest, occasionally nearer" rule — a
 * 40% chance of dropping a band in the scale family, a flat 30% draw from every
 * pair in the composed spaces — on the reasoning that difficulty should vary.
 * It varies the wrong thing: a conclusion short of the diameter is reachable
 * without composing everything, and the premises that do not carry it are there
 * to be read and discarded.
 *
 * Tested on the pickers rather than on rendered items because the property is
 * about the *layout*, and a rendered premise list has already lost it — the
 * scramble means displayed order says nothing about graph distance.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    LINEAR_SCALES, buildBranching, buildChain, graphDistance, pickDistantPair,
} from "../src/app/syllogimous/utils/linear.utils";
import { buildNdWideConclusion } from "../src/app/syllogimous/utils/ndspace.utils";
import { depthReport } from "../src/app/syllogimous/utils/ability.utils";
import { createDeictic } from "../src/app/syllogimous/generators/deictic";
import { reversalTextFor } from "../src/app/syllogimous/utils/deictic.utils";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { createShapeRotation } from "../src/app/syllogimous/generators/shape-rotation";
import { createLinear } from "../src/app/syllogimous/generators/linear";
import { compareConstruction } from "../src/app/syllogimous/utils/construct.utils";
import { createGraphMatching } from "../src/app/syllogimous/generators/graph-matching";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

const strip = (t: string) => t.replace(/<[^>]+>/g, "");

/** Nothing switched on: no circular axes, no under-specification. */
function ndContext(deep = true, loops = 0): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => loops,
            spread: () => null, depthFor: () => 0, scramble: 100,
            // Absent would read as on, so the off case has to say so outright.
            deepConclusions: deep,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** The longest shortest path: what a full-depth conclusion has to span. */
function diameter(neighbors: Record<string, string[]>): number {
    const words = Object.keys(neighbors);
    let max = 0;
    for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
            const d = graphDistance(words[i], words[j], neighbors);
            if (Number.isFinite(d)) max = Math.max(max, d);
        }
    }
    return max;
}

test("a conclusion pair spans the whole layout, not part of it", () => {
    seeded(20260823, () => {
        for (let n = 3; n <= 9; n++) {
            const words = Array.from({ length: n + 1 }, (_, i) => `w${i}`);

            for (const layout of [buildChain(words), buildBranching(words)]) {
                const far = diameter(layout.neighbors);
                if (far < 2) continue;

                for (let rep = 0; rep < 60; rep++) {
                    const pair = pickDistantPair(layout);
                    assert(!!pair, `no pair at all on a ${n}-premise layout`);
                    equal(graphDistance(pair![0], pair![1], layout.neighbors), far,
                        `asked about a pair ${far} apart at most, got a shallower one`);
                }
            }
        }
    });
});

/**
 * Slack is for callers that need several distinct pairs, and nothing else.
 *
 * A layout usually holds one or two pairs at the diameter, so a second claim
 * demanding the same depth fails to generate rather than coming out slightly
 * shallower. Widening is bounded so "could not find a deep pair" can never
 * quietly become "asked about two adjacent objects".
 */
test("slack widens by exactly as much as it is asked to", () => {
    seeded(915, () => {
        const words = Array.from({ length: 9 }, (_, i) => `w${i}`);
        const layout = buildChain(words);
        const far = diameter(layout.neighbors);

        for (const slack of [0, 1, 2, 3]) {
            for (let rep = 0; rep < 80; rep++) {
                const pair = pickDistantPair(layout, slack);
                if (!pair) continue;
                const d = graphDistance(pair[0], pair[1], layout.neighbors);
                assert(d <= far, `a pair further apart than the diameter: ${d} > ${far}`);
                assert(d >= far - slack,
                    `slack ${slack} reached ${far - d} bands down, which is further than asked`);
            }
        }
    });
});

/**
 * The floor cannot be met by refusing to build.
 *
 * The first cut of this change made five configurations throw `Cannot
 * generate` — the depth was honoured by producing nothing, which is the one
 * outcome worse than a shallow conclusion.
 */
test("every layout that has a distant pair yields one", () => {
    seeded(3311, () => {
        for (let n = 2; n <= 12; n++) {
            const words = Array.from({ length: n + 1 }, (_, i) => `w${i}`);
            for (const layout of [buildChain(words), buildBranching(words)]) {
                if (diameter(layout.neighbors) < 2) continue;
                assert(!!pickDistantPair(layout),
                    `a ${n}-premise layout with a distant pair returned none`);
            }
        }
    });
});

/**
 * Width: an N-dimensional map deserves an N-dimensional conclusion.
 *
 * Seven premises' worth of relations and a conclusion naming one axis was the
 * other half of the same complaint, and it is a separate failure from depth —
 * that item was at full depth and one-seventh width. `buildNdConclusion` asked
 * about a single axis whatever the item was built on, and *which* axis had no
 * good answer, because any choice makes the rest of every premise decoration.
 *
 * Counted by axis colour rather than by parsing relation words: every clause is
 * painted with its axis's `dim-N` class, in the conclusion exactly as in the
 * premises, so the two are comparable without knowing any mode's vocabulary.
 */
const dims = (html: string) =>
    new Set([...html.matchAll(/\bdim-(\d+)\b/g)].map(m => m[1]));

test("a composed space asks about every axis it is built on", () => {
    const ctx = ndContext();
    let checked = 0;

    seeded(4242, () => {
        for (const type of [
            EnumQuestionType.Space3D, EnumQuestionType.Space4D,
            EnumQuestionType.Space5D, EnumQuestionType.Space6D,
            EnumQuestionType.Space7D,
        ]) {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = createNdSpace(ctx, 3, type); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                if (!conclusion || q.answerMode !== "boolean") continue;

                const stated = new Set<string>();
                for (const p of q.premises) for (const d of dims(p)) stated.add(d);
                if (stated.size < 2) continue;

                const asked = dims(conclusion);
                // The single-axis fallback is legitimate for the layouts that
                // cannot carry a wide claim, and there is no circular axis and
                // no under-specification here, so none of them should be.
                equal(asked.size, stated.size,
                    `${type}: premises name ${stated.size} axes, conclusion names ${asked.size}`);
                checked++;
            }
        }
    });

    assert(checked > 20, `only ${checked} items were wide enough to check`);
});

/**
 * Shape Rotation must not ask back a separation a premise stated.
 *
 * The reported item read: *Cord is 2 corners clockwise from Hostess* ... *the
 * square is turned 180 degrees* => *after the turns, Hostess is 2 corners
 * clockwise from Cord*. Two failures at once. The pair was one a premise
 * related directly, so the conclusion was that premise read back; and on a
 * square a separation of two is its own reverse, so naming either direction is
 * the same claim and the reversal in the wording changed nothing.
 *
 * The invariance the mode teaches is real -- a turn cannot change how two
 * objects sit relative to each other -- but it has to be applied to a relation
 * that took work to establish, or the item asks nothing.
 */
test("a rotation conclusion is not a premise read back", () => {
    const ctx = ndContext();
    let checked = 0;
    const subjectsOf = (html: string) =>
        [...html.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);

    seeded(6006, () => {
        for (let n = 4; n <= 8; n++) {
            for (let rep = 0; rep < 40; rep++) {
                let q;
                try { q = createShapeRotation(ctx, n); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                // The other form is a choice among corner names, and has none.
                if (!conclusion.includes("after the turns")) continue;

                const asked = subjectsOf(conclusion);
                if (asked.length !== 2) continue;
                const key = [...asked].sort().join(" ");

                for (const premise of q.premises) {
                    const named = subjectsOf(premise);
                    if (named.length !== 2) continue;   // an absolute placement
                    assert([...named].sort().join(" ") !== key,
                        `asked about ${asked.join(" / ")}, which a premise states outright`);
                }
                checked++;
            }
        }
    });

    assert(checked > 15, `only ${checked} relative-form items were produced`);
});

const subjectsOf = (html: string) =>
    [...html.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);

/** Every rung on, so the relational form is reachable. */
function webCtx(): GeneratorContext {
    const ctx = ndContext();
    return { ...ctx, hasRung: () => true,
        progressionService: { hasRung: () => true, depthBonusFor: () => 0 } as unknown as ProgressionService };
}

/**
 * The relational form must show the pairing, not assert that one exists.
 *
 * Its derivation used to read *"every one of the first set's links can be
 * matched onto the second's, name for name"* -- true, and the conclusion in
 * different words. The pairing is the entire content of the mode and was the
 * one thing never stated, so someone who could already see it did not need the
 * line and someone who could not was told the answer twice.
 */
test("a structure match shows which name goes with which", () => {
    const ctx = webCtx();
    let sameItems = 0, diffItems = 0;

    seeded(8181, () => {
        for (let i = 0; i < 60; i++) {
            let q;
            try { q = createGraphMatching(ctx, 5); } catch { continue; }
            if (!String(q.conclusion).includes("same structure")) continue;

            const text = q.explanation.join(" ");
            const pairing = q.explanation.find(l => l.startsWith("Pair them off:"));
            assert(!!pairing, "the derivation never states the pairing");

            /*
             * Every object on both sides appears in the pairing line. A partial
             * correspondence is the failure this replaces -- it reads as an
             * explanation while leaving the reader to find the rest.
             */
            const paired = new Set(subjectsOf(pairing!));
            for (const word of q.bucket) {
                assert(paired.has(word), `${word} is in the item but not in the pairing`);
            }

            if (q.isValid) {
                // One correspondence line per link, and no sampling: four to six
                // is a short list, and "and so on" asks to be taken on trust
                // about the step in doubt.
                const links = q.explanation.filter(l => l.includes("&rarr;")).length;
                const stated = q.premises.filter(p => !p.endsWith(":")).length;
                equal(links * 2, stated, "the derivation skipped some links");
                sameItems++;
            } else {
                assert(/does not say that|no counterpart for/.test(text),
                    "a false item does not name the link that disagrees");
                diffItems++;
            }
        }
    });

    assert(sameItems > 3 && diffItems > 3,
        `only saw ${sameItems} matching and ${diffItems} differing items`);
});

/**
 * The absolute form asks about the far end of the chain.
 *
 * Drawing at random meant asking about a *named* object about half the time,
 * and a named object's answer is its stated corner plus the turns -- one
 * premise and the arithmetic, with every relative placement in the item unused.
 */
test("a position question is not answered by one premise", () => {
    const ctx = ndContext();
    let asked = 0;

    seeded(1357, () => {
        for (let n = 4; n <= 8; n++) {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = createShapeRotation(ctx, n); } catch { continue; }
                const prompt = q.choicePrompt;
                if (!prompt.includes("Which corner")) continue;   // the relative form
                asked++;

                const who = /Which corner is (.*?) on after/.exec(prompt)![1];
                /*
                 * A named object states its own corner outright. Asking about
                 * one is asking for a premise back, with the turns applied.
                 */
                const named = q.premises.some(p => {
                    const m = /^<span class="subject">([^<]*)<\/span> is on the/.exec(p);
                    return m?.[1] === who;
                });
                assert(!named, `asked where ${who} is, and a premise says outright`);
            }
        }
    });

    assert(asked > 20, `only ${asked} absolute-form items in the sample`);
});

/**
 * And it is the commoner of the two forms.
 *
 * A relative claim is invariant under rotation, so the turns are there to be
 * dismissed rather than computed. That is worth teaching and worth a quarter of
 * the items; it is not worth most of them.
 */
test("the form where the turns matter is the commoner one", () => {
    const ctx = ndContext();
    let absolute = 0, relative = 0;

    seeded(2468, () => {
        for (let rep = 0; rep < 120; rep++) {
            let q;
            try { q = createShapeRotation(ctx, 6); } catch { continue; }
            if (q.choicePrompt.includes("Which corner")) absolute++;
            else relative++;
        }
    });

    assert(absolute > relative * 1.5,
        `${absolute} absolute against ${relative} relative`);
});

/**
 * A claim answerable halfway through the reading, beside one that is not.
 *
 * With the depth floor requiring the whole premise set, a single conclusion can
 * only ever say "you did not get to the end". A checkpoint says where the
 * thread was lost, and the per-slot result screen reports the two separately.
 */
test("a checkpoint claim follows from the first half of the premises", () => {
    const ctx = ndContext();
    const withCheckpoint = { ...ctx, hasRung: (_t: string, r: string) => r === "checkpoint" } as GeneratorContext;
    let seen = 0;

    seeded(9090, () => {
        for (let n = 5; n <= 8; n++) {
            for (let rep = 0; rep < 20; rep++) {
                let q;
                try { q = createLinear(withCheckpoint, n, EnumQuestionType.LinearVertical); } catch { continue; }
                if (q.answerMode !== "construct" || q.construct.length !== 2) continue;
                seen++;

                const [first, last] = q.construct;
                assert(/first/i.test(first.slots[0].label),
                    `the early claim is not labelled by where it is answerable from: ${first.slots[0].label}`);
                assert(/all/i.test(last.slots[0].label),
                    `the late claim is not labelled as needing everything: ${last.slots[0].label}`);

                // Two different questions, or the checkpoint is the answer.
                const same = [first.a, first.b].sort().join() === [last.a, last.b].sort().join();
                assert(!same, "the checkpoint asks about the same pair as the conclusion");
            }
        }
    });

    assert(seen > 20, `only ${seen} checkpoint items in the sample`);
});

/**
 * Below five premises the midpoint is one or two premises deep, which is the
 * shallow conclusion the depth work exists to prevent. Serving one deliberately
 * would teach the habit being removed.
 */
test("short items get no checkpoint", () => {
    const ctx = ndContext();
    const withCheckpoint = { ...ctx, hasRung: (_t: string, r: string) => r === "checkpoint" } as GeneratorContext;

    seeded(4321, () => {
        for (const n of [2, 3, 4]) {
            for (let rep = 0; rep < 15; rep++) {
                let q;
                try { q = createLinear(withCheckpoint, n, EnumQuestionType.LinearVertical); } catch { continue; }
                assert(q.construct.length < 2,
                    `a ${n}-premise item carries a checkpoint, whose halfway is one premise deep`);
            }
        }
    });
});

/**
 * The result screen has to report the two apart, or the checkpoint has bought a
 * second question and no diagnosis.
 */
test("a checkpoint answer is reported slot by slot", () => {
    const ctx = ndContext();
    const withCheckpoint = { ...ctx, hasRung: (_t: string, r: string) => r === "checkpoint" } as GeneratorContext;

    seeded(555, () => {
        for (let rep = 0; rep < 40; rep++) {
            let q;
            try { q = createLinear(withCheckpoint, 6, EnumQuestionType.LinearVertical); } catch { continue; }
            if (q.construct.length !== 2) continue;

            // Right on the first, wrong on the second.
            const picks = q.construct.map((c, i) => c.slots.map(slot => ({
                direction: i === 0 ? slot.answerDirection : (slot.answerDirection + 1) % 3,
                magnitude: slot.answerMagnitude,
            })));

            const rows = compareConstruction(q.construct, picks);
            equal(rows.length, 2, "the two claims are not reported separately");
            assert(rows[0][0].ok, "the first claim was marked wrong when it was right");
            assert(!rows[1][0].ok, "the second claim was marked right when it was wrong");
            return;
        }
        assert(false, "no checkpoint item was built to check");
    });
});

/**
 * The first half has to actually be first on the page.
 *
 * The claim is placed at a boundary in the *reading*, so a premise that crossed
 * it would be one the reader did not have when the claim became answerable.
 * Both halves may be shuffled — the claim follows from the set before the
 * boundary, not from an order within it — but never across.
 */
test("a checkpoint's premises stay on their own side of the boundary", () => {
    const ctx = ndContext();
    const withCheckpoint = { ...ctx, hasRung: (_t: string, r: string) => r === "checkpoint" } as GeneratorContext;
    let checked = 0;

    seeded(1212, () => {
        for (let n = 5; n <= 8; n++) {
            for (let rep = 0; rep < 20; rep++) {
                let q;
                try { q = createLinear(withCheckpoint, n, EnumQuestionType.LinearVertical); } catch { continue; }
                if (q.construct.length !== 2) continue;
                checked++;

                const half = Math.floor(n / 2);
                const named = (line: string) =>
                    [...line.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);

                /*
                 * Everything the first claim asks about has to have been named
                 * before the boundary. That is weaker than re-deriving the
                 * relation and is the part a reordering bug would break: a
                 * premise that drifted past the line takes its objects with it.
                 */
                const early = new Set(q.premises.slice(0, half).flatMap(named));
                const [a, b] = [q.construct[0].a, q.construct[0].b];
                assert(early.has(a) && early.has(b),
                    `the first claim asks about ${a}/${b}, not both named in the first ${half}`);
            }
        }
    });

    assert(checked > 20, `only ${checked} checkpoint items in the sample`);
});

/**
 * Meta and checkpoints do not combine, structurally rather than fussily.
 *
 * A meta premise *replaces* premises with a claim about a different pair, so
 * after it runs there is no prefix that determines what the checkpoint asks —
 * and a checkpoint the reader cannot answer at the checkpoint is not one.
 */
test("a checkpoint item carries no meta premises", () => {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("meta", true);
    const ctx = { ...ndContext(), settings,
        hasRung: (_t: string, r: string) => r === "checkpoint" } as GeneratorContext;

    seeded(313, () => {
        for (let rep = 0; rep < 40; rep++) {
            let q;
            try { q = createLinear(ctx, 6, EnumQuestionType.LinearVertical); } catch { continue; }
            if (q.construct.length !== 2) continue;
            assert(!q.premises.some(p => p.includes("relates to")),
                "a checkpoint item carries a meta premise, so its prefix no longer determines the claim");
        }
    });
});

/**
 * Branching layouts are already long, which is why nothing was done about them.
 *
 * The plan called for one more piece of the depth work: choose the conclusion
 * pair first and build the layout around it, on the reasoning that a branching
 * layout is free to come out as a star where every pair is two steps apart
 * however many premises went in. The picker would then correctly report that
 * the deepest conclusion available is a shallow one, and no choice of pair
 * could repair it.
 *
 * Measured, the premise does not hold. `pickBase` weights the ends of what
 * exists so far, so a new object usually *extends* the arrangement rather than
 * hanging off its middle, and the mean span over six to twelve premises is
 * about eight. Laying a spine first — half the links end to end before anything
 * branches — moved that to 8.1 and cost ten points of branching, which is the
 * rung's own purpose. It was built, measured, and reverted.
 *
 * This test is what remains of it: the property the inversion would have
 * guaranteed, held by the layout builder as it stands. If it ever stops
 * holding, the inversion is worth building after all.
 */
test("a branching layout is long enough to ask across", () => {
    seeded(6161, () => {
        for (let n = 6; n <= 12; n++) {
            const words = Array.from({ length: n + 1 }, (_, i) => `w${i}`);
            let total = 0, worst = Infinity;
            for (let rep = 0; rep < 40; rep++) {
                const d = diameter(buildBranching(words).neighbors);
                total += d;
                worst = Math.min(worst, d);
            }
            const mean = total / 40;
            assert(mean >= n * 0.6,
                `${n} premises branch to a mean span of ${mean.toFixed(1)}`);
            assert(worst >= 3,
                `${n} premises produced a span of ${worst}, which is close to a star`);
        }
    });
});

/**
 * With the spine in place, the conclusion a real item asks about spans most of
 * what was stated -- which is what the whole of section 2 is for.
 */
test("a branching item still asks about a distant pair", () => {
    const ctx = ndContext();
    const branching = { ...ctx, hasRung: (_t: string, r: string) => r === "branching" } as GeneratorContext;

    seeded(818, () => {
        for (const n of [5, 7, 9]) {
            let shallow = 0, built = 0;
            for (let rep = 0; rep < 30; rep++) {
                let q;
                try { q = createLinear(branching, n, EnumQuestionType.LinearVertical); } catch { continue; }
                built++;
                const named = (line: string) =>
                    [...line.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);
                const asked = named(String(q.conclusion));
                if (asked.length !== 2) continue;
                // A pair stated outright in a premise is the shallow case.
                if (q.premises.some(p => {
                    const s = named(p);
                    return s.length === 2 && s.includes(asked[0]) && s.includes(asked[1]);
                })) shallow++;
            }
            assert(built > 10, `only ${built} items at ${n} premises`);
            equal(shallow, 0, `${shallow} of ${built} branching items asked back a stated pair`);
        }
    });
});

/* ------------------------------------------------------------------ *
 * The switch                                                          *
 * ------------------------------------------------------------------ */

/**
 * Everything above describes the deep model. This describes the other one.
 *
 * The switch is only worth having if its two positions produce different
 * items, and only honest if the off position is the behaviour that shipped
 * before the depth work rather than a softened version of what replaced it. So
 * each of the three things the switch governs is asserted to come back: the
 * one-axis claim, the pair drawn short of the diameter, and the rotation form
 * that asks about a random object.
 *
 * They are asserted as *frequencies*, because the old rules were probabilistic
 * — a 30% flat draw, a 40% band drop, a two-in-five split. A single shallow
 * item proves nothing either way; a run of them without one proves the switch
 * did nothing.
 */
test("switching the deeper conclusions off puts the one-axis claim back", () => {
    const ctx = ndContext(false);
    let wide = 0, narrow = 0;

    seeded(4242, () => {
        for (const type of [
            EnumQuestionType.Space4D, EnumQuestionType.Space5D,
            EnumQuestionType.Space6D, EnumQuestionType.Space7D,
        ]) {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = createNdSpace(ctx, 3, type); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                if (!conclusion || q.answerMode !== "boolean") continue;

                const stated = new Set<string>();
                for (const p of q.premises) for (const d of dims(p)) stated.add(d);
                if (stated.size < 2) continue;

                if (dims(conclusion).size === stated.size) wide++; else narrow++;
            }
        }
    });

    assert(narrow > 10, `only ${narrow} one-axis conclusions; the switch did nothing`);
    assert(wide === 0,
        `${wide} conclusions still named every axis with the switch off`);
});

test("switching it off lets a pair short of the diameter through", () => {
    const ctx = ndContext(false);
    let short = 0, full = 0;

    seeded(20260824, () => {
        for (let n = 5; n <= 9; n++) {
            for (const layout of [buildChain(
                Array.from({ length: n + 1 }, (_, i) => `w${i}`))]) {
                const far = diameter(layout.neighbors);
                if (far < 3) continue;

                for (let rep = 0; rep < 80; rep++) {
                    const pair = pickDistantPair(layout, 0, true);
                    assert(!!pair, "no pair at all");
                    const d = graphDistance(pair![0], pair![1], layout.neighbors);
                    // The floor the old rule kept: a stated pair is still not
                    // asked back, which was never the part that was wrong.
                    assert(d >= 2, `the old rule handed back a stated pair`);
                    if (d < far) short++; else full++;
                }
            }
        }
    });

    assert(short > 20, `only ${short} pairs fell short of the diameter`);
    assert(full > 20, `only ${full} pairs reached it; the old rule preferred it`);
});

test("switching it off asks a rotation about whoever it likes", () => {
    const ctx = ndContext(false);
    let restated = 0, relative = 0;
    const named = (html: string) =>
        [...html.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1]);

    seeded(6006, () => {
        for (let n = 4; n <= 8; n++) {
            for (let rep = 0; rep < 40; rep++) {
                let q;
                try { q = createShapeRotation(ctx, n); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                if (!conclusion.includes("after the turns")) continue;

                const asked = named(conclusion);
                if (asked.length !== 2) continue;
                relative++;

                const key = [...asked].sort().join(" ");
                for (const premise of q.premises) {
                    const pair = named(premise);
                    if (pair.length !== 2) continue;
                    if ([...pair].sort().join(" ") === key) { restated++; break; }
                }
            }
        }
    });

    assert(relative > 30,
        `only ${relative} relative items; off, they are meant to be the commoner form`);
    assert(restated > 0,
        "no conclusion restated a premise, so the rotation guard is still on");
});

/**
 * A ring is an axis too.
 *
 * The wide claim declined on any item carrying a circular axis, because a
 * displacement has no clause of the shape the claim is a list of. So the modes
 * that make a ring the interesting dimension were exactly the ones that never
 * got a wide conclusion — the fallback was silent, and an item with a loop in
 * it looked like an item the width work had simply missed.
 *
 * Checked by axis colour like the straight case. The arithmetic behind the new
 * clause is checked separately, below, against a layout whose coordinates are
 * written down rather than generated — a clause naming a number of steps is a
 * stronger claim than a direction word, and one wrong in the generator rather
 * than in the wording would be graded confidently against a claim nobody could
 * derive.
 */
test("a ring gets named in the conclusion like any other axis", () => {
    const ctx = ndContext(true, 1);
    let wide = 0, ringed = 0;

    seeded(90210, () => {
        for (const type of [
            EnumQuestionType.Space3D, EnumQuestionType.Space4D,
            EnumQuestionType.Space5D, EnumQuestionType.Space6D,
        ]) {
            for (let rep = 0; rep < 30; rep++) {
                let q;
                try { q = createNdSpace(ctx, 3, type); } catch { continue; }
                const conclusion = String(q.conclusion ?? "");
                if (!conclusion || q.answerMode !== "boolean") continue;

                const stated = new Set<string>();
                for (const p of q.premises) for (const d of dims(p)) stated.add(d);
                if (stated.size < 2) continue;

                // A loop shows up as a step count or as one of the two phrases
                // that stand in for one; a straight axis never says either.
                if (/\d+ steps? (clockwise|anticlockwise|later|earlier)|half a cycle away|diametrically opposite/
                    .test(conclusion)) ringed++;

                equal(dims(conclusion).size, stated.size,
                    `${type}: premises name ${stated.size} axes, conclusion names`
                    + ` ${dims(conclusion).size} — ${conclusion}`);
                wide++;
            }
        }
    });

    assert(wide > 20, `only ${wide} items were wide enough to check`);
    assert(ringed > 0,
        "no conclusion stated a displacement, so the circular clause is unused");
});

/**
 * The ring arithmetic, against coordinates nobody generated.
 *
 * A loop of six with the two objects four apart: read as a coordinate
 * difference that is "four", and read as a ring it is **two steps the other
 * way**, because nobody says the long way round about a dial. That is the one
 * mistake this clause can make and the one an item would never reveal — both
 * readings produce a confident, well-formed sentence, and only one of them is
 * what the premises say.
 *
 * Written out by hand for exactly that reason: a generated layout would be
 * checked against the same code that built it.
 */
test("a displacement in a wide claim is the short way round", () => {
    const ring = { scale: LINEAR_SCALES["horizontal"], modulus: 6 };
    const straight = { scale: LINEAR_SCALES["vertical"] };

    const layout = {
        words: ["Ash", "Bee"],
        axes: [ring, straight],
        // Four *forward* on the ring is two back, and Ash is plainly above Bee.
        coords: { Ash: [4, 1], Bee: [0, 0] },
        edges: [{ from: "Bee", to: "Ash", deltas: [4, 1] }],
        neighbors: { Ash: ["Bee"], Bee: ["Ash"] },
        branching: false,
    } as unknown as Parameters<typeof buildNdWideConclusion>[0];

    seeded(11, () => {
        const c = buildNdWideConclusion(layout, "Ash", "Bee", true, false);
        assert(!!c, "a two-axis layout with a ring could not carry a wide claim");

        const text = strip(String(c!.text));
        assert(/\b2 steps anticlockwise\b/.test(text),
            `four round a loop of six is two anticlockwise, not: ${text}`);
        assert(!/\b4 steps\b/.test(text), `the long way round was stated: ${text}`);
        // The straight axis is still there and still says what it always said.
        assert(text.includes(LINEAR_SCALES["vertical"].direction[0]),
            `the straight axis went missing: ${text}`);
    });

    // A false claim has to be false *on the ring* when the ring is what it
    // lies about — a wrong displacement, not a wrong direction word.
    seeded(12, () => {
        let lied = 0;
        for (let rep = 0; rep < 40; rep++) {
            const c = buildNdWideConclusion(layout, "Ash", "Bee", false, false);
            if (!c) continue;
            const text = strip(String(c!.text));
            if (c!.axis === 0) {
                assert(!/\b2 steps anticlockwise\b/.test(text),
                    `a false claim restated the true displacement: ${text}`);
                lied++;
            }
        }
        assert(lied > 5, `the ring never carried the lie in ${40} draws`);
    });
});

/* ------------------------------------------------------------------ *
 * Deictic                                                             *
 * ------------------------------------------------------------------ */

/**
 * Four statements about positions, a reversal, and an answer read off exactly
 * one of the four. That was the fourth of the reported instances, and it is the
 * one no floor could repair: the grid statements are independent facts, so a
 * conclusion about a position can only ever need the statement about *that*
 * position.
 *
 * So the grid is stated one short and the missing position is the one asked
 * about. The solver below is the reader: it takes the list of things from the
 * setup line, reads each statement as ruling one of them out, applies whichever
 * reversals were stated, and finds the answer by what is left over. It never
 * looks at the spec.
 */
const POLE_FLIP: Record<string, string> = {
    I: "you", you: "I", here: "there", there: "here", now: "then", then: "now",
};

const REVERSALS: Record<string, string[]> = {
    person: ["I", "you"], place: ["here", "there"], time: ["now", "then"],
};

function readStatement(text: string): { key: string; symbol: string } | null {
    const m = /^When (I|you) (?:am|are) (.+?), (?:I|you) hold (.+)$/.exec(text.trim());
    if (!m) return null;
    return { key: [m[1], ...m[2].split(/\s+/)].join("|"), symbol: m[3].trim() };
}

/** Swap the poles of every reversed axis, which is what a reversal states. */
const flipKey = (key: string, reversed: Set<string>) =>
    key.split("|")
        .map(word => [...reversed].some(ax => REVERSALS[ax].includes(word))
            ? POLE_FLIP[word] : word)
        .join("|");

test("a deictic answer is what the other positions leave over", () => {
    const ctx = ndContext();
    const params = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Deictic];
    let checked = 0, eliminated = 0;

    for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
        for (let run = 0; run < 12; run++) {
            const q = seeded(run * 7919 + n * 31, () => createDeictic(ctx, n));

            const things = subjectsOf(q.setup.join(" "));
            assert(things.length > 0, "the item never listed what there is to hold");

            const reversed = new Set<string>();
            const stated = new Map<string, string>();
            for (const raw of q.premises) {
                const text = strip(raw);
                for (const axis of Object.keys(REVERSALS)) {
                    if (text.toLowerCase() === reversalTextFor(axis as never).toLowerCase()) {
                        reversed.add(axis);
                    }
                }
                const st = readStatement(text);
                if (st) stated.set(st.key, st.symbol);
            }

            const asked = readStatement(strip(String(q.conclusion)));
            assert(!!asked, `could not read the conclusion: ${strip(String(q.conclusion))}`);

            const landed = flipKey(asked!.key, reversed);
            let correct = stated.get(landed);
            if (correct === undefined) {
                // Elimination: every stated position accounts for one thing.
                const spoken = new Set(stated.values());
                const left = things.filter(t => !spoken.has(t));
                equal(left.length, 1,
                    `${left.length} things unaccounted for, so the unstated`
                    + ` position holds any of them`);
                correct = left[0];
                eliminated++;
            }

            equal(correct === asked!.symbol, q.isValid,
                `the premises say ${correct}, the item claims ${asked!.symbol}`
                + ` and calls it ${q.isValid}`);
            checked++;
        }
    }

    assert(checked > 40, `only ${checked} items were read back`);
    assert(eliminated === checked,
        `${checked - eliminated} items stated the position they asked about`);
});

/** Off, the position asked about is stated outright, as it always was. */
test("switching it off states every position again", () => {
    const ctx = ndContext(false);
    let restated = 0, checked = 0;

    const params = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Deictic];
    for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
        for (let run = 0; run < 12; run++) {
            const q = seeded(run * 7919 + n * 31, () => createDeictic(ctx, n));

            const reversed = new Set<string>();
            const stated = new Map<string, string>();
            for (const raw of q.premises) {
                const text = strip(raw);
                for (const axis of Object.keys(REVERSALS)) {
                    if (text.toLowerCase() === reversalTextFor(axis as never).toLowerCase()) {
                        reversed.add(axis);
                    }
                }
                const st = readStatement(text);
                if (st) stated.set(st.key, st.symbol);
            }

            const asked = readStatement(strip(String(q.conclusion)));
            assert(!!asked, "could not read the conclusion");
            const correct = stated.get(flipKey(asked!.key, reversed));
            assert(correct !== undefined,
                "off the deep model, the position asked about should be stated");
            equal(correct === asked!.symbol, q.isValid,
                `off the floor, the answer stopped following: ${asked!.symbol}`);
            restated++;
            checked++;
        }
    }

    equal(restated, checked, "some items withheld a position with the switch off");
});

/* ------------------------------------------------------------------ *
 * Reporting it                                                        *
 * ------------------------------------------------------------------ */

/**
 * The reading that settles the original claim.
 *
 * *"Conclusion depth is often unrelated to the premise depth of logic"* was
 * made from screenshots, which is the only evidence available when nothing
 * measures it — and a screenshot cannot say whether a shallow item was typical
 * or unlucky. Two decisions in `depthReport` decide whether the answer means
 * anything, and both are the kind that look like rounding until they are wrong.
 */
const trial = (type: EnumQuestionType, premises: number, depth: number) => ({
    type, premises, rungs: [], seconds: null, estimate: 0, guess: 0.5,
    correct: true, depth,
});

test("an unmeasured mode is absent from the depth report, not reported as zero", () => {
    const report = depthReport([
        trial(EnumQuestionType.NestedSpaces, 4, 2),
        // Depth 0 is "this generator does not measure it", and averaging it in
        // would report every unmeasured mode as maximally broken.
        trial(EnumQuestionType.Distinction, 4, 0),
        trial(EnumQuestionType.Distinction, 5, 0),
    ]);

    equal(report.length, 1, "a mode with no measured depth appeared in the report");
    equal(report[0].type, EnumQuestionType.NestedSpaces, "the wrong mode survived");
    equal(report[0].trials, 1, "the unmeasured trials were counted anyway");
});

test("the share is averaged per item, not taken between the two means", () => {
    /*
     * Two items: one of two premises answered from both, one of ten answered
     * from two. Per item that is 100% and 20%, so 60% — a mode that serves a
     * shallow item half the time. Between the means it is 4/6, or 67%, which
     * describes an item nobody was ever served.
     */
    const report = depthReport([
        trial(EnumQuestionType.Direction, 2, 2),
        trial(EnumQuestionType.Direction, 10, 2),
    ]);

    equal(report.length, 1, "the two trials did not land in one mode");
    equal(Math.round(report[0].share * 100), 60,
        `share came out ${Math.round(report[0].share * 100)}%, so it is a ratio of means`);
    equal(Math.round(report[0].worst * 100), 20,
        "worst is not the shallowest item served");
});

test("the shallowest mode is listed first", () => {
    const report = depthReport([
        trial(EnumQuestionType.NestedSpaces, 4, 4),
        trial(EnumQuestionType.Direction, 4, 1),
        trial(EnumQuestionType.Deictic, 4, 2),
    ]);

    equal(report.map(r => r.type).join(","),
        [EnumQuestionType.Direction, EnumQuestionType.Deictic,
         EnumQuestionType.NestedSpaces].join(","),
        "the report is not ordered by how much of an item its answers need");
});

/* ------------------------------------------------------------------ *
 * The composed spaces' checkpoint                                     *
 * ------------------------------------------------------------------ */

/**
 * The same mechanism, on the other conclusion path.
 *
 * The scale family got a checkpoint first and the composed spaces have their
 * own everything — layout, prefix, claim builder — so none of it came for free.
 * What is asserted here is what actually breaks if the prefix is wrong: the
 * halfway claim must be about a pair both of whose objects have been *named*
 * before the boundary, and the two claims must be different questions.
 *
 * Naming is weaker than re-deriving the relation, and it is deliberately the
 * weaker check: a premise that drifted across the line takes its objects with
 * it, which is the failure a reordering bug produces, and it is visible without
 * a second implementation of the arithmetic.
 */
function ndCheckpointCtx(): GeneratorContext {
    return {
        ...ndContext(),
        hasRung: (_t: string, r: string) => r === "checkpoint",
    } as GeneratorContext;
}

test("a composed space asks a checkpoint before it asks the whole thing", () => {
    const ctx = ndCheckpointCtx();
    let seen = 0;

    seeded(5150, () => {
        for (let n = 5; n <= 8; n++) {
            for (const type of [EnumQuestionType.Space3D, EnumQuestionType.Space4D]) {
                for (let rep = 0; rep < 15; rep++) {
                    let q;
                    try { q = createNdSpace(ctx, n, type); } catch { continue; }
                    if (q.answerMode !== "construct" || q.construct.length !== 2) continue;
                    seen++;

                    const [first, last] = q.construct;
                    assert(/first/i.test(first.slots[0].label),
                        `the early claim is not labelled by where it is answerable`
                        + ` from: ${first.slots[0].label}`);
                    assert(/all/i.test(last.slots[0].label),
                        `the late claim is not labelled as needing everything:`
                        + ` ${last.slots[0].label}`);

                    assert([first.a, first.b].sort().join() !== [last.a, last.b].sort().join(),
                        "the checkpoint asks about the same pair as the conclusion");

                    // Every axis, in both claims: a composed space that asked
                    // the checkpoint about one dimension would be the width
                    // failure wearing a checkpoint.
                    equal(first.slots.length, last.slots.length,
                        "the two claims are not about the same number of axes");

                    const half = Math.floor(n / 2);
                    const named = new Set(q.premises.slice(0, half).flatMap(subjectsOf));
                    assert(named.has(first.a) && named.has(first.b),
                        `the checkpoint asks about ${first.a}/${first.b}, not both`
                        + ` named in the first ${half} premises`);
                }
            }
        }
    });

    assert(seen > 20, `only ${seen} checkpoint items in the sample`);
});

test("a short composed space gets no checkpoint", () => {
    const ctx = ndCheckpointCtx();

    seeded(6161, () => {
        for (const n of [3, 4]) {
            for (let rep = 0; rep < 20; rep++) {
                let q;
                try { q = createNdSpace(ctx, n, EnumQuestionType.Space3D); } catch { continue; }
                assert(q.construct.length < 2,
                    `a ${n}-premise item carries a checkpoint, whose halfway is`
                    + " one premise deep");
            }
        }
    });
});

/**
 * The four things that make a prefix meaningless.
 *
 * Edits and transformations rewrite the arrangement, so a relation stated
 * before one of them need not hold after it. Reports and testimony replace the
 * premises with claims that may be false, so nothing is determined until the
 * liars are found — which is the whole item rather than half of it. Each is
 * skipped rather than worked around.
 */
test("a mutated or reported composed space carries no checkpoint", () => {
    const base = ndContext();

    for (const rung of ["edit-1", "transform-1", "speakers", "testimony"]) {
        const ctx = {
            ...base,
            hasRung: (_t: string, r: string) => r === "checkpoint" || r === rung,
        } as GeneratorContext;

        seeded(7171, () => {
            for (let n = 5; n <= 8; n++) {
                for (let rep = 0; rep < 15; rep++) {
                    let q;
                    try { q = createNdSpace(ctx, n, EnumQuestionType.Space3D); } catch { continue; }
                    assert(q.construct.length < 2,
                        `${rung} and a checkpoint came out together, and a`
                        + " checkpoint the reader cannot answer at the checkpoint"
                        + " is not one");
                }
            }
        });
    }
});
