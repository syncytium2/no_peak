// The lead figure states numbers, so the numbers are pinned here.
//
// Two ways it could quietly become a lie. The onsets it draws are copied out of
// `data/benchmark/truth.json` rather than imported from it, so a regenerated
// corpus would leave the markers pointing at pulses that are no longer there;
// this reads the file and compares. And the counts in its headline and caption
// come from a live CLUSTER run, so a change in the algorithm rewrites the
// figure's own claim about itself — which is the point, but it should be a
// decision rather than a surprise. If this fails, look at the picture and at
// the caption prose before touching the assertion.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIG_RECORD, TRUE_ONSETS, computeFigure } from "./ProblemFigure";

describe("the About page's lead figure", () => {
  it("draws the onsets the benchmark actually generated", () => {
    const truth = JSON.parse(readFileSync("data/benchmark/truth.json", "utf8")) as {
      records: Record<string, { true_onsets: number[]; params: Record<string, number> }>;
    };
    const rec = truth.records[FIG_RECORD];
    expect(rec).toBeDefined();
    expect(TRUE_ONSETS).toEqual(rec.true_onsets);
    expect(rec.params.n_true_pulses).toBe(TRUE_ONSETS.length);
  });

  it("still shows a detector reporting half of what happened, and inventing none", () => {
    const f = computeFigure();
    expect(f.nTrue).toBe(12);
    expect(f.spans).toHaveLength(6);
    expect(f.nFound).toBe(6);
    expect(f.falsePositives).toBe(0);
  });

  // The defect of 2026-08-21, kept as a test because it was invisible in the
  // code and obvious in the picture: eleven of the twelve real pulses lie
  // inside a stretch the detector reports, and the first version of the figure
  // drew five of those as "missed" — one of them over the tallest peak in the
  // record. Only a pulse the detector reports NOTHING for may be drawn hollow.
  it("only calls a pulse unreported when no reported stretch covers it", () => {
    const f = computeFigure();
    expect(f.perSpan).toEqual([2, 1, 1, 1, 3, 3]);
    expect(f.perSpan.reduce((a, b) => a + b, 0)).toBe(11);
    expect(f.nRunTogether).toBe(3);
    expect(f.unreported).toHaveLength(1);
    // every marker drawn solid is one the detector really did report
    f.inSpan.forEach((ix, i) => {
      if (ix >= 0) {
        const s = f.spans[ix];
        expect(TRUE_ONSETS[i]).toBeGreaterThanOrEqual(s.a - f.dt);
        expect(TRUE_ONSETS[i]).toBeLessThanOrEqual(s.b + f.dt);
      }
    });
  });
});
