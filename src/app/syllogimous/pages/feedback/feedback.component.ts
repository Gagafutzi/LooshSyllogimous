import { Component } from '@angular/core';
import { GameService } from '../../services/game.service';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { Question } from '../../models/question.models';
import { ItemTally, itemTally, itemWasRight } from '../../utils/answer.utils';

@Component({
    selector: 'app-feedback',
    templateUrl: './feedback.component.html',
    styleUrls: ['./feedback.component.css']
})
export class FeedbackComponent {
    EnumScreens = EnumScreens;

    /* Every conclusion the item asked, not the last one. See `itemTally`. */
    itemWasRight(q: Question): boolean { return itemWasRight(q); }
    tally(q: Question): ItemTally { return itemTally(q); }

    constructor(
        public game: GameService,
        public router: Router
    ) { }
}
