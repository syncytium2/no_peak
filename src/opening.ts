// What a cold start shows, defined once.
//
// The About page leads with a real record analyzed at the settings its paper
// published, and the app opens on the same record at the same settings, so a
// reader who clicks through meets the picture they were just shown. Both read
// this file; neither names the record itself.
//
// The record is digitized, and `data/digitized/` can be withdrawn without
// breaking the build — see docs/digitized-suppression.md. When it is, the app
// falls back to the simulated GnRH record at the generic defaults, and the About
// page drops its lead figure rather than caption a generator as a sheep.

import { PRESETS } from "./core/presets";
import { DEFAULT_PARAMS, type ClusterParams } from "./core/types";
import { sampleByKey, type Sample } from "./samples";

/** Ewe #9013, Webster et al. 1991 Fig. 4A: 21 portal GnRH pulses in 6 h. */
export const OPENING_SAMPLE = "w91_gnrh_thx_9013";
/** The settings that paper states for portal GnRH. */
export const OPENING_PRESET = "webster1991_gnrh";
/** What the app opened on before 2026-09-11, and still does without the digitized tree. */
const FALLBACK_SAMPLE = "sim_gnrh_thx_ewe";

export interface Opening {
  sample: Sample;
  params: ClusterParams;
  /** False when the digitized records are absent and the fallback is in use. */
  real: boolean;
}

/** `lookup` is injectable so the fallback can be tested with the tree present. */
export function opening(lookup: (key: string) => Sample | undefined = sampleByKey): Opening {
  const real = lookup(OPENING_SAMPLE);
  if (real) {
    const preset = PRESETS.find((p) => p.key === OPENING_PRESET)!;
    return { sample: real, params: { ...DEFAULT_PARAMS, ...preset.params }, real: true };
  }
  return { sample: lookup(FALLBACK_SAMPLE)!, params: { ...DEFAULT_PARAMS }, real: false };
}
