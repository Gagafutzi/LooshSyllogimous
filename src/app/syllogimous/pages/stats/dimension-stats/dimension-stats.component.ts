import { Component } from '@angular/core';
import { GameService } from 'src/app/syllogimous/services/game.service';
import { DimensionRecord, dimensionBreakdown } from 'src/app/syllogimous/utils/construct.utils';

/**
 * Which dimension a player actually loses.
 *
 * The most actionable number the app can show about the composed spaces, and
 * the thing the construct answer mode was built to make sayable: a
 * seven-dimension item scored as one bit cannot tell six-right-one-wrong from
 * seven-wrong, and neither can a player looking at their own history.
 *
 * Two mistakes, kept apart. Getting the *direction* wrong is a slip in reading
 * the premises; getting the *distance* wrong having read them correctly is a
 * slip in arithmetic. Different problems, different remedies, and reporting
 * them as one number would be the same one-bit summary again.
 */
@Component({
    selector: 'app-dimension-stats',
    templateUrl: './dimension-stats.component.html',
    styleUrls: ['./dimension-stats.component.css'],
})
export class DimensionStatsComponent {
    rows: DimensionRecord[] = [];

    constructor(public game: GameService) {}

    ngOnInit() {
        this.rows = dimensionBreakdown(this.game.questions);
    }

    pct(fraction: number) { return Math.round(fraction * 100); }

    /** Whichever mistake this dimension makes more of, or neither. */
    leans(row: DimensionRecord): string {
        if (!row.wrong) return "";
        if (row.misread > row.miscounted) return "reading";
        if (row.miscounted > row.misread) return "counting";
        return "";
    }
}
