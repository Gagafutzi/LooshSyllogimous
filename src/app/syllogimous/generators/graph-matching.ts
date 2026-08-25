/**
 * Graph matching — isomorphism between two edge lists.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getSymbols, pickUniqueItems, shuffle, areGraphsIsomorphic } from "../utils/question.utils";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { hi, neg, subj } from "../utils/phrasing";
import { LINEAR_SCALES, LinearScale } from "../utils/linear.utils";
import {
    GraphEdge, MAX_DISTANCE_NODES, editDistance, oddGraphOut, orderConsistent,
} from "../utils/graphdist.utils";

export function createGraphMatching(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createGraphMatching");

    const type = EnumQuestionType.GraphMatching;
    const settings = ctx.settings;

    /*
     * Two questions the same two graphs can be asked, once there is a way to
     * measure how far apart they are rather than only whether they match.
     *
     * Drawn among the live forms rather than replacing the base one: "do these
     * match?" stays the common case, and a rung adds a way of being asked
     * rather than taking one away.
     */
    const forms: Array<"which" | "distance" | "relations"> = [];
    if (ctx.hasRung(type, "which-differs")) forms.push("which");
    if (ctx.hasRung(type, "distance")) forms.push("distance");
    if (ctx.hasRung(type, "as-relations")) forms.push("relations");

    if (forms.length && Math.random() < forms.length / (forms.length + 1)) {
        const form = forms[Math.floor(Math.random() * forms.length)];
        const built = form === "which" ? buildWhichDiffers(ctx, numOfPremises)
            : form === "relations" ? buildAsRelations(ctx, numOfPremises)
            : buildDistance(ctx, numOfPremises);
        if (built) return built;
        // Falling through rather than failing: a draw can simply not produce a
        // well-formed set, and the base form is always available.
    }

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

    // The mode\'s own ceiling, not the caller\'s idea of it.
    numOfPremises = clampPremises(type, numOfPremises);

    const numOfEls = numOfPremises + 1;
    const symbols = getSymbols(settings);
    const words = pickUniqueItems(symbols, numOfEls).picked;
    const question = new Question(type);

    let edgeList: [string, "↔" | "→" | "←", string][] = [];
    const inverseMap = { "→": "←", "←": "→" } as Record<"→" | "←", | "→" | "←">;
    const _words = [...words];
    const isWordUsed = (w: string) => edgeList.reduce((a, c) => (a.add(c[0]), a.add(c[2]), a), new Set() as Set<string>).has(w);
    const notAllUsed = () => _words.some(w => !isWordUsed(w));
    const edgeAlreadyExists = (a: string, b: string) => edgeList.some(([_a, _, _b]) => (_a === a && _b === b) || (_a === b && _b === a));
    let safe = 1e3;
    while (safe-- && notAllUsed()) {
        const [a, b] = pickUniqueItems(_words, 2).picked;
        if (edgeAlreadyExists(a, b)) {
            continue;
        }
        const newEdge = (Math.random() < 0.25)
            ? [a, "↔", b]
            : coinFlip()
                ? [a, "→", b]
                : [a, "←", b];
        edgeList.push(newEdge as [string, "↔" | "→" | "←", string]);
        if (_words.length > 2 && coinFlip()) {
            const subject = coinFlip() ? a : b;
            const foundIdx = _words.indexOf(subject);
            _words.splice(foundIdx, 1);
        }
    }
    if (safe <= 0) {
        throw new Error("MAXIMUM NUMBER OF ITERATIONS REACHED!");
    }

    const edgeDiscrepancyCount = edgeList.length !== numOfPremises;
    const all3ElementsAre2Way = numOfEls === 3 && edgeList.every(([a, rel, b]) => rel === "↔");
    if (edgeDiscrepancyCount || all3ElementsAre2Way) {
        return createGraphMatching(ctx, numOfPremises);
    }

    const newWords = pickUniqueItems(symbols, numOfEls).picked;
    let edgeList2: typeof edgeList = edgeList.map(([a, rel, b]) => ([
        newWords[words.indexOf(a)],
        rel,
        newWords[words.indexOf(b)]
    ]));

    question.isValid = coinFlip();
    if (!question.isValid) {
        ctx.logger.info("Modifying graph in an invalid way");

        while (areGraphsIsomorphic(edgeList, edgeList2)) {
            const { picked } = pickUniqueItems(edgeList2, 1);
            const [a, rel, b] = picked[0];

            if (rel === "→" || rel === "←") {
                if (Math.random() < 0.15) {
                    ctx.logger.info("Swap 1-way for 2-way");
                    picked[0][1] = "↔";
                } else if (coinFlip()) {
                    ctx.logger.info("Rotate 1-way direction");
                    picked[0][1] = inverseMap[picked[0][1] as "→" | "←"] as "→" | "←";
                }
            } else if (Math.random() < 0.15) {
                ctx.logger.info("Swap 2-way for 1-way");
                picked[0][1] = { "true": "→", "false": "←" }[String(coinFlip())] as "→" | "←";
            }

            if (coinFlip() && numOfEls > 3) {
                const rndBool = coinFlip();
                const bool2subject: Record<string, number> = { "true": 0, "false": 2 };
                const subjectPosIdx = bool2subject[String(rndBool)];
                const subjectNegIdx = bool2subject[String(!rndBool)];
                const { picked: picked2 } = pickUniqueItems(edgeList2, 1);
                let picked;
                while (!picked || picked === picked2[0][subjectPosIdx] || picked === picked2[0][subjectNegIdx]) {
                    picked = pickUniqueItems(newWords, 1).picked[0];
                }
                ctx.logger.info("Change an edge by connecting a/b to a different subject", [picked2[0][subjectPosIdx], picked]);
                picked2[0][subjectPosIdx] = picked;
            }
        }
    }

    const horizontalShuffle = (_edgeList: typeof edgeList) =>
        _edgeList.map(([a, rel, b]) => {
            ctx.logger.info("Before", [a, rel, b]);
            let result;
            if (coinFlip() && (rel === "→" || rel === "←")) {
                result = [b, inverseMap[rel], a];
            } else {
                result = [a, rel, b];
            }
            ctx.logger.info("After", result);
            return result;
        }) as typeof edgeList;

    shuffle(edgeList);
    edgeList = horizontalShuffle(edgeList);
    question.graphPremises = edgeList;
    ctx.logger.info("EdgeList", edgeList);

    shuffle(edgeList2);
    edgeList2 = horizontalShuffle(edgeList2);
    question.graphConclusion = edgeList2;
    ctx.logger.info("EdgeList2", edgeList2);

    const usedEdges = new Set<string>();
    const readable = (edges: typeof edgeList, edge: typeof edgeList[0], negated = false, meta = false) => {
        const getSubject = (subject: string) => subj(subject);
        const readMap = {
            "→": "goes to",
            "←": "comes from",
            "↔": "is connected to"
        };
        let relationship = readMap[edge[1]];
        let isMetaRelated = false;
        if (meta) {
            const getEdgeKey = (edge: typeof edgeList[0]) => [...edge].join(";");
            const edgeKey = getEdgeKey(edge);
            const pickedEdge = pickUniqueItems(edges, 1).picked[0];
            const pickedEdgeKey = getEdgeKey(pickedEdge);
            if (
                !usedEdges.has(pickedEdgeKey) &&
                edgeKey !== pickedEdgeKey &&
                edge[1] === pickedEdge[1]
            ) {
                usedEdges.add(edgeKey);
                usedEdges.add(pickedEdgeKey);
                if (coinFlip() && edge[1] !== "↔") {
                    relationship = `the inverse of ${getSubject(pickedEdge[2])} to ${getSubject(pickedEdge[0])}`;
                } else {
                    relationship = `${getSubject(pickedEdge[0])} is to ${getSubject(pickedEdge[2])}`;
                }
                isMetaRelated = true;
                ctx.logger.info("Metarelated");
                question.metaRelations++;
            }
        } else if (negated && (edge[1] === "→" || edge[1] === "←")) {
            ctx.logger.info("Negated");
            question.negations++;
            relationship = neg(readMap[inverseMap[edge[1]]]);
        }
        return isMetaRelated
            ? `${getSubject(edge[0])} is to ${getSubject(edge[2])} as ${relationship}`
            : `${getSubject(edge[0])} ${relationship} ${getSubject(edge[2])}`;
    };

    question.premises = edgeList.map((edge, _, edges) =>
        readable(
            edges,
            edge,
            settings.enabled.negation && coinFlip(),
            settings.enabled.meta && coinFlip()
        )
    );
    question.conclusion = edgeList2.map((edge, _, edges) =>
        readable(
            edges,
            edge,
            settings.enabled.negation && coinFlip(),
            settings.enabled.meta && coinFlip()
        ));

    question.instructions = [
        "Check isomorphism between premise and conclusion graphs."
    ];

    question.explanation = explainGraph(words, newWords, edgeList, edgeList2, question.isValid);

    return question;
}


/** Direction-aware identity for a link, so "A -> B" and "B <- A" are one edge. */
function edgeKey([a, rel, b]: [string, string, string]): string {
    if (rel === "↔") return [a, b].sort().join(" ↔ ");
    return rel === "→" ? `${a} → ${b}` : `${b} → ${a}`;
}

/**
 * Where the two shapes agree, and where they part company.
 *
 * The mode's whole content is a pairing between two sets of names, so the
 * derivation states the pairing first — that is the step a reader who got it
 * wrong usually never made explicit, having compared the drawings by eye.
 *
 * When the graphs differ, the *natural* pairing is the one shown, and it is
 * enough to exhibit one link it fails on. That is weaker than the claim being
 * made, so the closing line says what was actually established: no pairing
 * works, which `areGraphsIsomorphic` decided.
 */
function explainGraph(
    words: string[],
    newWords: string[],
    edgeList: Array<[string, string, string]>,
    edgeList2: Array<[string, string, string]>,
    isValid: boolean,
): string[] {
    const pairing = words.map((w, i) => `${subj(w)}&hairsp;/&hairsp;${subj(newWords[i])}`).join(", ");
    const lines = [`Pairing them in the order they appear: ${pairing}.`];

    const mapped = new Set(edgeList.map(([a, rel, b]) =>
        edgeKey([newWords[words.indexOf(a)], rel, newWords[words.indexOf(b)]])));
    const present = new Set(edgeList2.map(edgeKey));

    if (isValid) {
        lines.push(`Every link in the first has a counterpart in the second under that pairing.`);
        lines.push(`so the two shapes are the same.`);
        return lines;
    }

    const missing = [...mapped].find(k => !present.has(k));
    const extra = [...present].find(k => !mapped.has(k));
    if (missing) lines.push(`Under that pairing the second is missing ${hi(missing)}.`);
    if (extra) lines.push(`It has ${hi(extra)} instead, which the first does not.`);

    lines.push(`so the two shapes differ — and no other pairing repairs it.`);
    return lines;
}


/* ------------------------------------------------------------------ *
 * P4: more than two graphs, and how far apart two are                 *
 * ------------------------------------------------------------------ */

const ARROW = { "→": "goes to", "←": "comes from", "↔": "is connected to" } as const;

/** One graph as sentences. No negation or meta here — the form is the load. */
function statements(edges: GraphEdge[]): string[] {
    return edges.map(([a, rel, b]) => `${subj(a)} ${ARROW[rel]} ${subj(b)}`);
}

/** A connected graph over `names`, with a chord or two so it has some shape. */
function drawGraph(names: string[]): GraphEdge[] {
    const rel = () => (["→", "←", "↔"] as const)[Math.floor(Math.random() * 3)];
    const edges: GraphEdge[] = [];

    for (let i = 0; i < names.length - 1; i++) edges.push([names[i], rel(), names[i + 1]]);

    // One extra link, which is what stops every item being a path and makes
    // the isomorphism question worth asking.
    const [i, j] = [0, names.length - 1];
    edges.push([names[i], rel(), names[j]]);
    return edges;
}

/** The same graph under fresh names, restated in another order. */
function relabel(edges: GraphEdge[], from: string[], to: string[]): GraphEdge[] {
    const map = new Map(from.map((n, i) => [n, to[i]]));
    const out: GraphEdge[] = edges.map(([a, rel, b]) => {
        // Written back to front half the time, so a matching pair cannot be
        // spotted by the shape of the text.
        if (rel !== "↔" && coinFlip()) {
            return [map.get(b)!, rel === "→" ? "←" : "→", map.get(a)!];
        }
        return [map.get(a)!, rel, map.get(b)!];
    });
    shuffle(out);
    return out;
}

/** Change one relation, chosen at random. */
function perturb(edges: GraphEdge[]): GraphEdge[] {
    const out: GraphEdge[] = edges.map(e => [...e] as GraphEdge);
    const at = Math.floor(Math.random() * out.length);
    const others = (["→", "←", "↔"] as const).filter(r => r !== out[at][1]);
    out[at][1] = others[Math.floor(Math.random() * others.length)];
    return out;
}

/**
 * Several graphs, one of which is not isomorphic to the rest.
 *
 * Which one differs is checked with `oddGraphOut` rather than assumed from
 * which one was perturbed: a change can land somewhere the relabelling makes
 * equivalent, and then the intended odd one out matches after all and the item
 * has no answer — or two of them differ and it has several.
 */
function buildWhichDiffers(ctx: GeneratorContext, numOfPremises: number): Question | null {
    const settings = ctx.settings;
    const nodes = Math.max(4, Math.min(6, numOfPremises));
    const groups = 3 + (numOfPremises > 5 ? 1 : 0);

    for (let attempt = 0; attempt < 200; attempt++) {
        const symbols = getSymbols(settings);
        const picked = pickUniqueItems(symbols, nodes * groups).picked;
        if (picked.length < nodes * groups) return null;

        const names = [...Array(groups).keys()].map(i => picked.slice(i * nodes, (i + 1) * nodes));
        const base = drawGraph(names[0]);
        const odd = Math.floor(Math.random() * groups);

        const graphs = names.map((set, i) => {
            const copy = relabel(base, names[0], set);
            return i === odd ? perturb(copy) : copy;
        });

        if (oddGraphOut(graphs) !== odd) continue;

        const question = new Question(EnumQuestionType.GraphMatching);
        question.bucket = picked;
        question.premises = graphs.flatMap((edges, i) => [
            `${hi(`Group ${i + 1}`)}:`,
            ...statements(edges),
        ]);
        question.answerMode = "choice";
        question.choicePrompt = "Which group is not the same shape as the others?";
        question.choices = graphs.map((_, i) => `Group ${i + 1}`);
        question.correctChoice = odd;
        question.conclusion = `Group ${odd + 1}`;
        question.isValid = true;
        question.setup = [
            "Every group describes the same set of links between different things."
            + " All but one have the <b>same shape</b> — the names do not matter, only"
            + " which links exist and which way they run.",
        ];
        question.explanation = [
            `Every other group can be matched onto ${hi(`Group ${(odd + 1) % groups + 1}`)}`
            + ` name for name.`,
            `${hi(`Group ${odd + 1}`)} cannot: no matching of its names onto another`
            + ` group's leaves every link agreeing.`,
            `so the odd one out is ${hi(`Group ${odd + 1}`)}`,
        ];
        return question;
    }

    return null;
}

/**
 * How many relations would have to change for two graphs to match.
 *
 * The answer is searched for, never taken from the number of changes made.
 * Edits can partially cancel, and a bijection other than the one used to build
 * the pair can line the graphs up more cheaply — so an item that trusted its
 * own edit count would mark correct answers wrong.
 *
 * That is not an edge case. Measured over 2,000 pairs at five nodes, the true
 * distance is *below* the number of edits applied in 37% of one-edit pairs,
 * 75% of two-edit pairs and 98% of three-edit pairs. Trusting the count would
 * be wrong more often than right.
 */
function buildDistance(ctx: GeneratorContext, numOfPremises: number): Question | null {
    const settings = ctx.settings;
    const nodes = Math.max(4, Math.min(MAX_DISTANCE_NODES - 2, numOfPremises));

    for (let attempt = 0; attempt < 200; attempt++) {
        const symbols = getSymbols(settings);
        const picked = pickUniqueItems(symbols, nodes * 2).picked;
        if (picked.length < nodes * 2) return null;

        const first = picked.slice(0, nodes);
        const second = picked.slice(nodes);

        const base = drawGraph(first);
        let other = relabel(base, first, second);
        const edits = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < edits; k++) other = perturb(other);

        const truth = editDistance(base, other);
        if (truth === null || truth < 1 || truth > 4) continue;

        // Options around the answer, so the wrong ones are the numbers a
        // reader would plausibly arrive at rather than obvious outliers.
        const pool = [0, 1, 2, 3, 4, 5].filter(n => n !== truth);
        shuffle(pool);
        const options = [truth, ...pool.slice(0, 3)].sort((a, b) => a - b);

        const question = new Question(EnumQuestionType.GraphMatching);
        question.bucket = picked;
        question.premises = [
            `${hi("First")}:`, ...statements(base),
            `${hi("Second")}:`, ...statements(other),
        ];
        question.answerMode = "choice";
        question.choicePrompt = "Fewest links that would have to change to make these the same shape?";
        question.choices = options.map(n => `${n}`);
        question.correctChoice = options.indexOf(truth);
        question.conclusion = `${truth}`;
        question.isValid = true;
        question.setup = [
            "Names do not matter — only which links exist and which way they run."
            + " Changing a link means adding it, removing it, or altering its"
            + " direction; each counts as <b>one</b>.",
        ];
        question.explanation = [
            `Matched name for name as closely as possible, ${hi(String(truth))}`
            + ` link${truth === 1 ? " still disagrees" : "s still disagree"}.`,
            `No other matching of the names does better \u2014 every one was tried.`,
            `so the answer is ${hi(String(truth))}`,
        ];
        return question;
    }

    return null;
}

/**
 * The same two structures, stated as relations rather than as arrows.
 *
 * "Pure composition of parts already built", as the roadmap had it, and it
 * turned out to be — but the reason to want it is not that it is cheap. With
 * both graphs drawn as arrows, the two premise sets are written in the same
 * words, so they can be lined up by eye: match the text, match the structure.
 * Give one graph a spatial vocabulary and the other a temporal one and that
 * route closes. Nothing can be compared until both have been abstracted away
 * from what they say into what shape they are, which is the operation the mode
 * exists to train and the one its own presentation was letting people skip.
 *
 * The mapping is exact and the same in both directions: a one-way link is a
 * comparison, a two-way one is a statement of sameness. So the structures match
 * exactly when the graphs are isomorphic, decided by the same search the other
 * two forms use.
 */
function buildAsRelations(ctx: GeneratorContext, numOfPremises: number): Question | null {
    const settings = ctx.settings;
    const nodes = Math.max(4, Math.min(6, numOfPremises));

    const pair = pickScalePair();
    if (!pair) return null;
    const [first, second] = pair;

    for (let attempt = 0; attempt < 200; attempt++) {
        const symbols = getSymbols(settings);
        const picked = pickUniqueItems(symbols, nodes * 2).picked;
        if (picked.length < nodes * 2) return null;

        const left = picked.slice(0, nodes);
        const right = picked.slice(nodes);

        const base = drawGraph(left);
        /*
         * Both sets have to be readable as arrangements, not merely as graphs.
         *
         * This is the one form that words a link as a *comparison* — contains,
         * is on top of, is the same size as — and there a cycle is not a shape
         * but a contradiction: nothing is larger than the thing it is inside.
         * The other forms say "goes to" and "comes from", where a loop is an
         * ordinary graph and nothing is wrong with it, which is why the
         * constraint lives here and not in `drawGraph`.
         *
         * Left unchecked it shipped impossible items and marked them right:
         * *Fondue is within Cushion, Cushion is within Garland, Garland is the
         * same size as Lamb, Fondue contains Lamb*. Two sets that cannot be true
         * were isomorphic as digraphs, so "the two describe the same structure"
         * came out correct — true of the arrows and meaningless of the words.
         */
        if (!orderConsistent(base)) continue;

        let other = relabel(base, left, right);

        const same = coinFlip();
        if (!same) {
            // Perturbed until it genuinely differs: a change can land where the
            // relabelling makes it equivalent, and an item claiming "different"
            // about two matching structures is simply wrong.
            let guard = 0;
            do { other = perturb(other); } while (editDistance(base, other) === 0 && guard++ < 40);
            if (editDistance(base, other) === 0) continue;
            // A change can also turn a readable set into an impossible one.
            if (!orderConsistent(other)) continue;
        }

        const question = new Question(EnumQuestionType.GraphMatching);
        question.bucket = picked;
        question.premises = [
            `${hi(first.name)}:`, ...asRelations(base, first),
            `${hi(second.name)}:`, ...asRelations(other, second),
        ];
        question.conclusion = `The two sets describe the ${hi("same structure")}`;
        question.isValid = same;
        question.setup = [
            "Two sets of statements about different things, in different terms."
            + " The question is whether the <b>pattern of statements</b> is the"
            + " same &mdash; which links exist, and which way each one runs.",
            "Compare the statements as made, not what they add up to: a chain of"
            + " comparisons implies more than it states, and those implications"
            + " are not part of the pattern.",
        ];
        question.explanation = [
            `Read as shape, a one-way statement is a link with a direction and a`
            + ` sameness statement is a link with none.`,
            ...pairingLines(base, other, left, right, first, second, same),
            `so the two ${same ? "do" : "do not"} describe the same structure`,
        ];
        return question;
    }

    return null;
}

/** Two scales that share no words, so neither can be read as the other. */
function pickScalePair(): [LinearScale, LinearScale] | null {
    const usable = Object.values(LINEAR_SCALES)
        // A scale whose two directions read the same cannot state which way a
        // link runs, which is exactly what has to be compared.
        .filter(s => s.above !== s.below);

    const words = (s: LinearScale) => new Set([s.above, s.below, s.same]);
    const pairs: Array<[LinearScale, LinearScale]> = [];

    for (const a of usable) {
        for (const b of usable) {
            if (a === b) continue;
            const wa = words(a), wb = words(b);
            // Quantity and Height share their whole vocabulary; a reader could
            // not tell which set a statement belonged to except by position.
            if ([...wb].some(w => wa.has(w))) continue;
            pairs.push([a, b]);
        }
    }

    return pairs.length ? pairs[Math.floor(Math.random() * pairs.length)] : null;
}

/**
 * A graph's links as comparisons on one scale.
 *
 * Worded with `above`/`below`/`same` rather than the `direction` and `tie`
 * words. Those are bare adjectives for building clause lists — "higher",
 * "same amount" — and reading as a sentence needs the full phrase the scale
 * also carries: "is more than", "is at the same time as".
 */
/**
 * The correspondence itself, and then it working — or failing on one link.
 *
 * The explanation used to assert the answer in different words: *"every one of
 * the first set's links can be matched onto the second's, name for name"*.
 * True, and no help. The question is *which* name goes with which — that
 * pairing is the entire content of the mode, and it was the one thing the
 * derivation never said. Someone who could already see the correspondence did
 * not need the line, and someone who could not was told the conclusion twice.
 *
 * The pairing is known exactly rather than searched for: the second set is the
 * first relabelled position for position, so `left[i]` goes with `right[i]`.
 * On a false item that is still the closest pairing there is — `editDistance`
 * has already established no bijection does better — so naming the link that
 * disagrees under it names a real disagreement rather than an artefact of
 * having guessed the wrong pairing.
 *
 * Links are shown in both vocabularies, side by side, because reading one
 * relation as another is the operation being trained and the derivation should
 * demonstrate it rather than describe it.
 */
function pairingLines(
    base: GraphEdge[],
    other: GraphEdge[],
    left: string[],
    right: string[],
    firstScale: LinearScale,
    secondScale: LinearScale,
    same: boolean,
): string[] {
    const map = new Map(left.map((n, i) => [n, right[i]]));
    const pairs = left
        .map((n, i) => `${subj(n)}&hairsp;/&hairsp;${subj(right[i])}`)
        .join(", ");

    const present = new Set(other.map(edgeKey));
    const under = (e: GraphEdge): [string, string, string] =>
        [map.get(e[0])!, e[1], map.get(e[2])!];

    const say = (e: [string, string, string], scale: LinearScale) =>
        asRelations([e as GraphEdge], scale)[0];

    const lines = [`Pair them off: ${pairs}.`];

    if (same) {
        /*
         * Every link, not a sample. Four to six of them is a short list, and a
         * derivation that shows three and says "and so on" is asking to be
         * taken on trust about exactly the step in doubt.
         */
        for (const e of base) {
            lines.push(`${say(e, firstScale)} &rarr; ${say(under(e), secondScale)}`);
        }
        lines.push(`Every link has a counterpart running the same way.`);
        return lines;
    }

    const broken = base.find(e => !present.has(edgeKey(under(e))));
    if (broken) {
        lines.push(`${say(broken, firstScale)}, so the second set would need`
            + ` ${say(under(broken), secondScale)} &mdash; and it does not say that.`);
    } else {
        // The disagreement is an extra link rather than a missing one.
        const mapped = new Set(base.map(e => edgeKey(under(e))));
        const extra = other.find(e => !mapped.has(edgeKey(e)));
        if (extra) lines.push(`The second set has ${say(extra, secondScale)},`
            + ` which the first has no counterpart for.`);
    }
    lines.push(`No other pairing of the names does better &mdash; every one was tried.`);
    return lines;
}

function asRelations(edges: GraphEdge[], scale: LinearScale): string[] {
    return edges.map(([a, rel, b]) => {
        const phrase = rel === "→" ? scale.above : rel === "←" ? scale.below : scale.same;
        return `${subj(a)} ${hi(phrase)} ${subj(b)}`;
    });
}