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
