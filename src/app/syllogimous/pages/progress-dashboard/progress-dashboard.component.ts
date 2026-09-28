import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { GameService } from "../../services/game.service";
import { ProgressionService } from "../../services/progression.service";
import { StatsExportService } from "../../services/stats-export.service";
import { EnumScreens } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { LS_SELF_IQ, LS_SELF_IQ_SOURCE } from "../../constants/local-storage.constants";
import { itemTally } from "../../utils/answer.utils";
import { unlockRow } from "../../utils/tier.utils";
import {
    SHARE_DESTINATION, ShareMode, buildShareReport, readSelfReported,
} from "../../utils/share.utils";

/** Stamped so a comparison knows what it is comparing. */
const APP_VERSION = "4";

/** A mode's standing, one table row. */
export interface ModeRow {
    type: EnumQuestionType;
    /** The model's estimate, or a dash where it has never recorded one. */
    level: string;
    /** How sure that is, blank alongside a dash. */
    sure: string;
    items: number;
    accuracy: string;
}

/** One number with its name, which is the whole vocabulary of this screen. */
export interface Tile {
    label: string;
    value: string;
    /** What it means, where the name alone does not say. */
    note?: string;
}

/**
 * The progress dashboard, ported from Isomorph.
 *
 * It replaces the stats page, which stacked six analyses one after another and
 * asked the reader to find the number they came for. What this shows instead is
 * three short rows — what the model thinks, how the answering has gone, and how
 * heavy the reading has been — and the per-mode table underneath, which is the
 * one part of the old page that answered a question rather than reporting a
 * measurement.
 *
 * **Nothing here is a second opinion.** Every figure is read from the same place
 * the app already keeps it: the ability model for the levels, `itemTally` for
 * what counts as right, the recorded `arity`/`integration`/`depth` for the
 * reading load. A dashboard that recomputed any of them would be a second
 * answer to a question the app already answers, and the recurring defect in
 * this project is exactly that — a count taken from the wrong place.
 */
@Component({
    selector: "app-progress-dashboard",
    templateUrl: "./progress-dashboard.component.html",
    styleUrls: ["./progress-dashboard.component.css"],
})
export class ProgressDashboardComponent {
    EnumScreens = EnumScreens;
    SHARE_DESTINATION = SHARE_DESTINATION;

    constructor(
        public router: Router,
        private game: GameService,
        private progression: ProgressionService,
        private statsExport: StatsExportService,
    ) {}

    /**
     * The answered items this screen reports on.
     *
     * Free Play is excluded throughout, and that is not a filter so much as the
     * definition: those items are built from settings the player wrote and are
     * never recorded against the model, so counting them here would describe
     * training that the rest of the app does not believe happened.
     */
    private get answered() {
        return this.game.questions.filter(q => !q.playgroundMode);
    }

    /** The distinct days anything was answered on, oldest first. */
    private get days(): string[] {
        return [...new Set(this.answered.map(q => new Date(q.createdAt).toDateString()))]
            .map(d => new Date(d).getTime())
            .sort((a, b) => a - b)
            .map(t => new Date(t).toDateString());
    }

    /**
     * Days in a row up to the most recent, and the longest run ever.
     *
     * Counted back from the last day trained rather than from today, so a
     * dashboard opened in the morning does not report yesterday's streak as
     * broken before the day has had a chance to start.
     */
    private runs(): { current: number; longest: number } {
        const days = this.days.map(d => new Date(d).getTime());
        if (!days.length) return { current: 0, longest: 0 };

        const DAY = 24 * 60 * 60 * 1000;
        let longest = 1, run = 1;
        for (let i = 1; i < days.length; i++) {
            run = Math.round((days[i] - days[i - 1]) / DAY) === 1 ? run + 1 : 1;
            longest = Math.max(longest, run);
        }
        return { current: run, longest };
    }

    /** What the model makes of the account. */
    get model(): Tile[] {
        const evidence = this.progression.unlockEvidence();
        const { current, longest } = this.runs();
        return [
            {
                label: "Skill level",
                value: evidence.aggregateLevel.toFixed(1),
                note: `best single mode ${evidence.bestLevel.toFixed(1)}`,
            },
            {
                label: "Unlock row",
                value: String(unlockRow(evidence)),
                note: "how much of the app is open",
            },
            { label: "Items answered", value: String(this.answered.length) },
            {
                label: "Current streak",
                value: `${current} day${current === 1 ? "" : "s"}`,
                note: `longest ${longest}`,
            },
        ];
    }

    /**
     * How the answering has gone.
     *
     * Accuracy is per *conclusion* rather than per item, which is the figure the
     * rest of the app scores on: an item carrying three claims is three
     * questions asked, and counting it as one would rate a player who got two
     * of them the same as one who got none.
     */
    get outcomes(): Tile[] {
        const items = this.answered;
        let asked = 0, right = 0, timedOut = 0, spent = 0, timed = 0;

        for (const q of items) {
            const tally = itemTally(q);
            asked += tally.asked;
            right += tally.right;
            if (tally.timedOut) timedOut++;
            const took = q.answeredAt - q.createdAt;
            // A gap of hours is a tab left open, not a question thought about.
            if (took > 0 && took < 10 * 60 * 1000) { spent += took; timed++; }
        }

        return [
            {
                label: "Overall accuracy",
                value: asked ? `${Math.round((100 * right) / asked)}%` : "—",
                note: "per conclusion, not per item",
            },
            { label: "Days played", value: String(this.days.length) },
            {
                label: "Avg. time to answer",
                value: timed ? `${(spent / timed / 1000).toFixed(1)}s` : "—",
            },
            {
                label: "Timeout rate",
                value: items.length ? `${Math.round((100 * timedOut) / items.length)}%` : "—",
            },
        ];
    }

    /**
     * How heavy the reading has been, from what the items recorded about
     * themselves.
     *
     * These are the measurements the app takes and has never shown anybody.
     * They are not difficulty — `levelOf` prices that — they are what the items
     * were made of: how many objects a premise related, how much had to be held
     * at once, how deep the conclusion sat. Averaged over the items that
     * recorded them, because a mode that does not measure one should not drag
     * its average to zero.
     */
    get load(): Tile[] {
        const items = this.answered;
        const mean = (pick: (q: typeof items[number]) => number) => {
            const seen = items.map(pick).filter(v => v > 0);
            return seen.length
                ? (seen.reduce((a, b) => a + b, 0) / seen.length).toFixed(1)
                : "—";
        };
        const widths = items.map(q => q.widthDelta).filter(v => v !== 0);
        const width = widths.length
            ? (widths.reduce((a, b) => a + b, 0) / widths.length)
            : null;

        return [
            {
                label: "Width vs. typical",
                value: width === null ? "—" : `${width > 0 ? "+" : ""}${width.toFixed(1)}`,
                note: "how much wider than the mode's usual item",
            },
            { label: "Premise arity", value: mean(q => q.arity), note: "objects a premise relates" },
            { label: "Integration", value: mean(q => q.integration), note: "premises that had to be joined" },
            { label: "Pairs settled", value: mean(q => q.pairsSettled) },
            { label: "Open groups (peak)", value: mean(q => q.openGroups), note: "most held at once" },
            { label: "Conclusion depth", value: mean(q => q.depth), note: "steps from the premises" },
        ];
    }

    /** Nothing has been answered, so every figure would be a dash. */
    get empty(): boolean {
        return this.answered.length === 0;
    }

    /**
     * Where each mode that has been played actually stands.
     *
     * The one part of the old stats page worth keeping, in a form that fits on
     * a row: the level the model has settled on, how sure it is of that, and
     * what the answering looked like. The page it replaces spread the same
     * three facts over a heading, a list and a set of nested tabs per mode, so
     * comparing two modes meant remembering the first one.
     *
     * Ordered by how much has been played rather than by the mode list, because
     * the question this answers is "how am I doing", and the modes with two
     * items in them are not the ones that has an answer.
     */
    get modes(): ModeRow[] {
        const byType = new Map<EnumQuestionType, { items: number; asked: number; right: number }>();
        for (const q of this.answered) {
            const row = byType.get(q.type) ?? { items: 0, asked: 0, right: 0 };
            const tally = itemTally(q);
            row.items++;
            row.asked += tally.asked;
            row.right += tally.right;
            byType.set(q.type, row);
        }

        const rows: ModeRow[] = [];
        for (const [type, row] of byType) {
            let level = "—", sure = "";
            try {
                const est = this.progression.estimateFor(type);
                level = est.level.toFixed(1);
                sure = `± ${est.sd.toFixed(1)}`;
            } catch { /* a mode with no ledger has no level to report */ }
            rows.push({
                type, level, sure, items: row.items,
                accuracy: row.asked ? `${Math.round((100 * row.right) / row.asked)}%` : "—",
            });
        }
        return rows.sort((a, b) => b.items - a.items);
    }

    /* ---------------- sharing and export, carried from the stats page ---------------- */

    /**
     * What would be shared, shown before anything is copied.
     *
     * The CSV beside this is a per-item log — a timestamp and a duration for
     * every question ever answered — and publishing one says a great deal more
     * than how the training went. This carries where each mode sits and how
     * sure that is, and nothing about when anything happened.
     */
    shareReport: { text: string; json: string } | null = null;
    shareCopied = false;

    /*
     * Kept between visits, because it is a fact about the person rather than
     * about this session, and nobody should have to look it up twice.
     */
    iqScore = this.read(LS_SELF_IQ);
    iqSource = this.read(LS_SELF_IQ_SOURCE);

    private read(key: string) {
        try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
    }

    setIq(score: string, source: string) {
        this.iqScore = score;
        this.iqSource = source;
        try {
            localStorage.setItem(LS_SELF_IQ, score);
            localStorage.setItem(LS_SELF_IQ_SOURCE, source);
        } catch { /* private mode; it simply is not remembered */ }
        // Rebuilt so what is on screen is what would be copied.
        if (this.shareReport) this.buildShare();
    }

    buildShare() {
        const modes: ShareMode[] = [];
        for (const type of Object.values(EnumQuestionType)) {
            try {
                const est = this.progression.estimateFor(type);
                modes.push({ type, level: est.level, sure: est.sd, trials: est.trials });
            } catch { /* a mode with no ledger simply has no estimate */ }
        }

        this.shareReport = buildShareReport({
            modes,
            // Distinct dates rather than dates: how much training happened, not when.
            days: this.days.length,
            answered: this.answered.length,
            version: APP_VERSION,
            iq: readSelfReported(this.iqScore, this.iqSource),
        });
        this.shareCopied = false;
    }

    async copyShare() {
        if (!this.shareReport) return;
        const payload = `${this.shareReport.text}\n\n${this.shareReport.json}`;
        try {
            await navigator.clipboard.writeText(payload);
            this.shareCopied = true;
        } catch { /* the text is on screen; selecting it still works */ }
    }

    exportStats() {
        this.statsExport.exportStats();
    }
}
