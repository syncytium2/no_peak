// The Igor implementation's t-score is not scale-invariant. The original
// Fortran's is. This suite pins both, because the difference decides whether a
// published t threshold means anything without its units attached.
//
// mScore builds the pooled term as
//     S = sqrt( sum_i NDF*STDEV[i] / (df) )
// in the Igor path, where the Fortran sums STDEV[i]**2. Squared, that is a
// pooled variance and S carries the units of the data, so t is dimensionless.
// Unsquared, S carries units of sqrt(data), and t therefore scales as
// sqrt(k) when the data is multiplied by k — even though multiplying a record
// by a constant cannot change anything about its pulses.
//
// Consequence for a user: the same record in ng/ml and in pg/ml gives different
// pulse counts at the same threshold, under the app's default implementation.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { parseSeries } from "./csv";
import { hasScaleDependence } from "./presets";
import { DEFAULT_PARAMS, type ClusterParams } from "./types";

const series = () => parseSeries(readFileSync("data/synthetic/sim_gnrh_thx_ewe.csv", "utf8"));

/** Pulse counts for the same record multiplied by each of `factors`. */
function countsAcrossScales(params: Partial<ClusterParams>, factors: number[]): number[] {
  const s = series();
  return factors.map(
    (k) =>
      clusterMain(
        s.times!,
        s.values.map((v) => v * k),
        { ...DEFAULT_PARAMS, errorModel: "Error Wave", ...params },
        s.error!.map((e) => e * k),
      ).summary.nPeaks,
  );
}

const FACTORS = [0.01, 1, 100, 10_000];
const ONE_POINT = { nPeak: 1, nNadir: 1, tScoreUp: 3.2, tScoreDn: 3.2 } as const;

describe("scale invariance", () => {
  it("the original Fortran is invariant: same answer in any units", () => {
    const c = countsAcrossScales({ ...ONE_POINT, variant: "fortran" }, FACTORS);
    expect(new Set(c).size).toBe(1);
    expect(c[0]).toBe(11);
  });

  it("the Igor port is not: rescaling the same data changes the count", () => {
    // Not a rounding wobble — it runs from finding nothing to finding more
    // pulses than were generated.
    const c = countsAcrossScales({ ...ONE_POINT, variant: "igor" }, FACTORS);
    expect(new Set(c).size).toBeGreaterThan(1);
    expect(c[0]).toBe(0);
    expect(c[c.length - 1]).toBeGreaterThan(c[0]);
  });

  it("bites hardest at narrow windows, because S pools fewer terms", () => {
    const spread = (p: Partial<ClusterParams>) => {
      const c = countsAcrossScales({ ...p, variant: "igor" }, FACTORS);
      return Math.max(...c) - Math.min(...c);
    };
    const narrow = spread(ONE_POINT);
    const wide = spread({ nPeak: 3, nNadir: 3, tScoreUp: 2, tScoreDn: 2 });
    expect(narrow).toBeGreaterThan(wide);
  });

  it("warns for exactly the settings where it matters", () => {
    const p = (o: Partial<ClusterParams>): ClusterParams => ({ ...DEFAULT_PARAMS, ...o });
    expect(hasScaleDependence(p({ variant: "igor", nPeak: 1, nNadir: 1 }))).toBe(true);
    expect(hasScaleDependence(p({ variant: "igor", nPeak: 2, nNadir: 1 }))).toBe(true);
    // The Fortran path is sound at any window width.
    expect(hasScaleDependence(p({ variant: "fortran", nPeak: 1, nNadir: 1 }))).toBe(false);
    // Wider windows dilute it enough not to be worth a warning.
    expect(hasScaleDependence(p({ variant: "igor", nPeak: 2, nNadir: 2 }))).toBe(false);
  });

  it("affects a pulse-free control too — false positives appear from rescaling", () => {
    const s = parseSeries(readFileSync("data/synthetic/sim_gnrh_intact.csv", "utf8"));
    const count = (k: number, variant: "igor" | "fortran") =>
      clusterMain(
        s.times!,
        s.values.map((v) => v * k),
        { ...DEFAULT_PARAMS, ...ONE_POINT, variant, errorModel: "Error Wave" },
        s.error!.map((e) => e * k),
      ).summary.nPeaks;

    expect(count(10_000, "igor")).toBeGreaterThan(count(1, "igor"));
    expect(count(10_000, "fortran")).toBe(count(1, "fortran"));
  });
});
