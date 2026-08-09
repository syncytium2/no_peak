import { describe, expect, it } from "vitest";
import { parseSeries } from "./csv";
import { clusterMain } from "./cluster";
import { DEFAULT_PARAMS } from "./types";
import { TEMPLATE_CSV, TEMPLATE_NAME } from "../template";

// The template is what users are told to copy, so it has to survive the app's
// own parser and produce the two obvious pulses it visibly contains.
describe("downloadable CSV template", () => {
  const s = parseSeries(TEMPLATE_CSV);

  it("is a well-formed three-column file", () => {
    expect(TEMPLATE_NAME.endsWith(".csv")).toBe(true);
    expect(s.times).not.toBeNull();
    expect(s.error).not.toBeNull();
    expect(s.values.length).toBe(18);
    expect(s.error!.every((e) => e > 0)).toBe(true); // zero error breaks the t-test
  });

  it("detects the two pulses it obviously contains", () => {
    const r = clusterMain(
      s.times!, s.values,
      { ...DEFAULT_PARAMS, errorModel: "Error Wave" },
      s.error!,
    );
    expect(r.peaks.length).toBe(2);
    expect(r.valleys.length).toBe(1);
  });
});
