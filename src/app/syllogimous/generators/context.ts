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
     * Which syllogism algorithm the player picked.
     *
     * The last thing a generator reached past its context for: `createSyllogism`
     * read this straight out of `localStorage`, which made it the one generator
     * that could not be run without a browser-shaped global. It is a setting,
     * so it comes in with the other settings.
     */
    readonly syllogismGenerator: string;

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

import { ConstructClaim } from "../models/question.models";
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
export function buildConstructClaims(ctx: GeneratorContext, draw: () => ConstructClaim | null | undefined | false, numOfPremises: number) {
    const wanted = numOfPremises > 8 ? 3 : numOfPremises > 4 ? 2 : 1;
    const claims: ConstructClaim[] = [];
    const used = new Set<string>();

    for (let guard = 0; claims.length < wanted && guard < wanted * 40; guard++) {
        const claim = draw();
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
 * Extra transforms from the ladder plus any manual setting. Applied by
 * shifting the split between layout and transform premises, never by adding
 * premises on top.
 */
export function extraTransforms(ctx: GeneratorContext, type: EnumQuestionType) {
    return ctx.progressionService.depthBonusFor(type)
         + ctx.settingsOverrideService.depthFor(type);
}
