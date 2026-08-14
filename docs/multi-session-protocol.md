# Working one repo from many sessions

**Written 2026-08-12 in no_peak, for other repos to evaluate and copy or reject.**

The normal condition on this machine is several Claude sessions live at once,
across platforms, switched between constantly. On 2026-08-12 there were seven
live simultaneously across six repos, two of them in a single checkout of
`colonel_kernel` and two in a single checkout of `no_peak`. This document is
what no_peak installed after that day's collisions, why each piece is there, and
what each piece does *not* do.

Nothing here is theoretical. Every rule below is a transcript of something that
actually went wrong.

---

## 1. What actually happened, since the fixes only make sense against it

Two sessions worked no_peak's single checkout for about three hours. Neither
knew the other existed.

**Collision 1 — staging by wildcard.** Session A ran `git add -A` and committed.
It swept 970 lines of session B's in-progress work — a rewritten handoff, a
murderboard review, a tool change — into a commit whose message described none
of it. Nothing was lost, but the history now misattributes four files, and
session B found out by reading the log.

**Collision 2 — verifying the wrong artifact.** Session B fixed a scorer that
had been pinned to one code path (`variant: "igor"` as a hardcoded value).
Twenty minutes later session A, arguing about whether that pin existed, read and
ran the file — *after* the fix — saw both paths run, and concluded the defect
had never existed. It then sent a third repo a confident retraction telling them
to stand down from a correct finding, with a lecture about how running code
beats grepping. It had run the code. It had run a **different version** of the
code than the one under discussion. That retraction had to itself be retracted.

**Collision 3 — the silent guard.** The one mechanism that would have caught the
staleness — a vendor-freshness SessionStart hook in a downstream repo — had
fired correctly at every session start and reported to nobody, because it
signals "stale" by exiting 1, and a non-zero exit makes the harness discard the
hook's stdout. A check that works until the moment it matters.

Three failures, one shape: **state changed underneath a session that had no way
to know.**

## 2. The pieces, and what each is worth

### 2a. A SessionStart hook that names concurrent sessions — the load-bearing one

`~/.claude/sessions/<pid>.json` exists for every live session and carries `cwd`,
`pid`, `name` and `sessionId`. A hook can therefore answer the question no
session could answer on 2026-08-12: *is anyone else in this checkout right now?*

no_peak's [`.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh)
reports, in order:

1. **Peer sessions in this exact checkout** — loud, with the four rules that
   make sharing survivable (stage by path; re-read before acting; pin a sha
   before concluding what code does; or take a worktree).
2. **Uncommitted work** in this checkout and every worktree — the "best work
   sitting in a working tree, one disk failure from gone" failure.
3. **Unpushed commits**, computed against cached remote-tracking refs.
4. Worktree list and the last three commits.

Three implementation details are not optional, each learned by getting it wrong:

- **Exit 0 unconditionally.** SessionStart stdout is delivered as context *only*
  on exit 0. A non-zero exit is classified as a non-blocking error: stderr is
  surfaced, stdout is thrown away. Every command in the hook takes `|| true`.
  This is the single highest-value line in this document, because the failure it
  prevents is invisible — the hook appears installed and working.
- **Never touch the network.** No `git fetch`. Sessions start constantly; a hook
  that waits on a remote gets deleted within a week. Unpushed state is computed
  against whatever remote refs are already cached, and the output says so rather
  than implying it is current.
- **Self-exclude by `sessionId` from the hook's stdin payload, never by pid.**
  The hook runs as a subprocess, so its pid is never the session's; a pid test
  reports you to yourself every time. And note `python3 -` reads its *program*
  from stdin, so a heredoc-delivered script cannot also read the payload from
  stdin — pass it in argv.

### 2b. Worktree settings — cheap isolation, but read the limits

```json
"worktree": {
  "symlinkDirectories": ["node_modules"],
  "baseRef": "fresh",
  "bgIsolation": "worktree"
}
```

`symlinkDirectories` is what makes worktrees actually get used. no_peak's
`node_modules` is 386 MB; without the symlink, every worktree is a 386 MB
install and nobody takes one. Substitute your own heavy directory —
`.venv`, `target`, `vendor`, `.cache`.

**`bgIsolation` does not solve the problem in this document.** It governs
*background* sessions only, blocking Edit/Write in the main checkout until
`EnterWorktree` is called, and `"worktree"` is already the default. All three
collisions above were between *interactive* sessions, which it does not touch.
It is set explicitly here so the next reader does not mistake it for the fix.

### 2c. The discipline, which no setting enforces

The harness cannot stop two interactive sessions sharing a checkout. What it can
do is tell you it is happening. The rest is convention, and it is short:

- **One session, one worktree, one branch** when work will last more than a few
  minutes: `git worktree add -b <slug> ../<repo>-worktrees/<slug> main`.
  Worktrees live in a *sibling* directory so tooling never sees duplicate copies.
- **Commit by path, not merely stage by path.** `git add -A` is the obvious
  trap, but staging carefully is *not enough*: the index is shared too, so
  `git add <mine>` followed by `git commit` still sweeps in whatever a peer had
  already staged. Caught doing exactly this on 2026-08-12, hours after writing
  the line above — a peer's staged rename rode along in an unrelated commit.
  Use `git commit --only <path>...` (or `git commit <path>...`), which commits
  the named paths and ignores the rest of the index. Check `git status --short`
  first and read the left-hand column: a staged entry has no leading space.
- **Pin a sha before concluding anything about what committed code does** —
  `git show <sha>:<path>`, or check `git log -- <path>` first. Running the file
  in front of you proves nothing about the file someone else is discussing.
- **Push promptly.** Peers vendor from `main` by sha, so pushing is what
  actually delivers work to them; an unpushed commit is invisible.
- **Coordinate in committed handoff documents, not session messages.** Sessions
  die and get renamed — `downlow-16` became `downlow-3f` mid-conversation, and a
  correction sent to the first was addressed to something that no longer
  existed. A message is addressed to a session; a handoff is addressed to
  whoever picks the work up, and it carries a sha.

## 3. Why interface2's version did not spread on its own

`interface2/docs/session_protocol.md` has had the one-session-one-worktree rule
for months and it did not reach any consumer repo. The reason is instructive
rather than anyone's fault: **it is prose in a document in another repo.**
interface2's `.claude/settings.json` has only `hooks` and `permissions` — no
`worktree` key — and its SessionStart hook *reports* `git worktree list` without
creating or requiring anything. So there was no artifact to copy; adoption meant
every session in every repo reading a file in a repo it was not working in.

That protocol names its own ordering — mechanize first, doc second, one line in
`CLAUDE.md` third — and observes that "a rule that lives only there is a rule
that will eventually be missed." The worktree rule sat at tier two. This document
is an attempt to move it to tier one for repos that want it: a hook and a
settings block that can be copied wholesale.

## 4. Exposure survey, 2026-08-12

Measured on this machine, not assumed:

| repo | freshness hooks | wrapped `\|\| true` | concurrent-session hook |
|---|---|---|---|
| colonel_kernel | 4 | **no** | no |
| murderboard | 2 | **no** | no |
| downLow | 1 | **no** — observed failing | no |
| no_peak | 0 (upstream) | n/a | **yes**, as of this commit |
| interface2, foundations | 0 | n/a | no |

Seven unwrapped freshness hooks across three repos. Every one of them is silent
in precisely the circumstance it exists to report, and murderboard's and
colonel_kernel's only appear healthy because their vendored copies happen to be
current. The first time upstream moves ahead, they go the way downLow's did.

**The `|| true` wrapper is the cheapest fix in this document and the most
urgent.** It is a per-repo, one-line change. The proper repair belongs upstream
in `murderboard_freshness.sh` — mirroring the verdict to stderr when no TTY is
attached preserves the exit codes that non-hook callers depend on, and fixes
exit 2 ("cannot determine") as well, which is the worse silent case because it
reads identically to "current".

## 5. For a repo evaluating this

Copy [`.claude/hooks/session-start.sh`](../.claude/hooks/session-start.sh) and
the `hooks` + `worktree` blocks from
[`.claude/settings.json`](../.claude/settings.json). Then:

1. Change `symlinkDirectories` to your heavy directory.
2. If you vendor files from another repo, add your freshness check at the marked
   point in the hook — **with `|| true`**.
3. Run the hook by hand twice before trusting it: once passing your own
   `session_id`, which must produce no peer warning, and once passing a
   different one, which must warn. A concurrency check that cannot distinguish
   you from a peer is worse than none, because it trains you to ignore it.
4. Decide the branch question separately. Worktrees imply feature branches and a
   merge; if peers consume your `main` by sha, that adds a step for them. no_peak
   has not switched to branch-per-session — it installed the *warning* first, on
   the grounds that knowing a peer is present is most of the value and costs
   nobody anything.

## 6. A retraction is a `grep`, not an edit — 2026-08-14

The newest entry in this transcript, and the one least about tooling.

A no_peak session recorded a rights claim that had never been approved. A downLow
session caught it and **struck the sentence where it was written**. That was the
right call and the wrong shape of fix, and between them the two sessions took
three passes to finish a one-line retraction:

| pass | what happened |
|---|---|
| 1 | downLow strikes the claim in `docs/data-store-coordination_2026-08-14.md` §5.3 |
| 2 | no_peak, not having seen it, **propagates the same claim** into `AGENTS.md`, `docs/next-steps.md` and `docs/reference-code.md` — the three files a session actually reads first |
| 3 | no_peak retracts those three, then **finally greps**, and finds two more still live: §5.4 of the same document, and §5.3's own heading |

**No pass was careless.** Each fixed what its author could see. The claim still
outran all three, because a claim that is worth retracting is a claim someone
found useful, and useful claims get quoted — into summaries, into headings, into
later sentences of the same file, into whatever the reader writes next.

Three things follow, and the third is the one that actually cost time:

1. **`grep` for the claim before declaring a retraction done**, and grep for the
   *phrasing*, not the file. Ours survived in a sentence that merely referred back
   to it (`"which is why that one gets a named owner determination"`) — no
   keyword from the original, one section away, in a part nobody had struck.
2. **Strike through; do not delete.** A later reader who meets a clean sentence
   has no way to know it was ever wrong. One who meets a struck one learns both
   the correction and that corrections happen here.
3. **Tell the peer the sha, not the summary.** Pass 2 happened purely because a
   concurrent session had not seen `b7c7a3e`. In a shared checkout the retraction
   and the propagation can be minutes apart in either order.

### 6.1 Two passing self-tests do not prove two repos agree

From the same episode, on the vendored `tools/data_root.py`. Both repos' copies
had a green `--selftest` at the moment they silently disagreed about which trees
a bare `--push` moves — because each test builds its own temp tree and proves the
code self-consistent, which is not the claim anyone needed.

**The only check that bites is one side asserting a value the other side also
asserts.** `--selftest` here pins the shared manifest filename and
`default_synced=False` on `reference` — constants that live in two repos, cannot
be verified at runtime, and corrupt the store quietly if they drift. If a third
consumer of a vendored module ever appears, **that pattern is the thing to copy,
not the module.**

### 6.2 A rule spreads; its scope does not

The mirror of §6, from the same day, and the more expensive of the two.

A rule was written — *if the Dropbox member folder is ever shared, `reference/`
comes out first* — and it propagated cleanly into five places: `AGENTS.md`,
`docs/reference-code.md`, `docs/next-steps.md`, the coordination doc, and the
vendored `data_root.py` caution in another repo. Every copy faithful.

Every copy also said **`reference/`**, because that was the example in the room
when the rule was written. Meanwhile a third-party permissions correspondence
folder was sitting in `<member>/darkroom/no_peak/` on exactly the same basis —
other people's email, quoting named people at Michigan and at a publisher, two
directories from the store. A third session spotted it and recorded it (`78b563c`)
with the right diagnosis: *"anyone applying the rule would be looking at the data
store and would have no reason to think of a darkroom subfolder."*

**A rule stated as an instance propagates as that instance.** The condition was
"this folder is private". The rule said "`reference/`". Every faithful copy
narrowed it further, because each reader learns the scope from the example rather
than from the condition — and the copies are where the scope then lives.

- **State the condition, then enumerate**, rather than naming the one case that
  prompted the rule. "Everything here on the strength of this folder's privacy —
  currently A and B" survives a new B; "`reference/` comes out first" does not.
- **Say the list is incomplete when it is.** Both known items were found by
  sessions noticing in passing. Nobody has surveyed that member folder, and a
  list that does not admit this reads as exhaustive to the next reader.
- **The `grep` in §6 does not find this.** There is nothing wrong to grep for.
  Every copy is accurate; the gap is in what none of them mentions. Retractions
  are found by search — scope gaps only by asking *"what else is true for the
  same reason?"*, which has to be asked deliberately.
