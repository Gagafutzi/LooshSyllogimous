import { Component, Input } from "@angular/core";
import { dimClass, dimSlot } from "../../utils/phrasing";
import { Question } from "../../models/question.models";
import {
    CoordMap, QuestionMap, buildQuestionMap, coordMapFromTuples,
} from "../../utils/map.utils";

/**
 * The item, drawn.
 *
 * Syllogimous v3 had this and v4 did not: a picture of where everything ended
 * up, rather than only a sentence about how the answer follows. The two are
 * complementary — the derivation is the reasoning, the map is the state — and
 * the map is the one people draw for themselves on paper when an item beats
 * them.
 *
 * Sources, in order of preference: a coordinate map written by the generator,
 * the older tuple fields the ported 3D modes still fill, and the bucket forms
 * for the modes whose answer is an ordering or a partition. Anything else gets
 * nothing, which is correct — a syllogism has no coordinates to plot.
 */
@Component({
    selector: "app-question-map",
    templateUrl: "./question-map.component.html",
    styleUrls: ["./question-map.component.css"],
})
export class QuestionMapComponent {
    /**
     * The colour this axis's clauses were painted in, so a column and the
     * premises that filled it are found by the same cue.
     *
     * Through `dimSlot` because the palette is numbered from one and a column
     * index starts at zero — asking for `--th-dim-0` gets an undefined property
     * and a black cell.
     */
    axisClass(index: number) { return dimClass(dimSlot(index)); }

    map: QuestionMap | null = null;
    /** Ordering modes: a single ranked line rather than a grid. */
    chain: string[] = [];
    /** Distinction: the two groups, side by side. */
    groups: string[][] = [];

    /**
     * A structure to draw directly, rather than one read off a question.
     *
     * `bounds` is what makes several of these comparable: fitted separately, a
     * shape and the same shape shifted two east each fill their own grid and
     * look identical.
     */
    /**
     * The last plot built, so an unchanged one is not built again.
     *
     * Every caller passes an **object literal** — `[plot]="{ map: g.map, axes:
     * …, bounds: … }"` — and Angular compares inputs by reference, so a fresh
     * literal on every change-detection pass reads as a changed input. That is
     * five bindings, four of them on the game screen and one of those inside an
     * `*ngFor` over the options, each rebuilding a whole grid on every tick of
     * the clock, every keypress and every mouse move.
     *
     * Reported as the site slowing down and breaking, worst in Axis Maps, which
     * is exactly the mode that draws a grid *per option* on top of the ones in
     * its premises.
     *
     * The fields inside those literals are stable references off the question,
     * so comparing the three of them is O(1) and never misses a real change —
     * at worst it rebuilds when it need not. Fixing it here rather than in five
     * templates also covers the sixth one somebody writes later.
     */
    private lastPlot?: { map: CoordMap; axes?: string[]; bounds?: Array<[number, number]> };

    @Input() set plot(p: {
        map: CoordMap;
        axes?: string[];
        bounds?: Array<[number, number]>;
    } | undefined) {
        const same = !!p && !!this.lastPlot
            && p.map === this.lastPlot.map
            && p.axes === this.lastPlot.axes
            && p.bounds === this.lastPlot.bounds;
        if (same) return;

        this.lastPlot = p;
        this.chain = [];
        this.groups = [];
        this.map = p ? buildQuestionMap(p.map, p.axes ?? [], p.bounds) : null;
    }

    @Input() set question(q: Question | undefined) {
        this.lastPlot = undefined;
        this.map = null;
        this.chain = [];
        this.groups = [];
        if (!q) return;

        if (q.wordCoordMap && Object.keys(q.wordCoordMap).length) {
            this.map = buildQuestionMap(q.wordCoordMap, q.axisNames ?? []);
        } else if (q.coords3D?.length) {
            this.map = buildQuestionMap(coordMapFromTuples(q.coords3D),
                ["East-west", "North-south", "Level"]);
        } else if (q.coords?.length) {
            this.map = buildQuestionMap(coordMapFromTuples(q.coords),
                ["East-west", "North-south"]);
        }

        if (this.map) return;

        if (q.buckets?.length) {
            this.groups = q.buckets.map(g => [...g]);
        } else if (q.bucket?.length) {
            this.chain = [...q.bucket];
        }
    }

    get hasMap() {
        return !!this.map || this.chain.length > 0 || this.groups.length > 0;
    }

    /** Planes are stacked back to front; the class drives the transform. */
    planeClass(i: number, total: number) {
        return `plane-${Math.min(total - i, 8)}`;
    }
}
