import { Injectable } from "@angular/core";
import { allStorageKeys } from "../constants/local-storage.constants";
import { describeImport, isImportError, planImport } from "../utils/save-data.utils";
import { downloadFile } from "src/app/utils/file";

/**
 * Save-data and appearance actions, shared between the card "More" dropdown and
 * the side navigation.
 *
 * These lived inside CardDropdownComponent, which meant the side nav could only
 * offer them by duplicating the logic — including the destructive reset. Holding
 * them here keeps one implementation, so the two entry points cannot drift.
 */
@Injectable({ providedIn: "root" })
export class SystemActionsService {

    getDarkmode(): boolean {
        return JSON.parse(localStorage.getItem("darkmode") || "false");
    }

    /** `initial` re-applies the stored value on boot without flipping it. */
    toggleDarkmode(initial = false) {
        if (!initial) {
            localStorage.setItem("darkmode", JSON.stringify(!this.getDarkmode()));
        }
        const html = document.querySelector("html");
        if (this.getDarkmode()) {
            html?.setAttribute("darkmode", "");
        } else {
            html?.removeAttribute("darkmode");
        }
    }

    private isSafari() {
        return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }

    private createFileInput() {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        /*
         * No `accept`, and this is the phone fix.
         *
         * `.json` narrows the picker to files the OS has typed as JSON, and on
         * Android a backup sitting in Downloads is very often typed
         * `application/octet-stream` or nothing at all — so it is greyed out and
         * cannot be chosen. The file is read as text and validated either way,
         * so restricting the picker bought nothing and cost the one route a
         * phone has.
         */
        fileInput.accept = "";
        /*
         * Off-screen rather than `display: none`, and attached to the document.
         *
         * A detached input can be clicked on desktop and is ignored by several
         * mobile browsers, which is the other half of import doing nothing on a
         * phone: the picker never opened, so nothing was ever selected and the
         * promise below never settled.
         */
        fileInput.style.position = "fixed";
        fileInput.style.left = "-9999px";
        document.body.appendChild(fileInput);
        return fileInput;
    }

    private readFile(): Promise<string | null> {
        return new Promise(resolve => {
            const fileInput = this.createFileInput();
            const done = (value: string | null) => {
                fileInput.remove();
                resolve(value);
            };

            fileInput.onchange = (evt: any) => {
                const file = evt.target.files?.[0];
                if (!file) return done(null);

                const reader = new FileReader();
                reader.onload = e => {
                    const result = e.target?.result;
                    done(typeof result === "string" ? result : null);
                };
                // A file can fail to read — a permission the picker granted and
                // the OS then withdrew is common enough on a phone — and
                // without this the promise never settles and the button simply
                // stops working.
                reader.onerror = () => done(null);
                reader.readAsText(file);
            };

            fileInput.click();
        });
    }

    async import() {
        // Safari blocks the synthetic file-input click, so fall back to a paste.
        let importJson = this.isSafari()
            ? prompt("Paste your JSON here")
            : await this.readFile();

        /*
         * A picker that came back with nothing is offered the paste route.
         *
         * On a phone that is the common case rather than the exceptional one —
         * the file may be somewhere the picker will not reach, or typed in a way
         * it will not offer — and "Invalid/missing JSON file" with no way
         * forward is where import stopped for anyone it happened to.
         */
        if (!importJson && !this.isSafari()) {
            importJson = prompt("No file was read. Paste the contents of your backup here instead:");
        }

        if (!importJson || typeof importJson !== "string") {
            return alert("Nothing to import.");
        }

        if (!confirm("Importing will overwrite all existing settings. Are you sure?")) {
            return;
        }

        const plan = planImport(importJson);
        if (isImportError(plan)) return alert(plan.error);

        /*
         * Replace, rather than merge on top of what is already here.
         *
         * This is what made import look broken, and it is worse the older the
         * file is. Writing only the keys the file carries leaves every key it
         * does *not* — so restoring a backup taken before the ability model
         * existed gave the player their old history and settings sitting on top
         * of the current install's estimates, profiles and theme. A hybrid
         * account, silently, while the prompt said "importing will overwrite
         * all existing settings".
         *
         * Cleared first, then written, and only over keys this app owns.
         */
        /*
         * The history is written on a short delay, so a pending write has to be
         * abandoned before storage is cleared — otherwise it lands between the
         * clear and the reload and puts the old answers back.
         */
        (window as unknown as { syllogimous?: { forgetHistoryCache?: () => void } })
            .syllogimous?.forgetHistoryCache?.();
        for (const key of allStorageKeys()) localStorage.removeItem(key);
        for (const [key, value] of plan.entries) {
            try { localStorage.setItem(key, value); } catch { /* quota */ }
        }

        const notes = describeImport(plan);
        setTimeout(() => {
            alert(notes ? `Import completed — ${notes}.` : "Import completed successfully!");
            window.location.reload();
        }, 400);
    }

    export() {
        const exportJson: Record<string, string> = {};
        // Everything the app owns, read from storage. The named list left the
        // ability model, the profiles and the theme out of every backup.
        for (const lsProp of allStorageKeys()) {
            const propVal = localStorage.getItem(lsProp);
            if (propVal) {
                exportJson[lsProp] = propVal;
            }
        }

        downloadFile(
            new Blob([JSON.stringify(exportJson)], { type: "text/plain" }),
            `syllogimous-export_${new Date().toLocaleDateString("sv")}.json`
        );

        setTimeout(() => alert("Export completed successfully!"), 400);
    }

    /**
     * Wipes all save data and reloads. Callers are responsible for confirming
     * first — the dropdown uses a styled modal, the side nav a native confirm.
     */
    clearAllData() {
        // Likewise: a reset that leaves the ability estimates and the saved
        // profiles behind is not a reset, and it is the state a player is most
        // likely to be trying to escape.
        for (const lsProp of allStorageKeys()) {
            localStorage.removeItem(lsProp);
        }
        location.reload();
    }

    resetGameWithConfirm() {
        if (confirm("This deletes all progress, history and settings. Are you sure?")) {
            this.clearAllData();
        }
    }
}
