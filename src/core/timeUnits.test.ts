import { describe, expect, it } from "vitest";
import { defaultAxisLabel, formatDuration, pulseFrequency } from "./timeUnits";

describe("pulseFrequency", () => {
  it("counts pulses over the whole record, in pulses per hour", () => {
    // 6 pulses over 720 min = 12 h → half a pulse an hour.
    expect(pulseFrequency(6, 720, "min")!.perHour).toBeCloseTo(0.5, 9);
    expect(pulseFrequency(6, 720, "min")!.durationMin).toBe(720);
  });

  it("converts from whatever unit the axis is in", () => {
    expect(pulseFrequency(3, 3600, "s")!.perHour).toBeCloseTo(3, 9);
    expect(pulseFrequency(3, 1, "h")!.perHour).toBeCloseTo(3, 9);
  });

  it("is not the reciprocal of the interpulse interval", () => {
    // Two pulses 10 min apart in a 10-h record: the interval says 6 pulses/h,
    // the record says 0.2. Only the second is what a methods section means.
    const f = pulseFrequency(2, 600, "min")!;
    expect(f.perHour).toBeCloseTo(0.2, 9);
  });

  it("returns null when there is no time base or no extent", () => {
    expect(pulseFrequency(4, 600, "samples")).toBeNull();
    expect(pulseFrequency(4, 0, "min")).toBeNull();
  });

  it("reports zero for a record with no pulses", () => {
    expect(pulseFrequency(0, 600, "min")!.perHour).toBe(0);
  });
});

describe("defaultAxisLabel", () => {
  it("names the unit it was given", () => {
    expect(defaultAxisLabel("min")).toBe("Time (min)");
    expect(defaultAxisLabel("s")).toBe("Time (s)");
    expect(defaultAxisLabel("samples")).toBe("Sample number");
  });
});

describe("formatDuration", () => {
  it("picks the unit a reader would use", () => {
    expect(formatDuration(0.5)).toBe("30 s");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(960)).toBe("16 h");
  });
});
