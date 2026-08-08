#!/usr/bin/env bash
# Build the original CLUST5 Fortran and run it on a dataset, to generate the
# oracle files in data/oracle/ that src/core/oracle.test.ts checks against.
#
#   brew install gcc          # provides gfortran
#   bash tools/fortran/build_and_run.sh data/extracted/gnrh.csv 2 2
#
# Notes on why each step is needed:
#  - CLUST5.MPF has CRLF line endings; cpp will not see the directives unless
#    they are stripped first.
#  - It #includes opsys.h and defalt.h, which are NOT in the original source we
#    have. They are synthesized here: opsys.h picks the most portable platform
#    branch (pc_micro: plain file=/status= opens, no VMS carriagecontrol),
#    defalt.h supplies the unit-number aliases.
#  - The preprocessed output must NOT be named clust5.f alongside clust5.F —
#    macOS filesystems are case-insensitive and the redirect truncates the input.
#  - The program links against a Tektronix plotting library; stubs.f resolves
#    those symbols. The plot prompt is answered N, so none of them is called.
set -euo pipefail

CSV="${1:?usage: build_and_run.sh <csv> [nNadir] [nPeak] [tUp] [tDn]}"
NNADIR="${2:-2}"; NPEAK="${3:-2}"; TUP="${4:-2}"; TDN="${5:-2}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/tools/fortran"
BUILD="$(mktemp -d)"
NAME="$(basename "$CSV" .csv)"
TAG="${NAME}_nn${NNADIR}_np${NPEAK}"

cp "$HERE/opsys.h" "$HERE/defalt.h" "$HERE/stubs.f" "$BUILD/"
tr -d '\r' < "$ROOT/reference/fortran/CLUST5.MPF" > "$BUILD/src_clust5.F"

cd "$BUILD"
cpp -P -traditional-cpp -I. src_clust5.F > pp_clust5.f
gfortran -std=legacy -ffixed-form -w -fno-automatic -o clust5 pp_clust5.f stubs.f

# CLUST5 input format for variance option 3 ("input from data file"):
#   line 1: number of replicates (1)
#   line 2: time between data points
#   then:   value  SD  NDF        (one sample per line)
python3 - "$ROOT/$CSV" "$BUILD/in.dat" <<'PY'
import csv, sys
rows = [r for r in list(csv.reader(open(sys.argv[1])))[1:] if r and r[0].strip()]
t = [float(r[0]) for r in rows]; v = [float(r[1]) for r in rows]
e = [float(r[2]) for r in rows] if len(rows[0]) > 2 else [0.0]*len(rows)
with open(sys.argv[2], "w") as f:
    f.write("1\n"); f.write(f"{t[1]-t[0]}\n")
    for a, b in zip(v, e): f.write(f"{a} {b} 1\n")
PY

# prompts: infile, outfile, variance option, nNadir, nPeak, t-up, minPeak, t-down, plot?
printf 'in.dat\nout.lst\n3\n%s\n%s\n%s\n0\n%s\nN\n' "$NNADIR" "$NPEAK" "$TUP" "$TDN" \
  | ./clust5 > out.stdout.txt 2>&1

mkdir -p "$ROOT/data/oracle"
cp out.lst        "$ROOT/data/oracle/$TAG.lst"
cp out.stdout.txt "$ROOT/data/oracle/$TAG.stdout.txt"
echo "wrote data/oracle/$TAG.lst and .stdout.txt"
