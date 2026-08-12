import { describe, expect, it } from "vitest";
import { niceTicks, promoteTimeUnit, timeTicks } from "./scale";

describe("timeTicks", () => {
  const step = (t: number[]) => Number((t[1] - t[0]).toPrecision(12));

  it("uses clock divisions on a seconds axis, not the decimal ladder", () => {
    // The complaint this exists for: 8 ticks over 600 s by the 1/2/5 rule gives
    // a step of 100, so the axis reads 100, 200, 300 — arithmetic to convert.
    expect(step(niceTicks(0, 600, 8))).toBe(100);
    expect(step(timeTicks(0, 600, 8, 1))).toBe(60);
  });

  it("picks half-minute steps for short records", () => {
    expect(step(timeTicks(0, 240, 8, 1))).toBe(30);
    expect(step(timeTicks(0, 120, 8, 1))).toBe(15);
  });

  it("steps in whole minutes and hours as the record lengthens", () => {
    expect(step(timeTicks(0, 3600, 8, 1))).toBe(600); // 10 min
    expect(step(timeTicks(0, 86400, 8, 1))).toBe(10800); // 3 h
  });

  it("works on a minutes axis, where a step may be fractional", () => {
    // 4 minutes across 8 ticks wants 30-second ticks: 0.5 in axis units.
    expect(step(timeTicks(0, 4, 8, 60))).toBe(0.5);
    expect(step(timeTicks(0, 960, 8, 60))).toBe(120); // 16 h record → 2 h ticks
  });

  it("anchors ticks on multiples of the step, not on the data start", () => {
    const t = timeTicks(10, 610, 8, 1);
    expect(t[0] % 60).toBe(0);
    expect(t.every((v) => v % 60 === 0)).toBe(true);
  });

  it("stays inside the requested range", () => {
    for (const [lo, hi] of [[0, 600], [10, 1450], [-30, 90]] as const) {
      const t = timeTicks(lo, hi, 8, 1);
      expect(t[0]).toBeGreaterThanOrEqual(lo);
      expect(t[t.length - 1]).toBeLessThanOrEqual(hi);
    }
  });

  it("falls back to the decimal ladder beyond the clock range", () => {
    // A record of months: past a day per tick, round decimal numbers are as
    // good as anything and the clock ladder has nothing left to offer.
    const t = timeTicks(0, 30 * 86400, 8, 1);
    expect(t.length).toBeGreaterThan(2);
    expect(t).toEqual(niceTicks(0, 30 * 86400, 8));
  });

  it("degenerates safely", () => {
    expect(timeTicks(5, 5, 8, 1)).toEqual([5]);
    expect(timeTicks(0, 100, 8, 0)).toEqual(niceTicks(0, 100, 8));
  });
});

describe("promoteTimeUnit", () => {
  it("reads a 6 h record in hours, not 60-minute multiples", () => {
    // The complaint this exists for: a minutes axis over ewe #9013's 6 h record
    // ticks 0, 60, 120 … 360, which is an hour ladder the reader has to divide.
    const t = timeTicks(-2.5, 362.5, 8, 60);
    expect(t).toEqual([0, 60, 120, 180, 240, 300, 360]);
    const p = promoteTimeUnit(t, 1);
    expect(p).toEqual({ divisor: 60, short: "h" });
    expect(t.map((v) => v / p!.divisor)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("promotes a seconds axis to minutes, and to hours when it earns it", () => {
    expect(promoteTimeUnit(timeTicks(0, 600, 8, 1), 1 / 60)).toEqual({ divisor: 60, short: "min" });
    expect(promoteTimeUnit(timeTicks(0, 86400, 8, 1), 1 / 60)).toEqual({
      divisor: 3600,
      short: "h",
    });
  });

  it("leaves an axis alone when its own unit reads better", () => {
    // 10-minute ticks are minutes; 1.5 h would read worse than 90.
    expect(promoteTimeUnit([0, 10, 20, 30], 1)).toBeNull();
    expect(promoteTimeUnit([0, 90, 180], 1)).toBeNull();
    // ticks anchored off the hour (a zoom window starting at 05:30)
    expect(promoteTimeUnit([90, 150, 210], 1)).toBeNull();
    // an hours axis has nothing above it here, and sample numbers are not time
    expect(promoteTimeUnit([0, 2, 4], 60)).toBeNull();
    expect(promoteTimeUnit([0, 60, 120], null)).toBeNull();
    expect(promoteTimeUnit([60], 1)).toBeNull();
  });
});
