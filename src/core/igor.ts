// Reader for Igor Pro binary waves (.ibw) and packed experiments (.pxp).
//
// Much of the pulse-detection world keeps its recordings in Igor, so a CSV
// round-trip through Excel is the step where records get transposed, truncated
// or silently re-scaled. Reading the experiment file directly avoids that, and
// carries across two things a CSV cannot: the wave's own x scaling (sfA/sfB —
// the sampling interval) and its x units, which the app uses for the time axis.
//
// Layouts are from Igor's IgorBin.h (WaveMetrics, "Igor Technical Note 003").
// Only what this app needs is parsed: numeric 1-D waves, their scaling, units
// and note. Text waves, pictures, procedures and variables are skipped.
//
// Both byte orders are supported: experiments written on 68k/PowerPC Macs are
// big-endian, everything since is little-endian.

/** A numeric 1-D wave lifted out of an Igor file. */
export interface IgorWave {
  /** Data-folder path, e.g. "root:Cluster:set1C1(RD)". */
  path: string;
  /** Wave name without the folder path. */
  name: string;
  values: number[];
  /** Igor's x scaling: x(i) = x0 + i * dx. dx is the sampling interval. */
  dx: number;
  x0: number;
  /** x-dimension units as stored in the wave, e.g. "s", "min". "" if unset. */
  xUnits: string;
  /** Data (y) units, e.g. "pg/ml". "" if unset. */
  dataUnits: string;
  /** The wave note, verbatim. Often holds acquisition metadata. */
  note: string;
}

/** A wave present in the file that this reader deliberately did not load. */
export interface SkippedWave {
  path: string;
  reason: string;
}

export interface IgorFile {
  waves: IgorWave[];
  skipped: SkippedWave[];
}

// ---- Igor numeric type bits (IgorBin.h) ------------------------------------

const NT_CMPLX = 1;
const NT_FP32 = 2;
const NT_FP64 = 4;
const NT_I8 = 8;
const NT_I16 = 0x10;
const NT_I32 = 0x20;
const NT_I64 = 0x80;
const NT_UNSIGNED = 0x40;

interface NumType {
  bytes: number;
  read: (dv: DataView, off: number, le: boolean) => number;
}

/**
 * Decode the `type` field into an element reader. Returns null for text waves
 * (type 0) and for anything unrecognised.
 */
function numericType(type: number): NumType | null {
  const unsigned = (type & NT_UNSIGNED) !== 0;
  const base = type & ~(NT_UNSIGNED | NT_CMPLX);
  switch (base) {
    case NT_FP32:
      return { bytes: 4, read: (dv, o, le) => dv.getFloat32(o, le) };
    case NT_FP64:
      return { bytes: 8, read: (dv, o, le) => dv.getFloat64(o, le) };
    case NT_I8:
      return unsigned
        ? { bytes: 1, read: (dv, o) => dv.getUint8(o) }
        : { bytes: 1, read: (dv, o) => dv.getInt8(o) };
    case NT_I16:
      return unsigned
        ? { bytes: 2, read: (dv, o, le) => dv.getUint16(o, le) }
        : { bytes: 2, read: (dv, o, le) => dv.getInt16(o, le) };
    case NT_I32:
      return unsigned
        ? { bytes: 4, read: (dv, o, le) => dv.getUint32(o, le) }
        : { bytes: 4, read: (dv, o, le) => dv.getInt32(o, le) };
    case NT_I64:
      // Igor 7+. Doubles lose precision past 2^53, which no assay reaches.
      return unsigned
        ? { bytes: 8, read: (dv, o, le) => Number(dv.getBigUint64(o, le)) }
        : { bytes: 8, read: (dv, o, le) => Number(dv.getBigInt64(o, le)) };
    default:
      return null;
  }
}

// ---- small helpers ---------------------------------------------------------

/** Read a fixed-width, NUL-padded C string. Igor writes Latin-1 / UTF-8. */
function cstr(dv: DataView, off: number, max: number): string {
  const bytes: number[] = [];
  for (let i = 0; i < max; i++) {
    const b = dv.getUint8(off + i);
    if (b === 0) break;
    bytes.push(b);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
}

/** Read `len` bytes as text (Igor notes and extended units are not NUL-padded). */
function text(dv: DataView, off: number, len: number): string {
  if (len <= 0 || off + len > dv.byteLength) return "";
  const raw = new Uint8Array(dv.buffer, dv.byteOffset + off, len);
  return new TextDecoder("utf-8", { fatal: false }).decode(raw).replace(/\0+$/, "");
}

// ---- binary wave (.ibw, and the payload of a pxp wave record) --------------

const WAVE_HEADER_5 = 320; // sizeof(WaveHeader5); wData follows immediately
const WAVE_HEADER_2 = 110; // sizeof(WaveHeader2)

/**
 * Parse one Igor binary wave starting at `base`.
 *
 * `path` is the data-folder prefix the caller has walked to; the wave's own
 * name is appended. Throws for malformed input, returns null for waves this
 * app cannot use (text waves, multi-dimensional waves).
 */
function readWave(
  dv: DataView,
  base: number,
  le: boolean,
  folder: string,
): { wave: IgorWave } | { skipped: string; name: string } {
  const version = dv.getInt16(base, le);

  if (version === 5) {
    // BinHeader5 (64 bytes), then WaveHeader5 (320), then the data.
    const noteSize = dv.getInt32(base + 12, le);
    const dataEUnitsSize = dv.getInt32(base + 16, le);
    const dimEUnitsSize0 = dv.getInt32(base + 20, le);
    const wh = base + 64;

    const npnts = dv.getInt32(wh + 12, le);
    const type = dv.getInt16(wh + 16, le);
    const name = cstr(dv, wh + 28, 32);
    const nDim1 = dv.getInt32(wh + 72, le); // nDim[1]: non-zero means 2-D+

    if (nDim1 > 1) {
      return { skipped: `${nDim1}-column matrix wave — only 1-D waves are read`, name };
    }
    const nt = numericType(type);
    if (!nt) {
      return { skipped: type === 0 ? "text wave" : `unsupported numeric type ${type}`, name };
    }
    if (type & NT_CMPLX) return { skipped: "complex wave", name };
    if (npnts <= 0) return { skipped: "empty wave", name };

    const dataStart = wh + WAVE_HEADER_5;
    const dataBytes = npnts * nt.bytes;
    if (dataStart + dataBytes > dv.byteLength) {
      throw new Error(`wave "${name}" claims ${npnts} points but the file ends first.`);
    }

    const values = new Array<number>(npnts);
    for (let i = 0; i < npnts; i++) values[i] = nt.read(dv, dataStart + i * nt.bytes, le);

    // Units of 3 characters or fewer live in the header; longer ones are
    // appended after the data, in the order the BinHeader sizes list them.
    let after = dataStart + dataBytes;
    after += dv.getInt32(base + 8, le); // formulaSize
    const note = text(dv, after, noteSize);
    after += noteSize;
    const dataUnitsExt = text(dv, after, dataEUnitsSize);
    after += dataEUnitsSize;
    const xUnitsExt = text(dv, after, dimEUnitsSize0);

    return {
      wave: {
        path: folder + name,
        name,
        values,
        dx: dv.getFloat64(wh + 84, le), // sfA[0]
        x0: dv.getFloat64(wh + 116, le), // sfB[0]
        xUnits: xUnitsExt || cstr(dv, wh + 152, 4), // dimUnits[0]
        dataUnits: dataUnitsExt || cstr(dv, wh + 148, 4),
        note,
      },
    };
  }

  if (version === 1 || version === 2 || version === 3) {
    // BinHeader1/2/3 differ in length; WaveHeader2 is shared.
    const binHeader = version === 1 ? 8 : version === 2 ? 16 : 20;
    const noteSize = version === 1 ? 0 : dv.getInt32(base + 6, le);
    const wh = base + binHeader;

    const type = dv.getInt16(wh + 0, le);
    const name = cstr(dv, wh + 6, 20);
    const npnts = dv.getInt32(wh + 42, le);

    const nt = numericType(type);
    if (!nt) {
      return { skipped: type === 0 ? "text wave" : `unsupported numeric type ${type}`, name };
    }
    if (type & NT_CMPLX) return { skipped: "complex wave", name };
    if (npnts <= 0) return { skipped: "empty wave", name };

    const dataStart = wh + WAVE_HEADER_2;
    const dataBytes = npnts * nt.bytes;
    if (dataStart + dataBytes > dv.byteLength) {
      throw new Error(`wave "${name}" claims ${npnts} points but the file ends first.`);
    }
    const values = new Array<number>(npnts);
    for (let i = 0; i < npnts; i++) values[i] = nt.read(dv, dataStart + i * nt.bytes, le);

    // Pre-version-5 waves pad short data to 16 bytes before the note.
    const padded = Math.max(dataBytes, 16);
    return {
      wave: {
        path: folder + name,
        name,
        values,
        dx: dv.getFloat64(wh + 48, le), // hsA
        x0: dv.getFloat64(wh + 56, le), // hsB
        xUnits: cstr(dv, wh + 38, 4),
        dataUnits: cstr(dv, wh + 34, 4),
        note: text(dv, dataStart + padded, noteSize),
      },
    };
  }

  throw new Error(`unsupported Igor wave version ${version}.`);
}

/** Byte order of a wave record, from its version field (1-5 in one order only). */
function waveEndianness(dv: DataView, base: number): boolean {
  const le = dv.getInt16(base, true);
  if (le >= 1 && le <= 5) return true;
  const be = dv.getInt16(base, false);
  if (be >= 1 && be <= 5) return false;
  throw new Error("not an Igor binary wave (bad version field).");
}

/** Read a standalone .ibw file. */
export function readBinaryWave(buf: ArrayBuffer): IgorWave {
  const dv = new DataView(buf);
  if (dv.byteLength < 16) throw new Error("file is too short to be an Igor binary wave.");
  const got = readWave(dv, 0, waveEndianness(dv, 0), "");
  if ("skipped" in got) throw new Error(`this wave cannot be used: ${got.skipped}.`);
  return got.wave;
}

// ---- packed experiment (.pxp) ---------------------------------------------

const REC_WAVE = 3;
const REC_FOLDER_START = 10;
const REC_FOLDER_END = 11;
const RECORD_HEADER = 8;

/**
 * Walk the record stream of a packed experiment and pull out every numeric 1-D
 * wave, tagged with the data folder it lives in.
 *
 * A .pxp is a flat sequence of records — 2-byte type, 2-byte version, 4-byte
 * length, then that many bytes of payload. Folder start/end records bracket the
 * waves inside them, so tracking that stack reconstructs the tree.
 */
export function readPackedExperiment(buf: ArrayBuffer): IgorFile {
  const dv = new DataView(buf);
  const le = packedEndianness(dv);
  const waves: IgorWave[] = [];
  const skipped: SkippedWave[] = [];
  const stack: string[] = [];
  let pos = 0;

  while (pos + RECORD_HEADER <= dv.byteLength) {
    // The high bit marks a superseded record; the type is the low bits.
    const recordType = dv.getUint16(pos, le) & 0x7fff;
    const numDataBytes = dv.getInt32(pos + 4, le);
    const body = pos + RECORD_HEADER;
    if (numDataBytes < 0 || body + numDataBytes > dv.byteLength) {
      // Truncated tail: keep whatever was read rather than losing the file.
      break;
    }

    if (recordType === REC_FOLDER_START) {
      stack.push(cstr(dv, body, Math.min(numDataBytes, 255)));
    } else if (recordType === REC_FOLDER_END) {
      stack.pop();
    } else if (recordType === REC_WAVE && numDataBytes > 0) {
      const folder = stack.length ? stack.join(":") + ":" : "";
      try {
        const got = readWave(dv, body, waveEndianness(dv, body), folder);
        if ("skipped" in got) {
          skipped.push({ path: folder + got.name, reason: got.skipped });
        } else {
          waves.push(got.wave);
        }
      } catch (e) {
        skipped.push({
          path: `${folder}(wave at byte ${body})`,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    pos = body + numDataBytes;
  }

  if (waves.length === 0 && skipped.length === 0) {
    throw new Error("no waves found — this does not look like an Igor packed experiment.");
  }
  return { waves, skipped };
}

/** Byte order of the record stream, decided by which one yields a sane first record. */
function packedEndianness(dv: DataView): boolean {
  for (const le of [true, false]) {
    const type = dv.getUint16(0, le) & 0x7fff;
    const n = dv.getInt32(4, le);
    if (type <= 20 && n >= 0 && RECORD_HEADER + n <= dv.byteLength) return le;
  }
  throw new Error("not an Igor packed experiment (unrecognised first record).");
}

// ---- pairing heuristics ----------------------------------------------------

/**
 * Guess which waves go together, using the naming the Igor Cluster package
 * writes: a set is `<name>C1(RD)` for the data, `C2(STDEV)` for the errors and
 * `C3(Times)` for the time base. Falls back to sibling waves named "sem"/"sd".
 *
 * Returns the suggestion for `wave`; the user can always override it.
 */
export function suggestPartners(
  wave: IgorWave,
  all: IgorWave[],
): { error?: IgorWave; times?: IgorWave } {
  const sameLength = all.filter((w) => w !== wave && w.values.length === wave.values.length);
  const byPath = (p: string) => sameLength.find((w) => w.path === p);

  // Cluster-package column naming: swap the column tag, keep the set name.
  const m = /^(.*)C1\(RD\)$/.exec(wave.path);
  if (m) {
    return { error: byPath(`${m[1]}C2(STDEV)`), times: byPath(`${m[1]}C3(Times)`) };
  }

  const folder = wave.path.slice(0, wave.path.length - wave.name.length);
  const sibling = (re: RegExp) =>
    sameLength.find((w) => w.path.startsWith(folder) && re.test(w.name));
  return {
    error: sibling(/^(sem|sd|std|stdev|error|err)$/i) ?? sibling(/(sem|stdev|_sd|_err)/i),
    times: sibling(/^(time|times|t)$/i),
  };
}

/**
 * Igor x-unit strings mapped onto the app's time units. Unrecognised or empty
 * units return null so the caller leaves the user's own choice alone.
 */
export function timeUnitFromIgor(xUnits: string): "s" | "min" | "h" | null {
  switch (xUnits.trim().toLowerCase()) {
    case "s":
    case "sec":
    case "secs":
    case "second":
    case "seconds":
      return "s";
    case "min":
    case "mins":
    case "minute":
    case "minutes":
      return "min";
    case "h":
    case "hr":
    case "hrs":
    case "hour":
    case "hours":
      return "h";
    default:
      return null;
  }
}
