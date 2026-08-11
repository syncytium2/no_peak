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
  params: Pick<ClusterParams, "nPeak" | "nNadir" | "tScoreUp" | "tScoreDn">;
}

export const PRESETS: ParamPreset[] = [
  {
    key: "default",
    label: "This app's defaults",
    cite: "",
    note: "Two-point windows and t = 2, the settings the Igor package opens with.",
    params: { nPeak: 2, nNadir: 2, tScoreUp: 2, tScoreDn: 2 },
  },
  {
    key: "webster1991_gnrh",
    label: "Portal GnRH — Webster et al. 1991",
    cite: "Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ. Endocrinology 1991;129(3):1635–43.",
    note:
      "Hypophyseal-portal GnRH in the ewe, 5-min fractions over 6 h. The paper states a false " +
      "positive rate of 1% for this combination.",
    params: { nPeak: 1, nNadir: 1, tScoreUp: 3.2, tScoreDn: 3.2 },
  },
  {
    key: "webster1991_lh",
    label: "Peripheral LH — Webster et al. 1991",
    cite: "Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ. Endocrinology 1991;129(3):1635–43.",
    note:
      "Jugular LH in the ewe, 6-min sampling over 6 h. The paper states a false positive rate of " +
      "5% for this combination.",
    params: { nPeak: 1, nNadir: 1, tScoreUp: 2.32, tScoreDn: 2.32 },
  },
];

/** Which preset the current parameters match, if any. */
export function matchPreset(p: ClusterParams): ParamPreset | undefined {
  return PRESETS.find(
    (s) =>
      s.params.nPeak === p.nPeak &&
      s.params.nNadir === p.nNadir &&
      s.params.tScoreUp === p.tScoreUp &&
      s.params.tScoreDn === p.tScoreDn,
  );
}
