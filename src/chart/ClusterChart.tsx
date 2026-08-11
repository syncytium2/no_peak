// Publication figure: concentration series with CLUSTER pulse overlay.
// Layout mirrors the Igor Cluster panel — t-score panel on top, main series
// panel, then UP/DOWN flag strips sharing the x axis. All styling is baked as
// SVG attributes so the exported figure is self-contained.

import { useId, useMemo, useRef, useState } from "react";
import type { ClusterResult } from "../core/types";
import type { SegmentResult } from "../core/segments";
import { timeUnitDef, type TimeUnit } from "../core/timeUnits";
import { fmt } from "../core/format";
import { FIG, ERROR_BAR_OPACITY, type FigPalette } from "./palette";
import { linearScale, niceTicks, padDomain, formatTick, timeTicks } from "./scale";

export interface ClusterChartProps {
  result: ClusterResult;
  showError: boolean;
  showMscore: boolean;
  xLabel: string;
  yLabel: string;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  palette?: FigPalette;
  /** Units of the x axis; picks the tick ladder. */
  timeUnit?: TimeUnit;
  /** Set when several records are shown end to end, to draw the boundaries. */
  segments?: SegmentResult[];
  /**
   * Source credit for data that is not the reader's own, drawn into the figure
   * itself. An exported SVG or PNG separates from the app the moment it is
   * dropped into a talk, so the credit has to be part of the artwork rather
   * than something the app remembers on its behalf.
   */
  credit?: string;
  /**
   * Visible slice of the x axis, in the data's own time units. Undefined shows
   * the whole record. Zoom is a view control only — detection and every
   * reported statistic still run over the entire record, because a pulse count
   * that changed as you looked closer would be a trap.
   */
  xRange?: [number, number];
  onXRangeChange?: (r: [number, number] | undefined) => void;
}

const W = 900;
const M = { left: 64, right: 24, top: 10 };
const MSCORE_H = 92;
const MAIN_H = 300;
const STRIP_H = 18;
const GAP = 12;
const AXIS_H = 44;

interface Run {
  start: number;
  end: number; // inclusive index of last pulse point
}

function pulseRuns(pulse: number[]): Run[] {
  const runs: Run[] = [];
  let start = -1;
  for (let i = 0; i < pulse.length; i++) {
    if (pulse[i] === 1 && start < 0) start = i;
    if (pulse[i] !== 1 && start >= 0) {
      runs.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: pulse.length - 1 });
  return runs;
}

export function ClusterChart({
  result,
  showError,
  showMscore,
  xLabel,
  yLabel,
  svgRef,
  palette: P = FIG,
  timeUnit = "min",
  segments,
  credit,
  xRange,
  onXRangeChange,
}: ClusterChartProps) {
  const { times, values, error, ups, downs, mscoreUp, pulse, peaks, params } = result;
  const n = values.length;
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<
    { from: number; to: number; pan: boolean; base: [number, number] } | null
  >(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const mscoreTop = M.top;
  const mainTop = showMscore ? mscoreTop + MSCORE_H + GAP : M.top;
  const stripTop = mainTop + MAIN_H + GAP;
  const axisTop = stripTop + 2 * STRIP_H + 6;
  const CREDIT_H = credit ? 38 : 0;
  const H = axisTop + AXIS_H + CREDIT_H;

  const layout = useMemo(() => {
    const dt = times.length > 1 ? times[1] - times[0] : 1;
    const full: [number, number] = [times[0] - dt / 2, times[n - 1] + dt / 2];
    const x = linearScale(xRange ?? full, [M.left, W - M.right]);

    let yLo = Infinity;
    let yHi = -Infinity;
    for (let i = 0; i < n; i++) {
      const e = showError ? error[i] : 0;
      yLo = Math.min(yLo, values[i] - e);
      yHi = Math.max(yHi, values[i] + e);
    }
    // Peak numbers sit in a row along the top of the panel, so the y scale has
    // to leave a band clear for them. Two rows when the pulses are packed
    // tightly enough that one row would collide — staggering keeps every pulse
    // numbered, which matters because the numbers key the figure to the table.
    const xs = peaks.map((pk) => x(times[pk.iMax])).sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < xs.length; i++) minGap = Math.min(minGap, xs[i] - xs[i - 1]);
    const labelRows = xs.length > 1 && minGap < 16 ? 2 : 1;

    const yDom = padDomain([Math.min(yLo, 0), yHi], 0.05, labelRows === 2 ? 0.2 : 0.14);
    const y = linearScale(yDom, [mainTop + MAIN_H, mainTop]);

    let tHi = 1;
    for (let i = 0; i < n; i++) tHi = Math.max(tHi, Math.abs(mscoreUp[i]));
    const tDom = padDomain([-tHi, tHi], 0.08, 0.08);
    const yT = linearScale(tDom, [mscoreTop + MSCORE_H, mscoreTop]);

    return { x, y, yT, dt, labelRows, full };
  }, [times, values, error, mscoreUp, n, showError, mainTop, mscoreTop, peaks, xRange]);

  const { x, y, yT, dt, labelRows, full } = layout;
  const zoomed = !!xRange;
  // Anything data-driven has to be clipped to the panel: once the domain is a
  // window, samples outside it map outside the axes and would otherwise be
  // drawn over the labels and the margin.
  const clip = `plot-${useId().replace(/:/g, "")}`;
  const clipped = { clipPath: `url(#${clip})` };
  // A time axis gets clock divisions (…30 s, 1 min, 5 min…) rather than the
  // decimal 1/2/5 ladder, which on a seconds axis reads 100, 200, 300.
  const unitMinutes = timeUnitDef(timeUnit).minutes;
  const xTicks =
    unitMinutes === null
      ? niceTicks(x.domain[0], x.domain[1], 8)
      : timeTicks(x.domain[0], x.domain[1], 8, unitMinutes * 60);
  const yTicks = niceTicks(y.domain[0], y.domain[1], 6);
  const tTicks = niceTicks(yT.domain[0], yT.domain[1], 3);
  const runs = pulseRuns(pulse);
  const showDots = n <= 150;

  // Where one record ends and the next begins, plus a centred name for each.
  // Drawn because the joins are otherwise invisible, and a reader is entitled
  // to know that the trace is several animals rather than one long recording.
  const joins = useMemo(() => {
    if (!segments || segments.length < 2) return { lines: [] as number[], labels: [] as { at: number; name: string }[] };
    const lines: number[] = [];
    const labels: { at: number; name: string }[] = [];
    segments.forEach((s, k) => {
      if (k > 0) lines.push((times[s.start - 1] + times[s.start]) / 2);
      labels.push({ at: (times[s.start] + times[s.start + s.length - 1]) / 2, name: s.name });
    });
    return { lines, labels };
  }, [segments, times]);

  const linePath = useMemo(() => {
    let d = "";
    for (let i = 0; i < n; i++) {
      d += `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(2)},${y(values[i]).toFixed(2)}`;
    }
    return d;
  }, [x, y, times, values, n]);

  const tPath = useMemo(() => {
    let d = "";
    for (let i = 0; i < n; i++) {
      d += `${i === 0 ? "M" : "L"}${x(times[i]).toFixed(2)},${yT(mscoreUp[i]).toFixed(2)}`;
    }
    return d;
  }, [x, yT, times, mscoreUp, n]);

  /** Pointer position in viewBox units, which is what every scale speaks. */
  function atPointer(ev: React.PointerEvent) {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return ((ev.clientX - r.left) / r.width) * W;
  }

  /** Invert the x scale: viewBox px back to a time. */
  const timeAt = (px: number) =>
    x.domain[0] + ((px - x.range[0]) / (x.range[1] - x.range[0])) * (x.domain[1] - x.domain[0]);

  function onMove(ev: React.PointerEvent<SVGRectElement>) {
    const px = atPointer(ev);
    if (px === null) return;

    if (drag) {
      // Shift drags the window along; a plain drag sweeps out a new one.
      if (drag.pan) {
        const shift = timeAt(drag.from) - timeAt(px);
        const [a, b] = drag.base;
        const width = b - a;
        let lo = a + shift;
        if (lo < full[0]) lo = full[0];
        if (lo + width > full[1]) lo = full[1] - width;
        onXRangeChange?.([lo, lo + width]);
      } else {
        setDrag({ ...drag, to: px });
      }
      setHover(null);
      return;
    }

    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(times[i]) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  function onDown(ev: React.PointerEvent<SVGRectElement>) {
    const px = atPointer(ev);
    if (px === null || !onXRangeChange) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    setDrag({ from: px, to: px, pan: ev.shiftKey && zoomed, base: xRange ?? full });
  }

  function onUp(ev: React.PointerEvent<SVGRectElement>) {
    if (!drag) return;
    const { from, to, pan } = drag;
    setDrag(null);
    ev.currentTarget.releasePointerCapture?.(ev.pointerId);
    if (pan) return;
    // Too short a sweep is a click, not a selection — leave the view alone so
    // the tooltip stays usable.
    if (Math.abs(to - from) < 8) return;
    const lo = timeAt(Math.min(from, to));
    const hi = timeAt(Math.max(from, to));
    if (hi - lo > 0) onXRangeChange?.([lo, hi]);
  }

  // tooltip placement in % of container so it tracks responsive scaling
  const tooltipLeftPct = hover !== null ? (x(times[hover]) / W) * 100 : 0;
  const flipTooltip = hover !== null && x(times[hover]) > W * 0.72;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Concentration time series with CLUSTER pulse detection overlay"
      >
        {/* machine-readable provenance, kept even if the credit line is off */}
        <title>{`${yLabel} vs ${xLabel} — CLUSTER pulse detection`}</title>
        {credit && <desc>{credit}</desc>}
        <defs>
          <clipPath id={clip}>
            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={axisTop - M.top} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill={P.surface} />

        {/* ---- t-score panel ---- */}
        {showMscore && (
          <g>
            {tTicks.map((t) => (
              <g key={`tt${t}`}>
                <line x1={M.left} x2={W - M.right} y1={yT(t)} y2={yT(t)} stroke={P.grid} strokeWidth="1" />
                <text
                  x={M.left - 8}
                  y={yT(t)}
                  fontSize="11"
                  fontFamily={P.font}
                  fill={P.inkMuted}
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {/* significance thresholds — dashed reads as threshold, not grid */}
            <line
              x1={M.left}
              x2={W - M.right}
              y1={yT(params.tScoreUp)}
              y2={yT(params.tScoreUp)}
              stroke={P.inkMuted}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <line
              x1={M.left}
              x2={W - M.right}
              y1={yT(-params.tScoreDn)}
              y2={yT(-params.tScoreDn)}
              stroke={P.inkMuted}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text
              x={W - M.right - 4}
              y={yT(params.tScoreUp) - 4}
              fontSize="10"
              fontFamily={P.font}
              fill={P.inkSecondary}
              textAnchor="end"
            >
              t = {params.tScoreUp}
            </text>
            <text
              x={W - M.right - 4}
              y={yT(-params.tScoreDn) + 12}
              fontSize="10"
              fontFamily={P.font}
              fill={P.inkSecondary}
              textAnchor="end"
            >
              t = -{params.tScoreDn}
            </text>
            <path {...clipped} d={tPath} fill="none" stroke={P.inkSecondary} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            <text
              x={M.left - 48}
              y={mscoreTop + MSCORE_H / 2}
              fontSize="12"
              fontFamily={P.font}
              fill={P.inkSecondary}
              textAnchor="middle"
              transform={`rotate(-90 ${M.left - 48} ${mscoreTop + MSCORE_H / 2})`}
            >
              t-score
            </text>
            <line x1={M.left} x2={W - M.right} y1={mscoreTop + MSCORE_H} y2={mscoreTop + MSCORE_H} stroke={P.axis} strokeWidth="1" />
          </g>
        )}

        {/* ---- main panel: grid ---- */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={P.grid} strokeWidth="1" />
            <text
              x={M.left - 8}
              y={y(t)}
              fontSize="11"
              fontFamily={P.font}
              fill={P.inkMuted}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatTick(t)}
            </text>
          </g>
        ))}

        {/* pulse-region washes spanning the main panel */}
        <g {...clipped}>
        {runs.map((r, i) => {
          const x0 = x(times[r.start] - dt / 2);
          const x1 = x(Math.min(times[r.end] + dt / 2, x.domain[1]));
          return (
            <rect
              key={`run${i}`}
              x={x0}
              y={mainTop}
              width={Math.max(x1 - x0, 1)}
              height={MAIN_H}
              fill={P.pulse}
              opacity={P.washOpacity}
            />
          );
        })}
        </g>

        {/* error bars */}
        <g {...clipped}>
        {showError &&
          values.map((v, i) =>
            error[i] > 0 ? (
              <g key={`e${i}`} stroke={P.series} strokeWidth="1" opacity={ERROR_BAR_OPACITY}>
                <line x1={x(times[i])} x2={x(times[i])} y1={y(v - error[i])} y2={y(v + error[i])} />
                <line x1={x(times[i]) - 3} x2={x(times[i]) + 3} y1={y(v - error[i])} y2={y(v - error[i])} />
                <line x1={x(times[i]) - 3} x2={x(times[i]) + 3} y1={y(v + error[i])} y2={y(v + error[i])} />
              </g>
            ) : null,
          )}
        </g>

        {/* record boundaries, when several are shown end to end */}
        <g {...clipped}>
        {joins.lines.map((t, i) => (
          <line
            key={`join${i}`}
            x1={x(t)}
            x2={x(t)}
            y1={M.top}
            y2={stripTop + 2 * STRIP_H}
            stroke={P.inkMuted}
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}
        </g>
        <g {...clipped}>
        {joins.labels.map((l, i) => (
          <text
            key={`seg${i}`}
            x={x(l.at)}
            y={mainTop + 12}
            fontSize="10"
            fontFamily={P.font}
            fill={P.inkMuted}
            textAnchor="middle"
          >
            {l.name}
          </text>
        ))}
        </g>

        {/* the series */}
        <path {...clipped} d={linePath} fill="none" stroke={P.series} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <g {...clipped}>
        {showDots &&
          values.map((v, i) => (
            <circle
              key={`d${i}`}
              cx={x(times[i])}
              cy={y(v)}
              r="3"
              fill={P.series}
              stroke={P.surface}
              strokeWidth="2"
            />
          ))}
        </g>

        {/* Peak numbers, in a row along the top rather than riding each apex.
            On the apex they collide with the error bars and sit at whatever
            height the pulse happens to reach; in a row they are a legible index
            strip that scans straight across and keys to the table below. */}
        <g {...clipped}>
        {peaks.map((p, i) => (
          <text
            key={`pk${i}`}
            x={x(times[p.iMax])}
            y={mainTop + 11 + (labelRows === 2 ? (i % 2) * 12 : 0)}
            fontSize="11"
            fontFamily={P.font}
            fill={P.inkMuted}
            textAnchor="middle"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {i + 1}
          </text>
        ))}
        </g>

        {/* main panel baseline + y label */}
        <line x1={M.left} x2={W - M.right} y1={mainTop + MAIN_H} y2={mainTop + MAIN_H} stroke={P.axis} strokeWidth="1" />
        <text
          x={M.left - 48}
          y={mainTop + MAIN_H / 2}
          fontSize="13"
          fontFamily={P.font}
          fill={P.inkPrimary}
          textAnchor="middle"
          transform={`rotate(-90 ${M.left - 48} ${mainTop + MAIN_H / 2})`}
        >
          {yLabel}
        </text>

        {/* ---- flag strips ---- */}
        <g>
          <text
            x={M.left - 8}
            y={stripTop + STRIP_H / 2}
            fontSize="10"
            fontFamily={P.font}
            fill={P.inkSecondary}
            textAnchor="end"
            dominantBaseline="middle"
          >
            UP
          </text>
          <g {...clipped}>
          {ups.map((f, i) =>
            f === 1 ? (
              <path
                key={`u${i}`}
                d={`M${x(times[i])},${stripTop + 3} l5,${STRIP_H - 8} l-10,0 Z`}
                fill={P.flag}
                stroke={P.surface}
                strokeWidth="1"
              />
            ) : null,
          )}
          <text
            x={M.left - 8}
            y={stripTop + STRIP_H + STRIP_H / 2}
            fontSize="10"
            fontFamily={P.font}
            fill={P.inkSecondary}
            textAnchor="end"
            dominantBaseline="middle"
          >
            DOWN
          </text>
          {downs.map((f, i) =>
            f === -1 ? (
              <path
                key={`dn${i}`}
                d={`M${x(times[i])},${stripTop + STRIP_H + STRIP_H - 3} l5,${-(STRIP_H - 8)} l-10,0 Z`}
                fill={P.flag}
                stroke={P.surface}
                strokeWidth="1"
              />
            ) : null,
          )}
          </g>
        </g>

        {/* ---- x axis ---- */}
        <line x1={M.left} x2={W - M.right} y1={axisTop} y2={axisTop} stroke={P.axis} strokeWidth="1" />
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={axisTop} y2={axisTop + 5} stroke={P.axis} strokeWidth="1" />
            <text
              x={x(t)}
              y={axisTop + 18}
              fontSize="11"
              fontFamily={P.font}
              fill={P.inkMuted}
              textAnchor="middle"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatTick(t)}
            </text>
          </g>
        ))}
        <text
          x={(M.left + W - M.right) / 2}
          y={axisTop + 38}
          fontSize="13"
          fontFamily={P.font}
          fill={P.inkPrimary}
          textAnchor="middle"
        >
          {xLabel}
        </text>

        {/* source credit, wrapped over at most two lines */}
        {credit &&
          (credit.match(/.{1,150}(\s|$)/g) ?? []).slice(0, 3).map((line, i) => (
            <text
              key={`cr${i}`}
              x={M.left}
              y={axisTop + AXIS_H + 2 + i * 12}
              fontSize="9"
              fontFamily={P.font}
              fill={P.inkMuted}
            >
              {line.trim()}
            </text>
          ))}

        {/* the sweep in progress (never exported) */}
        {drag && !drag.pan && Math.abs(drag.to - drag.from) >= 8 && (
          <rect
            data-noexport="true"
            x={Math.min(drag.from, drag.to)}
            y={M.top}
            width={Math.abs(drag.to - drag.from)}
            height={axisTop - M.top}
            fill={P.inkMuted}
            opacity="0.16"
          />
        )}

        {/* ---- hover layer (stripped from exports) ---- */}
        {hover !== null && (
          <g data-noexport="true">
            <line
              x1={x(times[hover])}
              x2={x(times[hover])}
              y1={M.top}
              y2={axisTop}
              stroke={P.inkMuted}
              strokeWidth="1"
            />
            <circle
              cx={x(times[hover])}
              cy={y(values[hover])}
              r="5"
              fill={P.series}
              stroke={P.surface}
              strokeWidth="2"
            />
          </g>
        )}
        <rect
          data-noexport="true"
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={axisTop - M.top}
          fill="transparent"
          style={{ cursor: drag?.pan ? "grabbing" : "crosshair" }}
          onPointerMove={onMove}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onDoubleClick={() => onXRangeChange?.(undefined)}
          onPointerLeave={() => {
            setHover(null);
            setDrag(null);
          }}
        />
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipLeftPct}%`,
            top: `${((mainTop + 16) / H) * 100}%`,
            transform: flipTooltip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: P.surface,
            border: `1px solid ${P.grid}`,
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(11,11,11,0.10)",
            padding: "8px 10px",
            pointerEvents: "none",
            fontSize: 12,
            fontFamily: P.font,
            color: P.inkSecondary,
            whiteSpace: "nowrap",
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: P.inkPrimary, fontWeight: 600 }}>
            {fmt(values[hover])}
            {showError && error[hover] > 0 ? ` ± ${fmt(error[hover], 2)}` : ""}
          </div>
          <div>
            {xLabel}: {fmt(times[hover])}
          </div>
          <div>t-score: {fmt(mscoreUp[hover], 2)}</div>
          <div>
            pulse:{" "}
            <span style={{ color: pulse[hover] === 1 ? P.pulse : P.inkMuted, fontWeight: 600 }}>
              {pulse[hover] === 1 ? "yes" : "no"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
