/**
 * What a stimulus may be made of.
 *
 * Everything on a card reaches the DOM through an `[innerHTML]` binding, and
 * Angular's sanitiser keeps only the elements on its allowlist. `svg` is not on
 * it. So a stimulus built out of inline SVG is not merely styled oddly — it is
 * *removed*, and the player sees an empty subject where a token should be.
 *
 * That had happened. `visual-noise.utils` met it, solved it by drawing to a PNG
 * data URL, and wrote the reason down — in that file. `junk-emoji.utils` was
 * written afterwards, emitted `<svg class="junk">`, and every junk-shape
 * stimulus vanished on the way to the screen. There was even a `svg.junk` rule
 * in the theme sizing something that never arrived.
 *
 * A comment in one file cannot stop that. This can: it holds every stimulus
 * pool to markup that survives, so the next kind added to the mix — the pharmacy
 * one is the first since — fails here rather than on the screen.
 */

import { assert, equal, test } from "./harness";
import { getEmojis, NOUNS, getStrings } from "../src/app/syllogimous/constants/question.constants";
import { getJunkEmojiSymbols, junkEmoji } from "../src/app/syllogimous/utils/junk-emoji.utils";
import {
    getVisualNoiseSymbols, resetVisualNoisePool,
} from "../src/app/syllogimous/utils/visual-noise.utils";
import {
    MOLECULES, TERMS, getPharmaSymbols, resetPharmaFaces,
} from "../src/app/syllogimous/utils/pharma.utils";

/**
 * Angular's inline allowlist, the part a stimulus could plausibly want.
 *
 * Copied deliberately rather than imported: importing the framework's private
 * set would make this test agree with whatever Angular does next, and the point
 * is to notice when that changes.
 */
const KEPT = new Set([
    "b", "i", "u", "s", "em", "strong", "small", "span", "sub", "sup", "br",
    "img", "div", "abbr", "code", "mark",
]);

const tagsIn = (html: string) =>
    [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase());

/** Visible characters, which is what has to fit inside a premise. */
const visibleLength = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/g, "x").length;

const POOLS: Array<[string, () => string[]]> = [
    ["text", () => getStrings().slice(0, 200)],
    ["nouns", () => NOUNS.slice(0, 200)],
    ["emoji", () => getEmojis()],
    ["junk shapes", () => getJunkEmojiSymbols(60)],
    ["visual noise", () => getVisualNoiseSymbols()],
    ["pharmacy", () => getPharmaSymbols()],
];

/**
 * Run something with a canvas available, which is the state a player is in.
 *
 * The harness stubs `document` with just enough for the theme service, so the
 * picture kinds take their no-canvas fallback and emit SVG — legitimately, and
 * never on a screen. A test that read that fallback would be checking the one
 * path that does not ship, which is how the bug survived in the first place.
 */
function withCanvas<T>(fn: () => T): T {
    const real = (globalThis as { document?: any }).document;
    (globalThis as { document?: any }).document = {
        ...real,
        createElement: () => ({
            width: 0, height: 0,
            getContext: () => ({
                scale() {}, beginPath() {}, arc() {}, fill() {}, fillRect() {},
                moveTo() {}, lineTo() {}, closePath() {}, fillStyle: "",
            }),
            toDataURL: () => "data:image/png;base64,STUB",
        }),
    };
    // The noise pool is cached, so it has to be rebuilt in whichever
    // environment the caller is setting up rather than kept from the last one.
    resetVisualNoisePool();
    // Other suites write to the harness's own stub, so it always goes back.
    try { return fn(); } finally {
        (globalThis as { document?: any }).document = real;
        resetVisualNoisePool();
    }
}

test("every stimulus is made of markup the sanitiser keeps", () => {
    const faults = new Set<string>();

    withCanvas(() => {
        for (const [name, pool] of POOLS) {
            for (const symbol of pool()) {
                for (const tag of tagsIn(symbol)) {
                    if (!KEPT.has(tag)) faults.add(`${name}: <${tag}> is dropped on the way to the screen`);
                }
                if (!visibleLength(symbol) && !/<img/.test(symbol)) {
                    faults.add(`${name}: a stimulus with nothing visible in it`);
                }
            }
        }
    });

    equal(faults.size, 0, `\n  ${[...faults].join("\n  ")}`);
});

/**
 * The picture kinds specifically, because their node output is *allowed* to be
 * SVG — it is the fallback for having no DOM — and a test that only ever sees
 * the fallback would have passed on the bug it exists to catch.
 */
test("a picture stimulus ships as an image, not as inline SVG", () => {
    withCanvas(() => {
        for (const [name, render] of [
            ["junk shape", () => junkEmoji(7)],
            ["visual noise", () => getVisualNoiseSymbols()[0]],
        ] as Array<[string, () => string]>) {
            const markup = render();
            assert(markup.startsWith("<img"), `a ${name} rendered as ${markup.slice(0, 24)}`);
            assert(/src="data:image\/png/.test(markup), `a ${name} is not a png data url`);
            assert(!/<svg/.test(markup), `a ${name} still carries inline SVG`);
        }
    });
});

/** The fallback is allowed to be SVG — it is the path with nothing to draw on. */
test("without a canvas a picture stimulus still says something", () => {
    const markup = junkEmoji(7);
    assert(markup.startsWith("<svg"), "the no-canvas fallback stopped being SVG");
});

/* ------------------------------------------------------------------ *
 * The pharmacy pool                                                   *
 * ------------------------------------------------------------------ */

/**
 * Two tokens in one item have to be *different tokens*.
 *
 * Sum formulas are the risk: sucrose and lactose share one, and a pool holding
 * both as formulas would put the same token in a premise twice under two names.
 */
test("no two molecules can show the same face", () => {
    const seen = new Map<string, string>();
    for (const m of MOLECULES) {
        const forms = [m.name, m.formula.map(([el, n]) => el + (n === 1 ? "" : n)).join("")];
        if (m.condensed) forms.push(m.condensed);
        for (const form of forms) {
            const other = seen.get(form);
            assert(!other || other === m.name, `${m.name} and ${other} both show as ${form}`);
            seen.set(form, m.name);
        }
    }
});

/**
 * And one molecule may never show two faces at once.
 *
 * The pool is rebuilt per question and some generators draw from it more than
 * once for a single item, so a face chosen per draw would eventually put a drug
 * beside its own formula and call it a relation.
 */
test("a molecule wears one face at a time", () => {
    resetPharmaFaces();
    const pool = getPharmaSymbols();

    for (const m of MOLECULES) {
        const forms = [m.name, m.formula.map(([el, n]) => el + (n === 1 ? "" : `<sub>${n}</sub>`)).join("")];
        if (m.condensed) forms.push(m.condensed);
        const present = forms.filter(f => pool.includes(f));
        equal(present.length, 1, `${m.name} is in the pool ${present.length} times`);
    }

    // Same pool on the next draw, or an item could still mix two of them.
    assert(getPharmaSymbols().every((s, i) => s === pool[i]), "the pool changed between draws");
});

test("the pharmacy pool is big enough and short enough to use", () => {
    resetPharmaFaces();
    const pool = getPharmaSymbols();

    assert(pool.length >= 60, `only ${pool.length} pharmacy stimuli`);
    equal(new Set(pool).size, pool.length, "the pharmacy pool repeats itself");

    for (const symbol of pool) {
        assert(visibleLength(symbol) <= 14,
            `"${symbol}" is ${visibleLength(symbol)} characters, which reads as a sentence`);
    }
    for (const term of TERMS) {
        assert(/^[A-Za-zÄÖÜäöüß-]+$/.test(term), `"${term}" is not a plain word`);
    }
});

/**
 * Every element symbol is a real one, spelled the way chemistry spells it.
 *
 * The cheapest guard against the failure mode that matters here: a wrong
 * formula shown three hundred times is worse than no formula at all.
 */
test("formulas are made of real elements", () => {
    const ELEMENTS = new Set(["C", "H", "N", "O", "S", "P", "Cl", "F", "Br", "I", "Na", "K"]);
    for (const m of MOLECULES) {
        assert(m.formula.length > 0, `${m.name} has no formula`);
        for (const [el, n] of m.formula) {
            assert(ELEMENTS.has(el), `${m.name} names an element "${el}"`);
            assert(Number.isInteger(n) && n > 0, `${m.name} has ${n} of ${el}`);
        }
        // Carbon first, then hydrogen: Hill notation, which is what a formula
        // looks like everywhere it is printed.
        equal(m.formula[0][0], "C", `${m.name} does not start with carbon`);
        equal(m.formula[1][0], "H", `${m.name} does not put hydrogen second`);
    }
});
