# no_peak

Port of the CLUSTER pulse-detection algorithm (Michael L. Johnson / Veldhuis-Johnson
CLUSTER analysis for hormone pulsatility) to a client-side web app, validated
against existing datasets.

**Everything runs in the browser — no backend, uploaded data never leaves the
user's machine.** Figures are publication-grade SVG (vector) with 4× PNG export.

## App

- `npm run dev` — local dev server
- `npm test` — core algorithm tests (vitest)
- `npm run build` — static bundle in `dist/`
- `npm run deploy` — test + build + `wrangler deploy` (Cloudflare Workers,
  assets-only, same model as colonel-kernel; wrangler uses the machine's cached
  Cloudflare OAuth). Custom domain is added in the Cloudflare dashboard —
  DNS for tonydefazio.com is Cloudflare-managed, nothing to do at Porkbun.

Code layout: `src/core/` is the algorithm (pure functions — `cluster.ts`,
`mscore.ts`, `errorModel.ts`, `peaks.ts`), `src/chart/` the publication figure
(custom SVG, palette validated with the dataviz six-checks validator),
`src/App.tsx` the UI. `?demo` in the URL auto-loads the demo dataset.

Port fidelity notes:
- The port follows the **Igor implementation** (the validation oracle),
  including its quirks: pooled S sums `NDF*STDEV` unsquared (the original
  Fortran squares it — switchable via the "Fortran pooled-variance form"
  option), and each up-flag opens a pulse of nPeak−1 points (Fortran: nPeak).
- Peak/valley tables follow the Fortran reporting passes, including their
  inclusive-boundary loops and the edge rule (a run touching the record edge
  is shaded but not tabulated).

Source material copied from `gitlab.com/um-mip/coding-project`
(local: `~/Documents/coding-project`).

## reference/fortran — the original algorithm

- `CLUST5.MPF` — CLUSTER v6.01, standalone Fortran 77 console program
  (VAX/PC/Mac/Unix via #ifdef). The canonical algorithm:
  - `GETDAT` — reads data, computes per-point mean/SD/NDF with 10 variance-model
    options; also reads "FIX" files (`@$` header: mean, SD, time, nreps) with
    missing-point interpolation.
  - `UPS` / `DNS` — sliding pooled t-test comparing a trailing "nadir" window
    (NNADIR points) to a leading "peak" window (NPEAK points); flags significant
    increases/decreases given user t-score thresholds and a minimum data value.
  - Main program — combines up/down flags into a logical PULSE array
    (passes 1–4), then extracts peaks (position, width, height, % increase,
    area, increase above basal) and valleys (width, nadir, mean), plus
    mean/SD summaries (`MSD`).
- `do_cluster.mpf` — later Fortran 90 module ("CLUSTER8" v8.00) embedded in a
  Winteracter GUI app. Same core algorithm (parameters passed in instead of
  prompted), plus extras: `outlier_good_bad` (half-life-based outlier
  detection), `refine_answers`, `mua`/`mua2` (secretion summary stats,
  AIC/AICc/BIC/SBC), `res_runs` and `res_auto` (residual runs test and
  autocorrelation). Note: only reads FIX-format input; the interactive
  variance-model code is commented out.

## reference/igor — existing Igor Pro port (working reference implementation)

- `ClusterMasterV4-1.ipf` — the real port of the algorithm. Key ThreadSafe
  functions: `ClusterMain` (entry), `UPorDN` (= UPS/DNS), `pulseTest`
  (= pass-four pulse assembly; comments cite the Fortran line labels),
  `mScore` (t-statistic), `ts_error` (error/SD wave construction),
  `getNumPeaks`. Also the `Cluster0` panel UI.
- `JP_Cluster.ipf` + `mip_cluster.ipf` — MIP_Cluster panel GUI wrapper,
  settings/results tables, menus.
- `ClusterOutputProcessor-v1-3.ipf` — post-processing of the pulse output
  (pulse/interpulse durations etc.).
- `JP Cluster loader.ipf` — Igor package loader (INSERTINCLUDE list shows the
  full dependency set, which also includes `banalysis v1-0`,
  `burstanalysis v4-0`, `JP_shuffle v0-1`, `tonys_tools`).

## data

- `cluster td- just data.pxp` — Igor experiment containing sample cluster
  data (from `~/Documents/coding-projectx/sample data in pxp/`), for
  validating the web port against the Igor/Fortran results.

## Port plan (sketch)

1. Implement the core in plain TypeScript (or Python service): UPorDN sliding
   pooled t-test, pulse assembly, peak/valley summarization, optional outlier
   pass. Pure functions, no UI deps.
2. Web UI: paste/upload time series (CSV), set nPeak/nNadir/t-scores/minPeak,
   plot data with pulse overlay + up/down markers (mirrors the Igor panel).
3. Validation: export waves from the .pxp (and/or run parameter sets recorded
   in the panel settings tables), compare pulse flags and peak tables against
   Igor output; optionally compile CLUST5.MPF with gfortran as a second oracle.
