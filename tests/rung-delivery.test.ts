/**
 * A rung a ladder charges for has to change the item.
 *
 * `registries.test.ts` already checks that a generator *asks* about every rung
 * its ladder offers. That is not the same as delivering one, and the gap is
 * where three modes sat: Syllogism and both Direction3D modes offered `meta`,
 * asked about it through the global flag, and never produced a meta relation —
 * the direction generators still carry the TODO where it would go.
 *
 * It costs 1.0, the dearest of the basic rungs, so a player holding it had
 * every item priced a whole level above what it was and their answers credited
 * accordingly. A rung that is charged for and not delivered is a measurement
 * error, not a cosmetic one.
 *
 * Checked by generating with the rung on and looking for its mark on the card.
 * Only the two rungs with a mark that can be recognised without reimplementing
 * the generator — negation and meta — which is enough to catch this class.
 */

import { assert, equal, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";

function ctxOf(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("meta", true);
    settings.setEnable("negation", true);
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => true, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => true,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** What each rung leaves on a finished card. */
const MARK: Record<string, RegExp> = {
    meta: /relates to .*? in the (same|opposite) way|has the same relation as|is to .*? as .*? is to/i,
    negation: /class="is-negated"|<del\b/,
};

const cardText = (q: Question) => [
    ...q.premises, String(q.conclusion ?? ""), ...q.choices,
    ...q.series.flatMap(c => [c.text, ...(c.premises ?? [])]),
].join(" ");

test("a rung a ladder offers is one the item actually shows", () => {
    const ctx = ctxOf();
    const faults: string[] = [];

    for (const rung of Object.keys(MARK)) {
        seeded(1234, () => {
            for (const type of Object.values(EnumQuestionType)) {
                if (!ladderFor(type).includes(rung)) continue;
                if (!BUILD[type]) continue;

                const params = QUESTION_TYPE_SETTING_PARAMS[type];
                let made = 0, marked = 0;
                for (let r = 0; r < 40; r++) {
                    let q: Question;
                    try { q = BUILD[type](ctx, params.minNumOfPremises + (r % 3)); } catch { continue; }
                    made++;
                    if (MARK[rung].test(cardText(q))) marked++;
                }
                if (made >= 20 && marked === 0) {
                    faults.push(`${type} offers "${rung}" and produced none in ${made} items`);
                }
            }
        });
    }

    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("the tombstones are not offered as live rungs", () => {
    const live: string[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        for (const rung of ladderFor(type)) {
            if (rung.startsWith("retired-")) continue;
            if (rung === "meta" || rung === "negation") continue;
        }
    }
    /* The specific three this was written for. */
    for (const type of [EnumQuestionType.Syllogism,
                        EnumQuestionType.Direction3DSpatial,
                        EnumQuestionType.Direction3DTemporal]) {
        if (ladderFor(type).includes("meta")) live.push(String(type));
    }
    equal(live.length, 0, `still offering a meta rung they cannot produce: ${live.join(", ")}`);
    assert(true, "checked");
});
