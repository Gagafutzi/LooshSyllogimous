/**
 * Quantified set logic over a branching network — where "Set Hierarchy" landed.
 *
 * The roadmap listed it as a mode that was never built. It is not a mode: every
 * syllogism this app produced was a *path*, each premise composing onto the
 * running conclusion, and what a hierarchy adds is a different *shape* of
 * premise network. The solver never cared — `sylEntails` refutes rather than
 * derives, so it works over any set of premises — which is what made this a
 * rung rather than a generator.
 *
 * What branching buys is the thing a path cannot offer: a pair the premises
 * leave genuinely undecided, as distinct from one they rule out. Telling those
 * apart is most of what the mode is for, so the tests below check the
 * distinction rather than only the verdict.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createSyllogism } from "../src/app/syllogimous/generators/syllogism";
import { SylKind, SylPremise } from "../src/app/syllogimous/models/syllogism.models";
import {
    sylEntails, sylIsConsistent, sylNegate,
} from "../src/app/syllogimous/utils/syllogism.utils";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    // Off, so every premise renders plainly. A negated rendering says the same
    // thing in the opposite form, which reads back ambiguously once the markup
    // is stripped — and the structure is what is under test here.
    settings.setEnable("negation", false);

    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, spread: () => null, axesFor: () => null,
            circularAxes: () => 0, depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === "hierarchy",
        dialFor: () => 0,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** "All A is B" back into a premise. */
function parse(text: string): SylPremise | null {
    const line = text.replace(/<[^>]+>/g, "").trim();
    let m: RegExpExecArray | null;

    if ((m = /^Some (.+) is not (.+)$/.exec(line))) return [m[1], "some_not", m[2]];
    if ((m = /^All (.+) is (.+)$/.exec(line))) return [m[1], "all", m[2]];
    if ((m = /^No (.+) is (.+)$/.exec(line))) return [m[1], "no", m[2]];
    if ((m = /^Some (.+) is (.+)$/.exec(line))) return [m[1], "some", m[2]];
    return null;
}

function item(seed: number) {
    const q = seeded(seed, () => createSyllogism(context(), 5));
    const premises = q.premises.map(parse).filter((p): p is SylPremise => !!p);
    const claim = parse(String(q.conclusion));
    return { q, premises, claim };
}

test("a hierarchy item's answer is what the premises actually entail", () => {
    let checked = 0, right = 0, wrong = 0;

    for (let run = 0; run < 60; run++) {
        const { q, premises, claim } = item(run * 5237 + 11);
        assert(premises.length === q.premises.length, "a premise could not be read back");
        assert(!!claim, `the claim could not be read back: ${q.conclusion}`);

        assert(sylIsConsistent(premises),
            "the premises contradict each other, so everything follows from them");

        const follows = sylEntails(premises, claim!);
        assert(follows === q.isValid,
            `the premises ${follows ? "do" : "do not"} entail the claim, item says ${q.isValid}`);

        q.isValid ? right++ : wrong++;
        checked++;
    }

    assert(checked === 60, "some items could not be read back");
    assert(right > 15 && wrong > 15,
        `${right} true and ${wrong} false — the answer should not be guessable`);
});

test("the premises named as needed really are all of them and only them", () => {
    /*
     * A derivation that listed every premise would say "it follows from all of
     * this", which the verdict already said. The claim being made is stronger:
     * these are enough, and each one is load-bearing.
     */
    let checked = 0;

    for (let run = 0; run < 80 && checked < 20; run++) {
        const { q, premises, claim } = item(run * 811 + 7);
        if (!q.isValid) continue;

        /*
         * The leading lines, taken until one stops being a premise.
         *
         * They used to be tagged "— needed." and found by that word. The tag
         * went when the derivation was put into syllogistic order: it was
         * bookkeeping about the search rather than a step of the argument, and
         * a reader does not need every line labelled with why it is there.
         * Position carries it instead — the premises come first, then the move,
         * then the conclusion — which is what "in syllogistic order" means and
         * is worth testing directly.
         */
        const needed: SylPremise[] = [];
        for (const line of q.explanation) {
            const parsed = parse(line);
            if (!parsed) break;
            needed.push(parsed);
        }

        assert(needed.length >= 2, `only ${needed.length} premises were named`);
        assert(sylEntails(needed, claim!), "the named premises do not entail the claim");

        for (const drop of needed) {
            const without = needed.filter(p => p !== drop);
            assert(!sylEntails(without, claim!),
                `"${drop.join(" ")}" was named but is not needed`);
        }

        checked++;
    }

    assert(checked >= 20, `only ${checked} true items appeared`);
});

test("ruled out and merely undecided are told apart", () => {
    // The distinction the mode exists for. Calling both "does not follow" is
    // true of each and a description of neither.
    let ruled = 0, open = 0;

    for (let run = 0; run < 120 && (ruled < 8 || open < 8); run++) {
        const { q, premises, claim } = item(run * 3167 + 23);
        if (q.isValid) continue;

        const contradicted = sylEntails(premises, sylNegate(claim!));
        const saysRuledOut = q.explanation.some(l => l.includes("ruled out")
            && !l.includes("not the same as being ruled out"));

        assert(saysRuledOut === contradicted,
            contradicted
                ? "a claim the premises rule out was reported as merely unsupported"
                : "a claim the premises leave open was reported as ruled out");

        contradicted ? ruled++ : open++;
    }

    assert(ruled >= 8 && open >= 8,
        `${ruled} ruled out and ${open} left open — both have to be common`);
});

test("the premise network branches rather than forming a line", () => {
    /*
     * The whole difference from the chain generator. In a path every term is
     * named at most twice; a branch means some term is named three times or
     * more, and that is what lets two things be related only through a group
     * they are both in.
     */
    let branched = 0;

    for (let run = 0; run < 40; run++) {
        const { premises } = item(run * 967 + 5);

        const degree = new Map<string, number>();
        for (const [a, , b] of premises) {
            degree.set(a, (degree.get(a) ?? 0) + 1);
            degree.set(b, (degree.get(b) ?? 0) + 1);
        }
        if ([...degree.values()].some(d => d >= 3)) branched++;
    }

    assert(branched > 25, `only ${branched} of 40 items branched at all`);
});

test("every quantifier gets used", () => {
    // Drawing "all" three times in four is what builds a nesting, but a mode
    // that only ever says "all" is a subset lattice, not set logic.
    const seen = new Set<SylKind>();

    for (let run = 0; run < 40; run++) {
        for (const [, kind] of item(run * 419 + 3).premises) seen.add(kind);
    }

    for (const kind of ["all", "no", "some", "some_not"] as SylKind[]) {
        assert(seen.has(kind), `${kind} never appeared in any premise`);
    }
});
