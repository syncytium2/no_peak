import { useEffect, useMemo, useRef, useState } from "react";
import { resolveErrorModel } from "./core/errorModel";
import { parseLooseNumbers, parseSeries, resultToCSV, type ParsedSeries } from "./core/csv";
import { fmt } from "./core/format";
import { readBinaryWave, readPackedExperiment, type IgorFile } from "./core/igor";
import { PRESETS, hasScaleDependence, matchPreset } from "./core/presets";
import { runSegments, segmentsToCSV, type Segment } from "./core/segments";
import {
  TIME_UNITS,
  defaultAxisLabel,
  formatDuration,
  pulseFrequency,
  timeUnitDef,
  type TimeUnit,
} from "./core/timeUnits";
import { DEFAULT_PARAMS, type ClusterParams, type ErrorModelType, type MeanSD } from "./core/types";
import { ClusterChart } from "./chart/ClusterChart";
import { FIG, FIG_DOS } from "./chart/palette";
import { BORN, BUILT, VERSION, longDate } from "./version";
import { downloadPNG, downloadSVG, downloadText } from "./chart/export";
import { IgorPicker } from "./IgorPicker";
import { NumField } from "./NumField";
import { SAMPLES, SAMPLE_GROUPS, sampleByKey, sampleCounts } from "./samples";
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
  segments: Segment[];
  /** Set for bundled datasets: how the numbers were obtained. */
  provenance?: "simulated" | "digitised";
  /** Provenance line shown under the name. */
  note?: string;
  /** Source credit carried into every export. */
  citation?: string;
}

const fmtMS = (m: MeanSD | null) => (m ? `${fmt(m.mean)} ± ${fmt(m.sd)}` : "—");

/** Filenames that look like the error half of a pair: gnrh_sd, set1 SEM, … */
const looksLikeError = (name: string) =>
  /(^|[^a-z])(err|error|errors|sd|stdev|std|sem|se)([^a-z]|$)/i.test(name.replace(/\.[^.]+$/, ""));

const isIgor = (name: string) => /\.(pxp|ibw|bwav)$/i.test(name);

export function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [deltaT, setDeltaT] = useState(10);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("min");
  const [params, setParams] = useState<ClusterParams>({ ...DEFAULT_PARAMS });
  // null means "follow the time unit"; typing in the field pins a custom label.
  const [xLabelOverride, setXLabelOverride] = useState<string | null>(null);
  const [yLabel, setYLabel] = useState("Concentration");
  const [showError, setShowError] = useState(true);
  const [showMscore, setShowMscore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // set when a user-loaded file brings its own errors and we should ask first
  const [errorOffer, setErrorOffer] = useState<{ from: string; n: number } | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [igor, setIgor] = useState<{ file: IgorFile; name: string } | null>(null);
  // settings fold: open on desktop, collapsed on phones so the figure leads
  const [settingsOpen, setSettingsOpen] = useState(
    () => window.matchMedia("(min-width: 881px)").matches,
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const xLabel = xLabelOverride ?? defaultAxisLabel(timeUnit);
  const unitShort = timeUnitDef(timeUnit).short;
  /** True when every segment carries its own time column. */
  const hasTimes = !!loaded && loaded.segments.every((s) => s.times !== null);
  const hasErrors = !!loaded && loaded.segments.some((s) => s.error !== null);

  const computed = useMemo(() => {
    if (!loaded) return null;
    try {
      // belt-and-suspenders: never run "Error Wave" against data without one
      const effective =
        params.errorModel === "Error Wave" && !loaded.segments.some((s) => s.error)
          ? { ...params, errorModel: "Local SD" as const }
          : params;
      return { run: runSegments(loaded.segments, effective, deltaT), error: null as string | null };
    } catch (e) {
      return { run: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [loaded, deltaT, params]);

  const run = computed?.run ?? null;
  const result = run?.combined ?? null;
  const multi = (run?.segments.length ?? 0) > 1;

  const frequency = result
    ? pulseFrequency(result.summary.nPeaks, result.summary.recordDuration, timeUnit)
    : null;

  // ---- loading ------------------------------------------------------------

  async function onFiles(files: File[]) {
    setLoadError(null);
    try {
      // Igor files open the wave picker instead of being read as columns.
      if (files.length === 1 && isIgor(files[0].name)) {
        await openIgor(files[0]);
        return;
      }
      if (files.some((f) => isIgor(f.name))) {
        throw new Error("Load Igor files one at a time — the wave picker handles the rest.");
      }

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

      // Two files where one is named like errors: the classic data+error pair.
      if (parsed.length === 2 && parsed.some((p) => looksLikeError(p.name))) {
        const ei = parsed.findIndex((p) => looksLikeError(p.name));
        const data = parsed[ei === 0 ? 1 : 0];
        const errs = parsed[ei];
        if (errs.series.values.length !== data.series.values.length) {
          throw new Error(
            `"${errs.name}" has ${errs.series.values.length} values but "${data.name}" has ` +
              `${data.series.values.length}. A paired error file must be the same length.`,
          );
        }
        loadSeries(data.name, { ...data.series, error: errs.series.values }, true, errs.name);
        return;
      }

      // Otherwise every file is a record in its own right: analyse them
      // together under one set of settings.
      loadSegments(
        `${parsed.length} records`,
        parsed.map((p) => ({
          name: p.name,
          values: p.series.values,
          times: p.series.times,
          error: p.series.error,
        })),
        true,
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  async function openIgor(file: File) {
    const buf = await file.arrayBuffer();
    const parsed = /\.pxp$/i.test(file.name)
      ? readPackedExperiment(buf)
      : { waves: [readBinaryWave(buf)], skipped: [] };
    setIgor({ file: parsed, name: file.name });
  }

  /**
   * `ask` is set for user-supplied data: rather than silently switching the
   * error model, offer the choice. Bundled samples are curated, so they just
   * apply the right model.
   */
  function loadSegments(name: string, segments: Segment[], ask = false, errorFrom?: string) {
    setLoadError(null);
    setIgor(null);
    setLoaded({ name, segments });
    const errN = segments.reduce((a, s) => a + (s.error?.length ?? 0), 0);
    if (ask && errN > 0) {
      setErrorOffer({ from: errorFrom ?? `a column in ${name}`, n: errN });
      return; // leave the model alone until the user decides
    }
    setErrorOffer(null);
    setParams((p) => {
      const next = resolveErrorModel(p.errorModel, errN > 0);
      return next === p.errorModel ? p : { ...p, errorModel: next };
    });
  }

  function loadSeries(name: string, series: ParsedSeries, ask = false, errorFrom?: string) {
    loadSegments(
      name,
      [{ name, values: series.values, times: series.times, error: series.error }],
      ask,
      errorFrom,
    );
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
    const sample = sampleByKey(key);
    if (!sample) return;
    try {
      const series = sample.load();
      setLoadError(null);
      setIgor(null);
      setErrorOffer(null);
      // A bundled sample knows its own scale — adopt it rather than leaving the
      // figure on whatever the last dataset used.
      setTimeUnit(sample.timeUnit);
      setDeltaT(sample.deltaT);
      setYLabel(sample.valueLabel);
      setLoaded({
        name: sample.key,
        provenance: sample.provenance,
        note: sample.note,
        citation: sample.citation,
        segments: [
          { name: sample.key, values: series.values, times: series.times, error: series.error },
        ],
      });
      setParams((p) => {
        const next = resolveErrorModel(p.errorModel, series.error !== null);
        return next === p.errorModel ? p : { ...p, errorModel: next };
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }

  // ?demo auto-loads the synthetic demo; otherwise the bundled GnRH dataset
  // loads by default so the page never opens blank.
  useEffect(() => {
    loadSample(
      new URLSearchParams(window.location.search).has("demo") ? "demo" : "sim_gnrh_thx_ewe",
    );
  }, []);

  // Original Fortran mode gets the MS-DOS terminal chrome it ran under
  const dos = params.variant === "fortran";
  useEffect(() => {
    document.body.classList.toggle("dos", dos);
    return () => document.body.classList.remove("dos");
  }, [dos]);

  const set = <K extends keyof ClusterParams>(key: K) => (v: ClusterParams[K]) =>
    setParams((p) => ({ ...p, [key]: v }));

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
          accept=".csv,.txt,.tsv,.dat,.pxp,.ibw"
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

        <div className="formats">
          <strong>What the Load button accepts</strong>
          <ul>
            <li>
              <strong>Igor</strong> — a packed experiment (<code>.pxp</code>) or a single binary
              wave (<code>.ibw</code>). You pick the wave to analyse, and its error and time waves
              if it has them; the wave&apos;s own x scaling becomes the sampling interval.
            </li>
            <li>
              <strong>Text</strong> — CSV, TSV or plain text with one row per sample and one, two
              or three columns: <code>value</code>, <code>time,value</code>, or{" "}
              <code>time,value,error</code>. A header row is optional and lines starting with{" "}
              <code>#</code> are ignored.
            </li>
            <li>
              <strong>Several files at once</strong> — each becomes one record, analysed together
              under identical settings. Two files where one is named like errors (
              <code>…_sd</code>, <code>…SEM</code>) are paired instead.
            </li>
          </ul>
          <button
            className="linkish"
            onClick={() => downloadText(TEMPLATE_CSV, TEMPLATE_NAME)}
            title="Download a small example file with the expected columns"
          >
            Download an example CSV
          </button>{" "}
          · <a href="#about">how to prepare a file</a>
        </div>

        {loaded && (
          <span className="loadedname">
            {loaded.name} — {loaded.segments.length > 1 && `${loaded.segments.length} records, `}
            {loaded.segments.reduce((a, s) => a + s.values.length, 0)} points
            {loaded.provenance === "simulated" && (
              <span className="simtag" title="Generated data, not a real experiment">
                simulated
              </span>
            )}
            {loaded.provenance === "digitised" && (
              <span
                className="simtag digtag"
                title="A real record, read off a published figure — approximate to the width of a printed line"
              >
                digitised from a figure
              </span>
            )}
            {loaded.note && <span className="samplenote">{loaded.note}</span>}
          </span>
        )}
      </section>

      {igor && (
        <IgorPicker
          file={igor.file}
          fileName={igor.name}
          onCancel={() => setIgor(null)}
          onLoad={(segments, meta) => {
            if (meta.timeUnit) setTimeUnit(meta.timeUnit);
            if (meta.deltaT && meta.deltaT > 0) setDeltaT(meta.deltaT);
            if (meta.dataUnits) setYLabel(meta.dataUnits);
            loadSegments(
              segments.length > 1 ? `${igor.name} — ${segments.length} waves` : segments[0].name,
              segments,
              true,
            );
          }}
        />
      )}

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
          <p className="kbdhint">
            <kbd>Tab</kbd> moves between fields and selects what is there, so you can type straight
            over it. <kbd>↑</kbd> <kbd>↓</kbd> step a value — hold <kbd>Shift</kbd> for ten steps.
            <kbd>Esc</kbd> undoes an entry.
          </p>

          <h2>Detection parameters</h2>
          <label className="presetpick">
            Start from published settings
            <select
              value={matchPreset(params)?.key ?? ""}
              onChange={(e) => {
                const p = PRESETS.find((s) => s.key === e.target.value);
                if (p) setParams((prev) => ({ ...prev, ...p.params }));
              }}
            >
              <option value="" disabled>
                custom — edit the fields below
              </option>
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {(() => {
            const p = matchPreset(params);
            if (!p || !p.cite) return null;
            return (
              <p className="presetnote">
                {p.note} <span className="cite">{p.cite}</span>
              </p>
            );
          })()}
          <div className="grid">
            <NumField
              label="Peak window (points)"
              value={params.nPeak}
              onChange={set("nPeak")}
              min={1}
              step={1}
              integer
              title="Points averaged for the test window (Fortran NPEAK)"
            />
            <NumField
              label="Nadir window (points)"
              value={params.nNadir}
              onChange={set("nNadir")}
              min={1}
              step={1}
              integer
              title="Points averaged for the baseline window (Fortran NNADIR)"
            />
            <NumField
              label="t-score, increase"
              value={params.tScoreUp}
              onChange={set("tScoreUp")}
              step={0.1}
              min={0}
            />
            <NumField
              label="t-score, decrease"
              value={params.tScoreDn}
              onChange={set("tScoreDn")}
              step={0.1}
              min={0}
            />
            <NumField
              label="Min value for a pulse"
              value={params.minPeak}
              onChange={set("minPeak")}
              step={0.1}
            />
            <label>
              Error model
              <select
                value={params.errorModel}
                onChange={(e) =>
                  setParams((p) => ({ ...p, errorModel: e.target.value as ErrorModelType }))
                }
              >
                {ERROR_MODELS.map((m) => (
                  <option key={m} value={m} disabled={m === "Error Wave" && !hasErrors}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {(params.errorModel === "Fixed" || params.errorModel === "SQRT") && (
              <NumField
                label={params.errorModel === "Fixed" ? "Fixed error value" : "SQRT fallback (value ≤ 0)"}
                value={params.errorValue}
                onChange={set("errorValue")}
                step={0.1}
              />
            )}
          </div>
          {hasScaleDependence(params) && (
            <p className="warn">
              <strong>These settings depend on your units.</strong> The Igor implementation pools
              the per-point errors without squaring them, so its t-score is not dimensionless: the
              same record expressed in ng/ml and in pg/ml gives different pulse counts at the same
              threshold. Narrow windows make it worse, and one-point windows make it severe. Switch{" "}
              <strong>Implementation</strong> to the original Fortran, whose pooled variance is
              scale-invariant, before reproducing a published threshold.{" "}
              <a href="#about">Details</a>
            </p>
          )}

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
              <NumField
                className="inline"
                label="zero level"
                value={params.zero}
                onChange={set("zero")}
                step={0.1}
              />
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

          <h2>Time base</h2>
          <div className="grid">
            <label>
              Time units
              <select value={timeUnit} onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}>
                {TIME_UNITS.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
            {!hasTimes && (
              <NumField
                label={`Sampling interval (${unitShort})`}
                value={deltaT}
                onChange={setDeltaT}
                min={0.001}
                step={1}
                title="Time between samples, used to build the time axis"
              />
            )}
          </div>
          <p className="hint">
            {hasTimes
              ? `Times come from the data. They are read as ${timeUnitDef(timeUnit).label}, which sets the axis label, the tick spacing and the units of every reported interval and frequency.`
              : `The data carries no time column, so the axis is built from the sampling interval above. It is read as ${timeUnitDef(timeUnit).label}.`}
          </p>

          <h2>Figure</h2>
          <div className="grid">
            <label>
              X-axis label
              <input
                value={xLabel}
                onChange={(e) => setXLabelOverride(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <label>
              Y-axis label
              <input
                value={yLabel}
                onChange={(e) => setYLabel(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
          </div>
          {xLabelOverride !== null && (
            <p className="hint">
              The x-axis label no longer follows the time units.{" "}
              <button className="linkish" onClick={() => setXLabelOverride(null)}>
                Follow them again
              </button>
            </p>
          )}
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
                <button onClick={() => downloadText(
                    resultToCSV(result, {
                      datasetName: loaded!.name,
                      citation: loaded!.citation,
                    }),
                    `${loaded!.name}_cluster.csv`,
                  )}>
                  Results CSV
                </button>
                {multi && (
                  <button
                    onClick={() =>
                      downloadText(segmentsToCSV(run!, unitShort), `${loaded!.name}_by_record.csv`)
                    }
                  >
                    Per-record CSV
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!svgRef.current) return;
                    // jsPDF + svg2pdf are heavy; loaded on first use only
                    const { generatePDFReport } = await import("./report/pdf");
                    await generatePDFReport(svgRef.current, result, {
                      datasetName: loaded!.name,
                      xLabel,
                      yLabel,
                      unitShort,
                      frequency,
                      citation: loaded!.citation,
                      segments: multi ? run!.segments : undefined,
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
          {result && run && (
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
                timeUnit={timeUnit}
                segments={multi ? run.segments : undefined}
                credit={loaded?.citation}
              />

              {multi && (
                <p className="hint">
                  Each record was analysed on its own with these settings, so no detection window
                  crosses a boundary and no reported interval spans one. The dividers mark where one
                  record ends and the next begins.
                </p>
              )}

              <div className="statrow">
                <div className="stat headline">
                  <div className="statlabel">Pulse frequency</div>
                  <div className="statvalue">
                    {frequency ? fmt(frequency.perHour, 2) : fmt(result.summary.nPeaks)}
                    <span className="statunit">
                      {frequency ? " pulses/h" : " pulses (no time base)"}
                    </span>
                  </div>
                  <div className="statsub">
                    {result.summary.nPeaks} pulse{result.summary.nPeaks === 1 ? "" : "s"}
                    {frequency ? ` in ${formatDuration(frequency.durationMin)}` : ""}
                    {multi ? ` across ${run.segments.length} records` : ""}
                  </div>
                </div>
                <div className="stat">
                  <div className="statlabel">Interpulse interval</div>
                  <div className="statvalue">{fmtMS(result.summary.interPeakInterval)}</div>
                  <div className="statsub">{unitShort}</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Amplitude</div>
                  <div className="statvalue">{fmtMS(result.summary.peakAmplitude)}</div>
                  <div className="statsub">rise above baseline</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Peak value</div>
                  <div className="statvalue">{fmtMS(result.summary.peakValue)}</div>
                  <div className="statsub">absolute maximum</div>
                </div>
                <div className="stat">
                  <div className="statlabel">Mean level</div>
                  <div className="statvalue">{fmt(result.summary.meanValue)}</div>
                  <div className="statsub">whole record</div>
                </div>
              </div>

              {multi && (
                <>
                  <h2>By record</h2>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>record</th>
                          <th>points</th>
                          <th>duration ({unitShort})</th>
                          <th>pulses</th>
                          <th>pulses/h</th>
                          <th>interpulse ({unitShort})</th>
                          <th>amplitude</th>
                          <th>peak value</th>
                          <th>baseline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.segments.map((s) => {
                          const m = s.result.summary;
                          const f = pulseFrequency(m.nPeaks, m.recordDuration, timeUnit);
                          return (
                            <tr key={s.name + s.start}>
                              <td>{s.name}</td>
                              <td>{s.length}</td>
                              <td>{fmt(m.recordDuration)}</td>
                              <td>{m.nPeaks}</td>
                              <td>{f ? fmt(f.perHour, 2) : "—"}</td>
                              <td>{fmtMS(m.interPeakInterval)}</td>
                              <td>{fmtMS(m.peakAmplitude)}</td>
                              <td>{fmtMS(m.peakValue)}</td>
                              <td>{fmtMS(m.valleyNadir)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {result.peaks.length > 0 && (
                <>
                  <h2>Pulses</h2>
                  <p className="hint">
                    <strong>Peak value</strong> is the highest concentration reached, in the units of
                    your data. <strong>Baseline</strong> is the mean of the {params.nNadir} nadir
                    points immediately before the pulse starts. <strong>Amplitude</strong> is the
                    difference between them — the rise the pulse represents. The original Fortran
                    printed peak value as &quot;height&quot; and amplitude as &quot;L
                    increase&quot;, which is where the two get confused.
                  </p>
                  <div className="tablewrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>peak at ({unitShort})</th>
                          <th>pulse spans</th>
                          <th>width ({unitShort})</th>
                          <th>baseline (nadir)</th>
                          <th>peak value</th>
                          <th>amplitude</th>
                          <th>peak % of nadir</th>
                          <th>mean %</th>
                          <th>area</th>
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
                            <td>{fmt(p.nadirBefore)}</td>
                            <td>{fmt(p.peakValue)}</td>
                            <td>{fmt(p.amplitude)}</td>
                            <td>{fmt(p.largestPct, 1)}</td>
                            <td>{fmt(p.meanPct, 1)}</td>
                            <td>{fmt(p.area)}</td>
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
                          <th>nadir at ({unitShort})</th>
                          <th>valley spans</th>
                          <th>width ({unitShort})</th>
                          <th>nadir (lowest value)</th>
                          <th>mean level</th>
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
