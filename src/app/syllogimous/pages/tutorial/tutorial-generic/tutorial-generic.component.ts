import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

/**
 * Fallback tutorial.
 *
 * The game routes to /Tutorial/<type> before the first play of a mode. Any type
 * without its own tutorial component produced NG04002 and the game never
 * started — which silently made every added mode unplayable.
 *
 * Registered as the wildcard child of Tutorial, so new modes are playable the
 * moment they are added rather than needing a tutorial written first. The
 * parent supplies the Skip button, so this only has to describe the mode.
 */

const BLURBS: Record<string, string> = {
    "Transformation": "Premises fix a starting layout, then each transformation moves one object relative to another — mirrored across it, scaled from it, rotated around it, or set to match it on one axis. The conclusion is about where things end up, so carry the layout forward and apply each change in turn.",
    "Anchor Space": "Four fixed markers form a reference frame that never moves. Each object is placed relative to one marker, so to compare two objects you have to locate both against the frame rather than chaining from one to the next.",
    "Anchor Space v2": "As Anchor Space, but transformations then move the objects. The markers stay fixed throughout and can act as pivots, so they remain reliable reference points even as everything measured against them changes.",
    "Deictic Relations": "Premises fix a grid of facts from a point of view, then reversals swap what the deictic terms refer to — I and you, here and there, now and then. Reversing the same axis twice cancels out, so track parity rather than sequence.",
};

@Component({
    selector: "app-tutorial-generic",
    template: `
        <div class="p-3">
            <h3>How to Play {{ type }}</h3>
            <p>{{ blurb }}</p>
            <p class="text-muted">
                A full walkthrough for this mode has not been written yet. Use Skip
                Tutorial to start playing.
            </p>
        </div>
    `,
})
export class TutorialGenericComponent {
    type = "";
    blurb = "";

    constructor(route: ActivatedRoute) {
        // The mode name is the trailing path segment.
        const segments = route.snapshot.url;
        this.type = decodeURIComponent(segments.map(s => s.path).join("/"));
        this.blurb = BLURBS[this.type]
            ?? "Read the premises, then decide whether the conclusion follows from them.";
    }
}
