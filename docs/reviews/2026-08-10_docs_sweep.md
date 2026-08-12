# Murderboard run — About page, validation-status, DL handoff, README + support docs

**Date:** 2026-08-10 · **Process:** `docs/doc_review_process.md` @ 249a488 (freshness: current)
**Mode:** four parallel reviewers, one per artifact, each walking all 11 roles.
Roster check passes on each. Reviewers did not edit; fixes applied in the main thread.

## Verdict by artifact

| Artifact | High | Fixed now | Deferred |
|---|---|---|---|
| `src/About.tsx` | 3 | 5 | ~20 (mostly craft/structure) |
| `docs/validation-status.md` | 8 | 6 | reproducibility gaps recorded |
| `docs/deep-learning-handoff.md` | 12 | 9 | structure, figures |
| README + igor-validation + reference-code | 5 | 12 | 3 low |

## What was wrong and mattered

**The public page misled in three ways.** It linked to a GitHub repo that
404s (the repo is private) *and* asserted the reference Fortran and Igor code
were there — advertising redistribution of code whose license forbids exactly
that. It claimed "no server, no upload" absolutely, on a page that carries a
contact form posting to a third party. And it quoted CLUSTER's ~1%
false-positive rate with none of the density caveat this project measured and
wrote down a day earlier. All three fixed.

**A headline result rested on lost code.** The density-matched figures
(59.0%/0.4%) came from a throwaway script that was never persisted, and
`simulate_benchmark.py` could not produce that corpus — its priors cap records
at 48 points. Fixed by adding `--profile dense`; re-measured as **55.8%/58.4%
sensitivity at 0.3%/0.4% FDR**, and the published numbers corrected. The
conclusion (near-zero FDR on dense records, ~58% sensitivity matching Johnson's)
survives; the specific numbers did not.

**`data/oracle/` is not committed, and four places said it was** — two docs, a
shell script's error message, and by implication the claim that a green
`npm test` means the Fortran oracle ran. On a clean clone it skips. Fixed
everywhere.

**AutoDecon's "~98%" is a detection count, not a sensitivity.** It sums
Johnson's reported counts; for `ghsim1` he reports 19 detections against 18 true
pulses, so it contains unscored false positives. Now flagged as such.

**Two kill criteria could not fire.** Criterion 1 would have fired on a
*correct* simulator, because the amendment sixty lines above it says failing to
reproduce the published false-positive rate on a broad corpus is expected.
Criterion 2 was unfalsifiable as written. Both rewritten.

## Standing gaps (not fixed)

- Three headline comparisons remain unreproducible from the repo: the `fortran`
  ground-truth rows (`score_against_truth.ts` hardcodes `igor`), the PULSAR
  head-to-head (its scorer was never committed), and the "10-20% conservative
  SD" calibration. Recorded in `docs/validation-status.md`.
- `#about` is a fragment, so the ~2,850-word About page is invisible to any
  non-JS reader, crawler, or reference manager. `index.html` covers `/` only.
- Zero figures across About and both long docs; the reviewers named specific
  replacements, including plotting a simulated series next to a real one — the
  exact comparison the Phase 1 gate turns on.
- The benchmark-figure generator is still not persisted (carried from the
  2026-08-10 figure review).
- Parser documentation on the About page overstates precision in four places
  (filename regex, line numbers, trailing commas, header detection).

## Clean, for the record

All 21 citations on the About page verified against PubMed/Crossref — authors,
year, journal, volume, issue, pages, PMID, DOI — with zero errors, and eight
attributed claims checked against the papers' own text rather than memory. The
COMMON-block line numbers, the CLUSTER8 v8.00 asymmetry, 96/96/96 flags, 17+1
peaks, 75/75 Igor checks, 15 runs, and the 16-22% FDR all recomputed correctly.
No claim about Johnson's life status appears anywhere.

## Role ledger

Every role ran on every artifact (four reviewers × 11 roles). Consolidated:

| # | Role | Outcome across the four artifacts |
|---|---|---|
| 1 | Claim & data verifier — "Prove It." | The bulk of the damage. ~25 findings, including the dead GitHub link, the false `data/oracle/` claim in four places, the unreproducible density figures, the stale 36-test count, and AutoDecon's count-as-sensitivity. Numbers were recomputed, not read. |
| 2 | Citation & reference validator — "DOI or Die." | All 21 About-page citations verified clean against PubMed/Crossref; 8 attributed claims checked against source text. Findings were scope and format: Carlson 2013 generalized past the methods it compared, DynPeak credited with a posterior it does not compute, "6× false positives" really 3–33× per group, one missing PMID. |
| 3 | Consistency auditor — "Cross-Examiner." | Found the cross-document contradictions: About vs reference-code on redistribution, validation-status vs llms.txt on test count, igor-validation describing finished work as pending, handoff status contradicted by 201 committed files. |
| 4 | Adversarial reviewer — "Reviewer 2." | Two kill criteria that could not fire; selective reporting of the benchmark run (FDR quoted, sensitivity suppressed); "independent corroboration" that is circular; the undisclosed `includeTruncated` knob moving sensitivity 37.3→26.9%. |
| 5 | Line editor — "Kill Your Darlings." | Few findings; prose judged disciplined across all four. A fragment, one hedge that undercut its own evidence, mixed hyphen/en-dash ranges. |
| 6 | Methods / domain expert — "RTFM." | Mechanism errors: zero-error claim wrong (silent non-detection, not breakage), "replicate statistics" misdescribed, error-window circularity undisclosed, marginals promised as a joint posterior, three incompatible error metrics used interchangeably. |
| 7 | Reuse auditor — "Reinventing the Wheel." | Phases 1–2 of the handoff already exist and it did not say so; `score()` duplicated three ways; `score_against_truth.ts` hand-rolls parsing that `src/core/csv.ts` owns; constants retyped in three documents and already drifted. |
| 8 | Naive-reader accessibility — "You Lost Me." | Undefined-on-first-use terms concentrated in About's "How CLUSTER works" and the handoff's Phase 1/3; "75/75 checks" never defines a check. |
| 9 | Density & figure-first — "Show, Don't Tell." | Zero figures and zero tables across ~2,850 words (About) and both long docs. Named replacements given, including the simulated-vs-real trace the Phase 1 gate depends on. |
| 10 | Build & craft gate — "Ship It." | Ran against the built artifacts: link status on all 29 About URLs (1 real 404), heading tree, anchors, encoding. **Limitation recorded:** no browser was available, so the rendered About page was never inspected for layout — that check is outstanding, exactly as it was for the figure that shipped with mojibake. |
| 11 | Argument order — "Start With the Problem." | Both long docs bury their most decision-relevant fact past the midpoint, and both amendments sit downstream of the text they invalidate. About leads with a 900-word file-format manual before saying what the method does. Deferred, not fixed. |
