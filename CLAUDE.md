# Loosh Syllogimous

An Angular 15 reasoning trainer. Items are generated, not authored: every mode
has a generator that builds premises and a conclusion, and a progression system
decides how hard the next one should be. Deployed to GitHub Pages from `docs/`,
and wrapped as an Android app with Capacitor.

## Commands

```bash
npm run test:utils                 # the whole suite, ~2 minutes
TEST_FILTER="premise" npm run test:utils   # one slice, seconds
npx ng build --configuration production    # type-check + budgets
npm run prep-deploy:prod           # rebuild docs/ for Pages
npm run apk                        # debug APK via Capacitor
```

`TEST_FILTER` is a **case-insensitive literal substring of the test's name** —
regex metacharacters are escaped, so `a|b` matches nothing. It does not match
filenames. Grep the name out of the test file first.

The APK build needs `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64` and an SDK at
`~/android-sdk`; the script sets both.

## Shipping

**Commit and push to `main` once a change is verified — don't ask.** Verified
means the suite passes and `npx ng build --configuration production` is clean;
until then there is nothing to push. No branch, no PR.

Push rather than leaving it committed locally. Sessions run concurrently here,
and an unpushed commit is one another session can sweep into its own. Expect the
rebase to conflict on `docs/` — see below.

## Layout

```
src/app/syllogimous/
  generators/   one file per mode — builds premises and the conclusion
  utils/        the shared machinery: phrasing, ability, integration, share
  services/     game, progression, settings-override, timer (storage-backed)
  pages/        routed screens; game/ is the one that matters
  components/   card, side-nav, question-map, relational-web, stages, venn
  constants/    question types, settings, local-storage keys
tests/          80 files, plain node, no jasmine/karma
```

`EnumQuestionType`'s *values* are the display labels ("Space 4D", "Comparison
Numerical"). Don't build a second table of names.

## Tests

`tests/harness.ts` is the whole runner: `test`, `assert`, `equal`, `seeded`,
`flush`. A new file must be imported in `tests/index.ts` or it never runs.

Two rules that this suite exists to enforce:

**Mutation-test every new guard.** Revert the fix, run the test, confirm it goes
red with a message that names the problem. A test that passes against the bug is
worse than no test — it is a claim of coverage that is false.

**Test the writer as well as the reader.** Most defects found here were a marker
written in one place and read in another, where only the reader was checked.
Where a class name, flag or marker crosses a boundary, render through the real
mode and assert on the output.

## Things that have cost time

- **Component CSS budgets are 4 kB warn / 8 kB error, measured after
  minification** (comments are free). `game.component.css` sits at 7.98 kB — any
  new rule there fails the build. Prefer the Bootstrap utilities already loaded,
  or delete something dead to pay for it.
- **`app-card` has exactly two projection slots**, `[body]` and `[footer]`.
  Angular silently drops content matching neither: it renders nothing, warns
  nothing, and looks like a dead click handler. `tests/projection.test.ts`
  guards every page that uses the card.
- **`docs/` is build output that CI also commits.** Expect conflicts on
  `git pull --rebase`; resolve by taking the deployed side and keeping your
  source commit free of `docs/`.
- **Both top corners of the game card hold fixed buttons** — the nav toggle at
  12px left, the focus toggle at 12px right. Anything pinned there collides.
- **The history is stored in chunks, not under one key.** `SYL_HISTORY` is the
  pre-chunk key and is only read once, to migrate; the live data is
  `SYL_HISTORY_C:<n>` plus an index. Read it through `game.questions`, never out
  of storage — one page did, and it both parsed 3.5 MB to find out which modes
  had been seen and read a key that no longer exists. The reason is in
  `utils/history-store.utils.ts`: every answer used to rewrite the whole list,
  so the cost of an answer grew with how much you had played.
- **Measure what ships, not what the code says.** The recurring bug class here
  is a count taken from the wrong place: premises printed vs. built, rungs
  charged but never delivered, negations counted in discarded text. Generate
  real items and look at them.

## Style

Comments explain *why*, not what — the reason a thing is the way it is, and what
broke when it wasn't. Match the density of the file you're in.
