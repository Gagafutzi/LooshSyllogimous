# Reading list — sources for new modes

Organised by **what it would let you build**, not by discipline. Roughly ordered
within each section by value-for-effort. Everything here should be reachable
through a university library.

---

## 1. Item generation with predictable difficulty

The most directly useful category. These tell you not just what an item is but
what makes one hard, which is the thing the calibration scale keeps guessing at.

**Carpenter, Just & Shell (1990). "What one intelligence test measures: A
theoretical account of the processing in the Raven Progressive Matrices Test."
*Psychological Review* 97(3), 404–431.**

If you read one thing, this. It decomposes Raven's into five rule types —
constant in a row, quantitative pairwise progression, figure addition/subtraction,
distribution of three, distribution of two — and shows item difficulty is governed
by *how many rules* must be held and *how abstract* they are. That is a direct
recipe: difficulty as rule-count, not as element-count. It is the paper behind the
claim that matrix tests measure relational integration, and it maps almost exactly
onto the order-vs-breadth argument.

**Barrett, Hill, Santoro, Morcos & Lillicrap (2018). "Measuring abstract reasoning
in neural networks." *ICML*.**

Introduces the PGM dataset, and with it a **formal generative grammar for matrix
problems**: an item is a set of `(relation, object, attribute)` triples, e.g.
`(progression, shape, size)`. Compositional in exactly the way your generators
are. Worth reading purely for the schema — it is a ready-made spec for a
matrix-style mode, and the held-out splits show how to test whether a solver
generalises to unseen relation/attribute combinations rather than memorising.

**Embretson (1998). "A cognitive design system approach to generating valid tests:
Application to abstract reasoning." *Psychological Methods* 3(3), 380–396.**

The methodology for building items whose difficulty you can predict *before*
administering them. This is what your `MODE_SCALE` weights are approximating by
hand.

**Primi (2001). "Complexity of geometric inductive reasoning tasks: Contribution
to the understanding of fluid intelligence." *Intelligence* 30(1).**

Isolates which features drive difficulty in figural items. Useful counterweight to
Carpenter et al.

**Gierl & Haladyna, eds. (2012). *Automatic Item Generation.***

Book-length treatment of the whole field. Skim the item-model chapters.

---

## 2. Analogy — the theory behind second-order items

**Gentner (1983). "Structure-mapping: A theoretical framework for analogy."
*Cognitive Science* 7(2), 155–170.**

The systematicity principle: analogies align *systems of relations*, not
attributes, and deeper relational structure is preferred. Directly relevant to why
"same relation" should mean what it means in the analogy mode, and to what a
*good* distractor looks like — one that matches on attributes but not structure.

**Hofstadter & Mitchell — Copycat. Best entry: Mitchell, *Analogy-Making as
Perception* (1993), or the Copycat chapter in Hofstadter's *Fluid Concepts and
Creative Analogies* (1995).**

The letter-string domain: `abc → abd`, so `ijk → ?`, and then the hard ones —
`xyz → ?` where the successor of z doesn't exist, or `mrrjjj → ?`. A whole family
of items with genuinely graded difficulty, no domain knowledge required, and
multiple defensible answers that can be ranked. This is the richest untapped
puzzle domain on this list for your purposes, and it is *pure* relational
abstraction with no spatial crutch.

**Hofstadter & Sander (2013). *Surfaces and Essences: Analogy as the Fuel and Fire
of Thinking.***

Long and discursive; read it for idea generation rather than rigour.

**Holyoak & Thagard (1989/1995) — multiconstraint theory, LISA/ACME models.**

The computational counterpart to Gentner. Useful if you want to generate analogies
with controlled amounts of structural vs surface conflict.

---

## 3. Reasoning about knowledge — the biggest untapped mode family

Nothing in the app currently touches this, and it is deeply relational.

**van Ditmarsch, van der Hoek & Kooi (2007). *Dynamic Epistemic Logic.***
**Fagin, Halpern, Moses & Vardi (1995). *Reasoning About Knowledge.***

Common knowledge, and what changes when an announcement is made. The **muddy
children** puzzle is the canonical case: *n* children, some muddy, nobody can see
their own forehead, a public announcement plus repeated rounds of "does anyone
know?" lets everyone deduce their own state. It is exactly your kind of item —
verifiable by construction, difficulty scales cleanly with *n* and with the number
of announcement rounds, and it is second-order in a way none of your modes are:
you reason about what others know about what you know.

Related and just as generative: the **sum-and-product** puzzle, and the
**hats/prisoners** family.

**Smullyan — *What Is the Name of This Book?* (1978), *The Lady or the Tiger?*
(1982), *Forever Undecided* (1987).**

Knights and knaves (your P2), then the metapuzzles, then self-reference and
Gödelian material. The graded structure across the three books is itself a ladder
design. `Forever Undecided` is where it becomes modal logic in disguise.

---

## 4. Mental models — why some items are hard

**Johnson-Laird (1983). *Mental Models*; (2006). *How We Reason*.**
**Byrne & Johnson-Laird (1989). "Spatial reasoning." *Journal of Memory and
Language* 28(5).**

The central claim: difficulty scales with the **number of distinct models**
consistent with the premises. A determinate description admits one layout; an
indeterminate one admits several, and you must check the conclusion against all of
them. This is a difficulty axis your generators do not currently use at all —
every composed-space item is fully determinate by construction. Deliberately
*under*-specifying a layout so that several arrangements satisfy it, and asking
what follows in all of them, is a different and harder task than anything in the
app now.

**Rips (1994). *The Psychology of Proof*.**

The rule-based opposition to mental models. Read for the contrast.

---

## 5. Conceptual spaces — theory for the N-D modes

**Gärdenfors (2000). *Conceptual Spaces: The Geometry of Thought*.**

Concepts as regions in geometric spaces with quality dimensions. This is the
philosophical backing for what Space 4D/5D/6D already do, and it has a lot to say
about which dimensions are *integral* (must be processed together, like hue and
brightness) versus *separable*. That distinction predicts which of your axis
stacks will chunk and which will not — testable, and directly relevant to the
argument about whether dimensions are cheap.

**Behrens et al. (2018). "What is a cognitive map? Organizing knowledge for
flexible behavior." *Neuron* 100(2).**
**Constantinescu, O'Reilly & Behrens (2016). "Organizing conceptual knowledge in
humans with a gridlike code." *Science* 352.**
**Bellmund, Gärdenfors, Moser & Doeller (2018). "Navigating cognition: Spatial
codes for human thinking." *Science* 362.**

Grid-like coding for *abstract* two-dimensional spaces. The empirical case that
representing a domain as a space is a real mechanism rather than a metaphor.

---

## 6. Relational Frame Theory — the frames you aren't using

**Hayes, Barnes-Holmes & Roche, eds. (2001). *Relational Frame Theory: A
Post-Skinnerian Account of Human Language and Cognition*.**

Read it for the **taxonomy of frames**, which is the practical payoff:
coordination (same), distinction, opposition, comparison, hierarchy,
spatial, temporal, **causal**, and deictic (I/you, here/there, now/then).

The app covers comparison, spatial, temporal, hierarchy and deictic. It has
nothing for **causal frames** (if–then, because) and little for **opposition** as
a frame in its own right. Causal networks with derived relations would be a new
mode family and would inherit all your verification machinery.

**Barnes-Holmes et al. — the REC model and the IRAP literature.**

Where the speed-and-accuracy criteria come from. Relevant if you ever add fluency
gating.

---

## 7. Difficulty grading by required inference

**The Sudoku difficulty-rating literature**, and constraint-satisfaction more
generally.

Sudoku instances are graded by *which solving techniques are required* — naked
singles, hidden pairs, X-wing, and so on — rather than by how long they take. That
is a clean, transferable idea: rate an item by the hardest inference rule needed to
close it, not by premise count. It is a much better difficulty metric than length,
which is the thing this project has been fighting all along.

Zebra/Einstein puzzles are CSPs too, and generating them with a *guaranteed unique
solution and a known minimum inference depth* is a solved problem worth borrowing.

---

## 8. Group theory, for transformation composition

Your rotations already form a group. If you build Phase D (graph transformation
matching), the composition items — *is the map from S to S″ the composition of
S→S′ and S′→S″?* — are group-theoretic, and generators/inverses/order give you a
principled difficulty ladder. Any undergraduate abstract algebra text; you only
need the first chapter on groups, plus dihedral and permutation groups.

---

## Where I'd start, given limited time

1. **Carpenter, Just & Shell (1990)** — rule-count as difficulty. Changes how you
   think about `MODE_SCALE`.
2. **Copycat** (Mitchell 1993) — the richest new puzzle domain here.
3. **Muddy children / dynamic epistemic logic** — the biggest genuinely missing
   mode family.
4. **Johnson-Laird on indeterminacy** — a difficulty axis you have never used.

Each of those is one new mode or one change to how difficulty is measured.
