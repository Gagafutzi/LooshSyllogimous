import { Component } from '@angular/core';
import { Question } from '../../models/question.models';
import { GameService } from '../../services/game.service';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { EnumQuestionType } from '../../constants/question.constants';

@Component({
    selector: 'app-tutorials',
    templateUrl: './tutorials.component.html',
    styleUrls: ['./tutorials.component.css']
})
export class TutorialsComponent {
    EnumScreens = EnumScreens;
    EnumQuestionType = EnumQuestionType;

    questionTypes: EnumQuestionType[] = [];
    questions: Question[] = [];
    seenQs: Record<string, boolean> = {};

    constructor(
        public game: GameService,
        public router: Router
    ) {
        this.questionTypes = Object.values(EnumQuestionType);
    }

    ngOnInit() {
        /*
         * Through the service, not out of storage.
         *
         * This read and parsed the history key itself — three and a half
         * megabytes of JSON on the way into a screen that only wants to know
         * which modes have been seen, and a second copy of a list the service
         * already holds parsed. It also read a key that no longer exists: the
         * history is stored in chunks now, and `game.questions` is the one
         * thing that knows how to put them back together.
         *
         * Copied before reversing, because that list is the service's cache and
         * `reverse` is in place.
         */
        this.questions = [...this.game.questions].reverse();
        this.seenQs = this.questions.reduce((acc, curr) => (acc[curr.type] = true, acc), {} as any);
    }

    navTo(type: EnumQuestionType) {
        this.router.navigate([EnumScreens.Tutorial, type], { state: { data: { showBack: true } } });
    }
}
