// Linear scales and clean tick generation for the figure axes.

export interface LinearScale {
  (v: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const fn = ((v: number) => r0 + (v - d0) * k) as LinearScale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/** Round ticks at clean steps (1/2/5 x 10^n) covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const raw = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    // snap floating error to the step's precision
    ticks.push(Number(t.toFixed(Math.max(0, -Math.floor(Math.log10(step)) + 1))));
  }
  return ticks;
}

/**
 * Tick steps for a time axis, in seconds. Decimal 1/2/5 steps are wrong for
 * time: on a seconds axis they give 100, 200, 300, which nobody reads as
 * "1:40, 3:20, 5:00". These are the divisions of a clock, so a reader can map a
 * tick onto minutes without arithmetic.
 */
const TIME_STEPS_SEC = [
  1, 2, 5, 10, 15, 20, 30,
  60, 120, 300, 600, 900, 1200, 1800,
  3600, 7200, 10800, 21600, 43200, 86400,
];

/**
 * Ticks for an axis measured in time, where `unitSeconds` is how many seconds
 * one axis unit represents (60 for a minutes axis, 1 for seconds).
 *
 * Falls back to `niceTicks` when the range is wider or finer than the clock
 * ladder covers, so a multi-day record still gets sensible round numbers.
 */
export function timeTicks(
  min: number,
  max: number,
  target: number,
  unitSeconds: number,
): number[] {
  if (!(max > min) || !(unitSeconds > 0)) return niceTicks(min, max, target);

  const wantSec = ((max - min) * unitSeconds) / target;
  // Below a second, and above a day, the decimal ladder is the better one.
  if (wantSec < 1 || wantSec > TIME_STEPS_SEC[TIME_STEPS_SEC.length - 1]) {
    return niceTicks(min, max, target);
  }
  // Nearest rung in log space. Rounding up instead would systematically
  // undershoot the requested tick count — 600 s at 8 ticks wants 75, and the
  // next rung up (120) leaves a sparse axis where 60 reads perfectly well.
  const stepSec = TIME_STEPS_SEC.reduce((best, s) =>
    Math.abs(Math.log(s / wantSec)) < Math.abs(Math.log(best / wantSec)) ? s : best,
  );

  const step = stepSec / unitSeconds; // back into axis units
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) {
    // The step can be fractional in axis units (30 s on a minutes axis is 0.5),
    // so round to the precision the step itself carries.
    ticks.push(Number(t.toPrecision(12)));
  }
  return ticks.length >= 2 ? ticks : niceTicks(min, max, target);
}

/**
 * When every tick on a time axis lands on a whole larger unit, the axis is
 * counting in that unit and should say so: a 6 h record on a minutes axis ticks
 * 0, 60, 120 … 360, which is an hour ladder wearing minute clothes and asks the
 * reader to divide by 60 to think in hours.
 *
 * Returns the divisor and the unit to display in, or null when the ticks are
 * already in the axis's own unit. Never promotes past what the ticks support —
 * a 90-minute step stays in minutes, because 1.5 h reads worse than 90.
 */
export interface UnitPromotion {
  /** Divide tick values by this to get the displayed number. */
  divisor: number;
  /** Suffix for the axis label, e.g. "h". */
  short: string;
}

export function promoteTimeUnit(ticks: number[], unitMinutes: number | null): UnitPromotion | null {
  if (unitMinutes === null || !(unitMinutes > 0) || ticks.length < 2) return null;
  const stepMin = Math.abs(ticks[1] - ticks[0]) * unitMinutes;
  if (!(stepMin > 0)) return null;
  // A promotion has to divide every tick, not just the step: ticks anchored off
  // a whole unit (a window starting at 05:30) still read best in their own.
  const whole = (perMin: number) =>
    ticks.every((t) => Math.abs(((t * unitMinutes) / perMin) % 1) < 1e-9);

  if (unitMinutes < 1 && stepMin >= 60 && whole(60)) return { divisor: 60 / unitMinutes, short: "h" };
  if (unitMinutes < 1 && stepMin >= 1 && whole(1)) return { divisor: 1 / unitMinutes, short: "min" };
  if (unitMinutes === 1 && stepMin >= 60 && whole(60)) return { divisor: 60, short: "h" };
  return null;
}

/** Pad a domain by a fraction on each side (peak labels need headroom). */
export function padDomain([lo, hi]: [number, number], fLo = 0.05, fHi = 0.1): [number, number] {
  const span = hi - lo || 1;
  return [lo - span * fLo, hi + span * fHi];
}

export function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US");
  return String(v);
}
