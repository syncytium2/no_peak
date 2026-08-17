"""Independent second extraction of Webster 1991 Figs 3-4 from the U-M library
print-volume scan, for comparison against the committed PDF-derived CSVs.

**Writes nothing to data/digitized/.** This is an instrument for measuring how
well the digitization holds up, not a re-extraction: docs/figure-data-permissions.md
holds re-extraction until counsel answers, and nothing here anticipates that.

    python3 tools/crosscheck_webster_print.py [--json out.json]

The two readings share no pixels -- different scan, different page
decomposition, different panel geometry, an independently solved axis, a
different circle test -- so the spread between them measures digitization
accuracy, which is the only way this project has ever had to measure it.

As of 2026-08-17 it reports: 70 of the paper's 72 marked pulses at identical
sample indices, and a median disagreement of 0.26 printed line widths across the
five records not already flagged as being at the figure's resolution limit.

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


major_ticks = tick_rows          # name kept where it is called


def fit_lattice(panels, ticks, lo=45.0, hi=260.0, tol=0.13):
    """Pixels per minor interval, as the tick lattice's own period.

    The figure prints a tick at every minor interval measured up from the zero
    line, so the ticks lie on a lattice anchored at the axis. Sweeping the
    period and counting how many ticks fall on it measures that lattice
    directly, which is what the gaps between adjacent ticks only approximate --
    a tick detected twice, or a stray, puts a short gap into the set and drags
    a median estimate down, while it merely fails to score here.

    Ties go to the LARGEST period. Half a period also passes through every tick
    and so always ties on count; the true one is the coarsest lattice that still
    explains them.

    The four panels of a hormone share one printed axis -- all four GnRH records
    are portal GnRH on 0-1-2, all four LH records presampling LH on 0-10-20 --
    so their ticks are scored against one period, which is both steadier than
    any single panel and the honest model of the page.
    """
    best = None
    u = lo
    while u <= hi:
        hits = 0
        for p in panels:
            for t in ticks[p["key"]]:
                d = (p["bottom"] - t) / u
                if d > 0.5 and abs(d - round(d)) < tol:
                    hits += 1
        if best is None or (hits, u) > (best[0], best[1]):
            best = (hits, u)
        u += 0.1
    return best[1], best[0]


def solve_scales(panels, ticks):
    out, report = {}, {}
    for hormone in {p["hormone"] for p in panels}:
        grp = [p for p in panels if p["hormone"] == hormone]
        u, hits = fit_lattice(grp, ticks)
        total = sum(len(ticks[p["key"]]) for p in grp)
        for p in grp:
            out[p["key"]] = grp[0]["minor"] / u
        report[hormone] = (u, hits, total)
    return out, report


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
    val = lambda ypix: (B - ypix) * scale
    pulse_at = {int(round((cx - L) / (span / (n - 1)))): val(cy) for cy, cx in ring_xy}
    offsets = [0] + [d for k2 in range(1, int(round(4 * s)) + 1) for d in (-k2, k2)]

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

    ticks = {p["key"]: tick_rows(ink, p["top"] + 12, p["bottom"] - 18, p["left"])
             for p in panels}
    for k, t in ticks.items():
        if len(t) < 2:
            print(f"  !! {k}: {len(t)} ticks found")
    scales, report = solve_scales(panels, ticks)
    for h, (u, hits, total) in sorted(report.items()):
        print(f"{h:5s} axis: {u:.1f} px per minor interval "
              f"({hits}/{total} detected ticks on the lattice)")
    print()

    tops, series, problems = {}, {}, []
    for p in panels:
        scale = scales[p["key"]]
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

    for hormone, vals in tops.items():
        spread = (max(vals) - min(vals)) / np.mean(vals)
        print(f"\n{hormone} box-top agreement across 4 panels: {np.mean(vals):.2f} "
              f"+/- {np.std(vals):.2f} (spread {spread:.1%})")
        if spread > 0.05:
            problems.append(f"{hormone}: panels disagree on the axis top by {spread:.1%}")

    print("\nPROBLEMS:" if problems else "\nall validators pass")
    for q in problems:
        print("  -", q)
    if "--json" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps(series, indent=1))
        print(f"wrote {out}")
    print()
    compare(series)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
