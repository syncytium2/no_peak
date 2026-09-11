// The figure the About page leads with: a real ewe's portal GnRH, analyzed at
// the settings its paper published, drawn by the same chart the app uses.
//
// Nothing here is drawn by hand. The record and the settings come from
// `src/opening.ts`, which the app also opens on, and every number in the
// caption is counted from a live run when the page loads. `LeadFigure.test.tsx`
// pins those numbers and checks that the pulses land where the paper marked
// them, reading the paper's calls from disk. The calls are never imported here:
// `webster1991_pulses.csv` is the answer key and stays out of the bundle on
// purpose (see the glob in `src/samples.ts`).
//
// This replaced a simulated benchmark record on 2026-09-11. That figure charged
// the detector with pulses too small to see in the trace; the account is in
// docs/next-steps.md.

import { useMemo, useRef } from "react";
import { ClusterChart } from "./chart/ClusterChart";
import { runSegments, type Segment } from "./core/segments";
import { defaultAxisLabel } from "./core/timeUnits";
import type { ErrorModelType } from "./core/types";
import { opening } from "./opening";

/**
 * How many pulses the paper marks on this record's figure. Stated here because
 * the calls file never ships; the test reads that file and fails if the two
 * ever disagree.
 */
export const PUBLISHED_PULSES = 21;

/** The models that estimate error from the data: all a reader of the paper alone can use. */
const ESTIMATED: ErrorModelType[] = ["Local SD", "Local SE", "Global SD", "Global SE", "SQRT"];

export function computeLead() {
  const o = opening();
  if (!o.real) return null;
  const s = o.sample.load();
  const segments: Segment[] = [
    { name: o.sample.key, values: s.values, times: s.times, error: s.error },
  ];
  const run = (errorModel: ErrorModelType) =>
    runSegments(segments, { ...o.params, errorModel }, o.sample.deltaT).combined;
  const result = run(o.params.errorModel);
  return {
    sample: o.sample,
    params: o.params,
    result,
    nPulses: result.summary.nPeaks,
    /**
     * The record opens partway through a pulse: the chart shades its fall but
     * CLUSTER never saw the rise, so it carries no number. A reader counting
     * shaded bands gets one more than the headline, and the caption has to say
     * why.
     */
    opensMidPulse: result.pulse[0] === 1 && result.peaks.length > 0 && result.peaks[0].iFirst > 0,
    estimated: ESTIMATED.map((model) => ({ model, n: run(model).summary.nPeaks })),
  };
}

/** "a", "a and b", "a, b, and c". */
function list(items: string[]) {
  if (items.length < 3) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function LeadFigure() {
  const f = useMemo(computeLead, []);
  const svgRef = useRef<SVGSVGElement | null>(null);
  if (!f) return null;

  const { sample, params } = f;
  const same = f.nPulses === PUBLISHED_PULSES;
  const swing = list(
    f.estimated.map(({ model, n }, i) => `${n}${i === 0 ? (n === 1 ? " pulse" : " pulses") : ""} with ${model}`),
  );

  return (
    <figure className="leadfig">
      <p className="leadtitle">One ewe, six hours, {f.nPulses} pulses of GnRH.</p>
      <p className="leadsub">
        Portal blood sampled every {sample.deltaT} minutes, read off a printed figure from 1991
        and analyzed here with the settings that paper states.
      </p>
      <ClusterChart
        result={f.result}
        showError={false}
        showMscore={false}
        xLabel={defaultAxisLabel(sample.timeUnit)}
        yLabel={sample.valueLabel}
        svgRef={svgRef}
        timeUnit={sample.timeUnit}
        // No in-figure credit: ClusterChart keeps three 150-character lines, which
        // cuts this citation off before its reconstruction formula. The caption
        // prints it whole instead.
      />
      <figcaption>
        <p>
          <strong>
            {same
              ? `CLUSTER reports ${f.nPulses} pulses here, the same ${PUBLISHED_PULSES} the paper marked.`
              : `CLUSTER reports ${f.nPulses} pulses here; the paper marked ${PUBLISHED_PULSES}.`}
          </strong>{" "}
          The record is ewe #9013, thyroidectomized, from Fig. 4A of Webster et al. (1991). The
          settings are the paper&apos;s own: {params.nPeak}-point windows, t = {params.tScoreUp},
          and the original Fortran program. Each pulse is numbered to match the pulse table in the
          app.
          {f.opensMidPulse &&
            " The shaded stretch at the very start has no number because the record opens partway " +
              "through a pulse: CLUSTER sees it fall but never rise, so it does not count it, and " +
              "neither did the paper."}
        </p>
        <p>
          <strong>The agreement rests on a number the paper does not report.</strong> CLUSTER
          weighs each rise against the measurement error of every sample, and the paper does not
          say what error it supplied. This record carries a reconstructed one, 8% of each value
          with a floor fitted to the paper&apos;s own calls, so the match is partly built in.
          Estimate the error from the data instead, as a reader with only the paper must, and the
          same settings report {swing}.
        </p>
        <p>
          Counting hormone pulses, then, is not reading bumps off a chart. The count depends on
          the method and on every setting handed to it, including one most papers leave out.
          no_peak runs the method in your browser and keeps the settings attached to the answer,
          because the settings <em>are</em> the answer.
        </p>
        <p className="cite">
          {sample.citation} Detected live in your browser by the same code the app runs. Open the
          app and it starts here, on this record at these settings.
        </p>
      </figcaption>
    </figure>
  );
}
