/**
 * The label naming the mode being played.
 *
 * Its whole job is to be there in focus mode, where the tier badge and the nav
 * are hidden and the card is the entire screen. The ways it can quietly stop
 * doing that job are structural — being placed inside something a game mode
 * hides, or pinned into a corner a fixed button already owns — so those are
 * what is checked, rather than the text.
 */

import { readFileSync } from "fs";
import { assert, test } from "./harness";

const HTML = readFileSync(
    "src/app/syllogimous/pages/game/game.component.html", "utf8");
const CSS = readFileSync(
    "src/app/syllogimous/pages/game/game.component.css", "utf8");

test("the mode is named from the question rather than written down twice", () => {
    const tag = HTML.match(/<div class="mode-tag[^"]*"[^>]*>([^<]*)<\/div>/);
    assert(!!tag, "the mode label is gone from the game screen");
    assert(/\{\{\s*game\.question\.type\s*\}\}/.test(tag![1]),
        `the label does not show the question's own type: ${tag![1]}`);
});

test("the mode label survives every game mode", () => {
    /*
     * `.slides` carries d-none in the all-premises mode and `.timerbar` is
     * hidden whenever the clock is off. A label inside either is a label that
     * disappears exactly when somebody has switched to the layout they prefer.
     */
    const at = HTML.search(/class="mode-tag[ "]/);
    assert(at > 0, "the mode label is gone from the game screen");
    const before = HTML.slice(0, at);
    for (const owner of ['class="slides"', 'class="timerbar-wrap"', 'class="timerbar"']) {
        const opened = before.lastIndexOf(owner);
        assert(opened === -1 || before.indexOf("</div>", opened) !== -1,
            `the mode label is inside ${owner}, which is hidden in some modes`);
    }
    assert(before.includes('class="battlefield"'),
        "the mode label is outside the play area");
});

test("the label is not pinned into a corner a fixed button owns", () => {
    /*
     * Both top corners are taken: the nav toggle at 12px left, the focus
     * toggle at 12px right. The seconds readout already had to be moved out
     * from under one of them once.
     */
    const rule = CSS.match(/\.mode-tag\s*\{([^}]*)\}/);
    assert(!!rule, "the mode label has no styling of its own");
    assert(!/position:\s*(fixed|absolute)/.test(rule![1]),
        "the label is taken out of flow, where the fixed toggles sit");
});
