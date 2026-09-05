/**
 * Testimony checkable against stated fact — the two-conclusion form.
 *
 * The `speakers` rung leaves a knave's report worthless *and* unidentifiable
 * from the arrangement: who lied comes only from what the speakers say about
 * each other. Here a few relations are stated plainly and are simply true, and
 * some reports are about pairs those facts already settle — so a report can be
 * checked, and a contradiction names a knave directly.
 *
 * That gives the item its shape, and the shape is what these tests hold to: a
 * checkable report pins one speaker, their claims pin the rest, and only then
 * can the extending reports be sorted into usable and worthless. The relational
 * answer lives out there, so it cannot be reached until the liars are known.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNdSpace } from "../src/app/syllogimous/generators/ndspace";
import { Claim, solve } from "../src/app/syllogimous/utils/knaves.utils";

function context(): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
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
        hasRung: (_t: EnumQuestionType, r: string) => r === "testimony",
        dialFor: () => 0,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "");

function item(seed: number) {
    return seeded(seed, () => createNdSpace(context(), 7, EnumQuestionType.Space3D));
}

/** Speaker statements, split into claims about people and reports about places. */
function testimony(premises: string[]) {
    const said = premises
        .map(strip)
        .map(p => /^(.+?) says: (.+)$/.exec(p))
        .filter((m): m is RegExpExecArray => !!m);

    const aboutPeople = said.filter(m => /\b(knight|knave|kind|kinds)\b/.test(m[2]));
    const aboutPlaces = said.filter(m => !/\b(knight|knave|kind|kinds)\b/.test(m[2]));
    const plain = premises.map(strip).filter(p => !/ says: /.test(p));

    return { said, aboutPeople, aboutPlaces, plain };
}

test("the item states facts outright as well as reporting them", () => {
    /*
     * The whole premise of the form. With nothing stated plainly there is
     * nothing to check a report against, and it collapses into `speakers`.
     */
    for (let run = 0; run < 25; run++) {
        const { plain, aboutPlaces, aboutPeople } = testimony(item(run * 6673 + 3).premises);

        assert(plain.length >= 2, `only ${plain.length} facts were stated outright`);
        assert(aboutPlaces.length >= 2, `only ${aboutPlaces.length} reports about the arrangement`);
        assert(aboutPeople.length >= 2, `only ${aboutPeople.length} claims about people`);
    }
});

test("both answers are asked for, and each can be the wrong one", () => {
    let allTrue = 0, typesWrong = 0, relationWrong = 0;

    for (let run = 0; run < 60; run++) {
        const q = item(run * 1979 + 13);

        assert(Array.isArray(q.conclusion), "the item asked for a single conclusion");
        const claims = (q.conclusion as string[]).map(strip);
        assert(claims.length === 2, `${claims.length} conclusions, expected two`);
        assert(/knight|knave/.test(claims[0]), `the first claim is not about people: ${claims[0]}`);
        assert(!/knight|knave/.test(claims[1]), `the second claim is not about places: ${claims[1]}`);

        // Which half is wrong is readable from the derivation, which states the
        // one reading that fits.
        const reading = q.explanation.find(l => l.includes("leave one reading"));
        assert(!!reading, "the derivation never says who is what");

        const stated = [...claims[0].matchAll(/(\S+) is a (knight|knave)/g)]
            .map(m => `${m[1]} a ${m[2]}`);
        const typesRight = stated.every(s => strip(reading!).includes(s));

        if (q.isValid) {
            assert(typesRight, "a true item stated the types wrongly");
            allTrue++;
        } else if (!typesRight) {
            typesWrong++;
        } else {
            relationWrong++;
        }
    }

    assert(allTrue > 12, `only ${allTrue} of 60 items were true`);
    assert(typesWrong > 5 && relationWrong > 5,
        `${typesWrong} wrong on people and ${relationWrong} on places —`
        + " either half has to be able to be the culprit");
});

test("the people-claims plus the checkable reports leave exactly one reading", () => {
    /*
     * Solved from what the player can see. The inter-speaker claims alone
     * usually admit several readings; it is the checkable reports that cut it
     * to one, which is the step this form adds.
     */
    for (let run = 0; run < 25; run++) {
        const q = item(run * 421 + 29);
        const { aboutPeople } = testimony(q.premises);

        const speakers = [...new Set(testimony(q.premises).said.map(m => m[1]))].sort();
        const idx = (n: string) => speakers.indexOf(n);

        const claims: Claim[] = [];
        for (const m of aboutPeople) {
            const who = idx(m[1]);
            const said = m[2];
            let c: Claim | null = null;
            let g: RegExpExecArray | null;

            if ((g = /^I am a (knight|knave)$/.exec(said))) c = { kind: "is", who, knight: g[1] === "knight" };
            else if ((g = /^(.+) and (.+) are the same kind$/.exec(said))) c = { kind: "same", a: idx(g[1]), b: idx(g[2]) };
            else if ((g = /^(.+) and (.+) are different kinds$/.exec(said))) c = { kind: "differ", a: idx(g[1]), b: idx(g[2]) };
            else if ((g = /^(.+) is a (knight|knave)$/.exec(said))) c = { kind: "is", who: idx(g[1]), knight: g[2] === "knight" };

            assert(!!c, `could not read: ${said}`);
            claims[who] = c!;
        }

        assert(claims.filter(Boolean).length === speakers.length,
            "not every speaker said something about the others");

        // Consistent with what they say about each other, and with the reading
        // the item settled on — which must be one of them.
        const solutions = solve(claims);
        assert(solutions.length >= 1, "no reading fits what they say about each other");

        const reading = strip(q.explanation.find(l => l.includes("leave one reading"))!);
        const settled = speakers.map(n => reading.includes(`${n} a knight`));
        assert(solutions.some(s => s.every((v, i) => v === settled[i])),
            "the reading the item settled on contradicts the speakers' own claims");
    }
});

test("no derivation routes through a report it just called false", () => {
    /*
     * The bug this form found, and it was not confined to it: the path search
     * walked the layout's neighbours regardless of whether a relation had been
     * withheld or discredited. The arithmetic came out right and the proof went
     * through a premise the item had just said was false — worse than showing
     * nothing, and invisible to any check on the answer alone.
     */
    for (let run = 0; run < 30; run++) {
        const q = item(run * 3391 + 7);
        const { aboutPlaces } = testimony(q.premises);

        const liars = q.explanation
            .filter(l => l.includes("is false and tells you nothing"))
            .flatMap(l => [...strip(l).matchAll(/what (.+?) said/g)].map(m => m[1]))
            .flatMap(names => names.split(/ and |, /))
            .map(n => n.trim())
            .filter(Boolean);

        if (!liars.length) continue;

        // Every pair a liar reported on, as stated.
        const discredited = aboutPlaces
            .filter(m => liars.includes(m[1]))
            .map(m => {
                const g = /^(.+?) is .+ relative to (.+)$/.exec(m[2]);
                return g ? [g[1], g[2]].sort().join("|") : null;
            })
            .filter((p): p is string => !!p);

        const walked = q.explanation
            .filter(l => l.includes("running total"))
            .map(l => /^(.+?) is .+ relative to (.+?) —/.exec(strip(l)))
            .filter((m): m is RegExpExecArray => !!m)
            .map(m => [m[1], m[2]].sort().join("|"));

        for (const step of walked) {
            assert(!discredited.includes(step),
                `the derivation used ${step.replace("|", " and ")}, which a knave reported`);
        }
    }
});
