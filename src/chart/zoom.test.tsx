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
    // Unzoomed, this 6 h record ticks on whole hours, so the axis promotes
    // itself to hours and reads 0…6 (see promoteTimeUnit). Zoomed to an hour,
    // the ticks are 10-minute marks and stay in minutes.
    const all = ticks(draw());
    const win = ticks(draw([120, 180]));
    expect(Math.max(...all)).toBe(6);
    expect(Math.min(...win)).toBeGreaterThanOrEqual(120);
    expect(Math.max(...win)).toBeLessThanOrEqual(180);
  });

  it("clips the data so nothing spills outside the axes", () => {
    expect(draw([120, 180])).toMatch(/<clipPath id="plot-/);
    expect(draw([120, 180])).toMatch(/clip-path="url\(#plot-/);
  });

  it("leaves every reported statistic untouched", () => {
    // the chart is a pure view of one result; zooming re-renders, it does not
    // re-analyze, so the summary object is the same one either way
    const before = JSON.stringify(run.combined.summary);
    draw([120, 180]);
    draw();
    expect(JSON.stringify(run.combined.summary)).toBe(before);
    expect(run.combined.peaks.length).toBeGreaterThan(5);
  });

  it("never lets a window extend the axis past the record", () => {
    // The sweep that makes a window can overshoot the plot edges (pointer
    // capture keeps the drag alive out there), so the window arrives wider
    // than the data. The record ends at 360 min; an axis reaching 380 would
    // read as twenty minutes of data that does not exist.
    const signedTicks = (html: string) =>
      [...html.matchAll(/<text[^>]*y="4\d\d"[^>]*>(-?[\d,]+)<\/text>/g)]
        .map((m) => Number(m[1].replace(/,/g, "")))
        .filter((v) => Number.isFinite(v));
    const right = signedTicks(draw([300, 380]));
    expect(Math.max(...right)).toBeLessThanOrEqual(360);
    const left = signedTicks(draw([-40, 60]));
    expect(Math.min(...left)).toBeGreaterThanOrEqual(0);
  });

  it("still draws the whole record when no window is set", () => {
    // In hours, the promoted unit for a 6 h record: first tick at the start,
    // last within reach of the end.
    const t = ticks(draw());
    expect(Math.min(...t)).toBe(0);
    expect(Math.max(...t)).toBe(6);
    expect(draw()).toContain("Time (h)");
  });
});
