# Reference

## Rung ladders per mode family

A rung is a named modifier a mode can carry. `RUNG_LADDERS` in
`utils/progression.utils.ts` is the source of truth — a table here would drift
from it — but four invariants are worth stating because they are not obvious
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
- **A rung the generator does not read is worse than no rung.** It is charged for
  in `RUNG_COST` and delivers nothing, so the player pays for an item they were
  already being served. And it costs more than its price: `chooseConfig` refuses
  to raise premises past `structureBefore` while any rung is unclaimed, so a
  phantom rung pins the mode's length as well. Anything in `RUNG_LADDERS` must
  reach a `hasRung` call, a `depthBonusFor` prefix, or a `settings.enabled.*`
  flag the generator reads.

An empty ladder is not one thing, and the two kinds want opposite fixes.

*Nothing left to add* — Infer the Relation, Shape and Rotation. Difficulty comes
from length alone, and the answer is to give the mode rungs rather than to make
its items longer.

*Structure already indexed by length* — Deictic Relations. Its item is a 2^k grid
plus one premise per reversed axis, so `premises = 2^k + r` is a bijection onto
the frames the mode can take: a reversal *is* a premise and a third axis *is*
four more. It carried `extra-reversal` and `third-axis` until neither was found
to be read by anything, and no wiring could have saved them — there was no third
quantity for either name to mean. Here the premise count is the structure axis,
and adding a rung is charging twice.

Note that `premisesMayRise` does **not** enforce any of this. It belongs to the
v4 staircase and nothing calls it; the live rule is the `lengthCap` guard in
`chooseConfig`, which stops firing entirely once a ladder is empty — so an
empty-ladder mode grows on length freely, and its premise ceiling is the only
thing bounding it.

---
