import { Injectable } from "@angular/core";
import { ConstructClaim, IArrangementPremise, IDirection3DProposition, IDirectionProposition, Question } from "../models/question.models";
import { coinFlip, getCircularWays, getLinearWays, getRandomSymbols, getRelation, getSymbols, isPremiseLikeConclusion, createMetaRelationships, metarelateArrangement, pickUniqueItems, horizontalShuffleArrangement, shuffle, interpolateArrangementRelationship, fixBinaryInstructions, areGraphsIsomorphic } from "../utils/question.utils";
import { generatePolysyllogism, formatSylPremise, getRandomRuleValid, getRandomRuleInvalid, getSyllogism } from "../utils/syllogism.utils";
import { allCoords, answerFor, buildDeicticSpec, coordKey, reversalTextFor, statementFor, verifyAnswer } from "../utils/deictic.utils";
import { CoordMap, Transform, TransformKind, describeConclusion, describeOffset, describeTransform, drawTransforms, replay } from "../utils/transformations.utils";
import {
    LINEAR_SCALES, LinearLayout, LinearScale, buildBranching, buildChain, buildConclusion,
    buildConclusionSet, buildConstructClaim, compare, explainLinear, hasTies, pickDistantPair,
    renderPremises, vocabFor,
} from "../utils/linear.utils";
import {
    HierarchyLayout, buildHierarchy, buildHierarchyQuerySet, explainHierarchy, pickHierarchyQuery,
    renderHierarchyConclusion, renderHierarchyPremise,
} from "../utils/hierarchy.utils";
import {
    AxisSpec, NdLayout, applyNdEdits, applyNdTransforms, axesForDimensions, buildNdAnalogy,
    buildNdAnalogySet, buildNdConclusion, buildNdConclusionSet, buildNdConstructClaim,
    buildNdLayout, compareOn, describeNdAxes, displacementOn, drawNdEdits, drawNdTransforms,
    explainNdAxis,
    isCircular, mod, ndTransformVocab,
    pickDistantPair as pickDistantPairNd, renderNdEdit, renderNdPremises,
} from "../utils/ndspace.utils";
import { ANCHORS, anchorCoordMap } from "../utils/anchor.utils";
import { scrambleByFactor, scrambleLeading } from "../utils/premise-order.utils";
import { NUMBER_WORDS } from "../constants/question.constants";
import { EnumScreens, EnumTiers, ORDERED_QUESTION_TYPES, ORDERED_TIERS, TIER_SCORE_ADJUSTMENTS, TIER_SCORE_RANGES, TIERS_MATRIX } from "../constants/game.constants";
import { LS_DONT_SHOW, LS_HISTORY, LS_SCORE, LS_SKIP_TUTORIALS, LS_TIMER } from "../constants/local-storage.constants";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { ModalLevelChangeComponent } from "../components/modal-level-change/modal-level-change.component";
import { Router } from "@angular/router";
import { canGenerateQuestion, QuestionSettings, Settings } from "../models/settings.models";
import { ProgressAndPerformanceService } from "./progress-and-performance.service";
import { LinearFeatureFlags, SettingsOverrideService } from "./settings-override.service";
import { ProgressionService } from "./progression.service";
import { ToastService } from "src/app/services/toast.service";
import { Subject } from "rxjs";
import { SlotAnswer, constructionSatisfied } from "../utils/construct.utils";
import { applyResult, itemDifficulty } from "../utils/rating.utils";
import { guid } from "src/app/utils/uuid";
import { EnumArrangements, EnumQuestionType } from "../constants/question.constants";
import { EnumQuestionGroup, QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { Logger } from "../utils/logger";
import { GameTimerService } from "./game-timer.service";
import { getSyllogismGeneratorValue, SyllogismGenerator } from "../pages/settings/game-mode-choose/game-mode-choose.component";
import { neg, subj } from "../utils/phrasing";
import { createAnalogy } from "../generators/analogy";
import { createAnchorSpace, createAnchorSpaceV2 } from "../generators/anchor";
import { createArrangement } from "../generators/arrangement";
import { createBinary } from "../generators/binary";
import { createDeictic } from "../generators/deictic";
import { createDirection, createDirection3D } from "../generators/direction";
import { createDistinction } from "../generators/distinction";
import { createGraphMatching } from "../generators/graph-matching";
import { createHierarchy } from "../generators/hierarchy";
import { createComparison, createLinear } from "../generators/linear";
import { createNdSpace } from "../generators/ndspace";
import { createSyllogism } from "../generators/syllogism";
import { createTransformation } from "../generators/transformation";
import { createInferRelation } from "../generators/infer-relation";
import { createOddestRelation } from "../generators/oddest-relation";
import { createShapeRotation } from "../generators/shape-rotation";
import { createRelationalWeb } from "../generators/relational-web";
import { createStimulusFunction } from "../generators/stimulus-function";
import { GeneratorContext } from "../generators/context";

/**
 * Stated whenever a conclusion has to be *built*.
 *
 * Judging a claim only needs the direction, which the premises give directly.
 * Stating one needs the distance too, and that is only derivable if the reader
 * knows each premise is worth exactly one step. It is true of every layout the
 * engines produce — but true and *known* are different things, and an item
 * whose answer cannot be derived from what the player was shown is not an item.
 */


@Injectable({
    providedIn: "root"
})
export class GameService implements GeneratorContext {
    /**
     * Emitted whenever a new question is ready.
     *
     * Auto-advance keeps the player on /Game, and Angular reuses a component
     * when the route does not change — so ngOnInit would never fire again and
     * the countdown would not restart. The screen listens to this instead.
     */
    questionChanged = new Subject<void>();

    /** Last item's rating value and movement, for display. */
    lastItemDifficulty = 0;
    lastRatingDelta = 0;

    /** Shown briefly between questions; null when nothing to announce. */
    verdict: "correct" | "wrong" | "timeout" | null = null;

    /** The derivation for an item just got wrong; empty means move straight on. */
    review: string[] = [];

    dismissReview() {
        this.review = [];
        this.play(true, true);
    }

    /**
     * Force construction answering, whatever the ladder and overrides say.
     *
     * Set by the placement test for the length of one item. It cannot go
     * through the override layer, because the placement suppresses that layer
     * wholesale — the point being to measure the mode rather than the player's
     * current settings.
     *
     * "direction" is the easy form. A placement uses it deliberately: exact
     * distances are a separate skill the game only asks for at a high rung, and
     * measuring against something harder than the levels being placed into is
     * the mismatch this test already had once.
     */
    forceConstruction: "off" | "direction" | "distance" = "off";

    _score = 0;
    history: Question[] = [];
    question;
    playgroundSettings?: Settings;
    logger = new Logger("info", true);

    /**
     * Skill, derived rather than accumulated.
     *
     * With progression on this is the precision-weighted ability across modes,
     * recomputed from the posteriors every read. That is the substantive change:
     * the old number was a running total of answers given, so it only ever rose
     * and grinding easy items raised it as fast as anything else. A derived
     * number falls when you stop, falls when you answer below your level, and
     * cannot be farmed — answering easy items *is* evidence that ability is low.
     *
     * The stored total is still kept up to date underneath, so turning
     * progression off returns you to exactly the score you had.
     */
    get score() {
        if (this.progressionService.config.enabled && this.progressionService.config.derivedScore) {
            return this.progressionService.skillPoints;
        }
        return this._score;
    }

    set score(value: number) {
        this._score = value;
        localStorage.setItem(LS_SCORE, JSON.stringify(value));
    }

    /** The accumulated total, regardless of what is being displayed. */
    private get rawScore() { return this._score; }
    private set rawScore(value: number) {
        this._score = value;
        localStorage.setItem(LS_SCORE, JSON.stringify(value));
    }

    get tier() {
        for (const tier of Object.values(EnumTiers)) {
            const range = TIER_SCORE_RANGES[tier];
            if (this.score >= range.minScore && this.score <= range.maxScore) {
                return tier as EnumTiers;
            }
        }
        return EnumTiers.Peasant;
    }

    get settings() {
        if (this.playgroundSettings) return this.playgroundSettings;
        // Precedence: tier -> user overrides -> progression. Each layer is a
        // no-op unless opted in, so stock behaviour survives all three.
        const tierSettings = this.getSettingsFromTier(this.tier);
        return this.progressionService.applyTo(this.settingsOverrideService.applyTo(tierSettings));
    }

    get questions() {
        let questions: Question[] = [];
        const history = localStorage.getItem(LS_HISTORY);
        if (history) {
            questions = JSON.parse(history).slice(0, 1000);
        }
        return questions;
    }

    constructor(
        private modalService: NgbModal,
        private router: Router,
        private progressAndPerformanceService: ProgressAndPerformanceService,
        public settingsOverrideService: SettingsOverrideService,
        public progressionService: ProgressionService,
        private toastService: ToastService,
        private gameTimerService: GameTimerService,
    ) {
        this.loadScore();
        (window as any).syllogimous = this;

        // Create a first dummy question to avoid null pointer etc...
        const firstDummyQuestion = createSyllogism(this, 2);
        firstDummyQuestion.conclusion = "!";
        this.question = firstDummyQuestion;
    }

    loadScore() {
        const lsScore = localStorage.getItem(LS_SCORE);
        if (lsScore) {
            this.score = JSON.parse(lsScore);
        }
    }

    pushIntoHistory(question: Question) {
        localStorage.setItem(LS_HISTORY, JSON.stringify([question, ...this.questions]));
    }

    /** Given an EnumTiers value construct a Settings instance */
    getSettingsFromTier(tier: EnumTiers) {
        const tierIdx = ORDERED_TIERS.findIndex(_tier => _tier === tier);
        const settings = new Settings();

        settings.setEnable("negation", false);
        settings.setEnable("meta", false);

        for (let i = 0; i < TIERS_MATRIX[tierIdx].length; i++) {
            const questionType = ORDERED_QUESTION_TYPES[i];
            const isActive = !!TIERS_MATRIX[tierIdx][i];
            const numOfPremises = this.progressAndPerformanceService.getTrainingUnit(questionType).premises;
            settings.setQuestionSettings(questionType, isActive, numOfPremises);
        }

        if (tierIdx > 5) {
            settings.setEnable("negation", true);
        }

        if (tierIdx > 6) {
            settings.setEnable("meta", true);
        }

        return settings;
    }

    /** Given question type and number of premises, returns a question creator function */
    getCreateFn(questionType: EnumQuestionType, numOfPremises: number) {
        const creator = {
            [EnumQuestionType.Distinction]: () => createDistinction(this, numOfPremises),
            [EnumQuestionType.ComparisonNumerical]: () => createComparison(this, numOfPremises, EnumQuestionType.ComparisonNumerical),
            [EnumQuestionType.ComparisonChronological]: () => createComparison(this, numOfPremises, EnumQuestionType.ComparisonChronological),
            [EnumQuestionType.LinearVertical]: () => createLinear(this, numOfPremises, EnumQuestionType.LinearVertical),
            [EnumQuestionType.LinearHorizontal]: () => createLinear(this, numOfPremises, EnumQuestionType.LinearHorizontal),
            [EnumQuestionType.LinearContains]: () => createLinear(this, numOfPremises, EnumQuestionType.LinearContains),
            [EnumQuestionType.Syllogism]: () => createSyllogism(this, numOfPremises),
            [EnumQuestionType.LinearArrangement]: () => createArrangement(this, numOfPremises, EnumQuestionType.LinearArrangement),
            [EnumQuestionType.CircularArrangement]: () => createArrangement(this, numOfPremises, EnumQuestionType.CircularArrangement),
            [EnumQuestionType.Direction]: () => createDirection(this, numOfPremises),
            [EnumQuestionType.Direction3DSpatial]: () => createDirection3D(this, numOfPremises, EnumQuestionType.Direction3DSpatial),
            [EnumQuestionType.Direction3DTemporal]: () => createDirection3D(this, numOfPremises, EnumQuestionType.Direction3DTemporal),
            [EnumQuestionType.Space3D]: () => createNdSpace(this, numOfPremises, EnumQuestionType.Space3D),
            [EnumQuestionType.Space4D]: () => createNdSpace(this, numOfPremises, EnumQuestionType.Space4D),
            [EnumQuestionType.Space5D]: () => createNdSpace(this, numOfPremises, EnumQuestionType.Space5D),
            [EnumQuestionType.Space6D]: () => createNdSpace(this, numOfPremises, EnumQuestionType.Space6D),
            [EnumQuestionType.GraphMatching]: () => createGraphMatching(this, numOfPremises),
            [EnumQuestionType.Hierarchy]: () => createHierarchy(this, numOfPremises),
            [EnumQuestionType.Analogy]: () => createAnalogy(this, numOfPremises),
            [EnumQuestionType.Binary]: () => createBinary(this, numOfPremises),
            [EnumQuestionType.Deictic]: () => createDeictic(this, numOfPremises),
            [EnumQuestionType.Transformation]: () => createTransformation(this, numOfPremises),
            [EnumQuestionType.AnchorSpace]: () => createAnchorSpace(this, numOfPremises),
            [EnumQuestionType.AnchorSpaceV2]: () => createAnchorSpaceV2(this, numOfPremises),
            [EnumQuestionType.InferRelation]: () => createInferRelation(this, numOfPremises),
            [EnumQuestionType.OddestRelation]: () => createOddestRelation(this, numOfPremises),
            [EnumQuestionType.ShapeRotation]: () => createShapeRotation(this, numOfPremises),
            [EnumQuestionType.RelationalWeb]: () => createRelationalWeb(this, numOfPremises),
            [EnumQuestionType.StimulusFunction]: () => createStimulusFunction(this, numOfPremises),
        }[questionType];

        if (!creator) return creator;

        /*
         * Wrap so the progression layer knows which mode is being built. The
         * settings getter runs repeatedly *inside* the generator, and the scope
         * is cleared afterwards so anything reading settings outside generation
         * still sees the union.
         */
        return () => {
            this.progressionService.scopeTo(questionType);
            try {
                return creator();
            } finally {
                this.progressionService.scopeTo(undefined);
            }
        };
    }

    /** The GeneratorContext setting; read here so no generator touches storage. */
    get syllogismGenerator() { return getSyllogismGeneratorValue(); }

    /**
     * The GeneratorContext capability. Binary composes two other questions and
     * is the only generator that needs one.
     */
    random(numOfPremises?: number, basic?: boolean) {
        return this.createRandomQuestion(numOfPremises, basic);
    }

    /** Return a random question based on the current settings */
    createRandomQuestion(numOfPremises?: number, basic?: boolean) {
        const settings = this.settings;
        this.logger.info("Settings", settings);

        this.logger.info("Training units", this.progressAndPerformanceService.getAllTrainingUnits());

        const typeSettingTuples = Object.entries(settings.question) as [EnumQuestionType, QuestionSettings][];
        const getQuestionGroup = (qg?: EnumQuestionGroup) => typeSettingTuples.filter(([qt, qs]) => qs.group == qg);
        const groupsOfQuestions = [
            getQuestionGroup(undefined),
            getQuestionGroup(EnumQuestionGroup.Comparison),
            getQuestionGroup(EnumQuestionGroup.Direction),
            getQuestionGroup(EnumQuestionGroup.Arrangement),
        ];

        const choices: Array<() => Question> = [];

        // Pick one question from each group so that the distribution is uniform
        // The "isUndefinedGroup" predicate is used to push all ungrouped question into choices
        for (const grouped of groupsOfQuestions) {
            const isUndefinedGroup = grouped === groupsOfQuestions[0];
            const groupChoices: Array<() => Question> = isUndefinedGroup ? choices : [];
            for (const [qt, qs] of grouped) {
                const shouldIncludeQuestion = (basic == undefined) ? true : qs.basic === basic;
                if (qs.enabled && shouldIncludeQuestion) {
                    groupChoices.push(this.getCreateFn(qt, qs.clampNumOfPremises(numOfPremises || qs.getNumOfPremises())));
                }
            }
            if (!isUndefinedGroup && groupChoices.length) {
                choices.push(pickUniqueItems(groupChoices, 1).picked[0]);
            }
        }

        if (!choices.length) {
            this.logger.warn("NO CHOICES AVAILABLE!");
        }

        /*
         * A generator may legitimately fail: some configurations cannot be
         * satisfied, and the answer is to build a different item rather than to
         * end the session. Picking once and calling it made every such failure
         * fatal, which is a fragility worth removing for every mode and not just
         * the one that exposed it.
         *
         * Order is a shuffle rather than repeated random picks, so the first
         * choice stays uniform and the rest are fallbacks that are each tried
         * once.
         */
        let lastError: unknown;
        for (const make of shuffle([...choices])) {
            try {
                const question = make();
                this.logger.info("Random question", question);
                return question;
            } catch (e) {
                lastError = e;
                this.logger.warn("Generator failed, trying another mode", e);
            }
        }
        throw lastError ?? new Error("Cannot generate.");
    }

    skipIntro(dontShowAnymore: boolean) {
        if (dontShowAnymore) {
            localStorage.setItem(LS_DONT_SHOW + EnumScreens.Intro, "1")
        }
        this.router.navigate([EnumScreens.Start]);
    }

    /**
     * @param suppressTutorial skip the first-time tutorial for this mode.
     *
     * Auto-advance between questions must never land on a tutorial: the point of
     * it is that no input is required, and a tutorial demands a click. The gate
     * belongs when a mode is entered deliberately, not mid-drill.
     */
    /** Whether the player has opted out of tutorials for every mode. */
    get skipAllTutorials() {
        return localStorage.getItem(LS_SKIP_TUTORIALS) === "1";
    }

    set skipAllTutorials(value: boolean) {
        if (value) localStorage.setItem(LS_SKIP_TUTORIALS, "1");
        else localStorage.removeItem(LS_SKIP_TUTORIALS);
    }

    /**
     * Tier changes, announced without stopping the session.
     *
     * This used to open a modal and halt the timer. That was survivable while
     * tier came from a flat accumulator crossing a 250-point band; it is not now
     * that tier follows the ability estimate, which moves continuously and
     * wobbles — a posterior sitting near a boundary would re-open the dialog
     * every few answers.
     *
     * Two changes: a toast instead of a modal, and hysteresis. A crossing is
     * only announced once the score is clearly inside the new band, so drifting
     * back and forth over the line says nothing at all.
     */
    private announcedTier?: EnumTiers;

    /** Points a score must be inside a band before the crossing is announced. */
    private static readonly TIER_MARGIN = 60;

    private announceTier(previous: EnumTiers) {
        const next = this.tier;
        if (next === previous && next === this.announcedTier) return;

        const band = TIER_SCORE_RANGES[next];
        const score = this.score;
        const inside = Math.min(
            Number.isFinite(band.minScore) ? score - band.minScore : Infinity,
            Number.isFinite(band.maxScore) ? band.maxScore - score : Infinity,
        );
        if (inside < GameService.TIER_MARGIN) return;

        const last = this.announcedTier;
        this.announcedTier = next;
        // Nothing to say the first time: that is where the player already was.
        if (last === undefined || last === next) return;

        const rising = ORDERED_TIERS.indexOf(next) > ORDERED_TIERS.indexOf(last);
        try {
            this.toastService.show(rising ? `Reached ${next}` : `Back to ${next}`, {
                classname: rising ? "bg-success text-light" : "bg-secondary text-light",
                delay: 2500,
            });
        } catch { /* toast host not ready */ }
    }

    /**
     * The next question, built during the verdict flash.
     *
     * Generation can take tens of milliseconds for the heavier modes, and that
     * lands as a visible gap between items — the one place the rhythm breaks.
     * Building it while the verdict is on screen hides the cost completely.
     *
     * Built *after* `record`, which is what makes this free rather than a
     * trade: the posterior has already taken the last answer into account, so a
     * prepared item is chosen from exactly the same estimate an item generated
     * on demand would have used. Preparing any earlier would cost a trial of
     * adaptation.
     */
    private prepared?: Question;

    private prepareNext() {
        try { this.prepared = this.createRandomQuestion(); } catch { this.prepared = undefined; }
    }

    play(suppressTutorial = false, usePrepared = false) {
        // Only the auto-advance path may use a prepared item: every other entry
        // point can follow a settings change that would make it stale.
        this.question = (usePrepared && this.prepared) || this.createRandomQuestion();
        this.prepared = undefined;
        this.questionChanged.next();

        const wantsTutorial = !this.playgroundSettings
            && !suppressTutorial
            && !this.skipAllTutorials
            && !localStorage.getItem(LS_DONT_SHOW + this.question.type);

        if (wantsTutorial) {
            this.router.navigate([EnumScreens.Tutorial, this.question.type]);
        } else {
            this.router.navigate([EnumScreens.Game]);
        }
    }

    playArcadeMode() {
        this.playgroundSettings = undefined;
        this.play();
    }

    skipTutorial(dontShowAnymore: boolean) {
        if (dontShowAnymore) {
            localStorage.setItem(LS_DONT_SHOW + this.question.type, "1")
        }
        this.router.navigate([EnumScreens.Game]);
    }

    /**
     * Announce the daily goal once, when it is crossed.
     *
     * The chime is synthesised rather than loaded: no asset to ship, and nothing
     * to fail if the file is missing. Both halves are guarded because audio is
     * blocked without prior user interaction in some browsers, and a missing
     * notification should never take the answer flow down with it.
     */
    private dailyGoalReached() {
        try {
            this.toastService.show("Daily goal reached", {
                classname: "bg-success text-light",
                delay: 6000,
            });
        } catch { /* toast host not ready */ }

        // Three rising notes, so it is not mistaken for a per-answer sound.
        this.tone([[660, 0], [880, 0.13], [1180, 0.26]], "sine");
    }

    /**
     * Answer a choice-mode item.
     *
     * Folded into the boolean path rather than given its own scoring: what gets
     * recorded is "did they pick the right one", so history, stats and the
     * rating all keep working unchanged. The item's own `isValid` is true by
     * construction, which is what makes that equivalence hold.
     */
    checkChoice(index: number) {
        this.question.userChoice = index;
        return this.checkQuestion(index === this.question.correctChoice);
    }

    /**
     * Answer a construction item.
     *
     * Correct means *every* slot of *every* claim, with no partial credit. Half
     * a relation is not a relation — and partial credit would put the guess
     * floor back where true/false had it, which is the whole reason this mode
     * exists.
     */
    checkConstruction(picked: SlotAnswer[][]) {
        this.question.userConstruct = picked;
        return this.checkQuestion(constructionSatisfied(this.question.construct, picked));
    }

    async checkQuestion(value?: boolean) {
        this.question.userAnswer = value;
        this.question.answeredAt = Date.now();
        this.question.timerTypeOnAnswer = localStorage.getItem(LS_TIMER) || "0";
        /*
         * Unscored, because the active profile says so.
         *
         * This used to mean "the Free Play page is driving", which is why it
         * compared object identity against a settings object. The page is gone;
         * the property it provided — answers that do not teach the model —
         * belongs to a profile now, and `playgroundSettings` survives only as
         * the hook Diagnostics uses to force a full settings object.
         */
        this.question.playgroundMode =
            !!this.playgroundSettings || this.settingsOverrideService.practice;

        const type = this.question.type;
        const isQuestionValid = this.question.userAnswer === this.question.isValid;

        // Playground doesn't progress tiers
        if (!this.question.playgroundMode) {
            const answerSeconds = Math.max(0, (this.question.answeredAt - this.question.createdAt) / 1000);
            this.progressionService.record(
                type,
                value == null ? "timeout" : isQuestionValid ? "right" : "wrong",
                answerSeconds,
                {
                    // The guess rate belongs to the item, not the mode: a
                    // six-slot construction answered correctly is decisive
                    // where a true/false is barely evidence.
                    answerMode: this.question.answerMode,
                    // Every slot of every claim. Counting only the first
                    // claim's understated a three-claim item threefold, and
                    // would credit a five-way ranking at one in five.
                    slots: this.question.construct.reduce((n, c) => n + c.slots.length, 0),
                    options: this.question.construct?.[0]?.slots[0]?.directions.length ?? 3,
                    choices: this.question.choices?.length ?? 0,
                },
            );

            if (value == null) {
                this.progressAndPerformanceService.updateTrainingUnit(type, { timeout: 1 });
            } else if (isQuestionValid) {
                this.progressAndPerformanceService.updateTrainingUnit(type, { right: 1 });
            } else {
                this.progressAndPerformanceService.updateTrainingUnit(type, { wrong: 1 });
            }

            const { right, timeout, wrong } = this.progressAndPerformanceService.calcTrainingUnitPercentages(type);
            const { trainingUnitLength, premisesUpThreshold, premisesDownThreshold } = this.progressAndPerformanceService.getTrainingUnitSettings();

            /*
             * The training unit moves premises on its own thresholds, which is a
             * second adaptive system pulling against the ability estimate — the
             * two would fight over the same number and neither would settle. It
             * stays for anyone who turns progression off, and is otherwise
             * silent. Counts are still recorded above, because the stats screens
             * read them.
             */
            const unitOwnsPremises = !this.progressionService.config.enabled;

            if (unitOwnsPremises && right + timeout + wrong >= trainingUnitLength) {
                this.progressAndPerformanceService.restartTrainingUnit(this.question.type);
                const { premises } = this.progressAndPerformanceService.getTrainingUnit(type);
                const { minNumOfPremises, maxNumOfPremises } = QUESTION_TYPE_SETTING_PARAMS[type];

                if ((timeout + wrong) / trainingUnitLength >= premisesDownThreshold) {
                    if (premises > minNumOfPremises) {
                        this.gameTimerService.stop();
                        const modalRef = this.modalService.open(ModalLevelChangeComponent, { centered: true });
                        modalRef.componentInstance.title = "Number of Premises Decreased";
                        modalRef.componentInstance.content = `Your last <b>${trainingUnitLength}</b> answers for<br><b class="modal-level-type">${type}</b><br>have yielded this results:<div class="d-flex flex-row justify-content-center my-3"><span class="p-2"><b>${right}</b> right</span><span class="p-2 border-start border-end"><b>${timeout}</b> timeout</span><span class="p-2"><b>${wrong}</b> wrong</span></div>The number of premises for<br><b class="modal-level-type">${type}</b><br>has <b>decreased</b> to ${premises - 1}.`;
                        await modalRef.result;
                    }
                    this.progressAndPerformanceService.updateTrainingUnit(type, { premises: -1 });
                } else if (right / trainingUnitLength >= premisesUpThreshold) {
                    if (premises < maxNumOfPremises) {
                        this.gameTimerService.stop();
                        const modalRef = this.modalService.open(ModalLevelChangeComponent, { centered: true });
                        modalRef.componentInstance.title = "Number of Premises Increased";
                        modalRef.componentInstance.content = `Your last <b>${trainingUnitLength}</b> answers for<br><b class="modal-level-type">${type}</b><br>have yielded this results:<div class="d-flex flex-row justify-content-center my-3"><span class="p-2"><b>${right}</b> right</span><span class="p-2 border-start border-end"><b>${timeout}</b> timeout</span><span class="p-2"><b>${wrong}</b> wrong</span></div>The number of premises for<br><b class="modal-level-type">${type}</b><br>has <b>increased</b> to ${premises + 1}.`;
                        await modalRef.result;
                    }
                    this.progressAndPerformanceService.updateTrainingUnit(type, { premises: 1 });
                }
            }

            // Adjust tier based on score
            const currTier = this.tier;

            let ds = 0;

            /*
             * The stored total still moves on the flat schedule, so turning
             * progression off hands back exactly the score it would have had.
             * It is written through `rawScore` rather than `score` because
             * `score` now *reads* the derived value — `this.score += n` would
             * quietly overwrite the total with skill points plus n.
             */
            if (isQuestionValid) {
                this.rawScore += TIER_SCORE_ADJUSTMENTS[this.tier].increment;
                ds += 1;
            } else {
                this.rawScore = Math.max(0, this.rawScore - TIER_SCORE_ADJUSTMENTS[this.tier].decrement);
                if (this.rawScore > 0) {
                    ds -= 1;
                }
            }

            this.question.userScore = this.score;

            this.announceTier(currTier);
        }

        this.pushIntoHistory(this.question);

        const today = this.progressAndPerformanceService.getToday();
        const goalBefore = this.progressAndPerformanceService.calcDailyProgress(today);

        this.progressAndPerformanceService.setDailyProgress(
            today,
            this.question.answeredAt - this.question.createdAt
        );

        // Compare either side of the write rather than testing ">= 100", which
        // would re-fire on every question for the rest of the day.
        if (goalBefore < 100 && this.progressAndPerformanceService.calcDailyProgress(today) >= 100) {
            this.dailyGoalReached();
        }

        this.showVerdict(
            value == null ? "timeout" : isQuestionValid ? "correct" : "wrong"
        );
    }

    /**
     * Flash the outcome, then move straight on.
     *
     * This replaces a full Feedback route. The old screen carried its own
     * styling that ignored the theme, and required a click to continue — which
     * broke the rhythm of a timed drill for no information gain, since the
     * verdict is one word.
     */
    private showVerdict(kind: "correct" | "wrong" | "timeout") {
        this.verdict = kind;
        this.playVerdictSound(kind);
        this.prepareNext();

        /*
         * A wrong answer is the one moment worth interrupting for.
         *
         * Everything else about the pacing removes friction — auto-advance,
         * pre-generation, no dialogs — because momentum is the point while
         * things are going well. An error is the opposite case: the item took a
         * minute to read and returned a single bit, and an error only teaches if
         * the correction is actually read. So this waits for the player instead
         * of moving on.
         */
        const derivation = kind === "correct" ? [] : (this.question.explanation ?? []);

        // Long enough to register, short enough not to feel like a screen.
        setTimeout(() => {
            this.verdict = null;
            if (derivation.length) { this.review = derivation; return; }
            this.play(true, true);
        }, kind === "correct" ? 650 : 900);
    }

    /**
     * Synthesised rather than loaded: no assets to ship or fail.
     *
     * Correct rises, wrong falls, timeout is a flat double blip — distinguishable
     * without looking, which is the point of having sound at all.
     */
    private playVerdictSound(kind: "correct" | "wrong" | "timeout") {
        const notes: Record<typeof kind, Array<[number, number]>> = {
            correct: [[660, 0], [990, 0.09]],
            wrong:   [[300, 0], [190, 0.10]],
            timeout: [[420, 0], [420, 0.14]],
        };
        this.tone(notes[kind], kind === "wrong" ? "triangle" : "sine");
    }

    private tone(notes: Array<[number, number]>, type: OscillatorType) {
        try {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            for (const [freq, offset] of notes) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = type;
                osc.frequency.value = freq;
                const t0 = ctx.currentTime + offset;
                // Ramp rather than switch on, so it does not click.
                gain.gain.setValueAtTime(0.0001, t0);
                gain.gain.exponentialRampToValueAtTime(0.10, t0 + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
                osc.connect(gain).connect(ctx.destination);
                osc.start(t0);
                osc.stop(t0 + 0.18);
            }
            setTimeout(() => ctx.close().catch(() => {}), 700);
        } catch { /* autoplay policy, or no audio device */ }
    }


}