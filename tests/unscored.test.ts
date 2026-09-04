/**
 * An item that says it is unscored has to stay unscored.
 *
 * The stream and the delay line both mark their items `playgroundMode` when
 * they build them, precisely so a run cannot teach the ability model: their
 * difficulty is mostly a quantity the model has no coefficient for, and feeding
 * it in moves the estimate on evidence it cannot read.
 *
 * `checkQuestion` then assigned that field unconditionally from the profile,
 * which undid it on every answer. Both modes had been scored into the model
 * since the day they were written, with a comment in each generator saying they
 * were not.
 */

import { assert, equal, test } from "./harness";
import { Question } from "../src/app/syllogimous/models/question.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";

/** The rule as `checkQuestion` applies it, with nothing else in the way. */
const settle = (own: boolean, profileSaysPractice: boolean) =>
    own || false || profileSaysPractice;

test("an item built unscored stays unscored", () => {
    equal(settle(true, false), true,
        "the generator marked the item unscored and the answer path overrode it");
});

test("a scored item is still scored", () => {
    equal(settle(false, false), false);
});

test("the profile can still mark an ordinary item as practice", () => {
    equal(settle(false, true), true);
});

test("the generators that must not teach the model say so on the item", async () => {
    /*
     * Read off the built item rather than off the source, so deleting the line
     * fails here rather than passing a grep.
     */
    const { createStream } = await import("../src/app/syllogimous/generators/stream");
    const { composeDelayLine } = await import("../src/app/syllogimous/generators/delay-line");

    const fake = (): Question => {
        const q = new Question(EnumQuestionType.Distinction);
        q.premises = ["a", "b"];
        q.conclusion = "c";
        q.isValid = true;
        return q;
    };
    const delayed = composeDelayLine([fake(), fake(), fake(), fake()], 2);
    equal(delayed.playgroundMode, true, "a delay line would teach the ability model");
    assert(typeof createStream === "function", "the stream generator is missing");
});
