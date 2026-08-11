// Port of ts_error() from ClusterMasterV4-1.ipf:1146.
// Builds the per-point error array used by the pooled t-test.

import type { ErrorModelType } from "./types";
import { sampleSD, sem } from "./stats";

/**
 * Keep the selected error model consistent with the loaded file: a file with
 * an error column switches to "Error Wave"; a file without one cannot stay on
 * "Error Wave" and falls back to the default.
 */
export function resolveErrorModel(
  current: ErrorModelType,
  hasErrorColumn: boolean,
  fallback: ErrorModelType = "Local SD",
): ErrorModelType {
  if (hasErrorColumn) return "Error Wave";
  return current === "Error Wave" ? fallback : current;
}

export interface AssayError {
  cv: number;
  floor: number;
}

export function buildErrorArray(
  w: number[],
  errorModel: ErrorModelType,
  errorValue: number,
  nPeak: number,
  nNadir: number,
  userError?: number[],
  assay: AssayError = { cv: 0.08, floor: 0 },
): number[] {
  const n = w.length;
  const err = new Array<number>(n).fill(0);

  switch (errorModel) {
    // An assay's own precision, when the file does not carry it: a proportional
    // term plus a floor at the detection limit. Unlike the estimated models
    // this does not read the data's spread, so a pulse cannot inflate its own
    // error and hide itself — which is what happens to a one-point Local SD.
    case "Assay CV":
      for (let i = 0; i < n; i++) err[i] = Math.max(assay.floor, assay.cv * w[i]);
      return err;

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
