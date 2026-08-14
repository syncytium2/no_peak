# Next steps

Open work, ranked. Written 2026-08-11 at the end of a long session; every item
below is either a defect someone found or a gap a review recorded, not a wish.

State at handoff: 196 tests pass, `tsc -b` clean, `dist/` is byte-identical to
what <https://nopeak.tonydefazio.com> serves, working tree clean.

> **Updated 2026-08-13.** State now: **218 tests pass**, `tsc -b` clean, working
> tree clean, `main` pushed, and <https://nopeak.tonydefazio.com> **verified
> current on the wire**, not from `dist/` mtimes. Since 2026-08-12 the core
> gained a command line — `scripts/cluster.ts`, batch over a directory, one
> summary row per record, documented at `/methods#batch`, in `llms.txt`, and in
> a new root `AGENTS.md`. **§2 and both `scripts/run_csv.ts` items in §7 are
> closed**; the numbered items below are otherwise unchanged and still open
> unless struck. The block after this one is the work that arrived on
> 2026-08-12. **The numbering is load-bearing** — `deep-learning-handoff.md`
> and others cite `next-steps.md` by section number, so add new items rather
> than renumbering.

Sources for everything here: `docs/reviews/2026-08-11_docs_after_digitisation.md`
(the 11-role murderboard, which carries the full findings and the role ledger)
and `docs/reviews/2026-08-11_expert_review.md` (the outside domain review that
started the day).

---

## Arrived 2026-08-14 — the gitignored data now syncs, and §9 is affected

**Read this before concluding any data is missing.** The four gitignored trees
(`data/extracted/`, `data/oracle/`, `data/oracle_igor/`, `reference/`) are in a
private Dropbox store and arrive with `python3 tools/data_root.py --pull`.
A downLow session spent a day treating them as unavailable and retracted a
finding over it; the data was on this mac the whole time. Full account and the
decisions in `docs/data-store-coordination_2026-08-14.md`, mechanism in
`tools/data_root.py` (vendored from downLow — canonical there).

- **no_peak pushes and stays canonical; downLow pulls.** Store is
  `<dropbox-member>/nopeak/data/`, one sha256 manifest per tree.
- ⚠ **`reference/` is `default_synced=False`** — a bare `--push`/`--pull` skips
  it and prints why; **naming it explicitly is the consent, every time.** The
  owner cleared it to sync, asked directly on 2026-08-14. **That clearance does
  not carry**: if the member folder is ever shared, or the store re-pointed
  somewhere less private, `reference/` comes out first and **the question goes
  back to him**. `docs/reference-code.md` has the reasoning and its limits. The
  other three trees are ours and are unaffected.
- ⚠ **The sharing review is wider than `reference/`, and the rule does not say
  so anywhere it is quoted.** The permissions correspondence in
  `<member>/darkroom/no_peak/` rides on the same privacy (`78b563c`,
  `docs/figure-data-permissions.md`) and is nowhere near the store. **Open item:
  nobody has surveyed that member folder for a third.** The two known were found
  by sessions noticing in passing, which is not a method — see
  `docs/multi-session-protocol.md` §6.2.
- ⚠ **A rights position was once invented here, and the record says so.** An
  earlier version of this block attributed an "owner determination" to him on a
  question nobody had asked. He was then asked, and cleared it — so the
  conclusion stood, but it had been worthless until somebody checked. Same
  failure class as the fabricated `VJ 1994 p.412` citation the murderboard
  found in downLow. **If a rights question is open, ask.** Account in
  `docs/data-store-coordination_2026-08-14.md` §5.3 and §7.
- ⚠ **This repo has downLow's stamp-corruption bug and more of it — unfixed, and
  currently undetectable here.** downLow (`30351b2`) found that a hand-rolled
  stamp bump, `sed` over the whole file instead of line 1, rewrote a *second*
  stamp-shaped string in the **body** of `docs/validation-status.md` — a
  murderboard reference, `@ b2b2ba2` — to a no_peak sha. Nothing failed, nothing
  warned. It was caught only because the next re-vendor re-copied the body and
  repaired it, which is the same bug with the evidence deleted.

  **That string is ours**; their copy is a vendored copy of our file. Verified
  2026-08-14: no_peak is **clean** — all seven murderboard stamps read
  `b2b2ba2d6c42cef07850bd7be2db3aa4d019151c` and none resolves to a no_peak
  commit. The exposure is still worse here than there:

  | file | body string a whole-file `sed` would eat |
  |---|---|
  | `docs/validation-status.md:865` | `` @ b2b2ba2 `` — the exact case that broke |
  | `README.md:312` | `` (stamped `@ b2b2ba2`) `` |
  | `tools/murderboard_freshness.sh:443` | an `echo` of `vendored from $REPO_SLUG @ <short-sha>` |
  | `.claude/skills/murderboard/SKILL.md:4` | an *instruction* describing the stamp format |
  | `docs/reviews/*.md` (×3) | `upstream:` lines, plus `doc_review_process.md @ 249a488` |

  Worse in one specific way: our body string `@ b2b2ba2` is a **prefix of the
  real stamp**, so a substitution aimed at it mangles the seven full-length
  stamps too. And **no_peak has no freshness hook armed** (§D below, still
  awaiting your approval), so nothing here would report a corrupted stamp.

  ~~Fix is `tools/revendor.py` in downLow.~~ **Ported 2026-08-14 (`131edc5`)** as
  `tools/revendor.py`, with two adaptations that were not optional: our stamps
  sit on **line 2** behind a shebang in four of six files, so downLow's
  line-1-only rewrite would have skipped them while reporting success; and
  full-vs-short sha had to stop counting as staleness, or the gate would report
  five files needing a bump on every run forever. `--selftest` carries the
  prefix-nesting case and two negative controls proving both broken
  implementations fail it.
- **Closed 2026-08-14, both in downLow's canonical copy:** `scan()` now excludes
  a `NOISE_NAMES` set (`.DS_Store`, `Thumbs.db`, `desktop.ini`, `._*`), which
  covers the copy as well as the digest since `_copy_tree` iterates `scan()`;
  and `_verdict` now reads the manifest, so "never pushed" and "was here and is
  gone" no longer report identically. Both re-vendored here.
- **Settled, deliberately not doing:** renaming `.downlow-manifest.json`. It
  announces the wrong owner, which is cosmetic; a unilateral rename demotes the
  manifest to a data file on the other side, which is not. Both sessions agreed
  to carry the misnamed constant. `--selftest` asserts it so a drift fails loud.

**§9 below is partly overtaken** — the standing invitations there assume the
real series are unavailable. Three of them are readable now.

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

That arm shrank because **the field cannot adjudicate it, not because we
cannot** — no measurement of ours would change it. Deferring this item would
only be warranted if the limit were on our side. The other two arms are
untouched, which is why it stays ranked first.

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

### D. ~~The freshness hook — needs your approval, twice requested~~ **APPROVED AND ARMED 2026-08-14 — `131edc5`**

> **Closed.** Approved on the third asking, together with porting
> `tools/revendor.py`. Both families are checked at the marked point in
> `.claude/hooks/session-start.sh` — murderboard (5 files) and downLow
> (`tools/data_root.py`) — every line wrapped in `|| true`. Verified in both
> directions before being trusted: silent and exit 0 when current, and correctly
> reporting `data_root.py` stale when run with `--refresh`.
>
> **It paid on the first dry run**, in a way worth recording: `revendor.py`
> found that `tools/fetch_paper.py` differs from murderboard upstream by one
> word — `hand-organized` where upstream says `hand-organised`. That is your
> American-English call of 2026-08-12, deliberately applied to a vendored file,
> and a faithful re-vendor would have reverted it silently. Both locally adapted
> files (`fetch_paper.py`, `data_root.py`) are declared and are **reported,
> never overwritten**.
>
> The warnings below still apply and are the reason this stayed open so long —
> read them before filing a stale verdict as noise.

*Original entry, kept because its cautions are still live:*

A `SessionStart` hook running `tools/murderboard_freshness.sh` against the
vendored-doc set. The `downLow` repo has it approved and armed; this repo does
not. It would have caught two of the five wrong conclusions of 2026-08-12. No
Claude session will install it without you saying so, because it means writing
`.claude/settings.json`.

⚠ **Two ways this check reports truthfully about itself and misleadingly about
the repo**, both learned the hard way in `downLow` and both worth knowing
*before* installing it rather than after:

- It compares a file's stamp against `HEAD`, not against the file's content, so
  a file that did not change still reads as stale until its stamp is bumped.
  Bump **every** stamp in the set on a re-vendor, not only the ones that moved.
  Do **not** file that as churn or a false alarm: the stamp is a claim about
  *which upstream commit this copy corresponds to*, and after an unrelated
  commit the copy genuinely corresponds to the new one — same bytes, new
  commit. Bumping is the honest update. A reader told it is a formality starts
  skipping it, which is worse than the noise.
- Verifying by hand hits a cache that can serve the previous sha, so it will
  report stale on a file you just corrected. Use `--refresh` when checking
  manually; the session-start path is fine.

Both are the same shape: the check's output standing in for the files'
condition. That is the proxy failure of `docs/validation-status.md`'s header
table pointed inward at the tool.

**The thing that would actually kill this hook is its alert-to-action ratio.**
Every upstream commit fires it, and the action is almost always a one-line
stamp bump. That is what gets a check turned off, not any single false alarm.
If it becomes a problem the fix is to compare *content* rather than stamp for
files that did not move — but note where that would have to land:
`tools/murderboard_freshness.sh` is vendored from `syncytium2/murderboard` and
must not be edited here, so the change belongs upstream.

### E. Deploys are fine — but check the site, not `dist/` mtimes

Not an open item; recorded because it was nearly filed as one. After the
2026-08-12 public-surface edits, `dist/` mtimes suggested a stale build. They
were misleading: the build had run, and both `/` and `/methods` on
<https://nopeak.tonydefazio.com> serve today's text. Verify deployment by
fetching the live URL and grepping for a string you just wrote — case
insensitively, which is the second thing that fooled this check. `npm run
deploy` runs tests, builds and deploys, and does **not** push.

---

## 1. Two consent claims had no primary record — **one is closed, one is not**

The repo made two public statements about identifiable people's consent, and
neither had a dated primary artifact behind it. The second is now withdrawn; the
first still stands unsupported and is the live half of this item:

- *"This port is made with Michael Johnson's approval"* (`src/About.tsx`). The
  only record is a line in `docs/reference-code.md`: "Reported by R.A. DeFazio,
  2026-08-10."
- ~~*"Used with the permission of one of the paper's authors, obtained
  2026-08-11"*. This names no author and cites no record, and it now appears in
  eight dataset notes, three documents, `tools/digitize_webster1991.py`, every
  CSV header, and **every exported figure, PDF and results CSV**.~~
  **Resolved 2026-08-13 by withdrawal, not by evidence.** An author of the paper
  was asked directly and **declined to be the grantor**, pointing to the
  copyright holder — the correct answer, and the same distinction this repo had
  already drawn. No objection to the data was raised. The claim has been removed
  from all of the above; **do not reinstate it.** This item was right that the
  sentence was unverifiable, and the lesson is narrower than "get permission":
  *a blessing that is never written down addresses nothing, because it cannot be
  produced later.* Two requests are now open — the journal's publisher, and the
  U-M library on whether the institutional licence already covers it. They are
  tracked in **the request ledger in `docs/figure-data-permissions.md`**, which
  is where every ask and answer now goes, at the time it happens rather than
  after. **Decide by 2026-08-27** if both are still silent; the ledger says what
  the fallback costs.

**The live half is Johnson's approval**, which is still a public claim on the
About page resting on a single line of hearsay in `docs/reference-code.md`
("Reported by R.A. DeFazio, 2026-08-10"). What is needed is what was needed
before: a dated note of who granted what, when, and for what scope — porting is
not the same permission as redistributing — kept wherever this project keeps
such things. Until then it is unverifiable by anyone reading the repo, including
a reviewer who might reasonably ask.

⚠ **Do not treat the Webster outcome as a template for this one.** They are
different in kind: the Webster claim was about *data facts* a publisher owns,
and an author had no standing to grant it. Johnson's approval is about *his own
code*, which he does have standing to grant — so here the artifact is worth
chasing rather than withdrawing, and withdrawing the claim would be the wrong
correction. The port's legitimacy does not depend on it either way (the
algorithm is published and algorithms are not copyrightable —
`docs/reference-code.md`), but the sentence on the About page asserts something
specific about a named person and should be supportable.

## 2. ~~`robots.txt` policy is not in effect, and the repo says the opposite~~

**Closed 2026-08-13.** The owner turned managed robots.txt off on the
`tonydefazio.com` zone. The repo and the edge now say the same thing, and it was
checked on the wire rather than inferred from the dashboard: the live
`robots.txt` is byte-identical to `public/robots.txt`, and ClaudeBot, GPTBot,
CCBot, PerplexityBot and Googlebot user-agents each fetch `/methods` with a 200.
`kernel.tonydefazio.com` shares the zone and is fixed by the same change —
verified the same two ways.

Three things learned here that outlive the item:

- **Verifying takes two checks, not one.** Managed robots.txt and "Block AI
  Scrapers and Crawlers" fail differently, and the second acts *before*
  `robots.txt` is read — so a clean `robots.txt` proves nothing about an edge
  block in front of it. Fetch the file *and* fetch a page under a crawler
  user-agent. Both recipes are in `README.md` and in `public/robots.txt`'s own
  comment header.
- **The `README.md` error this item was tracking is fixed.** It claimed the
  managed file *replaces* colonel-kernel's robots.txt outright. It does not — it
  prepends there too, exactly as here, and the rewritten section says so.
- **The mechanism is documented rather than deleted**, in both `README.md` and
  `public/robots.txt`. The setting is a dashboard toggle no file in this repo can
  override, so it can come back without warning and without a diff.

Still genuinely open, and only you can answer it: **the policy was inherited, not
decided.** The digitized Webster data is public now, so "should AI crawlers index
this" is a live question. The current answer is "yes, all of them" — that is what
the edge now enforces. Change it deliberately if that is not what you want, and
change the repo with it.

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

- ~~`scripts/run_csv.ts`'s documented invocation is broken. Its header says
  `node --experimental-strip-types`, which fails on the repo's extensionless
  imports; `tsx` works but is not a declared dependency. Add `tsx` to
  devDependencies and fix the header, or add `.ts` extensions in
  `src/core/cluster.ts`.~~ **Done 2026-08-12**, by the second route: every
  import inside `src/core/` carries a `.ts` extension, so bare `node` resolves
  them and no dependency was added. The runner grew into `scripts/cluster.ts`,
  the batch command line — see `README.md`, "Command line". Do not strip those
  extensions back off; the documented invocation dies with them.
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

- **Ten of these files have a downstream consumer**, and **this prose is not the
  authoritative list.** The `downLow` repo (`~/Developer/downLow`, the
  learned-detector project) vendors copies; its own
  `.claude/settings.json` freshness hook carries the real set as `--file`
  flags. **Read it there before relying on a count.** As of 2026-08-14:

  ```
  docs/reference-code.md          data/benchmark/truth.json
  docs/figure-data-permissions.md tools/make_synthetic.py
  docs/validation-status.md       tools/score_against_truth.ts
  data/digitized/README.md        tools/score_benchmark.ts
  data/synthetic/README.md        tools/simulate_benchmark.py
  ```

  Its copies carry a stamp naming the no_peak sha they came from, and the hook
  compares that stamp against this repo's `main`. **no_peak is canonical for all
  ten**; renaming or moving one silently breaks a consumer that cannot see this
  repo's history. Tell that session — or leave the new path in a commit message,
  which is the only channel that survives. Its `docs/vendoring.md` is the
  authority on the arrangement.

  ⚠ **This entry said "seven" and then listed eight, for an actual ten**, from
  2026-08-11 until 2026-08-14 — missing `data/synthetic/README.md` and
  `tools/make_synthetic.py`. It is a hand-copied list of a set that has a
  machine-readable source, and nothing compared the two. A session then used it
  to tell downLow that a commit had touched no vendored file, when it had
  changed `docs/reference-code.md` — which was even on the short list. **Check
  the hook, not this paragraph**, and see `docs/multi-session-protocol.md` §6.3.
- **`tools/data_root.py` flows the other way — canonical in `downLow`**, and it
  is the only file that does. The stamp at its top names the downLow sha; fix
  bugs there and re-copy, do not patch it here. Two known items are listed in
  the 2026-08-14 block above.
- **`docs/reference-code.md` gained the store's rights reasoning on
  2026-08-14**, and downLow vendors that file — so its copy is stale until
  re-vendored. That is the freshness check working, not a problem to suppress.
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
- **Every import inside `src/core/` carries an explicit `.ts` extension**, and
  that is load-bearing rather than a style choice: it is what lets bare `node`
  resolve them, which is what makes `scripts/cluster.ts` — the command line —
  run with no loader and no dependency. A tidy-up that strips them back off
  breaks the invocation documented in `README.md` and in two handoffs, and the
  app's tests will not notice, because Vite resolves both forms.
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
