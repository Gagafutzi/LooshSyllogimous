import { jsonCopy } from "src/app/utils/json";
import { EnumQuestionType } from "../constants/question.constants";
import { EnumQuestionGroup, DEFAULT_ENABLED_FLAGS, QUESTION_TYPE_SETTING_PARAMS } from "../constants/settings.constants";
import { b2n } from "../utils/question.utils";

const getNumOfEnabledQuestions = (settings: Settings, basicQuestionFilter: boolean) => {
    return Object.values(settings.question)
        .filter(qs => qs.basic === basicQuestionFilter)
        .reduce((a, c) => a + b2n(c.enabled), 0);
};

const getNumOfEnabledOperators = (settings: Settings) => {
    return Object.values(settings.enabled.binary)
        .reduce((a, c) => a + b2n(c), 0);
};

export interface Picked<T> {
    picked: T[];
    remaining: T[];
}

/**
 * Non-basic types normally require two basic types to be enabled, because
 * Analogy and Binary *compose* other questions and have nothing to build from
 * otherwise. These types are non-basic only in the sense that nothing composes
 * them — they generate standalone, so that requirement does not apply.
 */
const SELF_CONTAINED_TYPES = new Set<EnumQuestionType>([
    EnumQuestionType.GraphMatching,
    EnumQuestionType.Deictic,
    EnumQuestionType.Transformation,
    EnumQuestionType.AnchorSpace,
    EnumQuestionType.AnchorSpaceV2,
    EnumQuestionType.Space3D,
    EnumQuestionType.Space4D,
    EnumQuestionType.Space5D,
    EnumQuestionType.Space6D,
    EnumQuestionType.Space7D,
    EnumQuestionType.Hierarchy,
    EnumQuestionType.InferRelation,
    EnumQuestionType.OddestRelation,
    EnumQuestionType.ShapeRotation,
    EnumQuestionType.RelationalWeb,
    EnumQuestionType.StimulusFunction,
]);

export function canGenerateQuestion(
    questionType: EnumQuestionType,
    numOfPremises: number,
    settings: Settings
) {
    const enoughPremises = numOfPremises >= settings.question[questionType].minNumOfPremises;
    if (settings.question[questionType].basic || SELF_CONTAINED_TYPES.has(questionType)) {
        return enoughPremises;
    }
    return enoughPremises && getNumOfEnabledQuestions(settings, true) >= 2;
}

/**
 * The premise count a mode will actually accept.
 *
 * `canGenerateQuestion` checks the *floor* only, so every generator has been
 * trusting its caller for the maximum. Every real call site happens to clamp
 * first, which is exactly the kind of thing that stays true until it does not
 * — a cap is a claim about what is answerable at that size, and a claim worth
 * making is worth not depending on three unrelated callers to keep.
 */
export function clampPremises(type: EnumQuestionType, numOfPremises: number): number {
    const params = QUESTION_TYPE_SETTING_PARAMS[type];
    return Math.max(params.minNumOfPremises, Math.min(params.maxNumOfPremises, numOfPremises));
}

export function areSettingsInvalid(settings: Settings) {
    const numOfEnabledBasicQuestions = getNumOfEnabledQuestions(settings, true);
    const numOfEnabledQuestions = numOfEnabledBasicQuestions + getNumOfEnabledQuestions(settings, false);
    const numOfEnabledOperators = getNumOfEnabledOperators(settings);
    const isAnalogyEnabled = settings.question[EnumQuestionType.Analogy].enabled;
    const isBinaryEnabled = settings.question[EnumQuestionType.Binary].enabled;

    if (numOfEnabledQuestions < 1) {
        return "You need at least one question type";
    }
    if ((isAnalogyEnabled || isBinaryEnabled) && numOfEnabledBasicQuestions < 2) {
        return "Analogy/binary type of questions need at least two other basic question types";
    }
    if (isBinaryEnabled && numOfEnabledOperators < 2) {
        return "Binary needs at least two operators"
    }

    return null;
}

export interface IQuestionSettingsParams {
    minNumOfPremises: number;
    maxNumOfPremises: number;
    basic: boolean;
    group?: EnumQuestionGroup;
    enabled: boolean;
    numOfPremises?: number;
}

export class QuestionSettings {
    enabled: boolean;
    minNumOfPremises: number; // Min number of premises
    private numOfPremises!: number; // Actual number of premises
    maxNumOfPremises: number; // Max number of premises
    basic: boolean; // Basic questions can be used by other questions (ex. Analogy, Binary, ...)
    group?: EnumQuestionGroup; // Group that this question belongs to (ex. Direction, ...)

    constructor(params: IQuestionSettingsParams) {
        this.minNumOfPremises = params.minNumOfPremises;
        this.maxNumOfPremises = params.maxNumOfPremises;
        this.basic = params.basic;
        this.group = params.group;

        // Some props are immutable because they are user for validation
        this.freezeProp("minNumOfPremises");
        this.freezeProp("maxNumOfPremises");
        this.freezeProp("basic");
        this.freezeProp("group");
        
        this.enabled = params.enabled;
        this.setNumOfPremises(params.numOfPremises || params.minNumOfPremises);
    }
    
    freezeProp(prop: string) {
        Object.defineProperty(this, prop, { configurable: false, writable: false });
    }

    setNumOfPremises(numOfPremises: number) {
        this.numOfPremises = this.clampNumOfPremises(numOfPremises);
    }

    getNumOfPremises() {
        return this.numOfPremises;
    }

    clampNumOfPremises(numOfPremises: number) {
        return Math.max(this.minNumOfPremises, Math.min(this.maxNumOfPremises, numOfPremises))
    }
}

export class Settings {
    question!: Record<EnumQuestionType, QuestionSettings>;
    enabled: typeof DEFAULT_ENABLED_FLAGS;

    private configSettings?: Settings;

    constructor(settings?: Settings) {
        this.configSettings = settings;

        this.enabled = jsonCopy(DEFAULT_ENABLED_FLAGS);
        this.enabled = { ...this.enabled, ...settings?.enabled };
        
        this.initQuestionSettings(EnumQuestionType.Distinction);
        this.initQuestionSettings(EnumQuestionType.ComparisonNumerical);
        this.initQuestionSettings(EnumQuestionType.ComparisonChronological);
        this.initQuestionSettings(EnumQuestionType.LinearVertical);
        this.initQuestionSettings(EnumQuestionType.LinearHorizontal);
        this.initQuestionSettings(EnumQuestionType.LinearContains);
        this.initQuestionSettings(EnumQuestionType.Syllogism);
        this.initQuestionSettings(EnumQuestionType.LinearArrangement);
        this.initQuestionSettings(EnumQuestionType.CircularArrangement);
        this.initQuestionSettings(EnumQuestionType.Direction);
        this.initQuestionSettings(EnumQuestionType.Direction3DSpatial);
        this.initQuestionSettings(EnumQuestionType.Direction3DTemporal);
        this.initQuestionSettings(EnumQuestionType.Space4D);
        this.initQuestionSettings(EnumQuestionType.Space3D);
        this.initQuestionSettings(EnumQuestionType.Space5D);
        this.initQuestionSettings(EnumQuestionType.Space6D);
        this.initQuestionSettings(EnumQuestionType.Space7D);
        this.initQuestionSettings(EnumQuestionType.GraphMatching);
        this.initQuestionSettings(EnumQuestionType.Hierarchy);
        this.initQuestionSettings(EnumQuestionType.Analogy);
        this.initQuestionSettings(EnumQuestionType.Binary);
        this.initQuestionSettings(EnumQuestionType.Deictic);
        this.initQuestionSettings(EnumQuestionType.Transformation);
        this.initQuestionSettings(EnumQuestionType.AnchorSpace);
        this.initQuestionSettings(EnumQuestionType.AnchorSpaceV2);
        this.initQuestionSettings(EnumQuestionType.InferRelation);
        this.initQuestionSettings(EnumQuestionType.OddestRelation);
        this.initQuestionSettings(EnumQuestionType.ShapeRotation);
        this.initQuestionSettings(EnumQuestionType.RelationalWeb);
        this.initQuestionSettings(EnumQuestionType.StimulusFunction);
    }

    initQuestionSettings(type: EnumQuestionType) {
        if (!this.question) {
            this.question = {} as any;
        }
        this.question[type] = new QuestionSettings(
            // @ts-ignore
            this.configSettings?.question[type] || QUESTION_TYPE_SETTING_PARAMS[type]
        );
    }

    setEnable(prop: "useEmojis" | "meaningfulWords" | "meta" | "negation" | "visualNoise" | "junkEmojis" | "useText", value: boolean) {
        this.enabled[prop] = value;
        return this;
    }

    setQuestionSettings(type: EnumQuestionType, enabled: boolean, numOfPremises: number) {
        this.question[type].enabled = enabled;
        this.question[type].setNumOfPremises(numOfPremises);
        return this;
    }
}
