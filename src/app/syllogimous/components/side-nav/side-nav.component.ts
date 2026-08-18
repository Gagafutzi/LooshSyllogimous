import { Component } from "@angular/core";
import { EnumScreens, TIER_SYMBOLS } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { SystemActionsService } from "../../services/system-actions.service";
import { GameService } from "../../services/game.service";
import { ProgressAndPerformanceService } from "../../services/progress-and-performance.service";

/**
 * v3-style options drawer.
 *
 * Lives in the app shell rather than inside any page, so navigation is global
 * without touching a single page component or generator. The tree is data, not
 * markup, so adding a mode or an options group is a one-line change here.
 */

export interface NavItem {
    label: string;
    /** Router path; omit for a pure group header. */
    link?: string[];
    /** Callback item, for actions that are not navigation. */
    action?: () => void;
    /** External destination; rendered as a plain link, not a route. */
    href?: string;
    /** Reflects live state next to the label, e.g. the darkmode toggle. */
    state?: () => string;
    children?: NavItem[];
    /**
     * Hide the entry when nothing is adapting difficulty.
     *
     * The tiers matrix is a table of what each tier unlocks. With every
     * progression system off, nothing is locked and nothing is climbed, so the
     * page describes a mechanism that is not running.
     */
    needsProgression?: boolean;
    /** Groups start closed unless flagged, to keep the drawer scannable. */
    open?: boolean;
    icon?: string;
}

const TUTORIAL_TYPES: EnumQuestionType[] = [
    EnumQuestionType.Distinction,
    EnumQuestionType.ComparisonNumerical,
    EnumQuestionType.ComparisonChronological,
    EnumQuestionType.Syllogism,
    EnumQuestionType.LinearArrangement,
    EnumQuestionType.CircularArrangement,
    EnumQuestionType.Direction,
    EnumQuestionType.Direction3DSpatial,
    EnumQuestionType.Direction3DTemporal,
    EnumQuestionType.GraphMatching,
    EnumQuestionType.Analogy,
    EnumQuestionType.Binary,
];

@Component({
    selector: "app-side-nav",
    templateUrl: "./side-nav.component.html",
    styleUrls: ["./side-nav.component.css"],
})
export class SideNavComponent {
    constructor(
        private system: SystemActionsService,
        public game: GameService,
        private progress: ProgressAndPerformanceService,
    ) {
        this.syncRoot();
    }

    /**
     * Time goals, read straight from the service.
     *
     * The shared progress component lays a percentage inside a variable-width
     * fill and anchors the label to that fill's moving edge — fine in the wide
     * card it was built for, unworkable in a 191px column, where a small fill
     * leaves neither piece of text anywhere to sit. Two lines of markup here
     * beat continuing to fight it.
     */
    TIER_SYMBOLS = TIER_SYMBOLS;

    goals = [
        { label: 'Daily goal',  value: () => this.progress.calcDailyProgress(this.progress.getToday()) },
        { label: 'Weekly goal', value: () => this.progress.calcWeeklyProgress(this.progress.getToday()) },
    ];

    /** Docked open on desktop, hidden behind the toggle on narrow screens. */
    open = typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches;

    nav: NavItem[] = [
        {
            label: "Play", open: true, icon: "▶", children: [
                // Start generates a fresh question and lands on Game; Game shows
                // whatever is already in play. The old labels made two different
                // actions look like one.
                { label: "New question",     link: ["/", EnumScreens.Start] },
                { label: "Current question", link: ["/", EnumScreens.Game] },
            ]
        },
        {
            label: "Progress", icon: "▤", children: [
                { label: "Stats",        link: ["/", EnumScreens.Stats] },
                { label: "History",      link: ["/", EnumScreens.History] },
                { label: "Tiers matrix", link: ["/", EnumScreens.TiersMatrix], needsProgression: true },
            ]
        },
        {
            label: "Options", open: true, icon: "⚙", children: [
                { label: "Calibrate",  link: ["/", EnumScreens.Calibration] },
                { label: "Display & timer", link: ["/", EnumScreens.Settings] },
                { label: "Customise",       link: ["/", EnumScreens.AdvancedOptions] },
                { label: "Appearance",      link: ["/", EnumScreens.Appearance] },
                // Diagnostics is a generator test rig, not a setting. Still
                // routed — it is reached by URL when something needs checking —
                // but off the menu, where it only ever confused.
            ]
        },
        {
            label: "Learn", icon: "◈", children: [
                { label: "All tutorials", link: ["/", EnumScreens.Tutorials] },
                // Reachable again: it carries the "skip all tutorials" option,
                // which is otherwise only offered on a screen you see once.
                { label: "Intro", link: ["/", EnumScreens.Intro] },
                {
                    label: "By mode",
                    children: TUTORIAL_TYPES.map(t => ({
                        label: t,
                        link: ["/", EnumScreens.Tutorial, t],
                    })),
                },
            ]
        },
        {
            label: "System", icon: "⛁", children: [
                { label: "Darkmode", action: () => this.system.toggleDarkmode(),
                  state: () => this.system.getDarkmode() ? "on" : "off" },
                { label: "Import save", action: () => this.system.import() },
                { label: "Export save", action: () => this.system.export() },
                { label: "Reset game",  action: () => this.system.resetGameWithConfirm() },
            ]
        },
        // Top-level external link: no children, so it renders as a single row.
        { label: "Discord", icon: "◇", href: "https://discord.gg/brain" },
    ];

    toggle() {
        this.open = !this.open;
        this.syncRoot();
    }

    /* ---------------- focus mode ---------------- */

    /**
     * Expands the question to fill the viewport and hides everything else — the
     * drawer, the backdrop, the card chrome.
     *
     * Deliberately *not* the browser Fullscreen API: that only removes the
     * browser's own furniture and leaves the app's layout untouched, which is the
     * opposite of what is wanted here. This is a layout state, so it lives as a
     * class on the root element where the global stylesheet can see it.
     */
    isFullscreen = false;

    ngOnInit() {
        document.addEventListener("keydown", this.onKey);
    }

    ngOnDestroy() {
        document.removeEventListener("keydown", this.onKey);
        document.documentElement.classList.remove("focus-mode");
    }

    /** Esc is the reflex for leaving a full-bleed view; honour it. */
    private onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.isFullscreen) this.toggleFullscreen();
    };

    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        document.documentElement.classList.toggle("focus-mode", this.isFullscreen);
    }

    /**
     * The drawer is position:fixed, so the routed page cannot reserve space for it
     * on its own. A class on the root element lets the global stylesheet drop the
     * reserved margin when collapsed — nothing else can see this component's state.
     */
    private syncRoot() {
        document.documentElement.classList.toggle("nav-collapsed", !this.open);
    }

    runAction(item: NavItem, event: MouseEvent) {
        event.stopPropagation();
        item.action?.();
    }

    toggleGroup(item: NavItem, event: MouseEvent) {
        event.stopPropagation();
        item.open = !item.open;
    }

    /** Close on navigation so the drawer never covers the game on mobile. */
    onNavigate() {
        if (window.matchMedia("(max-width: 900px)").matches) this.open = false;
    }
}
