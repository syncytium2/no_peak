// The no_peak command line: run CLUSTER over one record or a whole directory
// of them, without a browser.
//
//   node scripts/cluster.ts data/digitized/*.csv > summary.csv
//   node scripts/cluster.ts records/ --preset webster1991_lh -o summary.csv
//   npm run cluster -- records/ --n-peak 3 --t-up 2.5 --unit min --interval 10
//
// Output is the same one-row-per-record table the app's "Per-record CSV"
// button downloads — `segmentsToCSV`, shared rather than reimplemented, so a
// batch run and a run in the browser cannot drift apart. `--verbose` adds a
// per-pulse listing on stderr, which is what the Igor validation runs read;
// stdout stays a clean CSV so `>` and a pipe both work.
//
// Every record is analyzed under one set of detection settings. That is the
// point of a batch: tuning CLUSTER per animal makes the pulse counts
// incomparable between animals, which is the whole argument in
// src/core/segments.ts. Records are still analyzed independently — nothing is
// concatenated, no window spans two files.
//
// This runs on plain `node` with no loader and no extra dependency: Node strips
// the types, and src/core/ imports carry explicit .ts extensions so bare Node
// can resolve them. `npx vite-node scripts/cluster.ts` also works, and is what
// tools/score_*.ts use.

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseSeries } from "../src/core/csv.ts";
import { resolveErrorModel } from "../src/core/errorModel.ts";
import { PRESETS } from "../src/core/presets.ts";
import { runSegments, segmentsToCSV, type SegmentResult } from "../src/core/segments.ts";
import { timeUnitDef, pulseFrequency, type TimeUnit } from "../src/core/timeUnits.ts";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType } from "../src/core/types.ts";

const ERROR_MODELS: ErrorModelType[] = [
  "Global SD",
  "Global SE",
  "Local SD",
  "Local SE",
  "SQRT",
  "Fixed",
  "Error Wave",
];

const TIME_UNIT_KEYS: TimeUnit[] = ["s", "min", "h", "samples"];

/** Extensions treated as data when a directory is given. */
const DATA_EXTENSIONS = [".csv", ".tsv", ".txt"];

export interface CliOptions {
  inputs: string[];
  params: ClusterParams;
  unit: TimeUnit;
  /** Sampling interval for files with no time column, in `unit`. */
  interval: number;
  out: string | null;
  verbose: boolean;
  /** Stop on the first record that cannot be analyzed, rather than skipping it. */
  strict: boolean;
  /** Which preset supplied the parameters, for the provenance header. */
  preset: (typeof PRESETS)[number] | null;
}

const USAGE = `no_peak — CLUSTER pulse detection from the command line

  node scripts/cluster.ts <file|directory>... [options]
  npm run cluster -- <file|directory>... [options]

Input is one or more CSV/TSV files, or directories of them. Each accepts
value; time,value; or time,value,error columns, header row optional.

Detection settings (the defaults are the app's):
  --n-peak N            points in the test window            (${DEFAULT_PARAMS.nPeak})
  --n-nadir N           points in the baseline window        (${DEFAULT_PARAMS.nNadir})
  --t-up X              t-score for a significant increase   (${DEFAULT_PARAMS.tScoreUp})
  --t-dn X              t-score for a significant decrease   (${DEFAULT_PARAMS.tScoreDn})
  --min-peak X          minimum data value for a pulse       (${DEFAULT_PARAMS.minPeak})
  --error-model NAME    ${ERROR_MODELS.join(", ")}
                                                             (${DEFAULT_PARAMS.errorModel})
  --error-value X       value for Fixed; SQRT's fallback     (${DEFAULT_PARAMS.errorValue})
  --variant igor|fortran  which reference implementation     (${DEFAULT_PARAMS.variant})
  --zero-terminate X    end pulses at or below X
  --no-truncated        drop pulses whose end the record cuts off
  --preset KEY          published settings; --list-presets to see them

Time axis:
  --unit s|min|h|samples   units of the time column          (min)
  --interval X             sampling interval, for files with no time column (1)

Output:
  -o, --out FILE        write the summary CSV here      (default: stdout)
  -v, --verbose         list every pulse, on stderr
  --strict              stop on the first unreadable record
  -h, --help            this message
`;

class CliError extends Error {}

const num = (raw: string | undefined, flag: string): number => {
  const v = Number(raw);
  if (raw === undefined || raw === "" || !Number.isFinite(v)) {
    throw new CliError(`${flag} needs a number, got ${raw === undefined ? "nothing" : `"${raw}"`}.`);
  }
  return v;
};

/**
 * Parse argv into options. Exported so the tests can check the flag table
 * without spawning a process; `main` does the file I/O.
 */
export function parseArgs(argv: string[]): CliOptions {
  const params: ClusterParams = { ...DEFAULT_PARAMS };
  const opts: CliOptions = {
    inputs: [],
    params,
    unit: "min",
    interval: 1,
    out: null,
    verbose: false,
    strict: false,
    preset: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    switch (arg) {
      case "--n-peak": params.nPeak = num(value(), arg); break;
      case "--n-nadir": params.nNadir = num(value(), arg); break;
      case "--t-up": params.tScoreUp = num(value(), arg); break;
      case "--t-dn": params.tScoreDn = num(value(), arg); break;
      case "--min-peak": params.minPeak = num(value(), arg); break;
      case "--error-value": params.errorValue = num(value(), arg); break;
      case "--interval": opts.interval = num(value(), arg); break;

      case "--error-model": {
        const v = value();
        // Case- and space-insensitive: "local sd" and "Local SD" are the same
        // model, and quoting a space on a shell prompt is a papercut.
        const model = ERROR_MODELS.find(
          (m) => m.toLowerCase().replace(/\s+/g, "") === String(v).toLowerCase().replace(/\s+/g, ""),
        );
        if (!model) {
          throw new CliError(`Unknown error model "${v}". One of: ${ERROR_MODELS.join(", ")}.`);
        }
        params.errorModel = model;
        break;
      }

      case "--variant": {
        const v = value();
        if (v !== "igor" && v !== "fortran") {
          throw new CliError(`--variant is igor or fortran, got "${v}".`);
        }
        params.variant = v;
        break;
      }

      case "--zero-terminate":
        params.zeroTerminate = true;
        params.zero = num(value(), arg);
        break;

      case "--no-truncated": params.includeTruncated = false; break;

      case "--unit": {
        const v = value() as TimeUnit;
        if (!TIME_UNIT_KEYS.includes(v)) {
          throw new CliError(`--unit is one of ${TIME_UNIT_KEYS.join(", ")}, got "${v}".`);
        }
        opts.unit = v;
        break;
      }

      case "--preset": {
        const key = value();
        const preset = PRESETS.find((p) => p.key === key);
        if (!preset) {
          throw new CliError(
            `Unknown preset "${key}". One of: ${PRESETS.map((p) => p.key).join(", ")}.`,
          );
        }
        // Applied first so an explicit flag after --preset still wins, which is
        // the useful order: start from a published setting, vary one thing.
        Object.assign(params, preset.params);
        opts.preset = preset;
        break;
      }

      case "-o":
      case "--out": opts.out = value(); break;

      case "-v":
      case "--verbose": opts.verbose = true; break;

      case "--strict": opts.strict = true; break;

      default:
        if (arg.startsWith("-")) throw new CliError(`Unknown option "${arg}".`);
        opts.inputs.push(arg);
    }
  }

  return opts;
}

/** Every data file under a path: the file itself, or the directory's contents. */
export function expandInputs(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    let stat;
    try {
      stat = statSync(input);
    } catch {
      throw new CliError(`No such file or directory: ${input}`);
    }
    if (stat.isDirectory()) {
      const found = readdirSync(input)
        .filter((f) => DATA_EXTENSIONS.includes(extname(f).toLowerCase()))
        .sort()
        .map((f) => join(input, f));
      if (found.length === 0) {
        throw new CliError(
          `${input} holds no ${DATA_EXTENSIONS.join("/")} files.`,
        );
      }
      files.push(...found);
    } else {
      files.push(input);
    }
  }
  return files;
}

/** The record name in the summary table: the filename without its extension. */
const recordName = (file: string) => basename(file, extname(file));

interface RunOutcome {
  segments: SegmentResult[];
  skipped: { file: string; why: string }[];
}

/**
 * Analyze every file under one parameter set.
 *
 * Each record goes through `runSegments` on its own rather than all of them
 * going through together, because these are separate files and not one
 * concatenated study: there is no combined trace to build, and a record that
 * cannot be analyzed should cost its own row, not the whole run. A single
 * segment reduces exactly to `clusterMain`, so the numbers are the app's.
 */
export function runFiles(files: string[], opts: CliOptions): RunOutcome {
  const segments: SegmentResult[] = [];
  const skipped: { file: string; why: string }[] = [];

  for (const file of files) {
    try {
      const series = parseSeries(readFileSync(file, "utf8"));
      // An error column means the file carries its own per-sample error, and
      // "Error Wave" is the only model that can use it; a file without one
      // cannot stay on that model. Same rule the app applies on load.
      const params = {
        ...opts.params,
        errorModel: resolveErrorModel(opts.params.errorModel, series.error !== null),
      };
      const run = runSegments(
        [
          {
            name: recordName(file),
            values: series.values,
            times: series.times,
            error: series.error,
          },
        ],
        params,
        opts.interval,
      );
      segments.push(run.segments[0]);
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      if (opts.strict) throw new CliError(`${file}: ${why}`);
      skipped.push({ file, why });
    }
  }

  return { segments, skipped };
}

/** The `#` provenance block above the table. Settings travel with the numbers. */
export function summaryHeader(
  opts: CliOptions,
  files: string[],
  outcome: RunOutcome,
  version: string,
): string {
  const p = opts.params;
  const lines = [
    "# no_peak CLUSTER — batch summary, one row per record",
    `# no_peak ${version}, scripts/cluster.ts`,
  ];
  if (opts.preset) {
    lines.push(`# preset: ${opts.preset.label}`);
    for (const chunk of opts.preset.cite.match(/.{1,76}(\s|$)/g) ?? [opts.preset.cite]) {
      if (chunk.trim()) lines.push(`# source: ${chunk.trim()}`);
    }
  }
  lines.push(
    `# nPeak=${p.nPeak} nNadir=${p.nNadir} tUp=${p.tScoreUp} tDn=${p.tScoreDn}` +
      ` minPeak=${p.minPeak} error=${p.errorModel}` +
      (p.errorModel === "Fixed" || p.errorModel === "SQRT" ? ` errorValue=${p.errorValue}` : "") +
      (p.zeroTerminate ? ` zeroTerminate<=${p.zero}` : "") +
      (p.includeTruncated ? "" : " truncatedDropped") +
      ` impl=${p.variant}`,
  );
  lines.push(
    `# time unit: ${timeUnitDef(opts.unit).label}; interval for files with no time column:` +
      ` ${opts.interval}`,
  );
  lines.push(
    `# ${outcome.segments.length} of ${files.length} records analyzed` +
      (outcome.skipped.length ? `, ${outcome.skipped.length} skipped` : ""),
  );
  for (const s of outcome.skipped) lines.push(`# skipped ${s.file}: ${s.why}`);
  return lines.join("\n") + "\n";
}

/** The per-pulse listing `--verbose` writes to stderr. */
function describe(seg: SegmentResult, unit: TimeUnit): string {
  const r = seg.result;
  const round = (v: number | null) => (v === null ? "—" : Number(v.toPrecision(4)));
  const freq = pulseFrequency(r.summary.nPeaks, r.summary.recordDuration, unit);
  const short = timeUnitDef(unit).short;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const out = [
    `${seg.name}: ${r.values.length} points, ${r.summary.recordDuration} ${short}, ` +
      `${plural(r.summary.nPeaks, "pulse")}, ${plural(r.summary.nValleys, "valley")}` +
      (freq ? `, ${Number(freq.perHour.toPrecision(3))} pulses/h` : ""),
  ];
  for (const [i, p] of r.peaks.entries()) {
    out.push(
      `  pulse ${i + 1}: t=${r.times[p.iMax]} range ${r.times[p.iFirst]}-${r.times[p.iLast]} ` +
        `peak=${round(p.peakValue)} nadir=${round(p.nadirBefore)} amplitude=${round(p.amplitude)}`,
    );
  }
  return out.join("\n");
}

function main(argv: string[]): number {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv.includes("--list-presets")) {
    for (const p of PRESETS) {
      process.stdout.write(`${p.key}\n  ${p.label}\n`);
      if (p.cite) process.stdout.write(`  ${p.cite}\n`);
      const q = p.params;
      process.stdout.write(
        `  nPeak=${q.nPeak} nNadir=${q.nNadir} tUp=${q.tScoreUp} tDn=${q.tScoreDn}` +
          ` error=${q.errorModel} impl=${q.variant}\n\n`,
      );
    }
    return 0;
  }

  const opts = parseArgs(argv);
  if (opts.inputs.length === 0) {
    process.stderr.write(USAGE);
    return 2;
  }

  const files = expandInputs(opts.inputs);
  const outcome = runFiles(files, opts);

  for (const s of outcome.skipped) {
    process.stderr.write(`skipped ${s.file}: ${s.why}\n`);
  }
  if (outcome.segments.length === 0) {
    throw new CliError(`None of the ${files.length} input files could be analyzed.`);
  }
  if (opts.verbose) {
    for (const seg of outcome.segments) process.stderr.write(describe(seg, opts.unit) + "\n");
  }

  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  const csv =
    summaryHeader(opts, files, outcome, version) +
    segmentsToCSV(outcome.segments, timeUnitDef(opts.unit).short);

  if (opts.out) {
    writeFileSync(opts.out, csv);
    process.stderr.write(`${outcome.segments.length} records → ${opts.out}\n`);
  } else {
    process.stdout.write(csv);
  }
  return 0;
}

// Only when run as a program: the tests import this module for `parseArgs` and
// `runFiles`, and must not trip the argv path.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
