# Validation status

Honest accounting of what has and has not been checked, so the claim in the
README and on the site can be matched against reality.

_Last updated: 2026-08-12 (v0.2.0)._ Open work is in
[`docs/next-steps.md`](next-steps.md).

> **How the 2026-08-12 findings below were settled, because the next reader gets
> the conclusions without the process.** Four confident claims collapsed that
> day: two apparent direction-rule passes recorded here, one explanation for the
> broad-corpus shortfall, and one "retraction" asserting a defect had never
> existed. Each was settled by going to the artifact rather than to the
> argument — the source PDF, the commit via `git show`, the paper's own page,
> the corpus itself. Two were plausible, internally consistent, and produced by
> careful reasoning from a premise nobody had checked. Where a claim below is
> about what code does, what a paper says, or what the corpus contains, it is
> recorded with the command or the page that settles it. Please keep it that
> way.
>
> But "check the artifact" reads as advice about diligence, and that is not
> what went wrong. Every failure that day consulted *an* artifact — just not
> the one that answered the question. In each case something stood in for the
> real thing because it resembled it and was easier to reach:
>
> | The proxy consulted | The artifact that answers |
> | --- | --- |
> | a working tree | the commit under discussion |
> | `git ls-files` | the filesystem (untracked files vanish) |
> | an ownership conversation | the actual set of shared files |
> | a dataset's file table | the prose above it that qualifies the table |
> | samples per half-life | two separate physical rules, which it fuses |
>
> The last is a measurement rather than a lookup and belongs on the list
> anyway: it is a quantity that resembles what you want, is easier to reach,
> and is not it. So the operative question is not "did I check?" but **"is this
> the artifact that can answer this question, or the nearest thing to it?"**
>
> One further note on *how* they were caught, because it tells you what to do
> rather than merely what to admire. Not one was caught by its own author, and
> the mechanism was not review either — in the sharpest case the author found
> their own bug, but only after a second party reported that a number would not
> reproduce and could not say why. So the working rule is the cheap one:
> **report the mismatch even when you cannot explain it, and expect the author
> to find the cause.** That needs no one to be a good reviewer of anyone else's
> code, only for non-reproduction to be reported honestly rather than
> reconciled away.
>
> **And check `git status`, not just the file.** More than one agent worked in
> this checkout that day, which is the single fact most of the day's confusion
> reduces to: a file read mid-edit, edits found and misattributed to the owner,
> and one confident retraction of a real defect written after reading a file
> that had changed twenty minutes earlier. Pinning the commit —
> `git show <sha>:<path>`, and saying which sha — is half the fix, and it is
> the half that fails silently here: uncommitted edits are in no commit, so
> pinning shows a clean file and a confident wrong answer. Before concluding
> anything about what this code does, pin the sha **and** check whether the
> tree is dirty. In a shared checkout the gap between them is someone else's
> unfinished work, not your own.

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

**Zero false positives at the default settings**, on both variants, re-run and
confirmed 2026-08-12. CLUSTER missed a great many real pulses here and invented
none — the sensitivity/positive-accuracy trade the literature describes (≈1% vs
≈6% false positives against AutoDecon), seen directly.

> **Corrected 2026-08-12.** This read "in every configuration tried — including
> a 27-point sweep of window sizes and thresholds". No such sweep exists in the
> repo and none can be reproduced, so the claim is narrowed to what the
> committed scorer actually runs. The only committed sweep is
> `score_benchmark.ts --sweep`, 72 combinations on a different corpus.
>
> "Specificity" was also the wrong word, here and below. In this literature it
> means TN/(TN+FP) and needs a true-negative count, which nothing here
> computes. What is measured is **positive accuracy** — TP/(TP+FP), the
> complement of the FDR quoted elsewhere. Urban, Johnson & Veldhuis considered
> defining a true negative for exactly this purpose and declined, because
> false positives inflate the count by creating flanking valleys (*Endocrinology*
> 1991;128:2008–14, p. 2009). This project follows them: it reports sensitivity
> and positive accuracy, and claims neither specificity nor negative accuracy.

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
defend every pulse you report, the positive accuracy is the argument.

## Scored against a published answer on real data (2026-08-11)

The first check in this project where neither the trace nor the answer came from
us. Eight hormone records were digitized from the figures of Webster et al. 1991
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
same order as the digitization uncertainty itself — so "the assay error the
hormones actually had" is not established by this experiment, only assumed.
And the digitizer reads a marked sample's value from the circle center and
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
- `src/core/scale-invariance.test.ts` pins both behaviors, so neither can
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
    npx vite-node tools/score_benchmark.ts --dir /tmp/dense
    igor     55.8% sensitivity, 0.3% FDR
    fortran  58.4% sensitivity, 0.4% FDR

against his published Cluster figure of ~58%. (An earlier version of this
section reported 59.0%/59.1% from a throwaway script that was never persisted;
those numbers were unreproducible and are superseded by the ones above, which
the committed `--profile dense` regenerates. The conclusion is unchanged.)
So the simulator reproduces
CLUSTER's documented behavior when the record looks like the records it was
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

## Finding: VJ's direction rule passes; VJ's adequacy rule is the wrong lens (2026-08-12)

Veldhuis & Johnson 1994 (*Methods Enzymol* 240:377–414) give, at pp. 388–389,
monotonic direction rules for detector error: decreasing pulse amplitude,
increasing half-life, increasing experimental uncertainty, increasing pulse
frequency and diminished sampling intensity each drive detection errors up.
They also state an adequacy rule — five or more samples per half-life and per
burst width (p. 392). Both are stated while validating deconvolution and
generalized to peak detection only loosely, so they are a strong prior, not a
bound.

Measured on the committed 200-record corpus, **42% of records fall below that
adequacy rule** on the half-life arm (median 5.49 samples per half-life, min
0.53; 30 records under 2). The burst-width arm is not computable — the
generator does not record burst width in `truth.json`. That 42% was proposed as
the explanation for the `igor` variant's 37.3% broad-corpus sensitivity sitting
under the gate band: not a broken detector, a corpus largely in a regime the
chapter says nothing resolves.

**Tested, and it does not survive.** Run `score_benchmark.ts --strata`:

| samples per half-life | n | igor sens | fortran sens |
| --- | --- | --- | --- |
| under 2 | 30 | 28.4% | 50.0% |
| 2 to 5 | 54 | 33.8% | 53.5% |
| 5 to 10 | 62 | 39.2% | 66.1% |
| 10 and up | 54 | 46.7% | 81.8% |

Two readings, and they point opposite ways:

**⚠ The apparent direction-rule pass was withdrawn the same day — see "the
sampling axis does not mean what it looks like" below.** Sensitivity does rise
monotonically across these bands in both variants, 28.4 → 46.7% for `igor` and
50.0 → 81.8% for `fortran`, and that was initially recorded here as VJ's
sampling-intensity rule reproducing. It is not: samples per half-life is a
*ratio* of two quantities whose VJ rules push it in opposite directions, and
decomposing it dissolves the result. The table is kept because it is what
`--strata` prints and because the adequacy-rule conclusion below does not
depend on it.

**The adequacy rule does not explain the shortfall, and cannot.** Even the
best-sampled stratum reaches only 46.7% for `igor`, still under the band. The
decisive case is `--profile dense`, which scores 55.8%: it lies below the
adequacy rule **by construction, not by chance**. The generator draws its
half-life from U(20, 50) minutes against a fixed 10-minute sampling interval
(`simulate_benchmark.py`, the `dense` branch), so every dense record falls
strictly inside 2–5 samples per half-life — measured median 3.63, max 4.99, and
no seed can produce otherwise. A corpus that *cannot* satisfy the rule outscores
one sampled twice as well. Sampling adequacy is a real effect here and the
wrong mechanism.

**What that reframing costs the rule.** The dense profile is deliberately
shaped like Johnson's own reference datasets, which are real endocrine
sampling protocols. If dense is structurally sub-threshold, then routine
sampling practice in this field violates VJ's adequacy rule as a matter of
course. The rule is stated while validating *deconvolution* — a harder inverse
problem, which has to resolve the secretion waveform rather than just localize
a rise — and it does not transfer to peak detection. Treat it as a description
of that harder problem, not as a standard this project or any other should
gate on, and treat future claims leaning on it with suspicion.

What actually tracks it is pulse density, which is the finding in the section
above, seen from the other side. As density rises from under 0.05 to over 0.15
pulses per sample, `igor` FDR falls 37.7% → 0.6% while sensitivity falls
57.7% → 25.5%; `fortran` runs 90.2% → 41.9% sensitivity over the same range.
The broad corpus is 32% high-density records, and those are where the misses
are.

⚠ **One caution on reading the FDR column against pulse frequency**, because it
looks like a sign violation and is not established as one: FDR's denominator is
the detection count, which itself grows with pulse frequency, so FDR can fall
while the false-positive *count* rises. Testing VJ's frequency rule properly
needs a per-sample false-positive rate, which nothing here computes yet. The
same confound runs the other way on the sampling axis — samples per half-life
is set by the sampling interval, which also sets the record length and so the
density. The two axes above are not independent.

### The sampling axis does not mean what it looks like (2026-08-12, same day)

The table above bands records by **samples per half-life**, which is
`half_life / sampling_interval`. VJ state *increasing half-life* and
*diminished sampling intensity* as separate rules that each drive errors up.
In the ratio those two pull in **opposite directions**: the ratio rises either
because the half-life got longer (VJ: errors up) or because the interval got
shorter (VJ: errors down). A monotone trend in the ratio therefore cannot be
read as either rule reproducing. That the ratio is also how VJ state their
adequacy rule is a tension in the source, not a licence to use it as a test.

Decomposed on the same corpus:

| | igor | fortran |
| --- | --- | --- |
| **sampling interval alone** (2 → 5 → 10 min) | 48.2 → 39.2 → 27.7% | 85.7 → 67.0 → 42.5% |
| **half-life alone** (5–20 → 20–35 → 35–60 min) | 35.1 → 38.5 → 38.2% | 63.9 → 60.4 → 64.0% |

The sampling-interval arm has the sign VJ predict. The half-life arm has no
trend at all, in either variant. **VJ's half-life rule does not reproduce on
this corpus, and unlike the sampling arm this is a clean negative** — half-life
is drawn independently of everything else in the generator, and measured
against the committed corpus it correlates with nothing (|r| ≤ 0.12 against
sampling interval, density, pulse mass, assay CV and record length). So this
one is not a confound artifact.

It also is not an adequacy artifact, which was the obvious escape. VJ pair the
direction rule with the five-sample rule, so the rule should only be expected
to hold in the adequate regime; below it, a short half-life is punished by
simple aliasing (the bolus decays between samples) in a way that could mask the
opposite effect. Holding the interval fixed **and** restricting to above-floor
records does not rescue it — `igor` at 2-min sampling runs 34.7 → 53.9 → 57.7%
across rising half-life (n = 19/19/20), which is the *opposite* sign, while at
5-min sampling it runs 39.8 → 33.3%. The direction flips between intervals and
between variants inside the regime where VJ's rule is supposed to apply.

⚠ **Treat this as a probable defect in the generator, not a finding about
CLUSTER — but the mechanism is open.** Two candidate explanations have been
proposed and both fail a test of their own prediction. They are recorded
because the next person will think of them too:

1. **Undiminished step.** A pulse is an *instantaneous* bolus decaying as
   `m·exp(-k·d)`, so the step at its own onset is the full mass `m` whatever
   the half-life, while a longer half-life raises the accumulated background —
   suggesting long half-lives are simply easier here. The reported SD is affine
   in concentration, `sd = cv_mid·(v + floor)`, so accumulated background does
   raise the noise the step is judged against and could in principle cancel it.
   Measured, it does not: local step-to-noise is flat (below). So the premise
   survives — but a flat local ratio predicts long half-lives are the *same*,
   not easier, so this does not account for a 23-point gain either.
2. **Window filling.** A broad long-half-life excursion fills CLUSTER's
   multi-point peak window while a narrow spike leaves it straddling the decay.
   This predicts the wrong-sign gap should shrink at `nPeak = 1` and grow at
   `nPeak = 3`. Measured at 2-min sampling above the floor, the `igor` gap runs
   **+24.5, +23.0, +20.9** across `nPeak` 1→3 — flat, and drifting the opposite
   way from the prediction. `fortran` is likewise flat at −9.3, −6.1, −6.2.
   **Rejected**: the anomaly is invariant to peak-window size.

The single-step detectability proxy (median step over reported SD at true
onsets, 2-min sampling, above floor) is **flat across half-life**: 4.51, 4.75,
4.24. Two sessions computed this independently and initially disagreed; the
discrepancy was traced to a real bug in the other computation, which located
the onset by *nearest* sample and so about half the time differenced two
pre-onset samples — pure noise rather than the pulse step. Corrected, it is
flat there too (5.60, 5.63, 4.91 on the same 19/19/20 records). A residual
level offset of about one unit between the two remains and is not worth
chasing; both agree on the shape, which is what carries the conclusion.

**The useful result is a constraint, not a story.** Flat local step-to-noise
alongside a +23-point sensitivity gain means the effect **is not local** — it
cannot be read off any single onset, which excludes every single-point
explanation at once: step size, local SD, amplitude-to-noise ratio. Together
with the `nPeak` sweep excluding window geometry, whatever this is lives in the
**multi-sample structure** of the excursion, not in individual pulses and not
in the detector's window size.

⚠ **Do not admit a third mechanism into this document without the sweep that
tests it.** Two have already been proposed, found plausible, and killed.

**What is established: the finding, not the story.** Half-life is a clean axis,
the rule fails on it, and the failure survives both the confound and adequacy
escapes. Why remains open.

### Why this axis resists interrogation, and what that implies for sequencing

There is a structural reason the half-life anomaly is hard to pin down, and it
is exact rather than approximate. In this generator the *only* timescale in a
pulse is `1/k`. The width of an excursion above a fraction `f` of its own peak
is

    t_f = ln(1/f) / k = half_life · ln(1/f) / ln2

so in samples that is `half_life · ln(1/f) / (ln2 · dt)`. At `f = 0.5` the log
terms cancel and it reduces exactly to `half_life / dt` — which *is* samples
per half-life, the ratio axis retired above as uninterpretable. Excursion width
in samples and samples per half-life are the same quantity under two names.

The consequence is sharper than "hard to interrogate". At fixed sampling,
*"sensitivity rises with excursion width"* and *"sensitivity rises with
half-life"* are the same sentence. The one mechanism still standing in the
surviving space — that a longer excursion gives more consecutive elevated
samples and so more chances to form a passing cluster — is therefore a
**re-description of the observation, not an explanation of it**, and it is
unfalsifiable on this corpus rather than merely untested.

It also retires the ratio axis a second time on independent grounds: once
because VJ's half-life and sampling rules pull opposite ways inside it, and
again because this particular effect is definitionally trapped in it.

That gives the burst-duration gap an evidentiary argument it did not have a
moment ago. Adding finite burst width `D` makes the excursion roughly
`(D + decay)/dt` wide, so width becomes separable from half-life by varying `D`
at fixed half-life. Porting the square-burst model from `tools/make_synthetic.py`
is therefore not only the physiologically defensible choice — it is the
enabling change that makes this axis testable at all. That is the strongest
current reason to sequence it first.

Independently of the cause, **the generator has no burst-duration model at
all** — a pulse has no width. That gap is already recorded as Phase 1 work in
`docs/deep-learning-handoff.md`, where the square-burst model in
`tools/make_synthetic.py` is noted as never having been ported across. Real
bursts have finite width (Urban's FSH burst half-duration is 10.6 min), so
closing it is worth doing on its own merits before anything trains on this
corpus. It should *not* be assumed to be the fix for the half-life anomaly
until something demonstrates that it is — but it is very likely the change
that makes the anomaly *testable*, which is a different and better reason to
do it first. See the next section.

**And the sampling arm is not clean either.** In this generator, density is
roughly `sampling_interval / mean_ipi`, so a coarser interval mechanically
means denser records — the two cannot be separated by stratifying, only by
resampling one record at several intervals, which nothing here does. The FDR
column gives the confound away: it runs 33.3% → 1.5% (`igor`) across the same
interval bands, which is the density signature from the section above, not a
sampling signature.

**The floor reading is untestable here — not refuted.** Urban et al. 1991
varied sampling over 5/10/15 min at a 142-min half-life — 9.5 to 28.4 samples
per half-life, entirely *above* VJ's floor — and reported "no significant
differences by analysis of variance in peak discrimination … among 5-, 10-, or
15-min sampling intensities" (p. 2012). That suggests the rule is a floor below
which detection degrades rather than a gradient that keeps paying above it,
which would reconcile Urban's null with this corpus's effect.

Restricted to the 116 records above the floor, the interval effect does
persist — `igor` 49.5 → 37.3 → 31.3%, `fortran` 85.3 → 64.0 → 52.1%. But that
is **not** evidence against the floor reading, because restricting to
above-floor records does not decouple interval from density: the 6× density
confound above is still present inside that subset. The surviving effect is as
attributable to density as to sampling, which is the same objection that
retired the axis in the first place. Recorded as neither established nor
disproved. The practical consequence is unchanged — keep it out of the gate —
but the reason is that the corpus cannot decide it, not that it is wrong.

The confound is exact rather than approximate, and worth stating precisely
because it explains why no stratification rescues this axis. Since
`n = max(24, duration/dt)`, once that floor stops binding the record length
scales with `dt` and pulses-per-sample reduces to `dt / mean_ipi`, with the
record length cancelling out. Measured against that prediction:

| sampling interval | n | measured density | `dt / mean_ipi` |
| --- | --- | --- | --- |
| 2 min | 63 | 0.0405 | 0.0390 |
| 5 min | 76 | 0.1122 | 0.1108 |
| 10 min | 61 | 0.2399 | 0.2349 |

A 6× density swing across the three bands. The sampling axis is a density axis
wearing a sampling label.

**Verdict: this corpus cannot test VJ's sampling rule, and no stratification
of it will.** The honest reading of the Urban null is that he manipulated
sampling on a *fixed* underlying signal while this corpus varies everything at
once. Testing the rule properly needs the generator to emit one record at
several sampling intervals — a small change, and the right next piece of work
on this axis.

### The two clean axes: amplitude passes, assay CV does not (2026-08-12)

Pulse amplitude and assay CV are the axes nothing else in the generator is
drawn from, so they test VJ's direction rules without the sampling-interval
confound. Both are now recorded per record in `truth.json` and stratified by
`--strata`. VJ predict that decreasing amplitude and increasing experimental
uncertainty each drive detection errors up, so sensitivity should rise with the
first and fall with the second.

| | igor | fortran |
| --- | --- | --- |
| **amplitude** (log median mass / basal, four bands) | 28.3 → 30.5 → 43.0 → 50.5% | 53.9 → 62.2 → 67.5 → 67.6% |
| **assay CV** (under 0.075 → 0.125 and up) | 48.2 → 33.8 → 39.2 → 32.9% | 69.6 → 60.5 → 67.0 → 57.9% |

**Amplitude passes cleanly** — monotone increasing in both variants, and
`fortran`'s FDR falls across the same bands (25.3% → 14.4%), so the sign is
right on both error types. Amplitude is drawn independently of everything else
in the generator, so unlike the sampling axis this one is not standing in for
density. **It is the only one of VJ's five direction rules this corpus
currently reproduces** — the sampling rule is untestable here, the half-life
rule fails, the CV rule is unresolved, and the frequency rule needs a
per-sample false-positive rate nothing computes.

**Assay CV does not.** The endpoints have the right sign in both variants
(48.2 → 32.9% and 69.6 → 57.9%), but the middle two bands invert, and they
invert *the same way in both variants* — which argues against detector noise
and for something in the corpus.

⚠ **This is not yet a finding, and the reason is worth stating.** Each band
holds ~50 records scored once, with no run-to-run error bar anywhere in this
project's benchmark numbers. A four-point monotonicity check on single runs can
be broken by sampling noise as easily as by a misspecified generator, and
nothing here can currently tell those apart. Resolving it needs replication —
several seeds per condition, reporting spread — which is the first concrete
thing this benchmark needs that it does not have. Until then, record the CV
axis as unresolved rather than as a failure.

## Reproducibility gaps (found by review, 2026-08-10)

Several numbers in this document cannot currently be re-derived from the repo.
They are reported as measured, but a reader cannot check them:

- **The `fortran` rows in the ground-truth table.** ~~`tools/score_against_truth.ts`
  hardcodes `variant: "igor"`~~ — **closed 2026-08-12**: the scorer now runs both
  variants on every invocation, so both rows are derivable from committed code.
  **Fully closed 2026-08-12**: both rows were then re-derived and reproduce
  exactly — `igor` 67/130 (51.5%) and `fortran` 79/130 (60.8%), zero false
  positives, with the per-dataset `fortran` counts 15/15/17/8/12/12 matching
  the published table. Run twice from independent sessions, agreeing to the
  digit. The data comes from `Data/` inside `AutoDeconSoftware.zip` in the
  owner's Dropbox — extract it to a scratch directory and point `PULSEXP_DATA`
  at that:

      PULSEXP_DATA=/tmp/pxdata npx vite-node tools/score_against_truth.ts

  What remains is a distribution limit rather than a reproducibility one:
  Johnson's datasets are not redistributable, so a reader with only a clone
  still cannot check either figure. That is what the three public surfaces
  (`index.html`, `public/methods.html`, `public/llms.txt`) now say.
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
