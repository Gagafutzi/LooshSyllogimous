/**
 * Backing up an account, and restoring one.
 *
 * The reported symptom was that import "no longer works and isn't backwards
 * compatible". The file format never changed -- an old export is a strict
 * subset of a new one, both being localStorage key to value. What changed is
 * how much of an account there is: import *merged*, so a backup taken before a
 * feature existed restored the old half on top of the current install's new
 * half, silently, while the prompt promised to overwrite everything.
 */

import { assert, equal, test } from "./harness";
import {
    ImportPlan, describeImport, isImportError, planImport,
} from "../src/app/syllogimous/utils/save-data.utils";
import { LS_HISTORY, allStorageKeys } from "../src/app/syllogimous/constants/local-storage.constants";

const plan = (o: unknown) => planImport(JSON.stringify(o)) as ImportPlan;

/** What the service does with a plan, so the round trip can be tested. */
function apply(p: ImportPlan) {
    for (const key of allStorageKeys()) localStorage.removeItem(key);
    for (const [k, v] of p.entries) localStorage.setItem(k, v);
}

test("a backup taken before a feature existed does not leave it behind", () => {
    localStorage.clear();

    // The current install: an account with an ability model and a theme.
    localStorage.setItem("SYL_HISTORY", JSON.stringify([{ id: 1 }]));
    localStorage.setItem("syllogimous-ability:Vertical Order", '{"trials":300}');
    localStorage.setItem("syllogimous-progression-config", '{"targetAccuracy":0.8}');
    localStorage.setItem("SYL_THEME", "midnight");

    // A backup from before any of that existed: history and a score, nothing more.
    const old = {
        SYL_HISTORY: JSON.stringify([{ id: 99 }]),
        SYL_SCORE: "4200",
    };

    const p = plan(old);
    assert(!isImportError(p), "an old backup was rejected outright");
    apply(p);

    equal(localStorage.getItem("SYL_SCORE"), "4200", "the backup's own data did not arrive");
    equal(JSON.parse(localStorage.getItem(LS_HISTORY)!)[0].id, 99, "the old history did not replace the new");

    // The point: nothing of the newer account survives to be mixed in.
    for (const stale of ["syllogimous-ability:Vertical Order", "syllogimous-progression-config", "SYL_THEME"]) {
        equal(localStorage.getItem(stale), null,
            `${stale} survived an import that promised to overwrite everything`);
    }
});

test("a malformed file is reported, not thrown", () => {
    for (const bad of ["", "{", "not json at all", "[1,2,3]", '"a string"', "null"]) {
        const r = planImport(bad);
        assert(isImportError(r), `"${bad.slice(0, 12)}" was accepted as a backup`);
    }
});

/**
 * One unreadable entry must cost that entry, not the import.
 *
 * It used to cost the whole thing *and* leave the account half-written: the
 * history was parsed in the middle of the write loop, so a bad history threw
 * after some keys had already been replaced.
 */
test("one bad entry does not cost the rest", () => {
    const p = plan({
        SYL_HISTORY: "{{{ not json",
        SYL_SCORE: "77",
        "syllogimous-trials": "[]",
    });
    assert(!isImportError(p), "a single bad entry rejected the whole file");
    equal(p.malformed.join(","), LS_HISTORY, "the bad entry was not the one skipped");
    equal(p.entries.length, 2, "the good entries did not survive");
    assert(describeImport(p).includes("could not be read"), "the player is not told anything was skipped");
});

test("a value that is not a string is skipped rather than stringified", () => {
    // `setItem(key, {} as string)` writes the literal text "[object Object]",
    // which is a corrupted account that looks like a successful import.
    const p = plan({ SYL_SCORE: { nested: true }, SYL_TIMER_TYPE: "1" });
    assert(!isImportError(p), "the file was rejected outright");
    equal(p.malformed.join(","), "SYL_SCORE", "an object was accepted as a value");
    equal(p.entries.length, 1, "the good entry was lost with the bad one");
});

test("keys this app does not own are not written", () => {
    const p = plan({ SYL_SCORE: "1", "evil-key": "x", token: "secret" });
    assert(!isImportError(p), "the file was rejected outright");
    equal(p.entries.length, 1, "a foreign key was queued for writing");
    equal(p.foreign.sort().join(","), "evil-key,token", "foreign keys were not reported");
    assert(describeImport(p).includes("ignored"), "the player is not told what was ignored");
});

test("an oversized history is capped", () => {
    const huge = Array.from({ length: 3000 }, (_, i) => ({ id: i }));
    const p = plan({ [LS_HISTORY]: JSON.stringify(huge) });
    assert(!isImportError(p), "a large history was rejected");
    equal(JSON.parse(p.entries[0][1]).length, 1000, "the history was not capped");
});

test("export then import returns the same account", () => {
    localStorage.clear();
    const account: Record<string, string> = {
        SYL_HISTORY: JSON.stringify([{ id: 1 }, { id: 2 }]),
        SYL_SCORE: "1234",
        "syllogimous-ability:Syllogism": '{"trials":12}',
        darkmode: "true",
    };
    for (const [k, v] of Object.entries(account)) localStorage.setItem(k, v);

    // Exactly what SystemActionsService.export writes.
    const exported: Record<string, string> = {};
    for (const key of allStorageKeys()) {
        const v = localStorage.getItem(key);
        if (v) exported[key] = v;
    }

    localStorage.clear();
    localStorage.setItem("SYL_SCORE", "999");   // a different account in the way

    const p = plan(exported);
    assert(!isImportError(p), "our own export did not survive a round trip");
    apply(p);

    for (const [k, v] of Object.entries(account)) {
        equal(localStorage.getItem(k), v, `${k} did not survive the round trip`);
    }
    equal(allStorageKeys().sort().join(","), Object.keys(account).sort().join(","),
        "the restored account holds keys the backup did not");
});
