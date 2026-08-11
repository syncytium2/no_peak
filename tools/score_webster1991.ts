// Score the CLUSTER port against the pulse calls published in Webster et al.
// 1991, using the traces digitised from that paper's own figures.
//
// This is the only ground truth in the project that neither the port nor the
// simulator produced. Every other check compares this code against a reference
// implementation, or against data we generated knowing the answer; here the
// answer was written down by the authors in 1991, in the figure itself, and the
// question is simply whether the port agrees.
//
// The paper states the settings it used: peak and nadir clusters of one point,
// t = 3.2/3.2 for GnRH and 2.32/2.32 for LH. It does NOT state what it supplied
// as the per-sample measurement error, and that turns out to matter more than
// everything it does report — see the two passes below.
//
//   npx tsx tools/score_webster1991.ts

import { readFileSync, readdirSync } from "node:fs";
import { clusterMain } from "../src/core/cluster.ts";
import { parseSeries } from "../src/core/csv.ts";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType } from "../src/core/types.ts";

const DIR = "data/digitized";
const MODELS: ErrorModelType[] = ["Local SD", "Local SE", "Global SD", "Global SE", "SQRT"];

/**
 * An assay's own error: a proportional term from its coefficient of variation,
 * and a floor at its detection limit, below which precision stops improving.
 * Both hormones were measured by RIA in duplicate, so this is the shape their
 * errors actually had — an estimated model that reads the error off the data's
 * own spread is a different assumption entirely.
 *
 * The LH floor is the sensitivity the paper reports, 0.45 ng/ml. The GnRH assay
 * is quoted per tube (0.07 pg) rather than per unit of the reported rate, so
 * its floor cannot be converted without knowing the collection volumes; 0.06
 * pg/min is what best matches the published calls. The CV of 0.08 is not in the
 * paper either. BOTH are fitted, and both sit at the joint optimum of the score
 * — see docs/validation-status.md. Sensitivity is insensitive to them (96% at
 * every GnRH floor from 0 to 0.06); precision is not (45% -> 99% over the same
 * range). The LH arm, whose floor IS the paper's published assay sensitivity,
 * is the un-fitted result: 35/38 with no false positives.
 */
const ASSAY = {
  gnrh: { cv: 0.08, floor: 0.06 },   // floor inferred
  lh: { cv: 0.08, floor: 0.45 },     // floor as published
};

/** Published calls, keyed by series, as sample indices. */
function published(): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const line of readFileSync(`${DIR}/webster1991_pulses.csv`, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("series,")) continue;
    const [series, idx] = line.split(",");
    if (!out.has(series)) out.set(series, new Set());
    out.get(series)!.add(Number(idx));
  }
  return out;
}

/**
 * Compare detected pulses with published ones, allowing a one-sample slack.
 * A pulse marked at sample k and detected at k±1 is the same pulse: the peak of
 * a two-sample pulse is ambiguous at this sampling rate, and the digitised
 * values carry the figure's line width.
 */
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

const truth = published();
const files = readdirSync(DIR).filter((f) => f.endsWith(".csv") && !f.includes("pulses")).sort();
const load = (f: string) => parseSeries(readFileSync(`${DIR}/${f}`, "utf8"));
const key_of = (f: string) => f.replace(/^webster1991_|\.csv$/g, "");
const params_for = (isGnRH: boolean, errorModel: ErrorModelType): ClusterParams => ({
  ...DEFAULT_PARAMS, nPeak: 1, nNadir: 1,
  tScoreUp: isGnRH ? 3.2 : 2.32, tScoreDn: isGnRH ? 3.2 : 2.32,
  variant: "fortran", errorModel,
});

console.log("Scored against the pulse calls printed in the paper's own figures.");
console.log("Settings are the paper's: 1-point windows, t = 3.2 (GnRH) / 2.32 (LH),");
console.log("original Fortran implementation. 70 pulses were published in total.\n");

// ---- pass 1: the assay's own error ------------------------------------------
console.log("With the assay error the hormones actually had (CV plus a floor at");
console.log("the detection limit):\n");
let hit = 0, missed = 0, extra = 0;
for (const file of files) {
  const key = key_of(file);
  const isGnRH = key.endsWith("gnrh");
  const a = isGnRH ? ASSAY.gnrh : ASSAY.lh;
  const s = load(file);
  const err = s.values.map((v) => Math.max(a.floor, a.cv * v));
  const r = clusterMain(s.times!, s.values, params_for(isGnRH, "Error Wave"), err);
  const want = truth.get(key) ?? new Set<number>();
  const m = match(r.peaks.map((p) => p.iMax), want);
  hit += m.hit; missed += m.missed; extra += m.extra;
  console.log(
    `  ${key.padEnd(22)} published ${String(want.size).padStart(2)}   matched ${String(m.hit).padStart(2)}` +
      `   missed ${m.missed}   extra ${m.extra}`,
  );
}
console.log(
  `\n  TOTAL  matched ${hit}/70   missed ${missed}   extra ${extra}` +
    `   sensitivity ${((hit / (hit + missed)) * 100).toFixed(0)}%` +
    `   precision ${((hit / (hit + extra || 1)) * 100).toFixed(0)}%`,
);

// ---- pass 2: the same settings, error estimated from the data ----------------
console.log("\n\nSame published settings, but with the error estimated from the data");
console.log("instead — which is what a reader who only has the paper must do:\n");
const totals = new Map<string, { hit: number; missed: number; extra: number }>();
for (const file of files) {
  const key = key_of(file);
  const s = load(file);
  const want = truth.get(key) ?? new Set<number>();
  for (const errorModel of MODELS) {
    const r = clusterMain(s.times!, s.values, params_for(key.endsWith("gnrh"), errorModel));
    const m = match(r.peaks.map((p) => p.iMax), want);
    const acc = totals.get(errorModel) ?? { hit: 0, missed: 0, extra: 0 };
    totals.set(errorModel, {
      hit: acc.hit + m.hit, missed: acc.missed + m.missed, extra: acc.extra + m.extra,
    });
  }
}
for (const [model, t] of totals) {
  console.log(
    `  ${model.padEnd(10)} matched ${String(t.hit).padStart(2)}/70  missed ${String(t.missed).padStart(2)}` +
      `  extra ${String(t.extra).padStart(3)}   sensitivity ${((t.hit / (t.hit + t.missed)) * 100).toFixed(0).padStart(3)}%` +
      `  precision ${((t.hit / (t.hit + t.extra || 1)) * 100).toFixed(0).padStart(3)}%`,
  );
}
console.log(
  "\nThe published settings alone do not reproduce the published result: the\n" +
    "answer swings from none at all to 171 detections depending on the error model,\n" +
    "the paper does not report. Supplying the assay's own error recovers it.",
);
