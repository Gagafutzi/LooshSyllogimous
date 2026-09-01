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

/* ------------------------------------------------------------------ *
 * A break ends the slump                                              *
 * ------------------------------------------------------------------ */

/** A window as it sits in storage, written `minutesAgo` minutes ago. */
function storedWindow(values: number[], minutesAgo: number) {
    localStorage.clear();
    localStorage.setItem("syllogimous-residuals", JSON.stringify({
        at: Date.now() - minutesAgo * 60_000,
        values,
    }));
}

const SLUMP = Array(12).fill(-0.5);

/**
 * The bug this fixes: a session could *begin* flagged tired.
 *
 * The window is one global list that outlives a session, and it carried no
 * time at all — so the last few answers of a bad evening were still the reading
 * the next morning, and the posterior pause landed on fresh, rested answers. A
 * mechanism built to stop a bad hour setting tomorrow lower was stopping a good
 * morning from counting.
 */
test("a slump does not survive a break", () => {
    storedWindow(SLUMP, 45);
    const p = new ProgressionService();
    assert(p.fatigue === null, "yesterday's slump was still the reading today");
    assert(!p.tired, "a rested session started out paused");
});

/** But a pause for coffee is not a break, or the signal would never hold. */
test("a slump survives the gap between two answers of one sitting", () => {
    storedWindow(SLUMP, 5);
    const p = new ProgressionService();
    assert(p.tired, "a five-minute gap cleared a slump that was still real");
});

/**
 * The old format was a bare array with no timestamp, which cannot be told from
 * a window written last week. An unknown gap is treated as a long one.
 */
test("a window from before the format carried a time is not trusted", () => {
    localStorage.clear();
    localStorage.setItem("syllogimous-residuals", JSON.stringify(SLUMP));
    const p = new ProgressionService();
    assert(p.fatigue === null, "an undateable window was carried over as current");
});

/** And the reading comes back as soon as there is enough of it again. */
test("a fresh slump after a break registers normally", () => {
    storedWindow(SLUMP, 45);
    const p = new ProgressionService();
    answer(p, 12, false);
    assert(p.tired, "a slump built after a break was not detected");
});

/* ------------------------------------------------------------------ *
 * What a timeout is worth                                             *
 * ------------------------------------------------------------------ */

/**
 * Run something on its own store and report where the level ended up.
 *
 * Two services cannot be held side by side: `fresh()` clears storage and every
 * instance reads and writes the same keys, so interleaving them has each one
 * reading the other's ability state. The first draft of the test below did
 * exactly that, compared two numbers that were the same number, and passed —
 * which is worse than failing.
 */
function levelAfter(run: (p: ProgressionService) => void): number {
    const p = fresh();
    run(p);
    return p.estimateFor(TYPE).level;
}

/**
 * A timeout is one event, however many conclusions the item asked.
 *
 * The per-claim path grades each conclusion separately, which is right for an
 * answered item and wrong for an unanswered one: nothing was established about
 * any individual claim, and debiting five of them would make the deadline five
 * times as expensive on a five-conclusion item as on a one. The generator can
 * raise the conclusion count at any time, so this is worth holding down rather
 * than remembering.
 */
test("a timeout is one piece of evidence, not one per conclusion", () => {
    const one = levelAfter(p => p.record(TYPE, "timeout", 10,
        { claims: [{ correct: false, slots: 1 }] } as any));
    const five = levelAfter(p => p.record(TYPE, "timeout", 10, {
        claims: [1, 2, 3, 4, 5].map(() => ({ correct: false, slots: 1 })),
    } as any));

    assert(Math.abs(one - five) < 1e-9,
        `a five-conclusion timeout left the level at ${five.toFixed(3)} against`
        + ` ${one.toFixed(3)} for a one-conclusion timeout`);
});

/**
 * And it moves the level less than a wrong answer does.
 *
 * Running out of time is not the same event as being wrong — the item may have
 * been on its way to a right answer, and the only thing established is that it
 * needed longer than it got. The model's remedy for "less able" is a shorter
 * item, which is no help to somebody who ran out of time.
 */
test("a timeout costs less level than a wrong answer", () => {
    // Two, not a run: six of either drives the estimate into the floor of the
    // grid, where both land on the same number and the comparison says nothing.
    const start = levelAfter(() => {});
    const afterTimeouts = levelAfter(p => {
        for (let i = 0; i < 2; i++) p.record(TYPE, "timeout", 10);
    });
    const afterWrong = levelAfter(p => {
        for (let i = 0; i < 2; i++) p.record(TYPE, "wrong", 10);
    });

    const byTimeout = start - afterTimeouts;
    const byWrong = start - afterWrong;

    assert(byTimeout > 0, "a timeout said nothing at all about ability");
    assert(byTimeout < byWrong * 0.75,
        `a timeout cost ${byTimeout.toFixed(2)} levels against a wrong answer's`
        + ` ${byWrong.toFixed(2)} — it is meant to say markedly less`);
});
