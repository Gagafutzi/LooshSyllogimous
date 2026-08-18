/**
 * Setup lines: the facts about an item that its premises do not state.
 *
 * Each one is stated *because* the item is not derivable without it — a reader
 * who does not know that later premises rewrite earlier relations will produce
 * a confidently wrong answer rather than a hesitant one. They live together
 * because several are shared between families, and because the wording matters
 * more than where it is used: these are the sentences that make an item fair.
 */

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
export const HIERARCHY_NOTE =
    "Premises are <b>direct</b> links. The question asks whether one reaches the "
    + "other along <b>any number</b> of steps.";

/** Stated whenever axes with no difference are left out of the premises. */
export const COMPACT_NOTE =
    "A dimension left out of a premise is <b>the same</b> for both.";

/**
 * Stated because the item is unfair without it.
 *
 * Every other mode guarantees the premises settle the question, so a reader who
 * cannot find the answer assumes they have missed a step and keeps looking.
 * Here not finding it is sometimes the answer, and nobody can be expected to
 * infer that from the item.
 */
export const INDETERMINATE_NOTE =
    "Some relations are left unstated. A claim counts as true only if it holds"
    + " in <b>every</b> arrangement the premises allow \u2014 if they leave it open,"
    + " the claim is false.";

/** Stated whenever later premises rewrite earlier relations. */
export const EDIT_NOTE =
    "Later premises <b>change the relations themselves</b>, in order. Answer "
    + "about the relations as they end up.";

export const ONE_STEP_NOTE =
    "Each premise is <b>one step</b> on every dimension it names.";

/**
 * Stated whenever operations move objects around a composed space.
 *
 * Distinct from EDIT_NOTE on purpose — the two look similar and mean opposite
 * things. An edit rewrites what a premise *said*; a transformation leaves every
 * premise true of the arrangement it described and then moves things out of it.
 */
export const ND_TRANSFORM_NOTE =
    "Later premises <b>move things</b> around the space, in order. Answer about "
    + "where they end up.";

/**
 * Stated whenever a conclusion compares two relations.
 *
 * "The same relation" is genuinely ambiguous between direction and distance,
 * and the item is undecidable rather than merely hard if the reader picks the
 * other one.
 */
export const ND_ANALOGY_NOTE =
    "Two relations are <b>the same</b> when they point the same way on every "
    + "dimension, and <b>opposite</b> when every direction is reversed. How far "
    + "apart things are does not matter.";
