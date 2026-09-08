/**
 * Content handed to <app-card> that no slot accepts.
 *
 * The card offers two slots, [body] and [footer]. Angular silently drops
 * anything that matches neither — no error, no warning, no element. A panel
 * written correctly, bound correctly and styled correctly simply never
 * appears, and every clue points at the click handler instead of at the
 * markup. That is what happened to the share panel, so it is checked here for
 * every page rather than for that one.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { assert, test } from "./harness";

const VOID = new Set(["br", "hr", "img", "input", "meta", "link", "source"]);
const CARD = "src/app/syllogimous/components/card/card.component.html";

function templates(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...templates(p));
        else if (e.name.endsWith(".html")) out.push(p);
    }
    return out;
}

/** The slots the card actually declares, read from the card itself. */
function slots(): string[] {
    const html = readFileSync(CARD, "utf8");
    return [...html.matchAll(/<ng-content\s+select="\[(\w+)\]"/g)].map(m => m[1]);
}

/** Top-level children of every <app-card> in one template. */
function projected(html: string) {
    const found: { tag: string; attrs: string }[] = [];
    const s = html.replace(/<!--[\s\S]*?-->/g, "");
    for (const open of s.matchAll(/<app-card\b[^>]*>/g)) {
        let depth = 0;
        const rest = s.slice(open.index! + open[0].length);
        for (const t of rest.matchAll(/<(\/?)([a-zA-Z][-\w]*)\b([^>]*?)(\/?)>/g)) {
            const [, close, tag, attrs, selfClose] = t;
            if (tag === "app-card" && close) break;
            if (close) { depth--; continue; }
            if (depth === 0) found.push({ tag, attrs });
            if (!selfClose && !VOID.has(tag)) depth++;
        }
    }
    return found;
}

test("the card declares the slots this check knows about", () => {
    const declared = slots();
    assert(declared.length === 2 && declared.includes("body") && declared.includes("footer"),
        `the card's slots changed to [${declared}] — this check needs updating too`);
    assert(!/<ng-content\s*>/.test(readFileSync(CARD, "utf8")),
        "the card grew a catch-all slot, which would make this check moot");
});

test("nothing handed to a card is dropped on the floor", () => {
    const accepted = slots();
    const pages = templates("src/app").filter(
        f => f.replace(/\\/g, "/") !== CARD && readFileSync(f, "utf8").includes("<app-card"));
    assert(pages.length > 5, "no pages using the card were found — the walk is broken");

    for (const file of pages) {
        for (const { tag, attrs } of projected(readFileSync(file, "utf8"))) {
            /*
             * A named template is addressed by its reference, not projected,
             * so it is not content the card has to accept.
             */
            if (tag === "ng-template" && /#\w/.test(attrs)) continue;
            const slot = accepted.find(
                s => new RegExp(`(^|\\s)${s}(\\s|=|$)`).test(attrs));
            assert(!!slot, `${file}: <${tag}> is inside the card but carries no `
                + `[${accepted.join("] or [")}] — it will never render`);
        }
    }
});
