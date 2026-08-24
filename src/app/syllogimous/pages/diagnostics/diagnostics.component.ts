import { Component } from "@angular/core";
import { ORDERED_QUESTION_TYPES } from "../../constants/game.constants";
import { EnumQuestionType } from "../../constants/question.constants";
import { QUESTION_TYPE_SETTING_PARAMS } from "../../constants/settings.constants";
import { Question } from "../../models/question.models";
import { Settings, canGenerateQuestion } from "../../models/settings.models";
import { GameService } from "../../services/game.service";
import { ProgressionService } from "../../services/progression.service";
import { DepthReport, RungFit, WidthFit } from "../../utils/ability.utils";

/**
 * Generator diagnostics.
 *
 * Answer-level verification would mean parsing premise HTML back into relations,
 * which is mode-specific and brittle. These invariants need no such parsing and
 * still catch the failures that actually occur: generators that throw, empty or
 * miscounted premises, conclusions restating a premise, and answers stuck on one
 * value.
 *
 * It runs through Angular DI against the live GameService, so it exercises the
 * same path as real play rather than a reimplementation.
 */

interface TypeResult {
    type: EnumQuestionType;
    attempted: number;
    generated: number;
    truthRate: number;
    failures: string[];
    threw: number;
    ms: number;
    /** Modifiers actually applied, so per-mode gating is observable. */
    negations: number;
    metaRelations: number;
}

/*
 * Tag-stripping alone erases SVG stimuli completely, which makes genuinely
 * different premises look identical — two transforms pivoting on different
 * anchor glyphs both collapsed to the same text and were reported as
 * duplicates. Anchor markers and visual-noise stimuli carry their identity
 * *in* the markup, so each SVG is folded to a stable token rather than deleted.
 */
const glyphToken = (svg: string) => {
    let h = 0;
    for (let i = 0; i < svg.length; i++) h = (Math.imul(31, h) + svg.charCodeAt(i)) | 0;
    return "[glyph:" + (h >>> 0).toString(36) + "]";
};

const strip = (s: string) => s
    .replace(/<svg[\s\S]*?<\/svg>/g, glyphToken)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

@Component({
    selector: "app-diagnostics",
    templateUrl: "./diagnostics.component.html",
    styleUrls: ["./diagnostics.component.css"],
})
export class DiagnosticsComponent {
    results: TypeResult[] = [];
    running = false;
    // Rare defects need volume: duplicate transform descriptors showed up only
    // occasionally and 25 samples per type missed them entirely.
    perType = 200;

    /*
     * Several stock v4 generators retry in unbounded loops. At least one can spin
     * forever even with every type enabled, and a synchronous loop cannot be
     * interrupted from here — it wedges the tab. So the sweep is opt-in per type,
     * defaulting to the generators known to bound their own retries.
     */
    readonly BOUNDED: EnumQuestionType[] = [
        EnumQuestionType.Deictic,
        EnumQuestionType.Transformation,
        EnumQuestionType.AnchorSpace,
        EnumQuestionType.AnchorSpaceV2,
    ];
    /*
     * Assigning playgroundSettings short-circuits the settings getter, so the
     * override and progression layers never run — which is right for repeatable
     * generator checks, but means neither layer has any coverage. Live mode
     * leaves the getter alone so those layers are exercised as they are in play.
     */
    useLiveSettings = false;

    selected = new Set<EnumQuestionType>(this.BOUNDED);
    allTypes = ORDERED_QUESTION_TYPES;

    isSelected(t: EnumQuestionType) { return this.selected.has(t); }
    isBounded(t: EnumQuestionType) { return this.BOUNDED.includes(t); }
    toggle(t: EnumQuestionType, on: boolean) { on ? this.selected.add(t) : this.selected.delete(t); }
    selectBounded() { this.selected = new Set(this.BOUNDED); }
    selectAll() { this.selected = new Set(ORDERED_QUESTION_TYPES); }

    /** Survives a wedged tab, so a hang can be attributed to a specific type. */
    get lastAttempted() { return localStorage.getItem("syllogimous-diag-inflight") || ""; }
    sample?: { type: string; premises: string[]; conclusion: string; isValid: boolean };

    constructor(
        private gameService: GameService,
        private progression: ProgressionService,
    ) { }

    /* ---------------- what the answers say the rungs cost ---------------- */

    /**
     * The hand-written cost table, next to what play actually measured.
     *
     * `RUNG_COST` is guesses, and the honest correction is to measure rather
     * than argue. Shown rather than applied: below the trial threshold a fit is
     * worse than the guess it would replace, so this reports the numbers with
     * their sample sizes and leaves the table to a human.
     */
    rungFits: RungFit[] = [];
    trialCount = 0;

    widthFit: WidthFit | null = null;
    widthApplied = 0;
    depths: DepthReport[] = [];

    loadRungFits() {
        this.trialCount = this.progression.trials().length;
        this.rungFits = this.progression.fittedRungCosts();
        this.widthFit = this.progression.fittedWidthCoefficient();
        this.widthApplied = this.progression.appliedWidthPerBit();
        this.depths = this.progression.depthByMode();
    }

    /** A share reads as a percentage; nobody thinks in thirds of a premise. */
    pct(share: number) { return Math.round(share * 100); }

    /* ---------------- progression simulation ---------------- */

    simType: EnumQuestionType = EnumQuestionType.Distinction;
    simTrials = 120;
    simAccuracy = 0.85;
    simTrail: Array<{ i: number; p: number; t: number; rungs: string; event: string }> = [];
    simEvents: string[] = [];
    simRunning = false;

    /**
     * Drives the real ProgressionService through a synthetic player.
     *
     * The ladder was verified as pure arithmetic and for a single live answer,
     * but the sawtooth across a session — shrink, claim a rung, reset, claim the
     * next, then a premise rise — was never observed end to end. Playing 120
     * questions by hand to see it is impractical; this exercises the same
     * service, config and persistence, and only substitutes the human.
     *
     * The type's ladder is restored afterwards so a diagnostic run never costs
     * real progress.
     */
    async simulateProgression() {
        if (!this.progression.config.enabled) {
            this.simEvents = ["Enable fluid progression in Customise first."];
            return;
        }

        this.simRunning = true;
        this.simTrail = [];
        this.simEvents = [];
        await new Promise(r => setTimeout(r, 20));

        const type = this.simType;
        const saved = JSON.stringify(this.progression.stateFor(type));

        try {
            this.progression.resetAll();

            for (let i = 0; i < this.simTrials; i++) {
                const before = this.progression.stateFor(type);
                const correct = Math.random() < this.simAccuracy;
                // A confident answer lands well inside the limit; a miss burns it.
                const seconds = correct ? before.timeLimit * 0.4 : before.timeLimit;
                const outcome = correct ? "right" : (Math.random() < 0.5 ? "wrong" : "timeout");

                const events = this.progression.record(type, outcome as any, seconds);
                const after = this.progression.stateFor(type);

                if (events.length) this.simEvents.push(`trial ${i + 1}: ${events.join(", ")}`);

                // Record sparsely plus every event, so the shape is visible
                // without listing every trial.
                if (events.length || i % 10 === 0) {
                    this.simTrail.push({
                        i: i + 1,
                        p: after.premises,
                        t: Math.round(after.timeLimit),
                        rungs: after.rungs.join(",") || "-",
                        event: events.join(",") || "",
                    });
                }
            }
        } finally {
            try { localStorage.setItem("syllogimous-progression-state:" + type, saved); } catch { /* ignore */ }
            this.simRunning = false;
        }
    }

    get totalFailures() {
        return this.results.reduce((a, r) => a + r.failures.length, 0);
    }

    get ran() { return this.results.length > 0; }

    /** Invariants that hold for every mode regardless of its internal model. */
    private check(q: Question, requested: number, out: string[]) {
        if (!q) { out.push("returned nothing"); return; }
        if (typeof q.isValid !== "boolean") out.push("isValid is not a boolean");
        if (!q.premises?.length) out.push("no premises");

        const conclusion = Array.isArray(q.conclusion) ? q.conclusion.join(" ") : q.conclusion;
        if (!strip(conclusion || "")) out.push("empty conclusion");

        // A conclusion that restates a premise tests reading, not reasoning.
        const concl = strip(conclusion || "");
        if (q.premises.some(p => strip(p) === concl)) out.push("conclusion restates a premise");

        // Premises must be distinct; a duplicate is usually a generator revisiting
        // the same pair. Deictic used to be exempt on the grounds that repeating a
        // reversal is its parity mechanic — but parity is what the *spec* records,
        // and stating the reversal twice only restates it, so it holds this too.
        const seen = new Set(q.premises.map(strip));
        if (seen.size !== q.premises.length) out.push("duplicate premises");

        /*
         * No single premise may name both objects the conclusion asks about.
         * If one does, it states their relation outright (or its starting value)
         * and the item collapses to reading rather than reasoning.
         *
         * Subjects are compared as extracted sets, not by substring: stimulus
         * names can contain one another ("Ant" inside "Antlers").
         */
        const subjectsOf = (html: string) =>
            [...html.matchAll(/<span class="subject">([\s\S]*?)<\/span>/g)]
                .map(m => strip(m[1]))
                .filter(Boolean);

        /*
         * A conclusion asks about pairs: two subjects form one pair, and an analogy
         * ("X is to Y as Z is to A") forms two. No pair may be stated outright by a
         * premise, or that half of the item is read rather than reasoned.
         *
         * Only *plain binary* premises count as stating a pair. A premise naming
         * more than two subjects is higher-order — a meta premise relates two
         * relations ("A relates to B as B relates to C") and mentions both subjects
         * without saying how they compare, so flagging it would be a false positive.
         */
        const conclSubjects = subjectsOf(conclusion || "");
        const pairs: Array<[string, string]> =
              conclSubjects.length === 2 ? [[conclSubjects[0], conclSubjects[1]]]
            : conclSubjects.length === 4 ? [[conclSubjects[0], conclSubjects[1]],
                                            [conclSubjects[2], conclSubjects[3]]]
            : [];

        const binaryPremises = q.premises
            .map(p => new Set(subjectsOf(p)))
            .filter(set => set.size === 2);

        for (const [u, v] of pairs) {
            if (u === v) continue;
            if (binaryPremises.some(set => set.has(u) && set.has(v))) {
                out.push("a premise directly relates a conclusion pair");
                break;
            }
        }

        if (q.premises.length > requested + 4) {
            out.push(`premise count ${q.premises.length} far exceeds requested ${requested}`);
        }
    }

    /**
     * Every type enabled, so composite modes have something to draw from.
     *
     * Several generators retry in unbounded loops until they find a usable
     * source question. Analogy and Binary compose *other* enabled types, so with
     * the tier defaults (most types off at low tiers) they can spin forever —
     * and synchronous JS cannot be timed out from here. Guaranteeing the
     * precondition is the only safe option, and it also makes results
     * independent of the player's current tier.
     */
    private fullSettings() {
        const s = new Settings();
        for (const type of ORDERED_QUESTION_TYPES) {
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            s.setQuestionSettings(type, true, params.minNumOfPremises);
        }
        return s;
    }

    async run() {
        this.running = true;
        this.results = [];
        this.sample = undefined;
        await new Promise(r => setTimeout(r, 20));   // let the button repaint

        const previous = this.gameService.playgroundSettings;
        if (!this.useLiveSettings) {
            // Deterministic path: a known-good settings object for every type.
            this.gameService.playgroundSettings = this.fullSettings();
        }

        try {
            await this.sweep();
        } finally {
            this.gameService.playgroundSettings = previous;
            this.running = false;
        }
    }

    private async sweep() {
        for (const type of ORDERED_QUESTION_TYPES) {
            if (!this.selected.has(type)) continue;
            // Breadcrumb first: if this type hangs, the tab dies but this remains.
            localStorage.setItem("syllogimous-diag-inflight", type);
            const params = QUESTION_TYPE_SETTING_PARAMS[type];
            const res: TypeResult = {
                type, attempted: 0, generated: 0, truthRate: 0, failures: [], threw: 0, ms: 0,
                negations: 0, metaRelations: 0,
            };
            const t0 = performance.now();
            let trues = 0;

            for (let i = 0; i < this.perType; i++) {
                // Sweep the low end of the range, where off-by-one guards bite.
                const span = Math.max(1, Math.min(12, params.maxNumOfPremises - params.minNumOfPremises + 1));
                const n = params.minNumOfPremises + (i % span);
                if (!canGenerateQuestion(type, n, this.gameService.settings)) continue;
                res.attempted++;
                try {
                    const fn = this.gameService.getCreateFn(type, n);
                    if (!fn) { res.failures.push("no creator registered"); continue; }
                    const q = fn();
                    res.generated++;
                    if (q?.isValid) trues++;
                    res.negations += q?.negations ?? 0;
                    res.metaRelations += q?.metaRelations ?? 0;
                    const out: string[] = [];
                    this.check(q, n, out);
                    for (const o of out) {
                        if (!res.failures.includes(o)) res.failures.push(o);
                    }
                    if (!this.sample && q?.premises?.length) {
                        this.sample = {
                            type, premises: q.premises, isValid: q.isValid,
                            conclusion: Array.isArray(q.conclusion) ? q.conclusion.join(" | ") : q.conclusion,
                        };
                    }
                } catch (e: any) {
                    res.threw++;
                    const msg = `threw: ${e?.message ?? e}`;
                    if (!res.failures.includes(msg)) res.failures.push(msg);
                }
            }

            res.ms = Math.round(performance.now() - t0);
            res.truthRate = res.generated ? Math.round(trues / res.generated * 100) : 0;

            // A mode that never varies its answer is trivially gameable.
            if (res.generated >= 8 && (res.truthRate === 0 || res.truthRate === 100)) {
                res.failures.push(`answer always ${res.truthRate === 100 ? "TRUE" : "FALSE"}`);
            }

            this.results.push(res);
            localStorage.removeItem("syllogimous-diag-inflight");
            await new Promise(r => setTimeout(r, 0));  // keep the UI responsive
        }
    }

    statusOf(r: TypeResult) {
        if (r.generated === 0) return "fail";
        return r.failures.length ? "warn" : "ok";
    }
}
