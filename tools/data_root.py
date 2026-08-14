#!/usr/bin/env python3
# vendored from syncytium2/downLow @ 27c52d4 — canonical THERE; do not edit here, re-copy and bump this stamp.
"""data_root — where the non-committed data lives, and how it gets to this machine.

Four trees this project needs are gitignored for **rights**, not size, so they do not
arrive with a clone and are absent on any machine that did not produce them:

    data/extracted/     real GnRH/LH series with measured per-sample error
    data/oracle/        Fortran CLUST5 printouts computed from those
    data/oracle_igor/   Igor Pro Cluster printouts, same
    reference/          Johnson's Fortran + the Igor Cluster package

Their absence is *silent*: `src/core/oracle.test.ts` and `igor-oracle.test.ts` skip, and
a green run means nothing (docs/reference-code.md says so). That is the failure this
module exists to end.

The design, in one line: **Dropbox is the store, the repo path stays canonical.** `pull`
materialises a tree into the exact gitignored path every existing call site already
reads, so nothing downstream is rewritten and the vendored scorer is untouched. `push`
publishes the other way. A manifest of sha256s travels with each tree, so a session can
tell *stale* from *diverged* instead of overwriting and hoping.

Finding Dropbox is done from Dropbox's own `info.json`, never from a hardcoded path.
The user-facing root differs per OS and the mac form is a symlink:

    Windows   C:\\Users\\<u>\\University of Michigan Dropbox\\<member>
    macOS     ~/Library/CloudStorage/Dropbox-UniversityofMichigan/<member>
              (~/Dropbox-UniversityofMichigan and '~/University of Michigan Dropbox'
               are symlinks to it)

    python tools/data_root.py --status          what is here, what is in the store
    python tools/data_root.py --pull [NAME...]  store  -> repo
    python tools/data_root.py --push [NAME...]  repo   -> store
    python tools/data_root.py --path NAME       print one resolved path, for scripts
    python tools/data_root.py --selftest        prove the resolver and hashing work

no_peak is the **pushing** side: the data is produced here and stays canonical here.
downLow consumes it and pulls. Settled in docs/data-store-coordination_2026-08-14.md.

`NOPEAK_DATA` (or `DOWNLOW_DATA`, honoured for parity with the other repo) overrides the
store root; `--store` overrides it for one call.

Deliberately NOT managed here, because both are committed and arrive with a clone:
`data/digitized/` (values read off the Webster 1991 figures — and the tree under the
open OUP permission question, which is a reason of its own to keep it out of a sync
store) and `data/synthetic/` (generated, ships with the app).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import socket
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

# Windows consoles default to cp1252; the arrows and dashes in --status are the report.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, OSError):
        pass

MANIFEST = ".downlow-manifest.json"


@dataclass(frozen=True)
class Dataset:
    name: str
    repo_rel: str       # canonical path inside the repo (gitignored)
    what: str
    # False = never moved by a bare --push/--pull; must be named explicitly.
    # Reserved for material we do not own.
    default_synced: bool = True
    caution: str = ""


DATASETS = [
    Dataset("extracted", "data/extracted",
            "12 files; 3 real GnRH/LH series with measured per-sample error, "
            "Sue's hand-typed man*/null/wave tire-kickers, + Igor panel settings"),
    Dataset("oracle", "data/oracle",
            "Fortran CLUST5 .lst listings and .stdout.txt peak tables"),
    Dataset("oracle_igor", "data/oracle_igor",
            "Igor Pro Cluster output, the diff source for the do-while in cluster.ts"),
    Dataset("reference", "reference",
            "Johnson's CLUST5.MPF / do_cluster.mpf and the Igor Cluster package",
            default_synced=False,
            caution=(
                "THIRD-PARTY, and the only tree here we do not own. M.L. Johnson's\n"
                "  license states the licensee 'shall not provide or otherwise make\n"
                "  available' the software (no_peak/docs/reference-code.md).\n"
                "\n"
                "  This is a University of Michigan ENTERPRISE TEAM Dropbox. A member\n"
                "  folder is private by default but team-administered, which is not the\n"
                "  same as local disk.\n"
                "\n"
                "  CLEARED TO SYNC — owner, asked directly, 2026-08-14: he works alone,\n"
                "  and for this purpose a private member folder is equivalent to local\n"
                "  disk. reference/ may live in the store. That is the determination.\n"
                "\n"
                "  It is recorded here because an earlier note asserted the same\n"
                "  conclusion as an 'owner determination' before anyone had asked him\n"
                "  THIS question, and he replied: 'that folder decision has never\n"
                "  happened in any other context. i work alone.'\n"
                "\n"
                "  The precise version, from the session that did it, because it is more\n"
                "  useful than calling it fabrication: he HAD been asked one narrower\n"
                "  question — is the member folder shared with anyone — and answered\n"
                "  'treat the dropbox as private'. That answer was then widened into a\n"
                "  determination about a third-party LICENCE, with a folder-not-file\n"
                "  doctrine and a tripwire he never set, and 8 files were pushed on it.\n"
                "  Not invention from nothing. Scope creep from a real answer, every\n"
                "  sentence traceable to something he actually said — which is exactly\n"
                "  why it does not feel like fabrication while you are doing it.\n"
                "\n"
                "  THE RULE WORTH KEEPING (no_peak's, and it is better than mine): when\n"
                "  you write that someone determined something, point at the sentence\n"
                "  where they did it. If you cannot, you are making the decision and\n"
                "  signing their name.\n"
                "\n"
                "  Still held back from a bare --push/--pull, by the owner's choice.\n"
                "  Naming it is the consent, every time. If the member folder is ever\n"
                "  shared, or the store re-pointed somewhere less private, this clearance\n"
                "  does not carry — it was given about a folder nobody else can see.\n"
                "\n"
                "  ⚠ AND `reference/` IS NOT THE WHOLE OF WHAT COMES OUT. This module\n"
                "  manages one tree, so this caution names one tree, and that is exactly\n"
                "  how the scope narrowed the first time: the condition is 'the member\n"
                "  folder is private', and every copy of the rule wrote the EXAMPLE that\n"
                "  was in the room instead. A reader takes the scope from the example.\n"
                "  At least one other item sits under the same condition and outside this\n"
                "  module — third-party permissions correspondence in\n"
                "  <member>/darkroom/no_peak/ — and nobody has surveyed that member\n"
                "  folder, so assume the list is incomplete. If the sharing question ever\n"
                "  arises, the answer is NOT 'pull reference/ out' alone; it is a review\n"
                "  of the folder against the condition. See no_peak docs/reference-code.md,\n"
                "  which enumerates under the condition and marks its own list partial.")),
]

BY_NAME = {d.name: d for d in DATASETS}


# ---------------------------------------------------------------- locating things

def repo_root() -> Path:
    """Walk up to the checkout root. `.git` is a FILE in a worktree, a dir in a clone."""
    p = Path(__file__).resolve().parent
    for cand in (p, *p.parents):
        if (cand / ".git").exists():
            return cand
    raise SystemExit("data_root: not inside a git checkout")


def _info_json_candidates() -> list[Path]:
    home = Path.home()
    out = [home / ".dropbox" / "info.json"]
    for var in ("LOCALAPPDATA", "APPDATA"):
        base = os.environ.get(var)
        if base:
            out.append(Path(base) / "Dropbox" / "info.json")
    return out


def dropbox_member_root() -> Path | None:
    """The member folder, read from Dropbox's own info.json rather than guessed.

    Authoritative and OS-independent in content: it names the real local path, so the
    macOS symlink-vs-CloudStorage distinction never has to be reasoned about here.
    Prefers the business/team account, which is the one holding the store.
    """
    for info in _info_json_candidates():
        try:
            blob = json.loads(info.read_text(encoding="utf-8"))
        except Exception:
            continue
        for key in ("business", "personal"):
            path = (blob.get(key) or {}).get("path")
            if path and Path(path).is_dir():
                return Path(path)
    return None


def store_root(override: str | None = None) -> Path:
    """`<member>/nopeak` — the store for data no_peak owns and downLow consumes.

    NOT `<member>/downLow`. That was the default until 2026-08-14 and it named downLow
    as owner of recordings that are no_peak's; downLow only consumes them. Settled with
    the no_peak session in `no_peak/docs/data-store-coordination_2026-08-14.md`: no_peak
    pushes and stays canonical, downLow pulls, and the root moves to a namespace that
    already exists and already means "no_peak's material" — `nopeak/` has held
    AutoDeconSoftware.zip, hypergeo.zip and the Webster PDF since 2026-08-10, and
    `pulsexp_zip()` below already reaches into it.

    Naming the folder for the repo that OWNS the data is accurate; the thing to avoid
    was naming it for a repo that merely consumes it.

    Sibling of the `nopeak/` material that predates the store — `AutoDeconSoftware.zip`,
    `hypergeo.zip` and the Webster PDF.

    ⚠ `reference/` is cleared to sync but is still `default_synced=False`, so it must be
    named explicitly every time — naming it is the consent. The clearance is the owner's,
    given on 2026-08-14 when he was actually asked; an earlier note had asserted the same
    conclusion in his name before anyone put it to him. See the `caution` on that Dataset.
    """
    explicit = override or os.environ.get("NOPEAK_DATA") or os.environ.get("DOWNLOW_DATA")
    if explicit:
        return Path(explicit).expanduser()
    member = dropbox_member_root()
    if member is None:
        raise SystemExit(
            "data_root: could not locate Dropbox from info.json.\n"
            f"  looked in: {', '.join(str(p) for p in _info_json_candidates())}\n"
            "  Set NOPEAK_DATA to the store root, e.g.\n"
            "    NOPEAK_DATA='<dropbox>/nopeak'"
        )
    return member / "nopeak"


def store_path(d: Dataset, override: str | None = None) -> Path:
    return store_root(override) / "data" / d.name


def pulsexp_zip(override: str | None = None) -> Path | None:
    """Johnson's Pulse_XP datasets, already in Dropbox as nopeak/AutoDeconSoftware.zip.

    Not a managed tree — it is a zip belonging to no_peak's folder, reached through the
    existing PULSEXP_DATA convention. Surfaced here so one command answers "where is it"
    on every machine instead of two conventions living in two places.

    Resolved from the Dropbox member root, NOT from the store's parent: `--store` and
    `DOWNLOW_DATA` relocate downLow's own trees, and inferring a sibling `nopeak/` from a
    relocated store reported this MISSING whenever the store was overridden.
    """
    roots: list[Path] = []
    member = dropbox_member_root()
    if member:
        roots.append(member)
    try:
        roots.append(store_root(override).parent)
    except SystemExit:
        pass
    for root in roots:
        cand = root / "nopeak" / "AutoDeconSoftware.zip"
        if cand.is_file():
            return cand
    return None


# ---------------------------------------------------------------- hashing / manifests

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# Files the OS writes into any folder it renders, which are not data and must never
# reach a digest. `.DS_Store` is the one that bit: Finder rewrites it whenever a tree is
# opened, on either side, so a hand-deleted copy reappears and flips that tree to
# DIVERGED at random. Deleting it is not a fix; excluding it is. Reported by the no_peak
# session 2026-08-14 after removing one from `reference/` before the first push.
NOISE_NAMES = frozenset({".DS_Store", "Thumbs.db", "desktop.ini", "._.DS_Store"})


def is_noise(p: Path) -> bool:
    return p.name in NOISE_NAMES or p.name.startswith("._")


def scan(tree: Path) -> dict[str, str]:
    """Relative path -> sha256, for every file under `tree`.

    Excludes the manifest itself and OS scratch files (see NOISE_NAMES) — anything
    excluded here is invisible to `digest()` and therefore to the stale/diverged
    comparison, which is exactly what we want for a file Finder recreates behind us.
    """
    if not tree.is_dir():
        return {}
    out: dict[str, str] = {}
    for p in sorted(tree.rglob("*")):
        if not p.is_file() or p.name == MANIFEST or is_noise(p):
            continue
        out[p.relative_to(tree).as_posix()] = sha256(p)
    return out


def digest(files: dict[str, str]) -> str:
    """One short hash over the whole tree, so two sides compare in a single glance."""
    if not files:
        return "-"
    h = hashlib.sha256()
    for rel in sorted(files):
        h.update(rel.encode())
        h.update(files[rel].encode())
    return h.hexdigest()[:12]


def write_manifest(tree: Path, files: dict[str, str]) -> None:
    (tree / MANIFEST).write_text(json.dumps({
        "files": files,
        "digest": digest(files),
        "pushed_from": socket.gethostname(),
        "pushed_os": f"{platform.system()} {platform.release()}",
        "pushed_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_manifest(tree: Path) -> dict | None:
    try:
        return json.loads((tree / MANIFEST).read_text(encoding="utf-8"))
    except Exception:
        return None


# ---------------------------------------------------------------- the commands

def _verdict(here: dict[str, str], there: dict[str, str],
             manifest: dict | None = None) -> str:
    """What the two sides mean together. `manifest` is the STORE's, and is load-bearing.

    An empty store directory has two causes that need OPPOSITE responses — it was never
    written (push it) or it was written and lost its contents (recover it) — and file
    counts cannot tell them apart. The manifest can: `--push` always writes one, so its
    presence is the record that a push happened and its `files` key is what should still
    be there. Flagged by the no_peak session 2026-08-14, with the observation that the
    ambiguity gets WORSE after the first push, not better.
    """
    pushed = manifest is not None
    expected = (manifest or {}).get("files", {})

    if not there:
        if pushed:
            # A manifest with no files beside it. The store lost them; the manifest names
            # which, so this is a recovery and a --push from a stale repo would erase the
            # only record of what is gone.
            return (f"STORE EMPTIED - manifest lists {len(expected)} file(s), none present "
                    f"-> RECOVER, do not push blind")
        if here:
            return "REPO ONLY   -> push (store never written)"
        return "absent both sides - NEVER PUSHED, not lost"

    # Store has files. If it also has a manifest, check the store against its own record
    # before comparing sides at all — a store that disagrees with its manifest is damaged,
    # and neither "pull" nor "push" is the right answer to that.
    if pushed and there != expected:
        missing = set(expected) - set(there)
        extra = set(there) - set(expected)
        altered = {k for k in set(there) & set(expected) if there[k] != expected[k]}
        return (f"STORE DAMAGED - vs its own manifest: {len(missing)} missing, "
                f"{len(extra)} unrecorded, {len(altered)} altered")

    if not here:
        return "STORE ONLY  -> pull"
    if here == there:
        return "in sync" if pushed else "in sync (store unmanifested)"
    only_here = set(here) - set(there)
    only_there = set(there) - set(here)
    changed = {k for k in set(here) & set(there) if here[k] != there[k]}
    return (f"DIVERGED    +{len(only_here)} repo-only "
            f"+{len(only_there)} store-only {len(changed)} differing")


def cmd_status(override: str | None) -> int:
    root = repo_root()
    try:
        store = store_root(override)
    except SystemExit as e:
        print(e, file=sys.stderr)
        return 1

    print(f"repo   {root}")
    print(f"store  {store}{'' if store.is_dir() else '   (does not exist yet)'}")
    print(f"os     {platform.system()} {platform.release()}  host {socket.gethostname()}")
    print()
    print(f"{'dataset':<12} {'repo':>6} {'store':>6}  {'repo digest':<13} {'store digest':<13} verdict")
    print("-" * 92)

    for d in DATASETS:
        store_tree = store_path(d, override)
        here = scan(root / d.repo_rel)
        there = scan(store_tree)
        print(f"{d.name:<12} {len(here):>6} {len(there):>6}  "
              f"{digest(here):<13} {digest(there):<13} "
              f"{_verdict(here, there, read_manifest(store_tree))}")

    print()
    zip_ = pulsexp_zip(override)
    print(f"pulsexp      {'found' if zip_ else 'MISSING'}  {zip_ or '(nopeak/AutoDeconSoftware.zip)'}")
    print("             unzip it and point PULSEXP_DATA at the Data/ folder inside")
    print()
    # Say what was searched, not only what was concluded. A bare "absent" reads as a fact
    # about the world when it is only a fact about two directories — which is exactly how
    # this session and the mac's both concluded on 2026-08-14 that the data was lost, when
    # all four trees were sitting in no_peak's checkout the whole time.
    print("SEARCHED ONLY these two locations, per dataset:")
    print(f"  repo   {root}/<tree>")
    print(f"  store  {store}/data/<tree>")
    print("These trees are no_peak's; downLow consumes them. A no_peak checkout elsewhere")
    print("on this machine is NOT inspected here — check it before concluding anything is")
    print("lost. 'absent' above means absent from the two paths named, nothing more.")
    print()
    print("not managed here: data/digitized/, data/synthetic/ (both committed)")
    return 0


def _copy_tree(src: Path, dst: Path, force: bool) -> tuple[int, int]:
    """Copy src -> dst. Returns (written, skipped). Refuses to clobber divergence."""
    src_files, dst_files = scan(src), scan(dst)
    if dst_files and not force:
        changed = {k for k in set(src_files) & set(dst_files) if src_files[k] != dst_files[k]}
        lost = set(dst_files) - set(src_files)
        if changed or lost:
            raise SystemExit(
                f"data_root: {dst} has {len(changed)} differing and {len(lost)} extra file(s).\n"
                "  Refusing to overwrite. Inspect with --status, then re-run with --force."
            )
    written = skipped = 0
    for rel, h in src_files.items():
        target = dst / rel
        if dst_files.get(rel) == h:
            skipped += 1
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src / rel, target)
        written += 1
    return written, skipped


def _selected(names: list[str]) -> list[Dataset]:
    """Bare --push/--pull moves only what we own. Anything else must be named.

    A tree we did not author should never travel because someone typed the short
    form of a command. Naming it is the consent.
    """
    if not names:
        held = [d for d in DATASETS if not d.default_synced]
        for d in held:
            print(f"HELD BACK: {d.name} — not moved by a bare --push/--pull.\n"
                  f"  {d.caution}\n"
                  f"  To move it anyway: data_root.py --push {d.name}\n", file=sys.stderr)
        return [d for d in DATASETS if d.default_synced]
    bad = [n for n in names if n not in BY_NAME]
    if bad:
        raise SystemExit(f"data_root: unknown dataset(s) {', '.join(bad)}; "
                         f"known: {', '.join(BY_NAME)}")
    chosen = [BY_NAME[n] for n in names]
    for d in chosen:
        if d.caution:
            print(f"⚠ {d.name} — named explicitly, so proceeding.\n"
                  f"  {d.caution}\n", file=sys.stderr)
    return chosen


def cmd_transfer(direction: str, names: list[str], override: str | None, force: bool) -> int:
    root = repo_root()
    for d in _selected(names):
        repo_tree, store_tree = root / d.repo_rel, store_path(d, override)
        src, dst = (store_tree, repo_tree) if direction == "pull" else (repo_tree, store_tree)
        if not scan(src):
            print(f"{d.name:<12} skip — source empty or absent ({src})")
            continue
        before = len(scan(dst))
        written, skipped = _copy_tree(src, dst, force)
        after = scan(dst)
        if direction == "push":
            write_manifest(dst, after)
        print(f"{d.name:<12} {direction} {written} written, {skipped} already current  "
              f"| {before} -> {len(after)} files, digest {digest(after)}")
    return 0


def cmd_path(name: str, override: str | None) -> int:
    if name == "store":
        print(store_root(override))
    elif name == "pulsexp":
        z = pulsexp_zip(override)
        if z is None:
            print("data_root: AutoDeconSoftware.zip not found in the store's sibling nopeak/",
                  file=sys.stderr)
            return 1
        print(z)
    elif name in BY_NAME:
        print(store_path(BY_NAME[name], override))
    else:
        print(f"data_root: unknown name {name}; known: store, pulsexp, "
              f"{', '.join(BY_NAME)}", file=sys.stderr)
        return 1
    return 0


def selftest() -> int:
    """Prove the parts that can be proven without the real data being present."""
    import tempfile
    bad = 0

    def check(label: str, got, want) -> None:
        nonlocal bad
        ok = got == want
        bad += not ok
        print(f"  {'OK  ' if ok else 'FAIL'} {label}: got {got!r} want {want!r}")

    with tempfile.TemporaryDirectory() as td:
        a, b = Path(td) / "a", Path(td) / "b"
        (a / "sub").mkdir(parents=True)
        (a / "one.csv").write_text("1,2\n", encoding="utf-8")
        (a / "sub" / "two.csv").write_text("3,4\n", encoding="utf-8")

        files = scan(a)
        check("scan finds both files", sorted(files), ["one.csv", "sub/two.csv"])
        check("digest is stable", digest(files), digest(scan(a)))

        w, s = _copy_tree(a, b, force=False)
        check("copy writes both", (w, s), (2, 0))
        check("digests match after copy", digest(scan(b)), digest(files))

        # OS scratch must be invisible to BOTH the digest and the copy. Finder
        # recreates .DS_Store whenever a tree is browsed, on either side, so if it
        # reached the digest a tree would flip to DIVERGED for having been looked at.
        before = digest(scan(a))
        (a / ".DS_Store").write_bytes(b"\x00finder")
        (a / "sub" / "._one.csv").write_bytes(b"\x00resource fork")
        check("noise does not change the digest", digest(scan(a)), before)
        check("noise is not scanned", sorted(scan(a)), ["one.csv", "sub/two.csv"])
        w2, _ = _copy_tree(a, b, force=False)
        check("noise is not copied", (w2, (b / ".DS_Store").exists()), (0, False))

        w, s = _copy_tree(a, b, force=False)
        check("re-copy is a no-op", (w, s), (0, 2))

        write_manifest(b, scan(b))
        check("manifest excluded from scan", MANIFEST in scan(b), False)
        check("manifest reads back", read_manifest(b)["digest"], digest(files))

        (b / "one.csv").write_text("9,9\n", encoding="utf-8")
        check("divergence is detected", _verdict(scan(a), scan(b)).startswith("DIVERGED"), True)
        try:
            _copy_tree(a, b, force=False)
            check("divergence refuses to clobber", "no raise", "SystemExit")
        except SystemExit:
            check("divergence refuses to clobber", "SystemExit", "SystemExit")
        w, _ = _copy_tree(a, b, force=True)
        check("--force overwrites", w, 1)

        # The three states an empty store can be in. These are the point of the manifest:
        # "never pushed" and "lost" print identically from file counts alone, and need
        # opposite responses. Each must be provably distinguishable.
        man = {"files": files, "digest": digest(files)}
        check("empty store, no manifest = never pushed",
              _verdict({}, {}, None), "absent both sides - NEVER PUSHED, not lost")
        check("empty store, manifest present = LOST",
              _verdict({}, {}, man).startswith("STORE EMPTIED"), True)
        check("lost verdict names the count",
              "2 file(s)" in _verdict({}, {}, man), True)
        check("repo has it, store never written",
              _verdict(files, {}, None), "REPO ONLY   -> push (store never written)")
        check("repo has it, store lost it -> recover, not push",
              _verdict(files, {}, man).startswith("STORE EMPTIED"), True)

        # A store that disagrees with its own manifest is damaged; neither push nor pull.
        half = {k: files[k] for k in list(files)[:1]}
        check("store missing a manifested file = DAMAGED",
              _verdict(files, half, man).startswith("STORE DAMAGED"), True)
        check("damaged beats a plain diverged reading",
              "missing" in _verdict(files, half, man), True)

        check("store only", _verdict({}, files, man), "STORE ONLY  -> pull")
        check("in sync, manifested", _verdict(files, files, man), "in sync")
        check("in sync, unmanifested is flagged",
              _verdict(files, files, None), "in sync (store unmanifested)")

    # ⚠ LOCAL ADDITION — not in downLow's canonical copy, so a re-vendor DELETES it.
    # It has already been lost once, on the 27c52d4 re-copy. Re-add it after every
    # re-vendor, or better, get it adopted upstream so it stops being local.
    #
    # These two constants live in two repos, cannot be checked at runtime, and corrupt
    # the store quietly if they drift. Two independently-passing selftests do not prove
    # the copies agree — the only check that bites is each side asserting a value the
    # other also asserts.
    check("manifest name matches downLow's", MANIFEST, ".downlow-manifest.json")
    check("reference is still held back from a bare push",
          BY_NAME["reference"].default_synced, False)

    member = dropbox_member_root()
    print(f"  {'OK  ' if member else 'WARN'} dropbox member root: {member}")
    print(f"\n{'FAILED' if bad else 'PASS'} — {bad} problem(s)")
    return 1 if bad else 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--pull", nargs="*", metavar="NAME")
    ap.add_argument("--push", nargs="*", metavar="NAME")
    ap.add_argument("--path", metavar="NAME")
    ap.add_argument("--store", metavar="DIR", help="override the store root for this call")
    ap.add_argument("--force", action="store_true", help="overwrite a diverged destination")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()

    if a.selftest:
        return selftest()
    if a.path is not None:
        return cmd_path(a.path, a.store)
    if a.pull is not None:
        return cmd_transfer("pull", a.pull, a.store, a.force)
    if a.push is not None:
        return cmd_transfer("push", a.push, a.store, a.force)
    return cmd_status(a.store)


if __name__ == "__main__":
    sys.exit(main())
