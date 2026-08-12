// Peak/valley extraction and summary statistics, translated from the
// reporting passes of CLUST5.MPF (labels 4000-7004) / do_cluster.mpf.
//
// Index convention: Fortran is 1-based; here everything is 0-based. Fortran's
// ILAST — the first non-pulse point after a peak — maps to `iLast`, and the
// Fortran stat loops DO I=IFIRST,ILAST run inclusive of that boundary point;
// that inclusive behavior is preserved (it is part of the published output).
// NDF is 1 for every point, so the Fortran (NDF+1)-weighted means reduce to
// plain means.

import { mean, meanSD } from "./stats.ts";
import type { ClusterSummary, Peak, Valley } from "./types.ts";

export function extractPeaks(
  pulse: number[],
  w: number[],
  deltaT: number,
  nNadir: number,
  includeTruncated = false,
): Peak[] {
  const n = pulse.length;
  const peaks: Peak[] = [];

  // Fortran: first candidate start is index NNADIR+1 (1-based) = nNadir (0-based);
  // scanning stops when the window no longer leaves room for a trailing nadir.
  // includeTruncated relaxes only the trailing bound: a pulse whose onset was
  // detected but whose termination is censored by the end of the record is
  // still reported, with the after-nadir statistics left null. A pulse already
  // in progress at the start has no detected onset and is never reported.
  const scanEnd = includeTruncated ? n : n - nNadir - 1;
  let iFirst = nNadir;
  while (iFirst < scanEnd) {
    if (!(pulse[iFirst] === 1 && pulse[iFirst - 1] !== 1)) {
      iFirst += 1;
      continue;
    }
    // find iLast: first non-pulse point after the run
    let iLast = iFirst + 1;
    while (iLast < scanEnd && pulse[iLast] === 1) iLast += 1;
    if (!includeTruncated && pulse[iLast] === 1) break; // ran out of room before the run ended
    if (iLast >= n) iLast = n - 1; // run reaches the final point: cap in-bounds

    // largest value over [iFirst, iLast] inclusive (Fortran DO 4350)
    let peakValue = -Infinity;
    let iMax = iFirst;
    for (let i = iFirst; i <= iLast; i++) {
      if (w[i] > peakValue) {
        peakValue = w[i];
        iMax = i;
      }
    }

    const width = (iLast - iFirst) * deltaT;

    // preceding and following nadir means (Fortran DO 4360 / DO 4380)
    const before = mean(w, iFirst - nNadir, iFirst);
    const after =
      iLast + nNadir <= n && pulse[iLast] !== 1 ? mean(w, iLast, iLast + nNadir) : null;

    const peakMean = mean(w, iFirst, iLast + 1);

    peaks.push({
      iMax,
      iFirst,
      iLast,
      width,
      peakValue,
      nadirBefore: before,
      nadirAfter: after,
      largestPct: before !== 0 ? (peakValue / before) * 100 : null,
      meanPct: after !== null ? (peakMean / ((after + before) / 2)) * 100 : null,
      area: after !== null ? width * (peakMean - Math.min(before, after)) : null,
      amplitude: peakValue - before,
    });

    iFirst = iLast;
  }
  return peaks;
}

export function extractValleys(pulse: number[], w: number[], deltaT: number): Valley[] {
  const n = pulse.length;
  const valleys: Valley[] = [];

  // Fortran 6500: a valley starts where the pulse turns off and ends where it
  // resumes — leading/trailing baseline segments are not valleys.
  let iFirst = 1;
  while (iFirst < n) {
    if (!(pulse[iFirst] !== 1 && pulse[iFirst - 1] === 1)) {
      iFirst += 1;
      continue;
    }
    let iLast = iFirst + 1;
    while (iLast < n && !(pulse[iLast] === 1 && pulse[iLast - 1] !== 1)) iLast += 1;
    if (iLast >= n) break; // no resuming pulse: not a valley

    // min and mean over [iFirst, iLast] inclusive (Fortran DO 6620)
    let nadir = Infinity;
    let iMin = iFirst;
    let sum = 0;
    for (let i = iFirst; i <= iLast; i++) {
      sum += w[i];
      if (w[i] < nadir) {
        nadir = w[i];
        iMin = i;
      }
    }

    valleys.push({
      iMin,
      iFirst,
      iLast,
      width: (iLast - iFirst) * deltaT,
      nadir,
      mean: sum / (iLast - iFirst + 1),
    });

    iFirst = iLast;
  }
  return valleys;
}

export function summarize(
  w: number[],
  deltaT: number,
  peaks: Peak[],
  valleys: Valley[],
): ClusterSummary {
  const n = w.length;
  let sum = 0;
  for (const v of w) sum += v;

  // interpeak intervals from successive iMax positions (Fortran 5100)
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push((peaks[i].iMax - peaks[i - 1].iMax) * deltaT);
  }

  const notNull = (a: (number | null)[]) => a.filter((v): v is number => v !== null);

  return {
    nPeaks: peaks.length,
    nValleys: valleys.length,
    meanValue: sum / n,
    // trapezoidal area (Fortran: sum minus half the endpoints, times deltat)
    totalArea: (sum - w[0] / 2 - w[n - 1] / 2) * deltaT,
    recordDuration: (n - 1) * deltaT,
    interPeakInterval: meanSD(intervals),
    peakWidth: meanSD(peaks.map((p) => p.width)),
    peakValue: meanSD(peaks.map((p) => p.peakValue)),
    peakAmplitude: meanSD(notNull(peaks.map((p) => p.amplitude))),
    peakLargestPct: meanSD(notNull(peaks.map((p) => p.largestPct))),
    peakMeanPct: meanSD(notNull(peaks.map((p) => p.meanPct))),
    peakArea: meanSD(notNull(peaks.map((p) => p.area))),
    valleyWidth: meanSD(valleys.map((v) => v.width)),
    valleyMeanLevel: meanSD(valleys.map((v) => v.mean)),
    valleyNadir: meanSD(valleys.map((v) => v.nadir)),
  };
}
