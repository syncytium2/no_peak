"""Extract all 1-D waves + stored cluster settings from the pxp to CSV."""
import os
import sys

import numpy as np
from igor2 import packed

src = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)

records, filesystem = packed.load(src)
root = filesystem.get("root") or filesystem[b"root"]
root = {k.decode() if isinstance(k, bytes) else str(k): v for k, v in root.items()}


def wave_data(item):
    w = item.wave["wave"]
    return np.asarray(w["wData"], dtype=float)


waves = {}
scalars = {}
for name, item in root.items():
    label = name.decode() if isinstance(name, bytes) else str(name)
    if type(item).__name__ == "WaveRecord":
        waves[label] = wave_data(item)
    elif isinstance(item, float):
        scalars[label] = item

# ---- stored cluster panel settings ----
settings_keys = [
    "g_npntsUP", "g_npntsDN", "g_TscoreUP", "g_TscoreDN",
    "g_minPeak", "g_halflife", "g_outierTscore", "gRadioVal",
    "g_SQRT0value", "g_FixedValue",
]
with open(os.path.join(outdir, "igor_panel_settings.txt"), "w") as f:
    f.write("# Cluster panel globals stored in cluster td- just data.pxp\n")
    for k in settings_keys:
        if k in scalars:
            f.write(f"{k} = {scalars[k]!r}\n")
            print(f"{k} = {scalars[k]!r}")

def write_csv(fname, header, cols):
    n = len(cols[0])
    assert all(len(c) == n for c in cols), fname
    with open(os.path.join(outdir, fname), "w") as f:
        f.write(header + "\n")
        for i in range(n):
            f.write(",".join(repr(float(c[i])) for c in cols) + "\n")
    print(f"wrote {fname} ({n} rows)")

# ---- composite sets ----
write_csv(
    "set1.csv",
    "time,value,error",
    [waves["set1C3(Times)"], waves["set1C1(RD)"], waves["set1C2(STDEV)"]],
)
write_csv(
    "LHInfused.csv",
    "time,value,error",
    [np.arange(1, len(waves["LHInfusedC1(RD)"]) + 1, dtype=float),
     waves["LHInfusedC1(RD)"], waves["LHInfusedC2(STDEV)"]],
)
write_csv(
    "gnrh.csv",
    "time,value,error",
    [np.arange(1, len(waves["gnrh"]) + 1, dtype=float), waves["gnrh"], waves["sem"]],
)

# ---- single series ----
for label in ["null1", "man2", "man3", "man4", "man5", "man6", "wave0", "wave1"]:
    write_csv(f"{label}.csv", "value", [waves[label]])

print("done")
