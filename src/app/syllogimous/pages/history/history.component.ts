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

    /*
     * Which conclusion of an item is being looked at, per card.
     *
     * Keyed by the card's own identity rather than held on the question,
     * because it is a property of the looking and not of the answer — and
     * because a question read out of storage is a plain object that nothing
     * should be writing view state onto.
     */
    private claimAt = new Map<string, number>();

    private cardKey(q: Question): string {
        return String(q.answeredAt) + "|" + String(q.createdAt) + "|" + q.type;
    }

    /**
     * The conclusions of an item, each with its own derivation.
     *
     * History showed one explanation for an item that asked three. It was not
     * choosing between them: `takeSeriesAnswer` overwrites `question.explanation`
     * as the card advances, so what reached storage was whatever the *last*
     * conclusion left behind — and the first two, which are the ones you would
     * open History to understand, were not shown at all despite being right
     * there on `series[i].explanation`.
     *
     * A claim without one of its own falls back to the item's, which is correct
     * for the modes where a single derivation covers every conclusion.
     */
    claims(q: Question) {
        const series = q.series ?? [];
        if (series.length <= 1) return null;
        return series.map((claim, i) => ({
            index: i,
            /*
             * Not every conclusion is a sentence. The picking modes ask their
             * question in the prompt above a set of options — `text` is empty
             * there — so the card has to show whichever of the two this claim
             * actually used, or it renders a blank where the question was.
             */
            text: claim.text || claim.prompt || q.choicePrompt || "",
            /* The claim's own premises where it replaced them, else the item's. */
            premises: claim.premises ?? q.premises,
            /* And its options, where the answer was a pick rather than a judgement. */
            choices: claim.choices ?? (i === series.length - 1 ? q.choices : undefined),
            correctChoice: claim.correctChoice ?? (i === series.length - 1 ? q.correctChoice : -1),
            explanation: claim.explanation?.length ? claim.explanation : q.explanation,
            isValid: claim.isValid,
            answered: q.seriesAnswers?.[i],
        }));
    }

    claimIndex(q: Question): number {
        const n = (q.series ?? []).length;
        const at = this.claimAt.get(this.cardKey(q)) ?? 0;
        return Math.min(Math.max(0, at), Math.max(0, n - 1));
    }

    showClaim(q: Question, index: number) {
        const n = (q.series ?? []).length;
        if (!n) return;
        // Wraps, so stepping past either end is a step rather than a dead button.
        this.claimAt.set(this.cardKey(q), ((index % n) + n) % n);
    }

    stepClaim(q: Question, by: number) {
        this.showClaim(q, this.claimIndex(q) + by);
    }

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
