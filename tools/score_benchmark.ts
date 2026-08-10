// Score detectors on the generated benchmark (tools/simulate_benchmark.py).
//
// This is the Phase 1 validation gate and the Phase 2 baseline table from
// docs/deep-learning-handoff.md in one script. The gate: CLUSTER must score on
// this corpus roughly what it scores on real ground-truth data — 55-60%
// sensitivity at a near-zero false-positive rate. Land far from that and the
// simulator is wrong (too easy or too hard), and anything trained on it will
// not transfer.
//
//   npx vite-node tools/score_benchmark.ts
//   npx vite-node tools/score_benchmark.ts --sweep     # parameter sensitivity

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { clusterMain } from "../src/core/cluster.ts";
import { parseSeries } from "../src/core/csv.ts";
import { DEFAULT_PARAMS, type ClusterParams } from "../src/core/types.ts";

const DIR = "data/benchmark";
if (!existsSync(`${DIR}/truth.json`)) {
  console.error("No benchmark. Run: python3 tools/simulate_benchmark.py");
  process.exit(1);
}

interface Truth {
  records: Record<string, { true_onsets: number[]; params: Record<string, number> }>;
}
const truth = JSON.parse(readFileSync(`${DIR}/truth.json`, "utf8")) as Truth;
const files = readdirSync(`${DIR}/series`).filter((f) => f.endsWith(".csv")).sort();

/**
 * A true pulse counts as found when its onset falls within a detected pulse,
 * widened by one sampling interval at each end: CLUSTER flags the rise a
 * sample or so after secretion starts, so exact coincidence would understate
 * every detector. Each detection can only be credited once, so duplicated
 * detections on one pulse count as false positives.
 */
function score(onsets: number[], spans: { a: number; b: number }[], dt: number) {
  const used = new Set<number>();
  let tp = 0;
  for (const o of onsets) {
    const i = spans.findIndex((s, ix) => !used.has(ix) && o >= s.a - dt && o <= s.b + dt);
    if (i >= 0) {
      used.add(i);
      tp += 1;
    }
  }
  return { tp, missed: onsets.length - tp, fp: spans.length - used.size };
}

function run(over: Partial<ClusterParams>) {
  let tp = 0, missed = 0, fp = 0, detections = 0;
  for (const file of files) {
    const key = file.replace(/\.csv$/, "");
    const rec = truth.records[key];
    if (!rec) continue;
    const s = parseSeries(readFileSync(`${DIR}/series/${file}`, "utf8"));
    const dt = s.times![1] - s.times![0];
    try {
      const r = clusterMain(
        s.times!,
        s.values,
        { ...DEFAULT_PARAMS, errorModel: "Error Wave", ...over },
        s.error!,
      );
      const spans = r.peaks.map((p) => ({ a: s.times![p.iFirst], b: s.times![p.iLast] }));
      detections += spans.length;
      const sc = score(rec.true_onsets, spans, dt);
      tp += sc.tp;
      missed += sc.missed;
      fp += sc.fp;
    } catch {
      // window larger than the record: counts as finding nothing
      missed += rec.true_onsets.length;
    }
  }
  const total = tp + missed;
  return {
    tp, missed, fp, detections,
    sensitivity: (tp / total) * 100,
    fdr: detections ? (fp / detections) * 100 : 0,
  };
}

const sweep = process.argv.includes("--sweep");

console.log(`Benchmark: ${files.length} records, ${Object.values(truth.records)
  .reduce((n, r) => n + r.true_onsets.length, 0)} true pulses\n`);

if (!sweep) {
  for (const variant of ["igor", "fortran"] as const) {
    const r = run({ variant });
    console.log(
      `${variant.padEnd(8)} sens ${r.sensitivity.toFixed(1)}%  ` +
        `(${r.tp} found / ${r.missed} missed)  ` +
        `FP ${r.fp} of ${r.detections} detections (${r.fdr.toFixed(1)}% FDR)`,
    );
  }
  console.log("\nGATE: sensitivity 50-65% with FDR under ~5% means the corpus");
  console.log("behaves like real data. Far outside that and the simulator is wrong.");
} else {
  console.log("nPeak nNadir  t    variant   sens%   FDR%   found/missed");
  for (const variant of ["igor", "fortran"] as const)
    for (const np of [1, 2, 3])
      for (const nn of [1, 2, 3])
        for (const t of [1.5, 2, 2.5, 3]) {
          const r = run({ variant, nPeak: np, nNadir: nn, tScoreUp: t, tScoreDn: t });
          console.log(
            `${np}     ${nn}      ${String(t).padEnd(4)} ${variant.padEnd(8)} ` +
              `${r.sensitivity.toFixed(1).padStart(6)} ${r.fdr.toFixed(1).padStart(6)}   ` +
              `${r.tp}/${r.missed}`,
          );
        }
}
