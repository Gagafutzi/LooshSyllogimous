/**
 * Several conclusions, asked one at a time.
 *
 * The form this replaces put every claim on the card at once and scored them as
 * an AND. Two things were wrong with that, and both are asserted here.
 *
 * It was **one bit for two or three questions**, so the reader who settled the
 * first claim and guessed the rest scored the same as the reader who settled
 * all of them. And an AND **is not a coin**: a set of claims that must all hold
 * is false far more often than it is true, so "false" becomes the percentage
 * answer and the reasoning is optional.
 *
 * Asked one at a time, each claim is its own question at even odds, the
 * premises stay on screen, and answering one buys clock for the next.
 */

import { assert, equal, seeded, test } from "./harness";
import { BUILD } from "./modes";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createInferRelation } from "../src/app/syllogimous/generators/infer-relation";
import { createAxisMap } from "../src/app/syllogimous/generators/axis-map";
import { takeSeriesAnswer } from "../src/app/syllogimous/utils/answer.utils";
import { GameTimerService } from "../src/app/syllogimous/services/game-timer.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { isPremiseLikeConclusion } from "../src/app/syllogimous/utils/question.utils";

const strip = (h: string) => String(h).replace(/<[^>]+>/g, "");

function context(): GeneratorContext {
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
            dialFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/** The three families that ask several conclusions. */
const FAMILIES: Array<[EnumQuestionType, number]> = [
    [EnumQuestionType.LinearVertical, 5],
    [EnumQuestionType.Space4D, 4],
    [EnumQuestionType.Hierarchy, 5],
];

test("several conclusions come as a series, not as one card of claims", () => {
    const ctx = context();
    let seen = 0;

    for (const [type, n] of FAMILIES) {
        seeded(1234, () => {
            for (let rep = 0; rep < 25; rep++) {
                let q;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (q.series.length < 2) continue;
                seen++;

                // The card shows one claim, and it is the first of them.
                assert(typeof q.conclusion === "string",
                    `${type} put a list on the card instead of one claim`);
                equal(q.conclusion, q.series[0].text,
                    `${type} shows a claim that is not the first of the series`);
                equal(q.isValid, q.series[0].isValid,
                    `${type} is judged against a claim it is not showing`);
                equal(q.seriesAt, 0, `${type} starts partway through its series`);
            }
        });
    }

    assert(seen > 30, `only ${seen} series items across three families`);
});

/**
 * Each claim its own coin.
 *
 * The old set was all-true or exactly-one-false, because an AND answered from
 * several false claims can be settled from whichever you check first. Asked one
 * at a time that reasoning inverts: each claim is its own question, so each
 * wants its own even chance, and a reader who has learned that "false" is the
 * percentage answer has learned nothing worth having.
 */
test("a claim is as likely to hold as not, and the claims are independent", () => {
    const ctx = context();
    let holds = 0, total = 0, allTheSame = 0, items = 0;

    for (const [type, n] of FAMILIES) {
        seeded(8642, () => {
            for (let rep = 0; rep < 60; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (!q || q.series.length < 2) continue;

                items++;
                const claims = q.series;
                for (const c of claims) { total++; if (c.isValid) holds++; }
                if (claims.every(c => c.isValid === claims[0].isValid)) allTheSame++;
            }
        });
    }

    assert(total > 100, `only ${total} claims in the sample`);
    const rate = holds / total;
    assert(rate > 0.35 && rate < 0.65,
        `${(rate * 100).toFixed(0)}% of claims hold, which is not a coin`);

    // Independent, so a mixed item is the common case rather than the rare one.
    assert(allTheSame / items < 0.65,
        `${allTheSame} of ${items} items had every claim the same way, so the`
        + " first claim gives the rest away");
});

/**
 * The clock is handed seconds, not restarted.
 *
 * A series shares one arrangement and one countdown: answering a claim buys
 * time for the next, so the item stays one timed unit and the extra is visibly
 * what getting that far bought. Restarting it would make a three-claim item
 * three items long for the price of one.
 */
test("answering a claim adds to the clock without restarting it", () => {
    const timer = new GameTimerService();

    // Nothing running: extending is silent rather than an error.
    timer.extend(5);
    equal(timer.remainingSeconds, 0, "a stopped clock was given time");

    timer.start(30);
    timer.extend(5);
    equal(timer.remainingSeconds, 35, "the bonus was not added to what was left");

    timer.extend(0);
    equal(timer.remainingSeconds, 35, "a zero bonus moved the clock");

    // And it is still the same run, not a fresh one.
    assert(timer.running, "extending the clock restarted it");
    timer.stop();
});

/**
 * Which modes offer a series, as a set rather than a count.
 *
 * The floor is the full list, the way the derivation coverage test is written
 * and for the same reason: a number to beat lets a mode fall out silently while
 * the total still looks healthy. Every true-or-false mode is on it.
 *
 * The absentees are absent for a reason, not by oversight. The choice, map and
 * construct modes are not true-or-false items at all, so a boolean series has
 * nothing to attach to. Analogy takes a finished item from another mode and
 * re-purposes the object, so it must *clear* any series rather than carry one.
 * And Binary is already two questions compounded into one claim.
 */
const MUST_OFFER: Array<[EnumQuestionType, number]> = [
    [EnumQuestionType.Distinction, 5],
    [EnumQuestionType.LinearVertical, 5],
    [EnumQuestionType.LinearHorizontal, 5],
    [EnumQuestionType.ComparisonNumerical, 5],
    [EnumQuestionType.Space3D, 4],
    [EnumQuestionType.Space4D, 4],
    [EnumQuestionType.Hierarchy, 5],
    [EnumQuestionType.NestedSpaces, 4],
    [EnumQuestionType.Deictic, 6],
    [EnumQuestionType.LinearArrangement, 5],
    [EnumQuestionType.CircularArrangement, 5],
    [EnumQuestionType.Direction, 5],
    [EnumQuestionType.Direction3DSpatial, 5],
    [EnumQuestionType.Syllogism, 4],
    [EnumQuestionType.Transformation, 5],
    [EnumQuestionType.AnchorSpace, 5],
    [EnumQuestionType.AnchorSpaceV2, 5],
    [EnumQuestionType.Knaves, 5],
    // Answered by picking rather than by judging, which the form reaches too.
    [EnumQuestionType.ShapeRotation, 6],
    [EnumQuestionType.AxisMap, 3],
    [EnumQuestionType.InferRelation, 6],
];

/**
 * Widest Group is deliberately not on the list.
 *
 * Two groups is what the mode is — the extra ones came off the ladder for being
 * a longer read rather than a harder one — and asking "which is widest" a
 * second time about the same two groups is the same question with the answer
 * already given. The form only pays where a second question exists to ask.
 */

test("every true-or-false mode asks more than one conclusion", () => {
    const ctx = context();
    const silent: string[] = [];

    for (const [type, n] of MUST_OFFER) {
        let built = 0, withSeries = 0;

        seeded(2718, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (!q) continue;
                built++;
                if (q.series.length > 1) withSeries++;
            }
        });

        // Most rather than all: a drawer that cannot find a second claim on a
        // particular layout gives up rather than shortening the series, which
        // is the honest behaviour and does show up occasionally.
        if (!built || withSeries / built < 0.6) {
            silent.push(`${type} (${withSeries} of ${built})`);
        }
    }

    assert(silent.length === 0,
        `${silent.length} modes ask one conclusion where they should ask several:\n  `
        + silent.join("\n  "));
});

/** The composers must not carry one, which is the fault this class had. */
test("a mode that re-purposes another's item carries no series", () => {
    const ctx = context();

    for (const type of [EnumQuestionType.Analogy, EnumQuestionType.Binary]) {
        seeded(1618, () => {
            for (let rep = 0; rep < 20; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, 5); } catch { continue; }
                if (!q) continue;
                equal(q.series.length, 0,
                    `${type} carries a series it did not build, about a question`
                    + " it no longer asks");
            }
        });
    }
});

/* ------------------------------------------------------------------ *
 * A series answered by picking                                        *
 * ------------------------------------------------------------------ */

/**
 * Not every item that can ask twice is a true-or-false item.
 *
 * Shape Rotation works the turns out once and every further object is that same
 * result read somewhere else on the same shape — so a second question costs the
 * reader almost nothing except the thing the mode is for. It is the form that
 * gains most from being asked again, and it is answered by *picking*, so a
 * claim has to carry its own options and prompt rather than a wording and a
 * verdict.
 *
 * The trap, which cost a run to find: the shared drawer used to map a drawn
 * claim down to `{ text, isValid }`, which silently dropped the options — a
 * picking series with nothing to pick, and every claim after the first
 * unanswerable.
 */
test("a picking item can ask about the other objects too", () => {
    const ctx = context();
    let asked = 0;

    seeded(9753, () => {
        for (let rep = 0; rep < 80; rep++) {
            let q: Question | undefined;
            try { q = BUILD[EnumQuestionType.ShapeRotation](ctx, 6); } catch { continue; }
            if (!q || q.answerMode !== "choice" || q.series.length < 2) continue;
            asked++;

            for (const [i, claim] of q.series.entries()) {
                assert(!!claim.choices && claim.choices.length > 1,
                    `claim ${i + 1} has nothing to pick from`);
                assert(claim.correctChoice != null
                    && claim.correctChoice >= 0
                    && claim.correctChoice < claim.choices!.length,
                    `claim ${i + 1} points at no option`);
                assert(!!claim.prompt, `claim ${i + 1} asks nothing`);
            }

            // The card opens on the first claim, as every series does.
            equal(q.series[0].prompt, q.choicePrompt,
                "the card is asking something other than its first claim");
            equal(q.series[0].correctChoice, q.correctChoice,
                "the card is scored against something other than its first claim");

            // Each claim is about a different object, or it is the same
            // question twice with the options shuffled.
            const prompts = q.series.map(c => c.prompt);
            equal(new Set(prompts).size, prompts.length,
                "two claims ask about the same object");
        }
    });

    assert(asked > 20, `only ${asked} picking series in the sample`);
});

/**
 * Where the map is the expensive half, the map is what stays.
 *
 * Most series keep every premise and ask something else about them. These two
 * are built the other way round: the costly reading is a *map* — a change read
 * off worked examples, a space read off its premises — and the cheap half is
 * what it gets applied to. So the examples or the space stay put and the part
 * being asked about is replaced, which is the same trade every other series
 * makes and simply falls on the other side of the card.
 *
 * Swapping the other half would be the wrong direction: different examples mean
 * a different change, and that is not another question about this item, it is a
 * different item printed underneath.
 */
test("a map-and-apply item keeps its map and replaces what it is applied to", () => {
    const ctx = context();

    for (const [type, n, keeps] of [
        [EnumQuestionType.AxisMap, 3, "examples"],
        [EnumQuestionType.InferRelation, 6, "the space"],
    ] as const) {
        let checked = 0;

        seeded(1379, () => {
            for (let rep = 0; rep < 60; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (!q || q.series.length < 2) continue;
                checked++;

                const lists = q.series.map(c => c.premises);
                for (const [i, list] of lists.entries()) {
                    assert(!!list && list.length > 0,
                        `${type}: claim ${i + 1} shows no premises at all`);
                }

                /*
                 * The shared head is the map. It has to be a real prefix and a
                 * substantial one — a series whose claims share nothing has
                 * replaced the item, and one that shares everything has not
                 * asked a second question.
                 */
                const first = lists[0]!;
                for (let c = 1; c < lists.length; c++) {
                    const other = lists[c]!;
                    let shared = 0;
                    while (shared < first.length && shared < other.length
                        && first[shared] === other[shared]) shared++;

                    assert(shared > 0,
                        `${type}: claim ${c + 1} keeps none of the ${keeps}`);
                    assert(shared < first.length,
                        `${type}: claim ${c + 1} changed nothing, so it is the`
                        + " same question twice");
                    assert(first.slice(0, shared).join("\n") === other.slice(0, shared).join("\n"),
                        `${type}: the ${keeps} moved between claims`);
                }

                // And each claim is answerable: it brings its own options.
                for (const [i, claim] of q.series.entries()) {
                    assert(!!claim.choices && claim.choices.length > 1,
                        `${type}: claim ${i + 1} has nothing to pick from`);
                    assert(claim.correctChoice != null && claim.correctChoice >= 0,
                        `${type}: claim ${i + 1} points at no option`);
                }
            }
        });

        assert(checked > 15, `only ${checked} ${type} series in the sample`);
    }
});

/**
 * A claim about a pair some premise states outright is read, not worked out.
 *
 * Reported on Distinction: premises *"Lantern is opposite of Ladybug"* and a
 * claim *"Ladybug is same as Lantern"* — the same pair, so the answer is one
 * premise read backwards, in a mode whose whole content is carrying a side
 * along a chain. Every mode's own conclusion has always rejected those; the
 * series was drawing pairs without asking.
 *
 * **Only the modes where a shared pair really is a restatement.** The measure
 * that found this over-reports badly, and the exclusions are the interesting
 * part:
 *
 *   - **Deictic** states one subject per line, so any two lines naming the same
 *     thing look like a matching "pair" to a check built for two-ended
 *     relations. It has its own guard against an exact repeat.
 *   - **Transformation** and **Anchor Space v2** state the *initial* offset and
 *     ask about the *final* relation, and the transforms are required to have
 *     changed it — so a shared pair is the item working, not failing.
 *   - **Hierarchy** offers a reversed pair deliberately: a premise says A leads
 *     to B and the claim says B leads to A, which is false and has to be caught
 *     by reading the direction. That is a near miss on purpose.
 */
test("no claim restates a pair the premises already state", () => {
    const ctx = context();
    const PAIRWISE: Array<[EnumQuestionType, number]> = [
        [EnumQuestionType.Distinction, 5],
        [EnumQuestionType.LinearArrangement, 5],
        [EnumQuestionType.CircularArrangement, 5],
        [EnumQuestionType.Direction, 5],
        [EnumQuestionType.Direction3DSpatial, 5],
        [EnumQuestionType.Direction3DTemporal, 5],
    ];

    for (const [type, n] of PAIRWISE) {
        let claims = 0, restated = 0;

        seeded(8080, () => {
            for (let rep = 0; rep < 40; rep++) {
                let q: Question | undefined;
                try { q = BUILD[type](ctx, n); } catch { continue; }
                if (!q || q.series.length < 2) continue;

                for (const claim of q.series) {
                    if (!claim.text) continue;
                    claims++;
                    if (isPremiseLikeConclusion(claim.premises ?? q.premises, claim.text)) {
                        restated++;
                    }
                }
            }
        });

        assert(claims > 40, `${type}: only ${claims} claims in the sample`);
        equal(restated, 0,
            `${type}: ${restated} of ${claims} claims ask about a pair a premise states`);
    }
});

/* ------------------------------------------------------------------ *
 * A claim that replaces the premises replaces the derivation too      *
 * ------------------------------------------------------------------ */

/**
 * Reported from play, with a screenshot: the derivation named two objects the
 * card did not mention, and a symbol the card did not print.
 *
 * Infer the Relation asks several questions about one space, and each one
 * withholds a *different* relation behind a *different* symbol — carrying ⊕
 * over from the last question would be answering the wrong question with the
 * right method. But the item's derivation was built once, for the first claim,
 * and every later claim inherited it. So a card reading "Purple ⊗ Mulch" was
 * explained by "Phone ⊕ Mulch rules out...", which is not a hard explanation to
 * follow, it is an explanation of something else.
 *
 * Worse than no derivation, because it is confidently wrong, and it defeats the
 * one thing a derivation is for: checking an answer you believe was right.
 */
test("every claim's derivation is about the claim on the card", () => {
    seeded(6060, () => {
        const ctx = context();
        let checked = 0;

        for (let rep = 0; rep < 40; rep++) {
            let q;
            try { q = createInferRelation(ctx, 4); } catch { continue; }
            if (q.series.length < 2) continue;

            for (let i = 0; i < q.series.length; i++) {
                const claim = q.series[i];
                if (!claim.premises) continue;

                /*
                 * Absence is the bug, so it is asserted rather than skipped.
                 * The first draft of this test read `if (!claim.explanation)
                 * continue`, which skipped exactly the claims that were broken
                 * and passed against the unfixed generator.
                 */
                assert(!!claim.explanation,
                    `claim ${i + 1} replaces the premises and carries no derivation,`
                    + " so the item's own — about another claim — is what shows");

                // The symbol the card prints for this claim, off its own lines.
                const shown = claim.premises.map(strip).join(" ");
                const symbol = ["⊕", "⊗", "⊙", "⊘", "⊛"].find(o => shown.includes(o));
                if (!symbol) continue;

                const said = claim.explanation!.map(strip).join(" ");
                assert(said.includes(symbol),
                    `claim ${i + 1} prints ${symbol} and its derivation talks about`
                    + ` something else: ${said.slice(0, 80)}`);

                // And about the objects the card names, not another claim's.
                const named = claim.premises
                    .filter(p => strip(p).includes(symbol))
                    .flatMap(p => strip(p).split(symbol).map(x => x.trim()));
                for (const line of claim.explanation!.map(strip)) {
                    if (!line.includes("rules out")) continue;
                    const subject = line.split("rules out")[0];
                    for (const word of subject.split(symbol).map(x => x.trim())) {
                        if (!word) continue;
                        assert(named.includes(word),
                            `the derivation for claim ${i + 1} names "${word}",`
                            + " which the card does not mention");
                    }
                }
                checked++;
            }
        }
        assert(checked > 0, "no multi-claim inference items were produced to check");
    });
});

/**
 * Answering one conclusion should leave you where the next one is asked.
 *
 * Reaching the end of the carousel is what unlocks answering, so an answer
 * always leaves the card at its last slide — and the next claim then arrives
 * with its question behind you. The claim records which premise it replaced,
 * which is the head of the part being asked about: the operator lines in Infer
 * Relation, the chain in Axis Maps. Everything above it is reading already paid
 * for.
 */
test("a claim that replaces premises says which one to jump to", () => {
    seeded(4141, () => {
        const ctx = context();
        let checked = 0;

        for (const make of [createInferRelation, createAxisMap]) {
            for (let rep = 0; rep < 30 && checked < 12; rep++) {
                let q;
                try { q = make(ctx, 4); } catch { continue; }
                if (q.series.length < 2) continue;

                const before = [...q.premises];
                takeSeriesAnswer(q, q.series[0].isValid);
                const at = q.seriesFocusPremise;
                if (!q.series[1].premises) continue;

                assert(at >= 0, "a claim replaced the premises and pointed at none of them");
                assert(at < q.premises.length, `focus ${at} is past the end of the card`);
                assert(q.premises[at] !== before[at],
                    "the premise it points at is one that did not change");
                for (let i = 0; i < at; i++) {
                    assert(q.premises[i] === before[i],
                        `premise ${i} changed and is before the one being pointed at`);
                }
                checked++;
            }
        }
        assert(checked > 0, "no premise-replacing series items were produced to check");
    });
});
