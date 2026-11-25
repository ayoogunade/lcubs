"""Turn experiments/results/*.csv into figures (PNG) and a Markdown summary table.

Usage:  .venv/bin/python experiments/plot.py
Writes: experiments/plots/fig1_scaling.png ... fig4_bound.png, summary.md
"""
import csv
import math
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "experiments" / "results"
OUT = ROOT / "experiments" / "plots"

SOLVER_STYLE = {"baseline": dict(color="#c0392b", marker="o"),
                "fasterAlgo": dict(color="#2471a3", marker="s")}
WORKLOAD_LABEL = {"random_dna": "random DNA (σ=4)", "random_binary": "random binary (σ=2)",
                  "near_cube_10": "near-cube, 10% noise (σ=4)"}
WORKLOAD_LINE = {"random_dna": "-", "random_binary": "--", "near_cube_10": ":"}


def load(name: str) -> list[dict]:
    with open(RES / f"{name}.csv") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        for k, v in r.items():
            try:
                r[k] = float(v)
            except (TypeError, ValueError):
                pass
    return rows


def style_axes(ax, title, xlabel, ylabel):
    ax.set_title(title, fontsize=11)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(True, which="both", alpha=0.3)


def fig_scaling(rows):
    fig, ax = plt.subplots(figsize=(7, 4.5))
    for (w, solver), pts in sorted(group(rows, "workload", "solver").items()):
        pts.sort(key=lambda r: r["n"])
        ax.plot([r["n"] for r in pts], [r["seconds"] for r in pts], WORKLOAD_LINE[w],
                label=f"{solver}: {WORKLOAD_LABEL[w]}", markersize=4, **SOLVER_STYLE[solver])
    # reference slope n^5 anchored at the baseline's random-DNA point nearest n=100
    base = [r for r in rows if r["solver"] == "baseline" and r["workload"] == "random_dna"]
    if base:
        anchor = min(base, key=lambda r: abs(r["n"] - 100))
        xs = [20, 900]
        ax.plot(xs, [anchor["seconds"] * (x / anchor["n"]) ** 5 for x in xs], color="gray",
                lw=0.8, label="reference slope n^5")
    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_ylim(1e-3, 60)
    ax.set_xlim(15, 900)
    style_axes(ax, "Figure 1. Running time vs input length (log-log, median of 3)",
               "n (length of S)", "seconds")
    ax.legend(fontsize=7, loc="upper left")
    save(fig, "fig1_scaling")


def fig_alphabet(rows):
    fig, ax1 = plt.subplots(figsize=(7, 4))
    for solver, pts in group(rows, "solver").items():
        pts.sort(key=lambda r: r["sigma"])
        ax1.plot([r["sigma"] for r in pts], [r["seconds"] for r in pts], label=solver,
                 **SOLVER_STYLE[solver])
    ax1.set_yscale("log")
    n = int(rows[0]["n"])
    style_axes(ax1, f"Figure 3. Running time vs alphabet size (n={n}, median of 3)",
               "alphabet size σ", "seconds")
    ax2 = ax1.twinx()
    fast = sorted((r for r in rows if r["solver"] == "fasterAlgo"), key=lambda r: r["sigma"])
    ax2.plot([r["sigma"] for r in fast], [r["length"] for r in fast], color="gray", ls="--",
             marker="^", markersize=4, label="answer length 3|X|")
    ax2.set_ylabel("answer length 3|X|", color="gray")
    lines = ax1.get_legend_handles_labels()
    lines2 = ax2.get_legend_handles_labels()
    ax1.legend(lines[0] + lines2[0], lines[1] + lines2[1], fontsize=8, loc="center right")
    save(fig, "fig3_alphabet")


def fig_noise(rows):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 4))
    for solver, pts in group(rows, "solver").items():
        pts.sort(key=lambda r: r["noise"])
        ax1.plot([100 * r["noise"] for r in pts], [r["seconds"] for r in pts], label=solver,
                 **SOLVER_STYLE[solver])
    ax1.set_yscale("log")
    n = int(rows[0]["n"])
    style_axes(ax1, f"(a) Running time (n={n})", "noise (% of positions randomised)", "seconds")
    ax1.legend(fontsize=8)

    fast = sorted((r for r in rows if r["solver"] == "fasterAlgo"), key=lambda r: r["noise"])
    ax2.plot([100 * r["noise"] for r in fast], [100 * r["evaluated"] / r["cuts"] for r in fast],
             color="#2471a3", marker="s", label="cuts fully evaluated")
    ax2.plot([100 * r["noise"] for r in fast], [100 * r["after_bound"] / r["cuts"] for r in fast],
             color="#7fb3d5", marker="^", ls="--", label="cuts surviving initial bound")
    ax2.set_yscale("log")
    style_axes(ax2, "(b) fasterAlgo: share of cuts examined", "noise (%)", "% of all cuts")
    ax2.legend(fontsize=8)
    fig.suptitle("Figure 2. Effect of distance from a perfect cube", fontsize=11)
    save(fig, "fig2_noise")


def fig_bound(rows):
    fig, ax = plt.subplots(figsize=(7, 4))
    for w, pts in group(rows, "workload").items():
        by_n = defaultdict(list)
        for r in pts:
            by_n[r["n"]].append(r["pct_evaluated"])
        ns = sorted(by_n)
        ax.plot(ns, [sum(by_n[n]) / len(by_n[n]) for n in ns], WORKLOAD_LINE[w], marker="s",
                color="#2471a3", label=WORKLOAD_LABEL[w])
    ax.set_xscale("log")
    ax.set_yscale("log")
    style_axes(ax, "Figure 4. Share of cuts needing a full LCS3 (fasterAlgo, mean of 3)",
               "n", "% of all cuts evaluated")
    ax.legend(fontsize=8)
    save(fig, "fig4_bound")


def summary_table(scaling):
    """Largest n each solver finished (median under the time limit) per workload."""
    lines = ["| Workload | baseline: largest n | time | fasterAlgo: largest n | time |",
             "|---|---|---|---|---|"]
    for w in WORKLOAD_LABEL:
        cells = [WORKLOAD_LABEL[w]]
        for solver in ("baseline", "fasterAlgo"):
            pts = [r for r in scaling if r["workload"] == w and r["solver"] == solver]
            best = max(pts, key=lambda r: r["n"]) if pts else None
            cells += [f"{best['n']:.0f}", f"{best['seconds']:.2f}s"] if best else ["-", "-"]
        lines.append("| " + " | ".join(cells) + " |")

    lines += ["", "Speedup (baseline time / fasterAlgo time) at sizes both solved:", "",
              "| Workload | n | baseline | fasterAlgo | speedup |", "|---|---|---|---|---|"]
    for w in WORKLOAD_LABEL:
        b = {r["n"]: r["seconds"] for r in scaling if r["workload"] == w and r["solver"] == "baseline"}
        f = {r["n"]: r["seconds"] for r in scaling if r["workload"] == w and r["solver"] == "fasterAlgo"}
        for n in sorted(set(b) & set(f)):
            if n >= 100:
                lines.append(f"| {WORKLOAD_LABEL[w]} | {n:.0f} | {b[n]:.3f}s | {f[n]:.3f}s | {b[n] / f[n]:.0f}x |")

    lines += ["", "Empirical growth exponent (slope of log time vs log n, fitted on n >= 100):", "",
              "| Workload | baseline | fasterAlgo |", "|---|---|---|"]
    for w in WORKLOAD_LABEL:
        cells = [WORKLOAD_LABEL[w]]
        for solver in ("baseline", "fasterAlgo"):
            pts = [(r["n"], r["seconds"]) for r in scaling
                   if r["workload"] == w and r["solver"] == solver and r["n"] >= 100]
            cells.append(f"{slope(pts):.2f}" if len(pts) >= 2 else "-")
        lines.append("| " + " | ".join(cells) + " |")
    (OUT / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def slope(pts):
    xs = [math.log(n) for n, _ in pts]
    ys = [math.log(t) for _, t in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)


def group(rows, *keys):
    out = defaultdict(list)
    for r in rows:
        out[r[keys[0]] if len(keys) == 1 else tuple(r[k] for k in keys)].append(r)
    return out


def save(fig, name):
    OUT.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.png", dpi=200)
    plt.close(fig)
    print(f"wrote {OUT / name}.png")


if __name__ == "__main__":
    for name, fn in [("scaling", fig_scaling), ("noise", fig_noise), ("alphabet", fig_alphabet),
                     ("bound", fig_bound)]:
        if (RES / f"{name}.csv").exists():
            fn(load(name))
    if (RES / "scaling.csv").exists():
        summary_table(load("scaling"))
