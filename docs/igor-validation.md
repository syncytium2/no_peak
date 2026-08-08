# Validating no_peak against Igor

The goal: make the claim "validated against the Igor Pro implementation" true by
diffing this port against Igor's own output, point by point.

You need Igor Pro, `data/cluster td- just data.pxp`, and
`reference/igor/ClusterMasterV4-1.ipf`. Budget 20 minutes.

## The short version

1. Open the experiment; make sure `ClusterMasterV4-1.ipf` is compiled.
2. Open `tools/igor/no_peak_validate.ipf` (File ▸ Open File ▸ Procedure) and
   compile.
3. In Igor's **Command Window** (the pane at the bottom of the main window —
   Igor has no shell-level batch mode, see below), run either:
   - `np_ValidateAll()` — asks for an output folder, or
   - `np_ValidateAllTo("/Users/you/Developer/no_peak/data/oracle_igor")` —
     no dialog, writes straight into the repo.
4. It writes 15 CSVs.
5. If you used `np_ValidateAll()`, copy the folder to `data/oracle_igor/`.
6. `npm test` — the Igor oracle suite goes from skipped to real.

## Igor has no batch mode

There is no `igor -batch` equivalent to `matlab -batch` or `Rscript`: Igor is
GUI-only, and "command line" above means Igor's own Command Window.

Igor64.app *is* AppleScript-enabled (`NSAppleScriptEnabled = true`), so it can
be driven with `osascript` sending the standard do-script event
(`«event miscdosc»`). Two traps, both hit while trying it here:

- Igor ships classic terminology, not a modern `.sdef`, so `do script` fails to
  compile under that name — the raw event code is required.
- **Any dialog blocks the Apple Event until it is dismissed**, and the reply
  then fails with `AppleEvent timed out (-1712)`. That is why
  `np_ValidateAllTo()` exists and uses `NewPath/O/Q/Z`: an interactive
  `NewPath` will pop a folder picker and hang the automation.

For a one-off validation, typing one line into the Command Window is simply
faster than fighting this.

Each CSV records its own parameters in a header comment, so the test harness
reads the settings from the file. You do not need to tell the tests anything.

## If you would rather drive the panel by hand

The exporter just calls `ClusterMain` and saves waves; you can do the same
manually. For a wave named `gnrh` the relevant outputs are:

| Wave | What it is |
|---|---|
| `pulse_gnrh` | the 0/1 pulse array — the single most important one |
| `ups_gnrh` / `downs_gnrh` | significance flags |
| `Mscore_ups_gnrh` / `Mscore_downs_gnrh` | the t-score traces |
| `err_gnrh` | the error array `ts_error` built (absent if you supplied your own) |

Save them as delimited text with the wave names in the first row, one file per
run, and name each file after its settings.

The call the exporter makes, for reference:

```
ClusterMain(wn, nPeak, nNadir, tScoreUp, tScoreDn, minPeak, halfLife,
            outScore, errType, errVal, zero, zeroTerminate, errwn, minnadir)
```

`halfLife`, `outScore`, and `minnadir` do not affect detection — `minnadir`
reaches `pulseTest` but every line that would use it is commented out in
V4-1 — so the exporter passes 0 for all three. `errwn` is a **wave name**: pass
a non-empty string and that wave is used directly as the error, bypassing
`ts_error` entirely (this is the "Error Wave" case).

## The waves in this experiment

Names matter, and two of them are awkward:

| Data | Error | Points | Note |
|---|---|---|---|
| `gnrh` | `sem` | 96 | the app's default dataset |
| `set1C1(RD)` | `set1C2(STDEV)` | 145 | also has `set1C3(Times)`; parentheses in the name |
| `LHInfusedC1(RD)` | `LHInfusedC2(STDEV)` | 61 | parentheses in the name |
| `man2`–`man6`, `null1`, `wave0`, `wave1` | — | 16–145 | value only |

The exporter duplicates the two parenthesised pairs to clean names
(`np_set1`, `np_set1_sd`, `np_lhinf`, `np_lhinf_sd`) before running, because
liberal names are a needless source of trouble.

## The matrix, and why each row exists

Every row targets a branch in the port that nothing else reaches. If you only
have time for a few, do **A, C, and E** — they cover the default path, the
question the Fortran work left open, and the error-model code.

| # | Wave | nPeak | nNadir | tUp | tDn | minPeak | Error model | errVal | zeroTerm | What it proves |
|---|---|---|---|---|---|---|---|---|---|---|
| A | gnrh | 2 | 2 | 2 | 2 | 0 | Error Wave (`sem`) | — | 0 | The defaults the app ships with. If only one run happens, this is it. |
| B | gnrh | 1 | 1 | 2 | 2 | 0 | Error Wave (`sem`) | — | 0 | The settings actually stored in the panel. nPeak=1 makes loop 1200 mark `nPeak−1 = 0` points — a genuine edge case. |
| C | gnrh | 3 | 1 | 2 | 2 | 0 | Error Wave (`sem`) | — | 0 | **Asymmetric windows.** Decides whether Igor swaps the two window sizes on the downs pass, as the Fortran does. See below. |
| D | gnrh | 1 | 3 | 2 | 2 | 0 | Error Wave (`sem`) | — | 0 | The mirror of C, so the answer cannot be a coincidence of which is larger. |
| E | gnrh | 2 | 2 | 2 | 2 | 0 | Local SD | — | 0 | `ts_error`'s sliding-window path, including how it fills the edges. |
| F | gnrh | 2 | 2 | 2 | 2 | 0 | Local SE | — | 0 | Same, standard-error form. |
| G | gnrh | 2 | 2 | 2 | 2 | 0 | Global SD | — | 0 | Whole-record SD. |
| H | gnrh | 2 | 2 | 2 | 2 | 0 | Global SE | — | 0 | Whole-record SE. |
| I | man3 | 2 | 2 | 2 | 2 | 0 | Fixed | 0.1 | 0 | Fixed error on a value-only wave. 0.1 is the panel's stored `g_FixedValue`. |
| J | man3 | 2 | 2 | 2 | 2 | 0 | SQRT | 0.01 | 0 | Square-root model and its non-positive fallback. 0.01 is the stored `g_SQRT0value`. |
| K | gnrh | 2 | 2 | 3 | 1.5 | 0 | Error Wave (`sem`) | — | 0 | Asymmetric thresholds — catches any up/down mix-up. |
| L | gnrh | 2 | 2 | 2 | 2 | 1 | Error Wave (`sem`) | — | 0 | The minimum-data-value (`dvmp`) gate, which is otherwise never exercised. |
| M | null1 | 2 | 2 | 2 | 2 | 0 | Local SD | — | **1** | The 2017 zero-activity termination heuristic. |
| N | set1 | 2 | 2 | 2 | 2 | 0 | Error Wave | — | 0 | Longest real series. |
| O | LHInfused | 2 | 2 | 2 | 2 | 0 | Error Wave | — | 0 | Second real series with a genuine error wave. |

`zero` is 0 everywhere; only row M turns termination on.

## What C and D are really asking

The compiled Fortran (see `docs/validation-status.md`) turned out to run its
**downs** pass with the two window sizes exchanged, because `CLUST5.MPF`
declares `COMMON /MISC/` in one order in `UPS` and the opposite order in `DNS`.
Igor's `ClusterMain` passes `(nPeak, nNadir)` identically for both directions
and appears not to swap — this port follows Igor — but that has never been
checked against running Igor.

Rows C and D settle it. They cannot disagree when `nPeak == nNadir`, which is
why every other row in the matrix is symmetric and why this went unnoticed.

- If C and D **match**, the port is right and the Fortran's swap is a quirk of
  that lineage. Nothing changes.
- If C and D **differ**, Igor swaps too, this port is wrong for asymmetric
  windows, and `upOrDn` needs the exchange in the downs call.

Either answer is worth having. The defaults are unaffected either way.

## What the tests check

For every file: the error array, the up flags, the down flags, the pulse array,
and the t-score trace — element by element. Flags and pulses must match exactly;
floats are compared to a tolerance.

Time bases are deliberately ignored. Igor's waves use point scaling (x = 0, 1,
2, …) while the CSVs here carry real sampling times, and none of the compared
arrays depends on the time base — only widths and areas do.

## If something disagrees

Do not "fix" the port to match until the disagreement is understood. Check, in
order: the error array (if `err` differs, everything downstream will), then the
t-scores (a variance-form difference), then the flags (a threshold or window
boundary), then the pulse array (assembly, most likely the backward zap).

The first array that diverges is the one to debug; later ones are downstream
consequences.
