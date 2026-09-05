# Advancement: a plan for how difficulty should compute

Companion to [README.md](README.md), which describes the system *as it is*. This
describes what it should become, and why. Nothing here is built yet.

The prompt for it: the app now has a great many ways to make an item harder, and
the machinery that picks the next one can only reach a few of them. Meta and
merge arity are two more levers worth having, and adding them to the current
structure would repeat a mistake it already contains.

---

## 1. What is actually wrong

Advancement reads a **prefix of a finite ordered list**. `chooseConfig` searches
`ladder.slice(0, n)` for `n` from zero to the ladder's length, pairs each prefix
with a premise count, and closes the remaining gap with the clock.

That shape has three consequences, and all three have now been observed rather
than predicted:

**Everything is capped.** Premises stop at `maxNumOfPremises`, rungs at the
ladder's length, dimensions at seven, transformation depth at two, the posterior
grid at `maxLevel: 26`, the clock at `minSeconds: 8`. A player comfortable at the
top of a mode has one axis left — the clock — and then nothing. That contradicts
the rule this plan is written to satisfy: *comfortable at any level means
advance*, with no ceiling anywhere.

**Counted quantities are being encoded as ordinal gates.** `transform-depth-1`,
`transform-depth-2`, `edit-1`, `edit-2`, `circular`, `circular-2` are not six
unlocks. They are three integers, each allowed to reach two, because two is how
many list positions were spent on them. There is no reason edits stop at two
except that nobody wrote `edit-3`.

**Position in the list is load-bearing, so the list cannot be reordered.** A
stored profile keeps a *count*, and the count is read positionally. That is why
`checkpoint` was appended to the end of `ND_LADDER` — correct procedure — and
why appending it there made it unreachable, since the end of that list is past
every rung whose presence rules a checkpoint out. It had never fired for anyone.

Two further defects of the same family were found in the same pass: `meta` was
offered by three modes that have never produced one, and it is the dearest basic
rung, so those modes priced every item a level above what it was. A ladder that
cannot be reordered accumulates exactly this: entries that are wrong in place and
too expensive to move.

---

## 2. The inventory

Every quantity that currently affects, or should affect, an item's difficulty.

### Priced and live

| variable | how it enters | bound |
|---|---|---|
| premise count | `weight × premises`, weight from `MODE_SCALE` | `maxNumOfPremises` |
| rungs held | `Σ RUNG_COST[r]` | ladder length |
| deadline | `perTimeHalving × log₂(reference / seconds)` | `minSeconds: 8` |

### Measured, priced at zero

These have fitters written and coefficients deliberately left at `0`, so the term
is a no-op until answered items say what it should be.

| variable | measured by | coefficient |
|---|---|---|
| realised width | `ndWidth`, bits to locate an object per axis | `widthPerBit: 0` |
| unneeded premises | `premises − depth`, from `graphDistance` | `levelsPerUnneededPremise: 0` |
| carousel | one premise at a time vs the whole card | `levelsPerCarousel: 0` |

### Not measured at all

| variable | what it is |
|---|---|
| **merge arity** | the largest number of separate relational groups any one premise welds together |
| **meta density** | how many premises of an item state a relation between two *relations* rather than two objects |

Merge arity is currently **2 on every item of every mode**, measured over sixty
items each at six premises and full scramble, with one exception: enabling meta
raises it to 3 and 4 on the scale modes and the arrangements. That is not a
tuning gap. Every premise the app writes names exactly two objects, so a single
integration step can never combine more than two groups. Width and depth and
scramble all move; arity is pinned by the premise vocabulary.

### Related but distinct, and worth not conflating

- **depth** — steps along the shortest path from one end of the claim to the
  other. Sequential. Controlled by construction (`pickDistantPair`).
- **peak concurrent groups** — how many unjoined fragments you carry at once,
  driven by the scramble factor, which sets what fraction of adjacent premise
  pairs survive reordering. Runs 1–3 at six premises. Measured nowhere.
- **merge arity** — the size of the largest group merged in one step. Above.
- **width** — how much state locating one object costs.

Four different quantities. The model currently prices one of them.

---

## 3. The rule

**One scale.** Everything above resolves to levels — linear-equivalent premises
— and the posterior is over that scale. This does not change; it is what lets a
clock be traded against a dimension and the number mean the same thing. Anything
that cannot be expressed in levels does not belong in advancement.

**Two kinds of variable, and the split is the substance of this plan.**

- **Gates** are ordered and finite. A form of item is either available or not:
  branching, indeterminacy, facing, speakers, testimony, checkpoint,
  choose-conclusion, construct-conclusion. Their order encodes a teaching
  sequence, so a prefix is the right structure and position stays meaningful.
- **Dials** are counted and unbounded. Premises, dimensions, edits,
  transformation depth, circular axes, meta density, merge arity, and the clock.
  Each contributes `cost × n` for an integer `n ≥ 0` with **no upper bound in the
  difficulty model**. A mode's generator may refuse a value it cannot build; that
  is a feasibility limit and it belongs in the generator, not in the ladder.

Migrating the six mis-encoded entries — `transform-depth-1/2`, `edit-1/2`,
`circular/circular-2` — is what lets those quantities keep rising, and it frees
six ladder positions. Tombstone them in place, as `retired-*` already does, so
stored counts keep their meaning.

**Advancement is unchanged in principle.** Pick the configuration whose level is
nearest `targetLevel(posterior, targetP)`. What changes is that the search space
becomes gates × dials rather than a prefix count, and it has no top. Remove
`maxLevel: 26` from the grid, or raise it as the aggregate rises; a player at the
ceiling of the grid has an estimate that cannot move.

**Preference among ties.** Configurations within `TOLERANCE` of the target are
equal on difficulty, and the tie-break says what kind of harder to serve. Today:
more rungs, then closer, then fewer premises. Proposed:

1. a **gate** the player has earned but this mode has not shown recently
2. a **dial** raised on an axis not recently raised
3. **premise count**
4. the **clock**

Length and the clock stay last because they are the two that stand in for
structure without being any. Adding a recency term also fixes something the
current rule does not address: a stable posterior serves the same configuration
repeatedly, and variety of practice is the argument the randomised labels were
built on.

---

## 4. Pricing discipline

Three coefficients sit at zero with fitters written and unused. That is the
correct default and it should be the standing rule:

> **A new lever ships at cost 0, which makes it a no-op, and is priced only from
> a fit over answered items. No coefficient is ever hand-set.**

`fitRungCosts`, `fitWidthCoefficient` and `fitDepthCoefficient` exist. Meta
density and merge arity get the same treatment: measured and recorded from the
day they exist, priced when there is evidence.

And one more, learned the hard way this week:

> **A lever may not be priced above zero until a test proves items actually carry
> it.** `registries.test.ts` proved a generator *reads* a rung. That is not the
> same as delivering one, and three modes charged a full level for a relation
> they have never produced. `rung-delivery.test.ts` now checks the mark on the
> finished card.

---

## 5. Making arity move

Merge arity cannot rise while every premise names two objects, so a dial for it
is worthless until premise forms exist that name more. In order of cost:

1. **Un-retire wide premises.** `retired-wide-premises` is on the linear ladder
   and the code still exists. "A is above B, which is above C" names three
   objects, arity 3. Weakest of the three, because it decomposes into two binary
   relations read in sequence.
2. **Betweenness.** "B is between A and C" names three objects and does *not*
   decompose: it withholds the direction that `A < B` and `B < C` would give.
   Fits every linear scale already defined and every axis of a composed space,
   verified against the layout the generator already builds. This is a premise
   form on existing modes, not a new mode.
3. **Meta as a dial rather than a flag.** A meta premise relates two relations
   and names four objects. Today it is a boolean rung on eight modes, absent from
   `ND_LADDER` entirely — so the composed spaces, which carry the most
   dimensions and the most premises, are the ones structurally fixed at binary
   integration. As a dial it becomes "how many of this item's premises are meta",
   and the composed spaces become able to have any.

Arity is then a measured property of the built item, reported alongside `depth`
and `widthDelta`, and a target the generator can be asked for.

Nothing here caps it. If a player is comfortable at arity 4, the next item asks
for 5.

---

## 6. Order of work

Each step is independently shippable and independently verifiable.

1. **Measure before changing anything.** Record merge arity and peak concurrent
   groups on every item, next to `depth` and `widthDelta`. Costs nothing, prices
   nothing, and gives the fitters something to fit. It also says how much of the
   current level spread is explained by quantities the model cannot see.
2. **Split gates from dials.** Migrate the six counted entries out of the
   ladders, tombstoning their positions. No behaviour change intended; the check
   is that a player's configuration is the same before and after.
3. **Remove the ceilings.** `maxLevel`, and the assumption that a ladder's length
   is the top of a mode.
4. **Preference and recency** in `chooseConfig`'s tie-break.
5. **Ternary premise forms** — betweenness first, wide premises restored beside
   it — so arity has range.
6. **Meta as a dial**, including on the composed spaces, which have never had it.
7. **Fit** the coefficients that now have evidence: width, depth shortfall,
   carousel, arity, meta.

Steps 1–4 are the plan proper. Steps 5–7 are what the plan makes possible.

---

## 7. What this does not decide

- **What `targetP` should be.** The item is chosen to sit a fixed distance below
  the estimate; that distance is a separate question from what the axes are.
- **Whether the mode families are right.** Five scale modes share one estimate.
  Adding axes does not change that grouping.
- **Session shape.** How many items, how long, in what order. Advancement picks
  the next item; it says nothing about when to stop.
