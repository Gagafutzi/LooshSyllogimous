import { Component, EventEmitter, Input, Output } from "@angular/core";
import { DIM_SLOTS } from "../../utils/phrasing";
import { arrowPath, bowFor } from "../../utils/web.utils";

export interface DrawnWeb {
    adj: boolean[][];
    labels: string[];
    layout: Array<[number, number]>;
    highlight?: number;
    /**
     * Nodes to be matched, in the order they are to be matched.
     *
     * Coloured by position rather than merely lit, because the order is part of
     * the question: the answer is a correspondence, and a correspondence needs
     * to say which goes with which.
     */
    marks?: number[];
    /** Answers are given by pointing at this web. */
    selectable?: boolean;
    /** Chosen so far, in order; index into the answer, not the node. */
    picked?: number[];
}

/** Drawn as a path, so it can bow away from its neighbours. */
interface Arrow { d: string; both: boolean; }
interface Loop { x: number; y: number; }
interface Node {
    x: number;
    y: number;
    label: string;
    lit: boolean;
    /** Position in the match order, or -1. Drives the colour and the badge. */
    mark: number;
    index: number;
}

/**
 * A directed graph, drawn.
 *
 * The one mode whose premises are not sentences. Everything is computed here
 * rather than in the template because arrows have to stop at the rim of a node
 * rather than at its centre — an arrowhead buried under a circle points at
 * nothing, and direction is the whole content of the picture.
 */
@Component({
    selector: "app-relational-web",
    templateUrl: "./relational-web.component.html",
    styleUrls: ["./relational-web.component.css"],
})
export class RelationalWebComponent {
    /** Viewbox units; the SVG scales to whatever box it is given. */
    readonly size = 200;

    /**
     * Node size falls as the count rises, and the arrows are why.
     *
     * A line is trimmed to each node's rim, so two circles of a fixed size
     * eventually leave no room between them for a head and a shaft — and twelve
     * nodes far enough apart for thirteen-unit circles do not fit in the box at
     * all. Shrinking the circles buys the arrows their space back, which is the
     * right trade: a slightly smaller label is a minor cost, and an arrow whose
     * direction cannot be read is the whole picture failing.
     */
    radius = 13;

    /**
     * How much line an arrowhead needs, to read as pointing somewhere.
     *
     * A head with no shaft behind it is a triangle sitting between two circles,
     * and which of them it belongs to is anyone's guess.
     */
    get headRoom() { return this.radius + 1; }

    nodes: Node[] = [];
    arrows: Arrow[] = [];
    loops: Loop[] = [];
    selectable = false;

    /** A node was pointed at. The page decides what that means. */
    @Output() pick = new EventEmitter<number>();

    @Input() set web(w: DrawnWeb | undefined) {
        this.nodes = [];
        this.arrows = [];
        this.loops = [];
        this.selectable = !!w?.selectable;
        if (!w) return;

        this.radius = Math.max(8, Math.min(13, Math.round(52 / Math.sqrt(w.labels.length))));

        const at = (i: number) => ({
            x: w.layout[i][0] * this.size,
            y: w.layout[i][1] * this.size,
        });

        /*
         * A marked node takes its colour from where it sits in the order; a
         * *picked* node takes the colour of the slot it was picked into. Same
         * palette both sides, which is the whole point — the colour is the
         * correspondence, so the two webs have to agree on what it means.
         */
        this.nodes = w.labels.map((label, i) => ({
            ...at(i),
            label,
            index: i,
            lit: w.highlight === i,
            mark: w.marks?.indexOf(i) ?? (w.picked?.indexOf(i) ?? -1),
        }));

        for (let i = 0; i < w.adj.length; i++) {
            for (let j = 0; j < w.adj.length; j++) {
                if (!w.adj[i][j]) continue;
                if (i === j) { this.loops.push(at(i)); continue; }
                // Drawn once for a mutual pair, with a head at each end.
                if (w.adj[j][i] && j < i) continue;
                this.arrows.push(this.between(at(i), at(j), w.adj[j][i], i, j));
            }
        }
    }

    /*
     * The dimension palette, reused.
     *
     * It already exists to tell several things apart at a glance in the spatial
     * modes, it is theme-aware, and it is what the reader has been trained on
     * everywhere else in the app. A second palette invented here would compete
     * with it for no gain.
     */
    markColor(slot: number) { return `var(--th-dim-${slot % DIM_SLOTS})`; }

    /** The same hue, faint, so the label stays readable on top of it. */
    markFill(slot: number) {
        return `color-mix(in srgb, var(--th-dim-${slot % DIM_SLOTS}) 22%, transparent)`;
    }

    /** Geometry lives in `web.utils`, where it can be checked. */
    private between(
        a: { x: number; y: number },
        b: { x: number; y: number },
        both: boolean,
        i: number,
        j: number,
    ): Arrow {
        // Curvature from the node indices rather than from geometry, so the
        // same pair always curves the same way and a redraw does not reshuffle
        // the picture under someone mid-item.
        const path = arrowPath(
            [a.x, a.y], [b.x, b.y], this.radius, this.headRoom, bowFor(i, j));
        return { d: path.d, both };
    }
}
