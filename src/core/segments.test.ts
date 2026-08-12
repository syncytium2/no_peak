import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { runSegments, segmentsToCSV, type Segment } from "./segments";
import { DEFAULT_PARAMS } from "./types";

const params = () => ({ ...DEFAULT_PARAMS });

/** A flat baseline with `nPulses` triangular pulses, at 10-minute sampling. */
function record(nPulses: number, baseline = 1, amp = 9, gap = 10): number[] {
  const v: number[] = [];
  for (let p = 0; p < nPulses; p++) {
    for (let i = 0; i < gap; i++) v.push(baseline);
    v.push(baseline + amp, baseline + amp / 2);
  }
  for (let i = 0; i < gap; i++) v.push(baseline);
  return v;
}

const seg = (name: string, values: number[]): Segment => ({
  name,
  values,
  times: values.map((_, i) => (i + 1) * 10),
  error: null,
});

describe("runSegments", () => {
  it("reduces to a plain clusterMain run for a single record", () => {
    const values = record(3);
    const times = values.map((_, i) => (i + 1) * 10);
    const one = runSegments([seg("a", values)], params(), 10);
    const direct = clusterMain(times, values, params());

    expect(one.combined.pulse).toEqual(direct.pulse);
    expect(one.combined.times).toEqual(direct.times);
    expect(one.combined.summary.nPeaks).toBe(direct.summary.nPeaks);
  });

  it("gives each record the same answer it would get alone", () => {
    const a = record(3);
    const b = record(2, 4, 20);
    const run = runSegments([seg("a", a), seg("b", b)], params(), 10);

    const alone = (v: number[]) =>
      clusterMain(v.map((_, i) => (i + 1) * 10), v, params()).summary.nPeaks;
    expect(run.segments[0].result.summary.nPeaks).toBe(alone(a));
    expect(run.segments[1].result.summary.nPeaks).toBe(alone(b));
  });

  it("does not let a detection window straddle the join", () => {
    // A record ending high butted against one starting low is a step change no
    // detector could know is artificial. Analyzed separately, neither record
    // sees it; concatenated and run once, the step is a pulse edge.
    const high = [9, 9, 9, 9, 9, 9];
    const low = [1, 1, 1, 1, 1, 1];
    const run = runSegments([seg("high", high), seg("low", low)], params(), 10);
    expect(run.combined.summary.nPeaks).toBe(0);

    const naive = clusterMain(
      [...high, ...low].map((_, i) => (i + 1) * 10),
      [...high, ...low],
      params(),
    );
    expect(naive.downs.some((d) => d === -1)).toBe(true); // the artifact it avoids
  });

  it("lays records end to end without overlapping in time", () => {
    const run = runSegments([seg("a", record(2)), seg("b", record(2))], params(), 10);
    const t = run.combined.times;
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);

    const first = run.segments[0];
    const second = run.segments[1];
    expect(second.start).toBe(first.length);
    // one sampling interval between the last point of a and the first of b
    expect(t[second.start] - t[second.start - 1]).toBeCloseTo(10, 9);
  });

  it("shifts peak indices into the combined arrays", () => {
    const run = runSegments([seg("a", record(2)), seg("b", record(2))], params(), 10);
    for (const p of run.combined.peaks) {
      expect(run.combined.values[p.iMax]).toBe(run.combined.values[p.iMax]);
      expect(p.iMax).toBeGreaterThanOrEqual(p.iFirst);
      expect(p.iLast).toBeLessThan(run.combined.values.length);
    }
    const total = run.segments.reduce((a, s) => a + s.result.peaks.length, 0);
    expect(run.combined.peaks.length).toBe(total);
  });

  it("pools interpulse intervals within records only", () => {
    const run = runSegments([seg("a", record(3)), seg("b", record(3))], params(), 10);
    const within = run.segments.reduce(
      (a, s) => a + Math.max(0, s.result.peaks.length - 1),
      0,
    );
    expect(run.combined.summary.interPeakInterval?.n).toBe(within);
    // A pooled interval spanning the join would be far longer than any real one.
    const longest = Math.max(
      ...run.segments.map((s) => s.result.summary.recordDuration),
    );
    expect(run.combined.summary.interPeakInterval!.mean).toBeLessThan(longest);
  });

  it("sums record duration so frequency is over time actually recorded", () => {
    const run = runSegments([seg("a", record(2)), seg("b", record(2))], params(), 10);
    const summed = run.segments.reduce((a, s) => a + s.result.summary.recordDuration, 0);
    expect(run.combined.summary.recordDuration).toBe(summed);
  });

  it("names the record that failed", () => {
    expect(() => runSegments([seg("ok", record(2)), seg("tiny", [1, 2])], params(), 10)).toThrow(
      /"tiny"/,
    );
  });

  it("writes one CSV row per record", () => {
    const run = runSegments([seg("ewe 1", record(3)), seg("ewe 2", record(2))], params(), 10);
    const lines = segmentsToCSV(run.segments, "min").trim().split("\n");
    expect(lines).toHaveLength(3); // header + two records
    expect(lines[1]).toContain('"ewe 1"');
    expect(lines[2]).toContain('"ewe 2"');
  });
});
