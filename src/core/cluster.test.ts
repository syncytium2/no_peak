import { describe, it, expect } from "vitest";
import { mScore } from "./mscore";
import { buildErrorArray, resolveErrorModel } from "./errorModel";
import { upOrDn, pulseTest, clusterMain } from "./cluster";
import { extractPeaks, extractValleys } from "./peaks";
import { parseSeries, resultToCSV } from "./csv";
import { DEFAULT_PARAMS, type ClusterParams } from "./types";

// A flat baseline of 1s with two clear square pulses of height 10.
function twoPulseSeries(): { times: number[]; values: number[] } {
  const n = 60;
  const values = new Array<number>(n).fill(1);
  for (let i = 15; i < 20; i++) values[i] = 10;
  for (let i = 40; i < 45; i++) values[i] = 10;
  const times = values.map((_, i) => (i + 1) * 10); // deltaT = 10 min
  return { times, values };
}

const params = (over: Partial<ClusterParams> = {}): ClusterParams => ({
  ...DEFAULT_PARAMS,
  errorModel: "Fixed",
  errorValue: 0.5,
  ...over,
});

describe("mScore", () => {
  it("is positive for an increase and symmetric for the mirrored decrease", () => {
    const up = [1, 1, 1, 10, 10, 10];
    const dn = [10, 10, 10, 1, 1, 1];
    const err = new Array(6).fill(0.5);
    const tUp = mScore(3, 3, 3, up, err);
    const tDn = mScore(3, 3, 3, dn, err);
    expect(tUp).toBeGreaterThan(0);
    expect(tDn).toBeCloseTo(-tUp, 10);
  });

  it("matches a hand-computed value (Igor variance form)", () => {
    // nNadir = nPeak = 2 at ipt=2 on [1,1,10,10]: nMean=1, pMean=10,
    // weights: sumN=sumP=4; s = sum(err[0..3]) = 4*0.5 = 2; S = sqrt(2/6);
    // t = 9 / S / sqrt(1/4+1/4) = 9 / sqrt(1/3) / sqrt(1/2)
    const w = [1, 1, 10, 10];
    const err = [0.5, 0.5, 0.5, 0.5];
    const expected = 9 / Math.sqrt(2 / 6) / Math.sqrt(0.5);
    expect(mScore(2, 2, 2, w, err)).toBeCloseTo(expected, 10);
  });

  it("fortranVariance squares the error term", () => {
    const w = [1, 1, 10, 10];
    const err = [0.5, 0.5, 0.5, 0.5];
    const s = 4 * 0.25;
    const expected = 9 / Math.sqrt(s / 6) / Math.sqrt(0.5);
    expect(mScore(2, 2, 2, w, err, true)).toBeCloseTo(expected, 10);
  });
});

describe("buildErrorArray", () => {
  const w = [1, 4, 9, 16, 25];

  it("Fixed fills with the value", () => {
    expect(buildErrorArray(w, "Fixed", 2, 2, 2)).toEqual([2, 2, 2, 2, 2]);
  });

  it("SQRT takes the square root, with fallback for non-positive data", () => {
    expect(buildErrorArray([4, 0, -1], "SQRT", 7, 1, 1)).toEqual([2, 7, 7]);
  });

  it("Global SD is the sample SD everywhere", () => {
    const err = buildErrorArray(w, "Global SD", 0, 2, 2);
    const m = 11;
    const sd = Math.sqrt(
      w.map((v) => (v - m) ** 2).reduce((a, b) => a + b, 0) / (w.length - 1),
    );
    for (const e of err) expect(e).toBeCloseTo(sd, 10);
  });

  it("Local SD fills the edges outward from the first/last computed point", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const err = buildErrorArray(data, "Local SD", 0, 2, 2);
    expect(err[0]).toBe(err[2 - 1]); // edge copy
    expect(err[0]).toBe(err[2]);
    expect(err[7]).toBe(err[8 - 2 - 1]);
    // interior windows of a linear ramp all have identical SD
    expect(err[3]).toBeCloseTo(err[2], 10);
  });

  it("resolveErrorModel switches with the loaded file's shape", () => {
    // file with an error column adopts it
    expect(resolveErrorModel("Local SD", true)).toBe("Error Wave");
    expect(resolveErrorModel("Error Wave", true)).toBe("Error Wave");
    // file without one cannot stay on Error Wave (the stale-state bug)
    expect(resolveErrorModel("Error Wave", false)).toBe("Local SD");
    // other models are untouched
    expect(resolveErrorModel("Fixed", false)).toBe("Fixed");
  });

  it("Error Wave validates length", () => {
    expect(() => buildErrorArray(w, "Error Wave", 0, 2, 2, [1, 2])).toThrow();
    expect(buildErrorArray(w, "Error Wave", 0, 2, 2, [1, 1, 1, 1, 1])).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("upOrDn", () => {
  it("flags the rise and fall of a square pulse", () => {
    const { values } = twoPulseSeries();
    const err = buildErrorArray(values, "Fixed", 0.5, 2, 2);
    const up = upOrDn(values, err, 2, 2, 2, 1, 0);
    const dn = upOrDn(values, err, 2, 2, 2, -1, 0);
    // pulse occupies indices 15..19: the first test window fully inside the
    // pulse starts at 15
    expect(up.flags[15]).toBe(1);
    expect(dn.flags[20]).toBe(-1);
    // no spurious flags on the flat baseline
    expect(up.flags.slice(2, 14).every((f) => f === 0)).toBe(true);
    expect(dn.flags.slice(2, 14).every((f) => f === 0)).toBe(true);
  });

  it("respects the minimum data value for a pulse (dvmp)", () => {
    const { values } = twoPulseSeries();
    const err = buildErrorArray(values, "Fixed", 0.5, 2, 2);
    const up = upOrDn(values, err, 2, 2, 2, 1, 50); // dvmp above every value
    expect(up.flags.every((f) => f === 0)).toBe(true);
  });
});

describe("pulseTest", () => {
  it("marks both square pulses and leaves the baseline clear", () => {
    const { times, values } = twoPulseSeries();
    const r = clusterMain(times, values, params());
    // interior of each pulse must be marked
    expect(r.pulse.slice(16, 19).every((p) => p === 1)).toBe(true);
    expect(r.pulse.slice(41, 44).every((p) => p === 1)).toBe(true);
    // deep baseline (away from edge effects) must be clear
    expect(r.pulse.slice(25, 38).every((p) => p === 0)).toBe(true);
    expect(r.pulse.slice(5, 13).every((p) => p === 0)).toBe(true);
  });

  it("forces an initial pulse when the record starts inside one", () => {
    // starts high, drops at index 5
    const n = 30;
    const values = new Array<number>(n).fill(1);
    for (let i = 0; i < 5; i++) values[i] = 10;
    const err = buildErrorArray(values, "Fixed", 0.5, 2, 2);
    const up = upOrDn(values, err, 2, 2, 2, 1, 0);
    const dn = upOrDn(values, err, 2, 2, 2, -1, 0);
    const pulse = pulseTest(values, up.flags, dn.flags, 2, 2);
    expect(pulse[0]).toBe(1);
    expect(pulse[1]).toBe(1);
  });

  it("zeroTerminate clears pulse points at or below the zero level", () => {
    const { times, values } = twoPulseSeries();
    const zeroed = values.map((v, i) => (i === 17 ? 0 : v));
    const r = clusterMain(times, zeroed, params({ zeroTerminate: true, zero: 0 }));
    expect(r.pulse[17]).toBe(0);
  });
});

describe("peaks and valleys", () => {
  it("finds two peaks with correct positions and heights", () => {
    const { times, values } = twoPulseSeries();
    const r = clusterMain(times, values, params());
    expect(r.peaks.length).toBe(2);
    const [p1, p2] = r.peaks;
    expect(p1.iMax).toBeGreaterThanOrEqual(15);
    expect(p1.iMax).toBeLessThan(20);
    expect(p1.height).toBe(10);
    expect(p2.height).toBe(10);
    expect(r.summary.interPeakInterval?.mean).toBeCloseTo((p2.iMax - p1.iMax) * 10, 10);
  });

  it("finds the valley between the peaks", () => {
    const { times, values } = twoPulseSeries();
    const r = clusterMain(times, values, params());
    expect(r.valleys.length).toBe(1);
    expect(r.valleys[0].nadir).toBe(1);
    expect(r.valleys[0].iFirst).toBeGreaterThan(15);
    expect(r.valleys[0].iLast).toBeLessThanOrEqual(41);
  });

  it("extractPeaks ignores runs that touch the edges", () => {
    const pulse = [1, 1, 0, 0, 0, 1, 1, 0, 0, 0];
    const w = [5, 5, 1, 1, 1, 5, 5, 1, 1, 1];
    const peaks = extractPeaks(pulse, w, 1, 2);
    expect(peaks.length).toBe(1);
    expect(peaks[0].iFirst).toBe(5);
  });

  it("extractValleys requires pulses on both sides", () => {
    const pulse = [0, 0, 1, 1, 0, 0, 0, 1, 0, 0];
    const w = [1, 1, 5, 5, 1, 0.5, 1, 5, 1, 1];
    const valleys = extractValleys(pulse, w, 1);
    expect(valleys.length).toBe(1);
    expect(valleys[0].nadir).toBe(0.5);
  });
});

describe("summary", () => {
  it("mean and trapezoidal area match the Fortran formulas", () => {
    const { times, values } = twoPulseSeries();
    const r = clusterMain(times, values, params());
    const sum = values.reduce((a, b) => a + b, 0);
    expect(r.summary.meanValue).toBeCloseTo(sum / values.length, 10);
    expect(r.summary.totalArea).toBeCloseTo((sum - values[0] / 2 - values[59] / 2) * 10, 10);
  });
});

describe("clusterMain validation", () => {
  it("rejects window sizes larger than the record", () => {
    expect(() =>
      clusterMain([1, 2, 3], [1, 2, 3], params({ nPeak: 2, nNadir: 2 })),
    ).toThrow(/exceeds/);
  });
});

describe("csv", () => {
  it("parses one, two and three column layouts with and without headers", () => {
    expect(parseSeries("1\n2\n3\n").values).toEqual([1, 2, 3]);
    const two = parseSeries("time,lh\n10,1.5\n20,2.5\n");
    expect(two.labels).toEqual(["time", "lh"]);
    expect(two.times).toEqual([10, 20]);
    expect(two.values).toEqual([1.5, 2.5]);
    const three = parseSeries("10\t1.5\t0.1\n20\t2.5\t0.2\n");
    expect(three.error).toEqual([0.1, 0.2]);
  });

  it("rejects garbage", () => {
    expect(() => parseSeries("")).toThrow();
    expect(() => parseSeries("a,b\nc,d\n")).toThrow(/not numeric/);
    expect(() => parseSeries("1,2,3,4\n")).toThrow(/columns/);
  });

  it("round-trips a result into CSV", () => {
    const { times, values } = twoPulseSeries();
    const r = clusterMain(times, values, params());
    const csv = resultToCSV(r);
    expect(csv).toContain("time,value,error,up,down,mscore_up,mscore_dn,pulse");
    expect(csv.split("\n").length).toBeGreaterThan(values.length);
    expect(csv).toContain("# peaks");
  });
});
