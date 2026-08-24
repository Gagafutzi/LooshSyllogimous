# 2 — Conclusion depth

> So my general problem is that conclusion depth is often unrelated to the
> premise depth of logic. Ideally a puzzle should have multiple conclusions
> spread in between (so they are of different complexity to estimate where the
> user got it wrong) and one final one you have to construct or choose from
> multiple options.

Five of the fourteen screenshots are this, and the author's closing paragraph
names it. It is the single largest item in the plan and the only one that needs
a new shared mechanism rather than a per-mode repair.

---

## 2.1 What is actually wrong

**A conclusion should take the whole relation to reach, or near enough.** That
is the requirement, and everything below is a way of enforcing it. Two things
follow from it that are worth separating, because they are enforced by different
means:

- **Depth** — reaching the conclusion must use the whole premise set, not a
  fragment of it. [2.2](#22-the-mechanism-measure-depth-then-require-it).
- **Width** — the conclusion must be about every dimension the item is built on,
  not one of them. [2.5](#25-an-n-dimensional-map-deserves-an-n-dimensional-conclusion).

An item can fail either independently. The 7-D item below is full depth and
one-seventh width; the nested item is full width and depth 1.

The app already measures item difficulty carefully — the ability model, the
width estimate in bits, the rung ladders. None of it measures **how much of the
premise set the conclusion needs**. A ten-relation nested item and a
one-relation restatement of half a premise are, to every difficulty model in the
codebase, the same item.

The four instances:

**Nested** ([shot 03](shots/03-nested-shallow-conclusion.png)) — **FIXED**.
Five premises, each carrying an outer relation and a bracketed inner one, so ten
relations in play. The conclusion is *"Inside the brackets: Lens is after
Doorstep"* and premise four's bracket reads *"where Lens is before Doorstep"*.
The conclusion is one premise, negated. Depth 1 out of a possible 5.

`pickPair` drew any two objects, so the pair a bracket stated outright was as
likely as any other. It now draws from the pairs at least `MIN_DEPTH` relations
apart in the space being asked about — a floor, not a fixed distance, so where
the answer sits in the chain still varies while a restatement is impossible.

`MIN_DEPTH` is **2**, not the chain's full length, and that is a deliberate
first step rather than a compromise. Nested's difficulty is carried by the
interference between its two spaces as much as by the span within either, so
pinning the conclusion to the ends of one chain would make the answer's
position predictable while adding little. Raising the floor is one number, and
the mode is the natural place to raise it first, because it is the one whose
premises carry twice as many relations as they appear to.

**Shape Rotation** ([shot 05](shots/05-shape-rotation-shallow.png)). Premise
three is *"Cord is 2 corners clockwise from Hostess"*; the conclusion is *"after
the turns, Hostess is 2 corners clockwise from Cord"*. On a four-corner square,
two clockwise is its own inverse, so the conclusion is premise three read
backwards, and the two positional premises contribute nothing.

**Deictic** ([shot 10](shots/10-deictic-shallow.png)) — **FIXED**, in two
parts. *"Here is there and there is here"* plus *"When I am there, I hold
Cloud"* gives *"When I am here, I hold Cloud"*. Two premises out of five.

The ordering half is [2.4](#24-transformations-that-arrive-before-the-thing-they-transform).
The depth half could not be fixed by a floor, and that is the interesting part:
the grid statements are **independent facts**, so a conclusion about a position
can only ever need the statement about *that* position, however many positions
are stated and however many reversals are applied. Depth here is bounded by
reversals + 1 whatever the premise count, and no choice of pair moves it.

This is the case [2.2](#22-the-mechanism-measure-depth-then-require-it)
anticipated — *"if a mode turns out to reject most of what it builds, the layout
generator is what needs changing, not the floor"*. So the grid is stated **one
short**, and the missing position is the one asked about. Every position holds a
different one of the listed things, so each statement rules one out and what is
left over is what the unstated position holds. Every premise becomes
load-bearing: drop any one and the answer is two things at once.

Three things it turned on.

**The convention has to be stated.** Without the setup line naming the things
and saying that each position holds a different one, an unstated position holds
anything at all and the conclusion is not derivable but merely likely. The line
marks them up as *subjects* rather than merely highlighting them, because the
guard from [1.1](1-correctness.md#11-a-conclusion-naming-an-object-no-premise-states--fixed)
reads the setup exactly as it reads a premise — and caught this, correctly, on
the first run.

**The frame is asked for one more premise than the item wants**, since one is
about to be withheld. Otherwise a deep item is a premise shorter than the count
the ability model was told it would get. It also moves the two-to-three axis
boundary down by one, which is the right way round: a frame that has to give a
statement up needs the room to give it up in.

**The position the utterance names is still stated.** That is not an oversight:
it is the answer for anyone who read past the reversal, which makes it the trap
this mode always should have had.

**Composed space at 7-D** ([shot 12](shots/12-ndspace-7d-1d-conclusion.png)).
Three premises stating seven axes each — twenty-one relations — and a conclusion
that names one axis: *"Chalk is west of Museum"*. Six-sevenths of every premise
is decoration.

The existing guard cannot help. `isPremiseLikeConclusion`
([`question.utils.ts:44`](../src/app/syllogimous/utils/question.utils.ts))
rejects a conclusion whose subject *pair* matches a premise's subject pair. It
is exact-match on a pair of names — it does not see the nested case (the pair is
in a bracket, not a premise subject), the rotation case (the relation is
self-inverse, not restated), or the composed-space case (the pair is genuinely
two premises apart on one axis and zero apart on six).

---

## 2.2 The mechanism: measure depth, then require it

One function, shared, and the modes read it.

### `derivationDepth(question): number`

The size of the smallest premise subset that still forces the conclusion.

The algorithm already exists in the codebase and is already documented as
approximate. [`syllogism.ts:348`](../src/app/syllogimous/generators/syllogism.ts)
finds the load-bearing premises by greedy removal — drop a premise, re-check
entailment, keep it dropped if the conclusion still follows. As the roadmap
records, greedy removal is not guaranteed to find the *smallest* such set and
does not claim to; what it guarantees is that every premise left is load-bearing.
That guarantee is exactly what is needed here, because the failure mode being
prevented is a floor, not a ceiling: if greedy removal says three premises are
load-bearing, at least three are, and an item that survives a `depth >= 3` gate
is genuinely at least that deep.

What it needs to generalise is a per-mode `entails(subset, conclusion)`. Every
mode that has a derivation already has one in some form, since a derivation is
a proof that the conclusion follows; the work is exposing it behind one
signature rather than writing new solvers.

Modes where the entailment check is already sitting there:

| mode | check |
|---|---|
| Syllogism, Set Hierarchy | `sylEntails`, [`syllogism.utils.ts`](../src/app/syllogimous/utils/syllogism.utils.ts) |
| the scale family, Nested | `compare(layout, a, b)` over the subset's edges, [`linear.utils.ts`](../src/app/syllogimous/utils/linear.utils.ts) |
| composed spaces | axis-wise `compare` over the subset, [`ndspace.utils.ts`](../src/app/syllogimous/utils/ndspace.utils.ts) |
| Deictic, Transformation, Anchor | replay the subset's operations, as the derivations already do |

For a chain-or-graph mode there is a cheaper equivalent that needs no solver:
**graph distance between the conclusion's two objects over the premise graph**.
`graphDistance` already exists in
[`linear.utils.ts`](../src/app/syllogimous/utils/linear.utils.ts) and
`LinearConclusion` already carries a `span` field computed from it. A conclusion
about a pair `k` edges apart needs at least `k` premises. Use `span` where it is
available and greedy removal only where it is not — it is the same number for
these modes and it is free.

### `minDepth`, a generator constraint — **BUILT for both pair pickers**

Both `pickDistantPair`s take the diameter now, with `slack` saying how far below
it a caller may reach and zero the default.

**The inversion below was built, measured and reverted.** The reasoning was that
a branching layout is free to come out as a star — every pair two steps apart,
however many premises went in — and that the picker would then correctly report
the deepest available conclusion as a shallow one, which no choice of pair could
repair. So the pair should be chosen first and the layout built around it.

The premise does not hold. `pickBase` weights the ends of what exists so far, so
a new object usually *extends* the arrangement rather than hanging off its
middle, and the mean span over six to twelve premises is already about eight.
Laying a spine first — half the links end to end before anything branches —
moved that to 8.1 and cost ten points of branching, which is the rung's own
purpose.

What remains of it is a test: the property the inversion would have guaranteed,
asserted of the layout builder as it stands. If it ever stops holding, the
inversion becomes worth building.

A caution worth recording, because it nearly shipped: the first measurement said
the spine took the mean span from 3.3 to 4.5, which looked decisive. It was
measuring a version with a duplicated attach loop — every object added twice —
so both numbers were of a corrupted layout. The real comparison is 7.9 to 8.1.


Every generator that builds a conclusion gains a floor and rejects candidates
below it, the way `isPremiseLikeConclusion` is used today: draw, check, redraw.

**The floor is the whole premise set, or one short of it.** Not half — half was
the first draft of this section and it is not what was asked for. The
requirement is that reaching the conclusion takes the *whole* relation, or
near enough:

```
minDepth = premises - slack        // slack is 0 or 1, and 0 is the default
```

An item with five premises should need five of them. `slack` exists for the
layouts that genuinely cannot offer a full-depth pair — see the rejection note
below — and for the deliberate case where one premise is *meant* to be
discardable, so that noticing it is discardable is the exercise. It is a
setting with a default of zero, not a tolerance the generator drifts into.

That is a much stronger constraint than a floor at half, and it has a
consequence worth stating plainly: **the generator can no longer pick a pair
and hope.** For most layouts only a handful of pairs are at full depth — on a
chain, exactly the two ends — so the conclusion pair has to be chosen *first*,
from the pairs at maximum distance, and the layout built or rejected around it.
That inversion is the actual work of this section; the floor is just how it is
checked.

Three things to get right:

- **Count relations, not premises, where a premise carries several.** Nested's
  five premises hold ten relations and the composed spaces' three premises hold
  twenty-one. A depth measured in premises would pass the nested item at depth
  2 while the conclusion still came from a single bracket. Measure in the units
  the mode's solver works in.
- **Rejection has to be bounded.** Some layouts admit no full-depth conclusion
  at all — a star-shaped branching layout has span 2 between every pair,
  whatever its premise count. Cap the retries and, on exhaustion, rebuild the
  *layout* rather than shipping a shallow conclusion or throwing. If a mode
  turns out to reject most of what it builds, the layout generator is what
  needs changing, not the floor.
- **A restated premise is the floor's worst case, not a separate rule.**
  `isPremiseLikeConclusion` exists because depth 1 was the failure people
  noticed; it can go once depth is measured, since depth ≥ premises − 1 rules
  out a restatement at any premise count above two, and rules out the cases the
  pair-matching guard never saw — the nested item's bracket, and a
  self-inverse relation restated backwards.

### Record it — **BUILT**

`Question` gains `depth: number`, alongside `widthDelta` — which the roadmap
notes was added as *recorded rather than charged*, for the same reason. Log it
first, charge for it once there are answered items to fit a coefficient
against.

Recorded by Nested, the scale family, the composed spaces, Shape Rotation,
Deictic, both syllogism generators, Set Hierarchy and the Hierarchy mode; it
rides to the trial log beside `widthDelta` and is read back on the diagnostics
page as **share** — depth over premise count, per mode.

The last four cost nothing, because each already knew the answer:

| where | what it already had |
|---|---|
| Set Hierarchy | the load-bearing set its derivation is built from |
| Syllogism (Canyon) | `chainDepth` — the chain is the answer, the rest are distractors |
| Syllogism (Fredo) | **two, always.** The first two premises are the syllogism and everything after is a distractor built from an invalid rule |
| Hierarchy | `HierarchyQuery.span`, the links along the claimed path |

Fredo is worth recording precisely *because* the number is bad. A six-premise
item whose answer needs two of them is the complaint this section is named for,
and it should appear in the report as such rather than as a blank. It is left
alone otherwise: Canyon has been the default since the picker was removed, so
Fredo only runs for an account that chose it before that, and overriding an
explicit stored choice to fix a depth problem is not the trade.

**Canyon's chain now draws from the top two bands.** `chainDepth` was drawn
anywhere from two to the premise count and the remainder padded with
distractors, so a six-premise item could be a two-premise argument with four
lines of noise — the defect this section is named for, sitting in a variable
that already had the right name and needing only a narrower draw.

Top *two* bands rather than the top one, deliberately. A syllogism with no
discardable premise stops asking whether a premise is relevant, and noticing
that one is not is a real part of the skill — which is exactly the deliberate
case [2.2](#22-the-mechanism-measure-depth-then-require-it) says `slack` exists
for, rather than a tolerance drifted into.

**Two of them record the whole premise set for a claim that is false.** A pair
the premises leave undecided has no support at all, and a hierarchy claim that
is false because nothing joins the two has an infinite span — and nought is the
value that already means *not measured*. Establishing that nothing settles a
pair means having failed to find a derivation, which takes the whole set. That
is the reader's cost rather than the prover's, and it is the honest one for a
report about how much of an item its answer needed.

Four decisions, each of which would have made the number mean something else:

- **Zero means *not measured*, not *shallow*.** A mode that does not record
  depth is absent from the report rather than averaged in at nought, which
  would report every unmeasured mode as maximally broken and bury the ones that
  are.
- **The share is averaged per item, not taken between the two means.** Two
  items — one of two premises answered from both, one of ten answered from two
  — are 100% and 20%, so 60%: a mode that serves a shallow item half the time.
  Between the means it is 4/6, which describes an item nobody was served.
- **The column that matters is `worst`.** A floor is a promise about the
  minimum, so a good average with a bad minimum means the floor is not holding,
  and an average alone would hide exactly the failure this section exists to
  catch.
- **Where an item asks several claims, the shallowest is recorded.** The figure
  is a floor on what the answer costs; reporting the maximum would describe an
  item by its hardest part and call that its depth.

This is what settles *"conclusion depth is unrelated to premise depth"* by
measurement rather than by screenshot — and, more usefully from here, says
whether a floor that was raised actually moved anything.

---

## 2.2b The switch — **BUILT**

All of the above is behind **Conclusions** in Customise, on by default. Off,
the generators do what they did before this section existed.

Three things it governs, and they are the three that changed for every item:
how far apart the asked-about pair sits (`pickDistantPair` in both
`linear.utils` and `ndspace.utils`), how wide the claim is
(`buildNdWideConclusion`), and which form Shape Rotation asks in. Nested's
floor is the fourth.

**Off is the old rule, not a softened new one.** That distinction is the whole
value of the switch — it exists so the two models can be compared, and a
comparison against a tidied-up version of the old one answers nothing. So the
ported probabilities are back in the code rather than approximated by a wide
`slack`: `v3Bands()` drops a band with probability 0.4 up to three, which is
where the 40/17/7 figures in `pickDistantPair`'s comment come from; the
composed spaces draw from every pair 30% of the time; Shape Rotation goes back
to invariance three items in five, asking about a random object. `slack` and
the legacy draw are deliberately not the same mechanism, because they are not
the same shape: slack widens by bands *from* the diameter, and what v3 did was
ignore the diameter entirely.

**It does not remove rungs.** The checkpoint, choose-one, multi-conclusion and
construction are ladder steps a player holds, and taking one away because a
depth switch was turned off would remove something earned to fix something
nobody complained about. The switch changes how their pairs are drawn and
nothing else.

**It sits outside Customise's master switch and outside profiles.** Everything
else in `settings-override.service.ts` is an override layered on top of what
the tier decided and is meaningless with Customise off; this is a choice
between two versions of the generators, so holding an opinion about it must not
require switching a dozen unrelated overrides on. For the same reason a profile
saved last month does not carry one around and silently apply it. It is also
not suppressed during placement: `suppress` exists so a placement measures the
mode rather than the mode plus whatever is switched on, and the conclusion
model is not something switched on — it is what the mode *is*, so measuring
under the other one would measure a mode the player never plays.

**Absent reads as on**, in the stored state and in the generator's reader
alike. One rule in both places, and it is the right way round: the players who
have state saved from before the switch existed were already being served the
deep model.

---

## 2.3 The rotation no-op — **PARTLY BUILT**

The conclusion is still relative, and the invariance question stays — a turn
genuinely cannot change how two objects sit relative to each other, and knowing
that is worth testing. What changed is the pair it is asked about: the furthest
apart in the premise graph, never one a premise relates directly, and never at a
separation of exactly half the corners, which on an even-sided shape is its own
reverse — so "2 clockwise" and "2 anticlockwise" of a square named the same
claim and the reversal in the wording changed nothing.

The reported item failed on both counts at once, which is why it read as
derivable from a single premise: it was.

**The absolute form now carries the weight.** It already existed — "which corner
is X on after the turns?" — but at two items in five, and it asked about a
*random* object. Half the time that was one named outright, whose answer is its
stated corner plus the turns: one premise and the arithmetic, with every
relative placement in the item unused. It now asks about the object furthest
from the frame, so the whole chain is load-bearing, and it is three items in
four.

Invariance stays at the remaining quarter. It is worth teaching — a turn cannot
change how two objects sit relative to each other — but a relative claim is
invariant under rotation, so the turns are there to be dismissed rather than
computed, and that is not most of a mode about turning things.

Shape Rotation needs one thing beyond the depth gate, because the depth gate
alone would not save it. Its conclusion asks for a **relative** position — *"X
is 2 corners clockwise from Y"* — and rotating the whole square leaves every
relative position unchanged. The rotation premise is therefore not a shallow
contribution to the answer; it is *no* contribution, in every item where the
conclusion is relative.

Two candidate answers, and the first is better:

1. **Make the conclusion absolute.** *"After the turns, which corner is Cord
   on?"* Now the rotation is load-bearing and the positional premises are too,
   because an absolute answer needs a starting position and the turns.
2. Keep relative conclusions and drop rotation from those items. This throws
   away the mode's whole point.

Take (1). It also turns the mode into a `choice` item over four corner names,
which removes the coin-flip floor — the reason `answerMode: "choice"` exists,
per [`question.models.ts`](../src/app/syllogimous/models/question.models.ts).

The general rule this is an instance of, worth applying across the transforming
modes: **a transformation premise must change the truth of the conclusion.**
The composed spaces already enforce something like it — `ndspace.ts:440` reads
*"Mutations have to matter. A conclusion whose truth survives the edits…"* — so
this is extending an existing rule to the modes that never got it, not inventing
one.

---

## 2.4 Transformations that arrive before the thing they transform — **DONE**

The intent was already in the code, and undone one line later. Deictic built its
premises as grid-then-reversals with a comment saying why, then handed the whole
list to `scrambleByFactor`, which shuffles everything — so the reversal could
land first, which is what the screenshot caught. It now uses `scrambleLeading`,
which scrambles the grid among itself and leaves the tail alone, the same helper
the transformation premises already needed.

**The general version is settled as unnecessary, and the assertion is built
instead.** The idea was a flag on the premise — `operation: true` — with the
orderer respecting it, so the next mode with operations would not have to
rediscover the rule. It is not worth building, and the reason is worth
recording rather than leaving as an open item somebody re-proposes:

- **Every mode that has operations already gets it right.** Five callers use
  `scrambleLeading`, and each computes its boundary from a list it has just
  built. A tag would replace a correct one-line call with a tagged list at each
  of them: more code, same behaviour, and a migration's worth of risk for it.
- **The tag is only cheaper where the two kinds are *interleaved* at the point
  of construction**, so the caller cannot simply concatenate. No mode is built
  that way, and the one that eventually is can add the helper then, with a real
  caller to shape it.
- **What was actually missing was the assertion.** The property was written
  down in the generator, silently broken by a scramble one line later, and then
  written down again — and nothing would have caught it recurring. A property
  with that history needs a test, not a third comment.

So: *a deictic reversal never arrives before the positions it reverses*, in
`tests/depth.test.ts`. Everything from the first reversal on must be a
reversal, checked on the rendered premises across every premise count.

Deictic states its reversal first:

> Here is there and there is here
> When you are there, you hold Ceramic
> …

Read in that order, the reversal is a substitution rule applied while reading,
and each subsequent premise can be rewritten on sight and forgotten. Read
*last*, it is an operation on a structure that must already be held whole. Same
information, different exercise, and the second is the one the mode is for. The
author says as much: *"I dislike that the transformation is not at the
end/applies post transformation."*

There is already a place for this. `premise-order.utils.ts` exists and the
scramble control in
[`mode-modifiers.component.ts`](../src/app/syllogimous/components/mode-modifiers/mode-modifiers.component.ts)
already reorders premises. What is missing is the constraint that **operation
premises sort after descriptive ones**, which is a property of the premise, not
of the shuffle. Add a flag at the point of construction and have the orderer
respect it; do not try to recognise operations by their text.

In [`deictic.ts`](../src/app/syllogimous/generators/deictic.ts) specifically,
`shuffle(gridPremises)` and `shuffle(reversalPremises)` at lines 57–58 shuffle
the two groups separately and then concatenate them — so the ordering is already
group-aware and the fix is which group goes first.

---

## 2.5 An N-dimensional map deserves an N-dimensional conclusion — **BUILT**

`buildNdWideConclusion` names every axis, worded through the same `axisClause`
the premises use, with a false claim wrong on exactly one axis. A 7-D item now
reads *"Amber is west, south, above, later, wider, lower, opposite kind relative
to Neck"* where it read *"Chalk is west of Museum"*.

**The circular case is now built.** `displacementClause` is the missing shape:
the same three cases and the same short-way-round rule as `displacementText`,
said as a phrase rather than as a claim, so it can sit in the comma-joined list
a wide conclusion is. `oppositeClause` was added beside `opposite` on each of
the three cyclic scales rather than derived from it by cutting words off, since
"is diametrically opposite to" and "diametrically opposite" are both wanted and
neither is a substring transformation of the other worth relying on.

This mattered more than the count of affected items suggests: the fallback was
silent, so the modes that make a ring the interesting dimension were exactly the
ones that never got a wide conclusion, and an item with a loop in it looked like
one the width work had simply missed.

The arithmetic is tested against a layout written down by hand rather than
generated, because the mistake available here — reading the coordinate
difference instead of the ring displacement, so four round a loop of six is
stated as four rather than as two the other way — produces a confident,
well-formed sentence either way, and a generated layout would only check the
code against itself.

One case still falls back: a pair the premises leave **unsettled on some axis**,
which the under-specification rungs produce on purpose. A claim about an axis
nobody stated is unanswerable rather than hard, so that one is correct as it
stands.

The explanation still covers one axis: the one a false claim lies about, which
is right, or the pair's chosen axis on a true claim, which is thin. That is
[4.2](4-legibility.md#42-the-composed-space-explanation-diagram)'s job — a
seven-axis answer wants the coordinate table, not seven walks.

The original diagnosis follows.

Twenty-one stated relations, a conclusion naming one
([shot 12](shots/12-ndspace-7d-1d-conclusion.png)). The cause is direct:
`axisClaim` in
[`ndspace.utils.ts:889`](../src/app/syllogimous/utils/ndspace.utils.ts) is
documented as *"A claim about one axis, true or false by construction"*, and it
is what a boolean-mode composed-space item gets regardless of how many axes the
item has.

The machinery for the wide version already exists: `ConstructClaim` /
`ConstructSlot` in
[`question.models.ts`](../src/app/syllogimous/models/question.models.ts) hold one
slot per dimension and are exactly this. Their own comment makes the argument —
*"a six-axis item has a one-in-729 guess floor against true/false's one in
two"*. The problem is purely that construction sits at the far end of the ND
ladder (`construct-conclusion`, `construct-distance`), so a player at 7-D who
has not climbed that far gets a 1-D claim about a 7-D layout.

**Fix. The conclusion states every axis the item is built on.** A 2-D map gets
a 2-D conclusion, a 3-D map a 3-D one, a 7-D map all seven. Not a proportion of
them — the whole relation, the same way [2.2](#22-the-mechanism-measure-depth-then-require-it)
asks for the whole premise set. Axis count is a property of the item, and the
ladder position decides only *how the answer is given*, never how much of the
item the answer is about:

| answer mode | what changes with the ladder |
|---|---|
| boolean | one claim naming all N axes, true or false |
| choice | several full-width relations, one of which holds |
| construct | all N axes, stated by the player, as today |

Only the first is missing, and it is a small addition to `axisClaim`: build the
claim across every axis rather than one, and make a false variant by flipping
exactly one of them. Flipping exactly one is deliberate — a claim wrong on five
axes out of seven is spotted from whichever axis you check first, which turns a
seven-dimensional item back into a one-dimensional one by the back door.

This also removes the reason `axisClaim` picks an axis at all, and with it the
question of *which* axis it picks — a question that had no good answer, since
any choice makes six-sevenths of every premise decoration.

**Verification.** For every composed-space item, the set of axes named in the
conclusion equals the set the premises are built on — equality, not a floor,
because a floor is what let this drift to one in the first place. The existing
derivation check — *a replayed trace ends where the answer says it does* —
extends to the new claim form for free, since it reads the rendered conclusion.

---

## 2.6 A halfway conclusion and a final one — **BUILT**, both families

The `checkpoint` rung, last on the linear ladder. Two claims, answered together
as a two-slot construction — which needed no new answer flow, the construct
screen already taking several claims with their own slots, and which brings the
per-slot result screen from [3.1](3-explanations.md#31-construct-answers-scored-per-dimension)
with it. The two are reported separately, so a reader who lost the thread late
is distinguished from one who never had it.

Three things it turned on.

**"Halfway" is halfway through the reading**, so the claim is built from
`prefixLayout` — the arrangement the first *k* premises determine on their own,
recomputed from their own edges rather than sliced out of the finished one. A
pair the prefix does not connect has no relation yet, and taking its finished
coordinates would invent one.

**Premise order became load-bearing**, where it had been a presentation choice.
`scrambleBlocks` shuffles within each half and never across: the claim follows
from the *set* before the boundary, not from an order within it, but a premise
that crossed the line would be one the reader did not have when the claim became
answerable.

**Meta and checkpoints do not combine**, and that is structural rather than
fussy. A meta premise *replaces* premises with a claim about a different pair,
so once it has run there is no prefix that determines what the checkpoint asks.
Skipped rather than worked around: a checkpoint the reader cannot answer at the
checkpoint is not one.

**The composed spaces have it too, now.** They have their own everything —
layout, prefix, claim builder — so none of it came for free: `ndPrefixLayout` is
the twin of `prefixLayout`, and `checkpoint` is appended to `ND_LADDER` rather
than inserted, because a profile stores how many rungs it has earned and reads
them by position.

It differs from the scale family's version in effect rather than in shape. A
composed-space claim is already one slot per axis, so the halfway claim
distinguishes *losing the thread on one dimension* from *losing it altogether*
without the second claim being reached at all — which is the diagnostic value
this section is for, arriving one conclusion earlier.

**Four things rule a checkpoint out**, and the caller decides because the
conclusion builder never sees them. Edits and transformations **rewrite** the
arrangement, so a relation stated before one of them need not hold after it —
the prefix describes a state the reader is later told to abandon. Reports and
testimony **replace** the premises with claims that may be false, so nothing is
determined until the liars have been found, which is the whole item rather than
half of it. Skipped, as meta is skipped in the scale family: a checkpoint the
reader cannot answer at the checkpoint is not one.

The rung is also gated at five premises in `RUNG_MIN_PREMISES`, which it was
not before — below that there is no halfway, so the ladder was handing out
something that silently did nothing.

**Still to do:** the ability model still receives one bit per item, so the
second slot is diagnostic on the screen and not yet in the estimate.

### The original diagnosis

The author's proposal, and it is a good one:

> Ideally a puzzle should have multiple conclusions spread in between (so they
> are of different complexity to estimate where the user got it wrong) and one
> final one you have to construct or choose from multiple options.

**Two conclusions, not a spread of them.** One at the halfway point and one at
the end:

| | what it is derivable from | form |
|---|---|---|
| halfway | the first half of the premises, **as displayed** | boolean or choice |
| final | the whole set, per [2.2](#22-the-mechanism-measure-depth-then-require-it) | construct, or choose from several |

**"Halfway" means halfway through the reading, not half the depth.** The
distinction matters and it is the whole point of the checkpoint: a conclusion
that needs any five of ten premises is not answerable halfway down the page,
because which five is not known until the tenth has been read. The halfway
conclusion has to be entailed by premises 1…k *in displayed order*, so a player
who has read that far can answer it and then carry on.

Two consequences:

- **Premise order becomes load-bearing**, where today it is a presentation
  choice — `scrambleByFactor` shuffles it, and the Customise scramble control
  sets how much. An item with a checkpoint has to hold its first `k` premises
  fixed as a set; they can still be shuffled *among themselves*. This is the
  same constraint [2.4](#24-transformations-that-arrive-before-the-thing-they-transform)
  puts on operation premises, so both belong to `premise-order.utils.ts` rather
  than being solved twice.
- **The halfway pair is chosen from the prefix layout.** Build the first `k`
  premises, pick a full-depth pair *within* what they determine, then extend the
  layout to the remaining premises and pick the final pair across the whole.
  Choosing the final conclusion first and hoping a prefix happens to entail
  something is the same "pick and hope" that
  [2.2](#22-the-mechanism-measure-depth-then-require-it) rejects.

**The halfway conclusion appears only above four premises.** Below that there is
no halfway to speak of — on a three-premise item the midpoint is depth 1 or 2,
which is the shallow conclusion this whole section exists to prevent, and
serving one deliberately would teach exactly the habit the depth floor is
removing. Four is the boundary: five premises and up get both, four and under
get the final one alone.

Its value is diagnostic, and that is the whole argument for it. A player who
answers the halfway one correctly and the final one wrongly lost the thread in
the second half; one who fails both never had it. Today both look identical to
[`ability.utils.ts`](../src/app/syllogimous/utils/ability.utils.ts), because it
sees one bit per item — and the difference between "cannot hold six relations at
once" and "cannot read a relation" is the most useful thing an item could report.

The halfway conclusion is also the answer to a problem the full-depth floor
creates. Requiring the whole premise set means a wrong answer says only *"you
did not get to the end"*, with no indication of where the chain broke. A
checkpoint restores that, and it does it without weakening the final conclusion.

`multi-conclusion` already exists as a rung and is not this: it means *several
claims all of which must hold* — an AND, scored as one. This is two questions
with two answers, so it needs a rung of its own rather than a redefinition of
one that several ladders already depend on.

**This should be built last of the six sections**, not because it is least
valuable but because it is the one thing here that changes what the ability
model receives. Graded conclusions produce partial scores, and
[`ability.utils.ts`](../src/app/syllogimous/utils/ability.utils.ts) is written
against binary outcomes. That is a real piece of work and it should not be
started while the depth measurement it depends on is still being calibrated.
