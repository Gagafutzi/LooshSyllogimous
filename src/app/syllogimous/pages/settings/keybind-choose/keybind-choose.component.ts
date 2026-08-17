import { Component } from "@angular/core";
import { ACTION_LABELS, GameAction, KeybindService, keyLabel } from "../../../services/keybind.service";

/**
 * Rebinding, by pressing the key rather than naming it.
 *
 * A dropdown of key names is the other way to build this, and it is worse for
 * the same reason a dropdown of colours is worse than a swatch: the player
 * knows the key by where their finger goes, not by what it is called. Click the
 * row, press the key, done.
 */
@Component({
    selector: "app-keybind-choose",
    templateUrl: "./keybind-choose.component.html",
    styleUrls: ["./keybind-choose.component.css"],
})
export class KeybindChooseComponent {
    rows = ACTION_LABELS;
    label = keyLabel;

    /** The row currently listening, if any. */
    capturing: GameAction | null = null;

    constructor(public keys: KeybindService) { }

    listen(action: GameAction) {
        this.capturing = this.capturing === action ? null : action;
    }

    /**
     * Bound on the row's own button, not the document.
     *
     * A document listener would also catch the key that *opened* the capture if
     * that was Enter or Space, binding the action to the key you pressed to
     * start binding it.
     */
    capture(event: KeyboardEvent) {
        if (!this.capturing) return;
        event.preventDefault();
        event.stopPropagation();

        if (event.key === "Escape") { this.capturing = null; return; }
        if (event.key === "Tab") return;   // leave a way out for the keyboard

        this.keys.set(this.capturing, event.key);
        this.capturing = null;
    }

    reset() { this.keys.reset(); }
}
