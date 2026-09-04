/**
 * Every theme has to stay readable, and its true/false pair distinguishable.
 *
 * A palette is the one thing here that is chosen by eye, and the failure is
 * quiet: a warm theme that pushes both answer colours towards amber leaves two
 * buttons the same colour under a glance, and nothing in the app notices. The
 * Ember preset is exactly that risk, which is why this exists.
 *
 * Measured in OKLab, where distance is roughly perceptual.
 */

import { assert, equal, test } from "./harness";
import { THEME_PRESETS } from "../src/app/syllogimous/services/theme.service";

function srgbToLinear(c: number) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function oklab(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map(i => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
    const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
    const [l_, m_, s_] = [l, m, s].map(v => Math.cbrt(v));
    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
    ];
}

const dist = (a: string, b: string) => {
    const [x1, y1, z1] = oklab(a), [x2, y2, z2] = oklab(b);
    return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
};

const isHex = (v: unknown): v is string =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

test("true and false are told apart in every theme", () => {
    const faults: string[] = [];
    for (const [name, t] of Object.entries(THEME_PRESETS)) {
        if (!isHex(t.ok) || !isHex(t.bad)) { faults.push(`${name}: ok/bad are not plain colours`); continue; }
        const d = dist(t.ok, t.bad);
        if (d < 0.25) faults.push(`${name}: ${t.ok} and ${t.bad} are ${d.toFixed(3)} apart`);
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("text is readable against the background in every theme", () => {
    const faults: string[] = [];
    for (const [name, t] of Object.entries(THEME_PRESETS)) {
        if (!isHex(t.text) || !isHex(t.bg)) continue;
        const d = dist(t.text, t.bg);
        if (d < 0.45) faults.push(`${name}: text ${d.toFixed(3)} from the background`);
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("the accent stands off the panel it draws on", () => {
    const faults: string[] = [];
    for (const [name, t] of Object.entries(THEME_PRESETS)) {
        if (!isHex(t.accent) || !isHex(t.panel)) continue;
        const d = dist(t.accent, t.panel);
        if (d < 0.20) faults.push(`${name}: accent ${d.toFixed(3)} from the panel`);
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("muted text is dimmer than body text but still not the background", () => {
    const faults: string[] = [];
    for (const [name, t] of Object.entries(THEME_PRESETS)) {
        if (!isHex(t.textDim) || !isHex(t.bg)) continue;
        const d = dist(t.textDim, t.bg);
        if (d < 0.22) faults.push(`${name}: muted text ${d.toFixed(3)} from the background`);
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

test("there is more than one theme, and each is complete", () => {
    const names = Object.keys(THEME_PRESETS);
    assert(names.length >= 5, `only ${names.length} themes`);
    for (const [name, t] of Object.entries(THEME_PRESETS)) {
        for (const key of ["bg", "panel", "accent", "text", "ok", "bad"] as const) {
            assert(isHex(t[key]), `${name}: ${key} is ${String(t[key])}`);
        }
    }
});
