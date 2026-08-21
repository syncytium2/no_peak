// The figure the About page opens with: what a pulse detector is for, and why
// counting pulses is not reading bumps off a chart.
//
// Nothing here is drawn by hand. The trace is one record of the committed
// benchmark corpus, the orange stretches are what `clusterMain` reports at its
// default settings when this page loads, and every number in the headline and
// the legend is counted from that run. A change to the algorithm moves the
// picture and the words together, so the figure cannot drift into a claim the
// code no longer supports. `src/ProblemFigure.test.ts` pins the counts and
// re-reads the true onsets from `data/benchmark/truth.json`.
//
// Why a simulated record rather than a real one: the point of the figure is
// the gap between what happened and what was reported, and only generated data
// knows what happened. No animal is depicted. See data/benchmark and
// tools/simulate_benchmark.py.

import { useMemo } from "react";
import { clusterMain } from "./core/cluster";
import { parseSeries } from "./core/csv";
import { DEFAULT_PARAMS } from "./core/types";
import { FIG } from "./chart/palette";
import recordCsv from "../data/benchmark/series/0129.csv?raw";

/** Which benchmark record is drawn, for the caption and the test. */
export const FIG_RECORD = "0129";

/**
 * The pulse onsets the simulator generated for record 0129, in minutes —
 * `records["0129"].true_onsets` of `data/benchmark/truth.json`, seed 20260810.
 *
 * Copied rather than imported: `truth.json` carries all 200 records, and
 * importing it would ship 200 answer keys to draw one figure. The test reads
 * the file from disk and fails if these twelve numbers ever stop matching it.
 */
export const TRUE_ONSETS = [
  15.7143, 54.8912, 89.3461, 133.8119, 163.7702, 207.1155, 236.5741, 248.1398, 275.2539, 308.3174,
  321.9545, 354.2133,
];

/**
 * Credit each true pulse to at most one reported pulse, the rule
 * `tools/score_benchmark.ts` scores the whole corpus by: an onset counts as
 * found when it falls inside a reported stretch widened by one sampling
 * interval at each end (CLUSTER flags the rise a sample or so after secretion
 * starts), and a reported stretch can only be credited once — so two real
 * pulses reported as one count as one found and one missed.
 */
function credit(onsets: number[], spans: { a: number; b: number }[], dt: number) {
  const used = new Set<number>();
  const found: boolean[] = [];
  /**
   * Which reported stretch each real pulse falls in, or -1 for the pulses the
   * detector reports nothing for. This is containment, not credit: several
   * onsets can share a stretch, and that is the case the figure exists to show.
   *
   * ⚠ Keeping this separate from `found` is the whole correction of 2026-08-21.
   * The first published figure drew every uncredited pulse hollow, which put a
   * "missed" marker over the tallest peak in the record — a peak the detector
   * plainly did report, inside a stretch already credited to the pulse before
   * it. The scoring rule was right and the picture was a lie. Score with
   * `found`; draw with `inSpan`.
   */
  const inSpan: number[] = [];
  for (const o of onsets) {
    const inside = (s: { a: number; b: number }) => o >= s.a - dt && o <= s.b + dt;
    const i = spans.findIndex((s, ix) => !used.has(ix) && inside(s));
    if (i >= 0) used.add(i);
    found.push(i >= 0);
    inSpan.push(spans.findIndex(inside));
  }
  return { found, inSpan, falsePositives: spans.length - used.size };
}

export function computeFigure() {
  const s = parseSeries(recordCsv);
  const times = s.times!;
  const values = s.values;
  const error = s.error!;
  const dt = times[1] - times[0];
  // Error Wave, not the Local SD default: these records carry the per-sample
  // assay error the simulator used, and scoring them any other way would
  // measure the error model rather than the detector.
  const run = clusterMain(times, values, { ...DEFAULT_PARAMS, errorModel: "Error Wave" }, error);
  const spans = run.peaks.map((p) => ({ a: times[p.iFirst], b: times[p.iLast] }));
  const { found, inSpan, falsePositives } = credit(TRUE_ONSETS, spans, dt);
  /** How many real pulses fall inside each reported stretch. */
  const perSpan = spans.map((_, ix) => inSpan.filter((i) => i === ix).length);
  const unreported = TRUE_ONSETS.filter((_, i) => inSpan[i] < 0);
  return {
    times,
    values,
    dt,
    spans,
    found,
    inSpan,
    perSpan,
    unreported,
    falsePositives,
    nTrue: TRUE_ONSETS.length,
    nFound: found.filter(Boolean).length,
    /** Stretches reporting one pulse where two or more happened. */
    nRunTogether: perSpan.filter((n) => n > 1).length,
  };
}

/** Minutes into the record as "3 h 27 min", the way the axis reads it. */
function hhmm(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

// ---- layout -----------------------------------------------------------------

const W = 760;
const H = 410;
const LEFT = 54;
const RIGHT = 16;
const TICK_Y = 92; // apex row for the "what really happened" markers
const PLOT_TOP = 112;
const PLOT_BOTTOM = 280;
const STRIP_Y = 290; // the "what the method reported" bars, under the record
const STRIP_H = 16;

/**
 * A real pulse. Solid when the method reports a pulse covering it, hollow when
 * it reports nothing there — which is a different statement from "credited", and
 * the distinction this figure got wrong once already.
 */
function Marker({ x, reported, y = TICK_Y }: { x: number; reported: boolean; y?: number }) {
  const d = `M ${x - 6} ${y - 11} L ${x + 6} ${y - 11} L ${x} ${y} Z`;
  return (
    <path
      d={d}
      fill={reported ? FIG.inkPrimary : FIG.surface}
      stroke={reported ? FIG.inkPrimary : FIG.inkSecondary}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}

export function ProblemFigure() {
  const f = useMemo(computeFigure, []);
  const tMax = f.times[f.times.length - 1] + f.dt / 2;
  const vMax = Math.max(...f.values);
  const yTop = vMax * 1.06;
  const x = (t: number) => LEFT + (t / tMax) * (W - LEFT - RIGHT);
  const y = (v: number) => PLOT_BOTTOM - (v / yTop) * (PLOT_BOTTOM - PLOT_TOP);

  const line = f.values.map((v, i) => `${i ? "L" : "M"} ${x(f.times[i])} ${y(v)}`).join(" ");
  const hours = [];
  for (let t = 0; t <= tMax; t += 60) hours.push(t);
  // whole-number gridlines, two or three of them, whatever the data's scale
  const step = [0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => yTop / s <= 4) ?? 200;
  const yTicks = [];
  for (let v = 0; v <= yTop; v += step) yTicks.push(v);

  const headline = `${f.nTrue} pulses of hormone happened here. A standard method reports ${f.spans.length}.`;
  // exact, because "6 hours" of a 6 h 25 min record is the kind of rounding a
  // figure should not do to its own axis
  const last = f.times[f.times.length - 1];
  const duration = `${Math.floor(last / 60)} h ${Math.round(last % 60)} min`;

  return (
    <figure className="leadfig">
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-labelledby="leadfig-title leadfig-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="leadfig-title">{headline}</title>
      <desc id="leadfig-desc">
        A simulated record of hormone concentration in blood sampled every {f.dt} minutes for{" "}
        {duration}. {f.nTrue} markers along the top show where a pulse of hormone was actually
        released. Orange bars beneath the record are the {f.spans.length} stretches the CLUSTER
        algorithm reports as a pulse, each labelled with the number of real pulses inside it:{" "}
        {f.perSpan.join(", ")}. {f.nRunTogether} of them run two or more real pulses together and
        report them as one. {f.unreported.length} real pulse falls where the algorithm reports
        nothing at all, and its marker is hollow.
      </desc>

      <rect x="0" y="0" width={W} height={H} fill={FIG.surface} />

      <text x={LEFT} y="30" fontFamily={FIG.font} fontSize="21" fontWeight="600" fill={FIG.inkPrimary}>
        {headline}
      </text>
      <text x={LEFT} y="54" fontFamily={FIG.font} fontSize="14" fill={FIG.inkSecondary}>
        Hormone in the blood, sampled every {f.dt} minutes for {duration}.
      </text>

      <text x={LEFT} y="76" fontFamily={FIG.font} fontSize="12" fill={FIG.inkSecondary}>
        when a pulse of hormone was actually released
      </text>

      {/* A leader from every marker down to the bar row. All twelve, not just
          the interesting ones: what the reader has to be able to see is which
          bar each pulse lands on, and three markers standing over one bar is
          the whole point. */}
      {TRUE_ONSETS.map((o, i) => (
        <line
          key={`lead${i}`}
          x1={x(o)}
          x2={x(o)}
          y1={TICK_Y + 2}
          y2={STRIP_Y + STRIP_H}
          stroke={f.inSpan[i] < 0 ? FIG.inkMuted : FIG.axis}
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      {TRUE_ONSETS.map((o, i) => (
        <Marker key={`m${i}`} x={x(o)} reported={f.inSpan[i] >= 0} />
      ))}

      {/* What the algorithm calls a pulse: a wash over the record, and a solid
          bar beneath it. The wash alone was the whole picture at first and it
          swamped the data — six stretches cover most of six hours — while the
          bar states the same thing in a row of its own, against the row of
          markers above, which is the comparison the figure is making. */}
      {f.spans.map((s, i) => (
        <g key={`sp${i}`}>
          <rect
            x={x(s.a - f.dt / 2)}
            y={PLOT_TOP}
            width={x(s.b + f.dt / 2) - x(s.a - f.dt / 2)}
            height={PLOT_BOTTOM - PLOT_TOP}
            fill={FIG.pulse}
            opacity={0.07}
          />
          <rect
            x={x(s.a - f.dt / 2)}
            y={STRIP_Y}
            width={x(s.b + f.dt / 2) - x(s.a - f.dt / 2)}
            height={STRIP_H}
            rx="2"
            fill={FIG.pulse}
            opacity={0.85}
          />
          {/* how many real pulses are inside this one reported pulse — dark on
              the bar rather than white, which at 11px on this orange is not a
              contrast anyone should have to squint at */}
          <text
            x={(x(s.a - f.dt / 2) + x(s.b + f.dt / 2)) / 2}
            y={STRIP_Y + STRIP_H - 4}
            fontFamily={FIG.font}
            fontSize="11"
            fontWeight="700"
            fill={FIG.inkPrimary}
            textAnchor="middle"
          >
            {f.perSpan[i]}
          </text>
        </g>
      ))}

      {/* axes */}
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line
            x1={LEFT}
            x2={W - RIGHT}
            y1={y(v)}
            y2={y(v)}
            stroke={FIG.grid}
            strokeWidth="1"
          />
          <text
            x={LEFT - 8}
            y={y(v) + 4}
            fontFamily={FIG.font}
            fontSize="11"
            fill={FIG.inkMuted}
            textAnchor="end"
          >
            {v}
          </text>
        </g>
      ))}
      <line
        x1={LEFT}
        x2={W - RIGHT}
        y1={PLOT_BOTTOM}
        y2={PLOT_BOTTOM}
        stroke={FIG.axis}
        strokeWidth="1"
      />
      {hours.map((t) => (
        <text
          key={`x${t}`}
          x={x(t)}
          y={STRIP_Y + STRIP_H + 16}
          fontFamily={FIG.font}
          fontSize="11"
          fill={FIG.inkMuted}
          textAnchor="middle"
        >
          {t === 0 ? "0" : `${t / 60} h`}
        </text>
      ))}
      <text
        x={LEFT - 40}
        y={(PLOT_TOP + PLOT_BOTTOM) / 2}
        fontFamily={FIG.font}
        fontSize="11"
        fill={FIG.inkSecondary}
        textAnchor="middle"
        transform={`rotate(-90 ${LEFT - 40} ${(PLOT_TOP + PLOT_BOTTOM) / 2})`}
      >
        hormone (simulated units)
      </text>

      {/* the record */}
      <path d={line} fill="none" stroke={FIG.series} strokeWidth="2" strokeLinejoin="round" />
      {f.values.map((v, i) => (
        <circle
          key={`p${i}`}
          cx={x(f.times[i])}
          cy={y(v)}
          r="2.5"
          fill={FIG.series}
          stroke={FIG.surface}
          strokeWidth="1.5"
        />
      ))}

      {/* legend, two rows: the bar entry has to explain its own numeral and
          will not share a line with anything */}
      <g fontFamily={FIG.font} fontSize="12" fill={FIG.inkSecondary}>
        <Marker x={LEFT + 6} y={H - 44} reported />
        <text x={LEFT + 18} y={H - 44}>
          a pulse that really happened ({f.nTrue})
        </text>
        <Marker x={LEFT + 268} y={H - 44} reported={false} />
        <text x={LEFT + 280} y={H - 44}>
          one the method reports nothing for ({f.unreported.length})
        </text>
        <rect x={LEFT + 2} y={H - 32} width={16} height={11} rx="2" fill={FIG.pulse} opacity={0.85} />
        <text
          x={LEFT + 10}
          y={H - 23}
          fontSize="10"
          fontWeight="700"
          fill={FIG.inkPrimary}
          textAnchor="middle"
        >
          n
        </text>
        <text x={LEFT + 26} y={H - 22}>
          one pulse as the method reports it ({f.spans.length}) — the number is how many real pulses
          are inside
        </text>
      </g>
    </svg>
      <figcaption>
        <p>
          <strong>That gap is the problem.</strong> The record above is generated, so unlike any
          real experiment it comes with the answer attached: {f.nTrue} pulses of hormone were
          released into it. CLUSTER — the algorithm no_peak implements, running here at its default
          settings — reports {f.spans.length}.{" "}
          {f.falsePositives === 0 &&
            "It invents nothing, and it is not blind to the big ones: every stretch it reports contains a real pulse. "}
          What it cannot do is separate pulses that arrive close together. {f.nRunTogether} of its{" "}
          {f.spans.length} reported pulses cover two or three real ones and report them as one —
          which is why the numbers on the bars add to {f.perSpan.reduce((a, b) => a + b, 0)} rather
          than {f.spans.length}. {f.unreported.length === 1 ? "One pulse" : `${f.unreported.length} pulses`}{" "}
          {f.unreported.length === 1 ? "falls" : "fall"} where it reports nothing at all, at{" "}
          {f.unreported.map(hhmm).join(" and ")}.
        </p>
        <p>
          Score that the way this project scores its benchmark — one reported pulse can be credited
          to only one real one — and it is <strong>{f.nFound} of {f.nTrue}</strong> found with{" "}
          {f.falsePositives} invented, which is about what CLUSTER manages across data with known
          answers. The conservatism is the trade the algorithm is chosen for; the merging is the
          price.
        </p>
        <p>
          Which is to say that counting hormone pulses is not reading bumps off a chart. The answer
          depends on a method and on the settings handed to it, and two defensible settings give
          two different numbers. no_peak runs that method in your browser and keeps the settings
          attached to the answer, because the settings <em>are</em> the answer.
        </p>
        <p className="cite">
          Record {FIG_RECORD} of the 200-record simulated benchmark in this repository
          (<code>data/benchmark</code>, seed 20260810), sampled every {f.dt} min. Detected live in
          your browser by the same code the app runs; the marked pulses are the simulator&apos;s own
          onsets, and the {f.nFound}-of-{f.nTrue} score is the credit rule in{" "}
          <code>tools/score_benchmark.ts</code>. Simulated: it corresponds to no animal.
        </p>
      </figcaption>
    </figure>
  );
}
