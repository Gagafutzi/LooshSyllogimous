/**
 * What leaves the machine, checked before anything can send it anywhere.
 *
 * The point of the summary is that it can be read before it is published, and
 * the point of testing it is that "no timestamps" has to be a property rather
 * than an intention — a public store has no un-publishing.
 */

import { assert, equal, test } from "./harness";
import { buildShareReport, ShareInput } from "../src/app/syllogimous/utils/share.utils";

const input: ShareInput = {
    modes: [
        { type: "Comparison Numerical", level: 11.42, sure: 0.61, trials: 240 },
        { type: "Space 4D", level: 7.8, sure: 1.9, trials: 31 },
        { type: "Syllogism", level: 4.0, sure: 6.0, trials: 0 },
    ],
    days: 18, answered: 402, version: "4.1.0",
};

test("a mode nobody has answered is not reported as an estimate", () => {
    const { text, json } = buildShareReport(input);
    assert(!text.includes("Syllogism"), "a mode with no answers was given a level");
    assert(!json.includes("Syllogism"), "…and it is in the machine-readable half too");
});

test("nothing in it says when anything happened", () => {
    const { text, json } = buildShareReport(input);
    const both = text + json;
    assert(!/\d{4}-\d{2}-\d{2}/.test(both), "a date leaked into the summary");
    assert(!/\d{2}:\d{2}/.test(both), "a time of day leaked into the summary");
    // Epoch milliseconds, which is how a timestamp usually escapes.
    assert(!/\b1[6-9]\d{11}\b/.test(both), "an epoch timestamp leaked into the summary");
});

test("it is short enough that somebody could actually read it", () => {
    const { text } = buildShareReport(input);
    assert(text.split("\n").length < 30,
        "a summary nobody will read is not consent, it is a formality");
});

test("the two halves agree", () => {
    const { text, json } = buildShareReport(input);
    const parsed = JSON.parse(json);
    equal(parsed.modes.length, 2, "the machine-readable half has a different set");
    equal(parsed.answered, 402, "the totals disagree");
    assert(text.includes("402 answered over 18 days"), "the readable half lost the totals");
});

test("an untrained player gets a summary that says so", () => {
    const { text, json } = buildShareReport({ ...input, modes: [], answered: 0, days: 0 });
    assert(text.includes("No mode"), "an empty history produced an empty report");
    equal(JSON.parse(json).modes.length, 0, "modes were invented");
});

test("the strongest mode is listed first", () => {
    const lines = buildShareReport(input).text.split("\n");
    const first = lines.findIndex(l => l.startsWith("Comparison Numerical"));
    const second = lines.findIndex(l => l.startsWith("Space 4D"));
    assert(first > 0 && first < second, "the list is not ordered by level");
});
