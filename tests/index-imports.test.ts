/**
 * Every test file runs, and each of them once.
 *
 * `tests/index.ts` is the whole registry — a file missing from it never runs, and
 * says nothing about being missing. That is written down in the project's notes
 * and was not checked anywhere, so a new test file could be written, pass locally
 * under a filter, and be dead in the suite forever.
 *
 * The duplicate half is the one that actually bit. Nine files had been imported
 * twice by insertions anchored on each other, which is invisible serially — the
 * module cache loads a file once however often it is named. It became visible
 * only when the suite was split across processes, where the two copies landed in
 * different shards and forty-seven cases ran twice. A count that is wrong in the
 * direction of *more* passing is the worst kind.
 */

import { readdirSync, readFileSync } from "fs";
import { assert, equal, test } from "./harness";

const imported = () =>
    [...readFileSync("tests/index.ts", "utf8")
        .matchAll(/^import\s+"\.\/([\w.-]+)";$/gm)].map(m => m[1]);

test("every test file on disk is imported by the index", () => {
    const onDisk = readdirSync("tests")
        .filter(f => f.endsWith(".test.ts"))
        .map(f => f.slice(0, -3))
        .sort();
    const listed = [...new Set(imported())].sort();

    equal(onDisk.filter(f => !listed.includes(f)), [],
        "a test file exists and the index does not import it, so it never runs");
    equal(listed.filter(f => !onDisk.includes(f)), [],
        "the index imports a test file that is not there");
});

test("no test file is imported twice", () => {
    const listed = imported();
    const twice = [...new Set(listed.filter((f, i) => listed.indexOf(f) !== i))];
    equal(twice, [],
        "these are imported more than once — harmless in one process, and in "
        + "several it runs their cases once per copy and reports more passes than "
        + "there are tests");
});

test("the index runs the suite after importing it", () => {
    const index = readFileSync("tests/index.ts", "utf8");
    assert(/^run\(\);$/m.test(index),
        "the index imports every test and never calls run(), so nothing executes");
    const at = index.lastIndexOf("run();");
    const lastImport = index.lastIndexOf('import "./');
    assert(lastImport < at,
        "a test file is imported after run() is called, so its cases register too "
        + "late to be run");
});
