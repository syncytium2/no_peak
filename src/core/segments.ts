// Analyzing several records under one set of detection settings.
//
// The working practice this supports: rather than tune CLUSTER separately for
// each animal in a study — which makes the settings, and therefore the pulse
// counts, incomparable between animals — you concatenate every record into one
// long trace, run it once, and then chop the output back apart by animal.
//
// Concatenating is the right instinct and the chopping is the tax. Two things
// go wrong when it is done by hand. The join between two animals is a step
// change the detector cannot know is artificial, so it invents a pulse there or
// swallows a real one at the edges; and the pooled interpulse intervals include
// a meaningless interval spanning the join. Both are avoided here by running
// each segment independently — identical parameters, no window ever straddling
// a boundary — and then pooling the results. The concatenated trace remains as
// the display, because seeing every animal on one axis is the other half of why
// the practice exists.

import { clusterMain } from "./cluster.ts";
import { meanSD } from "./stats.ts";
import type { ClusterParams, ClusterResult, ClusterSummary, Peak, Valley } from "./types.ts";

/** One record — typically one animal — to be analyzed under shared settings. */
export interface Segment {
  name: string;
  values: number[];
  /** Sample times; null to generate them from `deltaT`. */
  times: number[] | null;
  /** Per-sample measurement error, when the source supplied one. */
  error: number[] | null;
}

export interface SegmentResult {
  name: string;
  result: ClusterResult;
  /** Added to this segment's own times to place it in the combined trace. */
  offset: number;
  /** Where this segment starts in the combined arrays. */
  start: number;
  /** Number of samples. */
  length: number;
}

export interface SegmentedRun {
  segments: SegmentResult[];
  /**
   * Every segment laid end to end: the trace to plot, carrying each segment's
   * own detection flags. Its summary pools the per-segment results rather than
   * being recomputed across the joins.
   */
  combined: ClusterResult;
}

const localTimes = (s: Segment, deltaT: number) =>
  s.times ?? s.values.map((_, i) => (i + 1) * deltaT);

/**
 * Run CLUSTER over every segment with the same parameters and stitch the
 * results into one combined view.
 *
 * A single segment reduces exactly to a plain `clusterMain` call, so the
 * one-file path is unchanged.
 */
export function runSegments(
  segments: Segment[],
  params: ClusterParams,
  deltaT: number,
): SegmentedRun {
  if (segments.length === 0) throw new Error("No data to analyze.");

  const results: SegmentResult[] = [];
  // Absolute time the next segment's first sample should sit at. The first
  // segment keeps its own times, so nothing moves in the single-record case.
  let cursor: number | null = null;
  let start = 0;

  for (const seg of segments) {
    const times = localTimes(seg, deltaT);
    let result: ClusterResult;
    try {
      result = clusterMain(times, seg.values, params, seg.error ?? undefined);
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(
        segments.length === 1 ? why : `"${seg.name}" could not be analyzed: ${why}`,
      );
    }

    const offset: number = cursor === null ? 0 : cursor - times[0];
    results.push({ name: seg.name, result, offset, start, length: seg.values.length });

    // Butt the next segment one sampling interval past this one's last point,
    // so the combined axis stays monotonic and never implies continuous
    // recording across the join.
    const dt = times.length > 1 ? times[1] - times[0] : deltaT;
    cursor = times[times.length - 1] + offset + dt;
    start += seg.values.length;
  }

  return { segments: results, combined: combine(results, params) };
}

/** Concatenate per-segment results, shifting times and peak indices into place. */
function combine(segments: SegmentResult[], params: ClusterParams): ClusterResult {
  const times: number[] = [];
  const values: number[] = [];
  const error: number[] = [];
  const ups: number[] = [];
  const downs: number[] = [];
  const mscoreUp: number[] = [];
  const mscoreDn: number[] = [];
  const pulse: number[] = [];
  const peaks: Peak[] = [];
  const valleys: Valley[] = [];

  // Appended in a loop rather than by spreading: `push(...arr)` passes every
  // element as an argument, which blows the stack on a long enough record.
  const append = (into: number[], from: number[]) => {
    for (const v of from) into.push(v);
  };

  for (const s of segments) {
    const r = s.result;
    for (const t of r.times) times.push(t + s.offset);
    append(values, r.values);
    append(error, r.error);
    append(ups, r.ups);
    append(downs, r.downs);
    append(mscoreUp, r.mscoreUp);
    append(mscoreDn, r.mscoreDn);
    append(pulse, r.pulse);
    for (const p of r.peaks) {
      peaks.push({
        ...p,
        iMax: p.iMax + s.start,
        iFirst: p.iFirst + s.start,
        iLast: p.iLast + s.start,
      });
    }
    for (const v of r.valleys) {
      valleys.push({
        ...v,
        iMin: v.iMin + s.start,
        iFirst: v.iFirst + s.start,
        iLast: v.iLast + s.start,
      });
    }
  }

  return {
    params,
    times,
    values,
    error,
    ups,
    downs,
    mscoreUp,
    mscoreDn,
    pulse,
    peaks,
    valleys,
    summary: poolSummary(segments.map((s) => s.result)),
  };
}

/**
 * Pool per-segment summaries.
 *
 * Every statistic is pooled over the segments' own peaks and valleys, so no
 * quantity is ever measured across a join. Interpulse intervals in particular
 * come only from consecutive pulses within one animal.
 */
export function poolSummary(results: ClusterSource[]): ClusterSummary {
  const all = <T,>(pick: (r: ClusterSource) => T[]): T[] => results.flatMap(pick);
  const notNull = (a: (number | null)[]) => a.filter((v): v is number => v !== null);
  const peaks = all((r) => r.peaks);
  const valleys = all((r) => r.valleys);

  let points = 0;
  let valueSum = 0;
  for (const r of results) {
    points += r.values.length;
    for (const v of r.values) valueSum += v;
  }

  // Interpulse intervals, recomputed per segment so none spans a boundary.
  const intervals: number[] = [];
  for (const r of results) {
    const dt = r.times.length > 1 ? r.times[1] - r.times[0] : 0;
    for (let i = 1; i < r.peaks.length; i++) {
      intervals.push((r.peaks[i].iMax - r.peaks[i - 1].iMax) * dt);
    }
  }

  return {
    nPeaks: peaks.length,
    nValleys: valleys.length,
    meanValue: points ? valueSum / points : 0,
    totalArea: results.reduce((a, r) => a + r.summary.totalArea, 0),
    recordDuration: results.reduce((a, r) => a + r.summary.recordDuration, 0),
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

/** The parts of a ClusterResult that pooling reads. */
type ClusterSource = Pick<
  ClusterResult,
  "peaks" | "valleys" | "values" | "times" | "summary"
>;

/**
 * Per-segment CSV: one row per record, the shape you would paste into a stats
 * package.
 *
 * Takes the segment list rather than a whole `SegmentedRun` because it reads
 * nothing else, and because a caller analyzing records that are not one
 * concatenated study — `scripts/cluster.ts` over a directory of files — has
 * results to tabulate without a combined trace to put them in.
 */
export function segmentsToCSV(segments: SegmentResult[], unitShort: string): string {
  const cell = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? "" : String(v);
  const out = [
    `segment,n_points,duration_${unitShort},n_pulses,pulses_per_${unitShort},` +
      `mean_interpulse_interval,mean_peak_value,mean_amplitude,mean_pulse_width,mean_nadir`,
  ];
  for (const s of segments) {
    const m = s.result.summary;
    out.push(
      [
        JSON.stringify(s.name),
        s.length,
        cell(m.recordDuration),
        m.nPeaks,
        cell(m.recordDuration > 0 ? m.nPeaks / m.recordDuration : null),
        cell(m.interPeakInterval?.mean),
        cell(m.peakValue?.mean),
        cell(m.peakAmplitude?.mean),
        cell(m.peakWidth?.mean),
        cell(m.valleyNadir?.mean),
      ].join(","),
    );
  }
  return out.join("\n") + "\n";
}
