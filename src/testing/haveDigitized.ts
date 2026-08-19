// Whether the digitized traces are present in this checkout.
//
// `data/digitized/` is committed today, so this is true everywhere and every
// test that reads it runs exactly as before. It exists so that suppressing
// those records is one commit rather than a day spent hunting every test that
// reads them from disk — see `docs/digitized-suppression.md` for what that
// decision is and how to throw or reverse it.
//
// Tests that need the traces skip loudly when they are gone, the same way the
// CLUST5 oracle in `src/core/oracle.test.ts` skips on the lab data this project
// does not distribute. The alternative — tests that quietly pass on an empty
// set — is the failure this project has already had once elsewhere.
//
// Test-only. Nothing that ships imports this, so it never reaches the bundle;
// `src/samples.ts` decides the same question from the glob it loads, because a
// browser has no filesystem to ask.
import { existsSync } from "node:fs";

const DIR = "data/digitized";

export const HAVE_DIGITIZED =
  existsSync(`${DIR}/webster1991_pulses.csv`) &&
  existsSync(`${DIR}/webster1991_fig3b_thx_8067_gnrh.csv`);

/** One reason string, so the skip reads the same wherever it appears. */
export const NEEDS_DIGITIZED =
  "needs data/digitized/ — see docs/digitized-suppression.md";
