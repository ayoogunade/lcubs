"""Random tests: compare every built solver in bin/ against the brute force.

For each random S we check two things:
  1. the reported length equals the true optimum (from brute force), and
  2. the reported X really works: X+X+X is a subsequence of S.
(Several different X can be optimal, so we don't compare X itself.)

Run with:  make test
"""
import random
import subprocess
import sys
from pathlib import Path

from brute import brute_lcubs, is_subsequence

ROOT = Path(__file__).resolve().parent.parent
SOLVERS = [p for p in (ROOT / "bin" / "baseline", ROOT / "bin" / "fasterAlgo") if p.exists()]
FIXED = ["", "a", "aa", "aaa", "abc", "abcabcabc", "atcgtatgcatgca", "aaaaaaaaaa", "abababab"]


def run(solver: Path, s: str) -> tuple[int, str]:
    out = subprocess.run([solver], input=s + "\n", capture_output=True, text=True, check=True)
    lines = out.stdout.split("\n")
    return int(lines[0]), lines[1]


def check(solver: Path, s: str) -> None:
    length, x = run(solver, s)
    want = brute_lcubs(s)
    assert length == want, f"{solver.name}: S={s!r} got {length}, expected {want}"
    assert length == 3 * len(x), f"{solver.name}: S={s!r} length {length} != 3*|X| for X={x!r}"
    assert is_subsequence(x * 3, s), f"{solver.name}: S={s!r} X={x!r} but XXX is not a subsequence"


def main() -> None:
    if not SOLVERS:
        sys.exit("No solvers built. Run `make` first.")
    rng = random.Random(360)
    cases = list(FIXED)
    for _ in range(400):
        n = rng.randint(0, 14)
        alphabet = "acgt"[: rng.randint(1, 4)]
        cases.append("".join(rng.choice(alphabet) for _ in range(n)))

    for solver in SOLVERS:
        for s in cases:
            check(solver, s)
        print(f"{solver.name}: all {len(cases)} cases passed")


if __name__ == "__main__":
    main()
