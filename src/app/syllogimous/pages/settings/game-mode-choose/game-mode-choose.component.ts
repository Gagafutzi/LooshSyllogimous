import { Component } from '@angular/core';
import { LS_CAROUSEL_ADVANCE, LS_CAROUSEL_SECONDS, LS_GAME_MODE } from '../../../constants/local-storage.constants';

/*
 * The syllogism generator choice lived here and is gone.
 *
 * The picker had already been removed as a detail of how one mode is built
 * rather than a way to play, leaving a stored value that was still honoured.
 * There is now one generator, so there is nothing for a stored value to select
 * — an account that still holds one is simply ignored, which is what it would
 * have got anyway since Canyon was the default.
 */

@Component({
    selector: 'app-game-mode-choose',
    templateUrl: './game-mode-choose.component.html',
    styleUrls: ['./game-mode-choose.component.css']
})
export class GameModeChooseComponent {
    advance = localStorage.getItem(LS_CAROUSEL_ADVANCE) || 'manual';
    advanceSeconds = Number(localStorage.getItem(LS_CAROUSEL_SECONDS)) || 4;

    ngAfterViewInit() {
        const gameMode = localStorage.getItem(LS_GAME_MODE) || '0';
        (document.querySelector(`#mode-choice-${gameMode}`) as HTMLInputElement).checked = true;

        const advanceEl = document.querySelector(`#advance-choice-${this.advance}`) as HTMLInputElement | null;
        if (advanceEl) advanceEl.checked = true;
    }

    setAdvance(mode: string) {
        this.advance = mode;
        localStorage.setItem(LS_CAROUSEL_ADVANCE, mode);
    }

    setAdvanceSeconds(raw: string) {
        this.advanceSeconds = Math.max(1, Math.min(60, Number(raw) || 4));
        localStorage.setItem(LS_CAROUSEL_SECONDS, String(this.advanceSeconds));
    }

    async setMode(gameMode: string) {
        localStorage.setItem(LS_GAME_MODE, gameMode);
    }
}
