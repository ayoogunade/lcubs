"""Exponential reference solver for LCubS, used only to check the C++ code.

Tries every subsequence of S (2^n of them) and keeps the longest one of the
form X+X+X. Only usable for n <= ~16, which is plenty for random testing.
"""
import sys


def brute_lcubs(s: str) -> int:
    n = len(s)
    best = 0
    for mask in range(1 << n):
        t = [s[i] for i in range(n) if mask >> i & 1]
        m = len(t)
        if m % 3 or m <= best:
            continue
        k = m // 3
        if t[:k] == t[k:2 * k] == t[2 * k:]:
            best = m
    return best


def is_subsequence(t: str, s: str) -> bool:
    it = iter(s)
    return all(ch in it for ch in t)


if __name__ == "__main__":
    print(brute_lcubs(sys.argv[1] if len(sys.argv) > 1 else sys.stdin.readline().strip()))
