import { useEffect, useMemo, useRef, useState } from "react";
import { clusterMain } from "./core/cluster";
import { resolveErrorModel } from "./core/errorModel";
import { parseLooseNumbers, parseSeries, resultToCSV, type ParsedSeries } from "./core/csv";
import { fmt } from "./core/format";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType, type MeanSD } from "./core/types";
import { ClusterChart } from "./chart/ClusterChart";
import { FIG, FIG_DOS } from "./chart/palette";
import { BORN, BUILT, VERSION, longDate } from "./version";
import { downloadPNG, downloadSVG, downloadText } from "./chart/export";
import { SAMPLES, SAMPLE_GROUPS, sampleCounts } from "./samples";
import { TEMPLATE_CSV, TEMPLATE_NAME } from "./template";

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
  // set when a user-loaded file brings its own errors and we should ask first
  const [errorOffer, setErrorOffer] = useState<{ from: string; n: number } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  // settings fold: open on desktop, collapsed on phones so the figure leads
  const [settingsOpen, setSettingsOpen] = useState(
    () => window.matchMedia("(min-width: 881px)").matches,
  );
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

  /** Filenames that look like the error half of a pair: gnrh_sd, set1 SEM, … */
  const looksLikeError = (name: string) =>
    /(^|[^a-z])(err|error|errors|sd|stdev|std|sem|se)([^a-z]|$)/i.test(
      name.replace(/\.[^.]+$/, ""),
    );

  async function onFiles(files: File[]) {
    setLoadError(null);
    try {
      const parsed = await Promise.all(
        files.map(async (f) => ({
          name: f.name.replace(/\.[^.]+$/, ""),
          series: parseSeries(await f.text()),
        })),
      );

      if (parsed.length === 1) {
        loadSeries(parsed[0].name, parsed[0].series, true);
        return;
      }
      if (parsed.length !== 2) {
        throw new Error(`Select one data file, or two (data + errors) — got ${parsed.length}.`);
      }

      // Pair them: prefer the filename hint, else assume the second is errors.
      const errIdx = parsed.findIndex((p) => looksLikeError(p.name));
      const ei = errIdx === -1 ? 1 : errIdx;
      const di = ei === 0 ? 1 : 0;
      const data = parsed[di];
      const errs = parsed[ei];

      if (errs.series.values.length !== data.series.values.length) {
        throw new Error(
          `"${errs.name}" has ${errs.series.values.length} values but "${data.name}" has ` +
            `${data.series.values.length}. A paired error file must be the same length.`,
        );
      }
      loadSeries(data.name, { ...data.series, error: errs.series.values }, true, errs.name);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  /**
   * `ask` is set for user-supplied files: rather than silently switching the
   * error model, offer the choice. Bundled samples are curated, so they just
   * apply the right model.
   */
  function loadSeries(name: string, series: ParsedSeries, ask = false, errorFrom?: string) {
    setLoadError(null);
    setLoaded({ name, series });
    if (ask && series.error) {
      setErrorOffer({ from: errorFrom ?? `a column in ${name}`, n: series.error.length });
      return; // leave the model alone until the user decides
    }
    setErrorOffer(null);
    setParams((p) => {
      const next = resolveErrorModel(p.errorModel, series.error !== null);
      return next === p.errorModel ? p : { ...p, errorModel: next };
    });
  }

  /**
   * Columns first; if that fails, fall back to reading the text as a plain
   * list of numbers so hand-typed input works.
   */
  function parsePasted(text: string): ParsedSeries {
    try {
      return parseSeries(text);
    } catch (e) {
      const loose = parseLooseNumbers(text);
      if (!loose) throw e; // not numeric: the column parser's message is better
      return { times: null, values: loose, error: null, labels: null };
    }
  }

  /** Live feedback while typing/pasting, so problems surface before loading. */
  const pastePreview = useMemo(() => {
    if (!pasteText.trim()) return null;
    try {
      const s = parseSeries(pasteText);
      const cols = s.error ? 3 : s.times ? 2 : 1;
      return {
        ok: true as const,
        text:
          `${s.values.length} points, ${cols} column${cols > 1 ? "s" : ""}` +
          (s.error ? " (time, value, error)" : s.times ? " (time, value)" : " (value only)"),
      };
    } catch (e) {
      const loose = parseLooseNumbers(pasteText);
      if (loose) {
        return { ok: true as const, text: `${loose.length} numbers, read as values in order` };
      }
      return { ok: false as const, text: e instanceof Error ? e.message : String(e) };
    }
  }, [pasteText]);

  function loadPasted() {
    try {
      loadSeries("typed", parsePasted(pasteText), true);
      setPasteOpen(false);
      setPasteText("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  function loadSample(key: string) {
    const sample = SAMPLES.find((s) => s.key === key);
    if (!sample) return;
    try {
      loadSeries(sample.key, sample.load());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  // ?demo auto-loads the synthetic demo; otherwise the bundled GnRH dataset
  // loads by default so the page never opens blank.
  useEffect(() => {
    loadSample(new URLSearchParams(window.location.search).has("demo") ? "demo" : "sim_gnrh");
  }, []);

  // Original Fortran mode gets the MS-DOS terminal chrome it ran under
  const dos = params.variant === "fortran";
  useEffect(() => {
    document.body.classList.toggle("dos", dos);
    return () => document.body.classList.remove("dos");
  }, [dos]);

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
          anywhere. <a href="#about">About &amp; references</a>
        </p>
      </header>

      <section className="loadrow">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".csv,.txt,.tsv,.dat"
          style={{ display: "none" }}
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            if (fs.length) void onFiles(fs);
            e.target.value = "";
          }}
        />
        <label className="implpick">
          Implementation
          <select
            value={params.variant}
            onChange={(e) =>
              setParams((p) => ({ ...p, variant: e.target.value as "igor" | "fortran" }))
            }
          >
            <option value="igor">Igor port (validated)</option>
            <option value="fortran">Original Fortran (CLUST5)</option>
          </select>
        </label>
        <button className="primary" onClick={() => fileRef.current?.click()}>
          Load data file
        </button>
        <button onClick={() => setPasteOpen((v) => !v)} aria-expanded={pasteOpen}>
          {pasteOpen ? "Close" : "Paste or type data"}
        </button>
        <label className="samplepick">
          Sample data
          <select
            value={SAMPLES.some((s) => s.key === loaded?.name) ? loaded!.name : ""}
            onChange={(e) => loadSample(e.target.value)}
          >
            {/* placeholder shown only while a user-supplied file is loaded */}
            <option value="" disabled>
              choose a dataset…
            </option>
            {SAMPLE_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {SAMPLES.filter((s) => s.group === g).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                    {sampleCounts[s.key] ? ` — ${sampleCounts[s.key]} pts` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <span className="hint">
          CSV/TSV: <code>value</code> · <code>time,value</code> · <code>time,value,error</code>
          {" "}(header row optional).{" "}
          <button
            className="linkish"
            onClick={() => downloadText(TEMPLATE_CSV, TEMPLATE_NAME)}
            title="Download a small example file with the expected columns"
          >
            Download a sample CSV
          </button>{" "}
          · <a href="#about">how to prepare a file</a>
        </span>
        {loaded && (
          <span className="loadedname">
            {loaded.name} — {loaded.series.values.length} points
            {SAMPLES.some((s) => s.key === loaded.name) && (
              <span className="simtag" title="Generated data, not a real experiment">
                simulated
              </span>
            )}
          </span>
        )}
      </section>

      {pasteOpen && (
        <section className="pastebox">
          <label>
            Paste columns copied from Excel, Igor, or a text file — tabs, commas, semicolons, and
            spaces all work, and a header row is fine. Or just type numbers and see what the
            detector makes of them: any list of numbers, on one line or many, is read as values in
            order.
            <textarea
              autoFocus
              rows={8}
              spellCheck={false}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={
                "1 1 1 8 12 6 2 1 1 1 9 14 7 2 1 1\n\n…or paste columns:\n" +
                "time\tvalue\terror\n10\t0.42\t0.03\n20\t0.38\t0.03"
              }
            />
          </label>
          <div className="pastefoot">
            <button className="primary" onClick={loadPasted} disabled={!pastePreview?.ok}>
              Load pasted data
            </button>
            <button
              onClick={() => {
                setPasteOpen(false);
                setPasteText("");
              }}
            >
              Cancel
            </button>
            {pastePreview && (
              <span className={pastePreview.ok ? "hint" : "error"}>{pastePreview.text}</span>
            )}
          </div>
        </section>
      )}

      {loadError && <p className="error">{loadError}</p>}

      {errorOffer && (
        <div className="offer">
          <span>
            Found {errorOffer.n} per-sample error values in <strong>{errorOffer.from}</strong>. Use
            them as the measurement error (the &quot;Error Wave&quot; model)? Detection is scaled by
            this error, so it changes which pulses are found.
          </span>
          <span className="offerbtns">
            <button
              className="primary"
              onClick={() => {
                setParams((p) => ({ ...p, errorModel: "Error Wave" }));
                setErrorOffer(null);
              }}
            >
              Use these errors
            </button>
            <button
              onClick={() => {
                setParams((p) => ({
                  ...p,
                  errorModel: p.errorModel === "Error Wave" ? "Local SD" : p.errorModel,
                }));
                setErrorOffer(null);
              }}
            >
              Ignore, estimate from the data
            </button>
          </span>
        </div>
      )}

      <div className="cols">
        <details
          className="panel"
          open={settingsOpen}
          onToggle={(e) => setSettingsOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Settings</summary>
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
                checked={params.includeTruncated}
                onChange={(e) => setParams((p) => ({ ...p, includeTruncated: e.target.checked }))}
              />
              Count a final pulse cut off by the end of the record
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
        </details>

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
                palette={dos ? FIG_DOS : FIG}
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
          TypeScript port validated against the Igor Pro implementation (ClusterMasterV4-1).{" "}
          <a href="#about">About, citations &amp; other tools</a> ·{" "}
          <a href="/methods">Methods reference</a>
        </p>
        <p>
          v{VERSION} · built {BUILT} · first commit {longDate(BORN)} ·{" "}
          <a href="#about">contact</a>
        </p>
      </footer>
    </div>
  );
}
