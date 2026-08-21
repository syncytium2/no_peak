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
  /** Missed, but lying inside a stretch already credited to an earlier pulse. */
  const swallowed: boolean[] = [];
  for (const o of onsets) {
    const inside = (s: { a: number; b: number }) => o >= s.a - dt && o <= s.b + dt;
    const i = spans.findIndex((s, ix) => !used.has(ix) && inside(s));
    if (i >= 0) used.add(i);
    found.push(i >= 0);
    swallowed.push(i < 0 && spans.some(inside));
  }
  return { found, swallowed, falsePositives: spans.length - used.size };
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
  const { found, swallowed, falsePositives } = credit(TRUE_ONSETS, spans, dt);
  return {
    times,
    values,
    dt,
    spans,
    found,
    swallowed,
    falsePositives,
    nTrue: TRUE_ONSETS.length,
    nFound: found.filter(Boolean).length,
    nSwallowed: swallowed.filter(Boolean).length,
  };
}

// ---- layout -----------------------------------------------------------------

const W = 760;
const H = 392;
const LEFT = 54;
const RIGHT = 16;
const TICK_Y = 92; // apex row for the "what really happened" markers
const PLOT_TOP = 112;
const PLOT_BOTTOM = 286;
const STRIP_Y = 296; // the "what the method reported" bars, under the record
const STRIP_H = 12;

/** A downward marker: solid for a pulse the method found, hollow for one it missed. */
function Marker({ x, found, y = TICK_Y }: { x: number; found: boolean; y?: number }) {
  const d = `M ${x - 6} ${y - 11} L ${x + 6} ${y - 11} L ${x} ${y} Z`;
  return (
    <path
      d={d}
      fill={found ? FIG.inkPrimary : FIG.surface}
      stroke={found ? FIG.inkPrimary : FIG.inkSecondary}
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
        released; {f.nFound} of them are solid, meaning the CLUSTER algorithm reported a pulse
        there, and {f.nTrue - f.nFound} are hollow, meaning it did not. Orange bars beneath the
        record mark the {f.spans.length} stretches the algorithm reports as a pulse.
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

      {/* leaders down to the trace for the pulses that were not reported */}
      {TRUE_ONSETS.map((o, i) =>
        f.found[i] ? null : (
          <line
            key={`lead${i}`}
            x1={x(o)}
            x2={x(o)}
            y1={TICK_Y + 2}
            y2={STRIP_Y + STRIP_H}
            stroke={FIG.inkMuted}
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ),
      )}
      {TRUE_ONSETS.map((o, i) => (
        <Marker key={`m${i}`} x={x(o)} found={f.found[i]} />
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

      {/* legend */}
      <g fontFamily={FIG.font} fontSize="12" fill={FIG.inkSecondary}>
        <Marker x={LEFT + 6} y={H - 26} found />
        <text x={LEFT + 18} y={H - 26}>
          a real pulse the method found ({f.nFound})
        </text>
        <Marker x={LEFT + 268} y={H - 26} found={false} />
        <text x={LEFT + 280} y={H - 26}>
          a real pulse it missed ({f.nTrue - f.nFound})
        </text>
        <rect
          x={LEFT + 468}
          y={H - 36}
          width={16}
          height={11}
          rx="2"
          fill={FIG.pulse}
          opacity={0.85}
        />
        <text x={LEFT + 488} y={H - 26}>
          reported as a pulse ({f.spans.length})
        </text>
      </g>
    </svg>
      <figcaption>
        <p>
          <strong>That gap is the problem.</strong> The record above is
          generated, so unlike any real experiment it comes with the answer attached:{" "}
          {f.nTrue} pulses of hormone were released into it. CLUSTER — the algorithm no_peak
          implements, running here at its default settings — reports {f.spans.length}.{" "}
          {f.falsePositives === 0 && "It invents nothing: every stretch it reports contains a real pulse. "}
          Of the {f.nTrue - f.nFound} it does not report separately, {f.nSwallowed} arrive while an
          earlier pulse is still being reported and are counted with it, and{" "}
          {f.nTrue - f.nFound - f.nSwallowed} falls where it reports no pulse at all.
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
          onsets, credited by the rule in <code>tools/score_benchmark.ts</code>. Simulated: it
          corresponds to no animal.
        </p>
      </figcaption>
    </figure>
  );
}
