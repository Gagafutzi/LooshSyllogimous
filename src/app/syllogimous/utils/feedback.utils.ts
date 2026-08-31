/**
 * Whether the screen makes a noise, and whether it says how the last item went.
 *
 * Two switches rather than one, because they are two complaints. The sound is
 * heard by everyone in the room and is the first thing anybody turns off in a
 * library or beside a sleeping flatmate. The verdict flash is a different
 * objection: it is the beat between questions, and somebody working through a
 * long session can want the stream to close up without wanting the app muted.
 *
 * **What "off" means for each.** Sound off silences every tone the app plays —
 * the per-answer blips and the daily-goal chime — because they come out of one
 * synthesiser and a switch that left one of them audible would be a switch that
 * did not work. Feedback off hides the word; it does not stop the scoring, the
 * history, the rating or the ability model, all of which run exactly as before.
 * The answer is still recorded and **History still shows what it was** — the
 * only thing given up is being told in the moment.
 *
 * **The pause is part of it.** The screen holds for 650ms after a right answer
 * and 900ms after a wrong one, and that time is bought by the verdict: it is
 * how long the word needs to be read. With nothing to read it is a stall, and a
 * stall between questions is precisely what somebody turning this off is trying
 * to get rid of. So the hold drops to a quarter second — still long enough that
 * a bounced key or a double-tap cannot answer the question that follows, which
 * is the pause's other and quieter job.
 *
 * Both split out here rather than read from storage inside the service, for the
 * same reason `review.utils` was: it makes them functions instead of a screen,
 * and a rule about timing that only exists inside a `setTimeout` is a rule that
 * gets verified by staring.
 */

import { LS_FEEDBACK_OFF, LS_SOUND_OFF } from "../constants/local-storage.constants";

/** Absence means audible, so nobody is migrated onto silence. */
export function soundOn(): boolean {
    try {
        return localStorage.getItem(LS_SOUND_OFF) !== "1";
    } catch {
        // Private mode: the default stands rather than the feature vanishing.
        return true;
    }
}

export function setSoundOn(on: boolean): void {
    try {
        if (on) localStorage.removeItem(LS_SOUND_OFF);
        else localStorage.setItem(LS_SOUND_OFF, "1");
    } catch { /* private mode; the default stands */ }
}

/** Absence means shown, for the same reason. */
export function feedbackOn(): boolean {
    try {
        return localStorage.getItem(LS_FEEDBACK_OFF) !== "1";
    } catch {
        return true;
    }
}

export function setFeedbackOn(on: boolean): void {
    try {
        if (on) localStorage.removeItem(LS_FEEDBACK_OFF);
        else localStorage.setItem(LS_FEEDBACK_OFF, "1");
    } catch { /* private mode; the default stands */ }
}

/**
 * The hold with no verdict in it: long enough to swallow a key bounce, short
 * enough not to read as a pause.
 */
export const SILENT_PAUSE_MS = 250;

/**
 * How long the screen holds between an answer and whatever comes next.
 *
 * A wrong answer gets longer than a right one because it carries more to read —
 * the marks under the word on a multi-conclusion item, which say *which*
 * conclusion lost it. Neither of those is on screen when the flash is off.
 */
export function verdictPause(
    kind: "correct" | "wrong" | "timeout",
    shown = feedbackOn(),
): number {
    if (!shown) return SILENT_PAUSE_MS;
    return kind === "correct" ? 650 : 900;
}

/**
 * How long one conclusion's flash stays up, mid-item.
 *
 * Shorter than the item verdict even when it is shown: the next conclusion is
 * already on screen behind it and the arrangement is being held in memory, so
 * this is a glance rather than something to stop for.
 */
export function claimFlashMs(shown = feedbackOn()): number {
    return shown ? 450 : SILENT_PAUSE_MS;
}
