// fasterAlgo.cpp - exact branch-and-bound algorithm for Longest Cubic Subsequence
//
// Same search space as the baseline (every pair of cut points i <= j, then
// LCS3 of A = S[0,i), B = S[i,j), C = S[j,n)), but most cuts are skipped:
//
//  1. Letter filter. A letter that occurs fewer than 3 times in S can never be
//     in X (each letter of X is used three times), so delete it first.
//
//  2. Starting answer. X = c^k with k = floor(count(c)/3) for the most frequent
//     letter c is always a valid cube; it is the first value to beat.
//
//  3. Upper bound per cut. Any common subsequence of A, B, C is also common to
//     every pair, so
//         LCS3(A,B,C) <= UB(i,j) = min(LCS(A,B), LCS(B,C), LCS(A,C)).
//     All three pairwise values for ALL O(n^2) cuts take O(n^3) total time:
//       LCS(A,B): fix i; one DP of S[i,n) against S[0,i) gives every j.
//       LCS(B,C): fix j; one DP of reverse(S[0,j)) against reverse(S[j,n)) gives every i.
//       LCS(A,C): fix i; one DP of reverse(S[i,n)) against reverse(S[0,i)) gives every j.
//     (Reversal works because LCS(U,V) = LCS(rev U, rev V), and it turns the
//      piece whose START moves into a piece whose prefix grows.)
//
//  4. Search. Evaluate cuts in decreasing UB order; stop as soon as UB <= best,
//     since no remaining cut can do better. Each LCS3 uses two rolling layers
//     (O(|B||C|) memory) and quits early once it can no longer beat best.
//
//  5. Rebuild X only once, for the winning cut, using lcs3() from common.hpp.
//
// Worst case is still O(n^5) (if nothing gets pruned), plus O(n^3) for the bounds.
// Prints a one-line stats summary to stderr for the experiments.

#include "common.hpp"

#include <algorithm>
#include <array>
#include <climits>

// out[t] = LCS(u[0,t), v) for t = 0..|u|.   Time O(|u||v|), memory O(|v|).
static std::vector<int> lcsByPrefix(const std::string& u, const std::string& v) {
    const size_t m = v.size();
    std::vector<int> prev(m + 1, 0), cur(m + 1, 0), out(u.size() + 1, 0);
    for (size_t t = 1; t <= u.size(); ++t) {
        for (size_t k = 1; k <= m; ++k) {
            if (u[t - 1] == v[k - 1]) cur[k] = prev[k - 1] + 1;
            else cur[k] = std::max(prev[k], cur[k - 1]);
        }
        out[t] = cur[m];
        std::swap(prev, cur);
    }
    return out;
}

// Length of LCS3(a, b, c), or -1 as soon as it is certain the result is <= best.
// Layer i of the 3D table only needs layer i-1, so two (|b|+1) x (|c|+1) layers suffice.
static int lcs3Length(const std::string& a, const std::string& b, const std::string& c,
                      int best, std::vector<int>& prev, std::vector<int>& cur) {
    const size_t A = a.size(), B = b.size(), C = c.size(), W = C + 1;
    prev.assign((B + 1) * W, 0);
    cur.assign((B + 1) * W, 0);
    for (size_t i = 1; i <= A; ++i) {
        const char ai = a[i - 1];
        for (size_t j = 1; j <= B; ++j) {
            const bool ab = (ai == b[j - 1]);
            int* row = &cur[j * W];             // cur  [j]
            const int* up = &cur[(j - 1) * W];  // cur  [j-1]
            const int* back = &prev[j * W];     // prev [j]
            const int* diag = &prev[(j - 1) * W];  // prev [j-1]
            for (size_t k = 1; k <= C; ++k) {
                int v;
                if (ab && ai == c[k - 1]) {
                    v = diag[k - 1] + 1;
                } else {
                    v = back[k];
                    if (up[k] > v) v = up[k];
                    if (row[k - 1] > v) v = row[k - 1];
                }
                row[k] = v;
            }
        }
        std::swap(prev, cur);
        // Each remaining letter of a adds at most 1.
        if (prev[B * W + C] + static_cast<int>(A - i) <= best) return -1;
    }
    return prev[B * W + C];
}

int main(int argc, char** argv) {
    const std::string original = readInput(argc, argv);

    // 1. Letter filter.
    std::array<int, 256> count{};
    for (unsigned char ch : original) ++count[ch];
    std::string s;
    for (unsigned char ch : original)
        if (count[ch] >= 3) s.push_back(static_cast<char>(ch));
    const int n = static_cast<int>(s.size());

    // 2. Starting answer: the best single-letter cube.
    int top = 0;
    for (int ch = 1; ch < 256; ++ch)
        if (count[ch] > count[top]) top = ch;
    std::string best(count[top] / 3, static_cast<char>(top));
    int bestLen = static_cast<int>(best.size());

    // 3. Upper bounds UB(i,j) for every cut, in O(n^3).
    const int W = n + 1;
    std::vector<int> ub(static_cast<size_t>(W) * W, INT_MAX);
    auto tighten = [&](int i, int j, int value) {
        int& slot = ub[static_cast<size_t>(i) * W + j];
        if (value < slot) slot = value;
    };
    const std::string r(s.rbegin(), s.rend());  // r.substr(n-x) = rev(S[0,x)), r.substr(0,n-x) = rev(S[x,n))

    for (int i = 0; i <= n; ++i) {  // LCS(A,B): j = i + t
        std::vector<int> v = lcsByPrefix(s.substr(i), s.substr(0, i));
        for (int t = 0; t <= n - i; ++t) tighten(i, i + t, v[t]);
    }
    for (int j = 0; j <= n; ++j) {  // LCS(B,C): i = j - t
        std::vector<int> v = lcsByPrefix(r.substr(n - j), r.substr(0, n - j));
        for (int t = 0; t <= j; ++t) tighten(j - t, j, v[t]);
    }
    for (int i = 0; i <= n; ++i) {  // LCS(A,C): j = n - t
        std::vector<int> v = lcsByPrefix(r.substr(0, n - i), r.substr(n - i));
        for (int t = 0; t <= n - i; ++t) tighten(i, n - t, v[t]);
    }

    // 4. Search cuts in decreasing UB order (ties: most balanced cut first).
    struct Cut { int ub, minPart, i, j; };
    std::vector<Cut> cuts;
    long long totalCuts = 0;
    for (int i = 0; i <= n; ++i)
        for (int j = i; j <= n; ++j) {
            ++totalCuts;
            const int u = ub[static_cast<size_t>(i) * W + j];
            if (u > bestLen) cuts.push_back({u, std::min({i, j - i, n - j}), i, j});
        }
    std::sort(cuts.begin(), cuts.end(), [](const Cut& x, const Cut& y) {
        return x.ub != y.ub ? x.ub > y.ub : x.minPart > y.minPart;
    });

    int bestI = -1, bestJ = -1;
    long long evaluated = 0;
    std::vector<int> layerA, layerB;  // reused across calls so we don't reallocate
    for (const Cut& cut : cuts) {
        if (cut.ub <= bestLen) break;
        ++evaluated;
        const int len = lcs3Length(s.substr(0, cut.i), s.substr(cut.i, cut.j - cut.i),
                                   s.substr(cut.j), bestLen, layerA, layerB);
        if (len > bestLen) {
            bestLen = len;
            bestI = cut.i;
            bestJ = cut.j;
        }
    }

    // 5. Rebuild X for the winning cut.
    if (bestI >= 0)
        best = lcs3(s.substr(0, bestI), s.substr(bestI, bestJ - bestI), s.substr(bestJ));

    printResult(best);
    std::cerr << "n=" << original.size() << " filtered_n=" << n << " cuts=" << totalCuts
              << " after_bound=" << cuts.size() << " evaluated=" << evaluated << "\n";
    return 0;
}
