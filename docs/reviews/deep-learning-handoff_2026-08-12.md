# Murderboard run — docs/deep-learning-handoff.md

- upstream:  syncytium2/murderboard @ b2b2ba2d6c42cef07850bd7be2db3aa4d019151c
- vendored:  b2b2ba2d6c42cef07850bd7be2db3aa4d019151c
- freshness: current (verified `--refresh` at review time, exit 0)
- artifact:  docs/deep-learning-handoff.md
  (bb1df304ea4ec3ec7968ede5ff2c12747527d600 → 5d84cb750e4839b045a0e833c2fe7c614b5658cc)
- roles:     11 of 11 run
- rounds:    5 blind verify rounds to clean

**Context.** Requested as "evaluate this handoff; advise", the day the
`downLow` repository was created to receive this plan (see
`docs/dl-new-repo-handoff.md`, the packing list, written the same day).
All 11 roles ran as parallel subagents against the 2026-08-08 artifact
(as corrected 2026-08-10). Fixes were applied in one synthesis pass, then
blind re-review iterated until a blind pass produced nothing beyond
adjudicated-declined items and nits.

## Role ledger

| # | Role | Result |
|---|---|---|
| 1 | Claim & data verifier — "Prove It." | 36-claim ledger; 24 exact matches (every headline number recomputed), 2 major (fortran 60.8% attributed to a scorer that cannot produce it; AutoDecon ~98% stripped of its detection-count ⚠), 7 minor (incl. demo.ts "~7% CV" is uniform ±7% ≈ 4% CV; "batch runner" mislabel; 15–20% vs measured 16–22% FDR) |
| 2 | Citation & reference validator — "DOI or Die." | 14 references verified, zero fabricated; found real 1990s neural-network prior art the gap claim omitted (Prank 1997 *Hum Reprod Update* 3:215–34; 1994 *Pediatr Res* 35:A82); AutoDecon ~98% mis-sourced (merges two datasets); license claim overstated its source; six named tools carried no citations (verified metadata supplied). Later self-correction: the gap re-check was four independent web-search framings plus follow-ups, not five, and used no direct database queries |
| 3 | Consistency auditor — "Cross-Examiner." | 1 blocking (header "Phases 1-2 built" vs stale §6 body — Phase 1 was already built and gated, PULSAR head-to-head already run), 4 major (16–22% FDR drift; AutoDecon caveat dropped; fortran-row provenance; stale PULSAR instruction), 3 minor. All repeated numbers reconciled against validation-status.md |
| 4 | Adversarial reviewer — "Reviewer 2." | 4 blocking (calibration kill criterion had no power to fail — training optimizes toward it and a base-rate predictor passes it; CLUSTER-agreement evaluation circular with a pre-loaded excuse; no trivial-baseline kill — a Platt-scaled t-score could pass every gate; broad training corpus had no validation gate), 10 major, 8 minor. Spotted that `data/digitized/` (Webster 1991) was never mentioned |
| 5 | Line editor — "Kill Your Darlings." | 2 blocking (§7 re-inherited the retracted ~1%-as-published framing; "that benchmark cannot be published" pointed at the wrong benchmark), 8 major (incl. the hollow gate — operative numbers lived only in the correction blockquote; the "do not tune until FDR reaches zero" inversion), 20 minor |
| 6 | Methods / domain expert — "RTFM." | Grounded in hormoneBayes, AutoDecon, Carlson 2013 full texts + SBI literature. 3 blocking (per-timepoint output is the marginal posterior, not "the posterior over pulse times", and a fixed-dimension flow cannot fix it — the space is transdimensional; hormoneBayes mischaracterized as deconvolution with "calibrated" posteriors; irregular-sampling constraint unmet by the built generator and a Δt channel can't deliver it), 8 major (incl. value/error is not CLUSTER's statistic; weight/parameter budget arithmetic inconsistent; SBI posteriors are prior-dependent and empirically overconfident — Hermans 2022), 4 minor. Self-correction: its own gap search was one query — ⚠ |
| 7 | Reuse auditor — "Reinventing the Wheel." | 2 blocking (Phase 1 written as future work when `simulate_benchmark.py` already is the deliverable; §5 asset list omitted every Phase 1–2 artifact), 9 major (incl. **new measurement**: committed broad benchmark scores igor 37.3%/16.5% FDR, fortran 62.9%/21.9% — igor below the script's own gate band; hormoneBayes code is public; `sbi`/BayesFlow toolkits unmentioned; demo.ts does not match make_synthetic.py as claimed), 2 minor |
| 8 | Naive-reader accessibility — "You Lost Me." | Per-section verdicts: 7 of 10 sections blocking for a cold reader (CLUSTER never described or cited; GnRH/LH/CV never expanded anywhere in the repo; FDR/false-positive-rate conflation; `igor`/`fortran` unexplained; Johnson's datasets not flagged unobtainable). 27 findings |
| 9 | Density & figure-first — "Show, Don't Tell." | Count table: 2,201 words, 0 tables, 0 figures. 1 major (the 9-quantity correction blockquote should be tables), 2 moderate (status table; reader never shown the data), 3 minor. Explicitly cleared §7 and most prose as load-bearing — no caveat cut |
| 10 | Build & craft gate — "Ship It." | Full mechanical table: all links, paths, dates, versions, code identifiers verified; only markdown style nits (MD013/MD060, house style). Re-run in full in every blind round; final round: 10/10 links, 47/47 paths, 3/3 tables, 49 § refs, 0 over-width prose lines |
| 11 | Argument order — "Start With the Problem." | Spine sound, cold open correct; 2 major (§8 held scoping decisions that gate Phases 0–3; status truth fragmented across header/blockquotes/companions), 3 minor, 2 nits; 1 explicit no-finding (correction blockquotes are correctly placed — do not consolidate into a changelog) |

## What changed (consolidated adjudications)

The artifact was substantially rewritten. Major fixes, grouped:

**Numbers and retractions**
- 15–20% FDR → measured **16–22%** (also fixed in `dl-new-repo-handoff.md`).
- AutoDecon "~98%, so the ceiling is known" → **128 detections / 130 pulses
  ⚠ (a count, not a scored sensitivity)** + the paper's own ~96% on a
  different corpus; "6×" labeled pooled (3–33× per group).
- "fifty-page opinion" → roughly forty pages (240:377–415 = 39).
- demo.ts noise: uniform ±7% ≈ 4% CV, not "~7% CV"; described as a reduced
  model, not "the same LH model".
- "zero false positives in every configuration tried" → holds at defaults;
  the "27-point sweep" does not exist (validation-status reproducibility
  gaps).
- fortran 60.8% marked ⚠ unreproducible from the committed scorer.
- §7 no longer re-inherits the retracted ~1%-published framing.
- **New measurement recorded**: broad committed benchmark — igor 37.3%
  sens / 16.5% FDR, fortran 62.9% / 21.9% (reproduced twice independently);
  igor sits below the script's own printed 50–65% gate band — logged as an
  unresolved item in Phase 1.

**Gates given power to fail**
- Phase 1 gate: operative numbers promoted into the gate body as an
  anchors table; band derivation stated (drawn 2026-08-10 from the Johnson
  anchors, same day the dense profile passed inside it — "passed" reads
  "consistent with anchors"); density honesty (dense = 30 pulses/record,
  the top of Johnson's 17–30 range, i.e. the easiest FDR case); matching
  rule stated; gate-scope note (the five simulator gaps plus drift/dt/
  half-life are ungated); CLUSTER-independent realism checks required;
  expert test given blinding/n/power terms; gate-drift across three
  locations named, with the fix (state it once, in the script, exit
  non-zero).
- Calibration kill criterion → **calibrated AND sharp under simulator
  shift**, with skill vs the base-rate predictor, SBC/expected-coverage
  (conditioned on the Phase 0 target choice), the Hermans overconfidence
  warning + ensembling plan, and the statement that real-data calibration
  is unverifiable in principle.
- New kill criteria: beat the **calibrated t-score baseline** (Platt-scaled
  CLUSTER t trace — the project's null hypothesis, added to Phase 2);
  robustness-under-shift; client-side budget (numeric table in §4, frozen
  at Phase 3 start).
- Sim-to-real: disagreement metric pre-registered; `data/digitized/` +
  `tools/score_webster1991.ts` added as the adjudicator (with its
  CLUSTER-lineage limit stated); spike-in tests added.

**Methodological corrections**
- Output restated as the **marginal** posterior **under the simulator's
  prior**; autoregressive factorization named as the joint route; the
  normalizing-flow fallback removed (transdimensional space); prior must
  ship as a cited table with sensitivity measured.
- hormoneBayes recharacterized (latent on/off state-space model,
  particle-Gibbs MCMC; not deconvolution; "quantified" not "calibrated"
  uncertainty; it already emits a per-timepoint latent-state posterior —
  amortization is the actual differentiator); its public code linked.
- value/error "is CLUSTER's own statistic" corrected → feed the actual
  mScore t trace (fortran variant — the igor form is not scale-invariant),
  with the §3 firewall interaction recorded.
- Budget arithmetic fixed (≤400 KB ↔ ~100k fp32 / ~400k int8; the 3–8 MB
  onnxruntime-web WASM runtime named and lazy-loaded; <100 ms latency
  bound).
- Δt-channel limitation and irregular-grid generator gap stated; marginal
  vs conditioning-on-half-life reframed (marginalize by default).
- Phase 3 pointed at `sbi` / BayesFlow instead of hand-rolling; AutoDecon
  head-to-head via local `pulse_xp.exe` noted.

**Structure and readability**
- §0 glossary added: six tools with verified citations (CLUSTER's for the
  first time), GnRH/LH/CV/FDR/IPI/Δt/calibrated/IRB-IACUC/proper scoring
  rule/normalizing flow/autoregressive factorization defined.
- §1 rewritten: 1990s prior art added; gap claim narrowed to "modern";
  re-check recorded honestly (four web-search framings, no database
  search — ⚠ still owed, queries below).
- Status: header + §6 phase table (phase · deliverable · status · gate);
  Phase 1 marked built-short-of-spec with 5 prioritized gaps (portal GnRH
  model first); Phase 2 status includes the finished PULSAR head-to-head
  (with its looser-matching caveat).
- Scoping decisions moved out of §8: target choice + collaboration →
  Phase 0 (with label-construction rule); per-hormone vs conditioning →
  Phase 1. Phase-inversion acknowledged in Phase 0 (Phase 1 ran before
  Phase 0; sunk cost, not momentum).
- Anchor/caveat tables added; caveats converted to lists; "look at the
  data first" instruction added (with the honest note that the 2026-08-10
  figure's generator was never persisted).
- ~40 line-level fixes (ambiguous antecedents, undefined terms at first
  use, referent-free relative words, the "do not tune until zero"
  inversion, "degrade to CLUSTER" → "additive, never a replacement").

**Companion files touched**
- `docs/dl-new-repo-handoff.md`: 15–20% → 16–22%; run_csv.ts description;
  §4 gate band reconciled to 55–60 with measured values; `data/extracted/`
  "eleven real series" → three real + test waves.
- `tools/simulate_benchmark.py`: docstring scope fix (Carlson 2013 biases
  the four methods it compared; CLUSTER not among them).

## Declined (no-change), with reasons

- §2 objections × §3 answers as a table — raised three times, declined
  three times: the bold-key mapping already works and the prose is
  load-bearing.
- §5 asset list as a table — the caveats resist cells.
- Consolidating the dated correction blockquotes into a changelog — role
  11's explicit no-finding: corrections belong beside the instructions
  they amend.
- Moving §0 to an appendix — kept as handoff-reference convention; a
  "skim and return" pointer added instead.
- MD013/MD060 lint on table rows — house style (matches
  validation-status.md).
- "particle-Gibbs MCMC" vs About.tsx's "sequential Monte Carlo" — both
  correct; the doc keeps the paper's own term.

## Verify rounds

| Round | Reviewers | Outcome |
|---|---|---|
| 1 (initial team) | 11 parallel role agents | ~90 findings; fixes applied in synthesis |
| 2 (blind) | claims/consistency · judgment · mechanical (role 10 full) | mechanical clean but for style; judgment+claims found regressions my fixes introduced (ghost §4↔Phase 3 quote; unstatable "passed" rule; unrecorded search queries) and new items (gate stated in four drifted places; dense scoring not reproducible without a `--dir` flag; IRB→IACUC). Fixed |
| 3 (blind) | single full-checklist agent + role 10 full | 4 major (dense profile matched to the easiest reference case; §3↔Phase 4 calibration contradiction; t-trace channel needed the fortran variant; header overstated the search re-check), 12 minor. Fixed |
| 4 (blind) | single full-checklist agent + role 10 full | 2 major (companion-doc contradiction on `data/extracted/` counts; Platt scaling misdescribed as one-parameter), 12 minor. Mechanicals fully clean; all recomputes exact. Fixed |
| 5 (blind, final) | single full-checklist agent + role 10 full | see closing status below |

PASS 2 (follow-up against the original finding list) ran after the blind
passes: every round-1 blocking and major finding verified **fixed** in the
final artifact; no finding **moved**; the declined list above is complete.

## Residual ⚠ — for a human to resolve

1. **Veldhuis & Johnson 1994** (*Methods Enzymol* 240:377–415) — paywalled,
   unread. Phase 0 depends on it; nobody has checked
   `simulate_benchmark.py` against the field's simulation-testing
   methodology. The cheapest outstanding derisking step: get the PDF.
2. **Veldhuis & Johnson 1986** (*Am J Physiol* 250:E486–93) — paywalled;
   wanted for the lit library (findings that rest on it were verified
   against the repo's line-by-line-validated port instead).
3. **The gap premise** was re-checked by web search only (queries below);
   a direct PubMed / Scholar / preprint-server search is still owed before
   Phase 0 clears.
4. **fortran 60.8% not reproducible** from the committed scorer
   (`score_against_truth.ts` pins `variant: "igor"`); one-line fix
   recommended, not applied (code out of doc-review scope). Same for:
   `--dir` flag + non-zero gate exit in `score_benchmark.ts`, and its
   header comment contradicting its printed gate.
5. **igor 37.3% broad-corpus sensitivity** sits below the script's own
   50–65% gate band — recorded as an unresolved item in Phase 1; needs a
   decision (band wrong for igor, or corpus wrong), not averaging.
6. **LH kinetics uncited** in `data/synthetic/README.md` (flagged in §5).
7. **Webster 1991 permission** primary record still being chased
   (`next-steps.md` §1, carried).
8. Six citations added this review (Prank 1997, *Pediatr Res* 1994, sbi,
   BayesFlow, Hermans 2022, Rubanova 2019) were verified by web lookup but
   have no PDFs in the lit library; `MURDERBOARD_LIT` was unset during
   this run — set it so want-lists persist.
9. `docs/validation-status.md` has a damaged tail (~L330–379); already
   tracked in `next-steps.md` §6 — not fixed here (different artifact).

## Appendix — literature-gap search queries (2026-08-12, WebSearch)

Independent framings (role 2):

1. `deep learning neural network pulse detection hormone concentration time series LH pulsatile 2025 2026`
2. `"simulation-based inference" OR "neural posterior estimation" hormone pulse detection amortized endocrine time series`
3. `machine learning pulse detection cortisol LH GnRH secretion time series convolutional neural network detect secretory pulses`
4. `arxiv biorxiv neural network detect pulses hormone secretion time series deconvolution deep learning endocrine 2026`

Follow-up (not an independent framing):

5. `"neural network" "episodic hormone secretion" clinical routine Pediatric Research 1994 abstract pulse detection`

Adjacent-work verification:

6. `machine learning menstrual cycle phase classification wearable data hormone trajectory prediction deep learning`
7. `"hormone trajectory" prediction machine learning longitudinal estradiol LH forecasting model`

Independent single-query check (role 6, self-flagged as insufficient):

- `deep learning neural network pulse detection hormone time series LH GnRH cortisol detector 2025 2026`

Result: no learned pulse detector for serial hormone assays found; nearest
hits were endocrine trajectory prediction and wearable cycle-phase work,
plus the 1990s ANN attempts now cited in §1.
