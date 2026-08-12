# External expert review of the app — findings and what was done

**Date:** 2026-08-11 · **Reviewer:** a reproductive neuroendocrinologist outside
the project, working from the live app. Kept unattributed here at their
request; the feedback is recorded, the source is not.

This is the first review by someone who runs these analyses for a living rather
than someone who ported the algorithm. It found one class of problem that
internal review had no way to catch: the app was correct about CLUSTER and wrong
about endocrinology.

## The finding that mattered most

**The bundled simulated data was not physiologic, and its scales were wrong.**
Verbatim: *"scales wrong on sample data"*. Three compounding errors in the GnRH
dataset:

- It applied an exponential clearance tail to GnRH. GnRH has no half-life worth
  modeling at these resolutions — circulating half-life is 2–4 minutes, shorter
  than any collection window, and portal blood is collected as integrated
  fractions. A pulse belongs in one or two samples with an abrupt return, not a
  decay spanning five.
- Its sampling interval was sample index relabeled as minutes, making the pulse
  interval ten times too fast.
- It was described as "fast sampling" when what was meant was high pulse
  frequency — a different claim about a different quantity.

Fixed by rewriting `tools/make_synthetic.py` around two separate secretion
models — square bursts integrated over collection fractions for portal GnRH,
exponential clearance for peripheral LH, where clearance genuinely applies — with
every scale traced to a citation. The standard test data now has to meet, and
the reasoning behind it, is written down in `data/synthetic/README.md`.

### The source paper, once it was actually read

The reviewer cited *Endocrinology* 1991;129(3) — thyroidectomized ewes, 6-minute
sampling, GnRH pulses every 12 minutes. The paper is Webster JR, Moenter SM,
Barrell GK, Lehman MN, Karsch FJ, PMID 1874193, and it is not open access; a
copy was supplied. Reading it settled three things that guesswork had got wrong,
including this project's own first guesses.

- **Sampling was every 5 min for 6 h**, for the portal GnRH collection. The
  6-minute interval in the reviewer's recollection is real but belongs to the
  jugular LH *presampling* — venipuncture every 6 min for 6 h before the portal
  surgery. Both are in the same Methods paragraph.
- **Pulse frequency was 11.2 ± 1.4 pulses/6 h** in thyroidectomized ewes — an
  interpulse interval near 32 min, not 12 — with as many as 21 pulses in 6 h in
  one ewe. Thyroid-intact controls showed generally no pulses at all. The "every
  12 minutes" does not appear; the closest is the 21-pulse ewe at ~17 min.
- **The paper prints its CLUSTER settings**, which had not been anticipated at
  all: peak and nadir clusters of one point, t = 3.2/3.2 for GnRH and 2.32/2.32
  for LH, stated to give false positive rates of 1% and 5%. It used this
  algorithm, so those are directly reusable.

The GnRH datasets were rebuilt to that protocol, and the two settings now ship
as presets. `sim_gnrh_thx_ewe.csv` returns the paper's 11 pulses per 6 h at the
paper's own settings and `sim_gnrh_intact.csv` returns about one — what a stated
1% false-positive rate predicts over 72 samples — both asserted in
`src/core/presets.test.ts` so the tie breaks loudly if either drifts.

Worth noting what this cost to get wrong: before the paper was available, an
earlier pass had reasoned from the abstract and the surrounding literature to
10-minute fractions and a ~50-minute interval — defensible, sourced, and still
not what the paper says. The reviewer's recollection was closer than the
inference was. The lesson is narrow and practical: for a protocol, read the
Methods section, and do not substitute a companion paper for it.

An unexpected consequence: the reviewer could not type `1` into the peak-window
field, and one point is exactly what this paper specifies. The entry bug was
blocking a published parameter set, not an exotic setting.

## Everything else, and its disposition

| Finding | Done |
| --- | --- |
| Seconds axis ticked 100, 200, 300 — should be clock divisions | `timeTicks` in `src/chart/scale.ts` ticks on a 1/2/5/10/15/30/60/300… second ladder |
| X-axis units unlinked from the data source and sampling interval | One time-unit setting now drives the axis label, the sampling-interval field, the tick ladder, and the units of every reported interval |
| Frequency is the headline number and had no prominence | Pulse frequency leads the statistics row, in pulses/h, with the count and duration under it |
| Peak vs amplitude conflated; "increase" is amplitude | `Peak.height` → `peakValue`, `increase` → `amplitude`; a nadir column added so peak − nadir = amplitude reads off the table; the Fortran's own names noted so old output stays traceable |
| Nadir absent from the peak table | Added as "baseline (nadir)" |
| Could not tab through settings quickly | Fields select their contents on focus; ↑/↓ step, Shift for ten steps, Esc reverts |
| First number field refused the value 1, repeatedly | Real bug, reproduced and fixed — see below |
| "Fast sampling" is irritating wording | Now "high pulse frequency" / "10-min fractions" throughout |
| Need for high-quality or digitized test data, labeled | `data/synthetic/README.md` sets the standard; the figure data was digitized with an author's permission the same day — see `data/digitized/` |

## The number-entry bug

Worth writing down because it was invisible to anyone who did not try to type a
value smaller than the default.

Every settings field was `<input type="number" value={String(n)} onChange={e =>
set(Number(e.target.value))}`. Clearing the field makes `e.target.value` the
empty string; `Number("")` is 0; the field is rewritten to `"0"` underneath the
caret. The next keystroke lands against that stray zero, so typing `1` into a
cleared field yields `10` or `01` depending on where the caret ended up. Every
intermediate state a person types through — `""`, `"-"`, `"1."` — had the same
problem.

`src/NumField.tsx` keeps the text being edited as text and commits only drafts
that parse and satisfy min/max, marking anything else invalid rather than
correcting it mid-word.

## Raised separately, and built

Two workflow observations from the same conversation, neither a defect:

**Much of the reviewer's data lives in Igor files, and it was unclear what the
Load button wanted.** `src/core/igor.ts` now reads Igor packed experiments
(`.pxp`) and binary waves (`.ibw`) directly, in both byte orders, with a picker
for choosing the data wave and its error and time waves. The Igor Cluster
package's own column naming (`…C1(RD)` / `C2(STDEV)` / `C3(Times)`) is detected
and proposed. A wave's x scaling becomes the sampling interval and its x units
set the time axis, which closes the units question from the other direction.
The Load button now also states what it accepts, in prose.

**Concatenating a whole study into one trace, then chopping the output back
apart by animal.** Done to keep the detection settings identical across animals,
which is right; the manual chopping is the tax, and it costs more than effort.
The join between two animals is a step change the detector reads as a pulse
edge, and pooled interpulse intervals include a meaningless interval spanning
the join. `src/core/segments.ts` runs each record independently under one set of
settings and pools the results, so no window straddles a boundary and no
reported interval spans one — while still plotting every record on one axis,
with the joins marked. Results come back per record, which is what the chopping
was for.
