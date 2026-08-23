import { Component } from '@angular/core';
import { EnumTiers, TIER_SCORE_RANGES } from 'src/app/syllogimous/constants/game.constants';
import { GameService } from 'src/app/syllogimous/services/game.service';

@Component({
    selector: 'app-tier-stats',
    templateUrl: './tier-stats.component.html',
    styleUrls: ['./tier-stats.component.css']
})
export class TierStatsComponent {
    TIER_SCORE_RANGES = TIER_SCORE_RANGES;
    tiers = Object.values(EnumTiers);
    /** Null at the top of the ladder, where there is nothing left to reach. */
    nextTier: EnumTiers | null = EnumTiers.HedgeWizard;
    pointsRemaining = 0;

    constructor(
        public game: GameService
    ) {}

    ngOnInit() {
        const currTierIdx = this.tiers.findIndex(tier => tier === this.game.tier);
        /*
         * There may be no next tier, and `"--"` is truthy.
         *
         * At the top of the ladder this read `TIER_SCORE_RANGES["--"].minScore`
         * and threw, taking the stats page with it. It was unreachable while
         * the last tier began at six thousand points and the derived score
         * stopped at 2600; making every tier earnable made it reachable.
         */
        const next = this.tiers[currTierIdx + 1];
        this.nextTier = next ?? null;
        this.pointsRemaining = next
            ? Math.max(0, TIER_SCORE_RANGES[next].minScore - this.game.score)
            : 0;
    }
}
