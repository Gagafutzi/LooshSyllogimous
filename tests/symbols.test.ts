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
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import {
    rel, setSymbolRelations, subj, symbolFor, symbolise, symbolisedWords, symbolLegend,
    symboliseStatement,
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

        /*
         * Parity, which this test did not read and so did not miss.
         *
         * A scale can carry a second vocabulary for composed spaces, where a
         * run of steps reads as odd or even rather than as a distance —
         * "opposite kind" exists only here. The table and this check were
         * written from the same four fields, so the check could not catch what
         * the table had skipped, and a seven-dimensional card printed the word.
         * Every field a scale can put on a card belongs in this list.
         */
        const parity = (s as {
            parity?: {
                same?: string; opposite?: string;
                sameRelation?: string; oppositeRelation?: string;
            };
        }).parity;
        if (parity) {
            add(parity.same, "parity.same");
            add(parity.opposite, "parity.opposite");
            add(parity.sameRelation, "parity.sameRelation");
            add(parity.oppositeRelation, "parity.oppositeRelation");
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
test("no relation word survives on any mode's card", () => {
    const words = everyRelationWord().map(w => w.word)
        .sort((a, b) => b.length - a.length);

    seeded(5150, () => {
        setSymbolRelations(true);
        try {
            const offenders: string[] = [];

            for (const [type, build] of Object.entries(BUILD)) {
                const params = QUESTION_TYPE_SETTING_PARAMS[type as EnumQuestionType];
                const min = params?.minNumOfPremises ?? 3;
                const max = params?.maxNumOfPremises ?? min + 2;

                /*
                 * Every length, and both with the ladder and without it.
                 *
                 * The version of this that ran six items of one length per mode
                 * passed while a seven-dimensional card was printing a word:
                 * the offending axis only appears once a mode is wide enough,
                 * which is a rung away. A sweep that never earns a rung is a
                 * sweep of the easy half of the app.
                 */
                const settings: Array<[number, string[]]> = [];
                for (let n = min; n <= max; n++) {
                    settings.push([n, []], [n, ladderFor(type as EnumQuestionType)]);
                }

                for (const [n, rungs] of settings) {
                    let q;
                    try { q = build(context(rungs), n); } catch { continue; }

                    // Exactly what the service converts before the card sees it.
                    const lines = [
                        ...q.premises,
                        ...(Array.isArray(q.conclusion) ? q.conclusion : [q.conclusion ?? ""]),
                        ...q.choices,
                        ...q.series.flatMap(c => [
                            c.text ?? "", ...(c.premises ?? []), ...(c.choices ?? []),
                        ]),
                    ].map(l => strip(symboliseStatement(l)));

                    for (const line of lines) {
                        for (const word of words) {
                            if (!new RegExp(`\\b${word}\\b`).test(line)) continue;
                            const note = `${type} still says "${word}"`;
                            if (!offenders.includes(note)) offenders.push(note);
                        }
                    }
                }
            }

            assert(offenders.length === 0,
                `${offenders.length} mode/word pair(s) still print words:\n  `
                + offenders.slice(0, 12).join("\n  "));
        } finally {
            setSymbolRelations(false);
        }
    });
});

function context(rungs: string[] = []): GeneratorContext {
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
        hasRung: (_t: string, r: string) => rungs.includes(r),
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

/**
 * A mark that is also markup disappears off the card.
 *
 * Premises are rendered through `[innerHTML]`, so ASCII `<` and `>` are not
 * characters, they are the start and end of a tag. `<span class="relation"><`
 * `</span>` has its symbol eaten by the tag that follows it, and the relation
 * is simply gone — which is what a comparison item reading "Kiwi  Doll" turned
 * out to be. Fullwidth forms look the same and are text.
 */
test("no mark is a character that HTML will read as markup", () => {
    for (const word of symbolisedWords()) {
        const mark = symbolFor(word)!;
        for (const ch of ["<", ">", "&"]) {
            assert(!mark.includes(ch),
                `the mark for "${word}" contains ${ch}, which is markup once it`
                + " reaches innerHTML and takes the relation with it");
        }
    }
});

/** And the whole statement survives the round trip, tags and all. */
test("a symbolised statement still has exactly its own tags", () => {
    setSymbolRelations(true);
    try {
        const before = `${subj("Gem")} ${rel("is less than")} ${subj("Grass")}`;
        const after = symboliseStatement(before);
        equal((after.match(/<span/g) ?? []).length, (before.match(/<span/g) ?? []).length,
            "a span was lost or invented");
        equal((after.match(/<\/span>/g) ?? []).length, (before.match(/<\/span>/g) ?? []).length,
            "a closing tag was lost or invented");
        assert(strip(after).includes("＜"), `the mark did not survive: ${strip(after)}`);
        assert(strip(after).includes("Gem") && strip(after).includes("Grass"),
            "an object name was lost");
    } finally {
        setSymbolRelations(false);
    }
});
