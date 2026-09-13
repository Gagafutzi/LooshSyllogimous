/**
 * The chunked history: what it stores, and how much it writes to store it.
 *
 * The second half is the point. A test that only checks the items come back
 * would pass against the single key this replaced — the fault was never that
 * the history was wrong, it was that every answer rewrote three and a half
 * megabytes of it. So the bytes written per answer are asserted directly, and
 * asserted to be flat as the history grows.
 */

import { assert, equal, test } from "./harness";
import { HistoryStore, HISTORY_CHUNK } from "../src/app/syllogimous/utils/history-store.utils";
import {
    LS_HISTORY, LS_HISTORY_CHUNK, LS_HISTORY_INDEX, allStorageKeys,
} from "../src/app/syllogimous/constants/local-storage.constants";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

/** An item about the size the generators actually produce: a few kilobytes. */
function item(n: number): Question {
    const q = new Question(EnumQuestionType.Distinction);
    q.premises = Array.from({ length: 6 }, (_, i) => `premise ${n}.${i} ${"x".repeat(60)}`);
    q.explanation = Array.from({ length: 8 }, (_, i) => `step ${n}.${i} ${"y".repeat(120)}`);
    q.conclusion = `conclusion ${n}`;
    q.createdAt = n;
    return q;
}

/** Bytes handed to `setItem`, and how many calls, while `fn` runs. */
function writes(fn: () => void): { calls: number; bytes: number } {
    const raw = globalThis.localStorage as any;
    const real = raw.setItem.bind(raw);
    let calls = 0, bytes = 0;
    raw.setItem = (k: string, v: string) => { calls++; bytes += String(v).length; return real(k, v); };
    try { fn(); } finally { raw.setItem = real; }
    return { calls, bytes };
}

const ids = (qs: Question[]) => qs.map(q => q.createdAt);

test("what goes in comes back out, newest first", () => {
    localStorage.clear();
    const store = new HistoryStore(1000);
    for (let n = 1; n <= 7; n++) store.append(item(n));

    equal(ids(new HistoryStore(1000).load()), [7, 6, 5, 4, 3, 2, 1],
        "a fresh store read back a different list than was written");
    localStorage.clear();
});

test("a history spanning many chunks reads back in one order", () => {
    localStorage.clear();
    const store = new HistoryStore(1000);
    const count = HISTORY_CHUNK * 3 + 7;
    for (let n = 1; n <= count; n++) store.append(item(n));

    const back = new HistoryStore(1000).load();
    equal(back.length, count, "lost or duplicated items across chunk boundaries");
    equal(ids(back), Array.from({ length: count }, (_, i) => count - i),
        "the chunks were reassembled out of order");
    localStorage.clear();
});

/**
 * The regression this exists for.
 *
 * Per-answer bytes must not grow with the history. Against the single key they
 * grew linearly: the thousandth answer rewrote a thousand items. Here the write
 * is one chunk, so the last answer of a long history costs what the first did.
 */
test("an answer writes the same amount whether it is the tenth or the thousandth", () => {
    localStorage.clear();
    const store = new HistoryStore(1000);

    for (let n = 1; n <= 10; n++) store.append(item(n));
    const early = writes(() => store.append(item(11)));

    for (let n = 12; n <= 1000; n++) store.append(item(n));
    const late = writes(() => store.append(item(1001)));

    // One chunk of items is the ceiling, whatever is behind it.
    const ceiling = JSON.stringify(Array.from({ length: HISTORY_CHUNK }, (_, i) => item(i))).length;
    assert(late.bytes <= ceiling,
        `the thousandth answer wrote ${late.bytes} bytes, past the ${ceiling}-byte chunk ceiling`);
    assert(late.bytes < early.bytes * 6,
        `an answer costs ${late.bytes} bytes deep into a history against ${early.bytes} early on`);
    localStorage.clear();
});

test("the whole history is never rewritten, however long it gets", () => {
    localStorage.clear();
    const store = new HistoryStore(1000);
    for (let n = 1; n <= 400; n++) store.append(item(n));

    const whole = JSON.stringify(new HistoryStore(1000).load()).length;
    let worst = 0;
    for (let n = 401; n <= 460; n++) {
        worst = Math.max(worst, writes(() => store.append(item(n))).bytes);
    }
    assert(worst * 4 < whole,
        `the worst write was ${worst} bytes against a ${whole}-byte history — close`
        + ` enough to the whole of it that the chunking is not doing anything`);
    localStorage.clear();
});

test("the cap is honoured, to within a chunk", () => {
    localStorage.clear();
    const limit = 200;
    const store = new HistoryStore(limit);
    for (let n = 1; n <= 500; n++) store.append(item(n));

    const back = new HistoryStore(limit).load();
    assert(back.length >= limit,
        `kept ${back.length} items under a ${limit} cap — less than asked for`);
    assert(back.length < limit + HISTORY_CHUNK * 2,
        `kept ${back.length} items under a ${limit} cap — more than a chunk of slack`);
    equal(back[0].createdAt, 500, "the newest answer is not at the front");
    localStorage.clear();
});

test("dropped chunks are removed from storage, not merely unlisted", () => {
    localStorage.clear();
    const store = new HistoryStore(100);
    for (let n = 1; n <= 600; n++) store.append(item(n));

    const listed: number[] = JSON.parse(localStorage.getItem(LS_HISTORY_INDEX)!);
    const present = allStorageKeys().filter(k => k.startsWith(LS_HISTORY_CHUNK));
    equal(present.length, listed.length,
        `${present.length} chunk keys in storage against ${listed.length} in the index`
        + " — an unlisted chunk is quota nobody will ever reclaim");
    localStorage.clear();
});

/*
 * Migration. An existing player has their whole history under one key, and so
 * does anyone importing a backup taken before the change — which is why this
 * runs off the read path rather than once at startup.
 */
test("a pre-chunk history is carried across and the old key released", () => {
    localStorage.clear();
    const old = Array.from({ length: 120 }, (_, i) => item(120 - i));
    localStorage.setItem(LS_HISTORY, JSON.stringify(old));

    const store = new HistoryStore(1000);
    equal(ids(store.load()), ids(old as Question[]),
        "migrating changed the history it was carrying across");
    assert(localStorage.getItem(LS_HISTORY) === null,
        "the old key survived the migration — the history is now stored twice");

    // And it is chunked afterwards, not sitting in one piece under a new name.
    const chunks = allStorageKeys().filter(k => k.startsWith(LS_HISTORY_CHUNK));
    assert(chunks.length >= 3, `migrated 120 items into ${chunks.length} chunks`);

    // Appending after a migration continues the list rather than restarting it.
    store.append(item(999));
    equal(new HistoryStore(1000).load().length, 121,
        "the first answer after a migration did not land on the carried history");
    localStorage.clear();
});

test("a migration replaces chunks rather than merging with them", () => {
    /*
     * The state an import leaves behind: a backup taken before the change is
     * written over an account that has already been chunked, so the old key and
     * the chunks are both present and only the old key is the whole list.
     */
    localStorage.clear();
    const store = new HistoryStore(1000);
    for (let n = 1; n <= 90; n++) store.append(item(n));

    const imported = Array.from({ length: 30 }, (_, i) => item(5000 + 30 - i));
    localStorage.setItem(LS_HISTORY, JSON.stringify(imported));

    equal(ids(new HistoryStore(1000).load()), ids(imported as Question[]),
        "the imported history came back mixed with the one it replaced");
    localStorage.clear();
});

test("a history that will not parse is an empty one, not a crash", () => {
    localStorage.clear();
    localStorage.setItem(LS_HISTORY_INDEX, "{not json");
    equal(new HistoryStore(1000).load().length, 0, "unreadable storage was not survived");

    localStorage.setItem(LS_HISTORY, "{not json");
    equal(new HistoryStore(1000).load().length, 0, "an unreadable old key was not survived");

    // And a store that found nothing can still be written to.
    localStorage.clear();
    const store = new HistoryStore(1000);
    store.load();
    store.append(item(1));
    equal(ids(new HistoryStore(1000).load()), [1], "could not record after an empty read");
    localStorage.clear();
});

test("reset makes the next read go and look again", () => {
    localStorage.clear();
    const store = new HistoryStore(1000);
    store.append(item(1));

    // What clearing a save does, underneath the store.
    for (const key of allStorageKeys()) localStorage.removeItem(key);
    store.reset();
    store.append(item(2));

    equal(ids(new HistoryStore(1000).load()), [2],
        "a store that was reset put the cleared history back");
    localStorage.clear();
});
