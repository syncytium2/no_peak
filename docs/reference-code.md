# Reference implementations are not in this repository

The two implementations this port was written from — the original Fortran
(`CLUST5.MPF`, `do_cluster.mpf`, Michael L. Johnson) and the Igor Pro Cluster
package (`ClusterMasterV4-1.ipf` and friends) — are **third-party code we do not
have redistribution rights for**. They are not committed here, and must not be.

`reference/` is in `.gitignore`. If you have the files, put them there and
everything below works; without them, the port, the app, and the unit tests are
unaffected.

## What still works without them

- The app and the whole TypeScript core. Nothing at runtime reads `reference/`.
- `npm test` — including `src/core/oracle.test.ts`, which compares against the
  Fortran's **output** in `data/oracle/`, not its source.

## What needs them

| Thing | Needs |
|---|---|
| `tools/fortran/build_and_run.sh` | `reference/fortran/CLUST5.MPF` |
| Regenerating `data/oracle/` | the same |
| `tools/igor/no_peak_validate.ipf` | a working Igor install with the Cluster package loaded |

Both fail with an explanatory message rather than a confusing error.

## Is the committed oracle output also restricted?

`data/oracle/*.lst` are printouts produced by running the Fortran on a dataset —
results, not source. They contain no algorithm code. That is a different
category from the program itself, but it is a judgement call rather than a
settled one, and worth confirming with whoever owns the code before this
repository is made public.

## Provenance, for the record

Source material came from `gitlab.com/um-mip/coding-project` (local working
copy: `~/Documents/coding-project`). The About page credits Veldhuis and
Johnson for the algorithm and cites Vanacker et al. 2017 for the Igor
implementation; describing and citing the work is fine, redistributing the
source is not.
