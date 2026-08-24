/**
 * Deictic Relations — why its ladder is empty.
 *
 * The mode used to hand out `extra-reversal` and `third-axis`. Both were
 * priced, both were labelled in Customise, and `deictic.ts` never called
 * `hasRung` — so the two names described exactly what `numOfPremises` already
 * decides in `buildDeicticSpec`, and a player who earned or forced either paid
 * for an item they were being served anyway.
 *
 * The reason it cannot be repaired by wiring the rungs up is arithmetic rather
 * than oversight: an item is a 2^k grid of statements plus one premise per
 * reversed axis, so `premises = 2^k + r`. That is a bijection onto the (axes,
 * reversals) pairs the frame can take, and there is no third quantity left for
 * a rung to name — a reversal *is* a premise, and a third axis *is* four more.
 *
 * These two tests are the halves of that claim, and they are what an attempt to
 * put the rungs back would have to break.
 */

import { assert, equal, seeded, test } from "./harness";
import { createDeictic } from "../src/app/syllogimous/generators/deictic";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { DEICTIC_AXES, reversalTextFor } from "../src/app/syllogimous/utils/deictic.utils";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { Question } from "../src/app/syllogimous/models/question.models";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { RUNG_COST } from "../src/app/syllogimous/utils/ability.utils";

const strip = (t: string) => t.replace(/<[^>]+>/g, "");

const PARAMS = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Deictic];

/**
 * `granted` answers every `hasRung` call, so "on" means every rung at once —
 * including names no ladder offers. A generator that read any of them would
 * come out different, whatever the name happened to be.
 */
function context(granted: boolean, deep = true): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100,
            rungOverride: () => (granted ? true : null),
            deepConclusions: deep,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => granted, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => granted,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Everything a reader sees, so "identical item" means what it says. */
const rendered = (q: Question) => JSON.stringify({
    setup: q.setup.map(strip),
    premises: q.premises.map(strip),
    conclusion: strip(String(q.conclusion)),
    isValid: q.isValid,
});

/** The frame an item shows, read off its premises rather than its spec. */
function frameOf(q: Question) {
    const reversed = new Set<string>();
    let setting = 0;

    for (const raw of q.premises) {
        const text = strip(raw);
        for (const axis of DEICTIC_AXES) {
            if (text.toLowerCase() === reversalTextFor(axis).toLowerCase()) reversed.add(axis);
        }
        // "When I am here now, I hold X" — one setting word per non-person axis.
        const m = /^When (?:I|you) (?:am|are) (.+?), (?:I|you) hold /.exec(text);
        if (m) setting = Math.max(setting, m[1].split(/\s+/).length);
    }

    assert(setting > 0, `no grid statement to read an axis count off: ${q.premises[0]}`);
    // Person is carried by the subject rather than the setting, so it is never
    // one of the counted words and always one of the axes.
    return { axes: 1 + setting, reversed: reversed.size, stated: q.premises.length };
}

/**
 * Claiming every rung changes nothing, which is what an empty ladder says.
 *
 * Compared as rendered text under a shared seed, so this is the whole item —
 * the grid, which position was withheld, which axes reversed, the claim and its
 * truth — and not a summary of it that could hide a difference.
 */
test("no rung a deictic item could claim changes the item", () => {
    let compared = 0;

    for (const deep of [true, false]) {
        const on = context(true, deep);
        const off = context(false, deep);

        for (let n = PARAMS.minNumOfPremises; n <= PARAMS.maxNumOfPremises; n++) {
            for (let run = 0; run < 12; run++) {
                const seed = run * 7919 + n * 31 + (deep ? 1 : 0);
                const withRungs = seeded(seed, () => createDeictic(on, n));
                const without = seeded(seed, () => createDeictic(off, n));

                equal(rendered(withRungs), rendered(without),
                    `every rung granted produced a different item at ${n} premises`
                    + ` (deep=${deep}) — if that is now intended, this mode has a`
                    + ` ladder again and the ladder table has to say so`);
                compared++;
            }
        }
    }

    assert(compared > 40, `only ${compared} items were compared`);

    /*
     * So the ladder is empty, and the two names are gone from the cost table.
     * Asserted here rather than in a test of its own because it is not an
     * independent fact: it is what the comparison above entitles the tables to
     * say, and separating them is how the two drift apart.
     */
    equal(ladderFor(EnumQuestionType.Deictic), [],
        "the generator ignores every rung, so the ladder may not offer one");
    for (const gone of ["extra-reversal", "third-axis"]) {
        assert(!(gone in RUNG_COST),
            `${gone} is still priced, so something still charges for it`);
    }
});

/**
 * And the mode has not thereby run out of difficulty.
 *
 * An empty ladder usually means a mode with no structure left to add, and
 * `reference.md` says the answer to that is to give it rungs rather than to
 * make its items longer. Deictic is the case where length *is* the structure:
 * more premises buy a second reversal and then a third axis, which is precisely
 * why a rung naming either of those was charging twice. If that ever stops
 * being true the empty ladder becomes the ordinary kind, and this fails.
 */
test("the premise count is what moves a deictic frame", () => {
    for (const deep of [true, false]) {
        const ctx = context(false, deep);
        const frames: string[] = [];
        let previous = 0;

        for (let n = PARAMS.minNumOfPremises; n <= PARAMS.maxNumOfPremises; n++) {
            const seen = new Set<string>();
            for (let run = 0; run < 12; run++) {
                const q = seeded(run * 104729 + n, () => createDeictic(ctx, n));
                const f = frameOf(q);
                seen.add(`${f.axes} axes / ${f.reversed} reversed`);

                assert(f.reversed >= 1 && f.reversed <= f.axes,
                    `${f.reversed} of ${f.axes} axes reversed at ${n} premises`);
                assert(f.stated >= previous,
                    `${n} premises produced a shorter item (${f.stated}) than`
                    + ` ${n - 1} did (${previous}), so length stopped tracking the ask`);
            }

            equal(seen.size, 1,
                `${n} premises produced more than one frame (deep=${deep}):`
                + ` ${[...seen].join(", ")} — the count no longer determines it`);
            frames.push([...seen][0]);
            previous = frameOf(seeded(n, () => createDeictic(ctx, n))).stated;
        }

        assert(new Set(frames).size >= 2,
            `every premise count from ${PARAMS.minNumOfPremises} to`
            + ` ${PARAMS.maxNumOfPremises} gave the same frame (deep=${deep}):`
            + ` ${frames[0]} — the mode's only difficulty axis is not moving`);
    }
});
