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

export interface ShareInput {
    modes: ShareMode[];
    /** Distinct days on which anything was answered. */
    days: number;
    /** Total answered questions. */
    answered: number;
    /** Which build produced this, so a comparison knows what it is comparing. */
    version: string;
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
        "",
    ];

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
        modes: modes.map(m => ({
            type: m.type, level: round(m.level, 2), sure: round(m.sure, 2), trials: m.trials,
        })),
    }, null, 2);

    return { text: lines.join("\n"), json };
}
