/**
 * Reading a backup file, apart from the browser.
 *
 * Import lived entirely inside `SystemActionsService`, wrapped in `prompt`,
 * `FileReader`, `alert` and `location.reload` — so the part that decides what a
 * file means could not be tested, and it had four faults that only show up on
 * files nobody generates deliberately:
 *
 *   - `JSON.parse` was uncaught, so a malformed file threw into a click
 *     handler and the player saw nothing happen at all.
 *   - The history branch parsed a second time, also uncaught, and it did so
 *     *midway through writing* — a bad history entry aborted the import with
 *     some keys already replaced.
 *   - Values were cast to string rather than checked, so an object in the file
 *     was written as the literal text `[object Object]`.
 *   - Any key at all was written, including keys this app does not own.
 *
 * None of that is what made import feel broken, though. See `applyImport`.
 */

import { LS_HISTORY, LS_HISTORY_CHUNK, LS_PREFIXES } from "../constants/local-storage.constants";
import { HISTORY_CHUNK } from "./history-store.utils";

/** History is capped on read elsewhere; cap on write so an import cannot blow the quota. */
const HISTORY_CAP = 1000;

/**
 * How many items a history key may carry in.
 *
 * The history moved into chunks, and a chunk key is a list of questions exactly
 * as the old single key was — so it wants the same protection, at the chunk's
 * own size. Without this a file could name twenty chunk keys of any length each
 * and the cap would be the one thing the import did not apply.
 */
function historyCapFor(key: string): number | null {
    if (key === LS_HISTORY) return HISTORY_CAP;
    if (key.startsWith(LS_HISTORY_CHUNK)) return HISTORY_CHUNK;
    return null;
}

export interface ImportPlan {
    /** Keys to write, validated and ready. */
    entries: Array<[string, string]>;
    /** Keys the file carried that this app does not own. */
    foreign: string[];
    /** Keys whose value was not a string, or could not be read. */
    malformed: string[];
}

export type ImportResult = ImportPlan | { error: string };

export function isImportError(r: ImportResult): r is { error: string } {
    return "error" in r;
}

const owned = (key: string) => LS_PREFIXES.some(p => key.startsWith(p));

/**
 * What a backup file would do, without doing any of it.
 *
 * Every failure is reported rather than thrown, because the caller is a click
 * handler: an exception there is indistinguishable from the button not working.
 */
export function planImport(text: string): ImportResult {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return { error: "That file is not valid JSON." };
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "That file is not a Syllogimous backup." };
    }

    const entries: Array<[string, string]> = [];
    const foreign: string[] = [];
    const malformed: string[] = [];

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (!owned(key)) { foreign.push(key); continue; }
        if (typeof value !== "string") { malformed.push(key); continue; }

        const cap = historyCapFor(key);
        if (cap !== null) {
            /*
             * Capped here rather than at write time, so a history that will not
             * parse costs the history and not the whole import. Every other key
             * is opaque to this layer and is passed through as written.
             */
            try {
                const parsed = JSON.parse(value);
                if (!Array.isArray(parsed)) { malformed.push(key); continue; }
                entries.push([key, JSON.stringify(parsed.slice(0, cap))]);
            } catch {
                malformed.push(key);
            }
            continue;
        }

        entries.push([key, value]);
    }

    if (!entries.length) {
        return { error: "That file holds no Syllogimous data." };
    }

    return { entries, foreign, malformed };
}

/** What to tell the player afterwards. Empty when everything was taken. */
export function describeImport(plan: ImportPlan): string {
    const notes: string[] = [];
    if (plan.malformed.length) {
        notes.push(`${plan.malformed.length} entr${plan.malformed.length === 1 ? "y" : "ies"} could not be read and were skipped`);
    }
    if (plan.foreign.length) {
        notes.push(`${plan.foreign.length} unrelated key${plan.foreign.length === 1 ? "" : "s"} ignored`);
    }
    return notes.join("; ");
}
