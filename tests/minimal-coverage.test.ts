/**
 * Minimal mode converts a card, or it converts none of it.
 *
 * `symbols.test.ts` checks the table against the vocabulary: every relation a
 * scale can state has a mark, and no mark stands for a relation nothing states.
 * Both passed while two modes printed "one level ⇧ and two steps North" — the
 * table is lower case and Direction3D capitalised its compass words, so the
 * word matched nothing and stayed. Half a premise in marks and half in words,
 * on every card those modes made.
 *
 * The table cannot catch that, because the words were in it. So this reads the
 * finished card instead: build a real item with the switch on, take away the
 * object names, and look for any wording the table knows in any casing. What is
 * left should be numbers, units and grammar.
 *
 * Casing is the specific thing it catches, and casing is the specific thing
 * that went wrong, twice over — the same premise reached the player mixed even
 * with both switches off.
 */

import { equal, seeded, test } from "./harness";
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
import {
    randomRelationLabels, setSymbolRelations, symboliseStatement, symbolisedWords,
} from "../src/app/syllogimous/utils/phrasing";

function ctxOf(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.setEnable("negation", true);
    const ctx: GeneratorContext = {
        settings, logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off", hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Every wording the table knows, longest first, in any casing. */
const ANY_CASE = new RegExp(
    "\\b(" + symbolisedWords()
        .sort((a, b) => b.length - a.length)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|") + ")\\b",
    "gi");

/** What the player reads, without the object names or the markup. */
const bare = (html: string) => html
    .replace(/<span class="subject">[\s\S]*?<\/span>/g, "\u00a4")
    .replace(/<[^>]+>/g, "");

const statements = (q: Question) => [
    ...q.premises, String(q.conclusion ?? ""), ...q.choices,
    ...q.series.flatMap(c => [c.text, ...(c.premises ?? [])]),
];

function sweep(convert: (s: string) => string): string[] {
    const ctx = ctxOf();
    const faults = new Map<string, Set<string>>();

    seeded(7, () => {
        for (const type of Object.values(EnumQuestionType)) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            for (let r = 0; r < 25; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (r % 3)); } catch { continue; }
                for (const text of statements(q)) {
                    for (const hit of bare(convert(text)).match(ANY_CASE) ?? []) {
                        const set = faults.get(String(type)) ?? new Set<string>();
                        set.add(hit);
                        faults.set(String(type), set);
                    }
                }
            }
        }
    });

    return [...faults].map(([type, words]) => `${type}: ${[...words].join(", ")}`);
}

test("minimal mode leaves no relation word on the card", () => {
    setSymbolRelations(true);
    let left: string[];
    try { left = sweep(s => symboliseStatement(s)); }
    finally { setSymbolRelations(false); }

    equal(left.length, 0,
        `relation wording survived the switch:\n  ${left.join("\n  ")}`);
});

/**
 * And the same for randomised labels, which read the same table.
 *
 * Same failure, same cause: a mode whose wording the table cannot match keeps
 * its English while everything around it is relabelled, and a card carrying
 * both is worse than one carrying neither — the player has to hold two
 * vocabularies for one item.
 */
test("randomised labels leave no relation word on the card", () => {
    const marks = randomRelationLabels();
    const left = sweep(s => symboliseStatement(s, marks));

    equal(left.length, 0,
        `relation wording survived relabelling:\n  ${left.join("\n  ")}`);
});

/**
 * The modes with rules of their own: Syllogism, Binary, Transformation,
 * Knights and Knaves, and Analogy's verdict and pairing.
 *
 * Their wording is not in the relation table — "All", "No", "and" are too
 * ordinary to match as text — so the two sweeps above could not see them, and
 * both switches left all of it in English. Checked against the words
 * themselves rather than the table, since the table is exactly what they are
 * missing from.
 */
const OWN_WORDING = /\b(All|the inverse of|Some|No|mirrored|scaled|rotated|set to|differs from|are not both true|are both false|are the same kind|are different kinds|same as|opposite of|alike|unlike)\b|(?<=¤ )to(?= ¤)/g;

function ownSweep(convert: (s: string) => string): string[] {
    const ctx = ctxOf();
    const faults = new Map<string, Set<string>>();
    seeded(11, () => {
        for (const type of Object.values(EnumQuestionType)) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            for (let r = 0; r < 25; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (r % 3)); } catch { continue; }
                for (const text of statements(q)) {
                    for (const hit of bare(convert(text)).match(OWN_WORDING) ?? []) {
                        const set = faults.get(String(type)) ?? new Set<string>();
                        set.add(hit);
                        faults.set(String(type), set);
                    }
                }
            }
        }
    });
    return [...faults].map(([type, words]) => `${type}: ${[...words].join(", ")}`);
}

test("the modes with their own rules are converted by minimal mode", () => {
    setSymbolRelations(true);
    let left: string[];
    try { left = ownSweep(s => symboliseStatement(s)); }
    finally { setSymbolRelations(false); }
    equal(left.length, 0, `own-rule wording survived minimal mode:\n  ${left.join("\n  ")}`);
});

test("and by randomised labels, which fall back to minimal mode's marks for them", () => {
    const left = ownSweep(s => symboliseStatement(s, randomRelationLabels()));
    equal(left.length, 0, `own-rule wording survived relabelling:\n  ${left.join("\n  ")}`);

    // Falling back means the fixed marks, not nothing: a syllogism is still
    // stated in quantifiers when the relations are letters.
    const ctx = ctxOf();
    seeded(12, () => {
        const q = BUILD[EnumQuestionType.Syllogism](ctx, 2);
        const text = bare(symboliseStatement(q.premises.join(" "), randomRelationLabels()));
        equal(/[∀∃∄]/.test(text), true, `no quantifier marks under fresh labels: ${text}`);
    });
});

/**
 * Both switches on: the fresh labels must reach every relation.
 *
 * `rel` and `hi` used to convert to the fixed marks themselves, while the item
 * was being generated, whenever minimal mode was on. With fresh labels on as
 * well, those relations reached the relabelling pass already as `＜` and `↑`,
 * which it cannot match — so a card said "QF" for the words written directly
 * and "↑" for the ones written through the helpers. Generating with the switch
 * on must therefore give exactly the card generating with it off gives.
 */
test("with both switches on, no relation keeps its fixed mark", () => {
    const ctx = ctxOf();
    const faults: string[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        if (!BUILD[type]) continue;
        const n = QUESTION_TYPE_SETTING_PARAMS[type].minNumOfPremises;
        const card = (on: boolean) => {
            setSymbolRelations(on);
            try {
                return seeded(99, () => {
                    const q = BUILD[type](ctx, n);
                    const marks = randomRelationLabels();
                    return statements(q).map(s => symboliseStatement(s, marks)).join("\n");
                });
            } catch { return null; }
            finally { setSymbolRelations(false); }
        };
        const off = card(false), on = card(true);
        if (off !== on) faults.push(String(type));
    }
    equal(faults.length, 0, `fixed marks leaked past fresh labels in: ${faults.join(", ")}`);
});
