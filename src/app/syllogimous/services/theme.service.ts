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
    | "radius" | "gap" | "borderWidth" | "panelAlpha" | "blur" | "glow" | "dimStrength"
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
    /*
     * How strongly the composed-space modes paint each dimension.
     *
     * A dial rather than a switch, and 0 is the switch: at nought every clause
     * takes the body colour and the feature is off. Between the two it mixes
     * toward the text colour, which is the useful middle — the colours are a
     * grouping cue, and some players want them present but quiet.
     */
    { key: "dimStrength", label: "Dimension colours", cssVar: "--th-dim-strength", kind: "range", min: 0, max: 100, step: 10, unit: "%", group: "Palette", hint: "Spatial modes: how strongly each dimension is coloured. 0 turns it off. Also on Display & timer" },

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
    answerShape: "none", answerFill: 12, dimStrength: 100,
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
     * Devil nobility: crimson, black, and gold.
     *
     * The palette is forced rather than chosen. A deep Gremory crimson —
     * #d81e3f, the colour the aesthetic actually wants — measures 3.9:1 against
     * this panel, and the accent is what *subjects* are painted in, so it would
     * fail the one job it has. The bright crimson stays as the accent, and the
     * nobility register is carried by **gold** in the second slot at 9.3:1,
     * where it drives links, hovers and the card's own sheen.
     *
     * The panel is blacker than it was. At #2b0a14 it read mauve, which is a
     * dusty, faded colour and the opposite of what is wanted; crimson on near-
     * black is the whole idea, and the panel should be the black half.
     *
     * The backdrop is a summoning circle, drawn in gradients rather than
     * shipped as an image: two rings — crimson inner, gold outer — over a
     * conic spoke pattern for the tick marks, and a low crimson wash beneath.
     * It sits behind a 94%-opaque panel, so it is atmosphere at the edges of
     * the screen and never something a premise has to be read against.
     */
    "Loosh": {
        ...MOONLIT,
        bg: "#07030a", bg2: "#12060c", panel: "#1b060e",
        // Crimson leads, gold ennobles. Gold cannot lead: it is what the eye
        // goes to first, and the thing worth looking at is the question.
        accent: "#ff2d55", accent2: "#d4af37",
        text: "#f6e6ea", textDim: "#c09aa6",
        // Crimson for yes, dried blood for no: red already means "accent"
        // everywhere here, so a red "false" would read as the emphasis.
        ok: "#ff2d55", bad: "#3d0a17",
        // Dark ink on the bright heart; the pale one on the dark half.
        okInk: "#1a0106", badInk: "#f6e6ea", answerFill: 100,
        /*
         * A cut gem rather than a pill.
         *
         * Applied to an inner face, never the button, so what can be clicked
         * stays rectangular — these are hit under time pressure.
         */
        answerShape: "polygon(7% 0, 93% 0, 100% 50%, 93% 100%, 7% 100%, 0 50%)",
        // Nearly opaque on purpose: the backdrop is a bright crimson wash, and
        // at the usual translucency it bled through and turned the premise card
        // a washed-out mauve.
        radius: 8, glow: 20, panelAlpha: 0.94, blur: 10,
        font: `"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif`,
        wallpaper:
            // Tick marks around the circle, faint enough to be texture.
            "repeating-conic-gradient(from 0deg at calc(50% + var(--nav-offset, 0px)) 46%, " +
                "rgba(212,175,55,0.13) 0deg 0.5deg, transparent 0.5deg 11.25deg), " +
            // The circle itself: crimson ring, gold ring, crimson outer.
            "radial-gradient(circle at calc(50% + var(--nav-offset, 0px)) 46%, " +
                "transparent 0 31%, rgba(255,45,85,0.34) 31% 31.5%, " +
                "transparent 31.5% 34%, rgba(212,175,55,0.26) 34% 34.4%, " +
                "transparent 34.4% 45%, rgba(255,45,85,0.16) 45% 45.4%, transparent 45.4%), " +
            // The light it is lit by.
            "radial-gradient(900px 640px at calc(50% + var(--nav-offset, 0px)) 46%, #40091c 0%, transparent 62%), " +
            "radial-gradient(1200px 800px at 78% -12%, #2a0712 0%, transparent 58%), " +
            "radial-gradient(700px 700px at 12% 112%, #1a0410 0%, transparent 60%)",
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

    /** Relative luminance, for deciding what a colour has to be read against. */
    private luminance(hex: string) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
        if (!m) return 0;
        const [r, g, b] = [1, 2, 3].map(i => {
            const c = parseInt(m[i], 16) / 255;
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * One colour per dimension of a composed space, chosen for the background.
     *
     * Two sets rather than one, because there is no colour that reads on both
     * a near-black panel and a paper-white one — a single palette would have to
     * be a mid grey-ish compromise that is neither legible nor distinguishable.
     * Same hues either way, so a dimension keeps its identity across themes;
     * only the lightness flips. Every entry clears 4.5:1 against the panel of
     * every shipped preset.
     *
     * Derived rather than authored, like `--th-accent-rgb`: it goes into the
     * same resolved-variables blob, so the boot script in index.html replays it
     * with the rest and there is no flash of the wrong palette.
     */
    private static readonly DIM_DARK = [
        "#f1af8e", "#e4ee77", "#8bee77", "#77eebc",
        "#77c6ee", "#bcb6f6", "#e7a4f4", "#f4a4c5",
    ];

    private static readonly DIM_LIGHT = [
        "#b84b14", "#6a730d", "#207c0e", "#0e7c4e",
        "#1274a5", "#6255ec", "#b417d3", "#d31766",
    ];

    /** Hue in degrees, or null for a colour that has none to speak of. */
    private hueOf(hex: string): number | null {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
        if (!m) return null;
        const [r, g, b] = [1, 2, 3].map(i => parseInt(m[i], 16) / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max - min < 0.04) return null;
        const d = max - min;
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (h * 60 + 360) % 360;
    }

    /**
     * The palette, turned so no dimension wears the theme's accent.
     *
     * Subjects are painted with the accent in every mode, and they are the
     * other thing being scanned for — a dimension in the same hue undoes the
     * separation this palette exists to create. On the default theme that is
     * exactly what happened: cyan accent, cyan east–west.
     *
     * Reordering rather than recolouring keeps every contrast figure intact:
     * anything within 40° of the accent moves to the end, where only a seven-
     * or eight-axis space would reach it. The eight hues sit exactly 45° apart,
     * so an 80°-wide window holds at most two of them — six clear ones always
     * remain, which is as many as any preset space uses.
     *
     * Which dimension gets which hue therefore depends on the theme, and that
     * is the right thing to give up: the association only has to hold while you
     * are looking at one.
     */
    private dimPalette(theme: Theme, light: boolean): string[] {
        const base = light ? ThemeService.DIM_LIGHT : ThemeService.DIM_DARK;
        const accent = this.hueOf(String(theme.accent));
        if (accent == null) return base;

        const apart = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
        const clashes = (color: string) => {
            const h = this.hueOf(color);
            return h != null && apart(h, accent) <= 40;
        };

        return [...base.filter(c => !clashes(c)), ...base.filter(clashes)];
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

        // Measured on the panel, which is what premise text actually sits on;
        // the page background can differ from it by a lot under a wallpaper.
        const light = this.luminance(String(theme.panel)) > 0.4;
        this.dimPalette(theme, light)
            .forEach((color, i) => { vars[`--th-dim-${i + 1}`] = color; });

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
