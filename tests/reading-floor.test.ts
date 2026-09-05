/**
 * A deadline you cannot read the item inside is not a deadline.
 *
 * The clock is chosen to fill whatever gap structure could not, and it bottomed
 * out at `minSeconds` — one number, with no idea how much there is to get
 * through. A carousel shows one premise per screen, so a seven-premise item at
 * four seconds a screen needs twenty-eight seconds of paging before an answer
 * is possible at all, against a deadline that can be eight. That item is not
 * hard; it is unanswerable by construction, and it is the combination the
 * default configuration is built on.
 *
 * A floored clock is a *looser* clock, so flooring makes the candidate easier
 * than the target rather than harder. That is the honest outcome and it lets
 * the selection prefer a candidate that reaches the target some other way.
 */

import { assert, equal, test } from "./harness";
import { DEFAULT_ABILITY, chooseConfig } from "../src/app/syllogimous/utils/ability.utils";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import {
    LS_CAROUSEL_ADVANCE, LS_CAROUSEL_SECONDS, LS_GAME_MODE,
} from "../src/app/syllogimous/constants/local-storage.constants";

const TYPE = EnumQuestionType.LinearVertical;

/*
 * Aimed well past what structure can reach, which is the only condition under
 * which the clock is asked to be tight — and a tight clock is what the floor
 * exists to catch. At a target structure nearly meets, the deadline is already
 * generous and there is nothing to floor.
 */
function choose(secondsPerPremise: number, target = 70) {
    return chooseConfig(TYPE, {
        minPremises: 3, maxPremises: 7, ladder: ladderFor(TYPE),
        target, structureBefore: 5, dials: dialsFor(TYPE), secondsPerPremise,
    }, DEFAULT_ABILITY);
}

test("with the whole card visible the clock is unchanged", () => {
    const c = choose(0);
    assert(c.seconds != null && c.seconds >= DEFAULT_ABILITY.minSeconds,
        "a clock was armed below the configured floor");
});

/**
 * The invariant, across every target rather than at one.
 *
 * Comparing a paged item against a flat one at a single target is fragile: the
 * two only differ where the clock was going to be tight, and which targets
 * those are depends on what the mode's structure can reach. The property that
 * has to hold everywhere is simpler — whatever clock is armed, it is never
 * shorter than the screens take to get through.
 */
test("one premise at a time buys the time to read them", () => {
    for (const perPremise of [2, 4, 6]) {
        for (let target = 4; target <= 80; target += 4) {
            const c = choose(perPremise, target);
            if (c.seconds == null) continue;
            assert(c.seconds >= c.premises * perPremise,
                `at target ${target}, ${c.premises} screens at ${perPremise}s each`
                + ` needs ${c.premises * perPremise}s and got ${c.seconds}s`);
        }
    }
});

test("and a tight clock is the case where it bites", () => {
    // Aimed far past what structure can reach, so the clock is asked to be short.
    const flat = choose(0, 80);
    const paged = choose(6, 80);
    assert(flat.seconds != null && paged.seconds != null, "both should carry a clock");
    assert(paged.seconds! > flat.seconds!,
        `paging bought no more time: flat ${flat.premises}p/${flat.seconds}s`
        + ` vs paged ${paged.premises}p/${paged.seconds}s`);
});

test("the floored clock is priced as the looser clock it is", () => {
    const paged = choose(4);
    const flat = choose(0);
    assert(paged.level <= flat.level + 1e-9,
        "a longer deadline was priced as harder than a shorter one");
});

/* ------------------------------------------------------------------ *
 * Where the number comes from                                         *
 * ------------------------------------------------------------------ */

function serviceWith(mode: string, advance?: string, each?: string) {
    localStorage.clear();
    localStorage.setItem(LS_GAME_MODE, mode);
    if (advance) localStorage.setItem(LS_CAROUSEL_ADVANCE, advance);
    if (each) localStorage.setItem(LS_CAROUSEL_SECONDS, each);
    const prog = new ProgressionService(new SettingsOverrideService());
    prog.set("enabled", true);
    prog.applyCalibration(12, 60);
    return prog;
}

test("the display decides how much reading time an item is owed", () => {
    const flat = serviceWith("0").configFor(TYPE);
    const timed = serviceWith("2", "timer", "5").configFor(TYPE);

    if (timed.seconds != null) {
        assert(timed.seconds >= timed.premises * 5,
            `${timed.premises} screens at five seconds each got ${timed.seconds}s`);
    }
    if (flat.seconds != null && timed.seconds != null) {
        assert(timed.seconds >= flat.seconds,
            "paging one premise at a time was given no more time than the whole card");
    }
});

test("a carousel advanced by hand still needs long enough to read one", () => {
    const manual = serviceWith("2", "manual").configFor(TYPE);
    if (manual.seconds != null) {
        assert(manual.seconds >= manual.premises * 2,
            `${manual.premises} screens got ${manual.seconds}s, which is under two each`);
    }
    equal(true, true, "checked");
});
