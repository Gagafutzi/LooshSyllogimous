/**
 * A summary of how training has gone, small enough to read before publishing it.
 *
 * The CSV export is a per-item behavioural log — a timestamp, a duration and an
 * outcome for every question ever answered. Published, that is more than
 * training data: timestamps alone give sleep and working hours, a timezone, and
 * every period somebody stopped, and two logs from one person are trivially
 * linkable. A public store also has no un-publishing.
 *
 * So this is deliberately not that. It carries what someone comparing progress
 * would actually want — where each mode sits on the difficulty scale and how
 * sure the estimate is — and no timestamps at all. Days and answers are counts,
 * which say how much training happened without saying when.
 *
 * Small enough to read is the point rather than a side effect: consent to
 * publishing means nothing if the thing being published cannot be looked at
 * first.
 *
 * Pure, so what leaves can be tested without a browser.
 */

export interface ShareMode {
    type: string;
    /** Ability in linear-equivalent premises. */
    level: number;
    /** Standard deviation of the estimate: how much of it is guesswork. */
    sure: number;
    /** Answers this mode's estimate rests on. */
    trials: number;
}

/**
 * A score somebody typed in, and where it came from.
 *
 * Optional, and marked as self-reported everywhere it appears — in the readable
 * half and in the field name — because a number in a public dataset gets read
 * as measured unless it says otherwise, and nothing here measured it.
 *
 * `source` matters more than it looks: 130 from Raven's, from a supervised
 * battery and from a free online quiz are three different claims, and a
 * collection of scores with no test named is a collection of noise. It is not
 * required, because demanding it would only produce invented answers.
 */
export interface SelfReported {
    score: number;
    /** Which test, in the reporter's own words. */
    source?: string;
}

/** Outside this, it is a typo rather than a score. */
export const IQ_RANGE: [number, number] = [40, 200];

export function readSelfReported(
    score: unknown, source?: unknown,
): SelfReported | null {
    const n = Number(score);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < IQ_RANGE[0] || rounded > IQ_RANGE[1]) return null;
    const named = typeof source === "string" ? source.trim().slice(0, 60) : "";
    return named ? { score: rounded, source: named } : { score: rounded };
}

export interface ShareInput {
    modes: ShareMode[];
    /** Distinct days on which anything was answered. */
    days: number;
    /** Total answered questions. */
    answered: number;
    /** Which build produced this, so a comparison knows what it is comparing. */
    version: string;
    /** Optional, and only ever included when somebody has entered one. */
    iq?: SelfReported | null;
}

export interface ShareReport {
    /** Readable, for pasting where people read. */
    text: string;
    /** The same numbers, for anything that wants to compute with them. */
    json: string;
}

/** A mode with no answers behind it has no estimate worth reporting. */
const measured = (m: ShareMode) => m.trials > 0;

const round = (n: number, dp = 1) => Number(n.toFixed(dp));

export function buildShareReport(input: ShareInput): ShareReport {
    const modes = input.modes.filter(measured)
        .slice()
        .sort((a, b) => b.level - a.level);

    const lines = [
        `Loosh Syllogimous — results`,
        `${input.answered} answered over ${input.days} day${input.days === 1 ? "" : "s"}`
        + ` · build ${input.version}`,
    ];

    if (input.iq) {
        lines.push(`Self-reported IQ ${input.iq.score}`
            + (input.iq.source ? ` (${input.iq.source})` : " (test not named)"));
    }
    lines.push("");

    if (!modes.length) {
        lines.push("No mode has been answered enough to have an estimate yet.");
    } else {
        const width = Math.max(...modes.map(m => m.type.length));
        lines.push("mode".padEnd(width) + "   level      ±   answers");
        for (const m of modes) {
            lines.push(
                m.type.padEnd(width)
                + String(round(m.level)).padStart(8)
                + String(round(m.sure)).padStart(7)
                + String(m.trials).padStart(10));
        }
        lines.push("");
        lines.push("Level is in linear-equivalent premises: one level is about one"
            + " premise of a plain ordering item. ± is how sure the estimate is,"
            + " not how much it varies.");
    }

    const json = JSON.stringify({
        app: "loosh-syllogimous",
        version: input.version,
        days: input.days,
        answered: input.answered,
        // Named for what it is, so nothing downstream reads it as measured.
        ...(input.iq ? { selfReportedIq: input.iq } : {}),
        modes: modes.map(m => ({
            type: m.type, level: round(m.level, 2), sure: round(m.sure, 2), trials: m.trials,
        })),
    }, null, 2);

    return { text: lines.join("\n"), json };
}
