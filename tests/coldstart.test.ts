/**
 * What a brand-new player is actually served, and who wins when two layers
 * both want to set the premise count.
 *
 * Both were reported from play: Peasant opened on five linear premises with
 * negation on, while Customise sat there saying two. They turned out to be
 * separate faults that happened to point the same way — a prior so wide its
 * mean landed mid-scale, and a progression layer that ran last and overwrote
 * whatever the user had typed.
 */

import { assert, test } from "./harness";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { buildChain, LINEAR_SCALES, renderPremises } from "../src/app/syllogimous/utils/linear.utils";

/** A service with no saved history, whatever earlier tests left behind. */
function fresh() {
    localStorage.clear();
    return new ProgressionService();
}

test("a new player starts at the shortest item every mode has", () => {
    const p = fresh();
    for (const type of Object.values(EnumQuestionType)) {
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        if (!params) continue;
        const chosen = p.configFor(type).premises;
        assert(chosen <= params.minNumOfPremises + 1,
            `${type} opens at ${chosen} premises, minimum is ${params.minNumOfPremises}`);
    }
});

test("a new player is given no modifiers before answering anything", () => {
    const p = fresh();
    for (const type of Object.values(EnumQuestionType)) {
        const rungs = p.rungsFor(type);
        assert(rungs.length === 0, `${type} opens carrying ${rungs.join(", ")}`);
    }
});

test("answering correctly is what raises difficulty", () => {
    const p = fresh();
    const before = p.estimateFor(EnumQuestionType.Distinction).level;
    for (let i = 0; i < 12; i++) p.record(EnumQuestionType.Distinction, "right", 8);
    const after = p.estimateFor(EnumQuestionType.Distinction);
    assert(after.level > before, "twelve correct answers did not move the estimate");
    assert(after.sd < 2.5, "twelve answers left the posterior as wide as the prior");
    assert(p.rungsFor(EnumQuestionType.Distinction).length > 0,
        "twelve correct answers unlocked nothing");
});

test("uncertainty makes items easier, not harder", () => {
    // The cold-start fault in one line: an unmeasured player must never be
    // served a harder item than a measured one sitting at the same estimate.
    const p = fresh();
    const cold = p.configFor(EnumQuestionType.Distinction).premises;
    for (let i = 0; i < 12; i++) p.record(EnumQuestionType.Distinction, "right", 8);
    const warm = p.configFor(EnumQuestionType.Distinction);
    assert(warm.premises + p.rungsFor(EnumQuestionType.Distinction).length >= cold,
        "the guess outranked the measurement");
});

test("a premise count set in Customise is not overwritten by progression", () => {
    const p = fresh();
    const type = EnumQuestionType.Distinction;
    for (let i = 0; i < 20; i++) p.record(type, "right", 4);

    const set = (n: number) => {
        let value = n;
        return {
            question: {
                [type]: {
                    enabled: true,
                    get numOfPremises() { return value; },
                    clampNumOfPremises: (v: number) => v,
                    setNumOfPremises: (v: number) => { value = v; },
                },
            },
            setEnable: () => {},
        } as any;
    };

    const free = set(2);
    p.applyTo(free);
    assert(free.question[type].numOfPremises > 2,
        "progression should raise an unpinned count for a strong player");

    const pinned = set(2);
    p.applyTo(pinned, { premises: new Set([type]), flags: true });
    assert(pinned.question[type].numOfPremises === 2,
        `Customise said 2, play got ${pinned.question[type].numOfPremises}`);
});

test("negation never takes every premise at once", () => {
    const layout = buildChain(["A", "B", "C", "D", "E"]);
    const scale = Object.values(LINEAR_SCALES)[0];
    let sawSome = false;

    for (let i = 0; i < 300; i++) {
        const { premises, negations } = renderPremises(scale, layout, { negate: true });
        assert(negations >= 1, "negation was on and nothing came out negated");
        assert(negations < premises.length,
            `all ${premises.length} premises were negated, which is the same item read backwards`);
        if (negations > 1) sawSome = true;
    }

    assert(sawSome, "the count never varied, so negation is now fixed at one");
});
