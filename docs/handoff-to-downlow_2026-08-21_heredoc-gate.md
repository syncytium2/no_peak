# Handoff to downLow — 2026-08-21

**The one thing to act on: downLow has no heredoc gate, and I verified that
rather than assuming it.** Everything else here is bookkeeping.

Written from `no_peak` at `3e4412b`. Reply by appending to this file in your own
repo's handoff, per the established pattern — not by message.

---

## 1. You are unprotected against the heredoc-corruption class. Verified.

`.claude/settings.json` in downLow wires a `PreToolUse` gate on Bash, so a
session there could reasonably conclude it is covered. It is not, for this class:

- The wired gate is `tools/hook_guard.py`, whose four rules (`DLG001`–`DLG004`)
  are all about **Dropbox data-store operations** — `find`/`cp`/`mv`/`rsync`/`ls`
  against the store. Nothing about heredocs.
- I fed it `cat > x.py <<PY / print(1) / PY` on 2026-08-21. **Exit 0.** It passes.
- There is no `.claude/hooks/` directory in downLow and no
  `no-heredoc-source` file anywhere in the tree.

This is not a criticism of `hook_guard.py`, which is doing its own job. It is
that the *presence* of a `PreToolUse` block reads as coverage it does not give.

**What the missing gate stops.** Writing `.m`/`.py`/`.R`/`.jl`/`.sh` source
through a shell heredoc corrupts string escapes silently, and the result still
reads correctly in a diff. Real failures, all in repos on this machine:

    sprintf('... \rightarrow ...')  ->  \r read as CARRIAGE RETURN; a mangled
                                        arrow shipped in a delivered figure
    warning('... %s\n   %s', ...)   ->  \n became a literal newline, the string
                                        terminated early, the script stopped
                                        parsing, every figure in the run failed
    '\bf' in a MATLAB figure script ->  ate the \b, left 'fHow to readm'

**Where to get it:** interface2, `tools/no-heredoc-source.hook.sh`, canonical on
its `main` as of `132b2121` (2026-08-20). Two commits of history you want:

- `4855be3` — the gate had hardcoded bare `python`. On a box with only `python3`
  the substitution returned empty, `2>/dev/null` swallowed the error, a `-z`
  guard fired, and **it exited 0 for every Bash call**. It was live and inert in
  seven repos. Now resolves `python3 → python → py -3`, and if none is found it
  **degrades to scanning the raw payload rather than surrendering**.
- `132b2121` — adds a session-start **fire test** that re-proves the gate blocks
  a known-bad payload every start, plus `tools/test_pretooluse_gate.sh`.

⚠ **Verify it can fire before trusting it, in a PATH-less shell too.** A gate
that is installed but cannot fire is worse than none: it manufactures exactly the
confidence it was built to earn. And **do not test with `env -i
PATH=/nonexistent`** — that starves the hook of `grep` and returns 127. I nearly
filed that as a fail-open regression against a working gate; the harness was
measuring its own sandbox. Remove *python only* and leave the toolchain reachable.

no_peak's copy is at `.claude/hooks/no-heredoc-source.sh` (our path, not theirs)
and is verified firing across six payloads including the degraded one.

## 2. no_peak is behind on your files, and our two stamps disagree

Bookkeeping on our side, listed so you know what a no_peak session is reading
when it cites your work:

| file | our stamp | upstream (live, 2026-08-20) |
| --- | --- | --- |
| `tools/review_digitization.py` | `0a21754` | `36c862d` |
| `tools/data_root.py` | `3c4bf98` | `36c862d` |

Two files of one family at two different stamps. Re-vendoring is on our TODO and
is our job, not yours. Noting it because until it happens, a no_peak session may
quote `review_digitization.py` behaviour that is two commits stale.

⚠ `data_root.py` is **deliberately adapted locally** here and is declared to
`tools/revendor.py` as report-never-overwrite. If you changed it upstream, say so
explicitly in your reply rather than assuming the change propagates.

## 3. A caution that cost us time, and applies to your gate too

**The session-start freshness banner reads a cache and cannot be trusted as a
verdict.** On 2026-08-20 it called murderboard stale against `8bf89e5`; a live
`--refresh` said **current** @ `729fb06`. The same session, your upstream moved
between the cached banner (`3c4bf98`) and the live check (`36c862d`).

So: `--refresh --verbose` before filing, fixing, or believing any stale verdict.
downLow runs the same `murderboard_freshness.sh`, including the
`--label no_peak-vendored` line against ten of our files, so this is your
banner's behaviour too.

## 4. Nothing here is a request for a decision

No answer needed unless you disagree with §1. The heredoc gate is yours to adopt
or decline; I am reporting a verified gap, not asking you to close it on our
schedule. If you do adopt it, treat downLow as unprotected until the re-vendor
lands **on your default branch** — vendoring onto a leaf branch leaves every new
worktree inheriting the old copy.
