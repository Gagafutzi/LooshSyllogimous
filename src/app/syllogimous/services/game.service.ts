import { Injectable } from "@angular/core";
import { ConstructClaim, IArrangementPremise, IDirection3DProposition, IDirectionProposition, Question } from "../models/question.models";
import { coinFlip, getCircularWays, getLinearWays, getRandomSymbols, getRelation, getSymbols, isPremiseLikeConclusion, createMetaRelationships, metarelateArrangement, pickUniqueItems, horizontalShuffleArrangement, shuffle, interpolateArrangementRelationship, fixBinaryInstructions, areGraphsIsomorphic } from "../utils/question.utils";
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
import { Finding, findings, sessionWeights } from "../utils/insight.utils";
import { NUMBER_WORDS } from "../constants/question.constants";
import { EnumScreens, EnumTiers, ORDERED_QUESTION_TYPES, ORDERED_TIERS, TIER_SCORE_ADJUSTMENTS, TIER_SCORE_RANGES, TIERS_MATRIX } from "../constants/game.constants";
import { LS_DONT_SHOW, LS_GAME_MODE, LS_HISTORY, LS_SCORE, LS_SERIES_BONUS, LS_SKIP_TUTORIALS, LS_STREAM, LS_STREAM_LENGTH, LS_STREAM_TYPE, LS_STREAM_WINDOW, LS_SYMBOL_RELATIONS, LS_TIMER, LS_ZEN } from "../constants/local-storage.constants";
import { explanationsOn, reviewSteps, setExplanationsOn } from "../utils/review.utils";
// Aliased: the service exposes members of the same names, and a call that
// could be read as either is worth one line of renaming to avoid.
import {
    claimFlashMs, feedbackOn as feedbackIsOn, setFeedbackOn as storeFeedbackOn,
    setSoundOn as storeSoundOn, soundOn as soundIsOn, verdictPause,
} from "../utils/feedback.utils";
import { hasNextClaim, judgeItem, takeSeriesAnswer } from "../utils/answer.utils";
// Aliased for the reason the feedback imports are: the service exposes a
// member of the same name, and a call that could be read as either is worth
// one line of renaming to avoid.
import { setSymbolRelations as pushSymbolRelations, symboliseStatement } from "../utils/phrasing";
import { NgbModal } from "@ng-bootstrap/ng-bootstrap";
import { ModalLevelChangeComponent } from "../components/modal-level-change/modal-level-change.component";
import { Router } from "@angular/router";
import { canGenerateQuestion, QuestionSettings, Settings } from "../models/settings.models";
import { ProgressAndPerformanceService } from "./progress-and-performance.service";
import { LinearFeatureFlags, SettingsOverrideService } from "./settings-override.service";
import { ProgressionService } from "./progression.service";
import { ToastService } from "src/app/services/toast.service";
import { Subject } from "rxjs";
import { SlotAnswer, compareConstruction, constructionSatisfied } from "../utils/construct.utils";
import { applyResult, itemDifficulty } from "../utils/rating.utils";
import { guid } from "src/app/utils/uuid";
import { EnumArrangements, EnumQuestionType } from "../constants/question.constants";
import { EnumQuestionGroup, QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { Logger } from "../utils/logger";
import { GameTimerService } from "./game-timer.service";
import { settingsForTier, unlockRow } from "../utils/tier.utils";
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
import { createAxisMap } from "../generators/axis-map";
import { createMutualMoves } from "../generators/mutual-moves";
import { createStream, DEFAULT_CHECKPOINTS, DEFAULT_WINDOW, STREAM_TYPES } from "../generators/stream";
import { createWidestGroup } from "../generators/widest-group";
import { createTransformMatch } from "../generators/transform-match";
import { createKnaves } from "../generators/knaves";
import { createNested } from "../generators/nested";
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

    /**
     * A new claim of the same item is on screen.
     *
     * Separate from `questionChanged` because nothing else about the item moved
     * — the premises above the claim are the reading that was already done, and
     * re-arming everything would throw away the picks, the timer and the
     * position for a question that is mostly the same card.
     */
    claimChanged = new Subject<void>();

    /** Last item's rating value and movement, for display. */
    lastItemDifficulty = 0;
    lastRatingDelta = 0;

    /** Shown briefly between questions; null when nothing to announce. */
    verdict: "correct" | "wrong" | "timeout" | null = null;

    /**
     * A second line under the verdict word, for the items where one word lies.
     *
     * Reported from play as *"correct answers in multiple conclusions get the
     * incorrect feedback"*, and the scoring was right — the wording was not. An
     * item that asks three conclusions is scored on all three, so answering the
     * last one correctly can still be told "Wrong", with the claim that was
     * actually missed two questions back behind a 450ms flash the player was
     * reading past. One word about a set of three is not feedback about any of
     * them.
     *
     * So the marks come with it: `✗ ✓ ✓` under the word says which conclusion
     * lost the item, which is the thing the player wanted to know and the only
     * part they could not reconstruct.
     */
    verdictNote = "";

    /** Which claim the derivation is about, when the item asked more than one. */
    reviewNote = "";

    /**
     * The pending claim-flash timer.
     *
     * Answering the last claim quickly used to have the previous claim's
     * 450ms timer fire *after* the item verdict went up and blank it, so the
     * one verdict that matters could vanish on exactly the fast answers that
     * earned it.
     */
    private flashTimer: ReturnType<typeof setTimeout> | null = null;

    /** The derivation for an item just got wrong; empty means move straight on. */
    review: string[] = [];

    /**
     * Once only.
     *
     * The skip key is space, and the Continue button takes focus when the
     * explanation opens — so a browser that turned the keypress into a click as
     * well would dismiss twice, and the second one builds a question nobody
     * sees. `preventDefault` should stop that; not depending on it costs a line.
     */
    dismissReview() {
        if (!this.review.length) return;
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

    /**
     * Whether anything is adapting difficulty on the player's behalf.
     *
     * Two systems can: the ability estimate, and the older training unit. With
     * both switched off nothing moves the premise count, nothing moves the
     * score, and the tier is a label attached to a number that no longer
     * changes — so it stops being shown and stops gating which modes exist.
     *
     * That is the honest reading of "off". A tier that cannot be climbed but
     * still withholds half the app is not a progression system, it is a lock.
     */
    get progressionActive() {
        return this.progressionService.config.enabled
            || this.progressAndPerformanceService.trainingUnitsEnabled;
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
        return this.progressionService.applyTo(
            this.settingsOverrideService.applyTo(tierSettings),
            this.settingsOverrideService.pinned());
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
        // Pushed into `phrasing` once at startup: that module is pure by design
        // and never reads storage itself, so somebody has to tell it.
        pushSymbolRelations(this.symbolRelations);
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
        return settingsForTier(tier, {
            gated: this.progressionActive,
            premisesFor: type => this.progressAndPerformanceService.getTrainingUnit(type).premises,
        }, this.unlockedRow);
    }

    /**
     * How much of the app is unlocked, decided by ability rather than by score.
     *
     * The badge still comes from the score, because a name is flavour and
     * pacing it off play time is harmless. What was not harmless was gating the
     * *modes* on the same number: with the derived score it meant "level 12.5"
     * and with the accumulated one "played this long", and neither had anything
     * to do with having outgrown what was already on offer.
     *
     * Falls back to the tier's own index when nothing is adapting, since there
     * is then no ability estimate to ask.
     */
    get unlockedRow(): number {
        if (!this.progressionService.config.enabled) {
            return ORDERED_TIERS.findIndex(t => t === this.tier);
        }
        return unlockRow(this.progressionService.unlockEvidence());
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
            [EnumQuestionType.Space7D]: () => createNdSpace(this, numOfPremises, EnumQuestionType.Space7D),
            [EnumQuestionType.GraphMatching]: () => createGraphMatching(this, numOfPremises),
            [EnumQuestionType.Hierarchy]: () => createHierarchy(this, numOfPremises),
            [EnumQuestionType.Analogy]: () => createAnalogy(this, numOfPremises),
            [EnumQuestionType.Binary]: () => createBinary(this, numOfPremises),
            [EnumQuestionType.Deictic]: () => createDeictic(this, numOfPremises),
            [EnumQuestionType.MutualMoves]: () => createMutualMoves(this, numOfPremises),
            [EnumQuestionType.Transformation]: () => createTransformation(this, numOfPremises),
            [EnumQuestionType.AnchorSpace]: () => createAnchorSpace(this, numOfPremises),
            [EnumQuestionType.AnchorSpaceV2]: () => createAnchorSpaceV2(this, numOfPremises),
            [EnumQuestionType.InferRelation]: () => createInferRelation(this, numOfPremises),
            [EnumQuestionType.OddestRelation]: () => createOddestRelation(this, numOfPremises),
            [EnumQuestionType.ShapeRotation]: () => createShapeRotation(this, numOfPremises),
            [EnumQuestionType.RelationalWeb]: () => createRelationalWeb(this, numOfPremises),
            [EnumQuestionType.StimulusFunction]: () => createStimulusFunction(this, numOfPremises),
            [EnumQuestionType.AxisMap]: () => createAxisMap(this, numOfPremises),
            [EnumQuestionType.WidestGroup]: () => createWidestGroup(this, numOfPremises),
            [EnumQuestionType.TransformMatching]: () => createTransformMatch(this, numOfPremises),
            [EnumQuestionType.Knaves]: () => createKnaves(this, numOfPremises),
            [EnumQuestionType.NestedSpaces]: () => createNested(this, numOfPremises),
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

    /**
     * How many tickets a mode gets in the draw.
     *
     * Selection is a uniform pick over one entry per mode, so frequency is
     * expressed by how many entries a mode puts in. A weight of two is two
     * entries and comes up about twice as often; a weight of a half is one
     * entry *half the time*, which is what the fractional part is for — a mode
     * cannot be entered half a time, but it can be entered every other time.
     *
     * Distinct from switching a mode off. A mode you find tedious but do not
     * want gone has no other setting, and turning it off to avoid it also stops
     * it being measured — so the estimate goes stale and the mode comes back
     * harder than you left it.
     */
    private copiesFor(type: EnumQuestionType): number {
        const weight = this.settingsOverrideService.weightFor(type)
            * this.curationWeightFor(type);
        const whole = Math.floor(weight);
        return whole + (Math.random() < weight - whole ? 1 : 0);
    }

    /* ---------------- curating the draw ---------------- */

    private curationCache: { at: number; weights: Record<string, number> } | null = null;

    /**
     * The lean the insight layer asks for, as a multiplier on the ticket count.
     *
     * Curation rides the mechanism frequency already uses rather than becoming
     * a second selection system to argue with the first — so a mode you have
     * manually turned down and the curator has turned up ends up somewhere
     * sensible instead of one of them silently winning.
     *
     * Recomputed every twenty items. The findings behind it read the whole
     * history and trial log, which is cheap in absolute terms and pointless to
     * repeat per item: nothing in them can turn over in one answer.
     */
    private curationWeightFor(type: EnumQuestionType): number {
        if (!this.settingsOverrideService.curateSession) return 1;

        const answered = this.progressionService.trialCountPublic();
        if (!this.curationCache || answered - this.curationCache.at >= 20) {
            this.curationCache = { at: answered, weights: this.sessionLean() };
        }
        return this.curationCache.weights[type] ?? 1;
    }

    /** The findings the feed shows, as weights. One analysis, two faces. */
    sessionLean(): Record<string, number> {
        return sessionWeights(this.currentFindings());
    }

    /**
     * What the app currently has to say about this player.
     *
     * Assembled here because this is the one place that can see all of it —
     * the history, the trial log and the ability model — and computed nowhere
     * else, so the page that reports a finding and the draw that acts on it
     * cannot disagree about what was found.
     */
    currentFindings(): Finding[] {
        return findings({
            history: this.questions,
            standings: this.progressionService.standings(),
            estimateTrail: this.progressionService.estimateTrail(),
            fatigue: this.progressionService.fatigue,
            fatigueThreshold: this.progressionService.config.fatigueThreshold,
            now: Date.now(),
        });
    }

    /** GeneratorContext: an explicit setting wins, else the ladder decides. */
    hasRung(type: string, rung: string) {
        return this.settingsOverrideService.rungOverride(type, rung)
            ?? this.progressionService.hasRung(type as EnumQuestionType, rung);
    }

    /** The GeneratorContext setting; read here so no generator touches storage. */

    /**
     * The GeneratorContext capability. Binary composes two other questions and
     * is the only generator that needs one.
     */
    random(numOfPremises?: number, basic?: boolean) {
        return this.createRandomQuestion(numOfPremises, basic);
    }

    /** Return a random question based on the current settings */
    // Annotated because the stream branch returns before the inference has
    // anything to work from, which makes the type circular otherwise.
    createRandomQuestion(numOfPremises?: number, basic?: boolean): Question {
        /*
         * The stream replaces the draw entirely rather than joining it.
         *
         * It is a way of *showing* relations, not a kind of relation, so mixing
         * stream items in with ordinary ones would mean the same mode name
         * arriving as two different tasks — and a player who turned it on
         * getting it a third of the time.
         */
        if (this.streamOn) {
            return this.asMinimal(
                createStream(this, this.streamType, this.streamWindow, this.streamLength));
        }

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
                    const make = this.getCreateFn(qt, qs.clampNumOfPremises(numOfPremises || qs.getNumOfPremises()));
                    for (let i = 0; i < this.copiesFor(qt); i++) groupChoices.push(make);
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
                return this.asMinimal(question);
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

    /**
     * Points a score must be inside a band before the crossing is announced.
     *
     * Scaled with the bands: they were 250 wide and are 100 now, so a margin of
     * 60 would have silenced every announcement outside the middle fifth of a
     * tier.
     */
    private static readonly TIER_MARGIN = 20;

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

    /**
     * Answer a structure match.
     *
     * Every node, in order, or nothing — the same rule construction follows and
     * for the same reason. A correspondence that is right about two nodes out of
     * three is not two-thirds of a correspondence; it is a different and wrong
     * claim about how the two structures line up.
     */
    checkMapping(picked: number[]) {
        this.question.userMap = [...picked];
        const answer = this.question.mapAnswer;
        return this.checkQuestion(
            picked.length === answer.length && picked.every((v, i) => v === answer[i]));
    }

    async checkQuestion(value?: boolean) {
        /*
         * Once only, and the clock stops here.
         *
         * Two faults, one cause. Answering never stopped the timer, so it ran
         * on through the explanation overlay — and when it reached zero it
         * called this again with no value, overwriting a correct answer given a
         * moment earlier with a timeout. Anyone answering in the last second of
         * the clock lost the answer they had just given.
         */
        if (this.question.answered) return;

        /*
         * A series is answered one claim at a time, on one arrangement.
         *
         * The premises stay, the countdown keeps running, and answering buys
         * seconds for the next claim rather than resetting the limit — so the
         * item remains one timed unit and the extra is visibly what getting
         * this far bought. Only the last claim ends the item.
         *
         * A timeout falls through deliberately. The clock ran out on the item,
         * and handing back time for a claim nobody answered would make the
         * deadline cheaper the more claims an item has.
         */
        if (value != null && hasNextClaim(this.question)) {
            const right = takeSeriesAnswer(this.question, value);
            this.gameTimerService.extend(this.seriesBonusSeconds);
            this.flashClaim(right);
            this.claimChanged.next();
            return;
        }

        this.question.answered = true;
        this.gameTimerService.stop();

        this.question.userAnswer = value;
        this.question.answeredAt = Date.now();
        this.question.timerTypeOnAnswer = localStorage.getItem(LS_TIMER) || "0";
        // Its sibling: what the clock was, and what the card looked like.
        this.question.gameModeOnAnswer = localStorage.getItem(LS_GAME_MODE) || "0";
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
        // The last claim recorded like the others, and the item judged on all
        // of them. The rule is in `answer.utils` so it can be walked in a test.
        const isQuestionValid = judgeItem(this.question, value);

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
                    // A structure match has one slot per node to be found, and
                    // as many options as the second web has nodes.
                    slots: this.question.answerMode === "map"
                        ? this.question.mapTargets.length
                        : this.question.construct.reduce((n, c) => n + c.slots.length, 0),
                    options: this.question.answerMode === "map"
                        ? (this.question.webs?.[1]?.labels.length ?? 3)
                        : this.question.construct?.[0]?.slots[0]?.directions.length ?? 3,
                    choices: this.question.choices?.length ?? 0,
                    // Logged so the bits-to-levels coefficient can be fitted
                    // rather than guessed; nothing reads it for difficulty yet.
                    widthDelta: this.question.widthDelta,
                    // Same standing: recorded now so that whether depth
                    // predicts accuracy can later be answered from answered
                    // items rather than from a screenshot.
                    depth: this.question.depth,
                    /*
                     * How each claim went, for an item that asks more than one.
                     *
                     * Computed here rather than carried on the question because
                     * this is the only place both halves exist — what was asked
                     * and what was entered — and `compareConstruction` is the
                     * same function the result screen reports from, so the model
                     * and the screen cannot disagree about which claim was right.
                     */
                    claims: this.question.series.length > 1
                        // A series is already one claim per question, so each
                        // is its own piece of evidence at the plain guess rate.
                        ? this.question.series.map((_, i) => ({
                            correct: this.question.seriesAnswers[i] === true,
                            slots: 0,
                        }))
                        : this.question.answerMode === "construct"
                            && this.question.construct.length > 1
                        ? compareConstruction(this.question.construct, this.question.userConstruct)
                            .map((slots, i) => ({
                                correct: slots.every(sl => sl.ok),
                                slots: slots.length,
                                fromPremises: this.question.construct[i].fromPremises,
                            }))
                        : undefined,
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
            const unitOwnsPremises = this.progressAndPerformanceService.trainingUnitsEnabled
                && !this.progressionService.config.enabled;

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
            if (!this.progressionActive) {
                // Nothing is adapting, so nothing should be climbing. Leaving
                // the score moving would keep promoting a tier that no longer
                // decides anything, and announcing it would be a promotion to
                // nowhere.
                this.question.userScore = this.score;
            } else if (isQuestionValid) {
                this.rawScore += TIER_SCORE_ADJUSTMENTS[this.tier].increment;
                ds += 1;
                this.question.userScore = this.score;
                this.announceTier(currTier);
            } else {
                this.rawScore = Math.max(0, this.rawScore - TIER_SCORE_ADJUSTMENTS[this.tier].decrement);
                if (this.rawScore > 0) {
                    ds -= 1;
                }
                this.question.userScore = this.score;
                this.announceTier(currTier);
            }
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
    /**
     * Seconds handed back for answering a claim of a series.
     *
     * Five unless it is set otherwise. Enough to read the next claim against
     * premises already in your head, not enough to re-read the item.
     */
    get seriesBonusSeconds(): number {
        try {
            const raw = Number(localStorage.getItem(LS_SERIES_BONUS));
            return Number.isFinite(raw) && raw >= 0 ? Math.min(60, raw) : 5;
        } catch { return 5; }
    }

    setSeriesBonusSeconds(value: number) {
        try {
            localStorage.setItem(LS_SERIES_BONUS,
                String(Math.max(0, Math.min(60, Math.round(value)))));
        } catch { /* private mode; the default stands */ }
    }

    /**
     * Whether a wrong answer stops for its explanation.
     *
     * Read through the service rather than out of storage in each screen, so
     * the switch on Display & timer and the panel it governs cannot come to
     * different conclusions. The rule itself lives in `review.utils`.
     */
    get explanationsShown(): boolean { return explanationsOn(); }

    setExplanationsShown(value: boolean) { setExplanationsOn(value); }

    /**
     * Whether the app makes any sound at all.
     *
     * Read through the service like the switch above it, so the checkbox on
     * Display & timer and the oscillator it governs cannot come to different
     * conclusions. The rule lives in `feedback.utils`.
     */
    get soundOn(): boolean { return soundIsOn(); }

    setSoundOn(value: boolean) { storeSoundOn(value); }

    /**
     * Whether the Correct / Wrong / Timeout flash appears.
     *
     * The game screen reads this to decide whether to *draw* the box. It
     * deliberately does not decide whether `verdict` is *set*: that field is
     * also what tells the keyboard handler an answer is being resolved, and
     * clearing it here would let a late keypress fall through onto the question
     * that follows. What is suppressed is the picture, not the state.
     */
    /**
     * Minimal mode: relations as marks rather than words.
     *
     * "3 north" becomes "3 ↑", "is east of" becomes "→". Every relation any
     * scale can state has one — there is a test that walks the scales and fails
     * on the first that does not, so this cannot half-apply and leave a card
     * mixing the two.
     *
     * Written through to `phrasing` as well as to storage, because that module
     * is pure and holds the flag in a variable rather than reading it.
     */
    get symbolRelations(): boolean {
        try { return localStorage.getItem(LS_SYMBOL_RELATIONS) === "1"; } catch { return false; }
    }

    setSymbolRelations(on: boolean) {
        try {
            if (on) localStorage.setItem(LS_SYMBOL_RELATIONS, "1");
            else localStorage.removeItem(LS_SYMBOL_RELATIONS);
        } catch { /* private mode; the default stands */ }
        pushSymbolRelations(on);

        /*
         * Throw away the item built under the old setting.
         *
         * An item is generated during the previous verdict flash, so the card
         * waiting when the switch is flipped was converted — or not converted —
         * before the flip. Turning the setting on and having the very next
         * question still read in words looks exactly like the feature failing,
         * and it is a one-line cost to build that item again.
         */
        this.prepared = undefined;
    }

    /**
     * The item's statements as marks, when minimal mode is on.
     *
     * Done here, on the finished question, rather than inside the phrasing
     * helpers. Substituting in `rel` and `hi` covered the modes that build
     * premises out of them and missed nineteen that write relation text
     * directly — a comparison card came out with one line reading "Rice <
     * Beanstalk" and the three around it still saying "is less than". Twice the
     * funnel turned out not to be one, so this stops guessing where the words
     * are produced and converts what the card will show.
     *
     * **Statements only.** `setup` and `explanation` keep their words: the setup
     * says things like "every change it makes is shown below", where "below" is
     * prose and a mark would be nonsense, and the derivation reads better in
     * words — it becomes the decoder for the card above it, which is worth
     * having rather than a consistency to enforce.
     */
    private asMinimal(question: Question): Question {
        if (!this.symbolRelations) return question;

        const one = (s: string) => symboliseStatement(s);
        question.premises = question.premises.map(one);
        question.conclusion = Array.isArray(question.conclusion)
            ? question.conclusion.map(one)
            : one(question.conclusion ?? "");
        question.choices = question.choices.map(one);
        question.choicePrompt = one(question.choicePrompt ?? "");

        // The claims a series will swap in later are statements too, and they
        // are already built by the time the item is handed over.
        for (const claim of question.series) {
            claim.text = one(claim.text);
            if (claim.premises) claim.premises = claim.premises.map(one);
            if (claim.choices) claim.choices = claim.choices.map(one);
            if (claim.prompt) claim.prompt = one(claim.prompt);
        }

        return question;
    }

    /* ---- continuous stream ---- */

    get streamOn(): boolean {
        try { return localStorage.getItem(LS_STREAM) === "1"; } catch { return false; }
    }

    setStreamOn(on: boolean) {
        try {
            if (on) localStorage.setItem(LS_STREAM, "1");
            else localStorage.removeItem(LS_STREAM);
        } catch { /* private mode; the default stands */ }
    }

    get streamType(): EnumQuestionType {
        try {
            const stored = localStorage.getItem(LS_STREAM_TYPE) as EnumQuestionType | null;
            if (stored && STREAM_TYPES.indexOf(stored) >= 0) return stored;
        } catch { /* private mode */ }
        return STREAM_TYPES[0];
    }

    setStreamType(type: EnumQuestionType) {
        try { localStorage.setItem(LS_STREAM_TYPE, type); } catch { /* private mode */ }
    }

    get streamWindow(): number {
        try {
            const n = Number(localStorage.getItem(LS_STREAM_WINDOW));
            if (n >= 2 && n <= 6) return n;
        } catch { /* private mode */ }
        return DEFAULT_WINDOW;
    }

    setStreamWindow(n: number) {
        try {
            localStorage.setItem(LS_STREAM_WINDOW,
                String(Math.max(2, Math.min(6, Math.round(n) || DEFAULT_WINDOW))));
        } catch { /* private mode */ }
    }

    /**
     * How many questions a run asks.
     *
     * Bounded only by what a number can be typed as, not by a judgement about
     * how long anybody should sit there. A stream has no natural stopping point
     * — that is the whole character of it — so the length is the only place a
     * stop comes from, and choosing it is the player's.
     */
    get streamLength(): number {
        try {
            const n = Number(localStorage.getItem(LS_STREAM_LENGTH));
            if (n >= 1) return Math.floor(n);
        } catch { /* private mode */ }
        return DEFAULT_CHECKPOINTS;
    }

    setStreamLength(n: number) {
        try {
            localStorage.setItem(LS_STREAM_LENGTH,
                String(Math.max(1, Math.floor(Number(n) || DEFAULT_CHECKPOINTS))));
        } catch { /* private mode */ }
    }

    get feedbackShown(): boolean { return feedbackIsOn(); }

    setFeedbackShown(value: boolean) { storeFeedbackOn(value); }

    /**
     * Zen mode: the screen stops offering, and the keyboard does everything.
     *
     * No answer buttons, no explanation panel, and the options answered from
     * the arrow keys rather than pointed at. It is one switch rather than three
     * because it is one way of playing — a request for less to look at, not for
     * three settings that happen to combine.
     *
     * It *overrides* the explanation switch rather than writing to it, so
     * turning zen off gives back whatever was set before rather than whatever
     * zen left behind.
     */
    get zenMode(): boolean {
        try { return localStorage.getItem(LS_ZEN) === "1"; } catch { return false; }
    }

    setZenMode(on: boolean) {
        try {
            if (on) localStorage.setItem(LS_ZEN, "1");
            else localStorage.removeItem(LS_ZEN);
        } catch { /* private mode; the default stands */ }
    }

    /**
     * The outcome of one claim, without ending the item.
     *
     * Short, and it does not stop the clock or offer the derivation: the next
     * claim is already on screen behind it, and the whole point of the form is
     * that the arrangement stays in your head between claims. The reckoning
     * comes once, at the end.
     */
    private flashClaim(right: boolean) {
        this.verdict = right ? "correct" : "wrong";
        // Which one this was about, since the next is already on screen behind
        // it and "Correct" alone could be about either.
        this.verdictNote =
            `Conclusion ${this.question.seriesAt} of ${this.question.series.length}`;
        this.playVerdictSound(this.verdict);

        if (this.flashTimer) clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
            this.flashTimer = null;
            this.verdict = null;
            this.verdictNote = "";
        }, claimFlashMs());
    }

    private showVerdict(kind: "correct" | "wrong" | "timeout") {
        // A claim flash still pending would blank this one; it is superseded.
        if (this.flashTimer) { clearTimeout(this.flashTimer); this.flashTimer = null; }

        this.verdict = kind;
        /*
         * An item judged on several conclusions says how each went.
         *
         * The word is about the set — two of three is not the item — and on its
         * own it reads as a verdict on the conclusion still on screen, which is
         * the one the player just answered and may well have got right.
         */
        const marks = this.question.series;
        /*
         * Marks while they can be read, a tally once they cannot.
         *
         * A hundred-question stream renders a hundred ticks and crosses, which
         * is a wall rather than a verdict — and the thing worth knowing at that
         * length is how many, not which.
         */
        const right = this.question.seriesAnswers.filter(Boolean).length;
        this.verdictNote = marks.length <= 1 ? ""
            : marks.length <= 12
                ? marks.map((_, i) => this.question.seriesAnswers[i] ? "✓" : "✗").join(" ")
                : `${right} of ${marks.length} right`;
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
         * of moving on — unless the player has said not to, on Display & timer,
         * in which case a wrong answer flows on like every other.
         */
        const derivation = reviewSteps(kind, this.question.explanation,
            this.explanationsShown && !this.zenMode);

        // Long enough to register, short enough not to feel like a screen.
        /*
         * Which claim the derivation is about.
         *
         * It is always the mode's own conclusion — the first one — because that
         * is the claim the mode built and explained. On an item that asked
         * three, a derivation about the first while the third is what went
         * wrong is a confident answer to a question nobody asked, so it says
         * which one it is answering.
         */
        this.reviewNote = this.question.series.length > 1
            ? "This explains the first conclusion of the item."
            : "";

        setTimeout(() => {
            this.verdict = null;
            this.verdictNote = "";
            if (derivation.length) { this.review = derivation; return; }
            this.play(true, true);
        }, verdictPause(kind));
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
        // The single point every sound in the app passes through, which is what
        // makes one switch able to silence all of them.
        if (!soundIsOn()) return;
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