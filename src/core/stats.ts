// Small statistics helpers shared by the core.

export function mean(a: ArrayLike<number>, from = 0, to = a.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return s / (to - from);
}

/** Sample standard deviation (n-1), matching Igor's V_sdev. */
export function sampleSD(a: ArrayLike<number>, from = 0, to = a.length): number {
  const n = to - from;
  if (n < 2) return 0;
  const m = mean(a, from, to);
  let s2 = 0;
  for (let i = from; i < to; i++) s2 += (a[i] - m) ** 2;
  return Math.sqrt(s2 / (n - 1));
}

/** Standard error of the mean, matching Igor's V_sem. */
export function sem(a: ArrayLike<number>, from = 0, to = a.length): number {
  const n = to - from;
  if (n < 1) return 0;
  return sampleSD(a, from, to) / Math.sqrt(n);
}

/** Mean and sample SD of a list, as reported by Fortran MSD (without the -1 sentinel skip). */
export function meanSD(vals: number[]): { mean: number; sd: number; n: number } | null {
  const n = vals.length;
  if (n === 0) return null;
  const m = mean(vals);
  if (n === 1) return { mean: m, sd: 0, n };
  let s2 = 0;
  for (const v of vals) s2 += (v - m) ** 2;
  return { mean: m, sd: Math.sqrt(s2 / (n - 1)), n };
}
