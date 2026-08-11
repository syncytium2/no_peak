# Murderboard run — documentation after the Webster digitisation

- upstream:  syncytium2/murderboard @ b2b2ba2d6c42cef07850bd7be2db3aa4d019151c
- vendored:  b2b2ba2d6c42cef07850bd7be2db3aa4d019151c (re-vendored during this run — see below)
- freshness: current (exit 0, after re-vendoring; the gate blocked at exit 1 first)
- artifacts: ten documents, hashes before → after in the table below
- roles:     11 of 11 run
- rounds:    2 apply rounds + 1 blind verify + 1 citation pass (see "Verify")

## Why the run started by stopping

`tools/murderboard_freshness.sh --refresh` exited **1 — STALE**: this repo carried
`249a488` against upstream `b2b2ba2`. The skill forbids proceeding, so all four
vendored files were re-fetched and re-stamped before any role ran. Diffing the
fetched copies against ours with the stamp lines excluded showed the content was
byte-identical, so no rule was actually missed this time — but that is a fact
established *after* re-vendoring, not a reason to have skipped it.

## Artifacts

| File | before | after |
| --- | --- | --- |
| `src/About.tsx` | 94a9ea65 | changed |
| `public/methods.html` | 7180999f | changed |
| `public/llms.txt` | 5cda24db | changed |
| `index.html` | b60da5c6 | changed |
| `README.md` | c7bc9249 | changed |
| `data/synthetic/README.md` | d9b2fa5e | changed |
| `data/digitized/README.md` | 16a27871 | changed |
| `docs/figure-data-permissions.md` | 55638630 | changed |
| `docs/validation-status.md` | 855b90e0 | changed |
| `docs/reviews/2026-08-11_expert_review.md` | f7f4f8bf | changed |

Also corrected: `tools/make_synthetic.py`, `tools/score_webster1991.ts`,
`docs/deep-learning-handoff.md`.

## Role ledger

| # | Role | Findings | Disposition |
| --- | --- | --- | --- |
| 1 | Claim & data verifier | 5 blocking, 4 major, 6 minor; 40-row claim ledger | all blocking + major fixed |
| 2 | Citation & reference validator | All 24 PubMed refs and all 20 DOIs exact; no fabricated citation anywhere. 3 major, 8 minor | fixed, except the consent records — see ⚠ 10 |
| 3 | Consistency auditor | 3 blocking, 5 major, 10 minor; confirmed clean on renamed files, 70/67 counting basis, 72-vs-73 samples | fixed; anchor-routing deferred |
| 4 | Adversarial reviewer | 6 blocking, 7 high, 8 medium — **the most important role in this run** | see below |
| 5 | Line editor | ~40 findings across 11 files | factual ones fixed; prose-craft deferred |
| 6 | Methods / domain expert | ran; findings folded into 1 and 4 | — |
| 7 | Reuse auditor | no blocking; 4 medium duplications, all currently in agreement | deferred, recorded below |
| 8 | Naive-reader accessibility | per-section table; 8 BLOCKING sections | worst two fixed; rest deferred |
| 9 | Density & figure-first | count table: 17,306 words, 8 tables, **0 figures** | deferred, recorded below |
| 10 | Build & craft gate | build current and byte-identical to live; 194/194 tests; 72 links resolve; 6 findings | 2 substantive recorded below |
| 11 | Argument order | per-document verdicts; 4 documents ended on a superseded conclusion | endings fixed; reordering deferred |

## What was wrong, and mattered

**The two public pages said the opposite of the truth.** `public/methods.html`
and `public/llms.txt` both stated that *every* bundled dataset is simulated and
corresponds to no animal, experiment or measurement. Eight real digitised ewe
records had shipped that morning. These are the no-JavaScript and
machine-readable surfaces — what a crawler, a reviewer's agent, or anyone
without JS actually reads — and they carried an inversion of the single fact this
project spent the day trying to make unmistakable. Found independently by roles
1, 3, 4, 5, 8, 9 and 11.

**A retracted number was still live in three places.** 59.0% sensitivity / 0.4%
FDR appeared on both public pages and in the DL handoff, having been explicitly
withdrawn in `validation-status.md` as unreproducible and superseded by
55.8%/58.4%. The repo retracted it and then kept publishing it.

**The headline validation claim overstated what was measured.** This is role 4's
finding and it is the one worth reading twice. The claim was "67 of 70 published
pulses, 96% sensitivity, 99% precision, at the paper's own settings, given the
assay error the hormones actually had." Two constants in that error model — the
CV (8%) and the GnRH detection floor (0.06 pg/min) — are not in the paper. A
sweep, recomputed independently before accepting the finding:

| GnRH floor | sensitivity | precision | false positives |
| --- | --- | --- | --- |
| 0.00 | 96% | 45% | 81 |
| 0.03 | 96% | 83% | 14 |
| 0.05–0.06 | 96% | **99%** | 1 |
| ≥0.07 | 94% | 100% | 0 |

**Sensitivity is invariant across the whole fitted range — it was not purchased.
Precision was.** And both free constants sit at the joint optimum of the score.
The previous text said "the result is not sensitive to it", which was true of the
number that could not move and silent about the one that could — the same
pattern this repo had already caught itself in once before over a claimed
27-point sweep that did not exist.

The un-fitted half is the LH arm, whose floor **is** the paper's published assay
sensitivity (0.45 ng/ml): **35 of 38, stable across CVs from 4% to 8%**. That is
the number to quote. (Its zero false-positive count is *not* equally stable —
the blind pass caught that: zero holds only from about a 7.8% CV upward, so that
half still leans on the fitted constant.) The GnRH arm, fitted, is 32 of 32
with 1 false positive.

Also corrected on role 4's evidence:

- **"human-checked" was an unsourced upgrade.** The paper reports pulses
  identified *by CLUSTER*. Nothing says a person inspected or edited that output.
  The docs were otherwise scrupulous about "what a detector reported, not what
  the animal secreted" and then silently reinstated a human verifier.
- **This is not independent validation.** Scoring a CLUSTER port against another
  CLUSTER run is a cross-implementation consistency check; the two share a
  derivation. Worse, the Fortran variant already reproduces CLUST5 exactly at
  defaults and the 1991 analysis was that lineage — so the port's fidelity was
  not the free variable in this experiment. The reconstructed error input was.
- **The answer key contaminates the input.** The digitiser reads a marked
  sample's value from the circle centre and erases a ±14 px box around it; the
  sample pitch is 10.9 px (GnRH) and 13.1 px (LH). So at a marked pulse the pulse
  sample *and both neighbours* are annotation-derived or reconstructed — and at
  one-point windows the t-test compares exactly those. Now disclosed.
- **Both fitted floors are ~9 px on a 400 dpi scan**, the same order as the
  digitisation uncertainty itself. "The assay error the hormones actually had" is
  assumed, not established.
- **The ±1-sample match slack was undisclosed.** At zero slack the result is 66
  of 70, 94%/97% — so the headline survives, which strengthens it. Now stated.
- **The permission claim overstated its scope.** An author can give a courtesy
  blessing; they cannot license the publisher's rights or waive the terms of the
  subscription the copy came through. `data/digitized/README.md` said the
  contractual question was "the right way through it"; the document it summarises
  says the contractual position "remains unresolved and untested". Corrected to
  match.

**Smaller factual corrections applied:** the GnRH axis was misread as 0–2 pg/min
(it runs to 3; the *pulses* reach ~2.1) and that misreading had set the simulated
amplitudes; "both zero-pulse controls match exactly" was false — the one false
positive is *in* one of them, and there are three such records, not two; the
three misses were attributed to the animal with the smallest pulses "relative to
baseline" when it is the smallest in absolute terms; "0 to 170" is 171; "124 unit
tests" is 194; "11 files, 16–145 points" is 15 files, 61–145; `README.md` called
`data/digitized/` "simulated, ours"; four documents ended on "nothing has been
digitised".

## ⚠ Residual — deferred, not fixed

1. ~~**The app cannot reproduce its own headline number.**~~ **CLOSED**, and it
   was reported from the user side before the fix landed: selecting the published
   settings gave *no peaks*. Root cause exactly as roles 6 and 7 predicted — the
   preset carried windows and t-scores but not the error model, the digitised
   CSVs have no error column, so the app fell back to `Local SD`, which at
   one-point windows lets a pulse inflate its own error and hide itself (0 of 70).
   Fixed by adding an `Assay CV` model — `error = max(floor, CV × value)`, the
   shape a real immunoassay has — to `ErrorModelType`, and by making presets
   carry `errorModel` and its parameters. Loading a record and picking the preset
   now reproduces the published counts with nothing else touched.
2. **Deep links into the About page eject the reader.** (role 3) `src/main.tsx`
   routes on `hash === "#about"` exactly, so `#terms`, `#scale`, `#presets` etc.
   render the app instead of the section — including the one in-page link the
   page itself carries.
3. **Zero figures in 17,306 words.** (role 9) Two would each replace ~300 words:
   a CLUSTER schematic, and a plot of pulses-found versus data scale factor.
   Readers are unlikely to believe the scale-dependence claim from prose alone.
4. **The About page has no navigation** and its `h2`/`h3` are 15 px/14 px against
   14 px body text, so 23 sections scan as one wall. Six of its seven anchor ids
   are unreferenced — half a table of contents that was never finished.
5. **Eight sections introduce three or more undefined terms** to a cold reader
   (role 8), and audience-facing text sends researchers to repo paths they cannot
   open (the repo is private).
6. **`scripts/run_csv.ts`'s documented invocation is broken** (role 10) — the
   `node --experimental-strip-types` form fails on extensionless imports, and
   `tsx` is not a declared dependency.
7. **`README.md` mis-describes the sibling site's robots.txt** (role 10) — it
   claims the managed file *replaces* colonel-kernel's, but curl shows it is
   prepended there too, exactly as on this site.
8. **`docs/validation-status.md` lines ~298–354 are structurally damaged**:
   orphan `### 2.`/`### 3.` with no `### 1.`, a tooling list filed under "what is
   not verified", and a spliced sentence. Partially repaired; the section still
   wants restructuring.
9. **`sim_gnrh_thx_fast` generates 22 bursts, not 21** (role 1). The banner was
   corrected; `presets.test.ts`'s comment and its `< 21` bound still rest on the
   old denominator.
10. **Two consent claims are recorded second-hand, with no primary artefact.**
    (role 2) "This port is made with Michael Johnson's approval" rests only on a
    line in `docs/reference-code.md` ("Reported by R.A. DeFazio, 2026-08-10");
    "used with the permission of one of the paper's authors, obtained
    2026-08-11" names no author and cites no record, and now appears in eight
    dataset notes, three documents, the digitiser, and every exported figure.
    Both are public statements about identifiable third parties' consent. They
    need a dated primary record — an email, a note of the conversation — kept
    wherever the repo keeps such things. **This one is the user's to resolve; it
    cannot be fixed by editing prose.**
11. **Webster et al. 1991 is not verifiable from the repo** (role 2). It is not
    open access, not committed, and not in the lit cache, so a reviewer cannot
    check the protocol figures, the printed CLUSTER settings, the assay
    sensitivities, or the per-panel pulse counts that the whole digitised set
    rests on. The one verbatim quotation attributed to it
    (`tools/make_synthetic.py`, "In 4 of 5 thyroid-intact ewes…") is unconfirmed.
    Depositing the PDF in the lit library would close this.

## Verify

Round 1 applied the fixes above. A blind pass — a reviewer given the corrected
artifacts and the sources, with no knowledge of the findings or which files were
touched — was then run per the process. `npm test` 194/194 and `tsc -b` clean
after every edit; `npm run build` succeeds; the simulated data was regenerated
after the generator's comments changed and is byte-identical.
