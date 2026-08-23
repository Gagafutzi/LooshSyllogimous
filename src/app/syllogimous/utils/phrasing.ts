/**
 * The tokens every premise and conclusion is built from.
 *
 * These three wrappers were defined separately in `ndspace.utils`,
 * `transformations.utils` and inline in half a dozen other places, which meant
 * "change how a premise reads" had no single place to change it. Adding one
 * colour per dimension touched five files for that reason, and missed the two
 * Direction3D modes entirely because their spans were written out by hand in
 * the generator.
 *
 * The markup is load-bearing, not decoration:
 *
 *   - `.subject` is matched by a regex in `question.utils` (`extractSubjects`)
 *     and in `GameService.fillLinearConclusion`, so the exact tag shape is a
 *     contract, not a style choice.
 *   - Angular's sanitizer strips inline styles from `[innerHTML]` bindings but
 *     keeps classes, which is why every visual difference here is a class.
 *
 * Pure strings. No Angular, no settings, no storage.
 */

/**
 * A stimulus: a word, an emoji, or a visual-noise fragment.
 *
 * Typed as a string now. Extracting this helper turned up generators handing it
 * a one-element array straight from `splice` and others handing it an optional,
 * all of which the template interpolation it replaced coerced silently; those
 * call sites have since been fixed, so the signature can say what it means.
 * `undefined` is still tolerated because two arrangement paths legitimately
 * build a claim before both ends are known.
 */
export const subj = (s: string | undefined) => `<span class="subject">${s}</span>`;

/**
 * A relation word, optionally painted as one dimension's.
 *
 * `extra` carries axis colour classes in the composed spaces and is empty
 * everywhere else — a one-axis mode has nothing to tell apart.
 */
export const rel = (s: string, extra = "") => `<span class="relation ${extra}">${s}</span>`;

/** An emphasised fragment, optionally painted as one dimension's. */
export const hi = (s: string, extra = "") => `<span class="highlight ${extra}">${s}</span>`;

/** The reversal cue: a word that means the opposite of what it says. */
export const neg = (s: string) => `<span class="is-negated">${s}</span>`;

/* ------------------------------------------------------------------ *
 * Dimension colour                                                    *
 * ------------------------------------------------------------------ */

/**
 * How many colour slots the stylesheet defines (`--th-dim-1` … `--th-dim-8`).
 *
 * ThemeService resolves the slots to actual colours, picking a light or dark
 * set for the theme and moving any hue too close to the accent out of the way.
 * Nothing here knows what colour a slot is.
 */
export const DIM_SLOTS = 8;

/**
 * A zero-based index into a palette that is numbered from one.
 *
 * `--th-dim-0` does not exist, so `slot % DIM_SLOTS` on a counter starting at
 * zero asks for an undefined custom property. The declaration is then invalid
 * at computed-value time and dropped — and `fill` inherits in SVG, so the
 * element falls through an unset ancestor to the initial value and is drawn
 * **black**. That is what happened to the first marked node in Relational Web,
 * and it also shifted every other marker one colour along.
 *
 * Anything painting from a counter goes through here rather than doing its own
 * modulo.
 */
export const dimSlot = (index: number) => (index % DIM_SLOTS) + 1;

/** The class pair for a slot: the generic hook, then the slot itself. */
export const dimClass = (slot: number) => `dim dim-${slot}`;
