// Tests for the command line, scripts/cluster.ts.
//
// Two kinds here, and the second is the one that matters. The flag tests are
// ordinary unit tests. The anchored tests re-run, through the CLI, the same
// records and settings that src/core/presets.test.ts runs through the library —
// so the batch path and the app cannot report different pulse counts for the
// same data without a test going red.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseArgs, expandInputs, runFiles, summaryHeader } from "./cluster.ts";
import { DEFAULT_PARAMS } from "../src/core/types.ts";
import { HAVE_DIGITIZED } from "../src/testing/haveDigitized.ts";

const CLI = fileURLToPath(new URL("./cluster.ts", import.meta.url));

/** Run the CLI as a program, the way a user does. Returns stdout. */
const run = (args: string[]) =>
  execFileSync("node", [CLI, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const dataRows = (csv: string) =>
  csv
    .trim()
    .split("\n")
    .filter((l) => !l.startsWith("#") && !l.startsWith("segment"));

describe("parseArgs", () => {
  it("defaults to the app's parameters", () => {
    const o = parseArgs(["a.csv"]);
    expect(o.params).toEqual(DEFAULT_PARAMS);
    expect(o.inputs).toEqual(["a.csv"]);
    expect(o.unit).toBe("min");
  });

  it("reads every detection flag", () => {
    const o = parseArgs([
      "--n-peak", "3", "--n-nadir", "4", "--t-up", "2.5", "--t-dn", "1.5",
      "--min-peak", "0.2", "--error-model", "Global SE", "--error-value", "0.5",
      "--variant", "fortran", "--zero-terminate", "0.1", "--no-truncated",
      "in.csv",
    ]);
    expect(o.params).toEqual({
      nPeak: 3, nNadir: 4, tScoreUp: 2.5, tScoreDn: 1.5, minPeak: 0.2,
      errorModel: "Global SE", errorValue: 0.5, variant: "fortran",
      zeroTerminate: true, zero: 0.1, includeTruncated: false,
    });
    expect(o.inputs).toEqual(["in.csv"]);
  });

  it("takes an error model however it is capitalized or spaced", () => {
    expect(parseArgs(["--error-model", "local sd", "a"]).params.errorModel).toBe("Local SD");
    expect(parseArgs(["--error-model", "SQRT", "a"]).params.errorModel).toBe("SQRT");
    expect(parseArgs(["--error-model", "errorwave", "a"]).params.errorModel).toBe("Error Wave");
  });

  it("applies a preset, and lets a later flag override one of its values", () => {
    const o = parseArgs(["--preset", "webster1991_lh", "--t-up", "4", "a.csv"]);
    expect(o.preset?.key).toBe("webster1991_lh");
    expect(o.params.nPeak).toBe(1);
    expect(o.params.variant).toBe("fortran");
    expect(o.params.tScoreUp).toBe(4); // the flag came after the preset
    expect(o.params.tScoreDn).toBe(2.32); // and left the rest of it alone
  });

  it("rejects what it cannot honor rather than guessing", () => {
    expect(() => parseArgs(["--n-peak", "x", "a"])).toThrow(/needs a number/);
    expect(() => parseArgs(["--n-peak"])).toThrow(/needs a number/);
    expect(() => parseArgs(["--error-model", "Poisson", "a"])).toThrow(/Unknown error model/);
    expect(() => parseArgs(["--variant", "matlab", "a"])).toThrow(/igor or fortran/);
    expect(() => parseArgs(["--unit", "fortnights", "a"])).toThrow(/--unit is one of/);
    expect(() => parseArgs(["--preset", "nope", "a"])).toThrow(/Unknown preset/);
    expect(() => parseArgs(["--jazz", "a"])).toThrow(/Unknown option/);
  });
});

describe("expandInputs", () => {
  it("expands a directory to its data files, sorted, and leaves files alone", () => {
    const dir = mkdtempSync(join(tmpdir(), "nopeak-cli-"));
    writeFileSync(join(dir, "b.csv"), "1\n2\n3\n");
    writeFileSync(join(dir, "a.csv"), "1\n2\n3\n");
    writeFileSync(join(dir, "notes.md"), "not data");
    expect(expandInputs([dir])).toEqual([join(dir, "a.csv"), join(dir, "b.csv")]);
    expect(expandInputs([join(dir, "b.csv")])).toEqual([join(dir, "b.csv")]);
  });

  it("names the path it could not find", () => {
    expect(() => expandInputs(["/no/such/place"])).toThrow(/No such file or directory/);
  });
});

describe("runFiles", () => {
  const opts = (over: Partial<ReturnType<typeof parseArgs>> = {}) => ({
    ...parseArgs(["x.csv"]),
    ...over,
  });

  it("skips a record it cannot analyze and keeps going", () => {
    const dir = mkdtempSync(join(tmpdir(), "nopeak-cli-"));
    writeFileSync(join(dir, "good.csv"), Array.from({ length: 20 }, (_, i) => `${i},${i % 3}`).join("\n"));
    writeFileSync(join(dir, "short.csv"), "1,1\n2,2\n");
    const outcome = runFiles(expandInputs([dir]), opts());
    expect(outcome.segments.map((s) => s.name)).toEqual(["good"]);
    expect(outcome.skipped).toHaveLength(1);
    expect(outcome.skipped[0].why).toMatch(/at least 3 data points/);
  });

  it("stops on the first bad record under --strict", () => {
    const dir = mkdtempSync(join(tmpdir(), "nopeak-cli-"));
    writeFileSync(join(dir, "short.csv"), "1,1\n2,2\n");
    expect(() => runFiles(expandInputs([dir]), opts({ strict: true }))).toThrow(/short\.csv/);
  });

  it("switches to Error Wave for a file that carries its own error column", () => {
    // The rule the app applies on load: a per-sample error column is the only
    // thing "Error Wave" can read, and it is what the Webster presets need.
    const file = join(mkdtempSync(join(tmpdir(), "nopeak-cli-")), "e.csv");
    writeFileSync(file, Array.from({ length: 20 }, (_, i) => `${i},${i % 3},0.1`).join("\n"));
    const outcome = runFiles([file], opts());
    expect(outcome.segments[0].result.params.errorModel).toBe("Error Wave");
    expect(outcome.segments[0].result.error.every((e) => e === 0.1)).toBe(true);
  });
});

describe("summaryHeader", () => {
  it("carries the settings and the preset's citation", () => {
    const opts = parseArgs(["--preset", "webster1991_gnrh", "a.csv"]);
    const header = summaryHeader(opts, ["a.csv"], { segments: [], skipped: [] }, "9.9.9");
    expect(header).toContain("no_peak 9.9.9");
    expect(header).toContain("nPeak=1 nNadir=1 tUp=3.2 tDn=3.2");
    expect(header).toContain("impl=fortran");
    expect(header).toContain("Webster JR");
    expect(header).toContain("0 of 1 records analyzed");
  });

  it("names every skipped file, so a short table is never silently short", () => {
    const opts = parseArgs(["a.csv", "b.csv"]);
    const outcome = { segments: [], skipped: [{ file: "b.csv", why: "too short" }] };
    const header = summaryHeader(opts, ["a.csv", "b.csv"], outcome, "0.0.0");
    expect(header).toContain("1 skipped");
    expect(header).toContain("# skipped b.csv: too short");
  });
});

describe("the program", () => {
  it.skipIf(!HAVE_DIGITIZED)("writes one row per record, and a header row", () => {
    const csv = run(["data/digitized/webster1991_fig3b_thx_8067_gnrh.csv",
                     "data/digitized/webster1991_fig3b_thx_8067_lh.csv"]);
    expect(csv.split("\n")[0]).toContain("batch summary");
    expect(csv).toContain("segment,n_points,duration_min,n_pulses");
    expect(dataRows(csv)).toHaveLength(2);
  });

  it("writes to --out and leaves stdout empty", () => {
    const out = join(mkdtempSync(join(tmpdir(), "nopeak-cli-")), "summary.csv");
    const stdout = run(["data/synthetic/sim_lh.csv", "-o", out]);
    expect(stdout).toBe("");
    expect(dataRows(readFileSync(out, "utf8"))).toHaveLength(1);
  });

  it("prints usage and stops when given nothing to do", () => {
    expect(() => run([])).toThrow(); // exit 2
  });

  // The anchors. These counts are the ones src/core/presets.test.ts asserts
  // against the library, and the ones the source papers report.
  it.skipIf(!HAVE_DIGITIZED)("reproduces the paper's 11 GnRH pulses in the digitized THX ewe", () => {
    const csv = run([
      "data/digitized/webster1991_fig3b_thx_8067_gnrh.csv",
      "--preset", "webster1991_gnrh",
    ]);
    expect(dataRows(csv)[0].split(",")[3]).toBe("11");
  });

  it("reproduces the library's 11 pulses in the simulated THX ewe", () => {
    const csv = run(["data/synthetic/sim_gnrh_thx_ewe.csv", "--preset", "webster1991_gnrh"]);
    expect(dataRows(csv)[0].split(",")[3]).toBe("11");
  });

  it.skipIf(!HAVE_DIGITIZED)("batches a directory under one setting, skipping what is not a series", () => {
    // data/digitized holds eight records plus webster1991_pulses.csv, which is
    // that paper's pulse table rather than a time series.
    const csv = run(["data/digitized", "--preset", "webster1991_lh"]);
    expect(dataRows(csv)).toHaveLength(8);
    expect(csv).toContain("# skipped data/digitized/webster1991_pulses.csv");
  });
});
