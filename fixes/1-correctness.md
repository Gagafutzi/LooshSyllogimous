# 1 — Correctness

Three defects where the app is not merely awkward but wrong: an unanswerable
item, a degenerate one, and a node drawn in a colour that does not exist.

They are first because they are cheap and because each has a test that would
have caught it, which is the part worth keeping.

---

## 1.1 A conclusion naming an object no premise states

![](shots/13-unreferenced-object.png)

Vertical Order, with the analogy and meta modifiers live. The premises are:

> Oyster relates to Gasket in the same way that Flannel relates to Cucumber
> Flannel is under Cucumber, which *is on top of* Oyster

and the conclusion is **Flannel is under Grass**. `Grass` appears in the object
bank at the top of the card and in no premise. The item is not hard; it is
unanswerable, and it was graded `true`.

### Why it is possible at all

There is a guard, and it does not guard this. `isPremiseLikeConclusion` in
[`utils/question.utils.ts:44`](../src/app/syllogimous/utils/question.utils.ts)
compares the conclusion's *subject pair* against each premise's subject pair and
rejects an exact match. It says nothing about whether the conclusion's subjects
appear in the premise set at all, and it is only called from four generators —
[`syllogism.ts:60`](../src/app/syllogimous/generators/syllogism.ts),
[`linear.ts:144`](../src/app/syllogimous/generators/linear.ts),
[`stimulus-function.ts:153`](../src/app/syllogimous/generators/stimulus-function.ts)
and deliberately not from `deictic.ts` (see its comment at line 33).

The object bank is drawn from `getSymbols`, which hands out more stimuli than
the layout uses. A conclusion builder that picks from the bank rather than from
the layout will therefore reach an unused word roughly as often as the bank is
oversized. The suspect is the second-order path: the analogy rung takes a
finished scale item and rewrites the conclusion, and the `wide`/meta rendering
in [`linear.utils.ts:610`](../src/app/syllogimous/utils/linear.utils.ts)
rewrites premises after the fact — so the set of objects the *premises* mention
is no longer the set the *layout* holds, and a conclusion picked from the layout
can name something the rendered premises dropped.

That is a hypothesis with a named place to look, not a diagnosis. Confirm it
before fixing it.

### The fix, in two parts

**The invariant, in the harness.** This is the durable half and it is
mode-independent:

> Every `.subject` span in the rendered conclusion must also appear as a
> `.subject` span in at least one rendered premise, in every mode, at every
> premise count, under every modifier combination.

It reads only rendered HTML, which is the house rule for these checks, and
`extractSubjects` already exists to parse it. Add it to `tests/generators.test.ts`
where the existing all-modes sweep lives, so it runs against the same matrix of
modifier combinations that `tests/combinations.test.ts` builds.

Expect it to fail in more than one mode. That is the point of writing it as an
invariant rather than as a patch: the source lists one instance, and a bank
oversized by two words in twenty modes will not have produced exactly one.

**The generator fix.** Whatever the sweep turns up, the shape of the repair is
the same in each: the conclusion must be drawn from the objects the *premises
name after rendering*, not from the bank and not from the layout. Where a mode
genuinely needs a distractor object in the bank — several do, and it is a real
difficulty knob — the bank stays oversized and only the conclusion picker
narrows.

---

## 1.2 The two-negative-premise syllogism

![](shots/14-syllogism-two-negatives.png)

> No Swimmer is Fisherman. No Zipper is Fisherman. ⊢ Some Zipper is not Swimmer.
> Correct answer: **false**.

**The logic is right and the presentation is what is wrong.** Settled by the
author: *"so it's not a wrong syllogism, the only error is how the display of
the explanation is misleading."* Two negative premises entail nothing, so the
conclusion does not follow, so `false` is correct. `sylEntails` is not at fault
and nothing in this section touches it.

**What misleads is the layout.** A syllogism is served in the same premise list
every other mode uses — one relation per line, subject, relation, object,
stacked. That layout is a chain: it is how the scale modes state *A is above B,
B is above C*, and it is read as one, so the eye walks the premises expecting
each to compose onto the last. A syllogism is not a chain. It is two statements
about class membership joined by a middle term, and *"No Swimmer is Fisherman /
No Zipper is Fisherman"* stacked in that layout invites reading a link from
Swimmer through Fisherman to Zipper that is not there.

**The fix is a Venn diagram**, and it is written up as the headline of
[3.3](3-explanations.md#33-the-syllogism-derivation-reads-as-a-chain) with the
rest of the syllogism display work, since it is the same fix shot 08 asks for.
Overlap, exclusion and the existential dot are the whole content of a syllogism
and a chain of sentences is the one shape that cannot show them.

### Separately, and not what was reported

An observation from reading the generator rather than from the source list, kept
because it is cheap and adjacent — but it is not the reported defect and should
not displace the diagram.

Every item with two negative premises has the same answer, for a reason that
requires no reading of the item: two negatives never entail. A player who
notices that can answer this class of item correctly, forever, without reading
past the second word of each premise. The same is true of two particular
premises. Two things follow.

**Distinguish "ruled out" from "not settled".** The hierarchy work already made
exactly this distinction and recorded why — see the Set Hierarchy entry in
[`roadmap/open.md`](../roadmap/open.md): both look like "false" and they are not
the same thing, so the derivation says which, and the generator draws between
them deliberately rather than letting one dominate. Plain Syllogism never got
that treatment. `sylEntails` in
[`utils/syllogism.utils.ts`](../src/app/syllogimous/utils/syllogism.utils.ts)
refutes rather than derives, so it already has the information; it is the
generator and the derivation that throw it away.

With that in place, the item above becomes *"the premises leave this open"*
rather than *"this is false"*, which is both a truer statement and a different
answer key — and it removes the shortcut, because "two negatives" tells you the
conclusion is not entailed but says nothing about whether it is refuted.

**Then cap the degenerate figures.** Premise pairs that violate the basic
syllogistic rules — two negatives, two particulars, undistributed middle —
should not be drawn at the rate a uniform pick gives them. Not banned: a player
should meet them, and recognising one *is* a skill. Capped, so the answer
distribution stops being predictable from the premise quantifiers alone. The
hierarchy generator already does this by drawing the wanted answer once and
searching for an item that has it, rather than drawing items and taking what
comes; the same inversion applies here.

**Verification.** Over 150 generated syllogisms, no single quantifier pattern
may predict the answer better than chance. That is a stronger and more honest
check than counting the answer distribution, because the distribution was
already balanced when this item was produced.

---

## 1.3 The black node in Relational Web

![](shots/06-relational-web-bad.png)

"The black of the A is also bad." This one is fully diagnosed.

[`relational-web.component.ts:161`](../src/app/syllogimous/components/relational-web/relational-web.component.ts):

```ts
markColor(slot: number) { return `var(--th-dim-${slot % DIM_SLOTS})`; }
markFill(slot: number)  { return `color-mix(in srgb, var(--th-dim-${slot % DIM_SLOTS}) 22%, transparent)`; }
```

`DIM_SLOTS` is 8, so the first marked node — slot 0 — asks for `--th-dim-0`.
ThemeService defines `--th-dim-1` through `--th-dim-8` and nothing else
([`theme.service.ts:341`](../src/app/syllogimous/services/theme.service.ts),
and `phrasing.ts:53` says so in as many words). `--th-dim-0` is undefined, the
declaration is invalid at computed-value time, and `fill` — which inherits in
SVG — falls back through an unset ancestor to its initial value, which is
black. The order number beside it, painted with the same call, goes black too.
That is the whole of it: the node is not styled dark, it is unstyled.

A side effect worth noticing: because slot 0 is broken, slots 1 and 2 take the
first two palette colours, so the whole marker palette is shifted by one and the
mode has only seven usable slots.

**Fix.** `(slot % DIM_SLOTS) + 1` in both methods.

**Test.** `tests/web.test.ts` already exercises this component's inputs. Add a
case asserting that every colour any component hands to a `style` binding names
a custom property the theme actually defines — a set-difference over
`ThemeService`'s resolved variable names against a grep of `var(--th-dim-` call
sites. A one-off assertion on `markColor(0)` would fix this instance and catch
nothing else; the off-by-one is the kind of thing that recurs.
