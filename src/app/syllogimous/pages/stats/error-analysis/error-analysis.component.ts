import { Component } from '@angular/core';
import { Question } from 'src/app/syllogimous/models/question.models';
import { GameService } from 'src/app/syllogimous/services/game.service';
import { itemTally } from 'src/app/syllogimous/utils/answer.utils';

@Component({
    selector: 'app-error-analysis',
    templateUrl: './error-analysis.component.html',
    styleUrls: ['./error-analysis.component.css']
})
export class ErrorAnalysisComponent {
    questions: Question[] = [];
    mostCommonMistake = "No Mistakes Yet";
    leastCommonMistake = "No Mistakes Yet";

    constructor(
        public game: GameService
    ) {}

    ngOnInit() {
        this.questions = this.game.questions;

        /*
         * Mistakes are counted per conclusion missed, not per item.
         *
         * `isValid !== userAnswer` compared against the *last* conclusion of a
         * multi-conclusion item, so a mode whose items ask three questions had
         * two thirds of its errors invisible here -- and an item missed on all
         * three counted the same as one missed on one.
         */
        const typeMistakesCount: Record<string, number> = {};
        this.questions
            .forEach(q => {
                const { asked, right, timedOut } = itemTally(q);
                if (timedOut) return;          // not a mistake; nothing was said
                const missed = asked - right;
                if (!missed) return;
                typeMistakesCount[q.type] = (typeMistakesCount[q.type] || 0) + missed;
            });
        const sorted = Object.entries(typeMistakesCount).sort((a, b) => a[1] - b[1]);
        if (sorted.length) {
            this.mostCommonMistake = sorted[sorted.length - 1][0];
            this.leastCommonMistake = sorted[0][0];
        }
    }
}
