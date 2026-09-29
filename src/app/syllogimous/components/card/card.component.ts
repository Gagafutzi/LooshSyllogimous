import { Component, Input } from "@angular/core";
import { EnumTiers, TIER_COLORS, TIER_SYMBOLS, TIER_SCORE_RANGES } from "../../constants/game.constants";
import { GameService } from "../../services/game.service";

@Component({
    selector: "app-card",
    styleUrls: ["./card.component.scss"],
    templateUrl: "./card.component.html"
})
export class CardComponent {
    /**
     * Fill the viewport instead of sitting in a 38rem card.
     *
     * The card's size is right for the thing it was built for — a question, read
     * once, where a narrow column is easier to read and the fixed height keeps the
     * answer buttons where the hand expects them. Every other screen inherited it
     * by living in the same component, and the data-dense ones suffered for it:
     * the tiers matrix is sixty mode columns in a 38rem box, and the dashboard's
     * tiles reflow to one per row with the rest of the screen empty.
     *
     * An input rather than a second component, because everything else about the
     * card — the tier badge, the two slots, the footer toolbar — is wanted on those
     * screens too. `projection.test.ts` guards the slots and is unaffected: an
     * input is not projected content.
     */
    @Input() wide = false;

    TIER_COLORS = TIER_COLORS;
    TIER_SYMBOLS = TIER_SYMBOLS;
    TIER_SCORE_RANGES = TIER_SCORE_RANGES;
    tiers = Object.values(EnumTiers);
    Infinity = Infinity;

    constructor(
        public game: GameService,
    ) {}
}