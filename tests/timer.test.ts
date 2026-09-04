/**
 * The clock, and the two ways it took answers away from people.
 *
 * Reported from play: the timer kept running while the explanation overlay was
 * up, and answering in the last second could still be recorded as a timeout.
 * Both are the same cause — answering never stopped the timer — and the second
 * is the one that costs something, because it overwrites an answer the player
 * actually gave with one they did not.
 *
 * The service could not tell the two endings apart. `start` resolved when the
 * clock reached zero and simply never settled when stopped, so a caller waiting
 * on it read *any* resolution as a deadline expiring.
 */

import { assert, equal, flush, test } from "./harness";
import { GameTimerService } from "../src/app/syllogimous/services/game-timer.service";

/*
 * Only the one-second interval is faked. `flush` still uses a real timeout, so
 * promise callbacks get their turn — faking both would leave the test unable to
 * observe the very thing it is about.
 */
let ticker: (() => void) | null = null;

function fakeClock() {
    const realSet = globalThis.setInterval;
    ticker = null;
    (globalThis as { setInterval: unknown }).setInterval = ((f: () => void) => {
        ticker = f;
        return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setInterval;
    return () => { globalThis.setInterval = realSet; ticker = null; };
}

const tick = (times: number) => { for (let i = 0; i < times; i++) ticker?.(); };

test("a clock that runs out reports a timeout", async () => {
    const restore = fakeClock();
    try {
        const timer = new GameTimerService();
        let outcome: boolean | undefined;
        void timer.start(3).then(v => { outcome = v; });

        tick(2);
        await flush();
        equal(outcome, undefined, "settled before it had run out");

        tick(1);
        await flush();
        equal(outcome, true, "running out was not reported as a timeout");
        assert(!timer.running, "still running after reaching zero");
    } finally { restore(); }
});

test("a clock that is stopped does not report a timeout", async () => {
    /*
     * The bug that cost answers. Answering now stops the clock, so this is the
     * path every answered question takes — and it must not look like a
     * deadline expiring.
     */
    const restore = fakeClock();
    try {
        const timer = new GameTimerService();
        let outcome: boolean | undefined;
        void timer.start(10).then(v => { outcome = v; });

        tick(3);
        timer.stop();
        await flush();

        equal(outcome, false, "stopping the clock was reported as a timeout");
        assert(!timer.running, "kept running after being stopped");

        tick(20);
        await flush();
        equal(outcome, false, "a tick after stopping changed the outcome");
    } finally { restore(); }
});

test("a stopped clock settles rather than hanging", async () => {
    // It used to leave the promise pending for the life of the page — one per
    // question answered before its deadline, which is most of them.
    const restore = fakeClock();
    try {
        const timer = new GameTimerService();
        let settled = false;
        void timer.start(30).then(() => { settled = true; });

        timer.stop();
        await flush();
        assert(settled, "the promise never settled, so its waiter leaked");
    } finally { restore(); }
});

test("the clock can be restarted after either ending", async () => {
    const restore = fakeClock();
    try {
        const timer = new GameTimerService();

        void timer.start(2);
        tick(2);
        await flush();

        let afterElapsing: boolean | undefined;
        void timer.start(2).then(v => { afterElapsing = v; });
        tick(2);
        await flush();
        equal(afterElapsing, true, "could not be restarted after running out");

        void timer.start(5);
        timer.stop();
        await flush();

        let afterStopping: boolean | undefined;
        void timer.start(2).then(v => { afterStopping = v; });
        tick(2);
        await flush();
        equal(afterStopping, true, "could not be restarted after being stopped");
    } finally { restore(); }
});

/**
 * The bar is drawn against a deadline, not against the tick.
 *
 * Reported from play: *"the timer animation doesn't look fluid"*. It was bound
 * to `remainingSeconds`, which changes once a second — so on a short limit the
 * bar moved in eighth-of-the-width jumps. It is now animated from where it is
 * to empty over `remainingMs`, and these are the properties that has to have:
 * the number must be a real duration, it must fall continuously rather than in
 * steps, it must survive the seconds an answered conclusion buys, and it must
 * not outlive the clock.
 */
test("the clock exposes a real duration, not a tick count", async () => {
    const t = new GameTimerService();
    const stop = fakeClock();
    try {
        t.start(10).catch(() => {});
        const first = t.remainingMs;
        assert(first > 9000 && first <= 10000, `remainingMs was ${first} at the start`);

        /*
         * Real time passes here, and no tick fires — the interval is faked, so
         * `remainingSeconds` cannot have moved. This is the assertion the whole
         * change is about: the bar's number falls *between* ticks. Reading it
         * off the count instead leaves it flat for a whole second at a time,
         * and passes every other check in this file.
         */
        await new Promise(r => setTimeout(r, 60));
        const later = t.remainingMs;
        equal(t.remainingSeconds, 10, "the fake clock ticked; this test cannot tell the two apart");
        assert(first - later >= 40,
            `remainingMs moved ${first - later}ms over 60ms of real time — it is `
            + `being read off the once-a-second count, not off a deadline`);
        t.stop();
    } finally { stop(); }
});

test("a bought second lengthens the bar as well as the count", async () => {
    const t = new GameTimerService();
    const stop = fakeClock();
    try {
        t.start(10).catch(() => {});
        const before = t.remainingMs;
        t.extend(5);
        const after = t.remainingMs;
        equal(t.remainingSeconds, 15, "the count did not take the extension");
        assert(after - before > 4000 && after - before <= 5001,
            `the deadline moved ${after - before}ms for five bought seconds`);
        t.stop();
    } finally { stop(); }
});

test("a stopped clock has no time left to draw", async () => {
    const t = new GameTimerService();
    const stop = fakeClock();
    try {
        t.start(10).catch(() => {});
        t.stop();
        equal(t.remainingMs, 0, "a stopped clock still reported time remaining");
    } finally { stop(); }
});

test("a paused clock reports what it was paused with", async () => {
    const t = new GameTimerService();
    const stop = fakeClock();
    try {
        t.start(10).catch(() => {});
        t.pause();
        // Whole seconds, because pausing deliberately leaves the count as the
        // tick left it rather than snapping it to wall-clock time.
        equal(t.remainingMs, 10000, "a paused clock lost or invented time");
    } finally { stop(); }
});
