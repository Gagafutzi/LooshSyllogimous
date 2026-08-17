import { Component } from '@angular/core';
import { LS_CAROUSEL_ADVANCE, LS_CAROUSEL_SECONDS, LS_GAME_MODE, LS_SYLLOGISM_GENERATOR } from '../../../constants/local-storage.constants';

export enum SyllogismGenerator {
    All = 'all',
    Fredo = 'fredo',
    Canyon = 'canyon'
}

/**
 * Which syllogism generator to use. No longer a user-facing choice — it was a
 * detail of how one mode is built rather than a way to play, and the stored
 * value is still honoured if it was set before the picker was removed.
 */
export const getSyllogismGeneratorValue = () => {
    return (localStorage.getItem(LS_SYLLOGISM_GENERATOR) || SyllogismGenerator.Canyon) as SyllogismGenerator;
}

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
