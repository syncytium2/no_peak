// Port of mScore() from ClusterMasterV4-1.ipf:1352 — the pooled t-statistic
// comparing the trailing nadir window to the leading peak window at point ipt.
//
// The Igor code fixes NDF = 1 for every point (single replicate per sample),
// so the (NDF+1) weights are the constant 2 and the window means are plain
// means; the weights are kept explicit here to preserve the derivation.

/**
 * t-statistic at `ipt`: nadir window is w[ipt-nNadir .. ipt-1], peak window is
 * w[ipt .. ipt+nPeak-1].
 *
 * `fortranVariance` selects the pooled-S form: Igor (default) sums
 * NDF[i]*STDEV[i]; the original Fortran sums NDF(I)*STDEV(I)**2.
 */
export function mScore(
  ipt: number,
  nNadir: number,
  nPeak: number,
  w: ArrayLike<number>,
  stdev: ArrayLike<number>,
  fortranVariance = false,
): number {
  const NDF = 1;

  let nMean = 0;
  let sumN = 0;
  for (let i = 1; i <= nNadir; i++) {
    const j = ipt - i;
    nMean += (NDF + 1) * w[j];
    sumN += NDF + 1;
  }
  nMean /= sumN;

  let pMean = 0;
  let sumP = 0;
  for (let i = 1; i <= nPeak; i++) {
    const j = ipt - 1 + i;
    pMean += (NDF + 1) * w[j];
    sumP += NDF + 1;
  }
  pMean /= sumP;

  let s = 0;
  for (let i = ipt - nNadir; i <= ipt + nPeak - 1; i++) {
    s += NDF * (fortranVariance ? stdev[i] * stdev[i] : stdev[i]);
  }
  const S = Math.sqrt(s / (sumN + sumP - 2));

  return (pMean - nMean) / S / Math.sqrt(1 / sumN + 1 / sumP);
}
