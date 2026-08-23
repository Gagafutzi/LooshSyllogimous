# Fixes — the problems list, worked into a plan

Source: `LooshSyllogism problems.odt` (23 Aug 2026), fourteen annotated
screenshots plus five closing remarks. The screenshots are kept in
[`shots/`](shots/) under the numbers used throughout, so a finding can be
checked against what was actually on screen rather than against a paraphrase.

The list is not fourteen unrelated bugs. Read together it is **four themes and
two loose ends**, and that is how the plan is split — a fix written once against
the theme is worth more than fourteen written against the symptoms, because most
of these modes will grow new conclusion forms later and the same defect would
come back with them.

| | what it is | why it is here |
|---|---|---|
| [1 — Correctness](1-correctness.md) | items that are wrong, not merely ugly | cheap, unambiguous, and one of them is a two-character fix |
| [2 — Conclusion depth](2-conclusion-depth.md) | conclusions reachable without the whole relation | the author's own summary of the whole list |
| [3 — Explanations](3-explanations.md) | derivations that do not explain | the payoff for getting an item wrong |
| [4 — Legibility](4-legibility.md) | things that cannot be read | includes the icon, which is the same class of problem |
| [5 — Mode reworks](5-mode-reworks.md) | Transformation Matching and Oddest Relation | the two the author wants rebuilt, not patched |
| [6 — Ladder and settings](6-ladder-and-settings.md) | wide premises, compact, meta, negation | four sentences of the source, all about progression |

## Where each screenshot went

| # | subject | theme |
|---|---|---|
| 01 | Construct answers scored as one bit, not per dimension | [3](3-explanations.md#31-construct-answers-scored-per-dimension) |
| 02 | Graph Matching explains nothing | [3](3-explanations.md#32-graph-matching-has-no-derivation) |
| 03 | Nested: conclusion restates a bracket verbatim | [2](2-conclusion-depth.md#21-what-is-actually-wrong) |
| 04 | Transformation Matching is trivial and mostly empty space | [5](5-mode-reworks.md#51-transformation-matching) |
| 05 | Shape Rotation: conclusion from one premise, rotation is a no-op | [2](2-conclusion-depth.md#23-the-rotation-no-op) |
| 06 | Relational Web: arrows indistinct, one node drawn black | [4](4-legibility.md#41-relational-web) |
| 07 | The good Relational Web, for reference | [4](4-legibility.md#41-relational-web) |
| 08 |  Syllogism derivation reads as a chain, not a syllogism | [3](3-explanations.md#33-the-syllogism-derivation-reads-as-a-chain) |
| 09 | Oddest Relation should be about groups | [5](5-mode-reworks.md#52-oddest-relation) |
| 10 | Deictic: two-premise conclusion, reversal stated first | [2](2-conclusion-depth.md#24-transformations-that-arrive-before-the-thing-they-transform) |
| 11 | 6-D explanation diagram is unreadable | [4](4-legibility.md#42-the-composed-space-explanation-diagram) |
| 12 | 7-D premises, 1-D conclusion; an N-D map wants an N-D conclusion | [2](2-conclusion-depth.md#25-an-n-dimensional-map-deserves-an-n-dimensional-conclusion) |
| 13 | Conclusion names an object no premise mentions | [1](1-correctness.md#11-a-conclusion-naming-an-object-no-premise-states) |
| 14 | Syllogism served in the linear-chain premise layout | [3](3-explanations.md#33-the-syllogism-derivation-reads-as-a-chain) |

## Order of work

Ordered by value per hour, not by how large the section is.

1. **[1 — Correctness](1-correctness.md).** An item that cannot be solved from
   its premises is worse than a missing feature, and the black node is a wrong
   variable name. Both are small.
2. **[6 — Ladder and settings](6-ladder-and-settings.md).** Two ladder entries
   deleted and two rung rows un-hidden. Small, and it stops the broken
   modifiers from being handed out while the rest of this is in progress.
3. **[2 — Conclusion depth](2-conclusion-depth.md).** The largest single win and
   the one the author names as the general problem. It needs one new shared
   measurement; every mode then reads it.
4. **[3 — Explanations](3-explanations.md).** Compounds with 2: once conclusions
   are deep, getting one wrong needs a derivation worth reading.
5. **[4 — Legibility](4-legibility.md).** Mostly bounded, mostly rendering.
6. **[5 — Mode reworks](5-mode-reworks.md).** Largest and least specified;
   Oddest Relation in particular needs a decision from the author before code.

## Ground rules carried over from the roadmap

These are not new, but every section below assumes them, so they are repeated
rather than linked:

- **v4's generators stay intact.** Add alongside; do not rewrite. Nothing in
  this plan calls for a generator to be replaced except the two in section 5,
  which the author explicitly asked to have reworked.
- **Every change is verified by an independent check that reads only rendered
  output.** The tests live in `tests/`, run with one command, and a fix here
  that has no test is a fix that will be undone by the next change to the same
  generator.
- **The five-registry hazard** applies to anything in section 5 that adds a
  question type. See [ROADMAP.md](../ROADMAP.md).

```bash
npm run test:utils
```

## One open question for the author

Section [5.2](5-mode-reworks.md#52-oddest-relation) turns on which reading of
"the group that has the dimension with the highest difference between members at
the edges of it" was meant. The two readings agree on many items and not on all,
and building the wrong one produces a mode that tests cannot catch, because the
tests would be written against the same misreading.

*(Settled: shot 14's syllogism is graded correctly — the defect is that a
syllogism is displayed in the chain layout. See
[3.3](3-explanations.md#33-the-syllogism-derivation-reads-as-a-chain).)*
