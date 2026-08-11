// Detection settings taken verbatim from published analyses.
//
// The five detection parameters *are* the model — different settings give
// different pulse counts from the same record — so a paper that reports them is
// the only kind that can be reproduced. Papers that do report them are worth
// having a click away, both to reproduce a published analysis and to start from
// a defensible setting for the same hormone and protocol rather than from this
// app's generic defaults.
//
// The rule for adding one: the parameters must be stated in the paper, not
// inferred from its figures, and the citation goes in with them.

import type { ClusterParams } from "./types";

export interface ParamPreset {
  key: string;
  label: string;
  /** Where the numbers come from. */
  cite: string;
  /** What the paper said this combination costs in false positives. */
  note: string;
  params: Pick<
    ClusterParams,
    "nPeak" | "nNadir" | "tScoreUp" | "tScoreDn" | "variant" | "errorModel" | "assayCV" | "assayFloor"
  >;
}

export const PRESETS: ParamPreset[] = [
  {
    key: "default",
    label: "This app's defaults",
    cite: "",
    note: "Two-point windows and t = 2, the settings the Igor package opens with.",
    params: {
      nPeak: 2, nNadir: 2, tScoreUp: 2, tScoreDn: 2, variant: "igor",
      errorModel: "Local SD", assayCV: 0.08, assayFloor: 0,
    },
  },
  {
    key: "webster1991_gnrh",
    label: "Portal GnRH — Webster et al. 1991",
    cite: "Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ. Endocrinology 1991;129(3):1635–43.",
    note:
      "Hypophyseal-portal GnRH in the ewe, 5-min fractions over 6 h, reported in pg/min. The " +
      "paper states a false positive rate of 1% for this combination. It selects the original " +
      "Fortran implementation, which is what existed in 1991 — and which matters more than it " +
      "sounds, because the Igor variant's t-score is not scale-invariant at one-point windows. " +
      "It also sets the error model, which the paper does NOT report: an assay CV of 8% with a " +
      "floor of 0.06 pg/min. Both are reconstructed, not published — the floor was chosen to " +
      "match this paper's own pulse calls. Without an assay-shaped error the estimated models " +
      "find nothing here, because at one-point windows a pulse inflates its own error.",
    params: {
      nPeak: 1, nNadir: 1, tScoreUp: 3.2, tScoreDn: 3.2, variant: "fortran",
      errorModel: "Assay CV", assayCV: 0.08, assayFloor: 0.06,
    },
  },
  {
    key: "webster1991_lh",
    label: "Peripheral LH — Webster et al. 1991",
    cite: "Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ. Endocrinology 1991;129(3):1635–43.",
    note:
      "Jugular LH in the ewe, 6-min sampling over 6 h, reported in ng/ml. The paper states a " +
      "false positive rate of 5% for this combination. Original Fortran, for the same reason. " +
      "The error model is an assay CV of 8% with a floor of 0.45 ng/ml — the floor IS the assay " +
      "sensitivity this paper reports; the CV is reconstructed.",
    params: {
      nPeak: 1, nNadir: 1, tScoreUp: 2.32, tScoreDn: 2.32, variant: "fortran",
      errorModel: "Assay CV", assayCV: 0.08, assayFloor: 0.45,
    },
  },
];

/** Which preset the current parameters match, if any. */
export function matchPreset(p: ClusterParams): ParamPreset | undefined {
  return PRESETS.find(
    (s) =>
      s.params.nPeak === p.nPeak &&
      s.params.nNadir === p.nNadir &&
      s.params.tScoreUp === p.tScoreUp &&
      s.params.tScoreDn === p.tScoreDn &&
      s.params.variant === p.variant &&
      s.params.errorModel === p.errorModel &&
      (p.errorModel !== "Assay CV" ||
        (s.params.assayCV === p.assayCV && s.params.assayFloor === p.assayFloor)),
  );
}

/**
 * Whether the current settings expose the Igor variant's scale dependence badly
 * enough to be worth saying so.
 *
 * The Igor pooled S sums the per-point errors *unsquared* and then takes a
 * square root, so S carries units of sqrt(concentration) while the numerator
 * carries concentration. The t-score is therefore not dimensionless: multiply a
 * record by a constant — leaving its signal-to-noise untouched — and every
 * t-score moves by the square root of that constant, so the same data in ng/ml
 * and pg/ml gives different pulse counts at the same threshold. The original
 * Fortran sums the errors squared, which is a proper pooled variance, and is
 * invariant.
 *
 * The narrower the windows the fewer terms there are in S and the worse it
 * bites; at one-point windows it is severe. Two-point windows and above it is
 * usually mild, so the warning is not worth showing for the common case.
 */
export function hasScaleDependence(p: ClusterParams): boolean {
  return p.variant === "igor" && p.nPeak + p.nNadir <= 3;
}
