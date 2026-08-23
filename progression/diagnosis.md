# Why it feels slow

The complaint, as reported:

> Sometimes even though I am on a 90 streak I barely advance because my total
> accuracy is around my goal.

Both halves are accurate observations, and they have **different causes**. One
is the system working as designed and arguably right. The other is a real
defect, and it is the opposite of what anyone would guess.

All numbers below are from [`simulate.ts`](simulate.ts), which drives the real
functions: a simulated player of true ability 8.0 answering 200 items to settle
the estimate, then a run of consecutive correct answers.

---

## Finding 1 — a streak makes the model *less* sure, and the aim goes *down*

This is the defect. It is not slowness; it is a sign error in effect.

Settled player, then consecutive correct answers on true/false items:

| after | posterior mean | sd | cautious aim | **target level** |
|---|---|---|---|---|
| 0 | 8.00 | 0.35 | 7.68 | **7.12** |
| 10 right | 8.15 | 0.36 | 7.83 | **7.27** |
| 30 right | 8.46 | 0.37 | 8.13 | **7.56** |
| 60 right | 9.06 | 0.82 | 8.33 | **7.76** |
| 90 right | 10.56 | **2.77** | 8.07 | **7.50** |

Read the last two rows. **Ninety consecutive correct answers aim you lower than
sixty do.** The mean rose by 2.56 levels and the served item got *easier*.

### Why

Two mechanisms compound.

**The posterior widens during a streak.** sd goes 0.35 → 2.77. That looks
backwards and it is not a bug in the arithmetic — it is what the likelihood
says. An item chosen to be answered correctly 80% of the time is, by
construction, well below your ability, so a correct answer on it is consistent
with *any* ability above the item. The likelihood is nearly flat over the whole
upper half of the grid, so each correct answer adds almost no information about
where in that half you are, while `forgetting = 0.995` keeps discarding the old
evidence that had pinned it. Mass drifts upward and spreads out.

**Caution then charges you for the width it just created.** The aim is
`mean − 0.9 × sd`. At 90 right that is `10.56 − 2.49 = 8.07`, below the 8.33 it
had at 60. The term exists so that a *new* player, who is unmeasured, is served
easy items. During a streak it fires for the opposite reason — the model is
unsure because you have been doing too well to be informative — and it responds
by making things easier still, which is self-reinforcing.

### The compounding loop

```
item is well below ability  ──►  correct answers carry little information
        ▲                                      │
        │                                      ▼
aim drops further              posterior mean rises but sd rises faster
        ▲                                      │
        └──────── caution = 0.9 × sd ◄──────────┘
```

### What the player sees

The served configuration barely changes. From the same simulation, tracking the
actual item:

| after | item served |
|---|---|
| settled | 4 premises, 5 rungs, 44 s |
| +30 right | 4 premises, 5 rungs, 33 s |
| +70 right | 4 premises, 5 rungs, 40 s |
| +90 right | 4 premises, 6 rungs, 53 s |

Thirty consecutive correct answers change **nothing** except eleven seconds off
the clock. The clock then *loosens* again as caution eats the gain. One rung
arrives at ninety.

### Fixes worth considering

None of these is implemented; they are the candidates the measurement suggests.

1. **Make caution one-sided.** It exists to stop an *unmeasured* player being
   over-served. It has no business lowering the aim for a player with 200 logged
   trials whose recent answers are all correct. Scaling it by evidence — trials
   seen, or recency-weighted trials — would keep the protection where it belongs
   and remove it where it backfires.
2. **Serve an informative item occasionally.** A model that only ever asks
   questions it expects you to get right cannot learn much. Periodically aiming
   *at* the estimate rather than below it — one item in five, say — costs a
   little comfort and buys most of the information. This is the standard
   split between training placement and measurement placement, and the code
   already comments on the distinction in `targetLevel` without acting on it.
3. **Cap the sd growth from consecutive successes**, or floor the aim at its
   own running maximum, so the item never gets easier while you are not getting
   anything wrong.
4. **Prefer answer modes with low guess rates when unsure.** Construction items
   move the estimate more than twice as fast (README §6). If the model wants
   information, it should ask a question whose answer carries some.

---

## Finding 2 — "accuracy around my goal" is the system working

This half is not a defect, and it is worth separating so the fix does not chase
it.

`targetAccuracy = 0.8` means: *choose items you will get right 80% of the time.*
If your long-run accuracy sits at ~80%, the model is hitting its aim exactly.
Difficulty is then stable **by definition** — the equilibrium is the goal, not a
failure to leave it.

What is misleading is the framing. Accuracy is not an input the system reads —
nothing in the live path looks at lifetime accuracy (README §7). It is an
*output*, and the fact that it lands near your target is the evidence that the
model is calibrated.

So "my accuracy is at my goal, therefore I do not advance" has the causation
backwards. You do not advance *because* accuracy is at target; both are
consequences of the model believing your ability has not changed. Finding 1 is
why it can hold that belief through ninety correct answers.

**If you want to advance faster, the honest dial is `targetAccuracy`.** Lowering
it to 0.7 aims higher and makes every answer more informative. It is exposed in
Advanced Options.

---

## Finding 3 — the discrete steps hide small gains

Secondary, but it shapes the feel.

`chooseConfig` treats two configurations within `TOLERANCE = 0.5` levels as
equal and then prefers more rungs and fewer premises. Since a premise is worth
~1.0 level and a rung 0.4–1.0, the estimate must move most of a level before the
*visible* item changes at all. Below that, the entire gain is spent on the clock
— which is the least legible axis and the one a player is least likely to
experience as progress.

Combined with Finding 1, the felt sequence is: a long correct run, no visible
change, a slightly shorter clock, then the clock loosening again.

Worth considering: **announce level movement**, not only configuration changes.
`record` currently emits an event only when premises or rungs change, so an
estimate that moved half a level is silent. A visible number that goes up is
the cheapest possible fix for "I am not advancing", and it is honest — the
number really did move.

---

## What I would measure next

- The same simulation with **`untimed`** set. With the clock unavailable, all
  gains must land on discrete steps, so Finding 3 should be sharply worse.
- The real trial log, if you can export it, rather than a simulated player.
  `fitRungCosts` and `fitWidthCoefficient` already read it, and the same data
  would show whether the observed sd actually grows during real streaks or
  whether the simulation's true-ability assumption flatters the effect.
- Whether `crossModeSd = 2.5` is spreading a streak in one mode across the
  others usefully or diluting it.
