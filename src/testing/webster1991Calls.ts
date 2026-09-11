// The pulse calls Webster et al. 1991 printed, read from disk, and the rule for
// matching detections to them.
//
// Test-only. `webster1991_pulses.csv` is the answer key and is kept out of the
// served bundle on purpose (see the glob in `src/samples.ts`), so nothing that
// ships may import this.
import { readFileSync } from "node:fs";

const FILE = "data/digitized/webster1991_pulses.csv";

/**
 * Sample indices of the pulses the paper marks, per series. Every series asked
 * for gets an entry, empty when the paper marks none in it.
 */
export function publishedCalls(series: string[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const s of series) out.set(s, new Set());
  for (const line of readFileSync(FILE, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || line.startsWith("series,")) continue;
    const [s, idx] = line.split(",");
    out.get(s)?.add(Number(idx));
  }
  return out;
}

/** One sample of slack: at this sampling rate a two-sample pulse has no single peak. */
export function matchCalls(found: number[], truth: Set<number>, slack = 1) {
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
