# Reference

## Rung ladders per mode family

A rung is a named modifier a mode can carry. `RUNG_LADDERS` in
`utils/progression.utils.ts` is the source of truth — a table here would drift
from it — but three invariants are worth stating because they are not obvious
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

A mode with an empty ladder — Graph Matching honours neither negation nor meta —
has no structure to add, and `premisesMayRise` stops it growing on length alone.
The answer is to give it rungs, not to make its items longer.

---
