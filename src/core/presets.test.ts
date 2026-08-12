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
    // The Fortran variant because that is what existed in 1991 — the paper
    // cites Veldhuis & Johnson's program, not the later Igor package.
    expect(preset("webster1991_gnrh").params).toEqual({
      nPeak: 1, nNadir: 1, tScoreUp: 3.2, tScoreDn: 3.2, variant: "fortran",
      errorModel: "Error Wave",
    });
    expect(preset("webster1991_lh").params).toEqual({
      nPeak: 1, nNadir: 1, tScoreUp: 2.32, tScoreDn: 2.32, variant: "fortran",
      errorModel: "Error Wave",
    });
  });

  // The defect this guards against: a preset that sets the windows and the
  // t-scores but not the error model is not reproducible. Selecting it on a file
  // with no error column left the app on Local SD, which at one-point windows
  // finds nothing at all — the published settings appeared to give no pulses.
  it("carries the error model, so selecting a preset configures the whole analysis", () => {
    for (const key of ["webster1991_gnrh", "webster1991_lh"]) {
      expect(preset(key).params.errorModel).toBe("Error Wave");
    }
  });

  it("reproduces the published count straight from the preset", () => {
    // exactly what the app does when a user picks the dataset and the preset
    const s = parseSeries(readFileSync("data/digitized/webster1991_fig3b_thx_8067_gnrh.csv", "utf8"));
    expect(s.error).not.toBeNull(); // the file carries its reconstructed error
    const r = clusterMain(
      s.times!, s.values,
      { ...DEFAULT_PARAMS, ...preset("webster1991_gnrh").params },
      s.error!,
    );
    expect(r.summary.nPeaks).toBe(11); // the count printed in that figure
  });

  it("recognizes the current parameters as a preset, and edits as custom", () => {
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

  it("finds about one false positive in the pulse-free control, as advertised", () => {
    // No pulses were generated in this record, so anything found is a false
    // positive. The paper states these settings carry a 1% false positive rate,
    // and 1% of 72 samples is about 0.7 — so one is the expected result, not a
    // defect. Asserting zero would be asserting the detector is better than its
    // own authors claimed.
    const n = run("sim_gnrh_intact.csv", "webster1991_gnrh").summary.nPeaks;
    expect(n).toBeLessThanOrEqual(2);
  });

  it("under-counts the fastest ewe, because the pulses are too close to resolve", () => {
    // 21 pulses were generated. At ~17 min between them and 5-min fractions,
    // adjacent pulses merge — the honest result, and the reason that dataset
    // is bundled.
    const n = run("sim_gnrh_thx_fast.csv", "webster1991_gnrh").summary.nPeaks;
    expect(n).toBeGreaterThan(11); // still clearly faster than the mean ewe
    expect(n).toBeLessThan(21);
  });

  // The property that makes the count above trustworthy rather than a
  // coincidence of tuning: it does not move when the data is rescaled.
  it("returns the same count whatever units the data is expressed in", () => {
    const s = parseSeries(readFileSync("data/synthetic/sim_gnrh_thx_ewe.csv", "utf8"));
    const counts = [0.01, 1, 100, 10_000].map(
      (k) =>
        clusterMain(
          s.times!,
          s.values.map((v) => v * k),
          { ...DEFAULT_PARAMS, ...preset("webster1991_gnrh").params, errorModel: "Error Wave" },
          s.error!.map((e) => e * k),
        ).summary.nPeaks,
    );
    expect(counts).toEqual([11, 11, 11, 11]);
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
