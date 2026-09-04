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
    RELATION_SYMBOLS, randomRelationLabels, setSymbolRelations, symbolLegend,
    symboliseStatement,
} from "../src/app/syllogimous/utils/phrasing";

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
