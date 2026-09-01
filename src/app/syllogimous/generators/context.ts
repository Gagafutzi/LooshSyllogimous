/**
 * What a generator needs from the game, and nothing else.
 *
 * The twenty generators used to be methods on GameService — 3,276 lines in one
 * file, so touching one mode meant paging past the other nineteen. They are now
 * a module per family, and this is the seam: a generator reads settings, logs,
 * asks the two override layers what is switched on, and occasionally asks for
 * another question. It does not know about routing, scoring, history, timers or
 * the verdict flash, and cannot reach them.
 *
 * GameService satisfies this structurally, so the registry passes `this`.
 * Written as an interface rather than a base class for exactly that reason —
 * nothing has to be constructed, and a test can supply a literal.
 */

import { Settings } from "../models/settings.models";
import { Logger } from "../utils/logger";
import { ProgressionService } from "../services/progression.service";
import { SettingsOverrideService } from "../services/settings-override.service";
import { Question } from "../models/question.models";

export interface GeneratorContext {
    /** Tier, then user overrides, then progression — already resolved. */
    readonly settings: Settings;
    readonly logger: Logger;
    readonly settingsOverrideService: SettingsOverrideService;
    readonly progressionService: ProgressionService;

    /**
     * Force construction answering for one item, whatever the ladder says.
     *
     * Set by the placement test, which measures the mode rather than the
     * player's current settings.
     */
    forceConstruction: "off" | "direction" | "distance";

    /**
     * Whether a mode has a modifier, forced or earned.
     *
     * The precedence rule in one place: an explicit per-mode setting wins,
     * otherwise the ladder decides. Generators asked `progressionService`
     * directly before, which meant a rung could only ever be earned — several
     * modifiers existed that no amount of configuring could switch on.
     */
    hasRung(type: string, rung: string): boolean;

    /**
     * Another question, built from the same settings.
     *
     * Only Binary needs it — it composes two other questions. Passed as a
     * capability rather than imported, because the thing that can build any
     * question is the registry, and a generator importing the registry that
     * dispatches to it is a cycle.
     */
    random(numOfPremises?: number, basic?: boolean): Question;
}

import { ConstructClaim, SeriesClaim } from "../models/question.models";
import { EnumQuestionType } from "../constants/question.constants";

/* ---- helpers shared by more than one family ---- */

/**
 * Draw the claims a construction item asks the player to state.
 *
 * More than one above four premises. A single relation can be reached by
 * tracking one thread through the premises and ignoring the rest; asking
 * for two unrelated pairs means the whole structure had to be held, which
 * is the difference between having followed an item and having solved it.
 */
export function buildConstructClaims(ctx: GeneratorContext, draw: (slack: number) => ConstructClaim | null | undefined | false, numOfPremises: number) {
    const wanted = numOfPremises > 8 ? 3 : numOfPremises > 4 ? 2 : 1;
    const claims: ConstructClaim[] = [];
    const used = new Set<string>();

    for (let guard = 0; claims.length < wanted && guard < wanted * 40; guard++) {
        /*
         * `slack` widens as claims accumulate, and only then.
         *
         * The first claim is at the layout's diameter, which is the point — a
         * conclusion you can reach without composing the whole premise set is
         * the defect this floor exists to remove. But a layout usually holds
         * one or two pairs at maximum distance, so a second claim demanding the
         * same depth simply fails, and the generator throws rather than serving
         * a slightly shallower question. Widening by one band per claim already
         * in hand keeps the first honest and lets the rest exist.
         */
        const claim = draw(claims.length);
        if (!claim) continue;
        const key = [claim.a, claim.b].sort().join(" ");
        if (used.has(key)) continue;
        used.add(key);
        claims.push(claim);
    }

    // All or nothing: a two-claim item that quietly became one claim would
    // be scored on the same scale as a genuine one.
    return claims.length === wanted ? claims : [];
}

/**
 * Which conclusion model to build under.
 *
 * One reader so the modes cannot drift apart on it: a player who switched the
 * deep model off and still met a full-width composed-space claim would
 * reasonably conclude the switch was broken, and would be right.
 *
 * A generator asking this should have both paths in front of it. "Off" is the
 * behaviour that shipped before the depth work — not a weakened version of the
 * new one — because the switch exists to make the two comparable.
 */
export function deepConclusions(ctx: GeneratorContext): boolean {
    // Absent reads as on, the same rule the stored state uses, so the deep
    // model is what you get unless something says otherwise.
    return ctx.settingsOverrideService.deepConclusions !== false;
}

/**
 * Whether an item should ask several conclusions rather than one.
 *
 * On for every mode unless the player switches it off, which is why this reads
 * the global flag directly rather than a ladder: asking a second question of an
 * arrangement already built is not a difficulty a mode should have to earn, and
 * a form that only some modes offered would be a setting that means different
 * things depending on what came up.
 */
export function seriesWanted(ctx: GeneratorContext): boolean {
    const forced = ctx.settingsOverrideService.linearOverride("multiConclusion");
    return forced === null ? true : !!forced;
}

/**
 * Draw the claims an item asks one after another.
 *
 * The shared half of the series form: how many, each on its own coin, all of
 * them distinct, and the whole thing abandoned rather than shortened if the
 * layout cannot supply them. What it cannot do is *make* a claim — only the
 * mode knows what a claim about its own arrangement is — so that comes in as
 * `draw`, the same shape `buildConstructClaims` uses for construction.
 *
 * **Each claim on its own coin.** The set this replaced was all-true or
 * exactly-one-false, because it was answered as an AND and several false claims
 * would let it be settled from whichever you checked first. Asked one at a time
 * that reasoning inverts: each claim is its own question, so each wants its own
 * even chance.
 *
 * **All or nothing.** A two-claim addition that quietly became one would be
 * scored on the same scale as a genuine one, and would hand back time for a
 * claim that never came. `count` is how many to add *after* the mode's own
 * conclusion, so one or two.
 */
export function buildSeries(
    draw: (wantValid: boolean) => (SeriesClaim & { key: string }) | null,
    count = 1 + Math.floor(Math.random() * 2),
): SeriesClaim[] {
    const out: SeriesClaim[] = [];
    const used = new Set<string>();

    for (let guard = 0; out.length < count && guard < count * 40; guard++) {
        const claim = draw(Math.random() < 0.5);
        if (!claim || used.has(claim.key)) continue;
        used.add(claim.key);
        // Everything but the key, so a claim answered by picking keeps its
        // options — dropping them left a picking series with nothing to pick.
        const { key, ...rest } = claim;
        out.push(rest);
    }

    return out.length === count ? out : [];
}

/**
 * Add drawn claims after the one the mode already built.
 *
 * **The item keeps its own conclusion, and the extra claims come after it.**
 * That is the whole trick, and the first version missed it: replacing the
 * conclusion meant every mode also had to rewrite its derivation, because the
 * old one closed on a pair the card no longer asked about. Appending instead
 * leaves the conclusion, the derivation and every renderer exactly as they
 * were, and a mode joins the form by supplying one thing — a way to draw
 * another claim about the arrangement it has already built.
 *
 * The derivation then covers claim one, which is the claim most worth
 * explaining: it is the one a reader who lost the thread lost it on.
 */
export function extendWithSeries(question: Question, extra: SeriesClaim[]): boolean {
    if (!extra.length) return false;

    const first: SeriesClaim = {
        text: Array.isArray(question.conclusion) ? question.conclusion[0] : question.conclusion,
        isValid: question.isValid,
        // Carried so that a later claim swapping in its own derivation does not
        // leave the first claim describing the wrong thing on the way back.
        explanation: question.explanation.length ? [...question.explanation] : undefined,
    };
    // A picking item has no conclusion text; what identifies its first claim is
    // the options and the prompt.
    if (question.answerMode === "choice") {
        first.choices = [...question.choices];
        first.correctChoice = question.correctChoice;
        first.prompt = question.choicePrompt;
    } else if (!first.text) {
        return false;
    }

    /*
     * If any later claim replaces the premises, the first has to state its own
     * — otherwise going back is impossible and, more to the point, the first
     * claim's premises would be whatever the last one left behind.
     */
    if (extra.some(c => c.premises)) first.premises = [...question.premises];

    /*
     * Nothing asked twice, including the claim the mode built for itself.
     *
     * `buildSeries` keeps its drawn claims distinct from each other, and knew
     * nothing about the conclusion they were being added to — so the second
     * claim could be the first one over again, same objects and same dimension.
     * That is what a player reported, and it reads worse than a missing claim:
     * it looks like the item is checking whether you noticed.
     *
     * Matched on everything the card *shows* rather than on a key, because a key
     * is per-mode and the thing that must not repeat is the question as read.
     * All of it, too: a picking item can reuse one prompt across every claim —
     * "after the change, which describes them?" — and what tells those apart is
     * the premises above and the options below, not the sentence between them.
     */
    const shown = new Set<string>();
    const distinct = [first, ...extra].filter(claim => {
        const face = [
            claim.text, claim.prompt,
            (claim.premises ?? []).join("\u0001"),
            (claim.choices ?? []).join("\u0001"),
        ].join("\u0002");
        if (shown.has(face)) return false;
        shown.add(face);
        return true;
    });
    if (distinct.length < 2) return false;

    question.series = distinct;
    question.seriesAt = 0;
    return true;
}

/**
 * Extra transforms from the ladder plus any manual setting. Applied by
 * shifting the split between layout and transform premises, never by adding
 * premises on top.
 */
export function extraTransforms(ctx: GeneratorContext, type: EnumQuestionType) {
    return ctx.progressionService.depthBonusFor(type)
         + ctx.settingsOverrideService.depthFor(type);
}

/**
 * Whether a mode carries a modifier, per mode.
 *
 * Precedence is **per-mode override → global override → ladder**, and the
 * middle term is why this cannot simply call `ctx.hasRung`: negation and meta
 * have a global Customise switch that predates the per-mode rung rows, and
 * `settings.enabled.*` already folds that switch together with what the ladder
 * granted. So the per-mode answer is asked for first, and everything else falls
 * through to the flag that already knows.
 *
 * Optional-called because a test context stubs the override service with only
 * the members it needs; absent, the global answer stands.
 */
export function modifierOn(
    ctx: GeneratorContext,
    type: string,
    rung: "meta" | "negation",
    globalFlag: boolean,
): boolean {
    return ctx.settingsOverrideService.rungOverride?.(type, rung) ?? globalFlag;
}
