/**
 * Transformation Matching — work out which map is operating.
 *
 * The induction gap. Every other mode states its relations and asks you to
 * apply them; this asks what relation is running, which is the operation matrix
 * tests measure and the one the app has never had.
 *
 * Four forms, in the order they are unlocked:
 *
 *   verify     does this map send S to S'?              (boolean, base)
 *   identify   which map sends S to S'?                 (choice)
 *   apply      S : S' :: R : ?  — the Raven's-isomorphic one
 *   compose    is S -> S'' the two steps run together?  (boolean)
 *
 * Everything is decided by coordinate equality on labelled points, so the
 * generator and the checker cannot drift: there is only one computation.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { hi } from "../utils/phrasing";
import {
    GridMap, Structure, applyMap, composeMaps, describeMap, describeStructure,
    distinguishing, mapPool, randomMap, sameStructure, signature,
} from "../utils/gridmap.utils";
import { sharedExtent } from "../utils/map.utils";

const FRAME_NOTE =
    "Each grid shows where the labelled points sit. Every grid of an item is"
    + " drawn on the <b>same frame</b>, so a point that has moved is in a"
    + " different square. The same change is applied to every point at once.";

/**
 * Hand the structures over to be drawn rather than listed.
 *
 * Coordinate lists made this mode arithmetic. A rotation, a reflection and a
 * shift are all the same kind of thing to a column of numbers — you work out
 * which by subtracting, which is the operation the mode is supposed to be
 * asking you to *see*. Drawn on one shared frame they are three obviously
 * different pictures.
 *
 * The frame is shared across every grid the item shows, options included: fitted
 * separately, a shape and the same shape shifted two east both fill their own
 * grid corner to corner and look identical.
 */
function draw(
    question: Question,
    labelled: Array<{ label: string; structure: Structure }>,
    options: Structure[] = [],
) {
    const all = [...labelled.map(l => l.structure), ...options];
    question.gridAxes = ["East-west", "North-south"];
    question.gridBounds = sharedExtent(all.map(asCoordMap));
    question.grids = labelled.map(l => ({ label: l.label, map: asCoordMap(l.structure) }));
    if (options.length) question.choiceGrids = options.map(asCoordMap);
}

const asCoordMap = (s: Structure): Record<string, number[]> =>
    Object.fromEntries(Object.keys(s).map(k => [k, [s[k][0], s[k][1]]]));

/** Which forms are live. Verify is always available; the rest are earned. */
function forms(ctx: GeneratorContext, type: EnumQuestionType) {
    return {
        identify: ctx.hasRung(type, "identify"),
        apply: ctx.hasRung(type, "apply"),
        compose: ctx.hasRung(type, "compose"),
        sequence: ctx.hasRung(type, "sequence"),
    };
}

export function createTransformMatch(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createTransformMatch");

    const type = EnumQuestionType.TransformMatching;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    numOfPremises = clampPremises(type, numOfPremises);

    /*
     * Premises buy points, not sentences.
     *
     * The item is two structures and a claim; length is how many labelled
     * points have to be checked, since a map is only pinned down by all of
     * them agreeing. Two points is the floor at which a map can be wrong in a
     * way that shows.
     */
    const pointCount = Math.max(2, Math.min(6, numOfPremises));
    const live = forms(ctx, type);

    const choices: Array<"verify" | "identify" | "apply" | "compose" | "sequence"> = ["verify"];
    if (live.identify) choices.push("identify");
    if (live.apply) choices.push("apply");
    if (live.compose) choices.push("compose");
    if (live.sequence) choices.push("sequence");
    const form = choices[Math.floor(Math.random() * choices.length)];

    for (let attempt = 0; attempt < 300; attempt++) {
        const twoSets = form === "apply" || form === "compose";
        const names = getRandomSymbols(settings, twoSets ? pointCount * 2 : pointCount);
        const order = names.slice(0, pointCount);
        const source = drawStructure(order);
        if (!source) continue;

        const question = new Question(type);
        question.bucket = [...order];
        question.setup = [FRAME_NOTE];

        const second = names.slice(pointCount, pointCount * 2);
        const built = form === "verify" ? buildVerify(question, order, source)
            : form === "identify" ? buildIdentify(question, order, source)
            : form === "compose" ? buildCompose(question, order, second, source)
            : form === "sequence" ? buildSequence(question, order, source)
            : buildApply(question, order, second, source);

        if (!built) continue;
        return question;
    }

    throw new Error("Cannot generate.");
}

/** Points far enough apart that no two maps in the pool agree on them. */
function drawStructure(order: string[]): Structure | null {
    const pool = mapPool();
    for (let attempt = 0; attempt < 200; attempt++) {
        const s: Structure = {};
        const taken = new Set<string>();
        let ok = true;
        for (const n of order) {
            let p: [number, number] = [0, 0];
            let guard = 0;
            do {
                p = [rnd(), rnd()];
                if (++guard > 50) { ok = false; break; }
            } while (taken.has(p.join(",")) || (p[0] === 0 && p[1] === 0));
            if (!ok) break;
            taken.add(p.join(","));
            s[n] = p;
        }
        if (ok && distinguishing(s, pool)) return s;
    }
    return null;
}

/** −3..3 without zero-heavy structures, which several maps fix. */
const rnd = () => Math.floor(Math.random() * 7) - 3;

function stateBoth(question: Question, order: string[], a: Structure, b: Structure) {
    // Kept as text too: the history list and the stats screens have no room
    // for a picture, and a recorded item still has to say what it was.
    question.premises = [
        `Before: ${describeStructure(a, order)}`,
        `After: ${describeStructure(b, order)}`,
    ];
    draw(question, [{ label: "Before", structure: a }, { label: "After", structure: b }]);
}

/* ---------------- verify ---------------- */

function buildVerify(question: Question, order: string[], source: Structure): boolean {
    const truth = randomMap();
    const image = applyMap(source, truth);
    const claimTrue = Math.random() < 0.5;

    let claimed = truth;
    if (!claimTrue) {
        const wrong = mapPool().filter(m =>
            !sameStructure(applyMap(source, m), image));
        if (!wrong.length) return false;
        claimed = wrong[Math.floor(Math.random() * wrong.length)];
    }

    stateBoth(question, order, source, image);
    question.conclusion = `The change from before to after is: ${hi(describeMap(claimed))}`;
    question.isValid = claimTrue;
    question.explanation = explainMap(order, source, image, truth, claimTrue ? null : claimed);
    return true;
}

/* ---------------- identify ---------------- */

function buildIdentify(question: Question, order: string[], source: Structure): boolean {
    const truth = randomMap();
    const image = applyMap(source, truth);

    /*
     * Distractors are rejected by what they *do* to this structure, not by
     * being different descriptions. Two maps can describe differently and act
     * identically here — a half turn and a double reflection, say — and an item
     * with two right answers is worse than an easy one.
     */
    const wrong = mapPool()
        .filter(m => !sameStructure(applyMap(source, m), image))
        .filter(m => describeMap(m) !== describeMap(truth));
    if (wrong.length < 3) return false;

    shuffle(wrong);
    const options = [truth, ...wrong.slice(0, 3)];
    shuffle(options);

    stateBoth(question, order, source, image);
    question.answerMode = "choice";
    question.choicePrompt = "Which change was applied?";
    question.choices = options.map(m => describeMap(m));
    question.correctChoice = options.findIndex(m => describeMap(m) === describeMap(truth));
    question.conclusion = describeMap(truth);
    question.isValid = true;
    question.explanation = explainMap(order, source, image, truth, null);
    return true;
}

/* ---------------- apply ---------------- */

function buildApply(
    question: Question,
    order: string[],
    otherNames: string[],
    source: Structure,
): boolean {
    const truth = randomMap();
    const image = applyMap(source, truth);

    const second = drawStructure(otherNames);
    if (!second) return false;
    const answer = applyMap(second, truth);

    const wrong = mapPool()
        .filter(m => !sameStructure(applyMap(second, m), answer))
        .map(m => applyMap(second, m));

    // Distinct *images*, since two maps can land the second structure in the
    // same place even when they differ on the first.
    const seen = new Set([signature(answer)]);
    const distinct = wrong.filter(s => {
        const k = signature(s);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
    if (distinct.length < 3) return false;

    shuffle(distinct);
    const options = [answer, ...distinct.slice(0, 3)];
    shuffle(options);

    question.bucket = [...order, ...otherNames];
    question.premises = [
        `Before: ${describeStructure(source, order)}`,
        `After: ${describeStructure(image, order)}`,
        `Now the same change is applied to: ${describeStructure(second, otherNames)}`,
    ];
    draw(question, [
        { label: "Before", structure: source },
        { label: "After", structure: image },
        { label: "Now this set", structure: second },
    ], options);
    question.answerMode = "choice";
    question.choicePrompt = "Where does the second set end up?";
    question.choices = options.map(s => describeStructure(s, otherNames));
    question.correctChoice = options.findIndex(s => signature(s) === signature(answer));
    question.conclusion = describeStructure(answer, otherNames);
    question.isValid = true;
    question.explanation = [
        `From before to after the change is ${hi(describeMap(truth))}.`,
        ...otherNames.map(n =>
            `${describeStructure({ [n]: second[n] }, [n])} becomes`
            + ` ${describeStructure({ [n]: answer[n] }, [n])}`),
        `so the second set ends at ${describeStructure(answer, otherNames)}`,
    ];
    return true;
}

/* ---------------- compose ---------------- */

function buildCompose(
    question: Question,
    order: string[],
    otherNames: string[],
    source: Structure,
): boolean {
    const first = randomMap();
    const middle = applyMap(source, first);
    const second = randomMap();
    const end = applyMap(middle, second);

    /*
     * Both steps have to be *visible*.
     *
     * The first version of this stated one step and then said "the same two
     * changes are applied again", which asked the reader to use a map the item
     * had never shown. Three structures are stated instead — start, halfway,
     * end — so each step is identifiable on its own, and the question is
     * whether the two run together correctly on something else.
     */
    if (sameStructure(middle, source) || sameStructure(end, middle)) return false;
    if (sameStructure(end, source)) return false;

    /*
     * The halfway structure has to identify the second step as clearly as the
     * start identifies the first.
     *
     * `drawStructure` only guarantees this of the *start*. The halfway point is
     * an image, and a map can land it somewhere two other maps agree on — a
     * doubling can produce coordinates a reflection and a rotation both send to
     * the same place. The item is then unanswerable in exactly the way that is
     * hardest to notice: the reader finds *a* second step, applies it, and gets
     * a defensible wrong answer.
     */
    if (!distinguishing(middle, mapPool())) return false;

    const other = drawStructure(otherNames);
    if (!other) return false;
    const landing = composeMaps(other, [first, second]);

    const claimTrue = Math.random() < 0.5;
    let shown = landing;
    if (!claimTrue) {
        /*
         * A false ending is drawn from what a *plausible* misreading gives —
         * one step only, the two in the wrong order, or one step twice. An
         * arbitrary wrong position would be rejectable without doing the work.
         */
        const slips = [
            applyMap(other, first),
            applyMap(other, second),
            composeMaps(other, [second, first]),
            composeMaps(other, [first, first]),
        ].filter(s => !sameStructure(s, landing));
        if (!slips.length) return false;
        shown = slips[Math.floor(Math.random() * slips.length)];
    }

    question.bucket = [...order, ...otherNames];
    question.premises = [
        `Start: ${describeStructure(source, order)}`,
        `After the first change: ${describeStructure(middle, order)}`,
        `After the second change: ${describeStructure(end, order)}`,
        `Both changes, in the same order, are applied to: ${describeStructure(other, otherNames)}`,
    ];
    draw(question, [
        { label: "Start", structure: source },
        { label: "After the first change", structure: middle },
        { label: "After the second change", structure: end },
        { label: "Both applied to this set", structure: other },
    ]);
    question.conclusion = `It ends at ${describeStructure(shown, otherNames)}`;
    question.isValid = claimTrue;
    question.explanation = [
        `The first change is ${hi(describeMap(first))}.`,
        `The second is ${hi(describeMap(second))}.`,
        `Running both over the last set gives`
        + ` ${describeStructure(landing, otherNames)}`,
        claimTrue
            ? `so it does end where the claim says`
            : `so it does not end where the claim says`,
    ];
    return true;
}

/* ---------------- sequence ---------------- */

/**
 * Three terms of a sequence; produce the fourth.
 *
 * The same machinery as `apply`, with the map composed with itself rather than
 * carried across to a different structure — so verification stays coordinate
 * equality on labelled points, and the mode gains extrapolation without gaining
 * an engine.
 *
 * It is a genuinely different demand, though, which is why it is its own rung.
 * `apply` shows the rule working twice and asks for a third instance;
 * a sequence shows one rule *iterating*, so the reader has to notice that the
 * step from the first to the second term is the same step as from the second to
 * the third before there is anything to extend.
 */
function buildSequence(question: Question, order: string[], source: Structure): boolean {
    /*
     * Tripling three times reaches eighty-one, which is arithmetic stamina
     * rather than induction. Doubling is kept; the rest are the maps whose
     * repeated application stays in a readable range.
     */
    const usable = mapPool().filter(m => !(m.kind === "scale" && m.factor === 3));
    const step = usable[Math.floor(Math.random() * usable.length)];

    const terms = [source];
    for (let i = 0; i < 3; i++) terms.push(applyMap(terms[terms.length - 1], step));
    const answer = terms[3];

    /*
     * Every term has to identify the step, not just the first.
     *
     * A reader works from whichever pair they look at, so if the second-to-third
     * transition is ambiguous the item has an answer the item does not support.
     * The same trap as the compose form's halfway structure, which is where it
     * was caught.
     */
    const pool = mapPool();
    if (terms.slice(0, 3).some(t => !distinguishing(t, pool))) return false;
    if (terms.some((t, i) => i > 0 && sameStructure(t, terms[i - 1]))) return false;

    const seen = new Set([signature(answer)]);
    const distinct: Structure[] = [];
    for (const candidate of [
        // Plausible misreadings first: the step not taken, taken twice, or
        // taken backwards. A random wrong position could be dismissed without
        // working out the rule at all.
        terms[2],
        applyMap(applyMap(terms[2], step), step),
        ...pool.map(m => applyMap(terms[2], m)),
    ]) {
        const k = signature(candidate);
        if (seen.has(k)) continue;
        seen.add(k);
        distinct.push(candidate);
    }
    if (distinct.length < 3) return false;

    const options = [answer, ...distinct.slice(0, 3)];
    shuffle(options);

    question.premises = [
        `First: ${describeStructure(terms[0], order)}`,
        `Second: ${describeStructure(terms[1], order)}`,
        `Third: ${describeStructure(terms[2], order)}`,
    ];
    draw(question, [
        { label: "First", structure: terms[0] },
        { label: "Second", structure: terms[1] },
        { label: "Third", structure: terms[2] },
    ], options);
    question.answerMode = "choice";
    question.choicePrompt = "What comes fourth?";
    question.choices = options.map(s => describeStructure(s, order));
    question.correctChoice = options.findIndex(s => signature(s) === signature(answer));
    question.conclusion = describeStructure(answer, order);
    question.isValid = true;
    question.explanation = [
        `First to second: ${hi(describeMap(step))}.`,
        `Second to third: the same again.`,
        ...order.map(n =>
            `${describeStructure({ [n]: terms[2][n] }, [n])} becomes`
            + ` ${describeStructure({ [n]: answer[n] }, [n])}`),
        `so the fourth is ${describeStructure(answer, order)}`,
    ];
    return true;
}

/* ---------------- shared derivation ---------------- */

/**
 * Point by point, because that is how the claim is checked.
 *
 * A map is only identified by every point agreeing, so a derivation that named
 * the map and stopped would be asserting the answer rather than showing it. The
 * false case ends on where the *claimed* map would have put things, which is
 * the difference the reader missed.
 */
function explainMap(
    order: string[],
    source: Structure,
    image: Structure,
    truth: GridMap,
    claimed: GridMap | null,
): string[] {
    const lines = order.map(n =>
        `${describeStructure({ [n]: source[n] }, [n])} became`
        + ` ${describeStructure({ [n]: image[n] }, [n])}`);

    lines.push(`Every point moves the same way: ${hi(describeMap(truth))}.`);

    if (claimed) {
        lines.push(`The claim was ${hi(describeMap(claimed))}, which would have given`
            + ` ${describeStructure(applyMap(source, claimed), order)}`);
    } else {
        lines.push(`so the change is ${hi(describeMap(truth))}`);
    }
    return lines;
}
