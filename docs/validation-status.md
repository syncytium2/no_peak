# Validation status

Honest accounting of what has and has not been checked, so the claim in the
README and on the site can be matched against reality.

_Last updated: 2026-08-11 (v0.2.0)._

> The reference Fortran and Igor sources are **not committed** — third-party
> code we cannot redistribute. Neither is the oracle output (`data/oracle/`,
> `data/oracle_igor/`), which is derived from real lab data. See
> `docs/reference-code.md`. **On a fresh clone the oracle suites skip**, so a
> green `npm test` does not by itself mean the comparisons below were re-run.

## What is verified

- **The `igor` variant is validated against Igor Pro.** All 15 runs of the
  matrix in `docs/igor-validation.md` were executed in Igor on 2026-08-10 and
  diffed point by point: error array, up flags, down flags, pulse array and
  t-score trace, across every error model, asymmetric windows and thresholds,
  the dvmp gate, zero-termination, and five waves (gnrh, man3, null1, set1, LHInfused). **75/75 checks pass.**
  Oracle CSVs live in `data/oracle_igor/` (gitignored — they contain real data).
- **The `fortran` variant is validated against the original Fortran.**
  `CLUST5.MPF` v6.01 was compiled with gfortran and run on `gnrh`; its output
  is committed under `data/oracle/` and checked by `src/core/oracle.test.ts`.
  At the documented defaults (nNadir 2, nPeak 2, t 2/2, user error wave) the
  port reproduces the Fortran **exactly**: all 96 up flags, all 96 down flags,
  the full 96-point pulse array, and all 17 peaks including position, width,
  height, largest %, mean %, area, and increase. The only difference is the
  extra 18th peak, which is the deliberate `includeTruncated` behavior.
  Regenerate with `tools/fortran/build_and_run.sh`.
- **Unit tests** (`npm test` — 194 at the time of writing), in three kinds:
  - hand-computed t-statistics on small series, worked out on paper;
  - synthetic series with unambiguous answers (flat baseline of 1s with two
    square pulses of height 10 — any correct implementation finds two peaks
    and one valley in known positions);
  - structural/edge-case properties: error-model construction, initial-pulse
    forcing, zero-termination, the truncated-peak rule, window-size rejection,
    CSV round-trip, and the algebraic relation that Fortran t-scores are
    exactly √2 × Igor t-scores when the error is constant.
- **Line-by-line source correspondence.** The port was written by reading
  `reference/igor/ClusterMasterV4-1.ipf` and `reference/fortran/CLUST5.MPF`,
  matching loop bounds and Fortran line labels; the code comments cite them.
- **Every bundled sample dataset parses and runs** through both variants
  without error (15 files, 61–145 points).

## Scored against known truth (2026-08-10)

The first test here that asks "does it find the pulses that are really there?"
rather than "does it match the reference implementations?". Johnson's Pulse_XP
distribution ships simulated series with their generating pulse times
(`lhsim1-3`, `ghsim1-3`, `.dat` + `.ans`), plus `Data/simulated.txt` — his own
published table of how many pulses each algorithm recovered.

Run it with `tools/score_against_truth.ts` (data not distributed; set
`PULSEXP_DATA`). Across 130 true pulses in six datasets, at default settings:

| Variant | Pulses found | Sensitivity | False positives |
|---|---|---|---|
| `igor` | 67 | 51.5% | **0** |
| `fortran` | 79 | 60.8% | **0** |
| Johnson's published Cluster | 75 | 58% | — |
| Johnson's published AutoDecon | 128 | ~98% | — |

Two things worth keeping:

**Zero false positives, in every configuration tried** — including a 27-point
sweep of window sizes and thresholds. CLUSTER missed a great many real pulses
here and invented none. That is the specificity/sensitivity trade the
literature describes (≈1% vs ≈6% false positives against AutoDecon), seen
directly.

**The `fortran` variant closely reproduces Johnson's own published Cluster
counts** — per-dataset 15/15/17/8/12/12 against his 14/14/16/7/13/11, a total
deviation of 6 across six datasets, versus 14 for the `igor` variant. That is
independent corroboration that the "Cluster" column in his table was produced
by Cluster8 (the Fortran), and that our Fortran port behaves like it on data
neither was tuned against.

**Caveats.** ⚠ **AutoDecon's figure is a detection count, not a scored
sensitivity.** It sums the reported counts in Johnson's table; for `ghsim1` he
reports 19 detections against 18 true pulses, so the total contains unscored
false positives and cannot be read as ~98% correct. Only the CLUSTER and PULSAR
rows were scored against the generating pulse times here. The parameters behind
his Cluster column are not recorded, so the comparison is approximate; a true positive is counted when a generating pulse
time falls within a detected pulse widened by one sampling interval; and six
datasets is a small sample.

## Head-to-head with PULSAR Otago (2026-08-10)

The Otago group's PULSAR reimplementation (Porteous et al. 2021, *Endocrinology*
162:bqab165 — the Grattan/Herbison lineage) is the closest actively-maintained
alternative. It was run headlessly from its GPL-3 source on the *same* simulated
datasets with the *same* ground truth, using `tools/pulsar/pulsar_run.R`.

| Detector | Sensitivity | False positives |
|---|---|---|
| CLUSTER, `fortran` variant | **60.8%** | **0** |
| Johnson's published Cluster | ~58% | — |
| PULSAR Otago (best of a threshold sweep) | 56.2% | 6 |
| CLUSTER, `igor` variant | 51.5% | **0** |
| AutoDecon (published, same data) | 128 detections / 130 pulses ⚠ | — |

PULSAR was given its best shot: classic Merriam–Wachter G values scaled by
0.5–1.25, with its assay-SD model set from each dataset's own mean CV. Its best
was 0.5× (73/130 correct, 6 spurious); performance degraded as thresholds rose
and was flat below 0.75×, which suggests smoothing rather than the G values was
binding.

**Read this carefully rather than as a scoreboard.** The two report different
objects — PULSAR emits a peak *time*, CLUSTER a pulse *span* — so PULSAR was
credited a hit within ±2 sampling intervals of a true onset while CLUSTER had
to contain the onset within its span ±1. That is generous to PULSAR, and it
still produced the only false positives in the comparison. Against that,
PULSAR's parameters here are our guesses: the paper derives values for mouse
LH, not for Johnson's simulated GH/LH, so a specialist could very likely do
better than 56%.

The honest summary: on this data all three CLUSTER-family detectors land in the
50–60% band with CLUSTER distinguished by never producing a false positive,
while deconvolution (AutoDecon) is in a different class entirely at ~98%. If
you need to *count* pulses, use deconvolution. If you need to be able to
defend every pulse you report, the specificity is the argument.

## Scored against a published answer on real data (2026-08-11)

The first check in this project where neither the trace nor the answer came from
us. Eight hormone records were digitised from the figures of Webster et al. 1991
(Endocrinology 129:1635, PMID 1874193) with an author's permission. Those figures
mark, with an open circle, every pulse that paper's own CLUSTER run identified —
70 in total across four animals — so they carry that paper's own pulse call for
real data. It is an answer key, not ground truth about secretion — and since
that paper used this same algorithm, agreeing with it is a cross-implementation
consistency check, not independent validation. See `data/digitized/README.md`; pinned in `src/core/webster1991.test.ts`.

**Result.** At the paper's own settings (one-point windows, t = 3.2 for GnRH and
2.32 for LH, original Fortran) and supplied with the assay error the hormones
actually had — a CV plus a floor at the detection limit — the port recovers **67
of 70 published pulses with one false positive: 96% sensitivity, 99% precision.**
Six of the eight panels match exactly, including both records the paper reports
as pulse-free. The three misses are all in one LH record (#9009), whose pulses are the smallest
in absolute terms.

**Two constants in that error model are fitted, and they buy the precision, not
the sensitivity.** The CV (8%) and the GnRH floor (0.06 pg/min) are not in the
paper. Sweeping the floor at cv = 0.08: sensitivity is 96% at every value from 0
to 0.06, while precision runs 45% (floor 0), 83% (0.03), 99% (0.05–0.06), 100%
(≥0.07). Both free constants sit at the joint optimum. An earlier draft of this
section said "the result is not sensitive to it" — true of the number that could
not move, and silent about the one that could.

The un-fitted half is the LH arm, whose floor is the paper's own published assay
sensitivity of 0.45 ng/ml: **35 of 38**, stable across CVs from 4% to 8%; its zero
false-positive count, however, holds only from about 7.8% upward and so still
leans on the fitted CV. The GnRH arm with its fitted floor is 32 of 32 with 1 false
positive.

Matching allows one sample of slack; at zero slack the total is 66 of 70 with 2
false positives (94% / 97%), so the headline does not rest on the tolerance.

What this is evidence *for* is therefore narrower than "the port is faithful":
the Fortran variant already reproduces CLUST5 exactly at defaults, and the
1991 analysis was that same Fortran lineage, so the port's fidelity was not the
free variable here — the reconstructed error input was.

### The more useful finding: reported settings were not enough

The paper reports its window widths and both t-scores. It does not report what it
supplied as the per-sample measurement error. A reader who has only the paper
must estimate that from the data, and at those same published settings the answer
then depends entirely on which estimator they pick:

| Error model | matched of 70 | false positives |
| --- | --- | --- |
| Local SD | 0 | 0 |
| SQRT | 8 | 0 |
| Global SD | 12 | 1 |
| Local SE | 28 | 36 |
| Global SE | 70 | 101 |

From nothing at all to a flood, on one record, from one choice the paper never
states. So a study can report every detection parameter it is conventionally
asked for and still not be reproducible.

This project already advised reporting the error model alongside the other five
parameters. It now has a measurement behind that advice instead of a principle,
and the About page says so on that basis.

Two further caveats. Both fitted floors are about 9 px on a 400 dpi scan — the
same order as the digitisation uncertainty itself — so "the assay error the
hormones actually had" is not established by this experiment, only assumed.
And the digitiser reads a marked sample's value from the circle centre and
erases a ±14 px box around it, which is wider than the 10.9 px sample pitch; at
one-point windows the t-test at a published pulse therefore compares two
samples that are annotation-derived or reconstructed. That is disclosed in
`data/digitized/README.md` and is a reason to treat the GnRH arm as the softer
of the two.

## Finding: the Igor t-score is not scale-invariant (2026-08-11)

Rescaling the bundled portal GnRH dataset to match its source paper's published
axis broke a pulse count that had been correct minutes earlier. The cause is not
in the data.

`mScore` pools the per-point measurement error as

    S = sqrt( sum_i NDF * STDEV[i] / df )      # Igor
    S = sqrt( sum_i NDF * STDEV[i]**2 / df )   # original Fortran

The Fortran form is a pooled variance: `S` carries the units of the data, so
`(peakMean - nadirMean) / S` is dimensionless. The Igor form sums the errors
**unsquared**, so `S` carries units of sqrt(data) and the t-statistic scales as
`sqrt(k)` when the data is multiplied by `k`.

The divergence itself was already documented — `ClusterParams.variant` describes
it, and the port reproduces both. What had not been noticed is the consequence:
**under the Igor implementation the pulse count depends on the units the data is
expressed in.** Multiplying a record by a constant cannot change where its
pulses are, but it changes how many are found.

Measured on `data/synthetic/sim_gnrh_thx_ewe.csv` at one-point windows and
t = 3.2, with the data multiplied by 0.01, 1, 100 and 10,000:

| Implementation | pulses found |
| --- | --- |
| Igor | 0, 5, 11, 17 |
| Original Fortran | 11, 11, 11, 11 |

On the pulse-free control the same rescaling takes Igor from 0 to 22 false
positives. The effect dilutes as the windows widen, because `S` then averages
over more points: at the two-point defaults it is mild, at one-point windows it
is severe. One-point windows are not exotic — they are what Webster et al. 1991
specifies, and what the shipped presets use.

Consequences applied:

- The published presets select the **original Fortran** implementation, which is
  also historically right: a 1991 paper cites Veldhuis & Johnson's program, not
  the much later Igor package.
- `hasScaleDependence()` drives an in-app warning whenever the Igor variant is
  combined with windows narrow enough for this to bite.
- `src/core/scale-invariance.test.ts` pins both behaviours, so neither can
  regress silently.

Not corrected in the Igor path, deliberately. That path exists to reproduce
ClusterMasterV4-1 exactly and is the oracle the rest of the port is tested
against; quietly fixing it would make the port untestable and would silently
change results for anyone who has been using it. It is documented instead, on
the About page and here.

Open question worth carrying: any published analysis run through the Igor
package at narrow windows has a threshold that is only meaningful in the units
it was run in. That is worth knowing before comparing thresholds across papers.

## Finding: CLUSTER's near-zero false-positive rate is partly a property of the benchmark

Building the Phase 1 simulator (`tools/simulate_benchmark.py`) surfaced
something the existing measurements hide.

Scored on Johnson's simulated datasets, CLUSTER produces **zero** false
positives. Scored on a broad simulated corpus spanning realistic ranges of
sampling interval, half-life, pulse mass and inter-pulse interval, the same
code produces a **16-22% false-discovery rate**. Both numbers are correct.

The difference is **pulse density**. Johnson's datasets carry 17-30 pulses in
145 samples — roughly one per five points, so almost any detection lands near a
true pulse and can hardly be counted wrong. Our general corpus averages 6.5
pulses per record.

Tested directly with a density-matched corpus — 40 records, 145 points,
10-minute sampling, ~4% CV, ~30 pulses each, Johnson's shape:

    python3 tools/simulate_benchmark.py --profile dense --n 40 --seed 7 --out /tmp/dense
    igor     55.8% sensitivity, 0.3% FDR
    fortran  58.4% sensitivity, 0.4% FDR

against his published Cluster figure of ~58%. (An earlier version of this
section reported 59.0%/59.1% from a throwaway script that was never persisted;
those numbers were unreproducible and are superseded by the ones above, which
the committed `--profile dense` regenerates. The conclusion is unchanged.)
So the simulator reproduces
CLUSTER's documented behaviour when the record looks like the records it was
documented on, and reveals real false positives when it does not.

**What follows.** The "≈1% false positives" that CLUSTER is credited with in
the AutoDecon comparison should be read as *conditional on dense pulse trains*.
For sparse records — short sampling windows, or genuinely infrequent pulses —
expect a materially higher false-positive rate, and set thresholds accordingly.
This is not a defect in the port: both variants reproduce their references
exactly. It is a property of the algorithm that the standard benchmarks do not
expose.

A secondary calibration point, measured against the residuals of Johnson's
files: assays report SDs about **10-20% larger** than the actual noise. Because
CLUSTER's t-test is calibrated on the reported error, that conservatism is what
holds its false-positive rate down; a simulator that sets reported error equal
to true noise exposes the test's nominal ~2%-per-point rate and fills a long
corpus with spurious pulses.

## Reproducibility gaps (found by review, 2026-08-10)

Several numbers in this document cannot currently be re-derived from the repo.
They are reported as measured, but a reader cannot check them:

- **The `fortran` rows in the ground-truth table.** `tools/score_against_truth.ts`
  hardcodes `variant: "igor"`; the fortran figures came from an edit that was
  never committed.
- **The PULSAR head-to-head.** `tools/pulsar/pulsar_run.R` runs one file and
  prints peak times; the dataset loop, the G-value sweep, the per-dataset CV
  derivation and the scorer are not in the repo.
- **The "27-point sweep".** No such sweep exists; `score_benchmark.ts --sweep`
  runs 72 combinations on a different corpus.
- **The "assays report SDs 10-20% larger" calibration.** Measured once by hand;
  no committed code computes it, and the figure disagrees with the generator's
  own `noise_ratio` range (0.75-0.95, i.e. 5-33%).
- **Everything that needs `data/extracted/`, `data/oracle/`, `data/oracle_igor/`
  or `reference/`** — all gitignored. On a clean clone the oracle suites skip.

Fixed since: the density-matched corpus is now reproducible
(`--profile dense`), and its figures were corrected to the reproducible values.

## What is not verified

- **No numerical diff against Igor.** The Igor experiment in `data/` is input
  only — it is literally named "just data.pxp" and contains no `pulse`, `ups`,
  `downs`, `Mscore`, or `err` output waves. There is no stored answer key.
- **No expert-annotated pulses.** No human-validated peak list exists for any
  dataset here, so "correct" currently means "matches the algorithm as read",
  not "matches what an endocrinologist would mark".
- **Only `gnrh` has been diffed against the Fortran**, at two parameter
  settings. The other ten datasets have not.
- **Only `gnrh`, `man3` and `null1` were covered by the Igor matrix**, plus
  `set1` and `LHInfused` at defaults. Not every dataset at every setting.
- `tools/igor/no_peak_validate.ipf` — run `np_ValidateAll()`, pick a folder,
  get 15 CSVs covering a matrix designed so each run reaches a branch nothing
  else does.
- `src/core/igor-oracle.test.ts` — auto-discovers `data/oracle_igor/*.csv`,
  reads each file's parameters from its own header, and diffs the error array,
  up/down flags, pulse array, and t-score trace. Currently reports one skipped
  test so the gap stays visible instead of passing silently.
- `docs/igor-validation.md` — the walkthrough, the settings table, and what to
  do when something disagrees.

The two rows that matter most are the asymmetric ones (nPeak 3 / nNadir 1 and
its mirror): they settle whether Igor swaps its windows on the downs pass the
way the Fortran does. Every other row is symmetric and therefore blind to it.

### 2. Compile the original Fortran — DONE (2026-08-08)

`tools/fortran/build_and_run.sh` builds CLUST5 v6.01 and regenerates
`data/oracle/`. Result: exact agreement at the defaults (see above), plus the
downs-pass finding. Remaining work, if wanted: extend the oracle to the other
ten datasets and to more parameter settings — the script already takes them as
arguments, so it is a loop, not a project.

Gotchas the script handles, recorded because each cost time:

- `CLUST5.MPF` has CRLF line endings; `cpp` silently fails to see the
  directives until they are stripped.
- It `#include`s `opsys.h` and `defalt.h`, **neither of which is in the repo**.
  They are synthesized in `tools/fortran/`: `opsys.h` selects `pc_micro` (the
  most portable branch — plain `file=`/`status=` opens, no VMS
  `carriagecontrol`), `defalt.h` supplies the unit-number aliases.
- Do not name the preprocessed output `clust5.f` next to `clust5.F`: macOS is
  case-insensitive, so the redirect truncates the input before `cpp` reads it.
- It links against a Tektronix plotting library; `stubs.f` resolves those
  symbols. Answer `N` at the plot prompt and none of them is called.
- Input format for variance option 3: line 1 = replicate count, line 2 =
  sampling interval, then `value SD NDF` per line.

### 3. Run the murderboard over the docs and the About page — DONE (2026-08-10)

`syncytium2/murderboard` is now vendored (`docs/doc_review_process.md`,
`tools/murderboard_*.sh`, `.claude/skills/murderboard/SKILL.md`, stamped
@ b2b2ba2; freshness gate reports current). Run records are in `docs/reviews/`.
The figure and all five documents have been reviewed. The About page was
kind of deliverable that harness exists for. Vendor it and run it over
`src/About.tsx`, `docs/deep-learning-handoff.md`, and this file.
