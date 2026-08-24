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
 * **All or nothing.** A three-claim item that quietly became one claim would be
 * scored on the same scale as a genuine one, and would hand back time for a
 * claim that never came.
 */
export function buildSeries(
    draw: (wantValid: boolean) => { text: string; isValid: boolean; key: string } | null,
    count = 2 + Math.floor(Math.random() * 2),
): SeriesClaim[] {
    const out: SeriesClaim[] = [];
    const used = new Set<string>();

    for (let guard = 0; out.length < count && guard < count * 40; guard++) {
        const claim = draw(Math.random() < 0.5);
        if (!claim || used.has(claim.key)) continue;
        used.add(claim.key);
        out.push({ text: claim.text, isValid: claim.isValid });
    }

    return out.length === count ? out : [];
}

/**
 * Put a drawn series on the question, or leave it alone if there is none.
 *
 * The card reads `conclusion` and `isValid`, so a series has to present its
 * first claim through them — every renderer, every scorer and every derivation
 * check then works unchanged, and the series is a thing the answer flow steps
 * through rather than a second kind of question.
 */
export function applySeries(question: Question, claims: SeriesClaim[]): boolean {
    if (claims.length < 2) return false;
    question.series = claims;
    question.seriesAt = 0;
    question.conclusion = claims[0].text;
    question.isValid = claims[0].isValid;
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
