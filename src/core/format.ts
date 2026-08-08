// Display formatting shared by the UI, chart tooltip, and PDF report.
// Rounds to `d` fraction digits at d+2 sig-fig precision; anything that would
// still show more than 3 significant digits is clamped to one decimal place.
// Full precision is always available in the results CSV export.
export const fmt = (v: number | null | undefined, d = 3): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = Number(v.toPrecision(d + 2)).toLocaleString("en-US", { maximumFractionDigits: d });
  const sigDigits = s.replace(/[^0-9]/g, "").replace(/^0+/, "").length;
  return sigDigits > 3 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : s;
};
