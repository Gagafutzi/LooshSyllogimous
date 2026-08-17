# Syllogimous v4 — roadmap

A personal fork aiming at parity with the closed-source Vercel build, then past
it. v4's generators are the stable base and stay intact; everything is added on
top of them.

**This file is ordered by status, not by history.** Open work is at the top
because that is what gets read; finished work is kept below in full because the
*reasoning* is the part worth having later, and several entries record a bug that
would otherwise be reintroduced. Numbering from the original plan (1.5, 2.3, 3.7)
is retained inside section titles only so older notes still resolve — it carries
no ordering.

| | |
|---|---|
| [Next up](docs/roadmap/open.md#next-up) | what to build, in order |
| [Proposed modes](docs/roadmap/open.md#proposed-modes) | specced but unbuilt |
| [Smaller fixes](docs/roadmap/open.md#smaller-fixes) | known rough edges |
| [Done](docs/roadmap/done.md) | with the reasoning, and the traps found |
| [Reference](docs/roadmap/reference.md) | rules that keep biting |
| [Superseded](docs/roadmap/superseded.md) | kept only to explain what replaced them |

---

## Ground rules

- **v4's generators stay intact.** They are the most stable thing here. Add
  alongside; do not rewrite.
- **Every generator is verified by an independent solver** that reads only
  rendered HTML and re-derives the answer. Every mode below that says DONE was
  checked this way, and most of the entries record something the check caught
  that inspection did not.
- **Difficulty is structure, not length.** Premise count is the axis of last
  resort; see [4.0](docs/roadmap/done.md#40-one-ability-estimate--done-utilsabilityutilsts).
- **The Vercel build's JS is unavailable.** `Syllogimous.html` is a DOM snapshot
  referencing `syllogimous.min.js` without containing it, so anything unique to
  that build is written from scratch, using the snapshot only as a
  *specification* — settings labels, legend text, changelog descriptions.
- **v3 source is local** at `repos/Syllogimous-v3`, and shares element ids with
  the Vercel snapshot, so it is an ancestor of it. Anything present there is a
  **port** rather than a reimplementation, and far cheaper.
- Personal, non-commercial use (CC BY-NC 3.0 lineage).

### The five-registry hazard

Adding a question type touches five registries. Miss one and the app breaks at
runtime in a way `tsc` cannot catch:

1. `constants/question.constants.ts` — `EnumQuestionType`
2. `constants/settings.constants.ts` — `QUESTION_TYPE_SETTING_PARAMS`
3. `models/stats.models.ts` — `TypeBasedStats`
4. `constants/game.constants.ts` — `ORDERED_QUESTION_TYPES` **and every row of
   `TIERS_MATRIX`** (a positional tuple — widen the type *and* insert the column
   at the right index; TypeScript cannot see a misalignment)
5. `models/settings.models.ts` — the `Settings` constructor's explicit
   `initQuestionSettings` list ← **this is the one that blanks the whole app**

---

The body of this document is split by section under `docs/roadmap/`,
so a question about one phase costs one file rather than all of them.

- [Open](docs/roadmap/open.md) — 495 lines
- [Done](docs/roadmap/done.md) — 1315 lines
- [Reference](docs/roadmap/reference.md) — 27 lines
- [Superseded](docs/roadmap/superseded.md) — 451 lines
