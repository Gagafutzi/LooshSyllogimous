/**
 * What the app says about you, and what it does about it.
 *
 * Two properties carry this file. The first is that a finding means something:
 * thresholds exist so that a feed which speaks has something to say, and a
 * horoscope drawn from four answers is the failure mode. The second is that the
 * page and the draw cannot disagree — the feed reports findings and the curator
 * consumes the same ones, so a session leaning somewhere the card never
 * mentioned would be a bug in the shape this design exists to prevent.
 */

import { assert, equal, test } from "./harness";
import { Finding, findings, sessionWeights } from "../src/app/syllogimous/utils/insight.utils";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);

const played = (type: string, at: number, n = 1) =>
    Array.from({ length: n }, () => ({
        type, answered: true, answeredAt: at, createdAt: at - 10000,
        isValid: true, userAnswer: true,
    }));

const base = {
    history: [] as any[],
    standings: [] as any[],
    estimateTrail: {} as Record<string, number[]>,
    fatigue: null as number | null,
    fatigueThreshold: 0.15,
    now: NOW,
};

const kinds = (found: Finding[]) => found.map(f => f.kind);

test("nothing is said about a player nothing is known about", () => {
    equal(findings({ ...base }).length, 0, "a finding was produced from no data");
});

test("a mode well below your own average is named", () => {
    const found = findings({
        ...base,
        history: played("Space6D", NOW - DAY),
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 9, trials: 40 },
            { type: "Space6D", level: 5, trials: 40 },
        ],
    });

    const weak = found.find(f => f.kind === "weak-mode");
    assert(!!weak, "the mode four levels below the average went unmentioned");
    equal(weak!.type, "Space6D", "the wrong mode was named as the weak one");
});

test("a mode barely below average is not worth saying", () => {
    /*
     * The threshold is the whole feature. A feed that names your weakest mode
     * unconditionally always has something to say and therefore says nothing —
     * there is always a weakest.
     */
    const found = findings({
        ...base,
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 8.8, trials: 40 },
            { type: "Space6D", level: 8.5, trials: 40 },
        ],
    });

    equal(found.filter(f => f.kind === "weak-mode").length, 0,
        "half a level of difference was reported as a weakness");
});

test("an estimate resting on a handful of answers is not a standing", () => {
    const found = findings({
        ...base,
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 9, trials: 40 },
            { type: "Space6D", level: 2, trials: 3 },
        ],
    });

    equal(found.filter(f => f.kind === "weak-mode").length, 0,
        "three answers were taken as evidence of a weakness");
});

test("a mode gone cold is named, and one played this week is not", () => {
    const found = findings({
        ...base,
        history: [...played("Deictic", NOW - 20 * DAY), ...played("Distinction", NOW - DAY)],
        standings: [
            { type: "Deictic", level: 8, trials: 40 },
            { type: "Distinction", level: 8, trials: 40 },
        ],
    });

    const stale = found.filter(f => f.kind === "stale-mode");
    equal(stale.length, 1, `stale came out as [${stale.map(f => f.type).join(", ")}]`);
    equal(stale[0].type, "Deictic", "the wrong mode was called cold");
    assert(/20 days/.test(stale[0].text), `the gap is not stated: ${stale[0].text}`);
});

test("an estimate that has moved up is reported, even with nothing visible", () => {
    /*
     * Finding 3 in progression/diagnosis.md: most of a level can be earned with
     * no change to the item, because an item is a whole premise and a whole
     * rung. A number that went up is the cheapest honest answer to "am I
     * getting anywhere".
     */
    const found = findings({
        ...base,
        estimateTrail: { Distinction: [5, 5, 5, 5, 5, 6, 6, 6, 6, 6] },
        standings: [{ type: "Distinction", level: 6, trials: 40 }],
    });

    const up = found.find(f => f.kind === "improving-mode");
    assert(!!up, "a full level of gain went unmentioned");
    equal(up!.type, "Distinction", "the wrong mode was called improving");
    equal(up!.nudge, undefined, "good news changed what comes up next");
});

test("a flat estimate is not progress", () => {
    const found = findings({
        ...base,
        estimateTrail: { Distinction: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] },
        standings: [{ type: "Distinction", level: 5, trials: 40 }],
    });

    equal(found.filter(f => f.kind === "improving-mode").length, 0,
        "a flat trail was reported as improvement");
});

test("tiredness leads, because its advice is to stop", () => {
    const found = findings({
        ...base,
        fatigue: -0.25,
        history: played("Space6D", NOW - DAY),
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 9, trials: 40 },
            { type: "Space6D", level: 5, trials: 40 },
        ],
    });

    equal(kinds(found)[0], "fatigue",
        "advice to stop arrived under three lines about what to practise");
    equal(found.find(f => f.kind === "fatigue")!.nudge, undefined,
        "being tired changed what comes up next");
});

test("a residual inside the threshold is not tiredness", () => {
    equal(findings({ ...base, fatigue: -0.05 }).length, 0,
        "an ordinary run of luck was reported as fatigue");
});

/* ------------------------------------------------------------------ *
 * The other face                                                      *
 * ------------------------------------------------------------------ */

test("what the feed says is what the draw does", () => {
    const found = findings({
        ...base,
        history: [...played("Deictic", NOW - 20 * DAY), ...played("Space6D", NOW - DAY)],
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 9, trials: 40 },
            { type: "Space6D", level: 5, trials: 40 },
            { type: "Deictic", level: 8, trials: 40 },
        ],
    });

    const weights = sessionWeights(found);

    // Every mode weighted up is one the feed named, and the other way round.
    const named = new Set(found.filter(f => f.nudge).map(f => f.type));
    equal(Object.keys(weights).sort().join(","), [...named].sort().join(","),
        "the draw leans towards a mode the card never mentioned");

    assert(weights["Space6D"] > 1, "the weak mode is not drawn more often");
    assert(weights["Deictic"] > 1, "the cold mode is not drawn more often");
    equal(weights["Distinction"], undefined, "a mode with no finding was reweighted");
});

test("a lean, not a takeover", () => {
    const found = findings({
        ...base,
        history: [...played("Deictic", NOW - 20 * DAY), ...played("Space6D", NOW - DAY)],
        standings: [
            { type: "Distinction", level: 9, trials: 40 },
            { type: "Syllogism", level: 9, trials: 40 },
            { type: "Space6D", level: 5, trials: 40 },
            { type: "Deictic", level: 8, trials: 40 },
        ],
    });

    const weights = sessionWeights(found);
    for (const [type, w] of Object.entries(weights)) {
        assert(w <= 2, `${type} is weighted ${w}, which is a takeover rather than a lean`);
    }

    /*
     * Serving only the worst modes would stop the rest being measured, and an
     * unmeasured mode goes stale — which is half of what these findings are
     * about. So a mode that is both weak *and* cold is still only doubled: two
     * findings about one mode are one reason to see it, not two.
     */
    const both = sessionWeights([
        { kind: "weak-mode", type: "Space6D", text: "", nudge: 2 },
        { kind: "stale-mode", type: "Space6D", text: "", nudge: 2 },
    ]);
    equal(both["Space6D"], 2, "two findings about one mode compounded");
});

test("a dimension is reported and not acted on", () => {
    /*
     * No mode *is* the time axis; several carry it. Weighting all of them up
     * would be a guess wearing the appearance of a plan, so this finding tells
     * you something and leaves the acting to you.
     */
    const constructed = Array.from({ length: 8 }, () => ({
        type: "Space4D", answered: true, answeredAt: NOW - DAY, createdAt: NOW - DAY - 10000,
        isValid: true, userAnswer: true,
        answerMode: "construct",
        construct: [{ a: "A", b: "B", slots: [{
            label: "Time", directions: ["later", "earlier", "same"],
            answerDirection: 0, answerMagnitude: 2, asksDistance: true,
        }] }],
        userConstruct: [[{ direction: 1, magnitude: 2 }]],
    }));

    const found = findings({ ...base, history: constructed });
    const dim = found.find(f => f.kind === "weak-dimension");
    assert(!!dim, "eight wrong answers on one dimension went unmentioned");
    assert(/Time/.test(dim!.text), `the dimension is not named: ${dim!.text}`);
    equal(dim!.nudge, undefined, "a dimension finding changed what comes up next");
    equal(sessionWeights(found)["Space4D"], undefined,
        "a dimension finding reweighted the mode it happened to appear in");
});
