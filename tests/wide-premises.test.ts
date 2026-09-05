/**
 * A rung that is claimed and not honoured.
 *
 * `wide-premises` was taken off the ladder because the merge fired only on
 * *consecutive stored* edges sharing the first one's second endpoint. A plain
 * chain has that for every pair; a branching layout almost never does — and
 * `branching` is earned two rungs earlier, so by the time this was reached
 * every item had it and most merged nothing. The rung was claimed and the item
 * rendered exactly as an item without it, for everyone who ever got there.
 *
 * It is back because the merge now pairs any two links sharing an object,
 * wherever they sit. What has to hold is that it fires on the layouts the mode
 * actually builds — which is the branching ones.
 */

import { assert, equal, seeded, test } from "./harness";
import { LINEAR_SCALES, buildBranching, buildChain, renderPremises }
    from "../src/app/syllogimous/utils/linear.utils";
import { integrationLoad } from "../src/app/syllogimous/utils/integration.utils";

const SCALE = LINEAR_SCALES["quantity"];
const WORDS = ["Kiwi", "Doll", "Rice", "Beanstalk", "Anchor", "Cobweb", "Tunnel"];

/** The joined form, which is the only thing the rung produces. */
const merged = (premises: string[]) => premises.filter(p => p.includes(", which ")).length;

test("a chain merges its links in pairs", () => {
    seeded(21, () => {
        const layout = buildChain(WORDS.slice(0, 6));
        const wide = renderPremises(SCALE, layout, { wide: true });
        const plain = renderPremises(SCALE, layout, {});
        assert(merged(wide.premises) > 0, "a chain merged nothing");
        assert(wide.premises.length < plain.premises.length,
            `the wide form should say the same links in fewer sentences:`
            + ` ${wide.premises.length} against ${plain.premises.length}`);
    });
});

/**
 * The case the rung was retired for. Every item that reaches this rung has
 * branching, so if it does not fire here it does not fire at all.
 */
test("a branching layout merges every link it can, not just some", () => {
    let merges = 0, items = 0, over = 0;
    seeded(404, () => {
        for (let i = 0; i < 60; i++) {
            const layout = buildBranching(WORDS);
            const wide = renderPremises(SCALE, layout, { wide: true });
            items++;
            merges += merged(wide.premises);
            // A connected layout can pair every link but one, at worst.
            if (wide.premises.length > Math.ceil(layout.edges.length / 2) + 1) over++;
        }
    });

    equal(over, 0, "an item left more links unpaired than a connected layout should");
    /*
     * Measured: pairing over the whole edge set reaches 3.00 merges an item on
     * these layouts, and the consecutive-stored rule this replaces reaches 1.75
     * — it merged *something* on 58 of 60, which is why "did anything merge"
     * cannot tell the two apart. What it could not do was merge everything, so
     * items came out 42% longer than the rung promises.
     */
    assert(merges / items >= 2.5,
        `${(merges / items).toFixed(2)} merges an item, against 3.00 when every`
        + " link is paired — the rung is being claimed and half honoured");
});

test("the same links are stated, and no object is invented", () => {
    seeded(7, () => {
        const layout = buildBranching(WORDS);
        const wide = renderPremises(SCALE, layout, { wide: true });
        const named = new Set(
            wide.premises.join(" ").match(/<span class="subject">([^<]*)<\/span>/g) ?? []);
        for (const word of layout.words) {
            assert(wide.premises.join(" ").includes(`>${word}<`),
                `${word} is in the layout and on no premise`);
        }
        assert(named.size <= layout.words.length,
            "a premise named something the layout does not contain");
    });
});

/**
 * The tail used to be recovered by stripping the second half's subject with a
 * regex whose object class was `[^<]`, which cannot match a subject containing
 * markup — a stimulus nesting a span inside one would have produced "A is above
 * B, which B is above C", silently. It is built rather than recovered now.
 */
test("the joined half does not repeat the object it runs through", () => {
    seeded(99, () => {
        const layout = buildChain(WORDS.slice(0, 5));
        for (const premise of renderPremises(SCALE, layout, { wide: true }).premises) {
            if (!premise.includes(", which ")) continue;
            const subjects = [...premise.matchAll(/<span class="subject">([^<]*)<\/span>/g)]
                .map(m => m[1]);
            equal(subjects.length, 3,
                `a joined premise should name three objects, and named`
                + ` ${subjects.length}: ${premise.replace(/<[^>]+>/g, "")}`);
            equal(new Set(subjects).size, 3, "a joined premise repeated an object");
        }
    });
});

test("negations in both halves are counted", () => {
    seeded(3, () => {
        let sawBoth = false;
        for (let i = 0; i < 40; i++) {
            const layout = buildChain(WORDS.slice(0, 6));
            const out = renderPremises(SCALE, layout, { wide: true, negate: true });
            const struck = out.premises.join(" ").match(/class="is-negated"/g)?.length ?? 0;
            equal(out.negations, struck,
                `reported ${out.negations} negations against ${struck} on the card`);
            if (struck >= 2) sawBoth = true;
        }
        assert(sawBoth, "no item negated twice, so the joined halves were not both tested");
    });
});

/**
 * What the item is measured as, from the premises the mode actually renders.
 *
 * A joined sentence names three objects and states two binary relations sharing
 * a middle term. Read as one relation it reports the player as having held
 * three things at once, which is what separates it from a genuinely ternary
 * premise — and the arity number is meant to be fitted against answers, so an
 * overstatement here becomes a coefficient later.
 *
 * The reader splits on a marker the writer puts there. This is the half that
 * checks the writer: everything else passes just as well when the join goes out
 * unmarked.
 */
test("a rendered wide item measures as the two binary steps it is", () => {
    seeded(17, () => {
        for (let i = 0; i < 20; i++) {
            const layout = buildChain(WORDS.slice(0, 6));
            const wide = renderPremises(SCALE, layout, { wide: true });
            if (!merged(wide.premises)) continue;
            equal(integrationLoad(wide.premises).arity, 2,
                "a joined sentence was measured as one relation over three objects:\n  "
                + wide.premises.find(p => p.includes(", which "))!.replace(/<[^>]+>/g, ""));
        }
    });
});

test("and a branching one too, where every link is joined", () => {
    seeded(404, () => {
        for (let i = 0; i < 20; i++) {
            const layout = buildBranching(WORDS);
            const wide = renderPremises(SCALE, layout, { wide: true });
            if (!merged(wide.premises)) continue;
            equal(integrationLoad(wide.premises).arity, 2,
                "a branching item's joined sentences were measured as ternary");
        }
    });
});
