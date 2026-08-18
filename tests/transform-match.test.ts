/**
 * Transformation Matching — the mode that asks which relation is operating.
 *
 * Two properties matter more than anything about the wording.
 *
 * **One right answer.** The image identifies the map only if no other map in
 * the pool sends this structure to the same place, and a symmetric structure
 * breaks that — a shape symmetric about the origin is fixed by a half turn. So
 * every choice item is checked for a second correct option, which is the
 * failure that would make the mode quietly unanswerable rather than visibly
 * broken.
 *
 * **The answer is the arithmetic.** Generation and checking are one
 * computation, so the test re-does it independently: apply the named map to the
 * stated "before" and compare against the stated "after", parsed back out of
 * the rendered text.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createTransformMatch } from "../src/app/syllogimous/generators/transform-match";
import {
    Structure, applyMap, describeMap, distinguishing, mapPool, sameStructure, signature,
} from "../src/app/syllogimous/utils/gridmap.utils";

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
        syllogismGenerator: "canyon",
        hasRung: (_t: EnumQuestionType, r: string) => rungs.includes(r),
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** Read a rendered "Name (x, y), Name (x, y)" list back into a structure. */
function parse(line: string): Structure {
    const out: Structure = {};
    const plain = line.replace(/<[^>]+>/g, "").replace(/−/g, "-");
    /*
     * One word for the name. Allowing spaces made the pattern swallow whatever
     * came before it — "It ends at Armchair (1, 0)" parsed as a point named
     * "It ends at Armchair" — and the premises only escaped it because their
     * prefixes end in a colon, which the character class excludes.
     */
    const re = /([A-Za-z][A-Za-z']*)\s*\((-?\d+),\s*(-?\d+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plain))) out[m[1].trim()] = [Number(m[2]), Number(m[3])];
    return out;
}

test("a named map really does send before to after", () => {
    const ctx = context();
    let checked = 0;

    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 7717 + 11, () => createTransformMatch(ctx, 4));
        const before = parse(q.premises[0]);
        const after = parse(q.premises[1]);
        assert(Object.keys(before).length >= 2, `only ${Object.keys(before).length} points stated`);

        /*
         * Matched on the exact tail, not with `includes`. One description is a
         * prefix of another — "shift everything 1 west" sits inside "shift
         * everything 1 west and 1 north" — so a substring match picks the
         * shorter map and then reports the generator as wrong.
         */
        const named = String(q.conclusion).replace(/<[^>]+>/g, "");
        const stated = named.replace(/^The change from before to after is:\s*/, "");
        const map = mapPool().find(m => describeMap(m) === stated);
        if (!map) continue;

        const agrees = sameStructure(applyMap(before, map), after);
        assert(agrees === q.isValid,
            `the item says ${q.isValid} but applying "${describeMap(map)}" ${agrees ? "works" : "does not"}`);
        checked++;
    }

    assert(checked > 25, `only ${checked} verify items were checkable`);
});

test("a choice item never has two right answers", () => {
    for (const rung of ["identify", "apply"]) {
        const ctx = context([rung]);
        let seen = 0;

        for (let run = 0; run < 60; run++) {
            const q = seeded(run * 2213 + 5, () => createTransformMatch(ctx, 4));
            if (q.answerMode !== "choice") continue;

            const options = q.choices.map(c => c.replace(/<[^>]+>/g, ""));
            assert(new Set(options).size === options.length,
                `${rung}: an option was offered twice`);
            assert(q.correctChoice >= 0 && q.correctChoice < options.length,
                `${rung}: the right answer is not among the options`);

            if (rung === "identify") {
                // Every wrong option must actually act differently here, not
                // merely be worded differently.
                const before = parse(q.premises[0]);
                const after = parse(q.premises[1]);
                options.forEach((label, i) => {
                    const map = mapPool().find(m => describeMap(m) === label);
                    if (!map) return;
                    const works = sameStructure(applyMap(before, map), after);
                    assert(works === (i === q.correctChoice),
                        `${rung}: option "${label}" ${works ? "also works" : "should have worked"}`);
                });
            } else {
                const images = options.map(o => signature(parse(o)));
                assert(new Set(images).size === images.length,
                    "two options put the second set in the same place");
            }
            seen++;
        }

        assert(seen > 15, `${rung}: only ${seen} choice items appeared`);
    }
});

test("the structure is never one a second map also fixes", () => {
    const ctx = context();
    for (let run = 0; run < 40; run++) {
        const q = seeded(run * 991 + 17, () => createTransformMatch(ctx, 4));
        const before = parse(q.premises[0]);
        assert(distinguishing(before, mapPool()),
            "a symmetric structure got through, so the image does not identify the map");
    }
});

test("each rung adds a form rather than replacing one", () => {
    const forms = (rungs: string[]) => {
        const ctx = context(rungs);
        const kinds = new Set<string>();
        for (let run = 0; run < 40; run++) {
            const q = seeded(run * 613 + 29, () => createTransformMatch(ctx, 4));
            kinds.add(q.answerMode === "choice"
                ? (q.premises.length === 3 ? "apply" : "identify")
                : (q.premises.length === 4 ? "compose" : "verify"));
        }
        return kinds;
    };

    assert(forms([]).size === 1, "the base state offered more than verification");
    assert(forms(["identify"]).has("verify"), "unlocking a rung took verification away");
    assert(forms(["identify"]).size === 2, "the identify rung did not add its form");
    assert(forms(["identify", "apply", "compose"]).size === 4, "not every form appeared");
});

/**
 * Compose has to show both steps.
 *
 * The first version stated one step and then said "the same two changes are
 * applied again", which asked the reader to use a map the item had never shown
 * — unanswerable, and invisible to any test that only checks the arithmetic.
 * So this checks the arithmetic *and* that each step is recoverable from what
 * is on the page.
 */
test("a compose item shows both steps and lands where it says", () => {
    const ctx = context(["compose"]);
    let checked = 0;

    for (let run = 0; run < 80 && checked < 15; run++) {
        const q = seeded(run * 1493 + 23, () => createTransformMatch(ctx, 3));
        if (q.premises.length !== 4) continue;

        const start = parse(q.premises[0]);
        const half = parse(q.premises[1]);
        const end = parse(q.premises[2]);
        const other = parse(q.premises[3]);
        const claimed = parse(String(q.conclusion));

        // Each step is identifiable from the structures on the page.
        const first = mapPool().find(m => sameStructure(applyMap(start, m), half));
        const second = mapPool().find(m => sameStructure(applyMap(half, m), end));
        assert(!!first, "the first change cannot be worked out from the item");
        assert(!!second, "the second change cannot be worked out from the item");

        const landing = applyMap(applyMap(other, first!), second!);
        assert(sameStructure(landing, claimed) === q.isValid,
            `the item says ${q.isValid} but running both steps `
            + `${sameStructure(landing, claimed) ? "does" : "does not"} reach the stated position`);
        checked++;
    }

    assert(checked >= 15, `only ${checked} compose items were checkable`);
});

/**
 * Sequence induction: three terms, produce the fourth.
 *
 * Checked the way a reader would: work the step out from the first pair, apply
 * it to the third term, and see whether that is the option marked correct. And
 * separately, that the step is recoverable from *every* consecutive pair — a
 * reader works from whichever pair they look at, so an ambiguous later
 * transition gives the item an answer the item does not support. That is the
 * same trap as the compose form's halfway structure, which is where it was
 * first caught.
 */
test("a sequence extends by the step it actually shows", () => {
    const ctx = context(["sequence"]);
    let checked = 0;

    for (let run = 0; run < 90 && checked < 20; run++) {
        const q = seeded(run * 8191 + 13, () => createTransformMatch(ctx, 3));
        if (q.answerMode !== "choice" || !String(q.choicePrompt).includes("fourth")) continue;

        const terms = q.premises.map(parse);

        // Every consecutive pair names the same step, and names it uniquely.
        const steps = [0, 1].map(i =>
            mapPool().filter(m => sameStructure(applyMap(terms[i], m), terms[i + 1])));
        steps.forEach((matches, i) => {
            assert(matches.length === 1,
                `step ${i + 1} is satisfied by ${matches.length} maps, so it is not identified`);
        });
        assert(describeMap(steps[0][0]) === describeMap(steps[1][0]),
            "the two steps shown are different maps, so there is no sequence");

        const fourth = applyMap(terms[2], steps[0][0]);
        const marked = parse(q.choices[q.correctChoice]);
        assert(sameStructure(fourth, marked),
            "the option marked correct is not where the shown step leads");

        // And no other option is also where it leads.
        q.choices.forEach((c, i) => {
            if (i === q.correctChoice) return;
            assert(!sameStructure(parse(c), fourth), "a second option is also correct");
        });
        checked++;
    }

    assert(checked >= 20, `only ${checked} sequence items were checkable`);
});
