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
     * Pink on near-black, and something is watching.
     *
     * One hue, from hot pink down to near-black, with the geometry taken out.
     *
     * What it was: a summoning circle in crimson and gold — concentric rings
     * and conic tick marks, which is the shape a gradient can make and no
     * other. Rings, hexagonal answer faces and 8px corners added up to a look
     * built entirely out of straight edges and circles, and the objection to it
     * was exactly that.
     *
     * So the backdrop is drawn now: tendrils that curve, and an eye. Both are
     * arcs, and an arc is the one thing gradients cannot state. It is still
     * inline rather than an asset — no file to ship and nothing to break if one
     * goes missing, which is why gradients were reached for originally.
     *
     * The panel stays blacker than the palette suggests. At #2b0a14 it read
     * mauve, a dusty faded colour and the opposite of what is wanted; pink on
     * near-black is the whole idea, and the panel is the black half of it.
     */
    "Loosh": {
        ...MOONLIT,
        bg: "#07030a", bg2: "#12060c", panel: "#1b060e",
        /*
         * One family now, pink through to near-black, and no gold.
         *
         * Gold held the second slot because crimson measures 3.9:1 against the
         * panel and the second accent drives links and hovers, which have to be
         * legible. It was doing a contrast job, not an aesthetic one — and a
         * pale pink does the same job at 9.1:1 against gold's 9.3:1 while
         * staying inside the one hue the look is built on. Nothing legible was
         * traded for it; the metal simply was not part of this.
         */
        accent: "#ff2d6f", accent2: "#ff8fab",
        text: "#f6e6ea", textDim: "#c09aa6",
        // Crimson for yes, dried blood for no: red already means "accent"
        // everywhere here, so a red "false" would read as the emphasis.
        ok: "#ff2d6f", bad: "#3d0a17",
        // Dark ink on the bright heart; the pale one on the dark half.
        okInk: "#1a0106", badInk: "#f6e6ea", answerFill: 100,
        /*
         * A lens rather than a cut gem.
         *
         * The hexagon was six straight edges, which is the thing this theme is
         * moving away from. An ellipse wider than its own box curves only at
         * the ends, so the shape reads as an eye and the middle — where the
         * word is — is never clipped. Applied to an inner face and never the
         * button, so what can be clicked stays rectangular; these are hit under
         * time pressure.
         */
        answerShape: "ellipse(62% 50%)",
        // Nearly opaque on purpose: the backdrop is a bright crimson wash, and
        // at the usual translucency it bled through and turned the premise card
        // a washed-out mauve.
        // Corners well rounded, since the objection to the old look was that it
        // was rectangular, and a card is the largest rectangle on the screen.
        radius: 22, glow: 24, panelAlpha: 0.94, blur: 10,
        font: `"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif`,
        wallpaper:
            /*
             * Drawn rather than composed out of gradients.
             *
             * The circle it replaces was rings and conic ticks, which is all a
             * gradient can be: concentric and straight-edged. Tendrils curve, and
             * an eye is two arcs — neither is expressible that way, so the layer
             * is an inline SVG instead. Still no asset to ship and nothing to
             * fail if a file is missing, which is why the gradients were chosen
             * in the first place.
             *
             * No width or height on the root: a background SVG with no intrinsic
             * size is scaled to the area it paints, so it covers the viewport
             * rather than tiling at some arbitrary pixel size.
             *
             * Kept faint on purpose. It sits behind a 94%-opaque panel, so it is
             * weather at the edges of the screen and never something a premise
             * has to be read against.
             */
            "url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' preserveAspectRatio='xMidYMid slice'> <g fill='none' stroke='%23ff2d6f' stroke-linecap='round'> <g opacity='.5'> <path d='M-40 90 C 210 140 330 260 430 430 C 500 550 560 700 540 950' stroke-width='2.5'/> <path d='M-40 90 C 150 120 240 200 300 300' stroke-width='1.2'/> <path d='M300 300 C 330 250 380 210 470 190' stroke-width='1'/> <path d='M430 430 C 350 470 300 540 280 640' stroke-width='1'/> <path d='M1480 60 C 1240 120 1120 250 1050 420 C 990 570 960 720 990 950' stroke-width='2.5'/> <path d='M1050 420 C 1140 470 1200 540 1230 650' stroke-width='1.2'/> <path d='M1480 300 C 1300 330 1200 420 1160 540' stroke-width='1'/> <path d='M-40 700 C 160 690 300 760 380 900' stroke-width='1.4'/> <path d='M1480 820 C 1300 790 1180 830 1090 900' stroke-width='1.2'/> </g> <g opacity='.34'> <path d='M700 -40 C 660 120 700 240 760 330' stroke-width='1.2'/> <path d='M760 940 C 720 800 740 690 800 600' stroke-width='1.2'/> </g> </g> <g transform='translate(720 430)'> <g fill='none' stroke='%23ff2d6f' opacity='.55'> <path d='M-300 0 C -170 -132 170 -132 300 0 C 170 132 -170 132 -300 0 Z' stroke-width='2'/> <path d='M-232 0 C -130 -96 130 -96 232 0 C 130 96 -130 96 -232 0 Z' stroke-width='.8' opacity='.55'/> <circle r='86' stroke-width='1.6'/> <circle r='54' stroke-width='.8' opacity='.6'/> </g> <circle r='30' fill='%23ff2d6f' opacity='.16'/> <g stroke='%23ff2d6f' stroke-width='.8' opacity='.3'> <path d='M0 -86 V -128'/><path d='M0 86 V 128'/> <path d='M-86 0 H -128'/><path d='M86 0 H 128'/> <path d='M-61 -61 L -92 -92'/><path d='M61 -61 L 92 -92'/> <path d='M-61 61 L -92 92'/><path d='M61 61 L 92 92'/> </g> </g> </svg>\"), " +
            // The light it is lit by: a low pink wash, close to black at the edges.
            "radial-gradient(1000px 700px at 50% 44%, #3a0a1e 0%, transparent 64%), " +
            "radial-gradient(1300px 820px at 82% -14%, #2a0714 0%, transparent 58%), " +
            "radial-gradient(800px 800px at 8% 110%, #1c0411 0%, transparent 62%)",
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

    /**
     * Blend two hex colours, keeping `amount` percent of the first.
     *
     * Done here rather than with `color-mix()` in the stylesheet. The CSS was
     * `color-mix(in srgb, var(--th-dim-N) var(--th-dim-strength), var(--th-text))`,
     * which puts a `var()` in the percentage position of a colour function —
     * and if that substitution does not parse, the whole declaration is dropped
     * and the clause silently falls back to the body colour. Which is precisely
     * the symptom: dimension colours stopped appearing when the strength dial
     * was added, having worked before it.
     *
     * Mixing here means the stylesheet only ever sees a plain colour, which is
     * the form that was working, and the dial keeps its full range.
     */
    private mix(from: string, to: string, amount: number): string {
        const parse = (hex: string) => {
            const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
            return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null;
        };
        const a = parse(from), b = parse(to);
        if (!a || !b) return from;

        const k = Math.max(0, Math.min(100, amount)) / 100;
        const channel = (i: number) => Math.round(a[i] * k + b[i] * (1 - k));
        return "#" + [0, 1, 2].map(i => channel(i).toString(16).padStart(2, "0")).join("");
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
        // Blended to strength here, so the stylesheet sees a plain colour.
        const strength = Number(theme.dimStrength ?? 100);
        this.dimPalette(theme, light).forEach((color, i) => {
            vars[`--th-dim-${i + 1}`] = strength >= 100
                ? color
                : this.mix(color, String(theme.text), strength);
        });

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
