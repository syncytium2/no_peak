# custard scored against CLUSTER on the benchmark (2026-09-01)

A third detector was run on `data/benchmark` with this repository's own hit
rule. It is **custard** (`TDcustard2`), an unpublished event detector from the
`interface2` calcium-imaging repository, loosely modelled on CLUSTER.

This record lives here because this is where someone would look for "has
anything else been scored on our benchmark?". **The harness and the write-up
live in `interface2`**, commit `c48ca11a` on branch `custard-hormone-benchmark`:

- `docs/custard_hormone_benchmark_2026-09-01.md` — the full note
- `tools/custard_hormone_benchmark/` — runners, scorers, README, and `results/`
  with the scored summaries

## Deliberately not on the site

Not in `validation-status.md`, not on `/methods`, not in `llms.txt`. custard is
unpublished, undistributed and uncitable, and it was built for a different
signal, so a reader of the site could not act on the comparison. PULSAR earned
its place there by being published, maintained, GPL-3 and in this domain;
custard is none of those. A benchmark in which the author's other tool beats one
of our two reference implementations reads as promotion rather than validation.
Recorded, not published — and if the question is reopened, this paragraph is the
prior answer.

## Method

Unchanged from `tools/score_benchmark.ts`: a true pulse counts as found when its
onset falls inside a detected span widened by one sampling interval at each end,
each detection credited at most once. Both sides were swept — 84 parameter
combinations for custard, the built-in 72 for each CLUSTER variant — so the
comparison is a frontier rather than one operating point.

custard and CLUSTER do not report the same object. CLUSTER emits a pulse span
anchored on a nadir window; custard emits a peak and an FWHM. Three span
definitions were scored; they agree to within about a point, so nothing here
turns on the choice.

## Result

200 records, 1291 true pulses, broad profile. Best sensitivity at a matched
false-discovery ceiling:

| FDR ceiling | custard | `fortran` | `igor` |
|---|---|---|---|
| ≤ 1% | **35.7%** | — | — |
| ≤ 2% | **41.1%** | 33.2% | — |
| ≤ 5% | 50.0% | 50.7% | 34.2% |
| ≤ 10% | **54.9%** | 52.3% | 38.6% |
| ≤ 15% | 54.9% | **57.6%** | 42.8% |
| ≤ 25% | 59.9% | **63.0%** | 45.3% |

On a dense corpus regenerated with `--profile dense --n 40 --seed 7`, where
every detector runs at near-zero FDR, it is a pure sensitivity race and not
close: `fortran` 85.4%, custard 67.6%, `igor` 65.5%.

So custard beats the Igor variant everywhere here and takes the conservative
end, below about 10% FDR, from both. Above that the Fortran pulls away.

## The part that is about CLUSTER rather than about custard

Both algorithms slide a trailing base window and a leading test window and
t-test the two means. The denominators differ, and that is the whole result:

- CLUSTER divides by the **assay error** (`mscore.ts` pools the supplied
  per-point SD), so it asks whether a rise exceeds the measurement uncertainty.
- custard's `ttest2` divides by the **within-window sample scatter**, which at
  two or three points per window carries two to four degrees of freedom.

custard's best settings on this data run p = 0.35 to 0.9 — its own significance
test is close to useless here, and an amplitude threshold does the work. That is
a negative control for the error model this port is built around, obtained
without arguing for it.

A second measurement points the same way. Thresholds derived from the trace
rather than from the assay error run well above the declared assay SD on these
records — median over 200 records: 4.00× for the trace SD, 2.65× for the SD of
the first difference, 1.70× for a power-spectral estimate. A pulse is one to
three samples wide at 2–10 minute sampling, so it sits inside the band those
estimators call noise. Any detector thresholding on trace-derived noise pays for
it here, and CLUSTER's insistence on an explicit error model is the reason it
does not.

## Caveats

- The dense corpus is not committed anywhere; regenerate it with the command in
  `tools/score_benchmark.ts` if you want to reproduce those two numbers.
- custard has no published defaults for hormone data. Its `minAmp` is in raw
  signal units with nothing making it scale-invariant, so every threshold in the
  sweep had to be tied to something in the record — the declared assay SD, or a
  noise estimate. That choice is ours, not its author's.
- Running it needs MATLAB with the Statistics and Machine Learning Toolbox.
