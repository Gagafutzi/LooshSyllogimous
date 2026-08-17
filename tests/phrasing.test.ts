/**
 * The markup contract.
 *
 * These wrappers used to be written out by hand in eight files. Moving them
 * into one is only safe if the output is byte-identical, and two of them are
 * matched by regex elsewhere — `extractSubjects` in question.utils and the
 * diagnostics screen both parse `.subject` back out of rendered HTML. So the
 * shape of the tag is a contract, and this is where it is pinned.
 */

import { assert, equal, test } from "./harness";
import { dimClass, hi, neg, rel, subj } from "../src/app/syllogimous/utils/phrasing";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";

test("subj emits exactly the markup the parsers expect", () => {
    equal(subj("Dog"), '<span class="subject">Dog</span>');
});

test("subj stringifies like the interpolation it replaced", () => {
    // Several generators pass a one-element array straight from splice.
    equal(subj(["Dog"] as unknown as string), '<span class="subject">Dog</span>');
});

test("extractSubjects round-trips what subj writes", () => {
    const premise = `${subj("Ash")} is east of ${subj("Bell")}`;
    equal(extractSubjects(premise), ["Ash", "Bell"]);
});

test("relation and highlight take an optional dimension class", () => {
    equal(rel("is east of"), '<span class="relation ">is east of</span>');
    equal(rel("is east of", dimClass(3)), '<span class="relation dim dim-3">is east of</span>');
    equal(hi("east", dimClass(1)), '<span class="highlight dim dim-1">east</span>');
});

test("negation cue is its own class, so it can outrank a dimension colour", () => {
    equal(neg("above"), '<span class="is-negated">above</span>');
});

test("dimension classes carry both the hook and the slot", () => {
    assert(dimClass(4).split(" ").includes("dim"), "generic hook missing");
    assert(dimClass(4).split(" ").includes("dim-4"), "slot class missing");
});
