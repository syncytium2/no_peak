# Next steps

Open work, ranked. Written 2026-08-11 at the end of a long session; every item
below is either a defect someone found or a gap a review recorded, not a wish.

State at handoff: 196 tests pass, `tsc -b` clean, `dist/` is byte-identical to
what <https://nopeak.tonydefazio.com> serves, working tree clean.

> **Updated 2026-08-12.** State now: **200 tests pass**, `tsc -b` clean, working
> tree clean, `main` pushed, and <https://nopeak.tonydefazio.com> **verified
> current** — both `index.html` and `/methods` changed today and the live site
> serves the new text. The numbered items below are unchanged and still open
> unless struck; the block immediately after this one is the work that arrived
> on 2026-08-12. **The numbering is load-bearing** — `deep-learning-handoff.md`
> and others cite `next-steps.md` by section number, so add new items rather
> than renumbering.

Sources for everything here: `docs/reviews/2026-08-11_docs_after_digitisation.md`
(the 11-role murderboard, which carries the full findings and the role ledger)
and `docs/reviews/2026-08-11_expert_review.md` (the outside domain review that
started the day).

---

## Arrived 2026-08-12 — unnumbered, so the sections below keep their numbers

Full detail for all of these is in `docs/validation-status.md`; this is the
ranked summary.

### A. The fixed-record generator capability — **the top item, and it needs a go**

`tools/simulate_benchmark.py` draws a fresh pulse train on every call, so it
cannot emit controlled variants of one record. Three separate open questions
all need exactly that, which is why this is one change and not three:

- a **five-runs-per-condition variance estimate** — nothing in this benchmark
  has an error bar, and a four-point monotonicity check on single runs cannot
  distinguish a misspecified generator from sampling noise;
- **Urban's resampling design** — one signal sampled at several intervals,
  which turns his published null result into a prediction we can fail rather
  than a shape we assume;
- **sweeping burst width at fixed half-life**, which is currently impossible
  because a pulse has no width and so width *is* half-life.

⚠ **On the sampling arm, this produces a description and not a gate.** The
field publishes both signs for sampling intensity's effect on false positives
and explicitly disclaims the interactions (`docs/validation-status.md`), so
decoupling density yields a clean measurement with nothing to check it
against. The falsifiable target on that axis is Urban's *null* across 5/10/15-
min sampling, not a direction. Know that before building, or you will look for
a pass/fail that cannot exist.

⚠ Two traps, both already recorded in the generator's own comments. Replicates
must differ in the **noise draw alone** — reseeding `simulate()` wholesale
redraws onsets and masses too, and then the spread measured is corpus variance,
not measurement variance. And the byte-identical regeneration guarantee this
file has twice been leaned on dies with the change, so it must be re-verified
rather than assumed.

### B. VJ's half-life direction rule fails, and nobody knows why

Of Veldhuis & Johnson's five direction rules, one reproduces (amplitude), one
**fails on a clean axis** (half-life), one is untestable here (sampling — the
axis is a density axis in disguise), one is unresolved pending replication
(assay CV), and one needs a statistic nothing computes (frequency). The
half-life failure is a probable generator defect. Two mechanisms were proposed
and each was killed by its own prediction, so the cause is open — do not admit
a third without the sweep that tests it, which item A is what enables.

### B2. Read Urban et al. 1988 — cheapest high-value item, and it is already here

`01-lit/urban et al 1988 endocrine reviews…pdf` — *Contemporary aspects of
discrete peak-detection algorithms. I. The paradigm of the luteinizing hormone
pulse signal in men*, *Endocr Rev* 1988;9(1):3–37, PMID 3286234. Thirty-four
pages, 76 mentions of Cluster, by the group that wrote it. Arrived 2026-08-12
and nobody has read it. Its contents section by section:

- **§V.E — sampling intensity vs false-positive and false-negative rates.** The
  axis this project could not test all day. Partially read already, and it
  contradicts Veldhuis & Johnson 1994 on the false-positive direction; see
  `docs/validation-status.md`. Read the rest before building any gate on a
  sampling shape.
- **§III.B — ideal properties of discrete signal detectors.** The closest thing
  to a written specification the gate has ever had, from the algorithm's own
  authors. ⚠ **Read it as input to a gate, not as one.** It is a 1988 list of
  properties a *detector* should have, not a validation protocol for a
  *simulator*, and the temptation on finding a criteria list will be to adopt
  it wholesale. That is the same move that made VJ's five-samples-per-half-life
  rule look like a gate when it is a deconvolution condition — see the
  adequacy-rule finding in `docs/validation-status.md`.
- **§V.C — concordance between simultaneous endocrine time series.** The design
  the digitized Webster records were wrongly claimed to instantiate. Read it
  before writing a want-list entry for such a dataset, because it states what
  the design actually requires.
- **§IV.B — detailed comparison of eight contemporary pulse-detection
  algorithms**, and **§V.B** on the three statistical error classes.

Two of those bear directly on questions this project generated on 2026-08-12
rather than questions it already knew it had. It wants a session of its own.

### C. Restructure the reproducibility gaps by category

A **reproducibility gap** is a bug in our tooling and can be closed. A
**distribution limit** is a property of someone else's license and can never
be. `docs/validation-status.md` currently files both under one heading that
implies all are actionable — at least three entries (the gitignored oracle
data, the Igor package, the Webster PDF) are the second kind. Collapsing the
two is how a repo talks itself into believing an unfixable problem is a to-do.

### D. The freshness hook — **needs your approval, twice requested**

A `SessionStart` hook running `tools/murderboard_freshness.sh` against the
vendored-doc set. The `downLow` repo has it approved and armed; this repo does
not. It would have caught two of the five wrong conclusions of 2026-08-12. No
Claude session will install it without you saying so, because it means writing
`.claude/settings.json`.

### E. Deploys are fine — but check the site, not `dist/` mtimes

Not an open item; recorded because it was nearly filed as one. After the
2026-08-12 public-surface edits, `dist/` mtimes suggested a stale build. They
were misleading: the build had run, and both `/` and `/methods` on
<https://nopeak.tonydefazio.com> serve today's text. Verify deployment by
fetching the live URL and grepping for a string you just wrote — case
insensitively, which is the second thing that fooled this check. `npm run
deploy` runs tests, builds and deploys, and does **not** push.

---

## 1. Two consent claims have no primary record — **only you can close this**

The repo makes two public statements about identifiable people's consent, and
neither has a dated primary artifact behind it:

- *"This port is made with Michael Johnson's approval"* (`src/About.tsx`). The
  only record is a line in `docs/reference-code.md`: "Reported by R.A. DeFazio,
  2026-08-10."
- *"Used with the permission of one of the paper's authors, obtained
  2026-08-11"*. This names no author and cites no record, and it now appears in
  eight dataset notes, three documents, `tools/digitize_webster1991.py`, every
  CSV header, and **every exported figure, PDF and results CSV**.

What is needed: a dated note of who granted what, when, and for what scope —
digitizing is not the same permission as redistributing — kept wherever this
project keeps such things. Until then the claim is unverifiable by anyone
reading the repo, including a reviewer who might reasonably ask.

Note the scope wording is already careful (`data/digitized/README.md` says an
author's *courtesy* permission cannot license the publisher's rights). The gap
is the record, not the phrasing.

## 2. `robots.txt` policy is not in effect, and the repo says the opposite

Cloudflare's managed robots.txt is prepended at the edge and disallows **nine**
AI agents; the site's own "all crawlers welcome" text and `Sitemap:` line never
take effect. Verify any time with:

```
curl -s https://nopeak.tonydefazio.com/robots.txt | head -20
```

Fix is a dashboard setting on the `tonydefazio.com` zone (AI Crawl Control →
managed robots.txt off; Security → Bots → "Block AI Scrapers and Crawlers" left
off). Nothing in this repo can override it.

**Decide it rather than inherit it.** The digitized Webster data is now public,
so "should AI crawlers index this" is a live question, not a leftover. Whatever
you choose, make the repo say the same thing the edge does.

One correction found while checking: `README.md` claims the managed file
*replaces* colonel-kernel's robots.txt outright. It does not — it prepends
there too, exactly as here. That sentence is still wrong and should be fixed
when the policy is settled.

## 3. Deep links into the About page eject the reader

`src/main.tsx` routes on `hash === "#about"` **exactly**. The page defines seven
anchor ids (`prepare`, `twokinds`, `concatenate`, `presets`, `scale`, `terms`,
`reporting`), so `/#terms` renders the app instead of the section — including
the one in-page link the About page itself carries (`href="#concatenate"`).

Fix: route to About when the hash matches any of its section ids, then scroll to
it. Small change, and it unlocks six ids that currently exist for nothing.

## 4. The About page is a wall

4,330 words, 23 sections, **no table of contents, no figures**, and headings
that barely outrank the body: `.about h2` is 15px and `.about h3` is 14px
against 14px body text, all in the same color. Cheapest high-value fix in the
set, in order:

1. Render a TOC from the ids that already exist (~15 lines).
2. Add ids to the four `h2`s that lack them.
3. Raise `h2` to ~17px in `--ink`, `h3` to 15px semibold.

## 5. Two figures would each replace ~300 words

Zero figures across 17,306 words of documentation. Two earn their place:

- **A CLUSTER schematic** — a trace with the nadir window, the peak window, the
  pooled-t bracket and one flagged *up*. Replaces the first ~110 words of the
  "How CLUSTER works" section on **both** the About page and `/methods`. The
  project already renders SVG in `src/chart/`, so it can be generated from the
  code path it explains.
- **The scale-dependence plot** — pulses found versus data scale factor, Igor
  0→5→11→17 against Fortran flat at 11. Readers will not believe that claim
  from prose, and the supporting table currently lives only in
  `docs/validation-status.md`, which the About reader never sees.

## 6. `docs/validation-status.md` has a damaged tail

Around lines 320–380: a tooling list filed under "What is not verified",
`### 2.` and `### 3.` with no `### 1.`, and completed work sitting under a
not-verified heading. Partially repaired; still wants restructuring into
"what is not verified" / "how to re-run the validation" / "completed".

## 7. Smaller, verified, and each a one-liner

- `scripts/run_csv.ts`'s documented invocation is broken. Its header says
  `node --experimental-strip-types`, which fails on the repo's extensionless
  imports; `tsx` works but is not a declared dependency. Add `tsx` to
  devDependencies and fix the header, or add `.ts` extensions in
  `src/core/cluster.ts`.
- `src/core/presets.test.ts` still says "21 pulses were generated" for
  `sim_gnrh_thx_fast`; the generator makes **22**, and the `< 21` bound rests on
  the old denominator.
- `public/llms.txt` claims "ten variance models"; there are **seven**.
- `index.html` has no `<meta name="description">` and no `og:description`, so
  social cards render captionless. No favicon anywhere either (404).
- `data/digitized/webster1991_pulses.csv` lacks the `# DIGITIZED FROM A
  PUBLISHED FIGURE` banner its eight siblings carry.

## 8. Duplication that currently agrees, and will not forever

Recorded by the reuse audit; nothing is broken today, all copies were verified
identical.

- `tools/score_webster1991.ts` and `src/core/webster1991.test.ts` each define
  their own `match()`, `ASSAY` constants and params. Same values today. One
  module, both importing it.
- The Webster parameters appear in four places; `src/core/presets.ts` is
  canonical and `presets.test.ts` shows the right idiom for reading from it.
- `src/core/segments.ts` `poolSummary()` re-derives what `peaks.ts`
  `summarize()` computes. Byte-identical on four records when checked, but
  `segments.test.ts` asserts only `pulse`, `times` and `nPeaks` — one line
  (`expect(one.combined.summary).toEqual(direct.summary)`) closes the class.
- `src/core/igor.ts` reads the real lab `.pxp` with zero difference against
  `data/extracted/*.csv`, but nothing in CI checks that: `igor.test.ts` only
  tests fixtures it writes itself. The oracle pattern already exists in
  `igor-oracle.test.ts` (auto-skips when the gitignored data is absent).

## 9. Standing invitations, if the data becomes available

- **Digitize Webster Figs. 3–4's LH presampling panels' error bars** — there are
  none; this is settled. But if the authors still hold the underlying values,
  they would replace both the digitized traces *and* the reconstructed error
  column, and moot most of the caveats in `data/digitized/README.md`.
- **Deposit the Webster PDF in the lit cache.** It is not open access, not
  committed and not cached, so no reviewer can check the protocol figures, the
  printed CLUSTER settings, the assay sensitivities, or the one sentence quoted
  from it verbatim in `tools/make_synthetic.py`.
- **Extend the Fortran oracle beyond `gnrh`.** Only that one wave has been
  diffed against CLUST5, at two settings, against a 15-run 5-wave matrix for
  Igor — and the published presets now route users onto the Fortran path.

---

## Things to not undo by accident

- **Seven of these files have a downstream consumer.** The `downLow` repo
  (`~/Developer/downLow`, the learned-detector project) *vendors* copies of
  `docs/validation-status.md`, `docs/reference-code.md`,
  `docs/figure-data-permissions.md`, `data/digitized/README.md`,
  `data/benchmark/truth.json`, `tools/score_benchmark.ts`,
  `tools/score_against_truth.ts` and `tools/simulate_benchmark.py`. Its copies
  carry a stamp naming the no_peak sha they came from, and a freshness check
  compares that stamp against this repo's `main`. **no_peak is canonical for
  all of them**; renaming or moving one silently breaks a consumer that cannot
  see this repo's history. Tell that session — or leave the new path in a
  commit message, which is the only channel that survives. Its own
  `docs/vendoring.md` is the authority on the arrangement.
- **Another Claude session may be working in this same checkout**, sharing one
  working tree *and* one `.git`. Stage explicit paths; never `git add -A` or
  `commit -a`, which sweep up the other session's unfinished work. Before
  concluding anything about what committed code does, pin the sha *and* run
  `git status` — see `docs/validation-status.md`'s header for why the first
  alone fails silently.
- **The port exposes exactly the seven error models Igor exposes.** An eighth
  was added during this session to solve a real problem and reverted, because
  two public pages state the Igor oracle spans *every* error model and a new
  model can have no oracle. If a per-sample error is needed, put it in the data
  as a column and use Error Wave — that is what the digitized records do.
- **Sensitivity and precision on the Webster scoring are not equally earned.**
  96% sensitivity is invariant to the fitted constants; 99% precision is not,
  and runs 45–100% across defensible floors. Quote the LH arm if quoting one
  number: its floor is the paper's own published assay sensitivity.
- **The digitized records' error column is reconstructed, not measured**, and
  the app draws it as error bars that leave in exported figures. That statement
  rides in the file header, the export credit, the dataset note and the About
  page. Do not let it fall out of any of them.
- **`data/synthetic/` and `data/digitized/` are different kinds of thing** and
  the simulated GnRH files were deliberately built to the same paper's protocol,
  so they look alike. `src/samples.test.ts` enforces the labeling that keeps
  them apart; do not relax it.
