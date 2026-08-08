// Client-side PDF report: title block, parameters, the figure as true vector
// art (svg2pdf), summary statistics, and peaks/valleys tables. Built entirely
// in the browser — nothing leaves the machine.

import { jsPDF } from "jspdf";
import "svg2pdf.js";
import autoTable from "jspdf-autotable";
import type { ClusterResult, MeanSD } from "../core/types";
import { fmt } from "../core/format";

const INK = "#0b0b0b";
const INK2 = "#52514e";
const MUTED = "#898781";
const GRID = "#e1e0d9";

const PAGE_W = 595.28; // A4 portrait, pt
const MARGIN = 48;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const fmtMS = (m: MeanSD | null) => (m ? `${fmt(m.mean)} ± ${fmt(m.sd)} (n=${m.n})` : "—");

export interface ReportMeta {
  datasetName: string;
  xLabel: string;
  yLabel: string;
}

export async function generatePDFReport(
  svg: SVGSVGElement,
  result: ClusterResult,
  meta: ReportMeta,
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const p = result.params;
  let y = MARGIN;

  // ---- title block ----
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(INK);
  doc.text("CLUSTER pulse detection report", MARGIN, y);
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(INK2);
  doc.text(`Dataset: ${meta.datasetName} — ${result.values.length} points`, MARGIN, y);
  y += 15;
  doc.setFontSize(9).setTextColor(MUTED);
  doc.text(
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} by no_peak (client-side CLUSTER analysis)`,
    MARGIN,
    y,
  );
  y += 18;
  doc.setDrawColor(GRID).setLineWidth(1);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 16;

  // ---- parameters ----
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(INK);
  doc.text("Parameters", MARGIN, y);
  y += 6;
  const paramRows: string[][] = [
    ["Peak window (points)", String(p.nPeak), "Nadir window (points)", String(p.nNadir)],
    ["t-score, increase", String(p.tScoreUp), "t-score, decrease", String(p.tScoreDn)],
    ["Min value for a pulse", String(p.minPeak), "Error model", p.errorModel],
  ];
  if (p.errorModel === "Fixed" || p.errorModel === "SQRT") {
    paramRows.push(["Error value", String(p.errorValue), "", ""]);
  }
  paramRows.push([
    "Zero-terminate",
    p.zeroTerminate ? `yes (≤ ${p.zero})` : "no",
    "Pooled-variance form",
    p.fortranVariance ? "Fortran (squared)" : "Igor",
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: paramRows,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 0, right: 8 }, textColor: INK2 },
    columnStyles: {
      1: { textColor: INK, fontStyle: "bold" },
      3: { textColor: INK, fontStyle: "bold" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  // ---- figure (vector) ----
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-noexport]").forEach((el) => el.remove());
  const vb = svg.viewBox.baseVal;
  const figW = CONTENT_W;
  const figH = (vb.height / vb.width) * figW;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  // svg2pdf resolves styles from the live DOM — attach off-screen during render
  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    await doc.svg(clone, { x: MARGIN, y, width: figW, height: figH });
  } finally {
    holder.remove();
  }
  y += figH + 10;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED);
  const caption = doc.splitTextToSize(
    `Figure: ${meta.yLabel} vs ${meta.xLabel}. Shaded regions are detected pulses; numbers mark peak apices; ` +
      `triangles mark significant increases (UP) and decreases (DOWN) by the sliding pooled t-test.`,
    CONTENT_W,
  );
  doc.text(caption, MARGIN, y);
  y += caption.length * 10 + 14;

  // ---- summary ----
  const s = result.summary;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(INK);
  doc.text("Summary", MARGIN, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: [
      ["Peaks", String(s.nPeaks), "Valleys", String(s.nValleys)],
      ["Mean value", fmt(s.meanValue), "Total area", fmt(s.totalArea)],
      ["Interpeak interval", fmtMS(s.interPeakInterval), "Peak width", fmtMS(s.peakWidth)],
      ["Peak height", fmtMS(s.peakHeight), "Peak increase above basal", fmtMS(s.peakIncrease)],
      ["Peak height, % of nadir", fmtMS(s.peakLargestPct), "Peak area", fmtMS(s.peakArea)],
      ["Valley width", fmtMS(s.valleyWidth), "Valley nadir", fmtMS(s.valleyNadir)],
    ],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 0, right: 8 }, textColor: INK2 },
    columnStyles: {
      1: { textColor: INK, fontStyle: "bold" },
      3: { textColor: INK, fontStyle: "bold" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // ---- peaks table ----
  const numStyle = { halign: "right" as const };
  if (result.peaks.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(INK);
    doc.text("Peaks", MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["#", "position", "range", "width", "height", "largest %", "mean %", "area", "increase"]],
      body: result.peaks.map((pk, i) => [
        String(i + 1),
        fmt(result.times[pk.iMax]),
        `${fmt(result.times[pk.iFirst])}–${fmt(result.times[pk.iLast])}`,
        fmt(pk.width),
        fmt(pk.height),
        fmt(pk.largestPct, 1),
        fmt(pk.meanPct, 1),
        fmt(pk.area),
        fmt(pk.increase),
      ]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3, textColor: INK, ...numStyle },
      headStyles: { textColor: INK2, fontStyle: "bold", lineWidth: { bottom: 0.75 }, lineColor: GRID },
      bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: GRID },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  // ---- valleys table ----
  if (result.valleys.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(INK);
    doc.text("Valleys", MARGIN, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["#", "position", "range", "width", "nadir", "mean"]],
      body: result.valleys.map((v, i) => [
        String(i + 1),
        fmt(result.times[v.iMin]),
        `${fmt(result.times[v.iFirst])}–${fmt(result.times[v.iLast])}`,
        fmt(v.width),
        fmt(v.nadir),
        fmt(v.mean),
      ]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 3, textColor: INK, ...numStyle },
      headStyles: { textColor: INK2, fontStyle: "bold", lineWidth: { bottom: 0.75 }, lineColor: GRID },
      bodyStyles: { lineWidth: { bottom: 0.5 }, lineColor: GRID },
    });
  }

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED);
    doc.text(
      "CLUSTER algorithm: Veldhuis & Johnson; original Fortran by Michael L. Johnson.",
      MARGIN,
      doc.internal.pageSize.getHeight() - 24,
    );
    doc.text(
      `${i} / ${pages}`,
      PAGE_W - MARGIN,
      doc.internal.pageSize.getHeight() - 24,
      { align: "right" },
    );
  }

  doc.save(`${meta.datasetName}_cluster_report.pdf`);
}
