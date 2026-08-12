// The real Igor experiment this reader was developed against is lab data and
// is not distributed (see docs/reference-code.md), so the fixtures here are
// written byte by byte from the layouts in Igor's IgorBin.h. That is the right
// fixture anyway: it pins the offsets the parser depends on, which is exactly
// what silently rots when a format is read by eye.

import { describe, expect, it } from "vitest";
import {
  readBinaryWave,
  readPackedExperiment,
  suggestPartners,
  timeUnitFromIgor,
  type IgorWave,
} from "./igor";

const BIN_HEADER_5 = 64;
const WAVE_HEADER_5 = 320;

interface WaveSpec {
  name: string;
  values: number[];
  dx?: number;
  x0?: number;
  xUnits?: string;
  dataUnits?: string;
  note?: string;
  /** NT_FP64 by default; pass 2 for NT_FP32, 0x20 for NT_I32. */
  type?: number;
}

/** Write one version-5 binary wave, as Igor lays it out. */
function ibw(spec: WaveSpec, le = true): Uint8Array {
  const { name, values, dx = 1, x0 = 0, xUnits = "", dataUnits = "", note = "" } = spec;
  const type = spec.type ?? 4; // NT_FP64
  const elem = type === 2 ? 4 : type === 0x20 ? 4 : 8;
  const noteBytes = new TextEncoder().encode(note);

  const total = BIN_HEADER_5 + WAVE_HEADER_5 + values.length * elem + noteBytes.length;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  const putStr = (off: number, s: string, max: number) => {
    const enc = new TextEncoder().encode(s).slice(0, max - 1);
    bytes.set(enc, off);
  };

  // BinHeader5
  dv.setInt16(0, 5, le); // version
  dv.setInt32(4, WAVE_HEADER_5 + values.length * elem, le); // wfmSize
  dv.setInt32(8, 0, le); // formulaSize
  dv.setInt32(12, noteBytes.length, le); // noteSize

  // WaveHeader5
  const wh = BIN_HEADER_5;
  dv.setInt32(wh + 12, values.length, le); // npnts
  dv.setInt16(wh + 16, type, le);
  putStr(wh + 28, name, 32); // bname
  dv.setInt32(wh + 68, values.length, le); // nDim[0]
  dv.setFloat64(wh + 84, dx, le); // sfA[0]
  dv.setFloat64(wh + 116, x0, le); // sfB[0]
  putStr(wh + 148, dataUnits, 4);
  putStr(wh + 152, xUnits, 4); // dimUnits[0]

  const data = wh + WAVE_HEADER_5;
  values.forEach((v, i) => {
    if (type === 2) dv.setFloat32(data + i * 4, v, le);
    else if (type === 0x20) dv.setInt32(data + i * 4, v, le);
    else dv.setFloat64(data + i * 8, v, le);
  });
  bytes.set(noteBytes, data + values.length * elem);
  return bytes;
}

/** Wrap records into a packed-experiment byte stream. */
function pxp(records: { type: number; body: Uint8Array }[], le = true): ArrayBuffer {
  const total = records.reduce((a, r) => a + 8 + r.body.length, 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let pos = 0;
  for (const r of records) {
    dv.setUint16(pos, r.type, le);
    dv.setInt16(pos + 2, 1, le);
    dv.setInt32(pos + 4, r.body.length, le);
    bytes.set(r.body, pos + 8);
    pos += 8 + r.body.length;
  }
  return buf;
}

const folder = (name: string) => ({
  type: 10,
  body: new TextEncoder().encode(name + "\0"),
});
const folderEnd = { type: 11, body: new Uint8Array(0) };
const waveRec = (spec: WaveSpec, le = true) => ({ type: 3, body: ibw(spec, le) });

const ab = (u: Uint8Array) =>
  u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

describe("readBinaryWave", () => {
  it("reads values, name, scaling and units", () => {
    const w = readBinaryWave(
      ab(
        ibw({
          name: "gnrh",
          values: [0.31, 4.04, 1.8, 0.28],
          dx: 10,
          x0: 10,
          xUnits: "min",
          dataUnits: "pg",
        }),
      ),
    );
    expect(w.name).toBe("gnrh");
    expect(w.values).toEqual([0.31, 4.04, 1.8, 0.28]);
    expect(w.dx).toBe(10);
    expect(w.x0).toBe(10);
    expect(w.xUnits).toBe("min");
    expect(w.dataUnits).toBe("pg");
  });

  it("reads big-endian waves, as written on older Macs", () => {
    const w = readBinaryWave(ab(ibw({ name: "old", values: [1, 2, 3], dx: 6 }, false)));
    expect(w.values).toEqual([1, 2, 3]);
    expect(w.dx).toBe(6);
  });

  it("reads 32-bit float and integer waves", () => {
    expect(readBinaryWave(ab(ibw({ name: "f", values: [1.5, 2.5], type: 2 }))).values).toEqual([
      1.5, 2.5,
    ]);
    expect(readBinaryWave(ab(ibw({ name: "i", values: [4, 5], type: 0x20 }))).values).toEqual([
      4, 5,
    ]);
  });

  it("reads the wave note", () => {
    const w = readBinaryWave(ab(ibw({ name: "n", values: [1, 2], note: "collected 6-min" })));
    expect(w.note).toBe("collected 6-min");
  });

  it("rejects what is not a wave", () => {
    expect(() => readBinaryWave(new ArrayBuffer(4))).toThrow(/too short/);
    expect(() => readBinaryWave(new ArrayBuffer(64))).toThrow(/not an Igor binary wave/);
  });
});

describe("readPackedExperiment", () => {
  it("finds every wave and the folder it lives in", () => {
    const file = readPackedExperiment(
      pxp([
        folder("root"),
        waveRec({ name: "gnrh", values: [1, 2, 3] }),
        folder("Cluster"),
        waveRec({ name: "set1C1(RD)", values: [4, 5, 6] }),
        folderEnd,
        waveRec({ name: "sem", values: [0.1, 0.2, 0.3] }),
        folderEnd,
      ]),
    );
    expect(file.waves.map((w) => w.path)).toEqual([
      "root:gnrh",
      "root:Cluster:set1C1(RD)",
      "root:sem",
    ]);
    expect(file.waves[1].values).toEqual([4, 5, 6]);
  });

  it("skips records it does not handle, without losing the waves around them", () => {
    const file = readPackedExperiment(
      pxp([
        { type: 1, body: new Uint8Array(32) }, // variables
        waveRec({ name: "a", values: [1, 2, 3] }),
        { type: 5, body: new TextEncoder().encode("Function foo()\rEnd\r") }, // procedure
        waveRec({ name: "b", values: [4, 5, 6] }),
      ]),
    );
    expect(file.waves.map((w) => w.name)).toEqual(["a", "b"]);
  });

  it("reports text waves as skipped rather than failing the import", () => {
    const file = readPackedExperiment(
      pxp([waveRec({ name: "labels", values: [], type: 0 }), waveRec({ name: "a", values: [1, 2] })]),
    );
    expect(file.waves.map((w) => w.name)).toEqual(["a"]);
    expect(file.skipped).toHaveLength(1);
    expect(file.skipped[0].reason).toMatch(/text wave/);
  });

  it("keeps the waves it read when the file is truncated mid-record", () => {
    const whole = new Uint8Array(pxp([waveRec({ name: "a", values: [1, 2, 3] }), waveRec({ name: "b", values: [9] })]));
    const cut = whole.slice(0, whole.length - 40);
    const file = readPackedExperiment(ab(cut));
    expect(file.waves.map((w) => w.name)).toEqual(["a"]);
  });

  it("rejects a file that is not an experiment", () => {
    const junk = new Uint8Array(64).fill(0xff);
    expect(() => readPackedExperiment(ab(junk))).toThrow(/not an Igor packed experiment/);
  });
});

describe("suggestPartners", () => {
  const wave = (name: string, n = 3): IgorWave => ({
    path: name,
    name: name.split(":").pop()!,
    values: Array.from({ length: n }, (_, i) => i),
    dx: 1,
    x0: 0,
    xUnits: "",
    dataUnits: "",
    note: "",
  });

  it("pairs the Igor Cluster package's column naming", () => {
    const all = [wave("set1C1(RD)"), wave("set1C2(STDEV)"), wave("set1C3(Times)")];
    const got = suggestPartners(all[0], all);
    expect(got.error?.name).toBe("set1C2(STDEV)");
    expect(got.times?.name).toBe("set1C3(Times)");
  });

  it("falls back to a sibling named like an error wave", () => {
    const all = [wave("gnrh"), wave("sem")];
    expect(suggestPartners(all[0], all).error?.name).toBe("sem");
  });

  it("will not pair a wave of a different length", () => {
    const all = [wave("gnrh", 96), wave("sem", 61)];
    expect(suggestPartners(all[0], all).error).toBeUndefined();
  });
});

describe("timeUnitFromIgor", () => {
  it("maps the spellings Igor files use", () => {
    expect(timeUnitFromIgor("s")).toBe("s");
    expect(timeUnitFromIgor("Seconds")).toBe("s");
    expect(timeUnitFromIgor("min")).toBe("min");
    expect(timeUnitFromIgor("hr")).toBe("h");
  });

  it("returns null for unset or unrecognized units, leaving the choice alone", () => {
    expect(timeUnitFromIgor("")).toBeNull();
    expect(timeUnitFromIgor("pg/ml")).toBeNull();
  });
});
