// Sample datasets bundled with the app — every wave extracted from the Igor
// experiment (data/extracted/, via tools/pxp_extract.py) plus the synthetic
// demo. All 11 CSVs together are ~9 KB, so they ship inline rather than being
// fetched, which keeps the "nothing leaves your machine" promise intact.

import { parseSeries, type ParsedSeries } from "./core/csv";
import { demoSeries } from "./demo";

import gnrhCsv from "../data/extracted/gnrh.csv?raw";
import set1Csv from "../data/extracted/set1.csv?raw";
import lhInfusedCsv from "../data/extracted/LHInfused.csv?raw";
import man2Csv from "../data/extracted/man2.csv?raw";
import man3Csv from "../data/extracted/man3.csv?raw";
import man4Csv from "../data/extracted/man4.csv?raw";
import man5Csv from "../data/extracted/man5.csv?raw";
import man6Csv from "../data/extracted/man6.csv?raw";
import null1Csv from "../data/extracted/null1.csv?raw";
import wave0Csv from "../data/extracted/wave0.csv?raw";
import wave1Csv from "../data/extracted/wave1.csv?raw";

export interface Sample {
  key: string;
  /** Group heading in the picker. */
  group: string;
  /** Short human label; the point count is appended at render time. */
  label: string;
  load: () => ParsedSeries;
}

const csv = (text: string) => () => parseSeries(text);

export const SAMPLES: Sample[] = [
  // Igor waves that carry a per-sample error column, so "Error Wave" works.
  { key: "gnrh", group: "Igor data (with error)", label: "GnRH", load: csv(gnrhCsv) },
  { key: "set1", group: "Igor data (with error)", label: "set1 (10-min sampling)", load: csv(set1Csv) },
  {
    key: "LHInfused",
    group: "Igor data (with error)",
    label: "LH infused",
    load: csv(lhInfusedCsv),
  },

  // Value-only series used for manual testing in the Igor experiment.
  { key: "man2", group: "Igor test series", label: "man2", load: csv(man2Csv) },
  { key: "man3", group: "Igor test series", label: "man3", load: csv(man3Csv) },
  { key: "man4", group: "Igor test series", label: "man4", load: csv(man4Csv) },
  { key: "man5", group: "Igor test series", label: "man5", load: csv(man5Csv) },
  { key: "man6", group: "Igor test series", label: "man6", load: csv(man6Csv) },
  { key: "null1", group: "Igor test series", label: "null1", load: csv(null1Csv) },
  { key: "wave0", group: "Igor test series", label: "wave0 (scratch)", load: csv(wave0Csv) },
  { key: "wave1", group: "Igor test series", label: "wave1 (scratch)", load: csv(wave1Csv) },

  {
    key: "demo",
    group: "Synthetic",
    label: "Demo (seeded LH-like series)",
    load: () => {
      const { times, values } = demoSeries();
      return { times, values, error: null, labels: null };
    },
  },
];

export const SAMPLE_GROUPS = [...new Set(SAMPLES.map((s) => s.group))];

/** Point counts for the picker labels; a file that fails to parse is skipped. */
export const sampleCounts: Record<string, number> = Object.fromEntries(
  SAMPLES.flatMap((s) => {
    try {
      return [[s.key, s.load().values.length]];
    } catch {
      return [];
    }
  }),
);
