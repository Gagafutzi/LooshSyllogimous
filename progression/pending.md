# Pending — holding document

Working list. Nothing here is built. Items leave this file when they land, or
when they are decided against; it is not a plan and not a record.

The plan proper is [advancement.md](advancement.md). This holds what has been
decided, what has been found, and what is queued, so none of it depends on a
conversation staying in scope.

---

## Decisions taken

**No variable is capped.** Comfortable at any level means advance. Every ceiling
in the current system — ladder length, `maxLevel: 26`, seven dimensions,
transformation depth 2, `minSeconds: 8` — is a limit of the machinery rather than
a claim about the player, and none of them should read as the latter. There is no
level at which a difficulty axis stops being available.

Specifically: **no arity ceiling.** Arity is a variable to measure and keep
raising. Nothing about it saturates at any particular value, and the progression
system must not behave as if it does.

**Arity is a target. Concurrent fragment count is not.**

The two are separate quantities and they trade against each other:

- *Merge arity* — the largest number of separate relational groups any one
  premise welds together. Currently **2 on every item of every mode**, except
  where meta is enabled, which reaches 3 and 4 on the scale modes and the
  arrangements.
- *Peak concurrent groups* — how many unjoined fragments are carried at once.
  Driven by the scramble factor, which sets what share of adjacent premise pairs
  survive reordering. Runs 1–3 at six premises, and scramble already defaults to
  100, so it is already at its maximum.

The position: **raising arity is worth doing; maximising fragment count is not.**
Fragments are storage — how many partial results you hold. Arity is integration —
how much has to be combined in one step. The second is the thing this app exists
to train, and the first is the thing it was trying not to be.

**And the demand is not that several groups meet — it is that several *large*
ones do.** Merging three objects is not the complex case. The complex case is an
item that builds two or more separate, substantial structures and then has to
fold them into one map: everything across the seam becomes determined at once,
and both sides have to be held entire while it happens.

So the count of groups joined is the wrong number on its own. `pairsSettled`
counts what actually changes — the object pairs whose relation was undetermined
before a premise and determined after it. Extending a six-chain by a name
settles six; joining two four-groups settles sixteen; joining two six-groups
settles thirty-six. Two groups joined can be worth four or worth thirty-six, and
the count reads 2 either way.

That also settles what wide premises are for. "A is above B, which is above C"
names three objects and my first measure called it arity 3 — but it is two
binary relations sharing a middle term, read in sequence, and it decomposes
without loss. Betweenness does not. The case for wide premises is the carousel
one: two links on one screen, integrated while both are visible. Not arity.

This settles what wide premises are for. They merge *consecutive* edges of one
layout, so a 7-edge item renders as ~4 sentences: arity rises to 3, fragment
count falls from 7 to 4. That is a trade, and it is the right way round.

**Default configuration: carousel with no going back, wide premises, timer.**

- *No going back* removes the re-reading strategy rather than pricing it. The
  model already has a term for that leak — `unneededPremises`, at coefficient 0.
- *Wide premises* raise arity to 3, and in a carousel they convert "hold a link,
  then hold another link" into "integrate two links while both are visible, then
  hold one result". Fewer screens to carry, more integration per screen.
- *Timer* is already on the one scale and trades against structure.

Fluid progression keeps working on every other mode; this combination is what it
should be tuned around.

**Scramble is the instrument, and it is currently blunt.**

It is pinned at 100, which maximises the quantity we have just said not to
maximise, and does nothing at all for the one we do. That is not a setting to
turn down — it is the wrong shape of control for the new default.

*Order decides whether a multi-object premise introduces or integrates.* A
premise naming three objects welds three groups if all three are new, and welds
three *held structures* if they are not. Those are the same premise doing two
completely different jobs, and which one happens is decided entirely by where the
shuffle puts it. At scramble 100 the app gets whichever comes up.

So scramble has to become the schedule of merges rather than a percentage of
surviving adjacencies:

- **All-premise mode keeps what it has.** With the whole card visible, order is a
  search cost, not a memory schedule, and the adjacency percentage expresses that
  correctly.
- **The carousel default gets a chosen order.** Search permutations for one that
  hits a target profile — maximum merge arity at or above *m*, peak concurrent
  groups at or below *f* — rather than shuffling and accepting the result. Two
  targets, independently set, which a single percentage cannot express: today
  turning it up raises *f* and leaves *m* alone.

**This also corrects the arity measurement.** Counting distinct groups welded
conflates the introduction with the integration: three fresh singletons score the
same as three held fragments, and only the second is the thing worth training.
The measure should count only groups that were already non-trivial, or weight by
the size of what is merged. Worth fixing before arity becomes a dial, because a
dial that targets the wrong number will be hit by scheduling the easy case.

---

## Fixes that must land before the default changes

**1. `recordDifficulty` reports the rendered premise count, not the one the
configuration asked for.**

`levelOf` is fed `this.question.premises.length`. Wide premises merge consecutive
edges, so a 7-edge item renders as ~4 sentences and is recorded as a level-4
item. Both sides of the loop read that number: the posterior settles at roughly
half true ability, and `chooseConfig` then serves items about half the length the
player can handle. It converges quietly to too easy, and every archived level is
wrong by the same factor.

The configuration already knows what it asked for — `armedSeconds` is stored on
the service for exactly this reason, being "what the screen decided". The premise
count needs the same treatment. One line, but it has to precede wide premises
becoming default or the default is a slow demotion.

**2. The deadline floor does not know the carousel exists.**

`secondsForCost` bottoms out at `minSeconds: 8`, and nothing relates that to how
many screens there are to page through. With manual advance this is survivable —
the player is hurried, which is the intended pressure. With timed advance at four
seconds a screen, a seven-premise item needs twenty-eight seconds of reading
against a deadline that can be eight, and is unanswerable by construction. The
floor has to scale with premise count wherever the premises are shown one at a
time.

**3. Wide premises are retired and would need un-retiring.**

`retired-wide-premises` is a tombstone on the linear ladder. The rendering code
is intact. Making it a default rather than a rung is a different move from
restoring it as a rung, and the two should not be conflated — as a default it is
not something the ladder grants, so it does not want a `RUNG_COST` at all.

---

## Levers queued

**Meta as a dial rather than a flag.** Today it is a boolean rung on eight modes,
and absent from `ND_LADDER` entirely — so the composed spaces, which carry the
most dimensions and the most premises, are the ones structurally fixed at binary
integration. As a dial it becomes "how many of this item's premises are meta",
with no ceiling, and the composed spaces become able to have any.

Blocked on: three modes offered `meta` and have never produced one (now
tombstoned). Any mode given the dial has to be shown to deliver it —
`rung-delivery.test.ts` is the check.

**Arity as a measured property, then as a dial.** Recorded on every item beside
`depth` and `widthDelta`, priced at 0 until fitted, and then a value the
generator can be asked to hit.

Blocked on: arity cannot rise while every premise names two objects. Three ways
to give it range, in order of cost:

1. Wide premises — arity 3, already written, decomposes into two binary relations
   read in sequence, so the weakest form.
2. Betweenness — "B is between A and C" names three objects and does *not*
   decompose, because it withholds the direction `A < B` and `B < C` would give.
   Fits every linear scale and every axis of a composed space, verified against
   the layout the generator already builds. A premise form on existing modes, not
   a new mode.
3. Meta — four objects, as above.

**A dial has no ceiling on the ladder and always has one on the item.** The
plan said feasibility "stays in the generator, where it belongs; the difficulty
scale simply prices whatever was asked for". That was half right and the missing
half is expensive: aiming past what structure could reach, `chooseConfig` asked
for fifty-six transformations on a five-premise item and priced the ask, which
the generator clamps to one. The model must not ask for what cannot be built, or
it prices a fiction and no mode ever runs out. Feasibility now travels with the
dial as a premise cost per turn that continues rising, and as a hard cap where
more premises cannot help.

**Peak concurrent groups, measured but not targeted.** Worth recording for the
same reason as arity — the fitters need it, and it says how much of the current
level spread the model cannot see. Explicitly not something to maximise.

---

## Open: dials, or a branching graph with carry-over

Dials beat linear gates, and that much is settled. Whether they should be
arranged in a graph rather than a flat set is not.

**What already carries over.** Three mechanisms exist, and they cover more ground
than the question assumes:

- `RUNG_COST` and `RUNG_MIN_PREMISES` are **global**, keyed by lever name and
  shared by every mode. What a lever *costs* is already learned from everybody's
  items everywhere, not re-learned per mode.
- `priorForNewMode` gives a mode never played the aggregate as its prior at
  `crossModeSd: 2.5`, so ability carries into unplayed modes.
- `MODE_FAMILIES` puts the five scale modes on one ledger.

**What does not carry over is availability.** A lever earned on Comparison says
nothing about the same lever on Space 4D, because the ladder is a per-mode list.
That is the real gap, and it is narrower than "the progression model is the wrong
shape" — pricing already carries, ability already carries, only the unlock does
not.

**The case for a graph.** One thing dials cannot express: prerequisites. Some
levers genuinely require others — a checkpoint needs no mutations, indeterminacy
needs enough premises, `premisesNeededFor` is a partial version of this already —
and today those live ad hoc inside generators as feature gating. A DAG states
them once.

**The case against.** A graph has edges, edges have order, and order is precisely
what made `checkpoint` unreachable and `meta` undeliverable. It is a more
elaborate structure to get wrong and it has to earn that. And a full capability
model means many latents per player rather than one per mode, which one person's
answer volume will not determine — the current model's whole virtue is that it
estimates a single number from sparse evidence.

**Where this leans.** A DAG over *constraints* rather than over *ordering*: it
says what is buildable, not what comes next. What comes next stays "whatever the
posterior wants", which is the thing that must not be capped. Plus lever-level
carry-over, which is the one piece genuinely missing — earning arity 3 on a scale
mode should be worth something towards arity 3 in a composed space, in the same
way ability already carries.

Undecided. Worth trying the cheap half first: make dials carry across modes the
way cost already does, and see whether the graph is still wanted afterwards.

---

## Found by simulation

`tests/player-sim.test.ts` runs the real `chooseConfig` / `levelOf` /
`abilityUpdate` loop against players the model will actually meet: improving,
erratic, prone to slumps, and strong everywhere except one modifier. Five seeds
each, four hundred items.

**What holds.** A steady player is tracked to within a level wherever they sit —
3.0 → 3.3, 8.0 → 8.1, 15.0 → 15.2, with the posterior settling at sd ≈ 0.4 and
realised accuracy within a few points of the 80% aim. A learner is followed to
where they got to. The model does its designed job well.

**Defect: one weak modifier costs the whole-mode estimate.** A player at level 10
who finds `negation` four levels harder is estimated at **6.3**. One at level 12
weak at `meta` is estimated at **7.2**. Rungs are a prefix, so the weak one lands
on 99% and 89% of items respectively and cannot be dropped without dropping
everything after it — and `chooseConfig` prefers *more* rungs on a tie, so it
never tries. They are then served items three to five levels too easy on
everything else as well.

This is the gates-and-dials split, measured: a dial can be turned down on its own
and a prefix cannot.

**Defect: a widened posterior does not always recover.** The aim is
`estimate − caution × sd`, and further below for the success target. When sd is
large the item served is far below the player, who answers it correctly — and a
correct answer well below your ability is almost no evidence, so sd stays large
and the aim stays low. The loop sustains itself.

Traced on one run: the served level sat at the mode's floor of 3.0 from item 50
to item 200 while true ability rose 4.5 → 6.0 and p(correct) climbed to 0.94. The
outcome is bimodal rather than average — most seeds settle at sd 0.4, some sit at
4–6 indefinitely. Reached by anything that legitimately widens the posterior: a
moving ability, or a noisy one.

Setting `caution` to 0 makes it go away, which confirms the mechanism rather than
being the fix — caution exists so a new player is not over-served on a wide
prior. A fix has to keep that and break the loop, probably by requiring the
served item to carry a minimum of information rather than only a maximum of
risk. **Not in the plan, and outside what the plan said it decides** — it is
adjacent to "what `targetP` should be". Wants a decision before anything is
built.

Both are guarded rather than fixed: the tests assert the numbers do not get
worse, and say so.

---

## Betweenness — deferred, not rejected

The ternary premise form the arity dial depends on, and it is not as simple as
the plan implies.

"B is between A and C" withholds the direction, which is what makes it
non-decomposable and worth having. In a chain it also destroys the only
information about how A stands to C: replace the links A–B and B–C with the
between-form and both `A > B > C` and `C > B > A` satisfy every remaining
premise. The item becomes under-determined, which is a different mode's rung
(`indeterminate`) rather than a harder version of this one.

So the form is only sound where **another path already orders the two outer
objects** — which a chain never has and a branching network sometimes does. That
makes it conditional on `branching` and on a per-item check, not a premise form
that can simply be switched on.

The composed spaces have the machinery for exactly this question —
`determinedOn` and `indeterminatePairs` — and the scale family does not. Whether
to build the equivalent for the scales, or to put betweenness on the composed
spaces where the check already exists, is undecided.

**Not being built for now.** The design question above is real and the answer is
not obvious, and nothing else is waiting on it — the arity dial is the only thing
it unblocks, and arity is measured and priced at nothing either way.

Un-retiring wide premises is unaffected and is what step 5 leaves behind. It is
not an arity gain — "A is above B, which is above C" decomposes into two binary
relations read in sequence — so its case is the carousel one: two links on one
screen, integrated while both are visible, and fewer screens to carry.

---

## Known and accepted

- **`levelsPerCarousel` loses its contrast** if the carousel becomes universal.
  A constant offset is the least harmful kind of pricing error inside the app,
  but the level stops being comparable to non-carousel history or to anything
  else in the archive. Keeping some proportion of items non-carousel is the only
  way that coefficient ever gets fitted.
- **`circular-2` is inert on Direction and Space 3D.** Not a bug: latitude does
  not wrap and longitude does, so there is no second cyclic axis unless the axis
  picker swaps north-south for left-right.
- **Three coefficients sit at zero** — `widthPerBit`,
  `levelsPerUnneededPremise`, `levelsPerCarousel` — with fitters written and
  unused. That is the correct default, not an oversight.

---

## Loose ends outside this file's subject

- `READING.md` carries two paragraphs that are no longer true: indeterminacy is
  built (`indeterminate` rung, `indeterminacy.test.ts`) and Phase D is built
  (`transform-match.ts`). Offered to correct; not yet answered.
- eWMTurp PR #1 is redundant — same commits, stale title. Offered to close; not
  yet answered.
