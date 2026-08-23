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
    "Vertical Order": "A single up-down scale. Each premise fixes one thing relative to another; chain them into one ordering and read the answer off it.",
    "Horizontal Order": "A single left-right scale. Each premise fixes one thing relative to another; chain them into one ordering and read the answer off it.",
    "Containment": "A single scale of size, worded as containing and being within. It behaves exactly like an ordering — chain the premises and read the answer off the result.",
    "Direction3D Spatial": "Compass directions with height as well. Two axes on the ground and one up the levels, all three carried at once, so add each step to a running total on every axis.",
    "Direction3D Temporal": "Compass directions with time as well. Two axes on the ground and one in hours before and after, all three carried at once, so add each step to a running total on every axis.",
    "Space 3D": "Three dimensions stated together in one sentence each. Each premise gives a step on every axis at once, so keep a running position per axis rather than trying to hold a picture.",
    "Space 4D": "Four dimensions stated together in one sentence each. Each premise gives a step on every axis at once, so keep a running position per axis rather than trying to hold a picture.",
    "Space 5D": "Five dimensions stated together in one sentence each. Each premise gives a step on every axis at once, so keep a running position per axis rather than trying to hold a picture.",
    "Space 6D": "Six dimensions stated together in one sentence each. Each premise gives a step on every axis at once, so keep a running position per axis rather than trying to hold a picture.",
    "Hierarchy": "A branching structure rather than a line, so two things can sit at the same level with no route between them. A claim about a pair holds only if the links actually lead from one to the other.",
    "Infer the Relation": "The premises place things without naming the rule that relates them. Work out what the rule is from the cases given, then apply it to the pair you are asked about.",
    "Oddest Relation": "Several structures share a property; some depart from it by different amounts. Naming the furthest one means holding the shared rule as a thing in itself and measuring against it, rather than spotting the three that match and taking the leftover.",
    "Shape and Rotation": "Positions sit on a shape whose corners come round again, so a rotation carries a corner past the end and back to the start. Count around the ring rather than along a line.",
    "Relational Web": "Two networks of arrows, and a question about their shape. What matters is the pattern of connections rather than any particular node, so compare structure — which nodes are interchangeable, which are not. The nodes are scattered differently in each web, so position tells you nothing \u2014 only the arrows do. Coloured nodes on the first web are the ones to find: tap their counterparts on the second, in the numbered order if there is more than one, and tap one again to take it back.",
    "Stimulus Function": "A property travels along the relations rather than being stated for every object. Follow the chain from where the property is established to the object asked about, applying each link in turn.",
    "Space 7D": "Seven dimensions stated in one sentence each. One of them has no distance at all — only two classes, same or opposite — so it is tracked by parity while the rest are tracked by position.",
    "Transformation Matching": "Two grids showing the same labelled points: the second is the first after one change applied to everything at once. Every grid of an item is drawn on the same frame, so a point that has moved is in a different square. The question is about that change — whether a stated one fits, which one it was, where it sends a different set, or what comes next in a sequence. Check the points one at a time; the change is only pinned down when all of them agree.",
    "Axis Maps": "The markers never move, and everything else is placed against them. A few objects are shown before and after the same change is applied to all of them, each one sitting along a single direction so you can see where that direction went and by how much. A direction may reverse, stretch, shift everything at once, or trade places with another; anything not shown is unchanged. Work out the change from the examples, then apply it to the chain — the chain survives it intact, so each link maps on its own.",
    "Nested Spaces": "Each premise states two things at once: one arrangement outside the brackets and a completely separate one inside them. They share their objects and nothing else, so they cannot contradict each other however alike the words sound. Track the two apart, and answer about whichever one the question names.",
    "Knights and Knaves": "Every speaker is a knight, who only says true things, or a knave, who only says false ones, and their statements are about who is which. A speaker is a knight exactly when what they said is true — so try a reading, check every statement against it, and keep the reading that holds throughout.",
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
