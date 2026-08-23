/**
 * A syllogism as three circles.
 *
 * The Venn test is a decision procedure, not an illustration: shade what the
 * universal premises say is empty, mark what the particular ones say exists,
 * and the conclusion follows exactly when the picture already shows it. So the
 * cases worth testing are the ones where the diagram and `sylEntails` have to
 * agree, and the classical traps where a careless diagram would disagree.
 */

import { assert, equal, test } from "./harness";
import { SylPremise } from "../src/app/syllogimous/models/syllogism.models";
import { rolesFor, vennFor } from "../src/app/syllogimous/utils/venn.utils";

const shadedOf = (premises: SylPremise[], conclusion: SylPremise) => {
    const roles = rolesFor(premises, conclusion)!;
    assert(!!roles, "no middle term");
    const d = vennFor(premises, roles);
    equal(d.undrawn.length, 0, "a premise could not be drawn");
    return d;
};

/** Barbara: All M is P, All S is M => All S is P. */
test("a universal chain empties everything outside the conclusion", () => {
    const d = shadedOf(
        [["M", "all", "P"], ["S", "all", "M"]],
        ["S", "all", "P"],
    );

    // "All S is M" empties S outside M; "All M is P" empties M outside P.
    // Between them every part of S outside P is gone, which is the conclusion.
    for (const region of ["s", "sp"]) {
        assert(d.shaded.includes(region),
            `${region} is in S and not in P, and nothing emptied it`);
    }
    assert(!d.shaded.includes("spm"), "the region the conclusion needs is empty too");
    equal(d.marks.length, 0, "a universal premise produced an existential mark");
});

/**
 * The screenshot's item: No S is M, No P is M.
 *
 * Two negative premises entail nothing, and the diagram has to show that rather
 * than merely fail to show the opposite. What it shows is the S/P overlap left
 * *open* — not shaded, not marked — which is exactly "the premises do not
 * settle this", and is the distinction the mode had been reporting as plain
 * "false".
 */
test("two negative premises leave the conclusion's region open", () => {
    const d = shadedOf(
        [["S", "no", "M"], ["P", "no", "M"]],
        ["S", "some_not", "P"],
    );

    assert(d.shaded.includes("sm"), "No S is M did not empty the S/M overlap");
    assert(d.shaded.includes("pm"), "No P is M did not empty the P/M overlap");
    assert(d.shaded.includes("spm"), "the three-way overlap survived two exclusions");

    // Neither shaded nor marked: nothing is known about it either way.
    assert(!d.shaded.includes("sp"), "the S/P overlap was ruled out, which nothing said");
    assert(!d.shaded.includes("s"), "S outside P was ruled out, which nothing said");
    equal(d.marks.length, 0, "something was claimed to exist");
});

/**
 * A mark straddles when the premises do not say which side it falls.
 *
 * This is the whole reason the diagram is drawn rather than described. "Some S
 * is M" with nothing said about P leaves two places the thing could be, and
 * putting the dot in either one asserts something the premises never did.
 */
test("an undetermined particular is drawn on the boundary", () => {
    const roles = { s: "S", p: "P", m: "M" };
    const d = vennFor([["S", "some", "M"]], roles);

    equal(d.marks.length, 1, "the particular premise produced no mark");
    equal([...d.marks[0].regions].sort().join(","), "sm,spm",
        "the mark was pinned to one region when two were open");
});

/** Shading first is load-bearing: it closes off one of the two places. */
test("a universal premise pins a particular one", () => {
    const roles = { s: "S", p: "P", m: "M" };
    const d = vennFor([["M", "no", "P"], ["S", "some", "M"]], roles);

    equal(d.marks.length, 1, "the particular premise produced no mark");
    equal(d.marks[0].regions.join(","), "sm",
        "the mark straddles a region the universal premise had emptied");
});

/** A term that plays no role means this is not a three-circle picture. */
test("an undrawable premise is reported, never dropped", () => {
    const roles = { s: "S", p: "P", m: "M" };
    const d = vennFor([["S", "all", "Q"]], roles);
    equal(d.undrawn.length, 1, "a premise about a fourth term was drawn anyway");
    equal(d.shaded.length, 0, "it shaded something despite not being drawable");
});

test("the middle term is the one the conclusion never mentions", () => {
    const roles = rolesFor([["M", "all", "P"], ["S", "all", "M"]], ["S", "all", "P"]);
    equal(roles?.m, "M", "the middle term was not identified");

    // Two candidates is not a syllogism, and guessing would draw a false picture.
    equal(rolesFor([["M", "all", "P"], ["S", "all", "N"]], ["S", "all", "P"]), null,
        "a premise set with two loose terms was forced into three circles");
});
