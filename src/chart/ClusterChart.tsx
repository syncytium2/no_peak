// Publication figure: concentration series with CLUSTER pulse overlay.
// Layout mirrors the Igor Cluster panel — t-score panel on top, main series
// panel, then UP/DOWN flag strips sharing the x axis. All styling is baked as
// SVG attributes so the exported figure is self-contained.

import { useMemo, useRef, useState } from "react";
import type { ClusterResult } from "../core/types";
import { fmt } from "../core/format";
import { FIG, PULSE_WASH_OPACITY, ERROR_BAR_OPACITY } from "./palette";
import { linearScale, niceTicks, padDomain, formatTick } from "./scale";

export interface ClusterChartProps {
  result: ClusterResult;
  showError: boolean;
  showMscore: boolean;
  xLabel: string;
  yLabel: string;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
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
}: ClusterChartProps) {
  const { times, values, error, ups, downs, mscoreUp, pulse, peaks, params } = result;
  const n = values.length;
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const mscoreTop = M.top;
  const mainTop = showMscore ? mscoreTop + MSCORE_H + GAP : M.top;
  const stripTop = mainTop + MAIN_H + GAP;
  const axisTop = stripTop + 2 * STRIP_H + 6;
  const H = axisTop + AXIS_H;

  const layout = useMemo(() => {
    const dt = times.length > 1 ? times[1] - times[0] : 1;
    const x = linearScale([times[0] - dt / 2, times[n - 1] + dt / 2], [M.left, W - M.right]);

    let yLo = Infinity;
    let yHi = -Infinity;
    for (let i = 0; i < n; i++) {
      const e = showError ? error[i] : 0;
      yLo = Math.min(yLo, values[i] - e);
      yHi = Math.max(yHi, values[i] + e);
    }
    const yDom = padDomain([Math.min(yLo, 0), yHi]);
    const y = linearScale(yDom, [mainTop + MAIN_H, mainTop]);

    let tHi = 1;
    for (let i = 0; i < n; i++) tHi = Math.max(tHi, Math.abs(mscoreUp[i]));
    const tDom = padDomain([-tHi, tHi], 0.08, 0.08);
    const yT = linearScale(tDom, [mscoreTop + MSCORE_H, mscoreTop]);

    return { x, y, yT, dt };
  }, [times, values, error, mscoreUp, n, showError, mainTop, mscoreTop]);

  const { x, y, yT, dt } = layout;
  const xTicks = niceTicks(times[0], times[n - 1], 8);
  const yTicks = niceTicks(y.domain[0], y.domain[1], 6);
  const tTicks = niceTicks(yT.domain[0], yT.domain[1], 3);
  const runs = pulseRuns(pulse);
  const showDots = n <= 150;

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

  function onMove(ev: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    // nearest sample by x
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
        <rect x="0" y="0" width={W} height={H} fill={FIG.surface} />

        {/* ---- t-score panel ---- */}
        {showMscore && (
          <g>
            {tTicks.map((t) => (
              <g key={`tt${t}`}>
                <line x1={M.left} x2={W - M.right} y1={yT(t)} y2={yT(t)} stroke={FIG.grid} strokeWidth="1" />
                <text
                  x={M.left - 8}
                  y={yT(t)}
                  fontSize="11"
                  fontFamily={FIG.font}
                  fill={FIG.inkMuted}
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
              stroke={FIG.inkMuted}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <line
              x1={M.left}
              x2={W - M.right}
              y1={yT(-params.tScoreDn)}
              y2={yT(-params.tScoreDn)}
              stroke={FIG.inkMuted}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text
              x={W - M.right - 4}
              y={yT(params.tScoreUp) - 4}
              fontSize="10"
              fontFamily={FIG.font}
              fill={FIG.inkSecondary}
              textAnchor="end"
            >
              t = {params.tScoreUp}
            </text>
            <text
              x={W - M.right - 4}
              y={yT(-params.tScoreDn) + 12}
              fontSize="10"
              fontFamily={FIG.font}
              fill={FIG.inkSecondary}
              textAnchor="end"
            >
              t = -{params.tScoreDn}
            </text>
            <path d={tPath} fill="none" stroke={FIG.inkSecondary} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            <text
              x={M.left - 48}
              y={mscoreTop + MSCORE_H / 2}
              fontSize="12"
              fontFamily={FIG.font}
              fill={FIG.inkSecondary}
              textAnchor="middle"
              transform={`rotate(-90 ${M.left - 48} ${mscoreTop + MSCORE_H / 2})`}
            >
              t-score
            </text>
            <line x1={M.left} x2={W - M.right} y1={mscoreTop + MSCORE_H} y2={mscoreTop + MSCORE_H} stroke={FIG.axis} strokeWidth="1" />
          </g>
        )}

        {/* ---- main panel: grid ---- */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={FIG.grid} strokeWidth="1" />
            <text
              x={M.left - 8}
              y={y(t)}
              fontSize="11"
              fontFamily={FIG.font}
              fill={FIG.inkMuted}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatTick(t)}
            </text>
          </g>
        ))}

        {/* pulse-region washes spanning the main panel */}
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
              fill={FIG.pulse}
              opacity={PULSE_WASH_OPACITY}
            />
          );
        })}

        {/* error bars */}
        {showError &&
          values.map((v, i) =>
            error[i] > 0 ? (
              <g key={`e${i}`} stroke={FIG.series} strokeWidth="1" opacity={ERROR_BAR_OPACITY}>
                <line x1={x(times[i])} x2={x(times[i])} y1={y(v - error[i])} y2={y(v + error[i])} />
                <line x1={x(times[i]) - 3} x2={x(times[i]) + 3} y1={y(v - error[i])} y2={y(v - error[i])} />
                <line x1={x(times[i]) - 3} x2={x(times[i]) + 3} y1={y(v + error[i])} y2={y(v + error[i])} />
              </g>
            ) : null,
          )}

        {/* the series */}
        <path d={linePath} fill="none" stroke={FIG.series} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {showDots &&
          values.map((v, i) => (
            <circle
              key={`d${i}`}
              cx={x(times[i])}
              cy={y(v)}
              r="3"
              fill={FIG.series}
              stroke={FIG.surface}
              strokeWidth="2"
            />
          ))}

        {/* selective peak labels at each apex */}
        {peaks.map((p, i) => (
          <text
            key={`pk${i}`}
            x={x(times[p.iMax])}
            y={y(values[p.iMax]) - (showDots ? 10 : 7)}
            fontSize="11"
            fontFamily={FIG.font}
            fill={FIG.inkPrimary}
            textAnchor="middle"
          >
            {i + 1}
          </text>
        ))}

        {/* main panel baseline + y label */}
        <line x1={M.left} x2={W - M.right} y1={mainTop + MAIN_H} y2={mainTop + MAIN_H} stroke={FIG.axis} strokeWidth="1" />
        <text
          x={M.left - 48}
          y={mainTop + MAIN_H / 2}
          fontSize="13"
          fontFamily={FIG.font}
          fill={FIG.inkPrimary}
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
            fontFamily={FIG.font}
            fill={FIG.inkSecondary}
            textAnchor="end"
            dominantBaseline="middle"
          >
            UP
          </text>
          {ups.map((f, i) =>
            f === 1 ? (
              <path
                key={`u${i}`}
                d={`M${x(times[i])},${stripTop + 3} l5,${STRIP_H - 8} l-10,0 Z`}
                fill={FIG.flag}
                stroke={FIG.surface}
                strokeWidth="1"
              />
            ) : null,
          )}
          <text
            x={M.left - 8}
            y={stripTop + STRIP_H + STRIP_H / 2}
            fontSize="10"
            fontFamily={FIG.font}
            fill={FIG.inkSecondary}
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
                fill={FIG.flag}
                stroke={FIG.surface}
                strokeWidth="1"
              />
            ) : null,
          )}
        </g>

        {/* ---- x axis ---- */}
        <line x1={M.left} x2={W - M.right} y1={axisTop} y2={axisTop} stroke={FIG.axis} strokeWidth="1" />
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={axisTop} y2={axisTop + 5} stroke={FIG.axis} strokeWidth="1" />
            <text
              x={x(t)}
              y={axisTop + 18}
              fontSize="11"
              fontFamily={FIG.font}
              fill={FIG.inkMuted}
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
          fontFamily={FIG.font}
          fill={FIG.inkPrimary}
          textAnchor="middle"
        >
          {xLabel}
        </text>

        {/* ---- hover layer (stripped from exports) ---- */}
        {hover !== null && (
          <g data-noexport="true">
            <line
              x1={x(times[hover])}
              x2={x(times[hover])}
              y1={M.top}
              y2={axisTop}
              stroke={FIG.inkMuted}
              strokeWidth="1"
            />
            <circle
              cx={x(times[hover])}
              cy={y(values[hover])}
              r="5"
              fill={FIG.series}
              stroke={FIG.surface}
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
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: `${tooltipLeftPct}%`,
            top: `${((mainTop + 16) / H) * 100}%`,
            transform: flipTooltip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            background: "#ffffff",
            border: `1px solid ${FIG.grid}`,
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(11,11,11,0.10)",
            padding: "8px 10px",
            pointerEvents: "none",
            fontSize: 12,
            fontFamily: FIG.font,
            color: FIG.inkSecondary,
            whiteSpace: "nowrap",
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: FIG.inkPrimary, fontWeight: 600 }}>
            {fmt(values[hover])}
            {showError && error[hover] > 0 ? ` ± ${fmt(error[hover], 2)}` : ""}
          </div>
          <div>
            {xLabel}: {fmt(times[hover])}
          </div>
          <div>t-score: {fmt(mscoreUp[hover], 2)}</div>
          <div>
            pulse:{" "}
            <span style={{ color: pulse[hover] === 1 ? FIG.pulse : FIG.inkMuted, fontWeight: 600 }}>
              {pulse[hover] === 1 ? "yes" : "no"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
