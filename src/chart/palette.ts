// Figure palette — validated with the dataviz six-checks validator
// (3 categorical slots, light surface, all-pairs: PASS; aqua contrast WARN is
// relieved by text labels on the flag strips and the full table view).
// Colors are baked as explicit hex so exported SVGs are self-contained.

export const FIG = {
  surface: "#fcfcfb",
  inkPrimary: "#0b0b0b",
  inkSecondary: "#52514e",
  inkMuted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",

  /** slot 1 — the concentration series */
  series: "#2a78d6",
  /** slot 2 — detected pulse regions */
  pulse: "#eb6834",
  /** slot 3 — up/down significance flags */
  flag: "#1baf7a",

  font: "Helvetica, Arial, sans-serif",
} as const;

/** Wash opacity for pulse-region fills (a wash, never a saturated block). */
export const PULSE_WASH_OPACITY = 0.12;
export const ERROR_BAR_OPACITY = 0.45;
