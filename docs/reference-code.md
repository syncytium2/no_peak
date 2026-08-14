# Reference implementations are not in this repository

The two implementations this port was written from — the original Fortran
(`CLUST5.MPF`, `do_cluster.mpf`, Michael L. Johnson) and the Igor Pro Cluster
package (`ClusterMasterV4-1.ipf` and friends) — are **third-party code we do not
have redistribution rights for**. They are not committed here, and must not be.

`reference/` is in `.gitignore`. If you have the files, put them there and
everything below works; without them, the port, the app, and the unit tests are
unaffected.

> **They are no longer only on local disk — 2026-08-14.** `reference/` now also
> lives in the private Dropbox store at `<member>/nopeak/data/reference`, and
> `python3 tools/data_root.py --pull reference` materializes it at the path
> above on any of the owner's machines. **Nothing about the redistribution
> position below has changed.** The store is reachable by the owner alone, and
> that is the entire basis on which this tree is allowed in it — see
> "The store is not a distribution" below.

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
is itself not ours to publish. They stay out of the repo; the tests that consume
them skip without them. Both are in the private store and arrive with
`tools/data_root.py --pull`.

## `reference/` in the store — cleared by the owner, 2026-08-14

`reference/` is synced to `<member>/nopeak/data/reference`. **The owner cleared
it, asked directly on 2026-08-14:** he works alone, and for this purpose a
private member folder is equivalent to local disk.

The reasoning he cleared: the license bars the licensee from providing or
otherwise making the software **available to others**. A private folder synced
between machines the licensee alone controls is not "others" — it is the same
licensee, on his second computer. Copying a licensed file from a desktop to a
laptop has never been distribution, and Dropbox is doing that with extra steps.

Three limits, and none of them are a session's to relax:

- **`reference` is `default_synced=False`** in `tools/data_root.py`. A bare
  `--push`/`--pull` skips it and prints the caution. **Naming it explicitly is
  the consent, every time.** The owner's choice, and the point is the friction.
- **The clearance does not carry.** It was given about a folder nobody else can
  see. **If that member folder is ever shared, or the store re-pointed anywhere
  less private, `reference/` comes out FIRST and the question goes back to
  him.** Removing it afterwards does not undo a distribution.
- ⚠ **`reference/` is not the only thing riding on that folder's privacy**, and
  this document is the wrong place to look for the others. The permissions
  correspondence in `<member>/darkroom/no_peak/` — third-party email quoting
  named people at Michigan and at a publisher — sits on the same basis and is
  two directories from the store, so a reader applying this section's rule would
  never think of it. See `docs/figure-data-permissions.md`, and treat this list
  as incomplete: it was assembled from what sessions happened to notice.
- **This is a U-M enterprise team Dropbox** — private by default, but
  team-administered, which is not the same as local disk. He weighed that. Do
  not reconstruct the conclusion from "it's private" alone.

> ### ⚠ How this was first recorded, and why that is written down
>
> Before he was asked, a session asserted this same conclusion as an "owner
> determination" and pushed `reference/` on that basis. Put to him afterwards,
> his answer was: *"that folder decision has never happened in any other
> context. i work alone."* He then cleared the files to stay.
>
> **The conclusion was right and it was still worthless**, because a licence
> resting on an approval nobody gave is worth nothing — this one landed, and the
> next guess may not. Kept here, in the rights document rather than only in a
> coordination doc, because this is where someone comes when they want to know
> whether they may move this tree. The answer is yes, and the reason it is a
> real answer is that somebody asked. Full account:
> `docs/data-store-coordination_2026-08-14.md` §5.3 and §7.

The other three trees (`data/extracted/`, `data/oracle/`, `data/oracle_igor/`)
are **ours**. They are gitignored because they are unpublished lab recordings
and things derived from them, which is a decision we can revisit whenever we
like — not a license we are bound by. Do not reason about all four as one
group; they sit in one directory and they do not share a posture.

## Permission for the port — 2026-08-10

**Michael L. Johnson has approved use of his Fortran code for this port.**
Reported by R.A. DeFazio, 2026-08-10.

What that settles: the port itself. This project reads `CLUST5.MPF`,
reimplements its algorithm in TypeScript, and ships that — with the author's
approval, not merely on the argument that algorithms are uncopyrightable.

**Decided 2026-08-10: we are not publishing Johnson's source.** The approval
covers the port, not redistribution, and the license below forbids passing the
code to third parties. `reference/fortran/` stays gitignored and out of history.
(Fragments of the Fortran do circulate online; that changes nothing about what
this project chooses to publish.)

**The Igor Cluster package is withheld by choice, not by license.** It is the
Moenter lab's own work — the lab is free to publish it — and the decision is
simply *not at this time*, because this app is intended to succeed it. That is
a different reason from the Fortran's, and the two should not be conflated: the
About page states them separately.

## The license, found 2026-08-10

Johnson's `HYPERGEO.PDF` (inside the `hypergeo.zip` distribution, held
privately — not in this repository) carries an
explicit license for the **"Hormone Pulse Analysis programs"** family, which is
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

⚠ **Two limits on that conclusion.** The license names the "Hormone Pulse
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

## Closed negative: the "nine variance models" are not in the distribution

Veldhuis & Johnson's 1994 companion paper (*Neurosci Biobehav Rev* 18(4):605–612)
captions its Fig. 1 with CLUSTER's pooled *t* applied to replicates "or
preferably to the dose-dependent intrasample SD's calculated by **one of nine
variance models**". Neither that paper nor the *Methods Enzymol* chapter
enumerates the nine. If they were listed anywhere, they would pin what this
port's seven error models are approximations *of*, so it was worth chasing.

**They are not in the Pulse_XP distribution.** Checked 2026-08-12 against
`AutoDeconSoftware.zip` (Dropbox, not committed — see the folder note in
`docs/`), reading `Docs/Pulse_XP_Cluster_0808.pdf`,
`Docs/Pulse_XP_FileFormat_0808.pdf`, `Docs/Hormone_FileFormat_0901.pdf`,
`Docs/Pulse_XP_Intro_0808.pdf` and `Docs/Cluster8_QuickStart_0908.pdf`:

- The Cluster manual says only that the algorithm works "in relation to
  dose-dependent variance models" — plural, unenumerated.
- The Variance Model sections describe exactly **one** parametric form: the
  `PUL_NATV` input filter's model in minimal detectable concentration and assay
  CV, where MDC is defined as twice the SD of a large number of replicates at
  zero hormone concentration.

So the nine, if they matter, come from the 1986 CLUSTER primary or earlier —
not from this distribution. Recorded so nobody spends another hour on it.

## Provenance, for the record

Source material came from `gitlab.com/um-mip/coding-project` (local working
copy: `~/Documents/coding-project`). The About page credits Veldhuis and
Johnson for the algorithm and cites Vanacker et al. 2017 for the Igor
implementation; describing and citing the work is fine, redistributing the
source is not.
