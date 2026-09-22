/**
 * The tokens every premise and conclusion is built from.
 *
 * These three wrappers were defined separately in `ndspace.utils`,
 * `transformations.utils` and inline in half a dozen other places, which meant
 * "change how a premise reads" had no single place to change it. Adding one
 * colour per dimension touched five files for that reason, and missed the two
 * Direction3D modes entirely because their spans were written out by hand in
 * the generator.
 *
 * The markup is load-bearing, not decoration:
 *
 *   - `.subject` is matched by a regex in `question.utils` (`extractSubjects`)
 *     and in `GameService.fillLinearConclusion`, so the exact tag shape is a
 *     contract, not a style choice.
 *   - Angular's sanitizer strips inline styles from `[innerHTML]` bindings but
 *     keeps classes, which is why every visual difference here is a class.
 *
 * Pure strings. No Angular, no settings, no storage.
 */

/**
 * A stimulus: a word, an emoji, or a visual-noise fragment.
 *
 * Typed as a string now. Extracting this helper turned up generators handing it
 * a one-element array straight from `splice` and others handing it an optional,
 * all of which the template interpolation it replaced coerced silently; those
 * call sites have since been fixed, so the signature can say what it means.
 * `undefined` is still tolerated because two arrangement paths legitimately
 * build a claim before both ends are known.
 */
export const subj = (s: string | undefined) => `<span class="subject">${s}</span>`;

/**
 * A relation word, optionally painted as one dimension's.
 *
 * `extra` carries axis colour classes in the composed spaces and is empty
 * everywhere else — a one-axis mode has nothing to tell apart.
 */
export const rel = (s: string, extra = "") =>
    `<span class="relation ${extra}">${s}</span>`;

/* ------------------------------------------------------------------ *
 * Minimal mode: a symbol where a word would be                        *
 * ------------------------------------------------------------------ */

/**
 * Every relation word the scales define, and the mark that stands for it.
 *
 * **Why a written table and not a field on the scale.** `linear.utils` imports
 * this file, so this file cannot import it back — and a hand-written list that
 * can fall behind is exactly the failure this project keeps finding. So the
 * completeness is a *test* instead: `tests/symbols.test.ts` walks every scale,
 * every direction, tie and cyclic wording, and fails on the first one with no
 * mark. A relation the app can state and this cannot is a build error, not a
 * blank on somebody's card.
 *
 * **Why they are distinct per axis.** A composed space states four or five
 * relations in one line, and colour already carries which axis is which — but
 * colour is the one channel a player may not have. Two axes sharing a mark
 * would make a premise unreadable for them in a way the words never were.
 *
 * Shared marks are deliberate where the *relation* is shared: "same height"
 * and "is at the same height as" are one fact said twice, and `up` and
 * `vertical` are two spellings of one axis that never appear together.
 */
export const RELATION_SYMBOLS: Record<string, string> = {
    /*
     * Quantity — the comparisons that already have marks, in their fullwidth
     * forms.
     *
     * Not ASCII `<` and `>`. Premises are rendered through `[innerHTML]`, so a
     * bare angle bracket is markup: `<span class="relation"><</span>` has its
     * `<` swallowed by whatever follows, and the relation vanishes off the card
     * entirely. It did, on a comparison item that read "Kiwi  Doll".
     */
    "is more than": "＞", "is less than": "＜", "is equal to": "＝",
    "greater": "＞", "smaller": "＜", "same amount": "＝",

    // Time, as chevrons: direction along a line that is not a direction in space.
    "is after": "»", "is before": "«", "is at the same time as": "≈",
    "later": "»", "earlier": "«", "same time": "≈",
    "later in the cycle": "↻", "earlier in the cycle": "↺",
    "is at the same point of the cycle as": "≈",

    // Containment, as the set marks it is.
    "contains": "⊃", "is within": "⊂", "is the same size as": "≡",
    "wider": "⊃", "narrower": "⊂", "same size": "≡",

    // Vertical: "on top of" rather than "above", which is the other scale.
    "is on top of": "∧", "is under": "∨", "is at the same height as": "≀",
    "higher": "∧", "lower": "∨", "same height": "≀",

    /*
     * Distinction is the one axis with no order, so its marks carry none.
     *
     * It also has a second vocabulary — `parity`, for the composed spaces,
     * where a run of steps is read as odd or even rather than as a distance.
     * "opposite kind" lives only there, which is why it was the one word left
     * printing as text on a seven-dimensional card: both the table and the test
     * that was meant to catch the table read the same four fields and neither
     * read this one.
     */
    "is a different kind from": "≠", "is the same kind as": "≐",
    "different kind": "≠", "same kind": "≐",
    "opposite kind": "≠", "is the opposite kind to": "≠",
    /*
     * Distinction's own wording for the same two relations. The mode — and
     * Binary and Analogy, which are built on it — says "same as" and "opposite
     * of", which appeared in no scale, so the whole mode printed English under
     * both switches while every mode beside it was converted.
     */
    "same as": "≐", "opposite of": "≠",

    // Temperature keeps its degree sign, since nothing else on a card has one.
    "is warmer than": "↑°", "is colder than": "↓°", "is as warm as": "=°",
    "warmer": "↑°", "colder": "↓°", "same warmth": "=°",

    // Left and right, as solid triangles — distinct from east and west, which
    // are the same geometry with a different frame behind it.
    "is right of": "▶", "is left of": "◀", "is at the same place as": "≍",
    "right": "▶", "left": "◀", "same place": "≍",
    "clockwise": "↻", "anticlockwise": "↺", "is at the same position as": "≍",

    // The compass, as plain arrows.
    "is east of": "→", "is west of": "←", "is at the same longitude as": "↔",
    "east": "→", "west": "←", "same longitude": "↔",
    "is at the same bearing as": "↔",
    "is north of": "↑", "is south of": "↓", "is at the same latitude as": "↕",
    "north": "↑", "south": "↓", "same latitude": "↕",

    // Height, as hollow arrows: up and down are already spent on north and
    // south, and a space can state both at once.
    "is above": "⇧", "is below": "⇩", "above": "⇧", "below": "⇩",

    /*
     * Direction3D's own wording, which belongs to no scale.
     *
     * Its ties take the mark of the tie they are: "on the same level" is the
     * same fact as "same height", and "in the same cardinal position" says both
     * compass axes tie at once, which is what "same place" means. Its poles are
     * spelled as the scales spell them, so they needed no marks of their own.
     */
    "at the same time": "≈",
    "on the same level": "≀", "in the same cardinal position": "≍",

    /*
     * The graph modes, whose relations are not scales at all.
     *
     * Hierarchy and Graph Matching state edges rather than positions — "feeds",
     * "reaches", "goes to" — so none of them appears in any scale and the
     * completeness test, which walks the scales, could not have found them.
     * They were the words left on a Hierarchy card after everything else had
     * been converted. `relationLiterals` and the test that reads it exist so
     * the next relation added outside the scales cannot slip through the same
     * gap.
     *
     * Marks chosen clear of the scale set: a card never mixes the two, but a
     * player moves between them and a mark that means two things across a
     * session is a mark that means neither.
     */
    "feeds": "⊳", "reaches": "⇒", "comes from": "↤",
    "goes to": "↦", "is connected to": "⇿",

    /*
     * The arrangements, which are positions along a path rather than a scale.
     *
     * Both arrangement modes wrote their relations as enum values, so they
     * appeared in no scale and in no `rel("…")` literal — the two things the
     * completeness check reads. Only the bare "left" and "right" inside them
     * matched anything, which put "is adjacent and ◀ of" on the card: the
     * direction in marks and the relation it qualifies still in words.
     *
     * Hollow triangles for the adjacent pair and solid for the loose one, since
     * that is the distinction the mode is made of — "immediately left" against
     * "somewhere left". The loose pair shares the left/right scale's marks
     * because it is the same relation.
     */
    "is adjacent and left of": "◁", "is adjacent and right of": "▷",
    "steps left of": "◀", "steps right of": "▶",
    "is at the left of": "◀", "is at the right of": "▶",
    "is next to": "◇", "is diametrically opposite to": "⊗",

    /*
     * The meta relation, which is an analogy and now reads as one.
     *
     * "A relates to B in the same way that C relates to D" is "A : B ∷ C : D",
     * and it was the last relation still printed entirely in English on every
     * mode that offers it — five of them. It shares ":" with the analogy
     * pairing because it is the same relation stated at length.
     */
    "relates to": ":", "in the same way that": "∷",
    "in the opposite way that": "∺",

    /*
     * The analogy pairing, in the notation analogies have always used.
     *
     * "A is to B as C is to D" becomes "A : B as C : D" — which is not a
     * translation into marks so much as the form the relation was borrowed
     * from. `as` is left as a word on purpose: it is a common enough English
     * connective that a two-letter key would be reaching into sentences it has
     * no business in.
     */
    "is to": ":",

    /*
     * The verdict of an analogy, which is the meta relation's two halves said
     * in one word — "A to B is alike C to D" is "A : B ∷ C : D".
     */
    "is alike": "∷", "is unlike": "∺",
    "is the same relation as": "∷", "has the same relation as": "∷",
    "is the opposite relation to": "∺",
};

/**
 * How the two arrangement modes word a position along their path.
 *
 * The enum in `question.constants` is the source; these are the strings it
 * renders to, which is what the card carries and therefore what needs a mark.
 * They differ in one place: the step count is interpolated in, so the keyable
 * part of that wording is the tail.
 */
export const ARRANGEMENT_WORDS = [
    "is adjacent and left of", "is adjacent and right of",
    "steps left of", "steps right of",
    "is at the left of", "is at the right of",
    "is next to", "is diametrically opposite to",
] as const;

/**
 * The meta relation, which says two pairs stand the same way to each other.
 *
 * Held here so the premise is built from the same strings the marks are keyed
 * on. It used to be written inline with the negation wrapped round the single
 * word "opposite", which split the phrase in two with markup and put it beyond
 * anything that reads whole relations.
 */
export const META_WORDS = {
    relatesTo: "relates to",
    same: "in the same way that",
    opposite: "in the opposite way that",
} as const;

/**
 * The words Direction3D states its own three axes with.
 *
 * Not a scale. Both Direction3D modes build their premises out of literals in
 * the generator, so the completeness check — which walks the scales, then the
 * `rel("…")` literals — could see none of them. The compass words were
 * capitalised there and lower case everywhere else, which is how a card came to
 * read "one level ⇧ and two steps North": half the premise in marks and half in
 * words, in minimal mode and under randomised labels alike.
 *
 * Exported so the generator and the table read the same strings, on the
 * `EDGE_WORDS` precedent, and so the check can count them as real.
 *
 * The two ties are worded per mode — a spatial third axis is a stack of levels
 * and a temporal one is a clock — and both mean "no difference on this axis".
 */
export const DIRECTION3D_WORDS = {
    /** The vertical axis, spatial. */
    above: "above", below: "below", sameLevel: "on the same level",
    /**
     * The same axis, temporal — in the chronological scale's own words.
     *
     * It said "one hour before" until the two modes were compared side by side,
     * where Comparison Chronological says "earlier" for the identical relation.
     * One relation with two names across modes is a thing to carry for no
     * reason, and "before" is a word Transformation Matching uses as a panel
     * caption, so the marks would have had to tell a relation from a heading by
     * its capital letter — which is the distinction that had just failed.
     */
    later: "later", earlier: "earlier", sameTime: "at the same time",
    /** Both compass axes at once, which is the only way they tie. */
    sameCardinal: "in the same cardinal position",
} as const;

/**
 * What Graph Matching calls its three edge directions.
 *
 * Exported so the generator reads its wording from the same place the marks are
 * kept. It used to hold them in a local object, which meant they appeared in no
 * scale and in no `rel("…")` literal — invisible to both checks, and therefore
 * the words that stayed on the card.
 */
export const EDGE_WORDS = {
    "→": "goes to",
    "←": "comes from",
    "↔": "is connected to",
} as const;

/**
 * Distinction's two relations, which Binary and Analogy are built on too.
 * Held here, on the `EDGE_WORDS` precedent, so the generators and the table
 * read the same strings and the completeness check can count them as real.
 */
export const DISTINCTION_WORDS = { same: "same as", opposite: "opposite of" } as const;

/**
 * The meta relation as the arrangements and the composed spaces word it —
 * "A to B has the same relation as C to D". Written from local strings, and
 * one through `rel(word)` with a variable the literal scan cannot read, so both
 * stayed English under either switch while the premises around them converted.
 */
export const PAIR_RELATION_WORDS = {
    same: "is the same relation as",
    opposite: "is the opposite relation to",
    has: "has the same relation as",
} as const;

/** An analogy's verdict: the meta relation's two halves, said in one word. */
export const ANALOGY_VERDICT = { alike: "is alike", unlike: "is unlike" } as const;

/** The words, longest first, so "is above" is not matched as "above". */
const RELATION_PATTERN = new RegExp(
    "\\b(" + Object.keys(RELATION_SYMBOLS)
        .sort((a, b) => b.length - a.length)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|") + ")\\b",
    "g");

/**
 * Off unless switched on, and held here rather than read from storage.
 *
 * This file is pure by design — no Angular, no settings, no storage — because
 * it runs inside generation, which is also where every test drives it from.
 * The switch is pushed in from the service that owns the setting instead, so
 * the rule stays a function of its arguments and one module-level flag.
 */
let symbolRelations = false;

export function setSymbolRelations(on: boolean) { symbolRelations = on; }

export function symbolRelationsOn() { return symbolRelations; }

/** What a relation word is called on this card. */
export function symbolFor(word: string): string | undefined {
    return RELATION_SYMBOLS[word];
}

/**
 * The marks a card is actually using, with what each one means.
 *
 * Read off the rendered text rather than from the item's axis list, so it
 * cannot disagree with what is on screen — a legend that lists an axis the card
 * does not mention is worse than none, and one that misses an axis it does is
 * worse still. Scanning the finished strings makes both impossible.
 *
 * The shortest wording wins as the label: a scale spells the same relation as
 * "north" and as "is north of", and a key is read in a glance or not at all.
 */
export function symbolLegend(
    texts: string[],
    marks: Record<string, string> = RELATION_SYMBOLS,
): Array<{ mark: string; word: string }> {
    const body = texts.join(" ");
    /*
     * **Object names are not marks.** Everything inside a `subject` span is
     * taken out before anything is looked for, which is the same protection
     * `symboliseStatement` gives when it rewrites — and it is needed here for a
     * sharper reason.
     *
     * A fresh label is two letters of the Latin alphabet, and one of the
     * stimulus pools is three-letter consonant-vowel-consonant strings in the
     * same alphabet: `QAR`, `ZIT`, `RUX`. So the label `UX` is a substring of
     * the object called `RUX`, and the key would list it — telling the reader
     * that a relation they have not been shown means "is north of", on a card
     * that never uses it. Measured at about one in seventy label-and-card
     * pairs, which is often enough to be met and rare enough never to be
     * reproduced on demand.
     *
     * Replaced rather than deleted, which keeps the card's shape: the text each
     * mark is found in still has a gap where the name was, so a mark cannot be
     * read across a join that only deletion would have created. On real cards
     * the names sit between spaces and deleting them would be safe too — this
     * is the cheaper guarantee, not a bug that was observed.
     */
    const shown = body.replace(SUBJECT_SPAN, SUBJECT_STANDIN);
    const out: Array<{ mark: string; word: string; at: number }> = [];
    /*
     * The fixed marks of the modes with rules of their own are on the card
     * under either switch, so the key explains them under either.
     */
    marks = { ...ownLegendMarks(), ...marks };

    /*
     * **Longest first, and each match struck out as it is found.**
     *
     * Two of the fixed marks contain another: the temperature axis is `↑°` and
     * `↓°`, and the vertical one is `↑` and `↓`. A plain `includes` sees `↑`
     * inside `↑°`, so a card stating nothing but temperature was given a key
     * that also explained "north" and "south" — two rows about relations the
     * item does not contain, on the one screen whose whole job is to say what
     * the card means.
     *
     * The stand-in is as long as what it replaces, so a mark's position is
     * still its position after an earlier one has been struck out, and the
     * order below is the order the card reads in.
     */
    let residue = shown;
    const longestFirst = [...new Set(Object.values(marks))]
        .filter(mark => !!mark)
        .sort((a, b) => b.length - a.length);

    for (const mark of longestFirst) {
        const at = residue.indexOf(mark);
        if (at === -1) continue;
        residue = residue.split(mark).join(STRUCK.repeat(mark.length));

        const words = Object.keys(marks)
            .filter(w => marks[w] === mark)
            .sort((a, b) => a.length - b.length);
        out.push({ mark, word: words[0], at });
    }

    // The order the card reads in, so the key can be scanned against it.
    return out
        .sort((a, b) => a.at - b.at)
        .map(({ mark, word }) => ({ mark, word }));
}

/**
 * A subject span, and what stands in its place while a card is being read.
 *
 * `symboliseStatement` keeps its own copy of this pattern rather than sharing
 * it, and has to: it splits on the span to protect it, which needs a capturing
 * group, and a `g`-flagged regex behaves differently under `split` than under
 * `replace`. The rule is the same — an object name is not relation text — and
 * `tests/phrasing.test.ts` holds the two to it from the outside.
 */
const SUBJECT_SPAN = /<span class="subject">[\s\S]*?<\/span>/g;
const SUBJECT_STANDIN = "\u00a4";
/** Stands in for a mark already credited, so a shorter one cannot re-read it. */
const STRUCK = "\u0000";

/**
 * A finished statement, with its relation words turned into marks.
 *
 * **Why this exists on top of `rel` and `hi`.** Substituting inside those two
 * covered the modes that build their premises out of them and missed nineteen
 * others, which write relation text directly — so minimal mode turned one line
 * of a comparison card into "Rice < Beanstalk" and left the three around it
 * saying "is less than". Twice now the funnel has turned out not to be one, and
 * the answer is to stop guessing where the words come from and convert the
 * finished string instead.
 *
 * **Object names are protected.** Everything inside a `subject` span is left
 * exactly as it is, so an object called Rice, Left or Contains is never
 * rewritten into a relation. That is not hypothetical — the noun pool is large
 * and the relation vocabulary is ordinary English.
 */
export function symboliseStatement(
    html: string,
    marks: Record<string, string> = RELATION_SYMBOLS,
): string {
    if (!symbolRelations && marks === RELATION_SYMBOLS) return html;
    return applyOwnRules(html, marks)
        .split(/(<span class="subject">[\s\S]*?<\/span>)/)
        .map((part, i) => (i % 2 ? part : symbolise(part, marks)))
        .join("");
}

/**
 * A setup line, with the relations in it converted and the prose left alone.
 *
 * The setup used to keep its words under both switches, on the stated grounds
 * that it "says things like 'every change it makes is shown below', where
 * 'below' is prose and a mark would be nonsense". That is right, and it is only
 * half the story — because some setup lines name the very relation the premises
 * have just been relabelled out of:
 *
 *   Stimulus Function  "Being wider makes something more fragile."
 *   Shape and Rotation "Corners: north, east, south, west."
 *   the composed spaces "The east/west axis is a loop of 4; it wraps around."
 *
 * Each of those is the rule the item turns on, and each was printing a relation
 * in English over premises that called it `QF`. Stimulus Function is the one
 * that is simply unanswerable that way: the whole item is "follow this property
 * along this relation", and the relation is named nowhere else.
 *
 * So the line is not converted wholesale — that would rewrite "Later premises
 * change the arrangement" into "QF premises change the arrangement", and the
 * prose argument was never wrong. What is converted is what the generator has
 * *marked* as a relation, by wrapping it in `rel` or `hi`. Prose is bare, or in
 * `<b>`, and is left exactly as it is.
 *
 * That makes it opt-in, which is the property worth having: a new setup line
 * naming a relation has to say so to be converted, and `tests/phrasing.test.ts`
 * fails on one that names a relation outside a marked span, so the choice is
 * made deliberately rather than discovered on a card.
 */
export function symboliseSetup(
    html: string,
    marks: Record<string, string> = RELATION_SYMBOLS,
): string {
    if (!symbolRelations && marks === RELATION_SYMBOLS) return html;
    /*
     * The inner text can carry markup of its own — `describeNdAxes` puts the
     * axis letter in `<b>` inside the same span — so this is not `[^<]*`. It is
     * still safe as a lazy match, because none of these spans contains another
     * one, so the first `</span>` is always this span's.
     */
    return html.replace(
        /(<span class="(?:relation|highlight)[^"]*">)([\s\S]*?)(<\/span>)/g,
        (_whole, open: string, inner: string, close: string) =>
            open + symbolise(inner, marks) + close);
}

/** Every word that has a mark, for the test that says every relation does. */
export function symbolisedWords(): string[] { return Object.keys(RELATION_SYMBOLS); }

/**
 * A relation phrase with its words replaced by marks.
 *
 * Applied inside `rel` and nowhere else, which is what makes this safe: object
 * names go through `subj`, so a thing called "North" is never touched, and the
 * only strings reaching here are relation phrases the scales produced.
 */
export function symbolise(
    s: string,
    marks: Record<string, string> = RELATION_SYMBOLS,
): string {
    if (!symbolRelations && marks === RELATION_SYMBOLS) return s;
    return s.replace(RELATION_PATTERN, m => marks[m] ?? m);
}

/**
 * An emphasised fragment, optionally painted as one dimension's.
 *
 * Neither this nor `rel` converts to marks any more. Both did, at generation
 * time, whenever minimal mode was on — and with fresh labels on as well, the
 * relations written through them reached the relabelling pass already as `↑`
 * and `＜`, which it cannot match. A card read "QF" for the words written
 * directly and "↑" for these. Conversion happens once, on the finished item,
 * in `symboliseStatement`.
 */
export const hi = (s: string, extra = "") =>
    `<span class="highlight ${extra}">${s}</span>`;

/**
 * The join in a premise that states two relations rather than one.
 *
 * "A is above B, which is above C" names three objects and states two binary
 * relations sharing a middle term. It reads as one sentence and it is not one
 * relation, and nothing downstream can tell the difference from the text: a
 * genuinely ternary premise — "B is between A and C" — names three objects too,
 * and is a single relation that does not come apart.
 *
 * The distinction matters to what the item is *worth*: two binary steps and one
 * ternary step are different demands, and a measure that cannot tell them apart
 * reports a wide item as though every reader held three things at once.
 *
 * So the writer marks the join and the reader splits on it, the way `subj` and
 * `extractSubjects` already work, and `neg` and `countNegations`. A class rather
 * than the wording, so rephrasing the connective cannot silently change what an
 * item is measured as.
 */
export const CHAIN_CLASS = "chained";

export const chainJoin = (text: string) =>
    `<span class="${CHAIN_CLASS}">${text}</span>`;

/** The reversal cue: a word that means the opposite of what it says. */
export const neg = (s: string) => `<span class="${NEGATED_CLASS}">${s}</span>`;

/**
 * The class a reversed word is marked with, and the one thing that reads it
 * back.
 *
 * Generators count their own negations as they render, which is right for every
 * mode that builds its own card. Analogy does not build one: it takes a
 * finished item from another mode, keeps the premises and throws the conclusion
 * away — so it inherits a count that includes negations from a line no longer
 * on the card. Its items claimed up to three with nothing struck through.
 *
 * Reading the count back out of the markup is exactly what the difficulty model
 * refuses to do, and for a good reason. This is the narrow exception: one mode
 * reconciling what it kept, with the reader living beside the writer so the two
 * cannot drift.
 */
const NEGATED_CLASS = "is-negated";

export function countNegations(texts: string[]): number {
    const mark = new RegExp(`class="[^"]*\\b${NEGATED_CLASS}\\b`, "g");
    return texts.reduce((n, t) => n + (t.match(mark)?.length ?? 0), 0);
}

/* ------------------------------------------------------------------ *
 * Dimension colour                                                    *
 * ------------------------------------------------------------------ */

/**
 * How many colour slots the stylesheet defines (`--th-dim-1` … `--th-dim-8`).
 *
 * ThemeService resolves the slots to actual colours, picking a light or dark
 * set for the theme and moving any hue too close to the accent out of the way.
 * Nothing here knows what colour a slot is.
 */
export const DIM_SLOTS = 8;

/**
 * A zero-based index into a palette that is numbered from one.
 *
 * `--th-dim-0` does not exist, so `slot % DIM_SLOTS` on a counter starting at
 * zero asks for an undefined custom property. The declaration is then invalid
 * at computed-value time and dropped — and `fill` inherits in SVG, so the
 * element falls through an unset ancestor to the initial value and is drawn
 * **black**. That is what happened to the first marked node in Relational Web,
 * and it also shifted every other marker one colour along.
 *
 * Anything painting from a counter goes through here rather than doing its own
 * modulo.
 */
export const dimSlot = (index: number) => (index % DIM_SLOTS) + 1;

/** The class pair for a slot: the generic hook, then the slot itself. */
export const dimClass = (slot: number) => `dim dim-${slot}`;


/* ------------------------------------------------------------------ *
 * Relation labels drawn fresh for each item                           *
 * ------------------------------------------------------------------ */

/**
 * A relation vocabulary invented for one item and thrown away after it.
 *
 * Minimal mode replaced the relation words with a *fixed* table of marks, and a
 * fixed table is learned: after a few hundred items `＜` is retrieved exactly
 * as fast as "is less than", and so are its compositions. The cost of stripping
 * the meaning is paid and nothing is collected for it.
 *
 * Drawing the labels fresh per item removes the thing that can be cached. There
 * is no composition table to build, because "QF then ZR" means something
 * different on the next card, so the arrangement has to be constructed from the
 * premises every time. That is variability of practice applied to the operator
 * rather than to the objects — worse to acquire and, on that literature's
 * prediction, better to retain.
 *
 * **Synonyms keep their grouping.** The fixed table maps several wordings onto
 * one mark — "north" and "is north of" are the same relation — so the fresh
 * labels are assigned per *equivalence class* of that table, not per key.
 * Assigning independently would make an item say two different things about the
 * same relation and be unanswerable.
 *
 * Not a replacement for minimal mode, and deliberately a separate switch: if
 * the argument for this is variability, making every item arbitrary is just a
 * new constant condition. The two switches let a session mix.
 */
const LABEL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I or O: they read as 1 and 0

/**
 * How an item lets you tell one pole of a relation from the other.
 *
 * A label is arbitrary by design, which leaves the reader with a problem the
 * fixed marks never posed: `＞` and `＜` say on their face that they are
 * opposites, and "QF" and "ZK" say nothing at all. There are two honest answers
 * to that and they are different exercises.
 *
 * `mapped` keeps a key, and makes reading it cost something — it is behind a
 * key press and it covers the card, so consulting it means giving up the
 * premises while you do. A key you can read beside the item is a lookup; a key
 * you have to swap the item out for is a rehearsal.
 *
 * The other three carry no key at all, and instead let the pairing be inferred:
 *
 *   `red`      one label for the axis, drawn red where it is inverted —
 *              "QF" and "QF" in red, so the pairing is given and the polarity
 *              is the thing to read.
 *   `anagram`  one label for the axis, its letters turned round where it is
 *              inverted — "QF" and "FQ". The same information as red, carried
 *              by the token rather than beside it, so it survives a reader who
 *              cannot use the colour.
 *   `colour`   two unrelated labels, painted in the axis's own colour, which is
 *              the only thing saying they belong together. Nothing says which
 *              is which — that is left to the item.
 */
export type LabelScheme = "mapped" | "red" | "anagram" | "colour";

/** The class an inverted label is drawn with under the `red` scheme. */
export const INVERTED_LABEL_CLASS = "label-inverted";

/**
 * Which marks are the two poles of one relation, base first.
 *
 * Written here rather than derived, because this file cannot import the scales
 * — `linear.utils` imports it. So the completeness is a test, as it is for the
 * marks themselves: `symbols.test.ts` walks every scale and fails if a scale's
 * two directions are not a pair here.
 *
 * Which of the two counts as inverted is arbitrary and only has to be stable,
 * since a label is redrawn per item anyway. The ties and the relations with no
 * opposite — "next to", "connected to", the graph edges — are absent, and get a
 * label of their own under every scheme.
 */
const MARK_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ["＞", "＜"], ["»", "«"], ["↻", "↺"], ["⊃", "⊂"], ["∧", "∨"],
    ["≠", "≐"], ["↑°", "↓°"], ["▶", "◀"], ["→", "←"], ["↑", "↓"],
    ["⇧", "⇩"], ["↤", "↦"], ["∷", "∺"], ["◁", "▷"],
];

/** Every mark that is one half of a pair, and the half it is. */
export function markPairs(): ReadonlyArray<readonly [string, string]> {
    return MARK_PAIRS;
}

export function randomRelationLabels(
    rand: () => number = Math.random,
    scheme: LabelScheme = "mapped",
): Record<string, string> {
    /* Group the fixed table by mark, so synonyms move together. */
    const classes = new Map<string, string[]>();
    for (const [word, mark] of Object.entries(RELATION_SYMBOLS)) {
        const list = classes.get(mark) ?? [];
        list.push(word);
        classes.set(mark, list);
    }

    const used = new Set<string>();
    /*
     * `reserve` is what the anagram scheme needs: a token whose reversal is
     * spoken for as well, and whose two letters differ — "QQ" reversed is "QQ",
     * which would say a relation and its opposite are the same thing.
     */
    const draw = (reserve = false) => {
        for (let tries = 0; tries < 400; tries++) {
            const a = LABEL_ALPHABET[Math.floor(rand() * LABEL_ALPHABET.length)];
            const b = LABEL_ALPHABET[Math.floor(rand() * LABEL_ALPHABET.length)];
            const token = a + b;
            const back = b + a;
            if (used.has(token) || (reserve && (a === b || used.has(back)))) continue;
            used.add(token);
            if (reserve) used.add(back);
            return token;
        }
        /* The alphabet holds 576 pairs and the table has far fewer classes, so
           this is unreachable — but a label that repeats would merge two
           relations, and an item that cannot be answered is worse than one that
           looks odd. */
        let n = used.size;
        let token = "Z" + n;
        while (used.has(token)) token = "Z" + (++n);
        used.add(token);
        return token;
    };

    const out: Record<string, string> = {};
    const label = (mark: string, text: string) => {
        for (const word of classes.get(mark) ?? []) out[word] = text;
    };

    /*
     * One label for both poles under `red` and `anagram`, so the pairing is
     * given and only the polarity has to be read. `mapped` and `colour` draw
     * the poles independently — the first has a key to settle them and the
     * second deliberately says nothing beyond the axis colour.
     */
    const paired = scheme === "red" || scheme === "anagram";
    const done = new Set<string>();

    if (paired) {
        for (const [base, inverted] of MARK_PAIRS) {
            if (!classes.has(base) && !classes.has(inverted)) continue;
            const token = draw(scheme === "anagram");
            label(base, token);
            label(inverted, scheme === "anagram"
                ? token[1] + token[0]
                : `<span class="${INVERTED_LABEL_CLASS}">${token}</span>`);
            done.add(base);
            done.add(inverted);
        }
    }

    for (const mark of classes.keys()) {
        if (done.has(mark)) continue;
        label(mark, draw());
    }
    return out;
}


/* ------------------------------------------------------------------ *
 * Modes with rules of their own                                       *
 * ------------------------------------------------------------------ */

/**
 * Wording that is not a relation between two objects, and so has no place in
 * the relation table — a syllogism's quantifiers, Binary's connectives, the
 * operations Transformation names.
 *
 * These were the words left on the card under both switches. They cannot be
 * put in `RELATION_SYMBOLS`: "All", "No", "is" and "and" are ordinary English,
 * and a table that matched them would rewrite sentences it has no business in.
 * So the generator marks exactly the words it means with `own(key)`, and the
 * conversion looks the key up here rather than matching text.
 *
 * **Fixed under randomised labels too.** Each of these is a rule the mode is
 * built on rather than an arbitrary name for a direction — "∀" and "∃" are
 * the logic, not a label for it — so a fresh vocabulary has nothing to vary
 * and they keep minimal mode's marks whichever switch is on. The one exception
 * is `relation`: a word that *is* a relation from the table, only written
 * where the table cannot safely match it, takes whatever that relation is
 * called on this card.
 *
 * An empty mark drops the words: "A and B are not both true" is "A ⊼ B", and
 * the tail has nothing left to say.
 */
export const OWN_RULES: Record<string, { words: string; mark: string; label?: string; relation?: string }> = {
    // Syllogism: the quantifiers, and the copula as membership.
    "syl-all": { words: "All", mark: "∀", label: "all" },
    "syl-some": { words: "Some", mark: "∃", label: "some" },
    "syl-no": { words: "No", mark: "∄", label: "no" },
    "syl-is": { words: "is", mark: "∈", label: "is" },
    "syl-is-not": { words: "is not", mark: "∉", label: "is not" },

    /*
     * Binary's connectives. Clear of `∧` and `∨`, which are the vertical
     * scale's marks and can be the operands' own relations on the same card,
     * and of `⊕`, which Infer the Relation uses for its unknown.
     */
    "bin-and": { words: "and", mark: "＆", label: "and" },
    "bin-or": { words: "or", mark: "｜", label: "or" },
    "bin-nand": { words: "and", mark: "⊼", label: "not both" },
    "bin-nand-tail": { words: "are not both true", mark: "" },
    "bin-nor": { words: "and", mark: "⊽", label: "neither" },
    "bin-nor-tail": { words: "are both false", mark: "" },
    "bin-xor": { words: "differs from", mark: "⊻", label: "differs from" },
    "bin-xnor": { words: "is equal to", mark: "⇔", label: "matches" },

    // Transformation's operations. The axis label sits between the halves.
    "tf-mirror": { words: "is ", mark: "⇋", label: "mirrored across" },
    "tf-mirrored": { words: "-mirrored across", mark: "" },
    "tf-mirrored-bare": { words: "mirrored across", mark: "" },
    "tf-scale": { words: "is ", mark: "⤢", label: "scaled from" },
    "tf-scaled": { words: "-scaled", mark: "" },
    "tf-scaled-bare": { words: "scaled", mark: "" },
    "tf-from": { words: "from", mark: "" },
    "tf-set": { words: "is set to", mark: "≔", label: "set to" },
    "tf-rotate": { words: "is ", mark: "⟳", label: "rotated around" },
    "tf-rotated": { words: "-rotated", mark: "" },
    "tf-around": { words: "around", mark: "" },

    /*
     * Knights and Knaves: "A and B are the same kind" is the distinction
     * relation, said around both names. The connective takes the relation's
     * mark and the tail goes, so it reads "A ≐ B" — and, being a relation, it
     * takes the item's own label when the labels are fresh.
     */
    "kn-same": { words: "and", mark: "≐", relation: "same kind" },
    "kn-same-tail": { words: "are the same kind", mark: "" },
    "kn-differ": { words: "and", mark: "≠", relation: "different kind" },
    "kn-differ-tail": { words: "are different kinds", mark: "" },

    // Graph Matching's reversed pair: "as the inverse of C to D".
    "gm-inverse": { words: "the inverse of", mark: "¬", label: "the inverse of" },

    // The analogy pairing, which is the table's "is to" said as "to".
    "pair-to": { words: "to", mark: ":", relation: "is to" },
};

const OWN_CLASS = "own-rule";

/** Words the conversion replaces by key rather than by matching the text. */
export const own = (key: keyof typeof OWN_RULES & string) =>
    `<span class="${OWN_CLASS} own--${key}">${OWN_RULES[key].words}</span>`;

const OWN_PATTERN = new RegExp(`<span class="${OWN_CLASS} own--([\\w-]+)">[^<]*</span>`, "g");

function applyOwnRules(html: string, marks: Record<string, string>): string {
    return html
        .replace(OWN_PATTERN, (whole, key: string) => {
            const rule = OWN_RULES[key];
            if (!rule) return whole;
            const mark = rule.relation ? (marks[rule.relation] ?? rule.mark) : rule.mark;
            return mark ? `<span class="${OWN_CLASS}">${mark}</span>` : "";
        })
        // A connective whose words were all tail leaves an empty line behind.
        .replace(/<div class="is-connector">\s*<\/div>/g, "");
}

/** The fixed marks, with what each one means, for the key. */
function ownLegendMarks(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const rule of Object.values(OWN_RULES)) {
        if (rule.mark && !rule.relation) out[rule.label ?? rule.words.trim()] = rule.mark;
    }
    return out;
}
