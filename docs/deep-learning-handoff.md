# Handoff: a learned pulse detector for no_peak

**Status:** Phase 0 partially done (gap re-checked 2026-08-12, web search
only ⚠; decisions open); Phase 1 built but short of its own spec (see
Phase 1's status note in §6); Phase 2 partly done; Phases 3–5 not started.
The per-phase table opens §6.
**Written:** 2026-08-08, against no_peak v0.2.0. **Updated:** 2026-08-12
(murderboard review — run record:
`docs/reviews/deep-learning-handoff_2026-08-12.md`). The Phase 1 gate and
Phase 2 publishability were amended 2026-08-10; those corrections are kept as
dated blockquotes in §6.
**Audience:** whoever picks this up next — a person, or an agent with this
repo.
**Companion:** [`dl-new-repo-handoff.md`](dl-new-repo-handoff.md) is the
packing list for the new repository; this document is the plan.

---

## 0. Names and terms used throughout

Reference material — skim and return as needed; the argument starts at §1.

The detectors this document leans on:

- **CLUSTER** — Veldhuis JD, Johnson ML, *Am J Physiol* 1986;250:E486–93,
  doi 10.1152/ajpendo.1986.250.4.E486. A moving-window pooled t-test: a rise
  is a pulse when a peak-window mean exceeds the preceding nadir-window mean
  by a t threshold, normalized by the assay's own per-sample error. no_peak
  ports it in `src/core/cluster.ts` as two numerically distinct **variants**,
  `igor` (the Igor Pro package) and `fortran` (the original CLUST5 Fortran);
  the app's UI calls this choice **Implementation**.
- **PULSAR** — Merriam GR, Wachter KW, *Am J Physiol* 1982;243:E310–8.
  **PULSAR Otago** is its maintained reimplementation (Porteous R et al.,
  *Endocrinology* 2021;162(11):bqab165).
- **AutoDecon** — Johnson ML et al., *Anal Biochem* 2008;381:8–17. Automated
  deconvolution: fits a secretion-plus-clearance model, inserting and testing
  candidate pulses.
- **hormoneBayes** — Voliotis M et al., *PLoS Comput Biol*
  2024;20(2):e1011928. A latent on/off state-space model of pulsatile drive,
  inferred per record by particle-Gibbs MCMC (Markov chain Monte Carlo —
  minutes per record; removing that per-record cost is what "amortized"
  means below). Source code: <https://git.exeter.ac.uk/mv286/hormonebayes>.
- **DynPeak** — Vidal A et al., *PLoS ONE* 2012;7(7):e39001. A deterministic
  multi-scale heuristic that estimates inter-pulse intervals.
- **Johnson's simulated datasets** — six series (`lhsim1–3`, `ghsim1–3`)
  with their generating pulse times, shipped inside Johnson's Pulse_XP
  distribution. ⚠ Not in this repo and not redistributable; using them
  requires a local copy (`PULSEXP_DATA` — see `docs/validation-status.md`
  and [`dl-new-repo-handoff.md`](dl-new-repo-handoff.md) §2).

Terms: **GnRH** (gonadotropin-releasing hormone, sampled here in hypophyseal
portal blood) and **LH** (luteinizing hormone, peripheral circulation) are
the two hormones the app ships presets for — "portal" vs "peripheral" names
the sampling site, and it is why there are two secretion models (§5).
**CV** — coefficient of variation, the assay's relative error.
**Sensitivity** — true pulses found ÷ true pulses present. **FDR** —
false-discovery rate, false detections ÷ all detections; not the same
quantity as a per-point false-positive rate, and this document quotes FDR
unless it says otherwise. **IPI** — inter-pulse interval. **Δt** — the gap
between consecutive samples, in minutes. **Calibrated** — of the timepoints
a model calls 70% likely, about 70% really are onsets; the load-bearing word
in §7. **IRB / IACUC** — the human-subjects and
animal-care approvals that, together with plain data ownership, limit data
sharing. **Proper scoring rule** — a loss (log loss, Brier) that only the
true probabilities minimize. **Normalizing flow** — a neural density
estimator over a fixed-dimension parameter vector. **Autoregressive
factorization** — predicting each step's label conditioned on the previous
ones, so a network emits a joint distribution one step at a time.

## 1. The gap

While assembling the app's About page (`src/About.tsx`) we checked the
literature for a deep-learning pulse detector for serial hormone assays and
did not find a modern one. Adjacent ML work exists (hormone trajectory
prediction, cycle-phase classification from wearables) — and the task itself
was attempted with neural networks in the 1990s: Prank K, Kloppstech M,
Brabant G, *Hum Reprod Update* 1997;3(3):215–34 ("adaptive mixtures of local
experts" locating GH secretory bursts), and a 1994 *Pediatr Res* abstract
(35:A82) that trained a back-propagation network on 15 GH series with
expert-marked pulses. Neither entered use, and the 1994 attempt is §2's
first objection made concrete: it trained a student to imitate a teacher.
Nothing since identifies pulses in a concentration time series with a
learned model the way CLUSTER, PULSAR, AutoDecon, or hormoneBayes do.

**First task for whoever picks this up: re-run that search** (the canonical
instruction is Phase 0). The claim was current as of 2026-08-08 and was
checked again 2026-08-12 during review: four independent web-search
framings plus follow-ups found nothing (the verbatim queries are in
`docs/reviews/deep-learning-handoff_2026-08-12.md`). ⚠ That check ran
through web search only — no direct PubMed, Scholar, or preprint-server
query — so treat it as supporting the premise, not settling it. The gap
claim is the entire premise of this document. Record the queries you run,
so the next reader can re-run *the same* search. If someone published one in
the meantime, read it before writing code — and the right move may be to
port or wrap theirs rather than train our own.

## 2. Why the gap exists (read this before assuming it's an oversight)

It is not that nobody thought of it. Four things make this task hostile to
the standard deep-learning recipe, and any credible proposal has to answer
all four.

1. **There are no labels.** Real hormone series have no ground truth. Nobody
   knows where the pulses "really" are — that is the whole problem. You
   cannot assemble a labeled corpus by annotating real data, because the
   annotation would just be some other algorithm's output, and you would be
   training a student to imitate a teacher whose errors you inherit. (The
   1994 *Pediatr Res* attempt in §1 did exactly this, with an expert as the
   teacher.)
2. **The data are tiny.** A study might yield dozens of series of ~100
   points each. That is kilobytes. Sharing is limited by ethics approvals
   (IRB/IACUC) and by data ownership, so there is no ImageNet here and there
   will not be one.
3. **The field values inspectability.** CLUSTER is still in use forty years
   on because you can explain it in two sentences and audit every decision.
   A black box that reports "pulse here, trust me" will not be adopted, and
   reviewers will be right to push back.
4. **Uncertainty is already quantified elsewhere.** hormoneBayes (a latent
   on/off state-space model fit by per-record MCMC) and the Bayesian
   deconvolution family (variable-pulse-count models fit by
   trans-dimensional — birth–death or reversible-jump — MCMC) already give
   full posteriors from mechanistic models — though
   *calibration* of those posteriors is demonstrated for neither; the
   nearest evidence is Carlson 2013's coverage results (>99% coverage of
   pulse number for the two Bayesian methods it compared; full citation in
   Phase 1). "Neural net gives a point estimate" is still a step backwards
   from that.

## 3. The proposed framing

Not "a neural network that detects pulses." Instead:

> **Amortized simulation-based inference.** Train a network on data
> generated by a mechanistic model the field already accepts, so that it
> learns to approximate the Bayesian posterior over pulse times *under that
> model* — then run that approximation in milliseconds, in the browser,
> instead of running per-record MCMC. The browser is not incidental: the
> client-side constraint in §4 rules out per-record MCMC and makes
> amortization the obvious route to a posterior here.

Two honesty clauses:

- **The output is a *marginal* posterior.** A per-timepoint onset
  probability trained with a proper scoring rule converges to the
  probability of an onset near t marginalized over the number and locations
  of every other pulse. The set of marginals does not recover the joint:
  pulse-count and IPI posteriors, and the anticorrelation that distinguishes
  "one pulse, uncertain location" from "two pulses", are not in it. If the
  joint is wanted (Phase 0's target decision notes users may want IPI),
  the cheap amortized route is an autoregressive factorization over the
  onset sequence — same simulator, same loss, still one network. A
  normalizing flow over a fixed-dimension parameter vector is *not* the
  fallback here: the variable
  pulse count makes the space transdimensional.
- **"Under that model" includes the prior.** Every probability the tool
  reports depends on the parameter ranges in the generator
  (`tools/simulate_benchmark.py`). That prior is scientific policy, not an
  implementation detail: it must ship as an explicit, cited table alongside
  the weights (Phase 5), with its sensitivity measured (Phase 4).

This framing answers the four objections above — the third and fourth
honestly rather than fully:

- **Labels** come free: the simulator knows where it put the pulses. (They
  are labels for the *simulator's* definition of an onset; at 10-minute
  sampling the real event is not crisp.)
- **Data** is unlimited for the same reason.
- **Inspectability** survives in a specific sense: the training distribution
  and its generative assumptions are fully auditable — ship the simulator
  alongside the weights and anyone can audit what the network was trained
  on. What this does not give is per-decision auditability: nobody can
  explain why the network emitted 0.8 at t = 40 the way CLUSTER's two
  sentences explain a call. The hybrid in §8 (network proposes, CLUSTER's
  t-test confirms) is the real answer to that half of the objection.
- **Uncertainty** is the output: a per-timepoint posterior probability of
  pulse onset. hormoneBayes already emits a close cousin per record (a
  per-timepoint latent on/off-state posterior); what nothing currently gives
  you is the *amortized* version — milliseconds, client-side, no per-record
  MCMC.

The value proposition is therefore **not** "more accurate than CLUSTER." It
is "posterior uncertainty at CLUSTER's speed, running client-side." If the
accuracy also improves in the low-amplitude / high-noise regime where
CLUSTER is conservative, that is a bonus to measure, not the headline to
promise — and note that the "bonus" framing hands every future disagreement
with CLUSTER a ready-made excuse, which is why Phase 4 pre-registers the
disagreement metric.

One firewall, stated once so it cannot blur: **CLUSTER output is never a
training target and never a model-selection signal.** It is a post-hoc
comparator only. That is what keeps objection 1 answered.

## 4. Hard constraints from this project

- **It must run client-side.** no_peak's whole identity is that data never
  leaves the browser. A model behind an API would break the one promise the
  app makes. The budget — proposed defaults until Phase 3 begins, at which
  point the table freezes and §7 evaluates against the frozen values:

  | Component | Budget | Basis |
  |---|---|---|
  | Weights | ≤ 400 KB | ≈100k parameters at float32 or ≈400k at int8 — pick the quantization story now |
  | Runtime | `onnxruntime-web` WASM, ~3–8 MB | lazy-load only when this Implementation is selected; the app currently ships no ML dependency at all |
  | Latency | < 100 ms for a 200-point series | a small network at this length is single-digit ms on CPU; the bound is generous |

- **It must consume the error channel.** Per-sample assay precision is what
  makes CLUSTER honest. Feed the per-sample error in as an input channel,
  not an afterthought — a model that ignores measurement error will
  confidently call noise.
- **It must be additive, never a replacement.** Ship it as an additional
  Implementation option next to `igor` and `fortran`; results from those two
  must stay bit-identical to what they produce today.
- **It must handle irregular sampling.** Condition on Δt per interval; do
  not assume a fixed grid. ⚠ Two gaps found in review: the built generator
  emits strictly regular grids (one Δt per record), so a Δt input channel
  carries no within-record variation — the network can read a record's
  sampling rate from it but cannot learn to handle a changing Δt; and a
  dilated convolution (the first Phase 3 candidate) treats its input
  samples as equidistant regardless of a side channel. Genuinely irregular
  series need jittered and gapped training grids at minimum, or
  continuous-time machinery (latent ODEs — Rubanova, Chen & Duvenaud,
  NeurIPS 2019) if Δt conditioning proves weak.
  CLUSTER itself is index-based, so this constraint exceeds the baseline;
  nothing in the repo currently tests it.

## 5. What already exists to build on

The authoritative packing list for the new repository is
[`dl-new-repo-handoff.md`](dl-new-repo-handoff.md) §1 — keep that table
canonical rather than letting two lists drift. What matters for the plan:

- [`tools/simulate_benchmark.py`](../tools/simulate_benchmark.py) — **the
  Phase 1 simulator as built**: seeded, documented, returns
  `(times, values, errors, true_onsets)`. What it spans and what it still
  lacks are listed once, in Phase 1.
- `data/benchmark/` — the frozen synthetic corpus it generated: 200 series
  plus `truth.json`, seed 20260810, committed and publishable.
- [`tools/score_benchmark.ts`](../tools/score_benchmark.ts) — corpus scorer,
  both variants, with a 72-combination `--sweep`. This — not
  `scripts/run_csv.ts` — is the thing to extend for corpus work.
- [`tools/score_against_truth.ts`](../tools/score_against_truth.ts) —
  scorer for Johnson's simulated datasets
  (local only, `PULSEXP_DATA`). ⚠ Ships pinned to `variant: "igor"`; the
  fortran baseline row is currently not reproducible from it (a one-line
  fix — see `docs/validation-status.md`, reproducibility gaps).
- `data/digitized/` +
  [`tools/score_webster1991.ts`](../tools/score_webster1991.ts) — eight
  real GnRH/LH
  records digitized from Webster et al. 1991, carrying the paper's own 70
  published CLUSTER pulse calls: **the one public real-data answer key in
  the project**, and the only adjudicator Phase 4 has that is neither this
  port's CLUSTER nor the simulator — though it is still CLUSTER-lineage
  output, so it supports consistency checks, not ground truth. Two further
  caveats travel with it and must be copied, not summarized away:
  the redistribution permission's primary record is still being chased, and
  ⚠ the error column is reconstructed, not measured (see
  `dl-new-repo-handoff.md` §3).
- [`tools/make_synthetic.py`](../tools/make_synthetic.py) — where the
  physiology is argued out, and the only implementation of the **portal
  GnRH model**: square secretory bursts time-averaged over each collection
  fraction (the timed windows of portal blood collection), with no
  clearance tail at practical (≈5-min) collection resolutions. The
  benchmark generator lacks this model entirely — porting it there is
  Phase 1 work. Nearly every scale is traced to a citation in
  [`data/synthetic/README.md`](../data/synthetic/README.md); the exceptions
  — the assay CV is an estimate from a lab wave's sample-to-error ratio (a
  "wave" is Igor's name for a data series), and the LH kinetics are uncited
  — must be sourced before they become a training prior. Inherit the
  sourcing standard with the code: a corpus built on invented scales trains
  a detector to the wrong prior.
- [`src/demo.ts`](../src/demo.ts) — a *reduced* LH model in TypeScript for
  the in-browser demo: the same 25 min half-life, but a fixed six-pulse
  train, uniform ±7% noise (≈4% CV — not the Gaussian 7%-CV of the Python
  model), and no error channel. Do not treat it as a second reference
  implementation; the reuse answer is to have `make_synthetic.py` emit the
  demo CSV instead.
- [`src/core/cluster.ts`](../src/core/cluster.ts) — the baseline to beat,
  both variants (`igor`, `fortran`), and a sanity-check comparator (never a
  label source — §3).
- [`scripts/run_csv.ts`](../scripts/run_csv.ts) — single-file CSV runner
  (not a batch runner; its documented `node --experimental-strip-types`
  invocation is broken — use `npx vite-node`, already a dev dependency and
  the root `README.md`'s documented command; `docs/next-steps.md` §7
  tracks fixing the header).
- `tools/pulsar/pulsar_run.R` — the PULSAR Otago runner behind the published
  head-to-head (single-file; the sweep and scorer are not committed).
- `data/extracted/` — eleven CSVs: three real hormone series with measured
  per-sample error (`gnrh`, `LHInfused`, `set1`); per the root
  `README.md`, the rest
  are six manual test series (`man2`–`man6`, `null1`) and two scratch
  waves — provenance unstated.
  **Gitignored** — absent from any clone, lab machines only — which decides
  where Phase 4's sim-to-real step can physically run. The Igor panel
  settings recorded alongside (`data/extracted/igor_panel_settings.txt`) are
  priors for what humans actually choose.

Before Phase 0, look at the data once: plot a benchmark record against its
truth (`data/benchmark/series/0000.csv` + `truth.json`), or open the app's
demo. (A rendered benchmark-vs-real comparison was built for the 2026-08-10
figure review, but it lives outside this repo and its generator was never
persisted — `docs/reviews/2026-08-10_benchmark_figure.md` has the details;
use the first two options.) Every gate below asks whether simulated series
*look* real; do not plan against data you have never seen.

## 6. Plan

| Phase | Deliverable | Status (2026-08-12) | Gate |
|---|---|---|---|
| 0 | go/no-go + scoping decisions | gap checked 2026-08-12 (web search only ⚠ — database search still owed); decisions open; Veldhuis & Johnson 1994 (*Methods Enzymol*) unread ⚠ | written kill list |
| 1 | training simulator | built, short of spec (5 gaps listed below) | **provisionally passed (dense profile only); broad-corpus sensitivity unresolved.** Dense: 55.8/58.4% at 0.3/0.4% FDR, inside the 50–65% at <1% band, and the gate now exits non-zero on failure (2026-08-12). ⚠ Band drawn from same-day anchors, so "passed" means consistent-with-anchors; gaps 1–5 ungated |
| 2 | baselines on the frozen benchmark | partly done | published baseline table incl. calibrated t-score |
| 3 | the model | not started | beats the calibrated t-score baseline on §7's terms |
| 4 | honest evaluation | not started | pre-registered metrics |
| 5 | ship | not started | §4 budget |

### Phase 0 — decide whether to proceed (about a day)

Re-run the literature search (§1) — directly against PubMed, Google
Scholar, and arXiv/bioRxiv, which the 2026-08-12 web-search check did not
reach — and record the queries. Note that the plan has already run out of
its own order: Phase 1 was built and gated before
this phase's go/no-go was decided and before the Veldhuis & Johnson 1994
methodology paper (below) was read. Phase 0 is still a live decision —
treat the Phase 1 work as sunk cost, not as momentum. Then two scoping
decisions that gate everything below:

- **Choose the target.** Marginal per-timepoint onset probability
  (simplest), a joint posterior via an autoregressive head (recovers count
  and IPI), an IPI posterior (what hormoneBayes reports, and possibly what
  users actually want), or full secretion-rate reconstruction. The
  simulator's label format and the network's output head depend on this.
  Whatever the choice, state the label-construction rule — how continuous
  `true_onsets` become per-timepoint targets (containing interval, or
  ± how many samples) — because every calibration claim downstream is
  conditional on it.
- **Solo build or collaboration.** The hormoneBayes group has the
  mechanistic model, public code (§0), and the domain credibility;
  amortizing *their* posterior is a more defensible paper than inventing a
  parallel one, and this app could be the client-side delivery vehicle.
  Amortizing their posterior requires running their MCMC as the reference —
  the code is downloadable, so this is checkable before committing.

Write down what would make this *not* worth doing — starting from §7, which
is the current draft of exactly that list. Then read Veldhuis &
Johnson 1994 (*Methods Enzymol* 240:377–414) on simulation-based testing of
pulse detectors — the field has a roughly forty-page opinion on how to
generate synthetic series and score detectors against them, and matching
that methodology is most of what makes this credible.

**Obtained and read 2026-08-12**, along with its companion (*Neurosci
Biobehav Rev* 1994;18(4):605–612); both are in the `downLow` repository's
lit cache. What the chapter does and does not supply, which matters because
it was expected to settle the Phase 1 gate:

- It does **not** predict a sensitivity figure for CLUSTER, and arguing it
  should is arguing against the chapter's own thesis — that a scalar
  detector score is meaningless unless amplitude, half-life, sampling
  interval, experimental variance, cluster size and t are all stated.
- It **does** give monotonic direction rules (pp. 388–389) and a sampling
  adequacy rule (p. 392), both of which this generator can be tested
  against without new data. That test has been run: see
  `docs/validation-status.md`. Result so far: of the five direction rules,
  **one reproduces** (pulse amplitude, on a clean axis), one fails (half-life —
  a clean negative and a probable generator defect, though two proposed
  mechanisms have each been tested and rejected, so the cause is open),
  one is untestable on this corpus (sampling intensity — the axis is
  structurally confounded with pulse density), one is unresolved pending
  replication (assay CV), and one needs a per-sample false-positive rate that
  nothing computes (pulse frequency). The adequacy rule does not explain the
  broad-corpus shortfall.
- It **does** carry published operating curves (Fig. 6, Cluster sensitivity
  and positive accuracy against half-life at four t-statistics; Fig. 13,
  four indices against t) which are independent predictions this generator
  could be made to reproduce. They are raster figures, so using them means
  digitizing — the practice this repo already has a tool and a permissions
  analysis for. Fig. 6's primary source is **Urban et al., *Endocrinology*
  1991;128:2008–2014**, which the owner supplied on 2026-08-12; it is in the
  lit cache and its parameters are verified below. *Am J Physiol*
  1988;255:E749 is now the only outstanding want-list item.

**What Urban 1991 supplies, verified against the PDF (2026-08-12).** Its
simulated FSH corpus is fully specified: 90-min pulse frequency ±30%,
biexponential clearance with half-lives of 142 and 719 min (the slow component
70% of the amplitude), 10.6-min secretory burst half-duration, 12% intrasample
experimental variance, 300 samples at a 10-min interval, and 128 Cluster
parameter permutations across five metabolic clearance rates. Its reported
optima are ~0.83–0.85 sensitivity at >0.80 positive accuracy.

**Do not anchor the Phase 1 gate to 0.83–0.85.** Two independent reasons.
First, that is a deliberately slow, long-half-life hormone at 300 samples —
the easy end of the sampling problem, not a comparable case. Second, its
142-min fast component against 10-min sampling is ~14 samples per half-life,
comfortably *above* the Veldhuis & Johnson adequacy rule, whereas the dense
profile is structurally *below* it at 2–5 (`docs/validation-status.md`). The
two numbers sit on opposite sides of a threshold we have separately shown does
not transfer, so they are not on one scale.

What is portable from Urban is the **shape**, not the level, and exactly two
shapes qualify: sensitivity falls while positive accuracy rises as the
threshold rises, and both degrade as half-life lengthens. Those are falsifiable
across hormones in a way a band never is, and they are the better Phase 1
replacement.

⚠ **Do not add a sampling-intensity shape to that list**, however tempting —
Urban's own data contradicts it. Immediately after reporting the optimum he
records "no significant differences by analysis of variance in peak
discrimination by the Cluster analysis program among 5-, 10-, or 15-min
sampling intensities" (p. 2012). A gate demanding monotone sensitivity against
sampling interval would fail against the paper it was drawn from. Note this
also means the half-life shape must be gated carefully: our own corpus does
*not* reproduce VJ's half-life rule (`docs/validation-status.md`), so of the
two shapes above, only the threshold one is currently supported at both ends.

**Why this project reports no specificity or negative accuracy**, which Urban
settles at p. 2009 and which is worth quoting because it is the primary source
for an omission every CLUSTER-family paper shares:

> …in order to calculate negative accuracy and specificity, a true negative
> result must be defined (11, 12). A true negative result in our system would
> be any valley identified by Cluster that included no true peak maxima.
> However, the presence of false positive peaks would falsely elevate the
> number of true negative events by creating additional flanking valleys.
> Since we are primarily concerned with the sensitivity and positive accuracy
> of peak detection, we did not attempt to define or use a true negative term.

The circularity is real and it is **specific to a valley-based true negative**,
which is forced on any detector that emits spans rather than per-sample calls.
A per-timepoint posterior does not have it: every sample either falls inside a
true pulse or does not, independent of what the model predicted. So specificity
returns for free if a learned detector targets per-timepoint output — but never
for CLUSTER, and it must not leak into the shared scorers, which score spans.

### Phase 1 — the simulator (the real work)

Everything downstream is only as good as this. Deliverable: a documented,
seedable generator producing `(times, values, errors, true_onsets)`, with
priors drawn from the literature rather than invented.

**Status: built, short of its own spec.** `tools/simulate_benchmark.py` is
this deliverable and already spans half-life, basal secretion, lognormal
pulse mass, gamma inter-pulse intervals, sampling interval and duration,
assay CV as a function of concentration (low-concentration CV blow-up is
where detectors actually fail), reported-error conservatism, and a slowly
varying baseline on some records. Remaining work, in priority order:

1. **The portal GnRH model.** Square bursts over collection fractions
   (`make_synthetic.py`, `portal_fractions`) are absent from the generator;
   the corpus currently contains no portal-type trace — half of what the
   app ships presets for. Port it, or explicitly narrow the project's scope
   to clearance-dominated peripheral hormones.
2. **Irregular and gapped sampling** — the generator emits regular grids
   only (§4).
3. **Non-stationary drive** — the mean IPI is constant within a record.
4. **Missing samples and outliers** — absent entirely.
5. **Pulse shape** — every burst is an instantaneous rise with a single
   exponential decay.

Note the validation gate's scope: it exercises only the peripheral
clearance model on regular grids, so it cannot register any of these five
gaps — a corpus missing all five passes it identically. The gaps are
therefore **ungated**: close them (or scope them out, explicitly, in
writing) before Phase 3 trains on the corpus; do not read "gate passed" as
"simulator done". The dense profile also disables baseline drift entirely
(`drift_amp = 0`) and fixes dt = 10 min with half-life 20–50 min — so the
drift term this section says to keep, two of the broad prior's three
sampling intervals, and both tails of its half-life range sit outside the
gate too.

The slowly varying baseline is already in; keep it. Carlson NE, Horton KW,
Grunwald GK (*Stat Med* 2013;32:4624–38, doi 10.1002/sim.5882) compared four
deconvolution-family methods (CLUSTER was not among them, though it seeds
pulse locations inside one) and found that ignoring a circadian baseline
drives false-positive rates (their per-method rates, not FDR) above 20% and
biases every parameter estimate — false positives being exactly the metric
this project most cares about.

One generator-scope decision belongs here rather than in §8: train
per-hormone, or condition on half-life? The Bayesian default is a third
option — train across a half-life prior and let the network
*marginalize* over it, which asks nothing of the user. Conditioning on
half-life is a refinement for when a per-subject clearance estimate actually
exists; per-hormone training is the fallback if conditioning proves hard.

**Validation gate, in its corrected form.** On a density-matched corpus —
145 points, 10-minute sampling, ~30 pulses, ~4% CV — CLUSTER must land near
its measured behavior on Johnson's simulated datasets. Two scope notes.
This is a sim-vs-sim consistency check against Johnson's simulator: no
real-data sensitivity figure exists, and per §2 none can, so it is the best
available gate, not ground truth. And Johnson's six sets carry 17–30 pulses
per ~145 samples (mean ≈22) while `--profile dense` sits at the top of that
range (~30) — since density is exactly what suppresses CLUSTER's FDR, the
<1% half of the gate is measured on the *easiest* case in the reference
set. The measured anchors:

| Corpus | igor | fortran | Reference point |
|---|---|---|---|
| Johnson's six datasets (130 pulses) | 51.5% sens, 0 FP (0% FDR) | 60.8% sens ⚠, 0 FP (0% FDR) | Johnson's published Cluster column ≈58% (a count; his parameters unrecorded) |
| Density-matched (`--profile dense`, 2026-08-10; re-derived 2026-08-12) | 55.8% sens, 0.3% FDR | 58.4% sens, 0.4% FDR | gate target: within the 50–65% band at <1% FDR |
| Broad corpus (committed benchmark, measured 2026-08-12) | 37.3% sens, 16.5% FDR | 62.9% sens, 21.9% FDR | 16–22% FDR (prior measurement of this same corpus — no independent expectation exists); sensitivity gate unsettled (below) |

Caveats that travel with the table:

- A true positive means a generating onset falls within a detected span
  widened by one sampling interval; each detection is credited to at most
  one onset, and every uncredited detection counts as a false positive
  (the matching rule is recorded in `docs/validation-status.md`).
- The ⚠ 60.8% came from an uncommitted edit. Fixed 2026-08-12:
  `score_against_truth.ts` now scores both variants on every run, so the row
  is derivable from committed code — but the figure itself has not been
  re-derived since 2026-08-10, and cannot be without `PULSEXP_DATA`.
- 130 pulses puts roughly ±8 points of binomial confidence interval on any
  sensitivity here, which is why the band is 50–65% and not the narrower
  55–60% an earlier draft used: the wider band is the one that actually
  spans all three Johnson anchors (51.5 / 58 / 60.8%).
- The <1% FDR target rests on single-digit false-positive counts (2–3 of
  ~700 detections): quote raw counts and expect seed-to-seed movement.
- The band was adopted 2026-08-10 from those same anchors, on the same day
  the dense profile was measured inside it, so read "passed" as "consistent
  with the anchors", not as an independent prediction confirmed. Veldhuis &
  Johnson 1994 was expected to supply an independent band and does not —
  the chapter argues against scalar detector scores (§Phase 0).
- "Zero false positives in every configuration tried" holds at defaults;
  the "27-point sweep" behind the wider phrase does not exist at all — the
  only committed sweep is `score_benchmark.ts --sweep`, 72 combinations on
  a different corpus (validation-status, reproducibility gaps).

Three items were found unresolved in review. Two were closed 2026-08-12; the
third narrowed but is still open.

- **Closed — the gate is now stated once.** It had been stated in four
  places that disagreed on both axes. It now lives in
  `score_benchmark.ts`'s header, is printed from the same constants, and is
  **50–65% sensitivity at under 1% FDR, judged on the dense profile only**.
  The script exits non-zero when a dense corpus misses either arm, and
  prints without failing on any other profile. Everywhere else — this doc,
  `dl-new-repo-handoff.md` §4, `docs/validation-status.md` — cites it
  rather than restating it.
- **Closed — the dense corpus is scorable without editing code.** The two
  exact commands:

      python3 tools/simulate_benchmark.py --profile dense --n 40 --seed 7 --out /tmp/dense
      npx vite-node tools/score_benchmark.ts --dir /tmp/dense

  (`truth.json` was regenerated the same day so its records carry the
  `profile` key the gate reads; the series files are byte-identical, and
  the whole committed corpus reproduces exactly from seed 20260810.)
- **Still open — why broad-corpus `igor` sensitivity is 37.3%.** It is no
  longer a gate failure, because the gate no longer claims the broad corpus.
  But it is still unexplained, and the leading explanation has now been
  tested and rejected: Veldhuis & Johnson's sampling-adequacy rule, which
  42% of the corpus violates, has the right *direction* but cannot account
  for the shortfall — see `docs/validation-status.md`, "sampling adequacy is
  not what holds broad-corpus sensitivity down". Pulse density is what
  tracks it. Resolve it before wiring any broad-corpus arm into the gate;
  a threshold there would currently be measuring corpus composition.

Because "CLUSTER behaves the same" is tunable-toward by construction, the
broad corpus also needs **realism checks that do not involve CLUSTER**:
hold out marginal-distribution, autocorrelation, and per-hormone
pulse-count statistics against the literature, and record which statistics
were tuning targets and which were validation. The expert test — a domain
expert should be unable to reliably distinguish simulated series from real
ones — needs its terms specified before it runs (blinded presentation,
stated n, stated pass/fail statistic), and its limits acknowledged: with
~11 real series it is severely underpowered. (Real material on hand: three
hormone series with measured error in `data/extracted/` — gitignored, lab
machines only —
plus the eight public digitized Webster records; that is the whole
real-data pool, so only the full-pool version of the test needs a lab
machine.)

Do not tune the generator to drive the broad-corpus FDR toward zero; that
would be fitting the simulator to an artifact.

> **Corrected 2026-08-10.** This gate originally said "~80% sensitivity /
> ~1% false positives", taking the 80% from the AutoDecon paper. That
> number is specific to AutoDecon's own synthetic data and is **too high**
> as a general target: a simulator tuned to make CLUSTER hit 80% would be
> systematically too easy — pulses too tall, noise too low, spacing too
> generous — and a model trained on it would collapse on real records.
> Calibrate to the measured 50–65% band instead. An earlier ~59% figure
> from a throwaway script was retracted; the regenerable figures are the
> `--profile dense` ones in the table above (`docs/validation-status.md`).

### Phase 2 — baselines on the benchmark

Before any model: score CLUSTER (both variants), PULSAR Otago, and **a
calibrated wrapper on CLUSTER's own t-score** (`src/core/mscore.ts`) —
Platt-scale the existing t trace (fit a two-parameter logistic, slope and
intercept, mapping t-score → probability) against simulator truth. That
wrapper costs ~zero parameters, runs client-side by definition, and is
fully inspectable. It is the null hypothesis of this project, and §7 kills
the project if the network cannot beat it. Publish the baseline table in
the repo, scored on the Phase-1 benchmark
(`data/benchmark/` — public and committed; not to be confused with
Johnson's datasets, which cannot be redistributed). Half the value of this
project is a shared benchmark, independent of whether the network works.

> **Partly done, 2026-08-10.** `tools/score_against_truth.ts` scores
> detections against Johnson's generating pulse times; both variants have
> baseline numbers on his six simulated datasets (with the fortran
> reproducibility caveat, §5), and the PULSAR Otago head-to-head has been
> run: 56.2% sensitivity, 6 false positives, best of a threshold sweep —
> scored on a looser matching rule than CLUSTER's (±2 intervals vs
> span-containment), and the sweep itself is not committed. All of it,
> with caveats, is in `docs/validation-status.md`.
>
> AutoDecon's figure on the same data is **128 detections against 130 true
> pulses** — ⚠ a raw detection count containing unscored false positives,
> not a scored sensitivity (`ghsim1` alone reports 19 detections against 18
> true pulses); the AutoDecon paper's own scored result is ~96% sensitivity
> (its abstract: "approximately 96% vs. 80%") on a *different* synthetic
> corpus, at ~6× CLUSTER's false-positive rate (a pooled ratio; per group
> it runs 3–33×). The ceiling is known in kind — deconvolution is in a
> different class on sensitivity — but not in number. Two consequences.
> First, **higher sensitivity than CLUSTER is a solved problem**
> (AutoDecon, 2008, at a false-positive cost — see Phase 4); calibrated
> uncertainty plus client-side speed is the only defensible
> differentiator, so resist
> leading with an accuracy number. An AutoDecon head-to-head on the Phase-1
> corpus is runnable locally with `pulse_xp.exe`
> (`dl-new-repo-handoff.md` §2). Second, **Johnson's datasets cannot be
> published**: his license forbids providing the software to third parties,
> and the datasets ship inside it. (The quoted grant in
> `docs/reference-code.md` names software, not data; the decision to treat
> the bundled datasets the same way is recorded in
> `dl-new-repo-handoff.md` §2, and `reference-code.md` flags further
> unresolved scope limits.) Publish the *numbers* and the scoring script;
> the public benchmark is the Phase-1 corpus.

### Phase 3 — the model

Start small and boring: a dilated temporal convolutional network or a small
U-Net (an encoder–decoder over the sequence), inputs `[value, error, Δt]`
per step, output the per-timepoint onset probability — or the
autoregressive head, if Phase 0 chose the joint posterior. Do not hand-roll
the training loop: the `sbi` toolkit (Tejero-Cantero et al., *JOSS* 2020,
doi 10.21105/joss.02505) or BayesFlow ships the neural posterior estimation
machinery and the calibration diagnostics §7 depends on (BayesFlow: Radev
ST et al., *JOSS* 2023, doi 10.21105/joss.05702); hand-roll only if the
ONNX export path forces it. Target the §4 budget table. Train with a
proper scoring rule (log loss or Brier — a loss that only the true
probabilities minimize) so the loss at least does not reward
miscalibration; then check calibration explicitly anyway (Phase 4), because
the guarantee holds only at the optimum, on the training distribution.

If a fourth input channel is wanted, feed CLUSTER's actual statistic: the
windowed peak-vs-nadir t trace from `src/core/mscore.ts`, computed at the
shipped window settings and with the **fortran** variant — the Igor form's
t-score is not scale-invariant (`docs/validation-status.md`), and record
amplitudes span two orders of magnitude across the corpus. (An earlier
draft suggested a per-point value-over-error channel and called it
CLUSTER's own statistic — it is not: CLUSTER's statistic is the windowed
contrast, and a per-point
signal-to-noise ratio is directly computable from the value and error
channels the network already has — redundant, not informative.) Feeding
CLUSTER's statistic as an *input* does not breach §3's firewall — labels
stay simulator-only — but record whether the channel was used, because
§7's beat-the-baseline criterion reads differently when the network holds
the baseline's own feature.

Only reach for a transformer if the simple thing demonstrably plateaus —
and per §3, a fixed-dimension normalizing flow is not the escape hatch for
the joint posterior; the space is transdimensional.

### Phase 4 — honest evaluation

- Sensitivity **and** FDR, reported together, always — as full
  precision–recall curves over the decision threshold, with CLUSTER's
  operating points plotted on the same axes, never one chosen point against
  another. (The planned Phase 5 UI shows the probability trace itself,
  which sidesteps a single threshold; state how the default is chosen
  anyway.) The CLUSTER-vs-AutoDecon comparison is instructive: higher
  sensitivity bought with ~6× the false positives (pooled; 3–33× per
  group) is not a free win — both halves of that figure come from
  AutoDecon's own corpus, and CLUSTER's ~1%
  there (a per-point false-positive rate, not an FDR) is conditional on
  dense pulse trains (16–22% FDR measured broad; Phase 1) — and which side
  of the trade you want depends on the biological question.
- Calibration of the emitted probabilities — **calibrated and sharp**, not
  merely calibrated. A model emitting the corpus base rate everywhere has a
  perfect reliability diagram and is useless, so report skill against that
  constant predictor (Brier / log-score improvement), and — if Phase 0
  chose the joint/autoregressive target — run simulation-based calibration
  (recover known simulator parameters through the posterior and check the
  rank statistics are uniform) or expected-coverage checks (the X%
  credible set contains the truth X% of the time) on a derived quantity
  (pulse count, IPI).
  With the marginal target those checks are structurally unavailable (§3:
  the marginals do not contain the count or IPI posteriors); only the
  pooled reliability diagram and the skill score remain, which is weaker —
  say so wherever the results are reported.
  Expect trouble: amortized posterior estimators are empirically
  overconfident across method families (Hermans et al., "A Trust Crisis in
  Simulation-Based Inference", *TMLR* 2022, arXiv:2110.06581); ensembling
  is the working mitigation — plan for it. And one structural honesty
  clause: on real data there is no truth to calibrate against, so
  real-data calibration is unverifiable in principle. What can be verified
  is calibration under simulator shift (next bullet).
- Robustness: deliberately train on one simulator configuration and test on
  a shifted one — including a shifted *prior* (§3), reporting how the
  emitted probabilities move. The sim-to-real gap is the single most likely
  failure mode of this whole plan; measure it directly rather than hoping.
  It now carries its own kill criterion (§7).
- Sim-to-real, in two tiers. First, `data/digitized/` +
  `tools/score_webster1991.ts`: eight real records with 70 published pulse
  calls — the only adjudicator that is neither this port's CLUSTER nor the
  simulator (it is still CLUSTER-lineage output, so it is a consistency
  check, not ground truth — and its error column is reconstructed, §5).
  Add spike-in tests: inject a simulated pulse into a real record and check
  both detectors see it. Second, agreement with CLUSTER on
  `data/extracted/`, where no answer key exists — with the disagreement
  metric, matching rule, and threshold **pre-registered before training**,
  because §3's framing hands every disagreement a ready-made excuse
  ("CLUSTER is conservative there") and an unpre-registered criterion can
  never fire. Any disagreement is a finding to explain, not a number to
  average away.

### Phase 5 — ship it, carefully

Third Implementation option, alongside `igor` and `fortran`. Show the
probability trace as a panel beside the t-score panel — the honest UI is
"here is the model's confidence over time," not a binary overlay that looks
as authoritative as the statistics. Record the model version in the CSV
header and PDF report exactly as the implementation is recorded now
(`impl=` in the CSV header, `src/core/csv.ts`; a prose label in the PDF).
Publish the simulator, the benchmark, the weights, the training code, and
the **prior table** (§3) together, and lazy-load the runtime (§4). A
learned detector whose training distribution is not inspectable is not
usable science.

## 7. Kill criteria

Stop and write up the negative result if any of these hold:

- The simulator cannot reproduce CLUSTER's behavior **on a density-matched
  corpus** (Phase 1 gate — noting that the band is not yet an independent
  prediction and the scoring script does not exit non-zero, so this
  criterion cannot currently fire unattended). Failing to reach near-zero
  FDR on a *broad* corpus is the expected, correct outcome (16–22%
  measured), not a kill.
- The model's probabilities are not both **calibrated and sharp under
  simulator shift** — the Phase 4 tests, with tolerances stated before
  training (an expected-calibration-error bound at a stated skill floor
  over the base-rate predictor). This is the load-bearing criterion:
  calibrated uncertainty is the entire value proposition, so a
  miscalibrated model fails even if it matches CLUSTER's accuracy — and a
  merely calibrated one fails too, because the base rate is calibrated.
  (Accuracy alone cannot kill the project: §3 disclaims it as the goal, and
  Phase 2 records that AutoDecon already won it. Do not pretend otherwise.)
- The network does not demonstrably beat the **calibrated t-score baseline**
  (Phase 2) on those same terms. If a monotone function of CLUSTER's own
  statistic passes every test, ship that instead — smaller, faster, fully
  inspectable — and write up why the network added nothing.
- Sim-to-real disagreement — on the **pre-registered** Phase 4 metric,
  after the Webster 1991 adjudication — is large and unexplainable. A
  detector that works on synthetic data and disagrees mysteriously with
  forty years of practice on real data is not publishable and not
  shippable.
- The client-side budget fails: weights size, runtime size, or inference
  latency exceed the §4 budget table as frozen at the start of Phase 3. §4
  calls this constraint hard; a hard constraint gets a kill line with
  numbers in it.

A clean negative result here is genuinely useful to the field — it would
explain *why* the gap exists (§2), which is currently just an observation.
Publish it whether the model works or not.

## 8. Open questions

The decisions that gate the build live in the plan, not here: the
prediction target and solo-vs-collaboration in Phase 0, the
per-hormone-vs-conditioning question in Phase 1. What genuinely remains
open:

- Would a hybrid beat either pure approach — the network proposing
  candidate pulses and CLUSTER's t-test confirming them, so the statistics
  stay auditable and the network only improves sensitivity? This is also
  the strongest available answer to §2's inspectability objection.
- Is onset even the right unit? hormoneBayes infers mean on/off durations
  (from which IPI follows) *and* a per-timepoint latent on/off probability
  — both of the things this plan treats as alternatives. If the
  collaboration route is taken, this question dissolves into theirs.
- What did the 1990s attempts (§1) die of, specifically? Reading Prank 1997
  closely is cheap, and may be a list of the failure modes this plan would
  otherwise repeat.
