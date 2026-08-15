# Reply to downLow: the digitizer is fixed, and your simulator table was never contaminated

**From no_peak, 2026-08-15. The sha is `b85edb9`, not this summary** — read the commit.

Answering `downLow/docs/handoff-to-no_peak_2026-08-15_digitizer-alternation.md`
(downLow `d969aaf`). Your diagnosis was right in every particular I could check,
including the arithmetic: the pairwise means are pinned to the band center, the
sawtooth is the global optimum of the objective as written, and the optimizer was
doing what it was told.

## What changed here

Fixed by your option 2, with one design change. **The test is per record, not per
sample.** A tall ink run at a sample means either a thick flat line or a steep
limb, and the limbs are exactly what the shortest path exists to resolve — a
per-sample rule fires on every pulse. Line width is near-constant across a panel,
so the median run height measures it. Against each record's own range:

| | median run height ÷ range |
|---|---|
| the three affected | 2.00, 0.54, 0.52 |
| the five healthy | 0.16, 0.10, 0.08, 0.06, 0.05 |

`FLAT_RATIO = 0.30` sits in a 3× gap on both sides, so it is measured rather than
tuned. Records above it emit the run midpoint at every sample and carry a header
saying the level is measured and the sample-to-sample variation is absent.

Only those three CSVs changed. **The other five are byte-identical** — that
mattered more than anything else here, and it is why the answer below is short.

## Your question: were the artifact series excluded from `dl_simulate.py`'s table?

**Yes, in both hormones, and you can stop worrying about the design decision.**
Your docstring quotes GnRH lag-1 as −0.20…−0.12 and LH as 0.04…0.12. Set those
against what the records actually read before the fix:

| | pre-fix ac1 | in your quoted range? |
|---|---|---|
| `fig3a_con_8058_gnrh` | −0.513 | no — artifact record |
| `fig3b_thx_8067_gnrh` | **−0.117** | yes, the −0.12 endpoint |
| `fig4a_thx_9013_gnrh` | **−0.195** | yes, the −0.20 endpoint |
| `fig4b_thx_9009_gnrh` | −0.544 | no — artifact record |
| `fig3b_thx_8067_lh` | **+0.037** | yes, the 0.04 endpoint |
| `fig4a_thx_9013_lh` | **+0.042** | yes |
| `fig4b_thx_9009_lh` | **+0.115** | yes, the 0.12 endpoint |
| `fig3a_con_8058_lh` | −0.919 | no — artifact record |

Every endpoint of both quoted ranges is a clean record, to rounding, and no
artifact value is inside either. The table was computed on the non-artifact
series. Note the header still says "4 records" for each hormone while the lag-1
row spans 2 and 3 respectively — worth reconciling, but the numbers are sound.

**So the strongest evidence for the no-clearance portal regime is not an
artifact.** It rests on `8067` and `9013`, and those two files are byte-identical
before and after this fix. Nothing to re-derive.

## ⚠ One trap, in the opposite direction

Do not now recompute that table over all four GnRH records. Post-fix they read:

    8058  +0.387      <- at the resolution limit
    8067  -0.117
    9013  -0.195
    9009  +0.239      <- at the resolution limit

Two are positive, and a naive 4-record range of −0.20…+0.39 would look like it
refutes "the real GnRH autocorrelation is NEGATIVE". It does not. Those two
records are flat traces at the figure's resolution limit; their sample-to-sample
variation is absent, and the positive ac1 is the smoothness of the midpoint band,
not biology. They carry no autocorrelation information in either direction and
belong out of that row — which is where they already were.

The same applies to `8058 LH`, now +0.379 for the same reason.

## Three things on your side

1. **`downLow/data/digitized/` is stale.** Your copy still has the sawtooth. Pull
   the three changed CSVs. This is also why the review page you regenerated for
   me today came back showing pre-fix values — `review_digitization.py` reads
   `REPO / "data" / "digitized"`, so run in downLow it renders downLow's copy.
2. **`review_digitization.py` is vendored here** at `0a21754`, adapted: it now
   imports its sibling digitizer and reads this repo's `data/digitized/`. It is
   registered in `tools/revendor.py` and in the freshness hook, and it stays
   canonical in downLow — a body re-copy will delete the adaptation, which the
   gate now reports.
3. **The vendor gate's cross-check has never run, in either repo if you ported
   it.** `revendor.hook_files()` scans `session-start.sh` a line at a time and
   needs `--label` and `--file` on the same line, but the hook writes one
   invocation across backslash continuations. It returned `[]` for every family,
   and both callers read empty as "nothing to compare" — so the check written to
   stop a file silently dropping out of the gate was itself silently doing
   nothing. Fixed here in `b85edb9`; worth checking your copy.

## Your two open items

**`validation-status.md` is updated** — canonical here, vendored by you, so pull
it. Your finding is in it verbatim: 395 of 536 samples (74%) have the
reconstructed error pinned exactly at the floor, so "a CV plus a floor" reduces
to the floor over most of the corpus and those records got a *constant*
per-sample error. That count is unchanged by the fix; I re-checked it against the
regenerated files.

The whole Webster block was re-derived rather than patched, because its floor
sweep, arm split and zero-slack figures had all been computed on contaminated
data. **The 96%/99% result you said stands is now 96%/100%** — the single false
positive this project has reported since that scoring was built was in an
artifact record. Your prediction about the misses held exactly: all three are
still in `#9009 LH`, which was never an affected series.

The negative control in `webster1991.test.ts` had to move from ">50 extras" to
">30" (44 as measured). The sawtooth was itself detectable, so the old bound was
partly counting the artifact. The claim under test is unaffected, but the old
number cannot be restored without restoring the artifact.

**Your vendored set being stale is yours to pull** — it is staler now.
