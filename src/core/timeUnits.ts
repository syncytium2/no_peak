// The time units of the x axis, and the statistics that depend on knowing them.
//
// The unit is one setting with several consequences, which is why it lives here
// rather than being retyped into an axis label: it names the sampling-interval
// field, labels the x axis, chooses the axis tick ladder, and converts pulse
// counts into a frequency. Getting a figure whose axis says "minutes" while the
// numbers are sample indices is the failure this is meant to prevent.

export type TimeUnit = "s" | "min" | "h" | "samples";

export interface TimeUnitDef {
  key: TimeUnit;
  /** Name in the picker. */
  label: string;
  /** Suffix used in axis labels and field names. */
  short: string;
  /** Minutes per unit; null when the x axis is not real time. */
  minutes: number | null;
}

export const TIME_UNITS: TimeUnitDef[] = [
  { key: "s", label: "seconds", short: "s", minutes: 1 / 60 },
  { key: "min", label: "minutes", short: "min", minutes: 1 },
  { key: "h", label: "hours", short: "h", minutes: 60 },
  { key: "samples", label: "sample number (not time)", short: "sample", minutes: null },
];

export const timeUnitDef = (u: TimeUnit): TimeUnitDef =>
  TIME_UNITS.find((t) => t.key === u) ?? TIME_UNITS[1];

/** The x-axis label this unit implies, e.g. "Time (min)". */
export function defaultAxisLabel(u: TimeUnit): string {
  return u === "samples" ? "Sample number" : `Time (${timeUnitDef(u).short})`;
}

export interface PulseFrequency {
  /** Pulses per hour over the whole record. */
  perHour: number;
  /** Record length in minutes. */
  durationMin: number;
}

/**
 * Pulse frequency over a record: peaks divided by elapsed time.
 *
 * Deliberately not the reciprocal of the mean interpulse interval — that
 * statistic only spans the first to the last pulse and needs two pulses to
 * exist at all, so it reads high on records with long quiet stretches. Counting
 * over the full record is what "pulses per hour" means in a methods section.
 *
 * Returns null when the x axis is not real time, or the record has no extent.
 */
export function pulseFrequency(
  nPeaks: number,
  recordDuration: number,
  unit: TimeUnit,
): PulseFrequency | null {
  const perUnit = timeUnitDef(unit).minutes;
  if (perUnit === null) return null;
  const durationMin = recordDuration * perUnit;
  if (!(durationMin > 0)) return null;
  return { perHour: (nPeaks / durationMin) * 60, durationMin };
}

/** Format a duration in minutes the way a methods section would write it. */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 90) return `${Number(minutes.toFixed(minutes < 10 ? 1 : 0))} min`;
  const h = minutes / 60;
  return `${Number(h.toFixed(h < 10 ? 1 : 0))} h`;
}
