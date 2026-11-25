| Workload | baseline: largest n | time | fasterAlgo: largest n | time |
|---|---|---|---|---|
| random DNA (σ=4) | 250 | 16.26s | 400 | 21.10s |
| random binary (σ=2) | 250 | 12.78s | 500 | 7.99s |
| near-cube, 10% noise (σ=4) | 250 | 15.86s | 700 | 11.56s |

Speedup (baseline time / fasterAlgo time) at sizes both solved:

| Workload | n | baseline | fasterAlgo | speedup |
|---|---|---|---|---|
| random DNA (σ=4) | 100 | 0.168s | 0.013s | 13x |
| random DNA (σ=4) | 125 | 0.508s | 0.047s | 11x |
| random DNA (σ=4) | 150 | 1.272s | 0.118s | 11x |
| random DNA (σ=4) | 175 | 2.740s | 0.205s | 13x |
| random DNA (σ=4) | 200 | 5.289s | 0.406s | 13x |
| random DNA (σ=4) | 250 | 16.260s | 1.170s | 14x |
| random binary (σ=2) | 100 | 0.135s | 0.004s | 33x |
| random binary (σ=2) | 125 | 0.391s | 0.007s | 56x |
| random binary (σ=2) | 150 | 0.992s | 0.027s | 36x |
| random binary (σ=2) | 175 | 2.084s | 0.030s | 69x |
| random binary (σ=2) | 200 | 4.143s | 0.123s | 34x |
| random binary (σ=2) | 250 | 12.785s | 0.287s | 45x |
| near-cube, 10% noise (σ=4) | 100 | 0.161s | 0.003s | 52x |
| near-cube, 10% noise (σ=4) | 125 | 0.466s | 0.004s | 104x |
| near-cube, 10% noise (σ=4) | 150 | 1.254s | 0.014s | 93x |
| near-cube, 10% noise (σ=4) | 175 | 2.661s | 0.019s | 143x |
| near-cube, 10% noise (σ=4) | 200 | 5.137s | 0.015s | 337x |
| near-cube, 10% noise (σ=4) | 250 | 15.855s | 0.087s | 183x |

Empirical growth exponent (slope of log time vs log n, fitted on n >= 100):

| Workload | baseline | fasterAlgo |
|---|---|---|
| random DNA (σ=4) | 4.99 | 5.12 |
| random binary (σ=2) | 4.97 | 4.99 |
| near-cube, 10% noise (σ=4) | 5.03 | 4.61 |
