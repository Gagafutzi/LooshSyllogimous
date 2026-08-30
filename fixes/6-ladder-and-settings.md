# 6 — Ladder and settings

> Another thing is that wide premises only work inconsistently, compact
> relations are also somewhat broke. Both shouldn't be part of the ladder.
>
> Meta and negation should have an on off ladder option as well.

Two sentences, four changes, all small. This section is second in the work order
despite being sixth in the file: the ladder hands out `wide-premises` and
`compact` to every player who climbs far enough, so leaving them in place while
the rest of the plan is built means continuing to serve items the author has
already said are broken.

---

## 6.1 Take `wide-premises` off the linear ladder

[`progression.utils.ts:219`](../src/app/syllogimous/utils/progression.utils.ts):

```ts
const LINEAR_LADDER = [
    "negation", "branching", "meta", "overlap", "wide-premises",
    "transform-1", "transform-2", "multi-conclusion", "choose-conclusion",
    "construct-conclusion", "construct-distance",
];
```

### Why it is inconsistent

The merge is in `renderPremises` at
[`linear.utils.ts:611`](../src/app/syllogimous/utils/linear.utils.ts):

```ts
for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const next = edges[i + 1];
    const shared = next && (next[0] === b || next[1] === b);
    if (!shared) { premises.push(one(a, b, i)); continue; }
    ...
}
```

Two premises merge only when edge `i+1` shares edge `i`'s **second** endpoint,
**in stored order**. On a plain chain that holds for every consecutive pair and
the rung does what it says. On a branching layout — and `branching` sits two
rungs *earlier*, so by the time `wide-premises` is earned every item has it —
consecutive stored edges rarely share an endpoint at all, so most items merge
nothing and render identically to an item without the rung. The player has
claimed a rung that the item does not honour, which is precisely the thing the
ladder's own comment promises cannot happen: *"Only rungs a mode actually
supports appear, so a promotion never claims something the generator ignores."*

There is a second, narrower fault in the same block:

```ts
const tail = second.text.replace(/^<span class="subject">[^<]*<\/span>\s*/, "");
```

`[^<]*` cannot match a subject whose content contains markup. `subj()` wraps a
plain string today, so this holds — but visual-noise and emoji stimuli are
assembled elsewhere, and any of them nesting a span inside the subject makes the
strip silently fail and produces *"A is above B, which B is above C"*. It is a
latent bug rather than the reported one, and it is worth fixing while the file
is open: match the span structurally rather than by regex, or have
`renderRelation` return its parts so the tail never has to be recovered from
rendered HTML.

### The change

1. Delete `"wide-premises"` from `LINEAR_LADDER`.
2. Remove it from `ModeModifiersComponent.COVERED` so it appears as an ordinary
   tri-state row — it stays available to anyone who wants it, and stops being
   handed out.
3. Leave `LinearFeatureFlags.widePremises` and the `wide` option in place.
   Nothing needs deleting; the rung is what was wrong, not the feature.

**Ordering caution.** The ladder is positional — a player's earned rungs are
stored as a count, and `rungs.push(ladder[rungs.length])` reads by index. The
comment above `LINEAR_LADDER` records that `negation` was appended mid-ladder
rather than at the front for exactly this reason. **Removing** an entry shifts
every rung after it down by one, which silently re-labels the earned rungs of
every existing profile. Either migrate stored state, or replace the entry with a
no-op placeholder rather than deleting it. Whichever is chosen,
`tests/progression.test.ts` should assert that a profile saved under the old
ladder resolves to the same set of rung names under the new one.

### Then decide what to do with it

Removing it from the ladder is what was asked for and is the whole of the fix.
Whether to repair the merge afterwards is a separate call, and it should be
informed by a measurement rather than by the screenshot: add a check that counts
what fraction of `wide` items actually merge anything, at each premise count,
with and without `branching`. If the answer is "eight percent when branching is
on", the repair is worth doing — merge across the whole edge list rather than
consecutive stored pairs — and the rung can go back afterwards.

---

## 6.2 Take `compact` off the ND ladder

[`progression.utils.ts:258`](../src/app/syllogimous/utils/progression.utils.ts):

```ts
const ND_LADDER = [
    "branching", "compact", "circular", "indeterminate", ...
];
```

`compact` sits second, so almost every composed-space item a progressing player
sees has it. What it does is drop the clauses where two objects do not differ
([`ndspace.utils.ts:850`](../src/app/syllogimous/utils/ndspace.utils.ts)), so an
unmentioned axis has to be read as "same" rather than ticked off.

Same change: remove from `ND_LADDER`, remove from `COVERED` so the tri-state row
appears, keep `LinearFeatureFlags.compact` and the `feat.compact` path.

Same ordering caution — the ND ladder is seventeen entries long and `compact` is
at index 1, so removing it shifts sixteen.

The author's report is *"somewhat broke"* without a symptom, so this section
cannot say what is wrong. Two things are worth checking while it is out of the
ladder, because both would present as "somewhat broke":

- **The convention has to be stated for the item to be derivable.**
  `ndspace.ts:717` says so and pushes `COMPACT_NOTE` at line 721. Confirm that
  note survives every path that can render a compact item — including the ones
  that build the setup line elsewhere, and including History, where the setup
  line is re-rendered from stored state.
- **Compact interacts with under-specification.** `ndspace.utils.ts:678`
  records that withholding a clause is *"indistinguishable from compact, which
  states levelness by omission"*, and `ndspace.ts:397` guards against them
  running together. Confirm that guard covers the override path as well as the
  ladder path — a forced `compact` from Customise reaches the flag at line 342
  by a different route from an earned one, and that is exactly where a guard
  written against the ladder gets bypassed.

---

## 6.3 Per-mode on/off for meta and negation

Both already have a tri-state, and it is **global**:

```ts
// settings-override.service.ts:188
meta: boolean | null;
negation: boolean | null;
```

applied across every mode at once
([`settings-override.service.ts:360`](../src/app/syllogimous/services/settings-override.service.ts)).
The comment at line 184 records why it is tri-state rather than boolean — the
old version *"forced negation and meta onto every mode at once, whatever any of
them wanted"* — which is the right diagnosis and only half the fix. It is still
one switch for twenty modes; what it stopped doing is forcing them *on*.

Everything needed for the per-mode version exists. `setRung(type, rung, value)`
writes a per-mode tri-state and `rungOf` reads it. The only reason `negation`
and `meta` do not appear as rows is that they are listed in

```ts
// mode-modifiers.component.ts:44
private static readonly COVERED = new Set([
    "negation", "meta", "branching", ...
]);
```

with the stated rationale that *"listing every rung would put two controls on
one setting for the scale modes"*. That was true when the family flag was the
only control. It is worth accepting the second control now, because the two
controls do different things — one is "everywhere", one is "here" — and the
alternative is the current state, where per-mode is impossible.

### The change

1. Remove `"negation"` and `"meta"` from `COVERED`, so they appear as tri-state
   rows on every mode whose ladder contains them.
2. Give them labels in `rungLabel` — the fallback prints the bare rung id, which
   is fine for `min-span-3` and not for a control this prominent.
3. Resolve global against per-mode explicitly, with the per-mode setting
   winning: **per-mode override → global override → ladder.** Write it once in
   the resolver rather than at each of the four call sites that currently read
   these flags, and say in a comment that per-mode wins, because "which of my
   two switches is in charge" is the question this change creates.
4. Make the precedence visible in the UI: when a global override is set, a
   per-mode row still reading "ladder" should say what it is deferring to.
   A control that appears to do nothing is worse than no control.

**Test.** `tests/customise.test.ts` covers the override service already. Add the
precedence table directly — nine cases, three states each for global and
per-mode — because precedence bugs are invisible in play and obvious in a table.

---

## 6.4 The widest spaces unlock late, and open at the floor — **BUILT**

> Lock 5, 6 and 7 D in some higher tiers, 6D can't be there alongside something
> like 3p graph isomorphism. And it should start with minimal premises.

Both halves of that are one observation. Every mode arrived at row 6 — level 8,
"a competent player" — which put a six-dimensional space beside a three-premise
graph match, and then `priorForNewMode` opened it at whatever the player's
aggregate said, so the first 6D item was several premises wide as well as six
axes deep.

### Width is the difficulty with no substitute

The unlock ramp is built on a defensible assumption: reasoning transfers, so a
level earned anywhere is evidence about a mode you have never played, and a
mode opened early is not unfair because the prior places it against what you
have shown. That holds for length, for modifiers, for answer mode, for
relational order — Analogy, Knaves and a ten-premise chain really are evidence
about each other.

It does not hold for width. Nothing else in the app asks you to carry six
independent accumulations through one chain, so an aggregate assembled from
everything else says nothing about whether you can. That is the whole argument,
and it is why the fix is in two places rather than one: a late unlock alone
would still have opened 6D at eight premises, and a floor start alone would
still have offered it beside the graph match.

### What changed

1. **`TIER_UNLOCK_LEVELS` is `[0, 3, 4, 5, 6, 7, 8, 10, 12, 14]`.** Rows 7, 8
   and 9 exist to add one axis each: 5D at level 10, 6D at 12, 7D at 14. Two
   levels apart is two tiers apart on the badge, so the climb is visible.
2. **Rows 6 to 8 of `TIERS_MATRIX` zero those three columns**, which is the
   half `tsc` cannot check — the tuple width is all it sees.
3. **`FLOOR_START_MODES` excuses the three from the cross-mode prior**, so they
   open at three premises with no rungs however good the record is. The climb
   out is short: about ten answers to a four-premise item with two rungs, which
   is the ability model doing what it is for.
4. **Exhaustion stops at row 6** (`EXHAUSTION_ROW`). `anyExhausted` fires at
   aggregate level 1 — running out of Distinction is evidence about Distinction,
   not a reason to be handed seven axes.
5. **The negation and meta grants are pinned to row numbers.** They read `> 5`
   and `> 6` when row 6 was the last row anyone could reach, so negation landed
   at the top of the ramp and meta was never granted at all on that path.
   Adding three rows would have handed meta out as a side effect of a change
   about which spaces are offered; they are now `>= 6` and `>= 9`, so the
   deep-space rows are about spaces and nothing else.

**The gate is a default, not a lock.** Customise applies after the tier row and
`ProgressionService.applyTo` never disables anything, so switching 7D back on
by hand still works and always did.

**Tests.** `tests/unlock.test.ts` gains the ordering (each axis its own unlock,
in order), the exhaustion cap, and a check that each threshold sits at least two
levels above the level of that mode's own opening item — a gate you clear on the
day the first item is beyond you is not pacing anything.
`tests/coldstart.test.ts` gains the floor start, including the case that keeps
it honest: a mode that is merely *new* still arrives where the player already
is, so this carves an exception out of the cold-start fix rather than reversing
it.

---

## 6.5 Pharmacy stimuli — **BUILT**

> Ich denke das Programm ist gestärkt dadurch dass alle Regeln arbiträr sind.
> Füge lediglich Moleküle in unterschiedlichen Darstellungen und Begriffe aus
> der Pharmazie als Stimuli hinzu. So kann ich mir immerhin passiv die Namen
> usw einprägen. — als Option

The scope is the point, and it is the player's own: **the rules stay arbitrary.**
Nothing here makes a premise mean anything. An item saying one molecule is above
another is as invented as it was with nonsense triples — which is what keeps it
a reasoning item the ability model can price, rather than a knowledge question
it cannot. Only the tokens change.

**Display & timer → What the stimuli are → Pharmacy stimuli**, off by default,
and a weight in the mix on Customise like every other kind.

### Three decisions worth stating

**One face per molecule per run.** The pool is rebuilt per question and several
generators draw from it more than once for a single item, so choosing a
representation per draw would eventually put "Ibuprofen is above C₁₃H₁₈O₂" on a
card — not a premise, a contradiction the reader has to ignore. The face is
chosen once per run instead: some molecules are names this session, others
formulas, and the assignment reshuffles on reload. That makes the collision
impossible rather than unlikely, and the pairing is still what gets learned
across sessions. `tests/stimuli.test.ts` asserts both halves, including that no
two *different* molecules can show the same face — sucrose and lactose share a
sum formula, and a pool holding both as formulas would repeat a token under two
names.

**Short and checkable rather than long and impressive.** Forty molecules, every
formula one anybody can verify, in Hill notation, with a test that the elements
are real ones. A junk shape cannot be wrong; a molecular formula can, and a
wrong one shown three hundred times is worse than no formula at all.

**No structural formulas.** They are the representation a chemistry exam most
wants, and they need a picture — which after §4.x means a canvas drawing, which
means either hand-encoding 2D coordinates per molecule or taking on a SMILES
renderer as a dependency. Hand-encoding forty skeletons is exactly the "wrong
thing memorised passively" risk above, at forty times the surface. Left out, and
worth doing properly with a renderer if it is wanted.

German terms, because the exam is in German and half the value of a vocabulary
list is recognising the word when it turns up in a question stem.

---

## 6.6 Two numbers read off a real account — **FIXED**

An export and a history CSV from a played account, which settled a question left
open in §6.x and produced a second finding neither of us was looking for.

### The premise count was never held to the mode's own ceiling

`MODE_SCALE.ceiling` is documented as *"the highest level at which the mode
still tells you anything. Past it, extra premises add length rather than
difficulty"* — and it says outright that above it a mode *"simply stops being
offered"*. The placement test is the only thing that ever read it. **In play,
nothing did.**

What that produced, from the account:

| mode | served | that is level | ceiling |
| --- | --- | --- | --- |
| Graph Matching | 15 premises | 18.0 | 9 |
| Anchor Space v2 | up to 20 allowed | 50.0 | 20 |
| Distinction | 8 premises | 8.0 | 6 |

The Graph Matching row is the whole story. Fifteen relations is a *counting*
exercise, not a reasoning one; it was answered wrong, repeatedly, and the
estimate for that mode fell to **3.3** — which is two premises answered in ten
seconds. Both halves of *"the system gives me weirdly easy or difficult tasks"*
came out of the same gap, in that order, and the swing between modes in one
session is now about ten levels: Graph Matching at 3.3 beside Anchor Space v2 at
13.2.

**The fix** caps the served premise count at `ceiling / weight`, applied in
`configFor` where the bounds are assembled. Two conditions on it:

- Never above the mode's own `maxNumOfPremises`, which is the author's tighter
  statement where there is one.
- Never where the cap would land within one premise of the mode's floor. A
  ceiling that divides down onto the floor is not a length cap; it is a mode
  whose ceiling, weight and premise bounds disagree, and that is a calibration
  question rather than something to enforce silently. Six modes are skipped on
  this rule — Axis Maps, Knights and Knaves, Nested Spaces, Infer the Relation,
  Oddest Relation, Transformation Matching — and they are worth a look.

**What it costs, stated plainly.** A player past a capped mode's ceiling now
gets easy items from it, because the other half of what `MODE_SCALE` describes —
*"it simply stops being offered and the harder modes carry the run"* — is not
built. The draw does not yet drop a mode nobody can be stretched by.
`tests/progression.test.ts` says so where it used to assert the opposite.

### Time away from the keyboard counted as time on task

> Sometimes the program counts far too much time if you have timer off and you
> are afk.

With no deadline, nothing bounds the gap between an item being built and being
answered. Ten items in the export ran past five minutes; the worst carried
**8,938 seconds** — 149 minutes of a 207-minute day, against a 180-minute daily
goal that was therefore met almost entirely by a tab left open.

The day and week summary cards had already met this and clamp at five minutes an
item. `setDailyProgress` did not, so the two screens disagreed by hours about
the same day. Same clamp now, from the same exported constant.

The history keeps the real elapsed time. What is capped is what gets *counted* —
the raw number is a record, and "time on task" is a claim.
