import { describe, expect, it } from "vitest";
import { parseLooseNumbers, parseSeries } from "./csv";

// The paste box feeds straight into parseSeries, so what matters is that the
// clipboard shapes people actually produce survive it.
describe("pasted clipboard data", () => {
  it("accepts a tab-separated block with a header (Excel / Igor)", () => {
    const s = parseSeries("time\tvalue\terror\n10\t0.42\t0.03\n20\t0.38\t0.03\n30\t0.45\t0.03");
    expect(s.values).toEqual([0.42, 0.38, 0.45]);
    expect(s.times).toEqual([10, 20, 30]);
    expect(s.error).toEqual([0.03, 0.03, 0.03]);
  });

  it("accepts a single pasted column with no header", () => {
    const s = parseSeries("0.42\n0.38\n0.45\n0.51");
    expect(s.values.length).toBe(4);
    expect(s.times).toBeNull();
  });

  it("tolerates Windows line endings and a trailing blank line", () => {
    const s = parseSeries("10,1.5\r\n20,2.5\r\n30,3.5\r\n\r\n");
    expect(s.values).toEqual([1.5, 2.5, 3.5]);
  });

  it("tolerates leading and trailing whitespace on rows", () => {
    const s = parseSeries("  10 , 1.5  \n  20 , 2.5  \n");
    expect(s.values).toEqual([1.5, 2.5]);
  });

  it("reports the offending line when a cell is not numeric", () => {
    expect(() => parseSeries("10,1.5\n20,ND\n30,3.5")).toThrow(/line 2/i);
  });
});

describe("hand-typed numbers (parseLooseNumbers)", () => {
  it("reads a single line of numbers as a series — the strict parser cannot", () => {
    const text = "1 1 1 8 12 6 2 1 1 1 9 14 7 2 1 1";
    expect(() => parseSeries(text)).toThrow(); // 16 "columns"
    expect(parseLooseNumbers(text)!.length).toBe(16);
  });

  it("ignores how the numbers are separated or wrapped", () => {
    expect(parseLooseNumbers("1,2,3\n4 5\t6;7")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("accepts decimals and negatives", () => {
    expect(parseLooseNumbers("-1.5 0.25 3e2")).toEqual([-1.5, 0.25, 300]);
  });

  it("declines non-numeric text so the column parser keeps its error message", () => {
    expect(parseLooseNumbers("time value\n10 abc")).toBeNull();
  });

  it("declines input too short to analyze", () => {
    expect(parseLooseNumbers("1 2")).toBeNull();
  });
});
