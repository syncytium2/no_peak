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
  | "Assay CV"
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
  /**
   * "Assay CV" model: error_i = max(assayFloor, assayCV * value_i).
   *
   * The shape a real immunoassay actually has — a proportional term from its
   * coefficient of variation, and a floor at its detection limit, below which
   * precision stops improving. Every other model here estimates the error from
   * the spread of the data, which is a different assumption: at narrow windows
   * it reads a pulse's own height as noise, so a large clean pulse can raise its
   * own error enough to hide itself.
   */
  assayCV: number;
  assayFloor: number;
  /** Terminate pulses where the data is at/below `zero` (Igor 20170110 heuristic). */
  zeroTerminate: boolean;
  zero: number;
  /**
   * Which reference implementation to reproduce. "igor" (default) matches
   * ClusterMasterV4-1.ipf, the validation oracle. "fortran" matches the
   * original CLUST5.MPF: pooled S sums NDF(I)*STDEV(I)**2 (Igor sums
   * NDF[i]*STDEV[i]), and the pulse-assembly pass differs — loop 1200 marks
   * NPEAK points per up-flag (Igor marks nPeak-1), the initial down-run sets
   * only PULSE(1) (Igor fills and terminates the whole leading run), loop
   * 1300 starts at the second point, and the backward zap runs to index 1
   * (Igor stops at 3).
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
  assayCV: 0.08,
  assayFloor: 0,
  zeroTerminate: false,
  zero: 0,
  variant: "igor",
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
