import { Component, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { GameService } from '../../services/game.service';
import { StatsService } from '../../services/stats.service';
import { LS_CAROUSEL_ADVANCE, LS_CAROUSEL_SECONDS, LS_GAME_MODE, LS_TIMER } from '../../constants/local-storage.constants';
import { LS_CUSTOM_TIMERS_KEY } from '../settings/modal-timer-settings/modal-timer-settings.component';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { GameTimerService } from '../../services/game-timer.service';
import { ConstructSlot } from '../../models/question.models';
import { ProgressionService } from '../../services/progression.service';
import { SlotAnswer, blankPicks, slotsRemaining } from '../../utils/construct.utils';

@Component({
    selector: 'app-game',
    templateUrl: './game.component.html',
    styleUrls: ['./game.component.css']
})
export class GameComponent {
    Array = Array;
    
    timerType;
    gameMode;
    timerTimeSeconds = 0;
    trueButtonToTheRight = false;
    private questionSub?: Subscription;

    /** 'manual' = Prev/Next, 'click' = advance anywhere, 'timer' = auto-advance. */
    carouselAdvance: 'manual' | 'click' | 'timer' = 'manual';
    carouselSeconds = 4;

    constructor(
        public game: GameService,
        public gameTimerService: GameTimerService,
        private statsService: StatsService,
        public progressionService: ProgressionService,
        private router: Router,
    ) {
        this.timerType = localStorage.getItem(LS_TIMER) || '0';
        this.gameMode = localStorage.getItem(LS_GAME_MODE) || '0';
        this.carouselAdvance = (localStorage.getItem(LS_CAROUSEL_ADVANCE) as any) || 'manual';
        this.carouselSeconds = Number(localStorage.getItem(LS_CAROUSEL_SECONDS)) || 4;
        this.trueButtonToTheRight = Math.random() > 0.5;

        if (this.game.question.conclusion === "!") {
            this.router.navigate([EnumScreens.Start]);
        }
    }

    /**
     * ngb-carousel auto-advances on this interval. Only the timed mode wants
     * that; the others park it far enough out that it never fires, which is how
     * the component was already suppressing auto-advance.
     */
    get carouselIntervalMs() {
        return this.carouselAdvance === 'timer'
            ? Math.max(1, this.carouselSeconds) * 1000
            : 999999999;
    }

    /**
     * Click-to-advance. Ignores clicks on real controls so the answer buttons
     * and nav do not also step the carousel.
     */
    onSlideAreaClick(carousel: any, event: Event) {
        if (this.carouselAdvance !== 'click') return;
        if ((event.target as HTMLElement)?.closest('button, a, input, select, textarea')) return;
        carousel.next();
    }

    /**
     * Whether a clock is actually counting down on this question.
     *
     * The bar used to be shown on `timerType !== '0'`, which is the *setting*
     * rather than the fact. Progression arms a clock of its own regardless of
     * that setting, so with the ladder on and the timer preference set to off
     * the question was being timed out with nothing on screen — no warning, no
     * countdown, and no way to tell it apart from a bug. The honest condition is
     * whether a limit was armed for this question.
     */
    get timerRunning() {
        return this.timerTimeSeconds > 0;
    }

    private startTimerForQuestion() {
        // Cleared first: it survives from the previous question otherwise, and a
        // stale value both shows a bar for an untimed item and divides the
        // progress bar by the wrong total.
        this.timerTimeSeconds = 0;

        // Progression owns the clock when it is on: the shrinking limit *is* the
        // difficulty, so a fixed or stats-derived timer would fight it. It
        // returns null when the player has the timer off, so "Timer disabled"
        // means no countdown here either.
        //
        // Free Play is the exception. It runs on settings the player wrote
        // themselves and its answers are never recorded, so no ladder is driving
        // that item — a limit computed for a configuration it was not built from
        // is the wrong number as well as an unasked-for one.
        const ladderSeconds = this.game.playgroundSettings
            ? null
            : this.progressionService.timeLimitFor(this.game.question.type);
        if (ladderSeconds != null) {
            this.timerTimeSeconds = ladderSeconds;
            this.kickTimer();
            return;
        }

        switch(this.timerType) {
            case '1': {
                console.log("Custom timer");

                const customTimers = JSON.parse(localStorage.getItem(LS_CUSTOM_TIMERS_KEY) || "{}");
                this.timerTimeSeconds = customTimers[this.game.question.type] || 90;
                this.kickTimer();
                
                break;
            }
            case '2': {
                console.log("Adaptive timer");

                const correctRate = 0.5;
                const incorrectRate = 1;
                const timeoutRate = 1.5;
                const newLevelBonus = 15;
                const negationBonus = 3;
                const metaRelationBonus = 4;
                this.timerTimeSeconds = 90;

                const questionType = this.game.question.type;
                const questionPremises = this.game.question.premises.length;
                const { typeBasedStats } = this.statsService.calcStats(this.timerType);
                const tbs = typeBasedStats[questionType];

                if (tbs?.stats) {
                    const prevStats = (tbs.stats as any)[questionPremises - 1];
                    const currStats = (tbs.stats as any)[questionPremises];

                    let avgTimeToRespond = this.timerTimeSeconds;
                    if (currStats && currStats.count > 2) {
                        avgTimeToRespond = (currStats.last10Sum / 1000) / (currStats.last10Count || 1);
                        avgTimeToRespond -= correctRate * currStats.last10Correct;
                        avgTimeToRespond += incorrectRate * currStats.last10Incorrect;
                        avgTimeToRespond += timeoutRate * currStats.last10Timeout;
                    } else if (prevStats && prevStats.count > 2) {
                        avgTimeToRespond = (prevStats.last10Sum / 1000) / (prevStats.last10Count || 1);
                        avgTimeToRespond -= correctRate * prevStats.last10Correct;
                        avgTimeToRespond += incorrectRate * prevStats.last10Incorrect;
                        avgTimeToRespond += timeoutRate * prevStats.last10Timeout;
                        avgTimeToRespond += newLevelBonus; // Bonus for the new level
                    }

                    avgTimeToRespond += negationBonus * this.game.question.negations;
                    avgTimeToRespond += metaRelationBonus * this.game.question.metaRelations;

                    this.timerTimeSeconds = Math.floor(Math.max(0, avgTimeToRespond));
                }

                this.kickTimer();
                
                break;
            }
            default: {
                console.log("No timer");
            }
        }
    }

    ngOnInit() {
        this.startTimerForQuestion();
        this.resetPicks();

        // Auto-advance replaces the question in place, so the screen has to
        // re-arm itself rather than relying on a fresh component.
        this.questionSub = this.game.questionChanged.subscribe(() => {
            this.gameTimerService.stop();
            this.trueButtonToTheRight = Math.random() > 0.5;
            this.resetPicks();
            this.startTimerForQuestion();
        });
    }

    /**
     * Construction answers, one entry per slot per claim.
     *
     * Held here rather than on the Question so an unfinished attempt is not
     * written into history if the clock runs out mid-build.
     */
    picks: SlotAnswer[][] = [];

    ngOnDestroy() {
        this.questionSub?.unsubscribe();
        this.gameTimerService.stop();
    }

    /**
     * Slide gating for the conclusion builder.
     *
     * In carousel modes the builder waits until every premise has been shown.
     * Visible from the first slide it is a scratchpad you can fill in as you
     * read, which is exactly the memory load that stepping through premises one
     * at a time — and not being able to go back — exists to impose.
     *
     * "Furthest reached", not "currently on the last slide": in the mode that
     * allows Prev, stepping back should not take the form away again.
     */
    activeSlideId = "";
    private reachedEnd = false;

    /**
     * Bumped per question, and part of every slide id.
     *
     * ngb-carousel keeps its own `activeId` across content changes and only
     * falls back to the first slide when that id is gone. Slide ids used to be
     * fixed — `s-conclusion-0` and so on — so answering from the conclusion left
     * the carousel sitting on an id the *next* question also had, and that
     * question opened on its conclusion with the premises never shown.
     *
     * Making the ids unique per question is what fixes it, rather than reaching
     * for the carousel and calling `select`: the slides are rebuilt by `ngFor`
     * on the same tick the question changes, so an imperative reset races the
     * render, while an id that cannot match leans on the fallback the component
     * already does correctly.
     */
    private questionToken = 0;

    slideId(name: string) {
        return `s${this.questionToken}-${name}`;
    }

    onSlideChange(id: string) {
        this.activeSlideId = id;
        if (id === this.lastSlideId) this.reachedEnd = true;
    }

    /** The final slide, which depends on which slides this question has. */
    private get lastSlideId() {
        const q = this.game.question;
        if (q.answerMode === "choice") return this.slideId("choices");
        // A construction item has no conclusion slide — the conclusion is the
        // thing being built — so its last slide is the last premise.
        if (q.answerMode === "construct") return this.slideId("premise-" + (q.premises.length - 1));
        const count = Array.isArray(q.conclusion) ? q.conclusion.length : 1;
        return this.slideId("conclusion-" + (count - 1));
    }

    /** All-at-once has no slides to wait for, so the form is there from the start. */
    get builderReady() {
        return this.gameMode === "0" || this.reachedEnd;
    }

    private armCarousel() {
        // Before the ids are computed, so this question's slides are all new.
        this.questionToken++;
        const first = this.slideId(this.game.question.setup?.length ? "setup" : "premise-0");
        this.activeSlideId = first;
        // A one-slide question is already at its end and would otherwise never
        // fire a slide event to say so.
        this.reachedEnd = first === this.lastSlideId;
    }

    private resetPicks() {
        this.picks = blankPicks(this.game.question.construct);
        this.armCarousel();
    }

    /**
     * A direction word without its leading "is".
     *
     * These strings double as rendered relation sentences elsewhere, so they
     * carry a verb the dropdown does not need.
     */
    short(option: string) {
        return option.replace(/^is /, "");
    }

    /** Direction dropdown: normal, reversed, or same. */
    pickDirection(claim: number, slot: number, raw: string) {
        // The placeholder option carries "", which must not become 0.
        this.picks[claim][slot].direction = raw === "" ? -1 : Number(raw);
    }

    /** Distance box. Blank or nonsense falls back to one rather than to zero. */
    pickMagnitude(claim: number, slot: number, raw: string) {
        const n = Math.floor(Number(raw));
        this.picks[claim][slot].magnitude = Number.isFinite(n) && n > 0 ? n : 1;
    }

    /**
     * Whether this slot wants a distance right now.
     *
     * Two reasons it might not: the mode is asking for direction only, or the
     * player has said "same", which has no distance to state.
     */
    needsMagnitude(claim: number, slot: number, spec: ConstructSlot) {
        if (!spec.asksDistance) return false;
        const dir = this.picks[claim]?.[slot]?.direction;
        return dir === 0 || dir === 1;
    }

    /** How many slots are still unset, phrased for the button. */
    get slotsLeft() {
        const left = slotsRemaining(this.picks);
        return left === 0 ? "all set" : `${left} left`;
    }

    /** Every direction chosen — until then there is nothing to submit. */
    get constructComplete() {
        return this.picks.length > 0 && slotsRemaining(this.picks) === 0;
    }

    submitConstruction() {
        if (!this.constructComplete) return;
        this.game.checkConstruction(this.picks);
    }

    /**
     * Number keys answer a choice item.
     *
     * Choice mode puts four buttons where two used to be, and hunting for the
     * right one with a mouse spends the time budget on aiming rather than
     * reasoning. Ignored while a verdict is showing, so a late keypress cannot
     * answer the next question before it is read.
     */
    @HostListener("document:keydown", ["$event"])
    onKey(event: KeyboardEvent) {
        if (this.game.question.answerMode !== "choice") return;
        if (this.game.verdict) return;
        if (event.metaKey || event.ctrlKey || event.altKey) return;

        const index = Number(event.key) - 1;
        if (!Number.isInteger(index)) return;
        if (index < 0 || index >= this.game.question.choices.length) return;

        event.preventDefault();
        this.game.checkChoice(index);
    }

    kickTimer = async () => {
        await this.gameTimerService.start(this.timerTimeSeconds);
        this.game.checkQuestion();
    }
}
