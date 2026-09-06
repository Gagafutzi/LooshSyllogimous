/**
 * The bar starts where the item starts, not where the last one stopped.
 *
 * Reported six times. Each earlier attempt fixed a different real thing — a
 * transition on a hidden element, `width` instead of `transform`, a hidden tab
 * whose deadline had passed, a deadline of a thousand seconds — and none of
 * them was this.
 *
 * The sweep placed `scaleX(from)` with `transition: none`, flushed with
 * `void el.offsetWidth`, then set the transition and `scaleX(0)`. Reading
 * `offsetWidth` forces **layout**, and `transform` is a compositor property
 * that does not affect layout — so the browser had no reason to commit the
 * intermediate value. The two writes coalesced and the transition ran from the
 * *current computed* transform: wherever the previous item's sweep had stopped.
 *
 * On the first item of a session there is no previous transform, so it starts
 * full and looks right. Every item after it starts where the last one ended,
 * and after enough of them it sits at zero. That is why the drawing looked
 * correct on inspection — the code says `scaleX(from)` and means it, and the
 * browser is entitled to skip it.
 *
 * Read from the source: driving it needs a component, a router and a real
 * compositor, and what went wrong is a flush that cannot work for this
 * property.
 */

import { assert, test } from "./harness";
import { readFileSync } from "fs";

const src = () => readFileSync(
    "src/app/syllogimous/pages/game/game.component.ts", "utf8");

const armBody = () => {
    const s = src();
    const start = s.indexOf("private armTimerBar()");
    assert(start > 0, "armTimerBar was not found, so this test proves nothing");
    // Comments stripped: this file's own prose names `offsetWidth` while
    // explaining why it cannot work here, and the scan would find its own note.
    return s.slice(start, s.indexOf("\n    private barAnim", start))
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
};

test("the sweep states where it starts instead of relying on a flush", () => {
    const body = armBody();
    assert(/\.animate\(/.test(body),
        "the sweep is a transition again, which starts from whatever the previous"
        + " item left behind unless an intermediate style is committed");
    assert(!/offsetWidth/.test(body),
        "`void el.offsetWidth` forces layout, and transform does not affect layout —"
        + " it cannot commit the starting value for this property");
});

test("a new sweep cancels the one before it", () => {
    const body = armBody();
    assert(/barAnim\?\.cancel\(\)/.test(body),
        "an animation with fill: forwards goes on asserting its end state, so the"
        + " previous one has to be cancelled before the next is armed");
    assert(/fill: ['\"]forwards['\"]/.test(body),
        "without fill: forwards the bar snaps back to full when the sweep ends");
});

test("the bar is still placed before the frame, in case the frame never comes", () => {
    const body = armBody();
    const place = body.indexOf("el.style.transform");
    const raf = body.indexOf("requestAnimationFrame");
    assert(place > 0 && place < raf,
        "the amount of time left is drawn only inside the frame callback, so an"
        + " item whose frame is dropped shows an empty track");
});

test("freezing stops the sweep rather than measuring where it got to", () => {
    const s = src();
    const body = s.slice(s.indexOf("private freezeTimerBar()"));
    assert(/barAnim\.pause\(\)/.test(body.slice(0, body.indexOf("\n    }"))),
        "an answered item's bar carries on draining, or is pinned by measuring the"
        + " box, which rounds to whatever the layout happened to be");
});

test("the sweep is cancelled when the screen goes away", () => {
    const s = src();
    const body = s.slice(s.indexOf("ngOnDestroy()"));
    assert(/barAnim\?\.cancel\(\)/.test(body.slice(0, body.indexOf("\n    }"))),
        "the animation outlives the component that armed it");
});
