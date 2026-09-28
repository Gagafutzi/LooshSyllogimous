/**
 * Cyclic Dominance — rock, paper, scissors, and what the premises leave open.
 *
 * Ported from Isomorph, where its guide reads: *"everyone is one of three
 * kinds, and each kind beats the next round a circle. So if A beats B and B
 * beats C, then C beats A — transitivity is the trap. Select every outcome
 * still possible between two people."*
 *
 * Which is the possibility question asked of a dominance circle, so it is
 * exactly that: `buildPossibility` over `CIRCLE_SYSTEMS` rather than a second
 * generator saying the same thing in its own words. That is Isomorph's
 * arrangement and the reason the band is cheap to bring across — the mode says
 * what is asked, the system says what the relation means.
 *
 * ── Why the kinds are what make it hard ──
 *
 * Nobody is told which kind anyone is. The premises say who beat whom, and the
 * kinds have to be worked out from that — and they cannot always be pinned
 * down, which is the point. Two people whose kinds are still undecided have an
 * outcome that is still undecided with them, including the one this app's other
 * modes have no way to express: they might be the same kind, in which case
 * neither beats the other.
 *
 * ── The rung ──
 *
 * `five` widens the circle. Three kinds has a property the wider circles lose:
 * from A beating B and B beating C it follows that C beats A, every time, so
 * the trap is a rule you can learn to invert. At five each kind beats the two
 * that follow, and a chain of two sometimes gives the third and sometimes does
 * not — there is nothing left to invert, only something to work out.
 */

import { EnumQuestionType } from "../constants/question.constants";
import { Question } from "../models/question.models";
import { CIRCLE_SYSTEMS, systemById } from "../utils/relation-systems.utils";
import { GeneratorContext } from "./context";
import { buildPossibility } from "./possibility";

export function createCyclicDominance(ctx: GeneratorContext, numOfPremises: number): Question {
    ctx.logger.info("createCyclicDominance");

    const type = EnumQuestionType.CyclicDominance;
    /*
     * The wider circle replaces the smaller one rather than joining it. Both in
     * the pool would mean half the items were still the three-kind circle, and
     * a rung that arrives half the time is a rung a player cannot tell they
     * have — the ladder's own complaint about phantom modifiers.
     */
    const pool = ctx.hasRung(type, "five")
        ? [systemById("cyclic5")!]
        : CIRCLE_SYSTEMS.filter(s => s.id === "cyclic3");

    return buildPossibility(ctx, numOfPremises, type, pool);
}
