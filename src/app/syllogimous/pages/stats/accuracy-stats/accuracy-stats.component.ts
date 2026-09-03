import { Component } from '@angular/core';
import { Question } from 'src/app/syllogimous/models/question.models';
import { GameService } from 'src/app/syllogimous/services/game.service';
import { itemTally, itemWasRight } from 'src/app/syllogimous/utils/answer.utils';

@Component({
    selector: 'app-accuracy-stats',
    templateUrl: './accuracy-stats.component.html',
    styleUrls: ['./accuracy-stats.component.css']
})
export class AccuracyStatsComponent {
    questions: Question[] = [];
    correctQs: Question[] = [];
    incorrectQs: Question[] = [];
    unansweredQs: Question[] = [];
    currentStreak: Question[] = [];
    longestStreak: Question[] = [];
    /** Conclusions, not items: a three-conclusion item is three answers. */
    conclusionsRight = 0;
    conclusionsAsked = 0;

    constructor(
        public game: GameService
    ) {}

    ngOnInit() {
        this.questions = this.game.questions;

        /*
         * Cleared or not, per item, and separately how many conclusions went.
         *
         * These lists are of items, so they stay item-shaped -- but "correct"
         * has to mean every conclusion the item asked, not the last one, which
         * is what `isValid === userAnswer` compares on a multi-conclusion item.
         */
        this.correctQs = this.questions.filter(q => itemWasRight(q));
        this.incorrectQs = this.questions.filter(q => q.userAnswer !== undefined && !itemWasRight(q));
        this.unansweredQs = this.questions.filter(q => q.userAnswer === undefined);

        for (const q of this.questions) {
            const { asked, right, timedOut } = itemTally(q);
            if (!timedOut) { this.conclusionsAsked += asked; this.conclusionsRight += right; }
        }

        for (const q of this.questions) {
            if (!itemWasRight(q)) {
                break;
            }
            this.currentStreak.push(q);
        }

        let streak = [];
        for (const q of this.questions) {
            if (!itemWasRight(q)) {
                if (streak.length > this.longestStreak.length) {
                    this.longestStreak = streak;
                    streak = [];
                }
                continue;
            }
            streak.push(q);
        }
    }
}
