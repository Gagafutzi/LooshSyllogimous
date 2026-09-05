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
        hasRung: () => false,
        dialFor: () => 0,
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
 * The plain mode draws its picture, not only the rung.
 *
 * The diagram first went into `buildSetHierarchy` alone -- so the generator
 * that produces the plain mode, and the reported items, got nothing. Coverage
 * is the property worth testing here: a mode that explains itself in one of its
 * code paths does not explain itself.
 *
 * This looped over two generators until Fredo was removed. The loop is gone
 * rather than kept with one entry, because a coverage test that covers
 * everything there is says so more clearly without the scaffolding.
 */
test("a plain syllogism produces a diagram", () => {
    const ctx = ndContext();
    let drawn = 0;

    seeded(5150, () => {
        for (let rep = 0; rep < 30; rep++) {
            let q;
            try { q = createSyllogism(ctx, 2); } catch { continue; }
            drawn += q.venn ? 1 : 0;

            if (!q.venn) continue;
            // Three roles, all named, all different: anything else is not a
            // syllogism and the picture would be asserting one.
            const roles = [q.venn.roles.s, q.venn.roles.p, q.venn.roles.m];
            equal(new Set(roles).size, 3, "a term plays two roles");
            for (const r of roles) assert(!!r, "an unnamed circle");
            equal(q.venn.undrawn.length, 0, "a premise went undrawn");
        }
    });

    assert(drawn > 10, `only ${drawn} diagrams out of 30`);
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

/**
 * Every syllogism explains itself, at every length.
 *
 * This used to loop over the three generators, and that was the point of it:
 * `createSyllogism` picked between Fredo and Canyon on a coin flip and only
 * Canyon had a derivation, so half of every player's syllogisms answered a
 * wrong answer with a verdict and nothing else. Not "sometimes broken" --
 * never present, half the time, and invisible to a coverage test over the mode
 * because the mode did explain itself on the runs where the coin fell the other
 * way.
 *
 * With one generator left the loop is over *lengths* instead, which is where
 * the same failure now hides: a two-step chain and a five-step one take
 * different paths through the derivation, and the short one was the thin one.
 */
test("every syllogism explains itself, however long its chain", () => {
    const ctx = ndContext();
    let built = 0, explained = 0;

    seeded(1919, () => {
        for (let n = 2; n <= 5; n++) {
            for (let rep = 0; rep < 15; rep++) {
                let q;
                try { q = createSyllogism(ctx, n); } catch { continue; }
                built++;
                if (q.explanation.length) explained++;
            }
        }
    });

    assert(built > 40, `built only ${built} items`);
    equal(explained, built, `${built - explained} of ${built} items had no derivation`);
});

/**
 * A derivation has to say something the item did not already say.
 *
 * The floor from fixes/3: a derivation made entirely of restated premises has
 * done no work. This was asserted of Fredo, which named its two load-bearing
 * premises and then had to add the middle term and the move -- and when Fredo
 * went, the same assertion pointed at Canyon and failed. A two-step chain has
 * no intermediate conclusions, so its whole derivation was `so <the answer>`.
 * The short case is explained as the syllogism it is now, which is what Fredo
 * had been quietly covering up.
 */
test("a syllogism derivation adds something to the premises", () => {
    const ctx = ndContext();
    seeded(2828, () => {
        for (let rep = 0; rep < 20; rep++) {
            let q;
            try { q = createSyllogism(ctx, 3); } catch { continue; }
            const stated = new Set([...q.premises, String(q.conclusion)]);
            const novel = q.explanation.filter(line => !stated.has(line));
            assert(novel.length >= 2,
                `a derivation of ${q.explanation.length} lines restated all but ${novel.length}`);
        }
    });
});
