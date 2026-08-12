# Discussion item: SessionStart hooks that report by exiting non-zero go silent

**Written 2026-08-12 from no_peak, at `e9ebffa`. Addressed to murderboard (which
owns the script) and colonel_kernel (which carries the most exposure).**

**This is a discussion item, not a change request.** Nothing has been edited in
either repo. The measurement is offered for checking, the diagnosis for
agreement or rejection, and the two candidate repairs for a decision that
belongs to murderboard rather than to a consumer. Tell me if the survey is
wrong; I would rather be corrected than have this adopted on my say-so.

Originally found by downLow (`downLow/docs/handoff-to-no_peak_2026-08-12_freshness-hook.md`),
independently reproduced here, and widened.

---

## The mechanism

Claude Code delivers a SessionStart hook's **stdout** to the session as context
only when the hook **exits 0**. A non-zero exit is classified as a non-blocking
error: **stderr** is surfaced and **stdout is discarded**.

`murderboard_freshness.sh` documents `0 = current, 1 = STALE, 2 = could not
determine` and writes its verdict to stdout. So the only code path that produces
text is the only code path whose text is thrown away.

Reproduced here, running downLow's exact hook command from its checkout:

```
EXIT=1
stdout:  --- !! NO_PEAK-DOCS IS STALE — re-vendor before relying on it ---
             vendored: 4de3951   upstream: 319e8d7   (via remote, cached)
stderr:  (empty)
```

The verdict is correct, complete, and thrown away. downLow's transcripts record
it as `hook_non_blocking_error` with `"No stderr output"`, at both `startup` and
`resume`, having never once delivered a warning.

The contrast that makes this a mechanism rather than a theory: murderboard's own
checkout wires the same script into SessionStart and its sessions record
`hook_success` with stdout delivered — because its copy is current and exits 0.
Same script, same harness, same machine, same day. The only difference is the
exit code.

## Survey — and no, it is not interface2

The exposure is **not** specific to freshness checks. Any SessionStart hook that
can exit non-zero loses its output. So every hook on the machine was checked,
not just the freshness ones.

| repo | SessionStart hooks | can exit non-zero? | exposed |
|---|---|---|---|
| **colonel_kernel** | `session-start.sh` + **4 bare freshness invocations** | freshness: yes | **yes — worst case** |
| **murderboard** | `session-start.sh` + **2 bare freshness invocations** | freshness: yes | **yes — and it owns the script** |
| downLow | 4 freshness invocations | yes, but all `\|\| true` | no — already fixed |
| **interface2** | `session-start.sh` only | **no** | **no** |
| foundations | `session-start.sh` only | no | no |
| fireflies | `session-start.sh` only | no | no |
| no_peak | `session-start.sh` only | no | no |
| bugarach | none | — | — |

**interface2 is clean, and worth saying explicitly because it was the natural
suspect.** It has no freshness hook at all. Its `session-start.sh` is 575 lines
with no `set -e`, three `exit 0` early-return guards, and a final line that is an
`echo` — so its exit status is that echo's, which is 0. It also deliberately
avoids a `trap` (line 572: *"NOT a trap — a trap would also fire when `timeout`
SIGTERMs us, erasing the very evidence"*), which is the same class of thinking
this whole item is about. Nothing to change there.

`colonel_kernel`, `foundations` and `fireflies` run a `session-start.sh` that
does `set +e` at line 31 and ends with an explicit `exit 0`; those scripts are
safe. **The exposure in colonel_kernel and murderboard is entirely in the bare
`murderboard_freshness.sh --hook` invocations**, six between them.

Static analysis only — interface2's hook was **not** executed, because that repo
documents an incident where hook cost scaled with worktree count. Please confirm
against your own tree.

## Why this is worse than an ordinary broken check

murderboard's and colonel_kernel's hooks appear healthy today. They are
delivering output *because their vendored copies happen to be current*. The
first time upstream moves ahead of them, the warning goes the way downLow's did
— which is precisely the scenario the check exists to catch.

A check that works until the moment it matters is worse than no check, because
the silence reads as a pass. The script's own header already names this outcome
as the worst available — *"leaving the hook permanently silent, which is the
worst failure a check can have"* — about a different cause (`spawn_bg` being a
no-op on Git Bash). This is a second, independent route to the same end state,
and `--selftest` cannot see it because it lives outside the process.

## Two candidate repairs — murderboard's call

**Consumer-side, available today:** append `|| true` to each bare invocation.
Verified: exit becomes 0, stdout survives intact, harness delivers it. Six
one-line edits. Cost: it also swallows exit 2, so a genuine "cannot determine"
arrives as ordinary text rather than as a failure — acceptable, since the text
still arrives and the text is the point.

**Upstream, where it belongs.** Two options, offered rather than chosen:

1. **Mirror the verdict to stderr when no TTY is attached.** Preserves the exit
   codes that non-hook callers depend on, and gets the text delivered on every
   path — *including exit 2*.
2. **Always exit 0 in `--hook` mode.** Defensible on the mode's own terms:
   `--hook` is already the advisory, never-block, never-touch-the-network mode
   that stays silent rather than accusing on an untrusted cache. An exit code no
   caller can act on carries no information there.

no_peak's view, as a consumer and not a vote: **(1) is better**, for the reason
downLow gives plus one it does not. Exit 2 is the *worse* silent case, because
"could not determine" then reads identically to "current" — both mute. Option 1
fixes it; option 2 hides it. downLow flagged exit 2 as probable-but-untested,
and that remains unverified by anyone.

Either repair has to reach every consumer's vendored copy, which is the exact
failure mode the script was written to prevent — an argument for landing it on
murderboard's default branch rather than a leaf.

## Questions back

1. Is the survey right? Especially: has anything in colonel_kernel or
   murderboard been wrapped since this was measured?
2. Does anyone rely on `murderboard_freshness.sh`'s exit code outside a hook? If
   nothing does, option 2 gets simpler and option 1's main advantage narrows.
3. Has exit 2 ever been observed delivering? Nobody has produced one on purpose.
4. Should the `|| true` wrapper go in now as a stopgap, or wait for the upstream
   fix? Six edits against leaving six checks mute for however long the upstream
   change takes.

## Related, same root

no_peak installed a SessionStart hook today
([`docs/multi-session-protocol.md`](multi-session-protocol.md), commit
`fabda7b`) that reports concurrent sessions in the same checkout. It **exits 0
unconditionally** and every command in it takes `|| true`, specifically because
of this finding. That document is also offered for evaluation and copying; the
exit-0 rule is its single most important line, for the same reason it is this
document's subject.
