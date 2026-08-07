// Deterministic demo dataset: an LH-like pulsatile series, 10-minute sampling
// over 12 hours. Seeded PRNG so every visitor sees the same figure.

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoSeries(): { times: number[]; values: number[] } {
  const rand = mulberry32(20260807);
  const n = 72;
  const dt = 10; // minutes
  const baseline = 3;
  const halfLifeMin = 45;
  const k = Math.LN2 / halfLifeMin;

  const pulseStarts = [40, 150, 270, 380, 500, 620]; // minutes
  const amplitudes = [6, 9, 5, 8, 7, 10];

  const times: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * dt;
    let v = baseline;
    for (let p = 0; p < pulseStarts.length; p++) {
      const dtp = t - pulseStarts[p];
      if (dtp >= 0) v += amplitudes[p] * Math.exp(-k * dtp);
    }
    // ~7% CV assay noise
    v *= 1 + (rand() - 0.5) * 0.14;
    times.push(t);
    values.push(Number(v.toFixed(3)));
  }
  return { times, values };
}
