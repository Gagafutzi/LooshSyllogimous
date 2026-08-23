import { EnumQuestionType } from "./question.constants";

export const INF = Infinity;

export enum EnumScreens {
    Intro = "Intro",
    Start = "Start",
    Tutorial = "Tutorial",
    Game = "Game",
    Feedback = "Feedback",
    History = "History",
    Tutorials = "Tutorials",
    Stats = "Stats",
    Settings = "Settings",
    Appearance = "Appearance",
    AdvancedOptions = "Advanced Options",
    Diagnostics = "Diagnostics",
    Calibration = "Calibration",
    TiersMatrix = "Tiers Matrix",
    OtherGames = "Other Games",
}

/**
 * The ladder, twenty-five rungs.
 *
 * It starts as a joke and stops being one. The bottom five are deliberately
 * undignified — nobody is a Savant on their first evening, and a rank that
 * flatters you at the start has nothing left to say later. From Adept on they
 * are earnest, and the top third keeps the words that made the ladder worth
 * climbing: Demiurge, Aeon, Numen, Ineffable.
 *
 * Positional. Colours, score bands and point adjustments below are all keyed by
 * these names but ordered by rank, so renaming a rung is safe and reordering
 * one is not.
 */
export enum EnumTiers {
    Peasant = "Peasant",
    TurnipFarmer = "Turnip Farmer",
    HedgeWizard = "Hedge Wizard",
    Apprentice = "Apprentice",
    Squire = "Squire",
    Adept = "Adept",
    Scholar = "Scholar",
    Expert = "Expert",
    Genius = "Genius",
    Visionary = "Visionary",
    Oracle = "Oracle",
    Sage = "Sage",
    Philosopher = "Philosopher",
    Mystic = "Mystic",
    Transcendent = "Transcendent",
    Ascendant = "Ascendant",
    Paragon = "Paragon",
    Archon = "Archon",
    Empyrean = "Empyrean",
    Demiurge = "Demiurge",
    Aeon = "Aeon",
    Eidolon = "Eidolon",
    Numen = "Numen",
    Ineffable = "Ineffable",
    Absolute = "Absolute",
}

/** Tier names in order, and the source the score bands are built from. */
export const ORDERED_TIER_NAMES = Object.values(EnumTiers);

export const TIER_COLORS: Record<EnumTiers, { bgColor: string, textColor: string }> = {
    [EnumTiers.Peasant]:          { bgColor: "#F0F8FF", textColor: "#045D56" },  // Alice Blue with Teal
    [EnumTiers.TurnipFarmer]:        { bgColor: "#ADD8E6", textColor: "#013220" },  // Light Blue with Deep Green
    [EnumTiers.HedgeWizard]:         { bgColor: "#E6E6FA", textColor: "#4B0082" },  // Lavender with Indigo
    [EnumTiers.Apprentice]:         { bgColor: "#D8BFD8", textColor: "#8B008B" },  // Thistle with Dark Magenta
    [EnumTiers.Squire]:     { bgColor: "#DDA0DD", textColor: "#483D8B" },  // Plum with Dark Slate Blue
    [EnumTiers.Adept]:      { bgColor: "#B0E0E6", textColor: "#002366" },  // Powder Blue with Royal Blue
    [EnumTiers.Scholar]:         { bgColor: "#AFEEEE", textColor: "#004953" },  // Pale Turquoise with Deep Aqua
    [EnumTiers.Expert]:       { bgColor: "#00CED1", textColor: "#002D62" },  // Dark Turquoise with Deep Blue
    [EnumTiers.Genius]:       { bgColor: "#98FB98", textColor: "#006400" },  // Pale Green with Dark Green
    [EnumTiers.Visionary]:        { bgColor: "#FFFACD", textColor: "#556B2F" },  // Lemon Chiffon with Dark Olive Green
    [EnumTiers.Oracle]:         { bgColor: "#FFDAB9", textColor: "#A0522D" },  // Peach Puff with Sienna
    [EnumTiers.Sage]:           { bgColor: "#FFC0CB", textColor: "#8B0000" },  // Pink with Dark Red
    [EnumTiers.Philosopher]:    { bgColor: "#D8BFD8", textColor: "#4A235A" },  // Thistle with Dark Purple
    [EnumTiers.Mystic]:         { bgColor: "#C71585", textColor: "#FFE4E1" },  // Medium Violet Red with Misty Rose
    [EnumTiers.Transcendent]:   { bgColor: "#4B0082", textColor: "#F0F8FF" },  // Indigo with Alice Blue
    [EnumTiers.Ascendant]:      { bgColor: "#7DD3FC", textColor: "#0C4A6E" },
    [EnumTiers.Paragon]:        { bgColor: "#67E8F9", textColor: "#083344" },
    [EnumTiers.Archon]:         { bgColor: "#5EEAD4", textColor: "#042F2E" },
    [EnumTiers.Empyrean]:       { bgColor: "#A5B4FC", textColor: "#1E1B4B" },
    [EnumTiers.Demiurge]:       { bgColor: "#C4B5FD", textColor: "#2E1065" },
    [EnumTiers.Aeon]:           { bgColor: "#F0ABFC", textColor: "#4A044E" },
    [EnumTiers.Eidolon]:        { bgColor: "#FDA4AF", textColor: "#4C0519" },
    [EnumTiers.Numen]:          { bgColor: "#FCD34D", textColor: "#451A03" },
    [EnumTiers.Ineffable]:      { bgColor: "#E5E7EB", textColor: "#111827" },
    [EnumTiers.Absolute]:       { bgColor: "#111827", textColor: "#F9FAFB" },
};

/**
 * A mark per tier, escalating from geometry to the celestial.
 *
 * Twenty-five names is more than anyone holds in order, and the colours alone
 * do not rank — a pale blue and a pale green say nothing about which is higher.
 * The symbols do: they start as plain four-pointed stars and simple polygons,
 * gain points and complexity through the middle, and end on astronomical and
 * void-like marks. Progress becomes legible at a glance, from the shape rather
 * than from remembering that Virtuoso outranks Genius.
 *
 * Chosen from ranges with broad font coverage — geometric shapes, dingbat stars
 * and a handful of astronomical signs — because the app's own fonts carry none
 * of them and every one of these falls back cleanly to a system symbol font.
 */
export const TIER_SYMBOLS: Record<EnumTiers, string> = {
    [EnumTiers.Peasant]:          "\u2726",  // ✦  four-pointed star
    [EnumTiers.TurnipFarmer]:        "\u2727",  // ✧  its hollow twin
    [EnumTiers.HedgeWizard]:         "\u25C8",  // ◈  diamond in a diamond
    [EnumTiers.Apprentice]:         "\u2756",  // ❖  black diamond minus white X
    [EnumTiers.Squire]:     "\u2B22",  // ⬢  hexagon
    [EnumTiers.Adept]:      "\u2B21",  // ⬡  hollow hexagon
    [EnumTiers.Scholar]:         "\u2736",  // ✶  six-pointed
    [EnumTiers.Expert]:       "\u2737",  // ✷  eight-pointed
    [EnumTiers.Genius]:       "\u2738",  // ✸  heavy eight-pointed
    [EnumTiers.Visionary]:        "\u2739",  // ✹  twelve-pointed
    [EnumTiers.Oracle]:         "\u263D",  // ☽  first quarter moon
    [EnumTiers.Sage]:           "\u263E",  // ☾  last quarter moon
    [EnumTiers.Philosopher]:    "\u269A",  // ⚚  staff of Hermes
    [EnumTiers.Mystic]:         "\u2734",  // ✴  eight-pointed black star
    [EnumTiers.Transcendent]:   "\u273A",  // ✺  sixteen-pointed asterisk
    [EnumTiers.Ascendant]:      "\u27E1",  // ⟡  concave-sided diamond
    [EnumTiers.Paragon]:        "\u2B1F",  // ⬟  black pentagon
    [EnumTiers.Archon]:         "\u29EB",  // ⧫  black lozenge
    [EnumTiers.Empyrean]:       "\u2735",  // ✵  eight-pointed pinwheel
    [EnumTiers.Demiurge]:       "\u29C9",  // ⧉  two joined squares
    [EnumTiers.Aeon]:           "\u221E",  // ∞  infinity
    [EnumTiers.Eidolon]:        "\u25C9",  // ◉  fisheye
    [EnumTiers.Numen]:          "\u2609",  // ☉  the sun
    [EnumTiers.Ineffable]:      "\u27C1",  // ⟁  triangle within a triangle
    [EnumTiers.Absolute]:       "\u269D",  // ⚝  outlined star: the one past the stars
};

export const NO_DATA = "--";

/**
 * One tier per level of measured ability.
 *
 * These were bands of 250 points running to 6000, written when the score was
 * the *accumulated* one — unbounded, and a measure of how much you had played.
 * The score is now the ability estimate times a hundred by default, which stops
 * at 2600, so fourteen of the twenty-five names could never be earned by
 * anybody and the badge stopped tracking anything the player could see: every
 * mode unlocked, and still Apprentice.
 *
 * Built from the ability grid instead, so a tier *is* a level: Turnip Farmer at
 * level 2, Absolute at 26. The badge, the points-to-next-tier readout, the
 * crossing announcement and the Advanced Options picker all read these bands,
 * so deriving them keeps one source of truth rather than four agreeing by hand.
 *
 * A player still on the accumulated score climbs these faster than before —
 * 2600 points instead of 6000 for the full set. That is the honest trade: the
 * names are flavour, and a flavour ladder nobody can finish is worse than one
 * that runs a little quick for a path that is no longer the default.
 */
const TIER_BAND = 100;

export const TIER_SCORE_RANGES: Record<EnumTiers, { minScore: number, maxScore: number }> =
    Object.fromEntries(ORDERED_TIER_NAMES.map((tier, i) => {
        // The first tier catches everything below the grid, the last everything
        // above it: an estimate outside the bands is still somebody's estimate.
        const min = i === 0 ? -INF : (i + 1) * TIER_BAND;
        const max = i === ORDERED_TIER_NAMES.length - 1 ? INF : (i + 2) * TIER_BAND - 1;
        return [tier, { minScore: min, maxScore: max }];
    })) as Record<EnumTiers, { minScore: number, maxScore: number }>;

export const TIER_SCORE_ADJUSTMENTS: Record<EnumTiers, { increment: number, decrement: number }> = {
    [EnumTiers.Peasant]:          { increment: 10, decrement: 10 },
    [EnumTiers.TurnipFarmer]:        { increment: 10, decrement: 10 },
    [EnumTiers.HedgeWizard]:         { increment: 10, decrement: 10 },
    [EnumTiers.Apprentice]:         { increment: 10, decrement: 10 },
    [EnumTiers.Squire]:     { increment: 10, decrement: 10 },
    [EnumTiers.Adept]:      { increment: 10, decrement: 10 },
    [EnumTiers.Scholar]:         { increment: 10, decrement: 10 },
    [EnumTiers.Expert]:       { increment: 10, decrement: 10 },
    [EnumTiers.Genius]:       { increment: 10, decrement: 10 },
    [EnumTiers.Visionary]:        { increment: 10, decrement: 10 },
    [EnumTiers.Oracle]:         { increment: 10, decrement: 10 },
    [EnumTiers.Sage]:           { increment: 10, decrement: 10 },
    [EnumTiers.Philosopher]:    { increment: 10, decrement: 10 },
    [EnumTiers.Mystic]:         { increment: 10, decrement: 10 },
    [EnumTiers.Transcendent]:   { increment: 10, decrement: 10 },
    [EnumTiers.Ascendant]:      { increment: 10, decrement: 10 },
    [EnumTiers.Paragon]:        { increment: 9, decrement: 10 },
    [EnumTiers.Archon]:         { increment: 8, decrement: 10 },
    [EnumTiers.Empyrean]:       { increment: 7, decrement: 10 },
    [EnumTiers.Demiurge]:       { increment: 6, decrement: 10 },
    [EnumTiers.Aeon]:           { increment: 5, decrement: 10 },
    [EnumTiers.Eidolon]:        { increment: 4, decrement: 10 },
    [EnumTiers.Numen]:          { increment: 4, decrement: 10 },
    [EnumTiers.Ineffable]:      { increment: 4, decrement: 10 },
    [EnumTiers.Absolute]:       { increment: 4, decrement: 10 },
};

export const ORDERED_TIERS = ORDERED_TIER_NAMES;

export const ORDERED_QUESTION_TYPES = [
    EnumQuestionType.Distinction,
    EnumQuestionType.ComparisonNumerical,
    EnumQuestionType.ComparisonChronological,
    EnumQuestionType.LinearVertical,
    EnumQuestionType.LinearHorizontal,
    EnumQuestionType.LinearContains,
    EnumQuestionType.Syllogism,
    EnumQuestionType.LinearArrangement,
    EnumQuestionType.CircularArrangement,
    EnumQuestionType.Direction,
    EnumQuestionType.Direction3DSpatial,
    EnumQuestionType.Direction3DTemporal,
    EnumQuestionType.Space3D,
    EnumQuestionType.Space4D,
    EnumQuestionType.Space5D,
    EnumQuestionType.Space6D,
    EnumQuestionType.Space7D,
    EnumQuestionType.GraphMatching,
    EnumQuestionType.Hierarchy,
    EnumQuestionType.Analogy,
    EnumQuestionType.Binary,
    EnumQuestionType.Deictic,
    EnumQuestionType.Transformation,
    EnumQuestionType.AnchorSpace,
    EnumQuestionType.AnchorSpaceV2,
    EnumQuestionType.InferRelation,
    EnumQuestionType.OddestRelation,
    EnumQuestionType.ShapeRotation,
    EnumQuestionType.RelationalWeb,
    EnumQuestionType.StimulusFunction,
    EnumQuestionType.TransformMatching,
    EnumQuestionType.AxisMap,
    EnumQuestionType.WidestGroup,
    EnumQuestionType.Knaves,
    EnumQuestionType.NestedSpaces,
];

/**
 * Which modes each tier has unlocked, as a positional tuple over
 * ORDERED_QUESTION_TYPES. The two must be edited together — the tuple width is
 * the only thing the compiler checks, so a row of the right length in the wrong
 * order fails silently.
 */
/**
 * Which modes each tier has unlocked, as a positional tuple over
 * ORDERED_QUESTION_TYPES. The two must be edited together — the tuple width is
 * the only thing the compiler checks, so a row of the right length in the wrong
 * order fails silently.
 */
/**
 * Which modes each tier has unlocked, as a positional tuple over
 * ORDERED_QUESTION_TYPES. The two must be edited together — the tuple width is
 * the only thing the compiler checks, so a row of the right length in the wrong
 * order fails silently.
 */
export const TIERS_MATRIX: Record<number, [ 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1 ]> = {
    
    
    
     0: [ 1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    
    
    
     1: [ 1,  1,  1,  1,  1,  0,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    
    
    
     2: [ 1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    
    
    
     3: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    
    
    
     4: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    
    
    
     5: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  1,  0,  0,  0,  0,  0,  0,  0,  1,  0,  1,  0,  0,  0,  1,  0,  0 ],
    
    
    
     6: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
     7: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
     8: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
     9: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    10: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    11: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    12: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    13: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    14: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    15: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    16: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    17: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    18: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    19: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    20: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    21: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    22: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    23: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
    
    
    
    24: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  1,  1,  1,  1 ],
};