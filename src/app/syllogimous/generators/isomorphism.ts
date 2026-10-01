/**
 * The Isomorphism family — same structure, different names.
 *
 * Four modes in one file, on the precedent `ndspace.ts` sets for the composed
 * spaces: they are the same question asked four ways over one substrate, and the
 * wording of an arrow has to be identical across them or two cards that mean the
 * same thing read differently. What varies is which sub-structure is asked about.
 *
 * ── What they share, and why it is the hard part ──
 *
 * Every entity here is named, and the names carry nothing. Position carries
 * nothing either — there is no space, only arrows. So the only thing a reader can
 * work with is the pattern of connections, and the only way to compare two
 * patterns is to try to line them up. That is why these are late modes: nothing
 * about them can be read off one premise, and nothing accumulates along a chain
 * the way a relation does.
 *
 * The systems on a card are given *separate vocabularies* rather than headings.
 * A heading is a line that is not a premise, and the reader has to be told which
 * block it governs; distinct names make the grouping a property of the sentences
 * themselves, which is also how Isomorph does it.
 *
 * ── Two candidates where Isomorph offers three or four ──
 *
 * Structure Match and Motif Search are choices, and this app holds a choice to
 * two options unless the options are the card's own premises. Three candidate
 * systems would be a menu of three claims about three different groups — the
 * case the rule was written about. Two makes the floor a half rather than a
 * third, which makes the item harder, and the decoy is built to be one arrow away
 * so it cannot be dismissed by counting.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { canGenerateQuestion, clampPremises } from "../models/settings.models";
import { getRandomSymbols, pickUniqueItems, shuffle } from "../utils/question.utils";
import { EDGE_WORDS, hi, rel, subj } from "../utils/phrasing";
import { orderPremises } from "../utils/premise-order.utils";
import {
    Web, cloneWeb, edgesOf, induced, isomorphic, largestCommon, motifSites, oddPairs,
    permuteWeb, randomPermutation, randomWeb,
} from "../utils/web.utils";
import { GeneratorContext } from "./context";

/**
 * One arrow, in the words the rest of the app already uses for arrows.
 *
 * Taken from `EDGE_WORDS` rather than written here. Graph Matching keeps a local
 * copy of the same three words and its own comment says why that was a mistake:
 * a wording that appears in no scale and in no `rel()` literal is invisible to
 * both checks that guard the symbol switch, so the card stayed English while the
 * premises around it converted.
 */
const arrow = (a: string, b: string) => `${subj(a)} ${rel(EDGE_WORDS["→"])} ${subj(b)}`;

/** A whole system as sentences, one per arrow. */
const systemLines = (w: Web, names: string[]) =>
    edgesOf(w).map(([i, j]) => arrow(names[i], names[j]));

/** A group named by its members, for an option that says what it means. */
const groupText = (names: string[]) => names.length === 1
    ? subj(names[0])
    : `${names.slice(0, -1).map(subj).join(", ")} and ${subj(names[names.length - 1])}`;

/**
 * A web with some shape to it, and enough of it to be worth comparing.
 *
 * Rejected when it has too few arrows to constrain anything or so many that every
 * group looks like every other. Drawn rather than constructed because the modes
 * need webs whose *structure* varies, and a construction that guaranteed
 * interesting structure would guarantee a recognisable one.
 */
function drawWeb(n: number, lo: number, hi2: number): Web | null {
    for (let attempt = 0; attempt < 200; attempt++) {
        const w = randomWeb(n, 0.3);
        const count = edgesOf(w).length;
        if (count < lo || count > hi2) continue;
        /*
         * And nobody is left out of the arrows entirely.
         *
         * An entity with no arrow at all appears in no premise, and these modes
         * name entities in their options — so the card offered a group containing
         * a name the premises never mentioned, which is not a hard item but an
         * unanswerable one. Caught by the check that a conclusion may only name
         * what the premises name, which is exactly the class of defect it is for.
         */
        const touched = (v: number) =>
            w.adj[v].some(Boolean) || w.adj.some(row => row[v]);
        if (![...Array(n).keys()].every(touched)) continue;
        return w;
    }
    return null;
}

/**
 * The same web with one arrow changed — added or removed.
 *
 * The decoy for both choice modes. One arrow is the smallest possible difference
 * and the only one worth offering: two arrows apart is usually visible in the
 * arrow *count*, and a reader who has learned to count has learned to skip the
 * comparison the mode exists for.
 */
function oneArrowOff(w: Web): Web[] {
    const out: Web[] = [];
    for (let i = 0; i < w.n; i++) {
        for (let j = 0; j < w.n; j++) {
            if (i === j) continue;
            const other = cloneWeb(w);
            other.adj[i][j] = !other.adj[i][j];
            if (!isomorphic(other, w)) out.push(other);
        }
    }
    return shuffle(out);
}

/* ------------------------------------------------------------------ *
 * Structure Match — which of these two is the same system renamed     *
 * ------------------------------------------------------------------ */

/**
 * A total analogy between systems.
 *
 * Isomorph's guide: *"One system to match, candidates stated in premises of their
 * own. One is the same structure renamed; the others differ by one relation, with
 * the same relations occurring about as often, so counting does not tell."*
 *
 * The plainest question in the family and the right one to arrive first: no
 * sub-structure, no partial match, just "is this the same thing with the names
 * changed". Everything later in the family is this question asked of a part.
 *
 * The decoy has the *same number of arrows* as the original, which is the whole
 * of the construction. A candidate one arrow short is told apart by counting
 * arrows, which is not comparing structures — so the decoy swaps an arrow out for
 * an arrow in, and the reader has to line the two systems up.
 */
export function createStructureMatch(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createStructureMatch");

    const type = EnumQuestionType.StructureMatch;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    /* Four entities a side. Three has too few shapes for a decoy one arrow away
       to exist at all; five triples the premises for the same question. */
    const n = 4;

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, 3 * n);
        if (new Set(words).size !== 3 * n) continue;
        const [ref, same, off] = [words.slice(0, n), words.slice(n, 2 * n), words.slice(2 * n)];

        const base = drawWeb(n, Math.max(3, numOfPremises - 2), numOfPremises);
        if (!base) continue;

        const twin = permuteWeb(base, randomPermutation(n));

        /*
         * A decoy with the same arrow count, so counting cannot answer it.
         *
         * One arrow off changes the count by one, so the count is restored by
         * moving a second arrow the other way — and the result is checked not to
         * be the original after all, which a pair of changes can easily be.
         */
        const nearly = oneArrowOff(base).map(w => {
            for (const other of oneArrowOff(w)) {
                /*
                 * Two conditions, and only two.
                 *
                 * This had three — the second flip going the opposite way, the
                 * count matching, and the result re-checked after permuting — and
                 * mutation found all three individually redundant: any one of them
                 * forces the arrow count back on its own, so no single deletion
                 * could be caught. Three checks that cannot fail are three claims
                 * of coverage that are false, so two are gone. What is left is the
                 * pair that says what the decoy has to be.
                 */
                if (edgesOf(other).length !== edgesOf(base).length) continue;
                if (isomorphic(other, base)) continue;
                return other;
            }
            return null;
        }).find(w => !!w);
        if (!nearly) continue;

        const decoy = permuteWeb(nearly, randomPermutation(n));

        const shown = shuffle([
            { names: same, web: twin, right: true },
            { names: off, web: decoy, right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(base, ref), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...shown.flatMap(c => orderPremises(systemLines(c.web, c.names), ctx.settingsOverrideService.scramble, ctx.mergeTarget())),
        ];
        question.choices = shown.map(c => groupText(c.names));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = "Which group is the same system renamed?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `${groupText(ref)} form one system. Two other groups form systems of `
            + "their own, stated in their own premises.",
            `Exactly ${hi("one")} of them is the first system with the names changed — `
            + "the same arrows between the matching entities. The other is one arrow "
            + "different, and has <b>as many arrows</b>, so counting them settles nothing.",
        ];

        question.explanation = [
            `the first system has ${hi(String(edgesOf(base).length))} arrows, and so does `
            + "each of the other two",
            `${groupText(shown[question.correctChoice].names)}: every arrow lines up with `
            + "one of the first system's, under one matching of the names",
            `${groupText(shown[1 - question.correctChoice].names)}: no matching of the `
            + "names lines all of them up — one arrow runs between the wrong pair",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}

/* ------------------------------------------------------------------ *
 * Motif Search — where the pattern sits in the larger system          *
 * ------------------------------------------------------------------ */

/**
 * A small system hidden inside a larger one.
 *
 * Isomorph's guide: *"A small system — the pattern, with its own names — and a
 * larger one. Exactly one group of the larger system's entities stands to each
 * other as the pattern's do, and nothing points at it."*
 *
 * Structure Match compares two whole systems, which a reader can do by lining up
 * the degree of each entity. This cannot be done that way: the group is *inside*
 * a larger system, so every entity in it has arrows to entities outside it that
 * have nothing to do with the pattern. The comparison has to be made on the
 * arrows within the group and nowhere else, which is exactly what makes the
 * sub-structure induced.
 *
 * "Exactly one group" is checked over *every* group of the host, not just the two
 * offered — otherwise the card's claim is about the menu rather than about the
 * system, and a reader who found a third group would be right.
 */
export function createMotifSearch(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createMotifSearch");

    const type = EnumQuestionType.MotifSearch;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    const pat = 3;
    const host = Math.min(7, Math.max(5, numOfPremises - 1));

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, pat + host);
        if (new Set(words).size !== pat + host) continue;
        const patNames = words.slice(0, pat);
        const hostNames = words.slice(pat);

        const big = drawWeb(host, host, host * 2);
        if (!big) continue;

        /* The pattern is cut out of the host, so it is there by construction —
           and then the host is required to contain it exactly once. */
        const sites = motifSites(big, induced(big, [0, 1, 2]));
        if (sites.length !== 1) continue;
        const site = sites[0];
        const pattern = induced(big, site);
        /*
         * **Nobody in the pattern is left out of the pattern's own arrows.**
         *
         * `drawWeb` makes this true of the host, and it is not enough: the pattern
         * is *cut out* of the host, so an entity with plenty of arrows in the big
         * system can have none at all inside the three that were taken. It was then
         * named in "A, B and C are the pattern" and appeared in no premise — the
         * card introducing an entity it never says anything about, in one item in
         * ten. A reader who goes looking for what it does finds nothing, which is
         * not a hard item but an unanswerable-looking one.
         *
         * The same reasoning as `drawWeb`'s own check, applied where it was
         * missing. It is not caught by "a conclusion names only what the premises
         * name", because the entity is named in the *setup* rather than in the
         * conclusion or the options.
         *
         * This also replaces the arrow count that used to stand here: three
         * entities cannot all be touched by fewer than two arrows, so "at least
         * two" was the weaker half of what this says.
         */
        const held = (v: number) =>
            pattern.adj[v].some(Boolean) || pattern.adj.some(row => row[v]);
        if (![...Array(pattern.n).keys()].every(held)) continue;

        /*
         * The decoy group is one arrow away from the pattern — the fewest
         * relations wrong, as Isomorph puts it. A group two arrows off is told
         * apart by counting the arrows inside it.
         */
        const others = [...Array(host).keys()];
        const decoys = shuffle(
            [...Array(host).keys()].flatMap(a => others.flatMap(b => others.map(c => [a, b, c])))
                .filter(g => new Set(g).size === 3 && g.join(",") !== [...site].sort().join(","))
                .map(g => [...g].sort((x, y) => x - y))
                .filter((g, i, all) => all.findIndex(h => h.join(",") === g.join(",")) === i))
            .find(g => {
                const sub = induced(big, g);
                if (isomorphic(sub, pattern)) return false;      // would be a second site
                return edgesOf(sub).length === edgesOf(pattern).length;
            });
        if (!decoys) continue;

        const shown = shuffle([
            { group: site, right: true },
            { group: decoys, right: false },
        ]);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(pattern, patNames), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(systemLines(big, hostNames), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
        ];
        question.choices = shown.map(c => groupText(c.group.map(i => hostNames[i])));
        question.correctChoice = shown.findIndex(c => c.right);
        question.answerMode = "choice";
        question.choicePrompt = "Which group stands to each other as the pattern does?";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `${groupText(patNames)} are the <b>pattern</b>. The rest form one larger `
            + "system.",
            "Exactly one group of the larger system stands to each other exactly as the "
            + "pattern's entities do — counting only the arrows <b>within</b> the group, "
            + "since arrows leading out of it are not part of the pattern.",
        ];

        const right = shown[question.correctChoice].group;
        const wrong = shown[1 - question.correctChoice].group;
        question.explanation = [
            `the pattern has ${hi(String(edgesOf(pattern).length))} arrows among its three `
            + "entities, and so does each group offered",
            `${groupText(right.map(i => hostNames[i]))}: the arrows among these three `
            + "match the pattern's under one matching of the names",
            `${groupText(wrong.map(i => hostNames[i]))}: as many arrows, running between `
            + "the wrong pair of them",
            "and no other group of the larger system matches either, so this is the one",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}

/* ------------------------------------------------------------------ *
 * Partial Isomorphism — who has no counterpart                        *
 * ------------------------------------------------------------------ */

/**
 * Two systems alike but for one entity each.
 *
 * Isomorph's guide: *"Two systems are the same structure except for one entity on
 * each side: leave those out and a renaming of the rest of one gives the rest of
 * the other. Select the entities of the first system that have no counterpart,
 * then those of the second."*
 *
 * Isomorph asks for the two sides in turn. Asked as one selection over both
 * systems' entities together it is the same question and a harder one: the reader
 * cannot use the first answer to narrow the second, and the floor is one subset in
 * `2^(2n)` rather than two picks of one in `n`.
 *
 * The item is only well formed when *exactly one* pair works. A system with a
 * symmetry usually offers several — two entities that could equally be the odd one
 * out — and the card would then mark one of several right answers wrong with
 * nothing about it looking amiss. That is checked over every pair, not assumed
 * from how the item was built.
 */
export function createPartialIsomorphism(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createPartialIsomorphism");

    const type = EnumQuestionType.PartialIsomorphism;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    /*
     * Four a side at the floor, five above it.
     *
     * Five everywhere made the easiest item of this mode a card of ten entities,
     * sixteen arrow statements and a menu of ten to select from — which is the
     * hardest shape in the family, offered as the first rung of it. Four a side
     * is thirteen statements and a menu of eight, and it draws a well-formed item
     * once in four attempts against five-a-side's one in two: rarer, and nowhere
     * near the three hundred the loop allows.
     *
     * Four only at the floor, and this is why: the shared core of a four-a-side
     * item saturates at six arrows — `(n - 1) * (n - 2)` with `n` four — so from
     * eight premises up it would build the same item while the ladder printed a
     * larger number. That is the exact failure the note below records, so the
     * rung that would cause it is the rung that hands over to five.
     */
    const n = numOfPremises <= 6 ? 4 : 5;
    /*
     * The count is the arrows, and it has to be: drawn at a fixed density this
     * mode built the same item whether it was asked for six premises or ten,
     * while the ladder went on printing the number it had asked for. That is the
     * failure Graph Matching's own note records — a player watching "2p" become
     * "7p" beside an item that never changed — so the shared core's arrow count
     * is taken from the ask, and the two extra entities add to it from there.
     */
    const core = Math.max(3, Math.min((n - 1) * (n - 2), numOfPremises - 2));

    for (let attempt = 0; attempt < 300; attempt++) {
        const words = getRandomSymbols(settings, 2 * n);
        if (new Set(words).size !== 2 * n) continue;
        const left = words.slice(0, n);
        const right = words.slice(n);

        const shared = drawWeb(n - 1, core, core + 2);
        if (!shared) continue;

        /* Each side is the shared structure plus one entity of its own, wired
           however it falls — the odd entity is what the two sides disagree on. */
        const grow = (w: Web) => {
            const out: Web = { n: w.n + 1, adj: [] };
            out.adj = Array.from({ length: out.n }, () => Array(out.n).fill(false));
            for (let i = 0; i < w.n; i++) for (let j = 0; j < w.n; j++) out.adj[i][j] = w.adj[i][j];
            for (let i = 0; i < w.n; i++) {
                if (Math.random() < 0.4) out.adj[i][w.n] = true;
                if (Math.random() < 0.4) out.adj[w.n][i] = true;
            }
            return out;
        };

        const a = permuteWeb(grow(shared), randomPermutation(n));
        const b = permuteWeb(grow(permuteWeb(shared, randomPermutation(n - 1))), randomPermutation(n));

        /*
         * **The grown entity has at least one arrow.**
         *
         * `grow` wires the new entity to each of the others with probability .4
         * either way, so it can come out wired to nothing — about one item in
         * fourteen. That entity then appeared in no premise and was still offered
         * in the menu, which asks the reader to decide whether a name the card
         * never says anything about has a counterpart. It is also, every time, the
         * odd one: an entity with no arrows cannot be matched by one that has
         * some, so the item quietly became "spot the name that is missing".
         *
         * `drawWeb` makes this true of the webs it draws and `grow` is not one of
         * them, which is how it was missed on both sides.
         */
        const wired = (w: Web, v: number) =>
            w.adj[v].some(Boolean) || w.adj.some(row => row[v]);
        if (![a, b].every(w => [...Array(w.n).keys()].every(v => wired(w, v)))) continue;

        const pairs = oddPairs(a, b);
        if (pairs.length !== 1) continue;                  // "exactly one" is checked
        const [oddA, oddB] = pairs[0];
        if (isomorphic(a, b)) continue;                    // then nothing is odd at all

        const candidates = shuffle([
            ...left.map((w, i) => ({ word: w, odd: i === oddA })),
            ...right.map((w, i) => ({ word: w, odd: i === oddB })),
        ]);
        const answer = candidates.map((c, i) => c.odd ? i : -1).filter(i => i >= 0);
        if (answer.length !== 2) continue;

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(a, left), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(systemLines(b, right), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
        ];
        question.choices = candidates.map(c => subj(c.word));
        question.selectAnswer = answer;
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = "Select the two entities with no counterpart.";
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `${groupText(left)} form one system; ${groupText(right)} form another.`,
            "They are the same structure except for <b>one entity on each side</b>. Leave "
            + "those two out and the rest of one is the rest of the other renamed. Select "
            + "<b>both</b> of them.",
        ];

        question.explanation = [
            `${hi(left[oddA])} and ${hi(right[oddB])} are the two`,
            "without them, every arrow of what is left on one side lines up with one on "
            + "the other, under a single matching of the names",
            "leaving out any other pair leaves two structures that cannot be lined up, "
            + "so this pair is the only one that works",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}

/* ------------------------------------------------------------------ *
 * Common Sub-System — the largest part the two share                  *
 * ------------------------------------------------------------------ */

/**
 * A structure two separate systems share, that nobody points at.
 *
 * Isomorph's guide: *"Two separate systems share a structure that nobody points
 * at: some three entities of the first stand to each other exactly as three of
 * the second do, and no larger group does."*
 *
 * The hardest of the four, because nothing on the card says where to look. Motif
 * Search at least hands over the pattern; here the pattern has to be found in two
 * places at once, and the only way in is to hold both systems and compare them
 * part by part.
 *
 * Two claims are checked rather than arranged. The group is *the largest* — every
 * bigger group, on both sides, is tried and fails — and it is *the only* group of
 * its size in the first system, or the card would be marking one of several right
 * answers wrong.
 */
export function createCommonSubsystem(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createCommonSubsystem");

    const type = EnumQuestionType.CommonSubsystem;
    const settings = ctx.settings;
    if (!canGenerateQuestion(type, numOfPremises, settings)) throw new Error("Cannot generate.");
    numOfPremises = clampPremises(type, numOfPremises);

    /*
     * Six a side, not five.
     *
     * Over five-entity systems the largest shared part is usually four, and
     * selecting four of five is not the question the card asks — it is "which one
     * is left out", answered by finding the odd entity rather than by comparing
     * the systems. Six leaves a group of three or four to be picked out of six,
     * which is a selection.
     */
    const n = 6;

    for (let attempt = 0; attempt < 400; attempt++) {
        const words = getRandomSymbols(settings, 2 * n);
        if (new Set(words).size !== 2 * n) continue;
        const left = words.slice(0, n);
        const right = words.slice(n);

        const a = drawWeb(n, numOfPremises - 1, numOfPremises + 2);
        const b = drawWeb(n, numOfPremises - 1, numOfPremises + 2);
        if (!a || !b) continue;
        if (isomorphic(a, b)) continue;          // then the whole of both is the answer

        const found = largestCommon(a, b);
        if (!found.length) continue;
        /*
         * Three or four, said on the card rather than assumed.
         *
         * Isomorph's guide says three; insisting on exactly three made the mode
         * fail to build at most counts, since the largest shared part is as often
         * four. Both are worth asking, so the card states which it is. Two is too
         * small to be worth finding, and anything larger leaves too few entities
         * unselected for the answer to be a group rather than an exclusion.
         *
         * The *largest* part is found first and only then admitted or rejected —
         * capping the search at four instead would leave "no larger group does"
         * printed on a card where a larger group existed and had been skipped.
         */
        const size = found[0].inA.length;
        if (size < 3 || size > n - 2) continue;

        /* One group in the first system, however many places it sits in the
           second: the question is only about the first. */
        const distinct = new Set(found.map(f => f.inA.join(",")));
        if (distinct.size !== 1) continue;
        const group = found[0].inA;

        const candidates = shuffle([...Array(n).keys()]);
        const answer = candidates.map((v, i) => group.includes(v) ? i : -1).filter(i => i >= 0);

        const question = new Question(type);
        question.bucket = [...words];
        question.premises = [
            ...orderPremises(systemLines(a, left), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
            ...orderPremises(systemLines(b, right), ctx.settingsOverrideService.scramble, ctx.mergeTarget()),
        ];
        question.choices = candidates.map(v => subj(left[v]));
        question.selectAnswer = answer;
        question.selectAsked = true;
        question.answerMode = "select";
        question.choicePrompt = `Select the ${group.length} that match a group of the other system.`;
        question.isValid = true;
        question.conclusion = "";

        question.setup = [
            `${groupText(left)} form one system; ${groupText(right)} form another. `
            + "Nothing connects the two.",
            `They share a structure all the same: ${hi(String(group.length))} of the first `
            + "stand to each other exactly as some of the second do, and <b>no larger "
            + "group does</b>. Select those from the <b>first</b> system.",
        ];

        const bigger = group.length + 1;
        question.explanation = [
            `${groupText(group.map(i => left[i]))} stand to each other as `
            + `${groupText(found[0].inB.map(i => right[i]))} do — the same arrows, under `
            + "one matching of the names",
            `no group of ${bigger} in either system lines up with a group of ${bigger} in `
            + `the other, so ${group.length} is as large as the shared structure gets`,
            `and no other ${group.length} of the first system match a group of the second, `
            + "so this is the group",
        ];
        return question;
    }
    throw new Error("Cannot generate.");
}
