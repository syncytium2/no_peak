import { useEffect, useMemo, useRef, useState } from "react";
import { clusterMain } from "./core/cluster";
import { resolveErrorModel } from "./core/errorModel";
import { parseSeries, resultToCSV, type ParsedSeries } from "./core/csv";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType, type MeanSD } from "./core/types";
import { ClusterChart } from "./chart/ClusterChart";
import { downloadPNG, downloadSVG, downloadText } from "./chart/export";
import { demoSeries } from "./demo";

const ERROR_MODELS: ErrorModelType[] = [
  "Local SD",
  "Local SE",
  "Global SD",
  "Global SE",
  "SQRT",
  "Fixed",
  "Error Wave",
];

interface Loaded {
  name: string;
  series: ParsedSeries;
}

const fmt = (v: number | null | undefined, d = 3) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? "—"
    : Number(v.toPrecision(d + 2)).toLocaleString("en-US", { maximumFractionDigits: d });

const fmtMS = (m: MeanSD | null) => (m ? `${fmt(m.mean)} ± ${fmt(m.sd)}` : "—");

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [deltaT, setDeltaT] = useState(10);
  const [params, setParams] = useState<ClusterParams>({ ...DEFAULT_PARAMS });
  const [xLabel, setXLabel] = useState("Time (min)");
  const [yLabel, setYLabel] = useState("Concentration");
  const [showError, setShowError] = useState(true);
  const [showMscore, setShowMscore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const computed = useMemo(() => {
    if (!loaded) return null;
    const { series } = loaded;
    const times = series.times ?? series.values.map((_, i) => (i + 1) * deltaT);
    try {
      // belt-and-suspenders: never run "Error Wave" against a file without one
      const effective =
        params.errorModel === "Error Wave" && !series.error
          ? { ...params, errorModel: "Local SD" as const }
          : params;
      return {
        result: clusterMain(times, series.values, effective, series.error ?? undefined),
        error: null as string | null,
      };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [loaded, deltaT, params]);

  const result = computed?.result ?? null;

  async function onFile(file: File) {
    setLoadError(null);
    try {
      const text = await file.text();
      const series = parseSeries(text);
      setLoaded({ name: file.name.replace(/\.[^.]+$/, ""), series });
      setParams((p) => {
        const next = resolveErrorModel(p.errorModel, series.error !== null);
        return next === p.errorModel ? p : { ...p, errorModel: next };
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  function loadDemo() {
    setLoadError(null);
    const { times, values } = demoSeries();
    setLoaded({ name: "demo", series: { times, values, error: null, labels: null } });
    setParams((p) => {
      const next = resolveErrorModel(p.errorModel, false);
      return next === p.errorModel ? p : { ...p, errorModel: next };
    });
  }

  // ?demo auto-loads the demo dataset (shareable example link)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("demo")) loadDemo();
  }, []);

  const num = (key: keyof ClusterParams) => ({
    value: String(params[key] as number),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setParams((p) => ({ ...p, [key]: Number(e.target.value) })),
  });

  return (
    <div className="page">
      <header>
        <h1>
          no_peak<span className="tagline"> — CLUSTER pulse detection</span>
        </h1>
        <p className="privacy">
          Runs entirely in your browser. Uploaded data is processed on your machine and never sent
          anywhere.
        </p>
      </header>

      <section className="loadrow">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,.dat"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button className="primary" onClick={() => fileRef.current?.click()}>
          Load data file
        </button>
        <button onClick={loadDemo}>Demo dataset</button>
        <span className="hint">
          CSV/TSV: <code>value</code> · <code>time,value</code> · <code>time,value,error</code>
          {" "}(header row optional)
        </span>
        {loaded && (
          <span className="loadedname">
            {loaded.name} — {loaded.series.values.length} points
          </span>
        )}
      </section>

      {loadError && <p className="error">{loadError}</p>}

      <div className="cols">
        <aside className="panel">
          <h2>Detection parameters</h2>
          <div className="grid">
            <label>
              Peak window (points)
              <input type="number" min={1} step={1} {...num("nPeak")} />
            </label>
            <label>
              Nadir window (points)
              <input type="number" min={1} step={1} {...num("nNadir")} />
            </label>
            <label>
              t-score, increase
              <input type="number" step={0.1} {...num("tScoreUp")} />
            </label>
            <label>
              t-score, decrease
              <input type="number" step={0.1} {...num("tScoreDn")} />
            </label>
            <label>
              Min value for a pulse
              <input type="number" step={0.1} {...num("minPeak")} />
            </label>
            <label>
              Error model
              <select
                value={params.errorModel}
                onChange={(e) =>
                  setParams((p) => ({ ...p, errorModel: e.target.value as ErrorModelType }))
                }
              >
                {ERROR_MODELS.map((m) => (
                  <option key={m} value={m} disabled={m === "Error Wave" && !loaded?.series.error}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {(params.errorModel === "Fixed" || params.errorModel === "SQRT") && (
              <label>
                {params.errorModel === "Fixed" ? "Fixed error value" : "SQRT fallback (value ≤ 0)"}
                <input type="number" step={0.1} {...num("errorValue")} />
              </label>
            )}
            {!loaded?.series.times && (
              <label>
                Sampling interval
                <input
                  type="number"
                  min={0.001}
                  step={1}
                  value={String(deltaT)}
                  onChange={(e) => setDeltaT(Number(e.target.value))}
                />
              </label>
            )}
          </div>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={params.zeroTerminate}
                onChange={(e) => setParams((p) => ({ ...p, zeroTerminate: e.target.checked }))}
              />
              Terminate pulses at zero-activity bins
            </label>
            {params.zeroTerminate && (
              <label className="inline">
                zero level
                <input type="number" step={0.1} {...num("zero")} />
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={params.fortranVariance}
                onChange={(e) => setParams((p) => ({ ...p, fortranVariance: e.target.checked }))}
              />
              Fortran pooled-variance form (squares the error term)
            </label>
          </div>

          <h2>Figure</h2>
          <div className="grid">
            <label>
              X-axis label
              <input value={xLabel} onChange={(e) => setXLabel(e.target.value)} />
            </label>
            <label>
              Y-axis label
              <input value={yLabel} onChange={(e) => setYLabel(e.target.value)} />
            </label>
          </div>
          <div className="checks">
            <label>
              <input
                type="checkbox"
                checked={showError}
                onChange={(e) => setShowError(e.target.checked)}
              />
              Error bars
            </label>
            <label>
              <input
                type="checkbox"
                checked={showMscore}
                onChange={(e) => setShowMscore(e.target.checked)}
              />
              t-score panel
            </label>
          </div>

          {result && (
            <>
              <h2>Export</h2>
              <div className="exports">
                <button
                  onClick={() => svgRef.current && downloadSVG(svgRef.current, `${loaded!.name}_cluster.svg`)}
                >
                  SVG (vector)
                </button>
                <button
                  onClick={() =>
                    svgRef.current && void downloadPNG(svgRef.current, `${loaded!.name}_cluster.png`, 4)
                  }
                >
                  PNG (4×)
                </button>
                <button onClick={() => downloadText(resultToCSV(result), `${loaded!.name}_cluster.csv`)}>
                  Results CSV
                </button>
                <button
                  onClick={async () => {
                    if (!svgRef.current) return;
                    // jsPDF + svg2pdf are heavy; loaded on first use only
                    const { generatePDFReport } = await import("./report/pdf");
                    await generatePDFReport(svgRef.current, result, {
                      datasetName: loaded!.name,
                      xLabel,
                      yLabel,
                    });
                  }}
                >
                  PDF report
                </button>
              </div>
            </>
          )}
        </aside>

        <main className="content">
          {!loaded && (
            <div className="empty">
              <p>Load a data file — or try the demo dataset — to run CLUSTER.</p>
            </div>
          )}
          {computed?.error && <p className="error">{computed.error}</p>}
          {result && (
            <>
              <div className="legend" aria-hidden="false">
                <span className="key">
                  <span className="swatch-line" /> {yLabel}
                </span>
                <span className="key">
                  <span className="swatch-wash" /> detected pulse
                </span>
                <span className="key">
                  <span className="swatch-tri" /> up / down flags
                </span>
              </div>
              <ClusterChart
                result={result}
                showError={showError}
                showMscore={showMscore}
                xLabel={xLabel}
                yLabel={yLabel}
                svgRef={svgRef}
              />

              <div className="statrow">
                <div className="stat">
                  <div className="statlabel">Peaks</div>
                  <div className="statvalue">{result.summary.nPeaks}</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Valleys</div>
                  <div className="statvalue">{result.summary.nValleys}</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Mean value</div>
                  <div className="statvalue">{fmt(result.summary.meanValue)}</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Interpeak interval</div>
                  <div className="statvalue">{fmtMS(result.summary.interPeakInterval)}</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Peak height</div>
                  <div className="statvalue">{fmtMS(result.summary.peakHeight)}</div>
                </div>
              </div>

              {result.peaks.length > 0 && (
                <>
                  <h2>Peaks</h2>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>position</th>
                          <th>range</th>
                          <th>width</th>
                          <th>height</th>
                          <th>largest %</th>
                          <th>mean %</th>
                          <th>area</th>
                          <th>increase</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.peaks.map((p, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{fmt(result.times[p.iMax])}</td>
                            <td>
                              {fmt(result.times[p.iFirst])}–{fmt(result.times[p.iLast])}
                            </td>
                            <td>{fmt(p.width)}</td>
                            <td>{fmt(p.height)}</td>
                            <td>{fmt(p.largestPct, 1)}</td>
                            <td>{fmt(p.meanPct, 1)}</td>
                            <td>{fmt(p.area)}</td>
                            <td>{fmt(p.increase)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {result.valleys.length > 0 && (
                <>
                  <h2>Valleys</h2>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>position</th>
                          <th>range</th>
                          <th>width</th>
                          <th>nadir</th>
                          <th>mean</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.valleys.map((v, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{fmt(result.times[v.iMin])}</td>
                            <td>
                              {fmt(result.times[v.iFirst])}–{fmt(result.times[v.iLast])}
                            </td>
                            <td>{fmt(v.width)}</td>
                            <td>{fmt(v.nadir)}</td>
                            <td>{fmt(v.mean)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <details>
                <summary>Data table ({result.values.length} points)</summary>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>time</th>
                        <th>value</th>
                        <th>error</th>
                        <th>t-score</th>
                        <th>up</th>
                        <th>down</th>
                        <th>pulse</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.values.map((v, i) => (
                        <tr key={i}>
                          <td>{fmt(result.times[i])}</td>
                          <td>{fmt(v)}</td>
                          <td>{fmt(result.error[i])}</td>
                          <td>{fmt(result.mscoreUp[i], 2)}</td>
                          <td>{result.ups[i] === 1 ? "▲" : ""}</td>
                          <td>{result.downs[i] === -1 ? "▼" : ""}</td>
                          <td>{result.pulse[i] === 1 ? "●" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </main>
      </div>

      <footer>
        <p>
          CLUSTER algorithm: Veldhuis &amp; Johnson; original Fortran by Michael L. Johnson.
          TypeScript port validated against the Igor Pro implementation (ClusterMasterV4-1).
        </p>
      </footer>
    </div>
  );
}
