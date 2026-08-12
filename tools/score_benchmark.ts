// Score detectors on the generated benchmark (tools/simulate_benchmark.py).
//
// This is the Phase 1 validation gate and the Phase 2 baseline table from
// docs/deep-learning-handoff.md in one script.
//
// THE GATE, stated once and only here. It is judged on the **dense** profile,
// which is the only corpus with a published anchor: it is shaped after
// Johnson's reference datasets, for which he published a Cluster figure of
// ~58%. Both arms must hold —
//
//     sensitivity   50-65%
//     FDR           under 1%
//
// Land far from that and the simulator is wrong (too easy or too hard), and
// anything trained on it will not transfer.
//
// DO NOT "FIX" THE DENSE PROFILE'S SAMPLING RATE. Its half-life draw against a
// fixed 10-minute interval puts every dense record at 2-5 samples per
// half-life, which is below the adequacy rule of Veldhuis & Johnson 1994 and
// looks like a bug. It is not: the profile is anchored to what Johnson's real
// datasets actually sampled, and raising the rate would break the one anchor
// the gate has. See docs/validation-status.md, "VJ's direction rule passes".
//
// On the **broad** corpus neither arm is a gate, and the script does not fail
// on it. A 15-25% FDR there is expected rather than a bug — see
// docs/validation-status.md, "CLUSTER's near-zero false-positive rate is
// partly a property of the benchmark". Broad-corpus sensitivity has no
// published anchor at all, and `--strata` shows what it is actually tracking.
//
//   npx vite-node tools/score_benchmark.ts
//   npx vite-node tools/score_benchmark.ts --sweep            # 72-combination sensitivity
//   npx vite-node tools/score_benchmark.ts --strata           # score by regime
//   npx vite-node tools/score_benchmark.ts --dir /tmp/dense   # score another corpus

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { clusterMain } from "../src/core/cluster.ts";
import { parseSeries } from "../src/core/csv.ts";
import { DEFAULT_PARAMS, type ClusterParams } from "../src/core/types.ts";

const dirArg = process.argv.indexOf("--dir");
const DIR = dirArg >= 0 ? process.argv[dirArg + 1] : "data/benchmark";
if (!DIR || !existsSync(`${DIR}/truth.json`)) {
  console.error(
    `No benchmark at ${DIR}. Run: python3 tools/simulate_benchmark.py [--profile dense --out DIR]`,
  );
  process.exit(1);
}

interface Rec {
  true_onsets: number[];
  params: Record<string, number | string>;
}
const truth = JSON.parse(readFileSync(`${DIR}/truth.json`, "utf8")) as {
  records: Record<string, Rec>;
};
const files = readdirSync(`${DIR}/series`).filter((f) => f.endsWith(".csv")).sort();

/**
 * Which profile generated this corpus, for deciding whether the gate applies.
 * Corpora written before the generator recorded it have no `profile` key; those
 * report as unknown and are not gated, rather than being assumed broad.
 */
function corpusProfile(): "broad" | "dense" | "unknown" {
  const seen = new Set(
    Object.values(truth.records).map((r) => String(r.params.profile ?? "unknown")),
  );
  if (seen.size !== 1) return "unknown";
  const only = [...seen][0];
  return only === "broad" || only === "dense" ? only : "unknown";
}

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

/** Per-record outcome, kept so `--strata` can group without re-running CLUSTER. */
interface Row {
  samplesPerHalfLife: number;
  samplingMin: number;
  halfLifeMin: number;
  density: number;
  /** log(median pulse mass / basal); NaN for corpora generated before it was recorded. */
  massMu: number;
  /** assay CV in the middle of the curve. */
  cvMid: number;
  tp: number;
  missed: number;
  fp: number;
  detections: number;
}

function runRows(over: Partial<ClusterParams>): Row[] {
  const rows: Row[] = [];
  for (const file of files) {
    const key = file.replace(/\.csv$/, "");
    const rec = truth.records[key];
    if (!rec) continue;
    const halfLife = Number(rec.params.half_life_min);
    const sampling = Number(rec.params.sampling_min);
    const nPoints = Number(rec.params.n_points);
    const shape = {
      samplesPerHalfLife: halfLife / sampling,
      samplingMin: sampling,
      halfLifeMin: halfLife,
      density: rec.true_onsets.length / nPoints,
      massMu: Number(rec.params.mass_mu ?? NaN),
      cvMid: Number(rec.params.cv_mid ?? NaN),
    };
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
      rows.push({ ...shape, ...score(rec.true_onsets, spans, dt), detections: spans.length });
    } catch {
      // window larger than the record: counts as finding nothing
      rows.push({ ...shape, tp: 0, missed: rec.true_onsets.length, fp: 0, detections: 0 });
    }
  }
  return rows;
}

function total(rows: Row[]) {
  const tp = rows.reduce((n, r) => n + r.tp, 0);
  const missed = rows.reduce((n, r) => n + r.missed, 0);
  const fp = rows.reduce((n, r) => n + r.fp, 0);
  const detections = rows.reduce((n, r) => n + r.detections, 0);
  return {
    n: rows.length, tp, missed, fp, detections,
    sensitivity: (tp / (tp + missed)) * 100,
    fdr: detections ? (fp / detections) * 100 : 0,
  };
}

const run = (over: Partial<ClusterParams>) => total(runRows(over));

const sweep = process.argv.includes("--sweep");
const strata = process.argv.includes("--strata");
const profile = corpusProfile();

console.log(
  `Benchmark: ${files.length} records, ${Object.values(truth.records)
    .reduce((n, r) => n + r.true_onsets.length, 0)} true pulses, ` +
    `profile ${profile}  (${DIR})\n`,
);

if (sweep) {
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
} else if (strata) {
  // Veldhuis & Johnson 1994 (Methods Enzymol 240:377-414, pp. 388-389) predict
  // that decreasing pulse amplitude, increasing experimental uncertainty,
  // increasing pulse frequency and diminished sampling intensity each drive
  // detection errors up. These are the four axes this generator varies that map
  // onto that prediction, so the corpus can be checked for the right sign.
  //
  // Two cautions on reading the output:
  //
  // 1. FDR's denominator is the detection count, which grows with pulse
  //    frequency, so FDR can fall while the false-positive count rises. Testing
  //    VJ's frequency rule properly needs a per-sample false-positive rate,
  //    which this script does not compute.
  // 2. The first two axes are NOT independent. Samples per half-life is set by
  //    the sampling interval, which also sets the record length and therefore
  //    the density. Amplitude and CV are the clean axes — nothing else in the
  //    generator is drawn from them.
  const BANDS: { title: string; of: (r: Row) => number; cuts: number[] }[] = [
    {
      // NOT a test of either VJ rule: this is half_life/dt, and VJ's half-life
      // and sampling-intensity rules push the ratio in opposite directions. Kept
      // because it is how VJ state their adequacy rule. Read the next two axes
      // instead for the direction rules.
      title: "samples per half-life (VJ's adequacy rule wants 5+; NOT a direction test)",
      of: (r) => r.samplesPerHalfLife,
      cuts: [2, 5, 10],
    },
    {
      // Confounded with density: density is roughly dt/mean_ipi in this
      // generator, so coarser sampling mechanically means denser records.
      // Separating them needs one record resampled at several intervals.
      title: "sampling interval, min (confounded with density — see validation-status)",
      of: (r) => r.samplingMin,
      cuts: [5, 10],
    },
    { title: "half-life, min (does not reproduce VJ's rule)", of: (r) => r.halfLifeMin, cuts: [20, 35] },
    { title: "pulse density (true pulses per sample)", of: (r) => r.density, cuts: [0.05, 0.1, 0.15] },
    {
      title: "pulse amplitude, log median mass over basal (clean axis)",
      of: (r) => r.massMu,
      cuts: [0, 0.7, 1.2],
    },
    { title: "assay CV in mid-curve (clean axis)", of: (r) => r.cvMid, cuts: [0.075, 0.1, 0.125] },
  ];
  for (const variant of ["igor", "fortran"] as const) {
    const rows = runRows({ variant });
    const all = total(rows);
    console.log(
      `${variant} — overall ${all.sensitivity.toFixed(1)}% sensitivity, ${all.fdr.toFixed(1)}% FDR`,
    );
    for (const band of BANDS) {
      // Corpora generated before an axis was recorded report NaN for it; skip
      // the axis rather than printing a heading with no rows under it.
      if (rows.every((r) => !Number.isFinite(band.of(r)))) {
        console.log(`  by ${band.title} — not recorded in this corpus, skipped`);
        continue;
      }
      console.log(`  by ${band.title}`);
      const edges = [-Infinity, ...band.cuts, Infinity];
      for (let i = 0; i < edges.length - 1; i++) {
        const [lo, hi] = [edges[i], edges[i + 1]];
        const t = total(rows.filter((r) => band.of(r) >= lo && band.of(r) < hi));
        if (!t.n) continue;
        const label =
          lo === -Infinity ? `under ${hi}` : hi === Infinity ? `${lo} and up` : `${lo} to ${hi}`;
        console.log(
          `    ${label.padEnd(12)} n=${String(t.n).padStart(3)}  ` +
            `sens ${t.sensitivity.toFixed(1).padStart(5)}%  FDR ${t.fdr.toFixed(1).padStart(5)}%  ` +
            `(${t.tp}/${t.tp + t.missed})`,
        );
      }
    }
    console.log();
  }
} else {
  const results = { igor: run({ variant: "igor" }), fortran: run({ variant: "fortran" }) };
  for (const [variant, r] of Object.entries(results)) {
    console.log(
      `${variant.padEnd(8)} sens ${r.sensitivity.toFixed(1)}%  ` +
        `(${r.tp} found / ${r.missed} missed)  ` +
        `FP ${r.fp} of ${r.detections} detections (${r.fdr.toFixed(1)}% FDR)`,
    );
  }

  console.log("\nGATE  sensitivity 50-65%, FDR under 1% — judged on the dense profile only.");
  if (profile !== "dense") {
    console.log(
      `      Not enforced here: this corpus is ${profile}, which has no published anchor.\n` +
        "      A 15-25% FDR on the broad corpus is expected, not a bug; run --strata\n" +
        "      to see what its sensitivity tracks. Regenerate the gated corpus with\n" +
        "      python3 tools/simulate_benchmark.py --profile dense --n 40 --seed 7 --out /tmp/dense",
    );
  } else {
    const failures = Object.entries(results).flatMap(([variant, r]) => [
      ...(r.sensitivity < 50 || r.sensitivity > 65
        ? [`${variant} sensitivity ${r.sensitivity.toFixed(1)}% outside 50-65%`]
        : []),
      ...(r.fdr >= 1 ? [`${variant} FDR ${r.fdr.toFixed(1)}% is 1% or more`] : []),
    ]);
    if (failures.length) {
      console.log(`\nGATE FAILED:\n  ${failures.join("\n  ")}`);
      process.exit(1);
    }
    console.log("      PASSED on both variants.");
  }
}
