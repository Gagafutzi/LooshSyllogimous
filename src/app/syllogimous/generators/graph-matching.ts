/**
 * Graph matching — isomorphism between two edge lists.
 *
 * Split out of GameService, which held all twenty generators in one file.
 * State comes in through {GeneratorContext} rather than `this`.
 */

import { GeneratorContext } from "./context";
import { Question } from "../models/question.models";
import { coinFlip, getSymbols, pickUniqueItems, shuffle, areGraphsIsomorphic } from "../utils/question.utils";
import { canGenerateQuestion } from "../models/settings.models";
import { EnumQuestionType } from "../constants/question.constants";
import { neg, subj } from "../utils/phrasing";

export function createGraphMatching(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createGraphMatching");

    const type = EnumQuestionType.GraphMatching;
    const settings = ctx.settings;

    if (!canGenerateQuestion(type, numOfPremises, settings)) {
        throw new Error("Cannot generate.");
    }

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

    return question;
}
