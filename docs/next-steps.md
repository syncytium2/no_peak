# Next steps

Open work, ranked. Written 2026-08-11 at the end of a long session; every item
below is either a defect someone found or a gap a review recorded, not a wish.

State at handoff: 196 tests pass, `tsc -b` clean, `dist/` is byte-identical to
what <https://nopeak.tonydefazio.com> serves, working tree clean.

Sources for everything here: `docs/reviews/2026-08-11_docs_after_digitisation.md`
(the 11-role murderboard, which carries the full findings and the role ledger)
and `docs/reviews/2026-08-11_expert_review.md` (the outside domain review that
started the day).

---

## 1. Two consent claims have no primary record — **only you can close this**

The repo makes two public statements about identifiable people's consent, and
neither has a dated primary artefact behind it:

- *"This port is made with Michael Johnson's approval"* (`src/About.tsx`). The
  only record is a line in `docs/reference-code.md`: "Reported by R.A. DeFazio,
  2026-08-10."
- *"Used with the permission of one of the paper's authors, obtained
  2026-08-11"*. This names no author and cites no record, and it now appears in
  eight dataset notes, three documents, `tools/digitize_webster1991.py`, every
  CSV header, and **every exported figure, PDF and results CSV**.

What is needed: a dated note of who granted what, when, and for what scope —
digitising is not the same permission as redistributing — kept wherever this
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

**Decide it rather than inherit it.** The digitised Webster data is now public,
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
against 14px body text, all in the same colour. Cheapest high-value fix in the
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
- `data/digitized/webster1991_pulses.csv` lacks the `# DIGITISED FROM A
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

- **Digitise Webster Figs. 3–4's LH presampling panels' error bars** — there are
  none; this is settled. But if the authors still hold the underlying values,
  they would replace both the digitised traces *and* the reconstructed error
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

- **The port exposes exactly the seven error models Igor exposes.** An eighth
  was added during this session to solve a real problem and reverted, because
  two public pages state the Igor oracle spans *every* error model and a new
  model can have no oracle. If a per-sample error is needed, put it in the data
  as a column and use Error Wave — that is what the digitised records do.
- **Sensitivity and precision on the Webster scoring are not equally earned.**
  96% sensitivity is invariant to the fitted constants; 99% precision is not,
  and runs 45–100% across defensible floors. Quote the LH arm if quoting one
  number: its floor is the paper's own published assay sensitivity.
- **The digitised records' error column is reconstructed, not measured**, and
  the app draws it as error bars that leave in exported figures. That statement
  rides in the file header, the export credit, the dataset note and the About
  page. Do not let it fall out of any of them.
- **`data/synthetic/` and `data/digitized/` are different kinds of thing** and
  the simulated GnRH files were deliberately built to the same paper's protocol,
  so they look alike. `src/samples.test.ts` enforces the labelling that keeps
  them apart; do not relax it.
