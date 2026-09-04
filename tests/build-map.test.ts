/**
 * The tests build items the same way the app does.
 *
 * There are two maps from mode to generator: `getCreateFn` in `GameService`,
 * which is what plays, and `BUILD` in `tests/modes.ts`, which is what every
 * generator test runs. Nothing compared them.
 *
 * That cost a whole change. Direction was routed through the composed-space
 * engine, the suite passed 620 green, and none of those 620 had run it — the
 * test map still pointed at the generator the app had stopped using. The
 * checks that would have caught the four faults in that change were all
 * pointed at the old code.
 *
 * Compared by name out of the source of both, because the values are closures
 * and a closure cannot be compared to another one. A textual check is enough
 * for the thing that actually goes wrong here, which is one map being edited
 * and the other not.
 */

import { assert, equal, test } from "./harness";
import { readFileSync } from "fs";
import { ORDERED_QUESTION_TYPES } from "../src/app/syllogimous/constants/game.constants";

/** `[EnumQuestionType.X]: ... createY(...)` → { X: "createY" } */
function generatorsIn(file: string, from: string, to: string): Record<string, string> {
    const src = readFileSync(file, "utf8");
    const start = src.indexOf(from);
    assert(start >= 0, `${file}: could not find ${from}`);
    const end = to ? src.indexOf(to, start) : src.length;
    const block = src.slice(start, end > start ? end : src.length);

    const out: Record<string, string> = {};
    for (const m of block.matchAll(
        /\[EnumQuestionType\.([A-Za-z0-9_]+)\]\s*:\s*(?:\([^)]*\)\s*=>\s*)?([A-Za-z0-9_]+)/g)) {
        out[m[1]] = m[2];
    }
    return out;
}

const app = () => generatorsIn(
    "src/app/syllogimous/services/game.service.ts", "const creator = {", "\n        } as", );
const tests = () => generatorsIn("tests/modes.ts", "BUILD", "");

test("both maps are readable and cover the modes", () => {
    const a = app(), t = tests();
    assert(Object.keys(a).length > 20, `only ${Object.keys(a).length} modes parsed from the app`);
    assert(Object.keys(t).length > 20, `only ${Object.keys(t).length} modes parsed from the tests`);
});

test("every mode is built by the same generator in the app and in the tests", () => {
    const a = app(), t = tests();
    const faults: string[] = [];
    for (const key of Object.keys(a)) {
        if (!(key in t)) { faults.push(`${key}: the tests do not build it at all`); continue; }
        if (a[key] !== t[key]) {
            faults.push(`${key}: the app uses ${a[key]}, the tests use ${t[key]}`);
        }
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("the tests do not build a mode the app cannot serve", () => {
    const a = app(), t = tests();
    const extra = Object.keys(t).filter(k => !(k in a));
    equal(extra.length, 0, `built only in tests: ${extra.join(", ")}`);
});

test("every mode the app offers is in both maps", () => {
    const a = app();
    const byName = new Set(Object.keys(a));
    /* The enum key, not its string value — that is what both maps are written
       in. Any mode missing from `creator` would throw when it came up. */
    const missing = ORDERED_QUESTION_TYPES.filter(t => {
        const key = Object.keys(EnumLookup).find(k => EnumLookup[k] === String(t));
        return key ? !byName.has(key) : false;
    });
    equal(missing.length, 0, `not built by the app: ${missing.join(", ")}`);
});

/* The enum, as a plain object, so the check above can go from value to key. */
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
const EnumLookup: Record<string, string> =
    Object.fromEntries(Object.entries(EnumQuestionType));
