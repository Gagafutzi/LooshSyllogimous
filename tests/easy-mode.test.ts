/**
 * Easy mode: play below your level, off the record.
 *
 * Two halves that have to hold together, because either one alone is a trap.
 * Serving easier items while still recording them would *cost* points — the
 * score is derived from the posteriors, so answering easy items is evidence
 * that ability is low, and a warm-up would dig a hole to climb out of. Not
 * recording while still serving at full difficulty would be a mode that does
 * nothing at all.
 */

import { readFileSync } from "fs";
import { assert, equal, seeded, test } from "./harness";
import {
    DEFAULT_ABILITY, levelOf, pCorrect,
} from "../src/app/syllogimous/utils/ability.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import {
    EASY_MODE_POINTS, POINTS_PER_LEVEL, ProgressionService,
} from "../src/app/syllogimous/services/progression.service";

const TYPE = EnumQuestionType.LinearVertical;

/** What the item this configuration describes is actually worth. */
const levelOfChoice = (service: ProgressionService, type = TYPE) => {
    const c = service.configFor(type);
    return levelOf({
        type, premises: c.premises, rungs: ladderFor(type).slice(0, c.rungs),
        dials: c.dials, seconds: c.seconds,
    }, DEFAULT_ABILITY);
};

/**
 * A player measured somewhere near `at`, with enough answers behind them that
 * the posterior is narrow. Easy mode has to be tested against a settled
 * estimate well clear of the floor: five levels below a beginner is five levels
 * below nothing, and the item cannot get any easier.
 */
function settled(at: number, seed: number): ProgressionService {
    const service = new ProgressionService();
    for (let i = 0; i < 160; i++) {
        const lvl = levelOfChoice(service);
        service.record(TYPE, Math.random() < pCorrect(DEFAULT_ABILITY, at, lvl, 0.5) ? "right" : "wrong", 8);
    }
    return service;
}

test("easy mode serves a markedly easier item", () => {
    seeded(4242, () => {
        localStorage.clear();
        const service = settled(14, 4242);

        const normal = levelOfChoice(service);
        service.set("easyMode" as never, true as never);
        const easy = levelOfChoice(service);

        assert(easy < normal,
            `easy mode served a level ${easy.toFixed(2)} item against a normal ${normal.toFixed(2)} —`
            + " the aim did not move");
        /*
         * Not the full five: difficulty comes in steps — a premise is worth
         * about a level, a rung about half of one — so the aim moves by five
         * and the item lands on the nearest rung below. Three is the loosest
         * claim that still means "a different item".
         */
        assert(normal - easy >= 3,
            `easy mode came down only ${(normal - easy).toFixed(2)} levels, asked for`
            + ` ${EASY_MODE_POINTS / POINTS_PER_LEVEL}`);
    });
});

/** The switch has to take effect on the next item, not the next answer. */
test("turning easy mode on drops the cached choice", () => {
    seeded(4343, () => {
        localStorage.clear();
        const service = settled(14, 4343);

        const first = levelOfChoice(service);
        service.config.easyMode = true;           // set directly: no cache clearing
        const second = levelOfChoice(service);

        assert(second < first,
            "the configuration cache handed back the item chosen under the old setting");
    });
});

test("nothing answered in easy mode moves the estimate or the points", () => {
    seeded(4444, () => {
        localStorage.clear();
        const service = settled(14, 4444);
        service.set("easyMode" as never, true as never);

        const before = service.estimateFor(TYPE);
        const pointsBefore = service.skillPoints;

        // Right, wrong and timed out alike: none of it is evidence.
        for (let i = 0; i < 60; i++) {
            service.record(TYPE, i % 3 === 0 ? "wrong" : i % 7 === 0 ? "timeout" : "right", 8);
        }

        const after = service.estimateFor(TYPE);
        equal(Math.round(after.level * 1000), Math.round(before.level * 1000),
            `the estimate moved from ${before.level.toFixed(3)} to ${after.level.toFixed(3)} in easy mode`);
        equal(after.trials, before.trials,
            "easy-mode answers were counted as trials");
        equal(service.skillPoints, pointsBefore,
            `points moved from ${pointsBefore} to ${service.skillPoints} in easy mode`);
    });
});

/*
 * The test above would pass just as well if easy mode had quietly disabled
 * progression, so this is the other half: turn it off and the very next answer
 * is evidence again. A mode you cannot leave is worse than no mode.
 */
test("switching easy mode off starts recording again", () => {
    seeded(4545, () => {
        localStorage.clear();
        const service = settled(14, 4545);
        service.set("easyMode" as never, true as never);
        for (let i = 0; i < 20; i++) service.record(TYPE, "wrong", 8);

        const before = service.estimateFor(TYPE);
        service.set("easyMode" as never, false as never);
        for (let i = 0; i < 20; i++) service.record(TYPE, "wrong", 8);

        assert(service.estimateFor(TYPE).level < before.level,
            "twenty wrong answers with easy mode off left the estimate where it was");
    });
});

/**
 * A probe exists to measure, and easy mode measures nothing.
 *
 * Wound forward to a turn the schedule *would* have made a probe before easy
 * mode goes on, because easy mode also stops the trial count advancing — so a
 * test that just answered forty easy items would sit off the schedule for ever
 * and pass whether the suppression existed or not. It has to be a turn that is
 * a probe one line earlier.
 */
test("no probe is served in easy mode", () => {
    seeded(4646, () => {
        localStorage.clear();
        const service = settled(14, 4646);

        let found = false;
        for (let i = 0; i < 40 && !found; i++) {
            if (service.isProbeTurn(TYPE)) { found = true; break; }
            service.record(TYPE, "right", 8);
        }
        assert(found, "never reached a probe turn, so there is nothing to suppress");

        service.set("easyMode" as never, true as never);
        assert(!service.isProbeTurn(TYPE), "a probe came up in easy mode");

        service.set("easyMode" as never, false as never);
        assert(service.isProbeTurn(TYPE),
            "the probe schedule did not come back when easy mode went off — suppressed is not destroyed");
    });
});

/** With progression off there is no aim to move, so the flag selects nothing. */
test("easy mode is inert while progression is off", () => {
    localStorage.clear();
    const service = new ProgressionService();
    service.set("easyMode" as never, true as never);
    service.set("enabled" as never, false as never);
    equal(service.easy, false, "easy mode claimed to be in force with progression off");
});

/**
 * The conversion, pinned where it is used.
 *
 * Easy mode is written in points and applied in levels, so the one number
 * joining the two scales has to be the same one the score is computed with. If
 * `aggregate` ever changes how it converts, five hundred points stops meaning
 * five hundred points and this says so.
 */
test("points per level matches the scale the score is reported in", () => {
    seeded(4747, () => {
        localStorage.clear();
        const service = settled(12, 4747);
        const skill = service.skill;
        equal(skill.points, Math.round(skill.level * POINTS_PER_LEVEL),
            `the aggregate reports ${skill.points} points at level ${skill.level.toFixed(3)},`
            + ` which is not ${POINTS_PER_LEVEL} per level`);
    });
});

/**
 * The writer, not just the reader.
 *
 * `record` throwing the answer away keeps the *derived* score still, but the
 * accumulated total in `game.service` is written on its own and is what comes
 * back if progression is ever switched off. It has to sit on the branch that
 * does not climb. The service wants the injector, so this is read off the
 * source — the alternative is no check at all on the half of the promise that
 * players would notice first.
 */
test("the stored score does not climb in easy mode", () => {
    const src = readFileSync("src/app/syllogimous/services/game.service.ts", "utf8");

    const guard = src.split("\n").find(l => l.includes("if (!this.progressionActive"));
    assert(guard != null, "the branch that decides whether the score moves has moved or been renamed");
    assert(/progressionService\.easy/.test(guard!),
        "easy mode is not on the no-score branch, so warm-ups are still being banked:\n  " + guard!.trim());

    // And the branches that do move it are the ones below, not above.
    const at = src.indexOf("if (!this.progressionActive");
    const writes = [...src.matchAll(/this\.rawScore\s*(\+=|=)/g)].map(m => m.index!);
    assert(writes.length > 0, "no write to the stored score was found at all");
    assert(writes.every(i => i > at),
        "the stored score is written before the easy-mode guard, which cannot then stop it");
});

/** A mode that stops your session counting has to say so while you play. */
test("easy mode is visible during play and on the settings page", () => {
    const game = readFileSync("src/app/syllogimous/pages/game/game.component.html", "utf8");
    assert(/progressionService\.easy/.test(game),
        "the game screen looks identical in easy mode, so an unrecorded session is invisible");

    const html = readFileSync(
        "src/app/syllogimous/pages/advanced-options/advanced-options.component.html", "utf8");
    assert(/setProg\('easyMode'/.test(html), "there is no way to turn easy mode on");
});
