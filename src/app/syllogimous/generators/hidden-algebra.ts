/**
 * Hidden Algebra — work out what the relation is, then use it.
 *
 * Ported from Isomorph, whose guide is the whole design: *"An invented word
 * names a relation, and its algebra is what you have to find. The first list is
 * complete: among those entities, these are the only times it holds. Does it run
 * both ways? Does it chain? Do two steps come back round? Only one reading fits
 * the list. Then use it: select every way the two named entities of the second
 * group could stand. Several at once means the facts do not settle it."*
 *
 * Two halves, and neither is the mode on its own. The first is induction: a
 * complete table over a handful of entities, from which exactly one of the
 * relation systems could have produced it. The second is the possibility
 * question — a different group, stated only partly, and the outcomes the
 * premises leave open. Getting the algebra wrong does not make the second half
 * hard; it makes it wrong, which is the point of putting them on one card.
 *
 * ── "Only one reading fits the list" ──
 *
 * That is a claim, and it is checked rather than hoped for: every other system
 * is asked whether any of *its* arrangements over the same entities produces
 * exactly this table, and the draw is thrown away if one can. Without it the
 * first half would sometimes have two answers and the second half would be
 * marked against whichever the generator happened to pick — an item that is
 * wrong rather than hard, and wrong invisibly.
 *
 * This is the enumeration earning its keep. "Is there another relation that
 * would look like this?" has no shortcut; it is a search of the same state
 * spaces the second half filters, asked of every other system.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { getRandomSymbols, pickUniqueItems } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { ALL_SYSTEMS, RelationSystem } from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { INVENTED, InventedWord, buildPossibility } from "./possibility";

/** The pairs a relation holds between, as a comparable key. */
function tableOf(system: RelationSystem, state: number[], n: number): string {
    const out: string[] = [];
    for (let a = 0; a < n; a++) {
        for (let b = 0; b < n; b++) {
            if (a !== b && system.holds(state, a, b)) out.push(`${a}>${b}`);
        }
    }
    return out.join(",");
}

/**
 * Whether any other system could have produced this table.
 *
 * The uniqueness the first half rests on. Asked of every system rather than of
 * the plausible ones, because "plausible" is exactly the judgement that would
 * quietly stop being true when a system was added.
 */
function anotherReadingFits(system: RelationSystem, table: string, n: number): boolean {
    return ALL_SYSTEMS.some(other =>
        other !== system
        && n <= other.maxN
        && other.states(n).some(state => tableOf(other, state, n) === table));
}

/**
 * Whether the list contains a two-step path, so chaining can be read off it.
 *
 * `A` to `B` and `B` to `C`, with `C` not `A` — the one shape that makes "does it
 * chain?" a question about the list rather than about what else it could have
 * been. The `C !== A` is the whole point: `A` to `B` and `B` back to `A` is the
 * relation running both ways, which is a different property and is already
 * visible without it.
 */
function chainIsVisible(table: string): boolean {
    const pairs = table.split(",").map(p => p.split(">").map(Number));
    return pairs.some(([a, b]) => pairs.some(([c, d]) => b === c && d !== a));
}

export function createHiddenAlgebra(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createHiddenAlgebra");

    const type = EnumQuestionType.HiddenAlgebra;

    /*
     * Four in the first group. Not a correctness bound — the uniqueness check
     * below rejects an ambiguous list at any size — but a yield one: at three
     * entities most tables are produced by more than one relation, so most
     * draws are thrown away, and at five the list is long enough that reading
     * it becomes the work instead of the induction.
     */
    const shownOver = 4;

    for (let attempt = 0; attempt < 200; attempt++) {
        const system = pickUniqueItems(ALL_SYSTEMS.filter(s => s.maxN >= shownOver), 1).picked[0];
        const states = system.states(shownOver);
        if (!states.length) continue;

        const state = states[Math.floor(Math.random() * states.length)];
        const table = tableOf(system, state, shownOver);
        /*
         * A table with nothing in it, or with everything, is one every system
         * can produce and none is identified by — and it is also a list the
         * reader learns nothing from.
         */
        if (!table || table.split(",").length >= shownOver * (shownOver - 1)) continue;
        if (anotherReadingFits(system, table, shownOver)) continue;
        /*
         * **The list has to exercise chaining, not merely be consistent with it.**
         *
         * Uniqueness says one reading fits; it does not say the reader can see
         * which. A complete list of "Glass brands Onion, Onion brands Glass"
         * among four names is produced by sameness-of-group and by nothing else —
         * but there is no two-step path in it, so whether the relation *chains* is
         * never put to the test. The only route to the answer is to eliminate the
         * seven other readings from memory, which is a catalogue the card does not
         * give and a player has no reason to hold.
         *
         * With a two-step path in the list the induction is one the evidence
         * supports: `A` to `B` and `B` to `C` are both there, so either `A` to `C`
         * is there and it chains, or it is absent and it does not. Three quarters
         * of the lists that pass the uniqueness check already have one.
         */
        if (!chainIsVisible(table)) continue;

        const word: InventedWord = INVENTED[Math.floor(Math.random() * INVENTED.length)];
        const first = getRandomSymbols(ctx.settings, shownOver);
        if (new Set(first).size !== shownOver) continue;

        const lead = table.split(",").map(pair => {
            const [a, b] = pair.split(">").map(Number);
            return `${subj(first[a])} ${rel(word.third)} ${subj(first[b])}`;
        });

        /*
         * The second half is the possibility question, asked of the system the
         * first half identifies — the same builder Possibility Sets and Cyclic
         * Dominance use, given one system and the word already in play.
         *
         * It draws its own entities, and that is the point rather than an
         * economy: the algebra has to be carried across to a group it says
         * nothing about directly. A relation learnt as "these four names" is
         * not a relation learnt.
         */
        let question: Question;
        try {
            question = buildPossibility(ctx, numOfPremises, type, [system], {
                word,
                lead: [
                    `<b>Among ${first.map(w => subj(w)).join(", ")}, these are the `
                    + `<em>only</em> times ${rel(word.third)} holds:</b>`,
                    ...lead,
                    "<b>A second group, of which only some is stated:</b>",
                ],
                setup: [
                    `<b>${hi(word.third)}</b> names a relation, and what kind of relation `
                    + "it is is not stated — the first list is complete, so work it out "
                    + "from that. Does it run both ways? Does it chain? Do two steps come "
                    + "back round?",
                    "Then use it on the second group: select <b>every</b> way the two named "
                    + "could stand. Several at once means the facts do not settle it.",
                ],
            });
        } catch { continue; }

        /*
         * The first half named as part of the derivation, since getting the
         * algebra wrong is the way this mode is got wrong and the survivors
         * alone would not say so.
         */
        question.explanation = [
            `the first list is only produced by ${rel(word.third)} being `
            + `${system.meaning}`,
            ...question.explanation,
        ];
        return question;
    }

    throw new Error("Cannot generate.");
}
