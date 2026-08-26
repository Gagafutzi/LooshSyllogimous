/**
 * Turning a drawing into something a premise can carry.
 *
 * Stimuli reach the DOM through an `[innerHTML]` binding, and Angular's
 * sanitiser keeps only the elements on its allowlist — which has no `svg` on
 * it, and strips `style` attributes besides. So neither inline SVG nor
 * inline-styled divs survive to be seen. An `<img>` with a `data:image/png`
 * source does. (SVG data URLs are blocked too, since they can carry script.)
 *
 * That is the whole reason this file exists, and the reason it is a file rather
 * than a comment: it had been discovered once, written down inside
 * `visual-noise.utils`, and then met again by `junk-emoji.utils`, which shipped
 * inline SVG and rendered nothing at all. A rule that has to be rediscovered is
 * a rule that belongs in the one place both callers go through.
 *
 * Returns `null` where there is nothing to draw with — under node, and under a
 * test harness whose `document` is a stub with no `createElement`. Callers fall
 * back to SVG markup, which is fine for a test and never what a player sees.
 */
export function rasterise(
    width: number,
    height: number,
    scale: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
): string | null {
    try {
        if (typeof document === "undefined"
            || typeof document.createElement !== "function") return null;

        const canvas = document.createElement("canvas") as HTMLCanvasElement;
        if (typeof canvas?.getContext !== "function") return null;

        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        if (scale !== 1) ctx.scale(scale, scale);
        draw(ctx);

        return typeof canvas.toDataURL === "function"
            ? canvas.toDataURL("image/png")
            : null;
    } catch {
        // A drawing that cannot be made is not worth taking the card down for.
        return null;
    }
}
