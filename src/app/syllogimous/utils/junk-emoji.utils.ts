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

/** Six silhouettes, so colour is not the only channel. */
const SHAPES = [
    (c: string) => `<circle cx="12" cy="12" r="9" fill="${c}"/>`,
    (c: string) => `<rect x="4" y="4" width="16" height="16" rx="3" fill="${c}"/>`,
    (c: string) => `<polygon points="12,3 21,20 3,20" fill="${c}"/>`,
    (c: string) => `<polygon points="12,2 22,12 12,22 2,12" fill="${c}"/>`,
    (c: string) => `<polygon points="12,3 20,9 17,19 7,19 4,9" fill="${c}"/>`,
    (c: string) => `<path d="M12 21 C 3 14, 5 4, 12 8 C 19 4, 21 14, 12 21 Z" fill="${c}"/>`,
];

export const JUNK_EMOJI_COUNT = HUES.length * SATURATION.length * LIGHTNESS.length * SHAPES.length;

/** One stimulus, as inline SVG. Same id, same picture, always. */
export function junkEmoji(id: number): string {
    const i = ((id % JUNK_EMOJI_COUNT) + JUNK_EMOJI_COUNT) % JUNK_EMOJI_COUNT;

    const shape = SHAPES[i % SHAPES.length];
    const rest = Math.floor(i / SHAPES.length);
    const light = LIGHTNESS[rest % LIGHTNESS.length];
    const sat = SATURATION[Math.floor(rest / LIGHTNESS.length) % SATURATION.length];
    const hue = HUES[Math.floor(rest / (LIGHTNESS.length * SATURATION.length)) % HUES.length];

    const fill = `hsl(${hue} ${sat}% ${light}%)`;
    return `<svg class="junk" viewBox="0 0 24 24" width="24" height="24" role="img"`
        + ` aria-label="coloured shape ${i}">${shape(fill)}</svg>`;
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
