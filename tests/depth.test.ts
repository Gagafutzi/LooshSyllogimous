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
    buildBranching, buildChain, graphDistance, pickDistantPair,
} from "../src/app/syllogimous/utils/linear.utils";

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
