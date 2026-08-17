/**
 * Anchor Space — modelled on Syllogimous v3 (`Direction2D(false, true)`).
 *
 * Four fixed markers sit in a diamond and never move. Objects are stated
 * relative to those markers rather than to each other, so instead of chaining a
 * path through named objects you locate everything against a stable frame.
 *
 * The markers being *visual* is the point: a shape cannot be rehearsed
 * sub-vocally the way a name can, so the reference frame has to be held
 * spatially.
 *
 * Coordinates are 2D, which lets `describeOffset` / `describeConclusion` from
 * transformations.utils be reused unchanged — they walk the coordinate length,
 * so a 2-element coord yields only east/west and north/south wording.
 */

import { Coord } from "./transformations.utils";

/**
 * Marker glyphs.
 *
 * These were inline <svg> originally, which rendered as nothing: premises reach
 * the DOM through an [innerHTML] binding, and Angular's default sanitizer strips
 * <svg> wholesale. Every anchor vanished at render time, leaving "…relative to"
 * pointing at nothing and making the mode unsolvable — while generator-level
 * checks still passed, because the markup was correct right up until it was
 * displayed.
 *
 * Characters in a classed <span> survive sanitization (span and class are both
 * allowed), so the glyph is now part of the text itself and cannot be stripped.
 * Colour comes from CSS rather than a style attribute, which the sanitizer also
 * removes.
 */
const GLYPH = (kind: string, char: string) =>
    `<span class="anchor anchor--${kind}">${char}</span>`;

const STAR     = GLYPH("star", "★");
const CIRCLE   = GLYPH("circle", "●");
const TRIANGLE = GLYPH("triangle", "▲");
const DIAMOND  = GLYPH("diamond", "◆");

export interface Anchor {
    /** Rendered marker; also serves as the object's identity in the coord map. */
    token: string;
    name: string;
    coord: Coord;
}

/**
 * The diamond layout from v3: one marker per cardinal direction. Keeping them
 * on the axes means every anchor has a clean directional relationship to the
 * others, so no premise is needed to establish the frame itself.
 */
export const ANCHORS: Anchor[] = [
    { token: STAR,     name: "star",     coord: [0, 1] },
    { token: CIRCLE,   name: "circle",   coord: [1, 0] },
    { token: TRIANGLE, name: "triangle", coord: [-1, 0] },
    { token: DIAMOND,  name: "diamond",  coord: [0, -1] },
];

export const ANCHOR_TOKENS = ANCHORS.map(a => a.token);

/** Starting coordinate map containing only the fixed frame. */
export function anchorCoordMap(): Record<string, Coord> {
    const map: Record<string, Coord> = {};
    for (const a of ANCHORS) map[a.token] = a.coord.slice();
    return map;
}

/** True when a token is part of the fixed frame — anchors must never be moved. */
export function isAnchor(token: string) {
    return ANCHOR_TOKENS.includes(token);
}
