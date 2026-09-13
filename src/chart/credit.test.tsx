// The source credit drawn into the figure has to arrive whole. It travels with
// every exported SVG, PNG and PDF, and its last clause is the one that matters:
// on the digitized records it says the error bars are reconstructed and gives
// the formula. Until 2026-09-12 the chart kept three wrapped lines, every
// digitized citation needed four, and each export stopped at "so the file
// supplies". Nothing failed; it was found by looking at the landing page.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClusterChart } from "./ClusterChart";
import { runSegments } from "../core/segments";
import { DEFAULT_PARAMS } from "../core/types";
import { SAMPLES, sampleByKey } from "../samples";

function draw(credit?: string) {
  const sample = sampleByKey("sim_gnrh_thx_ewe")!;
  const s = sample.load();
  const run = runSegments(
    [{ name: "x", values: s.values, times: s.times, error: s.error }],
    DEFAULT_PARAMS,
    sample.deltaT,
  );
  return renderToStaticMarkup(
    <ClusterChart result={run.combined} showError showMscore={false} xLabel="Time (min)"
      yLabel="GnRH" svgRef={{ current: null }} timeUnit="min" credit={credit} />,
  );
}

/** The credit as drawn: the text of every muted 9 px line, joined. */
const drawnCredit = (html: string) =>
  [...html.matchAll(/<text[^>]*font-size="9"[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&"))
    .join(" ");

const height = (html: string) => Number(html.match(/viewBox="0 0 \d+ (\d+(?:\.\d+)?)"/)![1]);

describe("the source credit drawn into a figure", () => {
  it("draws every word of a long credit, and grows the figure to hold it", () => {
    const words = Array.from({ length: 90 }, (_, i) => `word${i}`);
    const credit = `${words.join(" ")} so the file supplies max(floor, 0.08 x value).`;
    const html = draw(credit);
    expect(drawnCredit(html).replace(/\s+/g, " ")).toBe(credit);
    expect(height(html)).toBeGreaterThan(height(draw()) + 4 * 12);
  });

  it("carries every bundled citation whole, including the reconstruction clause", () => {
    const cited = SAMPLES.filter((s) => s.citation);
    for (const s of cited) {
      expect(drawnCredit(draw(s.citation)).replace(/\s+/g, " ")).toBe(s.citation!.replace(/\s+/g, " "));
    }
  });

  it("draws nothing and adds no space when there is no credit", () => {
    const html = draw();
    expect(drawnCredit(html)).toBe("");
    expect(html).not.toContain("<desc>");
  });
});
