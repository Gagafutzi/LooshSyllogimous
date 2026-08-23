import { Component, Input } from "@angular/core";
import { LS_PANEL_OPEN } from "../../constants/local-storage.constants";

/**
 * A titled section that folds away, and stays folded.
 *
 * Customise grew a card per concern and now runs past a screen and a half, so
 * finding the one setting you came for means scrolling past nine you did not.
 * Folding is the cheap fix, and the part that makes it worth having is that the
 * state **persists**: a section that springs open again every time the page is
 * entered has not been closed, it has been briefly hidden.
 *
 * Stored as the set of sections that are *closed*, so a section added later
 * arrives open — a new setting nobody knows about should not be hidden by a
 * preference expressed before it existed.
 *
 * The heading is a real `<button>` rather than a clickable div: it is operated
 * by keyboard for free, it announces its state, and it is reachable by tab.
 */
@Component({
    selector: "app-collapsible",
    templateUrl: "./collapsible.component.html",
    styleUrls: ["./collapsible.component.css"],
})
export class CollapsibleComponent {
    /** Shown in the header. */
    @Input() heading = "";
    /** Stable id for remembering the state. Falls back to the heading. */
    @Input() key = "";
    /** Sections that should start folded even on a first visit. */
    @Input() startClosed = false;
    /**
     * A summary shown beside the heading — "12 of 33 on".
     *
     * Most useful while the section is *shut*, which is when the reader can no
     * longer see what is in it. A folded section that says nothing about its
     * own contents has to be opened to be checked, which is most of the value
     * of folding it gone.
     */
    @Input() note = "";

    private static closed: Set<string> | null = null;

    private static load(): Set<string> {
        if (CollapsibleComponent.closed) return CollapsibleComponent.closed;
        try {
            const raw = localStorage.getItem(LS_PANEL_OPEN);
            CollapsibleComponent.closed = new Set<string>(raw ? JSON.parse(raw) : []);
        } catch {
            CollapsibleComponent.closed = new Set<string>();
        }
        return CollapsibleComponent.closed;
    }

    private get id() { return this.key || this.heading; }

    get open(): boolean {
        const closed = CollapsibleComponent.load();
        // `startClosed` only decides the *first* answer; once the reader has
        // touched it, what they chose wins.
        if (this.startClosed && !closed.has(`seen:${this.id}`)) return false;
        return !closed.has(this.id);
    }

    toggle() {
        const closed = CollapsibleComponent.load();
        // Read before marking: `open` consults the `seen` flag, so setting it
        // first makes a section that started folded report itself open and
        // promptly fold itself again.
        const wasOpen = this.open;
        closed.add(`seen:${this.id}`);
        if (wasOpen) closed.add(this.id); else closed.delete(this.id);
        try { localStorage.setItem(LS_PANEL_OPEN, JSON.stringify([...closed])); } catch { /* private mode */ }
    }
}
