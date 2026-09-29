/**
 * Composing concave relations — and why each direction is proved its own way.
 *
 * The mode's whole claim is that a composition question can be sound without an
 * exact composition table. It cannot have one: `rcc8.ts` gets its exact answer by
 * enumerating 167,281 arrangements of three rectangles, and the same enumeration
 * over three patches runs over the interleavings of twelve x-coordinates against
 * twelve y's. So `possible` is settled by a witness and `impossible` by a rule, and
 * the file lives or dies on two things being true at once:
 *
 *   The rules never contradict the geometry. A rule that excludes something a
 *   triple of patches realises marks a correct reader wrong, and nothing about the
 *   card looks wrong when it happens. This is checked over every chain the pool
 *   witnesses — eight thousand answers — because a rule is a universal claim and one
 *   counterexample is the whole story.
 *
 *   Every option is classified. A relation that is neither witnessed nor excluded
 *   must not reach a card, because the code has no answer for it.
 *
 * The first of these earned its keep immediately. It found sixteen violations, all
 * of one cause: the mouth of a bay was being counted as part of the patch, which
 * gave every patch a whisker across its own opening and let two patches "touch"
 * across an open gap. Regions with whiskers are not the closure of their interiors
 * and RCC8's laws do not hold for them, so `A deep inside B` with `B touching C` was
 * coming out with `A touching C`. Correcting it also *added* five relations, because
 * "apart, but reaching into the other's bay" had been getting counted as contact.
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
import { createDistinction } from "../src/app/syllogimous/generators/distinction";
import { createConcaveRegions } from "../src/app/syllogimous/generators/concave-regions";
import {
    BAY, BAY_STANDING, EDGE, Patch, STANDING, compositionItem, concavePool, constraintAllows,
    isPatch, meetings, meetingsOverLattice, parseKey, partAt, poolRelations, provableConstraint,
    realised, relationDistance, relationKey, relationOf, spellOutRelation, usableChains,
    witnessTriple, witnessedComposition,
} from "../src/app/syllogimous/utils/concave-regions.utils";

const strip = (h: string) => h.replace(/<[^>]+>/g, "");

function rng(seed: number) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 0x100000000;
    };
}

/* ------------------------------------------------------------------ *
 * The substrate the composition rests on                              *
 * ------------------------------------------------------------------ */

/**
 * The mouth of a bay is not part of the patch, and this is where that is asserted.
 *
 * The patch is its hull less its bay, so the segment where the bay meets the edge it
 * is flush with belongs to neither side: the patch is not there. Calling it part of
 * the outline is the single most consequential thing that can go wrong in this
 * file — it is a change of one comparison, it looks more correct than the truth
 * (surely the boundary of the bay is the boundary of the patch), and what it breaks
 * is composition three functions away.
 */
test("the mouth of a bay belongs to the bay, not to the patch", () => {
    /* A bay flush with the right edge: its mouth is x = 6, y strictly between 2 and 4. */
    const p: Patch = { x1: 0, x2: 6, y1: 0, y2: 6, bx1: 3, bx2: 6, by1: 2, by2: 4 };
    assert(isPatch(p), "the fixture is not a well-formed patch");

    equal(partAt(p, 12, 6), BAY,
        "the middle of the mouth is being reported as part of the patch — that is the "
        + "whisker that breaks every containment rule below");
    equal(partAt(p, 12, 4), EDGE,
        "the corner where the mouth meets a wall is not on the patch, so the bay has "
        + "swallowed the wall's endpoint");
    equal(partAt(p, 6, 6), EDGE, "the bay's far wall is not part of the patch");
    equal(partAt(p, 12, 10), EDGE, "the hull's own right edge is not part of the patch");
});

/**
 * And the consequence, stated as a fact about two patches.
 *
 * The rule above is one comparison; this is what it is *for*. A patch standing in
 * front of another's bay, sharing nothing with it, must come out `apart` — under the
 * whisker it came out `touching`, which is the reading that made the composition
 * rules fail.
 */
test("a patch across the mouth of a bay touches nothing", () => {
    const host: Patch = { x1: 0, x2: 6, y1: 0, y2: 10, bx1: 3, bx2: 6, by1: 1, by2: 9 };
    /*
     * Flush against the mouth from outside, and clear of both its corners — those are
     * where the bay's walls end, and a wall *is* part of the patch, so a patch
     * reaching one of them really does touch. The gap is the open part of the mouth.
     */
    const other: Patch = { x1: 6, x2: 8, y1: 3, y2: 6, bx1: 7, bx2: 8, by1: 4, by2: 5 };
    assert(isPatch(host) && isPatch(other), "the fixtures are not well-formed patches");

    equal(parseKey(relationKey(relationOf(meetings(other, host)))).stands, 0,
        "a patch lying across the mouth of a bay is reported as touching the patch — "
        + "the two share no point, and the mouth is not a place either of them is");
});

/**
 * The bounded sweep is the whole lattice, for the only thing it is asked.
 *
 * Every part of either patch is inside their shared bounding box, so the only
 * combination the box can miss is outside-meets-outside — which the one far point
 * supplies. Worth asserting rather than arguing, because the composition work makes
 * sixty thousand of these calls and the full sweep is a hundred times the cost.
 */
test("the bounded sweep agrees with the full lattice", () => {
    const random = rng(20261701);
    let checked = 0;
    for (let attempt = 0; attempt < 3000; attempt++) {
        const pool = concavePool();
        const a = pool[Math.floor(random() * pool.length)];
        const b = pool[Math.floor(random() * pool.length)];
        checked++;
        equal(meetings(a, b), meetingsOverLattice(a, b),
            `the two sweeps disagree on ${JSON.stringify(a)} against ${JSON.stringify(b)}`);
    }
    assert(checked > 2000, `only ${checked} pairs were compared`);
});

/**
 * The pool and the distance measure name the same relations.
 *
 * The pool decides what a card may offer; `realised` decides how nearly alike two
 * relations are, and so which ones get offered together. A relation in one and not
 * the other is either offered with no distance to anything — every neighbour at the
 * sentinel — or measured and never offered.
 */
test("the witness pool realises exactly the relations the limiter measures", () => {
    const pool = poolRelations();
    const measured = [...realised().keys()];
    equal([...pool].sort(), [...measured].sort(),
        "the pool and the distance measure disagree about which relations exist");
    assert(pool.length > 25,
        `only ${pool.length} relations — the domain or the pool has collapsed`);
});

/* ------------------------------------------------------------------ *
 * The rules against the geometry                                      *
 * ------------------------------------------------------------------ */

/**
 * **No rule excludes anything three patches can do.**
 *
 * The one check this file exists for. Each rule is a universal claim about regions,
 * so it is used to say "impossible" — and the only way a universal claim fails is
 * that something realises what it forbids. Every chain the pool witnesses is put to
 * every rule that fires on it, which is around eight thousand answers.
 *
 * A failure here is not a near miss. It means a card marked a reader wrong for
 * choosing a relation that three patches on a lattice are sitting in.
 */
test("no rule forbids a composition the patches realise", () => {
    const keys = poolRelations();
    let checked = 0, fired = 0;
    for (const first of keys) {
        for (const second of keys) {
            const witnessed = witnessedComposition(first, second);
            if (!witnessed.length) continue;
            const c = provableConstraint(first, second);
            if (c.stands || c.inTheirBay || c.theyInMine) fired++;
            for (const answer of witnessed) {
                checked++;
                assert(constraintAllows(c, answer),
                    `a rule forbids ${answer} after ${first} then ${second}, and the `
                    + `patches realise it: ${c.because.join("; ")}`);
            }
        }
    }
    assert(checked > 5000, `only ${checked} witnessed answers were checked`);
    assert(fired > 100, `only ${fired} chains have a rule at all — nothing is excluded`);
});

/**
 * And every rule that fires gives its reason.
 *
 * The reason is not commentary: it is what the explanation prints, and it is the
 * thing a composition table cannot supply. A constraint with no argument behind it
 * is a table entry that has learned to look like a proof.
 */
test("every constraint states the argument behind it", () => {
    const keys = poolRelations();
    for (const first of keys) {
        for (const second of keys) {
            const c = provableConstraint(first, second, "A", "B", "C");
            if (!c.stands && !c.inTheirBay && !c.theyInMine) {
                equal(c.because, [], `${first} then ${second} argues for nothing it claims`);
                continue;
            }
            assert(c.because.length > 0,
                `${first} then ${second} is constrained with no reason given`);
            /* At least one line argues from one end to the other. The others qualify
               it — "and one of those steps is deep within" names no patch and does
               not need to. */
            assert(c.because.some(line => /A/.test(line) && /C/.test(line)),
                `no reason for ${first} then ${second} connects the two ends: `
                + c.because.join("; "));
            for (const line of c.because) {
                assert(line.trim().length > 20,
                    `a reason for ${first} then ${second} says nothing: "${line}"`);
            }
        }
    }
});

/* ------------------------------------------------------------------ *
 * The menu                                                           *
 * ------------------------------------------------------------------ */

/**
 * Every option is proved one way or the other.
 *
 * This is the gap the design exists to close. A sampled composition table would
 * offer relations it has no witness for and no argument against, and mark them
 * impossible by default — which is the one failure mode that cannot be seen from
 * the outside. So: each option is either witnessed, and then it is marked possible,
 * or excluded by a rule, and then it is not.
 */
test("every option offered is witnessed possible or proved impossible", () => {
    for (const size of [3, 5, 8]) {
        const chains = usableChains(size);
        assert(chains.length > 100, `only ${chains.length} items at a menu of ${size}`);
        for (const { first, second, focusAt } of chains) {
            const item = compositionItem(first, second, size, focusAt)!;
            const witnessed = witnessedComposition(first, second);
            for (const key of item.options) {
                const isPossible = item.possible.includes(key);
                if (isPossible) {
                    assert(witnessed.includes(key),
                        `${key} is marked possible after ${first} then ${second} with no `
                        + "triple of patches behind it");
                } else {
                    assert(!constraintAllows(item.constraint, key),
                        `${key} is marked impossible after ${first} then ${second} and no `
                        + "rule forbids it — the card is guessing");
                }
            }
        }
    }
});

/**
 * And the possible ones really are laid out somewhere.
 *
 * `witnessedComposition` reads a bitmask that a sweep wrote; this goes back to the
 * patches and finds the three. Slower, and the point: a bit set in the wrong word
 * would pass the check above and fail this one.
 */
test("every answer marked possible has three patches behind it", () => {
    const chains = usableChains(5);
    let found = 0;
    for (const { first, second, focusAt } of chains.slice(0, 60)) {
        const item = compositionItem(first, second, 5, focusAt)!;
        for (const key of item.possible) {
            const triple = witnessTriple(first, second, key);
            assert(!!triple, `nothing realises ${first} then ${second} giving ${key}`);
            const [a, b, c] = triple!;
            equal(relationKey(relationOf(meetings(a, b))), first,
                "the witness does not stand in the first relation");
            equal(relationKey(relationOf(meetings(b, c))), second,
                "the witness does not stand in the second relation");
            equal(relationKey(relationOf(meetings(a, c))), key,
                "the witness does not give the answer it was found for");
            found++;
        }
    }
    assert(found > 60, `only ${found} answers were traced back to patches`);
});

/**
 * The menu is the answer's neighbourhood, and nothing nearer is left out.
 *
 * The limiter is the only reason a calculus of thirty-two relations fits on a card.
 * If the options were a sample instead, most items would be easy for the wrong
 * reason — an option about containment, when the premises are about contact, gets
 * dismissed without being thought about.
 */
test("the options are the relations nearest the answer", () => {
    for (const { first, second, focusAt } of usableChains(5).slice(0, 80)) {
        const item = compositionItem(first, second, 5, focusAt)!;
        const focus = item.options[0];
        const ds = item.options.map(k => (k === focus ? -1 : relationDistance(focus, k)));
        equal(ds, [...ds].sort((a, b) => a - b),
            `${first} then ${second} offers its options out of order: ${ds.join(", ")}`);

        const worst = ds[ds.length - 1];
        const classifiable = [
            ...witnessedComposition(first, second),
            ...poolRelations().filter(k => !constraintAllows(item.constraint, k)),
        ];
        for (const other of classifiable) {
            if (item.options.includes(other)) continue;
            assert(relationDistance(focus, other) >= worst,
                `${other} is nearer the answer than an option that was offered`);
        }
    }
});

/**
 * Both halves are on every menu.
 *
 * All-possible means "select everything", all-impossible means "select nothing", and
 * either is one bit of evidence wearing several buttons.
 */
test("no item is select-all or select-none", () => {
    for (const size of [3, 4, 5, 6, 7, 8]) {
        for (const { first, second, focusAt } of usableChains(size)) {
            const item = compositionItem(first, second, size, focusAt)!;
            equal(item.options.length, size,
                `${first} then ${second} offers ${item.options.length} rather than ${size}`);
            assert(item.possible.length >= 1,
                `${first} then ${second} has nothing to select`);
            assert(item.possible.length < item.options.length,
                `${first} then ${second} wants everything selected`);
            equal(new Set(item.options).size, item.options.length,
                `${first} then ${second} offers the same relation twice`);
        }
    }
});

/* ------------------------------------------------------------------ *
 * The card                                                           *
 * ------------------------------------------------------------------ */

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
            hasRung: () => false, depthBonusFor: () => 0, dialFor: () => 0,
            mergeTarget: () => null,
        } as unknown as ProgressionService,
        forceConstruction: "off",
        hasRung: () => false,
        dialFor: () => 0,
        mergeTarget: () => null,
        random: (n?: number) => createDistinction(ctx, n ?? 2),
    };
    return ctx;
}

const RANGE = QUESTION_TYPE_SETTING_PARAMS[EnumQuestionType.ConcaveRegions];

function items(): Question[] {
    const ctx = context();
    const out: Question[] = [];
    seeded(20261702, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 5; rep++) {
                try { out.push(createConcaveRegions(ctx, n)); } catch { /* an undrawable draw */ }
            }
        }
    });
    assert(out.length > 20, `only ${out.length} items were built`);
    return out;
}

/**
 * **Every premise says all three clauses, including the ones that say "clear of".**
 *
 * `describeRelation` drops a `clear of` on the grounds that "apart from B, clear of
 * B's bay, with B clear of A's bay" says one thing three times. That is right for
 * prose and wrong for a premise, and wrong twice over.
 *
 * As a premise it is load-bearing: half the rules turn on a `clear of`, and a
 * sentence that leaves it unsaid leaves the reader unable to tell "clear of" from
 * "not mentioned" — so the item would be unanswerable while looking complete. As an
 * option it is worse: `A partly overlaps C` stands for four different relations, so
 * two options on one menu could be the same words with different answers.
 */
test("every premise and option states all three parts of the relation", () => {
    for (const q of items()) {
        for (const line of [...q.premises, ...(q.choices ?? [])]) {
            const text = strip(line);
            const bays = BAY_STANDING.filter(w => text.includes(w)).length;
            assert(/'s bay/.test(text), `a line names no bay at all: ${text}`);
            equal((text.match(/'s bay/g) ?? []).length, 2,
                `a line names one bay rather than both — the reader cannot tell "clear `
                + `of" from unsaid: ${text}`);
            assert(bays >= 1, `a line has bay clauses with no bay standing in them: ${text}`);
            assert(STANDING.some(w => text.includes(w)),
                `a line says nothing about how the two stand: ${text}`);
        }
        equal(new Set(q.choices).size, (q.choices ?? []).length,
            "two options on one card read the same");
    }
});

/**
 * The marked answer is the set the options describe.
 *
 * Read back off the card rather than trusted from the generator: the options are
 * built from relation keys and the answer is a list of positions into them, and a
 * mismatch between the two is the defect class this suite keeps finding — a marker
 * written in one place and read in another.
 */
test("the marked selection is the set the card's own options name", () => {
    for (const q of items()) {
        const [a, b, c] = q.bucket;

        /* Which relation a line says, found by writing every relation out and looking
           for the one that matches — the same way round as the card wrote it. */
        const readAs = (line: string, x: string, y: string) => {
            const text = strip(line);
            const hits = poolRelations()
                .filter(key => text === strip(spellOutRelation(parseKey(key), x, y)));
            equal(hits.length, 1,
                `"${text}" matches ${hits.length} relations rather than one`);
            return hits[0];
        };

        /* The premises come scrambled, so each is placed by which pair it is about. */
        const lines = q.premises.map(line => strip(line));
        const ab = lines.find(l => l.startsWith(a) && l.includes(b) && !l.includes(c));
        const bc = lines.find(l => l.startsWith(b) && l.includes(c) && !l.includes(a));
        assert(!!ab && !!bc, `the card's premises are not a chain: ${lines.join(" / ")}`);

        const first = readAs(ab!, a, b);
        const second = readAs(bc!, b, c);

        const offered = (q.choices ?? []).map(choice => readAs(choice, a, c));
        equal(new Set(offered).size, offered.length, "an option is offered twice");

        /* And the answer, rebuilt from the premises the card actually printed. */
        const witnessed = witnessedComposition(first, second);
        const expected = offered.filter(key => witnessed.includes(key)).sort();
        const marked = (q.selectAnswer ?? []).map(i => offered[i]).sort();
        equal(marked, expected,
            `after ${first} then ${second} the card marks a different set from the one `
            + "its own premises give");

        /* Nothing marked is a relation a rule forbids, and nothing unmarked is allowed
           to be one a rule permits — the two halves of the classification. */
        const constraint = provableConstraint(first, second);
        for (const key of offered) {
            const isMarked = marked.includes(key);
            assert(isMarked ? constraintAllows(constraint, key) : !constraintAllows(constraint, key),
                `${key} is ${isMarked ? "marked possible" : "not marked"} after ${first} `
                + `then ${second}, and the rules say the opposite`);
        }
    }
});

/**
 * `identical to` is never a premise.
 *
 * Not because the composition is wrong — it is exactly right, and that is the
 * problem. `A is identical to B` makes the answer the *other* premise copied out, so
 * the card looks like composition and is transcription.
 */
test("no premise says the two patches are the same", () => {
    for (const q of items()) {
        for (const line of q.premises) {
            assert(!strip(line).includes(STANDING[7]),
                `a premise says two patches are identical, which hands over the answer: `
                + strip(line));
        }
    }
});

/**
 * The explanation argues, and argues about this card.
 *
 * Every reason names the two ends it is about, and the count of ruled-out options
 * matches the card's own marking — a derivation that closes on the wrong number is
 * one a reader checks against the card and stops believing.
 */
test("the explanation gives its reasons and counts what it ruled out", () => {
    for (const q of items()) {
        const lines = q.explanation.map(strip);
        assert(lines.length >= 2, `an item explains itself in ${lines.length} lines`);

        const ruled = (q.choices?.length ?? 0) - (q.selectAnswer?.length ?? 0);
        assert(lines.some(l => l.includes(`${ruled} of the ${q.choices!.length}`)),
            `no line accounts for the ${ruled} options the card ruled out: ${lines.join(" / ")}`);

        /* And the names are the card's, not the placeholders the rules default to. */
        for (const line of lines) {
            assert(!/\bthe (first|second|third)\b/.test(line),
                `an explanation line still has a placeholder in it: ${line}`);
        }
        for (const key of q.selectAnswer ?? []) {
            const opt = strip(q.choices![key]);
            const stand = STANDING.find(w => opt.includes(w))!;
            assert(lines.some(l => l.includes(stand)),
                `the explanation never mentions a relation it marked possible: ${opt}`);
        }
    }
});

/**
 * The menu grows with the ask, and the supply does not run out.
 *
 * The menu is the mode's only growth axis — there are always two premises — so if it
 * did not move with `numOfPremises` the ladder's larger numbers would buy nothing.
 */
test("asking for more premises gives a longer menu", () => {
    const ctx = context();
    const widths = new Map<number, number>();
    seeded(20261703, () => {
        for (let n = RANGE.minNumOfPremises; n <= RANGE.maxNumOfPremises; n++) {
            for (let rep = 0; rep < 4; rep++) {
                try {
                    const q = createConcaveRegions(ctx, n);
                    equal(q.premises.length, 2,
                        `${n} premises asked for gave ${q.premises.length} — the chain is `
                        + "three patches and the count is the menu");
                    widths.set(n, q.choices!.length);
                } catch { /* an undrawable draw */ }
            }
        }
    });
    const seen = [...widths.entries()].sort((a, b) => a[0] - b[0]);
    equal(seen.length, RANGE.maxNumOfPremises - RANGE.minNumOfPremises + 1,
        `only ${seen.length} of the settable premise counts built an item`);
    for (let i = 1; i < seen.length; i++) {
        assert(seen[i][1] > seen[i - 1][1],
            `${seen[i][0]} premises offers ${seen[i][1]} options and ${seen[i - 1][0]} `
            + `offers ${seen[i - 1][1]} — the extra premise bought nothing`);
    }
});
