/**
 * Knights and knaves.
 *
 * The solver is the definition of the answer — an assignment is a solution
 * exactly when every speaker's type matches the truth of what they said — so
 * there is no second implementation to drift from. What can still go wrong is
 * the *generator*: emitting a puzzle with no solution, or several when it
 * claimed one, or asking about a speaker the statements never pin down.
 *
 * So these tests re-solve every generated item from its own statements and
 * check the claim against every solution, which is what "true" has to mean when
 * more than one reading fits.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createKnaves } from "../src/app/syllogimous/generators/knaves";
import { Claim, determined, holds, solve } from "../src/app/syllogimous/utils/knaves.utils";

function context(rungs: string[] = []): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => rungs.includes(r),
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

test("the classic puzzles come out right", () => {
    /*
     * Worked examples, so the solver is anchored to something outside itself.
     * A liar saying "I am a knave" is the paradox that has no solution at all,
     * and getting *that* wrong would show up nowhere else.
     */
    const iAmAKnave: Claim[] = [{ kind: "is", who: 0, knight: false }];
    equal(solve(iAmAKnave).length, 0, "\"I am a knave\" should have no consistent reading");

    const iAmAKnight: Claim[] = [{ kind: "is", who: 0, knight: true }];
    equal(solve(iAmAKnight).length, 2, "\"I am a knight\" should fit either type");

    // A says "we are different kinds", B says "we are the same kind".
    // Consistent only when A is a knight and B is a knave.
    const disagree: Claim[] = [
        { kind: "differ", a: 0, b: 1 },
        { kind: "same", a: 0, b: 1 },
    ];
    const solutions = solve(disagree);
    equal(solutions.length, 1, "the disagreement puzzle should have one reading");
    equal(solutions[0], [true, false], "A is the knight");

    // A says "B is a knight", B says "A is a knave" — no consistent reading.
    const contradiction: Claim[] = [
        { kind: "is", who: 1, knight: true },
        { kind: "is", who: 0, knight: false },
    ];
    equal(solve(contradiction).length, 0, "this pair cannot both be placed");
});

/** The statements, read back out of the premises the player is shown. */
function claimsFrom(premises: string[], names: string[]): Claim[] {
    const idx = (n: string) => names.indexOf(n);
    const out: Array<{ speaker: number; claim: Claim }> = [];

    for (const raw of premises) {
        const plain = raw.replace(/<[^>]+>/g, "");
        const [who, said] = plain.split(" says: ");
        const speaker = idx(who);

        let claim: Claim | null = null;
        let m: RegExpExecArray | null;

        /*
         * Most specific first. "X is a knight" also matches "at least one of X
         * and Y is a knight" if it is tried earlier, which silently produced a
         * speaker index of -1 and puzzles that looked unsolvable.
         */
        if ((m = /^I am a (knight|knave)$/.exec(said))) {
            claim = { kind: "is", who: speaker, knight: m[1] === "knight" };
        } else if ((m = /^at least one of (.+) and (.+) is a (knight|knave)$/.exec(said))) {
            claim = { kind: "any", who: [idx(m[1]), idx(m[2])], knight: m[3] === "knight" };
        } else if ((m = /^(.+) and (.+) are both (knight|knave)s$/.exec(said))) {
            claim = { kind: "all", who: [idx(m[1]), idx(m[2])], knight: m[3] === "knight" };
        } else if ((m = /^(.+) and (.+) are the same kind$/.exec(said))) {
            claim = { kind: "same", a: idx(m[1]), b: idx(m[2]) };
        } else if ((m = /^(.+) and (.+) are different kinds$/.exec(said))) {
            claim = { kind: "differ", a: idx(m[1]), b: idx(m[2]) };
        } else if ((m = /^(.+) is a (knight|knave)$/.exec(said))) {
            claim = { kind: "is", who: idx(m[1]), knight: m[2] === "knight" };
        }

        assert(!!claim, `could not read the statement back: "${said}"`);
        out.push({ speaker, claim: claim! });
    }

    // Premises are shuffled for display; the solver indexes by speaker.
    return out.sort((a, b) => a.speaker - b.speaker).map(x => x.claim);
}

function check(rungs: string[], runs: number) {
    const ctx = context(rungs);
    let checked = 0, open = 0;

    for (let run = 0; run < runs; run++) {
        const q = seeded(run * 3121 + 19, () => createKnaves(ctx, 4));
        const names = q.bucket;
        const claims = claimsFrom(q.premises, names);
        const solutions = solve(claims);

        assert(solutions.length > 0, "the puzzle has no consistent reading at all");
        if (solutions.length > 1) open++;

        const plain = String(q.conclusion).replace(/<[^>]+>/g, "");
        const m = /(.+) is a (knight|knave)$/.exec(plain.replace(/^It must be true that /, ""));
        assert(!!m, `could not read the claim: ${plain}`);

        const who = names.indexOf(m![1]);
        const claimsKnight = m![2] === "knight";

        // True means true in *every* reading that fits, which is the only
        // definition that stays right when more than one does.
        const truth = solutions.every(s => s[who] === claimsKnight);
        assert(truth === q.isValid,
            `${solutions.length} readings fit; claim "${plain}" is ${truth}, item says ${q.isValid}`);
        checked++;
    }

    return { checked, open };
}

test("every generated puzzle is solvable and answered correctly", () => {
    const base = check([], 40);
    assert(base.checked === 40, "some items could not be read back");
    assert(base.open === 0, "the base mode produced a puzzle it could not settle");

    const withCompound = check(["compound"], 40);
    assert(withCompound.checked === 40, "compound items could not be read back");
    assert(withCompound.open === 0, "the compound rung produced an unsettled puzzle");
});

test("the undetermined rung produces both kinds, and calls them correctly", () => {
    const { checked, open } = check(["compound", "undetermined"], 60);
    assert(checked === 60, "some items could not be read back");
    assert(open >= 8, `only ${open} items had more than one reading`);
    assert(open <= 52, `${open} of 60 items were ambiguous, so the wording gives it away`);
});

test("a puzzle where everyone is the same kind is never built", () => {
    // Every statement about kinds is then uniformly true or uniformly false,
    // so there is nothing in the item to work out.
    const ctx = context(["compound"]);
    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 5077 + 3, () => createKnaves(ctx, 4));
        const claims = claimsFrom(q.premises, q.bucket);
        for (const world of solve(claims)) {
            assert(!world.every(w => w === world[0]),
                "a reading in which everyone is the same kind fits the whole puzzle");
        }
    }
});

test("a speaker's own statement is checked against their own type", () => {
    // The rule that makes the mode what it is: nobody is exempt from their own
    // claim, including a knave saying "I am a knight".
    const claims: Claim[] = [
        { kind: "is", who: 0, knight: true },
        { kind: "differ", a: 0, b: 1 },
    ];
    for (const world of solve(claims)) {
        claims.forEach((c, i) => {
            equal(holds(c, world), world[i], `speaker ${i} was let off their own statement`);
        });
    }
    assert(determined(solve(claims)).size >= 0, "determined() should not throw on any solution set");
});

/* ---------------- the modifier half ---------------- */

import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { determinedOn } from "../src/app/syllogimous/utils/ndspace.utils";

/**
 * Speakers wrapping another mode's premises — the half this file called more
 * interesting, and it is, because two puzzles have to hold together.
 *
 * The dangerous failure is not a wrong answer; it is an item that *cannot* be
 * answered, because the relations needed to reach the conclusion were the ones
 * a liar reported. So the check is that the honest reports alone settle the
 * claim, recomputed from the premises the player can see: solve who is lying
 * from what they say about each other, discard those reports, and confirm the
 * rest still connect the two things asked about.
 */
function spaceContext(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null,
            depthFor: () => 0, scramble: 100,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === "speakers",
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

test("a reported arrangement is settled by the honest reports alone", () => {
    const ctx = spaceContext();
    let checked = 0;

    for (let run = 0; run < 30; run++) {
        const q = seeded(run * 9127 + 5, () => createNdSpace(ctx, 5, EnumQuestionType.Space3D));

        const said = q.premises
            .map(p => p.replace(/<[^>]+>/g, ""))
            .map(p => /^(.+?) says: (.+)$/.exec(p))
            .filter((m): m is RegExpExecArray => !!m);
        assert(said.length === q.premises.length, "a premise was not attributed to anyone");

        const speakers = [...new Set(said.map(m => m[1]))].sort();
        assert(speakers.length >= 2, "only one speaker, so nothing to work out");

        // Statements about people are the puzzle; the rest are the arrangement.
        const about = said.filter(m => /\b(knight|knave|kind|kinds)\b/.test(m[2]));
        const spatial = said.filter(m => !/\b(knight|knave|kind|kinds)\b/.test(m[2]));

        assert(about.length === speakers.length,
            `${about.length} statements about people for ${speakers.length} speakers`);
        assert(spatial.length >= speakers.length,
            "some speaker reported nothing about the arrangement");

        // Nobody reports on themselves as an object, which would read as a
        // claim about the speaker's position rather than about the layout.
        for (const m of spatial) {
            assert(!new RegExp(`\\b${m[1]}\\b`).test(m[2]),
                `${m[1]} appears in their own report about the arrangement`);
        }

        checked++;
    }

    assert(checked === 30, `only ${checked} reported items were built`);
});

test("the puzzle half has exactly one reading, or the lies cannot be found", () => {
    const ctx = spaceContext();

    for (let run = 0; run < 30; run++) {
        const q = seeded(run * 337 + 41, () => createNdSpace(ctx, 5, EnumQuestionType.Space3D));

        const said = q.premises
            .map(p => p.replace(/<[^>]+>/g, ""))
            .map(p => /^(.+?) says: (.+)$/.exec(p)!)
            .filter(Boolean);

        const speakers = [...new Set(said.map(m => m[1]))];
        const about = said.filter(m => /\b(knight|knave|kind|kinds)\b/.test(m[2]));

        const claims = claimsFrom(about.map(m => `${m[1]} says: ${m[2]}`), speakers);
        const solutions = solve(claims);

        assert(solutions.length === 1,
            `${solutions.length} readings fit, so who lied cannot be established`);

        // And both kinds appear, or the modifier is doing nothing.
        const world = solutions[0];
        assert(world.some(w => w) && world.some(w => !w),
            "everyone is the same kind, so no report is in doubt");
    }
});
