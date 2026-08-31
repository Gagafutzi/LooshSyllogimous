/**
 * Mutual Moves — every object moves against another object, not against the frame.
 *
 * Axis Maps asks what happened to the *space*: one linear map, applied to every
 * object independently, read off worked examples. That is a rule about
 * directions, and the objects are interchangeable carriers of it. This mode asks
 * the other question — what did the objects do to *each other* — and it is a
 * different kind of rule, so it is a different mode rather than a rung.
 *
 * **The rule names a role, never an object.** "Each one mirrors over the next"
 * transfers to a group whose objects it has never seen; "Ring mirrors over Vase"
 * is a fact about two particular things and there is nothing to carry. That
 * distinction is what keeps the induce-then-apply shape intact: an example
 * group is shown before and after, and a second group is given only its before.
 *
 * **Order is content here, and that is the point.** A linear map's steps commute
 * in effect — Axis Maps deliberately describes the finished map rather than the
 * steps that built it, because two swaps of one pair leave the axes where they
 * started and replaying them would claim changes the item does not contain.
 * Nothing commutes once objects move against each other: doing them all at once
 * from where everything started, and doing them one after another so that each
 * sees the moves already made, give different answers from the same operation.
 * So "in what order" becomes a real question with evidence behind it, which is
 * the thing a map cannot ask.
 *
 * **Which object each one moves against is fixed at the start.** Under `nearest`
 * and `farthest` the reference would otherwise be a moving target — an object
 * becomes the nearest halfway through the sweep — and the rule would stop being
 * statable in a sentence. Resolved once, against the opening positions, and the
 * card says so.
 *
 * **Solvability is guaranteed by search, not by argument.** The vocabulary is
 * small and enumerable, so every rule it can express is applied to the example
 * and exactly one is required to survive. An inductive item that admits two
 * rules is the fault that makes number-series tests bad measures, and it is not
 * something to be reasoned about when it can be checked.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { EnumQuestionType } from "../constants/question.constants";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, shuffle } from "../utils/question.utils";
import { hi, rel, subj, dimClass, dimSlot } from "../utils/phrasing";
import { ANCHORS } from "../utils/anchor.utils";
import { axesForDimensions } from "../utils/ndspace.utils";
import { LinearScale } from "../utils/linear.utils";

/** What an object does with respect to the object it moves against. */
export type MoveOp = "step" | "mirror" | "join" | "follow";
/** How that object is chosen — a role, so the rule can transfer. */
export type MoveRole = "next" | "previous" | "nearest" | "farthest";
/** Whether the moves are read from the opening state or from the running one. */
export type MoveOrder = "at-once" | "in-turn";

export interface MoveRule {
    op: MoveOp;
    role: MoveRole;
    order: MoveOrder;
}

const OPS: Record<MoveOp, string> = {
    step: "moves one step towards it on every axis they differ on",
    mirror: "ends up as far past it as it began short of it",
    join: "moves onto it",
    follow: "moves by however far it stands from the marker",
};

const ROLES: Record<MoveRole, string> = {
    next: "the next one listed, the last going back to the first",
    previous: "the one listed before it, the first going back to the last",
    nearest: "whichever began nearest the marker",
    farthest: "whichever began farthest from the marker",
};

const ORDERS: Record<MoveOrder, string> = {
    "at-once": "all at once, every move read from where things began",
    "in-turn": "one after another down the list, each seeing the moves already made",
};

const sum = (c: number[]) => c.reduce((t, v) => t + Math.abs(v), 0);
const same = (a: number[], b: number[]) => a.every((v, i) => v === b[i]);

/**
 * Which object each one moves against, resolved once against the opening state.
 *
 * Returns null when a role cannot be pinned — two objects tied for nearest, or
 * an object that would have to move against itself. Both make the rule
 * ambiguous rather than hard, so the item is rebuilt instead.
 */
export function referencesFor(coords: number[][], role: MoveRole): number[] | null {
    const n = coords.length;

    if (role === "next") return coords.map((_, i) => (i + 1) % n);
    if (role === "previous") return coords.map((_, i) => (i + n - 1) % n);

    const distances = coords.map(sum);
    const want = role === "nearest"
        ? Math.min(...distances)
        : Math.max(...distances);
    if (distances.filter(d => d === want).length !== 1) return null;   // a tie

    // Everything moves against it, and it against nothing: it has no reference
    // of its own, and -1 is what says so.
    const pick = distances.indexOf(want);
    return coords.map((_, i) => (i === pick ? -1 : pick));
}

/** One object's move, given where it is and where its reference is. */
function moved(x: number[], r: number[], op: MoveOp): number[] {
    if (op === "step") return x.map((v, i) => v + Math.sign(r[i] - v));
    if (op === "join") return [...r];
    if (op === "follow") return x.map((v, i) => v + r[i]);
    return x.map((v, i) => 2 * r[i] - v);            // mirror
}

/**
 * The rule applied to a whole group.
 *
 * `at-once` reads every reference from the opening state; `in-turn` walks the
 * list and lets each object see what the ones before it did. That difference is
 * the whole reason order is worth asking about, and it is four lines.
 *
 * An object whose reference is itself (the one everything else moves against,
 * under `nearest` and `farthest`) stays where it is — it has nothing to move
 * against, and the card says as much.
 */
export function applyRule(coords: number[][], rule: MoveRule): number[][] | null {
    const refs = referencesFor(coords, rule.role);
    if (!refs) return null;

    const before = coords.map(c => [...c]);
    const out = coords.map(c => [...c]);

    for (let i = 0; i < coords.length; i++) {
        if (refs[i] < 0) continue;                    // stands still
        const source = rule.order === "at-once" ? before : out;
        out[i] = moved(before[i], source[refs[i]], rule.op);
    }
    return out;
}

/* ------------------------------------------------------------------ *
 * The vocabulary, and what it costs to widen it                       *
 * ------------------------------------------------------------------ */

/**
 * What the rule may be, which is exactly what the reader has to search.
 *
 * Both orders are in from the start, because the order is the mode's own idea
 * and a base without it would be a worse Axis Maps. Everything else opens as it
 * is earned: the base is one operation over one role, so the opening item asks
 * *only* "all at once, or one after another" — two hypotheses, and the whole
 * novel demand, with nothing else to hold at the same time.
 */
function vocabulary(ctx: GeneratorContext, type: EnumQuestionType) {
    const has = (r: string) => ctx.hasRung(type, r);

    /*
     * `step` is the base because it is the only operation with no calculation
     * in it: one step nearer on each axis they differ on is read off the sign,
     * and it cannot run away — mirroring doubles, and doubling under `in-turn`
     * compounds down the list. Mirror is worth having and is not worth opening
     * with.
     */
    const ops: MoveOp[] = ["step"];
    if (has("op-join")) ops.push("join");
    if (has("op-mirror")) ops.push("mirror");
    if (has("op-follow")) ops.push("follow");

    /*
     * `previous` is the base because of how it meets the sweep.
     *
     * References pointing *forward* while the sweep runs forward means only the
     * object that wraps round ever reads something already moved — the order,
     * which is the mode's whole reason to exist, would be settled by one line
     * and irrelevant to the rest. Pointing back down the list, every object but
     * the first reads a reference that has just moved. Same code; the default
     * is the difference between an incidental question and the item.
     */
    const roles: MoveRole[] = ["previous"];
    if (has("role-next")) roles.push("next");
    if (has("role-extremes")) roles.push("nearest", "farthest");

    let dims = 2;
    for (const d of [3, 4]) if (has(`axes-${d}`)) dims = d;

    const orders: MoveOrder[] = ["at-once", "in-turn"];

    const rules: MoveRule[] = [];
    for (const op of ops) for (const role of roles) for (const order of orders) {
        rules.push({ op, role, order });
    }
    return { rules, dims };
}

/** Rules that produce exactly this before-and-after. */
function fitting(rules: MoveRule[], before: number[][], after: number[][]): MoveRule[] {
    return rules.filter(rule => {
        const got = applyRule(before, rule);
        return !!got && got.every((c, i) => same(c, after[i]));
    });
}

/** How far apart two rules are, so a distractor can be a near miss. */
const distance = (a: MoveRule, b: MoveRule) =>
    (a.op === b.op ? 0 : 1) + (a.role === b.role ? 0 : 1) + (a.order === b.order ? 0 : 1);

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

function clauses(coord: number[], axes: LinearScale[]): string {
    const parts: string[] = [];
    for (let i = 0; i < coord.length; i++) {
        if (!coord[i]) continue;
        const word = coord[i] > 0 ? axes[i].direction[0] : axes[i].direction[1];
        parts.push(rel(`${Math.abs(coord[i])} ${word}`, dimClass(dimSlot(i))));
    }
    return parts.join(", ");
}

const line = (name: string, coord: number[], axes: LinearScale[]) =>
    `${subj(name)}: ${clauses(coord, axes) || hi("on the marker")}`;

const row = (names: string[], coords: number[][], axes: LinearScale[]) =>
    names.map((n, i) => line(n, coords[i], axes)).join(` ${hi("·")} `);

/* ------------------------------------------------------------------ *
 * The item                                                            *
 * ------------------------------------------------------------------ */

/**
 * Positions a reader can still see rather than compute.
 *
 * A mirror doubles its reference's displacement, and under `in-turn` those
 * doublings compound down the list: the first draft produced an object 28 steps
 * east, which is not a position anybody pictures — it is a number, and a number
 * is what this mode is least interested in. The bound is on the *result*, so a
 * rule that would run away is rebuilt rather than clamped, since clamping would
 * quietly make the shown after-state something no rule actually produces.
 */
const REACH = 6;

const pictureable = (coords: number[][]) =>
    coords.every(c => c.every(v => Math.abs(v) <= REACH));

/*
 * One step per axis, which is what keeps a mirror picturable.
 *
 * A mirror lands at `2r - x`, so opening positions two steps out reach six, and
 * under `in-turn` a mirror over an already-mirrored object compounds past that.
 * Bounding the result alone was not enough: it rejected almost every mirror,
 * which is the *base* operation, so the mode quietly became a `join` mode and
 * its opening rung could barely build. Small sources and a loose bound keep
 * both — the reach is where the interest is, so it is the input that gives way.
 */
const spread = (dims: number) =>
    Array.from({ length: dims }, () => Math.floor(Math.random() * 3) - 1);

export function createMutualMoves(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createMutualMoves");

    const type = EnumQuestionType.MutualMoves;
    if (!canGenerateQuestion(type, numOfPremises, ctx.settings)) {
        throw new Error("Cannot generate.");
    }
    numOfPremises = clampPremises(type, numOfPremises);

    for (let attempt = 0; attempt < 400; attempt++) {
        const built = build(ctx, type, numOfPremises);
        if (built) return built;
    }
    throw new Error("Cannot generate.");
}

function build(
    ctx: GeneratorContext,
    type: EnumQuestionType,
    numOfPremises: number,
): Question | null {
    const { rules, dims } = vocabulary(ctx, type);
    const axes = axesForDimensions(dims).slice(0, dims);
    const n = Math.max(3, Math.min(6, numOfPremises));

    const names = getRandomSymbols(ctx.settings, n * 2);
    if (names.length < n * 2) return null;
    const shownNames = names.slice(0, n);
    const askedNames = names.slice(n, n * 2);

    const truth = rules[Math.floor(Math.random() * rules.length)];

    /*
     * A group whose after-state only this rule could have produced.
     *
     * Rules coincide more often than they look like they would — `join` and
     * `mirror` agree wherever an object already stands on its reference, and
     * the two orders agree whenever nothing a later object reads has moved. So
     * the configuration is drawn and then tested, rather than reasoned about.
     */
    const shown = Array.from({ length: n }, () => spread(dims));
    const shownAfter = applyRule(shown, truth);
    if (!shownAfter) return null;
    if (fitting(rules, shown, shownAfter).length !== 1) return null;

    // An example that changes nothing teaches nothing.
    if (shownAfter.every((c, i) => same(c, shown[i]))) return null;

    /*
     * And one that collapses teaches nothing either. `join` run `in-turn` lands
     * every object on one that has already landed, so the whole group piles onto
     * a single point — recognisable at a glance, and true of that pairing
     * whatever the positions were.
     */
    if (shownAfter.every(c => same(c, shownAfter[0]))) return null;

    if (!pictureable(shownAfter)) return null;

    const asked = Array.from({ length: n }, () => spread(dims));
    const askedAfter = applyRule(asked, truth);
    if (!askedAfter || !pictureable(askedAfter)) return null;

    /*
     * The wrong option is the same rule with one part of it altered, and where
     * possible that part is the *order*: it is the mode's own question, and an
     * option reached by mistaking the order is the error worth offering. A rule
     * that differs in several places at once is dismissed on the first object.
     */
    const rivals = rules
        .filter(r => distance(r, truth) > 0)
        .map(r => ({ rule: r, out: applyRule(asked, r) }))
        // The wrong option is on the card too, so it is held to the same reach:
        // an option nobody could reach is also an option nobody has to read.
        .filter(r => !!r.out && pictureable(r.out)
            && !r.out.every((c, i) => same(c, askedAfter[i])))
        .sort((a, b) => {
            const orderOnly = (r: MoveRule) =>
                r.op === truth.op && r.role === truth.role ? 0 : 1;
            return orderOnly(a.rule) - orderOnly(b.rule)
                || distance(a.rule, truth) - distance(b.rule, truth);
        });
    if (!rivals.length) return null;
    const rival = rivals[0];

    const question = new Question(type);
    question.bucket = [...shownNames, ...askedNames];
    const marker = ANCHORS[0].token;

    question.setup = [
        `${marker} never moves — everything else is placed against it.`,
        `Every object moves with respect to <b>one other object</b>, by the same`
        + ` rule. Which object that is, is settled by how things stand at the`
        + ` start.`,
    ];

    /*
     * Both halves of an example on one line, rather than a before block and an
     * after block.
     *
     * Two blocks read as two lists to be matched up by name before anything can
     * be compared, and an object the rule happens to leave where it is prints
     * the *same line twice* — which is a repeated premise, and looked like a
     * bug on the card long before a test called it one.
     */
    question.premises = [
        `${marker} ${hi("— worked example")}`,
        ...shownNames.map((name, i) =>
            `${line(name, shown[i], axes)} ${hi("→")} `
            + `${clauses(shownAfter[i], axes) || hi("on the marker")}`),
        `${hi("Now the same rule, on")} ${marker}`,
        ...askedNames.map((name, i) => line(name, asked[i], axes)),
    ];

    const right = row(askedNames, askedAfter, axes);
    const wrong = row(askedNames, rival.out!, axes);
    if (right === wrong) return null;

    question.isValid = true;

    const flip = Math.random() < 0.5;
    question.answerMode = "choice";
    question.choices = flip ? [right, wrong] : [wrong, right];
    question.correctChoice = flip ? 0 : 1;

    const refs = referencesFor(asked, truth.role)!;
    question.explanation = [
        `The rule is: each one ${hi(OPS[truth.op])}, against ${hi(ROLES[truth.role])}.`,
        `They move ${hi(ORDERS[truth.order])}.`,
        ...askedNames.map((name, i) => refs[i] < 0
            ? `${subj(name)} is what the others move against, so it stays where it is.`
            : `${subj(name)} moves against ${subj(askedNames[refs[i]])}: `
              + `${clauses(asked[i], axes) || "on the marker"} `
              + `${hi("→")} ${clauses(askedAfter[i], axes) || "on the marker"}.`),
    ];

    return question;
}
