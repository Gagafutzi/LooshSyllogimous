/**
 * Fatigue detection: observed minus predicted, and what it suppresses.
 *
 * The service is `@Injectable` but its constructor takes nothing and only
 * touches storage, so it runs under node against the harness's localStorage
 * shim — no injector, no browser.
 */

import { assert, test } from "./harness";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const TYPE = EnumQuestionType.Distinction;

function fresh(overrides: Record<string, unknown> = {}) {
    localStorage.clear();
    const p = new ProgressionService();
    for (const [k, v] of Object.entries(overrides)) (p.config as any)[k] = v;
    return p;
}

/** Answer n items, all right or all wrong. */
function answer(p: ProgressionService, n: number, right: boolean) {
    for (let i = 0; i < n; i++) p.record(TYPE, right ? "right" : "wrong", 10);
}

test("fatigue says nothing until there is enough to say it with", () => {
    const p = fresh();
    assert(p.fatigue === null, "reported a fatigue signal from no answers");
    answer(p, 3, false);
    assert(p.fatigue === null, "three answers is a run of luck, not a slump");
    assert(!p.tired, "declared a slump on three answers");
});

test("a run of wrong answers drives the residual negative", () => {
    const p = fresh();
    answer(p, 12, false);
    const f = p.fatigue;
    assert(f !== null && f < 0, `expected a negative residual, got ${f}`);
    assert(p.tired, "twelve straight wrong answers did not register as a slump");
});

test("answering as expected is not a slump", () => {
    // Right answers can only push the residual up, so a player doing well is
    // never told they are tired.
    const p = fresh();
    answer(p, 12, true);
    const f = p.fatigue;
    assert(f !== null && f >= 0, `expected a non-negative residual, got ${f}`);
    assert(!p.tired, "a perfect run registered as a slump");
});

test("a detected slump stops the posterior moving", () => {
    /*
     * The point of the whole mechanism. Without this, a tired hour is recorded
     * as evidence of lower ability and sets the next session lower too.
     */
    const p = fresh();
    answer(p, 12, false);
    assert(p.tired, "precondition: expected a slump");

    const before = p.estimateFor(TYPE).level;
    answer(p, 5, false);
    const after = p.estimateFor(TYPE).level;
    assert(after === before, `ability moved during a slump: ${before} -> ${after}`);
});

test("with pausing off, the posterior keeps moving", () => {
    const p = fresh({ pauseWhenTired: false });
    answer(p, 12, false);
    const before = p.estimateFor(TYPE).level;
    answer(p, 5, false);
    assert(p.estimateFor(TYPE).level < before, "ability did not fall with pausing disabled");
});

test("a threshold of zero disables detection entirely", () => {
    const p = fresh({ fatigueThreshold: 0 });
    answer(p, 20, false);
    assert(!p.tired, "detection fired with the threshold at zero");
    assert(p.estimateFor(TYPE).level < 6, "ability did not move with detection disabled");
});

test("the window is bounded, and survives a reload", () => {
    const p = fresh({ fatigueWindow: 8 });
    answer(p, 40, false);
    const carried = new ProgressionService();
    carried.config.fatigueWindow = 8;
    assert(carried.fatigue !== null, "the residual window did not persist");
    assert(Math.abs((carried.fatigue ?? 0) - (p.fatigue ?? 0)) < 1e-9,
        "the reloaded window disagrees with the live one");
});

test("recovery ends a slump", () => {
    // The trials during a slump still enter the window — that is what lets it
    // end — even though they do not move the posterior.
    const p = fresh({ fatigueWindow: 10 });
    answer(p, 10, false);
    assert(p.tired, "precondition: expected a slump");
    answer(p, 10, true);
    assert(!p.tired, "a full window of right answers did not end the slump");
});
