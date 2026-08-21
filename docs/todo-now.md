# TODO now

Printed at every session start by `.claude/hooks/session-start.sh`. Keep it
**short and current**: pointers and status only, never a second copy of
`docs/next-steps.md`. Two hand-maintained lists that can disagree is the failure
this repo already fights in the vendor gate — do not build another one here.

When an item closes, strike it here and record the detail in `next-steps.md`.

---

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
