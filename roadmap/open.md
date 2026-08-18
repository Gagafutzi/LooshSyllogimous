# Open

## Next up

Ordered by value, not by size. The first two compound with every session played;
the rest add capability.

### 1. Finish derivation coverage — **DONE**

**All twenty-five sampled modes explain themselves.** The last eight were
Comparison, Distinction, Direction, Direction3D, Syllogism, Transformation,
Anchor Space v2 and Analogy.

Three things came out of finishing it.

**Comparison needed no new reasoning at all.** It runs the pre-engine generator
whenever no structural modifier is live, so the two covered scale modes explained
themselves and the Comparisons did not, purely because of which code path ran.
`bucket` is the chain in order and `sign` is which way it runs, so the layout is
recoverable exactly and the shared renderer does the rest.

**The transformation case needed the different renderer this file predicted.**
A walk through the premises is wrong in any mode whose premises *change* the
arrangement rather than describe it: the relation a premise states stops holding
the moment a later transform moves one of its ends, so a walk derives the
*starting* relation and presents it as the answer. Transformation and Anchor
Space v2 replay positions instead, and show only the steps that move one of the
two queried objects — the rest are there to be read and dismissed.

Transformation states coordinates relative to the first object, since that is all
the premises determine; they chain offsets, so the arrangement is fixed only up
to where the chain is pinned. Shifting the whole frame is safe because every
operation is defined against a pivot that shifts with it.

**Analogy really was one branch per layout,** as predicted. It has no relation of
its own — it takes a finished item from one of five other modes and asks whether
one pair stands to each other as another does — so there is no shared quantity to
fall back on and each layout describes its own pairs.

Verification went beyond the subject invariant, because a derivation that
recomputes an answer is a second implementation of arithmetic the generator
already did, and two implementations drift:

- `a replayed trace ends where the answer says it does` — for both trace modes,
  the direction the trace ends on must match the conclusion on a true item and
  contradict it on a false one.
- `Analogy's derivation agrees with its answer` — over all five layouts, reading
  the claim off the rendered conclusion because negation flips it.
- The coverage test's floor is now the full set rather than a number to beat, so
  losing a mode fails instead of quietly logging a smaller number.

### 2. Fatigue detection — **DONE**

The ability model predicts P(correct) for every item it serves, so
**observed minus predicted** over the last ~15 items is a difficulty-adjusted
tiredness signal — much better than raw accuracy, which falls simply because
difficulty rose.

This matters more than it looks: the posterior cannot distinguish "too hard" from
"tired", so fatigued answers are recorded as evidence of *lower ability* and set
the next session's difficulty lower. Trials during a detected slump arguably
should not update the posterior at all.

**Built.** `ProgressionService` records `observed − predicted` per answer, using
`pCorrect` against the estimate the item was *chosen* under — taken before the
update, or it would be measuring the model against a posterior that had already
seen the answer. The mean over the last `fatigueWindow` answers is the signal;
past `fatigueThreshold` below zero it reports `tired`, and with `pauseWhenTired`
the posterior stops moving. Trials during a slump still enter the window, which
is what lets the slump end.

Three decisions worth recording:

- **Half a window minimum.** Three answers below expectation is a run of luck at
  any ability, and acting on it would rest the estimate for everyone who started
  slowly.
- **The state is shown, not just acted on.** A difficulty that silently stops
  responding is indistinguishable from a bug; Advanced Options carries the
  reading and the switch that turns the behaviour off.
- **The window survives a reload**, so closing the tab mid-slump does not reset
  the judgement.

### 3. Indeterminacy — **DONE**, rung `indeterminate` on the composed spaces

Every composed-space item was fully determined by construction, so it could be
solved by constraint propagation — scan, intersect, repeat — which is search with
bookkeeping rather than relational integration. Now some clauses are withheld,
several arrangements satisfy the premises, and the claim is one of necessity:
true only if it holds in all of them.

**It needed no model enumeration.** The stated pairs form a tree, and any
assignment of vectors to a tree's edges yields exactly one layout — which is
precisely why every item so far was determined. Withholding a clause breaks the
tree *on that axis only*, so the objects split into groups nothing relates, and
the whole question reduces to **per-axis connectivity**: a relation is pinned
down exactly when a path of premises that all mention that axis runs between the
two. Under-specification is usually expensive to reason about; here the
structure of the premise set does the work.

Three things this had to get right:

- **Never alongside `compact`.** Compact omits a clause to *state* that a pair is
  level. Both live at once would give one omission two incompatible meanings in
  the same sentence — not a harder item, an unfair one. Also excluded alongside
  edits and transformations, which are answered by replaying what the premises
  did rather than by reading what they left out.
- **Roughly half the items are asked about a pair the premises do pin down**, so
  the wording gives nothing away: "not stated" has to be established rather than
  guessed from the mode being on.
- **The rule is stated in the setup.** Every other mode guarantees the premises
  settle the question, so a reader who cannot find the answer assumes they missed
  a step and keeps looking. Here not finding it is sometimes the answer.

**Verification does not check the structural test against itself.** It builds the
counter-arrangement: everything reachable from one end using only premises that
mention the axis, slid forty steps along it. Every stated clause still holds —
each joins two objects that moved together — and the two objects end up on
opposite sides in the two arrangements. Twenty-five open pairs proved open that
way, plus the converse check that a directly stated relation is never reported
open.

Costed at 1.3 levels, dearer than the other premise-shape modifiers, because it
changes what is being asked rather than how it is worded.

### 4. Transformation matching — **DONE**, `generators/transform-match.ts`

The induction gap, closed. Every other mode states its relations and asks you to
apply them; this asks which relation is operating, which is the operation matrix
tests measure.

Four forms, verify as the base and the rest as rungs:

| form | asks | cost |
|---|---|---|
| verify | does this map send S to S′? | base |
| identify | which map sends S to S′? | 1.0 |
| **apply** | **S : S′ :: R : ?** — the Raven's-isomorphic one | 1.6 |
| compose | where does R land after both steps? | 1.4 |

Tractable for the reason predicted: the points are **labelled**, so verification
is `applyMap(S, T)` compared point by point. Exact, linear, no isomorphism
search.

The maps are deliberately *global* — they act on the whole structure at once,
unlike `transformations.utils.ts`, whose operations move one object relative to
an anchor. A map that moved a single point would make "which map is this?" a
question about that point rather than about the structure.

**Three things building it turned up.**

*The structure has to identify the map.* A shape symmetric about the origin is
fixed by a half turn, so "which map is this?" would have two right answers and
the item would be quietly unanswerable rather than visibly broken. Structures are
drawn until no two maps in the pool send them to the same place — cheaper than
reasoning about which pairs collide.

*And so does the halfway structure.* That check only covers the *start*; the
halfway point of a compose item is an image, and a map can land it somewhere two
other maps agree on. The reader then finds *a* second step, applies it, and gets
a defensible wrong answer. Caught by the test, not by inspection.

*Compose has to show both steps.* The first version stated one step and then said
"the same two changes are applied again" — asking the reader to use a map the
item had never shown. Three structures are stated instead, so each step is
identifiable on its own, and false endings are drawn from plausible misreadings
(one step only, the two in the wrong order, one step twice) rather than from
arbitrary wrong positions that could be rejected without doing the work.

Weight 2.1 per point with a ceiling of six: each point is a coordinate pair to
check rather than one relation to append, and the work is finding a rule rather
than following one, so a four-point item is nothing like a four-premise chain.

### 5. Realized width as a difficulty axis — **PARTLY DONE**

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

**What was done — the noise, not the dial.** Two things were tangled together
here. Using width as a *dial* needs the bits-to-levels coefficient, and the
argument above is right that it should be fitted against answered items rather
than guessed. Holding width *steady* is a different problem, and it is the one
carrying the cost: the ±1 level of noise is there whether or not anyone ever
turns a dial.

Composed-space layouts are now drawn nine at a time and the median by width is
kept. Measured over 3,000 items at 6D with six objects:

| | mean | sd | range |
|---|---|---|---|
| one draw | 10.07 | 0.98 | 6.6 – 13.5 |
| median of nine | 10.08 | 0.41 | 8.8 – 11.5 |

The middle does not move, so difficulty is unchanged; the tails go, which is
where the noise was. No coefficient is involved, and it is self-calibrating —
the median of a sample from whatever configuration is in play, with no table to
keep in step with the axis presets. Nine is enough for the median to sit
reliably in the body of the distribution and cheap enough that generation cost
does not move.

The test asserts the spread narrows *and the mean does not*, because a change
that made every item easier would show the same reduced spread and would be
wrong.

**Still open: the dial.** Targeting a requested width, and the coefficient to
convert bits into levels. Both want fitting data — the same argument as
`RUNG_COST`, and the same answer: measure it rather than guess it.

### 6+. New modes

Eleven are specced below. In rough cost order:

| | |
|---|---|
| ~~Transformation matching~~ | **built** — `generators/transform-match.ts`, `utils/gridmap.utils.ts` |
| [P6 shape and rotation](#p6-shape-and-rotation) | cheapest — an *n*-gon's rotations are already `AxisSpec` with `modulus: n` |
| ~~P9 infer the relation~~ | **built** — `generators/infer-relation.ts` |
| ~~P12 transformation of function~~ | **built** — `generators/stimulus-function.ts` |
| ~~P11 oddest relation out~~ | **built** — `generators/oddest-relation.ts` |
| [P10 sequence induction](#p10-sequence-induction) | Phase D with the mapping applied *n* times |
| [P7 nested spatial](#p7-nested-spatial--mixed-dimensionality-with-deliberate-interference) | mixed dimensionality with deliberate interference |
| [P1 facing space](#p1-facing-space-as-a-modifier) | a modifier for any spatial mode |
| [P2 knights and knaves](#p2-knights-and-knaves) | |
| [P8 boolean concepts](#p8-boolean-concept-learning--rework-the-form-before-building) | **rework the form first** — the standard paradigm is inefficient for training |
| [P4 graph matching extended](#p4-graph-matching-extended) | edit distance is the hard part |
| ~~Relational Web~~ | **built** — `generators/relational-web.ts`, `utils/web.utils.ts` |
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

## P9. Infer the relation — **DONE**

Premises use an unnamed operator — "X ⊕ Y", "Y ⊕ Z" — with enough ground truth to
pin down which scale ⊕ is. Identify it.

The cheapest induction mode on the list: it reuses the whole composed-space
engine, the answer is one of the known scales, so it is a choice item with exact
verification and no new machinery. Difficulty comes from how many premises are
needed before the operator is determined, and from how many scales share
direction words.

### What building it turned up

**The uniqueness check is the mode.** An item is only answerable if exactly one
axis is consistent with every ⊕ claim, and that is not visible in the rendered
text — two axes could both fit and the item would look identical. So the draw is
retried until the hidden axis is the *sole* survivor of the elimination, and the
same test is applied in `tests/induction.test.ts` rather than trusted.

Circular axes are excluded as candidates. On a ring nothing is greater than
anything else, so "A ⊕ B" has no truth value there and the axis could never be
eliminated or confirmed — it would sit in the choice list forever as an option
no evidence bears on.


---

## P10. Sequence induction

S₁, S₂, S₃ generated by a repeated operation; produce S₄.

[Phase D](#4-graph-transformation-matching) with the mapping applied *n* times
rather than once, so it shares the transformation machinery and the same
labelled-structure tractability — verification stays `applyTransform` composed
with itself.

---

## P11. Oddest relation out — **DONE**

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

### What building it turned up

**Eight axes are not available.** The first run drew a stack past the six-axis
preset, where `axesForDimensions` extends from the choice list and picks up two
scales that share direction words — quantity and vertical both say
"higher"/"lower". A premise then stated "higher" twice with nothing to tell the
two dimensions apart: ambiguous to *read*, never mind to solve. Exactly what
`axisWordConflicts` exists to name, and it took one plain-text read of a
generated item to see.

So the stack is capped at six, and that caps the mode: distances 0..4 need ten
deviations, six axes hold two apiece, so **five relations is the ceiling**.
Six would need eight axes and there are not eight unambiguous ones.

**Ranking is still unbuilt.** The mode ships as a choice item at a 20% guess
floor; ranking all five through the existing `construct` answer mode would take
it to about 1%, and is the obvious rung.


---

## P12. Transformation of stimulus function — **DONE**

RFT's third pillar, and entirely absent. The app has mutual entailment and
combinatorial entailment thoroughly; it has nothing where a property attached to
one object propagates through the relational network.

> Zib is heavier than Kod. Mek is heavier than Zib. **Zib is dangerous.**
> Which is most dangerous?

A different cognitive operation from deriving a relation, central to the theory
the project descends from, and cheap — it builds on layouts that already exist.

**Built.** One thing the sketch above leaves out and the mode needs: the frame
that carries the function has to be *stated*, and half the time it must run
against the scale — "heavier means **less** dangerous". Otherwise the answer is
always the extreme of the scale and the property never has to be carried at all,
which makes it a scale mode with extra words.

The anchor is drawn from the middle and never allowed to be the answer, for the
same reason: if the object the property was attached to is the one being asked
about, nothing was transformed.

---

## Smaller fixes

### Premise caps never reviewed — **DONE**

Deictic capped at 8 (eight cells is the whole grid at three axes, so past that
the premises repeat rather than add) and Anchor Space at 8 (past it the item is
longer rather than harder). Analogy and Binary keep their length by the earlier
explicit decision.

### Only one generator enforces its own ceiling — **DONE**

`clampPremises` in `settings.models.ts`, applied in all seventeen generators
that take a premise count. A cap is a claim about what is answerable at that
size, and depending on three unrelated call sites to keep it is the kind of
thing that stays true until it does not.

### Rung costs are guesses

`RUNG_COST` in `ability.utils.ts` is a hand-written table. It is at least wrong
*in one place, explicitly*, where it can be corrected — and the right correction
is to fit it against answered items rather than argue about it. A few hundred
logged trials would do it.

### The tier cheat is inert — **DONE**

It seeds the posteriors now, through the same `applyCalibration` the placement
test uses, and sets the score mid-band so a wobble does not immediately fall out
of the tier that was asked for. The level-for-tier inversion is approximate and
says so.

### Argument swap

Objects exchanged *within* one relation ("X is south of Y" → "Y is south of X").
The same one-line vector negation as `reverse` in
[2.8](done.md#28-compact-premises-and-relation-edits--done); only the wording differs,
since reverse frames it as a property of the relation rather than of its
arguments.

### Unfinished ports from v3 — **PARTLY DONE**

- **Chain heuristics** (`space-hard-mode.js`) — the remaining part of 1.1. Still open.
- ~~Presentation modifiers~~ — all three ported.

**Wide premises** merge consecutive links into one sentence: "A is under B,
which is under C". Same relations, half the sentences, and harder for a reason
worth stating — a one-relation premise can be read, placed and forgotten, where
a two-relation one has to be held entire while the second half is placed against
the first. A rung on the linear ladder, appended mid-list rather than at the
front so it does not shift every rung already earned.

**Junk shapes** are flat coloured silhouettes with no names, from a pool of
2,232 (31 hues × 3 saturations × 4 lightnesses × 6 shapes), deterministic per id
so history redraws identically. Distinct from the visual-noise stimuli already
here: those are patterns and resist naming by intricacy, these differ only in
colour and outline. Batches are drawn across the pool rather than at random, so
two stimuli in one item are never a near-miss in both hue and shape.

**Incorrect directions** turned out to be the interesting one, and the first
attempt was wrong twice.

The obvious reading — make the false direction one the premises *used*, so "I
never saw that" stops working — measured at 79% against 75% baseline. It does
nothing, because a four-cardinal item already uses nearly every direction
somewhere. Reading v3's actual code showed a different design: a **weighted pool
of error types**, near-misses weighted highest, because a distractor only works
if getting it wrong looks like the mistake you would really have made.

The second attempt ported that and produced *malformed* items — putting "east"
where the north/south entry goes yields "two steps east and three steps east".
A replacement has to stay on its own axis, which leaves three well-formed ways
to be wrong: near-miss on distance (weight 3), the cross-axis slip with
magnitudes exchanged between axes (weight 2), and reversal (weight 1). The
middle one is the error a reasoner tracking two axes actually makes, and v4
could not previously produce it at all.

### Space 7D — **DONE**

Seven axes: the six-dimensional stack plus **Distinction**, which is the first
axis here that is not a line.

Every other scale is ordered — things are more or less along it, and the whole
arithmetic is adding signed steps. Distinction is a partition: two classes, and
a pair is either in the same one or not. There is no "further along", so there
is no distance to state, no comparison to make, and nothing for a transformation
to move. That is the point of adding it rather than a seventh line: it cannot be
carried the way the other six are carried, and nothing about a thing's position
on any of them says anything about its class.

Implemented as parity. Positions stay integers and the class is their parity, so
one code path serves both kinds of axis — a step flips the class, an even number
of steps returns to it, and the layout accumulates exactly as before. What
changes is what gets *asked*: same or opposite, with no third option and no
magnitude, which also makes it the one axis where a false conclusion carries as
much information as a true one.

Three places had to learn it, and each was a real assumption of ordering:
conclusions (two claims, not three), construction slots (two options and no
distance box — possible only because slots stopped assuming three when ranking
needed five), and transformations, which are excluded outright since "moves 2
opposite kind" is not a sentence.

**Temperature** (warmer/colder) was written first for this slot and kept on the
axis list, so it is available for custom stacks and anything wider than seven.
It is also why `axisWordConflicts` is now asserted clean for every preset from
3D to 7D: extending past six otherwise picks up `vertical`, whose higher/lower
is word for word what `quantity` says.

Worth knowing: the dimension palette guarantees six hues clear of the theme
accent, so a seventh axis takes one nearer it than the rest.

### Settings that existed but had no control — **DONE**

An audit of every knob in the code against the controls that reach it turned up
seven gaps, all now on the Customise page.

**Per-mode rungs.** The tri-state Ladder/Off/On covered the scale family only,
where a modifier means the same thing in all five modes. Ten others belonged to
one mode each and could only ever be *earned*: `structural` (Relational Web),
`extra-reversal` and `third-axis` (Deictic), `min-span-3` and `cycles`
(Hierarchy), `rank` (Oddest Relation), and the transform depths. The item they
produce existed and nothing reached it.

Generalising it moved the precedence rule onto the context: generators now ask
`ctx.hasRung(type, rung)`, which is an explicit setting first and the ladder
otherwise, instead of asking the progression service directly. A test asserts
every rung without a family flag is forceable, so a new mode that adds one and
forgets a control fails rather than shipping another unreachable feature.

`rank` in particular was reachable only by ticking "Build the conclusion" — a
flag named for a different family. It has its own control now.

**The training-unit knobs** — unit length and the two thresholds — drive premise
movement whenever fluid progression is off, and had a reader but no writer:
settable by editing storage and nothing else. **`floorSeconds`** had a control
for its ceiling but not its floor. **Skip-all-tutorials** was reachable only from
a tutorial screen, which is no use once they are all skipped.

**The stimulus mix** needed a generator change rather than a control. Enabled
kinds took an equal share, so "words with the occasional emoji" could not be
asked for — turning emoji on made half the stimuli emoji. Each kind now carries
a weight, and zero means the same as off.

### Cosmetic

- Start screen: daily/weekly goal bars clip their labels (monospace is wider than
  the original sans). **Still open.**
- `angular.json` style changes need a dev-server restart — webpack config, not
  hot-reloaded.

---
