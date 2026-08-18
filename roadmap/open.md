# Open

One thing is. Everything else specced in this file has been built or
deliberately settled as unnecessary.

| | why it is still here |
|---|---|
| **Pricing width into difficulty** ([5](#5-realized-width-as-a-difficulty-axis--partly-done)) | the dial and the fit both exist; the coefficient needs answered items with the dial off its default to fit against. Blocked on play, not on design. |

The rest of this file is kept as the record of what was decided and why,
including the parts that turned out differently from the plan. Those are the
entries worth reading.

### Set Hierarchy — **DONE**, rung `hierarchy` on Syllogism

Listed as a mode that was never built. It is not a mode. Every syllogism the app
produced was a **path** — each premise composing onto the running conclusion —
and what a hierarchy adds is a different *shape* of premise network, not
different logic. The solver never cared: `sylEntails` refutes rather than
derives, so it works over any premise set, chain or tree. That is what made this
a rung rather than a generator, and it is the same answer P8 got.

What branching buys is what a path cannot offer: a pair the premises leave
**genuinely undecided**, as distinct from one they **rule out**. Both look like
"false" and they are not the same thing, so the derivation says which, and the
generator draws between them deliberately — left to chance, "not settled" came
up seven times in eight and a player would learn to stop checking. Now roughly
72 follow, 46 are ruled out and 32 are left open per 150.

The derivation names the premises that actually do the work, found by dropping
the ones that do not. Greedy removal is not guaranteed to find the smallest such
set and does not claim to; what it guarantees is that every premise left is
load-bearing, since dropping it was tried and the conclusion stopped following.

Three things caught by looking at output rather than by types. Premises were
built with the quantifier in the subject slot, rendering as `undefined`. The
answer was skewed one in twenty towards "false", because a random pair is almost
never entailed — fixed by scanning every pair and quantifier, and by drawing the
wanted answer once rather than per attempt. And the derivation was worded
plainly beside a negated conclusion, so it read as a flat contradiction of the
claim it was explaining.

---

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

### 5. Realized width as a difficulty axis — **DONE** bar the fitted coefficient

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

**The dial — DONE**, and it needed no coefficient after all.

The blocker recorded here was the bits-to-levels conversion. It turned out to
block only *pricing*, not *targeting*, because the dial is a **percentile of
what the configuration produces** rather than a number of bits. "As wide as the
widest tenth of what this produces" is meaningful for any axis stack, object
count and tie chance, with no table to keep in step; "8.5 bits" means nothing
until you know what 8.5 is wide *for*. Fifty is the median, so the default is
exactly the noise fix above and nothing moved.

**And it is per-axis, which is the more useful half.** Width was treated as one
quantity and is not: it is spread on the east-west axis, *height* on the
vertical one, how long a span the *temporal* one covers. Those move
independently, and pooling them lets a narrow axis be paid for by a wide one.
Naming one axis scopes the dial to it. Measured over 1,500 items at 4D with six
objects:

| dial | that axis | the other three |
|---|---|---|
| p10 | 1.31 bits | 5.04 bits |
| p50 | 1.67 bits | 5.03 bits |
| p90 | 2.05 bits | 5.06 bits |

The named axis moves by more than half a bit while the rest sit still, which is
what makes "temporal width" mean something other than "width".

**The coefficient is now fittable, and reported rather than guessed.** Realized
width is logged per answered item as a departure from its batch's median, and
`fitWidthCoefficient` estimates levels-per-bit on Diagnostics beside the rung
costs.

Fitted by **maximum likelihood, not by the mean-accuracy match the rung costs
use** — and the difference is worth recording, because the first attempt used
the same bisection and came back pinned to its bracket bound. A rung's cost is
identifiable from mean accuracy because every item in its subsample carries the
rung, so raising the cost lowers every prediction. Width is a signed quantity
averaging zero: raising the coefficient makes wide items harder and narrow ones
easier, the mean barely moves, and the objective is flat in the parameter.
Likelihood uses the association between width and outcome instead. It recovers
planted coefficients of 0.5 and 2.0 from synthetic answers.

It returns null when the sample has no spread to learn from, which is the common
case and the honest one — at the default dial every item is drawn at the median,
so any coefficient fits equally well. **Until it is fitted, width is not priced
into difficulty**, and the control says so: a large change makes items harder
than the player's level claims.

### 6+. New modes

Eleven are specced below. In rough cost order:

| | |
|---|---|
| ~~Transformation matching~~ | **built** — `generators/transform-match.ts`, `utils/gridmap.utils.ts` |
| ~~P6 shape and rotation~~ | **built** — `generators/shape-rotation.ts` |
| ~~P9 infer the relation~~ | **built** — `generators/infer-relation.ts` |
| ~~P12 transformation of function~~ | **built** — `generators/stimulus-function.ts` |
| ~~P11 oddest relation out~~ | **built** — `generators/oddest-relation.ts` |
| ~~P10 sequence induction~~ | **built** — rung `sequence` on Transformation Matching |
| ~~P7 nested spaces~~ | **built** — `generators/nested.ts` |
| ~~P1 facing space~~ | **built** — rung `facing`, `utils/facing.utils.ts` |
| ~~P2 knights and knaves~~ | **built** — the mode, and the speaker modifier as rung `speakers` |
| ~~P8 boolean concepts~~ | **settled** — it is P11 with the question reversed; rung `state-rule` |
| ~~P4 graph matching extended~~ | **built** — all three parts: `which-differs`, `distance`, `as-relations` |
| ~~Relational Web~~ | **built** — `generators/relational-web.ts`, `utils/web.utils.ts` |
| ~~Set Hierarchy syllogism~~ | **settled and built** — it is Syllogism's premise network branching; rung `hierarchy` |

---

## Proposed modes


## P6. Shape and rotation — **DONE**, `generators/shape-rotation.ts`

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


## P7. Nested spaces — **DONE**, `generators/nested.ts`

Two unrelated arrangements over one object set, interleaved: the outer clause
describes one, the parenthetical describes another. Verification was free as
predicted — two independent chains, each already exactly checkable — so all the
work was in the design question.

**The scoping rule is in the code, not just in this note.** `axisWordConflicts`
forbids two axes that share direction words, because a flat premise naming both
is genuinely ambiguous. This mode wants exactly those pairs, and may have them
because *the space is identified by syntax rather than by vocabulary*: inside
the brackets is one arrangement, outside is another. The guard stays as it is
for flat premises and is waived only where nesting marks the scope.

**The sharp item is generated deliberately, not waited for.** That turned out to
need two things, not one. Making a pair adjacent in both chains and reversed in
the second is necessary but useless on its own — the two halves then sit in
different premises, a page apart, and read as two ordinary statements. They have
to land in the *same* premise, so the inner half is reordered to line up:

> Ash is left of Bee (where Bee is left of Ash)

Contradictory to every reading instinct, and contradictory to nothing at all.
Measured over 300 items: with the rung, every item carries a same-pair premise
and 255 of them state it in opposite directions; without it, 85 happen by
chance.

Verification reads the halves apart **by bracket, never by wording** — the same
discipline the item asks of the player — and recomputes the answer from the
asked-about space alone. If the answer ever depended on the other space, that
check would disagree with the item.

Difficulty ladder is the vocabulary collision alone, since without it the mode
is two chains read separately.

## P1. Facing space — **DONE**, rung `facing` on the composed spaces

Every relation the app had was allocentric: "B is west of A" is a fact about the
world. "B is on A's left" is a fact about the world *and* about which way A is
turned, so it cannot be read off the premises — the layout has to be
re-expressed from a point inside it. That is perspective-taking, and it was the
one spatial axis missing.

Built as the roadmap specified in the two places it mattered. **Facings are
stated relationally** — "A faces C", never "A faces north" — so the facing has
to be derived before it can be applied and one premise costs two steps. And
**fixed at statement**: a facing resolves to a bearing when stated and stops
tracking its target, since the alternative is a constraint rather than a value,
needs re-solving after every change, and a later premise can make it
unsatisfiable.

**No compass ring, though, and that is a departure worth stating.** The plan was
a circular axis of four or eight points, reusing the loop arithmetic. But an
eight-point ring has to *round* bearings, and a bearing exactly between two
points then has no honest answer. The sign of a cross product separates left
from right exactly, for any integer coordinates, and a dot product separates
ahead from behind on the line of sight — which is the computation being tested
rather than an approximation of it. The loop arithmetic was not needed at all.

Left and right are judged in the first two straight axes; rings and the parity
axis are passed over, since a ring has no consistent left and parity has no
distance to take a bearing along.

**A bug worth recording.** The facing premise was written into
`question.premises` inside the conclusion builder, which the caller overwrites
afterwards from the rendered layout — so the first working version produced
items whose derivation reasoned confidently from a facing the player was never
told. Caught by reading one generated item, not by any type or test, which is
the argument for looking at output.

Costed at 1.8, the dearest modifier in the table: the layout has to be held
twice, once absolutely and once from inside.

## P2. Knights and knaves — **MODE DONE**, `generators/knaves.ts`

The one classic puzzle family the app lacked, and structurally unlike everything
else in it: every other mode composes relations, this is truth-functional and
self-referential.

Solved by brute force over all 2ⁿ assignments, as planned. That is not a
compromise — at six speakers it is sixty-four evaluations, and it is the
*definition* of the answer rather than a procedure that computes it, so the
generator and the checker cannot drift.

Generation picks the answer first: choose who is what, draw a statement for each
speaker and keep it only if its truth in that world matches their type, then
solve and check the puzzle has the intended reading. Two rungs:

- **compound** — "at least one of you two is a knave", which cannot be resolved
  by looking at one speaker, so the puzzle becomes a small case analysis rather
  than a chain of implications.
- **undetermined** — several readings fit, and the claim holds only if it holds
  in all of them. Deliberately the same wording and the same idea as
  under-specified composed spaces, since it is the same demand: notice that the
  premises *failed* to settle something.

Two things generation has to refuse. A world where everyone is the same kind
makes every statement about kinds uniformly true or uniformly false, so there is
nothing in the item. And "I am a knave" has no consistent reading at all — the
solver returns nothing, and the attempt is discarded rather than shipped.

Tests anchor the solver to worked classics (the paradox with no reading, the
self-claim that fits either type, the disagreeing pair with exactly one), then
re-solve every generated item from the premises the player is shown and check
the claim against **every** reading, which is the only definition of "true" that
stays right when more than one fits.

### Testimony checkable against stated fact — **DONE**, rung `testimony`

The richer form, asked for and built. As `speakers` works, a knave's report is
worthless *and* unidentifiable from the arrangement: who lied comes only from
what the speakers say about each other. Here:

1. A few relations are **stated plainly** — true, unattributed.
2. Speakers report more, and some reports are about pairs the plain facts
   already determine. Those can be **checked**, and a contradiction names a
   knave directly.
3. Speakers still make the usual claims about each other.
4. Exactly one assignment fits both.
5. **Two conclusions** — who is a knight and who is a knave, *and* a relational
   claim, true only if both hold.

The shape follows from that: a checkable report pins one speaker, their claims
pin the rest, and only then can the *extending* reports — about objects the
plain facts never reached — be sorted into usable and worthless. The relational
answer lives out there, so it cannot be reached until the liars are known.

Four things it had to be made to do rather than assumed to do.

**A checkable pair must actually be checkable.** "Both ends are inside the core"
is not the same as "the plain facts settle it" — with branching premises the
core need not be connected by the edges that stayed plain. Verified per axis
against a plain-facts-only view of the layout.

**The testimony must be load-bearing.** Nothing stops the conclusion picker
choosing a pair the plain facts already settle, and that item is answerable
without working out who lied. Rejected against the same view.

**Either conclusion must be able to be the wrong one.** Built the way the
multi-conclusion idiom builds elsewhere: decide whether the set is all true, and
if not make exactly *one* false. A false type-claim is wrong in one place only —
wrong about everyone is rejectable by noticing a single speaker.

**And a bug it exposed that was never confined to it.** `pathBetween` walked the
layout's neighbours regardless of whether a relation had been withheld or
discredited, so a derivation could reach the right answer *through a premise the
item had just said was false*. Correct arithmetic and a proof the reader cannot
follow, which is worse than showing nothing — and invisible to any check on the
answer alone. It affected `indeterminate` and `speakers` too. Paths are now
walked per axis over stated relations only.

### The modifier half — **DONE** for the composed spaces, rung `speakers`

Wrapping another mode's premises in speakers turned out to compose with
[under-specification](#3-indeterminacy--done-rung-indeterminate-on-the-composed-spaces)
rather than needing per-mode falsification, which is what made it cheap after
all — though not for the reason originally given.

The move: **a knave's report is false, so it tells the reader nothing**, and the
queried pair therefore has to be pinned down by the honest reports alone. That
is exactly what `determinedOn` already decides, so marking the lied-about
relations as unstated makes the conclusion picker refuse anything the truthful
premises leave open, without it needing to know that liars are the reason.

A lie flips a *subset* of its axes, never all of them. Flipping all would make
it recoverable — reverse it and read on — and "says false things" does not mean
"says the exact opposite". The subset is what makes a lie genuinely worthless
and the composition sound.

It stays on the composed spaces rather than becoming universal, and the original
caveat is why: making a premise false is not uniformly easy, and this works
because `renderNdPremise` builds from a delta vector rather than from text. The
scale family would work the same way. Modes that assemble sentences directly
would not.

Two puzzles stacked, costed at 2.2 — the arrangement cannot be started until the
liars are found.

## P4. Graph matching, extended — **DONE**, `utils/graphdist.utils.ts`

**More than two graphs — built**, rung `which-differs`. Three or four groups,
one not isomorphic to the rest, answered by choice. Which one differs is
established with `oddGraphOut` rather than assumed from which one was perturbed:
a change can land somewhere the relabelling makes equivalent, in which case the
intended odd one out matches after all and the item has no answer — or two of
them differ and it has several. `oddGraphOut` returns null for both, and the
attempt is discarded.

**Edit distance to isomorphism — built**, rung `distance`. Minimum over all
vertex bijections of the number of disagreeing pairs, capped at eight nodes
(40,320 bijections) and returning null rather than nought past it — a silent
zero would read as a claim of isomorphism, which is the one wrong answer a cap
must not produce.

A pair is collapsed to a single state (nothing / one way / the other way / both)
rather than two directed slots, so reversing an edge costs one change rather
than two, which is what a reader would count.

**The trap this file flagged is much larger than it sounds.** "Applying *k*
swaps does not mean the distance is *k*" — measured over 2,000 pairs at five
nodes:

| edits applied | true distance was lower |
|---|---|
| 1 | 37% |
| 2 | 75% |
| 3 | 98% |

A generator trusting its own edit count would be wrong more often than right. It
is searched for every time, and the test that matters is the one asserting the
edit count and the distance genuinely disagree — if they never did, the search
would be unnecessary and the module pointless.

**Over other modes — DONE**, rung `as-relations`. Composition of parts already
built, as predicted, and it needed no per-mode work at all: the earlier note
had this backwards. Nothing has to expose its layout as an edge list, because
the traffic runs the other way — a graph is *rendered* as comparisons on a
scale, using vocabulary the scale family already carries.

The mapping is exact in both directions: a one-way link is a comparison, a
two-way one is a statement of sameness. So the structures match exactly when the
graphs are isomorphic, decided by the same search the other two forms use.

**The reason to want it is not that it was cheap.** With both graphs drawn as
arrows, the two premise sets are written in the same words, so they can be lined
up by eye: match the text, match the structure. Giving one set a spatial
vocabulary and the other a temporal one closes that route — nothing can be
compared until both have been abstracted away from what they say into what shape
they are, which is the operation the mode exists to train and the one its own
presentation was letting people skip.

Scale pairs are chosen to share no phrase at all. Quantity and Height say
exactly the same things, so a reader could only tell which set a statement
belonged to by where it sat on the page, which reopens the shortcut.

One thing worth stating in the setup rather than leaving implicit: the question
is about the statements *as made*. A chain of comparisons implies more than it
states, and those implications are not part of the pattern being matched.

## P8. Boolean concept learning — **SETTLED**, as a presentation of P11

The instruction here was to settle the form before writing a generator, and the
settlement is that **there is no new generator to write**.

The objections to the standard paradigm all stand: it teaches over many trials
per concept with most of them carrying little information, three binary
dimensions is eight objects and therefore memorable rather than derivable, and
it is categorisation over attributes rather than over relations. The promising
direction was relational instances, the whole set shown at once, and the *rule*
as the answer.

That is [P11](#p11-oddest-relation-out) with its question reversed. Oddest
Relation already shows several relations at once, already computes a consensus
pattern per dimension by strict majority, and already declines to state it —
because not stating it is what makes "which departs furthest" a question. Asking
for the pattern instead costs one presentation, not a mode. The two are one mode
with two presentations rather than neighbours, which is what this section
suspected.

Built as the rung `state-rule`, below `rank` on the ladder. Distractors differ
from the consensus on one or two dimensions, so each is *strictly* less
supported rather than merely different — every axis is decided by a strict
majority, so flipping any one loses it. A distractor that were equally supported
would make the item unanswerable rather than hard.

**What is genuinely lost** is the reason P8 was attractive in the first place:
Feldman's Boolean complexity gives a *computed* difficulty, and the
Shepard-Hovland-Jenkins six-type ordering gives a validated scale to check
against. That would have been the one `MODE_SCALE` weight derived rather than
guessed. It does not transfer, because these instances are relational
displacements rather than feature bundles over three binary dimensions. The
`fitRungCosts` machinery is the honest substitute — measured rather than
derived, but measured against this app's own players.

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

## P10. Sequence induction — **DONE**, rung `sequence` on Transformation Matching

S₁, S₂, S₃ generated by a repeated operation; produce S₄. As predicted it shares
the transformation machinery entirely — the map composed with itself rather than
carried to a different structure — so verification stays coordinate equality on
labelled points and the app gained extrapolation without gaining an engine.

Its own rung rather than a variant of `apply`, because the demand differs:
`apply` shows a rule working once and asks for another instance, while a
sequence shows one rule *iterating*, so the reader has to notice that the step
from first to second is the same step as from second to third before there is
anything to extend.

Two things it had to get right. Tripling three times reaches eighty-one, which
is arithmetic stamina rather than induction, so the repeated maps are restricted
to those whose iteration stays readable. And **every term has to identify the
step, not just the first** — a reader works from whichever pair they look at, so
an ambiguous later transition gives the item an answer the item does not
support. That is the same trap as the compose form's halfway structure, and the
test checks each consecutive pair independently.

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

### Rung costs are guesses — **MEASURABLE NOW**

`RUNG_COST` is still hand-written, and it still should be. What changed is that
it can now be *checked*: every answered item is logged with the estimate it was
chosen under, and `fitRungCosts` reports what those answers say each rung is
worth, with sample sizes, on Diagnostics.

Fitted by bisection on the cost rather than by differentiating the psychometric
function — slower and completely uninteresting, which is the point: no
derivative to get wrong, and the objective (mean predicted accuracy equals mean
observed) is the thing actually wanted rather than a proxy.

**Reported, never applied.** A fit from forty trials is worse than the guess it
would replace, so below the threshold it reports nothing at all rather than a
number with a caveat.

The test does the only check that matters: generate answers from a world where a
rung's true cost is a number the fitter was never told, and see whether it comes
back with that number. Planted costs of 0.3, 1.4 and 2.6 all come back within
0.35 over four thousand trials. A fit that cannot recover a planted value has
nothing to say about a real one, however reasonable its output looks.

### The tier cheat is inert — **DONE**

It seeds the posteriors now, through the same `applyCalibration` the placement
test uses, and sets the score mid-band so a wobble does not immediately fall out
of the tier that was asked for. The level-for-tier inversion is approximate and
says so.

### Argument swap — **DONE**, edit kind `exchange`

Objects exchanged *within* one relation, as predicted the same vector negation
as `reverse`. The framing is the whole of it: "the relation A → B is reversed"
asks you to invert a relation, "A and B trade places in that premise" asks you
to re-read a sentence with its arguments swapped. The second is the error people
actually make with asymmetric relations, and it is worth being able to *state*
rather than only to fall into.

Tested by asserting the two framings move every object to the same place while
reading differently — if they ever computed different layouts, one of the two
wordings would be lying.

### Unfinished ports from v3 — **DONE**

- ~~Chain heuristics~~ (`space-hard-mode.js`) — ported as an axis *ranking*.
- ~~Presentation modifiers~~ — all three ported.

**Chain heuristics.** v3's `directionize` chose which dimension to transform
along by measuring accumulated spread among the objects involved, and avoided
the dimension it had just used. v4 drew uniformly, which this file recorded as a
fidelity gap affecting texture rather than correctness. It affects rather more
than texture: an operation along an axis the pair is level on changes little the
conclusion can ask about, and two operations in a row on the same axis read as
one.

Ported as `rankAxes` on the draw options rather than as v3's chain machinery —
v4's operations are pairwise, so the analogue of accumulated spread along a
chain is the gap between the two objects involved. v3's nineteen-in-twenty split
between "take the best" and "take any" came across too: always taking the top
makes the choice predictable to anyone who notices, which is its own shortcut.

Measured over 3,600 operations:

| | on a level axis | repeating the last axis |
|---|---|---|
| uniform draw | 26.2% | 12.9% |
| ranked draw | 5.5% | 6.4% |

The test asserts thresholds well below the uniform figures, so a regression
fails rather than passing quietly with worse items.

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

- ~~Start screen: daily/weekly goal bars clip their labels~~ — **DONE**. The
  caption was *inside* the fill, so it was laid out in a box the width of the
  percentage and clipped by the track's overflow; at low progress there was
  almost no box to lay it out in. It now sits over the whole track and reads
  across the fill edge by blend mode, which needs no per-colour tuning — there
  are ten fill colours. The wider font did not cause it, only made it visible.
- `angular.json` style changes need a dev-server restart — webpack config, not
  hot-reloaded.

---
