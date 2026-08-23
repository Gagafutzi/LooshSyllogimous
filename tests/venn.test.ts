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
import { nameTheInference, rolesFor, vennFor } from "../src/app/syllogimous/utils/venn.utils";
import { seeded } from "./harness";
import { createSyllogism } from "../src/app/syllogimous/generators/syllogism";
import { sylPremisesFromRule } from "../src/app/syllogimous/utils/syllogism.utils";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

function ndContext(): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: { hasRung: () => false, depthBonusFor: () => 0 } as unknown as ProgressionService,
        forceConstruction: "off",
        syllogismGenerator: "canyon",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

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

/**
 * Every syllogism generator draws its picture, not just one of the three.
 *
 * The diagram first went into `buildSetHierarchy` alone, which is the rung --
 * so the two generators that produce the plain mode, and the reported items,
 * got nothing. Coverage is the property worth testing here: a mode that
 * explains itself in one of its three code paths does not explain itself.
 */
test("every syllogism generator produces a diagram", () => {
    const ctx = ndContext();
    const seen: Record<string, number> = {};

    seeded(5150, () => {
        for (const gen of ["fredo", "canyon"] as const) {
            const g = { ...ctx, syllogismGenerator: gen } as GeneratorContext;
            for (let rep = 0; rep < 30; rep++) {
                let q;
                try { q = createSyllogism(g, 2); } catch { continue; }
                seen[gen] = (seen[gen] ?? 0) + (q.venn ? 1 : 0);

                if (!q.venn) continue;
                // Three roles, all named, all different: anything else is not a
                // syllogism and the picture would be asserting one.
                const roles = [q.venn.roles.s, q.venn.roles.p, q.venn.roles.m];
                equal(new Set(roles).size, 3, `${gen}: a term plays two roles`);
                for (const r of roles) assert(!!r, `${gen}: an unnamed circle`);
                equal(q.venn.undrawn.length, 0, `${gen}: a premise went undrawn`);
            }
        }
    });

    for (const gen of ["fredo", "canyon"]) {
        assert((seen[gen] ?? 0) > 10,
            `${gen} drew ${seen[gen] ?? 0} diagrams out of 30`);
    }
});

/**
 * The recorded rule has to describe the item it is on.
 *
 * Fredo drew a rule for `question.rule` and then drew a *second* one for the
 * syllogism it actually built, so the field described a different item. Nothing
 * read it closely enough to notice until the diagram needed to know which term
 * was the middle -- which is what a stale field is for.
 */
test("the rule on the item is the rule the item was built from", () => {
    const ctx = { ...ndContext(), syllogismGenerator: "fredo" } as GeneratorContext;

    seeded(272, () => {
        for (let rep = 0; rep < 30; rep++) {
            let q;
            try { q = createSyllogism(ctx, 2); } catch { continue; }
            if (!q.rule || !q.venn) continue;

            const parts = sylPremisesFromRule(q.bucket[0], q.bucket[1], q.bucket[2], q.rule);
            assert(!!parts, `rule ${q.rule} does not describe a syllogism`);

            // The middle term the rule implies is the one the diagram drew.
            equal(q.venn.roles.m, q.bucket[2],
                `rule ${q.rule} and the drawn diagram disagree about the middle term`);
        }
    });
});

/**
 * The inference is read off the diagram, so it is right in every figure.
 *
 * The first version was a mood table -- one sentence per pair of quantifiers --
 * and it was quietly wrong in half the figures, because "All X is M" and
 * "All M is X" carry the same quantifiers and say different things. It read
 * plausibly, which is the worst way for an explanation to be wrong.
 */
test("the reading matches what the diagram shows, in every figure", () => {
    const roles = { s: "S", p: "P", m: "M" };
    const plain = (t: string) => t;
    const last = (premises: SylPremise[]) => {
        const d = vennFor(premises, roles);
        const lines = nameTheInference(premises, d, plain);
        return lines[lines.length - 1];
    };

    // Barbara, figure 1: All M is P, All S is M => all S is P.
    assert(/all S is P/.test(last([["M", "all", "P"], ["S", "all", "M"]])),
        "a universal chain was not read as one");

    // Celarent: No M is P, All S is M => no S is P.
    assert(/no S is P/.test(last([["M", "no", "P"], ["S", "all", "M"]])),
        "an exclusion through the middle was not read as one");

    // The same quantifiers, the other way round: All P is M, All S is M.
    // Both inside M says nothing about each other -- the classic undistributed
    // middle, and exactly the case a mood table gets wrong.
    assert(/leave it open/.test(last([["P", "all", "M"], ["S", "all", "M"]])),
        "an undistributed middle was read as though it concluded something");

    // Darii: All M is P, Some S is M => some S is P.
    assert(/some S is P/.test(last([["M", "all", "P"], ["S", "some", "M"]])),
        "a particular through the middle was not read as one");

    // Ferio: No M is P, Some S is M => some S is not P.
    assert(/some S is not P/.test(last([["M", "no", "P"], ["S", "some", "M"]])),
        "a particular against an exclusion was not read as one");

    // Two negatives conclude nothing, and the picture has to say so rather than
    // merely fail to say the opposite.
    assert(/leave it open/.test(last([["S", "no", "M"], ["P", "no", "M"]])),
        "two negative premises were read as concluding something");
});

/** Every premise gets its own line, in its own terms. */
test("each premise's effect on the picture is stated", () => {
    const roles = { s: "S", p: "P", m: "M" };
    const premises: SylPremise[] = [["M", "all", "P"], ["S", "some", "M"]];
    const lines = nameTheInference(premises, vennFor(premises, roles), t => t);

    equal(lines.length, 3, "a premise or the reading went missing");
    assert(/All M is P/.test(lines[0]) && /empties/.test(lines[0]),
        "a universal premise does not say what it empties");
    assert(/Some S is M/.test(lines[1]) && /puts something/.test(lines[1]),
        "a particular premise does not say what it places");
});
