// The landing page's lead figure states numbers, and the app opens on the same
// record at the same settings, so both are pinned here.
//
// The caption says CLUSTER reports the same 21 pulses the paper marked. The
// count is computed live, but "the same" can only be checked against the
// paper's calls, which never ship — so this reads them from disk. If a test
// here fails, look at the rendered figure and at the caption prose before
// touching the assertion.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadFigure, PUBLISHED_PULSES, computeLead } from "./LeadFigure";
import { OPENING_PRESET, OPENING_SAMPLE, opening } from "./opening";
import { matchPreset } from "./core/presets";
import { sampleByKey } from "./samples";
import { HAVE_DIGITIZED } from "./testing/haveDigitized";
import { matchCalls, publishedCalls } from "./testing/webster1991Calls";

const SERIES = "fig4a_thx_9013_gnrh";

describe("what a cold start shows", () => {
  it("falls back to the simulated record at the generic defaults without the digitized tree", () => {
    const o = opening((key) => (key.startsWith("w91_") ? undefined : sampleByKey(key)));
    expect(o.real).toBe(false);
    expect(o.sample.provenance).toBe("simulated");
    expect(matchPreset(o.params)?.key).toBe("default");
  });
});

describe.skipIf(!HAVE_DIGITIZED)("the About page's lead figure", () => {
  it("opens on ewe #9013 at the paper's portal GnRH settings", () => {
    const o = opening();
    expect(o.real).toBe(true);
    expect(o.sample.key).toBe(OPENING_SAMPLE);
    expect(o.sample.provenance).toBe("digitized");
    expect(matchPreset(o.params)?.key).toBe(OPENING_PRESET);
  });

  it("reports the paper's 21 pulses, at the places the paper marked them", () => {
    const f = computeLead()!;
    const calls = publishedCalls([SERIES]).get(SERIES)!;
    expect(calls.size).toBe(PUBLISHED_PULSES);
    expect(f.nPulses).toBe(PUBLISHED_PULSES);
    const found = f.result.peaks.map((p) => p.iMax);
    expect(matchCalls(found, calls)).toEqual({ hit: PUBLISHED_PULSES, missed: 0, extra: 0 });
  });

  // Found by looking at the page, not by a test: the chart shades a band at the
  // start with no number, so a reader counts one more band than the headline
  // says. The caption explains it only while it is true, and the paper's calls
  // are what make "neither did the paper" true.
  it("explains the unnumbered band at the start, and only because it is there", () => {
    const f = computeLead()!;
    expect(f.opensMidPulse).toBe(true);
    const firstCall = Math.min(...publishedCalls([SERIES]).get(SERIES)!);
    expect(firstCall).toBe(f.result.peaks[0].iFirst);
    expect(renderToStaticMarkup(<LeadFigure />)).toContain("opens partway through a pulse");
  });

  // The caption's second paragraph quotes these. They are the evidence that the
  // match depends on the error the paper leaves out, so a change here is a
  // change to what the figure argues.
  it("shows the count swinging with the error model the paper does not report", () => {
    const f = computeLead()!;
    expect(Object.fromEntries(f.estimated.map((e) => [e.model, e.n]))).toEqual({
      "Local SD": 0,
      "Local SE": 3,
      "Global SD": 1,
      "Global SE": 21,
      SQRT: 0,
    });
  });

  it("renders the count it computed, and says where the data came from", () => {
    const html = renderToStaticMarkup(<LeadFigure />);
    expect(html).toContain("the same 21 the paper marked");
    expect(html).toContain("0 pulses with Local SD, 3 with Local SE");
    expect(html).toContain("Webster JR");
  });
});
