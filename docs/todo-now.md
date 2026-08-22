# TODO now

Printed at every session start by `.claude/hooks/session-start.sh`. Keep it
**short and current**: pointers and status only, never a second copy of
`docs/next-steps.md`. Two hand-maintained lists that can disagree is the failure
this repo already fights in the vendor gate — do not build another one here.

When an item closes, strike it here and record the detail in `next-steps.md`.

---

## 0. Fortran is the default now — three calls left, all yours (2026-08-22)

The switch shipped: `DEFAULT_PARAMS.variant` is `"fortran"`, the picker leads
with it, the DOS skin is its own checkbox, and the Igor scale warning fires
whenever Igor is selected. Account in `next-steps.md`, `Arrived 2026-08-22`.
Three things were deliberately **not** decided, and each needs you rather than
another session:

- **a. Is `t = 2` still the right default?** At the two-point defaults the
  Fortran reports **7 pulses in a record containing none** (`sim_flat_control`)
  and 5 in `sim_gnrh_intact`. That is the nominal cost of a t = 2 threshold, not
  a defect — Igor's 0 was the artifact — but it is a poor thing for a default to
  do to a first upload. Keeping the literature's t = 2 is defensible; so is
  moving to 2.5. **Ask for the sweep before deciding**: sensitivity and FDR
  across t on the committed benchmark, both variants, one table.
- **b. Should the `fortran` variant reproduce CLUST5's COMMON-block bug?**
  CLUST5 declares `COMMON /MISC/` as `(…,NNADIR,NPEAK)` in UPS and
  `(…,NPEAK,NNADIR)` in DNS, so its downs pass reads the two window sizes
  **swapped**. The port follows Igor there and does not swap, which means that
  at `nPeak != nNadir` it is a *corrected* port, not a literal one. Symmetric
  windows — the default and nearly all real use — are unaffected and match
  exactly. If "literal authentic port" is the claim, this is the one place it is
  not true. Pinned by the asymmetric case in `src/core/oracle.test.ts`.
- **c. The honesty prose still describes the Igor path.** "Conservative, almost
  never invents" appears on the About page, in `index.html`'s prerender, in
  `llms.txt` and on `/methods`. It was measured where the conservatism was
  partly an artifact of unsquared pooling. The lead figure and the app warning
  were fixed; the long-form prose has had only a minimal pass and wants a
  proper one.

Also left: the Fortran oracle covers waves that carry a per-sample SD column,
because `tools/fortran/build_and_run.sh` drives CLUST5's variance option 3 only.
`man3` and `null1` are value-only and have never been scored against the
Fortran, and neither have the Fortran's own estimated error models. Harness
work, not a decision — but it is the gap between "authentic on 3 waves × 7
window settings" and "authentic".

## 1. The vendored heredoc gate is watched by nothing — needs a decision

`.claude/hooks/no-heredoc-source.sh` is vendored from **interface2**, a third
upstream that is **not registered** with the freshness gate. Its staleness has
never once been checked, so it silently carried a branch-era stamp (`@ a33c8ea9`)
while upstream moved on.

The gate itself **is live and does fire** — verified 2026-08-20 across six
payloads, including the degraded no-python-on-PATH path, and it blocked a real
command that session. This is not about a broken gate. It is about nothing
noticing if it *becomes* broken.

Open, and it is the owner's call:

- Register interface2 as a third family. Needs **both** hand-maintained lists
  updated together — §5 of `.claude/hooks/session-start.sh` and `FAMILIES` in
  `tools/revendor.py`; `revendor.py` refuses to run if they disagree. No new
  machinery required: `murderboard_freshness.sh` already takes
  `--label/--slug/--clone/--file`, and `revendor.py` already handles differing
  layouts via `remap`.
- Port interface2's `132b2121` (2026-08-20): a **fire test** that re-proves the
  gate blocks a known-bad payload every session, a **self-heal** for missing
  `PreToolUse` wiring, and `tools/test_pretooluse_gate.sh`.

⚠ It is a **port, not a copy**. Paths differ (`tools/no-heredoc-source.hook.sh`
there, `.claude/hooks/no-heredoc-source.sh` here), and their self-heal exists
because *their* `.claude/settings.json` is on skip-worktree so git can never
deliver an update to it. **Ours is not** — `git ls-files -v .claude/` shows no
skip-worktree flags — so here the self-heal is insurance, not necessity.

Full account: the `Arrived 2026-08-20` block at the top of `docs/next-steps.md`,
and §D as amended. Commit `3e4412b`.

## 2. downLow is stale here, and its stamps disagree with each other

`tools/review_digitization.py` is stamped `0a21754`; `tools/data_root.py` in the
same family is stamped `3c4bf98`; upstream was `36c862d` when last checked live
on 2026-08-20. Two files of one family at two different stamps is exactly the
condition §D says to fix by bumping **every** stamp in the set.

⚠ `data_root.py` is **deliberately adapted locally** and must be reported, never
overwritten, by a re-vendor. Same for `fetch_paper.py` in the murderboard family.

## 3. Never act on the session-start banner's stale verdict — re-check first

The banner reads a **cache**. On 2026-08-20 it called murderboard stale against
`8bf89e5`; a live `--refresh` said **current** @ `729fb06`. Upstream also moved
between the cached banner and the live check on downLow the same day.

Run the family's `murderboard_freshness.sh` line with `--refresh --verbose`
before filing, fixing, or believing any stale verdict. This is `next-steps.md`
§D's own second caution, and it has now fired for real.

## Also open, and older — blocked on the owner, not on effort

Do not read this file as the whole list. `docs/next-steps.md` is the ranked
record; these three have been waiting longest:

- **§1** Michael Johnson's approval of the port has no dated primary record.
  (The Webster 1991 rights half is **closed** as of 2026-08-19 — do not reopen.)
- **§2** The repo's `robots.txt` policy is not what the edge serves; it is a
  Cloudflare dashboard setting on the zone, and now a live decision.
- **What per-sample assay error did Webster 1991 actually use?** The digitized
  records ship a reconstructed column and the app banners it. downLow's evidence
  (`3c4bf98`) says the *shape* may be wrong — `sqrt(a² + (k·v)²)` beats
  `max(floor, k·v)` on every series. Not acted on; it touches a banner, eight
  dataset notes and every exported figure.
