/**
 * The answered history, stored in pieces rather than as one value.
 *
 * A thousand answered items is about three and a half megabytes of JSON — the
 * items carry their premises, their conclusion and their worked explanation,
 * and a 3D space item alone runs to six kilobytes. Storing that under one key
 * means every answer rewrites the whole of it: `JSON.stringify` over 3.5 MB is
 * 14ms in node and a `localStorage.setItem` of 3.5 MB is a synchronous write of
 * seven megabytes of UTF-16 through to disk, which on a phone is not measured
 * in single milliseconds. `GameService` already defers that write past the
 * verdict, which stops it landing on the keypress but does not make it smaller.
 *
 * The cost of one answer should not depend on how many came before it, and here
 * it did — linearly, which is exactly the complaint that the game gets slower
 * the more of it you have played.
 *
 * So the list is cut into chunks of fifty. Only the newest chunk is ever
 * rewritten; the ones behind it are sealed and never touched again except to be
 * dropped off the end. One answer writes at most one chunk — two hundred
 * kilobytes at the very worst, and typically far less — however much history is
 * behind it.
 *
 * **A sealed item is frozen.** Anything that edits an answered question more
 * than fifty answers after the fact will not be persisted. Nothing does: the
 * one late edit in the app is `takeSeriesAnswer` writing an explanation onto
 * the item on screen, which is always inside the open chunk.
 */

import { Question } from "../models/question.models";
import {
    LS_HISTORY, LS_HISTORY_CHUNK, LS_HISTORY_INDEX,
} from "../constants/local-storage.constants";

/** Items per chunk. Fifty items is the worst-case write, around 200 kB. */
export const HISTORY_CHUNK = 50;

const chunkKey = (seq: number) => LS_HISTORY_CHUNK + seq;

function readJson(key: string): unknown {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function writeJson(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /*
         * Out of quota, most likely. The history is the first thing worth
         * dropping — the session carries on with what is in memory rather than
         * failing an answer over storage.
         */
    }
}

/**
 * The chunked history, owned by whoever holds the instance.
 *
 * Deliberately not a service: it has no dependencies, it is constructed once by
 * `GameService`, and every test of it is a plain object against the harness's
 * storage shim.
 */
export class HistoryStore {
    /** Chunk sequence numbers, newest first. Empty until `load`. */
    private seqs: number[] = [];
    /** The newest chunk's items, newest first. The only chunk still writable. */
    private open: Question[] = [];
    /** Items in the sealed chunks behind `open`. */
    private sealed = 0;
    private loaded = false;

    constructor(private limit: number) {}

    /**
     * Everything stored, newest first.
     *
     * Reads every chunk, which is the same total work the single key cost and
     * happens once per session — `GameService` caches the result in memory.
     */
    load(): Question[] {
        this.loaded = true;
        this.seqs = [];
        this.open = [];
        this.sealed = 0;

        const legacy = this.migrateLegacy();
        if (legacy) return legacy;

        const index = readJson(LS_HISTORY_INDEX);
        if (!Array.isArray(index)) return [];
        this.seqs = index.filter((n: unknown): n is number => typeof n === "number");

        const out: Question[] = [];
        for (const seq of this.seqs) {
            const chunk = readJson(chunkKey(seq));
            if (Array.isArray(chunk)) out.push(...chunk);
        }
        const first = this.seqs.length ? readJson(chunkKey(this.seqs[0])) : null;
        this.open = Array.isArray(first) ? first : [];
        this.sealed = out.length - this.open.length;
        return out;
    }

    /**
     * Record one answered item.
     *
     * Writes the open chunk and, when that chunk is full or the oldest has
     * fallen off the end, the index. Never more than one chunk of items.
     */
    append(question: Question): void {
        if (!this.loaded) this.load();

        let indexChanged = false;

        // A full chunk is sealed as it stands and a new one opened in front of
        // it, so what was just written is never rewritten again.
        if (!this.seqs.length || this.open.length >= HISTORY_CHUNK) {
            this.sealed += this.open.length;
            this.seqs.unshift((this.seqs[0] ?? -1) + 1);
            this.open = [];
            indexChanged = true;
        }

        this.open.unshift(question);

        // Drop whole chunks off the back once the cap is passed. Dropping items
        // one at a time would mean rewriting the oldest chunk on every answer,
        // which is the cost this exists to avoid — so the cap is honoured to
        // within a chunk rather than exactly, and `load` is not capped at all.
        while (this.sealed + this.open.length - HISTORY_CHUNK >= this.limit) {
            const dropped = this.seqs.pop();
            if (dropped === undefined) break;
            const chunk = readJson(chunkKey(dropped));
            this.sealed -= Array.isArray(chunk) ? chunk.length : 0;
            try { localStorage.removeItem(chunkKey(dropped)); } catch { /* private mode */ }
            indexChanged = true;
        }

        writeJson(chunkKey(this.seqs[0]), this.open);
        if (indexChanged) writeJson(LS_HISTORY_INDEX, this.seqs);
    }

    /** Forget what is in storage, so the next read goes and looks again. */
    reset(): void {
        this.loaded = false;
        this.seqs = [];
        this.open = [];
        this.sealed = 0;
    }

    /**
     * Carry a pre-chunk history across, if there is one.
     *
     * Returns the items when it ran, `null` when there was nothing to carry.
     * The old key is removed afterwards so this cannot run twice — and so an
     * account that has been migrated is not carrying two copies of its history
     * in a storage quota measured in single-digit megabytes.
     */
    private migrateLegacy(): Question[] | null {
        const raw = readJson(LS_HISTORY);
        if (!Array.isArray(raw)) return null;

        const items: Question[] = raw.slice(0, this.limit);

        // Any chunks already here belong to a history this one supersedes:
        // the legacy key is only present on an account that has not been
        // migrated, or one that has just imported a backup taken before the
        // change, and in both cases it is the complete list.
        const stale = readJson(LS_HISTORY_INDEX);
        if (Array.isArray(stale)) {
            for (const seq of stale) {
                try { localStorage.removeItem(chunkKey(seq as number)); } catch { /* private mode */ }
            }
        }

        this.seqs = [];
        for (let i = 0; i < items.length; i += HISTORY_CHUNK) {
            // Numbered so the newest is highest, matching what `append` does.
            const seq = Math.ceil(items.length / HISTORY_CHUNK) - 1 - Math.floor(i / HISTORY_CHUNK);
            this.seqs.push(seq);
            writeJson(chunkKey(seq), items.slice(i, i + HISTORY_CHUNK));
        }
        this.open = items.slice(0, HISTORY_CHUNK);
        this.sealed = items.length - this.open.length;

        writeJson(LS_HISTORY_INDEX, this.seqs);
        try { localStorage.removeItem(LS_HISTORY); } catch { /* private mode */ }

        return items;
    }
}
