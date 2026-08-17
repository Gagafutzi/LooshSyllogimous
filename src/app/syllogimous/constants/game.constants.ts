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

export enum EnumTiers {
    Adept = "Adept",
    Scholar = "Scholar",
    Savant = "Savant",
    Expert = "Expert",
    Mastermind = "Mastermind",
    Visionary = "Visionary",
    Genius = "Genius",
    Virtuoso = "Virtuoso",
    Luminary = "Luminary",
    Prodigy = "Prodigy",
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

export const TIER_COLORS: Record<EnumTiers, { bgColor: string, textColor: string }> = {
    [EnumTiers.Adept]:          { bgColor: "#F0F8FF", textColor: "#045D56" },  // Alice Blue with Teal
    [EnumTiers.Scholar]:        { bgColor: "#ADD8E6", textColor: "#013220" },  // Light Blue with Deep Green
    [EnumTiers.Savant]:         { bgColor: "#E6E6FA", textColor: "#4B0082" },  // Lavender with Indigo
    [EnumTiers.Expert]:         { bgColor: "#D8BFD8", textColor: "#8B008B" },  // Thistle with Dark Magenta
    [EnumTiers.Mastermind]:     { bgColor: "#DDA0DD", textColor: "#483D8B" },  // Plum with Dark Slate Blue
    [EnumTiers.Visionary]:      { bgColor: "#B0E0E6", textColor: "#002366" },  // Powder Blue with Royal Blue
    [EnumTiers.Genius]:         { bgColor: "#AFEEEE", textColor: "#004953" },  // Pale Turquoise with Deep Aqua
    [EnumTiers.Virtuoso]:       { bgColor: "#00CED1", textColor: "#002D62" },  // Dark Turquoise with Deep Blue
    [EnumTiers.Luminary]:       { bgColor: "#98FB98", textColor: "#006400" },  // Pale Green with Dark Green
    [EnumTiers.Prodigy]:        { bgColor: "#FFFACD", textColor: "#556B2F" },  // Lemon Chiffon with Dark Olive Green
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
    [EnumTiers.Adept]:          "\u2726",  // ✦  four-pointed star
    [EnumTiers.Scholar]:        "\u2727",  // ✧  its hollow twin
    [EnumTiers.Savant]:         "\u25C8",  // ◈  diamond in a diamond
    [EnumTiers.Expert]:         "\u2756",  // ❖  black diamond minus white X
    [EnumTiers.Mastermind]:     "\u2B22",  // ⬢  hexagon
    [EnumTiers.Visionary]:      "\u2B21",  // ⬡  hollow hexagon
    [EnumTiers.Genius]:         "\u2736",  // ✶  six-pointed
    [EnumTiers.Virtuoso]:       "\u2737",  // ✷  eight-pointed
    [EnumTiers.Luminary]:       "\u2738",  // ✸  heavy eight-pointed
    [EnumTiers.Prodigy]:        "\u2739",  // ✹  twelve-pointed
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
    [EnumTiers.Absolute]:       "\u2B24",  // ⬤  filled circle: nothing left to add
};

export const NO_DATA = "--";

export const TIER_SCORE_RANGES: Record<EnumTiers, { minScore: number, maxScore: number }> = {
    [EnumTiers.Adept]:          { minScore: -INF, maxScore:  249 },
    [EnumTiers.Scholar]:        { minScore:  250, maxScore:  499 },
    [EnumTiers.Savant]:         { minScore:  500, maxScore:  749 },
    [EnumTiers.Expert]:         { minScore:  750, maxScore:  999 },
    [EnumTiers.Mastermind]:     { minScore: 1000, maxScore: 1249 },
    [EnumTiers.Visionary]:      { minScore: 1250, maxScore: 1499 },
    [EnumTiers.Genius]:         { minScore: 1500, maxScore: 1749 },
    [EnumTiers.Virtuoso]:       { minScore: 1750, maxScore: 1999 },
    [EnumTiers.Luminary]:       { minScore: 2000, maxScore: 2249 },
    [EnumTiers.Prodigy]:        { minScore: 2250, maxScore: 2499 },
    [EnumTiers.Oracle]:         { minScore: 2500, maxScore: 2749 },
    [EnumTiers.Sage]:           { minScore: 2750, maxScore: 2999 },
    [EnumTiers.Philosopher]:    { minScore: 3000, maxScore: 3249 },
    [EnumTiers.Mystic]:         { minScore: 3250, maxScore: 3499 },
    [EnumTiers.Transcendent]:    { minScore: 3500, maxScore: 3749 },
    [EnumTiers.Ascendant]:      { minScore: 3750, maxScore: 3999 },
    [EnumTiers.Paragon]:        { minScore: 4000, maxScore: 4249 },
    [EnumTiers.Archon]:         { minScore: 4250, maxScore: 4499 },
    [EnumTiers.Empyrean]:       { minScore: 4500, maxScore: 4749 },
    [EnumTiers.Demiurge]:       { minScore: 4750, maxScore: 4999 },
    [EnumTiers.Aeon]:           { minScore: 5000, maxScore: 5249 },
    [EnumTiers.Eidolon]:        { minScore: 5250, maxScore: 5499 },
    [EnumTiers.Numen]:          { minScore: 5500, maxScore: 5749 },
    [EnumTiers.Ineffable]:      { minScore: 5750, maxScore: 5999 },
    [EnumTiers.Absolute]:       { minScore: 6000, maxScore:  INF },
};

export const TIER_SCORE_ADJUSTMENTS: Record<EnumTiers, { increment: number, decrement: number }> = {
    [EnumTiers.Adept]:          { increment: 10, decrement: 10 },
    [EnumTiers.Scholar]:        { increment: 10, decrement: 10 },
    [EnumTiers.Savant]:         { increment: 10, decrement: 10 },
    [EnumTiers.Expert]:         { increment: 10, decrement: 10 },
    [EnumTiers.Mastermind]:     { increment: 10, decrement: 10 },
    [EnumTiers.Visionary]:      { increment: 10, decrement: 10 },
    [EnumTiers.Genius]:         { increment: 10, decrement: 10 },
    [EnumTiers.Virtuoso]:       { increment: 10, decrement: 10 },
    [EnumTiers.Luminary]:       { increment: 10, decrement: 10 },
    [EnumTiers.Prodigy]:        { increment: 10, decrement: 10 },
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

export const ORDERED_TIERS = Object.keys(TIER_SCORE_RANGES) as EnumTiers[];

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
export const TIERS_MATRIX: Record<number, [ 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1 ]> = {
     0: [ 1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ,  0 ],
     1: [ 1,  1,  1,  1,  1,  0,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ,  0 ],
     2: [ 1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ,  0 ],
     3: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ,  0 ],
     4: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0 ,  0 ],
     5: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  0,  0,  0,  1,  1,  0,  0,  0,  0,  0,  0,  0 ,  1 ],
     6: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
     7: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
     8: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
     9: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    10: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    11: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    12: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    13: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    14: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    15: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    16: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    17: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    18: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    19: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    20: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    21: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    22: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    23: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
    24: [ 1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1 ,  1 ],
};