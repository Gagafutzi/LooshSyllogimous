# Syllogimous v4 — roadmap

A personal fork aiming at parity with the closed-source Vercel build, then past
it. v4's generators are the stable base and stay intact; everything is added on
top of them.

**This file is ordered by status, not by history.** Open work is at the top
because that is what gets read; finished work is kept below in full because the
*reasoning* is the part worth having later, and several entries record a bug that
would otherwise be reintroduced. Numbering from the original plan (1.5, 2.3, 3.7)
is retained inside section titles only so older notes still resolve — it carries
no ordering.

| | |
|---|---|
| [Next up](#next-up) | what to build, in order |
| [Proposed modes](#proposed-modes) | specced but unbuilt |
| [Smaller fixes](#smaller-fixes) | known rough edges |
| [Done](#done) | with the reasoning, and the traps found |
| [Reference](#reference) | rules that keep biting |
| [Superseded](#superseded) | kept only to explain what replaced them |

---

## Ground rules

- **v4's generators stay intact.** They are the most stable thing here. Add
  alongside; do not rewrite.
- **Every generator is verified by an independent solver** that reads only
  rendered HTML and re-derives the answer. Every mode below that says DONE was
  checked this way, and most of the entries record something the check caught
  that inspection did not.
- **Difficulty is structure, not length.** Premise count is the axis of last
  resort; see [4.0](#40-one-ability-estimate--done-utilsabilityutilsts).
- **The Vercel build's JS is unavailable.** `Syllogimous.html` is a DOM snapshot
  referencing `syllogimous.min.js` without containing it, so anything unique to
  that build is written from scratch, using the snapshot only as a
  *specification* — settings labels, legend text, changelog descriptions.
- **v3 source is local** at `repos/Syllogimous-v3`, and shares element ids with
  the Vercel snapshot, so it is an ancestor of it. Anything present there is a
  **port** rather than a reimplementation, and far cheaper.
- Personal, non-commercial use (CC BY-NC 3.0 lineage).

### The five-registry hazard

Adding a question type touches five registries. Miss one and the app breaks at
runtime in a way `tsc` cannot catch:

1. `constants/question.constants.ts` — `EnumQuestionType`
2. `constants/settings.constants.ts` — `QUESTION_TYPE_SETTING_PARAMS`
3. `models/stats.models.ts` — `TypeBasedStats`
4. `constants/game.constants.ts` — `ORDERED_QUESTION_TYPES` **and every row of
   `TIERS_MATRIX`** (a positional tuple — widen the type *and* insert the column
   at the right index; TypeScript cannot see a misalignment)
5. `models/settings.models.ts` — the `Settings` constructor's explicit
   `initQuestionSettings` list ← **this is the one that blanks the whole app**

---

# Open

## Next up

Ordered by value, not by size. The first two compound with every session played;
the rest add capability.

### 1. Finish derivation coverage

Ten of twenty-four modes explain themselves after a wrong answer
([4.2](#42-derivation-on-error--done-composed-spaces)). The rest emit one bit for
an item that took a minute to read. The field on `Question` and the overlay are
shared, so each remaining mode is a generator-side change only.

Still uncovered: Analogy, Binary, Deictic, Graph Matching, Anchor Space, the
arrangement modes — and **any item carrying transformations or edits in any
mode**, because a path through the premises stops accounting for positions once
operations move things. That last case needs a coordinate trace rather than a
tree walk, which is a different renderer.

Read the Analogy trap in 4.2 before starting: a mode that reuses another's layout
inherits whatever that generator attached, and a stale `explanation` is *worse*
than none.

### 2. Fatigue detection

The ability model predicts P(correct) for every item it serves, so
**observed minus predicted** over the last ~15 items is a difficulty-adjusted
tiredness signal — much better than raw accuracy, which falls simply because
difficulty rose.

This matters more than it looks: the posterior cannot distinguish "too hard" from
"tired", so fatigued answers are recorded as evidence of *lower ability* and set
the next session's difficulty lower. Trials during a detected slump arguably
should not update the posterior at all.

### 3. Indeterminacy

Every composed-space item is fully determined by construction, so it can be
solved by constraint propagation — scan, intersect, repeat — which is search with
bookkeeping rather than relational integration.

Under-specify the layout so several arrangements satisfy the premises, then ask
what holds across *all* of them. Propagation no longer closes; you have to reason
over a set of models. Johnson-Laird's multiple-models account predicts difficulty
scales with the number of models to be held, which is a difficulty axis this
project has never used. Cheapest attack on the "it is just a search task"
objection, and it needs no new engine.

### 4. Graph transformation matching

The induction gap. Every mode states its relations and asks you to apply them;
none asks you to *infer* what relation is operating. That is the one cognitive
operation the app omits, and it is what matrix tests measure.

Four question forms over a structure S and its image S′:

| form | asks |
|---|---|
| verify | does T map S to S′? |
| identify | which T maps S to S′? |
| **apply** | **S : S′ :: R : ?** — the Raven's-isomorphic one |
| compose | is S→S″ the composition of S→S′ and S′→S″? |

Tractable because the objects are **labelled**: verification is
`applyTransform(S,T) === S′`, exact and linear. No isomorphism search, none of
the NP-hardness that sinks the edit-distance idea in
[P4](#p4-graph-matching-extended).

### 5. Realized width as a difficulty axis

**Measurement done** (`ndWidth`, `ndLiveAxes` in `ndspace.utils.ts`); the dial and
its calibration are not.

Two things vary between composed-space items the model treats as identical: how
many axes carry any difference at all, and how far apart things sit on the ones
that do. Both are "how much of this axis must be kept straight", and they collapse
into one quantity — the bits needed to locate an object:

    width = Σ over axes of log₂(distinct coordinate values)

A dead axis contributes 0, three positions 1.58, seven 2.81. That makes a 3D item
with wide axes directly comparable to a 6D item with narrow ones.

**Measured over 3,000 layouts per configuration:**

| | live axes | width | items with a dead axis |
|---|---|---|---|
| 3D, 6 objects | 3.00 / 3 | 5.07 bits (2.0–7.2) | 0% |
| 4D, 6 objects | 4.00 / 4 | 6.75 bits (4.0–9.2) | 0% |
| 6D, 4 objects | 5.94 / 6 | 8.19 bits (5.0–11.2) | 6% |
| 6D, 6 objects | 6.00 / 6 | 10.08 bits (6.6–13.3) | 0% |
| 6D, 8 objects | 6.00 / 6 | 11.45 bits (8.2–14.7) | 0% |

Three conclusions, one of which kills half the idea:

- **Dead axes barely happen.** 3–6% of items, and only at four objects; zero at
  six or more. "Declared versus actually-used dimensions" is real but has too
  narrow a window to be a dial.
- **Spread is the substantial variable.** Six-dimensional items at six objects
  range 6.6 to 13.3 bits — twofold, across items scored identically. sd ≈ 1 bit,
  and since ~10 bits sits at ~11 levels there, that is roughly **±1 level of
  noise going straight into the ability posterior**, against a psychometric slope
  of 1.6.
- **Width is not a substitute for premise count.** Three to seven premises at 3D
  moves width 4.09 → 5.72 bits — logarithmic — while `levelOf` moves 4.05 → 9.45,
  linear. Premises add chain to traverse; width adds state to hold. Separate
  quantities, so width is an added term and never a replacement.

**What is left.** `tieChance` is the natural knob — lower it and axes go live and
spread widens. Making width a target means drawing candidate layouts and keeping
the one nearest a requested value, which needs no formula. What it *does* need is
the coefficient converting bits to levels, and that should be **fitted against
answered items rather than guessed** — the same argument as `RUNG_COST`. A first
attempt at an analytic expectation predicted 6.18 bits where measurement said
5.07, which is why there is no formula in the code.

### 6+. New modes

Eleven are specced below. In rough cost order:

| | |
|---|---|
| [P6 shape and rotation](#p6-shape-and-rotation) | cheapest — an *n*-gon's rotations are already `AxisSpec` with `modulus: n` |
| [P9 infer the relation](#p9-infer-the-relation) | reuses the engine entire; the answer is one of the known scales |
| [P12 transformation of function](#p12-transformation-of-stimulus-function) | RFT's missing third pillar, over layouts that already exist |
| [P11 oddest relation out](#p11-oddest-relation-out) | needs a stated metric and a strict gap |
| [P10 sequence induction](#p10-sequence-induction) | Phase D with the mapping applied *n* times |
| [P7 nested spatial](#p7-nested-spatial--mixed-dimensionality-with-deliberate-interference) | mixed dimensionality with deliberate interference |
| [P1 facing space](#p1-facing-space-as-a-modifier) | a modifier for any spatial mode |
| [P2 knights and knaves](#p2-knights-and-knaves) | |
| [P8 boolean concepts](#p8-boolean-concept-learning--rework-the-form-before-building) | **rework the form first** — the standard paradigm is inefficient for training |
| [P4 graph matching extended](#p4-graph-matching-extended) | edit distance is the hard part |
| **Relational Web** | the original Phase 2 marquee feature, never built — see [Superseded](#superseded) |
| **Set Hierarchy syllogism** | quantified set logic over proof networks; also never built |

---

## Proposed modes


## P6. Shape and rotation

> Pentagon is the initial shape.
> A is on the upper-right corner. B is on the lower-right edge.
> **A is north of B.**
> The pentagon is rotated 144° to the left.
> *After the rotation, A is on the bottom edge.*

### It is already a circular axis

A regular *n*-gon's rotations form a cyclic group of order *n*. Positions are
integers mod *n*, a rotation is addition mod *n*, and a claim is decided by
comparing two integers. That is exactly `AxisSpec` with `modulus: n` — the
machinery from the circular-axis rung, with the polygon's symmetry order
supplying the modulus instead of an arbitrary 4 or 5.

So this is cheap, and exactly verifiable by construction.

### The premise that makes it worth building

Line 3 — *A is north of B* — is the whole design. Without it the item is
arithmetic: you are told a position, told an offset, and asked to add. With it,
the initial configuration is **derived from relations** rather than stated, and
only then rotated. Placement-by-constraint followed by transformation is a
different task from either half alone, and it is the version worth generating.

Generalises: state *k* of the objects absolutely and the rest by relation, and
let *k* fall as a rung.

### A leak to design out

**Corner and edge must not both be nameable.** Under a symmetry rotation a corner
maps to a corner and an edge to an edge, so an item that puts A on a *corner* and
claims an *edge* is false without doing any work — the type alone settles it. The
example above has this shape.

Fixes, in order of preference:

1. **Corners only** (or edges only), named by compass. Ten positions become five,
   the type never discriminates, and the modulus is clean.
2. Name all ten positions by direction alone, never as "corner" or "edge" — but
   then rotations of 36° tilt the polygon and absolute naming gets muddy.

Option 1 also keeps the modular arithmetic honest: rotations are multiples of
360/*n*, and every rotation maps the position set onto itself.

### Difficulty knobs

- **Polygon order** — 3, 4, 5, 6, 8. Changes the modulus, and odd orders are
  harder because no rotation is a simple reflection.
- **Rotation composition** — two or three rotations, left and right mixed.
  Non-commutative only in combination with reflection, so add reflection to make
  order matter.
- **How much is stated absolutely** vs derived from relations (above).
- **Asking for a relation rather than a position** — after rotation, is A still
  north of B? Under a pure rotation the *relative* arrangement is invariant,
  which is a genuinely useful thing to notice and a good trap for anyone
  recomputing both positions from scratch.

That last one is the best item in the family: the answer is derivable from
symmetry without computing anything, and only if you have understood what a
rotation preserves.


## P7. Nested spatial — mixed dimensionality with deliberate interference

> KOJ is left of CAM **(where CAM is north of JIV, CAM is east of PIJ)**
> CAM is left of ZES **(where ZES is north-west of REY, ZES is south of TEV)**

Two independent relational structures over overlapping object sets, interleaved
in the presentation. The **outer clause is one space** — say a 1D left/right
scale — and the **parenthetical is another** — say a 2D compass plane. Neither
constrains the other; they are separate graphs that happen to share objects.

Verification is free: two independent layouts over one object set, each already
exactly checkable by the existing engine. Nothing new is needed to decide an
item.

### The point is semantic interference, and the nesting is what licenses it

`axisWordConflicts` currently **forbids** two axes that share direction words —
"higher" belongs to both quantity and vertical, and a flat premise naming both
is genuinely ambiguous to a reader even though the generator knows what it meant.

This mode wants the opposite: axis pairs whose vocabulary *is* confusable, so
statements read as contradictory while being nothing of the kind. The reason
that is sound here and unsound in a flat premise is **the space is identified by
syntax rather than by wording**. Inside the parentheses is one space, outside is
another. Position disambiguates; vocabulary interferes. You get the conflict
without the ambiguity.

So the guard stays as it is for flat premises and is waived only where nesting
marks the scope. That distinction is the whole design and should be written into
the code, not just observed.

### The sharpest item

Put **the same pair** in both spaces, with words chosen to collide:

> A is **left of** B (where B is **west of** A)

Nothing here is contradictory — the horizontal scale and the compass plane are
unrelated — but every reading instinct says it is. That is a relational Stroop:
the work is suppressing an interference that natural language creates and the
model does not have. Generating these deliberately, rather than waiting for them
to occur by chance, is what makes the mode more than a presentation change.

### Difficulty knobs

- **Number of spaces** — two, then three.
- **Dimensionality of each** — 1D outer with 2D inner, then 3D inner.
- **Vocabulary collision** — none, near ("left" vs "west"), exact. The novel axis,
  and the one worth laddering.
- **Which space the conclusion asks about** — the good item asks about the space
  the phrasing pulls you away from.
- **Object-set overlap** — disjoint is bookkeeping, shared is interference.

### Relation to what exists

Composed spaces state every axis in one premise (`east, north, above, later`).
This states one space per clause and marks the rest by nesting, so the same
underlying structure gets a presentation that permits collisions the combined
form cannot. It is a rendering change plus an independence change, not a new
engine.


## P1. Facing space, as a modifier

Every object carries an **orientation** as well as a position, so relations
become egocentric: "B is on A's left" depends on which way A faces, where "B is
west of A" does not. This is the perspective-taking axis, and it is the hardest
kind of spatial reasoning there is.

Fits the machinery already built almost exactly:

- A facing is a position on a **circular axis** — the four or eight compass
  points — so §2.3's loop arithmetic covers it unchanged.
- "A turns 90° clockwise" is the existing `rotate` transform applied to the
  facing rather than the position, so §1.5's transformation vocabulary covers
  that too.
- Egocentric relation = bearing from A to B, minus A's facing, mod the ring.

**Facing is stated relationally, not absolutely** — "A faces B", not "A faces
north". That is the version worth building: it makes the facing itself something
that has to be derived (where *is* B?) before it can be applied, so a premise
costs two steps instead of one. It also raises the question the mode lives or
dies on, which has to be settled in the wording rather than left implicit:

> If A faces B and B then moves, is A still facing B?

Fixed-at-statement is the answer to build first — a facing resolves to a bearing
the moment it is stated and stops tracking its target. The alternative (facing
follows the object) is a constraint rather than a value, needs re-solving after
every transformation, and can be made unsatisfiable by a later premise.

Available to any mode with a two-or-more-dimensional position, which is what
makes it a modifier rather than a mode. Exactly verifiable (integer bearings).
Composes viciously with Deictic, which already does I/you and here/there — a
facing gives it the spatial half.


## P2. Knights and knaves

Each speaker always lies or always tells the truth; their statements are about
who is which. The one classic puzzle family the app lacks, and structurally
unlike everything else in it: current modes are all relational composition, this
is self-referential truth-functional.

Worth building **both ways** — as a mode of its own, and as a *modifier* that
wraps another mode's premises in speakers. The second is the more interesting
half and costs almost nothing extra once the first exists: take any generated
premise set, attribute the premises to speakers, and let some of those speakers
be liars.

- Constraint: speaker *i* is a knight **iff** their statement is true.
- Generation: pick an assignment, emit statements consistent with it, then check
  the conclusion is actually determined.
- Verification: brute force over `2^n` assignments — trivial for n ≤ 12, the
  same model-checking approach that settled Syllogism in §3.0.

The reason to want it here specifically: **it generalises the negation
modifier**. Negation currently marks a premise as inverted; knight/knave makes
inversion a hidden property of a *speaker* that has to be deduced first, and
then applied to everything they said. Same mechanic, one level up. Combined with
a scale ("a knave says X is more than Y") or with Deictic ("I am to your left"),
it is nastier still.


## P4. Graph matching, extended

**More than two graphs.** "Are all three isomorphic?" or, better, "which one
differs?" — the latter is a natural choice-mode item and the UI for that already
exists.

**Over other modes.** Build the two graphs out of *relational premises* rather
than abstract edges: one given as spatial relations, one as temporal, and the
question is whether the two relation-structures match. Pure composition of parts
already built.

**Edit distance to isomorphism** — "would swapping *k* relations make these
identical?" You flagged this as possibly hard mathematically, and that instinct
is right: graph edit distance is NP-hard in general, and isomorphism itself is
not known to be in P. But at the sizes in play it is brute-forceable — minimum
over all `n!` vertex bijections of the edge mismatch count, which is 40,320
bijections at n = 8 and fine, then unusable by n = 11.

The trap worth writing down now: **applying k swaps does not mean the distance
is k.** Swaps can partially cancel, or another bijection can do better. So the
generator must *search* for the true minimum rather than assume the number it
used — otherwise it will confidently mark correct answers wrong. Cap node count
explicitly.


---

## P8. Boolean concept learning — **rework the form before building**

Infer the rule separating positives from negatives. Attractive for one reason
above the others: **its difficulty is computable rather than fitted.** Feldman
(2000, *Nature*) showed subjective difficulty tracks Boolean complexity — the
length of the minimal formula expressing the concept — and Shepard, Hovland &
Jenkins (1961) give a validated six-type ordering over three binary dimensions to
check a scale against. It would be the only mode here whose `MODE_SCALE` weight
was derived instead of guessed, which is a useful check on all the others.

**The standard paradigm is the wrong shape for training and must be reworked
first.** As run in the literature it is inefficient:

- It teaches over **many trials per concept**, one exemplar at a time with
  feedback. Most of those trials carry little information, and throughput is the
  thing this project has least of.
- Three binary dimensions is eight objects total, so the space is small enough to
  memorise rather than derive, and the hardest type (parity) is a low ceiling.
- It is categorisation over **attributes**, which is not the relational operation
  the rest of the app trains.

The promising direction: make the instances **relational layouts rather than
feature bundles**, show the whole set at once instead of sequentially, and ask
for the *rule* rather than for the next classification. That lands close to a
Bongard problem over relational structures — and close enough to
[P11](#p11-oddest-relation-out) that the two may be one mode with two
presentations. Settle that before writing a generator.

---

## P9. Infer the relation

Premises use an unnamed operator — "X ⊕ Y", "Y ⊕ Z" — with enough ground truth to
pin down which scale ⊕ is. Identify it.

The cheapest induction mode on the list: it reuses the whole composed-space
engine, the answer is one of the known scales, so it is a choice item with exact
verification and no new machinery. Difficulty comes from how many premises are
needed before the operator is determined, and from how many scales share
direction words.

---

## P10. Sequence induction

S₁, S₂, S₃ generated by a repeated operation; produce S₄.

[Phase D](#4-graph-transformation-matching) with the mapping applied *n* times
rather than once, so it shares the transformation machinery and the same
labelled-structure tractability — verification stays `applyTransform` composed
with itself.

---

## P11. Oddest relation out

Four relational structures, several deviating from a shared property by graded
amounts. Name the furthest, or rank them all.

This kills the shortcut in ordinary odd-one-out. With a single deviant you can
find the three that *match*, take the leftover, and never articulate what they
share. With graded deviants you have to hold the rule as an object and measure
against it — which is the re-representation step, the most general component of
induction.

Two requirements, or the item has no defensible answer: a **stated metric**
(Hamming distance over the axes the property covers) and a **strict gap** between
candidates, so no ordering is arguable. State the metric, hide the pattern — the
same move as the compact-premise convention. Ranking all four rather than picking
one drops the guess floor from 25% to about 4% and fits the existing `construct`
answer mode.

---

## P12. Transformation of stimulus function

RFT's third pillar, and entirely absent. The app has mutual entailment and
combinatorial entailment thoroughly; it has nothing where a property attached to
one object propagates through the relational network.

> Zib is heavier than Kod. Mek is heavier than Zib. **Zib is dangerous.**
> Which is most dangerous?

A different cognitive operation from deriving a relation, central to the theory
the project descends from, and cheap — it builds on layouts that already exist.

---

## Smaller fixes

### Premise caps never reviewed

Analogy, Binary and Deictic Relations reach **13 premises** at level 20, Anchor
Space 11. Analogy and Binary are acceptable at length by explicit decision;
Deictic and Anchor Space were never reviewed and probably want the treatment
[2.10](#210-length-is-not-width--done) gave the composed spaces.

### Only one generator enforces its own ceiling

`canGenerateQuestion` checks the *floor* only, so every generator trusts its
caller for the maximum. Every real call site happens to clamp first.
`createNdSpace` clamps itself because its cap is a claim about what is answerable
at that width; the rest do not.

### Rung costs are guesses

`RUNG_COST` in `ability.utils.ts` is a hand-written table. It is at least wrong
*in one place, explicitly*, where it can be corrected — and the right correction
is to fit it against answered items rather than argue about it. A few hundred
logged trials would do it.

### The tier cheat is inert

Advanced Options can still set a score, but tier now follows ability, so nothing
happens. It would need to seed posteriors instead.

### Argument swap

Objects exchanged *within* one relation ("X is south of Y" → "Y is south of X").
The same one-line vector negation as `reverse` in
[2.8](#28-compact-premises-and-relation-edits--done); only the wording differs,
since reverse frames it as a property of the relation rather than of its
arguments.

### Unfinished ports from v3

- **Chain heuristics** (`space-hard-mode.js`) — the remaining part of 1.1.
- **Presentation modifiers** — `wide-premises`, `incorrect-directions`,
  `junk-emojis`.

### Cosmetic

- Start screen: daily/weekly goal bars clip their labels (monospace is wider than
  the original sans).
- `angular.json` style changes need a dev-server restart — webpack config, not
  hot-reloaded.

---

# Done

Each entry keeps the reasoning and, where there was one, the bug the verification
caught. Ordered by area rather than by date.

## 1.5 The linear-scale family — **DONE**, `utils/linear.utils.ts`

v4 shipped two scale modes (the two Comparisons) as bespoke generators. This is
the shared engine behind all five wordings, ported from v3's `LinearGenerator`:

| mode | above | below | equal |
|---|---|---|---|
| Comparison Numerical (quantity) | is more than | is less than | is equal to |
| Comparison Chronological | is after | is before | is at the same time as |
| **Vertical Order** | is on top of | is under | is at the same height as |
| **Horizontal Order** | is right of | is left of | is at the same place as |
| **Containment** | contains | is within | is the same size as |

The three bold ones are new. Quantity was not added again — Comparison Numerical
already *is* the more/less scale, and a second copy would only split its stats.

The family was fairly criticised as reskins of one task, so the difference is
structural rather than lexical. Three layouts, in increasing difficulty:

- **chain** — A–B–C–D in order. Read once, append as you go. This is stock v4.
- **branching** — each object attaches to an *arbitrary* earlier one, in either
  direction, so you cannot append; you have to backtrack and re-anchor. This is
  what v3 tags `modifiers: ['180']`, found in `js/generators/linear.js`.
- **overlap** — objects reached by different routes can land on the same
  coordinate, which is what licenses the third relation. A chain can never tie,
  so on a chain that relation is unusable and is never offered.

Plus **transformations** over the one-axis space (below), **multiple
conclusions**, and **choice answering**.

### Transformations are now a modifier, not a mode

`utils/transformations.utils.ts` was the engine behind one question type. It is
now dimension-agnostic and drives a rung any coordinate-backed mode can claim.
Seven operations, each a pure coordinate map:

| kind | effect |
|---|---|
| mirror | reflect the mover across the anchor |
| set | copy the anchor's coordinate onto the mover |
| scale | multiply the mover's offset from the anchor (2×, 3×, ½×) |
| rotate | quarter turn about the anchor within a plane (needs ≥2 axes) |
| **place** | drop the mover at a stated offset from the anchor |
| **translate** | shift the mover by a stated offset, no anchor |
| **swap** | exchange the two objects' coordinates |

mirror, set, scale and translate take an axis *list*, so they act on one or
several dimensions at once; the label reads "X-", "XY-" or "all-axis-". Wording
comes from a `TransformVocab` rather than being hardcoded, which is what lets the
same operations serve a one-axis "is left of" scale ("Calf is moved to 1 unit
higher than Pie") and a three-axis layout ("Dog is XZ-rotated 90°↷ around Elk").

Premise budget is shared, not additive: transformation premises come out of the
object count, so claiming the rung never smuggles in a premise increase.

### The ladder

`RUNG_LADDERS` gives the five scale modes a single eight-rung ladder:

```
negation → branching → meta → overlap → transform-1 → transform-2
         → multi-conclusion → choose-conclusion
```

Ordered by how much each changes, not by novelty. Two placements are mechanical
rather than aesthetic, and both were found by measurement:

- **meta before overlap.** A meta premise compares two relations with `<`, which
  has no honest reading when the pair is tied. Claimed before ties exist, it is
  always available; after overlap it applies only to layouts that happen not to
  tie. In the first ordering meta sat after transform-1 and consequently *never
  fired at all* — the generator's own guard disabled it.
- **negation is suppressed while overlap is on.** A negated premise names a
  relation the truth rules out, which pins the layout only when one option
  remains: with two relations "not less than" means "more than". With equality on
  the table there are three, the premises stop determining the layout, and the
  item's own answer no longer follows from what the player was shown. Dropping
  negation is the honest fix; telling the reader that stated pairs are never
  equal would leak the structure overlap exists to hide.

Everything is also forceable from Advanced Options as a tri-state
(Ladder / Off / On), because none of it is testable otherwise and a player who
already works at this level elsewhere should not have to climb to it.

### Answering modes

- **multiple conclusions** — two or three claims, true only if every one holds.
  A false item carries exactly one false claim; several would let it be spotted
  from any of them.
- **choose the conclusion** — four claims, exactly one follows. Distractors are
  about *other* pairs rather than other relations on the same pair, or three of
  four options would share two subjects and the answer would be findable by
  looking for the odd one out. Guessing is worth 1/4 rather than 1/2, which is
  the real gain: the same trial count says considerably more.

Choice mode adds `answerMode` / `choices` / `correctChoice` to `Question`, and
`checkChoice` folds into the boolean scoring path as "did they pick the right
one" so history, stats and the rating need no changes.

### Measured

An independent solver (`scratchpad/verify-linear.js`) reads *only the rendered
premise HTML* — the same thing the player sees — rebuilds the layout, replays the
transformations and derives the answer without touching generator state.

| configuration | items | verified | agreed |
|---|---|---|---|
| plain chain | 600 | 600 | 600 |
| branching (180) | 600 | 600 | 600 |
| branching + overlap | 600 | 600 | 600 |
| chain + 1 transform | 600 | 600 | 600 |
| branching + 2 transforms | 600 | 600 | 600 |
| multi-conclusion | 600 | 600 | 600 |
| choose conclusion | 600 | 600 | 600 |

Zero disagreements, zero generation failures. Re-run with meta relations on gives
the same result over the subset the solver's grammar covers (meta premises are a
different language). Ladder gating was checked rung by rung: each modifier
appears only at or after its rung, and transformation premises are never
displaced by meta substitution.

### Known limits

- Transformations reach the five scale modes and the two that were already built
  on them (Transformation, Anchor Space v2). Direction and Direction3D are
  coordinate-backed and *should* carry them, but their generators build premises
  through a separate path and were left alone. Distinction, Syllogism, Graph
  Matching, Analogy and Binary have no metric for a transformation to act on.
- Multiple conclusions and choice answering are likewise scale-family only; both
  need a model to draw extra claims from, which the other generators do not
  expose.
- Choice items make the card taller than any other mode. The body scrolls, but on
  a short viewport a premise or two sits below the fold.


## 2.3 Composed spaces, 4D / 5D / 6D — **DONE**, `utils/ndspace.utils.ts`

v4 had a 3D spatial mode and a 3D-plus-time mode, each a separate generator with
its vocabulary baked in. This replaces the idea: **a space is a list of axes**,
each axis is a `LinearScale`, and the dimension count is however many you name.

| mode | axes |
|---|---|
| Space 4D | east-west, north-south, up-down, **time** |
| Space 5D | + **containment** |
| Space 6D | + **quantity** |

"4D" is therefore a configuration, not a generator someone wrote — the stack is
editable per mode in Advanced Options, and `axesForDimensions` keeps extending
past six rather than erroring. Five and six deliberately add *non-spatial* axes:
the extra load should be holding a different kind of relation, not one more
compass direction.

The three spatial axes are now `LinearScale`s too (`SPATIAL_SCALES`), which is
what lets them compose with the scale family at all.

### Structure

One shared tree over the objects, with an independent step on **every** axis per
edge, so a premise fixes two objects on all axes at once:

> Ash is *east, same latitude, above, later* relative to Bell

Every axis is named, including the ones with no step ("same latitude"), because
"not mentioned" and "no difference" would otherwise be indistinguishable — and a
reader who cannot tell them apart may be unable to derive the relation the item
then asks about. The difficulty is carrying several independent accumulations
through one chain, not solving several separate puzzles.

### Circular dimensions

An axis can be bent into a loop of size 4 or 5. This is not the same axis with
modular arithmetic bolted on — it changes what the axis can be *asked*:

- **Straight axis** — ordinal. "Ash is east of Bell."
- **Circular axis** — ordering is meaningless, because you can reach anything
  going either way round. So it asks displacement instead: "Ash is 2 steps
  clockwise from Bell", "at the same bearing as", "diametrically opposite to".

Only axes with a circular reading can loop — a compass ring and a clock face are
both things people reason about; a ring of sizes or of quantities is not. Which
axes are loops is stated in the item's setup line, because the clauses read
identically either way and a reader assuming a straight line derives a
confidently wrong position the moment the chain runs past the end.

Loops of 4 and 5 alternate: an even modulus admits "diametrically opposite", an
odd one never does, and both claims stay in circulation.

### Ladder

`branching → circular → circular-2 → multi-conclusion → choose-conclusion`,
all forceable from Advanced Options (Ladder / 0 / 1 / 2 for loops).

### Measured

The same method as the scale family: an independent solver reads only the
rendered premises, matches each clause to the axis whose vocabulary owns that
word — *position in the list is ignored, so two axes sharing a word would be
caught here* — rebuilds the coordinates, and derives the answer.

| configuration | items | verified | agreed |
|---|---|---|---|
| chain | 450 | 450 | 450 |
| branching | 450 | 450 | 450 |
| branching + 1 loop | 450 | 450 | 450 |
| branching + 2 loops | 450 | 450 | 450 |
| multi-conclusion | 450 | 450 | 450 |
| choose conclusion | 450 | 450 | 450 |

(150 items each across 4D, 5D and 6D.) Zero disagreements, zero generation
failures. A standalone harness over the pure module adds 18,000 more across
3D–6D. Two items were also hand-derived from their premises and matched.

### Known limits

- Premises get long at six dimensions — six clauses each. That is inherent to
  naming every axis, which is what makes the item answerable, but it is the
  main thing that would put someone off 6D.
- Two axes that share a direction word (Quantity and Height both use
  "higher/lower") cannot appear in the same stack. `axisWordConflicts` detects
  it, the picker says so, and generation falls back to the preset rather than
  emitting an ambiguous premise.
- Direction and Direction3D are untouched. They now overlap conceptually with
  Space 4D, and the older pair could eventually be retired in its favour.


## 2.12 Space 3D — the ladder starts where people play — **DONE**

The composed-space engine was exposed at four dimensions and up. Three axes is
where a lot of actual play happens, and at three axes the only mode was
**Direction3D Spatial**, which has **two rungs** (negation, meta) and **no
premise cap**. Once both are claimed, every further step is length, to twenty.

| | rungs | premise cap |
|---|---|---|
| Direction3D Spatial | 2 | 20 |
| **Space 3D** | **13** | **10** |
| Space 4D / 5D / 6D | 13 | 8 / 7 / 6 |

Nothing new was written — `axesForDimensions(3)` already returned east/north/up
and the generator is dimension-agnostic. The work was registry wiring, a
calibration weight and the ladder. Everything the wider spaces earned applies
here: branching, compact premises, a circular axis, transformations including
cross-axis rotation, relation edits, analogy, and the three answer modes.

Ten premises rather than eight, because the cap falls as dimensions rise and a
three-axis premise is three clauses. Weight 1.35 puts ten premises at level 13 —
the same ceiling the wider spaces reach by trading length for breadth.

### The registry trap, again

`TIERS_MATRIX` is `Record<number, [23-tuple]>`. Adding a 24th mode shifts every
column at and after the new index, and **TypeScript cannot see it**: the rows
still had 23 entries and the tuple type still declared 23, so the file compiled
while every tier silently enabled the wrong modes from Space 4D onward. Caught
by asserting that a mode enabled at a given tier before the change is still
enabled after — not by the compiler and not by any generator test.

The column was inserted with the same value as Direction3D Spatial, since three
axes is no harder than the 3D direction modes it sits beside.

### Measured

| configuration | items | agreed | inert |
|---|---|---|---|
| plain, compact, branching (5–10 premises) | 600 | 600 | 0 |
| transformations and edits | 400 | 400 | 0 |
| circular axis, with and without operations | 302 | 302 | 0 |
| analogy, alone and with operations | 750 | 750 | 0 |

2,050 items checked by a solver that rebuilds the space from rendered premises
and replays every operation itself. True rate 46–54% throughout. A further ~200
items were skipped rather than checked: conclusions phrased as displacement on
the looped axis, which the solver declines to parse.

**Note for anyone playing at this level:** the tier matrix stops changing at
Genius, so from about 1500 points every tier enables all modes at their minimum
premise counts and score no longer affects difficulty at all. Everything after
that comes from the per-mode ladder — which means a large enabled-mode pool
makes progression very slow, since each mode carries its own ten-trial window.
Calibrating seeds every ladder at once; `applyCalibration` converts the placement
per mode rather than copying it.


## 2.7 Hierarchy — **DONE**, `utils/hierarchy.utils.ts`

(Was P3.) A directed graph of `feeds` links; the question is whether one node
reaches another **directly or by proxy**. The only mode in the app about
*connectivity* rather than position — everything else asks where things sit, and
this asks whether you can get there. It is also the only one whose answer does
not compose by arithmetic.

Asked both ways round over the same edge set:

> **X reaches Y** — is there a path X → … → Y
> **X comes from Y** — is there a path Y → … → X

That is not decoration. They are the same relation read in opposite directions,
and conflating them is the characteristic mistake — so a **reversed** pair
(reachable backwards but not forwards) is generated deliberately as the most
valuable false item the mode has. Second choice is two nodes sharing an ancestor
with no path between them. A random unrelated pair is the fallback and the worst
kind of item, because it can be rejected without following anything. In practice
the generator produced ~61% reversed, ~39% siblings and **zero** unrelated.

Premises say `feeds` and conclusions say `reaches` / `comes from`, and the setup
line states that premises are direct links while the question spans any number of
steps. Without that the conclusion reads as a restatement of a premise, which is
exactly the distinction being tested.

### Ladder

`min-span-3 → cycles → multi-conclusion → choose-conclusion`

Longer paths first, as a small continuous increase. **Cycles are the structural
jump**: in a hierarchy "reaches" is a partial order you can reason about by
level, and one loop destroys that — two nodes can then reach each other.

Loops are closed against an *ancestor*, not any earlier node. A link that merely
points backwards in the topological order usually creates nothing, because a
cycle needs the target to already reach the source. Measured: the first version
produced **0 cycles in 2000** requested-cyclic layouts; walking up the spanning
tree gives **2000/2000**.

### Measured

An independent solver parses the rendered premises into an adjacency matrix and
takes its transitive closure with Floyd–Warshall — deliberately not the
generator's own BFS, which is where the one real bug was.

| configuration | items | verified | agreed |
|---|---|---|---|
| plain hierarchy | 360 | 360 | 360 |
| longer paths | 360 | 360 | 360 |
| with cycles | 360 | 360 | 360 |
| multi-conclusion | 360 | 360 | 360 |
| choose conclusion | 360 | 360 | 360 |

Zero disagreements, zero generation failures, exact premise counts throughout
(120 items each at 4, 6 and 9 premises). A standalone harness over the pure
module adds 7,265 more. Two items were hand-derived and matched.

**The bug worth recording:** `shortestSteps` seeded the BFS visited-set with the
start node, so an edge returning to it was skipped and every self-distance stayed
Infinity. Reachability *between different* nodes was unaffected — which is why
7,000 claims passed while cycles were silently impossible. A test that only
checks the answers would never have found it; the one that caught it asserted a
property of the *structure*.

### Known limits

- Very large graphs become clerical rather than harder, which is why the
  calibration ceiling is 14 rather than 20.
- Construction answering does not apply — reachability is a yes/no about a path,
  with no dimensions to state.


## 3.0 Syllogism — **verified, no changes**

Model-checked rather than reviewed: an independent checker parses the rendered
premises back into categorical form and decides entailment by exhaustive search
over Venn cells (universals forbid cells, existentials demand a surviving one),
sharing no machinery with the generator.

| generator | premises | items | mismatches |
|---|---|---|---|
| canyon | 2 | 300 | 0 |
| canyon | 4 | 300 | 0 |
| fredo | 2 | 300 | 0 |
| fredo | 4 | 300 | 0 |

Under the *modern* reading, roughly 50 per batch disagree — which is the useful
finding: the app consistently assumes **existential import** (every category
non-empty), the traditional Aristotelian convention that the classic 24 valid
forms encode. Self-consistent, so nothing to fix, but worth stating in the
tutorial: forms like Darapti are valid here and invalid on the modern reading.


## 2.6 Conclusion building — **DONE**, answer mode `construct`

The player states the relation instead of judging one, filling **one slot per
dimension**. Each slot is a **direction dropdown** — normal / reversed / same,
e.g. above / below / at the same height as — plus a **distance box** defaulting
to 1.

Splitting direction from distance is what makes the mode bite. A single list of
whole relations could not express distance without one option per possible
value, so it only ever asked which *side* of the axis the pair sat on — and a
sign is the one thing you can track through the premises without holding the
structure. The distance cannot be.

Guess floors, per claim: at least `3^k` for k axes on direction alone, times the
distance space wherever the answer is not "same". True/false is one in two.

That number is the entire argument. A twenty-item placement, or any rating built
on binary answers, cannot separate a lucky run from an understood one at that
sample size — which is exactly the complaint that prompted this, and §3.6's own
simulation had already measured it (construction roughly halves the trials
needed for a given precision in the 15–30 range).

- **Two difficulties, earned separately.** `construct-conclusion` asks only for
  the direction; `construct-distance` adds the exact count. Direction alone is
  the half the premises hand over almost directly — a sign can be tracked
  through a chain without holding the structure — so distance is a rung of its
  own rather than the price of entry. The placement test uses direction only,
  deliberately: measuring against something harder than the levels being placed
  into is the mismatch §3.8 already had once.
- **Every dimension must be filled.** Submit stays disabled until then, and the
  button says so rather than hiding. A live counter shows how many slots remain,
  because a compact form otherwise hides what is missing.
- **Works in every game mode.** The builder sits outside both view containers —
  it is the answer, not the material. Inside the all-at-once container it was
  `d-none` in carousel mode, which left those modes with a Submit button and
  nothing to fill in.
- **Gated behind the premises in carousel modes.** Visible from the first slide
  it is a scratchpad you can fill in as you read, which cancels exactly the
  memory load that stepping through premises one at a time — and not being able
  to go back — exists to impose. It opens on the last premise.

  Gated on *furthest slide reached*, not *currently on the last slide*: in the
  mode that allows Prev, stepping back to re-read should not take the form away.
  All-at-once has no slides to wait for, so it is ungated there. Slides carry
  explicit ids (`s-premise-N`) because the auto-generated ones cannot be
  compared against "the last one".
- **"Same" has no distance**, so its box disappears rather than sitting there
  inviting a number that would be ignored.
- **Circular axes are judged modulo the loop.** Two steps clockwise round a
  five-loop *is* three steps anticlockwise; both are the same claim about the
  same pair, and insisting on the shorter way round would fail an answer that is
  exactly right.
- **No partial credit.** Half a relation is not a relation, and crediting near
  misses hands the guess floor straight back.
- Asking for distance requires the reader to know each premise is worth exactly
  one step. That is true of every layout the engines produce, but true and
  *known* are different things — so construction items state the convention in
  their setup line. Without it the item is not derivable from what was shown.
- **More than one claim above four premises**, three above eight. A single
  relation can be reached by tracking one thread and ignoring the rest; two
  unrelated pairs means the whole structure was held.
- Available in the scale family and the composed spaces, as ladder rung
  `construct-conclusion` and as an Advanced Options toggle.


## 2.11 Analogy as a question form — **DONE**

`createAnalogy` was a mode of its own. Analogy is now also a *conclusion form*
available to any composed space, which is the same move already made for
transformations: the interesting thing was trapped inside one generator.

> Dresser to Amethyst **is the opposite relation to** Lobster to Lip

Every other claim in these modes is first-order — two objects, where does one
sit relative to the other. This one takes two *relations* as its terms, so a
relation has to be held as an object before it can be compared. That is the
whole reason it is worth having, and why it belongs everywhere rather than in
one mode.

### Matching is on direction, not distance

Stated with the item, because "the same relation" is genuinely ambiguous and an
item is undecidable rather than merely hard if the reader picks the other
reading. Two reasons for choosing direction: the premises state directions, so
it is the sense the item's own language establishes; and exact vector equality
between derived pairs is far too rare in six dimensions to build on.

Claims are drawn only from pairs that are **not** stated as premises, so the
relation has to be derived rather than read, and never from a relation that is
zero on every axis — such a relation is its own reverse, which would make "same"
and "opposite" the same claim.

### Two defects found and fixed

**A biased answer key.** A true analogy needs two disjoint pairs whose relations
actually match; a false one is always available. Asking for a random validity
and discarding the failures therefore filtered out true claims *specifically*.
Measured: **40% true in 6D, 21% with two loops** — answering "false" every time
scored 79%, which is worse than the guessing it was meant to replace. Fixed by
requiring both answers to be constructible *before* tossing the coin, so
acceptance cannot correlate with the answer. This skews which layouts get used,
which is harmless: knowing a match exists somewhere says nothing about whether
the claim on screen is the one. Now 49–55% across every configuration.

**Search, don't sample.** The first version of that fix generated one claim and
tested whether the item's operations changed its truth. With dozens of matching
pairs and only some touched by an operation, that fails nearly always — 300
attempts exhausted, generator threw, session stopped on "Starting…". The
condition is now a filter over the whole candidate set, so a qualifying claim is
found whenever one exists.

### Three things that had to give

- **Objects, not operations.** Six premises carrying two operations leaves five
  objects, too few to find a match among — a quarter of items could not be
  built. Operations are now capped to keep at least six objects when analogy is
  live, because an item can have fewer operations and still be the item it was
  meant to be.
- **Fall through, don't throw.** A layout with no matching pair is a fact about
  the layout, not an error. The attempt budget is spent looking for one first
  and only the last 50 attempts settle for an ordinary axis claim — analogy
  fires on 120/120 items in most configurations and 117/120 in the hardest.
- **`getRandomQuestion` retried nothing.** It picked one generator and called
  it, so any generator failure ended the session. It now tries the other
  eligible modes first. That is a fragility for all 23 modes, not just this one.

### Composing rather than replacing

Analogy fills the conclusion slot, so it works with choice and multi-conclusion
too. Construction is the one form it cannot share an item with — you cannot
build a relation and judge an identity between two of them in the same answer —
so when both are live they alternate, rather than construction silently winning
forever once that rung is claimed. Measured 191 construction to 109 analogy.

### Measured

| configuration | items | agreed | true |
|---|---|---|---|
| 4D / 5D / 6D | 750 | 750 | 49–55% |
| compact, branching, two loops | 750 | 750 | 49–53% |

1,500 items, zero disagreements. The solver rebuilds the space from the rendered
premises and re-derives the claim from its own sign vectors. One item with a
`swap` operation was hand-derived end to end and scored correct in the UI.

**Covered structurally but not by the solver:** analogy *combined with*
transformations. The solver does not replay operations, so those runs are
checked by balance, generation rate and the "operations must matter" filter
rather than by independent re-derivation. Worth a combined solver if that pairing
becomes a rung people spend time on.

Ladder: `… edit-2 → analogy → multi-conclusion → choose-conclusion → construct-…`


## 2.8 Compact premises and relation edits — **DONE**

Two additions to the composed spaces, both in `utils/ndspace.utils.ts`.

### Compact premises

Axes a pair does not differ on are left out, so

> Ash is east, **same latitude**, above, **same time**, wider, lower relative to Bell

becomes

> Ash is east, above, wider, lower relative to Bell

Sound only because the convention is stated with the item — *"a dimension left
out of a premise is the same for both"*. Without that line, "not mentioned" and
"no difference" are indistinguishable and the conclusion may ask about exactly
the axis that went missing. Same shape of argument as the one-step rule for
construction: the fact is always true of these layouts, but true and *known* are
different things.

This is the fix for the six-clauses-per-premise limit recorded against 6D.
Measured: **2,817 clauses omitted across 2,520 premises** — a little over one per
premise, which matches the tie rate the generator draws at.

Slightly *harder*, not easier: you can no longer tick axes off as you read, and
an absent axis has to be actively read as "same".

### Relation edits (was P5)

Premises that rewrite an earlier **relation** rather than moving an object:

| operation | rendered as | implementation |
|---|---|---|
| reverse | the relation X → Y is **reversed** | negate one edge's delta vector |
| swap | the relations X → Y and B → C are **exchanged** | exchange two vectors |
| copy | X → Y becomes **the same relation as** B → C | overwrite one with another |

Every other modifier mutates the model — things move and you re-derive. These
mutate the **premise set**, which is a different task: you hold the statements as
data, edit them, and read the model off the result.

Cheap because each edge already carries a delta vector, so all three are vector
arithmetic. And safe for a reason worth stating: the stated pairs form a tree,
and *any* assignment of vectors to a tree's edges yields exactly one consistent
layout — so an edit can never produce an unsatisfiable premise set. An arbitrary
premise-rewriting mechanism would have no such guarantee.

Two rules the generator enforces:

- **A relation is never edited twice.** The second edit would silently undo or
  mask the first, and the reader cannot tell which of two statements about the
  same pair is meant to win.
- **Edits must change the queried pair**, or the conclusion is answerable from
  the relations as first stated and the edit premises are reading practice.

Edits come out of the object count rather than being added on top, so claiming
the rung never smuggles in a premise increase.

Ladder: `branching → compact → circular → edit-1 → circular-2 → edit-2 → …`

### Measured

| configuration | items | verified | agreed |
|---|---|---|---|
| compact only | 360 | 360 | 360 |
| 1 edit, full premises | 360 | 360 | 360 |
| 2 edits, full premises | 360 | 360 | 360 |
| compact + 2 edits | 360 | 360 | 360 |
| compact + 2 edits + multi-conclusion | 360 | 360 | 360 |

120 items each across 4D, 5D and 6D at 7 premises. Zero disagreements, zero
generation failures, exact premise counts. The solver parses compact premises
using the stated convention and replays the edits itself, so a wrong convention
or a mis-signed edit would show up. One 6D item with two copies was also
hand-derived and matched.

**Not yet done:** argument swap — objects exchanged *within* one relation
("X is south of Y" → "Y is south of X"). It is the same one-line vector negation
as `reverse`, and reverse currently phrases it as a property of the relation
rather than of its arguments. Worth adding as a separate wording if the
distinction turns out to read differently.


## 2.9 Operations in composed spaces — **DONE**

Transformations were reachable only by the two dedicated 3D modes. The linear
family drew them at `dims: 1`, and `kindsFor` only offers `rotate` at two axes or
more, so **rotation was unreachable by construction**; `ndspace.utils.ts`
mentioned transformations nowhere at all. The composed spaces had breadth and no
operations on it.

### Why rotation is the one that matters

A quarter turn *exchanges* two axes' displacements. Once the axes stop all being
spatial, that becomes a mapping between incommensurable things:

> `Gong is YC-rotated 90°↷ around Coat` — Gong's north-offset of +1 and its
> containment-offset of −1 swap into (−2, −1). **North became narrower.**

There is no spatial intuition to fall back on and no crystallised relation to
recall, because the pair of axes involved changes item to item. In six
dimensions there are 15 rotation planes. Measured over 800 items: **202 of 239
rotations crossed domains**, only 37 were purely spatial.

This also subsumes the "arbitrary relational cues" idea — renaming relations to
nonsense syllables to force the frame away from the semantics. Rotation
generates that arbitrariness structurally instead of by relabelling.

### What constrains it

**Circular axes are excluded from rotation planes.** A turn requires the pair to
be commensurable; turning a bounded axis against an unbounded one takes a
wrapped value and writes it where it has no meaning — well-defined arithmetic
describing nothing. Every other operation acts on each axis independently and
needs no such restriction, so mirror, scale, set, place, translate and swap all
apply to loops, with a reduction mod the loop afterwards. Verified: over 239
rotations, planes were `YC YQ ZQ CQ ZC YZ` — the two circular axes never appear.

**Circular axes hand over their cyclic wording** to the operation vocabulary.
Premises describe a looped east axis as clockwise/anticlockwise, so a transform
premise saying "moves 2 east" about that axis would describe a different space
than the one being reasoned about.

**The axis key is stated with the item.** `XT-rotated` is unreadable without
knowing which axes X and T are, and unlike every other operation name it cannot
be inferred from the direction words in the premises.

### The bug worth recording

`bites` — the guard that stops mutations being decorative — tested whether the
**pair's** relation changed, then chose the conclusion's axis at random
afterwards. That was already weak for edits and became badly wrong here: a
single-axis mirror changes one of six coordinates, so a pair that "changed" was
still five-sixths likely to be asked about an axis the operations never touched.
Operations can also cancel on an axis, which a pair-level test cannot see.

Found by hand-deriving a rendered item, not by the solver — the item was
*internally consistent*, so an independent solver agreed with it. It was
answerable while ignoring both operations, which is a different defect from
being wrong, and only a structural assertion catches it.

Now the axis is **drawn from the ones the operations reached** rather than drawn
at random and hoped over. Construction keeps the pair-level test, correctly:
it states every axis at once, so the pair is the right unit.

### Measured

| configuration | items | agreed | inert |
|---|---|---|---|
| 4D/5D/6D, 1–2 operations | 360 | 360 | 0 |
| + circular axes, edits, compact, branching | 840 | 840 | 0 |
| boolean conclusions, 4D/5D/6D | 800 | 800 | 0 |
| construct conclusions, everything on | 200 | 200 | 0 |

2,200 items, ~3,000 operations. The solver parses every one of the seven
operation kinds out of rendered text and replays them with its own vector
arithmetic, so a mis-signed rotation or a wrong modulus would show. `inert 0`
is the structural assertion: in no item did the answer survive the operations.

Ladder: `branching → compact → circular → transform-1 → edit-1 → circular-2 →
transform-2 → edit-2 → …` — the two families interleaved rather than stacked,
because an operation moves objects while an edit rewrites what a premise said,
and they are close enough to be confused.

**Not yet done:** rotation is currently a property of the *space*. Making it a
question — "which turn maps this arrangement to that one?" — is Phase D.


## 2.10 Length is not width — **DONE**

Composed spaces ran to 20 premises. They now cap at **8 / 7 / 6** for 4D / 5D /
6D, and `MODE_SCALE` ceilings drop from 20 to 13 to match.

The argument is not that long items are unpleasant. It is that length and
breadth are not the same axis:

- A premise is one more arbitrary pairwise fact. There is no unit for a set of
  them to become.
- The axes *within* one premise collapse into a single vector-valued relation
  with practice.

So width is the cheap axis and length is the expensive one, and the observed
working limit is six-dimensional items at four to five premises answered in
about thirty seconds, with seven premises out of reach at that width.

Eight premises at weight 1.6, seven at 1.9 and six at 2.2 all land at level
**13**, and that agreement is the point: the three modes reach the same real
difficulty by trading length against width. Past it a placement would clamp the
premise count while continuing to credit the level — exactly the "answered a
level-13 item, scored as level 20" failure `ceiling` exists to prevent. Above 13
the range is carried by relational order: Analogy, Transformation, Anchor Space
v2.

Two consequences that had to be handled:

- **Saved ladders can outlive the bounds.** A stored 9-premise 6D ladder would
  generate 6-premise items while reporting 9, and absorb three demotions before
  anything visible changed. `stateFor` now clamps on the way out of storage.
- **No generator enforced its own ceiling.** `canGenerateQuestion` checks only
  the floor, and every real call site happens to clamp first. `createNdSpace`
  now clamps itself, because the cap here is a claim about what is answerable at
  this width rather than a preference.

**Still outstanding:** Analogy, Binary and Deictic Relations reach 13 premises at
level 20, and Anchor Space 11. Analogy and Binary are the two you named as
acceptable at length. Deictic and Anchor Space were not, and are unreviewed.


## 4.0 One ability estimate — **DONE**, `utils/ability.utils.ts`

Three adaptive systems became one. Before: a tier driven by an accumulated
score, a per-mode staircase stepping over premises and a clock, and a
training-unit tracker with thresholds of its own. None of them exchanged
information, one of them was inert above Genius, and the number on screen was a
count of answers given.

Now there is a single latent — **ability in linear-equivalent premises** — with a
posterior per mode. Everything else is read off it.

### The difficulty scale is the whole trick

`levelOf(type, premises, rungs, seconds)` puts every axis on one number:

    weight[type] × premises  +  Σ rungCost[rung]  +  perTimeHalving × log₂(60 / seconds)

Once length, structure and clock are commensurable, three things that used to
need special cases become arithmetic:

- **"Structure before length"** stops being an axis ordering and becomes a
  tie-break. Among configurations of equal difficulty, prefer more rungs and
  fewer premises. A mode out of rungs tightens the clock instead of growing.
- **The clock is the fine axis** by construction: pick the coarsest structure at
  or under target, let time make up the remainder.
- **Rung costs are explicit.** They were previously implicit in a ladder's order
  and invisible to the score, so a rung that transformed the task counted for
  nothing.

`RUNG_MIN_PREMISES` was needed almost immediately. Without it the tie-break
stacked all thirteen rungs onto three-premise items, where branching has no
branch point and analogy has too few objects to find a matching pair. It is not
an aesthetic rule — it is the feasibility constraint the generators already
impose, written where the difficulty scale can see it. With it, premises and
rungs grow together: 3p/0 → 4p/2 → 4p/5 → 5p/11.

### What comes free

- **Cold start.** A mode with no history takes the aggregate as its prior. The
  ~240-question warm-up caused by 24 modes × a 10-trial window is gone; a
  never-played Space 6D opened at 11.6 ± 2.5 instead of the floor.
- **Decay.** Idle days widen the posterior. The *mean is preserved*, so a
  returning player is served the same difficulty and simply re-measured fast —
  nothing is un-claimed and no one is demoted for going on holiday.
- **Guess rates matter.** The likelihood takes the item's own guess rate, so a
  six-slot construction answered correctly is decisive where a true/false is
  barely evidence. Measured: posterior sd after 60 trials, 0.61 for true/false
  against 0.37 for six-slot construction.

### The score

Derived, not accumulated: precision-weighted mean ability across modes, × 100.
It can fall, it falls while you are away, and it cannot be farmed — answering
easy items *is* evidence that ability is low. The stored total still moves on the
old flat schedule underneath, so turning progression off hands back exactly the
score you would have had.

One trap worth recording: `score` is now a *derived getter*, so the old
`this.score += 10` would have read skill points and written that plus ten into
the stored total. Accumulation goes through a private `rawScore` instead.

### Measured

Simulated learners at true ability 4, 7, 10, 14, 18, forty replications each:

| | |
|---|---|
| bias | ≤ 0.12 levels |
| rmse | 0.36 – 0.43 |
| achieved accuracy | 72 – 83% against an 80% target |
| trials to settle within 1 level | median 33, 90th pct 81 |

Then end to end in the app: a simulated player with a hard ceiling at level 11
was estimated at 11.6 ± 0.5 after 120 items and served 4p / 5 rungs / 57s.

### Still open

- **The tier cheat is inert** under derived scoring, since tier now follows
  ability rather than a stored number. It would need to seed posteriors instead.
- **Rung costs are guesses.** They are at least guesses in one table now, and the
  right way to fix them is to fit them against answered items rather than to
  argue about them.
- **`useBayesian` and `useDifficultyRating` are gone** as options — both are now
  simply how it works.


## 3.6 Bayesian threshold estimation — **module DONE**, `utils/quest.utils.ts`

The staircase in `progression.utils.ts` tracks a threshold by stepping; this
estimates it. Time is a near-ideal fit for the psychophysics machinery: accuracy
rises monotonically with the deadline and saturates, timeouts are simply failures
at low intensity, and guessing enters explicitly as γ.

```
P(correct | t) = γ + (1 − γ − λ) · Φ( (ln t − τ) / σ )
```

Grid posterior over τ (60 bins in ln-seconds), slope fixed QUEST-style rather
than estimated psi-style — estimating slope costs ~3× the trials for little gain
at this sample size. Placement is at the threshold estimate (ZEST) rather than
entropy-optimal: the entropy-optimal pick buys little once the posterior is tight
and can park trials at difficulties that feel arbitrary. This is training, not
only measurement.

### Measured, by simulation against known ground truth

| Check | Result |
|---|---|
| Recovery, 60 trials, thresholds 8–110s | 9–15% median error |
| Convergence at 10 / 20 / 40 / 80 trials | 38% → 14% → 14% → 12% |
| 90% credible interval coverage | 94% (conservative, the safe direction) |
| Drift tracking, 60s → 18s mid-run | estimate followed to 22.4s |
| Promotion carry-over | mean rises, sd widens 0.18 → 0.35 |

Roughly twice as trial-efficient as the staircase, which needed ~30–40 trials to
settle. It plateaus near 12% — that floor is the guess rate, not the estimator.

### Answer mode changes the information per trial

| Trials | true/false (γ=.5) | construction (γ=.05) |
|---|---|---|
| 15 | 26% | 17% |
| 30 | 19% | 10% |
| 60 | 9% | 8% |

Construction roughly halves the trials needed for a given precision **in the
15–30 range** — the range a per-session estimate actually lives in — but the two
converge by 60. So it buys speed, not a better asymptote. (An earlier claim that
it "doubles the value of every trial" was too strong.)

### Still to wire

- Swap `ProgressionService`'s time mechanism to read `questNext` and feed
  `questUpdate`, keeping the discrete rung/premise ladder exactly as it is.
- **Promote on confidence**, not on a window: require the credible interval to
  sit entirely below `promotionSeconds`. This is the main practical gain — the
  current rule promotes on a lucky 10-trial streak.
- One posterior per *mode*; call `questPromote` on promotion rather than
  resetting. Per-configuration posteriors would fragment the data hopelessly
  (16 modes × 19 premise counts × rung states).
- `questDiffuse` once per session start, for between-session drift.
- Seed the prior from existing training-unit history instead of a flat guess.
- Keep it opt-in beside the staircase so the two can be compared on real data.

### Known limits

- The model assumes accuracy is monotone in time. Mostly true, but a rushed
  guess at a generous deadline violates it; the `fastFraction` idea from the
  staircase may still be needed as a filter.
- γ must track the answer mode. Hard-coding 0.5 while the player uses
  construction would make the estimator systematically overconfident.
- Simulations were well-specified — the observer used the same psychometric
  model being fitted. Robustness to a misspecified slope is untested.


## 3.7 Placement test — **DONE (rebuilt)**, `utils/calibration.utils.ts`

The first version measured nothing. It showed every premise at once, untimed,
drawing only from the modes the current *tier* had unlocked — which on a fresh
account is three one-dimensional chains. Premise count under those conditions is
a test of patience, so the staircase ran to the ceiling for anyone willing to
re-read, and the level it produced was then written into every mode as a raw
premise count. Twelve premises of a left/right chain became twelve premises of
Transformation.

Four changes, each closing one of those:

1. **Carousel, forward only.** One premise at a time, no going back — so the
   premises have to be held rather than re-read.
2. **A deadline on every item**, split into a reading budget (per premise shown)
   and a solving budget (per level). Timeout counts as a miss. Deliberately
   looser than the trained steady state: tightened by a third, simulation caps a
   slow-but-capable player at level 7 regardless of true ability, which is the
   untimed failure in the other direction.
3. **A linear-equivalent scale**, `MODE_SCALE`. Each mode carries a `weight`
   (linear premises per premise of that mode, anchored on the player's own
   report that 3–4p of 4D-with-a-transformation felt like 8–10p linear) and a
   `ceiling` — the level past which it stops discriminating. Linear chains stop
   at 6, Direction at 7, 3D/4D at 9/11, the composite and frame-shifting modes
   run to 20. A mode is also never offered below `ceil(minPremises × weight)`,
   which is what used to drop a 4-premise Transformation into level 5.
4. **The pool ignores tier gating** (but still respects a mode the user switched
   off in Advanced Options). A placement whose job is to skip the tier ladder
   cannot read its item pool off that ladder.

`applyCalibration` now converts the level per mode instead of copying it, and
`calibrationScore` floors the credited solve time at 1.5s per level — the rating's
time term is unbounded as the limit shrinks, so a lucky two-second guess was
outscoring a genuine solve.

### Measured, by simulation

| Check | Result |
|---|---|
| Recovery, true level 3–18, 60 runs each | median exactly on target at every level |
| 5th–95th percentile spread | ±1–2 levels |
| Length | 13–15 items mean (cap 20) |
| Slow-but-capable player (6s/equivalent premise) | recovered (10→10, 15→16) |
| Linear modes offered above level 6 | 0 across levels 7–20 |

Verified in the browser end to end: forward-only slides, countdown going red
under 20%, timeout advancing to the next item, and a true-ability-9 observer
placed at 9 through the real DOM buttons.

### Known limits

- Weights in `MODE_SCALE` are judgement, calibrated against one player's report.
  They are the right *shape* — composite modes cost more per premise — but the
  numbers deserve checking against real per-mode accuracy once there is data.
- Rounding is coarse for high-weight modes: Transformation gets 5 premises at
  both level 10 and level 12, so those two levels present the same item.
- Generators sometimes emit one more premise than requested (seen with Deictic),
  so the effective level of an item can drift slightly above its label.


## 3.8 Calibration validity — **fixed**

Three defects, all found by reading a real placement result back:

1. **It inherited the player's Advanced Options.** `MODE_SCALE`'s weights are
   documented as describing each mode *unmodified*, but items were being built
   with whatever was switched on — forced branching, transformations, looping
   axes. The level was computed on a scale that did not apply to the items it
   was measuring. Both the override layer and the ladder are now suppressed for
   the duration of a run (`suppress()` on each service).
2. **The pool respected per-mode enable switches.** Someone testing with three
   modes enabled got a placement measured on three modes, two of them the
   hardest in the app, with no cross-mode averaging left to steady it. The pool
   is now every mode, unconditionally — a placement measures the player, not
   their current playlist. Observed effect: 3 modes → 13 at level 4, 7 at 12.
3. **The meta line read `5 premises · level 12`**, two premise-ish numbers side
   by side, and the result screen then reported the level *as* "linear-equivalent
   premises". A 5-premise 6D item at level 12 was reasonably read as a
   12-premise item. Now `difficulty 12/20`.

Construction is forced wherever the mode supports it, which is ~39% of items
across the range and most items at the top.


## 3.9 Structure before length — **fixed**, `premisesMayRise`

> More than 5 premises without multiple conclusions or analogy or binary in any
> mode is dumb.

Correct, and the ladder was actively causing it: a premise increase **cleared
every claimed rung** ("re-walk the ladder at the new size"). Sensible at small
sizes — six premises with negation really is harder than five with negation and
meta — but past a handful it produced ten-premise items carrying nothing at all,
which is a longer read rather than a harder problem.

Two rules now hang off `structureBefore` (default 5):

- Above it, a premise increase **keeps** the claimed rungs.
- A mode with **no rungs left to give does not climb past it**. Graph Matching
  honours neither negation nor meta and has an empty ladder, so it caps at five
  premises. That says the true thing: the mode has run out of difficulty to
  offer, and the fix is to give it rungs, not to make its items longer.

Verified by simulation: a full ladder still reaches 20 premises with all rungs
and **zero** promotions leaving >5 premises bare; an empty ladder stops at 5; a
one-rung ladder still grows but keeps its modifier; below the cap the sawtooth
re-walk is unchanged; demotion still works.

**Still open:** the *tier* system is a separate premise source and is not capped
by this. It reads `ProgressAndPerformanceService`'s training units, which raise
premises on accuracy alone with no reference to modifiers. That is the other
half of "at Virtuoso I already have the premise counts of a mega genius".

---

Ideas worth building, each with a sketch and an honest feasibility read.


## 4.1 Flow — **DONE (two fixes)**

Challenge–skill balance is flow's central condition, and §4.0 already implements
it: items are placed just below the ability estimate. What was left was the
mechanics of *not interrupting*.

**The tier modal was a regression I introduced.** Announcing a tier change opened
a dialog and stopped the timer. That was survivable while tier came from a flat
±10 accumulator crossing a 250-point band. Once tier followed the ability
estimate — continuous, and wobbling near a boundary — the same code would reopen
the dialog every few answers.

Replaced with a toast, plus **hysteresis**: a crossing is announced only once the
score is at least 60 points inside the new band. Measured over 150 answered
items: 4 crossings, **0 modals**, 2 toasts — the crossings at 763 and 1001, which
were 13 and 1 point inside their bands, were correctly held back and announced
later once clearly inside.

**Pre-generation.** The next item is now built during the verdict flash rather
than after it, which removes the only remaining gap in the rhythm. Generation
runs ~10 ms for a mid-weight configuration and considerably more for the heavy
ones, and that landed as a visible stall between items.

It is free rather than a trade because of ordering: `record` runs before
`showVerdict`, so a prepared item is chosen from a posterior that has *already*
taken the last answer into account. Preparing any earlier — during the question,
say — would cost a trial of adaptation. Only the auto-advance path may consume a
prepared item; every other entry point can follow a settings change that would
make it stale.

### Deliberately not built

**Friction against stopping.** It was considered and rejected on the project's
own terms rather than on principle: the posterior cannot distinguish "too hard"
from "tired", so fatigued answers are recorded as evidence of *lower ability* and
set the next session's difficulty lower. Anything that keeps a tired player going
therefore corrupts the estimate that decides what they train on tomorrow. The
goal is zero friction to continue while fresh, not friction against leaving.

**Variable-ratio rewards.** They would work. They optimise for time-on-task
rather than for learning, and a predictable reward stays informative where a
random one stops being a signal at all.

**Celebration animations per item.** At roughly two items a minute, a one-second
animation after each success is a meaningful share of a session spent not
thinking, and it pulls attention outward exactly when it should stay in. Sound is
different — immediate feedback is a flow condition, so the verdict sound is
functional. Visual celebration belongs at milestones: a rung claimed, a session
finished.

### Worth building next

**Fatigue detection, which the model now makes easy.** The system predicts
P(correct) for every item it serves, so observed-minus-predicted over the last
~15 items is a difficulty-adjusted tiredness signal — far better than raw
accuracy, which falls simply because difficulty rose. Underperforming your own
estimate is the thing to detect, and trials during a detected slump arguably
should not update the posterior at all.


## 4.2 Derivation on error — **DONE (composed spaces)**

A wrong answer used to emit one bit. The item that earned it took a minute to
read, and an error only teaches if the correction is read too — so a wrong answer
now stops and shows the working:

> **How it follows**
> 1. Knot is east relative to Mister — running total +1
> 2. Green is east relative to Knot — running total +2
> 3. Glasses is same longitude relative to Green — running total +2
> 4. so Glasses is east of Mister

It walks the chain of stated relations joining the queried pair, accumulating the
asked-about axis, so the reader sees the derivation they were meant to perform
rather than the verdict alone.

### Where it deliberately stays silent

**Only while positions are the sum of the stated steps.** Edits preserve that —
they rewrite an edge's vector and the layout is re-derived from edges — but
**transformations set coordinates directly**, so a path through the premises no
longer accounts for where anything ended up. Those items get no explanation
rather than a confident fiction. Same for edited items, since `mutated` covers
both. Extending to transformed items means tracing coordinates through the
operations instead of walking the tree, which is a different renderer.

### The flow exception, stated

Everything else about the pacing removes friction — auto-advance,
pre-generation, no dialogs, toasts instead of modals — because momentum is the
point while things are going well. This is the one place friction is added on
purpose, and the asymmetry is deliberate: interrupt on failure, never on success.

### Two bugs the check caught

Both would have shipped on a visual inspection, since the overlay *looked* right:

- **`so Strap is is south of Buoy`.** `scale.above` is a whole clause — "is south
  of" — not an adjective, so prefixing "is" doubled the verb. The closing now
  uses the same phrase builder the conclusion does.
- **The arguments were reversed.** `compareOn(a, b)` means *a relative to b*, but
  walking a → b accumulates *b relative to a*. The derivation was stating the
  exact opposite of the claim, with correct arithmetic. Fixed by walking from the
  second named object to the first.

A third, smaller: circular axes closed with their own wording ("2 steps round")
against a conclusion phrased "diametrically opposite" — both true, but it makes
the reader check two things instead of one. Now shares `displacementPhrase`.

### Measured

The last line of every derivation must state the true relation, so the item is
valid exactly when that line matches its conclusion.

| configuration | items | agreed |
|---|---|---|
| 3D 5p, 3D 8p branching | 600 | 600 |
| 4D 6p, 6D 6p | 600 | 600 |
| 6D with one and two loops | 600 | 600 |

1,800 items, 100%. One derivation was also hand-checked end to end.

### Extended: linear family and Hierarchy

Ten of twenty-four modes now derive their answer.

**The linear family** (Comparison Numerical and Chronological, Vertical,
Horizontal, Containment) walks the stated pairs accumulating position. Simpler
than the composed-space version because `LinearLayout` carries absolute `pos`,
so the step is a subtraction rather than an edge lookup — and correct however the
layout was built, chain or branching, ties or none. The closing line is produced
by `renderRelation`, the conclusion's *own* renderer, so it cannot drift from the
claim it explains.

**Hierarchy** has no arithmetic to show: the route *is* the answer, and a claim
is false exactly when no route exists. Both cases are stated, and the false one
carefully — a reader who got it wrong has usually followed a link backwards, so
when the reverse route exists it is named rather than left to be wondered about:

> No route leads from Weasel to Chip.
> It runs the other way: Chip feeds Weasel.

| configuration | items | agreed |
|---|---|---|
| five linear modes, incl. branching and ties | 1,250 | 1,250 |
| Hierarchy 6p | 300 | 300 |

The Hierarchy check is stronger than agreement: every `X feeds Y` step in a
derivation was confirmed to be an actually stated premise, so the explanation
cannot quietly invent a link.

### The bug this nearly shipped

Adding derivations to the linear family silently gave one to **Analogy**, which
builds on a scale layout and then asks a different question of it. The
explanation attached while the layout was being made survived, so an item asking
*"Dog to Diary is alike Lizard to Blender"* rendered a correct, confident proof
that *"Diary is more than Lightning"* — a claim it never made.

Worse than showing nothing, and invisible to the check used for every other
mode, since that only compares a derivation against *its own* conclusion. The
invariant that catches it is different: **every subject named in the closing line
must appear in the conclusion.** Run across all 24 modes, it now finds nothing.

The general shape is worth remembering: a mode that reuses another's layout
inherits whatever that layout's generator attached, and `explanation` is the
first field that is dangerous rather than merely wrong when stale.

**Still not covered:** transformed or edited items in any mode — a path through
the premises stops accounting for positions once operations move things, so
those stay silent by design. Covering them means tracing coordinates through the
operations, which is a different renderer. Also uncovered: Analogy, Binary,
Deictic, Graph Matching, Anchor Space, the arrangement modes. The field on
`Question` and the overlay are shared, so each is a generator-side change.


## 4.3 Two gameplay bugs found in play, not in tests — **fixed**

**Questions opened on their conclusion.** `ngb-carousel` keeps its own
`activeId` across content changes and only falls back to the first slide when
that id no longer exists. Slide ids were fixed strings — `s-conclusion-0` and so
on — so answering from the conclusion left the carousel on an id the *next*
question also had, and that question opened on its conclusion with the premises
never shown. `armCarousel` looked like it handled this but only assigned a
component field; it never moved the carousel.

Fixed by making slide ids question-scoped (`s7-premise-0`), so a stale id cannot
match and the component's own fallback does the reset. Chosen over grabbing the
carousel and calling `select()` because the slides are rebuilt by `ngFor` on the
same tick the question changes, so an imperative reset races the render.

**A clock ran with nothing on screen.** The timer bar was shown on
`timerType !== '0'` — the *setting* rather than the fact. Progression arms a
clock of its own regardless of that setting, so with the ladder on and the timer
preference off, questions were being timed out with no countdown visible and no
way to tell it from a bug. The bar now shows whenever a limit was actually armed
for the question, and `timerTimeSeconds` is cleared per question so a stale value
cannot show a bar for an untimed item or divide the progress bar by the wrong
total.

Worth noting the shape of both: each was a *predicate that named the setting
instead of the state*. Neither is reachable by the generator verification that
found everything else, because neither is about what an item says.

---

## Phase 3.1 — **DONE (partly)**: generator diagnostics

`pages/diagnostics/` — drives the real generators through Angular DI and asserts
invariants that need no premise parsing: doesn't throw, premises non-empty and
distinct, conclusion non-empty, conclusion is not a restated premise, answer not
stuck on one value.

**It found a hang in `createDeictic` on its first run.** The mode used
`do { ... } while (isPremiseLikeConclusion(...))`. That helper compares
`subjects[0] + subjects[1]`, i.e. it assumes **two-subject** premises. Deictic
statements carry one subject, so both sides stringified with a trailing
`undefined`, and the claimed symbol always comes from the grid — the guard matched
every time and the loop never exited. Replaced with a bounded loop and an exact
restatement check.

This is why the game would not start from Arcade in earlier sessions. That was
never a tooling quirk; it was this hang.

Lessons baked into the tool:

- A synchronous generator loop **cannot be interrupted** from the UI thread; it
  wedges the tab. So type selection is opt-in, defaulting to generators known to
  bound their own retries.
- A breadcrumb is written to `localStorage` (`syllogimous-diag-inflight`) *before*
  each type runs, so a hang is attributable after the tab dies. Read it from any
  other tab. This is what identified the culprit.
- Stock v4 types are unticked by default — **not** because they are known bad, but
  because they are unverified and several use unbounded retries. Ticking them is
  the way to find out.

Current state: the four added modes pass (25/25 each, truth rates 36–68%).
`isPremiseLikeConclusion` should be treated as unsafe for any single-subject mode.

**Live-settings mode.** The harness assigns `playgroundSettings`, and the settings
getter returns that first — so the override and progression layers were never
exercised by it. A run that looked like it verified per-mode gating had in fact
bypassed the layer entirely. The harness now has a "Use live settings" toggle
that leaves the getter alone, plus per-type counters for negation and meta so a
modifier is observable rather than inferred.

That closed the gap it was built for: with Distinction holding the `meta` rung
and Comparison Numerical holding none, one run produced 249 meta relations for
the first and 0 for the second — per-mode gating from a single global flag,
confirmed rather than assumed.

Remaining for 3.1: answer-level verification via the relation-algebra engine,
which needs generators to emit structured premise data alongside HTML.


---

# Reference

## Rung ladders per mode family

A rung is a named modifier a mode can carry. `RUNG_LADDERS` in
`utils/progression.utils.ts` is the source of truth — a table here would drift
from it — but three invariants are worth stating because they are not obvious
from reading it:

- **A mode's rungs are always a prefix of its ladder.** Nothing selects rung 7
  without 1–6, so ladder *order* is a teaching order, not a difficulty ranking.
  Difficulty comes from `RUNG_COST`, which is a separate table.
- **A rung costs premises to be meaningful.** `RUNG_MIN_PREMISES` records how
  many; branching needs a branch point, analogy needs enough objects for two
  disjoint pairs. Without it the selector stacks every rung onto the shortest
  possible item, where half of them have nothing to act on.
- **Rungs no longer reset on a premise increase.** That was a property of the old
  staircase, where premises and rungs moved on separate axes. They are now
  points on one scale, and the selector picks whichever combination sits nearest
  the ability estimate.

A mode with an empty ladder — Graph Matching honours neither negation nor meta —
has no structure to add, and `premisesMayRise` stops it growing on length alone.
The answer is to give it rungs, not to make its items longer.

---

# Superseded

Kept because they explain *what was replaced and why*, which is the part that
stops an old idea being reintroduced. None of it describes the current system.

**The fluid progression design** — the three-axis staircase, its sawtooth, its
step-size derivation and its `LadderState` — was replaced wholesale by
[4.0](#40-one-ability-estimate--done-utilsabilityutilsts). One latent, one
posterior per mode, and the axis ordering became a tie-break rather than a rule.

**The original phase plan** — Phases 1, 2, 2.5 and 3, plus the suggested order
and build order derived from them. Most items are done and have their own entry
above. Two are not, and are the reason this is kept rather than deleted:
**Relational Web** (2.1, the "marquee feature", never built) and **Facing Space**
(2.2, which is the same proposal as P1 — it was specced twice, years apart,
without either noticing the other).

### The problem with what exists

v4 already adapts per mode via **training units**
(`progress-and-performance.service.ts`): each type keeps `premises / right /
wrong / timeout`, and after `trainingUnitLength` trials the premise count moves
up or down against accuracy thresholds. Two things make that feel abrupt:

- **Premise count is the only dial.** Going 4 → 5 premises is a large jump in
  working-memory load. There is nothing between "comfortable" and "overloaded".
- **Time is fixed.** The countdown is a setting, not a difficulty axis, so the
  system cannot apply pressure without adding material.

The modifiers that *would* give finer steps — negation, meta, transformation
depth — are global on/off switches unrelated to progression.


### Three axes, three granularities

Difficulty moves along the finest axis available, and only escalates to a
coarser one when the finer is exhausted:

| Axis | Granularity | Moves |
|---|---|---|
| **Time limit** | continuous | every trial |
| **Modifiers** (negation, meta, transform depth) | small discrete | at a promotion, if rungs remain |
| **Premise count** | large discrete | only when all rungs are claimed |


### The sawtooth

```
time
 ▲
 │╲        ╲        ╲
 │ ╲        ╲        ╲          each fall = getting faster
 │  ╲___     ╲___     ╲___      each jump = a promotion
 └────────────────────────► trials
      ↑        ↑        ↑
   rung 1   rung 2   premises+1
```

1. Start at `ceilingSeconds`, minimum premises, no modifiers.
2. Correct answers shrink the limit; errors and timeouts grow it.
3. When the limit reaches `promotionSeconds` **and** rolling accuracy ≥ target:
   claim the next **rung** if any remain, otherwise **premises += 1** and reset
   rungs. Either way the limit resets toward the ceiling.
4. If accuracy collapses near the ceiling, unclaim a rung, or drop a premise
   when none are claimed.

This is what makes "premise ups at 20s" work: `promotionSeconds` is user-set, so
a player chooses the speed they must reach before taking on more material.


### Staircase step sizes are not arbitrary

An asymmetric up/down staircase converges on a known accuracy. For target `p`:

```
shrink / grow = (1 - p) / p
```

so `p = 0.8` ⇒ grow is 4× shrink. **Set the ratio from the target accuracy
rather than hand-tuning two numbers** — otherwise the system silently converges
somewhere the player never asked for. Suggested defaults: `shrink = 3%`,
`grow = 12%`, `p = 0.8`.

Timeouts should grow harder than wrong answers (say 1.5×): a timeout means the
limit itself was the binding constraint, a wrong answer may not be.


### Data model

Extend `ITrainingUnit` rather than introducing a parallel store — the existing
right/wrong/timeout counters and up/down thresholds already work.

```ts
interface ITrainingUnit {
    premises: number;
    right: number; wrong: number; timeout: number;   // existing
    timeLimit: number;      // seconds, the continuous axis
    rungs: string[];        // claimed modifier ids, in order
    recent: boolean[];      // rolling window for accuracy
}
```

Config (per profile, not per mode):

```ts
{
    ceilingSeconds: 90,     // reset point after a promotion
    promotionSeconds: 20,   // user's "premise up at" threshold
    floorSeconds: 8,        // never shrink below this
    targetAccuracy: 0.8,    // derives the shrink/grow ratio
    windowSize: 10,         // trials in the rolling window
    enabled: false,         // opt-in; tier behaviour unchanged when off
}
```


### Integration points

- `GameService.settings` already applies `SettingsOverrideService`; the ladder
  becomes a second layer applied after it, so precedence is explicit:
  **tier → user overrides → progression**.
- The countdown comes from `GameTimerService.start(seconds)`, already
  parameterised — the ladder just supplies the number.
- Modifiers are `settings.enabled.*` flags plus per-mode numeric settings, which
  the ladder writes the same way overrides do.
- Answer results already flow through `updateTrainingUnit`; the ladder update
  hooks there so nothing new needs to observe the game loop.


### Risks worth designing around

- **Fast-and-wrong.** Shrinking on any correct answer rewards guessing on a
  binary question. Require the answer to be both correct *and* faster than a
  fraction of the limit before shrinking.
- **Ratcheting on a bad day.** Cap demotions per session so one poor run does not
  undo weeks.
- **Mode starvation.** Per-mode ladders mean rarely-played modes stay easy; the
  weighted sampler should favour modes whose ladder is behind.
- **Timeouts as data.** A timeout is not a wrong answer — record it separately in
  the rolling window or accuracy will read low for a purely speed-driven failure.


### Suggested order

1. **1.3** presentation modifiers — warm-up, proves the port path works
2. **1.1 + 1.2** transformations and anchors — the stated main gap
3. **3.1** verification layer — do this *before* the hard new modes, so Relational
   Web and Facing Space get checked as they are written
4. **2.1** Relational Web — highest visible value
5. **2.2 / 2.3** Facing Space, then N-D space
6. **2.4** smaller features, **3.2–3.5** the genuinely novel structures

Rationale for putting 3.1 third: every mode after it is a generator that can be
silently wrong. Building the checker first means the expensive modes are verified
by construction instead of debugged by hand.


### Build order

1. **DONE — `utils/progression.utils.ts`.** Pure state machine: config, ladder
   state, `update()`, and the per-family rung tables. No Angular, no storage, so
   it is verifiable in isolation.

   Verified by simulation, not just assertion — a player with a soft speed
   threshold was run 20k trials against the staircase:

   - step ratio holds `shrink * p == grow * (1 - p)` across target accuracies
   - convergence: target 0.70 → observed 0.733, target 0.80 → observed 0.821
   - promotion claims `rung, rung, premise`; a ladderless mode goes straight to
     premises; a premise-up resets rungs
   - demotion pops `rung, rung, premise` and never passes the minimum
   - clamps hold, and 5000 coin-flip guesses leave the limit at the ceiling
     rather than dragging it to the floor — the "comfortable win" guard works

   Still to wire: reading/writing this state on `ITrainingUnit`, which is step 2
   territory since it needs the timer feeding `answerSeconds` back in.

   **Sawtooth observed** (Diagnostics → Progression simulation). Driving the real
   service with a synthetic player produced three full cycles: time falls, a rung
   is claimed and the clock resets, the second rung follows, then premises rise
   and the rungs clear so the ladder is re-walked at the new size.

   | trial | premises | secs | event |
   |---|---|---|---|
   | 17 | 2 | 60 | rung-up (negation) |
   | 25 | 2 | 60 | rung-up (meta) |
   | 44 | 3 | 60 | premise-up, rungs reset |
   | 85 | 4 | 60 | premise-up, rungs reset |

   The simulation restores the ladder afterwards, so running it never costs real
   progress — it substitutes only the human, keeping the same service, config and
   persistence. Driving the browser UI for 120 questions had repeatedly failed;
   going through the service directly was both cheaper and stronger evidence.
2. Wire the time limit into `GameTimerService`.
3. Rung ladders per mode family, starting with negation/meta which already exist.
4. Progression panel in the drawer: current premises, time limit, claimed rungs,
   and the thresholds as inputs.
5. Only then transform depth as a rung, since that needs the depth setting
   exposed per mode first.


### Phase 1 — Ports from v3 (cheap, source exists)

#### 1.1 Transformations — **DONE** (core), `utils/transformations.utils.ts`

Ported the four operations as pure coordinate maps (mirror / set / scale / rotate),
plus `replay()` for exact verification. New `Transformation` question type:
layout premises fix a starting arrangement, transform premises mutate it, the
conclusion is about the final state.

Verified: mirror is involutive, `rotate⁴` = identity, `rotate²` = point
reflection, cw/ccw cancel, ops touch only their own axis, `replay` matches
stepwise application and never mutates its input. Generator: 5100 items over
premise counts 4–20, exact premise counts, ~49% true.

Two things fell out of this that were **not** in the original plan:

- `canGenerateQuestion` gates non-basic types behind "two basic types enabled",
  because Analogy and Binary *compose* other questions. Graph Matching was
  exempted by name. Transformation and Deictic are equally self-contained, so
  they are now in a `SELF_CONTAINED_TYPES` set. **Deictic was silently affected
  by this too** — it could not generate with few basic types enabled.
- Still deliberately **not** ported: v3's `createChains` / `directionize`
  heuristics, which pick *which* dimension to transform along by measuring
  accumulated shift per axis. The current generator picks dimensions uniformly.
  That is the remaining fidelity gap; it affects item texture, not correctness.

Original v3 notes retained below for that remaining work.

#### 1.1a Chain heuristics (remaining, `space-hard-mode.js`)
The main content gap. Words hold N-dimensional coordinates; transformations
mutate them along dimension *chains*, then the conclusion is re-derived from the
mutated map. Difficulty comes from tracking mutation, not from chaining premises.

- Bridge v3's `wordCoordMap` (`{word: [x,y,z]}`) to v4's
  `coords3D: [string, number, number, number][]`. Write the adapter both ways and
  unit-test the round trip before touching generation.
- Port `applyHardMode` / `createChains` / `applyChain` / `oneTransform`.
- Keep v3's retry loop: it rejects transforms where the conclusion coord goes
  all-zero, enforces a distance limit, and demands the conclusion actually
  *changed* (`demandChange`). Those guards are why its items are non-degenerate —
  do not drop them.
- Expose depth as a setting: wire `numTransforms` into the Advanced Options page
  (the surface already exists).

#### 1.2 Anchor Space — **DONE**, `utils/anchor.utils.ts`

The plan called this a port. It was mostly not one, and the correction is worth
recording:

- `anchors.js` holds **only** SVG shapes — no mode logic — and runs
  `document.getElementById(...)` at import time, so it cannot be imported as-is.
- The actual mode is `new DirectionQuestion(new Direction2D(false, true))`: Anchor
  Space is **2D direction with a flag**, not a separate generator. The flag's only
  real effect is `createWordMapAnchor`, which seeds the coordinate map with four
  fixed markers in a diamond (star `[0,1]`, circle `[1,0]`, triangle `[-1,0]`,
  heart `[0,-1]`) and builds objects onto that frame.

Implemented as a standalone type rather than a flag on v4's `createDirection`,
which keeps v4's 700-line direction generator untouched. Objects are each pinned
to one marker; a queried pair anchored to the *same* marker is rejected, since
those compare directly without using the frame.

Reuses `describeOffset` / `describeConclusion` from transformations.utils — they
walk the coordinate length, so 2-element coords yield only east/west and
north/south wording. Verified: 5400 items, premise counts exact, anchors provably
never move, every premise references a marker, ~51% true.

**Anchor Space v2 — DONE.** Composes 1.1 and 1.2: the frame is stated first, then
transforms mutate the objects measured against it. Markers are eligible as
*pivots* but never as movers, which is the literal reading of the snapshot
tooltip ("keeps anchor markers fixed during transforms") and what makes the frame
worth having — a reference point that itself moved would invalidate every premise
stated against it.

Verified: 5400 items, premise counts exact, anchors provably never displaced,
never selected as a mover, ~41% of transforms pivot on a marker, ~49% true. Also
carries the "transforms must change the queried pair" guard, so no item is
answerable from the layout premises alone.

#### 1.3 Presentation modifiers (small, independent)
`premise-reorder.js`, `wide-premises.js`, `visual-noise.js`,
`incorrect-directions.js`, `junk-emojis.js`. Each is a display/stimulus modifier
rather than a mode — cheap wins that add snapshot parity.

**DONE — visual noise** (`utils/visual-noise.utils.ts`). Ported the seeded LCG and
recursive rectangle splitter; hooked into `getSymbols`, which is the single
stimulus chokepoint, and exposed as a flag on the Advanced Options page.

Port notes for the remaining four:

- `getSymbols` in `utils/question.utils.ts` is the **only** place stimuli come
  from. Any new stimulus kind is one branch there plus a flag in
  `DEFAULT_ENABLED_FLAGS`, the `setEnable` union, and the override service.
- Keep generation **seeded and deterministic**. Stored history re-renders from
  the saved question, so a stimulus that regenerates randomly will not match what
  the user originally saw.
- v3's colour formula (`lightness = 10 + rand*91`) can emit 100% lightness —
  pure white, invisible on light themes. Clamped to 18–82% here. Expect similar
  contrast bugs in the other stimulus ports; the Vercel build's "Adaptive
  Symbols" changelog entry exists for exactly this reason.


### Phase 2 — Vercel-unique, must be written (no source anywhere)

#### 2.1 Relational Web — the marquee feature
Spec recovered from the snapshot:

- Settings: nodes 3–12 (default 7), time, priority %, colored nodes 2–12
  (default 2), role difficulty (`adaptive` | `degree cues` | `structural`),
  trial type (`mapping` | `comparison` | `properties` | `mixed`).
- Description: *match highlighted nodes across procedurally rearranged isomorphic
  directed webs; structural trials remove position and degree shortcuts.*
- Properties legend: Reflexivity, Irreflexivity, Symmetry, Antisymmetry,
  Asymmetry, Transitivity.
- Property-categories rule: TRUE when **both** graphs satisfy the named property
  **or both** violate it.

Implementation:

1. Random directed graph `G` on n nodes. Build `G' = π(G)` for a random
   permutation π, then lay it out with fresh random positions — isomorphic by
   construction, visually unrecognisable.
2. **Mapping trial:** highlight node `v` in `G`; ask which node of `G'` matches.
   Answer is `π(v)`.
3. **The correctness trap:** if `Aut(G)` is nontrivial and `v` sits in an orbit of
   size > 1, several answers are equally valid and the item is broken. Either
   require `v`'s orbit to be a singleton, or accept the whole orbit. Compute
   automorphisms by backtracking with colour-refinement pruning — trivial at
   n ≤ 12.
4. **Difficulty knob:** `degree cues` lets in/out-degree identify the match.
   `structural` requires `v` to share its degree signature (and ideally its
   1-WL colour) with another node, so only deeper structure disambiguates.
5. **Comparison trial:** show two graphs, ask whether isomorphic. Generate
   near-misses by a 2-swap rewire that preserves the degree sequence but changes
   the refinement classes — otherwise "count the degrees" solves it.
6. **Properties trial:** properties are one-liners on the adjacency matrix.
   Evaluate on both graphs and apply the both-satisfy-or-both-violate rule.
7. **Rendering:** new Angular component, SVG, arrows for direction, self-loops for
   reflexivity. This is the only item here needing real new UI.

#### 2.2 Facing Space
Snapshot: *"position + facing + turns + rotations around pivots."* Each object has
position **and** a facing; relations are egocentric ("to A's left" means left of
A's facing, not absolute). Convert by rotating the world→object vector by −facing.
Genuinely perspective-taking, and it composes with the Deictic mode already built.

#### 2.3 Space 4D / 5D / 6D
Snapshot names the axes: 4D adds a dimension, 5D adds Quantity, 6D adds
Membership. Requires rewriting `createDirection3D` (275 lines, hardcoded to three
axes, cardinal maps, `Math.cbrt`, fixed 4-tuples) as a dimension-parameterised
generator plus a general `coordsND` field. Biggest refactor here; also unlocks the
snapshot's "Height Levels 3D–6D" (adaptive, or force 2–5 levels).

#### 2.4 Smaller Vercel features
- **Multiple Conclusions / Conclusions by Mode** — `Question.conclusion` is already
  `string | string[]`; needs answer UI and a per-mode count setting.
- **Relation Gaps** — show relation cues briefly, then mask. Working-memory load.
- **Connection Branching** — premise graph branches instead of forming one chain.
- **Priority weights** — snapshot has a priority % per mode; v4 picks uniformly
  within groups. Replace with weighted sampling.
- **Adaptive symbols** — contrast-aware stimulus colouring against the active
  background (the snapshot computes contrast ratios per symbol).
- **Set Hierarchy syllogism** — quantified set logic (All/No/Some/Some-not) over
  connected proof networks where every premise is load-bearing.


### Phase 2.5 — Answer modes (new)

Everything so far varies the *item*. These vary how the player **responds**,
which is a difficulty axis nothing else touches.

#### 2.5a Multiple conclusions

Several conclusions per item, each judged separately. `Question.conclusion` is
already typed `string | string[]`, so the model needs no change — the work is the
answer UI, a per-mode count, and a scoring rule.

- **Per-mode count**, as the snapshot has ("Conclusions by Mode"), with a global
  default. Two conclusions over five premises is a different load from one.
- **Scoring.** All-or-nothing is harsh and makes partial knowledge worthless;
  per-conclusion credit is fairer but lets a guesser bank half. Suggest
  per-conclusion credit for stats, all-or-nothing for the progression outcome,
  so the ladder is not fed a stream of half-successes.
- **Generation.** Conclusions must be independent — several restatements of the
  same relation is one question asked twice. Reuse the existing pair guard: no
  two conclusions may query the same pair.
- **Fits progression as a rung.** More conclusions raise difficulty without
  adding premises, which is exactly what a rung is for. Cheaper than a premise,
  dearer than a time cut.

#### 2.5b Conclusion construction

Rather than judging a presented conclusion, the player **builds** it: choose a
subject, a relation, and a second subject.

The reason this matters is the guessing floor. A true/false conclusion can be
answered correctly half the time by a coin flip — which is why the progression
ladder needs its "comfortable win" guard, and why a 50% accuracy reading is
nearly uninformative. Construction removes the floor entirely: with n subjects
and r relations the chance of a lucky hit is ~1/(n(n-1)r), so accuracy starts
meaning something.

Three variants, cheapest first:

1. **Relation only.** The pair is given, the player picks the relation. Smallest
   UI change, still kills guessing on modes with more than two relations.
2. **Full construction.** The player picks both subjects and the relation. Needs
   an "is this conclusion true?" check for an *arbitrary* pair, not just the one
   the generator chose.
3. **Free production.** Any valid non-trivial conclusion is accepted. Needs the
   solver to enumerate what follows, and a triviality filter so restating a
   premise does not count.

**Prerequisite.** Variants 2 and 3 need the generator to answer "what is the
relation between arbitrary X and Y?" rather than only validating its own chosen
conclusion. The four added modes can already do this — `replay` and the
coordinate maps give any pair on demand — but stock v4 generators cannot without
the structured-premise work that answer-level verification also needs. **Build
variant 1 for all modes, variants 2–3 for the coordinate-based modes first.**

This is also the natural home for the relation-algebra engine: it already
computes the full set of relations consistent with the premises, which is
exactly what variant 3 needs to mark a free-form answer.


### Phase 3 — The "improved" part (beyond Vercel)

Work already proven in `relational-engine/` (standalone, verified against
brute-force enumeration). Porting it into v4 is what makes this build *better*
than the Vercel one rather than merely equal.

1. **Relation-algebra engine as a verification layer.** Point algebra over
   endpoints + path consistency. On the convex fragment PC is complete, so the
   relation set for any pair is exact. Run every generated item through it and
   assert the generator's claimed answer — this catches generator bugs
   automatically across all modes.
2. **Three-way answers: NECESSARY / POSSIBLE / IMPOSSIBLE.** Binary true/false is
   only adequate because total orders never produce ambiguity. Needs
   `Question.userAnswer`/`isValid` widened from boolean.
3. **Allen interval algebra** (13 relations). Turns point-based before/after into
   interval reasoning where composition is disjunctive.
4. **Computed difficulty** — chain length, surviving-set size, scramble distance,
   off-path premise count. Premise count is a poor proxy; off-path premises are
   nearly free.
5. **Structures no version has:** cyclic order/betweenness (wraparound breaks
   chaining), semiorders (intransitive indifference), non-transitive tournaments
   (punish the chaining reflex), RCC-8, generalised quantifiers ("most" is
   non-transitive — a trap for the syllogism-trained).

