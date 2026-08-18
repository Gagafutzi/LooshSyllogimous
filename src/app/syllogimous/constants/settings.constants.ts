import { EnumQuestionType } from "./question.constants";

export enum EnumQuestionGroup {
    Comparison = "Comparison",
    Direction = "Direction",
    Arrangement = "Arrangement",
}

export interface ISettingParams {
    enabled: boolean;
    minNumOfPremises: number;
    maxNumOfPremises: number;
    basic: boolean;
    group?: EnumQuestionGroup;
}

export const QUESTION_TYPE_SETTING_PARAMS: Record<EnumQuestionType, ISettingParams> = {
    [EnumQuestionType.Distinction]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true
    },
    [EnumQuestionType.ComparisonNumerical]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Comparison
    },
    [EnumQuestionType.ComparisonChronological]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Comparison
    },
    /*
     * The three linear scales v4 was missing. Grouped with Comparison because
     * the group mechanism draws one question per group, and five scale modes
     * left ungrouped would make a mixed session mostly scale questions — the
     * point of adding them is more kinds of difficulty, not more of this kind.
     *
     * Three premises is the floor: at two, every pair is stated outright, so
     * there is nothing to compose.
     */
    [EnumQuestionType.LinearVertical]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Comparison
    },
    [EnumQuestionType.LinearHorizontal]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Comparison
    },
    [EnumQuestionType.LinearContains]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Comparison
    },
    [EnumQuestionType.Syllogism]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true
    },
    [EnumQuestionType.LinearArrangement]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Arrangement
    },
    [EnumQuestionType.CircularArrangement]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Arrangement
    },
    [EnumQuestionType.Direction]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Direction3DSpatial]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Direction3DTemporal]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: true,
        group: EnumQuestionGroup.Direction
    },
    /*
     * Grouped with Direction: they are the same family of task at higher
     * dimension, and the group mechanism draws one per question, so leaving
     * them ungrouped would flood a mixed session with spatial items.
     *
     * Three premises is the floor — four objects, or every pair is stated.
     *
     * The ceilings are low on purpose, and lower as dimensions rise. Length and
     * breadth are not interchangeable here: a premise is one more arbitrary
     * pairwise fact with no unit for it to become, whereas the axes of a single
     * premise collapse into one vector-valued relation with practice. Twenty
     * premises of anything is a clerical task; the observed working limit is
     * six-dimensional items at around five premises answered in half a minute,
     * with seven premises out of reach at that width.
     *
     * So difficulty above this comes from the rung ladder — loops, operations,
     * edits, construction — and not from adding statements. A mode that has run
     * out of rungs has run out of difficulty, which `premisesMayRise` already
     * says; this stops length standing in for structure at the top end too.
     */
    /*
     * Three axes is ordinary space, and it exists so the composed-space ladder
     * starts where people actually play rather than one dimension above it.
     * Direction3D Spatial covers the same ground with two rungs and no cap, so
     * everything past negation and meta there is extra length; this reaches the
     * same arrangement and then has twelve more things to do to it.
     *
     * Ten premises rather than eight: the cap falls as dimensions rise, and at
     * three axes a premise is three clauses, so length stays readable longer.
     */
    [EnumQuestionType.Space3D]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 10,
        basic: false,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Space4D]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Space5D]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 7,
        basic: false,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Space6D]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 6,
        basic: false,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.Space7D]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 6,
        basic: false,
        group: EnumQuestionGroup.Direction
    },
    [EnumQuestionType.GraphMatching]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 20,
        basic: false
    },
    /*
     * Ungrouped: it is not a spatial or scale question, and pairing it with one
     * of those groups would halve how often the only connectivity mode appears.
     *
     * Three links is the floor — below that every path is a stated premise.
     */
    [EnumQuestionType.Hierarchy]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: false
    },
    [EnumQuestionType.Analogy]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: false
    },
    [EnumQuestionType.Binary]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 20,
        basic: false
    },
    /*
     * Needs 4 premises to state a 2-axis grid plus at least one reversal, and
     * tops out at 11: three axes is eight grid statements, and each axis
     * reverses once or not at all, so there are three reversals to state and no
     * twelfth thing to say. Asking for twenty used to be answered with the same
     * reversal restated five times over.
     */
        /*
     * Eight cells is the whole grid at three axes, so past that the
     * premises repeat rather than add: length without width.
     */
    [EnumQuestionType.Deictic]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 8,
        basic: false
    },
    [EnumQuestionType.Transformation]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 20,
        basic: false
    },
    // One premise per object, and a pair anchored to different markers is
    // needed for the frame to matter — so three is the useful floor.
        /*
     * Objects hang off four anchors; past eight the item is longer
     * rather than harder, which is the axis of last resort.
     */
    [EnumQuestionType.AnchorSpace]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false
    },
    // Needs 2 objects plus at least one transform.
    [EnumQuestionType.AnchorSpaceV2]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 20,
        basic: false
    },
    /*
     * Both induction modes size their own structure from the premise count —
     * how many candidate relations to eliminate, how many relations to compare
     * — so the caps here are about how wide that can get, not how long a chain
     * is. Above their ceilings the item stops getting harder and starts getting
     * longer, which is the axis of last resort.
     */
    [EnumQuestionType.InferRelation]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 8,
        basic: false
    },
    [EnumQuestionType.OddestRelation]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * Premises here buy objects on corners and turns to carry, and the polygon
     * caps the first — eight corners hold at most seven objects, so there is
     * nothing above this ceiling but more turns of the same kind.
     */
    [EnumQuestionType.ShapeRotation]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 9,
        basic: false
    },
    /*
     * Premises here are nodes, not sentences: the count sets how big the web
     * is. Twelve nodes is the ceiling — past that the picture is a hairball
     * rather than a structure.
     */
    [EnumQuestionType.RelationalWeb]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 10,
        basic: false
    },
    [EnumQuestionType.StimulusFunction]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * Premises buy labelled points rather than sentences: the item is always
     * two structures and a claim, and length is how many points have to agree
     * before the map is pinned down. Six is the ceiling because past that the
     * item is arithmetic endurance rather than induction.
     */
    [EnumQuestionType.TransformMatching]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 6,
        basic: false
    },
    /*
     * One statement per speaker, so premises are speakers. Six is the ceiling:
     * the solver is fine past it, but a reader holding seven interlocking
     * biconditionals is being tested on working memory rather than on
     * truth-functional reasoning.
     */
    [EnumQuestionType.Knaves]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 6,
        basic: false
    },
    /*
     * Each premise carries two relations, one per space, so the reading load
     * per premise is doubled and the ceiling comes down accordingly.
     */
    [EnumQuestionType.NestedSpaces]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 7,
        basic: false
    },
}

export const DEFAULT_ENABLED_FLAGS = {
    useText: true,
    useEmojis: false,
    visualNoise: false,
    junkEmojis: false,
    /**
     * Relative share of each stimulus kind, when more than one is on.
     *
     * Absent or 1 means an equal share, which is what enabling two kinds used
     * to force; zero is off.
     */
    stimulusMix: {} as Record<string, number>,
    meaningfulWords: true,
    meta: true,
    negation: true,
    binary: {
        and: true,
        nand: true,
        or: true,
        nor: true,
        xor: true,
        xnor: true,
    },
};