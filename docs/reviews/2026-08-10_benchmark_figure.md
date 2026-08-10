# Murderboard run — benchmark vs real datasets figure

**Artifact:** `darkroom/no_peak/figures/benchmark_vs_real_datasets.html` (built file)
**Date:** 2026-08-10 · **Process:** `docs/doc_review_process.md` @ 249a488 (freshness: current)
**Mode:** single-pass, every role walked (one figure page, not a multi-section document)

## Roles and findings

| # | Role | Finding | Verdict |
|---|---|---|---|
| 1 | Claim & data verifier | "30–50-fold mismatch" — recomputed as 36–56× (158/4.4, 158/2.8). Understated. | FIXED |
| 1 | Claim & data verifier | "median 57 points against 96–145 in the real sets" — ewe LH is 71 points, falsifying the stated range. | FIXED → "71–145 in the comparison sets" |
| 1 | Claim & data verifier | 158×, 4.4×, 2.8×, 37–63% all recomputed from source and correct. | no change |
| 2 | Citation validator | Only Porteous et al. 2021 named; verified earlier this session against PubMed 34383026. No DOIs asserted in the figure. | no findings |
| 3 | Consistency auditor | Callout, table, bar chart and trace tiles all agree numerically after fixes. | no findings |
| 4 | Adversarial reviewer | "That is why CLUSTER scores 37–63%" asserted a single cause from a correlation; length and density also differ and were not separated. | FIXED — hedged to "largest single reason … the three have not been separated" |
| 5 | Line editor | Prose tight; no filler found. | no findings |
| 6 | Methods / RTFM | "Dynamic range" used undefined "baseline" and "peak"; baseline is median of the lowest fifth, and using the max makes it one-outlier sensitive. | FIXED — both now defined and the sensitivity disclosed |
| 7 | Reuse auditor | Profiling script is bespoke where `src/core/csv.ts` parses these formats; acceptable for a one-off, but the generator was an inline heredoc and was **not persisted**, so the figure is not reproducible from the repo. | FLAGGED, not fixed |
| 8 | Naive reader | "pulses per 145 samples" — 145 unexplained. | FIXED — now says why (Johnson's record length) |
| 9 | Density & figure-first | Chart carries the finding; table supports it. Appropriate. | no findings |
| 10 | Build & craft gate | **Shipped with mojibake** — no charset declaration, UTF-8 read as Latin-1, so every × and — rendered as garbage. Caught by the reader, not by me. | FIXED — charset declared *and* entities used |
| 11 | Argument order | Opens with the finding, then evidence. | no findings |

## Verification pass (on the rebuilt file)

non-ASCII bytes 0 · charset declared · doctype/html/body present · no unresolved
template markers · dark mode present · 7 traces, 8 bars, 9 table rows rendered ·
built file newer than its inputs.

## The one that matters

Role 10 exists precisely for the defect that shipped. I checked the generator, not
the render. The process says to inspect the built file and I did not, and a reader
had to report garbled characters. The dataviz skill says the same thing in its step 7
("render it and look at it"). Two independent instructions, both skipped.

**Open:** the generator is not persisted (role 7). Anyone re-running this would have
to rewrite it. Fix by moving it into `tools/` if the figure is to be maintained.
