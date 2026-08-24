/**
 * Nested spaces — two unrelated arrangements, interleaved on purpose.
 *
 * The outer clause describes one space; the parenthetical describes another.
 * They share their objects and constrain each other in no way at all, so
 * verification is free: two independent layouts, each already exactly checkable
 * by the engines that built them.
 *
 * **The point is semantic interference.** `axisWordConflicts` forbids two axes
 * that share direction words, because "higher" belongs to both quantity and
 * height and a flat premise naming both is genuinely ambiguous — the generator
 * knows what it meant and the reader cannot. This mode wants exactly those
 * pairs, and it can have them for a reason worth stating in the code rather
 * than only in a design note:
 *
 *   **the space is identified by syntax, not by vocabulary.**
 *
 * Inside the brackets is one arrangement; outside is another. Position
 * disambiguates while wording interferes, so you get the conflict without the
 * ambiguity. The guard therefore stays exactly as it is for flat premises and
 * is waived only where nesting marks the scope.
 *
 * The sharpest item puts the same pair in both spaces with colliding words:
 *
 *     Ash is left of Bee (where Bee is left of Ash)
 *
 * Nothing there is contradictory. Every reading instinct says otherwise. That
 * is a relational Stroop, and generating it deliberately rather than waiting
 * for it to happen is what makes this more than a presentation change.
 */

import { GeneratorContext, deepConclusions } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getRandomSymbols } from "../utils/question.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { hi, subj } from "../utils/phrasing";
import {
    LINEAR_SCALES, LinearLayout, LinearScale, buildChain, compare, graphDistance,
    renderRelation,
} from "../utils/linear.utils";

/**
 * Which scale goes outside and which inside.
 *
 * Two lists so the collision rung has something to reach for. The plain pairing
 * keeps the vocabularies apart; the colliding one deliberately uses scales
 * whose words are the same or nearly so, which is the whole novel axis here.
 */
const PLAIN_PAIRS: Array<[string, string]> = [
    ["horizontal", "temporal"],
    ["vertical", "temporal"],
    ["temporal", "contains"],
    ["quantity", "temporal"],
];

const COLLIDING_PAIRS: Array<[string, string]> = [
    // Identical wording in both spaces: maximum interference, zero ambiguity,
    // because the brackets say which arrangement is meant.
    ["horizontal", "horizontal"],
    ["vertical", "vertical"],
    ["temporal", "temporal"],
    // Same word, different scales — the pairing `axisWordConflicts` exists to
    // forbid, which is sound to allow here and nowhere else.
    ["quantity", "vertical"],
    ["vertical", "quantity"],
];

/**
 * The shallowest conclusion this mode will serve, counted in relations of the
 * space it asks about.
 *
 * A pair that space states outright is depth 1, and asking it back tests
 * finding a premise rather than composing two — which is exactly what was
 * reported: five premises carrying ten relations, and a conclusion that was
 * premise four's bracket with the direction reversed.
 *
 * Two rather than the chain's full length, deliberately. Nested's difficulty is
 * carried by the interference between the two spaces as much as by the span
 * within either, so pinning the conclusion to the ends of one chain would make
 * the answer's position predictable while adding little. This is a floor meant
 * to rise, and raising it is this number.
 */
const MIN_DEPTH = 2;

const NESTED_NOTE =
    "Statements <b>outside</b> the brackets describe one arrangement."
    + " Statements <b>inside</b> them describe a completely separate one."
    + " The two share their objects and nothing else, so they cannot"
    + " contradict each other however alike they sound.";

export function createNested(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createNested");

    const type = EnumQuestionType.NestedSpaces;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    numOfPremises = clampPremises(type, numOfPremises);

    // Off, the conclusion pair is drawn as it always was: any two objects,
    // including the pair a premise states outright.
    const floor = deepConclusions(ctx) ? MIN_DEPTH : 1;

    const collide = ctx.hasRung(type, "collide");
    const pairs = collide ? COLLIDING_PAIRS : PLAIN_PAIRS;
    const [outerId, innerId] = pairs[Math.floor(Math.random() * pairs.length)];
    const outerScale = LINEAR_SCALES[outerId];
    const innerScale = LINEAR_SCALES[innerId];

    /*
     * The conclusion asks about the space the phrasing pulls away from as often
     * as not — that is where the interference actually costs something. Drawn
     * rather than always chosen, or the reader learns to read only one half.
     */
    const askInner = coinFlip();

    for (let attempt = 0; attempt < 200; attempt++) {
        const words = getRandomSymbols(settings, numOfPremises + 1);

        // Built independently, which is the whole claim of the mode: neither
        // arrangement knows the other exists.
        const outer = buildChain(words);
        const inner = buildChain(collide ? crossed(words) : shuffled(words));

        const outerText = outer.edges.map(([a, b]) =>
            renderRelation(outerScale, a, b, compare(outer, a, b), {}).text);
        const innerText = inner.edges.map(([a, b]) =>
            renderRelation(innerScale, a, b, compare(inner, a, b), {}).text);

        /*
         * Line the collision up rather than waiting for it.
         *
         * `crossed` guarantees some pair is adjacent in both chains and runs the
         * opposite way in each, but that only matters if the two halves land in
         * the *same premise* — otherwise it is two ordinary statements a page
         * apart. Reordering the inner half puts them side by side, which is the
         * item worth generating: "Ash is left of Bee (where Bee is left of
         * Ash)", contradictory to every reading instinct and contradictory to
         * nothing at all.
         */
        if (collide) alignCollision(outer.edges, inner.edges, innerText);

        const question = new Question(type);
        question.bucket = [...words];
        question.setup = [NESTED_NOTE];
        question.premises = outerText.map((text, i) =>
            innerText[i] ? `${text} ${hi(`(where ${innerText[i]})`)}` : text);

        const layout = askInner ? inner : outer;
        const scale = askInner ? innerScale : outerScale;
        const pair = pickPair(layout, floor);
        if (!pair) continue;

        const truth = compare(layout, pair[0], pair[1]);
        if (truth === 0) continue;

        // Relations of the asked-about space, which is the unit its solver
        // works in — the other space's half of every premise is there to be
        // read and set aside, and counting it would flatter the item.
        question.depth = graphDistance(pair[0], pair[1], layout.neighbors);

        const claimTrue = coinFlip();
        const stated = claimTrue ? truth : (truth === 1 ? -1 : 1);
        const claim = renderRelation(scale, pair[0], pair[1], stated, {}).text;

        question.conclusion = askInner
            ? `${hi("Inside the brackets")}: ${claim}`
            : `${hi("Outside the brackets")}: ${claim}`;
        question.isValid = claimTrue;
        question.explanation = explain(layout, scale, pair[0], pair[1], askInner, truth);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * A second ordering with one adjacent pair deliberately reversed.
 *
 * Both chains then state the same pair, in opposite directions, on scales whose
 * words collide. Nothing is contradictory — the arrangements are unrelated —
 * and that is precisely what has to be suppressed to answer.
 */
function crossed(words: string[]): string[] {
    const out = shuffled(words);
    if (out.length < 2) return out;

    const i = Math.floor(Math.random() * (words.length - 1));
    const [a, b] = [words[i], words[i + 1]];

    // Pull the pair out and reinsert it the other way round, wherever it fits.
    const rest = out.filter(w => w !== a && w !== b);
    const at = Math.floor(Math.random() * (rest.length + 1));
    return [...rest.slice(0, at), b, a, ...rest.slice(at)];
}

/** Put the shared pair's two statements in the same premise. */
function alignCollision(
    outerEdges: Array<[string, string]>,
    innerEdges: Array<[string, string]>,
    innerText: string[],
) {
    const same = (x: [string, string], y: [string, string]) =>
        (x[0] === y[0] && x[1] === y[1]) || (x[0] === y[1] && x[1] === y[0]);

    for (let i = 0; i < outerEdges.length; i++) {
        const k = innerEdges.findIndex(e => same(e, outerEdges[i]));
        if (k < 0 || k === i) continue;
        [innerText[i], innerText[k]] = [innerText[k], innerText[i]];
        return;
    }
}

/** A second ordering of the same objects, so the two spaces disagree freely. */
function shuffled(words: string[]): string[] {
    const out = [...words];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/**
 * A pair at least `floor` relations apart in the space being asked about.
 *
 * Drawn from every pair that clears the floor rather than only the furthest,
 * so where the answer sits in the chain still varies from item to item; what it
 * can no longer be is a premise handed back. Which way round the claim runs is
 * a separate coin flip, or every conclusion would read along the chain.
 */
function pickPair(layout: LinearLayout, floor: number): [string, string] | null {
    const { words, neighbors } = layout;
    const far: Array<[string, string]> = [];

    for (let i = 0; i < words.length; i++) {
        for (let j = i + 1; j < words.length; j++) {
            const d = graphDistance(words[i], words[j], neighbors);
            if (Number.isFinite(d) && d >= floor) far.push([words[i], words[j]]);
        }
    }
    if (!far.length) return null;

    const [a, b] = far[Math.floor(Math.random() * far.length)];
    return coinFlip() ? [a, b] : [b, a];
}

/**
 * The chain in the asked-about space, and nothing from the other one.
 *
 * Naming the other arrangement here would undo the mode: the reader's job is to
 * keep them apart, and a derivation that reassures them the two do not conflict
 * is answering a question they should never have entertained.
 */
function explain(
    layout: LinearLayout,
    scale: LinearScale,
    a: string,
    b: string,
    inner: boolean,
    truth: -1 | 0 | 1,
): string[] {
    const where = inner ? "inside the brackets" : "outside the brackets";
    const at = (w: string) => layout.pos[w];

    return [
        `Reading only the relations ${hi(where)}:`,
        `${subj(a)} sits at ${hi(String(at(a)))} and ${subj(b)} at ${hi(String(at(b)))}`
        + ` on that ${scale.name.toLowerCase()} scale.`,
        `so ${renderRelation(scale, a, b, truth, {}).text}`,
    ];
}
