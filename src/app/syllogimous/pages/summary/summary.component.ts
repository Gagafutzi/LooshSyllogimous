import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';
import { EnumScreens } from '../../constants/game.constants';
import {
    DaySummary, WeekSummary, daySummary, weekSummary,
} from '../../utils/session.utils';
import { ProgressAndPerformanceService } from '../../services/progress-and-performance.service';

/**
 * What you did today, and what you did this week.
 *
 * The payoff for having a goal. Everything on it is derived from the answered
 * history at the moment it is opened, so it is never out of step with History
 * or Stats, and it works for a player whose history predates the feature.
 */
@Component({
    selector: 'app-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.css'],
})
export class SummaryComponent {
    EnumScreens = EnumScreens;

    today!: DaySummary;
    week!: WeekSummary;

    /** Percentages against the goals already set in Settings, in minutes. */
    dailyPct = 0;
    weeklyPct = 0;
    /** Which of the seven days reached the daily goal. */
    metByDay: boolean[] = [];

    constructor(
        public game: GameService,
        public router: Router,
        private progress: ProgressAndPerformanceService,
    ) {}

    ngOnInit() {
        const history = this.game.questions;
        this.today = daySummary(history);
        this.week = weekSummary(history);

        /*
         * The goals were already here — daily and weekly, in minutes, settable
         * in Settings and tracked per day since long before this page. Nothing
         * new is invented: this reads what is stored, so a player who set
         * thirty minutes years ago is measured against thirty minutes.
         */
        const today = this.progress.getToday();
        this.dailyPct = this.progress.calcDailyProgress(today);
        this.weeklyPct = this.progress.calcWeeklyProgress(today);

        const played = this.progress.getDailyProgress();
        this.metByDay = this.week.days.map(
            d => (played[d.key] ?? 0) >= this.progress.DAILY_GOAL);
    }

    get goalMet() { return this.dailyPct >= 100; }
    get daysMet() { return this.metByDay.filter(Boolean).length; }

    pct(part: number, whole: number) {
        return whole ? Math.round((part / whole) * 100) : 0;
    }

    /** "24m", or "1h 05m" once it is worth saying in hours. */
    duration(seconds: number) {
        const m = Math.round(seconds / 60);
        if (m < 60) return `${m}m`;
        return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
    }

    /** Mon, Tue… for the week strip; today is labelled as today. */
    dayLabel(at: number, index: number) {
        if (index === this.week.days.length - 1) return "today";
        return new Date(at).toLocaleDateString(undefined, { weekday: "short" });
    }

    /** Bar height as a percentage of the busiest day, with a visible floor. */
    barHeight(answered: number) {
        const most = Math.max(...this.week.days.map(d => d.answered), 1);
        return answered ? Math.max(8, Math.round((answered / most) * 100)) : 2;
    }

    /** Minutes played on a given day of the strip. */
    minutesOn(key: string) {
        return Math.round((this.progress.getDailyProgress()[key] ?? 0) / 60000);
    }

    /** The dimension costing the most, if there is enough to name one. */
    get weakestDimension() {
        return this.today.dimensions.find(d => d.attempts >= 3 && d.wrong > 0) ?? null;
    }
}
