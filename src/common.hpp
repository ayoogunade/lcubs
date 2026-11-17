// common.hpp - shared helpers for baseline.cpp and fasterAlgo.cpp
//
// Both programs read S the same way, print the answer the same way, and
// rebuild X from a chosen split the same way, so that code lives here once.
#pragma once

#include <iostream>
#include <string>
#include <vector>

// Read S from argv[1] if given, otherwise from the first line of stdin.
// Trailing whitespace / '\r' is stripped so files saved on Windows still work.
inline std::string readInput(int argc, char** argv) {
    std::string s;
    if (argc > 1) {
        s = argv[1];
    } else {
        std::getline(std::cin, s);
    }
    while (!s.empty() && (s.back() == '\r' || s.back() == '\n' || s.back() == ' '))
        s.pop_back();
    return s;
}

// Output format (the test script and experiment runner rely on it):
//   line 1: length of the cubic subsequence, i.e. 3*|X|
//   line 2: X            (empty line if X is empty)
//   line 3: C = X.X.X    (human-readable form)
inline void printResult(const std::string& x) {
    std::cout << 3 * x.size() << "\n"
              << x << "\n"
              << "C = " << x << "." << x << "." << x << "\n";
}

// Longest common subsequence of three strings, returning the subsequence itself.
// dp[i][j][k] = LCS length of a[0..i), b[0..j), c[0..k).
// Time and memory: O(|a| * |b| * |c|).
inline std::string lcs3(const std::string& a, const std::string& b, const std::string& c) {
    const size_t A = a.size(), B = b.size(), C = c.size();
    std::vector<int> dp((A + 1) * (B + 1) * (C + 1), 0);
    auto at = [&](size_t i, size_t j, size_t k) -> int& {
        return dp[(i * (B + 1) + j) * (C + 1) + k];
    };

    for (size_t i = 1; i <= A; ++i)
        for (size_t j = 1; j <= B; ++j)
            for (size_t k = 1; k <= C; ++k) {
                if (a[i - 1] == b[j - 1] && b[j - 1] == c[k - 1]) {
                    at(i, j, k) = at(i - 1, j - 1, k - 1) + 1;
                } else {
                    int best = at(i - 1, j, k);
                    if (at(i, j - 1, k) > best) best = at(i, j - 1, k);
                    if (at(i, j, k - 1) > best) best = at(i, j, k - 1);
                    at(i, j, k) = best;
                }
            }

    // Walk back from (A, B, C) to recover one optimal common subsequence.
    std::string x;
    size_t i = A, j = B, k = C;
    while (i > 0 && j > 0 && k > 0) {
        if (a[i - 1] == b[j - 1] && b[j - 1] == c[k - 1]) {
            x.push_back(a[i - 1]);
            --i; --j; --k;
        } else if (at(i, j, k) == at(i - 1, j, k)) {
            --i;
        } else if (at(i, j, k) == at(i, j - 1, k)) {
            --j;
        } else {
            --k;
        }
    }
    return std::string(x.rbegin(), x.rend());
}
