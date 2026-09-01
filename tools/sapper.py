#!/usr/bin/env python3
# instrument: retrieval
"""sapper — no_peak's mechanized rule gate (ported pattern from interface2, via bugarach).

A sapper clears mines from ground others are about to cross: each rule is a
hard-won lesson converted into a check that fires by itself. Every rule MUST
prove it can fire — `--selftest` runs each rule against embedded bad/good
fixtures; a check that cannot fire is worse than no check, because it
manufactures exactly the confidence it was built to earn.

Usage:
  python3 tools/sapper.py --selftest   prove every rule can fire (and stay silent)
  python3 tools/sapper.py --all        scan all tracked files; exit 1 on BLOCK
  python3 tools/sapper.py --staged     scan ADDED lines of the staged diff (pre-commit)
  python3 tools/sapper.py --list       print the rule table

Wiring: tools/sapper.test.ts runs --selftest and --all under vitest, so
`npm test` enforces the rules; the optional pre-commit hook (.githooks/pre-commit,
enable with `git config core.hooksPath .githooks`) catches them earlier.

DISPUTING A RULE. interface2's version of this learned the hard way that a rule
you cannot correct is a rule that gets the whole gate switched off, and it built
a feedback directory reported at every session start so a complaint could not be
lost. This repository already has that surface and does not need a second one:
put it in docs/todo-now.md, whose headings the session-start hook prints at every
session, on every machine, until someone strikes them. Two hand-maintained lists
that can disagree is the failure this repo already fights in the vendor gate.

PORTED, NOT VENDORED, and the difference matters here. interface2's tools/sapper.sh
carries 35 rules about MATLAB, its data roots and its own retracted claims; not one
of them can fire on a TypeScript browser app, and copying it would install a gate
that cannot fire. bugarach hit the same wall and ported the pattern with its own
rule table, which is the precedent this file follows. So this file has NO
`vendored from … @ sha` stamp and is NOT a member of a vendor family: there is no
upstream copy of it to be stale against. What is shared is the shape — Rule
dataclass, fixtures, --selftest, --staged, the opt-in hook — and the shape is what
should stay in step.

THE RULES ARE NOT A WISHLIST. Each one below cites the place this repository
already wrote the lesson down. A rule that fires on correct code is a rule
someone switches off, so the bar for adding one is: mechanizable per line, and
it has already cost something.

DELIBERATELY NOT RULES, because a line regex is the wrong tool:
  - "exactly seven error models, never an eighth" (AGENTS.md). Counting union
    members is not a per-line test; it wants a unit test.
  - "numbers repeated across index.html, llms.txt, /methods and About.tsx must
    match docs/validation-status.md" (README). Cross-file agreement, not a
    pattern — the right shape is a test that reads both and compares.
  - heredoc-written source files. .claude/hooks/no-heredoc-source.sh already
    gates the ATTEMPT, which is strictly better: sapper only ever sees the
    wreckage, and only if it reaches a commit. tools/fortran/build_and_run.sh
    also uses a heredoc legitimately, so the rule would fire on correct code.
"""

from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
import sys
from dataclasses import dataclass, field


@dataclass
class Rule:
    id: str
    level: str                      # "BLOCK" | "WARN"
    pattern: str                    # regex, matched per line
    include: list[str]              # fnmatch globs of paths the rule applies to
    message: str
    fixture_bad: str                # one line the rule MUST fire on
    fixture_good: str               # one line the rule must NOT fire on
    exclude: list[str] = field(default_factory=list)


# Assembled by concatenation so this file never trips its own rules when scanned.
_HOME = r"/(?:Users|home)/[A-Za-z0-9._-]+/"


RULES = [
    Rule(
        id="SAP001", level="BLOCK",
        pattern=r"""^\s*(?:import|export)\b[^;]*?\bfrom\s+["']\.\.?/[^"']*(?<!\.ts)(?<!\.tsx)(?<!\.css)(?<!\?raw)["']""",
        include=["src/core/*.ts"],
        # The test files in src/core/ are legitimately extensionless: they run
        # under vitest, which resolves both forms, and are never reached by the
        # bare-`node` import chain this rule exists to protect. The first run of
        # this rule fired on 35 such lines and zero real ones — every production
        # file already complies — which is precisely how a gate earns being
        # switched off. Narrowed before it ever gated a commit.
        exclude=["tools/sapper.py", "src/core/*.test.ts"],
        message="Imports inside src/core/ carry explicit .ts extensions. That is "
                "load-bearing, not style: it is what lets bare `node` run "
                "scripts/cluster.ts, the documented batch invocation. AGENTS.md: "
                "'Do not strip them — Vite resolves both forms, so NO TEST WILL "
                "CATCH IT.' That sentence is why this is rule 001.",
        fixture_bad='import { clusterMain } from "./cluster";',
        fixture_good='import { clusterMain } from "./cluster.ts";',
    ),
    Rule(
        id="SAP002", level="BLOCK",
        pattern=_HOME,
        # Code that runs, not prose. The first draft also matched the strings
        # "University of Michigan" and "Dropbox-" anywhere in the tree and fired
        # 24 times — on the digitized records' SOURCE headers, on samples.ts's
        # citations, on /methods. Every one of those is a PROVENANCE CITATION
        # that data/digitized/README.md and samples.test.ts require to be there.
        # A rule cannot tell "the library that scanned the volume" from "a path
        # on my laptop" by the institution's name, so it no longer tries: the
        # hazard is a literal absolute home path, and that is all this matches.
        include=["tools/**", "scripts/**", "src/**", ".claude/**", ".githooks/**"],
        # sapper.py holds the pattern itself. data_root.py's job IS resolving the
        # store and it prints resolved absolute paths; excluding the resolver
        # from the path rule is the rule staying out of its own way, not a gap.
        # The .ipf's single hit is "/Users/you/out", a placeholder in a usage
        # comment — a real path is the hazard, a worked example is not.
        exclude=["tools/sapper.py", "tools/data_root.py", "tools/igor/no_peak_validate.ipf"],
        message="Absolute home-directory path in a tracked file, and this "
                "repository is public (github.com/syncytium2/no_peak). The four "
                "gitignored trees live behind tools/data_root.py, which resolves "
                "the store from Dropbox's own info.json precisely so that no "
                "machine's layout is written down — AGENTS.md, 'The store, and "
                "the one rule attached to it'.",
        fixture_bad='CLUST5_SRC="/Users/somebody/Developer/no_peak/reference/CLUST5.MPF"',
        fixture_good='CLUST5_SRC="${CLUST5_SRC:-$ROOT/reference/fortran/CLUST5.MPF}"',
    ),
    Rule(
        id="SAP003", level="BLOCK",
        pattern=r"git\s+(?:add\s+(?:-A\b|-u\b|\.(?:\s|$))|commit\s+(?:-a\b|-am\b))",
        # Scripts and hooks only. AGENTS.md and docs/multi-session-protocol.md
        # quote the forbidden command in order to forbid it; a rule that fires on
        # the prose stating the rule is a rule that gets switched off.
        include=["scripts/**", "tools/**", ".claude/**", ".githooks/**"],
        # session-start.sh is the file whose JOB is to warn every session off
        # this command; it names it twice, once in the incident note at the top
        # and once in the banner it prints. Firing on the warning about a thing
        # is not catching the thing.
        exclude=["tools/sapper.py", ".claude/hooks/session-start.sh"],
        message="Another agent may share this working tree and this index. Stage "
                "by path — `git commit --only <path>...` — because careful "
                "staging alone still sweeps up a peer's work. AGENTS.md, "
                "'Before you change anything'; the account is "
                "docs/multi-session-protocol.md, and it is a transcript of "
                "things that actually went wrong.",
        fixture_bad="git add -A && git commit -m 'wip'",
        fixture_good="git commit --only src/core/cluster.ts -m 'fix'",
    ),
    Rule(
        id="SAP004", level="BLOCK",
        pattern=r"\b(?:describe|it|test)\.only\s*\(",
        include=["**/*.test.ts", "**/*.test.tsx"],
        exclude=["tools/sapper.py"],
        message="A left-behind .only silently reduces the suite to one case while "
                "still reporting green. This repository already carries the "
                "milder version of that failure by design — the oracle suites "
                "SKIP on a fresh clone, so a green `npm test` does not mean the "
                "comparisons ran (docs/validation-status.md, head). A green run "
                "that checked one test is the same lie with none of the warning.",
        fixture_bad='it.only("reproduces the up flags exactly", () => {',
        fixture_good='it("reproduces the up flags exactly", () => {',
    ),
]


def _tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True)
    return out.stdout.splitlines()


def _applies(rule: Rule, path: str) -> bool:
    hit = any(fnmatch.fnmatch(path, g) for g in rule.include)
    exempt = any(fnmatch.fnmatch(path, g) for g in rule.exclude)
    return hit and not exempt


def scan_all() -> list[tuple[Rule, str, int, str]]:
    findings = []
    files = _tracked_files()
    for rule in RULES:
        rx = re.compile(rule.pattern)
        for path in files:
            if not _applies(rule, path):
                continue
            try:
                with open(path, encoding="utf-8", errors="ignore") as f:
                    for i, line in enumerate(f, 1):
                        if rx.search(line):
                            findings.append((rule, path, i, line.rstrip("\n")))
            except OSError:
                continue
    return findings


def scan_staged() -> list[tuple[Rule, str, int, str]]:
    """Only the lines the commit ADDS. A gate that blocks you on pre-existing
    lines in a file you touched gets switched off, and a switched-off gate
    catches nothing."""
    out = subprocess.run(["git", "diff", "--cached", "--unified=0"],
                         capture_output=True, text=True, check=True).stdout
    findings = []
    path = None
    lineno = 0
    for raw in out.splitlines():
        if raw.startswith("+++ b/"):
            path = raw[6:]
        elif raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            lineno = int(m.group(1)) - 1 if m else 0
        elif raw.startswith("+") and not raw.startswith("+++") and path:
            lineno += 1
            for rule in RULES:
                if _applies(rule, path) and re.search(rule.pattern, raw[1:]):
                    findings.append((rule, path, lineno, raw[1:]))
    return findings


def selftest() -> int:
    failures = 0
    for rule in RULES:
        rx = re.compile(rule.pattern)
        if not rx.search(rule.fixture_bad):
            print(f"SELFTEST FAIL {rule.id}: cannot fire on its bad fixture")
            failures += 1
        if rx.search(rule.fixture_good):
            print(f"SELFTEST FAIL {rule.id}: fires on its good fixture")
            failures += 1
    print(f"selftest: {len(RULES)} rules, {failures} failures")
    return 1 if failures else 0


def report(findings) -> int:
    blocked = False
    for rule, path, lineno, line in findings:
        print(f"{rule.level} {rule.id} {path}:{lineno}: {line.strip()}")
        print(f"    {rule.message}")
        blocked = blocked or rule.level == "BLOCK"
    if not findings:
        print("sapper: clear")
    return 1 if blocked else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--selftest", action="store_true")
    g.add_argument("--all", action="store_true")
    g.add_argument("--staged", action="store_true")
    g.add_argument("--list", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if args.list:
        for r in RULES:
            print(f"{r.id} {r.level:5s} {r.pattern}")
            print(f"    {r.message}")
        return 0
    return report(scan_staged() if args.staged else scan_all())


if __name__ == "__main__":
    sys.exit(main())
