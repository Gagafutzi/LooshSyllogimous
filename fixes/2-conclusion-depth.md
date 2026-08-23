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

### `minDepth`, a generator constraint

Every generator that builds a conclusion gains a floor and rejects candidates
below it, the way `isPremiseLikeConclusion` is used today: draw, check, redraw.

The floor should be a function of the premise count rather than a constant,
because "depth 2" means something different in a three-premise item and a
ten-premise one. A reasonable starting rule, to be calibrated against
`tests/rungfit.test.ts` rather than guessed at permanently:

```
minDepth = clamp(ceil(premises / 2), 2, premises)
```

Two things to get right:

- **Count relations, not premises, where a premise carries several.** Nested's
  five premises hold ten relations and the composed spaces' three premises hold
  twenty-one. A depth measured in premises would pass the nested item at depth
  2 while the conclusion still came from a single bracket. Measure in the units
  the mode's solver works in.
- **Rejection has to be bounded.** Some layouts admit no deep conclusion at all
  — a star-shaped branching layout has span 2 between every pair. Cap the
  retries and, on exhaustion, rebuild the *layout* rather than shipping a
  shallow conclusion or throwing.

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

## 2.5 Conclusion width should track premise width

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

**Fix.** Make the conclusion's axis count a function of the item's axis count
rather than of the ladder position. Concretely, three forms in increasing order,
and the *number of axes asked about* rises with dimensionality in all three:

- boolean, but the claim names every axis at once — a full relation, true or
  false. This form does not exist yet and is the missing rung.
- choice among full relations that differ on one or two axes.
- construct, as today.

The middle two already exist. The first is a small addition to `axisClaim`:
build the claim over all axes rather than one, flip exactly one axis to make a
false variant. Making false variants differ on exactly one axis is deliberate —
a false claim that is wrong on five axes is spotted from the first one checked.

**Verification.** For every composed-space item, the number of axes named in the
conclusion is at least `ceil(axes / 2)`. And the existing derivation check —
*a replayed trace ends where the answer says it does* — extends to the new claim
form for free, since it reads the rendered conclusion.

---

## 2.6 Several conclusions, of graded depth

The author's proposal, and it is a good one:

> Ideally a puzzle should have multiple conclusions spread in between (so they
> are of different complexity to estimate where the user got it wrong) and one
> final one you have to construct or choose from multiple options.

This is a partial-credit structure, and it needs `derivationDepth` to exist
first — the "spread in between" is a spread *in depth*, which is not currently a
quantity the app can compute. Once it is:

- An item with premise-depth *d* offers conclusions at roughly `d/3`, `2d/3` and
  `d`, the last in construct or choice form.
- The intermediate ones are stepping stones and are scored as such. Their value
  is diagnostic: a player who gets the first two right and the last wrong made a
  different error from one who got the first wrong, and the ability model
  currently cannot tell those apart because it sees one bit.
- `multi-conclusion` already exists as a rung, but it means *several claims all
  of which must hold* — an AND, not a ladder. This is a new form and should be a
  new rung rather than a redefinition, because the existing one is load-bearing
  in several ladders.

**This should be built last of the six sections**, not because it is least
valuable but because it is the one thing here that changes what the ability
model receives. Graded conclusions produce partial scores, and
[`ability.utils.ts`](../src/app/syllogimous/utils/ability.utils.ts) is written
against binary outcomes. That is a real piece of work and it should not be
started while the depth measurement it depends on is still being calibrated.
