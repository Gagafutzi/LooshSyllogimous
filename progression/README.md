# How progression works

Complete description of what decides the next item's difficulty, written from
the code rather than from intent. Every number here is either a constant you can
find in the source or a measurement from [`simulate.ts`](simulate.ts), which
drives the real functions.

[diagnosis.md](diagnosis.md) is the companion: what this system does that feels
wrong, measured.

---

## The short version

There is **no streak, no accuracy window, and no staircase** in the live path.
There is a **Bayesian estimate of your ability per mode**, and every item is
chosen to sit a fixed distance *below* that estimate.

```
your answers ──► posterior over ability θ  ──► point estimate (mean, sd)
                                                      │
                                   subtract caution ×  sd
                                                      │
                                   subtract the offset for 80% success
                                                      │
                                                  target level
                                                      │
                            chooseConfig: the (premises, rungs, clock)
                            combination closest to that level
```

Difficulty is a single number — **the level**, in units of "linear-equivalent
premises" — and premises, modifiers and the clock are three ways of buying it.

---

## 1. The level: one scale for three axes

[`ability.utils.ts:348`](../src/app/syllogimous/utils/ability.utils.ts) —
`levelOf`:

```
level = weight × premises
      + Σ RUNG_COST[each claimed rung]
      + widthPerBit × widthDelta
      + timeCost(seconds)
```

- **`weight`** is per mode, from `MODE_SCALE` in `calibration.utils.ts`. Roughly
  1 for the linear scales; a mode where one premise is worth more carries more.
- **`RUNG_COST`** is a hand-written table — `meta: 1.0`, `branching: 0.8`,
  `overlap: 0.7`, `negation` and the rest similar — with `0.8` as the fallback
  for anything unlisted. A test forbids the fallback being reached, so every
  live rung has a considered price.
- **`widthPerBit`** is **0 until fitted from your own answers**, and 0 means
  *unpriced*, not free.
- **`timeCost(seconds)`** = `perTimeHalving × log2(referenceSeconds / seconds)`,
  clamped at 0. So halving the clock adds `1.1` levels. `referenceSeconds` is
  replaced per mode by your own median answer time over the last 40 answers in
  that family, so the clock measures *pressure* rather than the presence of a
  number.

The whole point of one scale is that the three axes are **tradeable**: a mode
out of rungs tightens the clock instead of growing, and the difficulty number
says the same thing either way.

## 2. The estimate: a posterior, not a score

[`ability.utils.ts:422`](../src/app/syllogimous/utils/ability.utils.ts).

Ability `θ` is a grid of **80 bins from level 1 to 26**. The app keeps a
log-posterior over that grid, per mode.

**The model of a single answer** — `pCorrect`:

```
P(correct | θ, level, guess) = guess + (1 − guess − lapse) × Φ((θ − level) / slope)
```

with `slope = 1.6` and `lapseRate = 0.03`. So an item exactly at your level is
answered correctly about 73% of the time on a true/false question, and the curve
is gentle — you have to move an item ~1.6 levels to change the odds much.

**`guess` is the item's own guess rate**, not the mode's
(`guessRateFor`): 0.5 for true/false, 1/n for a choice among n, and
`(1/options)^slots` for a construction — as low as **1/729** for a six-axis
build. This matters enormously and is covered in [§6](#6-what-moves-the-estimate-fastest).

**The update** — `abilityUpdate`:

```ts
logPost[i] = logPost[i] * forgetting + log(likelihood)
```

`forgetting = 0.99`. Because the posterior is normalised so its maximum is 0,
multiplying by it *flattens* the posterior a little on every answer. Effective
memory is roughly **1/(1 − forgetting) = 100 answers**, and it is exposed in
Advanced Options as "Recent answers weighed". It was 200; see
[diagnosis.md](diagnosis.md#finding-1b--memory-length-is-the-lever-and-recent-only-breaks-it)
for why 100, and why shorter is not better.

**The point estimate** — `abilityEstimate` — is the posterior **mean** and
**sd**, plus a 90% credible interval.

**Decay** — `abilityDecay` — widens the posterior by `decayPerDay = 0.2` levels
per day away, capped at `maxDecaySd = 3.0`. The **mean is untouched**: a
returning player is re-measured, never demoted.

## 3. Choosing the item

[`progression.service.ts:458`](../src/app/syllogimous/services/progression.service.ts)
— `configFor`. Three subtractions, then a search.

**a. Caution.** `cautious = mean − cautionPenalty(sd, config, answersEverGiven)`.

The penalty is `0.9 × sd`, **bounded at `cautionCap = 0.6` levels**, with the
bound ramping in over the first `cautionCapAfter = 20` answers *across all
modes*. Uncertainty costs difficulty rather than adding it, so a brand-new
player gets easy items instead of mid-range ones on no evidence — and a player
with hundreds of answers is not treated as a brand-new one merely because the
posterior widened. See
[diagnosis.md](diagnosis.md#what-changed) for why it is bounded and what the
bound is worth.

**b. The success-rate offset.** `targetLevel(cautious, targetAccuracy, guess)`
solves `pCorrect` for the level at which you would succeed `targetAccuracy` of
the time. At the default 0.8 with a true/false guess rate this is about
**0.57 levels below** the cautious estimate.

`guess` used to be a hardcoded `0.5`, on the grounds that the answer mode is not
known until the item is built. It is: the answer mode is a *rung*, so the chosen
configuration determines it. `configFor` therefore aims twice — once at 0.5 to
settle the rung count, then again at the guess rate those rungs imply. Without
it a six-axis construction was served at 0.698 success against the 0.80 asked
for, while true/false got 0.838.

**a′. Probes.** One item in `probeEvery` (default 5) is placed to *measure*
rather than to train: it aims at `probeAccuracy` (0.65) instead of the training
target, and **skips caution entirely**. Aiming below on account of uncertainty
is the right instinct while training and precisely wrong while measuring — the
less sure the model is, the more it needs an informative answer. The schedule is
per mode and deterministic, off the mode's own answered count.

**c. `chooseConfig`** ([`ability.utils.ts:661`](../src/app/syllogimous/utils/ability.utils.ts))
enumerates every `(rungs, premises)` pair, computes the clock that would close
the remaining gap, and keeps the best. "Best" is:

```
closest to target        (ties within TOLERANCE = 0.5 levels)
  └─ then more rungs
       └─ then closer to target again
            └─ then fewer premises
```

Two structural rules:
- Rungs are always a **prefix** of the mode's ladder — you cannot have rung 3
  without 1 and 2.
- Past `structureBefore = 5` premises, **length may only rise if the ladder is
  exhausted**. Adding length when structure is available is not progress.

The clock can only *add* difficulty. A configuration already at or past the
target gets **no clock at all**.

## 4. Recording an answer

[`progression.service.ts:707`](../src/app/syllogimous/services/progression.service.ts)
— `record`.

1. The item is scored at the level it **actually came out at**, including its
   measured width — not at the level it was asked to be.
2. The **residual** `correct − expected` is pushed to the fatigue window, using
   the estimate the item was *chosen* under, before any update.
3. The trial is logged (up to 1500) for the rung-cost and width fits.
4. **If a slump is already detected and `pauseWhenTired` is on, the posterior
   does not move at all.** The trial still enters the window, which is what lets
   the slump end.
5. Otherwise: decay, then `abilityUpdate`.
6. Events (`rung-up`, `premise-up`, …) are emitted only if the *chosen
   configuration* changed — not if the estimate merely moved.

## 4b. Which modes exist at all

Separate from difficulty, and it used to be decided by something incommensurate
with it.

`TIERS_MATRIX` has one row per unlock step and one column per mode. The row was
picked by the **tier**, and the tier by the **score** — which is two different
quantities depending on a setting:

- **derived** (default): the ability estimate × 100, so it stops at 2600;
- **accumulated**: unbounded, and a measure of how much you have played.

Both were compared against thresholds written for the second. Under the derived
score, Space 3D wanted 1250 points — meaning level 12.5 — and only 11 of the 25
tiers were reachable at all, since the ceiling is 2600.

**The row now comes from ability**, in the units the ability model already uses:

```
level = max(aggregate across modes, best single mode)
row   = the highest threshold in TIER_UNLOCK_LEVELS that level clears
        (forced to the top if any mode has run out entirely)
```

`TIER_UNLOCK_LEVELS` is `[0, 3, 4, 5, 6, 7, 8]`, giving 4 modes at the start,
rising to all 33 by level 8. Deliberately low: the gate exists so a first
session is not thirty-three modes at once, not to be a months-long treadmill,
and a mode opened early is not an unfair one because `priorForNewMode` places it
against what the player has already shown.

Two rules carry the weight:

- **The best evidence, not the average.** A player deep in one mode has
  demonstrated that much reasoning, and gating on their average is backwards
  twice over — it withholds the modes that would raise the average, and it makes
  breadth a prerequisite for depth in an app that measures depth.
- **Anything exhausted forces a full unlock.** Every rung claimed and the
  premise ceiling reached means there is nothing left to serve there, and a
  pacing system that responds to that with nothing new is not pacing anything.

The **tier badge still comes from the score**. A name is flavour; withholding
content is not.

## 5. Fatigue

`observed − predicted` averaged over the last `fatigueWindow` answers. Past
`fatigueThreshold` below zero it reports `tired`, and with `pauseWhenTired` the
posterior stops moving. Minimum half a window before it will fire. Survives a
reload. Shown in Advanced Options rather than acting silently.

## 6. What moves the estimate fastest

The single most consequential fact about this model, and the least visible one:

| answer mode | guess rate | information in one correct answer |
|---|---|---|
| true/false | 0.5 | very little |
| choice of 4 | 0.25 | ~2× a true/false |
| construct, 6 axes | 1/729 | decisive |

Measured (`simulate.ts`, settled player at level 8.00, sd 0.35):

| 30 consecutive correct | resulting mean | sd |
|---|---|---|
| on true/false items | 8.46 | 0.37 |
| on construct items (guess 1/729) | **9.14** | 0.66 |

Same thirty answers, more than **twice** the movement. A correct true/false
answer is barely evidence: half of them are available for free.

## 7. Everything that is *not* used

Worth stating, because the names survive and mislead.

- **`LadderState` / `update()` in `progression.utils.ts`** — the rolling window,
  `targetAccuracy` staircase, `demotionAccuracy`, `windowSize`, `fastFraction`,
  `shrink`, `promotionSeconds`, `floorSeconds`. This is the **old** state
  machine. `configFor` does not call it. Of `ProgressionConfig`, the live path
  reads only `targetAccuracy`, `structureBefore`, `floorSeconds`/`ceilingSeconds`
  (as clock bounds), `crossModeSd` and `decayPerDay`.
- **Streaks.** Nothing counts consecutive correct answers. A 90-streak is 90
  independent likelihood updates.
- **Total accuracy.** Nothing reads lifetime accuracy. What *looks* like it is
  the equilibrium described in [diagnosis.md](diagnosis.md).

## 8. The dials, and where they live

| dial | default | effect |
|---|---|---|
| `targetAccuracy` | 0.80 | how far below your estimate items sit |
| `caution` | 0.9 sd | how much uncertainty lowers the aim |
| `cautionCap` | 0.6 | most levels uncertainty may ever cost |
| `cautionCapAfter` | 20 | answers before the cap is fully in force |
| `slope` | 1.6 | how sharply difficulty changes success odds |
| `memoryAnswers` | 100 | how much recent play outweighs history |
| `lapseRate` | 0.03 | errors independent of difficulty |
| `crossModeSd` | 2.5 | how much one mode says about another |
| `decayPerDay` | 0.2 | posterior widening per idle day |
| `probeEvery` | 5 | one item in five measures instead of training |
| `probeAccuracy` | 0.65 | what a probe aims for |
| `structureBefore` | 5 | premise count past which length needs an exhausted ladder |
| `TOLERANCE` | 0.5 | level difference treated as a tie |
| `perTimeHalving` | 1.1 | levels per halving of the clock |

`caution`, `slope`, `lapseRate` and `TOLERANCE` are **not user-tunable** — they
are constants in the source. `memoryAnswers` is, and is the one worth reaching
for if progression feels slow.
