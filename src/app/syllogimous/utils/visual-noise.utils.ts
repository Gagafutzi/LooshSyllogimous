/**
 * Visual-noise stimuli — ported from Syllogimous v3 (`js/generators/visual-noise.js`).
 *
 * Generates abstract SVGs by recursively splitting a rectangle and colouring the
 * pieces. They resist naming and subvocalisation, so premises have to be held as
 * visual patterns rather than rehearsed as words — a different memory load than
 * letters or nouns.
 *
 * Generation is seeded, so the same seed always yields the same image. That
 * matters for the history view: a stored question has to re-render identically.
 */

import { rasterise } from "./raster.utils";

/** Lehmer / Park-Miller LCG — matches v3 so seeds stay compatible. */
function seededRandom(seed: number) {
    const m = 2 ** 31 - 1;
    const a = 48271;
    let state = seed % m;
    return () => {
        state = (a * state) % m;
        return state / m;
    };
}

/** Keeps every region distinguishable against both light and dark backdrops. */
const LIGHTNESS_MIN = 18;
const LIGHTNESS_MAX = 82;

interface Rect { x: number; y: number; width: number; height: number; }

class VisualNoise {
    private random: () => number = Math.random;

    private nextColor() {
        const hue = Math.floor(this.random() * 360);
        const saturation = Math.floor(20 + this.random() * 81);
        // v3 used 10 + rand*91, which reaches 100% — pure white, invisible on a
        // light theme, and near-invisible regions make a stimulus unusable as an
        // identifier. Held to a band that stays legible on any backdrop.
        const lightness = Math.floor(LIGHTNESS_MIN + this.random() * (LIGHTNESS_MAX - LIGHTNESS_MIN + 1));
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    /** Biases splitting toward larger rectangles, keeping pieces legible. */
    private weightedRandomIndex(array: Rect[]) {
        const totalWeight = array.reduce((acc, _, i) => acc + Math.pow(i + 1, 2), 0);
        const randomWeight = this.random() * totalWeight;
        let cumulative = 0;
        for (let i = 0; i < array.length; i++) {
            cumulative += Math.pow(i + 1, 2);
            if (randomWeight < cumulative) return i;
        }
        return array.length - 1;
    }

    private build(id: number, splits: number, minSplit: number, maxSplit: number) {
        const width = 100, height = 50;
        let rectangles: Rect[] = [{ x: 0, y: 0, width, height }];

        for (let i = 0; i < splits; i++) {
            const [rect] = rectangles.splice(this.weightedRandomIndex(rectangles), 1);
            // Split across the longer axis more often, so pieces stay chunky.
            const splitProbability = rect.height / (rect.width + rect.height);
            if (this.random() < splitProbability) {
                const low = rect.height * minSplit;
                const high = rect.height * maxSplit;
                const splitY = rect.y + low + this.random() * (high - low);
                rectangles.push(
                    { x: rect.x, y: rect.y, width: rect.width, height: splitY - rect.y },
                    { x: rect.x, y: splitY, width: rect.width, height: rect.y + rect.height - splitY },
                );
            } else {
                const low = rect.width * minSplit;
                const high = rect.width * maxSplit;
                const splitX = rect.x + low + this.random() * (high - low);
                rectangles.push(
                    { x: rect.x, y: rect.y, width: splitX - rect.x, height: rect.height },
                    { x: splitX, y: rect.y, width: rect.x + rect.width - splitX, height: rect.height },
                );
            }
            rectangles.sort((a, b) => a.width * a.height - b.width * b.height);
        }

        return {
            width, height,
            cells: rectangles.map(r => ({ ...r, fill: this.nextColor() })),
        };
    }

    /**
     * Render to a PNG data URL. `raster.utils` carries the reason why.
     *
     * Falls back to SVG markup when there is nothing to draw with, so the
     * generator stays testable under node. That is the fallback and never what
     * a player sees.
     */
    private toMarkup(id: number, art: ReturnType<VisualNoise["build"]>) {
        const { width, height, cells } = art;

        const url = rasterise(width, height, 1, ctx => {
            for (const r of cells) {
                ctx.fillStyle = r.fill;
                // Round outward so neighbouring cells never leave a seam.
                ctx.fillRect(Math.floor(r.x), Math.floor(r.y),
                    Math.ceil(r.width), Math.ceil(r.height));
            }
        });

        if (!url) {
            const rects = cells.map(r =>
                `<rect x="${Math.round(r.x)}" y="${Math.round(r.y)}"`
                + ` width="${Math.round(r.width)}" height="${Math.round(r.height)}"`
                + ` fill="${r.fill}" />`).join("");
            return `<svg id="vnoise-${id}" class="noise" width="${width}" height="${height}"`
                + ` viewBox="0 0 ${width} ${height}">${rects}</svg>`;
        }

        return `<img class="noise" alt="" width="${DISPLAY_WIDTH}" height="${DISPLAY_HEIGHT}"`
            + ` src="${url}">`;
    }

    generate(seed: number, splits: number): string {
        this.random = seededRandom(seed);
        return this.toMarkup(seed, this.build(seed, splits, 0.25, 0.75));
    }

}

const generator = new VisualNoise();

/** Distinct seeds give visually distinct stimuli; 5 splits => 6 regions. */
export const DEFAULT_SPLITS = 5;

/**
 * Rendered size. Geometry stays in a 100x50 space so the splitter is unchanged;
 * only the displayed box shrinks. At the original 100x50 these dwarfed the
 * surrounding text — a stimulus has to read as a token in a sentence, not a
 * picture between words.
 */
export const DISPLAY_WIDTH = 46;
export const DISPLAY_HEIGHT = 23;

let pool: string[] | undefined;

/**
 * A stable pool of stimuli, built once. `getRandomSymbols` picks from it by
 * index and de-duplicates, so the pool only has to be larger than any single
 * question needs.
 */
/**
 * Drop the cache.
 *
 * For tests, which have to build the pool both with a canvas and without —
 * the cache would otherwise hand the second caller whatever the first one's
 * environment produced.
 */
export function resetVisualNoisePool() { pool = undefined; }

export function getVisualNoiseSymbols(size = 240, splits = DEFAULT_SPLITS) {
    if (!pool || pool.length !== size) {
        pool = Array.from({ length: size }, (_, i) => generator.generate(i + 1, splits));
    }
    return pool;
}
