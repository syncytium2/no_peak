# AGENTS.md

For an AI agent working in this repository, or asked to analyze hormone
time-series data with it. Humans want `README.md`; this is the short path to
doing the thing.

## What this is

A port of **CLUSTER** (Veldhuis & Johnson 1986) — pulse detection for endocrine
time series. Given concentrations sampled over time, it says which excursions
are secretory pulses. There is a web app at <https://nopeak.tonydefazio.com>,
and there is a command line, which is what you want.

## Analyzing data: use the command line, not the web page

```sh
npm install                                   # once
node scripts/cluster.ts <files-or-directory>... [options]
```

Plain `node` runs it — no build step, no loader, no extra dependency. It takes
CSV/TSV files or whole directories and writes **one summary row per record** to
stdout, or to `-o FILE`.

```sh
node scripts/cluster.ts records/ -o summary.csv
node scripts/cluster.ts records/ --preset webster1991_lh -o summary.csv
node scripts/cluster.ts one.csv --n-peak 3 --t-up 2.5 -v
node scripts/cluster.ts --help          # authoritative flag list
node scripts/cluster.ts --list-presets  # published settings, with citations
```

**Input** is plain text, one sample per line: `value`; `time,value`; or
`time,value,error`. Commas, tabs, semicolons or spaces; header row optional;
`#` and `//` lines ignored. Every row must be numeric — there is no
missing-value handling, and a blank stops the load with a line number.

**Output columns**: `segment`, `n_points`, `duration`, `n_pulses`,
`pulses_per_unit`, `mean_interpulse_interval`, `mean_peak_value`,
`mean_amplitude`, `mean_pulse_width`, `mean_nadir` — above them, `#` comment
lines carrying the version, the settings, the time base, and any preset's
citation.

**Common flags**: `--n-peak` `--n-nadir` `--t-up` `--t-dn` `--min-peak`
`--error-model` `--error-value` `--variant igor|fortran` `--preset` `--unit`
`--interval` `-o` `-v` `--strict`. Defaults match the app's.

## Four things to get right before reporting a number

1. **The detection parameters ARE the model.** Different settings give
   different pulse counts from the same record. Never report a count without
   the settings that produced it — which is why they ride in the CSV header.
   If the hormone and protocol match a published analysis, `--preset` supplies
   the settings *and* the citation.
2. **`peak_value` and `amplitude` are not the same thing**, and the literature
   routinely conflates them. `peak_value` is the highest concentration reached
   inside a pulse (Fortran `HEIGHT`); `amplitude` is that minus the preceding
   baseline (Fortran `L INCREASE`) — the rise. Both are reported. Say which one
   you mean.
3. **The CLI reports; it does not score.** Nothing in it compares a detection
   against a known pulse time. Sensitivity and false-discovery rates need
   ground truth: that is `tools/score_benchmark.ts`, and the measured numbers
   live in `docs/validation-status.md` **with caveats that matter** — read them
   before quoting any of them.
4. **CLUSTER is a 1986 method and misses pulses.** Against simulated data with
   known pulse times it recovers roughly half to two-thirds; deconvolution
   methods do better. `docs/validation-status.md` and the `/methods` page state
   this plainly, and so should you. Do not present it as a gold standard.

## One parameter set per batch, records analyzed independently

The CLI cannot vary the parameters per record, deliberately: per-animal tuning
makes the pulse counts incomparable between animals. And records never merge —
nothing is concatenated, and no averaging window spans two of them, so no pulse
is invented at a join and no interpulse interval is measured across one.

## Working on the code

- `src/core/` — the algorithm, pure TypeScript, no React and no DOM. Start at
  `cluster.ts`. `segments.ts` runs several records under one setting;
  `errorModel.ts` holds the seven variance models; `types.ts` has the shapes.
- `npm test` — vitest, and the suite is the contract. `scripts/cluster.test.ts`
  re-asserts through the CLI what `src/core/presets.test.ts` asserts through the
  library, including pulse counts published in the source papers.
- `npx tsc -b` — typecheck. `npm run build` — static bundle. `npm run deploy` —
  test, build, and ship to Cloudflare.
- **Imports inside `src/core/` carry explicit `.ts` extensions.** That is
  load-bearing, not style: it is what lets bare `node` run the CLI. Do not
  strip them — Vite resolves both forms, so no test will catch it.
- **The port exposes exactly the seven error models Igor exposes.** Not an
  eighth. A new model would have no validation oracle. If a per-sample error is
  needed, put it in the data as a third column and use Error Wave.

## Before you change anything

- **`docs/todo-now.md` is the short list of what is actually waiting**, and the
  session-start hook prints its headings at you. Start there.
  **`docs/next-steps.md` is the ranked open-work list** behind it and is the
  real record. Some items are blocked on the owner's decision rather than on
  effort; `todo-now.md` marks which.
- **Do not act on the session-start banner's stale-vendor verdict.** It reads a
  cache and has been wrong in both directions on the same day. Re-run that
  family's `tools/murderboard_freshness.sh` line with `--refresh --verbose`
  before believing it.
- **Another agent may be working in this same checkout**, sharing one working
  tree and one `.git`. Commit by path — `git commit --only <path>...` — never
  `git add -A` or `commit -a`; the index is shared, so careful staging alone
  still sweeps up a peer's work. `docs/multi-session-protocol.md` is the full
  account, and it is a transcript of things that actually went wrong.
- **Data provenance is enforced, not assumed.** `data/digitized/` is real
  measurement read off published figures (rights position:
  `docs/figure-data-permissions.md`);
  `data/synthetic/` corresponds to no animal. They are deliberately similar in
  shape and must never be described interchangeably; `src/samples.test.ts`
  enforces the labeling.
- **Four trees are gitignored and live in Dropbox, not in the clone.** If
  `data/extracted/`, `data/oracle/`, `data/oracle_igor/` or `reference/` look
  empty, they are not lost — run `python3 tools/data_root.py --status`, then
  `--pull`. **Do not hand-copy them and do not conclude they are missing**; a
  downLow session lost a day to exactly that on 2026-08-14 and retracted a
  finding over it. no_peak pushes and stays canonical, downLow pulls. Full
  account: `docs/data-store-coordination_2026-08-14.md`.

## The store, and the one rule attached to it

`<dropbox-member>/nopeak/data/` holds the four gitignored trees, one sha256
manifest each. `tools/data_root.py` resolves it from Dropbox's own `info.json`,
so it works on any machine and any OS without a hardcoded path.

⚠ **`reference/` is Johnson's third-party code — the only tree here we do not
own — and it is `default_synced=False`.** A bare `--push`/`--pull` skips it and
prints why. **Naming it explicitly is the consent, every time.** That is the
owner's choice, not a session's, and it is deliberately a small friction: it
puts a human in the loop on every movement of licensed material.

It is cleared to sync. The owner was **asked directly on 2026-08-14** and
cleared it: he works alone, and for this purpose a private member folder is
equivalent to local disk. Two limits ride with that clearance:

- **It does not carry.** It was given about a folder nobody else can see. If
  that member folder is ever shared, or the store re-pointed somewhere less
  private, the question **goes back to him** — it is not a judgment call for a
  session to make.
- ⚠ **And the review is wider than `reference/`.** At least two things sit in
  that member folder on the strength of its privacy, and the second is easy to
  miss because it is nowhere near the store:

  | what | where | why it is conditional |
  |---|---|---|
  | `reference/` | `<member>/nopeak/data/reference` | Johnson's licence — third-party code we may not redistribute |
  | permissions correspondence | `<member>/darkroom/no_peak/2026-08-13_permissions-correspondence` | third-party email quoting named people at Michigan and at a publisher |

  **Before that folder is shared, both come out and both questions go back to
  him** — and check for a third, because this list was written from what two
  sessions happened to notice. Anyone applying a rule that says "`reference/`"
  will be looking at the data store and will not think of a darkroom subfolder
  two directories away. `docs/figure-data-permissions.md` covers the second one.
- **This is a University of Michigan enterprise team Dropbox.** A member folder
  is private by default but team-administered, which is not the same as local
  disk. The owner weighed that and cleared it anyway; do not re-derive the
  conclusion from "it's private" without the second half.

**Do not infer a rights position from a convenient premise and attribute it to
the owner.** An earlier version of this section did exactly that — it asserted
an "owner determination" on a question nobody had put to him. The conclusion
happened to be right and it was still worthless, because a licence resting on an
invented approval is worth nothing. If a rights question is open, ask; the cost
of asking is a minute. The full account is in
`docs/data-store-coordination_2026-08-14.md` §5.3 and §7.

The other three trees are ours and are unaffected — do not reason about all four
as one group. See `docs/reference-code.md`.

## Reading rather than running

- <https://nopeak.tonydefazio.com/methods> — the citable reference. Real static
  HTML, no JavaScript, every heading has a stable id. `#batch` is this document's
  subject.
- <https://nopeak.tonydefazio.com/llms.txt> — the long-form machine-readable
  description, including the batch recipe and the honest limitations.
- The app at `/` is client-rendered React, but `index.html` ships a static
  summary inside `#root` for readers that do not run JavaScript.
