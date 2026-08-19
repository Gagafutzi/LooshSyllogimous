/**
 * Keybinds: the resolution rules, which are where this can go wrong.
 *
 * The service is plain — no injector needed — so the interesting cases run
 * headlessly: modified keys must not fire, a rebind must not leave two actions
 * on one key, and a saved set must survive a version that adds an action.
 */

import { assert, equal, test } from "./harness";
import {
    DEFAULT_KEYBINDS, KeybindService, keyLabel,
} from "../src/app/syllogimous/services/keybind.service";

const press = (key: string, mods: Partial<KeyboardEvent> = {}) =>
    ({ key, metaKey: false, ctrlKey: false, altKey: false, ...mods }) as KeyboardEvent;

function fresh() {
    localStorage.clear();
    return new KeybindService();
}

test("the arrows do what the arrows should", () => {
    const k = fresh();
    equal(k.actionFor(press("ArrowUp")), "answerTrue");
    equal(k.actionFor(press("ArrowDown")), "answerFalse");
    equal(k.actionFor(press("ArrowRight")), "next");
    equal(k.actionFor(press("ArrowLeft")), "prev");
});

test("a modified key is a browser shortcut, not a game one", () => {
    // Ctrl+ArrowLeft is "jump a word" everywhere else; stealing it would be
    // the kind of thing that makes a page feel broken.
    const k = fresh();
    for (const mod of ["metaKey", "ctrlKey", "altKey"] as const) {
        equal(k.actionFor(press("ArrowLeft", { [mod]: true })), null, `${mod} was ignored`);
    }
});

test("an unbound key means nothing", () => {
    const k = fresh();
    equal(k.actionFor(press("q")), null);
});

test("rebinding takes the key from whoever had it", () => {
    // Two actions on one key means one of them is unreachable, and the player
    // would have to work out which.
    const k = fresh();
    k.set("answerFalse", "ArrowUp");
    equal(k.actionFor(press("ArrowUp")), "answerFalse", "the new binding did not win");
    equal(k.binds.answerTrue, "", "the old holder kept the key as well");
});

test("an unbound action never matches, even against an empty key", () => {
    const k = fresh();
    k.set("answerFalse", "ArrowUp");   // leaves answerTrue unbound
    equal(k.actionFor(press("")), null, "an empty keypress matched an unbound action");
});

test("bindings survive a reload, and gain any action added since", () => {
    const k = fresh();
    k.set("next", "d");
    localStorage.setItem("SYL_KEYBINDS", JSON.stringify({ next: "d" }));

    const carried = new KeybindService();
    equal(carried.binds.next, "d", "the saved binding was lost");
    equal(carried.binds.answerTrue, DEFAULT_KEYBINDS.answerTrue,
        "an action missing from the saved set did not fall back to its default");
});

test("reset puts the arrows back", () => {
    const k = fresh();
    k.set("answerTrue", "w");
    k.reset();
    equal(k.binds, DEFAULT_KEYBINDS);
});

test("keys read as symbols where they have one", () => {
    equal(keyLabel("ArrowUp"), "↑");
    equal(keyLabel(" "), "Space");
    equal(keyLabel("a"), "A");
});

/**
 * Skipping the explanation.
 *
 * The explanation is the one screen you leave without looking — you have just
 * read it and want the next question — so the key for it should be the one the
 * thumb is already on. It was Enter, which is a reach, and nothing on screen
 * said it existed.
 */
test("space skips the explanation by default", () => {
    localStorage.clear();
    const keys = new KeybindService();

    equal(keys.binds.submit, " ", "the default skip key is not space");
    equal(keyLabel(keys.binds.submit), "Space", "space does not read as Space");

    const press = { key: " ", metaKey: false, ctrlKey: false, altKey: false } as KeyboardEvent;
    equal(keys.actionFor(press), "submit", "pressing space does not skip");

    localStorage.clear();
});

test("the skip key can be any key, which is the point of binding it", () => {
    localStorage.clear();
    const keys = new KeybindService();

    keys.set("submit", "Enter");
    const enter = { key: "Enter", metaKey: false, ctrlKey: false, altKey: false } as KeyboardEvent;
    equal(keys.actionFor(enter), "submit", "a rebound skip key does nothing");

    const space = { key: " ", metaKey: false, ctrlKey: false, altKey: false } as KeyboardEvent;
    equal(keys.actionFor(space), null, "the old key still skips after rebinding");

    // And taking a key from another action leaves that one visibly unbound,
    // rather than two actions racing for one press.
    keys.set("submit", "ArrowUp");
    equal(keys.binds.answerTrue, "", "the key was silently shared with answering");

    localStorage.clear();
});

test("a saved binding survives the default changing under it", () => {
    // The defaults are merged, not replaced, so moving the default from Enter to
    // space does not reach anyone who had already chosen.
    localStorage.clear();
    localStorage.setItem("SYL_KEYBINDS", JSON.stringify({ submit: "Enter" }));

    const keys = new KeybindService();
    equal(keys.binds.submit, "Enter", "a chosen binding was overwritten by the new default");
    equal(keys.binds.answerTrue, "ArrowUp", "an unset binding did not fall back to its default");

    localStorage.clear();
});
