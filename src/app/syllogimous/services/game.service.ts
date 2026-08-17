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

/**
 * Stated whenever a conclusion has to be *built*.
 *
 * Judging a claim only needs the direction, which the premises give directly.
 * Stating one needs the distance too, and that is only derivable if the reader
 * knows each premise is worth exactly one step. It is true of every layout the
 * engines produce — but true and *known* are different things, and an item
 * whose answer cannot be derived from what the player was shown is not an item.
 */
/**
 * Stated on every hierarchy item.
 *
 * Premises give *direct* links and the question asks about paths of any length,
 * which is the whole distinction the mode tests — and the two would otherwise
 * be told apart only by a verb.
 */
const HIERARCHY_NOTE =
    "Premises are <b>direct</b> links. The question asks whether one reaches the "
    + "other along <b>any number</b> of steps.";

/** Stated whenever axes with no difference are left out of the premises. */
const COMPACT_NOTE =
    "A dimension left out of a premise is <b>the same</b> for both.";

/** Stated whenever later premises rewrite earlier relations. */
const EDIT_NOTE =
    "Later premises <b>change the relations themselves</b>, in order. Answer "
    + "about the relations as they end up.";

const ONE_STEP_NOTE =
    "Each premise is <b>one step</b> on every dimension it names.";

/**
 * Stated whenever operations move objects around a composed space.
 *
 * Distinct from EDIT_NOTE on purpose — the two look similar and mean opposite
 * things. An edit rewrites what a premise *said*; a transformation leaves every
 * premise true of the arrangement it described and then moves things out of it.
 */
const ND_TRANSFORM_NOTE =
    "Later premises <b>move things</b> around the space, in order. Answer about "
    + "where they end up.";

/**
 * Stated whenever a conclusion compares two relations.
 *
 * "The same relation" is genuinely ambiguous between direction and distance,
 * and the item is undecidable rather than merely hard if the reader picks the
 * other one.
 */
const ND_ANALOGY_NOTE =
    "Two relations are <b>the same</b> when they point the same way on every "
    + "dimension, and <b>opposite</b> when every direction is reversed. How far "
    + "apart things are does not matter.";

@Injectable({
    providedIn: "root"
})
export class GameService {
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
        return EnumTiers.Adept;
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
        private settingsOverrideService: SettingsOverrideService,
        public progressionService: ProgressionService,
        private toastService: ToastService,
        private gameTimerService: GameTimerService,
    ) {
        this.loadScore();
        (window as any).syllogimous = this;

        // Create a first dummy question to avoid null pointer etc...
        const firstDummyQuestion = this.createSyllogism(2);
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
            [EnumQuestionType.Distinction]: () => this.createDistinction(numOfPremises),
            [EnumQuestionType.ComparisonNumerical]: () => this.createComparison(numOfPremises, EnumQuestionType.ComparisonNumerical),
            [EnumQuestionType.ComparisonChronological]: () => this.createComparison(numOfPremises, EnumQuestionType.ComparisonChronological),
            [EnumQuestionType.LinearVertical]: () => this.createLinear(numOfPremises, EnumQuestionType.LinearVertical),
            [EnumQuestionType.LinearHorizontal]: () => this.createLinear(numOfPremises, EnumQuestionType.LinearHorizontal),
            [EnumQuestionType.LinearContains]: () => this.createLinear(numOfPremises, EnumQuestionType.LinearContains),
            [EnumQuestionType.Syllogism]: () => this.createSyllogism(numOfPremises),
            [EnumQuestionType.LinearArrangement]: () => this.createArrangement(numOfPremises, EnumQuestionType.LinearArrangement),
            [EnumQuestionType.CircularArrangement]: () => this.createArrangement(numOfPremises, EnumQuestionType.CircularArrangement),
            [EnumQuestionType.Direction]: () => this.createDirection(numOfPremises),
            [EnumQuestionType.Direction3DSpatial]: () => this.createDirection3D(numOfPremises, EnumQuestionType.Direction3DSpatial),
            [EnumQuestionType.Direction3DTemporal]: () => this.createDirection3D(numOfPremises, EnumQuestionType.Direction3DTemporal),
            [EnumQuestionType.Space3D]: () => this.createNdSpace(numOfPremises, EnumQuestionType.Space3D),
            [EnumQuestionType.Space4D]: () => this.createNdSpace(numOfPremises, EnumQuestionType.Space4D),
            [EnumQuestionType.Space5D]: () => this.createNdSpace(numOfPremises, EnumQuestionType.Space5D),
            [EnumQuestionType.Space6D]: () => this.createNdSpace(numOfPremises, EnumQuestionType.Space6D),
            [EnumQuestionType.GraphMatching]: () => this.createGraphMatching(numOfPremises),
            [EnumQuestionType.Hierarchy]: () => this.createHierarchy(numOfPremises),
            [EnumQuestionType.Analogy]: () => this.createAnalogy(numOfPremises),
            [EnumQuestionType.Binary]: () => this.createBinary(numOfPremises),
            [EnumQuestionType.Deictic]: () => this.createDeictic(numOfPremises),
            [EnumQuestionType.Transformation]: () => this.createTransformation(numOfPremises),
            [EnumQuestionType.AnchorSpace]: () => this.createAnchorSpace(numOfPremises),
            [EnumQuestionType.AnchorSpaceV2]: () => this.createAnchorSpaceV2(numOfPremises),
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
        this.question.playgroundMode = this.settings === this.playgroundSettings;

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
                    slots: this.question.construct?.[0]?.slots.length ?? 0,
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

    createDistinction(numOfPremises: number): Question {
        this.logger.info("createDistinction");

        const type = EnumQuestionType.Distinction;
        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const length = numOfPremises + 1;
        const symbols = getRandomSymbols(settings, length);
        const question = new Question(type);

        do {
            const rnd = Math.floor(Math.random() * symbols.length);
            const first = symbols.splice(rnd, 1)
            let prev = first;
            let curr: string[] = [];

            question.buckets = [[prev], []];
            let prevBucket = 0;

            question.premises = [];

            for (let i = 0; i < length - 1; i++) {
                const rnd = Math.floor(Math.random() * symbols.length);
                curr = symbols.splice(rnd, 1);

                const isSameAs = coinFlip();
                const relation = getRelation(settings, type, isSameAs);

                question.premises.push(`<span class="subject">${prev}</span> is ${relation} <span class="subject">${curr}</span>`);

                if (!isSameAs) {
                    prevBucket = (prevBucket + 1) % 2;
                }

                question.buckets[prevBucket].push(curr);

                prev = curr;
            }

            // All same is useless, in that case repeat
            if (!question.buckets[0].length || !question.buckets[1].length) {
                return this.createDistinction(numOfPremises);
            }

            createMetaRelationships(settings, question, length);

            const isSameAs = coinFlip();
            const relation = getRelation(settings, type, isSameAs);

            question.conclusion = `<span class="subject">${first}</span> is ${relation} <span class="subject">${curr}</span>`;
            question.isValid = isSameAs
                ? question.buckets[0].includes(curr)
                : question.buckets[1].includes(curr);
        } while (isPremiseLikeConclusion(question.premises, question.conclusion));

        shuffle(question.premises);

        return question;
    }

    /**
     * Which linear scale a mode reads on, if any.
     *
     * The two Comparisons predate the shared engine and keep their original
     * generator while nothing structural is switched on, so a player who has not
     * unlocked anything sees exactly the v4 item they always saw.
     */
    private linearScaleFor(type: EnumQuestionType): LinearScale | undefined {
        return {
            [EnumQuestionType.ComparisonNumerical]: LINEAR_SCALES["quantity"],
            [EnumQuestionType.ComparisonChronological]: LINEAR_SCALES["temporal"],
            [EnumQuestionType.LinearVertical]: LINEAR_SCALES["vertical"],
            [EnumQuestionType.LinearHorizontal]: LINEAR_SCALES["horizontal"],
            [EnumQuestionType.LinearContains]: LINEAR_SCALES["contains"],
        }[type as string];
    }

    /**
     * Which structural modifiers are live for this mode right now.
     *
     * Two sources, in that order: what the ladder has earned, then anything
     * Advanced Options forces. Forcing wins because it is an explicit choice,
     * and because there is otherwise no way to see these without climbing.
     */
    private linearFeatures(type: EnumQuestionType) {
        const ladder = (r: string) => this.progressionService.hasRung(type, r);
        const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
            this.settingsOverrideService.linearOverride(k);

        const pick = (key: "branching" | "overlap" | "multiConclusion" | "chooseConclusion" | "constructConclusion" | "constructDistance", rung: string) => {
            const f = forced(key);
            return f === null ? ladder(rung) : !!f;
        };

        const forcedTransforms = forced("transforms");
        const transforms = forcedTransforms === null
            ? (ladder("transform-1") ? 1 : 0) + (ladder("transform-2") ? 1 : 0)
            : Math.max(0, Math.min(4, forcedTransforms));

        const branching = pick("branching", "branching");

        return {
            branching,
            // A chain cannot produce a tie however the flag is set, so overlap
            // is only meaningful once premises branch.
            overlap: branching && pick("overlap", "overlap"),
            transforms,
            multiConclusion: pick("multiConclusion", "multi-conclusion"),
            chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
            constructConclusion: this.forceConstruction !== "off" || pick("constructConclusion", "construct-conclusion"),
            constructDistance: this.forceConstruction !== "off"
                ? this.forceConstruction === "distance"
                : pick("constructDistance", "construct-distance"),
        };
    }

    /** True when anything beyond a plain chain is in play. */
    private hasLinearModifiers(type: EnumQuestionType) {
        const f = this.linearFeatures(type);
        return f.branching || f.transforms > 0 || f.multiConclusion || f.chooseConclusion || f.constructConclusion;
    }

    createComparison(numOfPremises: number, type: EnumQuestionType.ComparisonNumerical | EnumQuestionType.ComparisonChronological) {
        this.logger.info("createComparison:", type);

        // Structural modifiers are only implemented in the shared engine, so
        // hand over as soon as one is live and otherwise leave v4 alone.
        if (this.hasLinearModifiers(type)) {
            return this.createLinear(numOfPremises, type);
        }

        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const length = numOfPremises + 1;
        const question = new Question(type);

        do {
            question.bucket = getRandomSymbols(settings, length);
            question.premises = [];
            const sign = [-1, 1][Math.floor(Math.random() * 2)];

            let next = "";

            for (let i = 0; i < length - 1; i++) {
                const curr = question.bucket[i];
                next = question.bucket[i + 1];

                const isMoreOrAfter = coinFlip();
                const [first, last] = ((sign === 1) === isMoreOrAfter) ? [next, curr] : [curr, next];
                const relation = getRelation(settings, type, isMoreOrAfter);

                question.premises.push(`<span class="subject">${first}</span> is ${relation} <span class="subject">${last}</span>`);
            }

            createMetaRelationships(settings, question, length);

            const a = Math.floor(Math.random() * question.bucket.length);
            let b = Math.floor(Math.random() * question.bucket.length);
            while (a === b) {
                b = Math.floor(Math.random() * question.bucket.length);
            }

            const isMoreOrAfter = coinFlip();
            const relation = getRelation(settings, type, isMoreOrAfter);

            question.conclusion = `<span class="subject">${question.bucket[a]}</span> is ${relation} <span class="subject">${question.bucket[b]}</span>`;
            question.isValid = isMoreOrAfter
                ? sign === 1 && a > b || sign === -1 && a < b
                : sign === 1 && a < b || sign === -1 && a > b;
        } while (isPremiseLikeConclusion(question.premises, question.conclusion));

        shuffle(question.premises);

        return question;
    }

    /**
     * The shared linear-scale generator (engine in `utils/linear.utils.ts`).
     *
     * Serves all five scale modes, and every structural modifier the family has:
     * branching premises, overlapping positions, transformations over the
     * one-axis space, multiple conclusions and choice answering. Which of those
     * are live comes from `linearFeatures`, so the same code path produces a
     * two-premise chain and an eight-premise branching layout under two
     * transformations.
     *
     * Verification is by construction: positions are integers, transformations
     * are pure maps replayed from the stated start, and every claim is decided
     * by comparing final positions. Generation and checking cannot drift.
     */
    createLinear(numOfPremises: number, type: EnumQuestionType): Question {
        this.logger.info("createLinear:", type);

        const settings = this.settings;
        const scale = this.linearScaleFor(type);

        if (!scale || !canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const feat = this.linearFeatures(type);
        const vocab = vocabFor(scale);

        /*
         * The premise budget is shared: transformation premises come out of the
         * object count rather than being added on top, so claiming a rung never
         * smuggles in a premise increase — that is the one step the ladder is
         * supposed to ration. Four objects is the floor; below that a chain
         * states every pair outright and there is nothing left to infer.
         */
        const transformCount = Math.min(feat.transforms, Math.max(0, numOfPremises - 3));
        const objectCount = Math.max(4, numOfPremises + 1 - transformCount);

        for (let attempt = 0; attempt < 300; attempt++) {
            const words = getRandomSymbols(settings, objectCount);
            const layout = feat.branching ? buildBranching(words) : buildChain(words);

            // Until overlap is earned, a layout that happens to tie is thrown
            // away rather than asked about — the third relation should appear
            // when the player unlocks it, not by accident.
            const ties = hasTies(layout);
            if (ties && !feat.overlap) continue;

            /*
             * Negation and overlap cannot both be on, and this is the reason.
             *
             * A negated premise names a relation the truth rules out, which
             * pins the layout only when one option is left: with two relations,
             * "not less than" means "more than". Once equality is on the table
             * there are three, so "not less than" leaves both more and equal
             * open, the premises stop determining the layout, and the item's
             * own answer no longer follows from what the player was shown.
             *
             * Dropping negation is the honest fix. The alternative — telling the
             * reader that stated pairs are never equal — would leak the
             * structure the overlap rung exists to hide.
             */
            const rendered = renderPremises(scale, layout, {
                negate: settings.enabled.negation && !feat.overlap,
                allowTies: false,
            });
            const premises = rendered.premises;

            // One axis, so the whole layout is a coordinate map of singletons.
            const initial: CoordMap = {};
            for (const w of words) initial[w] = [layout.pos[w]];

            let transforms: Transform[] = [];
            let finalPos = initial;
            if (transformCount > 0) {
                transforms = drawTransforms(words, transformCount, { dims: 1 }, vocab);
                if (transforms.length < transformCount) continue;
                finalPos = replay(initial, transforms);
            }

            const finalLayout: LinearLayout = {
                ...layout,
                pos: Object.fromEntries(words.map(w => [w, finalPos[w][0]])),
            };

            const question = new Question(type);
            question.negations = rendered.negations;
            /*
             * Transformations can push two objects onto the same coordinate
             * whatever the overlap rung says, so once they are on, the third
             * relation has to be available to describe the result honestly.
             */
            const options = { negate: false, allowTies: feat.overlap || transformCount > 0 };

            if (!this.fillLinearConclusion(question, scale, layout, finalLayout, feat, options, transformCount > 0, numOfPremises)) {
                continue;
            }

            /*
             * Meta relations go in before the transformations are appended, and
             * are judged against the *starting* layout, because that is what the
             * layout premises describe — a meta premise reporting the end state
             * would be describing something the reader has not been told yet.
             * Doing it first also keeps `createMetaRelationships` from replacing
             * a transformation premise, which would delete an operation the
             * conclusion depends on.
             *
             * Skipped when the starting layout ties, because the helper compares
             * with `<` and would call a tie "the opposite way" rather than equal.
             * Ties only happen once overlap is unlocked, so up to that rung meta
             * is always available.
             */
            question.bucket = [...words].sort((a, b) => layout.pos[b] - layout.pos[a]);
            question.premises = premises;
            if (!ties) {
                createMetaRelationships(settings, question, premises.length + 1);
            }

            question.premises = transformCount > 0
                // Transformations are applied in sequence, so their order is
                // semantic and must not be shuffled into the layout premises.
                ? scrambleLeading(
                    [...question.premises, ...transforms.map(t => describeTransform(t, vocab))],
                    question.premises.length,
                    this.settingsOverrideService.scramble)
                : scrambleByFactor(question.premises, this.settingsOverrideService.scramble);

            question.setup = this.linearSetup(transformCount, feat.constructDistance);
            return question;
        }

        throw new Error("Cannot generate.");
    }

    /**
     * Draw the claims a construction item asks the player to state.
     *
     * More than one above four premises. A single relation can be reached by
     * tracking one thread through the premises and ignoring the rest; asking
     * for two unrelated pairs means the whole structure had to be held, which
     * is the difference between having followed an item and having solved it.
     */
    private buildConstructClaims(draw: () => ConstructClaim | null | undefined | false, numOfPremises: number) {
        const wanted = numOfPremises > 8 ? 3 : numOfPremises > 4 ? 2 : 1;
        const claims: ConstructClaim[] = [];
        const used = new Set<string>();

        for (let guard = 0; claims.length < wanted && guard < wanted * 40; guard++) {
            const claim = draw();
            if (!claim) continue;
            const key = [claim.a, claim.b].sort().join(" ");
            if (used.has(key)) continue;
            used.add(key);
            claims.push(claim);
        }

        // All or nothing: a two-claim item that quietly became one claim would
        // be scored on the same scale as a genuine one.
        return claims.length === wanted ? claims : [];
    }

    /**
     * Attach the conclusion, in whichever answering mode is live.
     *
     * Returns false when this layout cannot be asked about — no pair far enough
     * apart, or transformations that left the queried pair where they found it,
     * which would make the transformation premises decorative.
     */
    private fillLinearConclusion(
        question: Question,
        scale: LinearScale,
        initial: LinearLayout,
        final: LinearLayout,
        feat: ReturnType<GameService["linearFeatures"]>,
        options: { negate: boolean; allowTies: boolean },
        transformed: boolean,
        numOfPremises: number,
    ): boolean {
        /*
         * Transformations have to matter. A set of claims whose truth is the
         * same before and after is answerable from the layout premises alone,
         * which turns the transformation premises into reading practice.
         */
        const transformsBite = (pairs: Array<[string, string]>) =>
            !transformed || pairs.some(([a, b]) => compare(initial, a, b) !== compare(final, a, b));

        const pairsOf = (texts: string[]) => texts
            .map(t => (t.match(/<span class="subject">(.*?)<\/span>/g) ?? [])
                .map(s => s.replace(/<[^>]+>/g, "")))
            .filter(p => p.length === 2) as Array<[string, string]>;

        if (feat.constructConclusion) {
            const claims = this.buildConstructClaims(
                () => {
                    const pair = pickDistantPair(final);
                    return pair && buildConstructClaim(scale, final, pair[0], pair[1], feat.constructDistance);
                },
                numOfPremises);
            if (!claims.length) return false;
            question.construct = claims;
            question.answerMode = "construct";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        if (feat.chooseConclusion) {
            /*
             * Exactly one of four claims follows. The distractors are about
             * *other* pairs rather than other relations on the same pair —
             * otherwise three of the four options share two subjects and the
             * answer can be found by looking for the odd one out.
             */
            const set = buildConclusionSet(scale, final, 4, [true, false, false, false], options);
            if (set.length < 4) return false;
            // Only the true one has to move; the distractors are false either way.
            if (!transformsBite(pairsOf([set[0].text]))) return false;

            const order = shuffle(set.map((c, i) => i));
            question.choices = order.map(i => set[i].text);
            question.correctChoice = order.indexOf(0);
            question.answerMode = "choice";
            // Scored as "did they pick the right one", so the item itself is
            // always the valid side of the comparison in checkQuestion.
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        if (feat.multiConclusion) {
            // All must hold, so a false item needs exactly one false claim —
            // several would let it be spotted from any of them.
            const count = 2 + Math.floor(Math.random() * 2);
            const allTrue = coinFlip();
            const wants = Array(count).fill(true);
            if (!allTrue) wants[Math.floor(Math.random() * count)] = false;

            const set = buildConclusionSet(scale, final, count, wants, options);
            if (set.length < count) return false;
            if (!transformsBite(pairsOf(set.map(c => c.text)))) return false;

            question.conclusion = set.map(c => c.text);
            question.isValid = allTrue;
            return true;
        }

        const pair = pickDistantPair(final);
        if (!pair) return false;

        // A transformation list that does not change the answer is decoration:
        // the item would be solvable from the layout premises alone.
        if (transformed && compare(initial, pair[0], pair[1]) === compare(final, pair[0], pair[1])) {
            return false;
        }

        const conclusion = buildConclusion(scale, final, pair[0], pair[1], coinFlip(), options);
        question.conclusion = conclusion.text;
        question.isValid = conclusion.isValid;
        /*
         * Only when nothing moved. `final` is the post-transformation layout, so
         * its positions no longer decompose into the stated steps, and walking
         * the premises would produce a derivation that is confidently wrong.
         */
        if (!transformed) {
            question.explanation = explainLinear(scale, final, pair[0], pair[1]);
        }
        return true;
    }

    /**
     * The one thing about a scale item that the premises cannot convey.
     *
     * Only transformations qualify. That some premises rewrite the layout rather
     * than describe it is not visible from a premise read on its own, and
     * reading them all as descriptions gives a confidently wrong answer.
     *
     * Everything else that used to be here is carried by the conclusion labels
     * instead — "all must follow" for a conclusion set, "which of the statements
     * below follows?" for choice — so it sits next to what it qualifies rather
     * than as a preamble above the premises.
     */
    private linearSetup(transformCount: number, constructing: boolean): string[] {
        const lines: string[] = [];
        if (transformCount > 0) {
            lines.push("Later premises <b>change</b> the arrangement, in order.");
        }
        if (constructing) lines.push(ONE_STEP_NOTE);
        return lines;
    }

    /** How many dimensions each composed-space mode asks for. */
    private dimensionsOf(type: EnumQuestionType): number {
        return {
            [EnumQuestionType.Space3D]: 3,
            [EnumQuestionType.Space4D]: 4,
            [EnumQuestionType.Space5D]: 5,
            [EnumQuestionType.Space6D]: 6,
        }[type as string] ?? 4;
    }

    /**
     * Composed N-dimensional space (engine in `utils/ndspace.utils.ts`).
     *
     * Serves 4D, 5D and 6D from one code path, because the only difference
     * between them is how many axes are on the list. Which axes, and whether any
     * of them wrap into a loop, comes from the progression ladder and Advanced
     * Options rather than from the mode.
     */
    createNdSpace(numOfPremises: number, type: EnumQuestionType): Question {
        this.logger.info("createNdSpace:", type);

        const settings = this.settings;
        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        /*
         * This generator enforces its own ceiling rather than trusting the
         * caller. `canGenerateQuestion` only checks the floor, and every real
         * call site happens to clamp first — but the cap here is a claim about
         * what is answerable at this width, not a preference, and a claim worth
         * making is worth not depending on three unrelated call sites to keep.
         */
        numOfPremises = Math.min(
            numOfPremises,
            QUESTION_TYPE_SETTING_PARAMS[type].maxNumOfPremises);

        const dims = this.dimensionsOf(type);
        const scales = this.settingsOverrideService.axesFor(dims) ?? axesForDimensions(dims);
        const feat = this.ndFeatures(type);

        /*
         * Loops are applied to the axes that have cyclic wording — a ring of
         * sizes or of quantities is not something anyone can reason about, so
         * those stay straight however many the rung has earned.
         */
        const circularCapable = scales
            .map((s, i) => (s.cyclic ? i : -1))
            .filter(i => i >= 0);
        const loops = new Set(circularCapable.slice(0, feat.circular));

        const axes: AxisSpec[] = scales.map((scale, i) => ({
            scale,
            // An odd modulus never lets a pair sit exactly opposite, an even one
            // does; alternating keeps both kinds of claim in circulation.
            modulus: loops.has(i) ? (coinFlip() ? 4 : 5) : undefined,
        }));

        /*
         * Edit and transformation premises come out of the object count rather
         * than being added on top, so claiming a rung never smuggles in a
         * premise increase. Two relations are needed before one can be swapped
         * with another.
         */
        const editCount = Math.min(feat.edits, Math.max(0, numOfPremises - 3));

        /*
         * Analogy needs objects, and operations eat them.
         *
         * An analogy claim is about two derived relations that happen to match,
         * so it can only be built if the layout has enough pairs to find a match
         * among. Six premises carrying two operations leaves five objects, which
         * is thin enough that a quarter of items could not be built at all — and
         * a generator that throws is not a graceful degradation, it stops the
         * session. Operations are what gives way, because they are the thing an
         * item can have fewer of and still be the item it was meant to be.
         */
        const objectFloor = feat.analogy ? 6 : 4;
        const transformCount = Math.min(
            feat.transforms,
            Math.max(0, numOfPremises - 3 - editCount),
            Math.max(0, numOfPremises + 1 - objectFloor - editCount));
        const objectCount = Math.max(4, numOfPremises + 1 - editCount - transformCount);
        const vocab = ndTransformVocab(axes);

        for (let attempt = 0; attempt < 300; attempt++) {
            const words = getRandomSymbols(settings, objectCount);
            const layout = buildNdLayout(words, axes, { branching: feat.branching });

            /*
             * Edits rewrite the stated relations; transformations move objects
             * around the space those relations describe. So the edits land
             * first and the transformations act on what they produce — the
             * other order would have operations moving objects that a later
             * premise then relocates by rewriting how they were placed.
             */
            const edits = editCount ? drawNdEdits(layout, editCount) : [];
            if (edits.length < editCount) continue;
            const edited = edits.length ? applyNdEdits(layout, edits) : layout;

            const transforms = transformCount ? drawNdTransforms(edited, transformCount) : [];
            if (transforms.length < transformCount) continue;
            const final = transforms.length ? applyNdTransforms(edited, transforms) : edited;

            const question = new Question(type);
            if (!this.fillNdConclusion(question, layout, final, feat, numOfPremises, attempt >= 250)) continue;

            const stated = renderNdPremises(layout, { compact: feat.compact });
            const mutations = [
                ...edits.map(e => renderNdEdit(layout, e)),
                ...transforms.map(t => describeTransform(t, vocab)),
            ];
            question.premises = mutations.length
                // Mutations are applied in sequence, so their order is semantic
                // and must not be shuffled in among the relations they act on.
                ? scrambleLeading(
                    [...stated, ...mutations],
                    stated.length,
                    this.settingsOverrideService.scramble)
                : scrambleByFactor(stated, this.settingsOverrideService.scramble);
            question.bucket = [...words];
            question.setup = [
                ...this.ndSetup(axes, feat, edits.length > 0, transforms.length > 0),
                ...question.setup,
            ];
            return question;
        }

        throw new Error("Cannot generate.");
    }

    /** Which structural modifiers are live for a composed space. */
    private ndFeatures(type: EnumQuestionType) {
        const ladder = (r: string) => this.progressionService.hasRung(type, r);
        const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
            this.settingsOverrideService.linearOverride(k);

        const pick = (key: "branching" | "multiConclusion" | "chooseConclusion" | "constructConclusion" | "constructDistance" | "analogy", rung: string) => {
            const f = forced(key);
            return f === null ? ladder(rung) : !!f;
        };

        const forcedLoops = this.settingsOverrideService.circularAxes();
        const circular = forcedLoops === null
            ? (ladder("circular") ? 1 : 0) + (ladder("circular-2") ? 1 : 0)
            : forcedLoops;

        const forcedEdits = this.settingsOverrideService.linearOverride("edits");
        const edits = forcedEdits === null
            ? (ladder("edit-1") ? 1 : 0) + (ladder("edit-2") ? 1 : 0)
            : Math.max(0, Math.min(4, forcedEdits));

        const forcedCompact = this.settingsOverrideService.linearOverride("compact");

        const forcedTransforms = forced("transforms");
        const transforms = forcedTransforms === null
            ? (ladder("transform-1") ? 1 : 0) + (ladder("transform-2") ? 1 : 0)
            : Math.max(0, Math.min(4, forcedTransforms));

        return {
            branching: pick("branching", "branching"),
            compact: forcedCompact === null ? ladder("compact") : !!forcedCompact,
            edits,
            transforms,
            circular,
            analogy: pick("analogy", "analogy"),
            multiConclusion: pick("multiConclusion", "multi-conclusion"),
            chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
            constructConclusion: this.forceConstruction !== "off" || pick("constructConclusion", "construct-conclusion"),
            constructDistance: this.forceConstruction !== "off"
                ? this.forceConstruction === "distance"
                : pick("constructDistance", "construct-distance"),
        };
    }

    private fillNdConclusion(
        question: Question,
        initial: NdLayout,
        layout: NdLayout,
        feat: ReturnType<GameService["ndFeatures"]>,
        numOfPremises: number,
        /** Near the end of the attempt budget: take what can be built. */
        lastChance = false,
    ): boolean {
        /*
         * Mutations have to matter. A conclusion whose truth survives the edits
         * and transformations is answerable from the relations as first stated,
         * which turns those premises into reading practice.
         *
         * Compared as the answer would be *stated*, not as raw coordinates: an
         * ordering claim only notices the sign, a circular axis has no ordering
         * to notice, and a construction that asks distance notices the
         * magnitude too. Testing the coordinates directly would accept items
         * where something moved but nothing the player is asked about changed.
         */
        const mutated = initial !== layout;
        const axisAnswer = (l: NdLayout, a: string, b: string, i: number) => {
            if (isCircular(l.axes[i])) return displacementOn(l, i, a, b);
            const delta = l.coords[a][i] - l.coords[b][i];
            return feat.constructDistance ? delta : Math.sign(delta);
        };

        /*
         * Per axis, because a claim is about one axis and the pair moving is not
         * enough. A single-axis mirror changes one of six coordinates, so a pair
         * that "changed" is still five-sixths likely to be asked about an axis
         * the operations never touched — and that item is answerable by ignoring
         * them. Operations can also cancel on an axis, which the pair-level test
         * cannot see either.
         */
        const axisBites = (a: string, b: string, i: number) => !mutated
            || axisAnswer(initial, a, b, i) !== axisAnswer(layout, a, b, i);

        /** Construction states every axis at once, so the pair is the right unit. */
        const pairBites = (a: string, b: string) => !mutated
            || layout.axes.some((_, i) => axisBites(a, b, i));

        /*
         * An analogy is about two relations at once, so neither of the tests
         * above applies: the claim can survive both pairs moving, as long as
         * they moved the same way. The only honest question is whether the
         * claim's truth value is different before and after.
         */
        const analogyBites = (c: { pairs: [string, string, string, string]; claimSame: boolean }) => {
            if (!mutated) return true;
            const held = (l: NdLayout) => {
                const key = (x: string, y: string) => l.axes.map((axis, i) => isCircular(axis)
                    ? displacementOn(l, i, y, x)
                    : Math.sign(l.coords[y][i] - l.coords[x][i])).join(",");
                const [a, b, x, y] = c.pairs;
                const first = key(a, b);
                const second = key(x, y);
                const wanted = c.claimSame ? first : first.split(",").map((v, i) =>
                    isCircular(l.axes[i]) ? mod(-Number(v), l.axes[i].modulus!) : -Number(v)).join(",");
                return second === wanted;
            };
            return held(initial) !== held(layout);
        };

        /*
         * Analogy stands in for the axis claim rather than replacing an answer
         * mode, so it composes with choice and multi. Construction is the one
         * it cannot share an item with — you cannot build a relation and judge
         * an identity between two of them in the same answer — so when both are
         * live they alternate instead of construction silently winning forever.
         */
        const useAnalogy = feat.analogy && (!feat.constructConclusion || coinFlip());

        /*
         * Returns false when this layout cannot carry an analogy, and the
         * ordinary axis claim is used instead.
         *
         * Falling through rather than failing the item: a layout with no
         * matching pair of relations is a fact about the layout, not an error,
         * and the alternative — throwing — ends the session, because
         * `getRandomQuestion` calls a generator once. An occasional plain item
         * at the analogy rung is a much smaller cost, and it leaves the analogy
         * items that *are* produced exactly as balanced as before.
         */
        const tryAnalogy = (): boolean => {
            // Which conclusion form an item ended up with is decided here, not
            // by the feature flags, so the note that explains it is added here
            // too; createNdSpace appends the mode-level lines in front.
            question.setup.push(ND_ANALOGY_NOTE);
            if (feat.chooseConclusion) {
                const set = buildNdAnalogySet(layout, [true, false, false, false], analogyBites);
                if (set.length < 4) return false;
                const order = shuffle(set.map((_, i) => i));
                question.choices = order.map(i => set[i].text);
                question.correctChoice = order.indexOf(0);
                question.answerMode = "choice";
                question.isValid = true;
                question.conclusion = "";
                return true;
            }

            /*
             * Both answers must be constructible from this layout before either
             * is used, and the coin is tossed only afterwards.
             *
             * Not fussiness. A true analogy needs two disjoint pairs whose
             * relations actually match, and in six dimensions many layouts have
             * none; a false one is always available. Asking for a random
             * validity and discarding the failures therefore filters out true
             * claims specifically — measured at 40% true in 6D and 21% with two
             * loops, so answering "false" every time scored 79%. Deciding
             * whether the layout is usable *before* deciding the answer is what
             * removes the correlation. Which layouts get used is skewed by this,
             * which is harmless: knowing a match exists somewhere says nothing
             * about whether the claim on screen is the one.
             */
            if (feat.multiConclusion) {
                const count = 2 + Math.floor(Math.random() * 2);
                const buildSet = (allTrue: boolean) => {
                    const wants = Array(count).fill(true);
                    if (!allTrue) wants[Math.floor(Math.random() * count)] = false;
                    const set = buildNdAnalogySet(layout, wants, analogyBites);
                    return set.length === count ? set : null;
                };
                const yes = buildSet(true), no = buildSet(false);
                if (!yes || !no) return false;

                const allTrue = coinFlip();
                question.conclusion = (allTrue ? yes : no).map(c => c.text);
                question.isValid = allTrue;
                return true;
            }

            const options = [
                buildNdAnalogy(layout, true, undefined, analogyBites),
                buildNdAnalogy(layout, false, undefined, analogyBites),
            ];
            if (!options[0] || !options[1]) return false;
            const claim = options[coinFlip() ? 0 : 1]!;
            question.conclusion = claim.text;
            question.isValid = claim.isValid;
            return true;
        };

        if (useAnalogy && tryAnalogy()) return true;
        // The note belongs to the analogy form only; drop it if we fell through.
        question.setup = question.setup.filter(l => l !== ND_ANALOGY_NOTE);
        /*
         * Ask for a different layout rather than settling immediately. Roughly
         * half of six-dimensional layouts have no disjoint matching pair, so
         * giving up on the first one turns the analogy rung into an occasional
         * analogy; spending the attempt budget first turns it back into the
         * rung it is meant to be, and the fallback still catches the
         * configurations where no layout works at all.
         */
        if (useAnalogy && !lastChance) return false;

        if (feat.constructConclusion) {
            const claims = this.buildConstructClaims(() => {
                const pair = pickDistantPairNd(layout);
                if (!pair || !pairBites(pair[0], pair[1])) return null;
                return buildNdConstructClaim(layout, pair[0], pair[1], feat.constructDistance);
            }, numOfPremises);
            if (!claims.length) return false;
            question.construct = claims;
            question.answerMode = "construct";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        if (feat.chooseConclusion) {
            const set = buildNdConclusionSet(layout, 4, [true, false, false, false]);
            if (set.length < 4) return false;
            // set[0] is the one that follows, so it is the one that has to need
            // the operations; the distractors are false either way.
            if (!axisBites(set[0].a, set[0].b, set[0].axis)) return false;
            const order = shuffle(set.map((_, i) => i));
            question.choices = order.map(i => set[i].text);
            question.correctChoice = order.indexOf(0);
            question.answerMode = "choice";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        if (feat.multiConclusion) {
            const count = 2 + Math.floor(Math.random() * 2);
            const allTrue = coinFlip();
            const wants = Array(count).fill(true);
            if (!allTrue) wants[Math.floor(Math.random() * count)] = false;

            const set = buildNdConclusionSet(layout, count, wants);
            if (set.length < count) return false;
            if (!set.some(c => axisBites(c.a, c.b, c.axis))) return false;
            question.conclusion = set.map(c => c.text);
            question.isValid = allTrue;
            return true;
        }

        const pair = pickDistantPairNd(layout);
        if (!pair) return false;
        /*
         * Draw the axis from the ones the operations actually reached, rather
         * than drawing at random and hoping. With one axis touched out of six,
         * hoping is wrong five times in six.
         */
        const live = layout.axes.map((_, i) => i).filter(i => axisBites(pair[0], pair[1], i));
        if (!live.length) return false;
        const axisIndex = live[Math.floor(Math.random() * live.length)];
        const c = buildNdConclusion(layout, pair[0], pair[1], axisIndex, coinFlip());
        question.conclusion = c.text;
        question.isValid = c.isValid;
        /*
         * Only when nothing moved. A path through the premises accounts for a
         * position exactly while positions are the sum of the stated steps;
         * transformations set coordinates directly, so the same walk would
         * produce a confident and wrong derivation. Silence beats that.
         */
        if (!mutated) question.explanation = explainNdAxis(layout, c.b, c.a, axisIndex);
        return true;
    }

    /**
     * Naming the loops is not decoration.
     *
     * A circular axis is the one thing about the item the premises cannot
     * convey: the clauses read the same whether the axis wraps or not, and a
     * reader who assumes a straight line will derive a confidently wrong
     * position the moment the chain runs past the end.
     */
    private ndSetup(
        axes: AxisSpec[],
        feat: ReturnType<GameService["ndFeatures"]>,
        edited: boolean,
        transformed: boolean,
    ): string[] {
        const loops = axes.filter(a => isCircular(a));
        const lines: string[] = [];
        if (feat.constructDistance) lines.push(ONE_STEP_NOTE);
        /*
         * The compact convention has to be stated or the item is not derivable:
         * without it, an axis left out is indistinguishable from an axis with
         * no difference, and the conclusion may ask about exactly that axis.
         */
        if (feat.compact) lines.push(COMPACT_NOTE);
        if (edited) lines.push(EDIT_NOTE);
        /*
         * Same argument as the loop note below: the axis key is the one thing
         * an operation name depends on that the premises never state. "XT-
         * rotated" is guessable only if X and T have been identified.
         */
        if (transformed) {
            lines.push(ND_TRANSFORM_NOTE);
            lines.push(describeNdAxes(axes));
        }
        if (!loops.length) return lines;
        lines.push(loops.length === 1
            ? `The <b>${loops[0].scale.direction[0]}/${loops[0].scale.direction[1]}</b> axis is a loop of <b>${loops[0].modulus}</b>; it wraps around.`
            : `Two axes are loops that wrap around: `
              + loops.map(l => `<b>${l.scale.direction[0]}/${l.scale.direction[1]}</b> (${l.modulus})`).join(" and ") + ".");
        return lines;
    }

    /** Which structural modifiers this mode's ladder has earned. */
    private hierarchyFeatures() {
        const type = EnumQuestionType.Hierarchy;
        const ladder = (r: string) => this.progressionService.hasRung(type, r);
        const forced = <K extends keyof LinearFeatureFlags>(k: K) =>
            this.settingsOverrideService.linearOverride(k);

        const pick = (key: "multiConclusion" | "chooseConclusion", rung: string) => {
            const f = forced(key);
            return f === null ? ladder(rung) : !!f;
        };

        return {
            // Two links is a stated premise plus one hop; three is where you
            // have to hold a route rather than a pair.
            minSpan: ladder("min-span-3") ? 3 : 2,
            cycles: ladder("cycles"),
            multiConclusion: pick("multiConclusion", "multi-conclusion"),
            chooseConclusion: pick("chooseConclusion", "choose-conclusion"),
        };
    }

    /**
     * Directed reachability (engine in `utils/hierarchy.utils.ts`).
     *
     * Premises are direct links; the question is whether one thing reaches
     * another along any number of steps. The only mode in the app about
     * connectivity rather than position, and the only one where the answer does
     * not compose by arithmetic.
     */
    createHierarchy(numOfPremises: number): Question {
        this.logger.info("createHierarchy");

        const settings = this.settings;
        const type = EnumQuestionType.Hierarchy;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const feat = this.hierarchyFeatures();

        /*
         * Fewer nodes than links, so the spanning structure leaves room for the
         * extra routes. With one link per node the graph is a bare tree, every
         * pair has exactly one path, and there is nothing to weigh up.
         */
        const nodeCount = Math.max(4, Math.ceil(numOfPremises * 0.75) + 1);

        for (let attempt = 0; attempt < 300; attempt++) {
            const nodes = getRandomSymbols(settings, nodeCount);
            const layout = buildHierarchy(nodes, {
                cycles: feat.cycles,
                edgeCount: numOfPremises,
            });
            // The premise count is a promise; a graph that could not take the
            // requested number of links is discarded rather than shipped short.
            if (layout.edges.length !== numOfPremises) continue;

            const question = new Question(type);
            if (!this.fillHierarchyConclusion(question, layout, feat)) continue;

            question.premises = scrambleByFactor(
                layout.edges.map(renderHierarchyPremise),
                this.settingsOverrideService.scramble);
            question.bucket = [...nodes];
            question.setup = [HIERARCHY_NOTE];
            return question;
        }

        throw new Error("Cannot generate.");
    }

    private fillHierarchyConclusion(
        question: Question,
        layout: HierarchyLayout,
        feat: ReturnType<GameService["hierarchyFeatures"]>,
    ): boolean {
        if (feat.chooseConclusion) {
            const set = buildHierarchyQuerySet(layout, 4, [true, false, false, false], feat.minSpan);
            if (set.length < 4) return false;
            const order = shuffle(set.map((_, i) => i));
            question.choices = order.map(i => renderHierarchyConclusion(set[i]));
            question.correctChoice = order.indexOf(0);
            question.answerMode = "choice";
            question.isValid = true;
            question.conclusion = "";
            return true;
        }

        if (feat.multiConclusion) {
            const count = 2 + Math.floor(Math.random() * 2);
            const allTrue = coinFlip();
            const wants = Array(count).fill(true);
            if (!allTrue) wants[Math.floor(Math.random() * count)] = false;

            const set = buildHierarchyQuerySet(layout, count, wants, feat.minSpan);
            if (set.length < count) return false;
            question.conclusion = set.map(renderHierarchyConclusion);
            question.isValid = allTrue;
            return true;
        }

        const q = pickHierarchyQuery(layout, coinFlip(), feat.minSpan);
        if (!q) return false;
        question.conclusion = renderHierarchyConclusion(q);
        question.isValid = q.isValid;
        // Nothing mutates a hierarchy after it is stated, so this is always safe.
        question.explanation = explainHierarchy(layout, q);
        return true;
    }

    createAnchorSpace(numOfPremises: number) {
        this.logger.info("createAnchorSpace");

        const settings = this.settings;
        const type = EnumQuestionType.AnchorSpace;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const question = new Question(type);
        const objectCount = numOfPremises;

        for (let attempt = 0; attempt < 400; attempt++) {
            const names = getRandomSymbols(settings, objectCount);
            const coords = anchorCoordMap();

            // Each object is pinned to one anchor. Recording which anchor lets us
            // reject pairs that share one — those are comparable directly, without
            // routing through the frame, which is the skill being trained.
            const anchorOf: Record<string, string> = {};
            const taken = new Set(Object.values(coords).map(c => c.join(",")));

            for (const n of names) {
                const anchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
                let c: number[];
                do {
                    c = anchor.coord.map(v => v + Math.floor(Math.random() * 7) - 3);
                } while (taken.has(c.join(",")));
                taken.add(c.join(","));
                coords[n] = c;
                anchorOf[n] = anchor.token;
            }

            const [x, y] = pickUniqueItems(names, 2).picked;
            if (anchorOf[x] === anchorOf[y]) continue;

            const axisOrder = [0, 1];
            shuffle(axisOrder);
            const axes = axisOrder.filter(ax => coords[y][ax] !== coords[x][ax]);
            if (!axes.length) continue;

            const conclusion = describeConclusion(x, y, coords[x], coords[y], axes[0], coinFlip());
            if (!conclusion) continue;

            question.bucket = names;
            question.premises = scrambleByFactor(
                names.map(n => describeOffset(anchorOf[n], n, coords[anchorOf[n]], coords[n])),
                this.settingsOverrideService.scramble);
            question.conclusion = conclusion.text;
            question.isValid = conclusion.isValid;
            return question;
        }

        throw new Error("Cannot generate.");
    }

    /**
     * Extra transforms from the ladder plus any manual setting. Applied by
     * shifting the split between layout and transform premises, never by adding
     * premises on top.
     */
    private extraTransforms(type: EnumQuestionType) {
        return this.progressionService.depthBonusFor(type)
             + this.settingsOverrideService.depthFor(type);
    }

    createAnchorSpaceV2(numOfPremises: number) {
        this.logger.info("createAnchorSpaceV2");

        const settings = this.settings;
        const type = EnumQuestionType.AnchorSpaceV2;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const question = new Question(type);
        const extra = this.extraTransforms(type);
        const objectCount = Math.max(2, Math.ceil(numOfPremises / 2) - extra);
        const transformCount = Math.max(1, numOfPremises - objectCount);

        for (let attempt = 0; attempt < 400; attempt++) {
            const names = getRandomSymbols(settings, objectCount);
            const initial = anchorCoordMap();
            const anchorOf: Record<string, string> = {};
            const taken = new Set(Object.values(initial).map(c => c.join(",")));

            for (const n of names) {
                const anchor = ANCHORS[Math.floor(Math.random() * ANCHORS.length)];
                let c: number[];
                do {
                    c = anchor.coord.map(v => v + Math.floor(Math.random() * 7) - 3);
                } while (taken.has(c.join(",")));
                taken.add(c.join(","));
                initial[n] = c;
                anchorOf[n] = anchor.token;
            }

            // Markers are pivots, never movers — that is what keeps the frame
            // fixed while everything measured against it moves.
            const pivots = [...ANCHORS.map(a => a.token), ...names];
            // Same dedupe as Transformation; 2D has a smaller descriptor space, so
            // collisions are correspondingly more likely here.
            const transforms: Transform[] = [];
            const seenTransforms = new Set<string>();
            for (let guard = 0; transforms.length < transformCount && guard < transformCount * 25; guard++) {
                const b = names[Math.floor(Math.random() * names.length)];
                const candidates = pivots.filter(p => p !== b);
                const a = candidates[Math.floor(Math.random() * candidates.length)];
                const kind = pickUniqueItems<TransformKind>(["mirror", "set", "scale", "rotate"], 1).picked[0];
                const t: Transform = kind === "rotate"
                    ? { kind, a, b, plane: [0, 1], clockwise: coinFlip() }
                    : { kind, a, b, dimension: Math.floor(Math.random() * 2) };
                const key = describeTransform(t);
                if (seenTransforms.has(key)) continue;
                seenTransforms.add(key);
                transforms.push(t);
            }
            if (transforms.length < transformCount) continue;

            const final = replay(initial, transforms);

            // The frame must survive intact; a moved marker would invalidate every
            // premise stated against it.
            if (ANCHORS.some(a => final[a.token].join(",") !== a.coord.join(","))) continue;

            const [x, y] = pickUniqueItems(names, 2).picked;

            // Layout premises always pin to an anchor, so only a transform can name
            // both queried objects — and that would state their relation directly.
            if (transforms.some(t => (t.a === x && t.b === y) || (t.a === y && t.b === x))) continue;

            const axisOrder = [0, 1];
            shuffle(axisOrder);
            const axes = axisOrder.filter(ax => final[y][ax] !== final[x][ax]);
            if (!axes.length) continue;

            const conclusion = describeConclusion(x, y, final[x], final[y], axes[0], coinFlip());
            if (!conclusion) continue;

            // Reject items the transforms did not actually change at the queried
            // pair — those are answerable from the layout premises alone.
            const before = describeConclusion(x, y, initial[x], initial[y], axes[0], true);
            const after = describeConclusion(x, y, final[x], final[y], axes[0], true);
            if (before && after && before.isValid === after.isValid) continue;

            question.bucket = names;
            question.premises = scrambleLeading(
                [
                    ...names.map(n => describeOffset(anchorOf[n], n, initial[anchorOf[n]], initial[n])),
                    ...transforms.map(t => describeTransform(t)),
                ],
                names.length,
                this.settingsOverrideService.scramble);
            question.conclusion = conclusion.text;
            question.isValid = conclusion.isValid;
            return question;
        }

        throw new Error("Cannot generate.");
    }

    createTransformation(numOfPremises: number) {
        this.logger.info("createTransformation");

        const settings = this.settings;
        const type = EnumQuestionType.Transformation;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const question = new Question(type);

        // Premises split between fixing the starting layout (objects - 1) and
        // mutating it (the rest), so both halves scale with the requested count.
        const baseObjects = Math.max(3, Math.min(6,
            numOfPremises - Math.max(1, Math.round(numOfPremises / 2)) + 1));

        /*
         * Depth trades objects for transforms, but only down to four objects.
         * Below that the layout chain states almost every pair outright, so the
         * "not directly related" and "transforms must change the pair" guards
         * leave nothing to ask about and generation fails. Applying only the
         * affordable share keeps low premise counts generatable.
         */
        const affordableExtra = Math.max(0, baseObjects - 4);
        const objectCount = baseObjects - Math.min(this.extraTransforms(type), affordableExtra);
        const transformCount = Math.max(1, numOfPremises - objectCount + 1);

        for (let attempt = 0; attempt < 400; attempt++) {
            const names = getRandomSymbols(settings, objectCount);

            // Distinct starting positions; a duplicate would make an offset
            // premise ambiguous about which object it pins.
            const initial: CoordMap = {};
            const taken = new Set<string>();
            for (const n of names) {
                let c: number[];
                do {
                    c = [0, 0, 0].map(() => Math.floor(Math.random() * 7) - 3);
                } while (taken.has(c.join(",")));
                taken.add(c.join(","));
                initial[n] = c;
            }

            // Chain the layout premises so every object is pinned to the previous.
            const layoutPremises = names.slice(1).map((n, i) =>
                describeOffset(names[i], n, initial[names[i]], initial[n]));

            /*
             * Descriptors are drawn independently, so with few objects the same one
             * can come up twice and render as two identical premise lines. A repeated
             * "set" is a literal no-op (it is idempotent), so dedupe on the rendered
             * text. Repeating a *pair* with a different operation stays allowed —
             * that is meaningful.
             */
            const transforms: Transform[] = [];
            const seenTransforms = new Set<string>();
            for (let guard = 0; transforms.length < transformCount && guard < transformCount * 25; guard++) {
                const [b, a] = pickUniqueItems(names, 2).picked;
                const kind = pickUniqueItems<TransformKind>(["mirror", "set", "scale", "rotate"], 1).picked[0];
                const t: Transform = kind === "rotate"
                    ? { kind, a, b, plane: pickUniqueItems([0, 1, 2], 2).picked.sort((x, y) => x - y) as [number, number], clockwise: coinFlip() }
                    : { kind, a, b, dimension: Math.floor(Math.random() * 3) };
                const key = describeTransform(t);
                if (seenTransforms.has(key)) continue;
                seenTransforms.add(key);
                transforms.push(t);
            }
            if (transforms.length < transformCount) continue;

            const final = replay(initial, transforms);

            // Ask about an axis the two objects actually differ on; a tie has no
            // direction word and cannot be phrased as a true/false claim.
            const [x, y] = pickUniqueItems(names, 2).picked;

            /*
             * A single premise relating both queried objects hands over the answer
             * (or its starting value) directly, so the item tests reading rather
             * than tracking. Layout premises chain consecutive objects and a
             * transform names its own pair, so both are checked. Compared
             * structurally, not by substring — one stimulus name can contain
             * another ("Ant" inside "Antlers").
             */
            const statedTogether = (p: string, q: string) =>
                names.some((n, i) => i > 0 && ((names[i - 1] === p && n === q) || (names[i - 1] === q && n === p)))
                || transforms.some(t => (t.a === p && t.b === q) || (t.a === q && t.b === p));
            if (statedTogether(x, y)) continue;

            const axisOrder = [0, 1, 2];
            shuffle(axisOrder);
            const axes = axisOrder.filter(ax => final[y][ax] !== final[x][ax]);
            if (!axes.length) continue;

            const conclusion = describeConclusion(x, y, final[x], final[y], axes[0], coinFlip());
            if (!conclusion) continue;

            // Reject items the transforms left untouched at the queried pair —
            // those are answerable from the layout premises alone.
            const before = describeConclusion(x, y, initial[x], initial[y], axes[0], true);
            const after = describeConclusion(x, y, final[x], final[y], axes[0], true);
            if (before && after && before.isValid === after.isValid) continue;

            question.bucket = names;
            question.premises = scrambleLeading(
                [...layoutPremises, ...transforms.map(t => describeTransform(t))],
                layoutPremises.length,
                this.settingsOverrideService.scramble);
            question.conclusion = conclusion.text;
            question.isValid = conclusion.isValid;
            return question;
        }

        throw new Error("Cannot generate.");
    }

    createDeictic(numOfPremises: number) {
        this.logger.info("createDeictic");

        const settings = this.settings;
        const type = EnumQuestionType.Deictic;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const question = new Question(type);

        /*
         * Bounded, and deliberately NOT using isPremiseLikeConclusion: that helper
         * compares subjects[0] + subjects[1] and so assumes two-subject premises.
         * Deictic statements carry a single subject, so both sides stringify with a
         * trailing "undefined" and the claimed symbol always comes from the grid —
         * it matched every time and span forever. An exact restatement check is what
         * is actually wanted here.
         */
        for (let attempt = 0; attempt < 200; attempt++) {
            // 3 axes need 8 grid symbols; ask for the max so either width fits.
            const symbols = getRandomSymbols(settings, 8);
            const spec = buildDeicticSpec(numOfPremises, symbols);
            const cells = allCoords(spec.axes.length);

            question.bucket = cells.map(c => spec.grid[coordKey(c)]);

            const gridPremises = cells.map(c =>
                statementFor(spec.axes, c, spec.grid[coordKey(c)])
            );

            // Reversals are stated after the grid: they operate on facts already
            // fixed, so presenting them first would read as nonsense.
            const reversalPremises: string[] = [];
            spec.reversals.forEach((count, axis) => {
                for (let i = 0; i < count; i++) {
                    reversalPremises.push(reversalTextFor(spec.axes[axis]));
                }
            });
            shuffle(gridPremises);
            shuffle(reversalPremises);
            question.premises = scrambleByFactor(
                [...gridPremises, ...reversalPremises],
                this.settingsOverrideService.scramble);

            const uttered = cells[Math.floor(Math.random() * cells.length)];
            const correct = answerFor(spec, uttered);

            // A false conclusion names some other cell's symbol, so rejecting it
            // still requires resolving the perspective rather than spotting a
            // symbol that never appeared.
            const claimed = coinFlip()
                ? correct
                : pickUniqueItems(question.bucket.filter(s => s !== correct), 1).picked[0];

            question.conclusion = statementFor(spec.axes, uttered, claimed);
            question.isValid = verifyAnswer(spec, uttered, claimed);

            if (question.premises.includes(question.conclusion as string)) continue;
            return question;
        }

        throw new Error("Cannot generate.");
    }

    createArrangement(numOfPremises: number, type: EnumQuestionType.LinearArrangement | EnumQuestionType.CircularArrangement): Question {
        this.logger.info("createArrangement:", type);

        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const numOfEls = numOfPremises + 1;
        const isLinear = type === EnumQuestionType.LinearArrangement;
        const getWays = isLinear ? getLinearWays : getCircularWays;
        const symbols = getSymbols(settings);
        const words = pickUniqueItems(symbols, numOfEls).picked;
        const question = new Question(type);
        // Per-item, not a rule: the count varies and the premises never state it.
        question.setup = [`<b>${NUMBER_WORDS[numOfEls] || numOfEls} subjects</b> along a <b>${isLinear ? "linear" : "circular"}</b> path.`];

        const relationshipAlreadyExistent = (a: string, b: string) =>
            premises.find(({ a: pA, b: pB }) => (pA === a && pB === b) || (pA === b && pB === a));

        let premises: IArrangementPremise[] = [];
        let subjects = [...words];
        let a: string | undefined = undefined;
        let safe = 1e2;
        while (safe-- && premises.length < numOfEls - 1) {
            let premise: IArrangementPremise | undefined = undefined;
            let safe = 1e2;
            while (safe-- && premise == undefined) {
                // Pick A
                a = a || pickUniqueItems(subjects, 1).picked[0];
                this.logger.info("a", a);
                const aid = words.indexOf(a);

                // Pick B
                const b = pickUniqueItems(subjects.filter(sub => sub !== a), 1).picked[0];
                this.logger.info("b", b);
                const bid = words.indexOf(b);

                // Pick a way between A and B and check there are no connections already established between A and B
                const [wayDescription, wayData] = pickUniqueItems(Object.entries(getWays(aid, bid, numOfEls)), 1).picked[0];
                if (wayData.possible && !relationshipAlreadyExistent(a, b)) {
                    premise = {
                        a,
                        b,
                        relationship: {
                            description: wayDescription as EnumArrangements,
                            steps: wayData.steps
                        },
                        metaRelationships: [],
                        uid: guid()
                    };
                    subjects = subjects.filter(s => s !== a && s !== b)
                    a = b;
                }
            }
            if (safe <= 0) {
                throw new Error("MAXIMUM ITERATION COUNT REACHED!");
            }
            premises.push(premise!);
        }
        if (safe <= 0) {
            throw new Error("MAXIMUM ITERATION COUNT REACHED!");
        }

        horizontalShuffleArrangement(premises);
        shuffle(premises);
        metarelateArrangement(premises);

        let b: string | undefined = undefined;
        safe = 1e2;
        while (safe-- && b == undefined) {
            const subject = pickUniqueItems(words, 1).picked[0];
            if (subject !== a && !relationshipAlreadyExistent(a!, subject)) {
                b = subject;
            }
        }
        if (safe <= 0) {
            throw new Error("MAXIMUM ITERATION COUNT REACHED!");
        }

        const [aid, bid] = [words.indexOf(a!), words.indexOf(b!)];
        const ways = getWays(aid, bid, numOfEls, true);
        this.logger.info("a", a);
        this.logger.info("a", b);
        this.logger.info("ways", ways);

        question.isValid = coinFlip();
        const conclusions = Object.entries(ways).filter(([description, data]) => data.possible === question.isValid);
        const picked = pickUniqueItems(conclusions, 1).picked[0];
        const description = picked[0] as EnumArrangements;
        const steps = picked[1].steps;
        const interpolated = interpolateArrangementRelationship({ description, steps }, settings);
        question.conclusion = `<span class="subject">${a}</span> ${interpolated} <span class="subject">${b}</span>`;

        // Next to relationship with 3 elements are useless, in that case regenerate
        if (!isLinear && numOfEls === 3 && interpolated === EnumArrangements.Next) {
            return this.createArrangement(numOfPremises, type);
        }

        question.rule = words.join(", ");
        const metaRelationshipLookupMap: Record<string, boolean> = {};
        question.premises = premises.map(({ a, b, relationship, metaRelationships, uid }) => {
            if (settings.enabled.meta && coinFlip() && metaRelationships.length && !metaRelationshipLookupMap[uid]) {
                const premise = pickUniqueItems(metaRelationships, 1).picked[0];
                metaRelationshipLookupMap[premise.uid] = true;
                return `<span class="subject">${a}</span> to <span class="subject">${b}</span> has the same relation as <span class="subject">${premise.a}</span> to <span class="subject">${premise.b}</span>`;
            }

            const { description, steps } = relationship;
            const interpolated = interpolateArrangementRelationship({ description, steps }, settings);
            return `<span class="subject">${a}</span> ${interpolated} <span class="subject">${b}</span>`;
        });

        return question;
    }

    createDirection(numOfPremises: number): Question {
        this.logger.info("createDirection");

        const type = EnumQuestionType.Direction;
        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const numOfEls = numOfPremises + 1;
        const symbols = getSymbols(settings);
        const words = pickUniqueItems(symbols, numOfEls).picked;
        const question = new Question(type);

        const sideSize = 1 + Math.round(Math.sqrt(numOfEls));

        const cardinalOppositeMap: Record<string, string> = {
            "North": "South",
            "South": "North",
            "East": "West",
            "West": "East"
        };

        // Give random coords to each subject
        const coords: [string, number, number][] = [];
        let pool = [...words];
        while (pool.length) {
            let ri: number | undefined;
            let rj: number | undefined;
            while (ri == null || rj == null || coords.find(([_, x, y]) => ri === x && rj === y)) {
                ri = Math.floor(Math.random() * sideSize);
                rj = Math.floor(Math.random() * sideSize);
            }
            const { picked, remaining } = pickUniqueItems(pool, 1);
            coords.push([picked[0], ri, rj]);
            pool = remaining;
        }
        question.coords = coords;
        this.logger.info("Coords", coords);

        // Create pairs of subjects
        let copyOfCoords = [...coords];
        const pairs: [typeof coords[0], typeof coords[0]][] = [];
        const pairAlreadyEstablished = (a: string, b: string) =>
            pairs.find(([x, y]) => (x[0] === a && y[0] === b) || (x[0] === b && y[0] === a));
        for (let i = 0; i < numOfEls - 1; i++) {
            const { picked, remaining } = pickUniqueItems(copyOfCoords, 1);
            const subject = i === 0
                ? pickUniqueItems(remaining, 1).picked[0]
                : pickUniqueItems(pairs, 1).picked[0][Math.floor(Math.random() * 2)];
            const a = picked[0][0];
            const b = subject[0];
            if (a === b || pairAlreadyEstablished(a, b)) {
                i--;
                continue;
            }
            pairs.push([picked[0], subject]);
            copyOfCoords = remaining;
        }

        const usedCoords = Object.values(
            pairs.reduce((a, c) => {
                a[c[0][0]] = c[0];
                a[c[1][0]] = c[1];
                return a;
            }, {} as Record<string, typeof coords[0]>)
        );

        // Add one more pair that will represent the conclusion
        let coorda!: typeof coords[0];
        let coordb!: typeof coords[0];
        let safe = 1e2;
        while (safe-- && (!coorda || !coordb || pairAlreadyEstablished(coorda[0], coordb[0]))) {
            [coorda, coordb] = pickUniqueItems(usedCoords, 2).picked;
        }

        if (safe < 1) {
            this.logger.error("MAXIMUM ITERATION COUNT REACHED!");
            return this.createDirection(numOfPremises);
        }

        pairs.push([coorda, coordb]);
        this.logger.info("Pairs", pairs);

        // Calculate cardinals and relationship of each pair
        const premises: IDirectionProposition[] = [];

        const getRelationship = (cardinals: [string, number][], tweaked = false) => {
            let relationship = "";

            if (!tweaked && cardinals.every(c => c[1] === 1)) {
                relationship = "adjacent and " + cardinals[0][0];

                if (cardinals.length === 2) {
                    relationship += "-" + cardinals[1][0];
                }
            } else {
                const numStepsVertical = NUMBER_WORDS[cardinals[0][1]] || cardinals[0][1];
                relationship = numStepsVertical + " step" + (cardinals[0][1] > 1 ? "s" : "") + " " + cardinals[0][0];

                if (cardinals.length === 2) {
                    const numStepsHorizontal = NUMBER_WORDS[cardinals[1][1]] || cardinals[1][1];
                    relationship += " and " + numStepsHorizontal + " step" + (cardinals[1][1] > 1 ? "s" : "") + " " + cardinals[1][0];
                }
            }

            return relationship;
        };

        for (const pair of pairs) {
            const [subja, subjb] = pair;
            const [a, ax, ay] = subja;
            const [b, bx, by] = subjb;

            const cardinals: [string, number][] = [];
            const diffy = ay - by;
            const absdiffy = Math.abs(diffy);
            const diffx = ax - bx;
            const absdiffx = Math.abs(diffx);

            if (diffy > 0) {
                cardinals.push(["North", absdiffy]);
            } else if (diffy < 0) {
                cardinals.push(["South", absdiffy]);
            }

            if (diffx > 0) {
                cardinals.push(["East", absdiffx]);
            } else if (diffx < 0) {
                cardinals.push(["West", absdiffx]);
            }

            premises.push({
                pair,
                cardinals,
                relationship: getRelationship(cardinals),
                uid: guid()
            })
        }
        this.logger.info("Premises", premises);

        // Sanity check, this fixes a bug with analogy questions
        if (new Set(premises.map(x => x.pair[0][0])).size !== coords.length) {
            this.logger.error("Missing subject in premises");
            return this.createDirection(numOfPremises);
        }

        // Extract the last premise and say it's the conclusion
        // Flip a coin and either keep or tweak the conclusion
        let conclusion = premises.pop()!;
        let tweaked = false;
        const isValid = coinFlip();
        if (isValid) {
            this.logger.info("Keep conclusion");
        } else {
            this.logger.info("Tweak conclusion");
            const rndIdx = Math.floor(Math.random() * conclusion.cardinals.length);
            if (coinFlip()) {
                this.logger.info("Add one to one cardinal");
                conclusion.cardinals[rndIdx][1]++;
            } else {
                this.logger.info("One cardinal flipped");
                conclusion.cardinals[rndIdx][0] = cardinalOppositeMap[conclusion.cardinals[rndIdx][0]];
            }
            tweaked = true;
        }
        // Regenerate conclusion relationship
        conclusion.relationship = getRelationship(conclusion.cardinals, tweaked);
        this.logger.info("Conclusion", conclusion);

        const negateRelationship = (relationship: string) => {
            return relationship.replaceAll(/(north|south|east|west)/gi, substr => {
                if (coinFlip()) {
                    question.negations++;
                    return `<span class="is-negated">${cardinalOppositeMap[substr]}</span>`;
                }
                return substr;
            });
        };

        const stringifyProposition = (p: IDirectionProposition) => {
            const relationship = settings.enabled.negation ? negateRelationship(p.relationship) : p.relationship;
            return `<span class="subject">${p.pair[0][0]}</span> is ${relationship} of <span class="subject">${p.pair[1][0]}</span>`;
        };

        shuffle(premises);
        question.isValid = isValid;
        question.premises = premises.map(stringifyProposition);
        question.conclusion = stringifyProposition(conclusion);
        question.notes = [
            "Cardinal directions are strict and direct (e.g., \"north\" means exactly north, not \"north-east\" or \"north-west\")"
        ];

        // TODO: Create meta relationship

        return question;
    }

    createDirection3D(numOfPremises: number, type: EnumQuestionType.Direction3DSpatial | EnumQuestionType.Direction3DTemporal): Question {
        this.logger.info("createDirection3D");

        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const numOfEls = numOfPremises + 1;
        const symbols = getSymbols(settings);
        const words = pickUniqueItems(symbols, numOfEls).picked;
        const question = new Question(type);
        const isSpatial = type === EnumQuestionType.Direction3DSpatial;

        const sideSize = 1 + Math.round(Math.cbrt(numOfEls));

        const trasversalOpposite: Record<string, string> = {
            "before": "after",
            "after": "before",
            "below": "above",
            "above": "below"
        };
        const cardinalOppositeMap: Record<string, string> = {
            "North": "South",
            "South": "North",
            "East": "West",
            "West": "East"
        };

        // Give random coords to each subject
        const coords: [string, number, number, number][] = [];
        const alreadyHasCoords = (ri: number, rj: number, rk: number) => {
            return coords.find(([_, x, y, k]) =>
                ri === x && rj === y && rk === k
            );
        };
        let pool = [...words];
        while (pool.length) {
            let ri: number | undefined;
            let rj: number | undefined;
            let rt: number | undefined;
            while (ri == null || rj == null || rt == null || alreadyHasCoords(ri, rj, rt)) {
                ri = Math.floor(Math.random() * sideSize);
                rj = Math.floor(Math.random() * sideSize);
                rt = Math.floor(Math.random() * sideSize);
            }
            const { picked, remaining } = pickUniqueItems(pool, 1);
            coords.push([picked[0], ri, rj, rt]);
            pool = remaining;
        }
        this.logger.info("All coords", coords);

        // Create pairs of subjects
        let copyOfCoords = [...coords];
        const pairs: [typeof coords[0], typeof coords[0]][] = [];
        const subjectsAlreadyIncluded = (a: string, b: string) =>
            pairs.find(([x, y]) => (x[0] === a && y[0] === b) || (x[0] === b && y[0] === a));
        for (let i = 0; i < numOfEls - 1; i++) {
            const { picked, remaining } = pickUniqueItems(copyOfCoords, 1);
            const subject = i === 0
                ? pickUniqueItems(remaining, 1).picked[0]
                : pickUniqueItems(pairs, 1).picked[0][Math.floor(Math.random() * 2)];
            const a = picked[0][0];
            const b = subject[0];
            if (a === b || subjectsAlreadyIncluded(a, b)) {
                i--;
                continue;
            }
            pairs.push([picked[0], subject]);
            copyOfCoords = remaining;
        }

        const usedCoords = Object.values(
            pairs.reduce((a, c) => {
                a[c[0][0]] = c[0];
                a[c[1][0]] = c[1];
                return a;
            }, {} as Record<string, typeof coords[0]>)
        );
        question.coords3D = usedCoords;
        this.logger.info("Used coords", usedCoords);

        // Add one more pair that will represent the conclusion
        let coorda!: typeof coords[0];
        let coordb!: typeof coords[0];
        let safe = 1e2;
        while (safe-- && (!coorda || !coordb || subjectsAlreadyIncluded(coorda[0], coordb[0]))) {
            [coorda, coordb] = pickUniqueItems(usedCoords, 2).picked;
        }

        if (safe < 1) {
            this.logger.error("MAXIMUM ITERATION COUNT REACHED!");
            return this.createDirection3D(numOfPremises, type);
        }

        pairs.push([coorda, coordb]);
        this.logger.info("Pairs", pairs);

        // Calculate relationship of each pair
        const premises: IDirection3DProposition[] = [];

        const getTrasversalRelationship = (tdiff: number) => {
            const absdiff = Math.abs(tdiff);
            const s = (absdiff > 1) ? "s" : "";
            const n = NUMBER_WORDS[absdiff] || absdiff;
            if (isSpatial) {
                if (tdiff === 0) {
                    return "on the same level";
                } else if (tdiff < 0) {
                    return `${n} level${s} below`;
                } else {
                    return `${n} level${s} above`;
                }
            } else {
                if (tdiff === 0) {
                    return "at the same time";
                } else if (tdiff < 0) {
                    return `${n} hour${s} before`;
                } else {
                    return `${n} hour${s} after`;
                }
            }
        };

        const SAME_CARDINAL_DIRECTION = "in the same cardinal position";
        const getCardinalRelationship = (_cardinals: [string, number][]) => {
            if (_cardinals.every(c => c[1] === 0)) {
                return SAME_CARDINAL_DIRECTION;
            }

            const cardinals = _cardinals.filter(c => c[1] !== 0);

            let relationship = "";
            const numStepsVertical = NUMBER_WORDS[cardinals[0][1]] || cardinals[0][1];
            const s = cardinals[0][1] > 1 ? "s" : "";

            relationship = `${numStepsVertical} step${s} ${cardinals[0][0]}`;

            if (cardinals.length === 2) {
                const numStepsHorizontal = NUMBER_WORDS[cardinals[1][1]] || cardinals[1][1];
                const s = cardinals[1][1] > 1 ? "s" : "";

                relationship += ` and ${numStepsHorizontal} step${s} ${cardinals[1][0]}`;
            }

            return relationship;
        };

        for (const pair of pairs) {
            const [subja, subjb] = pair;
            const [a, ax, ay, at] = subja;
            const [b, bx, by, bt] = subjb;

            const trasversalDifference = at - bt;

            const cardinals: [string, number][] = [];
            const diffy = ay - by;
            const absdiffy = Math.abs(diffy);
            const diffx = ax - bx;
            const absdiffx = Math.abs(diffx);

            if (diffy > 0) {
                cardinals.push(["North", absdiffy]);
            } else if (diffy < 0) {
                cardinals.push(["South", absdiffy]);
            } else {
                cardinals.push(["!", 0]);
            }

            if (diffx > 0) {
                cardinals.push(["East", absdiffx]);
            } else if (diffx < 0) {
                cardinals.push(["West", absdiffx]);
            } else {
                cardinals.push(["!", 0]);
            }

            const trasversalRelationship = getTrasversalRelationship(trasversalDifference);
            const cardinalRelationship = getCardinalRelationship(cardinals);
            const connector = (cardinalRelationship === SAME_CARDINAL_DIRECTION) ? " and " : (cardinalRelationship.indexOf(" and ") > -1) ? ", " : " and ";
            const relationship = trasversalRelationship + connector + cardinalRelationship;

            premises.push({
                pair,
                trasversalDifference,
                cardinals,
                relationship,
                uid: guid()
            })
        }
        this.logger.info("Premises", premises);

        // Extract the last premise and say it's the conclusion
        // Flip a coin and either keep or tweak the conclusion
        let conclusion = premises.pop()!;
        const isValid = coinFlip();
        if (isValid) {
            this.logger.info("Keep conclusion");

            // Filter out collinear cardinals
            conclusion.cardinals = conclusion.cardinals.filter(c => c[0] !== "!");
        } else {
            this.logger.info("Tweak conclusion");

            if (coinFlip()) {
                this.logger.info("Invert trasversal difference");
                conclusion.trasversalDifference = conclusion.trasversalDifference * -1;
            }

            // Filter out collinear cardinals and zero cardinals
            conclusion.cardinals = conclusion.cardinals.filter(c => c[0] !== "!" && c[1] !== 0);

            if (!conclusion.cardinals.length) {
                return this.createDirection3D(numOfPremises, type);
            }

            const rndIdx = Math.floor(Math.random() * conclusion.cardinals.length);

            if (coinFlip()) {
                this.logger.info("One cardinal flipped");
                conclusion.cardinals[rndIdx][0] = cardinalOppositeMap[conclusion.cardinals[rndIdx][0]];
            } else {
                this.logger.info("Add one to one cardinal");
                conclusion.cardinals[rndIdx][1]++;
            }
        }

        // Regenerate conclusion relationship
        conclusion.trasversalDifference = conclusion.pair[0][3] - conclusion.pair[1][3];
        const trasversalRelationship = getTrasversalRelationship(conclusion.trasversalDifference);
        const cardinalRelationship = getCardinalRelationship(conclusion.cardinals);
        const connector = (cardinalRelationship === SAME_CARDINAL_DIRECTION) ? " and " : (cardinalRelationship.indexOf(" and ") > -1) ? ", " : " and ";
        conclusion.relationship = trasversalRelationship + connector + cardinalRelationship;
        this.logger.info("Conclusion", conclusion);

        const negateRelationship = (relationship: string) => {
            return relationship
                .replaceAll(/(before|after|below|above)/gi, substr => {
                    if (coinFlip()) {
                        question.negations++;
                        return `<span class="is-negated">${trasversalOpposite[substr]}</span>`;
                    }
                    return substr;
                })
                .replaceAll(/(north|south|east|west)/gi, substr => {
                    if (coinFlip()) {
                        question.negations++;
                        return `<span class="is-negated">${cardinalOppositeMap[substr]}</span>`;
                    }
                    return substr;
                });
        };

        const stringifyProposition = (p: IDirection3DProposition) => {
            const relationship = settings.enabled.negation ? negateRelationship(p.relationship) : p.relationship;
            return `<span class="subject">${p.pair[0][0]}</span> is ${relationship} of <span class="subject">${p.pair[1][0]}</span>`;
        };

        shuffle(premises);
        question.isValid = isValid;
        question.premises = premises.map(stringifyProposition);
        question.conclusion = stringifyProposition(conclusion);
        question.notes = [
            "Cardinal directions are strict and direct (e.g., \"north\" means exactly north, not \"north-east\" or \"north-west\")"
        ];

        // TODO: Create meta relationship

        return question;
    }

    createGraphMatching(numOfPremises: number): Question {
        this.logger.info("createGraphMatching");

        const type = EnumQuestionType.GraphMatching;
        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const numOfEls = numOfPremises + 1;
        const symbols = getSymbols(settings);
        const words = pickUniqueItems(symbols, numOfEls).picked;
        const question = new Question(type);

        let edgeList: [string, "↔" | "→" | "←", string][] = [];
        const inverseMap = { "→": "←", "←": "→" } as Record<"→" | "←", | "→" | "←">;
        const _words = [...words];
        const isWordUsed = (w: string) => edgeList.reduce((a, c) => (a.add(c[0]), a.add(c[2]), a), new Set() as Set<string>).has(w);
        const notAllUsed = () => _words.some(w => !isWordUsed(w));
        const edgeAlreadyExists = (a: string, b: string) => edgeList.some(([_a, _, _b]) => (_a === a && _b === b) || (_a === b && _b === a));
        let safe = 1e3;
        while (safe-- && notAllUsed()) {
            const [a, b] = pickUniqueItems(_words, 2).picked;
            if (edgeAlreadyExists(a, b)) {
                continue;
            }
            const newEdge = (Math.random() < 0.25)
                ? [a, "↔", b]
                : coinFlip()
                    ? [a, "→", b]
                    : [a, "←", b];
            edgeList.push(newEdge as [string, "↔" | "→" | "←", string]);
            if (_words.length > 2 && coinFlip()) {
                const subject = coinFlip() ? a : b;
                const foundIdx = _words.indexOf(subject);
                _words.splice(foundIdx, 1);
            }
        }
        if (safe <= 0) {
            throw new Error("MAXIMUM NUMBER OF ITERATIONS REACHED!");
        }

        const edgeDiscrepancyCount = edgeList.length !== numOfPremises;
        const all3ElementsAre2Way = numOfEls === 3 && edgeList.every(([a, rel, b]) => rel === "↔");
        if (edgeDiscrepancyCount || all3ElementsAre2Way) {
            return this.createGraphMatching(numOfPremises);
        }

        const newWords = pickUniqueItems(symbols, numOfEls).picked;
        let edgeList2: typeof edgeList = edgeList.map(([a, rel, b]) => ([
            newWords[words.indexOf(a)],
            rel,
            newWords[words.indexOf(b)]
        ]));

        question.isValid = coinFlip();
        if (!question.isValid) {
            this.logger.info("Modifying graph in an invalid way");

            while (areGraphsIsomorphic(edgeList, edgeList2)) {
                const { picked } = pickUniqueItems(edgeList2, 1);
                const [a, rel, b] = picked[0];

                if (rel === "→" || rel === "←") {
                    if (Math.random() < 0.15) {
                        this.logger.info("Swap 1-way for 2-way");
                        picked[0][1] = "↔";
                    } else if (coinFlip()) {
                        this.logger.info("Rotate 1-way direction");
                        picked[0][1] = inverseMap[picked[0][1] as "→" | "←"] as "→" | "←";
                    }
                } else if (Math.random() < 0.15) {
                    this.logger.info("Swap 2-way for 1-way");
                    picked[0][1] = { "true": "→", "false": "←" }[String(coinFlip())] as "→" | "←";
                }

                if (coinFlip() && numOfEls > 3) {
                    const rndBool = coinFlip();
                    const bool2subject: Record<string, number> = { "true": 0, "false": 2 };
                    const subjectPosIdx = bool2subject[String(rndBool)];
                    const subjectNegIdx = bool2subject[String(!rndBool)];
                    const { picked: picked2 } = pickUniqueItems(edgeList2, 1);
                    let picked;
                    while (!picked || picked === picked2[0][subjectPosIdx] || picked === picked2[0][subjectNegIdx]) {
                        picked = pickUniqueItems(newWords, 1).picked[0];
                    }
                    this.logger.info("Change an edge by connecting a/b to a different subject", [picked2[0][subjectPosIdx], picked]);
                    picked2[0][subjectPosIdx] = picked;
                }
            }
        }

        const horizontalShuffle = (_edgeList: typeof edgeList) =>
            _edgeList.map(([a, rel, b]) => {
                this.logger.info("Before", [a, rel, b]);
                let result;
                if (coinFlip() && (rel === "→" || rel === "←")) {
                    result = [b, inverseMap[rel], a];
                } else {
                    result = [a, rel, b];
                }
                this.logger.info("After", result);
                return result;
            }) as typeof edgeList;

        shuffle(edgeList);
        edgeList = horizontalShuffle(edgeList);
        question.graphPremises = edgeList;
        this.logger.info("EdgeList", edgeList);

        shuffle(edgeList2);
        edgeList2 = horizontalShuffle(edgeList2);
        question.graphConclusion = edgeList2;
        this.logger.info("EdgeList2", edgeList2);

        const usedEdges = new Set<string>();
        const readable = (edges: typeof edgeList, edge: typeof edgeList[0], negated = false, meta = false) => {
            const getSubject = (subject: string) => `<span class="subject">${subject}</span>`;
            const readMap = {
                "→": "goes to",
                "←": "comes from",
                "↔": "is connected to"
            };
            let relationship = readMap[edge[1]];
            let isMetaRelated = false;
            if (meta) {
                const getEdgeKey = (edge: typeof edgeList[0]) => [...edge].join(";");
                const edgeKey = getEdgeKey(edge);
                const pickedEdge = pickUniqueItems(edges, 1).picked[0];
                const pickedEdgeKey = getEdgeKey(pickedEdge);
                if (
                    !usedEdges.has(pickedEdgeKey) &&
                    edgeKey !== pickedEdgeKey &&
                    edge[1] === pickedEdge[1]
                ) {
                    usedEdges.add(edgeKey);
                    usedEdges.add(pickedEdgeKey);
                    if (coinFlip() && edge[1] !== "↔") {
                        relationship = `the inverse of ${getSubject(pickedEdge[2])} to ${getSubject(pickedEdge[0])}`;
                    } else {
                        relationship = `${getSubject(pickedEdge[0])} is to ${getSubject(pickedEdge[2])}`;
                    }
                    isMetaRelated = true;
                    this.logger.info("Metarelated");
                    question.metaRelations++;
                }
            } else if (negated && (edge[1] === "→" || edge[1] === "←")) {
                this.logger.info("Negated");
                question.negations++;
                relationship = `<span class="is-negated">${readMap[inverseMap[edge[1]]]}</span>`;
            }
            return isMetaRelated
                ? `${getSubject(edge[0])} is to ${getSubject(edge[2])} as ${relationship}`
                : `${getSubject(edge[0])} ${relationship} ${getSubject(edge[2])}`;
        };

        question.premises = edgeList.map((edge, _, edges) =>
            readable(
                edges,
                edge,
                settings.enabled.negation && coinFlip(),
                settings.enabled.meta && coinFlip()
            )
        );
        question.conclusion = edgeList2.map((edge, _, edges) =>
            readable(
                edges,
                edge,
                settings.enabled.negation && coinFlip(),
                settings.enabled.meta && coinFlip()
            ));

        question.instructions = [
            "Check isomorphism between premise and conclusion graphs."
        ];

        return question;
    }

    createAnalogy(length: number) {
        this.logger.info("createAnalogy");

        const topType = EnumQuestionType.Analogy;
        const settings = this.settings;

        if (!canGenerateQuestion(topType, length, settings)) {
            throw new Error("Cannot generate.");
        }

        const choiceIndices = [];
        if (settings.question[EnumQuestionType.Distinction].enabled) {
            choiceIndices.push(0);
        }

        // Randomly pick one comparison question from the comparison questions enabled
        const comparisonChoices = [];
        if (settings.question[EnumQuestionType.ComparisonNumerical].enabled) {
            comparisonChoices.push(1);
        }
        if (settings.question[EnumQuestionType.ComparisonChronological].enabled) {
            comparisonChoices.push(2);
        }
        if (comparisonChoices.length) {
            choiceIndices.push(pickUniqueItems(comparisonChoices, 1).picked[0]);
        }

        // Randomly pick one direction question from the direction questions enabled
        const directionsChoices = [];
        if (settings.question[EnumQuestionType.Direction].enabled) {
            directionsChoices.push(3);
        }
        if (settings.question[EnumQuestionType.Direction3DSpatial].enabled) {
            directionsChoices.push(4);
        }
        if (settings.question[EnumQuestionType.Direction3DTemporal].enabled) {
            directionsChoices.push(5);
        }
        if (directionsChoices.length) {
            choiceIndices.push(pickUniqueItems(directionsChoices, 1).picked[0]);
        }

        // Randomly pick one arrangement from enabled arrangements
        const arrangementChoices = [];
        if (settings.question[EnumQuestionType.LinearArrangement].enabled) {
            arrangementChoices.push(6);
        }
        if (settings.question[EnumQuestionType.CircularArrangement].enabled) {
            arrangementChoices.push(7);
        }
        if (arrangementChoices.length) {
            choiceIndices.push(pickUniqueItems(arrangementChoices, 1).picked[0]);
        }

        const choiceIndex = pickUniqueItems(choiceIndices, 1).picked[0];

        let question = new Question(topType);
        let isValidSame;
        let a, b, c, d;
        let indexOfA, indexOfB, indexOfC, indexOfD;

        const flip = coinFlip();

        switch (choiceIndex) {
            case 0:
                question = this.createDistinction(length);
                question.type = topType;
                question.conclusion = "";

                [a, b, c, d] = pickUniqueItems([...question.buckets[0], ...question.buckets[1]], 4).picked;
                question.conclusion += `<span class="subject">${a}</span> to <span class="subject">${b}</span>`;

                [
                    indexOfA,
                    indexOfB,
                    indexOfC,
                    indexOfD
                ] = [
                        Number(question.buckets[0].indexOf(a) !== -1),
                        Number(question.buckets[0].indexOf(b) !== -1),
                        Number(question.buckets[0].indexOf(c) !== -1),
                        Number(question.buckets[0].indexOf(d) !== -1)
                    ];
                isValidSame = (indexOfA === indexOfB && indexOfC === indexOfD) || (indexOfA !== indexOfB && indexOfC !== indexOfD);
                break;
            case 1:
            case 2:
                const type = (choiceIndex === 1)
                    ? EnumQuestionType.ComparisonNumerical
                    : EnumQuestionType.ComparisonChronological;
                question = this.createComparison(length, type);
                question.type = topType;
                question.conclusion = "";

                [a, b, c, d] = pickUniqueItems(question.bucket, 4).picked;
                question.conclusion += `<span class="subject">${a}</span> to <span class="subject">${b}</span>`;

                [indexOfA, indexOfB] = [question.bucket.indexOf(a), question.bucket.indexOf(b)];
                [indexOfC, indexOfD] = [question.bucket.indexOf(c), question.bucket.indexOf(d)];
                isValidSame = (indexOfA > indexOfB && indexOfC > indexOfD) || (indexOfA < indexOfB && indexOfC < indexOfD);
                break;
            case 3:
                while (flip !== isValidSame) {
                    question = this.createDirection(length);
                    question.type = topType;
                    question.conclusion = "";

                    const [coordsa, coordsb, coordsc, coordsd] = pickUniqueItems(question.coords, 4).picked;
                    [a, b, c, d] = [coordsa[0], coordsb[0], coordsc[0], coordsd[0]];
                    question.conclusion += `<span class="subject">${a}</span> to <span class="subject">${b}</span>`;

                    const dxatob = coordsa[1] - coordsb[1];
                    const dyatob = coordsa[2] - coordsb[2];

                    const dxctod = coordsc[1] - coordsd[1];
                    const dyctod = coordsc[2] - coordsd[2];

                    isValidSame = (dxatob === dxctod) && (dyatob === dyctod);
                }
                break;
            case 4:
            case 5: {
                const type = (choiceIndex === 4)
                    ? EnumQuestionType.Direction3DSpatial
                    : EnumQuestionType.Direction3DTemporal;
                while (flip !== isValidSame) {
                    question = this.createDirection3D(length, type);
                    question.type = topType;
                    question.conclusion = "";

                    const [coordsa, coordsb, coordsc, coordsd] = pickUniqueItems(question.coords3D, 4).picked;
                    [a, b, c, d] = [coordsa[0], coordsb[0], coordsc[0], coordsd[0]];
                    question.conclusion += `<span class="subject">${a}</span> to <span class="subject">${b}</span>`;

                    const dxatob = coordsa[1] - coordsb[1];
                    const dyatob = coordsa[2] - coordsb[2];
                    const dtatob = coordsa[3] - coordsb[3];

                    const dxctod = coordsc[1] - coordsd[1];
                    const dyctod = coordsc[2] - coordsd[2];
                    const dtctod = coordsc[3] - coordsd[3];

                    isValidSame = (dxatob === dxctod) && (dyatob === dyctod) && (dtatob === dtctod);
                }
                break;
            }
            case 6:
            case 7: {
                const type = (choiceIndex === 6)
                    ? EnumQuestionType.LinearArrangement
                    : EnumQuestionType.CircularArrangement;
                const isLinear = type === EnumQuestionType.LinearArrangement;
                question = this.createArrangement(length, type);
                question.type = topType;
                question.conclusion = "";
                question.notes = [];
                if (isLinear) {
                    question.notes.push("Proximity makes the relationship alike.");
                } else {
                    question.notes.push("Proximity and diametrical opposition makes the relationship alike.");
                }

                const subjects = question.rule.split(", ");
                [a, b, c, d] = pickUniqueItems(subjects, 4).picked;
                question.conclusion += `<span class="subject">${a}</span> to <span class="subject">${b}</span>`;

                const [idxA, idxB, idxC, idxD] = [
                    subjects.indexOf(a),
                    subjects.indexOf(b),
                    subjects.indexOf(c),
                    subjects.indexOf(d)
                ];

                const getWays = isLinear ? getLinearWays : getCircularWays;

                const waysA2B = getWays(idxA, idxB, length + 1, true, true);
                const waysC2D = getWays(idxC, idxD, length + 1, true, true);

                this.logger.info("Ways A2B", waysA2B);
                this.logger.info("Ways C2D", waysC2D);

                isValidSame = false;
                for (const key in waysA2B) {
                    if (waysA2B[key].possible && waysC2D[key].possible && waysA2B[key].steps === waysC2D[key].steps) {
                        isValidSame = true;
                    }
                }
                this.logger.info('Is a valid "same" relationship?', isValidSame);

                break;
            }
        }

        if (isValidSame === undefined) {
            throw new Error("Shouldn't be here...");
        }

        const isSameRelationship = coinFlip();
        question.isValid = isSameRelationship ? isValidSame : !isValidSame;

        if (settings.enabled.negation && coinFlip()) {
            question.negations++;
            question.conclusion += `<div class="analogy-conclusion is-negated">is ${isSameRelationship ? 'unlike' : 'alike'}</div>`;
        } else {
            question.conclusion += `<div class="analogy-conclusion">is ${isSameRelationship ? 'alike' : 'unlike'}</div>`;
        }

        question.conclusion += `<span class="subject">${c}</span> to <span class="subject">${d}</span>`;

        /*
         * Analogy builds on a scale layout and then asks a different question of
         * it, so any derivation attached while that layout was being made
         * explains a pair this item never asks about. Left in place it rendered
         * a confident, correct-looking proof of an unrelated claim — worse than
         * showing nothing. An analogy needs its own explanation of the two
         * relations being compared; until it has one, it has none.
         */
        question.explanation = [];

        return question;
    }

    createBinary(numOfPremises: number) {
        this.logger.info("createBinary");

        const topType = EnumQuestionType.Binary;
        const settings = this.settings;

        if (!canGenerateQuestion(topType, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const operands = [];
        const operandNames = [];
        const operandTemplates = [];

        if (settings.enabled.binary.and) {
            operands.push("a&&b");
            operandNames.push("AND");
            operandTemplates.push('$a <div class="is-connector">and</div> $b');
        }
        if (settings.enabled.binary.nand) {
            operands.push("!(a&&b)");
            operandNames.push("NAND");
            operandTemplates.push('$a <div class="is-connector">and</div> $b <div class="is-connector">are not both true</div>');
        }
        if (settings.enabled.binary.or) {
            operands.push("a||b");
            operandNames.push("OR");
            operandTemplates.push('$a <div class="is-connector">or</div> $b');
        }
        if (settings.enabled.binary.nor) {
            operands.push("!(a||b)");
            operandNames.push("NOR");
            operandTemplates.push('$a <div class="is-connector">and</div> $b <div class="is-connector">are both false</div>');
        }
        if (settings.enabled.binary.xor) {
            operands.push("!(a&&b)&&(a||b)");
            operandNames.push("XOR");
            operandTemplates.push('$a <div class="is-connector">differs from</div> $b');
        }
        if (settings.enabled.binary.xnor) {
            operands.push("!(!(a&&b)&&(a||b))");
            operandNames.push("XNOR");
            operandTemplates.push('$a <div class="is-connector">is equal to</div> $b');
        }

        const question = new Question(topType);
        const flip = coinFlip();
        const operandIndex = Math.floor(Math.random() * operands.length);
        const operand = operands[operandIndex];

        let safe = 1e2;
        do {
            const a = this.createRandomQuestion(Math.floor(numOfPremises / 2), true);
            const b = this.createRandomQuestion(Math.ceil(numOfPremises / 2), true);
            const choices = [a, b];

            // Per-item: which sub-questions this one was composed from. Without
            // it there is nothing to apply the operator to.
            question.setup = [fixBinaryInstructions(a), fixBinaryInstructions(b)].filter(instr => !!instr);

            question.premises = [...choices[0].premises, ...choices[1].premises];
            shuffle(question.premises);

            question.conclusion = operandTemplates[operandIndex]
                .replace("$a", Array.isArray(choices[0].conclusion) ? choices[0].conclusion[0] : choices[0].conclusion)
                .replace("$b", Array.isArray(choices[1].conclusion) ? choices[1].conclusion[0] : choices[1].conclusion);

            question.isValid = eval(
                operand
                    .replaceAll("a", String(choices[0].isValid))
                    .replaceAll("b", String(choices[1].isValid))
            );
        } while (safe-- && flip !== question.isValid);

        if (safe <= 0) {
            throw new Error("MAXIMUM NUMBER OF ITERATIONS REACHED!");
        }

        return question;
    }

    private createSyllogismAll(numOfPremises: number) {
        this.logger.info("createSyllogismAll");
        if (coinFlip()) {
            return this.createSyllogismFredo(numOfPremises);
        } else {
            return this.createSyllogismCanyon(numOfPremises);
        }
    }

    private createSyllogismFredo(numOfPremises: number) {
        this.logger.info("createSyllogismFredo");

        const type = EnumQuestionType.Syllogism;
        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const length = numOfPremises + 1;
        const question = new Question(type);
        question.isValid = coinFlip();

        do {
            question.rule = question.isValid ? getRandomRuleValid() : getRandomRuleInvalid();
            question.bucket = getRandomSymbols(settings, length);
            question.premises = [];

            [
                question.premises[0],
                question.premises[1],
                question.conclusion
            ] = getSyllogism(
                settings,
                question.bucket[0],
                question.bucket[1],
                question.bucket[2],
                question.isValid ? getRandomRuleValid() : getRandomRuleInvalid()
            );
        } while (isPremiseLikeConclusion(question.premises, question.conclusion));

        for (let i = 3; i < length; i++) {
            const rnd = Math.floor(Math.random() * (i - 1));
            const flip = coinFlip();
            const [p, m] = flip ? [question.bucket[i], question.bucket[rnd]] : [question.bucket[rnd], question.bucket[i]];
            question.premises.push(getSyllogism(settings, "#####", p, m, getRandomRuleInvalid())[0]);
        }

        shuffle(question.premises);

        return question;
    }

    private createSyllogismCanyon(numOfPremises: number) {
        this.logger.info("createSyllogismCanyon");

        const type = EnumQuestionType.Syllogism;
        const settings = this.settings;

        if (!canGenerateQuestion(type, numOfPremises, settings)) {
            throw new Error("Cannot generate.");
        }

        const question = new Question(type);
        const minDepth = Math.min(2, numOfPremises);
        const maxDepth = numOfPremises;
        const chainDepth = Math.floor(Math.random() * (maxDepth - minDepth + 1)) + minDepth;
        const chainTermsNeeded = chainDepth + 1;
        const numDistractors = numOfPremises - chainDepth;
        const minExtra = Math.ceil(numDistractors / chainTermsNeeded);
        const maxExtra = numDistractors;
        const extra = Math.floor(Math.random() * (maxExtra - minExtra + 1)) + minExtra;
        const poolSize = chainTermsNeeded + extra;
        const termPool = getRandomSymbols(settings, poolSize);
        const wantTrue = coinFlip();
        const { premises, conclusion, conclusionIsTrue } = generatePolysyllogism({
            nPremises: numOfPremises,
            chainDepth,
            termPool,
            trueConclusion: wantTrue,
        });

        const negated = settings.enabled.negation && coinFlip();

        question.bucket = termPool;
        question.isValid = conclusionIsTrue;
        question.premises = premises.map(p => formatSylPremise(p, negated));
        question.conclusion = formatSylPremise(conclusion, negated);

        return question;
    }

    createSyllogism(numOfPremises: number) {
        switch (getSyllogismGeneratorValue()) {
            case SyllogismGenerator.All:
                return this.createSyllogismAll(numOfPremises);
            case SyllogismGenerator.Fredo:
                return this.createSyllogismFredo(numOfPremises);
            case SyllogismGenerator.Canyon:
                return this.createSyllogismCanyon(numOfPremises);
            default:
                return this.createSyllogismAll(numOfPremises);
        }
    }
}