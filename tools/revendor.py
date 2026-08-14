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
        "files": ["tools/data_root.py"],
        # Adapted on purpose (NOPEAK_DATA, this repo's not-managed-here list, the
        # extracted description, and two cross-repo assertions in --selftest). A body
        # re-copy DELETES those every time — it already did once, on the 27c52d4
        # re-vendor. Reported, never applied silently.
        "adapted": ["tools/data_root.py"],
    },
]


def stamp_line_index(text: str, is_json: bool) -> int | None:
    """Which single line may carry the stamp — and never more than one.

    Line 1, except that an interpreter shebang must stay first, so a `#!`-led file
    carries the stamp on line 2. JSON has no comments, so it uses a `_vendored` key.
    Everything else in the file is body content and is left alone, however
    stamp-shaped it looks.
    """
    lines = text.split("\n")
    if is_json:
        for i, line in enumerate(lines):
            if '"_vendored"' in line:
                return i
        return None
    if not lines:
        return None
    return 1 if lines[0].startswith("#!") else 0


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
    """The set as the freshness gate sees it — the machine-readable source of truth."""
    if not HOOK.is_file():
        return []
    for line in HOOK.read_text().split("\n"):
        if f"--label {label}" in line and "--file" in line:
            return re.findall(r"--file (\S+)", line)
    return []


def _git(clone: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-C", str(clone), *args], capture_output=True, text=True)


def run(check_only: bool) -> int:
    rc = 0
    for fam in FAMILIES:
        hooked = hook_files(fam["label"])
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

        recopied, bumped, missing, held = [], [], [], []
        for rel in fam["files"]:
            up_rel = fam.get("remap", {}).get(rel, rel)
            r = _git(clone, "show", f"{fam['ref']}:{up_rel}")
            if r.returncode:
                missing.append(f"{rel} (looked for {up_rel})")
                continue
            up, p = r.stdout, ROOT / rel
            is_json = rel.endswith(".json")
            loc = p.read_text()
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
                    i = stamp_line_index(want, is_json) or 0
                    wl = want.split("\n")
                    want = "\n".join(wl[:i + 1]) + "\n" + up
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
