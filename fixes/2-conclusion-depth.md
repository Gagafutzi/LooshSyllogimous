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

**Nested** ([shot 03](shots/03-nested-shallow-conclusion.png)). Five premises,
each carrying an outer relation and a bracketed inner one, so ten relations in
play. The conclusion is *"Inside the brackets: Lens is after Doorstep"* and
premise four's bracket reads *"where Lens is before Doorstep"*. The conclusion
is one premise, negated. Depth 1 out of a possible 5.

**Shape Rotation** ([shot 05](shots/05-shape-rotation-shallow.png)). Premise
three is *"Cord is 2 corners clockwise from Hostess"*; the conclusion is *"after
the turns, Hostess is 2 corners clockwise from Cord"*. On a four-corner square,
two clockwise is its own inverse, so the conclusion is premise three read
backwards, and the two positional premises contribute nothing.

**Deictic** ([shot 10](shots/10-deictic-shallow.png)). *"Here is there and there
is here"* plus *"When I am there, I hold Cloud"* gives *"When I am here, I hold
Cloud"*. Two premises out of five.

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
it a caller may reach and zero the default. What is *not* built is the inversion
described below — choosing the pair first and building the layout around it. The
pickers still work with whatever layout they are handed, so a layout with a
small diameter still yields a shallow conclusion; it is now the layout that is
at fault rather than the picker, which is the right place for the remaining
work.


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

### Record it

`Question` gains `depth: number`, alongside `widthDelta` — which the roadmap
notes was added as *recorded rather than charged*, for the same reason. Log it
first, charge for it once there are answered items to fit a coefficient
against. It also gives the diagnostics page something to show, which is how a
claim like "conclusion depth is unrelated to premise depth" gets settled by
measurement instead of by screenshot.

---

## 2.3 The rotation no-op

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

## 2.4 Transformations that arrive before the thing they transform

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

Two cases still fall back to the single-axis claim and both are noted in the
code: a **circular axis**, whose relation is a displacement in steps rather than
a direction word and so has no clause of this shape; and a pair the premises
leave **unsettled on some axis**, which the under-specification rungs produce on
purpose. The first is the one worth finishing — it needs `displacementText`
split into a clause and a sentence.

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

## 2.6 A halfway conclusion and a final one

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
