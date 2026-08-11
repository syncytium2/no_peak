import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { parseSeries } from "./csv";
import { PRESETS, matchPreset } from "./presets";
import { pulseFrequency } from "./timeUnits";
import { DEFAULT_PARAMS } from "./types";

const preset = (key: string) => PRESETS.find((p) => p.key === key)!;

function run(file: string, key: string) {
  const s = parseSeries(readFileSync(`data/synthetic/${file}`, "utf8"));
  return clusterMain(
    s.times!,
    s.values,
    { ...DEFAULT_PARAMS, ...preset(key).params, errorModel: "Error Wave" },
    s.error ?? undefined,
  );
}

describe("published presets", () => {
  it("carries the settings Webster et al. 1991 printed", () => {
    // Peak and nadir clusters of one point; t = 3.2 for GnRH, 2.32 for LH.
    expect(preset("webster1991_gnrh").params).toEqual({
      nPeak: 1,
      nNadir: 1,
      tScoreUp: 3.2,
      tScoreDn: 3.2,
    });
    expect(preset("webster1991_lh").params).toEqual({
      nPeak: 1,
      nNadir: 1,
      tScoreUp: 2.32,
      tScoreDn: 2.32,
    });
  });

  it("recognises the current parameters as a preset, and edits as custom", () => {
    expect(matchPreset({ ...DEFAULT_PARAMS })?.key).toBe("default");
    expect(matchPreset({ ...DEFAULT_PARAMS, ...preset("webster1991_gnrh").params })?.key).toBe(
      "webster1991_gnrh",
    );
    expect(matchPreset({ ...DEFAULT_PARAMS, nPeak: 7 })).toBeUndefined();
  });

  // These tie the bundled data to the paper it was built from: the simulated
  // THX record should return the pulse count that study reports, at the
  // settings that study used. If either drifts, one of them is wrong.
  it("finds the reported 11 pulses per 6 h in the simulated THX ewe", () => {
    const r = run("sim_gnrh_thx_ewe.csv", "webster1991_gnrh");
    expect(r.summary.nPeaks).toBe(11); // reported: 11.2 ± 1.4 pulses/6 h
    const f = pulseFrequency(r.summary.nPeaks, r.summary.recordDuration, "min")!;
    expect(f.perHour).toBeGreaterThan(1.5);
    expect(f.perHour).toBeLessThan(2.5);
  });

  it("finds no pulses in the thyroid-intact control", () => {
    expect(run("sim_gnrh_intact.csv", "webster1991_gnrh").summary.nPeaks).toBe(0);
  });

  it("under-counts the fastest ewe, because the pulses are too close to resolve", () => {
    // 21 pulses were generated. At ~17 min between them and 5-min fractions,
    // adjacent pulses merge — the honest result, and the reason that dataset
    // is bundled.
    const n = run("sim_gnrh_thx_fast.csv", "webster1991_gnrh").summary.nPeaks;
    expect(n).toBeGreaterThan(11); // still clearly faster than the mean ewe
    expect(n).toBeLessThan(21);
  });

  it("gives a different answer from the app's defaults, which is the point", () => {
    // Where pulses are close together the window width decides how many
    // survive, so reproducing a published count needs that paper's windows —
    // which is why nPeak = 1 has to be typeable. On the well-separated record
    // the two settings happen to agree; on the fast one they do not.
    const asPublished = run("sim_gnrh_thx_fast.csv", "webster1991_gnrh").summary.nPeaks;
    const asDefault = run("sim_gnrh_thx_fast.csv", "default").summary.nPeaks;
    expect(asPublished).not.toBe(asDefault);
  });
});
