// Every bundled dataset must load, parse and analyze.
//
// The sample registry is the one place where a data file, its declared sampling
// interval and its units are asserted to belong together, and nothing else
// checks that: a mistyped import path, a regenerated file with a different
// length, or a note claiming a pulse count the data no longer has would all
// reach the picker unnoticed.

import { describe, expect, it } from "vitest";
import { SAMPLES, SAMPLE_GROUPS, sampleCounts } from "./samples";
import { runSegments } from "./core/segments";
import { pulseFrequency } from "./core/timeUnits";
import { DEFAULT_PARAMS } from "./core/types";
import { HAVE_DIGITIZED } from "./testing/haveDigitized";

describe("bundled samples", () => {
  // Asserted in both states rather than skipped, because "the digitized records
  // are gone" is a claim worth testing too: a suppression that half-worked, with
  // a record still reachable through the picker, would otherwise pass quietly.
  it("ships all eight digitized records, or none of them, and always the simulated", () => {
    const dig = SAMPLES.filter((s) => s.provenance === "digitized");
    const sim = SAMPLES.filter((s) => s.provenance === "simulated");
    expect(sim.length).toBeGreaterThan(0);
    expect(dig).toHaveLength(HAVE_DIGITIZED ? 8 : 0);
    if (HAVE_DIGITIZED) {
      // the real records lead the picker
      expect(SAMPLE_GROUPS[0]).toMatch(/^Real/);
      expect(SAMPLES[0].provenance).toBe("digitized");
    } else {
      expect(SAMPLE_GROUPS.some((g) => g.startsWith("Real"))).toBe(false);
    }
  });

  // The simulated GnRH records were built to the protocol of the same paper the
  // digitized ones come from, so they are the one pair in the app that can
  // genuinely be mistaken for each other. Keep them apart by construction.
  it("never labels a generated record as if it were an animal", () => {
    for (const s of SAMPLES.filter((x) => x.provenance === "simulated")) {
      expect(s.label, `${s.key} label claims an animal`).not.toMatch(/\bewe\b|#\d/i);
      expect(s.group).toMatch(/^Simulated/);
      expect(s.note.slice(0, 40)).toMatch(/GENERATED|seeded|Resembles|simulat/i);
    }
    for (const s of SAMPLES.filter((x) => x.provenance === "digitized")) {
      expect(s.group).toMatch(/^Real/);
      expect(s.note).toMatch(/MEASURED/);
    }
  });

  it("gives no two datasets the same label", () => {
    const labels = SAMPLES.map((s) => `${s.group}|${s.label}`);
    expect(new Set(labels).size).toBe(labels.length);
    // and no simulated label may duplicate a digitized one even across groups
    const dig = new Set(SAMPLES.filter((s) => s.provenance === "digitized").map((s) => s.label));
    for (const s of SAMPLES.filter((x) => x.provenance === "simulated")) {
      expect(dig.has(s.label), `${s.key} shares a label with a real record`).toBe(false);
    }
  });

  it("has a unique key and a group for each", () => {
    expect(new Set(SAMPLES.map((s) => s.key)).size).toBe(SAMPLES.length);
    for (const s of SAMPLES) {
      expect(SAMPLE_GROUPS).toContain(s.group);
      expect(s.note.length).toBeGreaterThan(40);
      expect(s.valueLabel).toBeTruthy();
      expect(s.deltaT).toBeGreaterThan(0);
    }
  });

  it("parses every one, and the picker's point counts are real", () => {
    for (const s of SAMPLES) {
      const series = s.load();
      expect(series.values.length, `${s.key} parsed empty`).toBeGreaterThan(2);
      expect(sampleCounts[s.key], `${s.key} missing a count`).toBe(series.values.length);
      expect(series.values.every(Number.isFinite), `${s.key} has non-finite values`).toBe(true);
    }
  });

  it("declares a sampling interval that matches the data's own times", () => {
    for (const s of SAMPLES) {
      const t = s.load().times;
      if (!t) continue; // value-only files have nothing to check against
      expect(t[1] - t[0], `${s.key} deltaT disagrees with its time column`).toBeCloseTo(s.deltaT, 6);
    }
  });

  it("runs through the analysis and yields a sane frequency", () => {
    for (const s of SAMPLES) {
      const series = s.load();
      const run = runSegments(
        [{ name: s.key, values: series.values, times: series.times, error: series.error }],
        { ...DEFAULT_PARAMS },
        s.deltaT,
      );
      const m = run.combined.summary;
      expect(m.recordDuration, `${s.key} has no duration`).toBeGreaterThan(0);
      const f = pulseFrequency(m.nPeaks, m.recordDuration, s.timeUnit)!;
      expect(f).not.toBeNull();
      // nothing plausible in endocrine sampling exceeds a pulse a minute
      expect(f.perHour, `${s.key} frequency implausible`).toBeLessThan(60);
    }
  });

  it("keeps the digitized records on the scale their figures are drawn on", () => {
    for (const s of SAMPLES.filter((x) => x.provenance === "digitized")) {
      const v = s.load().values;
      const ceiling = s.valueLabel.includes("GnRH") ? 3 : 31;
      expect(Math.max(...v), `${s.key} exceeds its axis`).toBeLessThanOrEqual(ceiling);
      expect(Math.min(...v), `${s.key} went negative`).toBeGreaterThan(0);
    }
  });

  it("cites the source in every digitized record's note", () => {
    for (const s of SAMPLES.filter((x) => x.provenance === "digitized")) {
      expect(s.note + s.label).toMatch(/Fig\.|Webster/);
    }
  });
});
