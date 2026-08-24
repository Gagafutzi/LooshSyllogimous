/**
 * Nested spaces — two unrelated arrangements sharing their objects.
 *
 * The mode is only sound if the two really are independent, and only worth
 * having if the words collide. Both are checked here, and the first is checked
 * the hard way: the answer is recomputed from the premises of the asked-about
 * space *alone*, reading the halves apart by bracket rather than by wording —
 * which is the same discipline the item asks of the player, and the reason the
 * usual guard against confusable vocabularies can be waived here.
 */

import { assert, seeded, test } from "./harness";
import { GeneratorContext } from "../src/app/syllogimous/generators/context";
import { ProgressionService } from "../src/app/syllogimous/services/progression.service";
import { SettingsOverrideService } from "../src/app/syllogimous/services/settings-override.service";
import { Settings } from "../src/app/syllogimous/models/settings.models";
import { EnumQuestionType } from "../src/app/syllogimous/constants/question.constants";
import { Logger } from "../src/app/syllogimous/utils/logger";
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createNested } from "../src/app/syllogimous/generators/nested";

function context(rung = "", deep = true): GeneratorContext {
    const settings = new Settings();
    for (const type of Object.values(EnumQuestionType)) settings.question[type].enabled = true;
    const ctx: GeneratorContext = {
        settings,
        logger: new Logger("error", false),
        settingsOverrideService: {
            linearOverride: () => null, axesFor: () => null, circularAxes: () => 0,
            spread: () => null,
            depthFor: () => 0, scramble: 100, deepConclusions: deep,
        } as unknown as SettingsOverrideService,
        progressionService: {
            hasRung: () => false, depthBonusFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === rung,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "");

/** "Ash is under Bee" → the two ends and the word between them. */
function statement(text: string): { a: string; rel: string; b: string } | null {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) return null;
    return { a: parts[0], rel: parts.slice(1, -1).join(" "), b: parts[parts.length - 1] };
}

/** Premises split by bracket, never by vocabulary — the mode's whole rule. */
function halves(premises: string[]) {
    const outer: Array<{ a: string; rel: string; b: string }> = [];
    const inner: Array<{ a: string; rel: string; b: string }> = [];

    for (const raw of premises) {
        const m = /^(.*?) \(where (.*)\)$/.exec(strip(raw));
        if (!m) continue;
        const o = statement(m[1]), i = statement(m[2]);
        if (o) outer.push(o);
        if (i) inner.push(i);
    }
    return { outer, inner };
}

/**
 * Positions along one chain, from that chain's statements only.
 *
 * `positive` is the relation word the conclusion uses, so the sign convention
 * is taken from the claim rather than from any knowledge of the scale — the
 * test cannot look up which space it is reading, exactly as the reader cannot.
 */
function positions(edges: Array<{ a: string; rel: string; b: string }>, positive: string) {
    const near: Record<string, Array<{ to: string; step: number }>> = {};
    for (const { a, rel, b } of edges) {
        const step = rel === positive ? 1 : -1;
        (near[a] ??= []).push({ to: b, step: -step });
        (near[b] ??= []).push({ to: a, step });
    }

    const pos: Record<string, number> = {};
    const start = edges[0]?.a;
    if (!start) return pos;

    pos[start] = 0;
    const queue = [start];
    while (queue.length) {
        const cur = queue.shift()!;
        for (const { to, step } of near[cur] ?? []) {
            if (to in pos) continue;
            pos[to] = pos[cur] + step;
            queue.push(to);
        }
    }
    return pos;
}

function verify(rung: string, runs: number) {
    const ctx = context(rung);
    let checked = 0, collisions = 0;

    for (let run = 0; run < runs; run++) {
        const q = seeded(run * 2699 + 13, () => createNested(ctx, 4));
        const { outer, inner } = halves(q.premises);
        assert(outer.length >= 3 && inner.length >= 3, "a premise did not carry both halves");

        for (const p of q.premises) {
            const m = /^(.*?) \(where (.*)\)$/.exec(strip(p));
            const o = statement(m![1]), i = statement(m![2]);
            if (o && i && ((o.a === i.b && o.b === i.a) || (o.a === i.a && o.b === i.b))) {
                collisions++;
                break;
            }
        }

        const plain = strip(String(q.conclusion));
        const askInner = plain.startsWith("Inside the brackets");
        const claim = statement(plain.replace(/^[^:]+:\s*/, ""));
        assert(!!claim, `could not read the claim: ${plain}`);

        // Only the half that was asked about. If the answer depended on the
        // other one, this would disagree with the item.
        const pos = positions(askInner ? inner : outer, claim!.rel);
        assert(claim!.a in pos && claim!.b in pos, "the claim names something that space never placed");

        const holds = pos[claim!.a] > pos[claim!.b];
        assert(holds === q.isValid,
            `${askInner ? "inner" : "outer"} space says ${holds}, item says ${q.isValid}: ${plain}`);
        checked++;
    }

    return { checked, collisions };
}

test("each space answers for itself, with no help from the other", () => {
    const plain = verify("", 50);
    assert(plain.checked === 50, "some items could not be read back");
});

test("the collision rung puts the same pair in one premise, every time", () => {
    const { checked, collisions } = verify("collide", 50);
    assert(checked === 50, "some items could not be read back");
    assert(collisions === 50,
        `${collisions} of 50 items had a same-pair premise; the point is not to wait for them`);

    // And it stays sound: the same fifty items were all answered correctly
    // above, from one space at a time.
});

test("colliding vocabularies are still answerable, which is the whole claim", () => {
    /*
     * The guard against confusable axis words exists because a *flat* premise
     * naming two of them is genuinely ambiguous. Here the brackets say which
     * space is meant, so the same pairing is sound — and the proof is that the
     * items verify from one half at a time, which the fifty above did.
     *
     * What this adds is that the collision is real: some item states the same
     * pair in opposite directions using the same words.
     */
    const ctx = context("collide");
    let reversed = 0;

    for (let run = 0; run < 60; run++) {
        const q = seeded(run * 811 + 7, () => createNested(ctx, 4));
        for (const p of q.premises) {
            const m = /^(.*?) \(where (.*)\)$/.exec(strip(p));
            const o = statement(m![1]), i = statement(m![2]);
            if (o && i && o.a === i.b && o.b === i.a && o.rel === i.rel) reversed++;
        }
    }

    assert(reversed > 20,
        `only ${reversed} premises stated a pair both ways in the same words`);
});

/**
 * The reported defect, asserted away: *"Inside the brackets: Lens is after
 * Doorstep"* against a premise reading *"where Lens is before Doorstep"*.
 *
 * Measured from the rendered premises, never from the generator's layout, so
 * the check is the one the reader could make — walk the asked-about space and
 * count how many of its relations lie between the two objects the claim names.
 * On a chain that count is the difference of the reconstructed positions.
 */
test("a nested conclusion is never one bracket read back", () => {
    for (const rung of ["", "collide"]) {
        const ctx = context(rung);
        const spans: number[] = [];

        for (let run = 0; run < 120; run++) {
            const premises = 3 + (run % 5);
            const q = seeded(run * 3301 + 29, () => createNested(ctx, premises));
            const { outer, inner } = halves(q.premises);

            const plain = strip(String(q.conclusion));
            const askInner = plain.startsWith("Inside the brackets");
            const claim = statement(plain.replace(/^[^:]+:\s*/, ""));
            assert(!!claim, `could not read the claim: ${plain}`);

            const pos = positions(askInner ? inner : outer, claim!.rel);
            const span = Math.abs(pos[claim!.a] - pos[claim!.b]);

            assert(span >= 2,
                `${rung || "plain"}: conclusion spans ${span} relation(s) of the`
                + ` ${askInner ? "inner" : "outer"} space: ${plain}`);

            // The recorded figure has to be the real one, or the log it exists
            // to fill would be a record of the generator's intentions.
            assert(q.depth === span,
                `item reports depth ${q.depth}, the premises say ${span}: ${plain}`);

            spans.push(span);
        }

        // A floor, not a fixed distance: pinning every conclusion to the ends
        // of the chain would make where the answer sits predictable.
        assert(new Set(spans).size > 1,
            `${rung || "plain"}: every conclusion spanned ${spans[0]} relations`);
    }
});

/**
 * The switch has to switch something off.
 *
 * A toggle whose two positions produce the same items is worse than no toggle:
 * it invites the player to conclude the setting does nothing, and they would be
 * right. So the off position is asserted to bring back the thing the floor
 * removes — a conclusion the asked-about space states outright — rather than
 * merely being asserted to run without throwing.
 */
test("turning the deeper conclusions off brings the old ones back", () => {
    const ctx = context("", false);
    let restatements = 0, read = 0;

    for (let run = 0; run < 120; run++) {
        const q = seeded(run * 3301 + 29, () => createNested(ctx, 3 + (run % 5)));
        const { outer, inner } = halves(q.premises);

        const plain = strip(String(q.conclusion));
        const askInner = plain.startsWith("Inside the brackets");
        const claim = statement(plain.replace(/^[^:]+:\s*/, ""));
        assert(!!claim, `could not read the claim: ${plain}`);

        const pos = positions(askInner ? inner : outer, claim!.rel);
        if (Math.abs(pos[claim!.a] - pos[claim!.b]) === 1) restatements++;
        read++;

        // Old model or new, the item still has to be right.
        const holds = pos[claim!.a] > pos[claim!.b];
        assert(holds === q.isValid, `off the floor, the answer stopped following: ${plain}`);
    }

    assert(read === 120, "some items could not be read back");
    assert(restatements > 10,
        `only ${restatements} of 120 conclusions restated a premise; the floor`
        + " looks to still be in force with the switch off");
});
