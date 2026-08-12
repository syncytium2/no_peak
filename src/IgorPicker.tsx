import { useMemo, useState } from "react";
import type { IgorFile, IgorWave } from "./core/igor";
import { suggestPartners, timeUnitFromIgor } from "./core/igor";
import type { Segment } from "./core/segments";
import type { TimeUnit } from "./core/timeUnits";
import { fmt } from "./core/format";

/**
 * Wave picker for an imported Igor file.
 *
 * An experiment file holds everything the lab ever put in it, so the job here
 * is narrowing: which wave is the data, which is its error, which is its time
 * base. The Igor Cluster package names its columns predictably —
 * `set1C1(RD)` / `C2(STDEV)` / `C3(Times)` — so those pairings are proposed and
 * shown rather than applied silently.
 *
 * Ticking several data waves concatenates them into one analysis: the same
 * detection settings across every record, results reported per record.
 */
export interface IgorPickerProps {
  file: IgorFile;
  fileName: string;
  onCancel: () => void;
  onLoad: (
    segments: Segment[],
    meta: { deltaT: number | null; timeUnit: TimeUnit | null; dataUnits: string },
  ) => void;
}

/** Waves that are somebody else's error bars or time base, by name. */
const looksLikeError = (w: IgorWave) => /(sem|sd|stdev|std|error|err)\b|\(STDEV\)/i.test(w.name);
const looksLikeTimes = (w: IgorWave) => /^(time|times|t)$|\(Times\)/i.test(w.name);

/** Min and max in one pass. `Math.min(...values)` overflows on a long wave. */
function extent(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

export function IgorPicker({ file, fileName, onCancel, onLoad }: IgorPickerProps) {
  const { waves, skipped } = file;
  const [picked, setPicked] = useState<string[]>(() => {
    // Open on the most plausible data wave: longest, not an error or time base.
    const candidates = waves.filter((w) => !looksLikeError(w) && !looksLikeTimes(w));
    const best = (candidates.length ? candidates : waves).reduce(
      (a, b) => (b.values.length > a.values.length ? b : a),
      candidates[0] ?? waves[0],
    );
    return best ? [best.path] : [];
  });
  const [errorOverride, setErrorOverride] = useState<string>("");
  const [timesOverride, setTimesOverride] = useState<string>("");

  const byPath = useMemo(() => new Map(waves.map((w) => [w.path, w])), [waves]);
  const chosen = picked.map((p) => byPath.get(p)).filter((w): w is IgorWave => !!w);
  const single = chosen.length === 1 ? chosen[0] : null;

  /** Resolve the error and time waves for one data wave. */
  function partnersFor(w: IgorWave): { error?: IgorWave; times?: IgorWave } {
    const auto = suggestPartners(w, waves);
    if (!single) return auto;
    return {
      error: errorOverride === "none" ? undefined : (byPath.get(errorOverride) ?? auto.error),
      times: timesOverride === "none" ? undefined : (byPath.get(timesOverride) ?? auto.times),
    };
  }

  function toggle(path: string) {
    setPicked((p) => (p.includes(path) ? p.filter((x) => x !== path) : [...p, path]));
    setErrorOverride("");
    setTimesOverride("");
  }

  function load() {
    const segments: Segment[] = chosen.map((w) => {
      const { error, times } = partnersFor(w);
      return {
        name: w.name,
        values: w.values,
        // A wave's own x scaling is a real time base whenever Igor was told
        // one; dx of exactly 1 with no units is Igor's default, i.e. unset.
        times: times
          ? times.values
          : w.dx !== 1 || w.x0 !== 0
            ? w.values.map((_, i) => w.x0 + i * w.dx)
            : null,
        error: error ? error.values : null,
      };
    });

    const first = chosen[0];
    const firstTimes = first ? partnersFor(first).times : undefined;
    onLoad(segments, {
      // A times wave states the interval; otherwise fall back to wave scaling.
      deltaT: firstTimes
        ? firstTimes.values[1] - firstTimes.values[0]
        : first && first.dx !== 1
          ? first.dx
          : null,
      timeUnit: first ? timeUnitFromIgor(first.xUnits) : null,
      dataUnits: first?.dataUnits ?? "",
    });
  }

  const lengthMismatch = chosen.some((w) => {
    const { error, times } = partnersFor(w);
    return (
      (error && error.values.length !== w.values.length) ||
      (times && times.values.length !== w.values.length)
    );
  });

  return (
    <section className="igorpick">
      <h2>
        Waves in <code>{fileName}</code>
      </h2>
      <p className="hint">
        {waves.length} numeric wave{waves.length === 1 ? "" : "s"} found. Tick the one you want to
        analyze — or tick several to run every record under one set of detection settings, which is
        the point of concatenating a study.
      </p>

      <div className="tablewrap wavelist">
        <table>
          <thead>
            <tr>
              <th />
              <th>wave</th>
              <th>points</th>
              <th>x scaling</th>
              <th>range</th>
              <th>paired error</th>
            </tr>
          </thead>
          <tbody>
            {waves.map((w) => {
              const on = picked.includes(w.path);
              const partner = on ? partnersFor(w) : suggestPartners(w, waves);
              const [lo, hi] = extent(w.values);
              return (
                <tr key={w.path} className={on ? "picked" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(w.path)}
                      aria-label={`Analyze ${w.path}`}
                    />
                  </td>
                  <td>
                    <code>{w.path}</code>
                    {looksLikeError(w) && <span className="tag">error</span>}
                    {looksLikeTimes(w) && <span className="tag">times</span>}
                  </td>
                  <td>{w.values.length}</td>
                  <td>
                    {w.dx !== 1 || w.x0 !== 0 ? (
                      <>
                        {fmt(w.dx)} {w.xUnits || "per point"}
                      </>
                    ) : (
                      <span className="muted">none</span>
                    )}
                  </td>
                  <td>
                    {fmt(lo)}–{fmt(hi)} {w.dataUnits}
                  </td>
                  <td>
                    {partner.error ? (
                      <code>{partner.error.name}</code>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {single && (
        <div className="grid pairing">
          <label>
            Error wave
            <select value={errorOverride} onChange={(e) => setErrorOverride(e.target.value)}>
              <option value="">
                auto — {suggestPartners(single, waves).error?.name ?? "none found"}
              </option>
              <option value="none">none (estimate from the data)</option>
              {waves
                .filter((w) => w.path !== single.path && w.values.length === single.values.length)
                .map((w) => (
                  <option key={w.path} value={w.path}>
                    {w.path}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Time wave
            <select value={timesOverride} onChange={(e) => setTimesOverride(e.target.value)}>
              <option value="">
                auto — {suggestPartners(single, waves).times?.name ?? "use the sampling interval"}
              </option>
              <option value="none">none (use the sampling interval)</option>
              {waves
                .filter((w) => w.path !== single.path && w.values.length === single.values.length)
                .map((w) => (
                  <option key={w.path} value={w.path}>
                    {w.path}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {skipped.length > 0 && (
        <details className="skipped">
          <summary>
            {skipped.length} wave{skipped.length === 1 ? "" : "s"} not shown
          </summary>
          <ul>
            {skipped.map((s) => (
              <li key={s.path}>
                <code>{s.path}</code> — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="pastefoot">
        <button className="primary" onClick={load} disabled={chosen.length === 0}>
          {chosen.length > 1 ? `Analyze ${chosen.length} records together` : "Analyze this wave"}
        </button>
        <button onClick={onCancel}>Cancel</button>
        {lengthMismatch && (
          <span className="error">
            A paired wave differs in length from its data wave and will be ignored.
          </span>
        )}
      </div>
    </section>
  );
}
