"""Read Webster 1991 Figs 3-4 off the U-M library's print-volume scan.

**This is the extractor for data/digitized/.** It replaced
tools/digitize_webster1991.py on 2026-08-19, and the reason is provenance, not
accuracy: that tool reads the publisher's PDF, obtained through the library's
electronic subscription, and University counsel confirmed that a derived table
of values is "any part of the Publications" under the terms attached to that
copy. This one reads the Document Delivery scan of the bound volume, which was
obtained outside the subscription. See docs/figure-data-permissions.md.

    python3 tools/digitize_webster_print.py            # read and report
    python3 tools/digitize_webster_print.py --write    # regenerate the CSVs
    python3 tools/digitize_webster_print.py --json out.json

Run without --write it also diffs what it read against what is committed, which
is now a regeneration check: the committed CSVs should come back out of the scan
unchanged.

--- what the two readings said about each other ------------------------------

Before the replacement this file was an instrument rather than the extractor,
and the diff it printed was the only measurement of digitization accuracy this
project has ever had a way to make. The two readings shared no pixels: different
scan, different page decomposition, different panel geometry, an independently
solved axis, a different circle test. Recorded here because the comparison
cannot be run again once the committed files come from this side of it.

  - 68 of the paper's 70 marked pulses at identical sample indices; the other
    two each moved by one sample.
  - Median disagreement 0.8% of each record's range, 0.18 printed line widths,
    across the five records not at the figure's resolution limit.
  - The three flat records disagree by up to 1.2 line widths, which is what
    their own banner predicts rather than a new problem.

The 08-17 version of this file reported 1.5% and 0.26 line widths. The
difference is the axis calibration below, not a change in the scan.

--- why this is not just a --page flag ---------------------------------------

docs/figure-data-permissions.md expected re-extraction to cost a flag and a
re-measure. It costs more, because three things the licensed scan made easy are
harder here, all of them downstream of one fact: this scan is heavier-inked.

  1. pdfimages returns fragments. The scan stores p.1639 as 13 MRC layers and
     the base layer has the data traces stripped out of it, so the page has to
     be composited with pdftoppm.

  2. Ring interiors do not scale. The page is placed 1.36x larger, so a 400 dpi
     render is 1.36x the licensed scan and every length scales -- but the open
     pulse circles are drawn with heavier ink, so their enclosed white centres
     come out roughly the SAME area rather than 1.36^2 larger. Size alone then
     no longer separates a pulse ring from the counter of a letter in the panel
     title; they overlap. Rings are instead kept by whether the ink around them
     belongs to the trace, which a title letter never does. That is a stronger
     discriminator than size and it returns the printed pulse count exactly, in
     all five panels that have one.

  3. The tick marks are nearly swallowed. The axis line is thick enough here
     that the minor ticks protrude only two or three pixels past it, so the
     tool's fixed tick strip cannot see them. Ticks are found instead by
     protrusion RELATIVE to the axis line's own edge, the labelled ticks are
     taken as the deepest, and the scale is then solved by consensus -- first
     within a panel, then across the four panels that share an axis. That last
     step is the tool's own validator ("the four panels must agree on their
     axis top") used as a constraint rather than only as a check.

Everything else -- the polyline reader, the shortest path over line edges, the
flat-record rule -- is imported from tools/digitize_webster1991.py and used as
written, with only its pixel margins scaled.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, str(Path(__file__).resolve().parent))
import digitize_webster1991 as W

REPO = Path(__file__).resolve().parent.parent


def find_scan():
    """The library scan, by name, wherever Dropbox is mounted on this machine.

    Never a hardcoded path -- the two workstations and the laptop mount Dropbox
    in three different places. Same resolution as digitize_webster1991.find_pdf,
    but it must pick the LIBRARY scan out of a folder that also holds the
    licensed one, which is the whole point of this tool.
    """
    env = os.environ.get("WEBSTER_PRINT_PDF")
    if env:
        return Path(env).expanduser()
    from data_root import dropbox_member_root
    member = dropbox_member_root()
    if member is None:
        sys.exit("could not locate Dropbox; set $WEBSTER_PRINT_PDF")
    hits = [q for q in (member / "nopeak").glob("*.pdf")
            if "library" in q.name.lower() and "webster" in q.name.lower()]
    if len(hits) != 1:
        sys.exit(f"expected exactly one library scan in {member/'nopeak'}, found "
                 f"{len(hits)}; set $WEBSTER_PRINT_PDF")
    return hits[0]
PAGE = 6            # p.1639; the library's copyright cover page shifts it by one
DPI = 400           # native-ish: the page is placed 1.36x, so this is ~490 dpi of paper

# Aiming coordinates only; every edge is snapped to the rule actually on the page.
ANCHOR = {"Fig 3": ((400, 483), (2058, 2733)), "Fig 4": ((2243, 2988), (3926, 5264))}
XCOL = {("Fig 3", "L"): ((1332, 1610), (2120, 2694)),
        ("Fig 3", "R"): ((2341, 2985), (3131, 4033)),
        ("Fig 4", "L"): ((1348, 1650), (2142, 2740)),
        ("Fig 4", "R"): ((2356, 3030), (3146, 4086))}

RING_AREA, RING_SIDE, RING_FILL = (170, 400), (14, 25), 0.65


def render(dpi):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-gray", "-f", str(PAGE), "-l",
                        str(PAGE), "-png", str(find_scan()), f"{tmp}/pg"], check=True)
        return np.array(Image.open(sorted(Path(tmp).glob("pg*.png"))[0])
                        .convert("L")) < 128


def _longest(idx):
    if not len(idx):
        return 0
    d = np.diff(idx); brk = np.flatnonzero(d > 2)
    s = np.r_[idx[0], idx[brk + 1]]; e = np.r_[idx[brk], idx[-1]]
    return int((e - s + 1).max())


def _group(hits, gap=3):
    groups, cur = [], [hits[0]]
    for v in hits[1:]:
        if v - cur[-1] <= gap:
            cur.append(v)
        else:
            groups.append(cur); cur = [v]
    groups.append(cur)
    return groups


def hrule(ink, y0, y1, x0, x1, minfrac=0.75):
    need = minfrac * (x1 - x0)
    hits = [y for y in range(max(0, y0), min(ink.shape[0], y1))
            if _longest(np.flatnonzero(ink[y, x0:x1])) >= need]
    if not hits:
        return None
    g = max(_group(hits), key=len)
    return min(g), max(g)


def vrule_edges(ink, x0, x1, y0, y1, minfrac=0.40):
    """Outer edges of the first and last vertical rules in the band.

    The threshold is low on purpose: the axis is the same physical line as in
    the licensed scan but its edges are fuzzy over ~9 px here, and its outer
    edge is the one place that means the same thing in both scans.
    """
    need = minfrac * (y1 - y0)
    hits = [x for x in range(max(0, x0), min(ink.shape[1], x1))
            if _longest(np.flatnonzero(ink[y0:y1, x])) >= need]
    if not hits:
        return None, None
    g = _group(hits)
    return min(g[0]) + 1, max(g[-1]) - 1


def _thick_cols(ink, x, y0, y1, minfrac=0.40):
    """Width of the vertical rule that column `x` sits in."""
    need = minfrac * (y1 - y0)
    w = 0
    for d in range(-14, 15):
        c = int(x) + d
        if 0 <= c < ink.shape[1] and _longest(np.flatnonzero(ink[y0:y1, c])) >= need:
            w += 1
    return w


def affine(pair):
    (a0, b0), (a1, b1) = pair
    return lambda v: b0 + (v - a0) * (b1 - b0) / (a1 - a0)


def build_panels(ink):
    out = []
    for old in W.PANELS:
        fig, col = old["panel"][:5], ("R" if old["panel"].endswith("B") else "L")
        fy, fx = affine(ANCHOR[fig]), affine(XCOL[(fig, col)])
        pt, pb = int(round(fy(old["top"]))), int(round(fy(old["bottom"])))
        pl, pr = int(round(fx(old["left"]))), int(round(fx(old["right"])))
        gt = hrule(ink, pt - 25, pt + 25, pl + 30, pr - 30)
        gb = hrule(ink, pb - 25, pb + 25, pl + 30, pr - 30)
        top = pt if gt is None else gt[0]
        # The bottom frame IS the zero line, and where a flat trace lies on it
        # the two merge into one band whose first row is the trace. Both frames
        # are printed at one weight, so measure thickness on the top frame --
        # where nothing can merge with it -- and step back that far from the
        # bottom of the band.
        if gb is None:
            bot = pb
        else:
            thick = (gt[1] - gt[0] + 1) if gt else 5
            bot = max(gb[0], gb[1] - thick + 1)
        li, _ = vrule_edges(ink, pl - 25, pl + 25, top + 25, bot - 25)
        _, ri = vrule_edges(ink, pr - 30, pr + 30, top + 25, bot - 25)
        # Erase margins are measured, not scaled. This scan's rules are heavier
        # than the licensed scan's and vary panel to panel; one pixel short and
        # rule ink survives, and rule ink spans the whole panel, so the reader
        # selects it AS the trace and the record tops out at the box top.
        #
        # The horizontal and vertical rules are measured separately -- the
        # verticals are the heavier of the two here -- and the bottom is treated
        # apart from the rest, because the flat traces lie directly on the zero
        # line and an over-generous erase there deletes the record instead of
        # the frame.
        L0 = pl if li is None else li
        R0 = pr if ri is None else ri
        vt = max(_thick_cols(ink, L0, top + 25, bot - 25),
                 _thick_cols(ink, R0, top + 25, bot - 25))
        ht = (gt[1] - gt[0] + 1) if gt else 0
        out.append(dict(old, top=top, bottom=bot,
                        m_t=max(ht, 5) + 2, m_b=4, m_x=max(vt, 6) + 2,
                        left=float(L0), right=float(R0)))
    return out


# ---- axis scale --------------------------------------------------------------

def tick_rows(ink, top, bottom, left, look=34, gap=6, frac=0.0):
    """Every tick row, found by protrusion past the axis line's own edge.

    Absolute length cannot be used here: this scan's axis is thick enough that
    a minor tick clears it by only two or three pixels. Protrusion relative to
    the line's own edge is the same measurement the eye makes and survives that.

    Keep the minor ticks as well as the labelled ones. They cost nothing -- the
    vote below tolerates strays -- and they are what breaks the aliasing on the
    LH axis, whose labelled ticks at 10 and 20 are both even multiples of the
    5-unit step and so fit a halved scale exactly as well. The ticks at 5 and 15
    do not, and that is the whole disambiguation.
    """
    L = int(left)
    sl = ink[top:bottom, L - look:L + 6]
    xl = np.array([(np.flatnonzero(r).min() if r.any() else 10 ** 6) for r in sl])
    real = xl[xl < 10 ** 6]
    if not len(real):
        return []
    base = int(np.bincount(real).argmax())
    depth = np.where(xl < 10 ** 6, base - xl, -1)
    hit = np.flatnonzero(depth >= 3)
    if not len(hit):
        return []
    cl = [((min(g) + max(g)) / 2 + top, int(depth[min(g):max(g) + 1].max()))
          for g in _group(list(hit), gap)]
    dmax = max(d for _, d in cl)
    return [y for y, d in cl if d >= frac * dmax]


def tick_depths(ink, top, bottom, left, look=34, gap=6):
    """Every tick as (row, protrusion depth), the row taken at full protrusion.

    Same measurement as `tick_rows`, keeping the depth and centring the row on
    the rows that actually reach the tick's own maximum rather than on the whole
    detected group. A heavy scan frays the far end of a tick; the frayed rows
    are shallower, so they drag a group's midpoint but not this one.
    """
    L = int(left)
    sl = ink[top:bottom, L - look:L + 6]
    xl = np.array([(np.flatnonzero(r).min() if r.any() else 10 ** 6) for r in sl])
    real = xl[xl < 10 ** 6]
    if not len(real):
        return []
    base = int(np.bincount(real).argmax())
    depth = np.where(xl < 10 ** 6, base - xl, -1)
    hit = np.flatnonzero(depth >= 3)
    if not len(hit):
        return []
    out = []
    for g in _group(list(hit), gap):
        seg = depth[min(g):max(g) + 1]
        d = int(seg.max())
        core = np.flatnonzero(seg >= d - 2) + min(g)
        out.append(((core.min() + core.max()) / 2 + top, d))
    return out


# A labelled tick protrudes about five times as far as a minor one (33-35 px
# against 3-9 on this scan), so this threshold sits in a wide gap rather than
# being tuned. The label digits are ~74 px clear of the axis and outside the
# 34 px detection band, so they are not what is being measured.
LABELLED_FRAC = 0.70


def calibrate(ink, p):
    """Scale and zero row for one panel, from its labelled ticks alone.

    ⚠ **Calibrate per panel. Figures 3 and 4 are printed at different
    reductions** -- Fig. 4's boxes are about 2% taller than Fig. 3's on the same
    page, and its axes are scaled to match. An earlier version of this file fit
    ONE lattice period across all four panels of a hormone, on the reasoning
    that they share one printed axis. They do not: they share one *design*, laid
    out twice at different sizes. That fit returned a compromise between the two
    figures and was the whole of the systematic ~2% disagreement with the
    licensed-scan reading. Per-panel calibration removes it and brings the four
    panels' implied axis tops from a 3% spread onto 3.00 pg/min.

    The minor ticks are not used. They clear this scan's heavy axis by two or
    three pixels, and a lattice vote over them moved the two hormones in
    opposite directions by up to 2% -- noise, not a bias worth correcting. The
    labelled ticks are unambiguous, and zero-to-top is four minor intervals, so
    the baseline is four times longer than any single gap.
    """
    rows = tick_depths(ink, p["top"] - 40, p["bottom"] + 40, p["left"])
    if not rows:
        return None
    dmax = max(d for _, d in rows)
    lab = sorted((y for y, d in rows if d >= LABELLED_FRAC * dmax), reverse=True)
    step = 2 * p["minor"]                      # labelled every second minor
    if len(lab) != 3:
        return dict(scale=None, zero=None, n=len(lab), resid=None, step=step)
    # rows run downwards, values upwards: row = zero - value * px_per_unit
    v = np.array([0.0, step, 2 * step])
    r = np.array(lab, dtype=float)
    A = np.column_stack([np.ones(3), -v])
    (zero, per_unit), *_ = np.linalg.lstsq(A, r, rcond=None)
    resid = float(np.max(np.abs(A @ np.array([zero, per_unit]) - r)))
    return dict(scale=float(1.0 / per_unit), zero=float(zero), n=3,
                resid=resid, step=step, per_unit=float(per_unit))


def solve_scales(ink, panels):
    """Per-panel scale, with the axis top pooled across the panels that share it.

    Two measurements are available and they are not equally good. A panel's box
    height is a distance between two long straight rules, good to about a pixel
    in 650. The gap between labelled ticks is 210 px measured between features
    whose rows this scan reports to about +/-3, so 1.5% -- and the four panels
    of one hormone duly disagree by 2-3% on it, which is more than the printed
    page can actually differ.

    So use each for what it is good at. The ticks fix ONE number per hormone,
    the value at the box top, which every panel of that hormone shares because
    they are the same axis drawn at different sizes. The box height then carries
    the per-panel size. Pooling four noisy tick estimates into one shared
    constant and reading the rest off the geometry beats trusting any single
    panel's ticks.

    This does not assume a round number anywhere. GnRH comes out at 3.02 +/-
    0.03 pg/min, which is consistent with a designed 3.00 and is not snapped to
    it; LH comes out near 31.3 ng/ml, which is no round number at all -- the box
    top simply is not on a gridline there.
    """
    out, report, tops = {}, {}, {}
    for p in panels:
        c = calibrate(ink, p)
        report[p["key"]] = c
        if c and c["scale"] is not None:
            height = p["bottom"] - p["top"]
            c["top_from_ticks"] = height / c["per_unit"]
            tops.setdefault(p["hormone"], []).append(c["top_from_ticks"])
    pooled = {h: float(np.mean(v)) for h, v in tops.items()}
    for p in panels:
        c = report[p["key"]]
        if c and c["scale"] is not None and p["hormone"] in pooled:
            c = dict(c)
            c["axis_top"] = pooled[p["hormone"]]
            c["scale"] = c["axis_top"] / (p["bottom"] - p["top"])
            report[p["key"]] = c
        out[p["key"]] = c
    return out, report, pooled


# ---- rings -------------------------------------------------------------------

def trace_mask(ink, p):
    T, B, L, R = p["top"], p["bottom"], int(p["left"]), int(p["right"])
    img = ink[T:B + 1, :].copy()
    img[:p["m_t"], :] = False; img[B - T - p["m_b"]:, :] = False
    img[:, :L + p["m_x"]] = False; img[:, R - p["m_x"]:] = False
    lab, k = ndi.label(img)
    if not k:
        return np.zeros_like(img)
    w = [((np.where(lab == i)[1].max() - np.where(lab == i)[1].min()), i)
         for i in range(1, k + 1)]
    return lab == max(w)[1]


def rings(ink, p):
    """Open pulse circles: enclosed white centres whose ink sits on the trace.

    The licensed scan could keep them on size alone. Here the heavier ink has
    shrunk the centres until they overlap the counters of the title's letters,
    so the test is instead whether the blob's surrounding ink belongs to the
    trace component. A title letter is never on the trace.
    """
    T, B, L, R = p["top"], p["bottom"], int(p["left"]), int(p["right"])
    tm = trace_mask(ink, p)
    sub = ink[T:B, L + 1:R]
    lab, n = ndi.label(~sub)
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    out = []
    for i in range(1, n + 1):
        if i in border:
            continue
        ys, xs = np.where(lab == i)
        if not RING_AREA[0] <= ys.size <= RING_AREA[1]:
            continue
        h = int(ys.max() - ys.min()) + 1
        w = int(xs.max() - xs.min()) + 1
        if not (RING_SIDE[0] <= h <= RING_SIDE[1] and RING_SIDE[0] <= w <= RING_SIDE[1]):
            continue
        if ys.size / (h * w) < RING_FILL:
            continue
        cy, cx = ys.mean() + T, xs.mean() + L + 1
        r = int(max(h, w) * 1.1)
        if tm[max(0, int(cy - r) - T):int(cy + r) - T + 1,
              max(0, int(cx - r)):int(cx + r) + 1].sum() == 0:
            continue
        out.append((cy, cx))
    return sorted(out, key=lambda q: q[1])


# ---- reader (tools/digitize_webster1991.py:read_panel, margins scaled) --------

def read_panel(ink, p, scale, ring_xy, s, ring_r):
    T, B, L, R, n = p["top"], p["bottom"], p["left"], p["right"], p["n"]
    m_t, m_b, m_x = p["m_t"], p["m_b"], p["m_x"]
    img = ink[T:B + 1, :].copy()
    img[:m_t, :] = False
    img[B - T - m_b:, :] = False
    img[:, :int(L) + m_x] = False
    img[:, int(R) - m_x:] = False

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
    # Zero comes from the labelled ticks, not from the frame. The frame's bottom
    # rule is the zero line, but it is drawn heavily enough here that which of
    # its rows counts as "the line" moves the whole record by a few tenths of a
    # percent; the tick fit measures the same quantity with a 4x longer lever.
    zero = p.get("zero") or B
    val = lambda ypix: (zero - ypix) * scale
    pulse_at = {int(round((cx - L) / (span / (n - 1)))): val(cy) for cy, cx in ring_xy}
    # How far sideways a sample may be read when its own column carries no ink.
    # The licensed-scan reader searched +/-4 px at 400 dpi; scaled here that is
    # +/-5. That is not always enough: this scan's pulse circles are erased by a
    # fixed radius that, at LH's ~18 px sample spacing, can swallow the whole
    # neighbourhood of the sample NEXT to a pulse. Widening the search to half a
    # sample interval recovers those from the trace either side, and cannot
    # wander further than half a sample by construction.
    reach = max(int(round(4 * s)), int(round(0.5 * span / (n - 1))))
    offsets = [0] + [d for k2 in range(1, reach + 1) for d in (-k2, k2)]

    def read(px):
        for dx in offsets:
            rr = W._runs(trace[:, int(round(px)) + dx])
            if rr:
                return min(r[0] for r in rr), max(r[1] for r in rr)
        return None

    at_sample = [None if i in pulse_at else read(at(i)) for i in range(n)]
    sample_mid = [None if r is None else val(T + (r[0] + r[1]) / 2) for r in at_sample]
    heights = [val(r[0] + T) - val(r[1] + T) for r in at_sample if r is not None]
    seen = [m for m in sample_mid if m is not None] + list(pulse_at.values())
    span_v = (max(seen) - min(seen)) if seen else 0.0
    flat = bool(heights) and span_v > 0 and float(np.median(heights)) >= W.FLAT_RATIO * span_v

    cand = []
    for i in range(n):
        if i in pulse_at:
            cand.append([pulse_at[i]])
        elif at_sample[i] is None:
            cand.append([None])
        elif flat:
            cand.append([sample_mid[i]])
        else:
            r = at_sample[i]
            cand.append(sorted({val(r[0] + T), val(r[1] + T)}, reverse=True))

    mids = [None if (r := read((at(i) + at(i + 1)) / 2)) is None
            else val(T + (r[0] + r[1]) / 2) for i in range(n - 1)]

    prev, back = {j: 0.0 for j in range(len(cand[0]))}, []
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
        j = bk[j]; picks.append(j)
    picks.reverse()
    values = [cand[i][picks[i]] for i in range(n)]
    for i in (0, n - 1):
        if values[i] is None:
            values[i] = values[1] if i == 0 else values[n - 2]
    lw = float(np.median(heights)) if heights else 0.0
    return values, sorted(pulse_at), flat, lw


def read_csv(path):
    t, v = [], []
    for line in path.read_text().splitlines():
        if line.startswith("#") or line.startswith("time"):
            continue
        a, b, _ = line.split(",")
        t.append(float(a)); v.append(float(b))
    return np.array(t), np.array(v)


def compare(new):
    meta = {p["key"]: p for p in W.PANELS}

    print(f"{'record':24s} {'n':>3s} {'unit':7s} {'range':>13s} "
          f"{'median|d|':>9s} {'p90':>7s} {'max':>7s} {'%range':>7s} {'d/line':>7s}")
    print("-" * 96)
    rows, pulse_rows = [], []
    for key, rec in new.items():
        p = meta[key]
        _, old_v = read_csv(REPO / "data" / "digitized" / f"webster1991_{key}.csv")
        nv = np.array([np.nan if v is None else v for v in rec["values"]], float)
        ok = ~np.isnan(nv)
        d = np.abs(nv[ok] - old_v[ok])
        rng = float(old_v.max() - old_v.min())
        lw = rec["line_width"] or np.nan
        rows.append((key, p, d, rng, lw, rec, old_v, nv, ok))
        print(f"{key:24s} {ok.sum():3d} {p['unit']:7s} "
              f"{old_v.min():5.2f}-{old_v.max():6.2f} "
              f"{np.median(d):9.3f} {np.percentile(d, 90):7.3f} {d.max():7.3f} "
              f"{100 * np.median(d) / rng:6.1f}% {np.median(d) / lw:6.2f}")

    print("\n\nPULSE CALLS -- the paper's own CLUSTER marks, found independently")
    print("-" * 96)
    for key, p, *_ , rec, old_v, nv, ok in [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8]) for r in rows]:
        if not p["pulses"]:
            continue
        truth = REPO / "data" / "digitized" / "webster1991_pulses.csv"
        old_idx = sorted(int(l.split(",")[1]) for l in truth.read_text().splitlines()
                         if l.startswith(key + ","))
        new_idx = sorted(rec["pulses"])
        same = old_idx == new_idx
        off = [b - a for a, b in zip(old_idx, new_idx)] if len(old_idx) == len(new_idx) else None
        print(f"{key:24s} {len(old_idx):2d} marks  "
              f"{'IDENTICAL' if same else 'differ'}"
              f"{'' if same else f'  old={old_idx}  new={new_idx}'}"
              f"{'' if not off or same else f'  shifts={off}'}")

    print("\n\nSUMMARY")
    print("-" * 96)
    allrel, alllw = [], []
    for key, p, d, rng, lw, rec, old_v, nv, ok in rows:
        allrel.append(np.median(d) / rng)
        alllw.append(np.median(d) / lw)
    print(f"median disagreement, as a share of each record's range: "
          f"{100 * np.median(allrel):.1f}%  (worst {100 * max(allrel):.1f}%)")
    print(f"median disagreement, in printed line widths:            "
          f"{np.median(alllw):.2f}   (worst {max(alllw):.2f})")

    nonflat = [r for r in rows if not r[5]["flat"]]
    if nonflat:
        rel = [np.median(r[2]) / r[3] for r in nonflat]
        lwv = [np.median(r[2]) / r[4] for r in nonflat]
        print(f"\nexcluding the three records already flagged as being at the "
              f"figure's resolution limit:")
        print(f"  {len(nonflat)} records, median {100 * np.median(rel):.1f}% of range, "
              f"{np.median(lwv):.2f} line widths (worst {max(lwv):.2f})")



# ---- main --------------------------------------------------------------------

def main():
    ink = render(DPI)
    panels = build_panels(ink)
    s = float(np.mean([(p["right"] - p["left"]) / (o["right"] - o["left"])
                       for p, o in zip(panels, W.PANELS)]))
    m = int(round(4 * s))
    print(f"rendered p.{PAGE} at {DPI} dpi -> {ink.shape[1]}x{ink.shape[0]}")
    print(f"panel boxes are {s:.4f}x the licensed scan; ~{DPI * s:.0f} dpi of paper\n")

    cal, report, pooled = solve_scales(ink, panels)
    for k in sorted(report):
        c = report[k]
        if c is None or c["scale"] is None:
            print(f"  !! {k}: {0 if c is None else c['n']} labelled ticks found, expected 3")
            continue
        print(f"{k:24s} ticks: {c['per_unit']:7.2f} px per unit "
              f"(resid {c['resid']:.1f} px) -> box top {c['top_from_ticks']:7.3f}")
    # Pooling makes "the four panels agree on the axis top" true by
    # construction, so the check moves to where it still means something: the
    # four INDEPENDENT tick-derived tops, before they are pooled. That is the
    # digitizer's own validator, applied to the last quantity each panel still
    # measures on its own.
    pre_spread = {}
    for h, v in sorted(pooled.items()):
        spread = [c["top_from_ticks"] for k, c in report.items()
                  if c and c.get("top_from_ticks")
                  and next(p for p in panels if p["key"] == k)["hormone"] == h]
        pre_spread[h] = (max(spread) - min(spread)) / v
        print(f"{h:5s} axis top pooled over {len(spread)} panels: {v:.3f} "
              f"+/- {np.std(spread):.3f} ({pre_spread[h]:.1%} spread before pooling)")
    print()

    tops, series, problems = {}, {}, []
    for p in panels:
        c = cal[p["key"]]
        if c is None or c["scale"] is None:
            problems.append(f"{p['key']}: axis calibration failed "
                            f"({0 if c is None else c['n']} labelled ticks, expected 3)")
            continue
        scale = c["scale"]
        # Scale comes from the labelled ticks; ZERO DOES NOT. The bottom frame
        # rule is the zero line by the figure's own design, and `build_panels`
        # already derives it carefully -- measuring the rule's weight on the top
        # frame, where nothing can merge with it, and stepping back that far.
        # The tick fit's intercept lands on the rule's centre instead, half a
        # rule-weight lower, which is invisible on a record ranging to 2 pg/min
        # and moves a flat record sitting on the axis by half its whole range.
        # Tried both against the independent licensed-scan reading: frame zero
        # agrees to 0.17 printed line widths, tick zero to 0.21, and the worst
        # record goes from 1.24 line widths to 2.49. Design convention wins.
        if c["resid"] > 6.0:
            problems.append(f"{p['key']}: labelled ticks are {c['resid']:.1f} px "
                            f"off a straight line")
        top_value = scale * (p["bottom"] - p["top"])
        found = rings(ink, p)
        if len(found) != p["pulses"]:
            problems.append(f"{p['key']}: found {len(found)} circles, "
                            f"panel prints {p['pulses']}")
        values, pulse_idx, flat, lw = read_panel(ink, p, scale, found, s,
                                                 int(round(14 * s)))
        series[p["key"]] = dict(values=[None if v is None else float(v) for v in values],
                                pulses=[int(i) for i in pulse_idx], flat=bool(flat),
                                top_value=float(top_value), n_rings=len(found),
                                line_width=lw, scale=float(scale),
                                box=[int(p["top"]), int(p["bottom"]),
                                     float(p["left"]), float(p["right"])])
        tops.setdefault(p["hormone"], []).append(top_value)
        vv = [v for v in values if v is not None]
        print(f"{p['key']:24s} top={top_value:6.2f} {p['unit']:7s} "
              f"rings={len(found):2d}/{p['pulses']:2d} "
              f"range {min(vv):.2f}-{max(vv):.2f}"
              f"{f'  {values.count(None)} UNREAD' if None in values else ''}"
              f"{'  FLAT' if flat else ''}")

    for hormone in sorted(pre_spread):
        # Not the pooled tops -- those agree by construction and check nothing.
        print(f"\n{hormone} independent tick-derived tops agree to "
              f"{pre_spread[hormone]:.1%} across 4 panels")
        if pre_spread[hormone] > 0.05:
            problems.append(f"{hormone}: the four panels' own tick calibrations "
                            f"disagree on the axis top by {pre_spread[hormone]:.1%}, "
                            f"which is more than the page can differ")

    print("\nPROBLEMS:" if problems else "\nall validators pass")
    for q in problems:
        print("  -", q)
    if "--json" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps(series, indent=1))
        print(f"wrote {out}")
    print()

    if "--write" in sys.argv:
        if problems:
            print("refusing to write with validators failing")
            return 1
        n = write(panels, series)
        print(f"wrote {n} files to {W.OUT}")
        return 0

    compare(series)
    return 1 if problems else 0


BANNER = (
    "# DIGITIZED FROM A PUBLISHED FIGURE - not a raw laboratory record.\n"
    "# Webster JR, Moenter SM, Barrell GK, Lehman MN, Karsch FJ.\n"
    "# Endocrinology 1991;129(3):1635-43. PMID 1874193. {panel}, ewe #{animal}\n"
    "# ({group}). {hormone} in {unit}, sampled every {dt} min for 6 h.\n"
    "#\n"
    "# SOURCE: the University of Michigan library's scan of the bound PRINT\n"
    "# volume (Endocrinology v.129 1991 Sep), supplied by Document Delivery and\n"
    "# obtained outside the publisher's electronic subscription. Read by\n"
    "# tools/digitize_webster_print.py. This replaced a reading of the\n"
    "# publisher's PDF on 2026-08-19; see docs/figure-data-permissions.md for\n"
    "# why the source of the copy is the whole point.\n"
    "#\n"
    "# Values are approximate: they carry the figure's printed line width and\n"
    "# the scan's resolution as error. The article is not redistributed - only\n"
    "# these numbers, which are measurements. See data/digitized/README.md.\n"
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

FLAT_NOTE = (
    "#\n"
    "# ⚠ THIS RECORD IS AT THE FIGURE'S RESOLUTION LIMIT. Its entire data range\n"
    "# is comparable to the printed line's own thickness, so the trace carries no\n"
    "# information about where within that line the value falls. Every sample is\n"
    "# therefore the midpoint of the ink run, not a reading of one of its edges.\n"
    "# Treat the LEVEL as measured and the sample-to-sample VARIATION as absent:\n"
    "# it is a flat trace, and any pulse analysis run on it is analyzing line\n"
    "# width. Until 2026-08-15 this file instead alternated between the two edges\n"
    "# of the line, which produced a regular sawtooth that looked like data.\n"
)

TRUTH_HEAD = [
    "# Pulses marked with an open circle in the published figures.",
    "# These are the authors' own CLUSTER calls, not ours.",
    "# Read off the U-M library's print-volume scan by",
    "# tools/digitize_webster_print.py -- see any series file for the provenance.",
    "series,pulse_index,time_min,value",
]


# The GnRH error floor is FITTED, not published, and it had to be re-fitted for
# this reading. The criterion is the one docs/validation-status.md already sets
# out: sweep it with the CV and take the joint optimum of sensitivity and
# precision against the paper's own 70 marked pulses.
#
# Against the licensed-PDF reading that optimum was 0.06 pg/min, pinned from
# above because sensitivity FELL past it (96% to 0.06, then 94%, then 91%).
# Against this reading sensitivity does not fall at all across 0.03-0.10, so
# that upper pin is gone, and the optimum is set by precision alone: extras run
# 2-3 at 0.03, 1 at 0.04-0.06, and 0 from 0.07 up. 0.07 is the low edge of the
# zero-extra plateau, chosen the same way 0.06 was.
#
# At cv = 0.08, floor = 0.07: 68 of 70 published pulses matched, 0 false
# positives -- 97% sensitivity, 100% precision.
#
# ⚠ This is the one number here that was tuned, and moving it moves the third
# column of every GnRH file. It is recorded in the file headers as fitted, and
# it must not be nudged to make a particular record come out at a particular
# count. It moved because the data changed source, and it was re-fitted by
# sweeping, not by aiming.
FITTED_FLOOR = {"GnRH": 0.07}


def write(panels, series):
    """Regenerate data/digitized/ from this reading.

    Same format and the same reconstructed error column as the reading it
    replaces, so nothing downstream has to change shape. What changes is the
    numbers, the fitted GnRH floor, and the source line above them.
    """
    W.OUT.mkdir(parents=True, exist_ok=True)
    truth = list(TRUTH_HEAD)
    n = 0
    for p in panels:
        s = series.get(p["key"])
        if s is None:
            continue
        values = s["values"]
        if any(v is None for v in values):
            raise SystemExit(f"{p['key']}: unread samples, refusing to write")
        floor = FITTED_FLOOR.get(p["hormone"], p["floor"])
        with (W.OUT / f"webster1991_{p['key']}.csv").open("w") as f:
            f.write(BANNER.format(**dict(p, floor=floor)))
            if s["flat"]:
                f.write(FLAT_NOTE)
            f.write("time,value,error\n")
            for i, v in enumerate(values):
                f.write(f"{i * p['dt']},{v:.3f},{max(floor, p['cv'] * v):.4f}\n")
        n += 1
        for i in s["pulses"]:
            truth.append(f"{p['key']},{i},{i * p['dt']},{values[i]:.3f}")
    (W.OUT / "webster1991_pulses.csv").write_text("\n".join(truth) + "\n")
    return n + 1


if __name__ == "__main__":
    sys.exit(main())
