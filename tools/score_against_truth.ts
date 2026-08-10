// Score the port against SIMULATED data with known answers.
//
// Every other test here asks "does the port match the reference
// implementations?". This asks the different and harder question: "does it
// find the pulses that are actually there?" — which is only answerable on
// simulated series whose generating pulse times are known.
//
// The data comes from Michael Johnson's Pulse_XP distribution (Data/lhsim*.dat,
// ghsim*.dat with matching .ans files). It is not redistributed here; point
// PULSEXP_DATA at a local copy.
//
//   PULSEXP_DATA=/path/to/Pulse_XP/Data npx vite-node tools/score_against_truth.ts
//
// File formats, reverse-engineered from the files themselves:
//   .dat  header lines start with ! or ;  — includes !ANSWERS(n), which is
//         AutoDecon's *fit*, not the truth. Data rows are tab-separated:
//         value, SD, time, nreps, fitted-conc, secretion, (-1e35 = missing)
//   .ans  the generating truth: BASAL SEC., CONC(T=0), SEC. SD., HALF-LIFE,
//         then POSITION-nnn / LogHeight-nnn pairs. The POSITION values are
//         pulse onset times in the same units as the data.

import { readFileSync, existsSync } from "node:fs";
import { clusterMain } from "../src/core/cluster.ts";
import { DEFAULT_PARAMS } from "../src/core/types.ts";

const DIR = process.env.PULSEXP_DATA ?? "";
if (!DIR || !existsSync(DIR)) {
  console.error("Set PULSEXP_DATA to the Pulse_XP Data folder (not distributed here).");
  process.exit(1);
}

interface Series {
  times: number[];
  values: number[];
  errors: number[];
}

function readDat(file: string): Series {
  const times: number[] = [], values: number[] = [], errors: number[] = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("!") || line.startsWith(";")) continue;
    const c = line.split(/\t+/).map(Number);
    if (c.length < 3 || !Number.isFinite(c[0])) continue;
    values.push(c[0]);
    errors.push(c[1]);
    times.push(c[2]);
  }
  return { times, values, errors };
}

/** Generating pulse onset times from the .ans file. */
function readTruth(file: string): number[] {
  const out: number[] = [];
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(-?[\d.]+(?:E[-+]?\d+)?)\s+\w\s+POSITION-\d+/i);
    if (m) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

/**
 * A true pulse counts as detected when its onset falls inside a detected
 * pulse's span, widened by one sampling interval at each end — CLUSTER flags
 * the rise a sample or so after secretion begins, so demanding exact
 * coincidence would understate every algorithm.
 */
function score(truth: number[], detected: { start: number; end: number }[], dt: number) {
  const used = new Set<number>();
  let hit = 0;
  for (const t of truth) {
    const i = detected.findIndex(
      (d, idx) => !used.has(idx) && t >= d.start - dt && t <= d.end + dt,
    );
    if (i >= 0) {
      used.add(i);
      hit += 1;
    }
  }
  return { truePositives: hit, missed: truth.length - hit, falsePositives: detected.length - used.size };
}

const CASES = ["lhsim1", "lhsim2", "lhsim3", "ghsim1", "ghsim2", "ghsim3"];
// Counts published in Pulse_XP's Data/simulated.txt: simulated, Cluster, AutoDecon
const PUBLISHED: Record<string, { sim: number; cluster: number; autodecon: number }> = {
  lhsim1: { sim: 17, cluster: 14, autodecon: 16 },
  lhsim2: { sim: 25, cluster: 14, autodecon: 25 },
  lhsim3: { sim: 30, cluster: 16, autodecon: 30 },
  ghsim1: { sim: 18, cluster: 7, autodecon: 19 },
  ghsim2: { sim: 23, cluster: 13, autodecon: 21 },
  ghsim3: { sim: 17, cluster: 11, autodecon: 17 },
};

console.log(
  "case      n   dt   true  found   TP  miss   FP   sens%   | published: Cluster / AutoDecon",
);
let tTP = 0, tMiss = 0, tFP = 0;

for (const name of CASES) {
  const dat = `${DIR}/${name}.dat`;
  const ans = `${DIR}/${name}.ans`;
  if (!existsSync(dat) || !existsSync(ans)) {
    console.log(`${name}: missing`);
    continue;
  }
  const s = readDat(dat);
  const truth = readTruth(ans);
  const dt = s.times[1] - s.times[0];

  const r = clusterMain(
    s.times,
    s.values,
    { ...DEFAULT_PARAMS, errorModel: "Error Wave", variant: "igor" },
    s.errors,
  );
  const detected = r.peaks.map((p) => ({ start: s.times[p.iFirst], end: s.times[p.iLast] }));
  const sc = score(truth, detected, dt);
  tTP += sc.truePositives;
  tMiss += sc.missed;
  tFP += sc.falsePositives;

  const pub = PUBLISHED[name];
  const sens = ((sc.truePositives / truth.length) * 100).toFixed(0);
  console.log(
    `${name.padEnd(8)} ${String(s.values.length).padStart(3)} ${String(dt).padStart(4)} ` +
      `${String(truth.length).padStart(6)} ${String(detected.length).padStart(6)} ` +
      `${String(sc.truePositives).padStart(4)} ${String(sc.missed).padStart(5)} ` +
      `${String(sc.falsePositives).padStart(4)} ${sens.padStart(6)}%   | ` +
      `${pub ? `${pub.cluster} / ${pub.autodecon} (of ${pub.sim})` : ""}`,
  );
}

const total = tTP + tMiss;
console.log(
  `\nTOTAL: ${tTP}/${total} true pulses found (${((tTP / total) * 100).toFixed(1)}% sensitivity), ` +
    `${tFP} false positives`,
);
