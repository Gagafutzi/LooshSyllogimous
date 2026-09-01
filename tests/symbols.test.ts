/**
 * Minimal mode: a mark where a relation word would be.
 *
 * The requirement is "this must exist for every relation", and the table that
 * satisfies it is hand-written — `linear.utils` imports `phrasing`, so
 * `phrasing` cannot import the scales back and build the table from them. A
 * hand-written list that can fall behind the thing it mirrors is the failure
 * this project keeps finding, so completeness is checked here instead: every
 * scale, every direction, every tie, every cyclic wording.
 *
 * A relation the app can state and the table cannot is a build failure rather
 * than a blank on somebody's card.
 */

import { assert, equal, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import {
    rel, setSymbolRelations, symbolFor, symbolise, symbolisedWords, symbolLegend,
} from "../src/app/syllogimous/utils/phrasing";
import { LINEAR_SCALES, SPATIAL_SCALES } from "../src/app/syllogimous/utils/linear.utils";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");
const SCALES = { ...LINEAR_SCALES, ...SPATIAL_SCALES };

/** Every word any scale can put on a card, with where it came from. */
function everyRelationWord(): Array<{ word: string; from: string }> {
    const out: Array<{ word: string; from: string }> = [];
    for (const [id, s] of Object.entries(SCALES)) {
        const add = (word: string | undefined, field: string) => {
            if (word) out.push({ word, from: `${id}.${field}` });
        };
        add(s.above, "above");
        add(s.below, "below");
        add(s.same, "same");
        add(s.direction[0], "direction[0]");
        add(s.direction[1], "direction[1]");
        add((s as { tie?: string }).tie, "tie");

        const cyclic = (s as { cyclic?: { direction?: string[]; same?: string } }).cyclic;
        if (cyclic) {
            add(cyclic.direction?.[0], "cyclic.direction[0]");
            add(cyclic.direction?.[1], "cyclic.direction[1]");
            add(cyclic.same, "cyclic.same");
        }
    }
    return out;
}

test("every relation any scale can state has a mark", () => {
    const missing = everyRelationWord()
        .filter(({ word }) => !symbolFor(word))
        .map(({ word, from }) => `${from} = "${word}"`);

    assert(missing.length === 0,
        `${missing.length} relation(s) would still be printed as words:\n  `
        + missing.join("\n  "));
});

/** And nothing in the table is for a relation no scale can produce. */
test("no mark stands for a relation that does not exist", () => {
    const real = new Set(everyRelationWord().map(w => w.word));
    const stale = symbolisedWords().filter(w => !real.has(w));
    assert(stale.length === 0,
        `the table carries words no scale states any more: ${stale.join(", ")}`);
});

/**
 * Two axes sharing a mark would be unreadable in a composed space for anyone
 * who cannot use the colours — which is the one channel that carries "which
 * axis" otherwise. Shared marks are allowed only *within* an axis, where the
 * same fact is said twice.
 */
test("no two axes are given the same mark", () => {
    const byMark = new Map<string, Set<string>>();
    for (const [id, s] of Object.entries(SCALES)) {
        for (const word of [s.above, s.below, s.direction[0], s.direction[1]]) {
            const mark = symbolFor(word);
            if (!mark) continue;
            (byMark.get(mark) ?? byMark.set(mark, new Set()).get(mark)!).add(id);
        }
    }

    for (const [mark, axes] of byMark) {
        // `up` and `vertical` are two spellings of one axis and never co-occur.
        const distinct = new Set([...axes].map(a => (a === "vertical" ? "up" : a)));
        assert(distinct.size <= 1,
            `${mark} stands for ${[...axes].join(" and ")}, which a composed space`
            + " can state in the same line");
    }
});

/* ------------------------------------------------------------------ *
 * The switch                                                          *
 * ------------------------------------------------------------------ */

test("off, a relation reads exactly as it always did", () => {
    setSymbolRelations(false);
    equal(strip(rel("3 north")), "3 north", "words were replaced with the switch off");
    equal(symbolise("is east of"), "is east of", "words were replaced with the switch off");
});

test("on, the words become marks and the distances stay", () => {
    setSymbolRelations(true);
    equal(strip(rel("3 north")), "3 ↑", "a distance lost its number, or its mark");
    equal(strip(rel("is east of")), "→", "a whole relation phrase was not replaced");
    equal(strip(rel("2 above, 1 earlier")), "2 ⇧, 1 «",
        "a multi-clause position did not come through");
    setSymbolRelations(false);
});

/**
 * "is above" must not be read as the word "above" with an "is" in front, or the
 * card says "is ⇧" where it means "⇧".
 */
test("the longest wording wins", () => {
    setSymbolRelations(true);
    equal(strip(rel("is above")), "⇧", "a compound relation matched its own tail");
    equal(strip(rel("later in the cycle")), "↻", "a cyclic wording matched plain 'later'");
    setSymbolRelations(false);
});

/** Object names go through `subj`, never here, so a thing called North is safe. */
test("only relation text is touched", () => {
    setSymbolRelations(true);
    equal(symbolise("Northbound"), "Northbound", "a word containing a relation was rewritten");
    equal(symbolise("eastern"), "eastern", "a word containing a relation was rewritten");
    setSymbolRelations(false);
});

/* ------------------------------------------------------------------ *
 * On a real card                                                      *
 * ------------------------------------------------------------------ */

/**
 * The check that would have caught the first version, and did not exist.
 *
 * Substitution went into `rel` on the reasoning that it is the funnel every
 * relation word passes through. It is not: the composed spaces write their
 * clauses through `hi`, so every n-dimensional card — most of what the setting
 * is for — printed "3 north" with the switch on. Reading the code said the fix
 * was complete; generating an item said otherwise.
 *
 * So this asserts on the premises of built items rather than on the helper.
 */
test("no relation word survives on a card with the switch on", () => {
    const words = everyRelationWord().map(w => w.word)
        .sort((a, b) => b.length - a.length);

    seeded(5150, () => {
        setSymbolRelations(true);
        try {
            for (const type of [
                EnumQuestionType.Space4D,
                EnumQuestionType.Space3D,
                EnumQuestionType.Direction,
                EnumQuestionType.AnchorSpace,
            ]) {
                const build = BUILD[type];
                if (!build) continue;

                for (let rep = 0; rep < 6; rep++) {
                    let q;
                    try { q = build(context(), 3); } catch { continue; }

                    for (const line of q.premises.map(strip)) {
                        for (const word of words) {
                            assert(!new RegExp(`\\b${word}\\b`).test(line),
                                `${type} still says "${word}": ${line}`);
                        }
                    }
                }
            }
        } finally {
            setSymbolRelations(false);
        }
    });
});

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
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/* ------------------------------------------------------------------ *
 * The key behind the "?"                                              *
 * ------------------------------------------------------------------ */

/**
 * A mark you cannot read is worse than the word it replaced, so the key is the
 * other half of the feature rather than a nicety.
 *
 * It is built by scanning the card's own text, which is what makes it unable to
 * disagree with the card: a key listing an axis the item never mentions is
 * worse than none, and one missing an axis it does mention is worse still.
 */
test("the key lists every mark on the card and none that is not", () => {
    setSymbolRelations(true);
    try {
        const card = [strip(rel("3 north")), strip(rel("2 above, 1 earlier"))];
        const rows = symbolLegend(card);
        const marks = rows.map(r => r.mark);

        assert(marks.includes("↑"), "a mark on the card is missing from the key");
        assert(marks.includes("⇧"), "a mark on the card is missing from the key");
        assert(marks.includes("«"), "a mark on the card is missing from the key");
        assert(!marks.includes("→"), "the key explains a mark the card never used");
        equal(new Set(marks).size, marks.length, "a mark is listed twice");
    } finally {
        setSymbolRelations(false);
    }
});

/** The short spelling, because a key is read at a glance or not at all. */
test("the key names the direction, not the sentence", () => {
    setSymbolRelations(true);
    try {
        const rows = symbolLegend([strip(rel("is north of"))]);
        equal(rows.length, 1, "one mark should have produced one row");
        equal(rows[0].word, "north", `the key reads "${rows[0].word}"`);
    } finally {
        setSymbolRelations(false);
    }
});

/** Nothing to decode when the card says words, so nothing is offered. */
test("no key when the switch is off", () => {
    setSymbolRelations(false);
    equal(symbolLegend([strip(rel("3 north"))]).length, 0,
        "a key was offered for a card with no marks on it");
});
