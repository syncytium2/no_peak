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
- `npm test` — the app and core suites. **Note what does _not_ run:**
  `src/core/oracle.test.ts` and `src/core/igor-oracle.test.ts` compare against
  `data/oracle/` and `data/oracle_igor/`, which are **gitignored** (they hold
  Fortran/Igor output computed from real lab data). On a fresh clone both
  suites **skip**. A green `npm test` therefore does *not* mean the oracle
  comparisons ran — check the skip count.

## What needs them

| Thing | Needs |
|---|---|
| `tools/fortran/build_and_run.sh` | `reference/fortran/CLUST5.MPF` |
| Regenerating `data/oracle/` | the same |
| `tools/igor/no_peak_validate.ipf` | a working Igor install with the Cluster package loaded |

`build_and_run.sh` fails with an explanatory message. **`no_peak_validate.ipf`
does not** — it calls `ClusterMain` unconditionally, so without the Igor Cluster
package loaded Igor fails at compile time with a generic "unknown function"
error. It does guard the output folder and missing waves.

## The oracle output is not distributed either

`data/oracle/` (`.lst` listings and `.stdout.txt` peak tables) and
`data/oracle_igor/` are **gitignored and have never been committed**. They are
printouts produced by running the Fortran and Igor on real lab data — results
rather than source, and containing no algorithm code, but derived from data that
is itself not ours to publish. They stay local; the tests that consume them skip
without them.

## Permission for the port — 2026-08-10

**Michael L. Johnson has approved use of his Fortran code for this port.**
Reported by R.A. DeFazio, 2026-08-10.

What that settles: the port itself. This project reads `CLUST5.MPF`,
reimplements its algorithm in TypeScript, and ships that — with the author's
approval, not merely on the argument that algorithms are uncopyrightable.

**Decided 2026-08-10: we are not publishing Johnson's source.** The approval
covers the port, not redistribution, and the licence below forbids passing the
code to third parties. `reference/fortran/` stays gitignored and out of history.
(Fragments of the Fortran do circulate online; that changes nothing about what
this project chooses to publish.)

**The Igor Cluster package is withheld by choice, not by licence.** It is the
Moenter lab's own work — the lab is free to publish it — and the decision is
simply *not at this time*, because this app is intended to succeed it. That is
a different reason from the Fortran's, and the two should not be conflated: the
About page states them separately.

## The license, found 2026-08-10

Johnson's `HYPERGEO.PDF` (inside `hypergeo.zip`, kept at
`Dropbox-UniversityofMichigan/Richard DeFazio/nopeak/hypergeo.zip`) carries an
explicit licence for the **"Hormone Pulse Analysis programs"** family, which is
the umbrella covering Pulse_XP, AutoDecon, Cluster8 and HyperGeo:

> Licensor: Michael L. Johnson … Software is furnished to the Licensee free, or
> for a nominal charge, and may only be copied, in whole or in part, for use by
> the Licensee and his/her employees. … **Licensee shall not provide or
> otherwise make available the software or any part or copies thereof in any
> form to any third party**, except as may be permitted in writing by the
> Licensor. … The Licensee further agrees that this software will not be used
> for profit by anyone.

So redistribution of **Johnson's programs** is prohibited in writing, not merely
unclear, and the history purge was warranted. Local use is explicitly allowed,
so running them for validation is fine.

⚠ **Two limits on that conclusion.** The licence names the "Hormone Pulse
Analysis programs" and the distribution lists Pulse_XP, AutoDecon, Cluster8 and
HyperGeo; the code actually ported here is `CLUST5.MPF` **v6.01**, which is the
same lineage but not named. And the **Igor Cluster package is a different
group's work** (Vanacker/Moenter/DeFazio, doi 10.1210/en.2017-00382), not
Johnson's distribution — its terms are not stated anywhere here. Keeping both
out of the repository is the conservative reading; confirm the scope with the
owners before making this repository public.

Note the distinction that makes this port legitimate: the **algorithm** is
published (Veldhuis & Johnson 1986) and algorithms are not copyrightable. A
reimplementation written from the paper and from reading the reference code is
ours to license as we choose; the reference *source* is not ours to ship.

## Provenance, for the record

Source material came from `gitlab.com/um-mip/coding-project` (local working
copy: `~/Documents/coding-project`). The About page credits Veldhuis and
Johnson for the algorithm and cites Vanacker et al. 2017 for the Igor
implementation; describing and citing the work is fine, redistributing the
source is not.
