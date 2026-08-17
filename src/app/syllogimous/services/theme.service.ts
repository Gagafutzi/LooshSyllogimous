import { Injectable } from "@angular/core";

/**
 * Runtime theming.
 *
 * theme.css reads every visual decision from a custom property, so changing the
 * look is just writing variables onto <html>. That keeps customisation live
 * (no reload, no stylesheet swap) and means a preset is plain data.
 */

export type ThemeKey =
    | "bg" | "bg2" | "panel" | "accent" | "accent2" | "text" | "textDim"
    | "ok" | "bad" | "okInk" | "badInk" | "answerShape" | "answerFill"
    | "radius" | "gap" | "borderWidth" | "panelAlpha" | "blur" | "glow"
    | "font" | "fontSize" | "wallpaper";

export interface ThemeControl {
    key: ThemeKey;
    label: string;
    /** CSS custom property this writes to. */
    cssVar: string;
    kind: "color" | "range" | "text";
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    group: "Palette" | "Form" | "Typography";
    hint?: string;
}

export const THEME_CONTROLS: ThemeControl[] = [
    { key: "bg",        label: "Background",      cssVar: "--th-bg",       kind: "color", group: "Palette" },
    { key: "bg2",       label: "Background alt",  cssVar: "--th-bg-2",     kind: "color", group: "Palette" },
    { key: "panel",     label: "Panel",           cssVar: "--th-panel",    kind: "color", group: "Palette" },
    { key: "accent",    label: "Accent",          cssVar: "--th-accent",   kind: "color", group: "Palette", hint: "Drives borders, glow and highlighted terms" },
    { key: "accent2",   label: "Accent hover",    cssVar: "--th-accent-2", kind: "color", group: "Palette" },
    { key: "text",      label: "Text",            cssVar: "--th-text",     kind: "color", group: "Palette" },
    { key: "textDim",   label: "Text muted",      cssVar: "--th-text-dim", kind: "color", group: "Palette" },
    { key: "ok",        label: "True button",     cssVar: "--th-ok",       kind: "color", group: "Palette" },
    { key: "bad",       label: "False button",    cssVar: "--th-bad",      kind: "color", group: "Palette" },
    { key: "okInk",     label: "True label",      cssVar: "--th-ok-ink",   kind: "color", group: "Palette" },
    { key: "badInk",    label: "False label",     cssVar: "--th-bad-ink",  kind: "color", group: "Palette" },

    { key: "radius",      label: "Corner radius", cssVar: "--th-radius",       kind: "range", min: 0,  max: 32, step: 1,    unit: "px", group: "Form" },
    { key: "gap",         label: "Panel gap",     cssVar: "--th-gap",          kind: "range", min: 0,  max: 40, step: 1,    unit: "px", group: "Form" },
    { key: "borderWidth", label: "Border width",  cssVar: "--th-border-width", kind: "range", min: 0,  max: 4,  step: 1,    unit: "px", group: "Form" },
    { key: "panelAlpha",  label: "Panel opacity", cssVar: "--th-panel-alpha",  kind: "range", min: 0.1, max: 1, step: 0.05, unit: "",   group: "Form", hint: "Lower is more see-through" },
    { key: "blur",        label: "Backdrop blur", cssVar: "--th-blur",         kind: "range", min: 0,  max: 40, step: 1,    unit: "px", group: "Form" },
    { key: "glow",        label: "Accent glow",   cssVar: "--th-glow",         kind: "range", min: 0,  max: 40, step: 1,    unit: "px", group: "Form" },

    { key: "fontSize",  label: "Font size", cssVar: "--th-font-size",  kind: "range", min: 11, max: 24, step: 1, unit: "px", group: "Typography" },
    { key: "font",      label: "Font stack", cssVar: "--th-font",      kind: "text",  group: "Typography" },
    { key: "wallpaper", label: "Backdrop",   cssVar: "--th-wallpaper", kind: "text",  group: "Typography", hint: "Any CSS background-image value" },
    /*
     * The answer buttons' silhouette, as a clip-path value.
     *
     * Carried as theme data rather than a class on <html> so it survives the
     * per-variable editing the appearance page allows — a preset is still just
     * data. The clip applies to an inner face, never to the button, because
     * clipping a button clips where it can be clicked and these are hit under
     * time pressure.
     */
    { key: "answerShape", label: "Answer shape", cssVar: "--th-answer-shape", kind: "text",  group: "Form", hint: "A clip-path value, or none" },
    { key: "answerFill",  label: "Answer fill",   cssVar: "--th-answer-fill",  kind: "range", min: 8, max: 100, step: 2, unit: "%", group: "Form", hint: "Low is an outlined chip, 100 is solid" },
];

export type Theme = Record<ThemeKey, string | number>;

const MOONLIT: Theme = {
    bg: "#05070c", bg2: "#090d16", panel: "#0d1420",
    accent: "#22d3ee", accent2: "#38bdf8",
    text: "#d7e3f4", textDim: "#7d8ca6",
    // Matches what theme.css already declared, so existing themes are unchanged.
    ok: "#4ade80", bad: "#fb7185", okInk: "#4ade80", badInk: "#fb7185",
    answerShape: "none", answerFill: 12,
    radius: 14, gap: 14, borderWidth: 1, panelAlpha: 0.55, blur: 14, glow: 10,
    fontSize: 15,
    font: `"JetBrains Mono", "Fira Code", ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
    wallpaper:
        "radial-gradient(1200px 700px at 70% -10%, #0e2c3f 0%, transparent 60%), " +
        "radial-gradient(900px 600px at 10% 110%, #0a1e30 0%, transparent 55%)",
};

/** Presets are plain data — each is just a partial override of the default. */
export const THEME_PRESETS: Record<string, Theme> = {
    "Moonlit (default)": MOONLIT,
    "Gruvbox": {
        ...MOONLIT,
        bg: "#1d2021", bg2: "#282828", panel: "#32302f",
        accent: "#fabd2f", accent2: "#fe8019",
        text: "#ebdbb2", textDim: "#a89984",
        glow: 6, panelAlpha: 0.8,
        wallpaper: "radial-gradient(1000px 600px at 80% 0%, #3c3836 0%, transparent 60%)",
    },
    "Catppuccin Mocha": {
        ...MOONLIT,
        bg: "#11111b", bg2: "#181825", panel: "#1e1e2e",
        accent: "#cba6f7", accent2: "#f5c2e7",
        text: "#cdd6f4", textDim: "#9399b2",
        radius: 18, panelAlpha: 0.7,
        wallpaper: "radial-gradient(1100px 700px at 60% -10%, #302d41 0%, transparent 60%)",
    },
    "Nord": {
        ...MOONLIT,
        bg: "#2e3440", bg2: "#3b4252", panel: "#434c5e",
        accent: "#88c0d0", accent2: "#8fbcbb",
        text: "#eceff4", textDim: "#aeb6c4",
        glow: 5, panelAlpha: 0.75,
        wallpaper: "radial-gradient(1000px 600px at 70% 0%, #4c566a 0%, transparent 65%)",
    },
    "Paper (light)": {
        ...MOONLIT,
        bg: "#f4f1ea", bg2: "#ebe7de", panel: "#ffffff",
        accent: "#1f6feb", accent2: "#0969da",
        text: "#1c1f24", textDim: "#5b6472",
        blur: 0, glow: 0, panelAlpha: 0.95, borderWidth: 1,
        font: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
        wallpaper: "none",
    },
    "Terminal green": {
        ...MOONLIT,
        bg: "#000000", bg2: "#020602", panel: "#04120a",
        accent: "#39ff14", accent2: "#7cff5e",
        text: "#c8ffc0", textDim: "#5f9e57",
        radius: 2, glow: 16, panelAlpha: 0.6,
        wallpaper: "radial-gradient(900px 600px at 50% 0%, #062d16 0%, transparent 70%)",
    },
    /*
     * Crimson on near-black, lit from above like a summoning circle.
     *
     * Red on black is the classic legibility trap — a deep blood red looks the
     * part and then fails the moment it carries a highlighted relation word, so
     * the accent sits at a bright rose rather than a dark crimson and the body
     * text is warmed off-white instead of red. The atmosphere is carried by the
     * backdrop and the glow, which nothing has to be read against.
     */
    "Loosh": {
        ...MOONLIT,
        bg: "#0a0406", bg2: "#140609", panel: "#2b0a14",
        accent: "#ff2d55", accent2: "#ff7a92",
        text: "#f6e7ea", textDim: "#c49aa3",
        // Crimson for yes, near-black for no: red already means "accent"
        // everywhere else here, so a red "false" would read as the emphasis.
        ok: "#ff2d55", bad: "#43101f",
        // Dark ink on the bright heart: white on this crimson is 3.65:1, which
        // passes only because the label is large. 5.48:1 does not need the excuse.
        okInk: "#1a0106", badInk: "#f6e7ea", answerFill: 100,
        // Nearly opaque on purpose. The backdrop is a bright crimson wash, and
        // at the usual translucency it bled through and turned the premise card
        // a washed-out mauve — the panel has to hold its own colour for the
        // text on it to sit on something deliberate.
        radius: 10, glow: 18, panelAlpha: 0.94, blur: 10,
        font: `"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif`,
        wallpaper:
            "radial-gradient(1100px 700px at 72% -12%, #5c1020 0%, transparent 62%), " +
            "radial-gradient(900px 620px at 8% 112%, #2e0714 0%, transparent 58%), " +
            "radial-gradient(600px 600px at 50% 50%, #17040a 0%, transparent 70%)",
    },
};

const LS_THEME = "syllogimous-theme";
/** Resolved CSS declarations, replayed by the boot script in index.html. */
const LS_THEME_VARS = "syllogimous-theme-vars";

@Injectable({ providedIn: "root" })
export class ThemeService {
    theme: Theme = { ...MOONLIT };

    constructor() {
        this.load();
        this.apply();
    }

    /** Hex -> "r, g, b" so alpha compositing can reuse the accent. */
    private rgbOf(hex: string) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
        if (!m) return "34, 211, 238";
        return [1, 2, 3].map(i => parseInt(m[i], 16)).join(", ");
    }

    apply(theme: Theme = this.theme) {
        const root = document.documentElement;
        const vars: Record<string, string> = {};

        for (const c of THEME_CONTROLS) {
            const raw = theme[c.key];
            if (raw === undefined) continue;
            vars[c.cssVar] = c.kind === "range" ? `${raw}${c.unit ?? ""}` : String(raw);
        }
        // Accent is consumed both as a colour and as bare channels for rgba().
        vars["--th-accent-rgb"] = this.rgbOf(String(theme.accent));

        for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);

        /*
         * Stash the resolved declarations for the boot script in index.html.
         *
         * Angular cannot apply a theme until it has booted, so a non-default
         * palette flashes the stylesheet defaults first. Persisting what was
         * computed — rather than duplicating the key-to-property mapping in a
         * script tag — keeps this file the only thing that knows how a theme
         * becomes CSS.
         */
        try { localStorage.setItem(LS_THEME_VARS, JSON.stringify(vars)); } catch { /* private mode */ }
    }

    set(key: ThemeKey, value: string | number) {
        this.theme = { ...this.theme, [key]: value };
        this.apply();
        this.save();
    }

    usePreset(name: string) {
        const preset = THEME_PRESETS[name];
        if (!preset) return;
        this.theme = { ...preset };
        this.apply();
        this.save();
    }

    reset() { this.usePreset("Moonlit (default)"); }

    save() {
        try { localStorage.setItem(LS_THEME, JSON.stringify(this.theme)); } catch { /* private mode */ }
    }

    load() {
        try {
            const raw = localStorage.getItem(LS_THEME);
            // Merge onto the default so themes saved before a new knob existed
            // still pick up a sane value for it.
            if (raw) this.theme = { ...MOONLIT, ...JSON.parse(raw) };
        } catch { this.theme = { ...MOONLIT }; }
    }

    exportJson() { return JSON.stringify(this.theme, null, 2); }

    importJson(text: string) {
        const parsed = JSON.parse(text);
        this.theme = { ...MOONLIT, ...parsed };
        this.apply();
        this.save();
        return this.theme;
    }
}
