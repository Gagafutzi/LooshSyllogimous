/**
 * The sound switch and the verdict-flash switch.
 *
 * Three things have to hold and only one of them is obvious. Off has to mean
 * off; absence of either setting has to mean what every existing player already
 * has, which is why both are stored as *off* switches; and the two have to be
 * independent, because they were asked for as one sentence and are two entirely
 * different objections — one is about the room, the other is about the pacing.
 *
 * The pause is tested here as well, and it is the part that could quietly go
 * wrong. It is not decoration: it is also the window in which `verdict` is set,
 * which is what the keyboard handler checks before letting a keypress through.
 * Shortening it to nothing when the flash is hidden would make a double-tap
 * answer the *next* question — the fastest possible way to lose an item, on
 * exactly the answers given confidently enough to double-tap.
 */

import { assert, equal, test } from "./harness";
import {
    claimFlashMs, feedbackOn, setFeedbackOn, setSoundOn, soundOn, verdictPause,
    SILENT_PAUSE_MS,
} from "../src/app/syllogimous/utils/feedback.utils";

function fresh() { localStorage.clear(); }

test("sound and the verdict are both on for anyone who has never set them", () => {
    fresh();
    assert(soundOn(), "a fresh store read as muted");
    assert(feedbackOn(), "a fresh store read as no feedback");
});

test("muting takes, and unmuting gives it back", () => {
    fresh();
    setSoundOn(false);
    assert(!soundOn(), "the mute did not take");
    setSoundOn(true);
    assert(soundOn(), "unmuting did not take");
});

test("hiding the verdict takes, and showing it gives it back", () => {
    fresh();
    setFeedbackOn(false);
    assert(!feedbackOn(), "the off switch did not take");
    setFeedbackOn(true);
    assert(feedbackOn(), "turning it back on did not take");
});

/**
 * On is stored as *nothing*, which is what makes the default free — and what
 * lets a future default change move somebody who never expressed a preference.
 */
test("on leaves nothing behind in storage", () => {
    fresh();
    setSoundOn(false);
    setSoundOn(true);
    setFeedbackOn(false);
    setFeedbackOn(true);
    equal(localStorage.getItem("SYL_SOUND_OFF"), null,
        "unmuting left a stored value behind");
    equal(localStorage.getItem("SYL_FEEDBACK_OFF"), null,
        "showing the verdict again left a stored value behind");
});

/** Two complaints, two switches: neither may move the other. */
test("the two switches are independent", () => {
    fresh();
    setSoundOn(false);
    assert(feedbackOn(), "muting also hid the verdict");

    fresh();
    setFeedbackOn(false);
    assert(soundOn(), "hiding the verdict also muted the app");
});

/* ------------------------------------------------------------------ *
 * The pause between questions                                         *
 * ------------------------------------------------------------------ */

test("a shown verdict gets long enough to read, and wrong gets longer", () => {
    fresh();
    const right = verdictPause("correct");
    const wrong = verdictPause("wrong");
    const out = verdictPause("timeout");
    assert(right >= 500, "a correct answer flashed past faster than it can be read");
    assert(wrong > right, "a wrong answer got no longer than a right one, and it carries more");
    assert(out > right, "a timeout got no longer than a correct answer");
});

test("hiding the verdict closes the gap without removing it", () => {
    fresh();
    setFeedbackOn(false);
    for (const kind of ["correct", "wrong", "timeout"] as const) {
        equal(verdictPause(kind), SILENT_PAUSE_MS,
            "a hidden verdict still held for its full reading time on " + kind);
    }
});

/**
 * The floor, stated as its own case: a bounced key or a fast double-tap must
 * not reach the question underneath.
 */
test("there is always a gap, however the switches are set", () => {
    fresh();
    for (const shown of [true, false]) {
        for (const kind of ["correct", "wrong", "timeout"] as const) {
            assert(verdictPause(kind, shown) >= 200,
                "the gap fell to where a double-tap answers the next question");
        }
        assert(claimFlashMs(shown) >= 200, "the claim flash left no gap at all");
    }
});

/** Mid-item, the next conclusion is already on screen behind the flash. */
test("a claim flash is shorter than an item verdict either way", () => {
    fresh();
    assert(claimFlashMs(true) < verdictPause("wrong", true),
        "one conclusion's flash stopped play as long as the item's verdict");
    equal(claimFlashMs(false), SILENT_PAUSE_MS,
        "hiding the verdict left the claim flash at its reading length");
});

/** The default argument is the setting, so a caller may simply not pass one. */
test("the pause reads the setting when it is not told", () => {
    fresh();
    setFeedbackOn(false);
    equal(verdictPause("wrong"), verdictPause("wrong", false),
        "verdictPause ignored the stored setting");
    equal(claimFlashMs(), claimFlashMs(false),
        "claimFlashMs ignored the stored setting");
});
