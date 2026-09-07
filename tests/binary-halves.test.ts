/**
 * Binary conjoins two claims, so both halves have to *be* claims.
 *
 * It reads each half's conclusion into a sentence of its own — "$a and $b" — so
 * a half with no conclusion text leaves the slot empty and the card reads "and"
 * on its own, with four premises above it and nothing to judge.
 *
 * Modes answered by picking or by building have no such sentence: they carry a
 * prompt and a set of options instead. The scale modes become one the moment
 * `choose-conclusion` is earned, which is why this could only happen to a
 * player who had got that far, and only when both halves landed on it.
 */

import { assert, seeded, test } from "./harness";
import { createBinary } from "../src/app/syllogimous/generators/binary";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createLinear } from "../src/app/syllogimous/generators/linear";

/** No rungs, so the halves are the plain true-or-false items Binary can state. */
function ctxFor(rungs = false): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => rungs, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => rungs, dialFor: () => (rungs ? 2 : 0),
        mergeTarget: () => null,
        // Halves drawn from a mode whose answer mode the rungs can change.
        random: (n?: number) =>
            createLinear(ctx, n ?? 3, EnumQuestionType.LinearVertical),
    };
    return ctx;
}

const text = (q: Question) =>
    (Array.isArray(q.conclusion) ? q.conclusion[0] : q.conclusion) ?? "";

test("a binary conclusion never comes out as the connective alone", () => {
    seeded(4242, () => {
        const ctx = ctxFor();
        let built = 0;
        for (let i = 0; i < 120; i++) {
            let q: Question;
            try { q = createBinary(ctx, 6); } catch { continue; }
            built++;
            const bare = text(q).replace(/<[^>]+>/g, "").trim();
            assert(bare.length > 6 && !/^(and|or|xor|nand)$/i.test(bare),
                `the conclusion is the connective and nothing else: "${bare}"`);
        }
        assert(built > 0, "no binary item was built, so this proves nothing");
    });
});

test("both halves of a binary item state something", () => {
    seeded(77, () => {
        const ctx = ctxFor();
        for (let i = 0; i < 80; i++) {
            let q: Question;
            try { q = createBinary(ctx, 6); } catch { continue; }
            const bare = text(q).replace(/<[^>]+>/g, "");
            // The template is "<a> and <b>": neither side may be blank.
            const halves = bare.split(/\s+(?:and|or|xor|nand)\s+/i);
            for (const half of halves) {
                assert(half.trim().length > 0,
                    `one half of "${bare}" is empty, so there is nothing to judge`);
            }
        }
    });
});

/**
 * And where no half can state a claim, the mode declines rather than shipping
 * one. Throwing is how a generator says "not this configuration" — the draw
 * moves on to another mode, which is a far better outcome than a card whose
 * conclusion is the word "and".
 */
test("a mode whose halves state nothing declines to build", () => {
    const ctx = ctxFor();
    // Every half a picking item: a prompt and options, and no claim.
    (ctx as { random: unknown }).random = () => {
        const q = new Question(EnumQuestionType.LinearVertical);
        q.premises = ["<span class=\"subject\">A</span> is above <span class=\"subject\">B</span>"];
        q.conclusion = "";
        q.answerMode = "choice";
        q.choices = ["one", "two"];
        return q;
    };

    let threw = false;
    try { createBinary(ctx, 6); } catch { threw = true; }
    assert(threw,
        "an item was built from halves that state nothing, so its conclusion is"
        + " the connective and nothing else");
});
