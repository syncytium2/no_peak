// CSV/TSV parsing for uploaded time series, and CSV serialization of results.
// Accepted layouts (header row optional, auto-detected):
//   1 column:  value            (times generated from a sampling interval)
//   2 columns: time, value
//   3 columns: time, value, error

import type { ClusterResult } from "./types";

export interface ParsedSeries {
  times: number[] | null;
  values: number[];
  error: number[] | null;
  /** Column labels from a header row, if one was present. */
  labels: string[] | null;
}

export function parseSeries(text: string): ParsedSeries {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));
  if (lines.length === 0) throw new Error("The file is empty.");

  const split = (line: string) =>
    line.split(/[,;\t]|\s+/).filter((c) => c.length > 0);

  let labels: string[] | null = null;
  let start = 0;
  const firstCells = split(lines[0]);
  if (firstCells.some((c) => Number.isNaN(Number(c)))) {
    labels = firstCells;
    start = 1;
    if (start >= lines.length) throw new Error("Only a header row was found — no data.");
  }

  const rows: number[][] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = split(lines[i]).map(Number);
    if (cells.some((c) => Number.isNaN(c))) {
      throw new Error(`Line ${i + 1} is not numeric: "${lines[i]}"`);
    }
    rows.push(cells);
  }

  const nCols = rows[0].length;
  if (rows.some((r) => r.length !== nCols)) {
    throw new Error("Rows have inconsistent numbers of columns.");
  }
  if (nCols > 3) {
    throw new Error(
      `${nCols} columns found — expected value; time,value; or time,value,error.`,
    );
  }

  if (nCols === 1) {
    return { times: null, values: rows.map((r) => r[0]), error: null, labels };
  }
  return {
    times: rows.map((r) => r[0]),
    values: rows.map((r) => r[1]),
    error: nCols === 3 ? rows.map((r) => r[2]) : null,
    labels,
  };
}

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

export function resultToCSV(r: ClusterResult): string {
  const out: string[] = [];
  out.push("# no_peak CLUSTER results");
  out.push(
    `# nPeak=${r.params.nPeak} nNadir=${r.params.nNadir} tUp=${r.params.tScoreUp} tDn=${r.params.tScoreDn}` +
      ` minPeak=${r.params.minPeak} error=${r.params.errorModel}` +
      (r.params.errorModel === "Fixed" || r.params.errorModel === "SQRT"
        ? ` errorValue=${r.params.errorValue}`
        : "") +
      (r.params.zeroTerminate ? ` zeroTerminate<=${r.params.zero}` : "") +
      ` impl=${r.params.variant}`,
  );
  out.push("");
  out.push("time,value,error,up,down,mscore_up,mscore_dn,pulse");
  for (let i = 0; i < r.values.length; i++) {
    out.push(
      [
        r.times[i],
        r.values[i],
        r.error[i],
        r.ups[i],
        r.downs[i],
        r.mscoreUp[i],
        r.mscoreDn[i],
        r.pulse[i],
      ].join(","),
    );
  }
  out.push("");
  out.push("# peaks");
  out.push("n,t_max,i_max,i_first,i_last,width,height,largest_pct,mean_pct,area,increase");
  r.peaks.forEach((p, i) => {
    out.push(
      [
        i + 1,
        r.times[p.iMax],
        p.iMax,
        p.iFirst,
        p.iLast,
        p.width,
        p.height,
        fmt(p.largestPct),
        fmt(p.meanPct),
        fmt(p.area),
        fmt(p.increase),
      ].join(","),
    );
  });
  out.push("");
  out.push("# valleys");
  out.push("n,t_min,i_min,i_first,i_last,width,nadir,mean");
  r.valleys.forEach((v, i) => {
    out.push(
      [i + 1, r.times[v.iMin], v.iMin, v.iFirst, v.iLast, v.width, v.nadir, v.mean].join(","),
    );
  });
  return out.join("\n") + "\n";
}
