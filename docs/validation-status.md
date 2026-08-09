# Validation status

Honest accounting of what has and has not been checked, so the claim in the
README and on the site can be matched against reality.

_Last updated: 2026-08-08 (v0.2.0)._

> The reference Fortran and Igor sources are **not committed** — third-party
> code we cannot redistribute. See `docs/reference-code.md`. The oracle output
> in `data/oracle/` is committed, so the tests below run without them.

## What is verified

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

## What is NOT verified

- **No numerical diff against Igor.** The Igor experiment in `data/` is input
  only — it is literally named "just data.pxp" and contains no `pulse`, `ups`,
  `downs`, `Mscore`, or `err` output waves. There is no stored answer key.
- **No expert-annotated pulses.** No human-validated peak list exists for any
  dataset here, so "correct" currently means "matches the algorithm as read",
  not "matches what an endocrinologist would mark".
- **Only `gnrh` has been diffed against the Fortran**, at two parameter
  settings. The other ten datasets have not.
- **The `igor` variant — the default — is still unvalidated against Igor.**
  The Fortran oracle does not cover it: the two implementations genuinely
  differ (variance form, marking width), so agreeing with the Fortran says
  nothing about agreeing with Igor.

So the accurate claim today is: *the Fortran variant is numerically validated
against the original Fortran on one dataset; the Igor variant, which is the
default, is a careful translation that has never been diffed against Igor.*
The README and the About page say "validated against the Igor Pro
implementation", which is still the one thing not yet true — either the wording
or the evidence should change.

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

### 1. Capture the Igor oracle — READY TO RUN (needs Igor Pro + a human)

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
