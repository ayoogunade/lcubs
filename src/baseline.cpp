// baseline.cpp - exact O(n^5) algorithm for Longest Cubic Subsequence (LCubS)
//
// Idea: if C = X.X.X is a subsequence of S, the three copies of X occupy three
// consecutive (non-overlapping) blocks of S. So there are cut points
// 0 <= i <= j <= n with
//     X subsequence of S[0..i),  X subsequence of S[i..j),  X subsequence of S[j..n).
// For a fixed cut, the longest such X is exactly LCS3(S[0..i), S[i..j), S[j..n)).
// Try every cut and keep the best one.
//
// Time:   sum over all O(n^2) cuts of |A|*|B|*|C| <= (n/3)^3  ->  O(n^5)
// Memory: O(n^3) for one LCS3 table.
//
// Usage:  ./bin/baseline atcgtatgcatgca      or      echo atcg... | ./bin/baseline

#include "common.hpp"

int main(int argc, char** argv) {
    const std::string s = readInput(argc, argv);
    const size_t n = s.size();

    std::string best;
    for (size_t i = 0; i <= n; ++i) {
        for (size_t j = i; j <= n; ++j) {
            std::string x = lcs3(s.substr(0, i), s.substr(i, j - i), s.substr(j));
            if (x.size() > best.size()) best = x;
        }
    }

    printResult(best);
    return 0;
}
