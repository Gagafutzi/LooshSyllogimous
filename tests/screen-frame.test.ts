/**
 * The compass as the screen: up, down, left, right.
 *
 * The compass is allocentric — "north" has to be mapped onto the layout before
 * the relation is usable — and up/down/left/right is egocentric, so it lands on
 * the picture directly. One mapping step removed, same task underneath.
 *
 * Done as a rewrite of the finished item because `direction.ts` writes the four
 * words as literals in eight places. What that has to get right is the two
 * things a rewrite can get wrong: leaving an object name alone, and not
 * inventing a direction out of a word that merely contains one.
 */

import { assert, equal, test } from "./harness";
import { toScreenFrame } from "../src/app/syllogimous/utils/screen-frame";

test("each cardinal becomes its screen direction", () => {
    equal(toScreenFrame("A is north of B"), "A is up of B");
    equal(toScreenFrame("A is south of B"), "A is down of B");
    equal(toScreenFrame("A is east of B"), "A is right of B");
    equal(toScreenFrame("A is west of B"), "A is left of B");
});

test("casing is kept, because the card capitalises where it starts a line", () => {
    equal(toScreenFrame("North of it"), "Up of it");
    equal(toScreenFrame("2 steps East"), "2 steps Right");
});

test("an object called North is not turned into a direction", () => {
    const html = '<span class="subject">North</span> is east of <span class="subject">West</span>';
    const out = toScreenFrame(html);
    assert(out.indexOf(">North<") >= 0, "an object name was rewritten: " + out);
    assert(out.indexOf(">West<") >= 0, "an object name was rewritten: " + out);
    assert(out.indexOf("is right of") >= 0, "the relation was not rewritten: " + out);
});

test("a word that merely contains a cardinal is left alone", () => {
    equal(toScreenFrame("northern"), "northern");
    equal(toScreenFrame("Westminster"), "Westminster");
    equal(toScreenFrame("easterly"), "easterly");
});

test("nothing else is touched", () => {
    const s = "A is above B and later than C";
    equal(toScreenFrame(s), s);
});
