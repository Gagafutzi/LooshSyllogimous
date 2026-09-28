/**
 * Cyclic Dominance — the mode whose whole point is that chaining fails.
 *
 * Every other mode in this app states an ordering, and an item is solved by
 * leaning on transitivity. This one states results on a ring, where A beats B,
 * B beats C and far enough round C beats A — so the thing to prove is not that
 * the generator is consistent with itself but that it is consistent with the
 * *ring*, and that the ring is one the premises actually determine.
 *
 * The answer is therefore recomputed here from the premises alone: they are
 * read back as edges, assembled into a cycle, and the asked pair is decided by
 * counting round it. Nothing is imported from the generator but the item, which
 * is the only arrangement in which "the answer is right" is a claim about the
 * card rather than a restatement of how it was built.
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
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createCyclicDominance } from "../src/app/syllogimous/generators/cyclic";

const TYPE = EnumQuestionType.CyclicDominance;
const { minNumOfPremises: MIN, maxNumOfPremises: MAX } = QUESTION_TYPE_SETTING_PARAMS[TYPE];

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

/** The pair a "X beats Y" line names, in that order. */
function edgeOf(line: string): [string, string] {
    const named = extractSubjects(line);
    equal(named.length, 2, "a premise does not name exactly two objects");
    return [named[0], named[1]];
}

/**
 * The ring the premises determine, assembled the way a player has to.
 *
 * Returns null when they do not determine one — which is itself a finding, and
 * the reason this is a walk rather than a lookup: `n` results form a ring only
 * if every object wins once and loses once and the whole thing closes in one
 * loop. Two disjoint cycles would satisfy the counts and settle nothing.
 */
function ringFrom(premises: string[]): string[] | null {
    const next = new Map<string, string>();
    const beaten = new Set<string>();
    for (const line of premises) {
        const [w, l] = edgeOf(line);
        if (next.has(w) || beaten.has(l)) return null;   // a second win or loss
        next.set(w, l);
        beaten.add(l);
    }
    if (next.size !== premises.length) return null;

    const start = premises.length ? edgeOf(premises[0])[0] : null;
    if (!start) return null;

    const order: string[] = [start];
    for (let at = next.get(start)!; at !== start; at = next.get(at)!) {
        if (!at || order.length > next.size) return null;
        order.push(at);
    }
    return order.length === next.size ? order : null;    // one loop, not several
}

/** Every item the sweep looks at. */
function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20260928, () => {
        for (let n = MIN; n <= MAX; n++) {
            for (let rep = 0; rep < 6; rep++) {
                try { out.push(createCyclicDominance(ctx, n)); } catch { /* an undrawable ring */ }
            }
        }
    });
    assert(out.length > 50, `only ${out.length} items were built`);
    return out;
}

/**
 * The premises close into one ring, at every size.
 *
 * Everything else here rests on this. If the results formed two loops, or left
 * an object unbeaten, the reader could assemble something consistent with every
 * premise and still not have the arrangement the answer was taken from — and
 * the item would be unanswerable while looking exactly like one that is not.
 */
test("the premises determine one ring and nothing less", () => {
    for (const q of items()) {
        const ring = ringFrom(q.premises);
        assert(!!ring, `the premises do not close into a single ring:\n  `
            + q.premises.map(p => p.replace(/<[^>]+>/g, "")).join("\n  "));
        equal(ring!.length, q.premises.length,
            "the ring holds a different number of objects than there are results");
        /* Odd, or a pair sits at exactly half the loop with no answer. */
        assert(ring!.length % 2 === 1, `a ring of ${ring!.length} has an undecidable pair`);
    }
});

/**
 * The marked answer is the one the ring gives, recomputed rather than trusted.
 *
 * `reach` is derived from the ring the premises state, not from the generator:
 * on an odd ring each object beats exactly half of the others, so the rule is a
 * consequence of the size and there is nothing to take on faith.
 */
test("the option marked correct is the one counting round the ring gives", () => {
    for (const q of items()) {
        const ring = ringFrom(q.premises)!;
        const n = ring.length;
        const reach = (n - 1) / 2;
        const at = new Map(ring.map((w, i) => [w, i]));
        const steps = (a: string, b: string) => (at.get(b)! - at.get(a)! + n) % n;

        equal(q.choices.length, 2, "a direction is a choice between two");
        const [a, b] = edgeOf(q.choices[q.correctChoice]);
        assert(steps(a, b) <= reach,
            `the item says ${a} beats ${b}, which is ${steps(a, b)} steps round a ring`
            + ` where each one reaches ${reach}`);

        /* And the other option is the same pair the other way round, so the
           question is which direction rather than which pair. */
        const other = edgeOf(q.choices[1 - q.correctChoice]);
        equal([other[0], other[1]], [b, a],
            "the two options are not one pair offered both ways round");
    }
});

/**
 * The pair asked about is never one the premises state.
 *
 * An adjacent pair is a premise said back, and an item answered by finding the
 * line that already says it is not this mode — it is a reading test wearing a
 * ring. Checked in both directions, because a premise read backwards settles
 * the question just as completely.
 */
test("the asked pair is never one the premises already state", () => {
    for (const q of items()) {
        const stated = new Set(q.premises.map(p => edgeOf(p).join(" ")));
        for (const choice of q.choices) {
            const [x, y] = edgeOf(choice);
            assert(!stated.has(`${x} ${y}`) && !stated.has(`${y} ${x}`),
                `${x} and ${y} are adjacent, so the answer is read off a premise`);
        }
    }
});

/**
 * The trap is actually laid, at least some of the time.
 *
 * The mode exists because chaining gives the wrong answer on a ring — but not
 * on every pair: within the reach, following the premises forward happens to
 * agree. An item drawn only from those would be a transitive item in a ring's
 * clothing, and the mode would train the habit it was built to break.
 */
test("some items are ones a chain of premises gets wrong", () => {
    let trapped = 0, total = 0;

    for (const q of items()) {
        const ring = ringFrom(q.premises)!;
        const n = ring.length;
        const at = new Map(ring.map((w, i) => [w, i]));
        const [a, b] = edgeOf(q.choices[q.correctChoice]);
        total++;
        /*
         * Forward along the premises from the loser reaches the winner, so a
         * reader chaining "X beats Y, Y beats Z" concludes the loser wins.
         */
        if ((at.get(a)! - at.get(b)! + n) % n <= (n - 1) / 2) throw new Error("impossible");
        if ((at.get(b)! - at.get(a)! + n) % n > 1) trapped++;
    }

    assert(trapped > total * 0.5,
        `only ${trapped} of ${total} items punish a chain — the mode is mostly`
        + " agreeing with the habit it exists to break");
});

/**
 * A further claim asks about the ring, not about the last question again.
 *
 * Assembling the ring is the whole cost of the item and it is paid once, so the
 * claims after the first are nearly free — which is only true if each is about
 * a pair the item has not already settled.
 */
test("each further claim asks about a pair the item has not asked about", () => {
    let seen = 0;

    for (const q of items()) {
        const asked = new Set<string>();
        /*
         * The series, or the item alone when it has none. Not both: the first
         * entry of a series *is* the item's own claim — `extendWithSeries`
         * builds it from the question — so walking the item and then its series
         * counts that claim twice and reports the item as repeating itself.
         */
        const claims = q.series.length ? q.series : [q];
        for (const [i, claim] of claims.entries()) {
            const choices = claim.choices;
            if (!choices?.length) continue;
            if (i > 0) seen++;
            const [x, y] = edgeOf(choices[0]);
            const key = [x, y].sort().join(" ");
            assert(!asked.has(key), `${x} and ${y} are asked about twice in one item`);
            asked.add(key);
        }
    }

    assert(seen > 20, `only ${seen} further claims were built`);
});
