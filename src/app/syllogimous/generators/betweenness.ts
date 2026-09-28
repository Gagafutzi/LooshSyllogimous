/**
 * Betweenness — who must lie between these two.
 *
 * Isomorph's guide: *"A relation among three: 'B lies between A and C'. It says
 * nothing about left or right, so every arrangement that fits has a mirror image
 * that fits too. Select everyone who must lie between the two named entities in
 * every arrangement."*
 *
 * The first relation in this app that relates *three* things, and the reason to
 * have one. Every mode so far states facts about pairs, and a reader can get a
 * long way by treating each premise as an edge and chaining. Betweenness cannot
 * be chained that way: "B is between A and C" constrains a triple and says
 * nothing about any pair in it, so the only way through is to hold the
 * arrangements themselves.
 *
 * ── The mirror is the point, not a defect ──
 *
 * Because the relation is blind to direction, no premise set ever fixes a single
 * ordering: every arrangement has its reverse, and the reverse satisfies exactly
 * the same betweenness facts. So "who is second from the left" is never a
 * question this mode can ask. What survives the mirror is what lies *between*
 * things, which is why that is what it asks about — the question is chosen to be
 * one the relation can actually answer.
 *
 * ── Why a selection ──
 *
 * "Everyone who must" is a set, and a set is what the player picks, so the floor
 * is one subset in `2^n` and `guessRateFor("select", …)` prices it without help.
 * Asking instead for one name would need the answer to be a single entity, which
 * would throw away every item where two are pinned and every item where none is
 * — and "none of them is forced" is one of the readings worth training.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { hi, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import { permutations } from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";

/** `B` lies between `a` and `c` — said of the triple, not of any pair in it. */
interface Triple { a: number; b: number; c: number; }

/** Where each entity stands, as `permutations` gives it: `place[entity]`. */
type Row = number[];

const strictlyBetween = (place: Row, a: number, b: number, c: number) =>
    (place[a] < place[b] && place[b] < place[c])
    || (place[c] < place[b] && place[b] < place[a]);

const holdsAll = (place: Row, said: Triple[]) =>
    said.every(t => strictlyBetween(place, t.a, t.b, t.c));

export function createBetweenness(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createBetweenness");

    const type = EnumQuestionType.Betweenness;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    for (let attempt = 0; attempt < 300; attempt++) {
        /*
         * Six at most. The arrangements are every ordering, so the count is
         * `n!` — 720 at six and 5040 at seven, and the filtering is done once
         * per premise on each. Five or six is also as many as a card can name
         * without the selection becoming a wall of buttons.
         */
        const n = 5 + (numOfPremises > 5 ? 1 : 0);
        const words = getRandomSymbols(settings, n);
        if (new Set(words).size !== n) continue;

        const rows = permutations(n);
        const truth = rows[Math.floor(Math.random() * rows.length)];

        /* Every triple true of the real arrangement, as a pool to state from. */
        const available: Triple[] = [];
        for (let a = 0; a < n; a++) {
            for (let b = 0; b < n; b++) {
                for (let c = a + 1; c < n; c++) {
                    if (a === b || c === b) continue;
                    // (a,b,c) and (c,b,a) are the same statement, so only one is
                    // offered: `c > a` keeps each triple once.
                    if (strictlyBetween(truth, a, b, c)) available.push({ a, b, c });
                }
            }
        }
        if (available.length < numOfPremises) continue;

        const said = pickUniqueItems(available, numOfPremises).picked;
        const fitting = rows.filter(place => holdsAll(place, said));
        if (!fitting.length) continue;              // cannot happen: truth is one

        const forcedBetween = (x: number, y: number) => {
            const out: number[] = [];
            for (let m = 0; m < n; m++) {
                if (m === x || m === y) continue;
                if (fitting.every(place => strictlyBetween(place, x, m, y))) out.push(m);
            }
            return out;
        };

        /*
         * The pair asked about is never the ends of a stated premise.
         *
         * Drawn from the stated ends — which is the obvious choice, since those
         * are the pairs the premises speak about — the item gives its answer
         * away: "N lies between P and S" *is* the answer for the pair (P, S),
         * and three premises sharing those ends spell out three of the names to
         * select. The first draft did that and the first item built came out
         * with every candidate correct, all four of them readable off the
         * premises without a row being arranged.
         *
         * Asked of a pair no premise uses as its ends, every name in the answer
         * has to be derived. Both ends still have to be named *somewhere*, or
         * the premises do not constrain them and the answer is trivially
         * nobody.
         */
        const named = new Set(said.flatMap(t => [t.a, t.b, t.c]));
        const statedEnds = new Set(said.map(t => `${Math.min(t.a, t.c)}:${Math.max(t.a, t.c)}`));
        const askable: Array<[number, number]> = [];
        for (let a = 0; a < n; a++) {
            for (let b = a + 1; b < n; b++) {
                if (!named.has(a) || !named.has(b)) continue;
                if (statedEnds.has(`${a}:${b}`)) continue;
                askable.push([a, b]);
            }
        }
        if (!askable.length) continue;

        /*
         * Preferring a pair that forces somebody.
         *
         * Not because "nobody" is easy — establishing that nobody is forced
         * means checking every candidate against every arrangement, which is the
         * whole reading. Because it is *likely*: `guessRateFor("select", …)`
         * prices a selection at one subset in `2^n`, which assumes no single
         * subset is much likelier than another, and an empty answer that came up
         * a fifth of the time would credit submitting nothing as though it had
         * named one subset in eight. Kept at about a tenth, which leaves the
         * reading available — a premise set that pins nobody is worth meeting —
         * without letting it carry the mode's floor.
         */
        const settling = askable.filter(([a, b]) => forcedBetween(a, b).length > 0);
        const pool = settling.length && Math.random() > 0.08 ? settling : askable;
        const [x, y] = pickUniqueItems(pool, 1).picked[0];
        const forced = forcedBetween(x, y);

        /*
         * The candidates offered, which are every other name.
         *
         * Not a drawn subset: leaving one out would mean the card sometimes
         * omits a name the premises force, and the player who noticed would be
         * right and have nowhere to say so.
         */
        const candidates = shuffle([...Array(n).keys()].filter(m => m !== x && m !== y));
        const answer = candidates
            .map((m, i) => forced.includes(m) ? i : -1)
            .filter(i => i >= 0);

        /*
         * An item where nobody is forced is a real reading and a rare keeper.
         *
         * It is the honest answer to a premise set that pins nothing, and
         * "select nothing" has to stay available or the mode teaches that there
         * is always somebody. The rate is set by the draw above rather than
         * here: rejecting at this point would throw away the whole item and its
         * premises, when the only thing unwanted about it is which pair was
         * asked.
         */

        const line = (t: Triple) =>
            `${subj(words[t.b])} lies between ${subj(words[t.a])} and ${subj(words[t.c])}`;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            said.map(line), ctx.settingsOverrideService.scramble, ctx.mergeTarget());

        question.choices = candidates.map(m => subj(words[m]));
        question.selectAnswer = answer;
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = `Select everyone who must lie between `
            + `${words[x]} and ${words[y]}.`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "Everyone stands in a row. <b>Lies between</b> says nothing about which "
            + "way round the row runs, so every arrangement that fits has a mirror "
            + "image that fits too.",
            `Select <b>everyone</b> who lies between ${subj(words[x])} and `
            + `${subj(words[y])} in every arrangement the premises allow — which may `
            + "be nobody.",
        ];

        question.explanation = explain(words, fitting, candidates, answer, x, y);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why those and not the others.
 *
 * Counted over the arrangements, because that is what the answer is: a name is
 * in because every arrangement the premises allow puts it between the two, and
 * out because at least one does not. An argument about the premises directly
 * would be one the player could not check against the mirror pair.
 */
function explain(
    words: string[],
    fitting: Row[],
    candidates: number[],
    answer: number[],
    x: number,
    y: number,
): string[] {
    const half = fitting.length / 2;
    return [
        `${hi(String(fitting.length))} arrangements fit every premise — `
        + `${half === 1 ? "one ordering" : `${half} orderings`} and `
        + (half === 1 ? "its mirror" : "their mirrors"),
        ...candidates.map((m, i) => answer.includes(i)
            ? `${subj(words[m])}: between ${subj(words[x])} and ${subj(words[y])} in all of them`
            : `${subj(words[m])}: outside them in at least one, so not forced`),
        answer.length === 0
            ? "so the premises force nobody between the two"
            : answer.length === 1
            ? "so exactly one name is pinned between them"
            : `so ${hi(String(answer.length))} are pinned between them`,
    ];
}
