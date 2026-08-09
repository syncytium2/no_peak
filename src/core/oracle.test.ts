// Oracle tests against the ORIGINAL Fortran. The files in data/oracle/ are the
// verbatim output of CLUST5.MPF v6.01 compiled with gfortran and run on the
// bundled datasets — regenerate with tools/fortran/build_and_run.sh.
//
// This is the real validation of the "fortran" variant: the port was written
// by reading the Fortran, and these tests check that reading against what the
// program actually computes.

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { parseSeries } from "./csv";
import { DEFAULT_PARAMS } from "./types";

/** Parse the PASS FOUR table: index, time, mean, sd, UP flag, DOWN flag, pulse. */
function parseListing(file: string) {
  const lines = readFileSync(file, "utf8").split("\n");
  const start = lines.findIndex((l) => l.includes("PASS FOUR RESULTS")) + 2;
  const ups: number[] = [], downs: number[] = [], pulse: number[] = [];
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\d+\s+[\d.]+\s+[-\d.]+\s+[-\d.]+\s+([TF])([TF])(.{3})/);
    if (!m) break;
    ups.push(m[1] === "T" ? 1 : 0);
    downs.push(m[2] === "T" ? -1 : 0);
    // PUL(1) is always '*'; PUL(2..3) are '*' only inside a pulse
    pulse.push(m[3][1] === "*" ? 1 : 0);
  }
  return { ups, downs, pulse };
}

/** Parse the PEAKS table rows: I4,' (',I4,'-',I4,')',F8.1,F9.3,2F8.1,2F9.3 */
function parsePeaks(file: string) {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) =>
      l.match(
        /^\s*(\d+)\s+\(\s*(\d+)-\s*(\d+)\)\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*$/,
      ),
    )
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      iMax: +m[1], iFirst: +m[2], iLast: +m[3], width: +m[4], height: +m[5],
      largestPct: +m[6], meanPct: +m[7], area: +m[8], increase: +m[9],
    }));
}

// The oracle compares against real lab data and the Fortran's output on it —
// neither is distributed (see docs/reference-code.md). Without them the suite
// skips loudly rather than passing on nothing.
const HAVE_ORACLE =
  existsSync("data/extracted/gnrh.csv") && existsSync("data/oracle/gnrh_nn2_np2.lst");

if (!HAVE_ORACLE) {
  describe("CLUST5 oracle", () => {
    it.skip("needs the undistributed data — see docs/reference-code.md", () => {});
  });
}

const series = HAVE_ORACLE
  ? parseSeries(readFileSync("data/extracted/gnrh.csv", "utf8"))
  : { times: [], values: [], error: [], labels: null };

const run = (nNadir: number, nPeak: number) =>
  clusterMain(
    series.times!,
    series.values,
    { ...DEFAULT_PARAMS, nNadir, nPeak, errorModel: "Error Wave", variant: "fortran" },
    series.error!,
  );

describe.runIf(HAVE_ORACLE)("CLUST5 oracle — gnrh, nNadir=2 nPeak=2 (the documented defaults)", () => {
  const oracle = parseListing("data/oracle/gnrh_nn2_np2.lst");
  const oraclePeaks = parsePeaks("data/oracle/gnrh_nn2_np2.stdout.txt");
  const r = run(2, 2);

  it("reproduces the up flags exactly", () => expect(r.ups).toEqual(oracle.ups));
  it("reproduces the down flags exactly", () => expect(r.downs).toEqual(oracle.downs));
  it("reproduces the pulse array exactly", () => expect(r.pulse).toEqual(oracle.pulse));

  it("reproduces every peak's position and statistics", () => {
    expect(oraclePeaks.length).toBe(17);
    oraclePeaks.forEach((p, i) => {
      const o = r.peaks[i];
      // Fortran indices are 1-based
      expect(o.iMax + 1).toBe(p.iMax);
      expect(o.iFirst + 1).toBe(p.iFirst);
      expect(o.iLast + 1).toBe(p.iLast);
      expect(o.width).toBeCloseTo(p.width, 5);
      expect(o.height).toBeCloseTo(p.height, 3);
      expect(o.largestPct!).toBeCloseTo(p.largestPct, 0);
      expect(o.meanPct!).toBeCloseTo(p.meanPct, 0);
      expect(o.area!).toBeCloseTo(p.area, 2);
      expect(o.increase!).toBeCloseTo(p.increase, 2);
    });
  });

  it("adds exactly one peak the Fortran drops: the end-truncated pulse", () => {
    expect(r.peaks.length).toBe(oraclePeaks.length + 1);
    const last = r.peaks[r.peaks.length - 1];
    expect(last.iLast).toBe(series.values.length - 1);
    expect(last.meanPct).toBeNull(); // no following baseline inside the record
  });
});

describe.runIf(HAVE_ORACLE)("CLUST5 oracle — asymmetric windows expose a documented divergence", () => {
  const oracle = parseListing("data/oracle/gnrh_nn1_np3.lst");
  const r = run(1, 3);

  // CLUST5 declares COMMON /MISC/ as (…,NNADIR,NPEAK) in UPS but (…,NPEAK,NNADIR)
  // in DNS, so the downs pass receives the two window sizes exchanged. Igor's
  // UPorDN passes (nPeak, nNadir) identically for both directions and does not
  // swap; this port follows Igor. The two agree whenever nPeak == nNadir, which
  // is why the 2x2 case above matches exactly.
  it("matches the Fortran on the ups pass", () => expect(r.ups).toEqual(oracle.ups));

  it("differs on the downs pass, and swapping the windows explains it exactly", () => {
    expect(r.downs).not.toEqual(oracle.downs);
    const swapped = run(3, 1); // windows exchanged, as DNS effectively sees them
    expect(swapped.downs).toEqual(oracle.downs);
  });
});
