import { EnumQuestionType } from "./question.constants";
import { EnumScreens } from "./game.constants";

export const LS_DONT_SHOW = "SYL_DONT_SHOW:";
/**
 * Suppress every per-mode tutorial, including modes not met yet.
 *
 * Separate from the per-mode `LS_DONT_SHOW:` keys because those can only be set
 * by dismissing a tutorial you have already been shown — which is no use to
 * someone who knows the game and does not want to be interrupted sixteen more
 * times to say so.
 */
export const LS_SKIP_TUTORIALS = "SYL_SKIP_TUTORIALS";
export const LS_HISTORY = "SYL_HISTORY";
export const LS_TIMER = "SYL_TIMER_TYPE";
export const LS_GAME_MODE = "SYL_GAME_MODE";
export const LS_CAROUSEL_ADVANCE = "SYL_CAROUSEL_ADVANCE";
export const LS_CAROUSEL_SECONDS = "SYL_CAROUSEL_SECONDS";
export const LS_DAILY_PROGRESS = "SYL_DAILY_PROGRESS";
export const LS_PG_SETTINGS = "SYL_PG_SETTINGSv1";
export const LS_DAILY_GOAL = "SYL_DAILY_GOAL";
export const LS_WEEKLY_GOAL = "SYL_WEEKLY_GOAL";
export const LS_TRAINING_UNIT = "SYL_TRAINING_UNIT:";
export const LS_TRAINING_UNIT_LENGTH = "SYL_TRAINING_UNIT_LENGTH";
/*
 * Stored as an *off* switch so absence means on, which keeps every existing
 * player on the behaviour they already had without a migration.
 */
export const LS_TRAINING_UNITS_OFF = "SYL_TRAINING_UNITS_OFF";
export const LS_PREMISES_UP_THRESHOLD = "SYL_PREMISES_UP_THRESHOLD";
export const LS_PREMISES_DOWN_THRESHOLD = "SYL_PREMISES_DOWN_THRESHOLD";
export const LS_SCORE = "SYL_SCORE";
export const LS_COLOR_BLINDNESS_MODE = "SYL_COLOR_BLINDNESS_MODE";
/** Which settings sections the reader has folded away. */
export const LS_PANEL_OPEN = "SYL_PANEL_OPEN";

/**
 * Every prefix this app writes under.
 *
 * `LS_PROPS` below is a hand-written list, and it had drifted badly: nine key
 * families were being written and none of them were in it — the whole ability
 * model, the Customise overrides and their profiles, the residual window, the
 * trial log, the theme. Export produced a backup missing all of it, import
 * restored a partial account, and `clearAllData` left the very state a player
 * would be resetting to escape.
 *
 * Enumerating what is actually there cannot drift. The list survives because
 * some callers still want a *named* set, but nothing that means "everything"
 * may be built from it.
 */
export const LS_PREFIXES = ["SYL_", "syllogimous-", "darkmode"];

/** Every key this app owns, read from storage rather than assumed. */
export function allStorageKeys(): string[] {
    const out: string[] = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && LS_PREFIXES.some(p => key.startsWith(p))) out.push(key);
        }
    } catch { /* private mode */ }
    return out;
}

export const LS_PROPS = [
    LS_SKIP_TUTORIALS,
    LS_HISTORY,
    LS_TIMER,
    LS_GAME_MODE,
    LS_CAROUSEL_ADVANCE,
    LS_CAROUSEL_SECONDS,
    LS_DAILY_PROGRESS,
    LS_PG_SETTINGS,
    LS_DAILY_GOAL,
    LS_WEEKLY_GOAL,
    LS_TRAINING_UNIT_LENGTH,
    LS_PREMISES_UP_THRESHOLD,
    LS_PREMISES_DOWN_THRESHOLD,
    LS_SCORE,
];

for (const screen of Object.values(EnumScreens)) {
    LS_PROPS.push(LS_DONT_SHOW + screen);
}

for (const type of Object.values(EnumQuestionType)) {
    LS_PROPS.push(LS_DONT_SHOW + type);
    LS_PROPS.push(LS_TRAINING_UNIT + type);
}

/** Seconds handed back for each claim of a series answered. */
export const LS_SERIES_BONUS = "SYL_SERIES_BONUS";

/**
 * Suppress the explanation overlay after a wrong answer.
 *
 * Stored as an *off* switch, like `LS_TRAINING_UNITS_OFF` and for the same
 * reason: absence means shown, so nobody has to be migrated onto the behaviour
 * they already had.
 */
export const LS_EXPLANATIONS_OFF = "SYL_EXPLANATIONS_OFF";

/**
 * Zen mode: no answer buttons, no explanation, arrows for everything.
 *
 * Stored as an *on* switch — absent means off — because unlike the other two
 * flags here this one did not exist before, so there is no prior behaviour to
 * preserve for anybody.
 */
export const LS_ZEN = "SYL_ZEN";

/**
 * Silence every sound the app makes.
 *
 * There is no audio asset anywhere in the project — the verdict blips and the
 * daily-goal chime are synthesised on an `AudioContext` — so this is not a
 * volume control over a mixer, it is whether the oscillator is built at all.
 *
 * An *off* switch, like the two below it: absence means the sound plays, which
 * is what everyone already has.
 */
export const LS_SOUND_OFF = "SYL_SOUND_OFF";

/**
 * Suppress the Correct / Wrong / Timeout flash between questions.
 *
 * Separate from the explanation switch because they are separate requests. The
 * explanation is a panel you read; this is one word telling you how the last
 * item went, and somebody drilling for volume can want the second gone while
 * keeping the first, or the other way round.
 *
 * An *off* switch, for the reason `LS_EXPLANATIONS_OFF` is.
 */
export const LS_FEEDBACK_OFF = "SYL_FEEDBACK_OFF";
