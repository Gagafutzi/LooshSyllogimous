# Why it feels slow

> **Status:** two fixes shipped, one of this document's own recommendations
> measured and withdrawn, and six findings still open. See
> [What changed](#what-changed) at the bottom.

**The single mechanism behind most of this.** Five of the eight findings are the
same fault wearing different clothes: the aim is `mean − 0.9 × sd`, so
**anything that widens the posterior lowers the difficulty served**. A streak
widens it (1). Time away widens it (6). A cross-mode prior is born wide (7). In
each case the model responds to *not being sure you are still good* by assuming
you are worse — and then serves items so easy that it learns nothing, which
keeps it unsure. Caution was written for a player about whom nothing is known,
and it fires hardest for players about whom a great deal is known.


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

1. **~~Make caution one-sided.~~ Measured, and it is not the lever.** This was
   the top recommendation here and it was wrong. Scaling caution by evidence, or
   removing it outright, changes tracking speed **barely at all** — and at the
   old memory length it made things *worse*:

   | caution | answers to track a real +4 improvement (memory 200) | (memory 100) |
   |---|---|---|
   | flat 0.9 (shipped) | 168 | 67 |
   | decaying over 30 trials | 223 | 61 |
   | decaying over 60 trials | 203 | 60 |
   | off entirely | 218 | 57 |

   Caution only dominated in the *forced-streak* simulation, and a forced streak
   is data no real player produces — ninety correct answers regardless of
   difficulty. Against a player who genuinely improves, the memory length is the
   whole story. Recorded rather than deleted because the reasoning looked sound
   and the measurement is the only thing that settled it.
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

## Finding 1b — memory length is the lever, and "recent only" breaks it

A player of true ability 8 answers 200 items, then genuinely improves to 12.
How long before the model believes it?

| effective memory | settled estimate | answers to track the +4 jump | drift while steady |
|---|---|---|---|
| 200 answers (was shipped) | 8.30 / 0.36 | **168** | 0.38 |
| **100 answers (now shipped)** | 8.38 / 0.47 | **67** | 0.69 |
| 50 answers | 10.18 / 4.40 | 6 | 5.09 |
| 20 answers | 11.06 / 5.34 | 1 | 8.05 |

Two hundred answers of memory meant **168 answers to notice a real
improvement** — most of a month of play. That is the complaint, quantified.

But "reference recent history only" is not the fix either. Below about a
hundred the estimate stops being an estimate: at 50 it settles at 10.18 when
the truth is 8, with an sd of 4.40, and wanders five levels while nothing is
changing. Worse, that width feeds straight into the caution term, which reads
it as a reason to serve *easier* items — so a very short memory reproduces
Finding 1 permanently rather than fixing it.

**A hundred is the shortest memory that still measures anything**, and it is two
and a half times more responsive than what shipped before.

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

## Finding 4 — the tie-break handed every rung-less mode a permanent handicap

Found while testing the memory change, and independent of it.

`chooseConfig` treats candidates within `TOLERANCE = 0.5` levels as tied, then
prefers **more rungs**, then **fewer premises**. The second preference exists to
stop length standing in for structure. But it is only reached when the rung
counts are *equal* — and between two candidates with the same rungs there is no
structure to prefer. One is simply easier.

For a mode with an empty or exhausted ladder, length is the only axis, so the
rule fired on every choice it ever made and always took the easier option.

Measured on Infer the Relation, which has no ladder at all, with a player of
true ability 16:

| | premises | item level | P(correct) |
|---|---|---|---|
| before | 6 of 8 | 13.20 | **0.951** |
| after | 7 of 8 | 15.40 | **0.804** |

The target is 0.8. It was serving items the player got right 95% of the time and
could not be stretched, with two premises of headroom unused. Worth up to half a
level of permanent handicap on every mode with no rungs.

Fixed: with equal rungs, take the candidate closer to target.

---

## Finding 5 — the aim is computed for a guess rate most items do not have

`configFor` calls `targetLevel(cautious, targetAccuracy, 0.5, cfg)`. The `0.5`
is hardcoded, and the code says why: the answer mode is not known until the item
is built, so the target is computed at the **easiest guess rate the mode could
serve**. The item then arrives with whatever guess rate it actually has.

Player measured at level 10.0, target accuracy 0.80, aim computed at 9.07:

| the item turns out to be | guess rate | actual P(correct) | vs the 0.80 wanted |
|---|---|---|---|
| true/false | 0.5 | 0.838 | **+0.038** too easy |
| choice of 4 | 0.25 | 0.767 | −0.033 |
| construct, 3 axes | 0.037 | 0.708 | −0.092 |
| construct, 6 axes | 0.0014 | 0.698 | **−0.102** too hard |

A **14-point spread** across answer modes, and the target is only hit for
true/false. Construction — the mode the app most wants you to reach, and the
one whose whole justification is that it removes the guess floor — is served
ten points harder than asked for. It will feel disproportionately punishing, and
that is not a difficulty judgement anyone made; it is a placeholder.

**Fix.** The guess rate is knowable before the item is built: `chooseConfig`
already decides the rung count, and `construct-conclusion` / `choose-conclusion`
are rungs. Deciding the answer mode first and passing its real guess rate into
`targetLevel` costs nothing and removes the spread. Failing that, correcting
after the fact — re-aim once the mode is known — is strictly better than 0.5.

---

## Finding 6 — decay does demote, despite the comment saying it does not

`abilityDecay` widens the posterior and leaves the mean alone. Its comment:

> Nothing is taken away and no rung is un-claimed — the estimate simply becomes
> less certain… A player returning after a month is re-measured rather than
> demoted, which is both kinder and more accurate.

The mean really is preserved. But the *aim* is `mean − 0.9 × sd`, and decay is
an increase in `sd`. Measured, player settled at true ability 10:

| days away | mean | sd | aim | item actually served |
|---|---|---|---|---|
| 0 | 9.97 | 0.42 | 9.59 | 4p **6 rungs** 46 s — level 9.02 |
| 3 | 9.97 | 0.73 | 9.31 | 4p 6 rungs 55 s — level 8.74 |
| 7 | 9.97 | 1.45 | 8.66 | 4p **5 rungs** 32 s — level 8.10 |
| 15 | 9.98 | 2.99 | 7.28 | 4p 5 rungs **no clock** — level **7.10** |
| 30 | 9.98 | 2.99 | 7.28 | 4p 5 rungs no clock — level 7.10 |

Two weeks away costs **a rung, the entire clock, and 1.9 levels** of served
difficulty. A rung *is* un-claimed in the only sense the player can observe.

The comment is not wrong about `abilityDecay` — it is wrong about the system,
because it was written about the function rather than about what the function
feeds. This is the same mechanism as [Finding 1](#finding-1--a-streak-makes-the-model-less-sure-and-the-aim-goes-down):
caution turns uncertainty into difficulty loss, and everything that widens the
posterior therefore demotes.

**Fix.** Either say so honestly in the comment and the UI, or cap how much of
the caution term decay is allowed to feed — the estimate is uncertain about
*whether you are still this good*, which is a reason to re-measure quickly, not
a reason to serve two levels below a mean nobody has contradicted.

---

## Finding 7 — a new mode starts four levels too easy for a measured player

Cross-mode transfer is the thing `crossModeSd = 2.5` governs, and the **mean
transfers well**. A player measured at 14.36 across four modes, opening three
modes they have never played:

| fresh mode | prior estimate | item served | P(correct) for that player |
|---|---|---|---|
| Space 4D | 14.81 / **2.50** | 4p 5r | **0.963** |
| Syllogism | 14.81 / **2.50** | 7p 3r | **0.951** |
| Knights and Knaves | 14.81 / **2.50** | 5p 2r | **0.954** |

The prior mean is excellent — 14.81 against a measured 14.36. Then `caution ×
sd` = `0.9 × 2.50` = **2.25 levels** is subtracted, and the served item lands at
95% success instead of 80%.

So transfer works and is then thrown away. And it is thrown away into exactly
the regime of [Finding 1](#finding-1--a-streak-makes-the-model-less-sure-and-the-aim-goes-down):
items far below ability, correct answers carrying almost no information, so the
recovery is slow. Every mode a tier unlocks starts here. If progression feels
slow specifically after new modes appear, this is why.

**Fix.** The prior's width is a statement about *transfer*, not about this
player's evidence — and it is a width the model chose, not one the data forced.
Caution exists for a player about whom nothing is known; a player with 600
logged answers is not that player. Scaling caution by evidence does almost
nothing for [Finding 1](#finding-1--a-streak-makes-the-model-less-sure-and-the-aim-goes-down)
(measured above) but it is exactly right here, where the width comes from a
prior rather than from disagreement in the data.

---

## Finding 8 — ~~rung costs disagree with the ladder order~~ withdrawn, mostly

**The claim was wrong.** This section said `circular` (1.2) before `circular-2`
(0.8) "cannot be right, a second looping axis is not easier than the first", and
proposed fixing the table. Reading the neighbouring entries settles it:

```
"transform-1": 1.5,
"transform-2": 1.2,
```

These are **marginal** costs, not totals. Rungs are claimed as a prefix, so
holding `circular-2` means holding `circular` too and the item carries
1.2 + 0.8 = 2.0. The second loop *is* a smaller addition than the first, because
by then you know what a looping axis is. The totals are monotonic — every cost
is non-negative — so there is no inversion and nothing to fix.

Two things survive from the original section, both weaker than what was claimed:

- **The steps are uneven**, from 0.4 (`incorrect-directions`) to 2.6
  (`testimony`), against a psychometric slope of 1.6. A single rung can move
  P(correct) by anything from five points to thirty. That is a granularity
  problem and it compounds [Finding 3](#finding-3--the-discrete-steps-hide-small-gains),
  but it is not a wrongness problem.
- **The costs are hand-written and meant to be measured.** `fitRungCosts` reads
  the trial log and exists precisely to replace them. Checking the table against
  a fit is still worth doing — as measurement, not as bug-fixing.

Recorded rather than deleted, for the same reason the caution recommendation in
[Finding 1](#finding-1--a-streak-makes-the-model-less-sure-and-the-aim-goes-down)
is: the reasoning looked sound, and only reading the adjacent lines settled it.

---

## What changed

**Shipped, in two passes.**

| | change | effect |
|---|---|---|
| 1b | memory 200 → 100 answers, and a dial | tracking a real +4 gain: 168 → 67 answers |
| 4 | equal rungs take the closer item, not the shorter | Infer the Relation: 0.951 → 0.804 success |
| 6, 7 | **caution penalty bounded at 0.6 levels**, ramped in over the first 20 answers anywhere | 15 days idle: served level 7.10 → 9.13. Fresh mode for a measured player: 0.956 → 0.87 |
| 5 | **the aim is re-computed once the answer mode is known** | construction is no longer targeted as though it were true/false |

The caution bound is the load-bearing one, because it is the single mechanism
behind Findings 1, 6 and 7. It keeps the idea — an unmeasured player is not
handed a mid-range item — and removes the part that was a demotion in all but
name. Measured across every failure case:

| policy | steady accuracy | track +4 | after 15 days | fresh mode |
|---|---|---|---|---|
| was: 0.9 × sd, unbounded | 0.880 | 80 | 7.10 | 0.956 |
| **now: bounded, ramped** | 0.860 | 71 | 9.13 | 0.87 |
| bounded with no ramp | 0.860 | 64 | 9.17 | 0.876 |
| no caution at all | 0.828 | 75 | 9.99 | 0.804 |

The ramp costs a little on every column and buys one thing: a brand-new account
still opens at two premises and **no rungs**. Without it the first item of a new
account carried a modifier, which is exactly what caution was written to prevent
— caught by an existing test, not by this table.

**Two of this document's own recommendations were withdrawn** after measurement
or closer reading: evidence-scaled caution as the fix for Finding 1, and the
rung-cost inversion in Finding 8. Both are kept above rather than deleted.

**A test defect surfaced too.** `width.test.ts` computed its simulated item
level with `rungs: []` while `configFor` was free to claim some, so the item was
easier than the model scored it. It only stayed hidden while caution kept the
chosen configuration rung-free; with the bound in place the estimate ran to the
top of the grid. Now honours the chosen rungs.

**Finding 1's root is now addressed too.** One item in five is a **probe**: it
aims at 0.65 success instead of 0.80 and skips caution entirely, because aiming
below on account of uncertainty is the right instinct while training and
precisely wrong while measuring. Measured through the real service over 300
answers at a true ability of 10:

| | overall accuracy | probe accuracy | estimate | sd | promotions announced |
|---|---|---|---|---|---|
| probes off | 0.860 | — | 9.93 | 0.46 | 20 |
| **one in five** | **0.823** | 0.704 | 9.97 | 0.44 | 20 |

**The prediction was wrong about why it helps.** I expected faster tracking of a
genuine improvement; measured, tracking barely moves. What probes actually buy
is **calibration** — the served accuracy comes down to the 0.80 the system says
it is aiming for, from a 6-point overshoot, and in the earlier bench the
estimate's error at steady state nearly halved (0.53 → 0.31). The system was
missing its own stated target, and probes are what make it hit it.

Frequency matters more than placement. One in three is much worse (steady
accuracy 0.767, tracking three times slower) — too many hard items destabilise
the estimate rather than sharpening it. One in eight leaves the overshoot. And
because the configuration is discrete, aiming a probe at 0.50 and at 0.70
usually selects the same item, so the exact figure matters less than the rate.

Identical promotion counts with and without probes, which is the check that the
schedule is not leaking into the announcements: the probe flag flips on the very
answer whose events are reported, so reading it twice would announce a rung-up
every fifth item and a rung-down on the sixth.

**Still open: Findings 2 (by design) and 3, and the measurement half of 8.**

## What I would measure next

- The same simulation with **`untimed`** set. With the clock unavailable, all
  gains must land on discrete steps, so Finding 3 should be sharply worse.
- The real trial log, if you can export it, rather than a simulated player.
  `fitRungCosts` and `fitWidthCoefficient` already read it, and the same data
  would show whether the observed sd actually grows during real streaks or
  whether the simulation's true-ability assumption flatters the effect.
- Whether `crossModeSd = 2.5` is spreading a streak in one mode across the
  others usefully or diluting it.
