import { Injectable } from "@angular/core";

/**
 * Which key does what on the game screen.
 *
 * The answer buttons swap sides between questions on purpose — it stops the
 * answer becoming a motor habit — which makes the mouse a poor way to play at
 * speed, since you cannot aim before you have read. The keyboard has no such
 * problem: up and down mean the same thing whatever the buttons are doing.
 *
 * Rebindable because the defaults suit a right hand on the arrow cluster and
 * nothing else. Anyone playing left-handed, on a laptop without arrows, or with
 * one hand on a mouse wants something different, and the alternative to letting
 * them choose is that they do not use it.
 */

export type GameAction = "answerTrue" | "answerFalse" | "next" | "prev" | "submit";

export interface Keybinds extends Record<GameAction, string> {}

/**
 * Arrows, because the two questions the screen asks are both directional:
 * is this true (up) or false (down), and show me the next premise (right) or
 * the last one (left).
 */
export const DEFAULT_KEYBINDS: Keybinds = {
    answerTrue: "ArrowUp",
    answerFalse: "ArrowDown",
    next: "ArrowRight",
    prev: "ArrowLeft",
    /*
     * Space, not Enter. Dismissing the explanation is the one key you press
     * without looking — you have just read the thing and want the next
     * question — and space is where the thumb already is. Enter remains bindable
     * for anyone who prefers it, which is the point of this table.
     */
    submit: " ",
};

export const ACTION_LABELS: Array<{ action: GameAction; label: string; hint: string }> = [
    { action: "answerTrue",  label: "Answer true",  hint: "Also submits a built conclusion" },
    { action: "answerFalse", label: "Answer false", hint: "" },
    { action: "next",        label: "Next premise", hint: "Carousel modes" },
    { action: "prev",        label: "Previous premise", hint: "Carousel modes, where going back is allowed" },
    { action: "submit",      label: "Skip explanation", hint: "Dismisses the explanation shown after a wrong answer" },
];

const LS_KEYBINDS = "SYL_KEYBINDS";

/** How a key reads on screen: "↑" beats "ArrowUp" on a settings row. */
export function keyLabel(key: string): string {
    return ({
        ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
        " ": "Space", Enter: "Enter", Escape: "Esc",
    } as Record<string, string>)[key] ?? key.toUpperCase();
}

@Injectable({ providedIn: "root" })
export class KeybindService {
    binds: Keybinds = { ...DEFAULT_KEYBINDS };

    constructor() { this.load(); }

    load() {
        try {
            const raw = localStorage.getItem(LS_KEYBINDS);
            // Merged onto the defaults, so a binding added later is not missing
            // for anyone who saved before it existed.
            if (raw) this.binds = { ...DEFAULT_KEYBINDS, ...JSON.parse(raw) };
        } catch { this.binds = { ...DEFAULT_KEYBINDS }; }
    }

    save() {
        try { localStorage.setItem(LS_KEYBINDS, JSON.stringify(this.binds)); } catch { /* private mode */ }
    }

    /**
     * Bind a key, taking it from whatever held it.
     *
     * Two actions on one key means one of them is unreachable, and the player
     * would have to work out which — so the older binding gives way and is left
     * empty, which is visible on the settings row.
     */
    set(action: GameAction, key: string) {
        for (const other of Object.keys(this.binds) as GameAction[]) {
            if (other !== action && this.binds[other] === key) this.binds[other] = "";
        }
        this.binds[action] = key;
        this.save();
    }

    reset() {
        this.binds = { ...DEFAULT_KEYBINDS };
        this.save();
    }

    /** The action a keypress means, or null. */
    actionFor(event: KeyboardEvent): GameAction | null {
        // A modified key is a browser shortcut, not a game one.
        if (event.metaKey || event.ctrlKey || event.altKey) return null;
        for (const action of Object.keys(this.binds) as GameAction[]) {
            if (this.binds[action] && this.binds[action] === event.key) return action;
        }
        return null;
    }
}
