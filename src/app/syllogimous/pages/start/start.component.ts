import { Component } from '@angular/core';
import { GameService } from '../../services/game.service';

/**
 * Pass-through into arcade.
 *
 * This used to be the hub: session counters, a Settings link, and Arcade /
 * Playground buttons. All of that competed with the thing you are actually here
 * to read. The counters now live on Stats, mode entry points live in the drawer,
 * and this route just starts a question.
 */
@Component({
    selector: 'app-start',
    templateUrl: './start.component.html',
    styleUrls: ['./start.component.css']
})
export class StartComponent {
    constructor(public game: GameService) { }

    ngOnInit() {
        // In ngOnInit rather than the constructor so routing has settled before
        // we navigate again.
        this.game.playArcadeMode();
    }
}
