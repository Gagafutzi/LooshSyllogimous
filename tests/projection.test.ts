/**
 * Projection — who coincides once some directions stop counting.
 *
 * Recomputed from the card the long way: the premises give each edge's relation
 * as a direction per axis, the layout moves one step at a time, so accumulating
 * those signs over the premise graph rebuilds every position exactly. Then the
 * lens is read off the setup and coincidence is recomputed from the rebuilt
 * positions.
 *
 * Doing it that way rather than by inspecting the generator's layout is the
 * point: it proves the card *contains* its own answer. A mode that computed the
 * right class from coordinates the premises never pin down would pass any check
 * built on those coordinates and be unanswerable on screen.
 *
 * The half that matters is the names left unmarked. Marking one that does not
 * coincide is loud — the reader finds a counting direction that separates them
 * and is told they were wrong. Leaving out one that does is quiet, and it is
 * also the mode's own trap: compose the whole relation, then read "coincides"
 * off all of it instead of off the part that counts, and you mark nobody.
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
import {
    AxisSpec, axesForDimensions, renderNdPattern,
} from "../src/app/syllogimous/utils/ndspace.utils";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createProjection } from "../src/app/syllogimous/generators/projection";

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

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.Projection];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261008, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 12; rep++) {
                try { out.push(createProjection(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/**
 * The card, read back: the axes, the lens, the positions, the question.
 *
 * The axes are rebuilt the way the generator built them — the context above
 * overrides nothing, so `axesFor` returns null and both take the preset for this
 * many dimensions. How many is read off a premise's clause count.
 */
function readCard(q: Question) {
    /* "A is <clause>, <clause>, … relative to B" */
    const parsed = q.premises.map(line => {
        const text = strip(line);
        const [a, b] = extractSubjects(line);
        const at = text.indexOf(" is ");
        const rel = text.indexOf(" relative to ");
        assert(at >= 0 && rel > at, `a premise is not a relation: ${text}`);
        return { a, b, clauses: text.slice(at + 4, rel).split(", ").map(s => s.trim()) };
    });

    const dims = parsed[0].clauses.length;
    for (const p of parsed) {
        equal(p.clauses.length, dims,
            `premises describe different numbers of directions: ${p.clauses.join("/")}`);
    }

    const axes: AxisSpec[] = axesForDimensions(dims).map(scale => ({ scale }));
    const neutral = strip(renderNdPattern(axes, Array(dims).fill(0))).split(", ");
    const names = axes.map(a => `${a.scale.direction[0]}/${a.scale.direction[1]}`);

    /** A clause's sign on its axis: the positive word, the negative, or level. */
    const signOf = (clause: string, i: number) => {
        const [pos, neg] = axes[i].scale.direction;
        if (clause === pos) return 1;
        if (clause === neg) return -1;
        equal(clause, neutral[i],
            `"${clause}" is not a direction on the ${names[i]} axis, nor its level`);
        return 0;
    };

    /*
     * Positions accumulated over the premise graph. The layout moves one step
     * per axis per edge, so signs alone fix every coordinate — which is what
     * makes the card answerable without magnitudes being stated.
     */
    const coords: Record<string, number[]> = {};
    coords[parsed[0].b] = Array(dims).fill(0);
    for (let pass = 0; pass < parsed.length + 1; pass++) {
        for (const p of parsed) {
            const deltas = p.clauses.map((c, i) => signOf(c, i));
            if (coords[p.b] && !coords[p.a]) {
                coords[p.a] = coords[p.b].map((v, i) => v + deltas[i]);
            } else if (coords[p.a] && !coords[p.b]) {
                coords[p.b] = coords[p.a].map((v, i) => v - deltas[i]);
            }
        }
    }
    for (const w of q.bucket) {
        assert(!!coords[w],
            `${w} cannot be placed from the premises, so the card does not contain `
            + "its own answer");
    }

    /* "…only X and Y count. Z is ignored." — which axes count is on the card. */
    const [counts, ignores] = strip(q.setup[0]).split(/\.\s+/);
    assert(!!counts && !!ignores, `the setup does not say what the lens ignores: ${strip(q.setup[0])}`);
    const lens = names.map((n, i) => counts.includes(n) ? i : -1).filter(i => i >= 0);
    const blind = names.map((n, i) => ignores.includes(n) ? i : -1).filter(i => i >= 0);

    const named = extractSubjects(q.setup[1]);
    equal(named.length, 1, `the setup names ${named.length} things to compare against`);

    return {
        dims, names, coords, lens, blind, named: named[0],
        candidates: q.choices.map(c => strip(c).trim()),
    };
}

test("everyone but the named one is offered, exactly once", () => {
    for (const q of items()) {
        equal(q.answerMode, "select", "the item is not answered by selecting");
        const { named, candidates } = readCard(q);
        equal(candidates.length, q.bucket.length - 1,
            "the candidates are not everyone but the named one — someone who "
            + "coincides would have nowhere to be selected");
        equal(new Set(candidates).size, candidates.length, "a name is offered twice");
        assert(!candidates.includes(named),
            "the named thing is offered as coinciding with itself");
    }
});

/**
 * The lens counts something and ignores something, and says which.
 *
 * Counting every direction makes coincidence mean identity, so the answer is
 * always nobody; counting none makes everybody coincide. Both are lenses that
 * ask nothing, and the card has to name the split either way or the item cannot
 * be answered at all.
 */
test("the lens counts some directions and ignores the rest", () => {
    for (const q of items()) {
        const { dims, lens, blind } = readCard(q);
        assert(lens.length >= 1, "the lens counts no direction, so everything coincides");
        assert(blind.length >= 1,
            "the lens ignores no direction, so coincidence means identity and the "
            + "answer is nobody every time");
        equal(lens.length + blind.length, dims,
            "the counted and ignored directions do not account for every axis");
        equal(lens.filter(i => blind.includes(i)), [],
            "a direction is named as both counted and ignored");
    }
});

test("everyone marked coincides on every direction that counts", () => {
    for (const q of items()) {
        const { coords, lens, named, candidates } = readCard(q);
        for (const i of q.selectAnswer) {
            const w = candidates[i];
            const off = lens.filter(ax => coords[w][ax] !== coords[named][ax]);
            equal(off, [],
                `${w} is marked as coinciding with ${named} but is separated on a `
                + "direction the lens counts");
        }
    }
});

/**
 * And nobody left unmarked coincides, which is the quiet half.
 *
 * It is also the mode's own trap turned on the generator: reading coincidence
 * off the whole relation rather than off the counted part marks too few, and
 * every other thing about the item still looks right.
 */
test("nobody left unmarked coincides through the lens", () => {
    for (const q of items()) {
        const { coords, lens, named, candidates } = readCard(q);
        for (let i = 0; i < candidates.length; i++) {
            if (q.selectAnswer.includes(i)) continue;
            const w = candidates[i];
            const off = lens.filter(ax => coords[w][ax] !== coords[named][ax]);
            assert(off.length > 0,
                `${w} coincides with ${named} through the lens and is not marked, so a `
                + "reader who looked past the ignored directions is failed for it");
        }
    }
});

/**
 * Not everybody, which would be answered by selecting the list.
 *
 * Nobody is left alone deliberately and is not checked for here: establishing it
 * means checking every candidate, so it is not a free answer. Its *rate* is the
 * thing that matters, and that is held down in the generator rather than
 * asserted per item.
 */
test("a lens never collapses the whole card", () => {
    for (const q of items()) {
        assert(q.selectAnswer.length < q.choices.length,
            "everyone coincides, so the card is answered by selecting the whole list");
    }
});
