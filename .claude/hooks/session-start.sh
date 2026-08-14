#!/usr/bin/env bash
# session-start.sh — tell a starting session what it is walking into.
#
# WHY THIS EXISTS. On 2026-08-12 two sessions worked this repo's single checkout
# at once. One ran `git add -A` and swept the other's in-progress files into an
# unrelated commit; the other fixed a scorer, and the first then read and ran the
# fixed file while arguing about the broken one, "verified" the defect away, and
# talked a third repo into standing down from a correct finding. Neither session
# knew the other was there. Everything below is one of those two facts.
#
# CONTRACT — the hard-won part:
#
#   ALWAYS EXIT 0. Claude Code delivers a SessionStart hook's stdout as context
#   only on exit 0; a non-zero exit is a non-blocking error, which surfaces
#   stderr and DISCARDS stdout. A check that reports by exiting non-zero is a
#   check that goes silent exactly when it has something to say. Found the hard
#   way in downLow, where the vendor-freshness hook had never once delivered a
#   warning. Any command added below gets `|| true`.
#
#   NEVER TOUCH THE NETWORK. No `git fetch`. Sessions start constantly and a
#   hook that waits on a remote is a hook that gets removed. Unpushed state is
#   computed against existing remote-tracking refs, which may be stale — the
#   output says so rather than pretending.
#
#   PORTABLE. No `timeout` (absent on macOS), no GNU-only flags, python3
#   optional. Degrades section by section rather than failing whole.

set -u

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

REPO_TOP=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')

printf '=== session start: %s [%s] ===\n' "$(basename "$REPO_TOP")" "$BRANCH"

# --- 1. Peers in this very checkout. The collision condition, so it leads. ----
# ~/.claude/sessions/<pid>.json carries cwd + pid + sessionId for every live
# session. Self-exclusion is by sessionId from the hook's own stdin payload, NOT
# by pid: the hook runs as a subprocess, so its pid is never the session's and a
# pid test reports you to yourself.
HOOK_STDIN=$(cat 2>/dev/null || true)
if command -v python3 >/dev/null 2>&1; then
  # The payload goes in argv, not stdin: `python3 -` reads its PROGRAM from
  # stdin, which the heredoc below already occupies.
  python3 - "$REPO_TOP" "$HOOK_STDIN" <<'PY' 2>/dev/null || true
import glob, json, os, sys
top = os.path.realpath(sys.argv[1])
try:
    me = json.loads(sys.argv[2] or "{}").get("session_id", "")
except Exception:
    me = ""
here, elsewhere = [], []
for f in glob.glob(os.path.expanduser("~/.claude/sessions/*.json")):
    try:
        d = json.load(open(f))
        pid = int(d.get("pid", 0))
    except Exception:
        continue
    if pid == 0 or (me and d.get("sessionId") == me):
        continue
    try:
        os.kill(pid, 0)                      # liveness, no signal sent
    except Exception:
        continue
    cwd = os.path.realpath(d.get("cwd", ""))
    name = d.get("name", f"pid {pid}")
    if cwd == top:
        here.append(name)
    elif cwd.startswith(top + os.sep) or os.path.basename(top) in cwd:
        elsewhere.append((name, cwd))
if here:
    print("\n!! ANOTHER SESSION IS IN THIS CHECKOUT: " + ", ".join(sorted(here)))
    print("   Two sessions, one working tree. Before you edit or commit:")
    print("     - stage BY PATH, never `git add -A` / `-u` / `.`")
    print("     - re-read a file before acting on what it says; it may have moved")
    print("     - pin a sha (`git show <sha>:<path>`) before concluding what code does")
    print("     - or take your own worktree, which is what the settings are set up for")
for name, cwd in sorted(elsewhere):
    print(f"   (peer {name} is in {cwd})")
PY
fi

# --- 2. Uncommitted work, here and in every worktree -------------------------
# Tier-2 failure from the interface2 protocol: a session's best work sitting
# uncommitted, invisible to everyone, one disk failure from gone.
git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10)}' | while IFS= read -r wt; do
  [ -d "$wt" ] || continue
  n=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  b=$(git -C "$wt" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
  if [ "${n:-0}" -gt 0 ]; then
    printf '   uncommitted: %s file(s) in %s [%s]\n' "$n" "$wt" "$b"
  fi
done

# --- 3. Unpushed commits, against cached remote refs (no network) ------------
UNPUSHED=$(git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads 2>/dev/null \
  | grep -v '\[gone\]' | grep 'ahead' || true)
if [ -n "$UNPUSHED" ]; then
  printf '   unpushed (vs cached remote refs, not fetched):\n'
  printf '%s\n' "$UNPUSHED" | sed 's/^/     /'
fi

# --- 4. Where things stand ---------------------------------------------------
WT_COUNT=$(git worktree list 2>/dev/null | wc -l | tr -d ' ')
[ "${WT_COUNT:-1}" -gt 1 ] && git worktree list 2>/dev/null | sed 's/^/   worktree: /'
git log --oneline -3 2>/dev/null | sed 's/^/   /'

# --- 5. Vendored-file freshness ----------------------------------------------
# This said "no_peak is upstream, not a consumer, so nothing to check here" from
# 2026-08-12 until 2026-08-14. It was wrong by then and nobody noticed: this repo
# consumes SIX files from two upstreams. The cost was measured, not guessed —
# tools/data_root.py sat stale for hours on 2026-08-14 while governing restricted
# data, and was found only by a hand check during unrelated work.
#
# `|| true` IS LOAD-BEARING on every line below. Without it the stale verdict
# exits non-zero and the harness discards the text — the check then reports
# nothing in exactly the circumstance it exists for. Seven hooks across three
# repos had that bug; see docs/multi-session-protocol.md §4.
#
# `--hook` never touches the network: it serves a cached upstream sha, so a
# session start is never blocked. That also means it can report "current" from a
# stale cache — verify by hand with `--refresh` before trusting a green light.
#
# The --file lists here are the MACHINE-READABLE SOURCE for the vendored set.
# tools/revendor.py cross-checks its FAMILIES against these lines and refuses to
# run if they disagree, because two hand-maintained lists that can drift is how a
# file quietly stops being checked. Add a file here and there, or neither.

bash tools/murderboard_freshness.sh --hook --label murderboard-vendored \
  --slug syncytium2/murderboard --clone "$HOME/Developer/murderboard" \
  --file docs/doc_review_process.md \
  --file tools/murderboard_freshness.sh \
  --file tools/murderboard_roster.sh \
  --file tools/fetch_paper.py \
  --file .claude/skills/murderboard/SKILL.md || true

bash tools/murderboard_freshness.sh --hook --label downlow-vendored \
  --slug syncytium2/downLow --clone "$HOME/Developer/downLow" \
  --file tools/data_root.py || true

exit 0
