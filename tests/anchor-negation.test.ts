/**
 * Anchor Space — why its ladder still says `negation`.
 *
 * The mode declared the rung, `RUNG_COST` priced it at 0.6, Customise labelled
 * it "Negated premises", and `createAnchorSpace` never looked: no
 * `settings.enabled.negation`, no `modifierOn`, no `neg(`, and nothing in
 * `describeOffset` or `describeConclusion` that could have carried it. So the
 * rung was charged for on essentially every configuration and delivered the
 * plain item — the same defect Deictic Relations had, and see `deictic.test.ts`
 * for the case where the answer was to delete the rungs instead.
 *
 * Deleting was not the answer here, and the difference is worth stating because
 * the two look alike. A deictic item's premise count *is* its frame — `2^k + r`
 * is a bijection onto the (axes, reversals) pairs — so there was no third
 * quantity for a rung name to mean. An anchor item's premise count is its
 * object count, and how an offset is *worded* is not something a count decides.
 * The quantity existed; nothing was reading it.
 *
 * These tests are the two halves of that repair. The first is what an attempt
 * to unwire it again would break; the second is what a bad wiring would break —
 * a marked premise has to be recoverable, or the rung buys indeterminacy rather
 * than difficulty.
 */

import { assert, equal, seeded, test } from "./harness";
import { createAnchorSpace } from "../src/app/syllogimous/generators/anchor";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { Question } from "../src/app/syllogimous/models/question.models";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { SPATIAL_VOCAB } from "../src/app/syllogimous/utils/transformations.utils";
import { ANCHORS } from "../src/app/syllogimous/utils/anchor.utils";
import { ladderFor } from "../src/app/syllogimous/utils/progression.utils";
import { RUNG_COST } from "../src/app/syllogimous/utils/ability.utils";

const TYPE = EnumQuestionType.AnchorSpace;
const PARAMS = QUESTION_TYPE_SETTING_PARAMS[TYPE];

/* ------------------------------------------------------------------ *
 * Reading an item back                                                *
 * ------------------------------------------------------------------ */

/**
 * The cue survives stripping, because the cue is the whole point.
 *
 * `neg()` marks a word rather than inserting the word "not", so tearing the
 * markup off would erase exactly the thing under test — an inverted premise
 * would read as a plain one that happens to be false. The mark becomes a
 * character the parse below can see.
 */
const MARK = "¬";
const plain = (t: string) => t
    .replace(/<span class="is-negated">([^<]*)<\/span>/g, `${MARK}$1`)
    .replace(/<[^>]+>/g, "");

/** Axis and pole for every word the two-dimensional vocabulary can print. */
const POLES: Record<string, { axis: number; positive: boolean }> = {};
SPATIAL_VOCAB.axisWords.slice(0, 2).forEach(([pos, neg], axis) => {
    POLES[pos] = { axis, positive: true };
    POLES[neg] = { axis, positive: false };
});

const PREMISE = /^(.+?) is (.+) relative to (.+)$/;
const CLAUSE = new RegExp(`^(\\d+) (${MARK}?)(${Object.keys(POLES).join("|")})$`);

interface Clause { axis: number; magnitude: number; positive: boolean; inverted: boolean }
interface Stated { object: string; anchor: string; clauses: Clause[] }

/** One premise as what it claims, rather than as what it says. */
function readPremise(text: string): Stated {
    const line = plain(text);
    const m = PREMISE.exec(line);
    assert(!!m, `premise did not parse: ${line}`);
    const [, object, middle, anchor] = m!;

    const clauses = middle.split(" and ").map(part => {
        const c = CLAUSE.exec(part);
        assert(!!c, `clause did not parse: "${part}" in ${line}`);
        const [, magnitude, mark, word] = c!;
        return {
            axis: POLES[word].axis,
            magnitude: Number(magnitude),
            positive: POLES[word].positive,
            inverted: mark === MARK,
        };
    });

    return { object, anchor, clauses };
}

/** Coordinates as the parse sees them — anchors are glyphs once stripped. */
const coordsOf = (q: Question) => Object.fromEntries(
    Object.entries(q.wordCoordMap ?? {}).map(([k, v]) => [plain(k), v]));

/* ------------------------------------------------------------------ *
 * Contexts                                                            *
 * ------------------------------------------------------------------ */

/**
 * The four ways the rung can be answered, because the generator has to consult
 * all of them and `modifierOn` is what knows the order.
 *
 * `global` is the ladder's route: `applyTo` writes what the mode has earned
 * into `settings.enabled.negation`, scoped to the mode being built. `forced`
 * and `refused` are the per-mode Customise row, which wins over it in both
 * directions — a generator reading the flag directly would pass `forced` by
 * accident and fail `refused`, which is why both are here.
 */
type Mode = "off" | "global" | "forced" | "refused";

function context(mode: Mode): GeneratorContext {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
    settings.enabled.negation = mode === "global" || mode === "refused";

    const override = mode === "forced" ? true : mode === "refused" ? false : null;

    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100,
            rungOverride: (_type: string, rung: string) => rung === "negation" ? override : null,
            deepConclusions: true,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
            dialFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const ON: Mode[] = ["global", "forced"];
const OFF: Mode[] = ["off", "refused"];

/* ------------------------------------------------------------------ *
 * The rung reaches the item                                           *
 * ------------------------------------------------------------------ */

/**
 * Claiming it changes the item, and refusing it changes the item back.
 *
 * This is the assertion the mode could not make before: the rung was priced and
 * labelled and no item ever showed it. It fails if the generator stops reading
 * `negation`, and it fails if the generator reads the global flag without the
 * per-mode row on top of it.
 *
 * The counts are checked here rather than in a test of their own because they
 * are spent, not displayed: `itemDifficulty` charges `perModifier` for each and
 * the answer budget in `game.component` pays three seconds for each, so a count
 * that disagreed with the text would be handing out time for nothing.
 */
test("an anchor item shows the negation rung it was charged for", () => {
    for (let n = PARAMS.minNumOfPremises; n <= PARAMS.maxNumOfPremises; n++) {
        for (let run = 0; run < 12; run++) {
            for (const mode of ON) {
                const q = seeded(run * 7919 + n * 31, () => createAnchorSpace(context(mode), n));
                const stated = q.premises.map(readPremise);
                const invertedPremises = stated.filter(s => s.clauses.some(c => c.inverted));

                assert(invertedPremises.length > 0,
                    `${mode} at ${n} premises produced an item with no inverted premise —`
                    + ` the rung is priced at ${RUNG_COST["negation"]} and has to show up`);
                assert(invertedPremises.length < stated.length,
                    `${mode} at ${n} premises inverted every premise (${stated.length}) —`
                    + ` an item read entirely backwards can ignore the cue after the`
                    + ` first line, which is a different and easier exercise`);
                assert(invertedPremises.length <= Math.ceil(stated.length / 2),
                    `${mode} at ${n} premises inverted ${invertedPremises.length} of`
                    + ` ${stated.length}, past the half that renderPremises allows`);
                equal(q.negations, invertedPremises.length,
                    `${mode} at ${n} premises reported ${q.negations} negations and rendered`
                    + ` ${invertedPremises.length} — the budget pays three seconds each`);
            }

            for (const mode of OFF) {
                const q = seeded(run * 7919 + n * 31, () => createAnchorSpace(context(mode), n));
                const marks = q.premises.filter(p => plain(p).includes(MARK));

                equal(marks.length, 0,
                    `${mode} at ${n} premises still inverted ${marks.length} premises:`
                    + ` ${marks.map(plain).join(" / ")}`);
                equal(q.negations, 0, `${mode} at ${n} premises reported negations anyway`);
                assert(!plain(String(q.conclusion)).includes(MARK),
                    `${mode} at ${n} premises inverted the conclusion`);
            }
        }
    }

    /*
     * So the ladder may go on offering it. Asserted here rather than separately
     * for the reason the deictic test gives for doing the reverse: it is not an
     * independent fact, it is what the comparison above entitles the tables to
     * say, and splitting them is how the two come apart again.
     */
    assert(ladderFor(TYPE).includes("negation"),
        "the generator honours negation, so the ladder may not stop offering it");
    assert(typeof RUNG_COST["negation"] === "number",
        "a rung the generator reads has to carry a price");
});

/* ------------------------------------------------------------------ *
 * And what it shows is recoverable                                    *
 * ------------------------------------------------------------------ */

/**
 * An inverted premise still fixes the object, exactly where a plain one did.
 *
 * This is the whole soundness condition, and it is narrow. Negation is only
 * honest where the reader can get the truth back, which needs the axis to have
 * exactly two poles and the clause to have a non-zero magnitude — the same
 * condition `createLinear` checks when it refuses to negate under `overlap`,
 * where a third relation makes "not less than" leave two readings open. Here
 * the magnitude is printed plainly and only the pole word is marked, so a
 * marked clause names one displacement and not a half-plane.
 *
 * Checked against `wordCoordMap`, which is the map the item is scored from, so
 * "recoverable" means recoverable to the answer rather than to a restatement of
 * the text. Anchors are in there too, which is what makes the check possible:
 * the frame is stated, not assumed.
 */
test("an inverted anchor premise is the same fact, said the other way round", () => {
    let inverted = 0;
    let plainClauses = 0;

    for (let n = PARAMS.minNumOfPremises; n <= PARAMS.maxNumOfPremises; n++) {
        for (let run = 0; run < 12; run++) {
            const q = seeded(run * 104729 + n, () => createAnchorSpace(context("global"), n));
            const at = coordsOf(q);

            for (const premise of q.premises) {
                const { object, anchor, clauses } = readPremise(premise);

                assert(q.bucket.includes(object), `${object} is not one of the item's objects`);
                assert(!!at[anchor], `${anchor} is stated against but has no coordinate`);
                assert(clauses.length > 0,
                    `${object} was stated with no clause, so the cue has nowhere to land`);

                for (let axis = 0; axis < 2; axis++) {
                    const delta = at[object][axis] - at[anchor][axis];
                    const stated = clauses.filter(c => c.axis === axis);

                    if (delta === 0) {
                        equal(stated.length, 0,
                            `${object} is level with ${anchor} on axis ${axis} but the`
                            + ` premise names it — an inverted zero has no other pole`);
                        continue;
                    }

                    equal(stated.length, 1,
                        `${object} states axis ${axis} ${stated.length} times against ${anchor}`);
                    const c = stated[0];
                    equal(c.magnitude, Math.abs(delta),
                        `${object} is ${Math.abs(delta)} from ${anchor} on axis ${axis}`
                        + ` and the premise says ${c.magnitude}`);
                    equal(c.positive, c.inverted ? delta < 0 : delta > 0,
                        `${object} against ${anchor} on axis ${axis}:`
                        + ` ${c.inverted ? "inverting" : "reading"} the stated pole does not`
                        + ` give the offset the item is scored on`);

                    if (c.inverted) inverted++; else plainClauses++;
                }
            }
        }
    }

    // Both arms have to have been exercised, or the loop above proved nothing
    // about whichever one never came up.
    assert(inverted > 40, `only ${inverted} inverted clauses were checked`);
    assert(plainClauses > 40, `only ${plainClauses} plain clauses were checked`);
});

/**
 * The frame is not the only route between two things.
 *
 * Reported from play: *"Anchor space only creates relations directly involving
 * the anchors, not between other objects."* Every object was pinned straight to
 * an anchor, so every path between any two of them was the same two hops —
 * object to its anchor, anchor to anchor, anchor to object — and no premise
 * ever related two ordinary objects at all.
 *
 * An object may now be stated against an object already placed. The chain is
 * capped at two hops from an anchor: past that the frame stops being the point
 * and the item turns into the chain of offsets the composed spaces already are.
 */
test("some premises relate two ordinary objects", () => {
    const anchors = new Set(ANCHORS.map(a => a.token));
    let items = 0, withObjectPremise = 0, objectPremises = 0, total = 0;

    seeded(4242, () => {
        for (let rep = 0; rep < 120; rep++) {
            const q = createAnchorSpace(context("off"), 4 + (rep % 4));
            items++;
            let any = false;
            for (const premise of q.premises) {
                total++;
                if ([...anchors].some(a => premise.includes(a))) continue;
                objectPremises++;
                any = true;
            }
            if (any) withObjectPremise++;
        }
    });

    assert(withObjectPremise > items / 2,
        `only ${withObjectPremise} of ${items} items relate two objects to each other`);
    assert(objectPremises < total / 2,
        `${objectPremises} of ${total} premises skip the frame, which stops being a frame`);
});

/** A chain the reader has to compose is a chain the derivation has to walk. */
test("the derivation walks every hop back to the frame", () => {
    // The glyph, not the markup: the steps are compared after stripping tags.
    const anchors = new Set(ANCHORS.map(a => a.token.replace(/<[^>]*>/g, "")));

    seeded(99, () => {
        for (let rep = 0; rep < 120; rep++) {
            const q = createAnchorSpace(context("off"), 5);
            const strip = (t: string) => t.replace(/<[^>]*>/g, "");
            const steps = q.explanation.map(strip);

            // Whatever the conclusion names, the derivation reaches an anchor:
            // an offset chain explained only from its last hop explains the
            // easy half of exactly the items the chaining made hard.
            assert(steps.some(s => [...anchors].some(a => s.includes(a))),
                `a derivation never reached the frame:\n${steps.join("\n")}`);
        }
    });
});
