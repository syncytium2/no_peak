# Bootstrap kit: the learned-pulse-detector repo

**Written 2026-08-12, against no_peak v0.2.0** (`github.com/syncytium2/no_peak`,
live at <https://nopeak.tonydefazio.com>).

This document seeds a **new repository** that will attempt the deep-learning
approach. It is the packing list and the license map. The plan itself — framing,
phases, kill criteria, corrected calibration targets — is
[`deep-learning-handoff.md`](deep-learning-handoff.md); copy both files into the
new repo and read that one first. Do not start from this document alone: the
plan carries two hard-won corrections (the 50–65% sensitivity target and the
density-matched false-positive gate) that will silently invalidate the training
distribution if missed.

The premise, in one paragraph: no deep-learning pulse detector for serial
hormone assays existed as of August 2026 (re-verify before writing code). The
credible version is amortized simulation-based inference — train on a
mechanistic simulator the field already accepts, emit a calibrated per-timepoint
posterior, run client-side. The differentiator is calibrated uncertainty at
CLUSTER's speed, **not** accuracy: AutoDecon already beat CLUSTER on accuracy in
2008.

---

## 1. Copy from no_peak (MIT, ours to move)

| What | Why the new repo wants it |
|---|---|
| `docs/deep-learning-handoff.md` | The plan. Phases 0–5, kill criteria, open questions. |
| `tools/make_synthetic.py` | Nucleus of the training simulator. Two secretion models (square-burst portal GnRH, exponential-clearance peripheral LH), every scale traced to a citation. Generalize this; inherit its sourcing standard. |
| `data/synthetic/README.md` | The citation ledger for those scales. The standard itself: a corpus on invented scales trains the wrong prior. |
| `tools/simulate_benchmark.py`, `data/benchmark/` | Phase-1 frozen benchmark as built so far: 200 series in `series/`, generating truth in `truth.json` (seed 20260810). |
| `tools/score_benchmark.ts`, `tools/score_against_truth.ts` | Scoring harnesses: benchmark corpus and Johnson's simulated data respectively. The latter reads a local Pulse_XP `Data/` folder via `PULSEXP_DATA` (see §2). |
| `tools/score_webster1991.ts` | Scores any detector against the one public real-data ground truth (§3). |
| `src/core/cluster.ts` + `src/core/` | The baseline to beat, both variants (`igor`, `fortran`), and a sanity-check labeler. |
| `scripts/cluster.ts` | The command line: one record or a whole directory under one parameter set, summary CSV out, `-v` for a per-pulse listing. Runs on bare `node`, no loader. (Was `scripts/run_csv.ts`, whose broken invocation — `next-steps.md` §7 — is fixed: `src/core/` imports now carry `.ts` extensions.) For *scoring* a corpus against ground truth you still want `tools/score_benchmark.ts`; this one reports, it does not score. |
| `docs/validation-status.md` | Every baseline number quoted below, with its caveats attached. |
| `docs/reference-code.md`, `docs/figure-data-permissions.md` | The license and permissions ground truth for everything in §2 and §3. |

## 2. The AutoDecon package — use locally, never commit

**Location:** `~/Dropbox-UniversityofMichigan/Richard DeFazio/nopeak/AutoDeconSoftware.zip`
(92 MB, 83 files), alongside `hypergeo.zip` and the Webster 1991 PDF.
`moenter 1992.pdf` (PMID 1727719, pulse-waveform priors) sits loose in the
parent directory.

**License first.** Johnson's license (in `HYPERGEO.PDF`, quoted in full in
`reference-code.md`) covers the "Hormone Pulse Analysis programs" family —
Pulse_XP, AutoDecon, Cluster8, HyperGeo. Local use is explicitly permitted;
**providing it to any third party is prohibited in writing**, and so is
for-profit use. So: point the new repo's tooling at a local unzip (the
`PULSEXP_DATA` pattern), publish *numbers and scripts*, never the software or
its data. This is why no_peak purged it from history once already.

What is inside, and why each part matters:

- **`Data/*.dat` + `*.ans`** — Johnson's simulated hormone series *with the
  generating answers* (`lhsim1–3`, `ghsim1–3`, plus real sheep records
  `gnrh-ewe23-ovx`, `lh-ewe23-ovx`, and others). This is the ground truth behind
  every baseline number in §4, and the corpus AutoDecon's published ~98% was
  measured on. `tools/score_against_truth.ts` already parses both formats
  (`.ans` gives basal secretion, half-life, and pulse onset times).
- **`pulse_xp.exe`** — Windows binary containing AutoDecon itself. Running it
  head-to-head on the Phase-1 synthetic corpus is the single best evaluation
  this project could add; needs Wine, a VM, or a lab PC.
- **`Docs/`** — twenty-plus manuals, notably `Pulse_XP_AutoDecon_0808.pdf` (the
  algorithm), `Pulse_XP_Cluster_0808.pdf` (Johnson's own CLUSTER documentation),
  and `Pulse_XP_FileFormat_0808.pdf` (needed to write `.dat` files pulse_xp can
  read — i.e., to feed it our corpus).
- **`ppt/`** — Johnson's lecture slides; `mlj_6_other_algorithms.ppt` is a
  survey of the competitor landscape from the man who wrote half of it.
- **`hypergeo.zip`** — `HyperGeo.exe` plus the license PDF. Same family, same
  terms.

## 3. Ground truths available, ranked by what they can carry

1. **Johnson's simulated data + answers** (local only, §2): the established
   benchmark; every method in §4 has a number on it. Cannot be published — a
   public benchmark must come from the Phase-1 simulator instead.
2. **Webster et al. 1991 digitized records** (`data/digitized/`, public, in
   no_peak): eight real GnRH/LH traces with **70 published CLUSTER pulse calls**
   marked by the paper's own analysis — the only ground truth nobody in this
   project supplied. Two caveats travel with it and must be copied, not
   summarized away: (a) redistribution rests on an author's courtesy permission
   whose primary record is still being chased (`next-steps.md` §1);
   (b) ⚠ **the error column is reconstructed, not measured** — a fitted
   assay-CV model, not what the 1991 lab recorded. What Webster's group actually
   used for intra-assay error is an open question the owner is still running
   down; until it closes, any figure or fit built on that column must announce
   it. A detector trained or scored against those bars inherits the assumption.
3. **The frozen synthetic benchmark** (`data/benchmark/`, public): generating
   truth known exactly, publishable, but only as credible as the simulator —
   which is the whole Phase-1 gate.
4. **`data/extracted/`** (gitignored, lab machines only): eleven CSVs, of
   which three are real GnRH/LH series with *measured* per-sample error
   (`gnrh`, `LHInfused`, `set1`); the rest are manual test series and
   scratch waves. No truth labels; sim-to-real
   agreement checks only. Igor panel settings recorded alongside are priors for
   what humans actually choose.

## 4. Baseline numbers the new repo starts from

Measured against the generating pulse times in Johnson's simulated data
(details and caveats: `validation-status.md`):

| Detector | Sensitivity | False positives |
|---|---|---|
| CLUSTER, igor variant (this port) | 51.5% | 0 |
| CLUSTER, fortran variant (this port) | 60.8% | 0 |
| Johnson's published Cluster column | 58% | — |
| PULSAR Otago, best of threshold sweep | 56.2% | 6 |
| AutoDecon, published | ~98% ⚠ | ≈6× CLUSTER's rate |

⚠ AutoDecon's figure is a detection count (128 of 130), not a scored
sensitivity, and its false-positive comparison is *conditional on dense pulse
trains* — on a broad corpus CLUSTER's honest expectation is 16–22% FDR, not ~0.
The density-matched target for the Phase-1 gate is **the 50–65% sensitivity
band at <1% FDR** (measured 55.8% igor / 58.4% fortran, at 0.3/0.4% FDR) on a
corpus shaped like the reference data (~145 points, 10-min sampling,
~30 pulses, ~4% CV) — the band's derivation and its caveats are in
`deep-learning-handoff.md` Phase 1.

## 5. Standing decisions the new repo inherits

- **Client-side or it isn't no_peak-adjacent**: a few hundred KB of weights,
  CPU inference, sub-second on a 200-point series.
- **The error channel is an input, not an afterthought** — and see §3.2: know
  whether the error you are consuming is measured or reconstructed.
- **Ship beside CLUSTER, never instead of it**; existing results stay
  bit-identical.
- **Publish simulator + benchmark + weights + training code together**, or it
  is not usable science.
- **Sourcing standard**: every constant in the training distribution traces to
  a citation, the same rule `data/synthetic/README.md` enforces.
