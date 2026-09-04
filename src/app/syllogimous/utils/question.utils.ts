import { getEmojis, getStrings, NOUNS, NUMBER_WORDS } from "../constants/question.constants";
import { EnumArrangements, EnumQuestionType } from "../constants/question.constants";
import { IArrangementPremise, IArrangementRelationship, Question } from "../models/question.models";
import { Settings, Picked } from "../models/settings.models";
import { getVisualNoiseSymbols } from "./visual-noise.utils";
import { getPharmaSymbols } from "./pharma.utils";
import { getJunkEmojiSymbols } from "./junk-emoji.utils";
import { neg, subj } from "./phrasing";

export const b2n = (b: boolean) => +b as number;

export function genBinKey(booleans: boolean[]) {
    return booleans.map(value => (value ? '1' : '0')).join('');
}

export function coinFlip() {
    return Math.random() > 0.5;
}

export function pickUniqueItems<T>(array: T[], n: number): Picked<T> {
    const copy = [...array];
    const picked = [];
    while (n > 0) {
        const rnd = Math.floor(Math.random() * copy.length);
        picked.push(copy.splice(rnd, 1)[0]);
        n--;
    }
    return { picked, remaining: copy };
}

export function shuffle<T>(array: T[]) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

export function extractSubjects(phrase: string) {
    return [...phrase.matchAll(/<span class="subject">(.*?)<\/span>/g)].map(a => a[1]);
}

export function isPremiseLikeConclusion(premises: string[], conclusion: string) {
    const subjectsOfPremises = premises.map(p => extractSubjects(p));
    const subjectsOfConclusion = extractSubjects(conclusion);
    for (const subjects of subjectsOfPremises) {
        const toCompare = subjectsOfConclusion[0] + subjectsOfConclusion[1];
        if (subjects[0] + subjects[1] === toCompare || subjects[1] + subjects[0] === toCompare)
            return true;
    }
    return false;
}

/** Random sample without shuffling the whole source, which can be thousands long. */
function sampleN<T>(source: T[], n: number): T[] {
    if (source.length <= n) return [...source];
    const seen = new Set<number>();
    const out: T[] = [];
    while (out.length < n) {
        const i = Math.floor(Math.random() * source.length);
        if (seen.has(i)) continue;
        seen.add(i);
        out.push(source[i]);
    }
    return out;
}

/**
 * The stimulus pool for one question.
 *
 * Each enabled kind contributes, so selecting several mixes them within a single
 * item rather than one kind winning outright. Contributions are balanced: the
 * noun list is orders of magnitude larger than the noise pool, so an unweighted
 * union would make the other kinds vanishingly rare.
 *
 * Re-sampled per question, so restricting each kind's share costs variety across
 * a session rather than within it.
 */
export function getSymbols(settings: Settings) {
    const text = () => settings.enabled.meaningfulWords ? NOUNS : getStrings();

    /*
     * Each kind contributes in proportion to its weight.
     *
     * Enabled kinds used to take an equal share, so "words with the occasional
     * emoji" was not expressible: turning emoji on made half the stimuli emoji.
     * A weight of zero is the same as switching the kind off, which keeps the
     * checkbox and the slider from disagreeing.
     */
    const weights = settings.enabled.stimulusMix ?? {};
    const kinds: Array<{ pool: string[]; weight: number }> = [];
    const add = (on: boolean, key: string, pool: () => string[]) => {
        const weight = weights[key] ?? 1;
        if (on && weight > 0) kinds.push({ pool: pool(), weight });
    };

    /*
     * Letter triples as a kind, not as words-with-the-meaning-removed.
     *
     * `meaningfulWords` off already produced these, but as a *replacement* for
     * the text pool -- so "some words, some nonsense" could not be asked for at
     * all, and the only route to letters was a switch that reads like a
     * downgrade. As its own kind it takes a share of the mix like every other.
     */
    add(settings.enabled.randomLetters, "randomLetters", getStrings);
    add(settings.enabled.pharmaStimuli, "pharmaStimuli", getPharmaSymbols);
    add(settings.enabled.visualNoise, "visualNoise", getVisualNoiseSymbols);
    add(settings.enabled.junkEmojis, "junkEmojis", getJunkEmojiSymbols);
    add(settings.enabled.useEmojis, "useEmojis", getEmojis);
    add(settings.enabled.useText, "useText", text);

    // Deselecting everything would leave nothing to build a question from.
    if (!kinds.length) return [...text()];
    if (kinds.length === 1) return [...kinds[0].pool];

    const total = kinds.reduce((a, k) => a + k.weight, 0);
    const budget = Math.min(...kinds.map(k => k.pool.length), 240) * kinds.length;
    return kinds.flatMap(k => sampleN(k.pool,
        Math.max(1, Math.min(k.pool.length, Math.round((k.weight / total) * budget)))));
}

/**
 * Distinct stimuli, and never a hang.
 *
 * The rejection loop had no exit: asking for more stimuli than the pool holds
 * left it drawing indices forever with every one of them already seen, which
 * freezes the tab rather than throwing. Nothing asks for that many today, but
 * the pool size depends on which kinds are switched on and their weights in the
 * mix, so "today" is a property of the settings rather than of the code.
 *
 * Capped at what the pool can supply, and the tail is filled by repeating from
 * the front — a duplicate stimulus makes an item odd, which is a thing you can
 * see and report. A frozen page is not.
 */
export function getRandomSymbols(settings: Settings, length: number) {
    const symbols = getSymbols(settings);
    if (!symbols.length) return Array(length).fill("?");

    const wanted = Math.min(length, symbols.length);
    const seen = new Set<number>();
    const out: string[] = [];

    while (out.length < wanted) {
        let rnd = Math.floor(Math.random() * symbols.length);
        // Bounded: walk on from a taken index rather than redrawing forever.
        while (seen.has(rnd)) rnd = (rnd + 1) % symbols.length;
        seen.add(rnd);
        out.push(symbols[rnd]);
    }

    while (out.length < length) out.push(out[out.length % wanted]);
    return out;
}

export function getMetaReplacer(settings: Settings, choosenPair: Picked<string>, relations: string[], negations: boolean[]) {
    const choosenSubjects = [...choosenPair.picked[0].matchAll(/<span class="subject">(.*?)<\/span>/g)];
    const [a, b] = choosenSubjects.map(m => m[1]);

    const isSameAs = (relations[0] === relations[1]) === (negations[0] === negations[1]);
    const relation = getRelation(settings, EnumQuestionType.Distinction, isSameAs);

    return `$1 ${relation} (${subj(a)} to ${subj(b)}) to `;
}

export function getRelation(settings: Settings, type: EnumQuestionType, isPositive: boolean) {
    let positive = "";
    let negative = "";

    switch (type) {
        case EnumQuestionType.Distinction:
            positive = "same as";
            negative = "opposite of";
            break;
        case EnumQuestionType.ComparisonNumerical:
            positive = "more than";
            negative = "less than";
            break;
        case EnumQuestionType.ComparisonChronological:
            positive = "after";
            negative = "before";
            break;
    }

    let relation = isPositive ? positive : negative;
    if (settings.enabled.negation && coinFlip()) {
        switch (relation) {
            case positive:
                relation = neg(negative);
                break;
            case negative:
                relation = neg(positive);
                break;
        }
    }
    return relation;
}

/**
 * `enabled` overrides the global flag, so one mode can carry meta while the
 * rest do not.
 *
 * `settings.enabled.meta` is one switch for twenty modes — it was the only way
 * to ask for meta relations, so asking for them anywhere asked for them
 * everywhere. Callers now resolve per-mode first and pass the answer in;
 * omitting it keeps the old behaviour, which is what the modes with no per-mode
 * control still want.
 */
export function createMetaRelationships(settings: Settings, question: Question, length: number, enabled?: boolean) {
    // Substitute a variable number of premises with meta-relations
    if ((enabled ?? settings.enabled.meta) && coinFlip()) {
        const numOfMetaRelationships = 1 + Math.floor(Math.random() * Math.floor((length - 1) / 2));
        question.metaRelations += numOfMetaRelationships;

        let subjects: { value: number, subject: string }[] = [];
        if (question.type === EnumQuestionType.Distinction) {
            // `subject: b`, not `b[0]`: a bucket entry is the word itself. It
            // used to be a one-element array, so the old index took the word
            // out of it; against a plain string it takes the first letter, and
            // the lookup below then finds nothing.
            subjects = question.buckets.reduce((a, c, i) => [...a, ...c.map(b => ({ value: i, subject: b }))], [] as typeof subjects);
        } else {
            subjects = question.bucket.map((c, i, a) => ({ value: (a.length - i), subject: c }), []);
        }

        /*
         * Only premises stating exactly one relation can be consumed.
         *
         * A meta premise is *about* one relation, so it can only restate one:
         * it names the two objects of the premise it replaces, plus a pair from
         * a premise that survives. A wide premise states two relations over
         * three objects — "A is under B, which is under C" — and
         * `extractSubjects` returns the first two of them, so replacing it
         * dropped C from the premise set entirely. The conclusion is chosen
         * before this runs, against the full layout, so roughly one item in
         * twelve with both rungs on asked about an object no premise mentioned:
         * not hard, unanswerable, and graded as though it were fine.
         *
         * Skipping them is the honest fix rather than restating only half.
         * With every premise merged there is nothing meta can take, and it
         * takes nothing — which is correct: an item cannot carry a relation
         * about a relation it has stopped stating.
         */
        const eligible = question.premises.filter(p => extractSubjects(p).length === 2);
        const { picked: pickedPremises } = pickUniqueItems(eligible, Math.min(numOfMetaRelationships, eligible.length));
        const consumed = new Set(pickedPremises);
        const remainingPremises = question.premises.filter(p => !consumed.has(p));
        const pickedPremisesSubjects = pickedPremises.map(extractSubjects);
        const remainingPremisesSubjects = remainingPremises.map(extractSubjects);
        const bidirectionalRelationshipMap = remainingPremisesSubjects.reduce((acc, [a, b]) => (acc[a] = acc[a] || [], acc[a].push(b), acc[b] = acc[b] || [], acc[b].push(a), acc), {} as { [key: string]: string[] });
        const newPremises = [];
        for (const premiseSubjects of pickedPremisesSubjects) {
            const [a, b] = premiseSubjects.map(ps => subjects.find(s => ps === s.subject)!);
            const { picked } = pickUniqueItems(Object.entries(bidirectionalRelationshipMap), 1);
            let _c = "";
            let _d = "";
            if (picked[0][1].length > 1) { // Indirect relation
                _c = picked[0][1][0];
                _d = picked[0][1][1];
            } else {
                _c = picked[0][0]; // Direct relation
                _d = picked[0][1][0];
            }
            const c = subjects.find(s => s.subject === _c)!;
            const d = subjects.find(s => s.subject === _d)!;

            let isSame = false;
            if (question.type === EnumQuestionType.Distinction) {
                isSame = (a.value === b.value) === (c.value === d.value);
            } else {
                isSame = (a.value < b.value) === (c.value < d.value);
            }

            if (isSame) { // Same
                if (settings.enabled.negation && coinFlip()) {
                    newPremises.push(`${subj(a.subject)} relates to ${subj(b.subject)} in the <span class="is-negated">opposite</span> way that ${subj(c.subject)} relates to ${subj(d.subject)}`);
                } else {
                    newPremises.push(`${subj(a.subject)} relates to ${subj(b.subject)} in the same way that ${subj(c.subject)} relates to ${subj(d.subject)}`);
                }
            } else { // Different
                if (settings.enabled.negation && coinFlip()) {
                    newPremises.push(`${subj(a.subject)} relates to ${subj(b.subject)} in the <span class="is-negated">same</span> way that ${subj(c.subject)} relates to ${subj(d.subject)}`);
                } else {
                    newPremises.push(`${subj(a.subject)} relates to ${subj(b.subject)} in the opposite way that ${subj(c.subject)} relates to ${subj(d.subject)}`);
                }
            }
        }

        newPremises.push(...remainingPremises);
        question.premises = newPremises;
    }
}

/** This methods modifies some premises with meta-relationships */
export function metarelateArrangement(premises: IArrangementPremise[]) {
    premises.forEach(premise => {
        premise.metaRelationships = premises
            .filter(p => p.uid !== premise.uid)
            .filter(p => p.relationship.description === premise.relationship.description && p.relationship.steps === premise.relationship.steps);
    });
}

export function horizontalShuffleArrangement(premises: IArrangementPremise[]) {
    const switchSubjects = (premise: IArrangementPremise) =>
        [premise.a, premise.b] = [premise.b, premise.a];

    premises.forEach(premise => {
        if (premise.relationship && coinFlip()) {
            switch (premise.relationship.description) {
                case EnumArrangements.AdjacentLeft: {
                    premise.relationship.description = EnumArrangements.AdjacentRight;
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.AdjacentRight: {
                    premise.relationship.description = EnumArrangements.AdjacentLeft;
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.NStepsLeft: {
                    premise.relationship.description = EnumArrangements.NStepsRight;
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.NStepsRight: {
                    premise.relationship.description = EnumArrangements.NStepsLeft;
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.Next: {
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.InFront: {
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.Left: {
                    premise.relationship.description = EnumArrangements.Right;
                    switchSubjects(premise);
                    break;
                }
                case EnumArrangements.Right: {
                    premise.relationship.description = EnumArrangements.Left;
                    switchSubjects(premise);
                    break;
                }
            }
        }
    });
}

export function getLinearWays(
    i: number,
    j: number,
    _: number,
    forConclusion = false,
    precise = false
) {
    const isAdjLeft = i + 1 === j;
    const isAdjRight = i - 1 === j;
    const isNext = isAdjLeft || isAdjRight;
    const isLeft = i < j;
    const isRight = i > j;
    const steps = Math.abs(i - j);

    const ways: Record<string, { possible: boolean, steps: number }> = {
        [EnumArrangements.AdjacentLeft]: {
            possible: isAdjLeft,
            steps
        },
        [EnumArrangements.AdjacentRight]: {
            possible: isAdjRight,
            steps
        },
        [EnumArrangements.NStepsLeft]: {
            possible: isLeft,
            steps
        },
        [EnumArrangements.NStepsRight]: {
            possible: isRight,
            steps
        },
    };

    if (forConclusion) {
        ways[EnumArrangements.Next] = {
            possible: isNext,
            steps
        };
        if (!precise) {
            ways[EnumArrangements.Left] = {
                possible: isLeft,
                steps: -Infinity
            };
            ways[EnumArrangements.Right] = {
                possible: isRight,
                steps: -Infinity
            };
        }
    }

    return ways;
};

export function getCircularWays(
    i: number,
    j: number,
    numOfEls: number,
    forConclusion = false,
    precise = false
) {
    const getAdjLeft = (i: number) => (numOfEls + (i + 1)) % numOfEls;
    const getAdjRight = (i: number) => (numOfEls + (i - 1)) % numOfEls;
    const getInFront = (i: number) => (i + (numOfEls / 2)) % numOfEls;
    const getCWDist = (i: number, j: number) => (j - i + numOfEls) % numOfEls;
    const getCCWDist = (i: number, j: number) => numOfEls - getCWDist(i, j);

    // Set i to 0 and calc j relative to that
    j = (numOfEls + (j - i)) % numOfEls;
    i = 0;

    const isAdjLeft = getAdjLeft(i) === j;
    const isAdjRight = getAdjRight(i) === j;
    const isNext = isAdjLeft || isAdjRight;
    const isLeft = j < getInFront(i);
    const isRight = j > getInFront(i);
    const steps = Math.min(getCWDist(i, j), getCCWDist(i, j));

    const ways: Record<string, { possible: boolean, steps: number }> = {
        [EnumArrangements.AdjacentLeft]: {
            possible: isAdjLeft,
            steps
        },
        [EnumArrangements.AdjacentRight]: {
            possible: isAdjRight,
            steps
        },
        [EnumArrangements.NStepsLeft]: {
            possible: isLeft || steps === (numOfEls / 2),
            steps
        },
        [EnumArrangements.NStepsRight]: {
            possible: isRight || steps === (numOfEls / 2),
            steps
        },
    };

    // Even num of els do have diametrically opposite els
    if (numOfEls % 2 === 0) {
        ways[EnumArrangements.InFront] = {
            possible: getInFront(i) === j,
            steps
        };
    }

    if (forConclusion) {
        ways[EnumArrangements.Next] = {
            possible: isNext,
            steps
        };
        if (!precise) {
            ways[EnumArrangements.Left] = {
                possible: isLeft,
                steps: -Infinity
            };
            ways[EnumArrangements.Right] = {
                possible: isRight,
                steps: -Infinity
            };
        }
    }

    return ways;
};

/**
 * `onNegate` is called once for each negation this applies.
 *
 * The count is what the export reports and what an analysis of negation would
 * read, and this was the one place that negated a premise without telling
 * anybody: Linear and Circular Arrangement items came out with negated
 * relations and a negation count of zero. Every other generator increments its
 * own, which is why nothing noticed.
 */
export function interpolateArrangementRelationship(
    relationship: IArrangementRelationship,
    settings: Settings,
    onNegate?: () => void,
) {
    const numWord = NUMBER_WORDS[relationship.steps];

    const interpolatedWithSteps = relationship.description.replace(/# steps/, () =>
        relationship.steps === 1
            ? " adjacent and"
            : ((numWord || relationship.steps) + " steps")
    );

    if (settings.enabled.negation && coinFlip()) {
        return interpolatedWithSteps.replaceAll(/(left|right)/gi, substr => {
            onNegate?.();
            return neg((substr === "left") ? "right" : "left");
        });
    }

    return interpolatedWithSteps;
}

export function fixBinaryInstructions(q: Question) {
    const htmlify = (rule: string) => rule.split(", ").map(str => subj(str)).join(", ");
    switch (q.type) {
        case EnumQuestionType.LinearArrangement: {
            return htmlify(q.rule) + " are arranged in a <b>linear</b> way.";
        }
        case EnumQuestionType.CircularArrangement: {
            return htmlify(q.rule) + " are arranged in a <b>circular</b> way.";
        }
        default: {
            return "";
        }
    }
}

function buildGraph(edgeList: [string, "↔" | "→" | "←", string][]) {
    const graph = {} as Record<string, { out: Set<string>, in: Set<string> }>;
    edgeList.forEach(edge => {
        const [u, symbol, v] = edge;
        if (!graph[u]) graph[u] = { out: new Set(), in: new Set() };
        if (!graph[v]) graph[v] = { out: new Set(), in: new Set() };
        if (symbol === "→") {
            graph[u].out.add(v);
            graph[v].in.add(u);
        } else if (symbol === "←") {
            graph[v].out.add(u);
            graph[u].in.add(v);
        } else if (symbol === "↔") {
            // Bidirectional: add edges in both directions
            graph[u].out.add(v);
            graph[u].in.add(v);
            graph[v].out.add(u);
            graph[v].in.add(u);
        }
    });
    return graph;
}

/** Checks if two directed graphs (given as edge lists) are isomorphic */
export function areGraphsIsomorphic(edgeList1: [string, "↔" | "→" | "←", string][], edgeList2: [string, "↔" | "→" | "←", string][]) {
    const graph1 = buildGraph(edgeList1);
    const graph2 = buildGraph(edgeList2);
    const vertices1 = Object.keys(graph1);
    const vertices2 = Object.keys(graph2);

    // Quick check: graphs must have the same number of vertices
    if (vertices1.length !== vertices2.length) return false;

    // Quick check: compare sorted degree pairs [in-degree, out-degree]
    const degrees1 = vertices1
        .map(v => `${graph1[v].in.size},${graph1[v].out.size}`)
        .sort()
        .join(',');
    const degrees2 = vertices2
        .map(v => `${graph2[v].in.size},${graph2[v].out.size}`)
        .sort()
        .join(',');
    if (degrees1 !== degrees2) return false;

    const mapping = {} as Record<string, string>; // Mapping from graph1 vertices to graph2 vertices
    const used = new Set(); // Set of graph2 vertices that have been mapped

    // Checks the current partial mapping for consistency
    function isValidMapping() {
        for (const u of vertices1) {
            if (mapping[u]) {
                for (const v of graph1[u].out) {
                    if (mapping[v]) {
                        // Check that the mapped edge exists in graph2
                        if (!graph2[mapping[u]].out.has(mapping[v])) {
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    // Recursively tries to assign each vertex in graph1 to a vertex in graph2
    function backtrack(index: number) {
        if (index === vertices1.length) {
            // All vertices have been successfully mapped
            return true;
        }
        const u = vertices1[index];
        for (const v of vertices2) {
            if (!used.has(v)) {
                // Check if in-degree and out-degree match
                if (graph1[u].in.size === graph2[v].in.size &&
                    graph1[u].out.size === graph2[v].out.size) {
                    mapping[u] = v;
                    used.add(v);
                    if (isValidMapping() && backtrack(index + 1)) {
                        return true;
                    }
                    // Backtrack
                    delete mapping[u];
                    used.delete(v);
                }
            }
        }
        return false;
    }

    return backtrack(0);
}
