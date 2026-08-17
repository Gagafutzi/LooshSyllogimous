import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { FormControl } from '@angular/forms';
import { DEFAULT_DAILY_GOAL, DEFAULT_WEEKLY_GOAL } from '../../services/progress-and-performance.service';
import { LS_COLOR_BLINDNESS_MODE, LS_DAILY_GOAL, LS_WEEKLY_GOAL } from '../../constants/local-storage.constants';
import { GameService } from '../../services/game.service';
import { Subscription } from 'rxjs';

export const loadColorBlindnessMode = () => {
    const blindnessModeColor = localStorage.getItem(LS_COLOR_BLINDNESS_MODE);
    if (blindnessModeColor) {
        const [text, value] = blindnessModeColor.split(";");
        console.log("Loaded color blindness mode:", {text, value});
        document.documentElement.style.setProperty('--negated-color', value);
    }
};

@Component({
    selector: 'app-settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
    EnumScreens = EnumScreens;

    dailyProgressMinutes = new FormControl(DEFAULT_DAILY_GOAL);
    weeklyProgressMinutes = new FormControl(DEFAULT_WEEKLY_GOAL);

    colorBlindnessChoices = [
        { text: "None", value: "rgb(128, 0, 0)" },
        { text: "Protanopia", value: "rgb(73, 71, 0)", },
        { text: "Deuteranopia", value: "rgb(80, 90, 0)" },
        { text: "Tritanopia", value: "rgb(122, 0, 0)" },
        { text: "Achromatopsia", value: "rgb(38, 38, 38)" }
    ];
    get defaultColorBlindnessMode() {
        return this.colorBlindnessChoices[0].value;
    }
    colorBlindnessMode = new FormControl(this.defaultColorBlindnessMode, { nonNullable: true });

    subscriptions: Subscription[] = [];

    constructor(
        public router: Router,
        public game: GameService,
    ) {
        // Playtime stuff     
        const daily = localStorage.getItem(LS_DAILY_GOAL);
        this.dailyProgressMinutes.setValue(Number(daily) || DEFAULT_DAILY_GOAL);
        const dailySubscription = this.dailyProgressMinutes.valueChanges
            .subscribe(v => localStorage.setItem(LS_DAILY_GOAL, String(v)));
        this.subscriptions.push(dailySubscription);

        const weekly = localStorage.getItem(LS_WEEKLY_GOAL);
        this.weeklyProgressMinutes.setValue(Number(weekly) || DEFAULT_WEEKLY_GOAL);
        const weeklySubscription = this.weeklyProgressMinutes.valueChanges
            .subscribe(v => localStorage.setItem(LS_WEEKLY_GOAL, String(v)));
        this.subscriptions.push(weeklySubscription);

        const colorBlindnessMode = localStorage.getItem(LS_COLOR_BLINDNESS_MODE);
        if (colorBlindnessMode) {
            const [text, value] = colorBlindnessMode.split(";");
            this.colorBlindnessMode.setValue(value);
        }
        const colorBlindnessSubscription = this.colorBlindnessMode.valueChanges.subscribe(value => {
            const text = this.colorBlindnessChoices.find(choice => choice.value === value)?.text;
            const cmpKey = text + ";" + value;
            localStorage.setItem(LS_COLOR_BLINDNESS_MODE, cmpKey);
            loadColorBlindnessMode();
        });
        this.subscriptions.push(colorBlindnessSubscription);
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }
}
