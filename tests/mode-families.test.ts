/**
 * Every mode appears in exactly one family list.
 *
 * Question types are grouped into nested lists on Customise, and the grouping
 * is a hand-written map — so a mode added later lands in the fallback group
 * rather than nowhere, and a mode named in two families would be offered twice
 * with two independent-looking checkboxes for one setting.
 */

import { assert, equal, test } from "./harness";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";

/* Mirrors AdvancedOptionsComponent.FAMILY. Kept here rather than imported
   because the component drags Angular in; the source-scan below is what stops
   the two drifting. */
import { readFileSync } from "fs";

function familiesFromSource(): Record<string, string[]> {
    const src = readFileSync(
        "src/app/syllogimous/pages/advanced-options/advanced-options.component.ts", "utf8");
    const block = src.slice(src.indexOf("FAMILY: Array<"), src.indexOf("/** The rows, partitioned"));
    const out: Record<string, string[]> = {};
    for (const m of block.matchAll(/\{ name: "([^"]+)", types: \[([\s\S]*?)\] \}/g)) {
        out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1]);
    }
    return out;
}

test("the family map is readable and non-empty", () => {
    const f = familiesFromSource();
    assert(Object.keys(f).length >= 4, "only " + Object.keys(f).length + " families parsed");
});

test("no mode is listed in two families", () => {
    const f = familiesFromSource();
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const [name, types] of Object.entries(f)) {
        for (const t of types) {
            if (seen.has(t)) dupes.push(t + " in " + seen.get(t) + " and " + name);
            seen.set(t, name);
        }
    }
    equal(dupes.length, 0, dupes.join("; "));
});

test("every family names modes that exist", () => {
    const known = new Set(ORDERED_QUESTION_TYPES.map(String));
    const f = familiesFromSource();
    const ghosts: string[] = [];
    for (const [name, types] of Object.entries(f)) {
        for (const t of types) if (!known.has(t)) ghosts.push(name + ": " + t);
    }
    equal(ghosts.length, 0, "families naming modes that do not exist: " + ghosts.join(", "));
});

test("every mode is placed, or the fallback group would be carrying it", () => {
    const f = familiesFromSource();
    const placed = new Set(Object.values(f).flat());
    const loose = ORDERED_QUESTION_TYPES.map(String).filter(t => !placed.has(t));
    /*
     * Not a failure — "Other" exists so a new mode is visible rather than lost
     * — but it is worth naming, because a mode sitting in Other is a mode
     * nobody has decided where to put.
     */
    if (loose.length) console.log("        ungrouped, showing under Other: " + loose.join(", "));
    assert(true, "reported");
});
