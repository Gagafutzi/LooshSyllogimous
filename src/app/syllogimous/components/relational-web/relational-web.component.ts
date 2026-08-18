import { Component, Input } from "@angular/core";

export interface DrawnWeb {
    adj: boolean[][];
    labels: string[];
    layout: Array<[number, number]>;
    highlight?: number;
}

interface Arrow { x1: number; y1: number; x2: number; y2: number; both: boolean; }
interface Loop { x: number; y: number; }
interface Node { x: number; y: number; label: string; lit: boolean; }

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
    readonly radius = 13;

    nodes: Node[] = [];
    arrows: Arrow[] = [];
    loops: Loop[] = [];

    @Input() set web(w: DrawnWeb | undefined) {
        this.nodes = [];
        this.arrows = [];
        this.loops = [];
        if (!w) return;

        const at = (i: number) => ({
            x: w.layout[i][0] * this.size,
            y: w.layout[i][1] * this.size,
        });

        this.nodes = w.labels.map((label, i) => ({
            ...at(i), label, lit: w.highlight === i,
        }));

        for (let i = 0; i < w.adj.length; i++) {
            for (let j = 0; j < w.adj.length; j++) {
                if (!w.adj[i][j]) continue;
                if (i === j) { this.loops.push(at(i)); continue; }
                // Drawn once for a mutual pair, with a head at each end.
                if (w.adj[j][i] && j < i) continue;
                this.arrows.push(this.between(at(i), at(j), w.adj[j][i]));
            }
        }
    }

    /** Trimmed to the rim at both ends, so the heads are visible. */
    private between(a: { x: number; y: number }, b: { x: number; y: number }, both: boolean): Arrow {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const gap = this.radius + 3;
        return {
            x1: a.x + (dx / len) * gap,
            y1: a.y + (dy / len) * gap,
            x2: b.x - (dx / len) * gap,
            y2: b.y - (dy / len) * gap,
            both,
        };
    }
}
