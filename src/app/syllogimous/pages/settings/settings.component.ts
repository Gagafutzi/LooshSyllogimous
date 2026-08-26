import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { EnumScreens } from '../../constants/game.constants';
import { FormControl } from '@angular/forms';
import { DEFAULT_DAILY_GOAL, DEFAULT_WEEKLY_GOAL } from '../../services/progress-and-performance.service';
import { LS_COLOR_BLINDNESS_MODE, LS_DAILY_GOAL, LS_WEEKLY_GOAL } from '../../constants/local-storage.constants';
import { GameService } from '../../services/game.service';
import { ThemeService } from '../../services/theme.service';
import { LinearFeatureFlags, SettingsOverrideService } from '../../services/settings-override.service';

/** The boolean members of the linear flags; the other two are counts. */
type LinearToggle = Exclude<keyof LinearFeatureFlags, "transforms" | "edits">;
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

    /*
     * Phrasing, not difficulty.
     *
     * Both of these state the same facts in fewer sentences, so they belong
     * with how a question is shown rather than with what it asks. Tri-state
     * like every other override: leave it to the ladder, or force it either
     * way.
     */
    phrasingRows: Array<{ key: LinearToggle; label: string; hint: string }> = [
        {
            key: "widePremises",
            label: "Wide premises",
            hint: "Two links per sentence: “A is above B, which is above C”",
        },
        {
            key: "compact",
            label: "Compact relations",
            hint: "Leave out the dimensions a pair does not differ on, so an unmentioned one means “same”. Composed spaces only",
        },
    ];

    /* ---- what the stimuli are made of ---- */

    /**
     * Presentation, not difficulty — which is why these moved off Customise.
     * They apply whether or not the override layer is switched on.
     */
    get stimulusFlags() { return this.overrides.state.flags; }

    setStimulus(
        key: "useText" | "useEmojis" | "meaningfulWords" | "visualNoise" | "junkEmojis"
            | "pharmaStimuli",
        value: boolean,
    ) {
        this.overrides.setFlag(key, value);
    }

    phrasingOf(key: LinearToggle): boolean | null {
        return this.overrides.state.linear?.[key] ?? null;
    }

    setPhrasing(key: LinearToggle, value: boolean | null) {
        this.overrides.setLinear(key, value);
    }

    /* ---- the explanation overlay ---- */

    /**
     * Straight through the game service, which is the only reader of the flag
     * that matters — a second copy of "is it on" is how a checkbox and the
     * thing it checks drift apart.
     */
    get explanationsShown() { return this.game.explanationsShown; }

    setExplanationsShown(value: boolean) { this.game.setExplanationsShown(value); }

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

    /*
     * Dimension colours live in the theme, because that is what they are — a
     * palette value that exports and imports with everything else. But nobody
     * looks for "how spatial questions are shown" on the theme page, so the
     * control is here too, next to the other settings about how a question is
     * presented, with a sample that shows what the number does.
     */
    get dimStrength() { return Number(this.theme.theme.dimStrength ?? 100); }

    setDimStrength(raw: string) {
        this.theme.set("dimStrength", Number(raw));
    }

    constructor(
        public router: Router,
        public game: GameService,
        public theme: ThemeService,
        public overrides: SettingsOverrideService,
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
