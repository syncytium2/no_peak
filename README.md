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

Readable without JavaScript: the app is client-rendered, so anything that fetches
the URL without running a browser — a crawler, a reviewer's AI assistant, a text
browser — used to get an empty `<div id="root">`. Two things fix that and both
need to stay accurate:

- `index.html` ships a static summary **inside** `#root`. React's
  `createRoot().render()` clears the container on mount (`clearContainer` sets
  `textContent = ''`), so it is replaced by the app and doubles as the loading
  state. It also carries canonical/OpenGraph tags and a `SoftwareApplication`
  JSON-LD block.
- `public/methods.html` + `public/methods.css` — the standalone **Methods &
  Algorithm Reference**, served at `/methods`. Plain static HTML, no framework,
  no JavaScript, no external requests. This is the citable page and the one an
  agent can actually read. Same pattern as colonel-kernel's `/methods`.
- `public/llms.txt` is the long-form machine-readable description: scope,
  validation numbers, and the honest limitations from
  `docs/validation-status.md`.
- `public/sitemap.xml` lists `/` and `/methods`.

All of these repeat numbers that live in `docs/validation-status.md`; change
them together.

`public/robots.txt` welcomes every crawler including the AI ones, matching
colonel-kernel's stated policy and for the same reason: this is a free public
scientific tool that should be discoverable and described accurately, and the
app holds no user data to expose.

> ⚠ **That policy is currently NOT in effect, and the override is invisible from
> this repo.** Cloudflare's AI Crawl Control injects a *managed* robots.txt at
> the edge that prepends `Disallow: /` groups for ClaudeBot, GPTBot, CCBot,
> Google-Extended, Bytespider, Amazonbot, Applebot-Extended and
> meta-externalagent. Those named groups are more specific than our
> `User-agent: *`, so they win. On kernel.tonydefazio.com it is worse: the
> managed file *replaces* the site's own robots.txt outright, so colonel-kernel's
> "all crawlers welcome" text and its `Sitemap:` line never reach the wire at
> all. Fixing it means turning the managed robots.txt off in the Cloudflare
> dashboard for the `tonydefazio.com` zone (and leaving Security > Bots >
> "Block AI Scrapers and Crawlers" off too). Nothing in this repo can override
> it. Verify with `curl -s https://nopeak.tonydefazio.com/robots.txt`.

Code layout: `src/core/` is the algorithm (pure functions — `cluster.ts`,
`mscore.ts`, `errorModel.ts`, `peaks.ts`, `format.ts`) plus the input and
reporting layers around it (`igor.ts` reads Igor `.pxp`/`.ibw` binaries,
`segments.ts` runs several records under one set of settings, `timeUnits.ts`
owns the time base and pulse frequency); `src/chart/` the publication figure
(custom SVG, palette validated with the dataviz six-checks validator);
`src/App.tsx` the UI; `src/NumField.tsx` and `src/IgorPicker.tsx` its two
non-trivial controls; `src/About.tsx` the about/citations page (hash route
`#about`); `src/version.ts` the build stamp (`__APP_VERSION__` and
`__BUILD_DATE__` are injected in `vite.config.ts`; bump `package.json` version
to change what the app reports).

`src/samples.ts` bundles both kinds of dataset — see below. The **simulated** ones (`data/synthetic/`, made by
`tools/make_synthetic.py`) via `?raw` imports and drives the "Sample data"
picker; `sim_gnrh_thx_ewe` loads by default so the app never opens blank. Real
lab recordings are NOT bundled and NOT committed — see `docs/reference-code.md`.

`data/digitized/` holds eight REAL hormone records, read off the published
figures of Webster et al. 1991 with an author's permission
(`tools/digitize_webster1991.py`). Those figures mark every pulse that paper's
own CLUSTER run identified, so the set carries a ground truth nobody here
supplied — the only such data in the project. See `data/digitized/README.md`,
and `docs/figure-data-permissions.md` for how the permissions question was
settled. The article itself is NOT redistributed; only the numbers.

**Read `data/synthetic/README.md` before adding a dataset.** Every scale in a
bundled dataset has to be traceable to a citation, recorded next to the
parameter it justifies; test data is either simulated from documented physiology
or digitized from a publishable figure, and is labeled as such. This is a
standing constraint, not a style preference — an earlier GnRH dataset here was
generated with an exponential clearance tail the hormone does not have, on a
time scale ten times too fast, and that mis-teaches the window settings to every
user who calibrates against it. Adding a dataset = generate it into
`data/synthetic/`, cite the scales, add one `SAMPLES` entry with its time unit,
sampling interval and provenance note. Anything from that menu is tagged
"simulated" in the UI.

Port fidelity notes:
- The **Implementation** selector switches the whole algorithm between the
  Igor port (`variant: "igor"`, the default and the validation oracle) and the
  original Fortran (`variant: "fortran"`). Fortran mode squares the error term
  in the pooled S (Igor sums `NDF*STDEV` unsquared), and uses a separate
  verbatim port of the CLUST5 pass-four assembly (`pulseAssemblyFortran`):
  NPEAK-wide loop-1200 marking (Igor's do-while marks max(1, nPeak−1)), `PULSE(1)`-only initial
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
(local: `~/Documents/coding-projectx`).

## docs

- **`docs/next-steps.md` — read this first.** Open work, ranked, with what is
  blocked on a decision rather than on effort.

- `docs/deep-learning-handoff.md` — plan for a learned
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
without them those suites skip. Committed: `data/synthetic/` and `data/benchmark/` (simulated, ours) and
`data/digitized/` (real, read off a published figure with an author's permission).

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

## Document review (murderboard)

`docs/doc_review_process.md`, `tools/murderboard_*.sh` and
`.claude/skills/murderboard/SKILL.md` are **vendored** from
`syncytium2/murderboard` (stamped `@ b2b2ba2`). Run `/murderboard <artifact>`
before handing over any document deliverable — a figure, an explainer, a
methods section, a report. Run records live in `docs/reviews/`.

- `bash tools/murderboard_freshness.sh --verbose` — is the vendored copy current?
- `bash tools/murderboard_roster.sh check <report>` — did every role actually run?

Re-vendor by copying the files from upstream and updating the `@ <sha>` stamp in
the first lines of each.
