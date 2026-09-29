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
    /*
     * Four premises is the floor, and it is an object count rather than a
     * reading cost: the stem takes two objects and each candidate pair takes
     * two more that are not the stem's, so an item needs five objects before
     * it can offer a choice at all. Four premises is the shortest chain that
     * draws five.
     */
    [EnumQuestionType.AnalogyCompletion]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 20,
        basic: false
    },
    /*
     * One premise per adjacent pair, so the count *is* the ring size — and the
     * ring is odd, because an even one has a pair at exactly half the loop
     * that the rule does not settle. Five is the smallest ring with anything
     * to count: at three, every pair is adjacent and every answer is read off
     * a premise. Fifteen is the ceiling, where each object beats seven.
     */
    [EnumQuestionType.DominanceRing]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 15,
        basic: false
    },
    /*
     * Premises narrow the arrangements rather than building one, so the count
     * is how much is pinned down rather than how much there is to read. Three
     * is the floor: below it almost everything is still open and the answer is
     * "all three" whatever the system. Eight is the ceiling, where the premises
     * usually settle the pair outright and the skill is telling that.
     */
    [EnumQuestionType.PossibilitySets]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false
    },
    /* The same question over a dominance circle, so the same bounds. */
    [EnumQuestionType.CyclicDominance]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * The premise count is the second group only: the first list is complete
     * by definition and its length is the table's, not a setting. Three is the
     * floor for the same reason as Possibility Sets — below it nothing is
     * settled whatever the algebra turns out to be.
     */
    [EnumQuestionType.HiddenAlgebra]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * The premises are the options, so the count is the length of the menu as
     * well as of the reading. Four is the floor — below it there is rarely
     * anything spare to leave out — and seven the ceiling, because the smallest
     * sufficient subset is found by trying every subset and that is 2^n.
     */
    [EnumQuestionType.MinimalPremises]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 7,
        basic: false
    },
    /*
     * The premises are the options here too, so the count is the length of the
     * menu as well as of the reading. Six is the floor, and it is a measured
     * one rather than a guessed one: "withdraw any other and a clash remains"
     * needs the wrong premise to sit on *two* conflicts, so the set has to
     * carry two routes between the same pair. Drawn at random, four premises
     * produce that once in about five hundred and five about once in fifty,
     * which is a mode that intermittently fails to build; six is one in
     * twenty-two and the rejection loop clears it with room to spare.
     */
    [EnumQuestionType.Contradiction]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 9,
        basic: false
    },
    /*
     * Two of the count are held back as the candidates rather than stated, so
     * the floor is a premise higher than it looks: five leaves three premises,
     * which is the fewest that can leave a pair open and still bear on it.
     */
    [EnumQuestionType.MissingPremise]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * The analogies are the options, so the count is the length of the menu.
     * Five is the floor: the clash has to survive withdrawing any analogy but
     * one, which needs the disputed name spoken of by two others as well.
     */
    [EnumQuestionType.MappingConflict]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 9,
        basic: false
    },
    /*
     * Four premises at least, because three betweenness facts over five names
     * leave almost everything free; eight at most, because past that the
     * premises pin the row down to one ordering and its mirror, and then
     * everyone between the two ends is forced and the reading is over.
     */
    [EnumQuestionType.Betweenness]: {
        enabled: true,
        minNumOfPremises: 4,
        maxNumOfPremises: 8,
        basic: false
    },
    /*
     * The counts are the pairs, not a difficulty dial.
     *
     * Three periods have three pairs and one of them is the question, so two
     * premises is every pair that can be stated; four periods have six, so five
     * is. The generator widens from three periods to four at four premises for
     * that reason — the count *is* how many periods there are — and past five
     * there is nothing left to say without stating the answer.
     */
    [EnumQuestionType.Intervals]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 5,
        basic: false
    },
    /*
     * Six is the floor and it is the four claims that set it: the count is the
     * layout's premises, and three axes need four of them before there are pairs
     * enough two steps apart to draw eight distinct halves from. Nine is the
     * ceiling because the card already carries four analogies under the layout.
     */
    [EnumQuestionType.OddAnalogy]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 9,
        basic: false
    },
    /*
     * The count is the layout, and it is also the length of the menu — every
     * entity but the named one is offered. Five is the floor because three axes
     * need that many premises before positions accumulate rather than being
     * stated, and nine keeps the selection to a list rather than a wall.
     */
    [EnumQuestionType.Projection]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 9,
        basic: false
    },
    /*
     * The count is the arrows, not the entities: every one of these draws a fixed
     * number of named things and varies how densely they are connected, because
     * that is what makes two structures hard to line up. The floors are where a
     * web has enough shape for a decoy one arrow away to exist at all.
     */
    [EnumQuestionType.StructureMatch]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 10,
        basic: false
    },
    /* Stops at eight because the host system caps at seven entities: asked for
       more, the mode built the same item while the ladder printed a larger
       number. Measured, not guessed. */
    [EnumQuestionType.MotifSearch]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 8,
        basic: false
    },
    [EnumQuestionType.PartialIsomorphism]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 10,
        basic: false
    },
    [EnumQuestionType.CommonSubsystem]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 9,
        basic: false
    },
    /* The count is the arrows on each side; six is the fewest that leaves one
       lining-up strictly better than every other. */
    [EnumQuestionType.PartialAnalogy]: {
        enabled: true,
        minNumOfPremises: 6,
        maxNumOfPremises: 10,
        basic: false
    },
    /* Seven is the floor because the layout needs enough objects for three
       composed relations over disjoint pairs, plus somewhere one axis away for
       the decoy to stand. */
    [EnumQuestionType.SecondOrder]: {
        enabled: true,
        minNumOfPremises: 7,
        maxNumOfPremises: 10,
        basic: false
    },
    /* Seven is the floor: three axes, three codex words that all have to be used,
       and a chain of at least three steps so the answer is a sum. */
    /* Stops at eight: the chain caps at six steps and the codex at three words, so
       past that the mode built the same item while the ladder printed a larger
       number. Measured across the range, not guessed. */
    [EnumQuestionType.ObliqueBasis]: {
        enabled: true,
        minNumOfPremises: 7,
        maxNumOfPremises: 8,
        basic: false
    },
    /* The count is split between the two phases — placements before the move and
       after it — so seven is the fewest that leaves three and two with the move
       between them. */
    [EnumQuestionType.PivotTransforms]: {
        enabled: true,
        minNumOfPremises: 7,
        maxNumOfPremises: 11,
        basic: false
    },
    /* Eight is the floor: three axes, two composed base contexts and at least two
       operations that each change the running value. */
    [EnumQuestionType.ContextShifts]: {
        enabled: true,
        minNumOfPremises: 8,
        maxNumOfPremises: 11,
        basic: false
    },
    /* Nine, because the card carries two arrangements, the pairings that pin the
       dictionary, and the analogy — and the dictionary needs at least two pairings
       before it is pinned at all. */
    [EnumQuestionType.CrossAnalogy]: {
        enabled: true,
        minNumOfPremises: 9,
        maxNumOfPremises: 11,
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
     * tops out at 10. Asking for twenty used to be answered with the same
     * reversal restated five times over.
     *
     * The frame itself carries eleven: three axes is eight grid statements, and
     * each axis reverses once or not at all, so there are three reversals to
     * state and no twelfth thing to say. The cap sits one below that because a
     * deep conclusion withholds a grid statement and `createDeictic` asks
     * `buildDeicticSpec` for one more than it was given to pay for it — so a
     * request of 10 is what arrives there as the full eleven, three axes with
     * all three reversed. An eleventh premise is answered with that same item
     * under a count claiming more work than it holds, and `Trial.premises`
     * records the request rather than what turned up, so the claim would be
     * believed.
     *
     * It was 8, on the reasoning that eight cells is the whole grid and past
     * that the premises repeat. They do not: the ninth and tenth are reversals,
     * and a reversal states something no grid statement states. That cap
     * stopped the mode one frame short of the double- and triple-reversed
     * three-axis items, which are its hardest and the classic hard case in
     * RFT's deictic protocols — and with the ladder emptied (see
     * `progression.utils`) the premise count is the only thing left that
     * reaches them. Past level 16 the selection had nothing to add but the
     * clock, and the clock bottoms out at eight seconds.
     */
    [EnumQuestionType.Deictic]: {
        enabled: true,
        minNumOfPremises: 5,
        maxNumOfPremises: 10,
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
    /*
     * Off by default: superseded by Widest Group, which asks the same question
     * per dimension and measures the spread between the members at that
     * dimension's edges, rather than deciding every dimension by majority vote
     * and counting departures. See fixes/5.2. Kept rather than deleted, for the
     * same reasons as Transformation Matching above -- the ability history is
     * real, and a player who liked it can switch it back on in Customise.
     */
    [EnumQuestionType.OddestRelation]: {
        enabled: false,
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
    /*
     * Off by default: superseded by Axis Maps, which asks the same question
     * relationally and in more than two dimensions. See fixes/5.1. It is kept
     * rather than deleted -- the ability history is real, and a player who
     * liked it can switch it back on in Customise.
     */
    [EnumQuestionType.TransformMatching]: {
        enabled: false,
        minNumOfPremises: 2,
        maxNumOfPremises: 6,
        basic: false
    },
    /*
     * Premises buy chain length, not statements: the worked examples come from
     * how many axes the map touches, and the chain is what has to be carried
     * through it. Seven links, and each group gets its own chain of that
     * length — so the longest items are three chains of seven, which is a great
     * deal of applying and exactly the point past the induction.
     */
    [EnumQuestionType.AxisMap]: {
        enabled: true,
        minNumOfPremises: 2,
        maxNumOfPremises: 7,
        basic: false
    },
    /*
     * Premises buy members per group. Three is the floor — two members have a
     * spread and no ordering, so nothing has to be arranged before it is read
     * — and six is the ceiling, past which the item is a longer sort rather
     * than a harder comparison.
     */
    /*
     * Premises are objects in a group, and three is the floor: with two, the
     * next one round and the one before it are the same object, so half the
     * role vocabulary collapses and the rule stops being identifiable. Six is
     * the ceiling — past it an `in-turn` sweep is a longer simulation rather
     * than a harder rule.
     */
    [EnumQuestionType.MutualMoves]: {
        enabled: true,
        minNumOfPremises: 3,
        maxNumOfPremises: 6,
        basic: false
    },
    [EnumQuestionType.WidestGroup]: {
        enabled: true,
        minNumOfPremises: 3,
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
    /** Drug names, formulas and pharmacy vocabulary as the tokens. Off by default. */
    pharmaStimuli: false,
    /**
     * Relative share of each stimulus kind, when more than one is on.
     *
     * Absent or 1 means an equal share, which is what enabling two kinds used
     * to force; zero is off.
     */
    stimulusMix: {} as Record<string, number>,
    meaningfulWords: true,
    /**
     * Nonsense letter triples as a stimulus kind in their own right.
     *
     * They were already reachable, but only by turning `meaningfulWords` off --
     * which is a switch on the *text* kind, so it replaced words rather than
     * joining them. You could have words or letters and never a mix, and the
     * control read as "make the words worse" rather than as a thing to choose.
     * Off by default, so nothing changes for anyone who has not asked.
     */
    randomLetters: false,
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