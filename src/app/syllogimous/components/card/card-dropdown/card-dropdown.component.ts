import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { EnumScreens } from 'src/app/syllogimous/constants/game.constants';
import { GameService } from 'src/app/syllogimous/services/game.service';
import { SystemActionsService } from 'src/app/syllogimous/services/system-actions.service';

/**
 * Thin wrapper now: the save-data and appearance actions live in
 * SystemActionsService so the side navigation can offer the same ones without a
 * second copy. Method names are kept so the template is unchanged.
 */
@Component({
    selector: 'app-card-dropdown',
    templateUrl: './card-dropdown.component.html',
    styleUrls: ['./card-dropdown.component.scss']
})
export class CardDropdownComponent {
    EnumScreens = EnumScreens;

    constructor(
        public game: GameService,
        public router: Router,
        private modalService: NgbModal,
        private system: SystemActionsService,
    ) { }

    ngAfterViewInit() {
        this.system.toggleDarkmode(true);
    }

    /** Confirms via the styled modal, then defers the wipe to the service. */
    async resetGame(content: any) {
        await this.modalService.open(content, { centered: true }).result;
        this.system.clearAllData();
    }

    toggleDarkmode() { this.system.toggleDarkmode(); }
    getDarkmode() { return this.system.getDarkmode(); }
    import() { return this.system.import(); }
    export() { return this.system.export(); }
}
