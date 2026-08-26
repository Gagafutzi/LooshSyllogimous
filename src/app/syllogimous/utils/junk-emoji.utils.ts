/**
 * Junk emoji stimuli — ported from Syllogimous v3 (`js/generators/junk-emojis.js`).
 *
 * Coloured shapes with no names. v3 built a thousand of them from a large
 * hue/saturation/lightness pool and handed them out in an interleaved order, so
 * consecutive stimuli were far apart in colour space and could not be confused
 * with each other within one item.
 *
 * The point is different from the visual-noise stimuli already here. Those are
 * patterns, and resist naming by being intricate; these are single flat shapes,
 * and resist naming by differing only in *colour and outline* — "the orange
 * pentagon" is the whole of what there is to hold. Neither subvocalises, but
 * they load different things, and having both means a session can vary which.
 *
 * Deterministic from the id, like visual noise, because a stored question has
 * to redraw identically on the history screen.
 */

import { rasterise } from "./raster.utils";

/** Kept clear of both extremes so a shape reads on a light or a dark card. */
const LIGHTNESS = [38, 48, 58, 68];
const SATURATION = [55, 72, 88];

/**
 * Hues at uneven spacing.
 *
 * Even steps put too many neighbours in the greens, where the eye separates
 * poorly; this crowds where discrimination is good and spreads where it is not.
 */
const HUES = [
    0, 12, 24, 36, 45, 54, 62, 72, 84, 96, 110, 126, 142, 158, 172,
    186, 198, 208, 218, 228, 238, 248, 258, 268, 280, 292, 304, 316, 328, 340, 350,
];

/**
 * Six silhouettes, so colour is not the only channel.
 *
 * Described once as geometry and rendered twice, because the two renderers
 * below must not be allowed to drift into drawing different shapes.
 */
type Shape = { kind: "circle" } | { kind: "square" } | { kind: "poly"; points: Array<[number, number]> };

/** A regular n-gon on a 24-box, first point at the top. */
const ngon = (n: number, r = 9.5): Shape => ({
    kind: "poly",
    points: Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        return [12 + r * Math.cos(a), 12 + r * Math.sin(a)] as [number, number];
    }),
});

const SHAPES: Shape[] = [
    { kind: "circle" },
    { kind: "square" },
    ngon(3),
    ngon(4),
    ngon(5),
    ngon(6),
];

export const JUNK_EMOJI_COUNT = HUES.length * SATURATION.length * LIGHTNESS.length * SHAPES.length;

/**
 * One stimulus. Same id, same picture, always.
 *
 * **Drawn to a PNG data URL, not to inline SVG.** Stimuli reach the DOM through
 * an `[innerHTML]` binding, and Angular's sanitiser keeps only the elements on
 * its allowlist — which has no `svg` on it. This mode shipped emitting
 * `<svg class="junk">`, so every junk-shape stimulus was removed on the way to
 * the screen and the player saw an empty subject where a shape should have
 * been. `visual-noise.utils` had already met this and solved it the same way;
 * the note explaining it was in that file and not in this one.
 *
 * Falls back to SVG markup when there is no DOM, so the pool stays testable
 * under node — and `tests/stimuli.test.ts` checks the browser path is the one
 * that ships.
 */
export function junkEmoji(id: number): string {
    const i = ((id % JUNK_EMOJI_COUNT) + JUNK_EMOJI_COUNT) % JUNK_EMOJI_COUNT;

    const shape = SHAPES[i % SHAPES.length];
    const rest = Math.floor(i / SHAPES.length);
    const light = LIGHTNESS[rest % LIGHTNESS.length];
    const sat = SATURATION[Math.floor(rest / LIGHTNESS.length) % SATURATION.length];
    const hue = HUES[Math.floor(rest / (LIGHTNESS.length * SATURATION.length)) % HUES.length];

    const fill = `hsl(${hue} ${sat}% ${light}%)`;

    return pngMarkup(shape, fill, i) ?? svgMarkup(shape, fill, i);
}

/** The node path, for tests. Never what a player sees. */
function svgMarkup(shape: Shape, fill: string, i: number): string {
    const body = shape.kind === "circle"
        ? `<circle cx="12" cy="12" r="9.5" fill="${fill}"/>`
        : shape.kind === "square"
        ? `<rect x="3" y="3" width="18" height="18" fill="${fill}"/>`
        : `<polygon points="${shape.points.map(([x, y]) => `${x},${y}`).join(" ")}" fill="${fill}"/>`;
    return `<svg class="junk" viewBox="0 0 24 24" width="24" height="24" role="img"`
        + ` aria-label="coloured shape ${i}">${body}</svg>`;
}

/** Rendered at 3x and displayed small, so the edges stay clean. */
const SCALE = 3;
export const JUNK_DISPLAY = 18;

function pngMarkup(shape: Shape, fill: string, i: number): string | null {
    const url = rasterise(24, 24, SCALE, ctx => {
        ctx.fillStyle = fill;
        if (shape.kind === "circle") {
            ctx.beginPath();
            ctx.arc(12, 12, 9.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape.kind === "square") {
            ctx.fillRect(3, 3, 18, 18);
        } else {
            ctx.beginPath();
            shape.points.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.fill();
        }
    });
    if (!url) return null;

    return `<img class="junk" alt="coloured shape ${i}"`
        + ` width="${JUNK_DISPLAY}" height="${JUNK_DISPLAY}" src="${url}">`;
}

/**
 * A batch, spread across the pool.
 *
 * Drawn from far-apart slices rather than at random, which is v3's trick and
 * the reason it works: two stimuli in one item should never be a near-miss in
 * both hue and shape, or the item becomes an eye test rather than a memory one.
 */
export function getJunkEmojiSymbols(count = 120): string[] {
    const stride = Math.max(1, Math.floor(JUNK_EMOJI_COUNT / count));
    const offset = Math.floor(Math.random() * JUNK_EMOJI_COUNT);
    return Array.from({ length: count }, (_, k) => junkEmoji(offset + k * stride));
}
