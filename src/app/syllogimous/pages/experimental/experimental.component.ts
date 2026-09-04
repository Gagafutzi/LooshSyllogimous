import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { GameService } from "../../services/game.service";
import { EnumScreens } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { STREAM_TYPES } from "../../generators/stream";
import { DELAY_TYPES } from "../../generators/delay-line";

/**
 * The two modes that replace the draw rather than joining it.
 *
 * Both were reachable from Display & timer, which is where settings about *how
 * a question is shown* live — and these are not that. A stream and a delay line
 * decide which items exist and in what order, they switch every other mode off
 * while they run, and neither is priced by the ability model. Three ways of
 * being a different kind of setting from everything around them, on a page that
 * said nothing about any of it.
 *
 * Here they can say it once, in front, instead of the disclaimer being spread
 * across four collapsibles or left off entirely.
 */
@Component({
    selector: "app-experimental",
    templateUrl: "./experimental.component.html",
    styleUrls: ["./experimental.component.css"],
})
export class ExperimentalComponent {
    EnumScreens = EnumScreens;

    constructor(public game: GameService, public router: Router) {}

    /* ---- continuous stream ---- */

    streamTypes = STREAM_TYPES;

    get streamOn() { return this.game.streamOn; }

    setStreamOn(value: boolean) {
        this.game.setStreamOn(value);
        // One draw at a time: both of these replace it, so turning one on has
        // to turn the other off or the second would silently never run.
        if (value) this.game.setDelayOn(false);
    }

    get streamType() { return this.game.streamType; }

    setStreamType(value: string) { this.game.setStreamType(value as EnumQuestionType); }

    get streamAnalogy() { return this.game.streamAnalogy; }

    setStreamAnalogy(value: boolean) { this.game.setStreamAnalogy(value); }

    get streamLength() { return this.game.streamLength; }

    setStreamLength(value: string) { this.game.setStreamLength(Number(value)); }

    get streamWindow() { return this.game.streamWindow; }

    setStreamWindow(value: string) { this.game.setStreamWindow(Number(value)); }

    /* ---- delay line ---- */

    delayTypes = DELAY_TYPES;

    get delayOn() { return this.game.delayOn; }

    setDelayOn(value: boolean) {
        this.game.setDelayOn(value);
        if (value) this.game.setStreamOn(false);
    }

    get delayType() { return this.game.delayType; }

    setDelayType(value: string) { this.game.setDelayType(value as EnumQuestionType); }

    get delayDepth() { return this.game.delayDepth; }

    setDelayDepth(value: string) { this.game.setDelayDepth(Number(value)); }

    get delayRounds() { return this.game.delayRounds; }

    setDelayRounds(value: string) { this.game.setDelayRounds(Number(value)); }
}
