// Port of the CLUSTER detection passes from ClusterMasterV4-1.ipf:
// UPorDN (:821) and pulseTest (:939), which themselves port UPS/DNS and the
// pass-four pulse assembly of CLUST5.MPF / do_cluster.mpf (M. L. Johnson).
//
// Quirks of the Igor implementation are preserved deliberately — it is the
// validation oracle. Notable ones:
//  - loop 1200 marks nPeak-1 points per up-flag (the Fortran marked NPEAK);
//  - the backward zap pass runs from n-2 down to 3;
//  - an initial down-run forces a pulse that began before recording started.

import { mScore } from "./mscore";
import { mean } from "./stats";
import { buildErrorArray } from "./errorModel";
import { extractPeaks, extractValleys, summarize } from "./peaks";
import type { ClusterParams, ClusterResult } from "./types";

export interface UpDnResult {
  flags: number[];
  tTrace: number[];
}

/** Port of UPorDN: zSign > 0 scans for increases (ups), < 0 for decreases (downs). */
export function upOrDn(
  w: number[],
  err: number[],
  nPeak: number,
  nNadir: number,
  minT: number,
  zSign: 1 | -1,
  dvmp: number,
  fortranVariance = false,
): UpDnResult {
  const n = w.length;
  const flags = new Array<number>(n).fill(0);
  const tTrace = new Array<number>(n).fill(0);

  const iLast = n - nPeak + 1;
  for (let i = nNadir; i < iLast; i++) {
    const bMean = mean(w, i - nNadir, i);
    const tMean = mean(w, i, i + nPeak);
    const t = mScore(i, nNadir, nPeak, w, err, fortranVariance);
    tTrace[i] = t;

    if (zSign > 0) {
      if (t > minT && tMean > dvmp && tMean > bMean && Number.isFinite(t)) {
        flags[i] = 1;
      }
    } else {
      if (-t > minT && bMean > dvmp && bMean > tMean && Number.isFinite(t)) {
        flags[i] = -1;
      }
    }
  }
  return { flags, tTrace };
}

/** Port of pulseTest: combine up/down flags into the 0/1 pulse array. */
export function pulseTest(
  w: number[],
  ups: number[],
  downs: number[],
  nPeak: number,
  nNadir: number,
  zeroTerminate = false,
  zero = 0,
): number[] {
  const n = w.length;
  const pulse = new Array<number>(n).fill(0);

  // Loop 1100/1102: find the first flagged change. If it is a down, a pulse
  // was already in progress when recording started.
  let j = 0;
  let downIndex = 0;
  for (let i = 0; i < n; i++) {
    if (ups[i] === 1) j = 1;
    if (downs[i] === -1) {
      j = -1;
      downIndex = i;
    }
    if (j !== 0) break;
  }

  let index = 0;
  if (j === -1) {
    for (let k = 0; k < downIndex; k++) pulse[k] = 1;
    index = downIndex;
    do {
      pulse[index] = 1;
      index += 1;
    } while (index < n && downs[index] === -1);
    if (index < n) pulse[index] = 0; // terminate the first pulse
    index += 1;
    downIndex = index;
  }

  // Loop 1200: each up-flag opens a pulse nPeak-1 points long.
  for (; index < n; index++) {
    if (ups[index] === 1) {
      for (let k = 0; k < nPeak - 1; k++) {
        if (index + k < n) pulse[index + k] = 1;
      }
    }
  }

  // Loop 1300: carry the pulse state forward until a down-flag interrupts it.
  for (let i = downIndex + 1; i < n; i++) {
    if (pulse[i] !== 1 && downs[i] !== -1) pulse[i] = pulse[i - 1];
  }

  // Backward zap (Fortran 1301/1310): walking backward, extend each pulse's
  // tail back through trailing down-flags, and once inside a pulse skip
  // nNadir points past its start before resuming.
  let icur = n - 2;
  let izap = 1;
  while (icur > 2) {
    if (pulse[icur] === 1) izap = 0;
    if (izap === 1) {
      pulse[icur] = pulse[icur + 1];
      if (downs[icur] === -1) pulse[icur] = 1;
    } else if (pulse[icur] === 1 && pulse[icur - 1] === 0) {
      izap = 1;
      icur -= nNadir;
    }
    icur -= 1;
  }

  // Igor 20170110 heuristic: a pulse cannot extend through no-activity bins.
  if (zeroTerminate) {
    for (let i = 0; i < n; i++) {
      if (w[i] <= zero && pulse[i] === 1) pulse[i] = 0;
    }
  }

  return pulse;
}

/** Port of ClusterMain: full run from data + params to pulse array and tables. */
export function clusterMain(
  times: number[],
  values: number[],
  params: ClusterParams,
  userError?: number[],
): ClusterResult {
  const n = values.length;
  if (times.length !== n) {
    throw new Error(`times (${times.length}) and values (${n}) differ in length.`);
  }
  if (n < 3) throw new Error("Need at least 3 data points.");
  const { nPeak, nNadir } = params;
  if (!Number.isInteger(nPeak) || !Number.isInteger(nNadir) || nPeak < 1 || nNadir < 1) {
    throw new Error("nPeak and nNadir must be positive integers.");
  }
  // Fortran: "NOT ENOUGH DATA POINTS FOR PASS 2/3"
  if (nPeak + nNadir > n) {
    throw new Error(`nPeak + nNadir (${nPeak + nNadir}) exceeds the number of points (${n}).`);
  }

  const error = buildErrorArray(
    values,
    params.errorModel,
    params.errorValue,
    nPeak,
    nNadir,
    userError,
  );

  const up = upOrDn(values, error, nPeak, nNadir, params.tScoreUp, 1, params.minPeak, params.fortranVariance);
  const dn = upOrDn(values, error, nPeak, nNadir, params.tScoreDn, -1, params.minPeak, params.fortranVariance);

  const pulse = pulseTest(
    values,
    up.flags,
    dn.flags,
    nPeak,
    nNadir,
    params.zeroTerminate,
    params.zero,
  );

  const deltaT = times[1] - times[0];
  const peaks = extractPeaks(pulse, values, deltaT, nNadir);
  const valleys = extractValleys(pulse, values, deltaT);
  const summary = summarize(values, deltaT, peaks, valleys);

  return {
    params,
    times,
    values,
    error,
    ups: up.flags,
    downs: dn.flags,
    mscoreUp: up.tTrace,
    mscoreDn: dn.tTrace,
    pulse,
    peaks,
    valleys,
    summary,
  };
}
