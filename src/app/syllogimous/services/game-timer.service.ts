import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class GameTimerService {

    interval?: any;
    remainingSeconds = 0;
    running = false;

    /**
     * When the clock is due to reach zero, as a timestamp.
     *
     * The countdown itself ticks once a second, which is the right resolution
     * for the number on screen and the wrong one for the bar beside it: a bar
     * driven off `remainingSeconds` moves in one-second jumps, and on a short
     * limit those are eighth-of-the-width steps. Nothing here reads this — it
     * exists so the bar can be animated against real elapsed time rather than
     * against the tick.
     */
    private endsAt = 0;

    /**
     * What this run was given altogether, extensions included.
     *
     * The bar needs a denominator, and it used to take one from the screen —
     * `timerTimeSeconds` on the component — while taking its numerator from
     * here. Two values that have to agree, kept in two places, and every report
     * of a wrong bar has been them disagreeing: eighty seconds on an accurate
     * clock drawn as eight per cent of the track means the denominator was
     * about a thousand while the clock was about ninety.
     *
     * Kept with the countdown instead, so there is nothing to disagree with.
     * Extensions add to it as well as to the deadline: a series that buys
     * seconds has a longer bar to fall down, not a bar pinned at full.
     */
    private totalRunMs = 0;

    /** Milliseconds this run was given, for anything drawing a proportion. */
    get totalMs(): number { return this.totalRunMs; }

    /** Milliseconds left, to whatever resolution the caller wants to draw. */
    get remainingMs(): number {
        if (!this.running) return Math.max(0, this.remainingSeconds * 1000);
        return Math.max(0, this.endsAt - Date.now());
    }

    /** Resolves with whether the clock ran out, rather than merely that it ended. */
    private settle?: (elapsed: boolean) => void;

    /**
     * Runs until it reaches zero or somebody stops it.
     *
     * The promise says *which*. It used to resolve only on reaching zero and
     * simply never settle when stopped, so the caller could not tell a deadline
     * from an interruption — it treated every resolution as a timeout, and a
     * stopped timer leaked a pending promise for the life of the page.
     */
    start(seconds?: number) {
        return new Promise<boolean>((resolve, reject) => {
            if (this.running) {
                return reject("GameTimerService: Already running");
            }
    
            if (seconds == null) {
                seconds = this.remainingSeconds;
            }
    
            if (seconds <= 0) {
                return reject("GameTimerService: Invalid seconds");
            }
    
            this.remainingSeconds = seconds;
            this.endsAt = Date.now() + seconds * 1000;
            this.totalRunMs = seconds * 1000;
            this.running = true;
            this.settle = resolve;

            this.interval = setInterval(() => {
                if (this.remainingSeconds > 0) {
                    this.remainingSeconds--;
                    if (this.remainingSeconds === 0) {
                        const done = this.settle;
                        this.settle = undefined;
                        this.pause();
                        return done?.(true);
                    }
                }
            }, 1000);
        });
    }

    /**
     * Hand back some seconds without restarting the clock.
     *
     * A series of claims shares one arrangement and one countdown: answering a
     * claim buys time for the next rather than resetting the limit, so the item
     * stays one timed unit and the extra is visibly the reward for having got
     * that far. Silent when nothing is running, which is the untimed case.
     */
    extend(seconds: number) {
        if (!this.running || seconds <= 0) return;
        this.remainingSeconds += Math.round(seconds);
        this.endsAt += Math.round(seconds) * 1000;
        this.totalRunMs += Math.round(seconds) * 1000;
    }

    /**
     * Put the deadline back where the tick says it should be.
     *
     * The count and the deadline are two clocks, and a hidden tab separates
     * them: `setInterval` is throttled to a crawl or stopped outright, so
     * `remainingSeconds` barely moves while `endsAt` goes on passing in real
     * time. Come back and `remainingMs` reports nought against a count that
     * still reads eighty — the bar sits empty at the left for the rest of the
     * item, since `armTimerBar` has no time left to sweep against, while the
     * number beside it counts down as if nothing had happened.
     *
     * The count wins, deliberately, and that is the same decision `pause`
     * documents: time a throttled tab did not tick is time the player was not
     * given, so charging them for it would make a timeout mean something
     * different depending on whether the window was in front.
     */
    resync() {
        if (!this.running) return;
        this.endsAt = Date.now() + this.remainingSeconds * 1000;
    }

    pause() {
        if (!this.running) {
            return console.warn("GameTimerService: Not running");
        }

        /*
         * `remainingSeconds` is deliberately left as the tick left it.
         *
         * Snapping it to wall-clock time here would change what a timeout
         * means whenever the tab has been throttled — `setInterval` stops
         * firing in a background tab, so the two diverge — and that is a
         * decision about scoring, not about drawing a bar. `endsAt` is rebuilt
         * from this count on the next `start`, so resuming stays consistent.
         */
        this.running = false;
        clearInterval(this.interval);
    }

    stop() {
        const done = this.settle;
        this.settle = undefined;
        if (this.running) this.pause();
        this.remainingSeconds = 0;
        this.endsAt = 0;
        this.totalRunMs = 0;
        // Ended, but not by running out: whoever is waiting must not read this
        // as a deadline that expired.
        done?.(false);
    }
}
