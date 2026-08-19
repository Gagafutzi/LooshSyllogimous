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
    /**
     * Axis colour class, matching how the premises painted this dimension.
     *
     * Absent on the one-axis modes, which have nothing to tell apart.
     */
    colorClass?: string;
    /**
     * The options offered, in order.
     *
     * Three of them — [normal, reversed, same] — for a slot that states a
     * relation, and that triple is a convention the distance rules depend on:
     * `slotSatisfied` reads index 2 as "same", which has no distance. A slot
     * that only asks *which* of several answers is right may offer any number,
     * and must then set `asksDistance` false.
     */
    directions: string[];
    /** Index into `directions`. 0 = normal, 1 = reversed, 2 = same. */
    answerDirection: number;
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
    answerMode: "boolean" | "choice" | "construct" | "map" = "boolean";

    /**
     * A whole-structure match, answered by pointing rather than by picking.
     *
     * `mapTargets` are nodes of the first web, in the order they are to be
     * matched; the renderer colours them by that order. `mapAnswer` is where
     * each one lands in the second web. A menu could only ever ask about one
     * node at a time, and asking about one node is not matching a structure —
     * it is the difference between reading a correspondence and constructing
     * one.
     */
    mapTargets: number[] = [];
    mapAnswer: number[] = [];
    userMap: number[] = [];
    /** Candidate conclusions, in display order. Choice mode only. */
    choices: string[] = [];
    /**
     * What the choices are being asked *for*.
     *
     * Choice mode began as "which of these conclusions follows", and the screen
     * said so. Modes that offer corner names, or relations to identify, are
     * choosing among something other than conclusions, and the stock wording
     * then describes the wrong task. Blank keeps the original phrasing.
     */
    choicePrompt = "";
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
    /**
     * Which group each stimulus landed in, for the modes that partition.
     *
     * Two groups of words. It was three levels deep — groups of one-element
     * arrays — so membership was tested by array *identity*, which worked only
     * because the very same reference was pushed and then looked up. Flattened
     * to what it means, so the test is value equality and the words are words.
     */
    buckets: string[][] = [];
    /**
     * Where everything ended up, keyed by word, one entry per axis.
     *
     * Kept so the item can be *drawn* afterwards. A derivation says how the
     * answer follows; a map says where everything was, which is what people
     * reconstruct on paper when they get one wrong. Written by the modes that
     * have coordinates in hand — the composed spaces, the scale family, anchor
     * space — and absent elsewhere, where there is nothing to plot.
     */
    /**
     * Directed graphs to draw, for Relational Web.
     *
     * The only mode whose premises are not sentences: the picture *is* the
     * statement, so it is carried as data and drawn by a component. Angular's
     * sanitiser strips SVG out of `[innerHTML]`, so smuggling it through the
     * premise list was never an option.
     */
    webs?: Array<{
        adj: boolean[][];
        labels: string[];
        /** Positions as fractions of the box, so the drawing can be any size. */
        layout: Array<[number, number]>;
        /** The node being asked about, in the first web only. */
        highlight?: number;
        /** Nodes to be matched, in the order they are to be matched. */
        marks?: number[];
        /** This web takes the answer: its nodes can be pointed at. */
        selectable?: boolean;
        /** Filled in as the player answers, never by the generator. */
        picked?: number[];
    }>;
    wordCoordMap?: Record<string, number[]>;
    /** Axis names for the map, in the same order as the coordinates. */
    axisNames?: string[];
    /**
     * Position per object on a one-axis scale, when the mode has one.
     *
     * Written by the scale generators so a mode that *builds on* one — Analogy
     * takes a finished layout and asks a different question of it — can word
     * the relation between two objects without re-deriving it from the
     * rendered premises, which negation and meta have already rewritten.
     */
    /**
     * How much wider or narrower this item came out than typical, in bits.
     *
     * Measured against the median of the batch it was drawn from, so it is a
     * departure from *this configuration's* middle rather than an absolute
     * figure — 8.5 bits means nothing until you know what 8.5 is wide for.
     *
     * Recorded rather than charged. Converting bits to levels needs a
     * coefficient, and the honest way to get one is to fit it against answered
     * items, which needs this to have been logged first.
     */
    widthDelta = 0;

    positions: Record<string, number> = {};

    coords: [string, number, number][] = [];
    coords3D: [string, number, number, number][] = [];
    graphPremises: [string, string, string][] = [];
    graphConclusion: [string, string, string][] = [];

    constructor(type: EnumQuestionType) {
        this.type = type;
    }
}
