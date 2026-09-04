/**
 * Folding the settings pages, and remembering that they were folded.
 *
 * Customise grew a card per concern and runs past a screen and a half, so
 * finding the one setting you came for means scrolling past nine you did not.
 * The part worth testing is not the folding — it is that the state persists,
 * since a section that springs open again on every visit has not been closed.
 */

import { assert, equal, test } from "./harness";
import { readFileSync } from "fs";
import { CollapsibleComponent } from "../src/app/syllogimous/components/collapsible/collapsible.component";

/** The static cache is shared, so each case starts from a clean store. */
function fresh(): void {
    localStorage.clear();
    (CollapsibleComponent as unknown as { closed: Set<string> | null }).closed = null;
}

function panel(heading: string, startClosed = false): CollapsibleComponent {
    const c = new CollapsibleComponent();
    c.heading = heading;
    c.startClosed = startClosed;
    return c;
}

test("a section opens by default and remembers being shut", () => {
    fresh();
    const a = panel("Question types");
    assert(a.open, "a section started shut with nothing stored");

    a.toggle();
    assert(!a.open, "toggling did not shut it");

    // A second instance is what a fresh visit to the page produces.
    equal(panel("Question types").open, false, "the fold was forgotten between visits");
    a.toggle();
    equal(panel("Question types").open, true, "re-opening was forgotten");
});

test("sections are remembered apart", () => {
    fresh();
    panel("Profiles").toggle();
    assert(!panel("Profiles").open, "the shut section reopened");
    assert(panel("Question types").open, "shutting one section shut another");
});

/**
 * Stored as the set of *closed* sections, so a section added later arrives
 * open: a setting nobody knows about yet should not be hidden by a preference
 * expressed before it existed.
 */
test("a section added later starts open", () => {
    fresh();
    panel("Profiles").toggle();
    assert(panel("Something New").open, "a section that did not exist yet was already folded");
});

/**
 * `startClosed` decides the first answer only. Once the reader has opened a
 * long section, it stays open — otherwise the preference is unexpressable.
 */
test("a section that starts folded can be opened for good", () => {
    fresh();
    const p = panel("Fluid progression", true);
    assert(!p.open, "startClosed did not fold it");

    p.toggle();
    assert(p.open, "it could not be opened");
    assert(panel("Fluid progression", true).open, "it folded itself again on the next visit");
});

test("a broken store does not take the settings pages down", () => {
    fresh();
    localStorage.setItem("SYL_PANEL_OPEN", "{{{ not json");
    (CollapsibleComponent as unknown as { closed: Set<string> | null }).closed = null;
    assert(panel("Profiles").open, "an unreadable store threw instead of defaulting to open");
});

/** Every section needs a heading, or the fold has nothing to click. */
test("every folded section on the settings pages is labelled", () => {
    for (const file of [
        "src/app/syllogimous/pages/advanced-options/advanced-options.component.html",
        "src/app/syllogimous/pages/settings/settings.component.html",
        "src/app/syllogimous/components/mode-modifiers/mode-modifiers.component.html",
    ]) {
        const html = readFileSync(file, "utf8");
        const opens = [...html.matchAll(/<app-collapsible\b([^>]*)>/g)];
        assert(opens.length > 0, `${file} has no folded sections at all`);
        for (const [, attrs] of opens) {
            /*
             * A bound heading is a heading. The nested mode families take
             * theirs from the family they render, which is a label the reader
             * sees — what this is guarding against is a section with no name at
             * all, not one whose name is computed.
             */
            assert(/\bheading="[^"]+"/.test(attrs) || /\[heading\]="[^"]+"/.test(attrs),
                `${file}: a section with no heading`);
        }
        equal(opens.length, (html.match(/<\/app-collapsible>/g) ?? []).length,
            `${file}: a section is not closed`);
    }
});
