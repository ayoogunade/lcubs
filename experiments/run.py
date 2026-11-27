"""Benchmark runner for the LCubS solvers.

Runs four experiments and writes one CSV per experiment to experiments/results/:

  scaling   runtime vs n, both solvers, on three workloads
            (random DNA, random binary, near-cube with 10% noise).
            n grows until a solver goes over the time limit; that gives the
            "largest n solved in reasonable time" numbers for the report.
  alphabet  runtime vs alphabet size sigma at fixed n.
  noise     runtime and pruning vs how far S is from a perfect cube, at fixed n.
  bound     how tight the pairwise-LCS upper bound is (fasterAlgo stats only).

Every data point is the median of SEEDS runs on different random strings.
Timings are wall-clock time of the whole process (includes ~2 ms start-up).
All solvers are checked to agree on the answer whenever both finish.

Usage (from the repo root, after `make`):
    .venv/bin/python experiments/run.py            # everything (~15-25 min)
    .venv/bin/python experiments/run.py --quick    # small smoke test (writes to results/quick/)
    .venv/bin/python experiments/run.py scaling noise
"""
import argparse
import csv
import random
import statistics
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BIN = ROOT / "bin"
OUT = ROOT / "experiments" / "results"
LETTERS = "acgtbdefhijklmnopqrsuvwxyz"  # first 4 are DNA letters, so sigma=4 means "acgt"

SEEDS = 3
TIME_LIMIT = 30.0  # seconds per single run; a solver stops growing n once a median passes this


# ---------- input generators ----------

def random_string(n: int, sigma: int, rng: random.Random) -> str:
    return "".join(rng.choice(LETTERS[:sigma]) for _ in range(n))


def near_cube(n: int, sigma: int, noise: float, rng: random.Random) -> str:
    """X·X·X with |X| = n/3, then each position replaced by a random letter with prob. noise."""
    x = random_string(n // 3, sigma, rng)
    s = list(x * 3)
    for k in range(len(s)):
        if rng.random() < noise:
            s[k] = rng.choice(LETTERS[:sigma])
    return "".join(s)


WORKLOADS = {
    "random_dna": lambda n, rng: random_string(n, 4, rng),
    "random_binary": lambda n, rng: random_string(n, 2, rng),
    "near_cube_10": lambda n, rng: near_cube(n, 4, 0.10, rng),
}


# ---------- running one solver ----------

def run(solver: str, s: str) -> dict | None:
    """Run bin/<solver> on s. Returns None on timeout."""
    start = time.perf_counter()
    try:
        proc = subprocess.run([BIN / solver], input=s + "\n", capture_output=True,
                              text=True, check=True, timeout=TIME_LIMIT)
    except subprocess.TimeoutExpired:
        return None
    elapsed = time.perf_counter() - start
    result = {"seconds": elapsed, "length": int(proc.stdout.split("\n")[0])}
    # fasterAlgo prints "key=value ..." stats on stderr
    for tok in proc.stderr.split():
        key, _, val = tok.partition("=")
        if val.isdigit():
            result[key] = int(val)
    return result


def measure(solver: str, strings: list[str]) -> dict | None:
    """Median over the given strings; None if any run timed out."""
    runs = []
    for s in strings:
        r = run(solver, s)
        if r is None:
            return None
        runs.append(r)
    med = {k: statistics.median(r[k] for r in runs) for k in runs[0]}
    med["lengths"] = [r["length"] for r in runs]
    return med


def check_agree(row_by_solver: dict, context: str) -> None:
    lens = {name: m["lengths"] for name, m in row_by_solver.items() if m is not None}
    if len({tuple(v) for v in lens.values()}) > 1:
        sys.exit(f"MISMATCH {context}: {lens}")


def write_csv(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fields = sorted({k for r in rows for k in r}, key=lambda k: list(rows[0]).index(k) if k in rows[0] else 99)
    with open(OUT / f"{name}.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {OUT / name}.csv ({len(rows)} rows)")


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------- experiments ----------

def exp_scaling(quick: bool) -> None:
    sizes = [20, 40, 60, 80, 100] if quick else \
        [20, 40, 60, 80, 100, 125, 150, 175, 200, 250, 300, 350, 400, 500, 600, 700, 800, 1000, 1200]
    rows = []
    for wname, gen in WORKLOADS.items():
        alive = {"baseline": True, "fasterAlgo": True}
        for n in sizes:
            if not any(alive.values()):
                break
            rng = random.Random(f"{wname}-{n}")
            strings = [gen(n, rng) for _ in range(SEEDS)]
            got = {}
            for solver in alive:
                if not alive[solver]:
                    continue
                m = measure(solver, strings)
                got[solver] = m
                if m is None or m["seconds"] > TIME_LIMIT:
                    alive[solver] = False
                    log(f"  {wname:14} n={n:5} {solver:10} over {TIME_LIMIT:.0f}s, stopping this solver")
                    continue
                rows.append({"workload": wname, "n": n, "solver": solver, "seconds": m["seconds"],
                             "length": m["length"], "cuts": m.get("cuts", ""),
                             "after_bound": m.get("after_bound", ""), "evaluated": m.get("evaluated", "")})
                log(f"  {wname:14} n={n:5} {solver:10} {m['seconds']:8.3f}s  len={m['length']:.0f}")
            check_agree(got, f"scaling {wname} n={n}")
    write_csv("scaling", rows)


def exp_alphabet(quick: bool) -> None:
    n = 60 if quick else 150
    rows = []
    for sigma in [1, 2, 3, 4, 6, 8, 12, 16, 20, 26]:
        rng = random.Random(f"alpha-{sigma}")
        strings = [random_string(n, sigma, rng) for _ in range(SEEDS)]
        got = {}
        for solver in ("baseline", "fasterAlgo"):
            m = measure(solver, strings)
            got[solver] = m
            rows.append({"sigma": sigma, "n": n, "solver": solver, "seconds": m["seconds"],
                         "length": m["length"], "filtered_n": m.get("filtered_n", ""),
                         "evaluated": m.get("evaluated", ""), "cuts": m.get("cuts", "")})
            log(f"  sigma={sigma:3} {solver:10} {m['seconds']:8.3f}s  len={m['length']:.0f}")
        check_agree(got, f"alphabet sigma={sigma}")
    write_csv("alphabet", rows)


def exp_noise(quick: bool) -> None:
    n = 60 if quick else 200
    rows = []
    for noise in [0.0, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.75, 1.0]:
        rng = random.Random(f"noise-{noise}")
        strings = [near_cube(n, 4, noise, rng) for _ in range(SEEDS)]
        got = {}
        for solver in ("baseline", "fasterAlgo"):
            m = measure(solver, strings)
            got[solver] = m
            rows.append({"noise": noise, "n": n, "solver": solver, "seconds": m["seconds"],
                         "length": m["length"], "after_bound": m.get("after_bound", ""),
                         "evaluated": m.get("evaluated", ""), "cuts": m.get("cuts", "")})
            log(f"  noise={noise:4.2f} {solver:10} {m['seconds']:8.3f}s  len={m['length']:.0f}")
        check_agree(got, f"noise={noise}")
    write_csv("noise", rows)


def exp_bound(quick: bool) -> None:
    """Gap between the best upper bound and the true answer, plus share of cuts pruned."""
    rows = []
    for wname, gen in WORKLOADS.items():
        for n in ([30, 60] if quick else [50, 100, 200, 400]):
            rng = random.Random(f"bound-{wname}-{n}")
            for seed in range(SEEDS):
                r = run("fasterAlgo", gen(n, rng))
                if r is None:
                    continue
                rows.append({"workload": wname, "n": n, "seed": seed, "length": r["length"],
                             "cuts": r["cuts"], "after_bound": r["after_bound"],
                             "evaluated": r["evaluated"],
                             "pct_pruned_by_bound": 100 * (1 - r["after_bound"] / r["cuts"]),
                             "pct_evaluated": 100 * r["evaluated"] / r["cuts"]})
            log(f"  {wname:14} n={n:4} done")
    write_csv("bound", rows)


EXPERIMENTS = {"scaling": exp_scaling, "alphabet": exp_alphabet, "noise": exp_noise, "bound": exp_bound}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("which", nargs="*", choices=[*EXPERIMENTS, []], help="experiments to run (default: all)")
    ap.add_argument("--quick", action="store_true", help="small sizes, for a smoke test")
    args = ap.parse_args()
    if args.quick:  # never overwrite the full results with smoke-test data
        global OUT
        OUT = OUT / "quick"
    for solver in ("baseline", "fasterAlgo"):
        if not (BIN / solver).exists():
            sys.exit("Build first: make")
    for name in args.which or EXPERIMENTS:
        log(f"== {name} ==")
        t = time.perf_counter()
        EXPERIMENTS[name](args.quick)
        log(f"  ({time.perf_counter() - t:.0f}s)")


if __name__ == "__main__":
    main()
