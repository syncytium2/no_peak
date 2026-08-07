// Port of ts_error() from ClusterMasterV4-1.ipf:1146.
// Builds the per-point error array used by the pooled t-test.

import type { ErrorModelType } from "./types";
import { sampleSD, sem } from "./stats";

export function buildErrorArray(
  w: number[],
  errorModel: ErrorModelType,
  errorValue: number,
  nPeak: number,
  nNadir: number,
  userError?: number[],
): number[] {
  const n = w.length;
  const err = new Array<number>(n).fill(0);

  switch (errorModel) {
    case "SQRT":
      for (let i = 0; i < n; i++) err[i] = w[i] > 0 ? Math.sqrt(w[i]) : errorValue;
      return err;

    case "Fixed":
      err.fill(errorValue);
      return err;

    case "Global SD":
      err.fill(sampleSD(w));
      return err;

    case "Global SE":
      err.fill(sem(w));
      return err;

    case "Local SD":
    case "Local SE": {
      // Igor: wavestats/R=[i - nNadir, i + nPeak] — inclusive range,
      // computed for i in [nNadir, n - nPeak), edges copied outward.
      const fn = errorModel === "Local SD" ? sampleSD : sem;
      for (let i = nNadir; i < n - nPeak; i++) {
        err[i] = fn(w, i - nNadir, i + nPeak + 1);
      }
      for (let i = 0; i < nNadir; i++) err[i] = err[nNadir];
      for (let i = n - nPeak; i < n; i++) err[i] = err[n - nPeak - 1];
      return err;
    }

    case "Error Wave": {
      if (!userError || userError.length !== n) {
        throw new Error(
          `Error Wave selected but the error column has ${userError?.length ?? 0} points (data has ${n}).`,
        );
      }
      return userError.slice();
    }
  }
}
