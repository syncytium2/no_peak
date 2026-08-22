// Types for the CLUSTER pulse-detection port.
// Provenance: ClusterMasterV4-1.ipf (Igor Pro, reference implementation) and
// CLUST5.MPF / do_cluster.mpf (Michael L. Johnson's original Fortran).

export type ErrorModelType =
  | "Global SD"
  | "Global SE"
  | "Local SD"
  | "Local SE"
  | "SQRT"
  | "Fixed"
  | "Error Wave";

export interface ClusterParams {
  /** Points averaged for the test (peak) window — Fortran NPEAK. */
  nPeak: number;
  /** Points averaged for the baseline (nadir) window — Fortran NNADIR. */
  nNadir: number;
  /** Minimum t-score for a significant increase. */
  tScoreUp: number;
  /** Minimum t-score for a significant decrease. */
  tScoreDn: number;
  /** Minimum data value for a pulse — Fortran DVMP. */
  minPeak: number;
  errorModel: ErrorModelType;
  /** Fixed error value; also the SQRT fallback for non-positive data. */
  errorValue: number;
  /** Terminate pulses where the data is at/below `zero` (Igor 20170110 heuristic). */
  zeroTerminate: boolean;
  zero: number;
  /**
   * Which reference implementation to reproduce.
   *
   * "fortran" (default since 0.3.0) matches the original CLUST5.MPF v6.01, the
   * program Veldhuis and Johnson published: pooled S sums NDF(I)*STDEV(I)**2,
   * which is a variance, so the t-statistic is dimensionless and the pulse
   * count does not depend on the units the data is written in.
   *
   * "igor" matches ClusterMasterV4-1.ipf, the Moenter lab's package and the
   * oracle the port is tested against. It sums NDF[i]*STDEV[i] **unsquared**,
   * so its t-statistic carries units of sqrt(data) and its pulse count moves
   * with the scale of the record — see `hasScaleDependence` and
   * docs/validation-status.md. The pulse-assembly pass also differs: loop 1200
   * marks NPEAK points per up-flag (Igor marks nPeak-1), the initial down-run
   * sets only PULSE(1) (Igor fills and terminates the whole leading run), loop
   * 1300 starts at the second point, and the backward zap runs to index 1
   * (Igor stops at 3).
   *
   * ⚠ The default moved from "igor" to "fortran" in 0.3.0 and results changed
   * with it. Both paths stay, neither is corrected toward the other, and every
   * export stamps which one produced it.
   */
  variant: "igor" | "fortran";
  /**
   * Report a pulse whose onset was detected but whose termination is censored
   * by the end of the record (the Fortran drops it because the trailing nadir
   * window does not fit). Statistics needing the following baseline are null.
   */
  includeTruncated: boolean;
}

export const DEFAULT_PARAMS: ClusterParams = {
  nPeak: 2,
  nNadir: 2,
  tScoreUp: 2,
  tScoreDn: 2,
  minPeak: 0,
  errorModel: "Local SD",
  errorValue: 1,
  zeroTerminate: false,
  zero: 0,
  variant: "fortran",
  includeTruncated: true,
};

export interface Peak {
  /** Index of the largest value in the peak (0-based). */
  iMax: number;
  /** First index of the pulse run (0-based, inclusive). */
  iFirst: number;
  /** Last index of the pulse run (0-based, exclusive end of run, matching Fortran ILAST = first non-pulse point). */
  iLast: number;
  /** (iLast - iFirst) * deltaT */
  width: number;
  /**
   * The largest value reached in the pulse, in the units of the data — Fortran
   * LVAL, printed as "HEIGHT". This is an absolute concentration, not a rise
   * above baseline: `amplitude` is the rise. Keeping both is deliberate, since
   * the two are routinely conflated when CLUSTER output is written up.
   */
  peakValue: number;
  /** Mean of the nNadir points immediately before pulse onset — the pulse's baseline. */
  nadirBefore: number;
  /** Mean of the nNadir points after the pulse ends; null when the record ends first. */
  nadirAfter: number | null;
  /** peakValue as % of the preceding nadir mean — Fortran AA ("LARGEST%"). */
  largestPct: number | null;
  /** peak mean as % of surrounding nadir means — Fortran AB ("MEAN%"). */
  meanPct: number | null;
  /** width * (peak mean - lower surrounding nadir mean) — Fortran AC ("AREA"). */
  area: number | null;
  /**
   * Pulse amplitude: peakValue - nadirBefore, the rise above the preceding
   * baseline. Fortran AD, printed as "L INCREASE"; "amplitude" is what the
   * endocrine literature calls it.
   */
  amplitude: number | null;
}

export interface Valley {
  iMin: number;
  iFirst: number;
  iLast: number;
  width: number;
  /** Minimum value — Fortran NADIR. */
  nadir: number;
  /** Mean over the valley. */
  mean: number;
}

export interface MeanSD {
  mean: number;
  sd: number;
  n: number;
}

export interface ClusterSummary {
  nPeaks: number;
  nValleys: number;
  meanValue: number;
  totalArea: number;
  /**
   * times[n-1] - times[0], in the data's own time units. Pulse frequency is
   * derived from this rather than stored, because only the UI knows what the
   * time units are.
   */
  recordDuration: number;
  interPeakInterval: MeanSD | null;
  peakWidth: MeanSD | null;
  /** Absolute peak concentrations. See Peak.peakValue. */
  peakValue: MeanSD | null;
  /** Rises above the preceding baseline. See Peak.amplitude. */
  peakAmplitude: MeanSD | null;
  peakLargestPct: MeanSD | null;
  peakMeanPct: MeanSD | null;
  peakArea: MeanSD | null;
  valleyWidth: MeanSD | null;
  valleyMeanLevel: MeanSD | null;
  valleyNadir: MeanSD | null;
}

export interface ClusterResult {
  params: ClusterParams;
  times: number[];
  values: number[];
  /** Per-point error used by the t-test (err_ wave). */
  error: number[];
  /** 1 where a significant increase starts (ups_ wave). */
  ups: number[];
  /** -1 where a significant decrease starts (downs_ wave). */
  downs: number[];
  /** t-statistic trace from the ups scan (Mscore_ups_ wave). */
  mscoreUp: number[];
  /** t-statistic trace from the downs scan. */
  mscoreDn: number[];
  /** 1 inside a pulse, 0 outside (pulse_ wave). */
  pulse: number[];
  peaks: Peak[];
  valleys: Valley[];
  summary: ClusterSummary;
}
