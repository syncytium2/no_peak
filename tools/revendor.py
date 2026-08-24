#!/usr/bin/env python3
"""revendor — re-copy vendored files and bump their stamps, without corrupting them.

Ported from downLow's `tools/revendor.py` (2026-08-14, their `30351b2`/`2a68c61`), after
a hand-rolled `sed` there ran the stamp substitution over a WHOLE FILE and rewrote a
second, unrelated stamp-shaped string in the body of `docs/validation-status.md`. The
file then asserted the murderboard was vendored at a no_peak commit. Nothing failed and
nothing warned; it was caught only because the next re-vendor re-copied that body and
repaired it, which is the same bug with the evidence deleted.

no_peak is more exposed than downLow was, for two reasons worth stating up front:

  1. Five files here carry stamp-shaped strings in their BODIES — `README.md`,
     `docs/validation-status.md`, `tools/murderboard_freshness.sh` (an `echo` of the
     stamp format), `.claude/skills/murderboard/SKILL.md` (an INSTRUCTION describing
     the format), and `docs/reviews/*.md`. And our body string `@ b2b2ba2` is a PREFIX
     of the real full-length stamp `b2b2ba2d6c42…`, so one careless substitution aimed
     at the short form corrupts every long one in the same pass.
  2. **Our stamps are not all on line 1.** Shell and Python files carry a shebang first
     and the stamp on line 2. downLow's version only ever considers line 1, so a direct
     copy of it would silently skip four of our six vendored files — leaving them
     permanently unbumped while reporting success, which is the same class of quiet
     wrongness this tool exists to end. `stamp_line_index()` below is the fix and
     `--selftest` asserts it.

    python tools/revendor.py --check      report what would change, touch nothing
    python tools/revendor.py              do it
    python tools/revendor.py --selftest   prove the rewrite is surgical

THE VENDOR SET IS ASSERTED, NOT ASSUMED. `.claude/hooks/session-start.sh` runs the
freshness gate with an explicit `--file` list per family. Two hand-maintained lists that
can disagree is precisely how a file quietly stops being checked — it happened in
`docs/next-steps.md`, which claimed "seven", enumerated eight, and described a set of
ten. So this tool cross-checks its families against the hook and REFUSES TO RUN if they
disagree, rather than guessing which list is right.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOOK = ROOT / ".claude" / "hooks" / "session-start.sh"
STAMP_RE = re.compile(r"@ [0-9a-f]{7,40}")

# Every upstream no_peak consumes. Cross-checked against the freshness hook below.
FAMILIES = [
    {
        "label": "murderboard-vendored",
        "slug": "syncytium2/murderboard",
        "clone": Path.home() / "Developer" / "murderboard",
        "ref": "origin/main",
        "files": [
            "docs/doc_review_process.md",
            "tools/murderboard_freshness.sh",
            "tools/murderboard_roster.sh",
            "tools/fetch_paper.py",
            ".claude/skills/murderboard/SKILL.md",
        ],
        # murderboard's own layout is FLAT — no tools/ prefix, and skills/ rather than
        # .claude/skills/. Our paths are not its paths, so the mapping is explicit
        # rather than derived: a rule that strips a prefix would silently resolve the
        # wrong file the first time either repo rearranges. Five entries, stated.
        "remap": {
            "docs/doc_review_process.md": "doc_review_process.md",
            "tools/murderboard_freshness.sh": "murderboard_freshness.sh",
            "tools/murderboard_roster.sh": "murderboard_roster.sh",
            "tools/fetch_paper.py": "fetch_paper.py",
            ".claude/skills/murderboard/SKILL.md": "skills/murderboard/SKILL.md",
        },
        # `fetch_paper.py` says "hand-organized"; upstream says "hand-organised".
        #
        # ⚠ Do NOT read that as the house rule being applied to vendored files. It is
        # not applied consistently and probably was not a policy: `doc_review_process.md`
        # still carries 21 British spellings (16 `colour`, 5 `centre` and friends) and
        # `murderboard_freshness.sh` still says `behaviour`, both untouched. One file out
        # of five was changed, which reads as an incidental edit that survived rather
        # than a decision anyone made.
        #
        # Listed as adapted regardless, because the tool's job is to refuse to silently
        # revert a local change — not to judge whether it was intentional. Whether
        # vendored files should be Americanized AT ALL is an open question for the
        # owner, and it is not free: it means re-applying the change on every re-copy,
        # forever, in exchange for spelling in a file we do not own.
        "adapted": ["tools/fetch_paper.py"],
    },
    {
        "label": "downlow-vendored",
        "slug": "syncytium2/downLow",
        "clone": Path.home() / "Developer" / "downLow",
        "ref": "main",
        "files": ["tools/data_root.py", "tools/review_digitization.py"],
        # Adapted on purpose (NOPEAK_DATA, this repo's not-managed-here list, the
        # extracted description, and two cross-repo assertions in --selftest). A body
        # re-copy DELETES those every time — it already did once, on the 27c52d4
        # re-vendor. Reported, never applied silently.
        #
        # review_digitization.py is adapted for a different reason and it is not
        # cosmetic: upstream reaches sideways into a sibling no_peak/ checkout for
        # the digitizer, and reads downLow's own vendored copy of data/digitized/.
        # Run unmodified here it would render this repo's canonical CSVs against
        # nothing, or downLow's stale ones — which is exactly what happened on
        # 2026-08-15, when a review page came back showing pre-fix values after the
        # digitizer had already been corrected. The local copy imports its sibling
        # and reads this repo's data/. A body re-copy deletes that; re-apply it.
        "adapted": ["tools/data_root.py", "tools/review_digitization.py"],
    },
]


def stamp_line_index(text: str, is_json: bool) -> int | None:
    """Which single line may carry the stamp — and never more than one.

    Four positions, each forced by a format that will not take a comment on line 1:

      * line 1 normally;
      * line 2 when line 1 is a `#!` shebang, which must stay first;
      * the `"_vendored"` key's line in JSON, which has no comments;
      * inside YAML frontmatter when line 1 is `---`. Added 2026-08-23 (murderboard
        #29). `SKILL.md` is this case, and treating it as a line-1 file is not
        harmless: line 0 is the `---` fence, carries no stamp, so `bump_stamp`
        silently did nothing and the copy sat unbumped behind a passing gate.
    """
    lines = text.split("\n")
    if is_json:
        for i, line in enumerate(lines):
            if '"_vendored"' in line:
                return i
        return None
    if not lines:
        return None
    if lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":       # end of frontmatter
                break
            if STAMP_RE.search(lines[i]):
                return i
        return 1                                # frontmatter, not yet stamped
    return 1 if lines[0].startswith("#!") else 0


def recopy_with_stamp(local: str, up: str, is_json: bool) -> str:
    """Upstream's content carrying the local stamp line. NOT `local prefix + upstream`.

    Fixes a live corruption, found 2026-08-23 by running this tool against a real
    consumer instead of only its own fixtures (murderboard #29). The old
    reconstruction kept everything up to and including the stamp line and appended
    upstream whole, which repeats upstream's own opening lines whenever the stamp is
    not on line 1. Reproduced here, today, on `tools/murderboard_freshness.sh`:

        1  #!/usr/bin/env bash
        2  # vendored from syncytium2/murderboard @ fae0eca
        3  #!/usr/bin/env bash          <- upstream's, back again
        4  # murderboard_freshness.sh — is this repo's VENDORED murderboard current…

    The second `#!` is an inert comment, so the file still runs and `--selftest` still
    passes — nothing anywhere reports it. For a YAML file it is worse than cosmetic: a
    second `---` reopens the frontmatter block and swallows the body as metadata.

    The stamp is an INSERTED line, so re-copying puts it back into upstream at the
    position upstream reserves for it, rather than splicing two prefixes together.
    """
    i = stamp_line_index(local, is_json)
    llines = local.split("\n")
    if i is None or i >= len(llines) or not STAMP_RE.search(llines[i]):
        return up                                   # nothing to preserve
    stamp_line = llines[i]
    j = stamp_line_index(up, is_json)
    if j is None:                                   # e.g. JSON with no _vendored key yet
        j = 1
    ulines = up.split("\n")
    j = min(j, len(ulines))
    return "\n".join(ulines[:j] + [stamp_line] + ulines[j:])


def misplaced_stamp_line(text: str, is_json: bool) -> int | None:
    """A stamp the freshness gate WILL see but this writer would never touch. 1-based.

    `murderboard_freshness.sh` scans the first five lines for a stamp; this writer
    touches one. A stamp in between is green to the gate and invisible here, so the
    copy drifts forever behind a passing check. Report it; never treat it as
    "nothing to do".
    """
    eligible = stamp_line_index(text, is_json)
    lines = text.split("\n")
    if eligible is not None and eligible < len(lines) and STAMP_RE.search(lines[eligible]):
        return None
    for i, line in enumerate(lines[:5]):
        if i != eligible and STAMP_RE.search(line):
            return i + 1
    return None


def bump_stamp(text: str, new: str, is_json: bool) -> str:
    """Rewrite the stamp on the one eligible line and NOTHING else."""
    i = stamp_line_index(text, is_json)
    if i is None:
        return text
    lines = text.split("\n")
    if i < len(lines) and STAMP_RE.search(lines[i]):
        lines[i] = STAMP_RE.sub(f"@ {new}", lines[i])
    return "\n".join(lines)


def stamp_is_current(text: str, new: str, is_json: bool) -> bool:
    """True when the recorded stamp already names `new` — full or abbreviated.

    Stamps here are written at whatever length the vendoring session used: the
    murderboard set carries 40 chars, `data_root.py` carries 7. `git rev-parse
    --short` returns the short form, so a naive `!=` reports all five long stamps as
    needing a bump on every single run, forever. That is not staleness, it is two
    spellings of one sha.
    """
    i = stamp_line_index(text, is_json)
    if i is None:
        return False
    lines = text.split("\n")
    if i >= len(lines):
        return False
    m = STAMP_RE.search(lines[i])
    if not m:
        return False
    have = m.group(0)[2:]
    return have.startswith(new) or new.startswith(have)


def body_of(text: str, is_json: bool) -> str:
    """The file as upstream holds it, with our injected stamp line removed."""
    i = stamp_line_index(text, is_json)
    lines = text.split("\n")
    if i is None or i >= len(lines) or not STAMP_RE.search(lines[i]):
        return text
    return "\n".join(lines[:i] + lines[i + 1:])


def hook_files(label: str) -> list[str]:
    """The set as the freshness gate sees it — the machine-readable source of truth.

    Continuations are joined FIRST. The hook writes one invocation across several
    backslash-continued lines, so a line-at-a-time scan finds `--label` on one line
    and every `--file` on later ones, matches neither, and returns nothing. That is
    how this returned [] for both families from the day it was written until
    2026-08-15 — and an empty list is indistinguishable from "no hook", which the
    callers then treat as nothing to check. The cross-check written to stop a file
    silently dropping out of the gate was itself silently doing nothing.
    """
    if not HOOK.is_file():
        return []
    joined = HOOK.read_text().replace("\\\n", " ")
    for line in joined.split("\n"):
        if f"--label {label}" in line and "--file" in line:
            # A path lifted out of a JSON settings file arrives wearing the enclosing
            # quote and a trailing comma — `…/session-start.sh",`. Compared raw it
            # "disagrees" with the configured path over punctuation, and noise like that
            # is what gets a check switched off. Harmless here while the hook is a shell
            # script; kept so it stays correct if the invocation ever moves into JSON.
            return [t.strip("\\\"',") for t in re.findall(r"--file (\S+)", line)]
    return []


def _git(clone: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(clone), *args], capture_output=True, text=True)


def run(check_only: bool) -> int:
    rc = 0
    for fam in FAMILIES:
        hooked = hook_files(fam["label"])
        if not hooked and HOOK.is_file():
            print(f"revendor: the freshness hook lists no files for {fam['label']}.",
                  file=sys.stderr)
            print("  Either the label is missing from .claude/hooks/session-start.sh or"
                  " this parser no longer understands it. Not treating that as agreement:"
                  " an empty list used to pass silently.", file=sys.stderr)
            return 1
        if hooked and sorted(hooked) != sorted(fam["files"]):
            print(f"revendor: {fam['label']} disagrees with the freshness hook.", file=sys.stderr)
            print(f"  only in this file: {sorted(set(fam['files']) - set(hooked))}", file=sys.stderr)
            print(f"  only in the hook:  {sorted(set(hooked) - set(fam['files']))}", file=sys.stderr)
            print("  Reconcile them; two disagreeing lists is how a file stops being"
                  " checked.", file=sys.stderr)
            return 1

        clone = fam["clone"]
        if not (clone / ".git").exists():
            print(f"revendor: no clone of {fam['slug']} at {clone}", file=sys.stderr)
            rc = 1
            continue
        _git(clone, "fetch", "-q", "origin")
        new = _git(clone, "rev-parse", "--short", fam["ref"]).stdout.strip()

        recopied, bumped, missing, held, misplaced = [], [], [], [], []
        for rel in fam["files"]:
            up_rel = fam.get("remap", {}).get(rel, rel)
            r = _git(clone, "show", f"{fam['ref']}:{up_rel}")
            if r.returncode:
                missing.append(f"{rel} (looked for {up_rel})")
                continue
            up, p = r.stdout, ROOT / rel
            is_json = rel.endswith(".json")
            loc = p.read_text()

            # Gated but unbumpable: the gate reads a stamp this writer will never
            # touch, so the copy would drift behind a green check. An error, not a skip.
            bad_line = misplaced_stamp_line(loc, is_json)
            if bad_line is not None:
                misplaced.append(f"{rel} (stamp on line {bad_line})")
                continue
            # A stamp recording the FULL sha is current when upstream resolves to a
            # short form of the same commit. Rewriting it would be pure churn, and
            # churn is what gets a check switched off (next-steps §D names that as the
            # thing most likely to kill this gate).
            want = loc if stamp_is_current(loc, new, is_json) else bump_stamp(loc, new, is_json)
            if body_of(loc, is_json) != up:
                if rel in fam.get("adapted", []):
                    # Locally adapted: report the drift, never overwrite the adaptation.
                    held.append(rel)
                else:
                    want = recopy_with_stamp(want, up, is_json)
                    recopied.append(rel)
            elif want != loc:
                bumped.append(rel)
            if not check_only and want != loc:
                p.write_text(want)

        verb = "would re-copy" if check_only else "re-copied"
        print(f"{fam['label']}  upstream {new}")
        print(f"  {verb} (body changed): {recopied or 'none'}")
        print(f"  stamp bumped only:    {len(bumped)} file(s)")
        if held:
            print(f"  !! body differs but file is LOCALLY ADAPTED — merge by hand: {held}")
            rc = 1
        if misplaced:
            print("  !! STAMP IN THE WRONG PLACE — the gate sees it, this tool will not\n"
                  f"     touch it, so it stays unbumped behind a green check: {misplaced}",
                  file=sys.stderr)
            rc = 1
        if missing:
            print(f"  !! not found upstream: {missing}", file=sys.stderr)
            rc = 1
    return rc


def selftest() -> int:
    """The rewrite must be surgical, and the fixtures must be able to fail."""
    bad = 0

    def check(label, got, want):
        nonlocal bad
        ok = got == want
        bad += not ok
        print(f"  {'OK  ' if ok else 'FAIL'} {label}")
        if not ok:
            print(f"         got  {got!r}\n         want {want!r}")

    FULL = "b2b2ba2d6c42cef07850bd7be2db3aa4d019151c"

    # 1. The shape that broke downLow: real stamp on line 1, unrelated one in the body.
    doc = ("<!-- vendored from syncytium2/murderboard @ aaaaaaa — do not edit here. -->\n"
           "# Title\n"
           "The murderboard is vendored @ b2b2ba2; the gate reports current.\n")
    out = bump_stamp(doc, "ffffff1", False)
    check("line-1 stamp is rewritten", out.split("\n")[0].count("ffffff1"), 1)
    check("body stamp is UNTOUCHED", "@ b2b2ba2" in out, True)
    check("exactly one stamp changed", out.count("ffffff1"), 1)

    # 2. THE NESTING CASE — ours, and nastier than downLow's. The body string is a
    #    PREFIX of the real full-length stamp, so a substitution aimed at the short
    #    form eats the long one too. A fixture using two DISTINCT strings passes while
    #    this still breaks, which is why this case exists separately.
    nest = (f"<!-- vendored from syncytium2/murderboard @ {FULL} — do not edit. -->\n"
            "# Title\nThe murderboard is vendored @ b2b2ba2; gate current.\n")
    outn = bump_stamp(nest, "ffffff1", False)
    check("full-length line-1 stamp is rewritten", outn.split("\n")[0].count("ffffff1"), 1)
    check("body PREFIX of that stamp survives", "@ b2b2ba2;" in outn, True)
    check("long form gone from the body too", FULL not in outn, True)

    # 3. THE SHEBANG CASE — ours alone. downLow's version only considers line 1, so a
    #    direct copy would silently skip four of our six files and report success.
    sh = ("#!/usr/bin/env python3\n"
          f"# vendored from syncytium2/downLow @ {FULL} — canonical THERE.\n"
          '"""Docstring mentioning @ b2b2ba2 for context."""\n')
    outs = bump_stamp(sh, "ffffff1", False)
    check("shebang stays on line 1", outs.split("\n")[0], "#!/usr/bin/env python3")
    check("line-2 stamp IS rewritten", "ffffff1" in outs.split("\n")[1], True)
    check("body stamp below a shebang survives", "@ b2b2ba2" in outs.split("\n")[2], True)
    check("body_of drops the stamp line, not the shebang",
          body_of(sh, False).split("\n")[0], "#!/usr/bin/env python3")

    # 4. JSON, which has no comments and so uses a key.
    js = ('{\n "_vendored": "syncytium2/murderboard @ aaaaaaa — re-copy.",\n'
          ' "note": "see @ b2b2ba2"\n}\n')
    outj = bump_stamp(js, "ffffff1", True)
    check("json stamp is rewritten", "ffffff1" in outj.split("\n")[1], True)
    check("json body stamp is UNTOUCHED", "@ b2b2ba2" in outj, True)

    # 5. An unstamped file must come back unchanged rather than gaining a stamp.
    plain = "# nothing to see\nbody\n"
    check("unstamped file is unchanged", bump_stamp(plain, "ffffff1", False), plain)

    # 5b. YAML FRONTMATTER, and 5c THE RE-COPY RECONSTRUCTION. Both added 2026-08-23
    #     (murderboard #29), both found by running this tool against a real consumer
    #     rather than against its own fixtures. The fixtures below were all green while
    #     the tool was corrupting files.
    fm = ("---\n"
          "# vendored from syncytium2/murderboard @ aaaaaaa — do NOT edit.\n"
          "name: murderboard\n---\n\nBody mentioning @ b2b2ba2.\n")
    check("frontmatter stamp is found", stamp_line_index(fm, False), 1)
    outfm = bump_stamp(fm, "ffffff1", False)
    check("frontmatter stamp IS rewritten", "ffffff1" in outfm.split("\n")[1], True)
    check("body stamp below the frontmatter survives", "@ b2b2ba2" in outfm, True)
    check("a stamp outside the eligible line is REPORTED",
          misplaced_stamp_line("# a\n# b\n# vendored @ aaaaaaa\nbody\n", False), 3)
    check("a correctly placed stamp is not flagged", misplaced_stamp_line(fm, False), None)

    # THE LIVE ONE. Reproduced on tools/murderboard_freshness.sh before the fix: the
    # re-copy returned a file with TWO shebangs, the second inert, so it still ran and
    # --selftest still passed. Nothing anywhere reported it.
    up_sh = "#!/usr/bin/env bash\n# CANONICAL SOURCE: upstream — edit HERE.\necho hello\n"
    loc_sh = ("#!/usr/bin/env bash\n# vendored from syncytium2/murderboard @ aaaaaaa\n"
              "# CANONICAL SOURCE: upstream — edit HERE.\necho OLD\n")
    got_sh = recopy_with_stamp(loc_sh, up_sh, False)
    check("re-copy keeps exactly one shebang", got_sh.count("#!/usr/bin/env bash"), 1)
    check("re-copy keeps the local stamp", "@ aaaaaaa" in got_sh, True)
    check("re-copy takes upstream's body",
          "echo hello" in got_sh and "echo OLD" not in got_sh, True)
    check("re-copy is idempotent", recopy_with_stamp(got_sh, up_sh, False), got_sh)
    check("and its body then matches upstream", body_of(got_sh, False), up_sh)

    up_fm = "---\nname: murderboard\n---\n\nBody.\n"
    loc_fm = ("---\n# vendored from syncytium2/murderboard @ aaaaaaa\n"
              "name: murderboard\n---\n\nOLD body.\n")
    got_fm = recopy_with_stamp(loc_fm, up_fm, False)
    check("frontmatter re-copy keeps exactly two --- fences",
          got_fm.split("\n").count("---"), 2)
    check("frontmatter re-copy is idempotent", recopy_with_stamp(got_fm, up_fm, False), got_fm)

    # 6. PROVE THE FIXTURES HAVE POWER. The bug each guards against must fail it — a
    #    test that cannot fail is the thing this file exists because of. Pattern owed
    #    to the downLow session.
    def whole_file_sub(text, new):          # the implementation that corrupted a file
        return STAMP_RE.sub(f"@ {new}", text)

    def line1_only(text, new):              # downLow's version, applied to our shebangs
        lines = text.split("\n")
        if STAMP_RE.search(lines[0]):
            lines[0] = STAMP_RE.sub(f"@ {new}", lines[0])
        return "\n".join(lines)

    check("a whole-file substitution FAILS the nesting fixture",
          "@ b2b2ba2;" in whole_file_sub(nest, "ffffff1"), False)
    check("a line-1-only implementation FAILS the shebang fixture",
          "ffffff1" in line1_only(sh, "ffffff1"), False)

    def prefix_splice(local, up, is_json):    # the reconstruction that shipped here
        i = stamp_line_index(local, is_json) or 0
        return "\n".join(local.split("\n")[:i + 1]) + "\n" + up

    check("prefix-splicing FAILS the shebang fixture",
          prefix_splice(loc_sh, up_sh, False).count("#!/usr/bin/env bash"), 2)
    check("prefix-splicing FAILS the frontmatter fixture",
          prefix_splice(loc_fm, up_fm, False).split("\n").count("---"), 3)
    check("a line-1-only stamp_line_index FAILS the frontmatter fixture",
          "ffffff1" in line1_only(fm, "ffffff1"), False)

    # 7. Full-vs-short sha is not staleness. Without this the gate reports five files
    #    needing a bump on every run, forever — and noise is what gets a check ignored.
    long_stamped = f"<!-- vendored from syncytium2/murderboard @ {FULL} -->\nbody\n"
    check("full stamp is current against its own short form",
          stamp_is_current(long_stamped, FULL[:7], False), True)
    check("short stamp is current against the full form",
          stamp_is_current(f"# vendored @ {FULL[:7]}\nbody\n", FULL, False), True)
    check("a genuinely different sha is NOT current",
          stamp_is_current(long_stamped, "ffffff1", False), False)

    # 8. The two lists that can disagree.
    for fam in FAMILIES:
        hooked = hook_files(fam["label"])
        check(f"{fam['label']} matches the freshness hook",
              sorted(hooked) or sorted(fam["files"]), sorted(fam["files"]))

    print(f"\n{'FAILED' if bad else 'PASS'} — {bad} problem(s)")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true", help="report, change nothing")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    return selftest() if a.selftest else run(a.check)


if __name__ == "__main__":
    sys.exit(main())
