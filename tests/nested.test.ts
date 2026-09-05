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

import { assert, equal, seeded, test } from "./harness";
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
            dialFor: () => 0,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: (_t: EnumQuestionType, r: string) => r === rung,
        dialFor: () => 0,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const strip = (s: string) => s.replace(/<[^>]+>/g, "");

/**
 * The two halves of a nested conclusion.
 *
 * "Outside the brackets: A is under B, and inside them: A is on top of B" — one
 * claim about each arrangement, about the same pair.
 */
function readConclusion(plain: string) {
    const m = /^Outside the brackets: (.*?), and inside them: (.*)$/.exec(plain.trim());
    if (!m) return null;
    const outer = statement(m[1]), inner = statement(m[2]);
    return outer && inner ? { outer, inner } : null;
}

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

        const halves2 = readConclusion(strip(String(q.conclusion)));
        assert(!!halves2, `could not read the conclusion: ${strip(String(q.conclusion))}`);

        /*
         * Both halves, each against its own arrangement and nothing else.
         *
         * The conclusion now states the pair in *both* spaces, so this checks
         * what the mode actually claims: the outer half against the outer
         * premises, the bracketed half against the bracketed ones, and the
         * item true only when both hold. If either half depended on the other
         * space, one of these would disagree.
         */
        const outerPos = positions(outer, halves2!.outer.rel);
        const innerPos = positions(inner, halves2!.inner.rel);

        for (const [where, claim, pos] of [
            ["outer", halves2!.outer, outerPos] as const,
            ["inner", halves2!.inner, innerPos] as const,
        ]) {
            assert(claim.a in pos && claim.b in pos,
                `the ${where} half names something that space never placed`);
        }

        const outerHolds = outerPos[halves2!.outer.a] > outerPos[halves2!.outer.b];
        const innerHolds = innerPos[halves2!.inner.a] > innerPos[halves2!.inner.b];

        assert((outerHolds && innerHolds) === q.isValid,
            `outer says ${outerHolds} and inner ${innerHolds}, item says ${q.isValid}`);

        // A false item is wrong in exactly one half: wrong in both is spotted
        // from whichever the reader checks first.
        if (!q.isValid) {
            assert(outerHolds !== innerHolds,
                "a false item was false in both halves, so either one settles it");
        }
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

            const parts = readConclusion(strip(String(q.conclusion)));
            assert(!!parts, `could not read the conclusion: ${strip(String(q.conclusion))}`);

            /*
             * The floor holds in *both* arrangements, not just the one that
             * happens to be deep. A pair four relations deep outside and
             * adjacent inside gives half a deep item — which reads as a deep
             * item until you notice which half you worked for.
             */
            for (const [where, claim, edges] of [
                ["outer", parts!.outer, outer] as const,
                ["inner", parts!.inner, inner] as const,
            ]) {
                const pos = positions(edges, claim.rel);
                const span = Math.abs(pos[claim.a] - pos[claim.b]);
                assert(span >= 2,
                    `${rung || "plain"}: the ${where} half spans ${span} relation(s)`);
                spans.push(span);
            }

            // And it is one pair, asked about twice — not two questions.
            const pair = [parts!.outer.a, parts!.outer.b].sort().join();
            equal([parts!.inner.a, parts!.inner.b].sort().join(), pair,
                "the two halves are about different pairs");
        }

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
