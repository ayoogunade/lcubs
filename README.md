# Longest Cubic Subsequence (LCubS)

CMPT 360 Algorithm Design Report, Option 2.

Given a string S, find the longest subsequence of the form X·X·X.

## Layout

| Path | What it is |
|---|---|
| `src/baseline.cpp` | Exact O(n^5) algorithm: try every pair of cut points, run a 3-string LCS on the three pieces |
| `src/fasterAlgo.cpp` | Exact branch-and-bound: drops letters seen < 3 times, bounds every cut by its pairwise LCS values (all cuts in O(n^3)), evaluates cuts best-bound-first and stops early. Prints pruning stats to stderr |
| `src/common.hpp` | Shared input/output and 3-string LCS code |
| `tests/brute.py` | Exponential brute force (n <= ~16), used as the reference answer |
| `tests/test_against_brute.py` | Random tests comparing every built solver against the brute force |
| `experiments/run.py` | Benchmark runner: scaling, alphabet size, noise, bound tightness. Writes `experiments/results/*.csv` |
| `experiments/plot.py` | Figures and summary tables from the CSVs, into `experiments/plots/` |

## Build and run

Needs a C++17 compiler (clang++ or g++) and Python 3.

```sh
make                              # builds bin/baseline and bin/fasterAlgo
./bin/baseline atcgtatgcatgca     # S as an argument
echo atcgtatgcatgca | ./bin/baseline   # or on stdin
make test                         # random tests against the brute force
```

Output is three lines: the length 3·|X|, then X, then `C = X.X.X`.

```
9
atc
C = atc.atc.atc
```

Several X can be optimal (for the example above, `atg` also gives length 9).

## Experiments

```sh
python3 -m venv .venv && .venv/bin/pip install matplotlib
make
.venv/bin/python experiments/run.py           # full run, ~15-25 min (use --quick for a smoke test)
.venv/bin/python experiments/plot.py          # figures + experiments/plots/summary.md
```

Each data point is the median of 3 random strings. A solver stops growing n once a run passes 30 s.
Reported numbers were measured on an Apple M1 (8 GB), Apple clang 21, `-O2`.
