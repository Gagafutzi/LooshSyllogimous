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

**Open question this raises.** Scramble is pinned at 100, which maximises exactly
the quantity we have just said not to maximise — and with no going back its
anti-strategy value is largely spent, since the premises cannot be re-read in any
order anyway. Whether the default should come down from 100 is undecided and
worth measuring rather than arguing.

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

**Peak concurrent groups, measured but not targeted.** Worth recording for the
same reason as arity — the fitters need it, and it says how much of the current
level spread the model cannot see. Explicitly not something to maximise.

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
