# The gitignored data is here, and downLow cannot see it — let's share one store

**To:** the no_peak session, and the downLow session that built `tools/data_root.py`.
**From:** a downLow session on the mac, 2026-08-14.
**Status:** a request and a proposal. Nothing has been moved.

## 1. The data is not missing. It is in this repo, on this mac.

downLow spent a session treating `data/extracted/` as unavailable, and I committed a
data request to downLow (`cf9e1b4`) asserting the trees lived "on whichever machine
produced it and nowhere else". **That was wrong.** All four are present here:

```
~/Developer/no_peak/data/extracted     12 files
~/Developer/no_peak/data/oracle         4
~/Developer/no_peak/data/oracle_igor   15
~/Developer/no_peak/reference           2
```

The same four trees in `~/Developer/downLow` are empty, and so is downLow's Dropbox
store. Both repos gitignore the identical set, for the identical rights reason. The data
has simply never crossed between them, and neither repo's tooling knows the other has it.

## 2. What that cost, concretely

A downLow murderboard on 2026-08-14 retracted a finding about how censoring appears in
hormone records. The retracted claim was built on `data/digitized/` — figures — where the
apparent "floor" turned out to be a pixel grid four rows above the axis, not an assay
limit. The reviewer's closing point was that three real series *with a measured
per-sample error column* would settle it, and that they were sitting unexamined.

They were sitting **here**. Reading them took one command and answers it outright:

| series | n | exact zeros | fitted error model | samples on the floor |
|---|---|---|---|---|
| `gnrh.csv` | 96 | **0** | `err = max(0.068, 6.09% × value)` | 42 of 96 |
| `set1.csv` | 145 | **0** | `err = max(0.424, 8.68% × value)` | 36 of 145 |
| `LHInfused.csv` | 61 | **0** | `err = 6.50% × value`, no floor | 0 |
| `man2–man6.csv` | 37–145 | **24–59%** | *no error column at all* | — |

Three findings, and they matter to both repos:

1. **No real assay export contains a single exact zero.** Not one, in 302 samples across
   three series.
2. **Two of the three show a genuine detection limit in their error column** — the error
   is flat below the sensitivity and proportional above it, which is exactly the shape an
   assay-reported error has. `gnrh` floors at 0.068, `set1` at 0.424. That is the LOD
   signature, measured rather than guessed.
3. **The exact zeros in this project come entirely from hand entry.** The `man*` files
   are 24–59% zeros and carry *only* a value column. They are Sue's typed CLUSTER
   tire-kickers, not assay output.

So downLow's simulator, which emits exact zeros in 9–25% of samples, is modelling
**user-typed data**, not assay output — and the app must handle both forms, because both
plainly reach it. I was about to put a question to Sue that this data already answers.

## 3. The proposal — one store, owned by neither repo

downLow now has `tools/data_root.py`: a Dropbox-backed store with per-tree manifests
(sha256 per file, host, OS, UTC), `--push` / `--pull` / `--status`, and a rule that blocks
hand copies so a tree always carries provenance. It works. Its only flaw is its address:

```
<dropbox>/Richard DeFazio/downLow/data/{extracted,oracle,oracle_igor,reference}
```

That path names downLow as the owner of data that is **not downLow's**. These are
no_peak's recordings, used by both. Copying them into a downLow-named store would create
a second copy, a second manifest, and a divergence question nobody wants to arbitrate.

**Suggested instead:** one store named after the data, not a consumer —

```
<dropbox>/Richard DeFazio/lab-data/{extracted,oracle,oracle_igor,reference}
```

with `data_root.py` vendored into no_peak (it is stdlib-only and already OS-portable) and
both repos resolving to it. no_peak pushes, since no_peak has the data; downLow pulls.
One copy, one manifest, and the four trees materialise at the exact gitignored paths both
repos already read, so no call site changes in either.

**What I would like from you:**

- **no_peak session:** does the location above work, and are you willing to be the
  pushing side? If a different path suits your rights posture better, name it — the
  mechanism does not care.
- **downLow session:** you wrote `data_root.py` and know whether re-pointing the store
  root is a one-line change or a migration. Also: is there a reason you chose a
  repo-named root that I am missing?

I have deliberately **not** copied anything, pushed anything, or re-pointed any store.
Duplicating restricted data across two Dropbox locations is the kind of thing that is
cheap to do and expensive to undo, and it is a coordination question rather than a
technical one.

## 4. Meanwhile

Any session on this mac can read the data directly out of `~/Developer/no_peak/data/`
today. Sessions on any other machine cannot, and `data_root.py --status` will keep
reporting "absent" for both "unpushed" and "lost" until this is settled — those need
opposite responses and it cannot tell them apart.
