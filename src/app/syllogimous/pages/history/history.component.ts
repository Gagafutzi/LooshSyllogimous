import { Component } from '@angular/core';
import { GameService } from '../../services/game.service';
import { Question } from '../../models/question.models';
import { compareConstruction } from '../../utils/construct.utils';
import { ItemTally, itemTally } from '../../utils/answer.utils';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { ToastService } from 'src/app/services/toast.service';

@Component({
    selector: 'app-history',
    templateUrl: './history.component.html',
    styleUrls: ['./history.component.css']
})
export class HistoryComponent {
    Array = Array;
    EnumScreens = EnumScreens;

    /**
     * A construct answer, dimension by dimension.
     *
     * `Correct Answer: true / User Answer: false` is the whole report a
     * seven-dimension answer used to get, which is the one thing construction
     * was built to avoid — its argument is that a binary cannot tell a lucky
     * run from an understood one, and the result screen turned it back into
     * one. Six right and one wrong is a different event from seven wrong.
     */
    breakdown(q: Question) {
        if (q.answerMode !== "construct" || !q.construct.length) return null;
        return compareConstruction(q.construct, q.userConstruct);
    }

    /*
     * How many of the item's conclusions were right.
     *
     * The card used to be coloured by `userAnswer === isValid`, which on a
     * multi-conclusion item is the *last* conclusion -- so a slip on the first
     * of three drew the whole card green when the third went well. Three
     * states now, because two of three is neither of the other two.
     */
    tally(q: Question): ItemTally { return itemTally(q); }

    allQuestions: Question[] = [];
    questions: Question[] = [];
    sliceIdx = -25;
    
    constructor(
        public game: GameService,
        public router: Router,
        private toaster: ToastService
    ) { }

    ngOnInit() {
        this.allQuestions = this.game.questions;
        this.loadMoreQuestions();
    }

    loadMoreQuestions() {
        this.sliceIdx += 25;
        this.questions.push(...this.allQuestions.slice(this.sliceIdx, this.sliceIdx+25));
    }

    copyQuestion(q: Question) {
        const el = document.createElement("TEXTAREA") as HTMLTextAreaElement;
        document.body.appendChild(el);
        el.value = JSON.stringify(q, null, 2);
        el.focus();
        el.select();
        document.execCommand("copy");
        this.toaster.show("Question raw JSON data copied into your clipboard!", { classname: "bg-success text-light" });
        document.body.removeChild(el);
    }
}
