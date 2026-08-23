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
    equal(base, 2, `the base state uses ${base} axes, not two`);
    assert(top >= 6, `the full ladder reaches only ${top} axes`);
});

/**
 * The derivation describes the map, not the steps that built it.
 *
 * Changes compose and can cancel: two swaps of one pair put the axes back where
 * they started. A derivation replaying its own construction then reported
 * "Distinction and Time trade places" followed by "Time and Distinction trade
 * places" — two changes, in an item that contained none on those axes.
 */
test("a described change is a change the item actually carries", () => {
    for (const rungs of [FULL.slice(0, 6), FULL]) {
        seeded(31415, () => {
            const ctx = context(rungs);
            for (let rep = 0; rep < 40; rep++) {
                const q = createAxisMap(ctx, 3);
                const told = q.explanation.filter(l => l.startsWith("—") || l.includes("one change:"));

                // No fact stated twice: a swap is one fact about a pair.
                const said = told.map(strip);
                equal(new Set(said).size, said.length,
                    `a change is described twice: ${said.join(" / ")}`);

                // And no pair reported as trading places both ways round.
                for (const line of said) {
                    const m = /(\w[\w -]*) and (\w[\w -]*) trade places/.exec(line);
                    if (!m) continue;
                    const mirrored = `${m[2]} and ${m[1]} trade places`;
                    assert(!said.some(other => other.includes(mirrored)),
                        `the same swap is reported both ways round: ${line}`);
                }
            }
        });
    }
});

/** An item claiming three changes has to carry three. */
test("composing changes that cancel does not count as composing", () => {
    seeded(2718, () => {
        const ctx = context(FULL);
        for (let rep = 0; rep < 40; rep++) {
            const q = createAxisMap(ctx, 3);
            const header = strip(q.explanation[0]);
            const claimed = /(\d+) changes/.exec(header);
            if (!claimed) continue;
            const listed = q.explanation.filter(l => l.startsWith("—")).length;
            equal(listed, Number(claimed[1]),
                `the derivation announces ${claimed[1]} changes and lists ${listed}`);
        }
    });
});
