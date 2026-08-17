import { EnumArrangements, EnumQuestionType } from "../constants/question.constants";

export interface IArrangementRelationship {
    description: EnumArrangements;
    steps: number;
}

export interface IArrangementPremise {
    a: string;
    b: string;
    relationship: IArrangementRelationship;
    metaRelationships: IArrangementPremise[],
    uid: string;
}

export interface IDirectionProposition {
    pair: [[string, number, number], [string, number, number]];
    trasversalDifference?: number;
    cardinals: [string, number][];
    relationship: string;
    uid: string;
}

export interface IDirection3DProposition {
    pair: [[string, number, number, number], [string, number, number, number]];
    trasversalDifference: number;
    cardinals: [string, number][];
    relationship: string;
    uid: string;
}

/** One relation the player has to state, dimension by dimension. */
export interface ConstructClaim {
    a: string;
    b: string;
    slots: ConstructSlot[];
}

/**
 * One dimension of a claim, split into direction and distance.
 *
 * A single list of whole relations could not express distance without one
 * option per possible value, so it only ever asked which side of the axis the
 * pair sat on. Splitting it asks *how far* as well, which is the part that
 * cannot be got by tracking a sign through the premises.
 */
export interface ConstructSlot {
    /** Which dimension this slot is for, e.g. "Up-down". */
    label: string;
    /** [normal, reversed, same] — e.g. above / below / at the same height as. */
    directions: [string, string, string];
    /** 0 = normal, 1 = reversed, 2 = same. */
    answerDirection: 0 | 1 | 2;
    /** Steps along the axis. Zero when the answer is "same". */
    answerMagnitude: number;
    /**
     * Whether the distance is asked for as well as the direction.
     *
     * Direction alone is the easier half and the one the premises hand over
     * almost directly — a sign can be tracked through a chain without holding
     * the structure. Distance cannot, so it is earned separately rather than
     * being the price of entry to building a conclusion at all.
     */
    asksDistance: boolean;
    /**
     * Loop size, for a circular axis.
     *
     * Present means distances are judged modulo it, because on a ring "2 steps
     * clockwise" and "3 steps anticlockwise" of a five-loop are the same claim
     * and marking one of them wrong would be marking a correct answer wrong.
     */
    modulus?: number;
}

export class Question {
    /**
     * Rules for the mode. Fixed across every item of that type.
     *
     * No longer rendered on the game card — they say the same thing above every
     * question forever, which is noise once read. They stay on the object for
     * the tutorial and history screens.
     */
    instructions?: string[];
    notes?: string[];
    /**
     * Facts about *this* item that the premises do not state.
     *
     * The distinction from `instructions` is whether the answer changes without
     * it: how many subjects share an arrangement, or which operators a Binary
     * item was built from, cannot be recovered from the premises, so dropping
     * those makes the item unanswerable rather than merely tidier. Rendered as
     * one dim line, no heading.
     */
    setup: string[] = [];

    /**
     * How the answer follows, shown only after a wrong answer.
     *
     * A verdict of "Wrong" is one bit, and an item that took a minute to read
     * deserves more than that — an error with corrective feedback only teaches
     * if the feedback is actually processed. Built at generation time, where the
     * layout is still in hand, rather than reconstructed later from rendered
     * text.
     *
     * Empty means the mode has none to offer, and the screen shows nothing
     * rather than something vague.
     */
    explanation: string[] = [];
    type: EnumQuestionType;
    isValid = false;
    premises: string[] = [];
    conclusion: string | string[] = "";
    createdAt = new Date().getTime();
    answeredAt = new Date().getTime();
    userAnswer?: boolean;
    /**
     * How the item is answered.
     *
     * "boolean" is the stock true/false judgement. "choice" presents several
     * candidate conclusions of which exactly one follows, which removes the
     * coin-flip floor — a guess is worth 1/n rather than 1/2, so the same number
     * of trials says considerably more about whether the item was understood.
     */
    answerMode: "boolean" | "choice" | "construct" = "boolean";
    /** Candidate conclusions, in display order. Choice mode only. */
    choices: string[] = [];
    /** Index into `choices` of the one that follows. */
    correctChoice = -1;
    userChoice?: number;
    /**
     * Slots the player fills in to state the conclusion themselves.
     *
     * Construction mode. Every dimension has to be filled, so a six-axis item
     * has a one-in-729 guess floor against true/false's one in two — which is
     * the point: a placement or a rating built on binary answers cannot tell a
     * lucky run from an understood one, and twenty items is not enough trials
     * for that to average out.
     */
    construct: ConstructClaim[] = [];
    /** What the player entered, one direction-and-distance per slot. */
    userConstruct?: Array<Array<{ direction: number; magnitude: number }>>;
    negations = 0;
    metaRelations = 0;
    timerTypeOnAnswer = "0";
    userScore = 0;
    playgroundMode = false;
    // Technical fields
    rule = "";
    bucket: string[] = [];
    buckets: string[][][] = [];
    coords: [string, number, number][] = [];
    coords3D: [string, number, number, number][] = [];
    graphPremises: [string, string, string][] = [];
    graphConclusion: [string, string, string][] = [];

    constructor(type: EnumQuestionType) {
        this.type = type;
    }
}
