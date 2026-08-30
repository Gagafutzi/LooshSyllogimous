import { Component, Input } from "@angular/core";
import { Question } from "../../models/question.models";

/**
 * A change, watched happening.
 *
 * A picture of where things ended up says only *that* the answer was what it
 * was. When the change is a composition — and Axis Maps composes up to five —
 * the reader who got the item wrong is usually wrong about one of the steps,
 * and a still of the end state cannot tell them which. Stepping through gives
 * them the one place where their arrangement and the item's part company.
 *
 * The drawing is the shared question map, so this inherits its one good
 * property for free: a grid up to three axes, and a coordinate table past that,
 * where a grid would become a wall of small multiples.
 */
function computeBounds(
    stages: Array<{ label: string; map: Record<string, number[]> }>,
): Array<[number, number]> | undefined {
    if (!stages.length) return undefined;
    const all = stages.flatMap(s => Object.values(s.map));
    if (!all.length) return undefined;
    return all[0].map((_, axis) => {
        const values = all.map(c => c[axis] ?? 0);
        return [Math.min(...values), Math.max(...values)] as [number, number];
    });
}

@Component({
    selector: "app-stages",
    templateUrl: "./stages.component.html",
    styleUrls: ["./stages.component.css"],
})
export class StagesComponent {
    stages: Array<{ label: string; map: Record<string, number[]> }> = [];
    axisNames: string[] = [];
    at = 0;

    @Input() set question(q: Question | undefined) {
        this.stages = q?.stages ?? [];
        this.axisNames = q?.axisNames ?? [];
        this.bounds = computeBounds(this.stages);
        // Opens on the finished arrangement: that is the answer, and the reader
        // who wants the steps is the one who will move the slider.
        this.at = Math.max(0, this.stages.length - 1);
        this.retune();
    }

    get current() { return this.stages[this.at]; }

    /**
     * One frame for every stage.
     *
     * Fitted per stage, a shape and the same shape moved two east each fill
     * their own grid corner to corner and look identical — so the change, which
     * is the entire content, becomes invisible.
     *
     * A field rather than a getter, and it is not a micro-optimisation: it is
     * handed to `app-question-map` as an input, and a getter returns a fresh
     * array on every change-detection pass, which reads to Angular as a changed
     * input and rebuilds the whole grid every tick. See the note on that
     * component's `plot` setter.
     */
    bounds?: Array<[number, number]>;

    /**
     * What the map is handed, built once per step rather than per pass.
     *
     * The template used to construct this literal inline, which had the same
     * effect for the same reason.
     */
    plot?: { map: Record<string, number[]>; axes: string[]; bounds?: Array<[number, number]> };

    private retune() {
        this.plot = this.current
            ? { map: this.current.map, axes: this.axisNames, bounds: this.bounds }
            : undefined;
    }

    move(raw: string) {
        this.at = Math.max(0, Math.min(this.stages.length - 1, Number(raw)));
        this.retune();
    }

    step(by: number) { this.move(String(this.at + by)); }
}
