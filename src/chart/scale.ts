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

/** Pad a domain by a fraction on each side (peak labels need headroom). */
export function padDomain([lo, hi]: [number, number], fLo = 0.05, fHi = 0.1): [number, number] {
  const span = hi - lo || 1;
  return [lo - span * fLo, hi + span * fHi];
}

export function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US");
  return String(v);
}
