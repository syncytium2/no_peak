# Suppressing the digitized records, reversibly

**Status: the switch is built and NOT thrown.** `data/digitized/` is committed,
the eight records ship, the site is unchanged. Nothing in this file has been
done to the repository. It exists so that doing it is one commit rather than a
day's work, and so that the decision can be made on its merits rather than on
what it costs to execute.

**Why there is a switch at all:** on 2026-08-19 University counsel answered that
a derived table of measured values *is* "any part of the Publications" under the
subscription license, and the eight series were read off the licensed PDF. The
full record, including what that does and does not reach, is in
[`figure-data-permissions.md`](figure-data-permissions.md) → "Counsel answered,
and it goes the other way". **The decision to throw this switch is the owner's
and has not been made.**

## What the switch is

Three changes, all landed 2026-08-19, all no-ops while the tree is present:

- **[`src/samples.ts`](../src/samples.ts)** loads the CSVs through
  `import.meta.glob` instead of eight static `?raw` imports. A static import of
  a deleted file is a build error; a glob just yields no key, and the records
  are dropped from `SAMPLES` by the `flatMap` at the bottom of the file. The
  group headings derive from `SAMPLES`, so they disappear with it.
- **[`src/testing/haveDigitized.ts`](../src/testing/haveDigitized.ts)** exports
  `HAVE_DIGITIZED`, one `existsSync` check, in one place. Five test files import
  it: they skip loudly when the tree is gone, the same idiom
  [`src/core/oracle.test.ts`](../src/core/oracle.test.ts) already uses for the
  undistributed lab data.
- **[`tools/score_webster1991.ts`](../tools/score_webster1991.ts)** exits with a
  message naming this file instead of an unreadable stack.

⚠ **The glob excludes `webster1991_pulses.csv` deliberately.** A bare `*.csv`
matches it, and an eager glob bundles what it matches whether anything reads it
or not — the first version of this shipped the authors' pulse calls into the
served bundle, 2.4 kB that the eight static imports had never included. That
file is the answer key; it is read from disk by the tests and by
`score_webster1991.ts`, and the app never displays it. **Do not widen the
pattern.**

## To throw it

```sh
git rm -r --cached data/digitized          # leaves the files on disk
printf 'data/digitized/\n' >> .gitignore
npm run build && npx vitest run            # expect: builds clean, tests skip
```

Then commit, and redeploy so the served bundle stops carrying the values. The
files stay in your working tree; nothing is destroyed locally.

Optionally add `Dataset("digitized", "data/digitized", ...)` to
[`tools/data_root.py`](../tools/data_root.py) so the tree syncs to the private
store and survives a fresh checkout. ⚠ That file is **vendored from downLow and
canonical there** — edit it upstream and re-vendor, per
`docs/data-store-coordination_2026-08-14.md`, rather than diverging our copy.

## To reverse it

```sh
git revert <the suppression commit>
python3 tools/data_root.py --pull digitized   # only if the tree was moved to the store
npm run build && npx vitest run               # expect: 218 tests, none skipped
```

Redeploy. That is the whole reversal: the mechanism above is symmetric, and the
data was never destroyed.

## What it removes, measured

Verified 2026-08-19 by building both ways in a throwaway worktree.

| | data present | data absent |
|---|---|---|
| `tsc -b` | clean | clean |
| `vitest run` | 218 pass | passes, 19 skipped |
| `vite build` | succeeds | succeeds |
| `index-*.js` | 292,826 B | 271,778 B |
| CSV payloads in bundle | 8 | **0** |
| probe value `1.184` | present | **absent** |

**~21 kB of measured values leave the bundle. That is the ~530 numbers.**

## What it does NOT remove, and why that is the intended line

- **Git history.** The CSVs have been in a public repository for weeks;
  `git rm` changes the tip, not the history, and GitHub serves old blobs.
  Removing them for real means `filter-repo` and a force push, which is the
  irreversible direction, breaks the shared working tree and downLow's
  vendoring, dangles every sha this repo's docs cite, and still would not reach
  forks or archives. **Suppression stops the ongoing display. It does not
  erase, and nothing about the situation asks for erasure.**
- **The dataset metadata.** Labels, notes and citation strings for the eight
  records stay in the bundle as dead strings — `PMID 1874193` goes from 16
  occurrences to 8. They no longer render, because the records are not in
  `SAMPLES`.
- **Prose that cites the paper**, in `/methods`, the About page, the README and
  these docs, including the pulse counts the paper itself published.

The last two are the same line drawn twice: **this suppresses the dataset, not
the citation.** A tool that stops shipping someone's numbers while still saying
where the idea came from is the ordinary scholarly posture, and stripping the
references would be a documentation decision of a different kind — one nobody
has asked for.

## Deliberately out of scope: the CLUSTER settings

The `webster1991_gnrh` and `webster1991_lh` presets in
[`src/core/presets.ts`](../src/core/presets.ts) are the parameter settings the
paper states in its Methods. They are arguably reachable by the same reading
counsel gave, and they are **not** touched by this switch. **Owner's
instruction, 2026-08-19, asked and answered: do not include them.** Recorded
here so that a later reader does not tidily "finish the job" and quietly
suppress something the owner decided to keep.
