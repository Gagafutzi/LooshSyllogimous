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
    `<span class="relation ${extra}">${symbolise(s)}</span>`;

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
     * The analogy pairing, in the notation analogies have always used.
     *
     * "A is to B as C is to D" becomes "A : B as C : D" — which is not a
     * translation into marks so much as the form the relation was borrowed
     * from. `as` is left as a word on purpose: it is a common enough English
     * connective that a two-letter key would be reaching into sentences it has
     * no business in.
     */
    "is to": ":",
};

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
    const out: Array<{ mark: string; word: string }> = [];

    for (const mark of new Set(Object.values(marks))) {
        if (!body.includes(mark)) continue;
        const words = Object.keys(marks)
            .filter(w => marks[w] === mark)
            .sort((a, b) => a.length - b.length);
        out.push({ mark, word: words[0] });
    }

    // The order the card reads in, so the key can be scanned against it.
    return out.sort((a, b) => body.indexOf(a.mark) - body.indexOf(b.mark));
}

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
    return html
        .split(/(<span class="subject">[\s\S]*?<\/span>)/)
        .map((part, i) => (i % 2 ? part : symbolise(part, marks)))
        .join("");
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
 * Symbolised as well as `rel`, and that is not a nicety: the composed spaces
 * write their clauses through *this*, not through `rel`, so a version that only
 * substituted in `rel` printed "3 north" unchanged on every n-dimensional card
 * — which is most of the cards the setting exists for. Caught by looking at a
 * real item rather than by reading the code, which is the only way that one was
 * ever going to be caught.
 *
 * Safe for the same reason `rel` is, plus one: axis *names* are capitalised
 * ("East-west", "Up-down") and the table is lower-case, so a heading is never
 * mistaken for the direction it names.
 */
export const hi = (s: string, extra = "") =>
    `<span class="highlight ${extra}">${symbolise(s)}</span>`;

/** The reversal cue: a word that means the opposite of what it says. */
export const neg = (s: string) => `<span class="is-negated">${symbolise(s)}</span>`;

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

export function randomRelationLabels(
    rand: () => number = Math.random,
): Record<string, string> {
    /* Group the fixed table by mark, so synonyms move together. */
    const classes = new Map<string, string[]>();
    for (const [word, mark] of Object.entries(RELATION_SYMBOLS)) {
        const list = classes.get(mark) ?? [];
        list.push(word);
        classes.set(mark, list);
    }

    const used = new Set<string>();
    const draw = () => {
        for (let tries = 0; tries < 400; tries++) {
            const a = LABEL_ALPHABET[Math.floor(rand() * LABEL_ALPHABET.length)];
            const b = LABEL_ALPHABET[Math.floor(rand() * LABEL_ALPHABET.length)];
            const token = a + b;
            if (!used.has(token)) { used.add(token); return token; }
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
    for (const words of classes.values()) {
        const token = draw();
        for (const word of words) out[word] = token;
    }
    return out;
}
