import { Injectable } from "@angular/core";
import { LS_HISTORY, LS_PROPS, allStorageKeys } from "../constants/local-storage.constants";
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
        fileInput.accept = ".json";
        fileInput.style.display = "none";
        return fileInput;
    }

    private readFile(): Promise<string | null> {
        return new Promise(resolve => {
            const fileInput = this.createFileInput();
            fileInput.onchange = (evt: any) => {
                const file = evt.target.files[0];
                if (!file) {
                    alert("No JSON file selected");
                    return resolve(null);
                }
                const reader = new FileReader();
                reader.onload = e => {
                    const result = e.target?.result;
                    resolve(typeof result === "string" ? result : null);
                };
                reader.readAsText(file);
            };
            fileInput.click();
        });
    }

    async import() {
        // Safari blocks the synthetic file-input click, so fall back to a paste.
        const importJson = this.isSafari()
            ? prompt("Paste your JSON here")
            : await this.readFile();

        if (!importJson || typeof importJson !== "string") {
            return alert("Invalid/missing JSON file");
        }

        if (!confirm("Importing will overwrite all existing settings. Are you sure?")) {
            return;
        }

        const data = JSON.parse(importJson);
        for (const [key, value] of Object.entries(data)) {
            if (key === LS_HISTORY) {
                // History is capped on read elsewhere; cap on write too so an
                // oversized import cannot blow past the storage quota.
                const parsed = JSON.parse(value as string).slice(0, 1000);
                localStorage.setItem(key, JSON.stringify(parsed));
            } else {
                localStorage.setItem(key, value as string);
            }
        }

        setTimeout(() => {
            alert("Import completed successfully!");
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
