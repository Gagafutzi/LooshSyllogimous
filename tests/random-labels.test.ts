/**
 * Relation labels invented per item.
 *
 * Minimal mode swapped the relation words for a *fixed* table of marks, and a
 * fixed table is learned like the words it replaced: after enough items the
 * mark is retrieved as fast as the word, and so is what two of them compose to.
 * The cost of losing the meaning is paid and nothing is collected for it.
 *
 * Drawing the labels fresh per item removes the thing that can be cached.
 * These are the properties that has to have to be answerable at all.
 */

import { assert, equal, seeded, test } from "./harness";
import {
    INVERTED_LABEL_CLASS, LabelScheme, RELATION_SYMBOLS, markPairs,
    randomRelationLabels, setSymbolRelations, symbolLegend, symboliseSetup,
    symboliseStatement,
} from "../src/app/syllogimous/utils/phrasing";
import { LINEAR_SCALES, SPATIAL_SCALES } from "../src/app/syllogimous/utils/linear.utils";
import { labelSchemeFrom } from "../src/app/syllogimous/services/game.service";
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

/** Every mode switched on, nothing earned — the plainest item each can build. */
function ctxOf(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Words the fixed table treats as the same relation must stay together. */
function classesOf(map: Record<string, string>): string[] {
    const by = new Map<string, string[]>();
    for (const [word, mark] of Object.entries(map)) {
        const list = by.get(mark) ?? [];
        list.push(word);
        by.set(mark, list);
    }
    return [...by.values()].map(w => w.slice().sort().join("|")).sort();
}

test("synonyms keep their grouping, so an item cannot contradict itself", () => {
    seeded(11, () => {
        const before = classesOf(RELATION_SYMBOLS).join(" / ");
        for (let i = 0; i < 40; i++) {
            equal(classesOf(randomRelationLabels()).join(" / "), before,
                "two wordings of one relation were given different labels — the "
                + "item would say two different things about the same relation");
        }
    });
});

test("no two relations share a label", () => {
    seeded(22, () => {
        for (let i = 0; i < 200; i++) {
            const fresh = randomRelationLabels();
            equal(new Set(Object.values(fresh)).size, classesOf(fresh).length,
                "two different relations were given the same label, which merges them");
        }
    });
});

test("every relation the fixed table knows gets a label", () => {
    const fresh = randomRelationLabels();
    const missing = Object.keys(RELATION_SYMBOLS).filter(w => !fresh[w]);
    equal(missing.length, 0, "unlabelled: " + missing.slice(0, 6).join(", "));
});

test("the labels actually change from item to item", () => {
    seeded(33, () => {
        const seen = new Set<string>();
        for (let i = 0; i < 30; i++) seen.add(JSON.stringify(randomRelationLabels()));
        assert(seen.size > 25,
            "only " + seen.size + " distinct vocabularies in 30 items — a table "
            + "this stable is as learnable as the fixed one");
    });
});

test("a statement is rewritten in the item's own labels, and object names are not", () => {
    setSymbolRelations(false);   // the fresh table must work on its own
    seeded(44, () => {
        const fresh = randomRelationLabels();
        const html = '<span class="subject">Kiwi</span> is north of <span class="subject">Doll</span>';
        const out = symboliseStatement(html, fresh);
        assert(out.indexOf(fresh["north"]) >= 0, "the relation was not replaced: " + out);
        assert(out.indexOf(">Kiwi<") >= 0 && out.indexOf(">Doll<") >= 0,
            "an object name was rewritten: " + out);
        assert(!/\bnorth\b/.test(out), "the relation word survived: " + out);
    });
});

test("the key decodes the card it belongs to", () => {
    setSymbolRelations(false);
    seeded(55, () => {
        const a = randomRelationLabels();
        const text = symboliseStatement(
            '<span class="subject">X</span> is north of <span class="subject">Y</span>', a);
        const key = symbolLegend([text], a);
        equal(key.length, 1, "the key did not describe the one relation on the card");
        equal(key[0].mark, a["north"]);
        assert(key[0].word.indexOf("north") >= 0,
            "the key named the wrong relation: " + key[0].word);
    });
});

/* ------------------------------------------------------------------ *
 * The key describes the card, and only the card                       *
 * ------------------------------------------------------------------ *
 *
 * `symbolLegend` reads the marks off the rendered text rather than off the
 * item's axis list, so it cannot disagree with what is on screen. It found them
 * with `includes`, which is a substring test, and a substring test on a card
 * has two ways to be wrong — both of them producing a row about a relation the
 * item does not contain, on the one screen whose whole job is to say what the
 * card means.
 */

test("a mark nested inside another is not read out of it", () => {
    setSymbolRelations(true);
    try {
        /* The temperature axis is ↑°/↓° and the vertical one is ↑/↓, so a card
           stating nothing but temperature used to be given two extra rows
           explaining "north" and "south". */
        const card = ['<span class="subject">Aaa</span> <span class="relation">↑°</span> '
            + '<span class="subject">Bbb</span>'];
        const key = symbolLegend(card);

        equal(key.length, 1, `the key has ${key.length} rows for one relation: `
            + key.map(r => `${r.mark}=${r.word}`).join(", "));
        equal(key[0].mark, "↑°", "the wrong half of the pair was credited");
    } finally { setSymbolRelations(false); }
});

test("a label is not read out of an object's name", () => {
    setSymbolRelations(false);
    /*
     * A label is two letters of the Latin alphabet and one stimulus pool is
     * three-letter consonant-vowel-consonant strings in the same alphabet —
     * QAR, ZIT, RUX — so "AR" is inside "QAR". Measured at about one in
     * seventy label-and-card pairs: often enough to be met, rare enough never
     * to be reproduced on demand.
     *
     * Written as a fixed table rather than a drawn one, because the failure is
     * a coincidence and a test that waits for one is a test that passes.
     */
    const marks = {
        "north": "AR", "is north of": "AR",
        "south": "ZK", "is south of": "ZK",
    };
    const card = ['<span class="subject">QAR</span> <span class="relation">ZK</span> '
        + '<span class="subject">ZIT</span>'];

    const key = symbolLegend(card, marks);
    equal(key.length, 1,
        `the key explains ${key.map(r => strip(r.mark)).join(", ")} on a card that`
        + " only states one relation — the other is inside an object's name");
    equal(key[0].mark, "ZK", "the key credited the name rather than the relation");
});

test("the key still reads in the order the card does", () => {
    setSymbolRelations(true);
    try {
        /* The rows are scanned against the card, so their order has to be the
           card's — and striking out a mark as it is credited must not move the
           ones after it. */
        const card = ['<span class="relation">↓°</span> then <span class="relation">＞</span>'
            + ' then <span class="relation">↑</span>'];
        equal(symbolLegend(card).map(r => r.mark), ["↓°", "＞", "↑"],
            "the key is not in the order the card reads");
    } finally { setSymbolRelations(false); }
});

/**
 * Every label a card shows has a row in its key, across every mode.
 *
 * The two tests above are about rows the key should not have. This is the other
 * direction, and it is the one that makes an item unanswerable rather than
 * merely confusing: a label with no row is a relation the reader is given no
 * way to decode, on a scheme whose whole premise is that the vocabulary is
 * arbitrary and the key is how you learn it.
 *
 * Swept over every mode because the failure is structural, not per-mode. The
 * key is built from `setup`, `premises`, `conclusion` and `choices` — and not
 * from `choicePrompt`, which is the field a new mode would most easily put a
 * relation in.
 *
 * **This passes today for a reason worth writing down: no mode shows a relation
 * anywhere but its premises.** Every label in a conclusion, an option or a
 * prompt is one the premises already carry, so the sweep survives dropping any
 * one field from the key — it was tried. So it is a tripwire for the next mode
 * rather than a fix for this one, and the test below is what keeps it from
 * being a claim of coverage instead of coverage: it checks that the condition
 * this sweep is built on can actually fail.
 */
test("every label on a card has a row in that card's key", () => {
    const ctx = ctxOf();
    const unkeyed: string[] = [];

    seeded(31337, () => {
        for (const type of Object.values(EnumQuestionType)) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];

            for (let r = 0; r < 12; r++) {
                let q: Question;
                try { q = BUILD[type](ctx, params.minNumOfPremises + (r % 3)); } catch { continue; }

                const marks = randomRelationLabels();
                const conv = (t: unknown) => symboliseStatement(String(t ?? ""), marks);

                /* The same four fields the game screen hands to `symbolLegend`. */
                const keyed = [
                    ...(q.setup ?? []).map(l => symboliseSetup(l, marks)),
                    ...q.premises.map(conv),
                    ...(Array.isArray(q.conclusion) ? q.conclusion : [q.conclusion ?? ""]).map(conv),
                    ...q.choices.map(conv),
                ];
                const rows = new Set(symbolLegend(keyed, marks).map(row => row.mark));

                /* Everything the player is shown, the prompt included. */
                const shown = [...keyed, conv(q.choicePrompt)].join(" ");

                for (const label of new Set(Object.values(marks))) {
                    if (shown.includes(label) && !rows.has(label)) {
                        unkeyed.push(`${type}: ${strip(label)}`);
                    }
                }
            }
        }
    });

    equal([...new Set(unkeyed)].length, 0,
        `a label is shown with nothing in the key to decode it:\n  `
        + [...new Set(unkeyed)].join("\n  "));
});

/**
 * And the sweep above can fail, which is the part that is not free.
 *
 * Every mode currently restates its relations in its premises, so the sweep
 * would pass even against a key that read nothing at all. What is asserted here
 * is the detection itself, on the card shape a future mode would have: a
 * relation shown somewhere the key does not read. If this ever stops failing to
 * find it, the sweep above has stopped meaning anything.
 */
test("...and an unkeyed label is something the sweep can see", () => {
    const marks = randomRelationLabels();
    const north = marks["north"], south = marks["south"];
    assert(north !== south, "the two poles drew the same label");

    /* One relation, in a field the key reads. */
    const keyed = [`<span class="subject">Aaa</span> `
        + `<span class="relation">${north}</span> <span class="subject">Bbb</span>`];
    const rows = new Set(symbolLegend(keyed, marks).map(row => row.mark));

    equal([...rows], [north], "the key did not describe the one relation it was given");

    /* And another only in the prompt, which it does not. */
    const shown = [...keyed, `Which of them is ${south}?`].join(" ");
    assert(shown.includes(south) && !rows.has(south),
        "an unkeyed label is not detectable, so the sweep above proves nothing");
});

/* ------------------------------------------------------------------ *
 * Telling one pole from the other                                     *
 * ------------------------------------------------------------------ */

/**
 * A label is arbitrary, and that leaves a problem the marks never posed.
 *
 * `＞` says on its face that it is the opposite of `＜`; "QF" says nothing at
 * all about "ZK". So a standalone item — one with no key — has to hand the
 * reader the pairing some other way, and each scheme is a different way of
 * doing it. What every one of them has to keep is that a relation and its
 * opposite are still two different things on the card.
 */
const strip = (h: string) => h.replace(/<[^>]+>/g, "");

/**
 * Both poles of a scale, as the fixed table marks them.
 *
 * Distinction is skipped, and it is the reason this is a function rather than a
 * list: it has no order, so its two "directions" are one word said twice. A
 * pair whose halves are the same relation has no inverted half to mark.
 */
function polePairs(): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    for (const s of Object.values({ ...LINEAR_SCALES, ...SPATIAL_SCALES })) {
        if (!s.above || !s.below) continue;
        if (s.above === s.below) continue;
        if (RELATION_SYMBOLS[s.above] === RELATION_SYMBOLS[s.below]) continue;
        out.push([s.above, s.below]);
    }
    return out;
}

test("every scale's two directions are a pair the labels know about", () => {
    const known = new Set<string>();
    for (const [a, b] of markPairs()) { known.add(`${a}|${b}`); known.add(`${b}|${a}`); }

    const missing: string[] = [];
    for (const [above, below] of polePairs()) {
        const [x, y] = [RELATION_SYMBOLS[above], RELATION_SYMBOLS[below]];
        if (!x || !y) continue;
        if (!known.has(`${x}|${y}`)) missing.push(`"${above}" / "${below}" (${x} ${y})`);
    }

    equal(missing.length, 0,
        "a scale states two directions the label schemes cannot pair, so its"
        + ` inverted pole would be drawn as an unrelated relation:\n  ${missing.join("\n  ")}`);
});

test("red gives both poles one label and marks the inverted one", () => {
    seeded(5, () => {
        const marks = randomRelationLabels(Math.random, "red");
        for (const [above, below] of polePairs()) {
            if (!marks[above] || !marks[below]) continue;
            equal(strip(marks[below]), strip(marks[above]),
                `"${above}" and "${below}" were given different labels, so the`
                + " pairing red is meant to carry is not there");
            assert(marks[below].includes(INVERTED_LABEL_CLASS)
                !== marks[above].includes(INVERTED_LABEL_CLASS),
                `"${above}" and "${below}" are marked the same way, so nothing`
                + " says which of them is inverted");
        }
    });
});

test("anagram turns the label round rather than colouring it", () => {
    seeded(6, () => {
        const marks = randomRelationLabels(Math.random, "anagram");
        for (const [above, below] of polePairs()) {
            const [a, b] = [marks[above], marks[below]];
            if (!a || !b) continue;
            assert(!a.includes("<") && !b.includes("<"),
                "an anagram label carried markup, which is the red scheme's cue");
            equal(b, a.split("").reverse().join(""),
                `"${above}" is ${a} and "${below}" is ${b}, which is not its anagram`);
            assert(a !== b,
                `${a} is its own anagram, so a relation and its opposite read alike`);
        }
    });
});

test("axis colour leaves the poles unrelated, which is the hard one", () => {
    seeded(7, () => {
        const marks = randomRelationLabels(Math.random, "colour");
        let differing = 0;
        for (const [above, below] of polePairs()) {
            if (!marks[above] || !marks[below]) continue;
            assert(!marks[above].includes("<"), "a colour-scheme label carried markup");
            if (marks[above] !== marks[below]) differing++;
        }
        assert(differing > 0,
            "every pole shared its opposite's label, which is the red scheme"
            + " without the red");
    });
});

/**
 * Whichever scheme drew them, two relations that are not the same relation must
 * not arrive as the same text — an item that says "QF" for both "more" and
 * "less" cannot be answered at all.
 */
test("no scheme ever gives one label to two different relations", () => {
    for (const scheme of ["mapped", "red", "anagram", "colour"] as LabelScheme[]) {
        seeded(8, () => {
            for (let i = 0; i < 30; i++) {
                const marks = randomRelationLabels(Math.random, scheme);
                const byLabel = new Map<string, Set<string>>();
                for (const [word, label] of Object.entries(marks)) {
                    const set = byLabel.get(label) ?? new Set<string>();
                    set.add(RELATION_SYMBOLS[word]);
                    byLabel.set(label, set);
                }
                for (const [label, relations] of byLabel) {
                    assert(relations.size <= 1,
                        `${scheme}: ${strip(label)} stands for `
                        + `${[...relations].join(" and ")} at once`);
                }
            }
        });
    }
});

/* ------------------------------------------------------------------ *
 * What the stored setting means                                       *
 * ------------------------------------------------------------------ */

test("the old on/off flag reads as the scheme it behaved like", () => {
    equal(labelSchemeFrom("1"), "mapped",
        "a session that had labels switched on lost them, or lost its key");
    equal(labelSchemeFrom(null), null, "labels came on for somebody who had not asked");
    equal(labelSchemeFrom("red"), "red", "a stored scheme was not read back");
    equal(labelSchemeFrom("nonsense"), null, "an unreadable setting turned labels on");
});
