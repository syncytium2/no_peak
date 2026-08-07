// CLI runner: apply the ported CLUSTER core to a CSV, print the summary.
// Usage: node --experimental-strip-types scripts/run_csv.ts <file.csv> [nPeak nNadir tUp tDn minPeak errorModel]
// Used for validation runs against Igor output without opening the browser.

import { readFileSync } from "node:fs";
import { clusterMain } from "../src/core/cluster.ts";
import { parseSeries } from "../src/core/csv.ts";
import { DEFAULT_PARAMS, type ErrorModelType } from "../src/core/types.ts";

const [file, nPeak = "2", nNadir = "2", tUp = "2", tDn = "2", minPeak = "0", errorModel = "Local SD"] =
  process.argv.slice(2);

const series = parseSeries(readFileSync(file, "utf8"));
const times = series.times ?? series.values.map((_, i) => i + 1);

const result = clusterMain(
  times,
  series.values,
  {
    ...DEFAULT_PARAMS,
    nPeak: Number(nPeak),
    nNadir: Number(nNadir),
    tScoreUp: Number(tUp),
    tScoreDn: Number(tDn),
    minPeak: Number(minPeak),
    errorModel: errorModel as ErrorModelType,
  },
  series.error ?? undefined,
);

console.log(`${file}: ${series.values.length} points`);
console.log(`peaks: ${result.summary.nPeaks}, valleys: ${result.summary.nValleys}`);
for (const [i, p] of result.peaks.entries()) {
  console.log(
    `  peak ${i + 1}: t=${times[p.iMax]} range ${times[p.iFirst]}-${times[p.iLast]} height ${p.height}`,
  );
}
const pulseStr = result.pulse.join("");
console.log(`pulse: ${pulseStr}`);
