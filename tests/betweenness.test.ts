/**
 * Betweenness — who must lie between these two.
 *
 * The one mode here whose premises cannot be chained, so the only way to check
 * it is the way a player has to solve it: arrange everyone every possible way,
 * keep the arrangements every premise allows, and read the answer off those.
 * That is what these do, from the card as shown.
 *
 * Two of the checks are about the card telling the truth rather than about the
 * answer being right. The setup says every arrangement has a mirror that fits
 * too — a claim about the relation, and one that would quietly stop holding if
 * a premise form ever became direction-sensitive. And the pair asked about must
 * not be the ends of any stated premise, which is the defect the first draft
 * shipped: "N lies between P and S" *is* the answer for the pair (P, S), and an
 * item asked about stated ends spells its own answer out in the premises.
 */

import { assert, equal, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Question } from "../src/app/syllogimous/models/question.models";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../src/app/syllogimous/constants/settings.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { extractSubjects } from "../src/app/syllogimous/utils/question.utils";
import { permutations } from "../src/app/syllogimous/utils/relation-systems.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createBetweenness } from "../src/app/syllogimous/generators/betweenness";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

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
            dialFor: () => 0, mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

/**
 * The premise counts this mode actually ships, read rather than repeated.
 *
 * Written out as a range, these tests exercised five to nine whatever the
 * settings said — so lowering the floor, which is the change that makes an item
 * ambiguous, left the suite green while the app served the items the floor had
 * been protecting against. Reading the range means a floor moved in
 * `settings.constants` is a floor this checks at.
 */
const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Betweenness];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261005, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createBetweenness(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/** `[a, b, c]` — `b` lies between the two ends `a` and `c`. */
type Triple = [number, number, number];

function readCard(q: Question) {
    const at = new Map(q.bucket.map((w, i) => [w, i]));
    const said: Triple[] = q.premises.map(line => {
        // "B lies between A and C" — the middle is named first.
        const [b, a, c] = extractSubjects(line);
        return [at.get(a)!, at.get(b)!, at.get(c)!];
    });

    const asked = extractSubjects(q.setup[1]);
    equal(asked.length, 2, `the setup does not name one pair: ${strip(q.setup[1])}`);

    const candidates = q.choices.map(c => at.get(strip(c).trim())!);
    return {
        n: q.bucket.length, said,
        x: at.get(asked[0])!, y: at.get(asked[1])!,
        candidates,
    };
}

const middle = (place: number[], a: number, b: number, c: number) =>
    (place[a] < place[b] && place[b] < place[c])
    || (place[c] < place[b] && place[b] < place[a]);

/** The arrangements the premises allow, recomputed from the card. */
const fitting = (n: number, said: Triple[]) =>
    permutations(n).filter(place => said.every(([a, b, c]) => middle(place, a, b, c)));

test("everyone but the two ends is offered, exactly once", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        const { n, x, y, candidates } = readCard(q);
        equal(candidates.length, n - 2,
            "the candidates are not everyone but the two ends — a name the premises "
            + "force would then have nowhere to be selected");
        equal(new Set(candidates).size, candidates.length, "a name is offered twice");
        assert(!candidates.includes(x) && !candidates.includes(y),
            "one of the two ends is offered as lying between itself and the other");
    }
});

/**
 * The pair asked about is never the ends of a premise.
 *
 * The defect the first draft shipped, and the reason the first item built had
 * every candidate correct: three premises shared the asked pair as their ends,
 * so three of the four names to select were written out on the card. Asked of a
 * pair no premise uses as its ends, every name in the answer is derived.
 */
test("the asked pair is not the ends of any premise", () => {
    for (const q of items()) {
        const { said, x, y } = readCard(q);
        for (const [a, , c] of said) {
            assert(!((a === x && c === y) || (a === y && c === x)),
                "a premise states betweenness for the very pair being asked about, so "
                + "its middle name is the answer read off the card");
        }
    }
});

/*
 * ── Why the mirror claim is not a test of its own ──
 *
 * The setup says every arrangement that fits has a mirror that fits too, and a
 * check for it was written here first: filter the permutations by the premises,
 * then look for each one's reverse. It cannot fail. The filter uses the same
 * symmetric reading of "lies between" that makes the claim true, so the
 * assertion restates its own premise — and a mutation making the generator
 * direction-sensitive left it green, because the test was never consulting the
 * generator about it.
 *
 * It is deleted rather than weakened. The mutation it was meant to catch is
 * caught by "nobody left unmarked is forced" below: a generator reading a
 * direction the premises do not carry keeps too few arrangements, and marks the
 * wrong set for it.
 */

test("everyone marked lies between the two in every arrangement", () => {
    for (const q of items()) {
        const { n, said, x, y, candidates } = readCard(q);
        const fits = fitting(n, said);
        for (const i of q.selectAnswer) {
            assert(fits.every(place => middle(place, x, candidates[i], y)),
                `${q.bucket[candidates[i]]} is marked but stands outside the two in at `
                + "least one arrangement the premises allow");
        }
    }
});

/**
 * And nobody unmarked is forced, which is the half a generator gets wrong.
 *
 * Marking too few is the quiet failure: the item is answerable, the explanation
 * reads sensibly, and a player who worked out one more name than the card
 * expected is told they were wrong.
 */
test("nobody left unmarked is forced between the two", () => {
    for (const q of items()) {
        const { n, said, x, y, candidates } = readCard(q);
        const fits = fitting(n, said);
        for (let i = 0; i < candidates.length; i++) {
            if (q.selectAnswer.includes(i)) continue;
            assert(!fits.every(place => middle(place, x, candidates[i], y)),
                `${q.bucket[candidates[i]]} lies between the two in every arrangement `
                + "and is not marked, so a player who found it is failed for it");
        }
    }
});
