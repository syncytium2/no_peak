"""Generate a pulse-detection benchmark with known ground truth.

Phase 1 of docs/deep-learning-handoff.md. Everything downstream — baselines,
training data, the evaluation harness — is only as good as this generator, so
it is deliberately parameterised over the ranges real experiments span rather
than around one comfortable case.

Unlike the datasets in data/synthetic/ (which exist to make the app's demo look
plausible), this corpus records the generating pulse times, so detections can be
scored for sensitivity and false positives. It is entirely our own output and
carries no third-party license, so it can be published — which matters, because
the ground-truth data we have been scoring against cannot be.

    python3 tools/simulate_benchmark.py            # writes data/benchmark/
    python3 tools/simulate_benchmark.py --n 400    # bigger corpus

Model: concentration = basal(t) + sum of secretory bursts, each convolved with
first-order elimination, sampled on a regular grid, then perturbed by assay
noise whose CV rises at low concentration (which is where detectors actually
fail).

Priors, and why:
  half-life        LH in mouse is short (~5-10 min); human LH ~40-60 min; GH
                   ~15-20 min. Spanning 5-60 min covers the range CLUSTER is
                   applied to.
  sampling         2-10 min. Below the half-life the pulse is well resolved;
                   near or above it, pulses blur together — the regime where
                   detectors diverge most.
  inter-pulse      Gamma-shaped intervals, mean 20-90 min, so trains are
                   irregular rather than periodic.
  pulse mass       Lognormal: many small pulses, a few large ones. Detectors
                   look good on corpora of uniformly tall pulses; real records
                   are not like that.
  assay CV         5-15% at mid-range, rising toward a floor at low
                   concentration (a + b/x form), matching the regional-CV idea
                   in Veldhuis 1986 (Pediatr Res 20:632).
  baseline drift   Slow sinusoidal component on some records; Carlson 2013
                   found ignoring a changing baseline biases every method
                   they compared (CLUSTER was not among the four).
"""

from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def simulate(rng: random.Random, profile: str = "broad") -> dict:
    """One record. Returns the series, its true pulse onsets, and its params.

    profile="broad"  — the general corpus: wide priors, the default.
    profile="dense"  — shaped like Johnson's reference datasets (145 points at
                       10-minute sampling, ~30 pulses, ~4% CV). This profile
                       exists because the false-positive half of the Phase 1
                       gate is only meaningful against a density-matched
                       corpus; see docs/validation-status.md. It was originally
                       written as a throwaway script, which made the published
                       59.0%/0.4% figures unreproducible — hence its inclusion
                       here.
    """
    if profile == "dense":
        half_life = rng.uniform(20.0, 50.0)
        dt = 10.0
        n = 145
        basal = math.exp(rng.uniform(math.log(0.5), math.log(3.0)))
        mean_ipi = rng.uniform(40.0, 60.0)
    else:
        half_life = rng.uniform(5.0, 60.0)      # min
        dt = rng.choice([2.0, 5.0, 10.0])       # min between samples
        duration = rng.uniform(120.0, 480.0)    # min
        n = max(24, int(duration / dt))
        basal = math.exp(rng.uniform(math.log(0.05), math.log(8.0)))
        mean_ipi = rng.uniform(20.0, 90.0)
    # pulse mass relative to basal: lognormal, so small pulses dominate
    if profile == "dense":
        mass_mu, mass_sigma = math.log(2.0), 0.6
    else:
        mass_mu = rng.uniform(math.log(0.6), math.log(6.0))
        mass_sigma = rng.uniform(0.35, 0.9)

    cv_mid = rng.uniform(0.035, 0.05) if profile == "dense" else rng.uniform(0.05, 0.15)
    cv_floor_conc = basal * rng.uniform(0.2, 0.8)  # where CV starts to blow up
    # Assays report SDs that are conservative: measured against the residuals of
    # Johnson's own simulated datasets, actual noise is 0.8-0.9x the reported SD.
    # This matters far more than it looks. CLUSTER's t-test is calibrated on the
    # REPORTED error, so if that error were exactly right the test would show its
    # nominal ~2% per-point false-positive rate, and a long corpus would fill up
    # with spurious pulses. A slightly conservative SD is what keeps real-world
    # false positives near zero. Getting this wrong made the first version of
    # this generator produce a 23% false-discovery rate against ~0% on real data.
    noise_ratio = rng.uniform(0.75, 0.95)
    drift_amp = 0.0 if profile == "dense" else rng.choice([0.0, 0.0, rng.uniform(0.05, 0.35)]) * basal
    drift_period = rng.uniform(180.0, 720.0)

    k = math.log(2.0) / half_life

    # --- pulse onsets: gamma-ish spacing, first one anywhere in the first IPI
    onsets: list[float] = []
    t = rng.uniform(0.0, mean_ipi)
    while t < n * dt:
        onsets.append(t)
        shape = 3.0  # gamma shape: intervals cluster around the mean, no zeros
        t += sum(-math.log(1.0 - rng.random()) for _ in range(int(shape))) * (mean_ipi / shape)
    masses = [math.exp(rng.gauss(mass_mu, mass_sigma)) * basal for _ in onsets]

    times, values, errors = [], [], []
    for i in range(n):
        tt = (i + 1) * dt
        v = basal
        if drift_amp:
            v += drift_amp * math.sin(2 * math.pi * tt / drift_period)
        for onset, m in zip(onsets, masses):
            d = tt - onset
            if d >= 0:
                v += m * math.exp(-k * d)
        # assay CV rises as concentration falls toward the detection floor
        cv = cv_mid * (1.0 + cv_floor_conc / max(v, 1e-6))
        cv = min(cv, 0.35)
        sd = v * cv                      # the SD the assay REPORTS
        obs = max(v + rng.gauss(0.0, sd * noise_ratio), 0.0)   # actual noise is smaller
        times.append(round(tt, 4))
        values.append(round(obs, 5))
        errors.append(round(max(sd, 1e-4), 5))

    # onsets that produced a pulse inside the sampled window
    true_onsets = [round(o, 4) for o in onsets if 0 <= o <= n * dt]

    return {
        "times": times,
        "values": values,
        "errors": errors,
        "true_onsets": true_onsets,
        "params": {
            "half_life_min": round(half_life, 3),
            "sampling_min": dt,
            "n_points": n,
            "basal": round(basal, 5),
            "mean_ipi_min": round(mean_ipi, 3),
            "cv_mid": round(cv_mid, 4),
            "noise_ratio": round(noise_ratio, 3),
            "drift_amplitude": round(drift_amp, 5),
            "profile": profile,
            "n_true_pulses": len(true_onsets),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200, help="number of records")
    ap.add_argument("--seed", type=int, default=20260810)
    ap.add_argument("--profile", choices=["broad", "dense"], default="broad",
                    help="dense = shaped like Johnson's reference datasets")
    ap.add_argument("--out", default=str(ROOT / "data" / "benchmark"))
    args = ap.parse_args()

    out = Path(args.out)
    (out / "series").mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)

    truth = {}
    total_pulses = 0
    for i in range(args.n):
        rec = simulate(rng, args.profile)
        name = f"{i:04d}"
        with (out / "series" / f"{name}.csv").open("w") as f:
            f.write("# SIMULATED benchmark record — generated by tools/simulate_benchmark.py\n")
            f.write(f"# seed={args.seed} record={name}\n")
            f.write("time,value,error\n")
            for t, v, e in zip(rec["times"], rec["values"], rec["errors"]):
                f.write(f"{t},{v},{e}\n")
        truth[name] = {"true_onsets": rec["true_onsets"], "params": rec["params"]}
        total_pulses += len(rec["true_onsets"])

    with (out / "truth.json").open("w") as f:
        json.dump({"seed": args.seed, "records": truth}, f, indent=1)

    print(f"wrote {args.n} records, {total_pulses} true pulses -> {out}")
    print(f"  mean pulses/record: {total_pulses / args.n:.1f}")


if __name__ == "__main__":
    main()
