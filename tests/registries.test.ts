/**
 * The registries have to agree with each other.
 *
 * This app keeps the same facts in several places on purpose — a mode's
 * settings, its column in the tier matrix, its ladder, its rung prices, its
 * modifier labels. The arrangement is fine; what is missing is anything that
 * notices when one of them drifts, because `tsc` cannot: the tier matrix is a
 * positional tuple whose width is all that is checked, a rung is a string, and
 * a generator that never reads a rung compiles perfectly.
 *
 * Three real instances turned up in a single afternoon, none of them visible to
 * any existing test:
 *
 *   - Deictic's `extra-reversal` and `third-axis` were priced in the cost
 *     table and labelled in the settings UI, and the generator never read
 *     either. Climbing that ladder cost ability and changed nothing.
 *   - Oddest Relation was turned off in the settings params and still offered
 *     at twenty tiers, so a fresh install would have lost it while every
 *     existing account kept it.
 *   - Two syllogism generators shared a mode and only one had a derivation, so
 *     half of every player's syllogisms explained nothing — invisible to a
 *     coverage test over the *mode*, which did explain itself on the other runs.
 *
 * Each was found by hand. This file is the general form: assert the agreements
 * rather than the instances, so the next drift fails a test instead of shipping.
 *
 * **Everything here is checked dynamically wherever it can be.** A static scan
 * for `hasRung("foo")` would pass on a call that is unreachable, and this is a
 * file about things that look right and are not.
 */

import { assert, equal, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { ORDERED_QUESTION_TYPES, TIERS_MATRIX } from "../src/app/syllogimous/constants/game.constants";
import {
    OFF_LADDER_RUNGS, RUNG_LADDERS, ladderFor, offLadderFor, settableRungsFor,
} from "../src/app/syllogimous/utils/progression.utils";
import { RUNG_COST, RUNG_MIN_PREMISES } from "../src/app/syllogimous/utils/ability.utils";
import { TypeBasedStats } from "../src/app/syllogimous/models/stats.models";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";

/**
 * A tombstone holds a ladder slot without meaning anything.
 *
 * Rungs are read by position out of a stored count, so deleting one renames
 * every rung after it for everyone who already earned them. `retired-*` is the
 * convention for a slot that is kept and means nothing, and it is the one thing
 * here that is *meant* to match no `hasRung` call.
 */
const isTombstone = (rung: string) => rung.startsWith("retired-");

/**
 * The two rungs with no ask to observe.
 *
 * `negation` and `meta` predate the per-mode rung rows and are still global
 * flags: progression narrows `settings.enabled.*` to the type in flight before
 * the generator runs, so a generator that honours them perfectly reads a
 * boolean off its settings and asks nobody anything. There is no seam to watch,
 * and pretending otherwise would make the seam check report a fault every time
 * a mode did the right thing.
 *
 * They are covered behaviourally instead, below — which is the better check
 * anyway, and the only reason it is not used for everything is that most rungs
 * change an item in ways no test can recognise from the outside.
 */
const GLOBAL_FLAGS = new Set(["negation", "meta"]);

/**
 * Every rung a mode has, earnable or not.
 *
 * Off-ladder rungs are real rungs — priced, read by the generator, settable in
 * Customise — and the only thing they lack is a position progression can reach.
 * A pricing check that ignored them would report the price as stale.
 */
const declaredRungs = new Set([
    ...Object.values(RUNG_LADDERS).flat(),
    ...Object.values(OFF_LADDER_RUNGS).flat(),
]);

/* ------------------------------------------------------------------ *
 * The five-registry hazard, asserted                                  *
 * ------------------------------------------------------------------ */

/**
 * Adding a question type touches five registries, and missing one breaks the
 * app at runtime in a way the compiler cannot see. The ROADMAP names them and
 * warns a human; this checks them.
 *
 * The `Settings` constructor is the one worth reading twice. Its explicit
 * `initQuestionSettings` list is what blanks the whole app when a type is
 * missing from it — not a mode that fails to appear, the *whole app* — and it
 * is a list of calls rather than a loop over the enum, so nothing else can
 * notice.
 */
test("every question type is in every registry that has to know about it", () => {
    const settings = new Settings();
    // Hand-written one field per mode, like the Settings init list, so it can
    // silently miss one the same way.
    const stats = new TypeBasedStats();

    for (const type of Object.values(EnumQuestionType)) {
        assert(ORDERED_QUESTION_TYPES.includes(type),
            `${type} is missing from ORDERED_QUESTION_TYPES`);
        assert(!!QUESTION_TYPE_SETTING_PARAMS[type],
            `${type} has no entry in QUESTION_TYPE_SETTING_PARAMS`);
        assert(!!settings.question[type],
            `${type} is missing from the Settings constructor's init list —`
            + " this is the one that blanks the whole app");
        assert(!!BUILD[type],
            `${type} has no generator in the test sweep, so nothing ever builds it`);
        assert(!!(stats as unknown as Record<string, unknown>)[type],
            `${type} has no field on TypeBasedStats, so nothing counts it`);
    }

    equal(ORDERED_QUESTION_TYPES.length, Object.values(EnumQuestionType).length,
        "ORDERED_QUESTION_TYPES and the enum are different lengths, so one"
        + " carries a type the other does not");
});

/**
 * The tier matrix is positional, so its width is the only thing `tsc` sees.
 *
 * A row of the right length in the wrong order compiles and is silently wrong;
 * a row of the wrong length is the failure this catches, and it is what
 * inserting a mode without widening every row produces.
 */
test("every tier row has one column per mode", () => {
    for (const [tier, row] of Object.entries(TIERS_MATRIX)) {
        equal(row.length, ORDERED_QUESTION_TYPES.length,
            `tier ${tier} has ${row.length} columns for`
            + ` ${ORDERED_QUESTION_TYPES.length} modes`);
        for (const [i, cell] of row.entries()) {
            assert(cell === 0 || cell === 1,
                `tier ${tier} column ${i} (${ORDERED_QUESTION_TYPES[i]}) is ${cell}`);
        }
    }
});

/** A mode nobody can ever reach is a mode that was retired by accident. */
test("every mode a fresh install enables is offered at some tier", () => {
    for (const [i, type] of ORDERED_QUESTION_TYPES.entries()) {
        if (!QUESTION_TYPE_SETTING_PARAMS[type].enabled) continue;   // retired on purpose
        assert(Object.values(TIERS_MATRIX).some(row => row[i] === 1),
            `${type} is on for a fresh install and offered at no tier`);
    }
});

/* ------------------------------------------------------------------ *
 * Rungs                                                               *
 * ------------------------------------------------------------------ */

/**
 * A price for a rung nobody has is a number that can never be charged, and a
 * rung with no price is charged the fallback silently — `RUNG_COST[r] ?? 0.8`
 * in `levelOf`, which is a guess wearing the appearance of a table entry.
 */
test("every priced rung is one some ladder actually offers", () => {
    for (const rung of Object.keys(RUNG_COST)) {
        assert(declaredRungs.has(rung),
            `${rung} is priced but appears on no ladder`);
    }
    for (const rung of Object.keys(RUNG_MIN_PREMISES)) {
        assert(declaredRungs.has(rung),
            `${rung} has a premise floor but appears on no ladder`);
    }
});

/**
 * A rung the generator never reads.
 *
 * This is the Deictic case, and it is the reason the check is dynamic: the two
 * rungs were declared, priced and labelled, and the only thing missing was a
 * call.
 *
 * **A generator asks about a rung through one of three seams**, and a check
 * that watched only the obvious one reported thirty-four false positives on its
 * first run:
 *
 *   - `ctx.hasRung`, which most of them use;
 *   - `rungOverride`, which `modifierOn` goes through — negation and meta have
 *     a global Customise switch predating the per-mode rows, so they are asked
 *     for per-mode first and fall through to the flag that already knows;
 *   - `depthBonusFor`, which `extraTransforms` uses to *count* the
 *     `transform-depth-*` rungs rather than ask about them one at a time.
 *
 * All three are recorded. Watching one and calling the others dead would be the
 * same mistake this file exists to catch, pointed the other way.
 *
 * **The sweep runs ladder prefixes, not every rung at once**, which is both how
 * rungs are actually granted and the only way to see a rung behind a
 * short-circuit. `has("groups-3") ? 3 : has("groups-2") ? 2 : 1` never asks
 * about `groups-2` when `groups-3` is on, and with everything on that is every
 * run — three more false positives, all of them rungs that are read perfectly
 * well by the players who have them.
 *
 * Failing here means one of two things and both want fixing: the generator
 * should read the rung, or the ladder should stop offering it.
 */
test("every rung a ladder offers is one its generator reads", () => {
    const unread: string[] = [];

    for (const type of ORDERED_QUESTION_TYPES) {
        const ladder = settableRungsFor(type)
            .filter(r => !isTombstone(r) && !GLOBAL_FLAGS.has(r));
        if (!ladder.length || !BUILD[type]) continue;

        const asked = new Set<string>();
        const params = QUESTION_TYPE_SETTING_PARAMS[type];
        // Min, middle and max: enough to reach the branches a premise count
        // opens without generating the whole range for every prefix.
        const lengths = [...new Set([
            params.minNumOfPremises,
            Math.floor((params.minNumOfPremises + params.maxNumOfPremises) / 2),
            params.maxNumOfPremises,
        ])];

        const full = ladderFor(type);
        const off = offLadderFor(type);
        // Prefixes of the ladder, and then each off-ladder rung on its own —
        // which is how one is actually reached, since nothing grants it.
        const holdings = [
            ...full.map((_, i) => full.slice(0, i + 1)),
            ...off.map(r => [r]),
        ];
        for (const [prefix, holding] of holdings.entries()) {
            const held = new Set(holding);

            const settings = new Settings();
            for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
            settings.setEnable("negation", held.has("negation"));
            settings.setEnable("meta", held.has("meta"));

            const see = (rung: string) => { asked.add(rung); return held.has(rung); };

            const ctx: GeneratorContext = {
                settings,
                logger: new Logger("error", false),
                settingsOverrideService: {
                    linearOverride: () => null, axesFor: () => null, circularAxes: () => null,
                    spread: () => null, scramble: 100,
                    // `modifierOn` asks here first; null is "no opinion, use the
                    // global flag", which is what an unconfigured account gives.
                    rungOverride: (_t: string, rung: string) => { see(rung); return null; },
                    // `extraTransforms` counts rather than asks, so what it
                    // consumes is recorded on its behalf.
                    depthFor: () => 0,
                } as unknown as SettingsOverrideService,
                progressionService: {
                    hasRung: see,
                    depthBonusFor: () => {
                        for (const r of full) if (r.startsWith("transform-depth")) asked.add(r);
                        return full.filter(r => r.startsWith("transform-depth") && held.has(r)).length;
                    },
                } as unknown as ProgressionService,
                forceConstruction: "off",
                hasRung: (_t: string, rung: string) => see(rung),
                random: (n?: number) => createDistinction(ctx, n ?? 2),
            };

            seeded(20260824 + prefix, () => {
                for (const n of lengths) {
                    for (let rep = 0; rep < 4; rep++) {
                        try { BUILD[type](ctx, n); } catch { /* a draw that could not be built */ }
                    }
                }
            });
        }

        for (const rung of ladder) {
            if (!asked.has(rung)) unread.push(`${type} / ${rung}`);
        }
    }

    assert(unread.length === 0,
        `${unread.length} rungs are offered, priced and never read:\n  `
        + unread.join("\n  "));
});

/* ------------------------------------------------------------------ *
 * Derivations                                                         *
 * ------------------------------------------------------------------ */

/**
 * A mode that explains itself at one length and not another.
 *
 * The syllogism case: a two-step chain has no intermediate conclusions, so the
 * derivation that walked them produced one line for the commonest item in the
 * mode. A coverage sweep at a single premise count cannot see that, and the one
 * that existed swept generators instead — which hid it a second way.
 *
 * So the sweep is over *lengths*, and it is a floor on the derivation rather
 * than a check that one exists: two lines, because one line is the shape the
 * failure took and it was a restatement of the conclusion.
 *
 * Modes with no derivation at all are listed rather than asserted. Coverage is
 * [3](../fixes/3-explanations.md)'s business and finishing it is a separate
 * job; what this owns is a mode that explains itself *unevenly*, which is the
 * failure that hides.
 */
test("a mode that explains itself does so at every length", () => {
    const uneven: string[] = [];

    for (const type of ORDERED_QUESTION_TYPES) {
        if (!BUILD[type]) continue;
        const params = QUESTION_TYPE_SETTING_PARAMS[type];

        const settings = new Settings();
        for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
        const ctx: GeneratorContext = {
            settings,
            logger: new Logger("error", false),
            settingsOverrideService: {
                linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
                spread: () => null, depthFor: () => 0, scramble: 100,
            } as unknown as SettingsOverrideService,
            progressionService: {
                hasRung: () => false, depthBonusFor: () => 0,
            } as unknown as ProgressionService,
            forceConstruction: "off",
            hasRung: () => false,
            random: (n?: number) => createDistinction(ctx, n ?? 2),
        };

        const byLength = new Map<number, { built: number; thin: number }>();

        seeded(31415, () => {
            for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
                const row = { built: 0, thin: 0 };
                for (let rep = 0; rep < 12; rep++) {
                    let q;
                    try { q = BUILD[type](ctx, n); } catch { continue; }
                    row.built++;
                    if (q.explanation.length < 2) row.thin++;
                }
                if (row.built) byLength.set(n, row);
            }
        });

        const lengths = [...byLength.entries()];
        if (!lengths.length) continue;

        // Explains itself somewhere, so it is a mode with a derivation.
        const explainsSomewhere = lengths.some(([, r]) => r.thin < r.built);
        if (!explainsSomewhere) continue;   // no derivation at all — section 3's job

        for (const [n, row] of lengths) {
            if (row.thin === row.built) {
                uneven.push(`${type} at ${n} premises: ${row.built} items, none explained`);
            }
        }
    }

    assert(uneven.length === 0,
        `${uneven.length} lengths explain nothing in a mode that otherwise does:\n  `
        + uneven.join("\n  "));
});

/**
 * The two rungs the seam check cannot see, checked by what they do.
 *
 * Negation renders a relation as the struck-through form of its opposite —
 * "is not above" for "is below" — and that mark is what a reader has to undo.
 * So it is visible in the output, which makes the behavioural check possible
 * here and nowhere else: switch it off and no item carries the mark; switch it
 * on and some do.
 *
 * Asserted per mode that offers the rung, because "some mode somewhere negates"
 * is exactly the coverage that hid a broken generator behind a working one.
 */
test("a mode that offers negation actually negates", () => {
    const silent: string[] = [];

    for (const type of ORDERED_QUESTION_TYPES) {
        if (!ladderFor(type).includes("negation") || !BUILD[type]) continue;
        const params = QUESTION_TYPE_SETTING_PARAMS[type];

        const build = (negation: boolean) => {
            const settings = new Settings();
            for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;
            settings.setEnable("negation", negation);
            settings.setEnable("meta", false);

            const ctx: GeneratorContext = {
                settings,
                logger: new Logger("error", false),
                settingsOverrideService: {
                    linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
                    spread: () => null, depthFor: () => 0, scramble: 100,
                    rungOverride: () => null,
                } as unknown as SettingsOverrideService,
                progressionService: {
                    hasRung: () => false, depthBonusFor: () => 0,
                } as unknown as ProgressionService,
                forceConstruction: "off",
                hasRung: () => false,
                random: (n?: number) => createDistinction(ctx, n ?? 2),
            };

            let marked = 0, built = 0;
            seeded(90909, () => {
                for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
                    for (let rep = 0; rep < 10; rep++) {
                        let q;
                        try { q = BUILD[type](ctx, n); } catch { continue; }
                        built++;
                        const text = [...q.premises, String(q.conclusion ?? "")].join(" ");
                        if (text.includes("is-negated")) marked++;
                    }
                }
            });
            return { marked, built };
        };

        const off = build(false);
        const on = build(true);
        if (!on.built) continue;

        equal(off.marked, 0,
            `${type} negated ${off.marked} items with negation switched off`);
        if (on.marked === 0) silent.push(type);
    }

    assert(silent.length === 0,
        `${silent.length} modes offer negation and never negate:\n  ` + silent.join("\n  "));
});

/* ------------------------------------------------------------------ *
 * Series                                                              *
 * ------------------------------------------------------------------ */

/**
 * A series belongs to the question it is on.
 *
 * Analogy takes a finished item from another mode and *reuses the object*,
 * overwriting the conclusion with one of its own — so the inner mode's claims
 * rode along, about a question the item no longer asks, and the answer flow
 * would have stepped the player through them while the card said analogy.
 *
 * The check is cheap and general: whatever else a series contains, its first
 * claim is the conclusion on the card. A series inherited from somewhere else
 * fails that immediately, and so would a mode that replaced its conclusion and
 * forgot to say so.
 */
test("a series starts with the conclusion the card is showing", () => {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;

    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };

    let withSeries = 0;

    seeded(4004, () => {
        for (const type of ORDERED_QUESTION_TYPES) {
            if (!BUILD[type]) continue;
            const params = QUESTION_TYPE_SETTING_PARAMS[type];

            for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
                for (let rep = 0; rep < 6; rep++) {
                    let q;
                    try { q = BUILD[type](ctx, n); } catch { continue; }
                    if (!q.series.length) continue;
                    withSeries++;

                    assert(q.series.length > 1,
                        `${type} carries a series of one, which is not a series`);
                    equal(q.series[0].text,
                        Array.isArray(q.conclusion) ? q.conclusion[0] : q.conclusion,
                        `${type} shows a conclusion that is not the first of its series`);
                    equal(q.series[0].isValid, q.isValid,
                        `${type} is judged against something other than the claim it shows`);
                    equal(q.seriesAt, 0, `${type} starts partway through its series`);
                }
            }
        }
    });

    assert(withSeries > 20, `only ${withSeries} items carried a series at all`);
});

/* ------------------------------------------------------------------ *
 * Options                                                             *
 * ------------------------------------------------------------------ */

/**
 * A choice item offers two options, and they differ by one thing.
 *
 * A longer menu turns judging into **searching**. Four claims about four
 * different pairs let three be dismissed for not being about the pair that
 * matters; four corners of a square let most be dismissed for being nowhere
 * near; four numbers around the answer let a reader who counted roughly drop
 * the far ones without counting exactly. In every case the item can be
 * shortened by *looking* rather than by reasoning, and what is left is not the
 * task the mode was built for.
 *
 * Two options that differ by one part have nothing to play off against each
 * other. The guess floor is worse — one in two rather than one in four — and
 * the item is harder for it, which is the trade this whole plan keeps making.
 * The ability model reads the option count, so it already scores these as the
 * weaker evidence they are and nothing has to be told twice.
 *
 * Asserted over every mode and every claim of a series, at every rung a player
 * can reach, because the failure this prevents is a *new* mode shipping a menu
 * rather than an old one growing once.
 */
test("no item offers more than two options", () => {
    const settings = new Settings();
    for (const t of Object.values(EnumQuestionType)) settings.question[t].enabled = true;

    const wide: string[] = [];

    for (const type of ORDERED_QUESTION_TYPES) {
        if (!BUILD[type]) continue;
        const held = settableRungsFor(type);
        const params = QUESTION_TYPE_SETTING_PARAMS[type];

        const ctx: GeneratorContext = {
            settings,
            logger: new Logger("error", false),
            settingsOverrideService: {
                linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
                spread: () => null, depthFor: () => 0, scramble: 100, rungOverride: () => null,
            } as unknown as SettingsOverrideService,
            progressionService: {
                hasRung: () => false, depthBonusFor: () => 0,
            } as unknown as ProgressionService,
            forceConstruction: "off",
            hasRung: (_t: string, r: string) => held.includes(r),
            random: (n?: number) => createDistinction(ctx, n ?? 2),
        };

        seeded(6060, () => {
            for (let n = params.minNumOfPremises; n <= params.maxNumOfPremises; n++) {
                for (let rep = 0; rep < 4; rep++) {
                    let q;
                    try { q = BUILD[type](ctx, n); } catch { continue; }

                    for (const claim of [q, ...q.series]) {
                        const offered = claim.choices;
                        if (!offered || !offered.length) continue;
                        if (offered.length > 2) {
                            wide.push(`${type} at ${n} premises offers ${offered.length}`);
                        }
                        equal(new Set(offered).size, offered.length,
                            `${type} offers the same option twice`);
                    }
                }
            }
        });
    }

    assert(wide.length === 0,
        `${new Set(wide).size} items turn judging into searching:\n  `
        + [...new Set(wide)].join("\n  "));
});
