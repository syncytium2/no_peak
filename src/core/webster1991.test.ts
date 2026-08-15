// Scoring the port against real data with a published answer.
//
// The traces in data/digitized/ were read off the figures of Webster et al.
// 1991, which mark every pulse that paper's own CLUSTER run identified. Unlike
// every other check in this suite, the answer here was not produced by this
// code or by a simulator we wrote — it was written down by the authors in 1991.
//
// Two things are pinned. That the port agrees with those calls when it is given
// the assay error the hormones actually had; and that it does NOT agree when the
// error is estimated from the data, which is all a reader of the paper can do.
// The second is the more important number: it is the evidence for treating the
// error model as part of a reported method.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { parseSeries } from "./csv";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType } from "./types";

const DIR = "data/digitized";

/** Proportional CV plus a floor at the assay's detection limit. */
const ASSAY = { gnrh: { cv: 0.08, floor: 0.06 }, lh: { cv: 0.08, floor: 0.45 } };

const SERIES = [
  "fig3a_con_8058_gnrh", "fig3a_con_8058_lh",
  "fig3b_thx_8067_gnrh", "fig3b_thx_8067_lh",
  "fig4a_thx_9013_gnrh", "fig4a_thx_9013_lh",
  "fig4b_thx_9009_gnrh", "fig4b_thx_9009_lh",
];

function publishedCalls(): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const s of SERIES) out.set(s, new Set());
  for (const line of readFileSync(`${DIR}/webster1991_pulses.csv`, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("series,")) continue;
    const [series, idx] = line.split(",");
    out.get(series)!.add(Number(idx));
  }
  return out;
}

const load = (key: string) => parseSeries(readFileSync(`${DIR}/webster1991_${key}.csv`, "utf8"));

const paperParams = (isGnRH: boolean, errorModel: ErrorModelType): ClusterParams => ({
  ...DEFAULT_PARAMS,
  nPeak: 1, nNadir: 1,
  tScoreUp: isGnRH ? 3.2 : 2.32,
  tScoreDn: isGnRH ? 3.2 : 2.32,
  variant: "fortran",
  errorModel,
});

/** One sample of slack: at this sampling rate a two-sample pulse has no single peak. */
function match(found: number[], truth: Set<number>, slack = 1) {
  const unused = new Set(truth);
  let hit = 0;
  for (const f of found) {
    for (let d = 0; d <= slack; d++) {
      if (unused.has(f - d)) { unused.delete(f - d); hit++; break; }
      if (unused.has(f + d)) { unused.delete(f + d); hit++; break; }
    }
  }
  return { hit, missed: unused.size, extra: found.length - hit };
}

function score(errorModel: ErrorModelType | "assay") {
  const truth = publishedCalls();
  let hit = 0, missed = 0, extra = 0;
  for (const key of SERIES) {
    const isGnRH = key.endsWith("gnrh");
    const s = load(key);
    let r;
    if (errorModel === "assay") {
      const a = isGnRH ? ASSAY.gnrh : ASSAY.lh;
      r = clusterMain(s.times!, s.values, paperParams(isGnRH, "Error Wave"),
        s.values.map((v) => Math.max(a.floor, a.cv * v)));
    } else {
      r = clusterMain(s.times!, s.values, paperParams(isGnRH, errorModel));
    }
    const m = match(r.peaks.map((p) => p.iMax), truth.get(key)!);
    hit += m.hit; missed += m.missed; extra += m.extra;
  }
  return { hit, missed, extra };
}

describe("Webster et al. 1991, digitized", () => {
  it("carries all eight traces and the 70 published pulse calls", () => {
    const truth = publishedCalls();
    expect([...truth.values()].reduce((a, s) => a + s.size, 0)).toBe(70);
    // the counts printed inside each panel of the figure
    expect(truth.get("fig3b_thx_8067_gnrh")!.size).toBe(11);
    expect(truth.get("fig4a_thx_9013_gnrh")!.size).toBe(21);
    expect(truth.get("fig4a_thx_9013_lh")!.size).toBe(16);
    expect(truth.get("fig3a_con_8058_gnrh")!.size).toBe(0);
    expect(truth.get("fig4b_thx_9009_gnrh")!.size).toBe(0);
  });

  it("has the sampling grid the paper's Methods describes", () => {
    const gnrh = load("fig3b_thx_8067_gnrh");
    expect(gnrh.values).toHaveLength(73);              // every 5 min for 6 h
    expect(gnrh.times![1] - gnrh.times![0]).toBe(5);
    expect(gnrh.times![72]).toBe(360);
    const lh = load("fig3b_thx_8067_lh");
    expect(lh.values).toHaveLength(61);                // every 6 min for 6 h
    expect(lh.times![1] - lh.times![0]).toBe(6);
  });

  it("is on the scale the figures are drawn on", () => {
    // GnRH axis runs to 3 pg/min, LH to about 31 ng/ml
    for (const k of SERIES.filter((s) => s.endsWith("gnrh"))) {
      const v = load(k).values;
      expect(Math.max(...v)).toBeLessThan(3);
      expect(Math.min(...v)).toBeGreaterThan(0);
    }
    for (const k of SERIES.filter((s) => s.endsWith("lh"))) {
      expect(Math.max(...load(k).values)).toBeLessThan(31);
    }
  });

  it("recovers the published pulses when given the assay's own error", () => {
    const s = score("assay");
    expect(s.hit).toBeGreaterThanOrEqual(65);          // 67 of 70 as measured
    expect(s.extra).toBeLessThanOrEqual(3);
    const sensitivity = s.hit / (s.hit + s.missed);
    const precision = s.hit / (s.hit + s.extra);
    expect(sensitivity).toBeGreaterThan(0.9);
    expect(precision).toBeGreaterThan(0.95);
  });

  it("finds nothing in the two records the paper reports as pulse-free", () => {
    const truth = publishedCalls();
    for (const key of ["fig3a_con_8058_gnrh", "fig4b_thx_9009_gnrh"]) {
      expect(truth.get(key)!.size).toBe(0);
      const s = load(key);
      const a = ASSAY.gnrh;
      const r = clusterMain(s.times!, s.values, paperParams(true, "Error Wave"),
        s.values.map((v) => Math.max(a.floor, a.cv * v)));
      expect(r.summary.nPeaks).toBeLessThanOrEqual(1);  // 1% false positive rate
    }
  });

  it("does NOT reproduce the paper from its reported settings alone", () => {
    // The paper gives its windows and t-scores but not its error input. Every
    // estimator a reader could substitute gives a different answer, and none of
    // them gives the published one — which is the argument for reporting the
    // error model as part of the method.
    const models: ErrorModelType[] = ["Local SD", "Local SE", "Global SD", "Global SE", "SQRT"];
    const results = models.map((m) => ({ m, ...score(m) }));
    for (const r of results) {
      const ok = r.hit >= 65 && r.extra <= 3;
      expect(ok, `${r.m} unexpectedly reproduced the paper`).toBe(false);
    }
    // and the spread is not marginal: from finding none to a flood of extras
    expect(Math.min(...results.map((r) => r.hit))).toBe(0);
    // 44 as measured, all from Global SE, against 0 for the assay's own error.
    // This bound was >50 until 2026-08-15 and it was partly counting a
    // digitization artifact: three records alternated between the two edges of
    // the printed line, and the resulting sawtooth was itself detectable. The
    // claim under test is unaffected — no substitute model reproduces the paper
    // and the spread is still two orders of magnitude — but the old number
    // cannot be restored without restoring the artifact.
    expect(Math.max(...results.map((r) => r.extra))).toBeGreaterThan(30);
  });
});
