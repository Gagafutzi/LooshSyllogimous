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


## 4.4 "Timer disabled" did not disable the timer — **fixed**

The other half of the clock bug above. That fix made the bar honest about a
countdown the player had switched off; it did not stop the countdown.

`chooseConfig` spends difficulty on time once a mode has no structure left to
add, and `ProgressionService.configFor` never passed the `untimed` option the
function already accepted — so with progression on, "Timer disabled" still
produced a clock. It looked mode-dependent, and that is how it was reported:
only the modes whose rungs were exhausted reached for time, so a strong player
saw a countdown on Distinction and Syllogism and none on Space 4D.

Fixed at the source rather than by ignoring the limit at the screen, because the
clock is part of the configuration an item is *scored* at — `record` values an
answer at the level of the config it was built from, so suppressing the display
of a limit the item was chosen under would have quietly inflated the estimate.
`configFor` now reads the preference and invalidates `configCache` when it
changes, since the cached choices are per timer setting as much as per mode.

Measured with a level-20 posterior, timer preference flipped either way:

| mode | adaptive | disabled | config when disabled |
|---|---|---|---|
| Distinction | 10 s | none | 18 premises, 2 rungs |
| Syllogism | 8 s | none | 14 premises, 2 rungs |
| Direction | 10 s | none | 15 premises, 2 rungs |
| Space 4D | none | none | 5 premises, 10 rungs |

Space 4D is the control: it still had rungs to claim, so it never reached for
the clock under either setting. Difficulty does not vanish when the clock is
turned off — it goes back into structure, which is what the last column shows.

**Free Play was also being timed by the ladder.** It runs on settings the player
wrote themselves and its answers are never recorded, so no ladder is driving
those items; the limit came from a configuration they were not built from. It
now uses only the timer preference, so a custom 90 s in Free Play stays 90 s
instead of becoming the ladder's 10 s.

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
