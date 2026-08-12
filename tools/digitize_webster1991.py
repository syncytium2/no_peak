"""Digitize the hormone traces from Webster et al. 1991, Figures 3 and 4.

    Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ. Role of the
    thyroid gland in seasonal reproduction. III. Thyroidectomy blocks seasonal
    suppression of gonadotropin-releasing hormone secretion in sheep.
    Endocrinology 1991;129(3):1635-43. PMID 1874193.

Used with the permission of one of the paper's authors. The article itself is
not open access and is not redistributed here; only the numerical values are,
which are measurements and carry no copyright of their own. See
docs/figure-data-permissions.md for the reasoning and its limits.

Why this dataset is worth the trouble: the figures mark, with an open circle,
every pulse the authors' own CLUSTER run identified. Digitizing them therefore
recovers a trace *and* that paper's own pulse call for it — an answer key this
project cannot manufacture, though it records what a detector reported rather
than what the animal secreted.

    python3 tools/digitize_webster1991.py path/to/webster1991.pdf

Requires pdfimages (poppler), numpy, pillow, scipy.

--- How the reading works -----------------------------------------------------

The scan is 400 dpi bitonal line art. Each panel is a boxed plot whose bottom
edge is the zero line, with ticks protruding left of the axis at even intervals.

Open circles are found as their enclosed white interiors: label the white
pixels, discard anything touching the panel border, and keep blobs that are the
right size, near-square and well filled. That rejects both the counters of
letters in the panel title and the tall thin gaps enclosed between the limbs of
a spike. The circles are drawn centered on their data point, so at those samples
the circle's center IS the value.

Everywhere else the value has to come off the polyline, and the trap there is
that a steep limb covers many rows within a single column. Sampled at a vertex's
exact x, the ink run reaches from the vertex away towards its neighbors: at a
local maximum the vertex is the TOP of the run, at a local minimum the BOTTOM.
Which applies is not known until the series is. Sampled halfway between two
vertices, though, the segment is straight and the run is symmetric about its
value, so midpoint readings are unbiased and equal (y_k + y_k+1) / 2. Choosing
top-or-bottom at every vertex so the implied midpoints best match the measured
ones is a shortest-path problem over two states per sample, solved exactly by
dynamic programming.

Every step that could fail silently is checked instead: the tick fit reports a
residual, the four GnRH panels must independently agree on their axis top, and
the number of circles found in each panel must equal the pulse count printed
inside that panel.
"""

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = Path(__file__).resolve().parent.parent / "data" / "digitized"

# ---- panel geometry, measured from the 400 dpi scan of page 5 ---------------
# box top/bottom/left/right in pixels, the y-axis minor tick interval, the
# number of samples, the sampling interval in minutes, and the pulse count
# printed in the panel (used as an assertion, not as an input).
PANELS = [
    dict(key="fig3a_con_8058_gnrh", top=1110, bottom=1584, left=1335.5, right=2120.5,
         minor=0.5, n=73, dt=5, pulses=0, unit="pg/min", hormone="GnRH",
         animal="8058", group="thyroid-intact control", panel="Fig 3A", cv=0.08, floor=0.06),
    dict(key="fig3a_con_8058_lh", top=403, bottom=1028, left=1332.0, right=2120.0,
         minor=5.0, n=61, dt=6, pulses=0, unit="ng/ml", hormone="LH",
         animal="8058", group="thyroid-intact control", panel="Fig 3A", cv=0.08, floor=0.45),
    dict(key="fig3b_thx_8067_gnrh", top=1113, bottom=1587, left=2340.5, right=3131.5,
         minor=0.5, n=73, dt=5, pulses=11, unit="pg/min", hormone="GnRH",
         animal="8067", group="thyroidectomized", panel="Fig 3B", cv=0.08, floor=0.06),
    dict(key="fig3b_thx_8067_lh", top=401, bottom=1029, left=2341.0, right=3125.0,
         minor=5.0, n=61, dt=6, pulses=11, unit="ng/ml", hormone="LH",
         animal="8067", group="thyroidectomized", panel="Fig 3B", cv=0.08, floor=0.45),
    dict(key="fig4a_thx_9013_gnrh", top=2958, bottom=3443, left=1347.0, right=2142.5,
         minor=0.5, n=73, dt=5, pulses=21, unit="pg/min", hormone="GnRH",
         animal="9013", group="thyroidectomized", panel="Fig 4A", cv=0.08, floor=0.06),
    dict(key="fig4a_thx_9013_lh", top=2243, bottom=2873, left=1349.5, right=2142.0,
         minor=5.0, n=61, dt=6, pulses=16, unit="ng/ml", hormone="LH",
         animal="9013", group="thyroidectomized", panel="Fig 4A", cv=0.08, floor=0.45),
    dict(key="fig4b_thx_9009_gnrh", top=2957, bottom=3442, left=2355.5, right=3146.5,
         minor=0.5, n=73, dt=5, pulses=0, unit="pg/min", hormone="GnRH",
         animal="9009", group="thyroidectomized", panel="Fig 4B", cv=0.08, floor=0.06),
    dict(key="fig4b_thx_9009_lh", top=2242, bottom=2870, left=2356.5, right=3144.5,
         minor=5.0, n=61, dt=6, pulses=11, unit="ng/ml", hormone="LH",
         animal="9009", group="thyroidectomized", panel="Fig 4B", cv=0.08, floor=0.45),
]

RING = dict(area=(140, 230), side=(11, 21), fill=0.60)


# ---- small helpers ----------------------------------------------------------

def _clusters(idx, gap=4):
    out = []
    if not len(idx):
        return out
    s = p = idx[0]
    for i in idx[1:]:
        if i - p > gap:
            out.append((s + p) / 2)
            s = i
        p = i
    out.append((s + p) / 2)
    return out


def _runs(col):
    ys = np.where(col)[0]
    out = []
    if not len(ys):
        return out
    s = p = ys[0]
    for y in ys[1:]:
        if y - p > 1:
            out.append((s, p))
            s = y
        p = y
    out.append((s, p))
    return out


# ---- axis calibration -------------------------------------------------------

def y_ticks(ink, top, bottom, left, floor=32):
    """Tick rows left of the axis, ignoring the corners and the zero line.

    The `floor` band holds the "0" tick, which the fit anchors on anyway, and in
    the pulse-free panels the flat baseline trace pressed against the axis,
    which would otherwise read as a tick and skew the scale.
    """
    band = ink[top + 8:bottom - floor, int(left) - 15:int(left) - 2]
    return _clusters(list(np.where(band.sum(1) >= 4)[0] + top + 8))


def even_ticks(ticks, tol=0.25):
    """Largest subset consistent with a single even spacing."""
    ts = sorted(ticks)
    if len(ts) < 3:
        return ts
    step = float(np.median(np.diff(ts)))
    keep = [ts[0]]
    for t in ts[1:]:
        k = round((t - keep[-1]) / step)
        if k >= 1 and abs((t - keep[-1]) / step - k) < tol:
            keep.append(t)
    return keep


def fit_y(bottom, ticks, minor):
    """value = scale * (bottom - y), anchored on the zero line.

    Ticks are evenly spaced by one minor interval but the topmost one is not
    always the same multiple, so every offset is tried and the one leaving the
    smallest residual wins. The residual is returned so a bad fit is visible
    rather than silent.
    """
    d = np.array(sorted(bottom - t for t in ticks), float)
    best = None
    for j0 in range(1, 12):
        v = (np.arange(len(d)) + j0) * minor
        scale = float((d * v).sum() / (d * d).sum())
        rel = float(np.sqrt((((scale * d) - v) ** 2).mean()) / max(v.max(), 1e-9))
        if best is None or rel < best[0]:
            best = (rel, scale)
    return best[1], best[0]


# ---- feature detection ------------------------------------------------------

def rings(ink, top, bottom, left, right):
    """Open pulse circles, located by their enclosed white interiors."""
    sub = ink[top:bottom, int(left) + 1:int(right)]
    lab, n = ndi.label(~sub)
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    out = []
    for i in range(1, n + 1):
        if i in border:
            continue
        ys, xs = np.where(lab == i)
        if not RING["area"][0] <= ys.size <= RING["area"][1]:
            continue
        h = int(ys.max() - ys.min()) + 1
        w = int(xs.max() - xs.min()) + 1
        if not (RING["side"][0] <= h <= RING["side"][1] and RING["side"][0] <= w <= RING["side"][1]):
            continue
        if ys.size / (h * w) < RING["fill"]:
            continue
        out.append((ys.mean() + top, xs.mean() + int(left) + 1))
    return sorted(out, key=lambda p: p[1])


def read_panel(ink, p, scale, ring_xy, ring_r=14):
    """Values at every sample, and the indices the paper marked as pulses."""
    T, B = p["top"], p["bottom"]
    L, R, n = p["left"], p["right"], p["n"]
    img = ink[T:B + 1, :].copy()
    img[:4, :] = False
    img[B - T - 3:, :] = False
    img[:, :int(L) + 4] = False
    img[:, int(R) - 3:] = False

    # Identify the trace BEFORE masking the rings: they touch the polyline, so
    # trace-plus-rings is one component spanning the panel, while masking first
    # would cut it into arcs no wider than the title's letters.
    lab, k = ndi.label(img)
    trace = np.zeros_like(img)
    if k:
        widths = [((np.where(lab == i)[1].max() - np.where(lab == i)[1].min()), i)
                  for i in range(1, k + 1)]
        trace = lab == max(widths)[1]
    for cy, cx in ring_xy:
        trace[max(0, int(cy - ring_r) - T):int(cy + ring_r) - T + 1,
              int(cx - ring_r):int(cx + ring_r) + 1] = False

    span = R - L
    at = lambda t: L + span * t / (n - 1)
    val = lambda ypix: (B - ypix) * scale

    pulse_at = {int(round((cx - L) / (span / (n - 1)))): val(cy) for cy, cx in ring_xy}

    def read(px):
        for dx in (0, -1, 1, -2, 2, -3, 3, -4, 4):
            rr = _runs(trace[:, int(round(px)) + dx])
            if rr:
                return min(r[0] for r in rr), max(r[1] for r in rr)
        return None

    cand = []
    for i in range(n):
        if i in pulse_at:
            cand.append([pulse_at[i]])
            continue
        r = read(at(i))
        cand.append([None] if r is None else sorted({val(r[0] + T), val(r[1] + T)}, reverse=True))

    mids = []
    for i in range(n - 1):
        r = read((at(i) + at(i + 1)) / 2)
        mids.append(None if r is None else val(T + (r[0] + r[1]) / 2))

    # shortest path: pick one candidate per sample, minimizing disagreement
    # between the implied midpoints and the measured ones
    prev = {j: 0.0 for j in range(len(cand[0]))}
    back = []
    for i in range(1, n):
        cur, bk = {}, {}
        for j, vj in enumerate(cand[i]):
            best, arg = float("inf"), 0
            for pj, cost in prev.items():
                vp = cand[i - 1][pj]
                c = cost if (vj is None or vp is None or mids[i - 1] is None) \
                    else cost + abs((vp + vj) / 2 - mids[i - 1])
                if c < best:
                    best, arg = c, pj
            cur[j], bk[j] = best, arg
        prev, _ = cur, back.append(bk)
    j = min(prev, key=prev.get)
    picks = [j]
    for bk in reversed(back):
        j = bk[j]
        picks.append(j)
    picks.reverse()

    values = [cand[i][picks[i]] for i in range(n)]
    # the endpoints sit on the frame, which was erased; carry the neighbor in
    for i in (0, n - 1):
        if values[i] is None:
            values[i] = values[1] if i == 0 else values[n - 2]
    return values, sorted(pulse_at)


# ---- main -------------------------------------------------------------------

def main(pdf):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdfimages", "-png", "-f", "5", "-l", "5", str(pdf), f"{tmp}/pg"],
                       check=True)
        png = sorted(Path(tmp).glob("pg*.png"))[0]
        ink = np.array(Image.open(png).convert("L")) < 128
    if ink.shape != (4454, 3343):
        sys.exit(f"unexpected scan size {ink.shape}; panel coordinates assume 4454x3343")

    OUT.mkdir(parents=True, exist_ok=True)
    tops, series, problems = {}, {}, []

    for p in PANELS:
        ticks = even_ticks(y_ticks(ink, p["top"], p["bottom"], p["left"]))
        scale, resid = fit_y(p["bottom"], ticks, p["minor"])
        top_value = scale * (p["bottom"] - p["top"])
        found = rings(ink, p["top"], p["bottom"], p["left"], p["right"])

        if resid > 0.02:
            problems.append(f"{p['key']}: axis fit residual {resid:.3f}")
        if len(found) != p["pulses"]:
            problems.append(f"{p['key']}: found {len(found)} circles, panel prints {p['pulses']}")

        values, pulse_idx = read_panel(ink, p, scale, found)
        series[p["key"]] = (p, values, pulse_idx)
        tops.setdefault(p["hormone"], []).append(top_value)
        print(f"{p['key']:24s} resid={resid:.4f} top={top_value:6.2f} {p['unit']:7s} "
              f"pulses={len(found):2d}/{p['pulses']:2d} "
              f"range {min(values):.2f}-{max(values):.2f}")

    # the four panels of each hormone are calibrated independently; if the axis
    # reading were wrong they would not agree on where the box top falls
    for hormone, vals in tops.items():
        spread = (max(vals) - min(vals)) / np.mean(vals)
        print(f"\n{hormone} box-top agreement across 4 panels: "
              f"{np.mean(vals):.2f} +/- {np.std(vals):.2f} (spread {spread:.1%})")
        if spread > 0.05:
            problems.append(f"{hormone}: panels disagree on the axis top by {spread:.1%}")

    if problems:
        print("\nPROBLEMS:")
        for p in problems:
            print("  -", p)
        sys.exit(1)

    write(series)
    print(f"\nwrote {len(series) + 1} files to {OUT}")


def write(series):
    banner = (
        "# DIGITIZED FROM A PUBLISHED FIGURE - not a raw laboratory record.\n"
        "# Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ.\n"
        "# Endocrinology 1991;129(3):1635-43. PMID 1874193. {panel}, ewe #{animal}\n"
        "# ({group}). {hormone} in {unit}, sampled every {dt} min for 6 h.\n"
        "# Values read off the printed trace by tools/digitize_webster1991.py and\n"
        "# are therefore approximate; they carry the figure's line width and the\n"
        "# scan's resolution as error. Used with an author's permission.\n"
        "# Pulses identified in the paper: {pulses} (see webster1991_pulses.csv).\n"
        "#\n"
        "# COLUMN 3 (error) IS RECONSTRUCTED, NOT DIGITIZED. The figure prints no\n"
        "# error bars, and the paper does not report what per-sample error it gave\n"
        "# CLUSTER. This column is max({floor:g}, {cv:g} x value) — an assay-shaped\n"
        "# error: a proportional term plus a floor at the detection limit. For LH\n"
        "# that floor is the assay sensitivity the paper reports; for GnRH it was\n"
        "# chosen to match the paper's own pulse calls, and is therefore fitted.\n"
        "# It is supplied so the published settings are reproducible in the app,\n"
        "# which needs a per-sample error the estimated models cannot stand in for.\n"
    )
    truth = ["# Pulses marked with an open circle in the published figures.",
             "# These are the authors' own CLUSTER calls, not ours.",
             "series,pulse_index,time_min,value"]
    for key, (p, values, pulse_idx) in series.items():
        with (OUT / f"webster1991_{key}.csv").open("w") as f:
            f.write(banner.format(**p))
            f.write("time,value,error\n")
            for i, v in enumerate(values):
                f.write(f"{i * p['dt']},{v:.3f},{max(p['floor'], p['cv'] * v):.4f}\n")
        for i in pulse_idx:
            truth.append(f"{key},{i},{i * p['dt']},{values[i]:.3f}")
    (OUT / "webster1991_pulses.csv").write_text("\n".join(truth) + "\n")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__.strip().splitlines()[0] + "\n\nusage: digitize_webster1991.py <pdf>")
    main(Path(sys.argv[1]).expanduser())
