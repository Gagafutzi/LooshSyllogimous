/**
 * Continuous stream: premises arrive, old ones expire.
 *
 * The mode is only that mode if three things hold, and each of them is easy to
 * lose while the card still looks right — so each is a test rather than an
 * intention.
 */

import { assert, equal, seeded, test } from "./harness";
import { createStream, STREAM_TYPES, DEFAULT_WINDOW } from "../src/app/syllogimous/generators/stream";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    return { settings, logger: new Logger("error", false) } as unknown as GeneratorContext;
}

const strip = (h: string) => h.replace(/<[^>]+>/g, "");
const namesIn = (html: string) =>
    [...html.matchAll(/<span class="subject">(.*?)<\/span>/g)].map(m => m[1]);

test("every stream type builds, at every window", () => {
    seeded(3141, () => {
        for (const type of STREAM_TYPES) {
            for (const w of [2, 3, 4, 6]) {
                const q = createStream(context(), type, w);
                assert(q.series.length >= 2, `${type} produced no checkpoints`);
                assert(q.premises.length === w,
                    `${type} opened with ${q.premises.length} premises for a window of ${w}`);
            }
        }
    });
});

/**
 * Only the new premises are shown at a checkpoint.
 *
 * Re-displaying the whole window would look identical and remove the entire
 * demand — the retained relations have to be in your head, not on the card.
 */
test("a checkpoint shows only what has arrived since the last one", () => {
    seeded(2718, () => {
        for (const w of [2, 3, 4]) {
            const q = createStream(context(), EnumQuestionType.ComparisonNumerical, w);
            for (let i = 1; i < q.series.length; i++) {
                const shown = q.series[i].premises || [];
                assert(shown.length > 0, `checkpoint ${i + 1} showed nothing at all`);
                assert(shown.length < w,
                    `checkpoint ${i + 1} showed ${shown.length} of a ${w} window,`
                    + " so nothing had to be retained");
            }
        }
    });
});

/**
 * The conclusion spans the window rather than restating one premise of it.
 *
 * A conclusion answerable from a single remembered relation would make this a
 * recall task with relational decoration, and the window would be measuring
 * span rather than integration.
 */
test("no conclusion is answerable from one premise on the card", () => {
    seeded(1618, () => {
        for (const type of STREAM_TYPES) {
            const q = createStream(context(), type, 3);

            for (let i = 0; i < q.series.length; i++) {
                const claim = q.series[i];
                const ends = namesIn(claim.text);
                const shown = claim.premises || [];

                for (const premise of shown) {
                    const pair = namesIn(premise);
                    const restates = ends.every(e => pair.indexOf(e) >= 0);
                    assert(!restates,
                        `${type} checkpoint ${i + 1} asks about a pair that one`
                        + ` visible premise already states: ${strip(premise)}`);
                }
            }
        }
    });
});

/**
 * A stream item does not teach the model about the mode it borrowed.
 *
 * It is a far harder task at the same premise count, so scoring it as an
 * ordinary item of that mode would teach the estimate that four-premise
 * comparisons are beyond you — and shorten every ordinary item served
 * afterwards.
 */
test("a stream item is not scored against the mode it borrows", () => {
    seeded(99, () => {
        const q = createStream(context(), EnumQuestionType.LinearVertical, DEFAULT_WINDOW);
        assert(q.playgroundMode,
            "a stream item would have moved the borrowed mode's ability estimate");
    });
});

/** The promise the card makes has to be a promise the card keeps. */
test("the setup says the window is all there is", () => {
    seeded(7, () => {
        const q = createStream(context(), EnumQuestionType.Direction, 4);
        const said = q.setup.map(strip).join(" ");
        assert(/last 4/.test(said), `the setup does not state the window: ${said}`);
        assert(/nothing to keep|never needed|nothing before/i.test(said),
            "the setup does not promise that older premises are never needed");
    });
});

/**
 * A long run is the point, so the length must not be quietly capped.
 *
 * The generator draws one object per link, and a hundred questions needs more
 * links than any symbol pool holds — so a naive version simply fails to build
 * past a few dozen. Names recur instead, which is the difficulty that was
 * wanted: a stale binding competing with a live one measures letting go, where
 * a bigger window only measures holding.
 */
test("a run of a hundred questions builds", () => {
    seeded(555, () => {
        const q = createStream(context(), EnumQuestionType.ComparisonNumerical, 3, 100);
        equal(q.series.length, 100, "the run was shortened");
        for (let i = 1; i < q.series.length; i++) {
            assert((q.series[i].premises || []).length > 0,
                `checkpoint ${i + 1} of a long run showed no premises`);
        }
    });
});

/**
 * A name may repeat across a run, but never inside one window.
 *
 * Two positions for one object inside the live set makes the chain ambiguous
 * rather than hard — there would be no right answer to give.
 */
test("no object appears twice inside a single window", () => {
    seeded(4242, () => {
        for (const w of [2, 3, 4]) {
            const q = createStream(context(), EnumQuestionType.Direction, w, 60);
            const chain = q.bucket as string[];

            for (let i = 0; i + w < chain.length; i++) {
                const live = chain.slice(i, i + w + 1);
                equal(new Set(live).size, live.length,
                    `a window of ${w} at link ${i} names the same object twice`);
            }
        }
    });
});

/** And over a long run they *do* recur, or the pool would have to be endless. */
test("a long run brings objects back", () => {
    seeded(808, () => {
        const q = createStream(context(), EnumQuestionType.ComparisonNumerical, 3, 120);
        const chain = q.bucket as string[];
        assert(new Set(chain).size < chain.length,
            "a 120-question run used a distinct object every time, which no pool holds");
    });
});

/* ------------------------------------------------------------------ *
 * Analogy questions                                                   *
 * ------------------------------------------------------------------ */

const NUMBERS = /(\d+) /g;

/**
 * A true analogy has to be *made*: two random displacements match about never,
 * so the newest link is solved backwards from the answer. That construction
 * compounds if it is left alone — at a window of three the solved link is the
 * whole second pair, so each checkpoint's target is the previous solution plus
 * one, and a hundred questions in the card was printing 5 × 10^20.
 */
test("an analogy run never prints a number nobody could hold", () => {
    seeded(1234, () => {
        for (const w of [2, 3, 4, 5, 6]) {
            for (const type of STREAM_TYPES) {
                const q = createStream(context(), type, w, 60, true);
                for (const claim of q.series) {
                    for (const premise of claim.premises || []) {
                        for (const [, n] of strip(premise).matchAll(NUMBERS)) {
                            assert(Number(n) <= 6,
                                `${type} at window ${w} printed ${n} — the construction`
                                + " is compounding");
                        }
                    }
                }
            }
        }
    });
});

/**
 * And the answers have to be balanced, which is not free.
 *
 * A true analogy is only constructible when the required step is small, which
 * is not always — so flipping a coin whenever it *was* possible and asking a
 * false one whenever it was not produced 33% true. At that rate answering
 * "false" to everything scores 67% and the mode is a coin the player has seen
 * both sides of.
 */
test("neither answer wins an analogy run by itself", () => {
    seeded(86, () => {
        for (const w of [2, 3, 4, 5, 6]) {
            for (const type of STREAM_TYPES) {
                const q = createStream(context(), type, w, 120, true);
                const yes = q.series.filter(c => c.isValid).length;
                const share = yes / q.series.length;
                assert(share >= 0.35 && share <= 0.65,
                    `${type} at window ${w} came out ${Math.round(100 * share)}% true,`
                    + " so one answer beats reading the card");
            }
        }
    });
});

/** Both halves are built from the live window, not read off one premise. */
test("an analogy names three objects spanning the window", () => {
    seeded(31, () => {
        const q = createStream(context(), EnumQuestionType.Space3D, 4, 20, true);
        for (const claim of q.series) {
            const named = [...strip(claim.text).matchAll(/is to (\S+)/g)].length;
            equal(named, 2, `an analogy did not state two pairs: ${strip(claim.text)}`);
            for (const premise of claim.premises || []) {
                const pair = namesIn(premise);
                const ends = namesIn(claim.text);
                assert(!(pair.every(x => ends.indexOf(x) >= 0) && pair.length === 2
                         && ends.length >= 2 && new Set(ends).size === 2),
                    "an analogy restates a visible premise");
            }
        }
    });
});
