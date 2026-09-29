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
    "Mutual Moves": "Every object moves with respect to one other object, by the same rule — which object that is, is settled by how things stand at the start. One group is shown before and after; work out the rule and apply it to the second. Two things have to be worked out, not one: what each object does, and whether they all move at once from where things began or one after another, each seeing the moves already made.",
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
    "Axis Maps": "The markers never move, and everything else is placed against them. A few objects are shown before and after the same change is applied to all of them, and at first each one sits along a single direction, so you can see where that direction went and by how much -- later the examples pack every direction into one object and you have to work out which went where. A direction may reverse, stretch, shift everything at once, or trade places with another; anything not shown is unchanged. Work out the change from the examples, then apply it to the chain — the chain survives it intact, so each link maps on its own.",
    "Widest Group": "Several groups, each placed on the same directions. Within a group, look along one direction: the members spread out between an outermost one at each end, and the distance between those two is the group's spread on that direction. A group is scored by its widest direction, meaning its largest spread, and the answer is the group that scores highest. So find each group's widest direction first and then compare those against each other; the winner may not be widest on the direction you happened to check first.",
    "Nested Spaces": "Each premise states two things at once: one arrangement outside the brackets and a completely separate one inside them. They share their objects and nothing else, so they cannot contradict each other however alike the words sound. Track the two apart, and answer about whichever one the question names.",
    "Analogy Completion": "The premises place everything on several directions at once. One pair is named and the pair that matches it is not \u2014 \"A is to B as ? is to ?\" \u2014 and the answer is whichever of the two offered stands to each other the same way. Work out the first pair\u2019s relation in full before looking at the candidates: a candidate that agrees on the direction you happen to check first can still disagree on another, and one of the two always does. Direction counts, so a pair the right way round and a pair reversed are different answers.",
    "Dominance Ring": "Everything sits on a ring, and each one beats the few that follow it and loses to the few before it. So this is the one mode here where chaining does not work: A beats B and B beats C, and far enough round, C beats A. The premises give the neighbours only \u2014 assemble the ring from them, then count the steps from one to the other and compare that to how far each one\u2019s reach goes.",
    "Possibility Sets": "An invented word names a relation, and the setup says what kind of relation it is \u2014 whether it chains, whether it runs both ways. The premises state some of what holds and leave the rest out, so a pair can be settled or genuinely open. Select every outcome still possible between the two named: it runs one way, the other way, or neither. More than one can be open, and sometimes only one is \u2014 telling those apart is the whole mode.",
    "Cyclic Dominance": "Rock, paper, scissors. Everyone is one of three kinds, and each kind beats the next round a circle \u2014 so if A beats B and B beats C, then C beats A. Transitivity is the trap. Nobody tells you which kind anyone is: the premises say who beat whom, and the kinds have to be worked out from that. Often they cannot be pinned down, and then neither can the outcome \u2014 select every one still possible, including that the two are the same kind and neither beats the other.",
    "Hidden Algebra": "An invented word names a relation and nobody says what kind it is. The first list is complete \u2014 among those entities, those are the only times it holds \u2014 so work the algebra out from it: does it run both ways, does it chain, do two steps come back round? Exactly one kind of relation fits the list. Then use it on the second group, where only some is stated: select every way the two named could stand. Several at once means the facts do not settle it.",
    "Mapping Conflict": "Each analogy pairs its first name with its third and its second with its fourth. Read together they have to give every name one counterpart, and no counterpart two names \u2014 and one of them disagrees with the rest. What the analogies say about their names never comes into it: the only rule in play is that a counterpart is one thing.",
    "Context Shifts": "A context is a relation treated as a thing in its own right \u2014 not where two entities are, but the step from one to the other. Later contexts are built from earlier ones: reversed, mirrored along one direction, turned a quarter, or counted only where another context moves. Work them out in order, because a turn and a mirror do not give the same result the other way round.",
    "Cross-System Analogy": "Two arrangements with the same shape, each described in its own words \u2014 and the second group\u2019s words mean nothing until you work out which is which direction, and which way round. The lines pairing one entity with another are all you get: from those the dictionary follows, and only then can the last relation be carried across.",
    "Oblique Basis": "The relation words are not directions \u2014 each one moves two of them at once, and the codex says which. So there is no column to add up on its own, and tracking one direction at a time does not work: a premise is not about any single direction. Add the words along the chain, then read off where you ended up.",
    "Pivot Transforms": "The premises are in order, and partway through the whole arrangement moves \u2014 mirrored through one entity, or turned a quarter about it. Everything stated before the move describes where things *were*; everything after describes the new positions. Carry the early placements through the move before answering, or you will get a consistent wrong answer.",
    "Partial Analogy": "Two systems that agree in most of their arrows and not all, so no lining-up of the names keeps every one \u2014 and the question is which correspondence keeps the most. Every entity is also paired off with one of the same kind, which is a second, plausible pairing that has nothing to do with the arrows. Two things worth comparing are rarely identical; the real question is almost always which correspondence to prefer.",
    "Second-Order Analogy": "An analogy between relations rather than between things. Work each relation out along the chain \u2014 none is stated \u2014 then notice what was done to the first to get the second: every direction reversed, or two of the directions exchanged. Apply the same change to the last relation and find who stands that way to the named entity.",
    "Structure Match": "Two groups each form a system of their own, and one of them is the first system with the names changed \u2014 the same arrows between the matching entities. The other is one arrow different. Both have the same number of arrows, so counting them settles nothing: the two systems have to be lined up name by name.",
    "Motif Search": "A small pattern, and a larger system with one group in it that stands to each other exactly as the pattern\u2019s entities do. Only the arrows *within* a group count \u2014 arrows leading out of it are not part of the pattern, which is what makes this harder than comparing two whole systems.",
    "Partial Isomorphism": "Two systems that are the same structure except for one entity on each side. Leave those two out and the rest of one is the rest of the other renamed. Select both. Align the two as far as they go and notice where the alignment breaks \u2014 there is exactly one pair that works.",
    "Common Sub-System": "Two systems with nothing connecting them, which share a structure all the same: some of the first stand to each other exactly as some of the second do, and no larger group does. Nothing on the card points at it, so the only way in is to hold both systems and compare them part by part.",
    "Projection": "A lens counts some of the directions and ignores the rest, and two things coincide when nothing but an ignored direction separates them. So the work is the usual one and then a second step: compose the whole relation along the chain, then deliberately look past the part that no longer counts. Working the relation out correctly and then reading \"coincides\" off all of it marks nobody, every time.",
    "Odd Analogy": "Four claims that one pair stands as another does. Three hold on every axis and one does not \u2014 and the one that fails either holds the other way round, with every direction reversed, or agrees everywhere but a single axis. No pair is stated outright, so all four have to be composed along the chain before any of them can be ruled out.",
    "Interval Algebra": "Periods of time have length, so there are thirteen ways two of them can stand \u2014 and this is the one mode here whose relations do not compose to a single answer. Chain two of them and what you get is a set: \"A overlaps B and B is during C\" leaves several relations open between A and C, and naming all of them is the answer. Every relation is offered, in order from wholly earlier to wholly later, with what it means.",
    "Betweenness": "Everyone stands in a row, and a premise names three of them at once: the middle one lies between the other two. It says nothing about which way round the row runs, so every arrangement has a mirror that fits just as well \u2014 which is why the question is who lies between two names rather than who stands where. Select everyone the premises force between them, which may be nobody.",
    "Contradiction": "The premises cannot all be true, and exactly one of them is wrong. Find it: withdraw the wrong one and the rest agree, withdraw any other and the clash is still there. Every premise is a sentence of the same shape about the same things, so there is nothing to spot \u2014 a candidate is ruled out by taking it away and seeing that nothing was fixed.",
    "Missing Premise": "The premises leave a pair open, and one further statement would close it. Both statements offered are true; the question is what each would settle. The wrong one is not useless \u2014 it settles a different pair, which is exactly why it has to be worked out rather than glanced at.",
    "Minimal Premises": "The premises together settle how two things stand, and most of them are not needed for it. Select the smallest set that still settles the pair on its own \u2014 there is exactly one. A premise being true, and even being about the right things, does not make it part of the reason: what counts is whether the answer would still follow without it.",
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
