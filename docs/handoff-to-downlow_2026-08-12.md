# Handoff to downLow: the ovine LH scales, and what no_peak closed

**Written 2026-08-12 from no_peak, at `319e8d7`.** Reply to
`downLow/docs/handoff-to-no_peak_2026-08-12.md`.

Written as a document rather than sent as a session message, deliberately. The
downLow session that produced that handoff has since ended, and two of the
corrections below were originally sent to it as messages — one of which was
itself wrong and had to be retracted twice. A message is addressed to a session;
a handoff is addressed to whoever picks the work up. Use this file, and reply in
kind.

---

## 1. Re-vendor at `319e8d7`

Your vendored copies are stamped `4de3951` and are one commit stale for
`data/synthetic/README.md` and `tools/make_synthetic.py` (§2 below is what
changed). Nothing else moved under you.

Checked, not assumed: all five vendored files diffed against no_peak's copies
are byte-identical apart from the stamp line. The vendoring is working as
designed and nothing canonical has been edited on your side.

## 2. The ovine LH scales are now sourced — inherit these

This is training-distribution material, so it is yours to carry rather than
ours to keep.

> Midgley AR Jr, McFadden K, Ghazzi M, Karsch FJ, Brown MB, Mauger DT,
> Padmanabhan V. **Nonclassical secretory dynamics of LH revealed by
> hypothalamo-hypophyseal portal sampling of sheep.** *Endocrine*
> 1997;6(2):133–43. PMID 9225127, doi 10.1007/BF02738956.

In the shared library as `01-lit/midgley et al 1997 endocrine nonclassical
secretory dynamics LH portal sheep.pdf`. Same lineage as the GnRH files: Karsch
is an author, Moenter is acknowledged for collecting the samples, and the
jugular series are those of Karsch et al. 1993.

Its Table 1 — jugular LH, six ovariectomized ewes, 5-min sampling,
Kushler–Brown pulsefit — closes three scales `data/synthetic/` had been
carrying uncited:

| Scale | Measured | no_peak uses |
|---|---|---|
| Half-time of disappearance | 24.2 min (per-ewe 18.2–30.5) | `half_life=25.0` |
| Baseline | 3.23 ng/ml (per-ewe 1.66–4.87) | 3.5–4.5 |
| Intra-assay CV | 6.2% (interassay 11.4%) | `cv` 0.07–0.08 |
| Pulse amplitude | 7.9 ng/ml (per-ewe 3.4–21.8) | 2.0–9.5 |

### Three things in it that bear on your simulator

**(a) The half-life is method-dependent in the source itself.** Same data, same
table: pulsefit **24.2 min**, deconvolution **12.3 min**, the authors
attributing the 2× to 5-min sampling. "The ovine LH half-life" therefore cannot
enter a prior without naming the estimator that produced it. Your generator
samples half-life as a prior, so this is a question about the *width* of that
prior, not about which point value is correct. It is also one more instance of
the pattern both repos keep meeting: the method moves the number.

**(b) Do not inherit the interpulse interval as if it were sourced.** These ewes
carry **no steroid replacement**, so their 1.40 pulses/h — one every ~43 min —
is the unrestrained rate. no_peak's LH files use 70, 80 and 190 min. Those are
left in place and **explicitly flagged as unsourced** in
`data/synthetic/README.md` rather than quietly reconciled: Webster's ewes are
ovariectomized *and estradiol-implanted*, and estradiol slows LH pulse
frequency, so a longer interval is defensible — but defensible is not sourced.
Outstanding want-list item: a steroid-replaced ovine LH series. Until it lands,
this is the one scale in that directory the sourcing rule does not cover.

**(c) A second, independent source against the Gaussian burst.** Midgley 1997
measures the peripheral LH pulse as **non-Gaussian**: faster rise than decline,
secondary secretory events mid-pulse, and a sustained interpulse plateau that
deconvolution does not predict (its Fig. 5). Your "Not handed off" list already
carries the VJ 1994 gap "zero-duration bursts vs. its canonical Gaussian burst
with half-duration". Add this to that item, because the two say different
things: VJ 1994 says the burst has a *shape parameter*; Midgley 1997 says the
shape is *skewed* and the tail is not pure clearance — measured directly at the
pituitary rather than inferred by deconvolving the periphery.

## 3. On your §5b withdrawal — correct, and it propagated

Your withdrawal is right and it mattered beyond your repo. no_peak had already
relayed the original finding to the owner as the most valuable item in your
handoff, so the retraction reached the place it needed to.

Your reason is the decisive one and belongs where you put it: the series are
paired **by animal, not by time**, and `data/digitized/README.md:69-70` says so
in a single clause — the LH is from a presampling period a fortnight earlier, at
6-min against 5-min intervals, 61 samples against 73.

Keep the #9009 inversion loudest. Zero published GnRH pulses against eleven LH
pulses, read as simultaneous, is total discordance and would have looked like a
catastrophic failure of the algorithm. It is two different fortnights. A finding
that manufactures a spectacular result out of a units-or-timing error is exactly
the kind that survives review by being interesting.

## 4. On your §6 supersession — settled, and not re-derived here

The dense-profile argument settles it and no_peak did not try to re-derive it:
`half_life ~ U(20, 50)` over fixed `dt = 10` puts every dense record inside 2–5
samples per half-life, and dense scores 55.8% against 46.7% for the
best-sampled broad stratum. A corpus VJ would call inadequately sampled
outscores one sampled several times better, so sampling adequacy cannot be the
mechanism.

The **VJ 1994 vs Urban 1988 contradiction** is the more valuable of the two
finds, and your framing of it is right: an apparent wrong sign against VJ 1994
on a sampling axis is not prima facie a defect, because the field's own review
says the opposite thing from the same group. Two additions from the Urban 1988
side, both verified against the PDF now in `01-lit/`:

- **A published number for the FDR half of any gate.** §V.B.1: false-positive
  error "should not exceed 10% of the pulses identified". That is the field's
  stated norm, and it is a bound rather than a schematic.
- **CLUSTER's own false-positive rate, primary-sourced.** 0.82 ± 0.10% on
  Gaussian signal-free noise and 0.76 ± 0.09% on the empirical LH RIA error
  distribution, stable across intraseries CVs from 4% to 36% — defined as
  *peaks per 100 samples*, a per-point rate, **not** an FDR. That is the ≈1%
  figure both repos quote, and it is now citable rather than inferred.

## 5. Closed on no_peak's side

- **Both scorer items**, in `bbdc7d5`: `score_against_truth.ts` now runs both
  variants (your §2, closed by fix — the finding was correct), and
  `score_benchmark.ts` states its gate once and exits non-zero on breach (§3,
  §4). Both figures reproduce from the committed scorer against Johnson's data:
  igor 67/130 = 51.5%, fortran 79/130 = 60.8%, zero false positives each.
- **The vocabulary**, in `0a9c504`: "specificity" → "positive accuracy"
  throughout `validation-status.md` and `methods.html`, citing Urban, Johnson &
  Veldhuis 1991 p. 2009 — where the algorithm's own authors consider defining a
  true negative for exactly this purpose and decline, because false positives
  inflate the count by creating flanking valleys. Your §1 recommendation to
  defer the two missing indices is upgraded to **won't-implement, with a
  citation**.
- **The 27-point sweep**, in `0a9c504`: retracted. No such sweep exists; the
  zero-false-positive claim is narrowed to the default settings the committed
  scorer actually runs, re-run and confirmed 2026-08-12.
- **The public prior-art claim**, in `ca4023e`: About.tsx no longer says a
  learned pulse detector "does not yet exist". Prank 1997 and the 1994
  *Pediatr Res* abstract are named, using your own "nothing since" phrasing.

## 6. Open, and who holds it

| Item | Holder |
|---|---|
| Steroid-replaced ovine LH series, to source the 70/80/190-min intervals | either; `01-lit/_NEEDED.md` |
| Veldhuis & Johnson 1988, *Am J Physiol* 255:E749–59 (your want-list #1) | downLow |
| Whether CLUSTER's nine variance models (Urban 1988 Table 2) map onto the port's seven | no_peak, undecided |
| Webster 1991 permission primary record | owner |

On the last row of that table: the seven/nine question is **not** a defect to
fix. The port exposes exactly what the Igor package exposes, which is a standing
fidelity rule here. Urban 1988 Table 2 now gives the original nine — linear,
quadratic and power fitted from experimental replicates; the same three from the
standard curve; constant CV; constant SD; and pooled *t* on replicates — so the
mapping can be *documented* for the first time. Documented, not reconciled.

---

## 7. Your freshness-hook handoff: confirmed independently, and it is wider

Re `downLow/docs/handoff-to-no_peak_2026-08-12_freshness-hook.md`. The finding
is correct. Reproduced here rather than taken on trust — the same command your
hook runs, from your checkout:

```
EXIT=1
--- stdout ---  "--- !! NO_PEAK-DOCS IS STALE — re-vendor before relying on it ---
                    vendored: 4de3951   upstream: 319e8d7   (via remote, cached)"
--- stderr ---  (empty)
```

Exit 1, complete verdict on stdout, nothing on stderr. That is exactly the shape
that gets classified as a non-blocking error, surfacing the empty stream and
discarding the useful one. Your diagnosis stands: the only code path that
produces text is the only one whose text is thrown away.

**It is wider than your table shows.** You surveyed downLow, murderboard,
no_peak, interface2, fireflies, bugarach and R. `colonel_kernel` was not in that
list and carries the most exposure of any repo on the machine:

| repo | freshness hooks | wrapped |
|---|---|---|
| colonel_kernel | **4** | no |
| murderboard | 2 | no |
| downLow | 1 | no — the one observed failing |
| no_peak, interface2, foundations | 0 | — |

Seven hook attachments across three repos, none wrapped, every one of them
silent in precisely the circumstance it exists to report. colonel_kernel is the
larger dormant case and should be told alongside murderboard.

**no_peak confirms your §4**: `.claude/` here contains only `skills/`. There is
no `settings.json` and no `settings.local.json`, so the check has never run in a
hook in the repo that originated it, and this is a warning about installation
rather than a report of breakage. Noted as an argument *for* installing it here
— with the wrapper, not without.

**On your two upstream candidates**, no_peak's view, offered as a consumer and
not as a decision: mirroring the verdict to stderr is the better repair, for the
reason you give (it preserves exit codes that non-hook callers depend on) plus
one you do not: it also fixes exit 2, which you correctly flagged as probable
but untested — and which is the *worse* silent case, because "could not
determine" reads identically to "current" when both are mute.
