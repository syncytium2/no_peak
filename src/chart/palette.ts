// Figure palettes. Colors are baked as explicit hex so exported SVGs are
// self-contained.

export interface FigPalette {
  surface: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  grid: string;
  axis: string;
  /** slot 1 — the concentration series */
  series: string;
  /** slot 2 — detected pulse regions */
  pulse: string;
  /** slot 3 — up/down significance flags */
  flag: string;
  font: string;
  /** Wash opacity for pulse-region fills (a wash, never a saturated block). */
  washOpacity: number;
}

// Default light palette — validated with the dataviz six-checks validator
// (3 categorical slots, light surface, all-pairs: PASS; aqua contrast WARN is
// relieved by text labels on the flag strips and the full table view).
export const FIG: FigPalette = {
  surface: "#fcfcfb",
  inkPrimary: "#0b0b0b",
  inkSecondary: "#52514e",
  inkMuted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  series: "#2a78d6",
  pulse: "#eb6834",
  flag: "#1baf7a",
  font: "Helvetica, Arial, sans-serif",
  washOpacity: 0.12,
};

// Green-phosphor terminal palette for the Original Fortran (CLUST5) mode —
// the look of the MS-DOS consoles the program ran on in the late 80s.
// Flags take CGA bright yellow so they read against the green series.
export const FIG_DOS: FigPalette = {
  surface: "#000000",
  inkPrimary: "#33ff33",
  inkSecondary: "#22cc22",
  inkMuted: "#12a112",
  grid: "#0c3a0c",
  axis: "#1c7a1c",
  series: "#55ff55",
  pulse: "#33ff33",
  flag: "#ffff55",
  font: "'Courier New', Courier, monospace",
  washOpacity: 0.22,
};

export const ERROR_BAR_OPACITY = 0.45;
