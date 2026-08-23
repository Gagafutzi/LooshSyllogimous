/**
 * Axis Maps — the inductive mode. See roadmap P13.
 *
 * The whole item rests on one property: the worked examples must **determine**
 * the map. If two different maps could produce the same examples, the item has
 * two right answers and no amount of care over the distractors saves it.
 *
 * Checked as a property of the design rather than through a text parser: render
 * the examples for many maps and require that identical examples imply
 * identical behaviour everywhere. That is the same claim a solver would make,
 * without a second implementation of the phrasing to drift from the first.
 */

import { assert, equal, seeded, test } from "./harness";
import { applyAxisMap, createAxisMap } from "../src/app/syllogimous/generators/axis-map";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

const FULL = ladderFor(EnumQuestionType.AxisMap);

function context(rungs: string[]): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: (_t: string, r: string) => rungs.includes(r),
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (h: string) => h.replace(/<[^>]+>/g, "");
/** The example half of the premises: the lines showing a before and an after. */
const examplesOf = (q: { premises: string[] }) => q.premises.filter(p => p.includes("→")).map(strip);
/** The chain half: everything after the second heading. */
const chainOf = (q: { premises: string[] }) =>
    q.premises.filter(p => !p.includes("→") && !p.includes(":")).map(strip);

test("an item states its examples, its chain, and four distinct options", () => {
    for (const rungs of [[], FULL.slice(0, 4), FULL]) {
        seeded(1234, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 12; rep++) {
                const q = createAxisMap(ctx, 3);
                /*
                 * One example is legitimate: the base state applies a single
                 * change, and a change touches one axis. What must never
                 * happen is *none* — an item with nothing to induce from.
                 */
                assert(examplesOf(q).length >= 1, "no worked examples at all");
                assert(chainOf(q).length >= 2, "no chain to apply the map to");

                // Every shown example is a change. An example whose two halves
                // read alike says "this one is the same", which the convention
                // already says of everything not shown.
                for (const line of examplesOf(q)) {
                    const [before, after] = line.split("→").map(x => x.trim());
                    assert(before !== after, `an example shows no change: ${line}`);
                }

                // The two halves are labelled, or they read as one long list
                // and the reader has to find where the evidence stops.
                assert(q.premises.filter(p => p.includes(":")).length >= 2,
                    "the examples and the chain are not labelled apart");
                equal(q.choices.length, 4, "not four options");
                equal(new Set(q.choices).size, 4, "two options say the same thing");
                assert(q.correctChoice >= 0 && q.correctChoice < 4, "no correct option");
                assert(q.explanation.length > 0, "no derivation");
            }
        });
    }
});

/**
 * The examples determine the map.
 *
 * Every elementary change acts only on a covered axis, and every covered axis
 * gets an example placed on it alone -- so two maps that agree on all the
 * examples agree on every column and on the offset, which makes them the same
 * map. This checks that reasoning against what the generator actually builds.
 */
test("two maps with the same examples behave the same everywhere", () => {
    for (const rungs of [[], FULL.slice(0, 5), FULL]) {
        seeded(99, () => {
            const ctx = context(rungs);
            const byExamples = new Map<string, string>();
            for (let rep = 0; rep < 60; rep++) {
                const q = createAxisMap(ctx, 4);
                const key = examplesOf(q).join(" | ");
                // Same examples *and* same chain: then the answer must match.
                const chain = q.premises.filter(p => !p.includes("→")).map(strip).join(" | ");
                const stamp = `${key}###${chain}`;
                const answer = strip(q.choices[q.correctChoice]);
                const seen = byExamples.get(stamp);
                if (seen !== undefined) {
                    equal(answer, seen,
                        "the same examples over the same chain produced two different answers");
                }
                byExamples.set(stamp, answer);
            }
        });
    }
});

/**
 * A chain survives the map intact.
 *
 * This is the reason the mode is relational rather than drawn: the map is
 * linear, so each link maps on its own and no link has to be re-anchored. If it
 * were false the mode would be arithmetic with sentences around it.
 */
test("mapping a chain link by link is mapping it whole", () => {
    seeded(555, () => {
        for (let rep = 0; rep < 200; rep++) {
            const d = 2 + Math.floor(Math.random() * 6);
            const map = {
                perm: shuffled(d),
                factor: Array.from({ length: d }, () => [1, -1, 2, -2, 3][Math.floor(Math.random() * 5)]),
                offset: Array.from({ length: d }, () => Math.floor(Math.random() * 5) - 2),
                steps: [],
            };
            const a = Array.from({ length: d }, () => Math.floor(Math.random() * 9) - 4);
            const b = Array.from({ length: d }, () => Math.floor(Math.random() * 9) - 4);

            const whole = applyAxisMap(b, map).map((v, i) => v - applyAxisMap(a, map)[i]);
            // The displacement mapped directly, with no offset: an offset moves
            // both ends and so cannot show between them.
            const link = applyAxisMap(b.map((v, i) => v - a[i]),
                { ...map, offset: Array(d).fill(0) });
            equal(whole.join(","), link.join(","),
                "the map does not distribute over a chain, so links cannot be mapped one at a time");
        }
    });
});

function shuffled(d: number): number[] {
    const out = Array.from({ length: d }, (_, i) => i);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** The ladder has to actually widen the space, or the rungs are decoration. */
test("the rungs widen the space and the vocabulary", () => {
    const axisCount = (rungs: string[]) => {
        let widest = 0;
        seeded(7, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 20; rep++) {
                const q = createAxisMap(ctx, 3);
                // Distinct axis colour classes across the premises is the
                // dimensionality, counted the way the reader sees it.
                const dims = new Set([...q.premises.join(" ").matchAll(/\bdim-(\d+)\b/g)].map(m => m[1]));
                widest = Math.max(widest, dims.size);
            }
        });
        return widest;
    };

    const base = axisCount([]);
    const top = axisCount(FULL);
    /*
     * Three at the base, not two. Substitution is in the base vocabulary, and a
     * two-axis space has exactly one way to permute — so the item could not
     * field four distinct options at its own easiest setting.
     */
    equal(base, 3, `the base state uses ${base} axes, not three`);
    assert(top >= 6, `the full ladder reaches only ${top} axes`);
});

/**
 * The changes a derivation lists, grouped as the item groups them.
 *
 * A block is a header — "one change — X." or "N changes together:" — followed by
 * its "— X." lines, prefixed by "Group n: " when the item has several. Each
 * group is judged on its own: two groups may legitimately share a change while
 * differing elsewhere, so a fact repeated *across* groups is not a repeat.
 */
function changeBlocks(explanation: string[]): string[][] {
    const blocks: string[][] = [];
    for (const raw of explanation.map(strip)) {
        if (raw.startsWith("Nothing else moves") || raw.startsWith("Each link")) continue;
        if (raw.startsWith("—")) {
            if (blocks.length) blocks[blocks.length - 1].push(raw.replace(/^—\s*/, ""));
            continue;
        }
        const single = /one change — (.*)$/.exec(raw);
        blocks.push(single ? [single[1]] : []);
    }
    return blocks;
}

/**
 * The derivation describes the map, not the steps that built it.
 *
 * Changes compose and can cancel: two swaps of one pair put the axes back where
 * they started. A derivation replaying its own construction then reported
 * "Distinction and Time trade places" followed by "Time and Distinction trade
 * places" — two changes, in an item that contained none on those axes.
 */
test("a described change is a change the item actually carries", () => {
    for (const rungs of [FULL.slice(0, 5), FULL]) {
        seeded(31415, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 40; rep++) {
                const q = createAxisMap(ctx, 3);
                for (const said of changeBlocks(q.explanation)) {
                    equal(new Set(said).size, said.length,
                        `a change is described twice: ${said.join(" / ")}`);

                    for (const line of said) {
                        const m = /(\w[\w -]*) and (\w[\w -]*) trade places/.exec(line);
                        if (!m) continue;
                        const mirrored = `${m[2]} and ${m[1]} trade places`;
                        assert(!said.some(other => other.includes(mirrored)),
                            `the same swap is reported both ways round: ${line}`);
                    }
                }
            }
        });
    }
});

/** A group claiming three changes has to carry three. */
test("composing changes that cancel does not count as composing", () => {
    seeded(2718, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);
            const headers = q.explanation.map(strip).filter(l => /\d+ changes together/.test(l));
            const blocks = changeBlocks(q.explanation);
            for (let i = 0; i < headers.length; i++) {
                const claimed = Number(/(\d+) changes/.exec(headers[i])![1]);
                const listed = blocks.filter(b => b.length > 1)[i]?.length ?? 0;
                equal(listed, claimed,
                    `a group announces ${claimed} changes and lists ${listed}`);
            }
        }
    });
});

/**
 * Two groups given the same change is one group in two halves.
 *
 * The reader induces once and applies twice, which is the mode without the
 * demand the rung was added for.
 */
test("groups do not share a map", () => {
    seeded(1618, () => {
        const ctx = context(FULL);
        let sawGroups = 0;
        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);
            const blocks = changeBlocks(q.explanation);
            if (blocks.length < 2) continue;
            sawGroups++;
            const signatures = blocks.map(b => [...b].sort().join("|"));
            equal(new Set(signatures).size, signatures.length,
                `two groups carry the same change: ${signatures.join(" vs ")}`);
        }
        assert(sawGroups > 5, `only ${sawGroups} multi-group items in forty`);
    });
});

/**
 * The change, watched happening.
 *
 * A still of the end state says only *that* the answer was what it was. When
 * the change is a composition — and this composes up to five — the reader who
 * got it wrong is usually wrong about one step, and the stages are where their
 * arrangement and the item's part company.
 */
test("a composed change carries a stage per step", () => {
    seeded(4242, () => {
        const ctx = context(FULL);
        let composed = 0;
        for (let rep = 0; rep < 30; rep++) {
            const q = createAxisMap(ctx, 3);
            const stages = q.stages ?? [];
            assert(stages.length >= 2, "no stages at all");
            equal(strip(stages[0].label), "Before any change",
                "the first stage is not the arrangement as given");
            if (stages.length > 2) composed++;

            // Every stage plots the same cast, or the picture jumps.
            const cast = Object.keys(stages[0].map).sort().join(",");
            for (const s of stages) {
                equal(Object.keys(s.map).sort().join(","), cast,
                    "an object appears or vanishes between stages");
            }
            assert((q.axisNames ?? []).length > 0, "the stages have no axis names to label with");
        }
        assert(composed > 5, `only ${composed} items of thirty had more than one step`);
    });
});

/**
 * The markers never move, and are drawn where they actually are.
 *
 * Every group states its chain against its own marker, so plotting the relative
 * coordinates together would pile the groups on top of each other and show the
 * frame as a single point. And a frame that shifted between stages would make
 * the change unreadable — everything would appear to move.
 */
test("the frame is fixed across every stage", () => {
    seeded(31, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 25; rep++) {
            const q = createAxisMap(ctx, 3);
            const stages = q.stages ?? [];
            const markers = Object.keys(stages[0].map).filter(k => k.includes("anchor"));
            assert(markers.length >= 2, "the frame is not in the picture at all");

            const distinct = new Set(markers.map(m => stages[0].map[m].join(",")));
            equal(distinct.size, markers.length, "two markers are drawn at the same point");

            for (const s of stages) {
                for (const m of markers) {
                    equal(s.map[m].join(","), stages[0].map[m].join(","),
                        "a marker moved between stages");
                }
            }
        }
    });
});

/** Every step after the first says what changed at it, for every group. */
test("each stage is captioned with the change it shows", () => {
    seeded(808, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 25; rep++) {
            const q = createAxisMap(ctx, 3);
            const stages = q.stages ?? [];
            for (const s of stages.slice(1)) {
                const label = strip(s.label);
                assert(label.startsWith("Then — "), `an unlabelled stage: ${label}`);
                assert(!/step \d+$/.test(label), `a stage says only where it is: ${label}`);
            }
        }
    });
});

/**
 * One chain, in one group.
 *
 * Every group having its own chain made the item two puzzles printed side by
 * side: four options, each a run-on of both answers, and nothing gained that a
 * longer single chain would not have given. The demand the rung exists for is
 * *which dictionary applies here*, which is asked by giving several groups
 * their examples and only one of them something to map.
 */
test("several groups, but only one chain to map", () => {
    seeded(4949, () => {
        const ctx = context(FULL);
        let multi = 0;
        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);

            const headers = q.premises.filter(p => /— examples|Now, from/.test(strip(p)));
            const chainHeaders = headers.filter(p => /Now, from/.test(strip(p)));
            equal(chainHeaders.length, 1,
                `${chainHeaders.length} chains in one item -- that is that many puzzles`);

            if (headers.length > 2) multi++;

            // An option is one chain, not several joined together.
            for (const choice of q.choices) {
                assert(!/— examples/.test(strip(choice)),
                    `an option answers for more than one group: ${strip(choice).slice(0, 60)}`);
            }
        }
        assert(multi > 10, `only ${multi} multi-group items in forty`);
    });
});

/**
 * Taking the wrong marker's dictionary is the characteristic error, so the
 * answer it leads to has to be on offer.
 *
 * A reader who applies the other group's change should find their answer among
 * the options and be wrong, rather than find nothing and reconsider by
 * elimination -- which would let the item be solved without ever settling which
 * dictionary applied.
 */
test("applying the wrong group's change lands on an option", () => {
    seeded(5150, () => {
        const ctx = context(FULL);
        let checked = 0;

        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);
            const headers = q.premises.filter(p => /— examples|Now, from/.test(strip(p)));
            if (headers.length <= 2) continue;          // single group
            checked++;

            /*
             * The chain names its marker, and every option is that chain under
             * *some* map -- so the options must number four distinct readings
             * rather than three plus a near-repeat.
             */
            equal(new Set(q.choices).size, 4, "two options describe the same arrangement");

            /*
             * Every option names the same objects as the chain. Checked by cast
             * rather than by phrasing, so a change to how a position is worded
             * does not quietly turn this into a test of nothing.
             */
            const chainAt = q.premises.findIndex(p => /Now, from/.test(strip(p)));
            const cast = new Set(q.premises.slice(chainAt + 1)
                .flatMap(p => [...p.matchAll(/<span class="subject">([^<]*)<\/span>/g)].map(m => m[1])));
            for (const choice of q.choices) {
                const named = new Set([...choice.matchAll(/<span class="subject">([^<]*)<\/span>/g)]
                    .map(m => m[1]));
                equal([...named].sort().join(","), [...cast].sort().join(","),
                    "an option is not the chain");
            }
        }

        assert(checked > 10, `only ${checked} multi-group items to check`);
    });
});

/** The derivation has to say whose change applied, or the item is unexplained. */
test("a multi-group derivation names the group whose change applied", () => {
    seeded(6161, () => {
        const ctx = context(FULL);
        let checked = 0;
        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);
            const headers = q.premises.filter(p => /— examples|Now, from/.test(strip(p)));
            if (headers.length <= 2) continue;
            checked++;
            assert(/change that applies/.test(strip(q.explanation[0])),
                `the derivation does not say whose change applied: ${strip(q.explanation[0])}`);
        }
        assert(checked > 10, `only ${checked} multi-group items to check`);
    });
});

/**
 * A dense example set determines the map, and that is proved rather than
 * asserted.
 *
 * The construction relies on magnitudes no allowed factor can confuse: with
 * factors capped at three, `p * f = q * g` has no solution in 1..3 for any pair
 * of 1, 5, 7 and 11, so each after-component divides cleanly by exactly one
 * before-component. This enumerates every signed permutation with those factors
 * and requires exactly one to fit — if the argument is wrong, this finds a
 * second.
 */
test("one dense example pins the whole map", () => {
    const FACTORS = [1, -1, 2, -2, 3, -3];

    /** Every signed permutation of `d` axes, as (perm, factor) pairs. */
    function* candidates(d: number): Generator<{ perm: number[]; factor: number[] }> {
        const perms: number[][] = [];
        const walk = (left: number[], acc: number[]) => {
            if (!left.length) { perms.push([...acc]); return; }
            for (let i = 0; i < left.length; i++) {
                walk([...left.slice(0, i), ...left.slice(i + 1)], [...acc, left[i]]);
            }
        };
        walk(Array.from({ length: d }, (_, i) => i), []);

        for (const perm of perms) {
            const factors: number[][] = [[]];
            for (let i = 0; i < d; i++) {
                const next: number[][] = [];
                for (const acc of factors) for (const f of FACTORS) next.push([...acc, f]);
                factors.length = 0;
                factors.push(...next);
            }
            for (const factor of factors) yield { perm, factor };
        }
    }

    seeded(31415, () => {
        for (const d of [2, 3, 4]) {
            for (let rep = 0; rep < 12; rep++) {
                // A dense example: one distinct magnitude per axis.
                const marks = [1, 5, 7, 11].slice(0, d);
                const before = marks.map(m => (Math.random() < 0.5 ? -m : m));

                const perm = shuffledPerm(d);
                const factor = Array.from({ length: d }, () =>
                    FACTORS[Math.floor(Math.random() * FACTORS.length)]);
                const after = Array(d).fill(0);
                for (let i = 0; i < d; i++) after[perm[i]] = factor[i] * before[i];

                let fits = 0;
                for (const cand of candidates(d)) {
                    const got = Array(d).fill(0);
                    for (let i = 0; i < d; i++) got[cand.perm[i]] = cand.factor[i] * before[i];
                    if (got.every((v, i) => v === after[i])) fits++;
                }
                equal(fits, 1,
                    `${fits} maps fit one dense example on ${d} axes -- the item has that many answers`);
            }
        }
    });
});

function shuffledPerm(d: number): number[] {
    const out = Array.from({ length: d }, (_, i) => i);
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * With an offset it takes two, and the second sits on the marker.
 *
 * A shift and a stretch are indistinguishable on one object -- "2 east becomes
 * 4 east" is twice as far or two further -- so an item whose map shifts must
 * show something at the marker, which maps to the offset alone.
 */
test("an offset is shown by an example at the marker", () => {
    seeded(2718, () => {
        const ctx = context([...FULL.slice(0, FULL.indexOf("dense-examples") + 1)]);
        let withOffset = 0;

        for (let rep = 0; rep < 60; rep++) {
            const q = createAxisMap(ctx, 3);
            const shifts = q.explanation.some(l => /everything shifts/.test(strip(l)));
            if (!shifts) continue;
            withOffset++;

            const examples = q.premises.filter(p => strip(p).includes("→"));
            assert(examples.length >= 2,
                "an item that shifts shows one example, which cannot separate a shift from a stretch");
        }

        assert(withOffset > 5, `only ${withOffset} shifting items in sixty`);
    });
});
