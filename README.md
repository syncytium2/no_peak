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
`mscore.ts`, `errorModel.ts`, `peaks.ts`, `format.ts`), `src/chart/` the
publication figure (custom SVG, palette validated with the dataviz six-checks
validator), `src/App.tsx` the UI, `src/About.tsx` the about/citations page
(hash route `#about`), `src/version.ts` the build stamp (`__APP_VERSION__` and
`__BUILD_DATE__` are injected in `vite.config.ts`; bump `package.json` version
to change what the app reports).

`src/samples.ts` bundles the **simulated** datasets (`data/synthetic/`, made by
`tools/make_synthetic.py`) via `?raw` imports and drives the "Sample data"
picker; `sim_gnrh` loads by default so the app never opens blank. Real lab
recordings are NOT bundled and NOT committed — see `docs/reference-code.md`.
Adding a dataset = generate it into `data/synthetic/` and add one `SAMPLES`
entry. Anything from that menu is tagged "simulated" in the UI.

Port fidelity notes:
- The **Implementation** selector switches the whole algorithm between the
  Igor port (`variant: "igor"`, the default and the validation oracle) and the
  original Fortran (`variant: "fortran"`). Fortran mode squares the error term
  in the pooled S (Igor sums `NDF*STDEV` unsquared), and uses a separate
  verbatim port of the CLUST5 pass-four assembly (`pulseAssemblyFortran`):
  NPEAK-wide loop-1200 marking (Igor marks nPeak−1), `PULSE(1)`-only initial
  state, loop 1300 from the second point, backward zap down to index 1.
  In practice the zap canonicalizes both to the same runs for ordinary
  bounded pulses, so the visible difference comes from the variance form.
  Fortran mode also switches the UI and figure to a green-phosphor MS-DOS
  theme (`body.dos` in `styles.css`, `FIG_DOS` in `chart/palette.ts`).
- Peak/valley tables follow the Fortran reporting passes, including their
  inclusive-boundary loops. **Exception:** the Fortran drops a final pulse
  whose trailing nadir window doesn't fit in the record; `includeTruncated`
  (default on, UI checkbox) reports it instead, with after-nadir-dependent
  stats (mean %, area) null. A pulse already in progress at the start has no
  detected onset and is never tabulated in either mode.
- Displayed numbers go through `core/format.ts`: anything needing more than 3
  significant digits is clamped to one decimal. Exports keep full precision.

Source material copied from `gitlab.com/um-mip/coding-project`
(local: `~/Documents/coding-project`).

## docs

- `docs/deep-learning-handoff.md` — proposal (nothing built) for a learned
  pulse detector, framed as amortized simulation-based inference so it trains
  on the accepted generative model and emits calibrated posteriors instead of
  point estimates. Includes kill criteria and the client-side constraint.

## reference/ — NOT in this repository

The original Fortran and the Igor Pro Cluster package are third-party code we
do not have redistribution rights for. `reference/` is gitignored; see
`docs/reference-code.md`. Everything below describes files you supply locally.

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

**Not committed** (gitignored): `cluster td- just data.pxp`, `data/extracted/`,
`data/oracle/`, `data/oracle_igor/` — real lab recordings and output derived
from them. Keep them locally to run the oracle tests and regenerate oracles;
without them those suites skip. Committed: `data/synthetic/` only.

- `cluster td- just data.pxp` — Igor experiment containing sample cluster
  data (from `~/Documents/coding-projectx/sample data in pxp/`), for
  validating the web port against the Igor/Fortran results.
- `data/extracted/` — every wave from the pxp exported to CSV
  (`tools/pxp_extract.py`, igor2 library): three complete sets with errors
  (`set1.csv` time/value/SD, `LHInfused.csv` value/SD, `gnrh.csv` value/SEM —
  index time base for the latter two), six manual test series (`man2`–`man6`,
  `null1`), two scratch waves, and `igor_panel_settings.txt` — the Cluster
  panel globals stored in the experiment (last Igor run: nPeak=1, nNadir=1,
  tUp=tDn=2, minPeak=0, error model = user error wave).
- `scripts/run_csv.ts` — CLI runner for validation
  (`npx vite-node scripts/run_csv.ts data/extracted/set1.csv 2 2 2 2 0 "Error Wave"`).

## Port plan (sketch)

1. Implement the core in plain TypeScript (or Python service): UPorDN sliding
   pooled t-test, pulse assembly, peak/valley summarization, optional outlier
   pass. Pure functions, no UI deps.
2. Web UI: paste/upload time series (CSV), set nPeak/nNadir/t-scores/minPeak,
   plot data with pulse overlay + up/down markers (mirrors the Igor panel).
3. Validation: export waves from the .pxp (and/or run parameter sets recorded
   in the panel settings tables), compare pulse flags and peak tables against
   Igor output; optionally compile CLUST5.MPF with gfortran as a second oracle.
