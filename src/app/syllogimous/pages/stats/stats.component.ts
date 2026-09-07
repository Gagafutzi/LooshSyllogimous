import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { StatsExportService } from '../../services/stats-export.service';
import { GameService } from '../../services/game.service';
import { ProgressionService } from '../../services/progression.service';
import { buildShareReport, readSelfReported, ShareMode } from '../../utils/share.utils';
import { LS_SELF_IQ, LS_SELF_IQ_SOURCE } from '../../constants/local-storage.constants';
import { EnumQuestionType } from '../../constants/question.constants';
import { EnumScreens } from '../../constants/game.constants';

/** Stamped so a comparison knows what it is comparing. */
const APP_VERSION = "4";

@Component({
    selector: 'app-stats',
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.css']
})
export class StatsComponent {
    EnumScreens = EnumScreens;

    constructor(
        public router: Router,
        private statsExportService: StatsExportService,
        private game: GameService,
        private progression: ProgressionService,
    ) {}

    /* ---------------- sharing results ---------------- */

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

        // Distinct dates rather than dates: how much training happened, not when.
        const answered = this.game.questions.filter(q => !q.playgroundMode);
        const days = new Set(
            answered.map(q => new Date(q.createdAt).toDateString())).size;

        this.shareReport = buildShareReport({
            modes, days, answered: answered.length, version: APP_VERSION,
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
        this.statsExportService.exportStats();
    }
}