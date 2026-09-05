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
    randomRelationLabels, setSymbolRelations, symbolLegend,
    symboliseStatement,
} from "../src/app/syllogimous/utils/phrasing";
import { LINEAR_SCALES, SPATIAL_SCALES } from "../src/app/syllogimous/utils/linear.utils";
import { labelSchemeFrom } from "../src/app/syllogimous/services/game.service";

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
