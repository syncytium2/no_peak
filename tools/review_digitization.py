#!/usr/bin/env python3
# vendored from syncytium2/downLow @ 0a21754 — canonical THERE; do not edit here, re-copy and bump this stamp.
"""Panel-by-panel review of the Webster 1991 digitization, against the printed figure.

    python3 tools/review_digitization.py [pdf] [outdir]

For each of the eight panels it emits three views at identical geometry:

    1. the panel as printed, cropped from the scan
    2. THE OVERLAY — our extracted series drawn on top of that crop, in red
    3. our extracted series alone

The overlay is the one that earns the page. A digitization error shows up there
as a red line leaving the black one; in two plots side by side it shows up as
nothing at all, because the eye cannot carry a shape across a gap.

WHERE THIS WRITES, AND WHY NOT THE DARKROOM. The output embeds crops of the
published figure. The article is not open access, `data/digitized/README.md`
declines to redistribute it, and the contractual question in
`docs/figure-data-permissions.md` is open and untested. A darkroom page is
explicitly the kind of thing that gets forwarded, so this writes to a LOCAL,
gitignored `review/` instead — which is the right home for it anyway: it is a QA
artifact for one reader, not a deliverable.

CALIBRATION IS NOT RE-DERIVED HERE. It imports the panel geometry and the y-axis
tick fit from no_peak's `tools/digitize_webster1991.py`, which is canonical for
both. A second implementation would be a second chance to be wrong, and agreeing
with itself would prove nothing — the same reason `data_root.py`'s self-test was
found not to bite.
"""

import base64
import io
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# ADAPTED FOR no_peak. Upstream reaches sideways into a sibling `no_peak/`
# checkout for the digitizer and for the panel geometry; here both are local, so
# the import is an ordinary sibling one and `DIG` below is this repo's own
# `data/digitized/`. That difference is the whole reason this copy exists:
# running it in downLow renders downLow's VENDORED copy of the CSVs, which is
# how a review page came back showing the pre-fix values on 2026-08-15 after the
# digitizer had already been corrected here.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np                                                    # noqa: E402
from PIL import Image                                                 # noqa: E402

from digitize_webster1991 import (PANELS, even_ticks, fit_y,          # noqa: E402
                                  y_ticks)

DIG = REPO / "data" / "digitized"
WIDTH = 860          # display width for every view, so the three rows align


def load_series(key):
    vals = []
    for line in (DIG / f"webster1991_{key}.csv").read_text().splitlines():
        if line.startswith("#") or not line.strip() or line.startswith("time"):
            continue
        p = line.split(",")
        try:
            vals.append((float(p[0]), float(p[1])))
        except ValueError:
            pass
    return vals


def load_pulses():
    """The paper's OWN circled pulse calls, per series -> sample indices."""
    out = {}
    for line in (DIG / "webster1991_pulses.csv").read_text().splitlines():
        if line.startswith("#") or not line.strip() or line.startswith("series"):
            continue
        p = [x.strip() for x in line.split(",")]
        if len(p) < 2:
            continue
        try:
            out.setdefault(p[0], []).append(int(p[1]))
        except ValueError:
            pass
    return out


def png_uri(arr):
    im = Image.fromarray(arr)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main(pdf, outdir):
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if not Path(pdf).exists():
        sys.exit(f"no such PDF: {pdf}\n"
                 "The article is not stored in either repo by design — "
                 "data/digitized/README.md declines to redistribute it. "
                 "Pass the path to your own copy.")
    with tempfile.TemporaryDirectory() as tmp:
        try:
            subprocess.run(["pdfimages", "-png", "-f", "5", "-l", "5",
                            str(pdf), f"{tmp}/pg"], check=True, capture_output=True)
        except subprocess.CalledProcessError as e:
            sys.exit(f"pdfimages failed on {pdf}\n{e.stderr.decode()[:400]}")
        pages = sorted(Path(tmp).glob("pg*.png"))
        if not pages:
            sys.exit("pdfimages produced no image for page 5 — is this the right PDF?")
        grey = np.array(Image.open(pages[0]).convert("L"))

    ink = grey < 128
    pulses = load_pulses()
    cards, problems = [], []

    for p in PANELS:
        T, B, L, R, n = p["top"], p["bottom"], p["left"], p["right"], p["n"]
        ticks = even_ticks(y_ticks(ink, T, B, L))
        scale, resid = fit_y(B, ticks, p["minor"])
        top_value = scale * (B - T)

        crop = grey[T:B + 1, int(L):int(R) + 1]
        h, w = crop.shape
        disp_h = WIDTH * h / w

        series = load_series(p["key"])
        vals = [v for _, v in series]
        if len(vals) != n:
            problems.append(f"{p['key']}: csv has {len(vals)} samples, geometry says {n}")

        # our series, in the crop's own pixel frame, then scaled to WIDTH
        sx = WIDTH / w
        pts = " ".join(
            f"{((L + (R - L) * i / (n - 1)) - L) * sx:.2f},"
            f"{((B - v / scale) - T) * (disp_h / h):.2f}"
            for i, v in enumerate(vals))

        # The paper's own circled pulses, redrawn at OUR extracted value. If the
        # digitization is right these land on the printed rings; if a value is
        # misread the blue circle floats off its black one, which is the fastest
        # per-sample check on the page.
        marks = [i for i in pulses.get(p["key"], []) if 0 <= i < n]
        if len(marks) != p["pulses"]:
            problems.append(f"{p['key']}: pulses.csv has {len(marks)} marks, "
                            f"geometry says the panel prints {p['pulses']}")
        rings = "".join(
            f'<circle cx="{((L + (R - L) * i / (n - 1)) - L) * sx:.2f}" '
            f'cy="{((B - vals[i] / scale) - T) * (disp_h / h):.2f}" r="8" '
            f'fill="none" stroke="#1f4e9c" stroke-width="2"/>'
            for i in marks)

        img = png_uri(crop)
        overlay = (f'<div class=stack style="height:{disp_h:.0f}px">'
                   f'<img src="{img}" width="{WIDTH}">'
                   f'<svg width="{WIDTH}" height="{disp_h:.0f}">'
                   f'<polyline points="{pts}" fill="none" stroke="#c1272d" '
                   f'stroke-width="1.6" opacity="0.85"/>{rings}</svg></div>')
        ours = (f'<svg width="{WIDTH}" height="{disp_h:.0f}" '
                f'style="background:#fff;border:1px solid #eee">'
                f'<polyline points="{pts}" fill="none" stroke="#1a1a1a" '
                f'stroke-width="1.6"/></svg>')

        cards.append(f"""
<section>
  <h2>{p['panel']} — ewe {p['animal']}, {p['hormone']} <span class=g>({p['group']})</span></h2>
  <p class=meta>box {T}–{B} px · y-fit residual <b>{resid:.4f}</b> · axis top
     {top_value:.2f} {p['unit']} · {n} samples at {p['dt']} min ·
     range {min(vals):.3f}–{max(vals):.3f} · paper marks {p['pulses']} pulses, {len(marks)} redrawn in blue</p>
  <p class=lbl>1. as printed</p><img src="{img}" width="{WIDTH}">
  <p class=lbl>2. overlay — our extraction in red</p>{overlay}
  <p class=lbl>3. our extraction alone</p>{ours}
</section>""")

    warn = ("<p class=bad>" + "<br>".join(problems) + "</p>") if problems else ""
    html = f"""<!doctype html><meta charset="utf-8">
<title>Webster 1991 digitization review</title>
<style>
 body{{font:15px/1.5 system-ui;max-width:960px;margin:24px auto;padding:0 20px;color:#1a1a1a}}
 h1{{font-size:22px;margin:0 0 2px}} h2{{font-size:16px;margin:26px 0 2px}}
 .g{{color:#6b6b6b;font-weight:400}}
 .meta{{font:12px ui-monospace,monospace;color:#4a4a4a;margin:0 0 10px}}
 .lbl{{font:12px system-ui;color:#6b6b6b;margin:12px 0 3px}}
 .stack{{position:relative}} .stack img,.stack svg{{position:absolute;top:0;left:0}}
 img{{display:block;border:1px solid #eee}}
 .warn{{background:#fff6e5;border:1px solid #e8c980;padding:10px 14px;border-radius:5px}}
 .bad{{background:#fdecec;border:1px solid #e0a0a0;padding:10px 14px;border-radius:5px}}
</style>
<h1>Webster 1991 — digitization review, panel by panel</h1>
<p class=g>Eight panels, each shown as printed, as an overlay, and as our extraction.
Read row 2: any place the red leaves the black is a digitization error.</p>
<p class=warn><b>Local review artifact — do not put this in the darkroom or forward it.</b>
It embeds crops of a figure from an article that is not open access and is not
redistributed by this project, and the contractual question in
<code>docs/figure-data-permissions.md</code> is open. The extracted <i>numbers</i> are
measurements and travel freely; these <i>images</i> do not.</p>
{warn}
{''.join(cards)}"""

    out = outdir / "webster_digitization_review.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out}  ({len(PANELS)} panels)")
    if problems:
        print("PROBLEMS:", *problems, sep="\n  ")
    return out


if __name__ == "__main__":
    # ADAPTED: the PDF argument is optional here. It is found in Dropbox by the
    # digitizer's own resolver, which reads Dropbox's info.json — the machines
    # this runs on mount it at three different paths.
    from digitize_webster1991 import find_pdf                          # noqa: E402
    main(find_pdf(sys.argv[1] if len(sys.argv) > 1 else None),
         sys.argv[2] if len(sys.argv) > 2 else REPO / "review")
