/**
 * One difficulty scale, and it is not a premise count.
 *
 * Reported: *"how will the archive possibly give a good estimate of syllogimous
 * performance without keeping rungs into account, also premise count in linear
 * compared to space 7d is a completely different game"*.
 *
 * Exactly right, and the archive was reading `q.premises.length`. The app has
 * had the real thing all along — `levelOf` prices the mode's own weight, the
 * rungs the item carried, the clock it was under — but only the ability model
 * could see it. Everything outside got the premise count, which says a seven
 * premise linear chain and a seven premise 7D space are the same item.
 *
 * These are the properties the stored number has to have for a reader to be
 * able to trust it.
 */

import { assert, equal, test } from "./harness";
import { levelOf, DEFAULT_ABILITY } from "../src/app/syllogimous/utils/ability.utils";
import { MODE_SCALE } from "../src/app/syllogimous/utils/calibration.utils";
import { dialsFor, ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

const spec = (over: Partial<Parameters<typeof levelOf>[0]> = {}) => ({
    type: EnumQuestionType.Distinction,
    premises: 4,
    rungs: [] as string[],
    seconds: null as number | null,
    ...over,
});

test("the same premise count is a different difficulty in a different mode", () => {
    const linear = levelOf(spec({ type: EnumQuestionType.LinearArrangement, premises: 7 }));
    const space = levelOf(spec({ type: EnumQuestionType.Direction3DSpatial, premises: 7 }));
    assert(Math.abs(linear - space) > 0.01,
        `seven premises priced identically in two modes: ${linear} vs ${space} — `
        + "this is the premise-count problem the whole change is about");
});

test("every mode carries a weight, so none of them is priced as generic", () => {
    const missing = Object.values(EnumQuestionType).filter(t => !MODE_SCALE[t]);
    equal(missing.length, 0,
        `modes with no weight, priced at 1 by default: ${missing.join(", ")}`);
});

/**
 * Every lever a mode has costs something — whichever kind it is.
 *
 * Gates and dials are priced from different tables, and a mode may have either
 * or both: two modes' ladders are now entirely tombstones, their whole
 * structure having become a dial. What has to hold is that turning on
 * everything a mode offers is harder than turning on none of it.
 */
test("every lever a mode has costs something", () => {
    const faults: string[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        const ladder = ladderFor(type);
        const dials = dialsFor(type);
        if (!ladder.length && !dials.length) continue;

        const plain = levelOf(spec({ type }));
        const turned: Record<string, number> = {};
        for (const name of dials) turned[name] = 1;
        const loaded = levelOf(spec({ type, rungs: ladder.slice(), dials: turned }));

        if (!(loaded > plain)) {
            faults.push(`${type}: ${ladder.length} rungs and ${dials.length} dials`
                + ` added nothing (${plain} -> ${loaded})`);
        }
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});

/** And a dial keeps costing as it is turned, past where the ladder used to stop. */
test("a dial goes on costing past the two steps the ladder allowed", () => {
    const type = EnumQuestionType.Space4D;
    const at = (n: number) => levelOf(spec({ type, dials: { edits: n } }));
    assert(at(1) > at(0), "the first turn cost nothing");
    assert(at(2) > at(1), "the second turn cost nothing");
    assert(at(3) > at(2),
        "the third turn cost nothing — the dial still stops where the ladder did");
    assert(at(4) > at(3), "and the fourth");
});

test("a clock costs something, and a looser one costs less", () => {
    const untimed = levelOf(spec({ seconds: null }));
    const loose = levelOf(spec({ seconds: 120 }));
    const tight = levelOf(spec({ seconds: 15 }));
    assert(tight > loose, `a tighter deadline was not harder: ${tight} vs ${loose}`);
    assert(loose >= untimed, `a deadline made an item easier than having none: ${loose} vs ${untimed}`);
});

test("more premises is harder, within one mode", () => {
    for (const type of Object.values(EnumQuestionType)) {
        const few = levelOf(spec({ type, premises: 3 }));
        const many = levelOf(spec({ type, premises: 8 }));
        assert(many > few, `${type}: eight premises priced at or below three`);
    }
});

/*
 * The carousel term is present and deliberately zero — the coefficient has to
 * be fitted from answered items, the way the rung costs were, and a guess here
 * would rescale every ability estimate in the app. What this checks is that the
 * wiring exists, so fitting it later is a one-line change rather than a hunt.
 */
test("how the premises were shown reaches the formula", () => {
    equal(DEFAULT_ABILITY.levelsPerCarousel, 0,
        "the carousel coefficient has been given a value nobody measured");
    const all = levelOf(spec({ carousel: false }));
    const one = levelOf(spec({ carousel: true }));
    equal(one, all, "unpriced, this must be a no-op");

    const priced = { ...DEFAULT_ABILITY, levelsPerCarousel: 1.5 };
    assert(levelOf(spec({ carousel: true }), priced) - levelOf(spec({ carousel: false }), priced) > 1.4,
        "the term is not wired into levelOf, so fitting it would do nothing");
});

test("difficulty is a number a reader can order, for every mode", () => {
    const faults: string[] = [];
    for (const type of Object.values(EnumQuestionType)) {
        const v = levelOf(spec({ type, premises: 5, rungs: ladderFor(type).slice(0, 2), seconds: 60 }));
        if (!Number.isFinite(v) || v <= 0) faults.push(`${type}: level ${v}`);
    }
    equal(faults.length, 0, `\n  ${faults.join("\n  ")}`);
});
