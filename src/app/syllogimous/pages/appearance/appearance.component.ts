import { Component } from "@angular/core";
import { THEME_CONTROLS, THEME_PRESETS, ThemeControl, ThemeKey, ThemeService } from "../../services/theme.service";

@Component({
    selector: "app-appearance",
    templateUrl: "./appearance.component.html",
    styleUrls: ["./appearance.component.css"],
})
export class AppearanceComponent {
    presets = Object.keys(THEME_PRESETS);
    groups: Array<{ name: string; controls: ThemeControl[] }>;
    importError = "";
    importOpen = false;
    importText = "";

    constructor(public themeService: ThemeService) {
        const names = ["Palette", "Form", "Typography"] as const;
        this.groups = names.map(name => ({
            name,
            controls: THEME_CONTROLS.filter(c => c.group === name),
        }));
    }

    get theme() { return this.themeService.theme; }

    onChange(key: ThemeKey, value: string | number) {
        this.themeService.set(key, value);
    }

    // Range inputs hand back strings; the service writes them straight into CSS
    // where "14" and "14px" are not interchangeable, so coerce here.
    onRange(key: ThemeKey, value: string) {
        this.themeService.set(key, Number(value));
    }

    applyPreset(name: string) { this.themeService.usePreset(name); }

    reset() { this.themeService.reset(); }

    copyJson() {
        navigator.clipboard?.writeText(this.themeService.exportJson());
    }

    doImport() {
        try {
            this.themeService.importJson(this.importText);
            this.importError = "";
            this.importOpen = false;
        } catch {
            this.importError = "That is not valid theme JSON.";
        }
    }
}
