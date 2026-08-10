# Validation status

Honest accounting of what has and has not been checked, so the claim in the
README and on the site can be matched against reality.

_Last updated: 2026-08-10 (v0.2.0)._

> The reference Fortran and Igor sources are **not committed** — third-party
> code we cannot redistribute. See `docs/reference-code.md`. The oracle output
> in `data/oracle/` is committed, so the tests below run without them.

## What is verified

- **The `igor` variant is validated against Igor Pro.** All 15 runs of the
  matrix in `docs/igor-validation.md` were executed in Igor on 2026-08-10 and
  diffed point by point: error array, up flags, down flags, pulse array and
  t-score trace, across every error model, asymmetric windows and thresholds,
  the dvmp gate, zero-termination, and all three datasets. **75/75 checks pass.**
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
- **36 unit tests** (`npm test`), in three kinds:
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
  without error (11 files, 16–145 points).

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

**Caveats.** The parameters behind his Cluster column are not recorded, so the
comparison is approximate; a true positive is counted when a generating pulse
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
| AutoDecon (published, same data) | ~98% | — |

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

Tested directly: a density-matched corpus (40 records, 145 points, 10-minute
sampling, ~4% CV, ~30 pulses each — Johnson's shape) gives

    igor     59.0% sensitivity, 0.4% FDR
    fortran  59.1% sensitivity, 0.4% FDR

against his published Cluster figure of ~58%. So the simulator reproduces
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

## What is NOT verified

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
- **No expert-annotated pulses.** "Correct" still means "matches the reference
  implementations", not "matches what an endocrinologist would mark".

So the claim "validated against the Igor Pro implementation" is now **true**,
and independently the `fortran` variant reproduces CLUST5 exactly at its
defaults.

## Finding: Igor's loop 1200 is a do-while, so nPeak=1 marks a point

The Igor diff caught a real bug in this port. Igor writes loop 1200 as a
`do … while(j < nPeak - 1)`, which always executes once; the port used
`for (k = 0; k < nPeak - 1; k++)`, which executes **zero** times when
nPeak = 1. So at nPeak = 1 Igor marked a pulse point and the port marked none.

Invisible at nPeak ≥ 2, where both mark `nPeak - 1` points — and the app's
default is 2, so no shipped analysis was affected. But **the parameters stored
in the Igor panel are nPeak = 1, nNadir = 1**, so it would have bitten the
first person to reproduce that session. Fixed by transcribing the do-while
literally; pinned by a unit test and by oracle runs B and D.

This is the case for oracle testing in one paragraph: reading the source
carefully got the loop bound right in spirit and wrong at the boundary, and
only running the real thing exposed it.

## Finding: the Fortran swaps its windows on the downs pass

Discovered while building the oracle, and worth recording because it is not in
any documentation.

`CLUST5.MPF` declares the shared parameter block in **two different orders**:

```
line  38  main:  COMMON /MISC/ TVAL, NNADIR, NPEAK
line 539  UPS:   COMMON /MISC/ Z,    NNADIR, NPEAK     <- same order
line 465  DNS:   COMMON /MISC/ Z,    NPEAK,  NNADIR    <- exchanged
```

Because a COMMON block matches by position, not by name, `DNS` reads the two
window sizes swapped: its base window takes `NPEAK` and its test window takes
`NNADIR`. `do_cluster.mpf` (CLUSTER8 v8.00) carries the identical asymmetry, so
this is long-lived behavior in the Fortran lineage, not a v6.01 slip.

It may well be deliberate: on a *decrease* the earlier window is the peak and
the later one is the nadir, so exchanging the sizes is arguably the correct
thing to do. Igor's `UPorDN` takes the opposite view — `ClusterMain` passes
`(nPeak, nNadir)` in the same order for both directions, treating the arguments
as "size of base window" and "size of test window" regardless of direction.

**Consequences.** The two agree whenever `nPeak == nNadir`, which covers the
app default (2, 2) and the parameters recorded in the Igor panel (1, 1), so no
shipped analysis is affected. They diverge for asymmetric windows: on `gnrh`
with nNadir 1 / nPeak 3, 50 of 96 down flags differ, and swapping the windows
reproduces the Fortran exactly. This port follows Igor in both variants.
`src/core/oracle.test.ts` pins the divergence so it cannot change silently.

**Open decision:** should `variant: "fortran"` reproduce the swap, given that
it claims to be the original program? Left as-is pending a call, because it
changes numbers.

## Pipeline

### 1. Capture the Igor oracle — DONE (2026-08-10)

Run in Igor; 15 CSVs in `data/oracle_igor/`; 75/75 checks pass after fixing the
do-while bug above. `np_ValidateAllTo` needed an HFS path
("Macintosh HD:Users:…"), not POSIX — the function now tries three forms.

**Answered: Igor does not swap its windows on the downs pass.** Runs C
(nPeak 3 / nNadir 1) and D (the mirror) both match this port, so the swap seen
in `CLUST5.MPF`'s `COMMON /MISC/` really is specific to the Fortran lineage.
The port's behaviour was correct.

### 1b. Extend the Igor oracle — OPTIONAL

The highest-value remaining item, and the only thing standing between the repo
and its own validation claim. Everything except the Igor session is built:

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

### 3. Run the murderboard over the docs and the About page — NOT DONE

`syncytium2/murderboard` (anti-slop document review: citation validator,
claim/data verifier, consistency auditor) is **not vendored into this repo**, so
it never ran. The About page is citation-dense and public; it is exactly the
kind of deliverable that harness exists for. Vendor it and run it over
`src/About.tsx`, `docs/deep-learning-handoff.md`, and this file.
