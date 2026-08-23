import { Component, Input } from "@angular/core";
import { REGIONS, VennDiagram } from "../../utils/venn.utils";

/** Fixed three-circle geometry: the arrangement everyone has already seen. */
const R = 26;
const CENTRES = { s: [37, 38], p: [63, 38], m: [50, 62] } as const;

/**
 * Where a mark goes, per region.
 *
 * Hard-coded because the geometry is fixed, and a centroid computed from the
 * circles would drift into a neighbouring lobe on the three narrow regions —
 * the point of a mark is *which region it is in*, so an approximately right
 * position is a wrong one.
 */
const SPOTS: Record<string, [number, number]> = {
    s: [23, 30], p: [77, 30], m: [50, 78],
    sp: [50, 25], sm: [33, 57], pm: [67, 57], spm: [50, 47],
};

interface Shape { d: string; }
interface Mark { x: number; y: number; }

/**
 * A syllogism drawn as the standard Venn test.
 *
 * Regions are cut with nested `clipPath`s, which intersect — a group clipped to
 * S containing a group clipped to M draws only where both hold. Exclusion is a
 * `mask`, since there is no "clip to the outside of" primitive. Doing it with
 * masks alone does not work: masks multiply luminance, so two of them give the
 * intersection of the *masks* rather than of the shapes, and every region came
 * out as the whole circle.
 *
 * Ids are per-instance for the same reason the web drawing's marker ids are:
 * a page can hold several of these, `url(#id)` resolves to the first match in
 * the document, and the first match may be in a hidden subtree.
 */
let vennInstance = 0;

@Component({
    selector: "app-venn",
    templateUrl: "./venn.component.html",
    styleUrls: ["./venn.component.css"],
})
export class VennComponent {
    readonly uid = `venn-${++vennInstance}`;
    readonly r = R;
    /** Typed here so the template's `*ngFor` hands `cx`/`cy` a real role. */
    readonly roleOrder: Array<"s" | "p" | "m"> = ["s", "p", "m"];

    shaded: Array<{ inside: Array<"s" | "p" | "m">; outside: Array<"s" | "p" | "m"> }> = [];
    marks: Mark[] = [];
    labels: Array<{ role: "s" | "p" | "m"; text: string; x: number; y: number }> = [];

    @Input() set diagram(d: VennDiagram | null | undefined) {
        this.shaded = [];
        this.marks = [];
        this.labels = [];
        if (!d) return;

        for (const key of d.shaded) {
            const region = REGIONS.find(r => r.key === key);
            if (!region) continue;
            const roles: Array<"s" | "p" | "m"> = ["s", "p", "m"];
            this.shaded.push({
                inside: roles.filter(x => region[x]),
                outside: roles.filter(x => !region[x]),
            });
        }

        for (const mark of d.marks) {
            const spots = mark.regions.map(k => SPOTS[k]).filter(Boolean);
            if (!spots.length) continue;
            /*
             * Two possible regions puts the mark on the boundary between them,
             * which is the standard notation: the premises did not say which
             * side it falls, and a mark inside one of them would assert
             * something they never did.
             */
            this.marks.push({
                x: spots.reduce((a, s) => a + s[0], 0) / spots.length,
                y: spots.reduce((a, s) => a + s[1], 0) / spots.length,
            });
        }

        // Placed outside their circles, so a label never sits on a region.
        this.labels = [
            { role: "s", text: d.roles.s, x: 12, y: 14 },
            { role: "p", text: d.roles.p, x: 88, y: 14 },
            { role: "m", text: d.roles.m, x: 50, y: 96 },
        ];
    }

    clipId(role: string) { return `${this.uid}-clip-${role}`; }
    maskId(roles: string[]) { return `${this.uid}-mask-${roles.join("")}`; }
    hatchId() { return `${this.uid}-hatch`; }

    /** Every exclusion combination the shaded regions actually need. */
    get maskSets(): Array<Array<"s" | "p" | "m">> {
        const seen = new Map<string, Array<"s" | "p" | "m">>();
        for (const region of this.shaded) {
            if (!region.outside.length) continue;
            seen.set(region.outside.join(""), region.outside);
        }
        return [...seen.values()];
    }

    cx(role: "s" | "p" | "m") { return CENTRES[role][0]; }
    cy(role: "s" | "p" | "m") { return CENTRES[role][1]; }
}
