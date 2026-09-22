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

import { readFileSync } from "fs";
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
import {
    randomRelationLabels, rel, setSymbolRelations, symboliseSetup, symboliseStatement,
    symbolisedWords,
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

/* ------------------------------------------------------------------ *
 * The setup line                                                      *
 * ------------------------------------------------------------------ *
 *
 * The setup used to keep its words under both switches, and the reasoning was
 * half right: it says things like "every change it makes is shown below", and a
 * mark there would be nonsense. What the reasoning missed is that some setup
 * lines name the very relation the premises were relabelled out of — and those
 * are the lines the item turns on.
 *
 *   Stimulus Function  "Being wider makes something more fragile."
 *   Shape and Rotation "Corners: north, east, south, west."
 *   composed spaces    "The east/west axis is a loop of 4; it wraps around."
 *
 * Stimulus Function is the unanswerable one: the whole item is "follow this
 * property along this relation", the relation is named nowhere but the setup,
 * and every premise called it `QF`.
 *
 * Both directions are asserted, because the fix has two ways to be wrong. A
 * relation left in English is the bug; prose rewritten into a mark is the
 * over-correction, and "QF premises change the arrangement" is worse than what
 * it replaced.
 */

const setupLines = (q: Question) => q.setup ?? [];

function setupSweep(convert: (s: string) => string): string[] {
    const ctx = ctxOf();
    const faults = new Map<string, Set<string>>();

    seeded(7, () => {
        for (const type of Object.values(EnumQuestionType)) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            for (let r = 0; r < 25; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (r % 4)); } catch { continue; }
                for (const line of setupLines(q)) {
                    for (const hit of bare(convert(line)).match(ANY_CASE) ?? []) {
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

test("minimal mode leaves no relation word in a setup line", () => {
    setSymbolRelations(true);
    let left: string[];
    try { left = setupSweep(s => symboliseSetup(s)); }
    finally { setSymbolRelations(false); }

    equal(left.length, 0,
        `a setup line names a relation the card has marked away:\n  ${left.join("\n  ")}`);
});

test("randomised labels leave none either", () => {
    const marks = randomRelationLabels();
    const left = setupSweep(s => symboliseSetup(s, marks));

    equal(left.length, 0,
        `a setup line names a relation the card relabelled:\n  ${left.join("\n  ")}`);
});

/**
 * And the prose is left alone, which is the other half.
 *
 * Converting the line wholesale would be the easy fix and the wrong one. Only
 * what the generator *marked* as a relation — wrapped in `rel` or `hi` — is
 * converted; bare prose and anything in `<b>` stays as written.
 *
 * **The fixtures are the old wordings, deliberately.** Every shipped setup line
 * that collided with a relation word was also reworded — "left out of a
 * premise" now reads "omitted from", "shown below" reads "shown in the
 * examples" — because a reader meeting "left" beside relabelled premises cannot
 * tell prose from an axis, and that is true with or without this converter. But
 * that rewording is exactly what would let a wholesale conversion pass
 * unnoticed: with no colliding word left in any real line, there is nothing for
 * the over-correction to damage. So the contract is held to the sentences that
 * made it necessary, which are the ones a future setup line will look like.
 */
test("a setup line's prose is not rewritten into marks", () => {
    const marks = randomRelationLabels();
    const kept = [
        // "Later" as in subsequent, not as in the temporal relation.
        "Later premises <b>change</b> the arrangement, in order.",
        // "left out" as in omitted, not as in the horizontal axis.
        "A dimension left out of a premise is <b>the same</b> for both.",
        // "below" as in further down the card, not as in containment.
        "Every change it makes is shown <b>below</b> \u2014 anything the examples"
        + " leave alone stays as it is.",
        // "reaches" as in the question being asked, not a stated relation.
        "Premises are <b>direct</b> links. The question asks whether one reaches"
        + " the other along <b>any number</b> of steps.",
        // And the sides of the screen, not the horizontal axis.
        "The coloured node on the left is the one to find. Tap its counterpart"
        + " on the right.",
    ];

    for (const line of kept) {
        equal(symboliseSetup(line, marks), line,
            "a setup line's prose was rewritten as if it were a relation");
    }

    /* And the marked half of the same sentence *is* converted, so this is a
       test about the boundary rather than about doing nothing. */
    const mixed = `Later premises change the ${rel("north")} axis.`;
    const out = symboliseSetup(mixed, marks);
    assert(out.includes(marks["north"]), "the marked relation was not converted");
    assert(out.startsWith("Later premises change the"),
        "the prose around it was rewritten");
});

/**
 * The marked half really is converted, through a real item.
 *
 * The sweep above passes if a mode simply stops saying anything, so the one
 * mode whose rule *is* a relation is checked by building it and reading the
 * line back. Stimulus Function states "Being wider makes something more
 * fragile" and nothing else on the card names that relation, which is what made
 * it the unanswerable case.
 *
 * Run under `red`, and that is the point rather than a convenience. The
 * obvious assertion — the rule's label appears in the premises — is *false*
 * under `mapped`, which draws the two poles of a scale independently: an item
 * whose premises all happen to state "narrower" will have a rule naming the
 * "wider" label, and the key is what relates them. `red` gives both poles one
 * token and marks the inverted one, so the token in the rule is the token in
 * the premises, and the check becomes sound instead of nearly true.
 */
test("a rule stated in the setup is stated in the card's own labels", () => {
    const ctx = ctxOf();
    const marks = randomRelationLabels(Math.random, "red");

    let checked = 0;
    seeded(4242, () => {
        for (let r = 0; r < 30 && checked < 3; r++) {
            let q: Question;
            try {
                q = BUILD[EnumQuestionType.StimulusFunction](
                    ctx, QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.StimulusFunction].minNumOfPremises + (r % 3));
            } catch { continue; }

            const rule = (q.setup ?? []).find(l => /Being/.test(bare(l)));
            if (!rule) continue;
            checked++;

            const label = bare(symboliseSetup(rule, marks)).match(/Being (\S+) makes/)?.[1];
            assert(!!label, `no relation in the rule: ${bare(rule)}`);
            /* A label rather than the English word it replaced, which is the
               whole fix — and one this card actually uses. */
            assert(!symbolisedWords().includes(label!),
                `the rule still says "${label}" in words`);

            const premises = bare(q.premises.map(pr => symboliseStatement(pr, marks)).join(" "));
            assert(premises.includes(label!),
                `the rule names ${label} and no premise uses it`);
        }
    });
    assert(checked > 0, "no Stimulus Function item stated its rule");
});

/**
 * And the item handed to the screen has been through it.
 *
 * The three sweeps above call `symboliseSetup` themselves, which says the
 * converter works and nothing at all about whether anything calls it — remove
 * the one line in `asMinimal` that does and every one of them still passes.
 * That is the shape of the defect this whole area started as: a conversion that
 * covered the statements and skipped the line the item turns on.
 *
 * Read off the shipped service, beside the statement conversions it belongs
 * with, because what regresses is the call and not the function.
 */
test("the service converts a setup line as well as the statements", () => {
    const src = readFileSync(
        "src/app/syllogimous/services/game.service.ts", "utf8");

    const at = src.indexOf("private asMinimal");
    assert(at > 0, "the conversion pass is gone from the service");
    const pass = src.slice(at, at + 3000);

    assert(/question\.setup = question\.setup\.map\(/.test(pass),
        "the setup is not converted, so a relabelled card states its rule in words");
    assert(/symboliseSetup\(/.test(pass),
        "the setup goes through the statement converter, which would rewrite its prose");
    /* And the statements still go through theirs — the two are different
       functions on purpose, and swapping either for the other is a defect. */
    assert(/question\.premises = question\.premises\.map\(one\)/.test(pass),
        "the premises are no longer converted as statements");
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
