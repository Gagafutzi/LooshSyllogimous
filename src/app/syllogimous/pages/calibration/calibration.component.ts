import { Component, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { EnumScreens } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../../constants/settings.constants";
import { ConstructSlot, Question } from "../../models/question.models";
import { canGenerateQuestion } from "../../models/settings.models";
import { GameService } from "../../services/game.service";
import { ProgressionService } from "../../services/progression.service";
import { SettingsOverrideService } from "../../services/settings-override.service";
import {
    AbilityEstimate, CalibrationState, DEFAULT_CALIBRATION, calibrationScore,
    estimateAbility, initCalibration, modeFitsLevel, premisesForLevel, recordAnswer,
    secondsForItem, suggestedSeconds,
} from "../../utils/calibration.utils";
import {
    SlotAnswer, blankPicks, constructionSatisfied, slotsRemaining,
} from "../../utils/construct.utils";
import { itemDifficulty } from "../../utils/rating.utils";

interface Slide {
    label: string;
    html: string;
}

/**
 * Placement test.
 *
 * Finds roughly the right starting level in a dozen items so an experienced
 * player does not have to answer their way up from two.
 *
 * Items are presented the way the hard end of the game is actually played:
 * one premise at a time, no going back, against a deadline. That is not
 * decoration. With the whole set on screen and no clock, premise count measures
 * how long someone is willing to sit and re-read, so the staircase climbed to
 * the ceiling for anyone patient and the resulting placement was unusable.
 *
 * The level is in linear-equivalent premises rather than raw count, and modes
 * drop out of rotation once they stop discriminating — see MODE_SCALE.
 */
@Component({
    selector: "app-calibration",
    templateUrl: "./calibration.component.html",
    styleUrls: ["./calibration.component.css"],
})
export class CalibrationComponent implements OnDestroy {
    config = DEFAULT_CALIBRATION;
    state: CalibrationState = initCalibration(DEFAULT_CALIBRATION);

    question?: Question;
    started = false;
    finished = false;
    estimate?: AbilityEstimate;
    applied = false;
    error = "";

    /** Current item, one slide at a time, forward only. */
    slides: Slide[] = [];
    slideIndex = 0;

    /** Deadline for the item in flight. */
    limitSeconds = 0;
    remainingSeconds = 0;
    private ticker?: ReturnType<typeof setInterval>;

    /** Modes in rotation, so the placement is not read off a single mode. */
    private pool: EnumQuestionType[] = [];
    private poolIndex = 0;
    private shownAt = 0;

    constructor(
        private game: GameService,
        private progression: ProgressionService,
        private overrides: SettingsOverrideService,
        private router: Router,
    ) { }

    ngOnDestroy() { this.stopTimer(); }

    get progressPct() {
        const byTrials = this.state.trials.length / this.config.maxTrials;
        const byReversals = this.state.reversals.length / this.config.targetReversals;
        // Whichever finishes first governs, so the bar never stalls near the end.
        return Math.round(100 * Math.min(1, Math.max(byTrials, byReversals)));
    }

    get timePct() {
        if (!this.limitSeconds) return 0;
        return Math.max(0, Math.min(100, 100 * this.remainingSeconds / this.limitSeconds));
    }

    /** Under a fifth left: worth showing, since there is no going back. */
    get timeCritical() { return this.timePct <= 20; }

    get slide(): Slide | undefined { return this.slides[this.slideIndex]; }
    get atEnd() { return this.slideIndex >= this.slides.length - 1; }

    /**
     * Modes available to the placement.
     *
     * Deliberately ignores which modes the *tier* has unlocked. A placement
     * exists to let someone skip the tier ladder, so reading the pool off that
     * ladder defeats it: a new account has only the one-dimensional modes
     * enabled, so the run would have nothing left to ask above their ceiling
     * and would fall back to twelve-premise left/right chains — the exact
     * failure this is meant to remove.
     *
     * A mode the user has explicitly switched off in Advanced Options is still
     * respected; that is a preference, not a lock.
     */
    private buildPool(): EnumQuestionType[] {
        /*
         * Every mode, unconditionally.
         *
         * It used to respect the per-mode enable switches, which sounds
         * reasonable and is not: someone testing with three modes enabled got a
         * placement measured on three modes, two of them the hardest in the
         * app, with no cross-mode averaging left to steady it. A placement is a
         * measurement of the player, not of their current playlist.
         */
        return Object.values(EnumQuestionType);
    }

    /**
     * Modes that can ask the player to *state* the relation.
     *
     * Construction is what makes a twenty-item placement trustworthy. Judging a
     * claim is a coin flip you can win; stating one is not, so the same number
     * of trials carries far more information. Where a mode cannot do it the run
     * falls back to true/false rather than dropping the mode, since narrowing
     * the pool is the failure this whole method exists to avoid.
     */
    private readonly CONSTRUCTS = new Set<EnumQuestionType>([
        EnumQuestionType.ComparisonNumerical,
        EnumQuestionType.ComparisonChronological,
        EnumQuestionType.LinearVertical,
        EnumQuestionType.LinearHorizontal,
        EnumQuestionType.LinearContains,
        EnumQuestionType.Space3D,
        EnumQuestionType.Space4D,
        EnumQuestionType.Space5D,
        EnumQuestionType.Space6D,
    ]);

    start() {
        this.pool = this.buildPool();

        if (!this.pool.length) {
            this.error = "No question types are enabled.";
            return;
        }

        this.state = initCalibration(this.config);
        this.started = true;
        this.finished = false;
        this.applied = false;
        this.error = "";
        this.nextItem();
    }

    /**
     * Modes worth asking at the current level.
     *
     * Falls back to the whole pool when nothing fits, which happens if only the
     * one-dimensional modes are enabled and the staircase has climbed past their
     * ceiling. The placement is then capped by what those modes can show, but a
     * capped answer beats aborting the run.
     */
    private eligible(level: number): EnumQuestionType[] {
        const fits = this.pool.filter(t =>
            modeFitsLevel(t, level, QUESTION_TYPE_SETTING_PARAMS[t]));
        return fits.length ? fits : this.pool;
    }

    private nextItem() {
        const settings = this.game.settings;
        const level = this.state.level;
        const candidates = this.eligible(level);

        // Try each candidate in turn: a generator can fail on a given draw, and
        // giving up on the first miss would end the run.
        for (let attempt = 0; attempt < candidates.length; attempt++) {
            const type = candidates[this.poolIndex % candidates.length];
            this.poolIndex++;

            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            const premises = premisesForLevel(type, level, params);

            if (!canGenerateQuestion(type, premises, settings)) continue;

            try {
                /*
                 * Built with the override layer suppressed and construction
                 * forced where the mode supports it. MODE_SCALE's weights
                 * describe unmodified modes, so an item carrying whatever the
                 * player last switched on in Advanced Options is measured on a
                 * scale that does not apply to it.
                 */
                const q = this.overrides.suppress(() => this.progression.suppress(() => {
                    // Direction only: exact distances are a separate skill the
                    // game earns much later, and placing someone against
                    // something harder than the levels they are being placed
                    // into is the mismatch this test already had once.
                    this.game.forceConstruction = this.CONSTRUCTS.has(type) ? "direction" : "off";
                    try {
                        return this.game.getCreateFn(type, premises)?.();
                    } finally {
                        this.game.forceConstruction = "off";
                    }
                }));
                if (!q) continue;
                this.present(q, level);
                return;
            } catch { /* try the next mode */ }
        }

        this.error = "Could not generate an item at this level.";
        this.finish();
    }

    /** Lay the question out as forward-only slides and start its clock. */
    private present(q: Question, level: number) {
        this.question = q;
        this.slides = this.buildSlides(q);
        this.slideIndex = 0;

        this.picks = blankPicks(q.construct);
        this.limitSeconds = secondsForItem(level, q.premises.length, this.config);
        this.remainingSeconds = this.limitSeconds;
        this.shownAt = Date.now();
        this.startTimer();
    }

    private buildSlides(q: Question): Slide[] {
        const slides: Slide[] = [];

        const preamble = [...(q.instructions ?? []), ...(q.notes ?? [])];
        if (preamble.length) {
            slides.push({ label: "Instructions", html: preamble.join("<br>") });
        }

        q.premises.forEach((p, i) => slides.push({
            label: i === q.premises.length - 1 ? "Last premise" : `Premise ${i + 1}`,
            html: p,
        }));

        // A construction item's conclusion is the thing being built, so it is
        // rendered under the slides rather than as one.
        if (q.answerMode !== "construct") {
            const conclusions = Array.isArray(q.conclusion) ? q.conclusion : [q.conclusion];
            conclusions.forEach((c, i) => slides.push({
                label: conclusions.length > 1 ? `Conclusion ${i + 1}` : "Conclusion",
                html: c,
            }));
        }

        return slides;
    }

    /** Forward only — the whole point is that a premise gets one viewing. */
    next() {
        if (!this.atEnd) this.slideIndex++;
    }

    private startTimer() {
        this.stopTimer();
        this.ticker = setInterval(() => {
            this.remainingSeconds = Math.max(0,
                this.limitSeconds - Math.round((Date.now() - this.shownAt) / 1000));
            if (this.remainingSeconds <= 0) this.answer(null);
        }, 250);
    }

    private stopTimer() {
        if (this.ticker) clearInterval(this.ticker);
        this.ticker = undefined;
    }

    /** Construction answers, one direction-and-distance per slot per claim. */
    picks: SlotAnswer[][] = [];

    pickDirection(claim: number, slot: number, raw: string) {
        this.picks[claim][slot].direction = raw === "" ? -1 : Number(raw);
    }

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

    short(option: string) { return option.replace(/^is /, ""); }

    get slotsLeft() {
        const left = slotsRemaining(this.picks);
        return left === 0 ? "all set" : `${left} left`;
    }

    get constructComplete() {
        return this.picks.length > 0 && slotsRemaining(this.picks) === 0;
    }

    /**
     * A construction answer is right only if every slot of every claim is.
     *
     * No partial credit, for the reason the mode exists: the guess floor is the
     * product of the slot counts, and crediting a near miss would hand most of
     * that back.
     */
    submitConstruction() {
        if (!this.constructComplete || !this.question) return;
        const right = constructionSatisfied(this.question.construct, this.picks);
        this.answer(right ? "construct-right" : "construct-wrong");
    }

    /** `null` means the clock ran out, which counts against the player. */
    answer(value: boolean | null | "construct-right" | "construct-wrong") {
        if (!this.question || this.finished) return;
        this.stopTimer();

        const timedOut = value === null;
        // A timeout cost the full budget; anything else cost what it took.
        const seconds = timedOut
            ? this.limitSeconds
            : (Date.now() - this.shownAt) / 1000;
        const correct = typeof value === "string"
            ? value === "construct-right"
            : !timedOut && value === this.question.isValid;

        this.state = recordAnswer(this.state, this.config, correct, seconds);

        if (this.state.done) this.finish();
        else this.nextItem();
    }

    private finish() {
        this.stopTimer();
        this.finished = true;
        this.question = undefined;
        this.slides = [];
        this.estimate = estimateAbility(this.state, this.config);
    }

    /**
     * Starting points, on the same scale the live rating uses.
     *
     * Computed from the placement rather than awarded flat, so a player who
     * reached level 8 quickly starts above one who laboured to the same level.
     */
    get score(): number {
        return this.estimate ? calibrationScore(this.estimate, itemDifficulty) : 0;
    }

    /** What the placement works out to in each mode, for the result screen. */
    get placements(): { type: string; premises: number }[] {
        if (!this.estimate) return [];
        const level = this.estimate.level;
        return this.pool.map(type => ({
            type,
            premises: premisesForLevel(type, level, QUESTION_TYPE_SETTING_PARAMS[type]),
        }));
    }

    /** Writes the placement into every enabled mode's ladder. */
    apply() {
        if (!this.estimate) return;
        const seconds = suggestedSeconds(this.estimate, this.progression.config.ceilingSeconds);
        this.progression.applyCalibration(this.estimate.level, seconds);

        // Replaces the score outright rather than adding: this is a placement,
        // and adding would reward retaking the test.
        this.game.score = this.score;
        this.applied = true;
    }

    play() {
        this.router.navigate([EnumScreens.Start]);
    }

    retake() {
        this.stopTimer();
        this.started = false;
        this.finished = false;
        this.estimate = undefined;
        this.applied = false;
    }
}
