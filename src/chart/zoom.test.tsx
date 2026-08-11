// Zoom is a view control. The guarantee worth pinning is that it changes what
// is drawn and nothing else: the same pulses, intervals and frequency, whatever
// window happens to be on screen. A statistic that moved as you looked closer
// would quietly invalidate every number someone read off the page.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClusterChart } from "./ClusterChart";
import { runSegments } from "../core/segments";
import { DEFAULT_PARAMS } from "../core/types";
import { SAMPLES } from "../samples";

const sample = SAMPLES.find((s) => s.key === "w91_gnrh_thx_9013")!;
const series = sample.load();
const run = runSegments(
  [{ name: "x", values: series.values, times: series.times, error: series.error }],
  // settings that actually find this record's pulses, so the test exercises
  // a figure with something in it
  { ...DEFAULT_PARAMS, nPeak: 1, nNadir: 1, tScoreUp: 1, tScoreDn: 1 }, sample.deltaT,
);

const draw = (xRange?: [number, number]) =>
  renderToStaticMarkup(
    <ClusterChart result={run.combined} showError showMscore xLabel="Time (min)"
      yLabel="GnRH" svgRef={{ current: null }} timeUnit="min" xRange={xRange}
      onXRangeChange={() => {}} />);

/** x-axis tick labels, which reveal the visible domain. */
const ticks = (html: string) =>
  [...html.matchAll(/<text[^>]*y="4\d\d"[^>]*>([\d,]+)<\/text>/g)]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((v) => Number.isFinite(v));

describe("horizontal zoom", () => {
  it("narrows the axis to the requested window", () => {
    const all = ticks(draw());
    const win = ticks(draw([120, 180]));
    expect(Math.max(...all)).toBeGreaterThan(300);
    expect(Math.min(...win)).toBeGreaterThanOrEqual(120);
    expect(Math.max(...win)).toBeLessThanOrEqual(180);
  });

  it("clips the data so nothing spills outside the axes", () => {
    expect(draw([120, 180])).toMatch(/<clipPath id="plot-/);
    expect(draw([120, 180])).toMatch(/clip-path="url\(#plot-/);
  });

  it("leaves every reported statistic untouched", () => {
    // the chart is a pure view of one result; zooming re-renders, it does not
    // re-analyse, so the summary object is the same one either way
    const before = JSON.stringify(run.combined.summary);
    draw([120, 180]);
    draw();
    expect(JSON.stringify(run.combined.summary)).toBe(before);
    expect(run.combined.peaks.length).toBeGreaterThan(5);
  });

  it("still draws the whole record when no window is set", () => {
    const t = ticks(draw());
    expect(Math.min(...t)).toBeLessThanOrEqual(60);
    expect(Math.max(...t)).toBeGreaterThanOrEqual(300);
  });
});
