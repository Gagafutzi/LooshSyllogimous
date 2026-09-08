/**
 * What leaves the machine, checked before anything can send it anywhere.
 *
 * The point of the summary is that it can be read before it is published, and
 * the point of testing it is that "no timestamps" has to be a property rather
 * than an intention — a public store has no un-publishing.
 */

import { assert, equal, test } from "./harness";
import { readFileSync } from "fs";
import {
    IQ_RANGE, SHARE_DESTINATION, buildShareReport, readSelfReported, ShareInput,
} from "../src/app/syllogimous/utils/share.utils";

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

/* ------------------------------------------------------------------ *
 * The optional self-reported score                                    *
 * ------------------------------------------------------------------ */

test("no score entered means no score published", () => {
    const { text, json } = buildShareReport(input);
    assert(!/IQ/i.test(text), "an absent score was reported anyway");
    assert(!/iq/i.test(json), "…and it reached the machine-readable half too");
});

test("a score is marked as self-reported wherever it appears", () => {
    const { text, json } = buildShareReport(
        { ...input, iq: { score: 128, source: "Raven's APM" } });
    assert(/Self-reported IQ 128 \(Raven's APM\)/.test(text),
        "the readable half does not say who reported it");
    assert(JSON.parse(json).selfReportedIq.score === 128,
        "the machine-readable half lost the score");
    assert("selfReportedIq" in JSON.parse(json),
        "the field name does not say the number is self-reported");
});

test("a score with no test named says so rather than implying one", () => {
    const { text } = buildShareReport({ ...input, iq: { score: 115 } });
    assert(text.includes("test not named"),
        "an unsourced score reads as though it came from somewhere");
});

test("a typo is not a score", () => {
    equal(readSelfReported(""), null, "an empty field became a score");
    equal(readSelfReported("abc"), null, "text became a score");
    equal(readSelfReported(IQ_RANGE[0] - 1), null, "an implausible low value was kept");
    equal(readSelfReported(IQ_RANGE[1] + 1), null, "an implausible high value was kept");
    equal(readSelfReported(1300), null, "a missing decimal point was kept");
});

test("a score is rounded and its source trimmed", () => {
    const parsed = readSelfReported("127.6", "  Mensa Norway  ");
    equal(parsed?.score, 128, "the score was not rounded");
    equal(parsed?.source, "Mensa Norway", "the source was not trimmed");
    equal(readSelfReported(120, "   ")?.source, undefined,
        "a blank source became an empty string rather than being left out");
});

/**
 * A destination that is not there yet.
 *
 * The link is to somewhere outside this app, so it can be wrong in a way no
 * amount of local testing notices — the only two states worth allowing are a
 * real address and none, and the second must not render a button.
 */
test("no button is offered until there is somewhere for it to go", () => {
    const html = readFileSync(
        "src/app/syllogimous/pages/stats/stats.component.html", "utf8");
    const link = html.match(/<a\b[^>]*\[href\]="SHARE_DESTINATION"[^>]*>/);
    assert(!!link, "the destination link is gone");
    assert(/\*ngIf="SHARE_DESTINATION"/.test(link![0]),
        "an unset destination would still render a button that goes nowhere");
    assert(/rel="noopener"/.test(link![0]) && /target="_blank"/.test(link![0]),
        "the link should open elsewhere, without handing over this page");
});

test("the destination, if set at all, is a plain https address", () => {
    assert(SHARE_DESTINATION === "" || /^https:\/\/[^\s"']+$/.test(SHARE_DESTINATION),
        `an unusable destination: ${JSON.stringify(SHARE_DESTINATION)}`);
});
