// Oracle tests against Igor Pro (ClusterMasterV4-1), the implementation this
// port follows and the one the README claims validation against.
//
// Drop the CSVs produced by tools/igor/no_peak_validate.ipf into
// data/oracle_igor/ and these tests light up automatically — each file carries
// its own parameters in a header comment, so nothing needs wiring per dataset.
// With the folder absent or empty, the suite reports a single skipped test
// rather than passing silently, so the gap stays visible.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clusterMain } from "./cluster";
import { DEFAULT_PARAMS, type ErrorModelType } from "./types";

const DIR = "data/oracle_igor";

interface OracleRun {
  file: string;
  params: {
    wave: string;
    nPeak: number;
    nNadir: number;
    tUp: number;
    tDn: number;
    minPeak: number;
    errType: ErrorModelType;
    errVal: number;
    zero: number;
    zeroTerminate: number;
  };
  values: number[];
  err: number[];
  ups: number[];
  downs: number[];
  pulse: number[];
  mscoreUp: number[];
  mscoreDn: number[];
}

function parseOracle(file: string): OracleRun {
  const lines = readFileSync(`${DIR}/${file}`, "utf8").split(/\r\n|\r|\n/);
  const header = lines.find((l) => l.includes("nPeak=")) ?? "";
  const num = (k: string) => {
    const m = header.match(new RegExp(`${k}=(-?[\\d.]+)`));
    if (!m) throw new Error(`${file}: no ${k} in header`);
    return Number(m[1]);
  };
  const str = (k: string) => header.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? "";

  const rows = lines
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("i,"))
    .map((l) => l.split(",").map(Number));

  return {
    file,
    params: {
      wave: header.match(/wave=(\S+)/)?.[1] ?? "",
      nPeak: num("nPeak"),
      nNadir: num("nNadir"),
      tUp: num("tUp"),
      tDn: num("tDn"),
      minPeak: num("minPeak"),
      errType: str("errType") as ErrorModelType,
      errVal: num("errVal"),
      zero: num("zero"),
      zeroTerminate: num("zeroTerminate"),
    },
    values: rows.map((r) => r[1]),
    err: rows.map((r) => r[2]),
    ups: rows.map((r) => r[3]),
    downs: rows.map((r) => r[4]),
    pulse: rows.map((r) => r[5]),
    mscoreUp: rows.map((r) => r[6]),
    mscoreDn: rows.map((r) => r[7]),
  };
}

const files = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.endsWith(".csv")).sort()
  : [];

describe("Igor oracle (ClusterMasterV4-1)", () => {
  if (files.length === 0) {
    it.skip("no oracle files yet — see docs/igor-validation.md", () => {});
    return;
  }

  for (const file of files) {
    describe(file, () => {
      const o = parseOracle(file);
      // Point arrays do not depend on the time base, so an index time base is
      // fine here even for waves that carry real sampling times.
      const times = o.values.map((_, i) => i + 1);
      const r = clusterMain(
        times,
        o.values,
        {
          ...DEFAULT_PARAMS,
          variant: "igor",
          nPeak: o.params.nPeak,
          nNadir: o.params.nNadir,
          tScoreUp: o.params.tUp,
          tScoreDn: o.params.tDn,
          minPeak: o.params.minPeak,
          errorModel: o.params.errType,
          errorValue: o.params.errVal,
          zero: o.params.zero,
          zeroTerminate: o.params.zeroTerminate === 1,
        },
        o.params.errType === "Error Wave" ? o.err : undefined,
      );

      it("builds the same error array", () => {
        r.error.forEach((v, i) => expect(v).toBeCloseTo(o.err[i], 6));
      });
      it("flags the same increases", () => expect(r.ups).toEqual(o.ups));
      it("flags the same decreases", () => expect(r.downs).toEqual(o.downs));
      it("produces the same pulse array", () => expect(r.pulse).toEqual(o.pulse));
      it("computes the same t-scores", () => {
        r.mscoreUp.forEach((v, i) => {
          if (Number.isFinite(v) && Number.isFinite(o.mscoreUp[i])) {
            expect(v).toBeCloseTo(o.mscoreUp[i], 4);
          }
        });
      });
    });
  }
});
