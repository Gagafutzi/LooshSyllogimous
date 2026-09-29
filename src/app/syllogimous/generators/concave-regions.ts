/**
 * Concave Regions — Region Connection when the regions have a hollow in them.
 *
 * RCC8 asks how two regions stand, and over convex regions that is the whole story.
 * Cut a bay into one and it stops being the whole story in one specific place: a
 * patch nestling *inside* another's bay, touching nothing, and a patch lying
 * somewhere else entirely are both `apart from`. RCC8 has one word for two
 * situations that could not be less alike, and Cohn's RCC23 and its refinements
 * exist to name the difference. `concave-regions.utils` builds the naming; this is
 * the mode that asks about it.
 *
 * ── Why this is not Region Connection with more words ──
 *
 * Region Connection gets its exact answer set by *enumerating* every qualitative
 * arrangement of three rectangles — 167,281 of them — and that is what lets it say
 * "these five and no others". The same enumeration over three patches would run
 * over the interleavings of twelve x-coordinates against twelve y's, which is not a
 * number anything finishes. So the answer here cannot be enumerated, and a
 * *sampled* answer would be worse than none: a sample can only ever be too small,
 * so the card would omit a relation that is genuinely possible and mark a reader
 * wrong for finding it.
 *
 * What makes the mode work is that the two directions are not symmetrical.
 * **Possible** is settled by one actual triple of patches, so sampling is sound in
 * that direction by construction. **Impossible** is settled by a rule about regions
 * — "A is within B, and B shares no point with C, so neither does A" — which holds
 * over every region there is. Nothing else is offered. So the menu is exactly the
 * relations something can be *proved* about, and the reader's task ("rule out what
 * the premises forbid, select what is left") and the marked answer are the same set
 * with no gap between them.
 *
 * ── Why the menu is short when the calculus is not ──
 *
 * Thirty-two relations is far past what a card can show, which is the problem this
 * mode had to solve before it could exist. Showing a sample of them would make most
 * items easy for the wrong reason: an option about containment, when the premises
 * are about contact, gets dismissed without being thought about.
 *
 * So the options are the *closest* relations to one of the answers, by the paper's
 * own measure — the number of cells two intersection matrices differ in. Every
 * option is then a relation that very nearly holds, most of them differing from the
 * answer in one clause, and none can be dropped at a glance. The limit on what the
 * card shows is the same thing as the limit on what makes the item hard, which is
 * the only kind of shortening worth having.
 *
 * ── What grows ──
 *
 * The menu, and nothing else. There are always two premises: the chain is three
 * patches and the third pair is the question. A fourth patch would need the
 * composition of a composition, and the intermediate relation is not determined —
 * so that would need the exact set this mode has just finished explaining it cannot
 * have. What each extra option costs is real, though: another relation to find an
 * argument about, and `guessRateFor` prices a selection at one subset in `2^n`.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems } from "../utils/question.utils";
import { hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    BAY_STANDING, STANDING, compositionItem, parseKey, provableConstraint, spellOutRelation,
    usableChains,
} from "../utils/concave-regions.utils";
import { GeneratorContext } from "./context";

/**
 * The relation as a premise, with every clause said.
 *
 * All three, always — `describeRelation` drops a `clear of` as redundant and it is
 * not: half the rules turn on it, and a sentence that leaves it out leaves the
 * reader unable to tell "clear of" from "not mentioned".
 */
function statement(key: string, a: string, b: string): string {
    const r = parseKey(key);
    return `${subj(a)} ${rel(STANDING[r.stands])} ${subj(b)}, `
        + `${rel(BAY_STANDING[r.inTheirBay])} ${subj(b)}'s bay, `
        + `with ${subj(b)} ${rel(BAY_STANDING[r.theyInMine])} ${subj(a)}'s bay`;
}

/**
 * The same relation as an option, on two lines.
 *
 * Split the way Region Connection splits its eight: how they stand as regions on
 * the first line, the two bay clauses muted under it. The options are each other's
 * nearest neighbours and most of them differ in one clause, so a reader scanning
 * eight one-line sentences would be hunting for the difference rather than
 * reasoning about it — the standing above and the bays below makes the clause that
 * differs land in the same place every time.
 */
function option(key: string, a: string, b: string): string {
    const r = parseKey(key);
    /* The comma stays on the first line, so stripping the markup gives back exactly
       what `spellOutRelation` writes — which is how the card's own text is checked
       against the relation it was built from. */
    return `${subj(a)} ${rel(STANDING[r.stands])} ${subj(b)}, `
        + '<span class="d-block small text-muted">'
        + `${rel(BAY_STANDING[r.inTheirBay])} ${subj(b)}'s bay, `
        + `with ${subj(b)} ${rel(BAY_STANDING[r.theyInMine])} ${subj(a)}'s bay</span>`;
}

/**
 * How long the menu is.
 *
 * Three at the floor, because a selection shorter than that is a choice wearing a
 * submit button — which `registries.test.ts` says in as many words. Eight at the
 * ceiling: the supply of chains stops growing past a seven-long menu, so a ninth
 * option would be the same items with a relation added that nothing was straining
 * to exclude.
 */
const menuSize = (numOfPremises: number) => Math.max(3, Math.min(8, numOfPremises + 1));

export function createConcaveRegions(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createConcaveRegions");

    const type = EnumQuestionType.ConcaveRegions;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const size = menuSize(numOfPremises);
    const chains = usableChains(size);
    if (!chains.length) throw new Error("Cannot generate.");

    for (let attempt = 0; attempt < 200; attempt++) {
        const words = getRandomSymbols(settings, 3);
        if (new Set(words).size !== 3) continue;
        const [a, b, c] = words;

        const chain = pickUniqueItems(chains, 1).picked[0];
        const item = compositionItem(chain.first, chain.second, size, chain.focusAt);
        if (!item) continue;                       // `usableChains` says it does

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = orderPremises(
            [statement(chain.first, a, b), statement(chain.second, b, c)],
            ctx.settingsOverrideService.scramble,
            ctx.mergeTarget());

        question.choices = item.options.map(key => option(key, a, c));
        question.selectAnswer = item.options
            .map((key, i) => ({ key, i }))
            .filter(({ key }) => item.possible.includes(key))
            .map(({ i }) => i);
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select every relation that is still possible.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            "These are patches of a surface, each with a <b>bay</b> cut into one edge. "
            + "How two of them stand takes three parts: how they stand as patches, "
            + "whether the first sits in the second's bay, and whether the second sits "
            + "in the first's.",
            /*
             * No "below" and no "left" in this line, which is not fussiness: the
             * relation table knows both words, so minimal mode marks them away and
             * the sentence came out with a direction glyph in the middle of it.
             * `tests/minimal-coverage.test.ts` catches it, and it catches it in the
             * setup rather than the premises because the setup is the half nobody
             * thinks of as prose about relations.
             */
            `Each option is one of the few that nearly holds. Rule out every one the `
            + `two premises <b>forbid</b>, and select the rest as still possible for `
            + `${subj(a)} and ${subj(c)}.`,
        ];

        /* Asked again with the names in it: the rules phrase their arguments around
           whatever they are given, and "the first" is only the placeholder. */
        const because = provableConstraint(
            chain.first, chain.second, subj(a), subj(b), subj(c)).because;
        question.explanation = explain(item, because, a, c);
        return question;
    }

    throw new Error("Cannot generate.");
}

/**
 * Why those and not the others.
 *
 * The rules' own arguments, printed. This is the thing a composition table cannot
 * do and the reason the rules exist in the form they do: a table can say a relation
 * is impossible, and "why" is the only part worth reading. What is left over is
 * stated as what it is — each of these has an arrangement of three patches behind
 * it, which is why it is not ruled out.
 */
function explain(
    item: { options: string[]; possible: string[] },
    because: string[],
    a: string, c: string,
): string[] {
    const out = [...because];
    const ruled = item.options.length - item.possible.length;
    out.push(`so ${hi(String(ruled))} of the ${item.options.length} `
        + `${ruled === 1 ? "is" : "are"} ruled out — each would need an arrangement the `
        + "premises forbid");

    /* Said once, then the survivors listed. Repeating it under each of them read as
       five copies of one sentence, which is what the reader has to skip past to find
       the relation the line is actually about. */
    out.push(`what is not ruled out can be laid out with three real patches, so `
        + `${item.possible.length === 1 ? "this stands" : "these all stand"}:`);
    for (const key of item.possible) out.push(spellOutRelation(parseKey(key), a, c));
    return out;
}
