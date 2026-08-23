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
    @Input() set plot(p: {
        map: CoordMap;
        axes?: string[];
        bounds?: Array<[number, number]>;
    } | undefined) {
        this.chain = [];
        this.groups = [];
        this.map = p ? buildQuestionMap(p.map, p.axes ?? [], p.bounds) : null;
    }

    @Input() set question(q: Question | undefined) {
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
