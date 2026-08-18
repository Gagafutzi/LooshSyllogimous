# Superseded

Kept because they explain *what was replaced and why*, which is the part that
stops an old idea being reintroduced. None of it describes the current system.

**The fluid progression design** — the three-axis staircase, its sawtooth, its
step-size derivation and its `LadderState` — was replaced wholesale by
[4.0](done.md#40-one-ability-estimate--done-utilsabilityutilsts). One latent, one
posterior per mode, and the axis ordering became a tie-break rather than a rule.

**The original phase plan** — Phases 1, 2, 2.5 and 3, plus the suggested order
and build order derived from them. Most items are done and have their own entry
above. Two are not, and are the reason this is kept rather than deleted:
**Relational Web** (2.1, the "marquee feature", never built) and **Facing Space**
(2.2, which is the same proposal as P1 — it was specced twice, years apart,
without either noticing the other).

### The problem with what exists

v4 already adapts per mode via **training units**
(`progress-and-performance.service.ts`): each type keeps `premises / right /
wrong / timeout`, and after `trainingUnitLength` trials the premise count moves
up or down against accuracy thresholds. Two things make that feel abrupt:

- **Premise count is the only dial.** Going 4 → 5 premises is a large jump in
  working-memory load. There is nothing between "comfortable" and "overloaded".
- **Time is fixed.** The countdown is a setting, not a difficulty axis, so the
  system cannot apply pressure without adding material.

The modifiers that *would* give finer steps — negation, meta, transformation
depth — are global on/off switches unrelated to progression.


### Three axes, three granularities

Difficulty moves along the finest axis available, and only escalates to a
coarser one when the finer is exhausted:

| Axis | Granularity | Moves |
|---|---|---|
| **Time limit** | continuous | every trial |
| **Modifiers** (negation, meta, transform depth) | small discrete | at a promotion, if rungs remain |
| **Premise count** | large discrete | only when all rungs are claimed |


### The sawtooth

```
time
 ▲
 │╲        ╲        ╲
 │ ╲        ╲        ╲          each fall = getting faster
 │  ╲___     ╲___     ╲___      each jump = a promotion
 └────────────────────────► trials
      ↑        ↑        ↑
   rung 1   rung 2   premises+1
```

1. Start at `ceilingSeconds`, minimum premises, no modifiers.
2. Correct answers shrink the limit; errors and timeouts grow it.
3. When the limit reaches `promotionSeconds` **and** rolling accuracy ≥ target:
   claim the next **rung** if any remain, otherwise **premises += 1** and reset
   rungs. Either way the limit resets toward the ceiling.
4. If accuracy collapses near the ceiling, unclaim a rung, or drop a premise
   when none are claimed.

This is what makes "premise ups at 20s" work: `promotionSeconds` is user-set, so
a player chooses the speed they must reach before taking on more material.


### Staircase step sizes are not arbitrary

An asymmetric up/down staircase converges on a known accuracy. For target `p`:

```
shrink / grow = (1 - p) / p
```

so `p = 0.8` ⇒ grow is 4× shrink. **Set the ratio from the target accuracy
rather than hand-tuning two numbers** — otherwise the system silently converges
somewhere the player never asked for. Suggested defaults: `shrink = 3%`,
`grow = 12%`, `p = 0.8`.

Timeouts should grow harder than wrong answers (say 1.5×): a timeout means the
limit itself was the binding constraint, a wrong answer may not be.


### Data model

Extend `ITrainingUnit` rather than introducing a parallel store — the existing
right/wrong/timeout counters and up/down thresholds already work.

```ts
interface ITrainingUnit {
    premises: number;
    right: number; wrong: number; timeout: number;   // existing
    timeLimit: number;      // seconds, the continuous axis
    rungs: string[];        // claimed modifier ids, in order
    recent: boolean[];      // rolling window for accuracy
}
```

Config (per profile, not per mode):

```ts
{
    ceilingSeconds: 90,     // reset point after a promotion
    promotionSeconds: 20,   // user's "premise up at" threshold
    floorSeconds: 8,        // never shrink below this
    targetAccuracy: 0.8,    // derives the shrink/grow ratio
    windowSize: 10,         // trials in the rolling window
    enabled: false,         // opt-in; tier behaviour unchanged when off
}
```


### Integration points

- `GameService.settings` already applies `SettingsOverrideService`; the ladder
  becomes a second layer applied after it, so precedence is explicit:
  **tier → user overrides → progression**.
- The countdown comes from `GameTimerService.start(seconds)`, already
  parameterised — the ladder just supplies the number.
- Modifiers are `settings.enabled.*` flags plus per-mode numeric settings, which
  the ladder writes the same way overrides do.
- Answer results already flow through `updateTrainingUnit`; the ladder update
  hooks there so nothing new needs to observe the game loop.


### Risks worth designing around

- **Fast-and-wrong.** Shrinking on any correct answer rewards guessing on a
  binary question. Require the answer to be both correct *and* faster than a
  fraction of the limit before shrinking.
- **Ratcheting on a bad day.** Cap demotions per session so one poor run does not
  undo weeks.
- **Mode starvation.** Per-mode ladders mean rarely-played modes stay easy; the
  weighted sampler should favour modes whose ladder is behind.
- **Timeouts as data.** A timeout is not a wrong answer — record it separately in
  the rolling window or accuracy will read low for a purely speed-driven failure.


### Suggested order

1. **1.3** presentation modifiers — warm-up, proves the port path works
2. **1.1 + 1.2** transformations and anchors — the stated main gap
3. **3.1** verification layer — do this *before* the hard new modes, so Relational
   Web and Facing Space get checked as they are written
4. **2.1** Relational Web — highest visible value
5. **2.2 / 2.3** Facing Space, then N-D space
6. **2.4** smaller features, **3.2–3.5** the genuinely novel structures

Rationale for putting 3.1 third: every mode after it is a generator that can be
silently wrong. Building the checker first means the expensive modes are verified
by construction instead of debugged by hand.


### Build order

1. **DONE — `utils/progression.utils.ts`.** Pure state machine: config, ladder
   state, `update()`, and the per-family rung tables. No Angular, no storage, so
   it is verifiable in isolation.

   Verified by simulation, not just assertion — a player with a soft speed
   threshold was run 20k trials against the staircase:

   - step ratio holds `shrink * p == grow * (1 - p)` across target accuracies
   - convergence: target 0.70 → observed 0.733, target 0.80 → observed 0.821
   - promotion claims `rung, rung, premise`; a ladderless mode goes straight to
     premises; a premise-up resets rungs
   - demotion pops `rung, rung, premise` and never passes the minimum
   - clamps hold, and 5000 coin-flip guesses leave the limit at the ceiling
     rather than dragging it to the floor — the "comfortable win" guard works

   Still to wire: reading/writing this state on `ITrainingUnit`, which is step 2
   territory since it needs the timer feeding `answerSeconds` back in.

   **Sawtooth observed** (Diagnostics → Progression simulation). Driving the real
   service with a synthetic player produced three full cycles: time falls, a rung
   is claimed and the clock resets, the second rung follows, then premises rise
   and the rungs clear so the ladder is re-walked at the new size.

   | trial | premises | secs | event |
   |---|---|---|---|
   | 17 | 2 | 60 | rung-up (negation) |
   | 25 | 2 | 60 | rung-up (meta) |
   | 44 | 3 | 60 | premise-up, rungs reset |
   | 85 | 4 | 60 | premise-up, rungs reset |

   The simulation restores the ladder afterwards, so running it never costs real
   progress — it substitutes only the human, keeping the same service, config and
   persistence. Driving the browser UI for 120 questions had repeatedly failed;
   going through the service directly was both cheaper and stronger evidence.
2. Wire the time limit into `GameTimerService`.
3. Rung ladders per mode family, starting with negation/meta which already exist.
4. Progression panel in the drawer: current premises, time limit, claimed rungs,
   and the thresholds as inputs.
5. Only then transform depth as a rung, since that needs the depth setting
   exposed per mode first.


### Phase 1 — Ports from v3 (cheap, source exists)

#### 1.1 Transformations — **DONE** (core), `utils/transformations.utils.ts`

Ported the four operations as pure coordinate maps (mirror / set / scale / rotate),
plus `replay()` for exact verification. New `Transformation` question type:
layout premises fix a starting arrangement, transform premises mutate it, the
conclusion is about the final state.

Verified: mirror is involutive, `rotate⁴` = identity, `rotate²` = point
reflection, cw/ccw cancel, ops touch only their own axis, `replay` matches
stepwise application and never mutates its input. Generator: 5100 items over
premise counts 4–20, exact premise counts, ~49% true.

Two things fell out of this that were **not** in the original plan:

- `canGenerateQuestion` gates non-basic types behind "two basic types enabled",
  because Analogy and Binary *compose* other questions. Graph Matching was
  exempted by name. Transformation and Deictic are equally self-contained, so
  they are now in a `SELF_CONTAINED_TYPES` set. **Deictic was silently affected
  by this too** — it could not generate with few basic types enabled.
- Still deliberately **not** ported: v3's `createChains` / `directionize`
  heuristics, which pick *which* dimension to transform along by measuring
  accumulated shift per axis. The current generator picks dimensions uniformly.
  That is the remaining fidelity gap; it affects item texture, not correctness.

Original v3 notes retained below for that remaining work.

#### 1.1a Chain heuristics (remaining, `space-hard-mode.js`)
The main content gap. Words hold N-dimensional coordinates; transformations
mutate them along dimension *chains*, then the conclusion is re-derived from the
mutated map. Difficulty comes from tracking mutation, not from chaining premises.

- Bridge v3's `wordCoordMap` (`{word: [x,y,z]}`) to v4's
  `coords3D: [string, number, number, number][]`. Write the adapter both ways and
  unit-test the round trip before touching generation.
- Port `applyHardMode` / `createChains` / `applyChain` / `oneTransform`.
- Keep v3's retry loop: it rejects transforms where the conclusion coord goes
  all-zero, enforces a distance limit, and demands the conclusion actually
  *changed* (`demandChange`). Those guards are why its items are non-degenerate —
  do not drop them.
- Expose depth as a setting: wire `numTransforms` into the Advanced Options page
  (the surface already exists).

#### 1.2 Anchor Space — **DONE**, `utils/anchor.utils.ts`

The plan called this a port. It was mostly not one, and the correction is worth
recording:

- `anchors.js` holds **only** SVG shapes — no mode logic — and runs
  `document.getElementById(...)` at import time, so it cannot be imported as-is.
- The actual mode is `new DirectionQuestion(new Direction2D(false, true))`: Anchor
  Space is **2D direction with a flag**, not a separate generator. The flag's only
  real effect is `createWordMapAnchor`, which seeds the coordinate map with four
  fixed markers in a diamond (star `[0,1]`, circle `[1,0]`, triangle `[-1,0]`,
  heart `[0,-1]`) and builds objects onto that frame.

Implemented as a standalone type rather than a flag on v4's `createDirection`,
which keeps v4's 700-line direction generator untouched. Objects are each pinned
to one marker; a queried pair anchored to the *same* marker is rejected, since
those compare directly without using the frame.

Reuses `describeOffset` / `describeConclusion` from transformations.utils — they
walk the coordinate length, so 2-element coords yield only east/west and
north/south wording. Verified: 5400 items, premise counts exact, anchors provably
never move, every premise references a marker, ~51% true.

**Anchor Space v2 — DONE.** Composes 1.1 and 1.2: the frame is stated first, then
transforms mutate the objects measured against it. Markers are eligible as
*pivots* but never as movers, which is the literal reading of the snapshot
tooltip ("keeps anchor markers fixed during transforms") and what makes the frame
worth having — a reference point that itself moved would invalidate every premise
stated against it.

Verified: 5400 items, premise counts exact, anchors provably never displaced,
never selected as a mover, ~41% of transforms pivot on a marker, ~49% true. Also
carries the "transforms must change the queried pair" guard, so no item is
answerable from the layout premises alone.

#### 1.3 Presentation modifiers (small, independent)
`premise-reorder.js`, `wide-premises.js`, `visual-noise.js`,
`incorrect-directions.js`, `junk-emojis.js`. Each is a display/stimulus modifier
rather than a mode — cheap wins that add snapshot parity.

**DONE — visual noise** (`utils/visual-noise.utils.ts`). Ported the seeded LCG and
recursive rectangle splitter; hooked into `getSymbols`, which is the single
stimulus chokepoint, and exposed as a flag on the Advanced Options page.

Port notes for the remaining four:

- `getSymbols` in `utils/question.utils.ts` is the **only** place stimuli come
  from. Any new stimulus kind is one branch there plus a flag in
  `DEFAULT_ENABLED_FLAGS`, the `setEnable` union, and the override service.
- Keep generation **seeded and deterministic**. Stored history re-renders from
  the saved question, so a stimulus that regenerates randomly will not match what
  the user originally saw.
- v3's colour formula (`lightness = 10 + rand*91`) can emit 100% lightness —
  pure white, invisible on light themes. Clamped to 18–82% here. Expect similar
  contrast bugs in the other stimulus ports; the Vercel build's "Adaptive
  Symbols" changelog entry exists for exactly this reason.


### Phase 2 — Vercel-unique, must be written (no source anywhere)

#### 2.1 Relational Web — **BUILT**
Spec recovered from the snapshot:

- Settings: nodes 3–12 (default 7), time, priority %, colored nodes 2–12
  (default 2), role difficulty (`adaptive` | `degree cues` | `structural`),
  trial type (`mapping` | `comparison` | `properties` | `mixed`).
- Description: *match highlighted nodes across procedurally rearranged isomorphic
  directed webs; structural trials remove position and degree shortcuts.*
- Properties legend: Reflexivity, Irreflexivity, Symmetry, Antisymmetry,
  Asymmetry, Transitivity.
- Property-categories rule: TRUE when **both** graphs satisfy the named property
  **or both** violate it.

Implementation:

1. Random directed graph `G` on n nodes. Build `G' = π(G)` for a random
   permutation π, then lay it out with fresh random positions — isomorphic by
   construction, visually unrecognisable.
2. **Mapping trial:** highlight node `v` in `G`; ask which node of `G'` matches.
   Answer is `π(v)`.
3. **The correctness trap:** if `Aut(G)` is nontrivial and `v` sits in an orbit of
   size > 1, several answers are equally valid and the item is broken. Either
   require `v`'s orbit to be a singleton, or accept the whole orbit. Compute
   automorphisms by backtracking with colour-refinement pruning — trivial at
   n ≤ 12.
4. **Difficulty knob:** `degree cues` lets in/out-degree identify the match.
   `structural` requires `v` to share its degree signature (and ideally its
   1-WL colour) with another node, so only deeper structure disambiguates.
5. **Comparison trial:** show two graphs, ask whether isomorphic. Generate
   near-misses by a 2-swap rewire that preserves the degree sequence but changes
   the refinement classes — otherwise "count the degrees" solves it.
6. **Properties trial:** properties are one-liners on the adjacency matrix.
   Evaluate on both graphs and apply the both-satisfy-or-both-violate rule.
7. **Rendering:** new Angular component, SVG, arrows for direction, self-loops for
   reflexivity. This is the only item here needing real new UI.

**Built, and two things the spec had slightly wrong.**

*Colour refinement has to be canonically numbered.* The obvious implementation
assigns colour indices in encounter order, which makes a node's colour depend on
where it sits in the array — so two relabellings of one graph get different
numbers and the isomorphism search, which prunes on colour equality across the
pair, rejects every valid mapping. The symptom was that no graph was isomorphic
to itself relabelled. Renumbering by sorted signature each round fixes it, and
it is the only subtle thing in the file.

*The `structural` difficulty cannot ask for a refinement twin.* The spec says v
should share "its degree signature (and ideally its 1-WL colour)" with another
node. On graphs this small refinement is essentially complete, so two nodes of
the same colour share an **orbit** — and a node in a shared orbit has no unique
answer, which is the one thing a mapping item may not have. Asking for a
refinement twin asks for an item that cannot exist. A degree twin is the version
that both exists and does the job: arrow counts stop identifying the node while
refinement still separates it.

The orbit check itself is not an optimisation but the correctness condition, and
is tested directly and again through the generator on the graphs it produces.

#### 2.2 Facing Space
Snapshot: *"position + facing + turns + rotations around pivots."* Each object has
position **and** a facing; relations are egocentric ("to A's left" means left of
A's facing, not absolute). Convert by rotating the world→object vector by −facing.
Genuinely perspective-taking, and it composes with the Deictic mode already built.

#### 2.3 Space 4D / 5D / 6D
Snapshot names the axes: 4D adds a dimension, 5D adds Quantity, 6D adds
Membership. Requires rewriting `createDirection3D` (275 lines, hardcoded to three
axes, cardinal maps, `Math.cbrt`, fixed 4-tuples) as a dimension-parameterised
generator plus a general `coordsND` field. Biggest refactor here; also unlocks the
snapshot's "Height Levels 3D–6D" (adaptive, or force 2–5 levels).

#### 2.4 Smaller Vercel features
- **Multiple Conclusions / Conclusions by Mode** — `Question.conclusion` is already
  `string | string[]`; needs answer UI and a per-mode count setting.
- **Relation Gaps** — show relation cues briefly, then mask. Working-memory load.
- **Connection Branching** — premise graph branches instead of forming one chain.
- **Priority weights** — snapshot has a priority % per mode; v4 picks uniformly
  within groups. Replace with weighted sampling.
- **Adaptive symbols** — contrast-aware stimulus colouring against the active
  background (the snapshot computes contrast ratios per symbol).
- **Set Hierarchy syllogism** — quantified set logic (All/No/Some/Some-not) over
  connected proof networks where every premise is load-bearing.


### Phase 2.5 — Answer modes (new)

Everything so far varies the *item*. These vary how the player **responds**,
which is a difficulty axis nothing else touches.

#### 2.5a Multiple conclusions

Several conclusions per item, each judged separately. `Question.conclusion` is
already typed `string | string[]`, so the model needs no change — the work is the
answer UI, a per-mode count, and a scoring rule.

- **Per-mode count**, as the snapshot has ("Conclusions by Mode"), with a global
  default. Two conclusions over five premises is a different load from one.
- **Scoring.** All-or-nothing is harsh and makes partial knowledge worthless;
  per-conclusion credit is fairer but lets a guesser bank half. Suggest
  per-conclusion credit for stats, all-or-nothing for the progression outcome,
  so the ladder is not fed a stream of half-successes.
- **Generation.** Conclusions must be independent — several restatements of the
  same relation is one question asked twice. Reuse the existing pair guard: no
  two conclusions may query the same pair.
- **Fits progression as a rung.** More conclusions raise difficulty without
  adding premises, which is exactly what a rung is for. Cheaper than a premise,
  dearer than a time cut.

#### 2.5b Conclusion construction

Rather than judging a presented conclusion, the player **builds** it: choose a
subject, a relation, and a second subject.

The reason this matters is the guessing floor. A true/false conclusion can be
answered correctly half the time by a coin flip — which is why the progression
ladder needs its "comfortable win" guard, and why a 50% accuracy reading is
nearly uninformative. Construction removes the floor entirely: with n subjects
and r relations the chance of a lucky hit is ~1/(n(n-1)r), so accuracy starts
meaning something.

Three variants, cheapest first:

1. **Relation only.** The pair is given, the player picks the relation. Smallest
   UI change, still kills guessing on modes with more than two relations.
2. **Full construction.** The player picks both subjects and the relation. Needs
   an "is this conclusion true?" check for an *arbitrary* pair, not just the one
   the generator chose.
3. **Free production.** Any valid non-trivial conclusion is accepted. Needs the
   solver to enumerate what follows, and a triviality filter so restating a
   premise does not count.

**Prerequisite.** Variants 2 and 3 need the generator to answer "what is the
relation between arbitrary X and Y?" rather than only validating its own chosen
conclusion. The four added modes can already do this — `replay` and the
coordinate maps give any pair on demand — but stock v4 generators cannot without
the structured-premise work that answer-level verification also needs. **Build
variant 1 for all modes, variants 2–3 for the coordinate-based modes first.**

This is also the natural home for the relation-algebra engine: it already
computes the full set of relations consistent with the premises, which is
exactly what variant 3 needs to mark a free-form answer.


### Phase 3 — The "improved" part (beyond Vercel)

Work already proven in `relational-engine/` (standalone, verified against
brute-force enumeration). Porting it into v4 is what makes this build *better*
than the Vercel one rather than merely equal.

1. **Relation-algebra engine as a verification layer.** Point algebra over
   endpoints + path consistency. On the convex fragment PC is complete, so the
   relation set for any pair is exact. Run every generated item through it and
   assert the generator's claimed answer — this catches generator bugs
   automatically across all modes.
2. **Three-way answers: NECESSARY / POSSIBLE / IMPOSSIBLE.** Binary true/false is
   only adequate because total orders never produce ambiguity. Needs
   `Question.userAnswer`/`isValid` widened from boolean.
3. **Allen interval algebra** (13 relations). Turns point-based before/after into
   interval reasoning where composition is disjunctive.
4. **Computed difficulty** — chain length, surviving-set size, scramble distance,
   off-path premise count. Premise count is a poor proxy; off-path premises are
   nearly free.
5. **Structures no version has:** cyclic order/betweenness (wraparound breaks
   chaining), semiorders (intransitive indifference), non-transitive tournaments
   (punish the chaining reflex), RCC-8, generalised quantifiers ("most" is
   non-transitive — a trap for the syllogism-trained).
