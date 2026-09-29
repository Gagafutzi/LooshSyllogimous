/**
 * The screens that fill the viewport, and the ones that must not.
 *
 * `app-card` was built for a question: a narrow column is easier to read, and a
 * fixed height keeps the answer buttons where the hand expects them. Every other
 * screen inherited that by living in the same component, which is fine for the
 * focused ones and wrong for the tables — the tiers matrix is sixty mode columns
 * in a 38rem box.
 *
 * The opt-in is a marker written in one place and read in two others: the page
 * sets `wide` on the element, the component turns it into a class, and the
 * stylesheet is what makes the class mean anything. That is the shape of defect
 * this suite exists for, so all three ends are checked against each other rather
 * than just the one that is easy to check.
 */

import { readFileSync } from "fs";
import { assert, equal, test } from "./harness";

const CARD = "src/app/syllogimous/components/card/card.component";
const page = (name: string) =>
    readFileSync(`src/app/syllogimous/pages/${name}/${name}.component.html`, "utf8");

/**
 * The screens that are tables, lists or dashboards.
 *
 * Named rather than derived from which ones carry the attribute, for the reason
 * the imported-modes list is named: a check whose subject is defined by the thing
 * it is checking cannot fail. A page that loses its `wide` would still match a
 * derivation of "the pages that have `wide`".
 */
const DENSE = [
    "progress-dashboard",   // three rows of tiles and a per-mode table
    "tiers-matrix",         // twenty-five rows by sixty mode columns
    "history",              // every item ever answered
    "tutorials",            // one entry per mode, and there are sixty
    "settings",             // a form
    "other-games",          // a list of links
];

/**
 * The screens where the narrow card *is* the design.
 *
 * A question read once, and the screens either side of it. Widening these would
 * not be a neutral change — the game card's two pinned corner buttons and its
 * fixed-height answer area are placed against that size.
 */
const FOCUSED = ["game", "intro", "start", "summary", "feedback", "tutorial"];

test("the dense screens ask for the whole viewport and the focused ones do not", () => {
    /*
     * Bound, not bare. `<app-card wide>` passes the *string* `""`, which Angular's
     * template checking rejects for a boolean input — so the attribute has to be
     * written as a binding, and this has to look for the binding or it would pass
     * against a form that does not compile.
     */
    for (const name of DENSE) {
        assert(/<app-card\s+\[wide\]="true"/.test(page(name)),
            `${name} is a table-shaped screen and sits in the 38rem question card`);
    }
    for (const name of FOCUSED) {
        assert(!/<app-card\s+\[wide\]/.test(page(name)),
            `${name} is built around the narrow card and has been widened`);
    }
});

/**
 * What the page writes, the component reads, and the stylesheet acts on.
 *
 * Each of the three can be changed without the others complaining: an input
 * renamed in the component leaves the template's attribute silently inert, and a
 * class renamed in the stylesheet leaves the card the same size with everything
 * still "working". Neither shows up as an error — the screen simply stays narrow.
 */
test("the wide flag survives the whole way from page to stylesheet", () => {
    const cls = readFileSync(`${CARD}.ts`, "utf8");
    const html = readFileSync(`${CARD}.html`, "utf8");
    const css = readFileSync(`${CARD}.scss`, "utf8");

    assert(/@Input\(\)\s+wide\b/.test(cls),
        "the card has no `wide` input, so the attribute the pages set is inert");

    for (const marker of ["playcard--wide", "playcard-body--wide"]) {
        assert(new RegExp(`\\[class\\.${marker}\\]="wide"`).test(html),
            `the card's template never puts ${marker} on anything`);
        assert(new RegExp(`\\.${marker}\\s*\\{`).test(css),
            `${marker} is set on an element and the stylesheet does not define it`);
    }
});

/**
 * And the wide card is actually wider than the narrow one.
 *
 * The rule could exist, be applied, and set a width that changes nothing. Read
 * out of the stylesheet as numbers rather than trusted as present.
 */
test("the wide card is wider and taller than the question card", () => {
    const css = readFileSync(`${CARD}.scss`, "utf8");
    const widthOf = (selector: string) => {
        const block = css.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`));
        assert(!!block, `no rule for .${selector}`);
        const m = block![1].match(/width:\s*min\(([\d.]+)rem/);
        assert(!!m, `.${selector} does not set a width in rem: ${block![1]}`);
        return Number(m![1]);
    };
    assert(widthOf("playcard--wide") > widthOf("playcard"),
        "the wide card is no wider than the question card");

    /* The narrow rule has to come first, or it would win on equal specificity. */
    assert(css.indexOf(".playcard {") < css.indexOf(".playcard--wide"),
        "the wide rule is declared before the base one, so the base overrides it");
    /* And the mobile rule has to come last, or wide screens would keep a gutter
       on a phone where the card is meant to be edge to edge. */
    assert(css.indexOf(".playcard--wide") < css.indexOf("@media(max-width: 768px)"),
        "the mobile full-bleed rule no longer overrides the wide width");
});
