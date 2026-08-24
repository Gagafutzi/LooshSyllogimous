import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class GameTimerService {

    interval?: any;
    remainingSeconds = 0;
    running = false;

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
    }

    pause() {
        if (!this.running) {
            return console.warn("GameTimerService: Not running");
        }

        this.running = false;
        clearInterval(this.interval);
    }

    stop() {
        const done = this.settle;
        this.settle = undefined;
        if (this.running) this.pause();
        this.remainingSeconds = 0;
        // Ended, but not by running out: whoever is waiting must not read this
        // as a deadline that expired.
        done?.(false);
    }
}
