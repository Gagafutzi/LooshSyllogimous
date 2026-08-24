import { Component, HostListener, ViewChild } from '@angular/core';
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
import { SlotAnswer, blankPicks, compareConstruction, slotsRemaining } from '../../utils/construct.utils';
import { KeybindService, keyLabel } from '../../services/keybind.service';
import { slideNames, stepSlide } from '../../utils/slides.utils';
import { ProgressAndPerformanceService } from '../../services/progress-and-performance.service';

@Component({
    selector: 'app-game',
    templateUrl: './game.component.html',
    styleUrls: ['./game.component.css']
})
export class GameComponent {
    Array = Array;
    EnumScreens = EnumScreens;

    /**
     * Whether today's goal has been reached, and so whether there is a way out.
     *
     * The stream stays endless — nothing here stops or interrupts play, which
     * is the point of an arcade. What reaching the goal buys is a *stopping
     * point*: a button that was not there before, offering the day's summary.
     * An app with no end and no marker of having done anything is one you stop
     * playing for no reason and start again for none either.
     *
     * Recomputed when an answer lands rather than continuously, since the only
     * thing that can change it is an answer.
     */
    goalMet = false;

    refreshGoal() {
        // The daily goal that has always been in Settings, in minutes, tracked
        // per day by the service that has always tracked it. Nothing here
        // invents a second goal for the button to answer to.
        const today = this.progress.getToday();
        this.goalMet = this.progress.calcDailyProgress(today) >= 100;
    }

    /**
     * The answer just given, dimension by dimension.
     *
     * The same rows History has shown for a while, moved to where they are
     * actually useful. A player reviewing a wrong seven-dimension answer needs
     * to know *which* dimension while the item is still in front of them;
     * finding out days later in History is finding out about a different item.
     *
     * `compareConstruction` is the one judge — the same call the result rows,
     * the ability model and the history page all read, so none of them can
     * disagree about which slot was right.
     */
    breakdown() {
        const q = this.game.question;
        if (!q || q.answerMode !== "construct" || !q.construct?.length) return null;
        return compareConstruction(q.construct, q.userConstruct);
    }
    
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
        public keys: KeybindService,
        public router: Router,
        private progress: ProgressAndPerformanceService,
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
     * Click-to-advance. Ignores clicks on real controls so the answer buttons
     * and nav do not also step the carousel.
     */
    onSlideAreaClick(event: Event) {
        if (this.carouselAdvance !== 'click') return;
        if ((event.target as HTMLElement)?.closest('button, a, input, select, textarea')) return;
        this.step(1);
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
        const ladderSeconds = this.game.question.playgroundMode
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

                /*
                 * Budget = typical time for this shape of item, plus headroom.
                 *
                 * Two things were wrong. The budget *was* the mean of the last
                 * ten answers, and a mean is the middle of a distribution — so
                 * about half of all answers ran out of clock by construction.
                 * And the adjustments were seconds multiplied by raw counts, so
                 * ten correct in a row cut five seconds off a mode whose whole
                 * budget might be eight, with a floor of zero underneath.
                 *
                 * Now the mean gets a headroom multiplier, the adjustments are
                 * proportions of that budget rather than absolute seconds, and
                 * nothing can drop below a floor a human can actually read the
                 * premises in.
                 */
                const HEADROOM = 1.6;
                const MIN_SECONDS = 12;
                /* Fractions of the budget, not seconds. */
                const correctTighten = 0.25;
                const incorrectLoosen = 0.3;
                const timeoutLoosen = 0.5;
                const newLevelBonus = 15;
                const negationBonus = 3;
                const metaRelationBonus = 4;
                this.timerTimeSeconds = 90;

                const questionType = this.game.question.type;
                const questionPremises = this.game.question.premises.length;
                const { typeBasedStats } = this.statsService.calcStats(this.timerType);
                const tbs = typeBasedStats[questionType];

                /** Budget from one premise-count bucket, or null if too thin to trust. */
                const budgetFrom = (st: any): number | null => {
                    const n = st?.last10Count || 0;
                    if (!st || n < 1) return null;
                    const mean = (st.last10Sum / 1000) / n;
                    if (!isFinite(mean) || mean <= 0) return null;
                    const scale = 1
                        - correctTighten * (st.last10Correct / n)
                        + incorrectLoosen * (st.last10Incorrect / n)
                        + timeoutLoosen * (st.last10Timeout / n);
                    return mean * HEADROOM * scale;
                };

                if (tbs?.stats) {
                    const prevStats = (tbs.stats as any)[questionPremises - 1];
                    const currStats = (tbs.stats as any)[questionPremises];

                    let budget: number | null = null;
                    if (currStats && currStats.count > 2) {
                        budget = budgetFrom(currStats);
                    } else if (prevStats && prevStats.count > 2) {
                        const shorter = budgetFrom(prevStats);
                        // One premise longer than anything measured, so pay for
                        // the extra step as well as the unfamiliarity.
                        if (shorter != null) budget = shorter + newLevelBonus;
                    }

                    if (budget != null) {
                        budget += negationBonus * this.game.question.negations;
                        budget += metaRelationBonus * this.game.question.metaRelations;
                        this.timerTimeSeconds = Math.floor(Math.max(MIN_SECONDS, budget));
                    }
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
        this.refreshGoal();

        // Auto-advance replaces the question in place, so the screen has to
        // re-arm itself rather than relying on a fresh component.
        this.questionSub = this.game.questionChanged.subscribe(() => {
            this.gameTimerService.stop();
            this.trueButtonToTheRight = Math.random() > 0.5;
            this.resetPicks();
            this.startTimerForQuestion();
            // The item that just left is the one that may have met the goal.
            this.refreshGoal();
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
        clearInterval(this.carouselTimerHandle);
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
    private reachedEnd = false;

    /**
     * Which slide is showing, by name.
     *
     * Names rather than generated ids, and no per-question token. The token
     * existed only to make `ngb-carousel` let go of a slide id it was still
     * holding from the previous question — a workaround for a component that is
     * no longer here.
     */
    activeSlide = "";

    /** How the skip key reads, for the button that says so. */
    get skipKeyLabel() {
        const key = this.keys.binds.submit;
        return key ? keyLabel(key) : "";
    }

    private show(name: string) {
        this.activeSlide = name;
        if (name === this.slideOrder[this.slideOrder.length - 1]) this.reachedEnd = true;
    }

    /**
     * The index carried by the active slide's name, or -1.
     *
     * `premise-3` and `conclusion-0` are the only slides there can be several
     * of, and the template needs to know which one without a second source of
     * truth about the order.
     */
    slideIndexOf(prefix: string): number {
        return this.activeSlide.startsWith(prefix)
            ? Number(this.activeSlide.slice(prefix.length))
            : -1;
    }

    conclusionAt(i: number) {
        const c = this.game.question.conclusion;
        return Array.isArray(c) ? c[i] : c;
    }

    conclusionLabel(i: number) {
        const c = this.game.question.conclusion;
        if (!Array.isArray(c)) return "Conclusion";
        return i === c.length - 1 ? "Last conclusion" : `Conclusion ${i + 1}`;
    }

    /**
     * Every slide this question has, in the order they are meant to be read.
     *
     * ngb-carousel decides `next()` from its own `ContentChildren` list, and
     * that list is assembled from four separate structural blocks — an `*ngIf`
     * setup, an `*ngIf` webs slide, an `*ngFor` over premises, and an `*ngIf`
     * pair for the ending. Its order is whatever those views happened to be
     * created in, which is how a carousel ended up going premise 2, premise 1,
     * last premise, premise 3. Stepping is driven from this array instead, so
     * reading order is stated once and cannot drift from the template.
     */
    slideOrder: string[] = [];

    private buildSlideOrder() {
        // The order lives in `slides.utils`, where its contract is tested.
        this.slideOrder = slideNames(this.game.question);
    }

    /**
     * Move by one slide, clamped at both ends.
     *
     * Deliberately not wrapping: reaching the end is what unlocks answering in
     * the carousel modes, and wrapping round to the first premise again made
     * that a lap counter rather than a position.
     */
    step(delta: number) {
        if (!this.slideOrder.length) return;
        this.show(stepSlide(this.slideOrder, this.activeSlide, delta));
    }

    /** All-at-once has no slides to wait for, so the form is there from the start. */
    get builderReady() {
        return this.gameMode === "0" || this.reachedEnd;
    }

    private armCarousel() {
        this.buildSlideOrder();
        this.activeSlide = this.slideOrder[0] ?? "";
        // A one-slide question is already at its end and would otherwise never
        // fire a slide event to say so.
        this.reachedEnd = this.slideOrder.length <= 1;
        this.armCarouselTimer();
    }

    private carouselTimerHandle?: any;

    /**
     * Timed advance, driven here rather than by the carousel's own `interval`.
     *
     * The same reason as `step`: the carousel's auto-advance walks its content
     * list, which is the order being replaced.
     */
    private armCarouselTimer() {
        clearInterval(this.carouselTimerHandle);
        if (this.carouselAdvance !== "timer") return;
        this.carouselTimerHandle = setInterval(
            () => this.step(1), Math.max(1, this.carouselSeconds) * 1000);
    }

    /* ---------------- structure matching ---------------- */

    /**
     * Nodes pointed at in the second web, in the order they were pointed at.
     *
     * Held here rather than on the question so that a redraw cannot lose them
     * and an unfinished answer is never mistaken for a submitted one.
     */
    mapPicks: number[] = [];

    /**
     * Pointing at a node adds it; pointing at one already chosen takes it back
     * out, along with everything after it.
     *
     * Removing the tail rather than closing the gap is the honest behaviour: the
     * order is part of the answer, so silently promoting the later picks would
     * change claims the player never revisited.
     */
    onWebPick(node: number) {
        if (this.game.question.answerMode !== "map") return;

        const at = this.mapPicks.indexOf(node);
        if (at >= 0) {
            this.mapPicks = this.mapPicks.slice(0, at);
        } else if (this.mapPicks.length < this.game.question.mapTargets.length) {
            this.mapPicks = [...this.mapPicks, node];
        }
        this.showPicks();
    }

    /**
     * Mirror the picks onto the drawn web, which is what colours them.
     *
     * Mutated in place, deliberately. Replacing the array — or the web object
     * inside it — makes `*ngFor` destroy and rebuild a component that lives
     * *inside a carousel slide*, and ngb-carousel re-picks its active slide
     * whenever its content children churn. Every tap therefore threw the reader
     * back to the first slide, which is a mode that does not work in carousel.
     */
    private showPicks() {
        const second = this.game.question.webs?.[1];
        if (second) second.picked = [...this.mapPicks];
        this.webRedraw++;
    }

    /**
     * Bumped on every pick, purely to give the drawing a changed input.
     *
     * The web object is mutated rather than replaced, so an `@Input` bound to
     * it never sees a new reference; this is the changed reference, and it
     * costs nothing structural.
     */
    webRedraw = 0;

    get mapComplete() {
        return this.game.question.answerMode === "map"
            && this.mapPicks.length === this.game.question.mapTargets.length;
    }

    submitMapping() {
        if (!this.mapComplete || !this.builderReady) return;
        this.game.checkMapping(this.mapPicks);
    }

    private resetPicks() {
        this.mapPicks = [];
        this.webRedraw = 0;
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
     * Playing from the keyboard.
     *
     * The answer buttons swap sides between questions on purpose, so the mouse
     * is a poor instrument here — you cannot aim until you have read, and the
     * aiming comes out of the time budget. Up and down mean the same thing
     * whatever the buttons are doing.
     *
     * Number keys still answer a choice item directly: four buttons is more
     * hunting than two, and 1–4 is faster than any binding could be.
     */
    @HostListener("document:keydown", ["$event"])
    onKey(event: KeyboardEvent) {
        // Never while a verdict is up: a late keypress would answer the next
        // question before it has been read.
        if (this.game.verdict) return;

        // Typing in the conclusion builder is typing, not playing.
        const target = event.target as HTMLElement | null;
        if (target?.closest("input, select, textarea")) return;

        if (this.game.review.length) {
            // The one thing worth doing while the explanation is up.
            if (this.keys.actionFor(event) === "submit") {
                event.preventDefault();
                this.game.dismissReview();
            }
            return;
        }

        if (this.game.question.answerMode === "choice") {
            const index = Number(event.key) - 1;
            if (Number.isInteger(index) && index >= 0 && index < this.game.question.choices.length) {
                event.preventDefault();
                this.game.checkChoice(index);
                return;
            }
        }

        const action = this.keys.actionFor(event);
        if (!action) return;

        switch (action) {
            case "answerTrue":
                if (this.game.question.answerMode === "construct") {
                    // The same key submits what has been built: on that mode
                    // there is no true or false to press, and a second binding
                    // for "the affirmative action" would be one to remember.
                    if (this.constructComplete) { event.preventDefault(); this.submitConstruction(); }
                    return;
                }
                if (this.game.question.answerMode !== "boolean") return;
                event.preventDefault();
                this.game.checkQuestion(true);
                return;

            case "answerFalse":
                if (this.game.question.answerMode !== "boolean") return;
                event.preventDefault();
                this.game.checkQuestion(false);
                return;

            case "next":
                if (this.gameMode === "0") return;
                event.preventDefault();
                this.step(1);
                return;

            case "prev":
                // Game mode 2 is the no-going-back carousel; the button is
                // disabled there, and the key must not be a way around it.
                if (this.gameMode === "0" || this.gameMode === "2") return;
                event.preventDefault();
                this.step(-1);
                return;
        }
    }

    kickTimer = async () => {
        // Only a clock that actually ran out is a timeout. Stopping it — which
        // answering now does — used to look identical from here.
        const elapsed = await this.gameTimerService.start(this.timerTimeSeconds);
        if (elapsed) this.game.checkQuestion();
    }
}
