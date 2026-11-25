// Builds the LCubS report draft as .docx
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, ImageRun, LevelFormat, PageBreak, BorderStyle, Footer, PageNumber,
} = require("docx");

const REPO = path.resolve(__dirname, "..");  // run: npm install docx && node report/build_report.js
const PLOTS = path.join(REPO, "experiments/plots");
const OUT = path.join(REPO, "report/LCubS_Report_DRAFT.docx");
const FONT = "Arial";

// ---- inline markup: **bold**, _italic_, `code`, [[placeholder]] ----
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith("_")) out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Courier New", size: 19, ...base }));
    else out.push(new TextRun({ text: "[" + t.slice(2, -2) + "]", highlight: "yellow", bold: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 100 }, ...opts });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const B = (text, level = 0) => new Paragraph({ numbering: { reference: "bullets", level }, children: runs(text), spacing: { after: 40 } });
const N = (text, ref = "steps") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(text), spacing: { after: 40 } });
const Caption = (t) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: runs(t, { size: 18, italics: true }) });

function Img(file, widthPx, heightPx) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 40 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(PLOTS, file)), transformation: { width: widthPx, height: heightPx } })],
  });
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
function Tbl(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      children: r.map((cell, ci) => new TableCell({
        borders, width: { size: widths[ci], type: WidthType.DXA },
        shading: ri === 0 ? { fill: "E8EEF4", type: ShadingType.CLEAR } : undefined,
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({ children: runs(cell, { size: 18, bold: ri === 0 }) })],
      })),
    })),
  });
}

// ================= CONTENT =================
const body = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: "Longest Cubic Subsequence: an Exact Baseline and a Branch-and-Bound Algorithm", bold: true, size: 30 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: runs("CMPT 360 Algorithm Design Report, Option 2  ·  Ayo Ogunade  ·  [[student number]]  ·  Code: github.com/ayoogunade/lcubs", { size: 20 }) }),

  H1("1. Problem and a key reformulation"),
  P("Let _S_ be a string of length _n_ and write _S_[_a_,_b_) for the substring of positions _a_ to _b_−1. We want a longest string _X_ such that _X_·_X_·_X_ is a subsequence of _S_; the output is _C_ = _X_·_X_·_X_ of length 3|_X_|. LCS(_U_,_V_) and LCS3(_U_,_V_,_W_) denote the longest common subsequence of two and of three strings. Both algorithms rest on one observation:"),
  P("**Lemma 1 (cut lemma).** _X_·_X_·_X_ is a subsequence of _S_ if and only if there are cut points 0 ≤ _i_ ≤ _j_ ≤ _n_ such that _X_ is a common subsequence of _A_ = _S_[0,_i_), _B_ = _S_[_i_,_j_) and _C_ = _S_[_j_,_n_). Hence the optimum is max over all cuts of LCS3(_A_,_B_,_C_)."),
  P("_Proof._ (⇒) Let the three copies of _X_ be embedded at positions _p_₁<…<_p_ₖ < _q_₁<…<_q_ₖ < _r_₁<…<_r_ₖ. Take _i_ = _p_ₖ+1 and _j_ = _q_ₖ+1; then each copy lies entirely inside its own block. (If _X_ is empty take _i_ = _j_ = 0.) (⇐) Embeddings of _X_ inside the three disjoint, consecutive blocks concatenate, in order, into an embedding of _X_·_X_·_X_ in _S_. ∎"),

  H1("2. Baseline algorithm (src/baseline.cpp)"),
  P("**Overview.** The baseline tries every pair of cut points and solves a three-string LCS on the three blocks with the textbook dynamic program, keeping the best. It is short, obviously exact by Lemma 1, and its running time does not depend on the content of _S_, so it is a reliable reference. Its limitation is the Θ(_n_⁵) running time: in our experiments it cannot go beyond _n_ ≈ 250 within 30 seconds, whatever the input."),
  P("**Algorithm.**"),
  N("For every 0 ≤ _i_ ≤ _j_ ≤ _n_: let _A_ = _S_[0,_i_), _B_ = _S_[_i_,_j_), _C_ = _S_[_j_,_n_)."),
  N("Fill the table _D_[_a_][_b_][_c_] = LCS3(_A_[0,_a_), _B_[0,_b_), _C_[0,_c_)) with _D_ = 0 on any zero index, _D_[_a_][_b_][_c_] = _D_[_a_−1][_b_−1][_c_−1] + 1 if _A_[_a_−1] = _B_[_b_−1] = _C_[_c_−1], and otherwise the maximum of _D_[_a_−1][_b_][_c_], _D_[_a_][_b_−1][_c_], _D_[_a_][_b_][_c_−1]."),
  N("Walk back from _D_[|_A_|][|_B_|][|_C_|] to recover one optimal _X_ (step diagonally on a triple match, otherwise move to a neighbour with the same value). Keep the longest _X_ over all cuts and output _X_·_X_·_X_."),
  P("**Correctness.** Lemma 1 shows the optimum equals the maximum of LCS3 over cuts, and every cut is tried. The LCS3 recurrence is the standard one: if the last three characters are equal, some optimal common subsequence ends with them (an exchange argument), otherwise at least one of the three last characters is unused, so dropping it loses nothing. The walk-back follows exactly the cases that produced each value, so it returns a common subsequence of the computed length, and by Lemma 1 _X_·_X_·_X_ is a subsequence of _S_."),
  P("**Running time and memory.** The cut (_i_,_j_) costs Θ(|_A_||_B_||_C_|) = Θ(_xyz_) where _x_+_y_+_z_ = _n_. Summing _xyz_ over all compositions of _n_ into three non-negative parts gives exactly C(_n_+2, 5) = _n_⁵/120 + O(_n_⁴), so the baseline runs in **Θ(n⁵)** time. The largest single table has (_n_/3+1)³ cells, so memory is O(_n_³). The small constant 1/120 explains why _n_ = 200 still takes only about 5 s; the measured growth exponent is 4.97 to 5.03 (Section 4)."),

  H1("3. Faster algorithm (src/fasterAlgo.cpp)"),
  P("**Overview.** fasterAlgo keeps the same search space (all cuts, Lemma 1) but turns it into a branch-and-bound search: it computes a cheap upper bound for every cut, examines cuts from the most to the least promising, and stops as soon as no remaining cut can beat the best answer found. It is exact. Its worst case is still O(_n_⁵), but in practice it is 11× to 340× faster, and it is provably very fast on inputs close to a cube. Table 1 separates standard components from the ideas specific to this problem."),
  Tbl([3000, 6360], [
    ["Component", "Standard or new?"],
    ["LCS / LCS3 dynamic programs, rolling two-layer arrays, branch-and-bound with best-first order", "Standard techniques from the course and textbook."],
    ["Pairwise-LCS upper bound for a cut (Lemma 3)", "New for this problem: a relaxation of LCS3 to its three pairs."],
    ["All O(_n_²) cut bounds in O(_n_³) total via prefix-row reuse and string reversal (Lemma 4)", "New observation; the main algorithmic idea."],
    ["Letter filter (Lemma 2) and single-letter starting answer", "Simple problem-specific observations."],
    ["Exactly one LCS3 evaluation on a perfect cube (Theorem 6)", "New analysis of a special case."],
  ]),
  Caption("Table 1. What is standard and what is specific to this work."),

  H2("3.1 The algorithm"),
  N("**Letter filter.** Delete every letter that occurs fewer than 3 times in _S_. **Lemma 2:** such a letter cannot occur in any feasible _X_, because each letter of _X_ appears three times in _C_; so the answer is unchanged, and an _X_ found in the filtered string is also valid in _S_.", "steps2"),
  N("**Starting answer.** With _c_ the most frequent letter, _X_ = _c_^⌊count(_c_)/3⌋ is always feasible. Its length is the first value to beat, _best_.", "steps2"),
  N("**Upper bound for every cut.** **Lemma 3:** LCS3(_A_,_B_,_C_) ≤ UB(_i_,_j_) = min(LCS(_A_,_B_), LCS(_B_,_C_), LCS(_A_,_C_)), since a common subsequence of all three strings is common to every pair. **Lemma 4:** UB can be computed for all cuts in O(_n_³) total time and O(_n_²) memory. _Proof._ One row-by-row LCS DP of _U_ against _V_ gives LCS(_U_[0,_t_), _V_) for every prefix length _t_ in O(|_U_||_V_|) time. (a) LCS(_A_,_B_): fix _i_, take _U_ = _S_[_i_,_n_), _V_ = _S_[0,_i_); prefix _t_ gives _j_ = _i_+_t_. (b) LCS(_B_,_C_): here the start of _B_ moves, which is not a prefix. Since LCS(_U_,_V_) = LCS(rev _U_, rev _V_), fix _j_ and take _U_ = rev(_S_[0,_j_)), _V_ = rev(_S_[_j_,_n_)): prefixes of _U_ are exactly the reversed _B_ = _S_[_j_−_t_,_j_). (c) LCS(_A_,_C_): fix _i_, _U_ = rev(_S_[_i_,_n_)), _V_ = rev(_S_[0,_i_)); prefix _t_ gives _C_ = _S_[_n_−_t_,_n_). Each family costs Σ O(_n_²) over _n_+1 choices, so O(_n_³) in total. ∎", "steps2"),
  N("**Best-first search.** Discard cuts with UB ≤ _best_, sort the rest by decreasing UB (ties: most balanced cut first) and scan them. Stop at the first cut with UB ≤ _best_. Otherwise compute LCS3 of the cut with two rolling layers of size (|_B_|+1)(|_C_|+1), aborting early when the current layer value plus the number of remaining letters of _A_ is ≤ _best_. Update _best_ on improvement.", "steps2"),
  N("Recover _X_ once, for the winning cut, with the baseline's full table and walk-back.", "steps2"),
  P("**Correctness (Lemma 5).** A cut is skipped or the scan stops only when UB ≤ _best_, or when the early-abort bound (each remaining letter of _A_ adds at most 1) is ≤ _best_. By Lemma 3, such a cut cannot give a strictly longer _X_, and because the list is sorted, neither can any later one. Every cut that could improve the answer is therefore evaluated exactly, and by Lemmas 1 and 2 the result is optimal."),
  P("**Complexity.** O(_n_) filtering, O(_n_³) bounds, O(_n_² log _n_) sorting, plus Σ |_A_||_B_||_C_| over the evaluated cuts. In the worst case nothing is pruned and this is O(_n_⁵), so the improvement is not asymptotic for arbitrary inputs. Memory drops to O(_n_²) (the bound table) plus O(_n_²) for the rolling layers."),

  H2("3.2 Special cases with guarantees"),
  P("**Theorem 6 (perfect cubes).** If _S_ = _Y_·_Y_·_Y_ with |_Y_| = _m_, fasterAlgo performs exactly one LCS3 evaluation. _Proof._ For every cut, UB ≤ min(|_A_|,|_B_|,|_C_|) ≤ _m_, and the cut (_m_,2_m_) is the only one with min(|_A_|,|_B_|,|_C_|) = _m_. It has UB = _m_ and LCS3 = _m_ (take _X_ = _Y_), so with the balanced tie-break it is the first cut scanned with UB = _m_. If _best_ is already _m_ nothing is evaluated (see the unary case). Otherwise it is evaluated, sets _best_ = _m_, and the next cut has UB ≤ _m_, so the scan stops. ∎ The experiments match this: at 0% noise, about 1 of 20,301 cuts is evaluated (Figure 2b)."),
  P("**Unary strings.** If _S_ = _a_ⁿ, the starting answer ⌊_n_/3⌋ already equals the largest possible UB, so no LCS3 is evaluated at all and the run takes O(_n_³) for the bounds. More generally, Theorem 6 explains the behaviour of near-cubes: with a little noise the optimum stays close to the largest bound, so very few cuts survive (Section 4)."),

  H2("3.3 An approach that did not work, and the use of AI tools"),
  P("For the related longest _square_ subsequence problem, LCS(_S_[0,_i_), _S_[_i_,_n_)) can be found for all _i_ faster than one DP per cut, because each pair of strings shares a single moving boundary. We first expected the same reuse to give an O(_n_⁴) algorithm for cubes: fix _i_ and reuse work over all _j_. It does not carry over. For fixed _i_, _B_ = _S_[_i_,_j_) grows at its end as _j_ increases, but _C_ = _S_[_j_,_n_) loses letters at its start. A single three-dimensional DP can index _B_ by prefixes, or (after reversal) _C_ by prefixes, but not both in the same direction, so the table for one _j_ cannot be reused for the next. Whether LCubS can be solved in _o_(_n_⁵) time in general remains open for us. This failure is why we moved from a faster exact recurrence to a pruning approach."),
  P("[[Ayo: rewrite this paragraph honestly in your own words. Suggested facts:]] An AI coding assistant (Claude) was used during development. The standard parts (LCS/LCS3 DPs, rolling arrays, branch-and-bound) were taken directly from known techniques. The pairwise-LCS bound, the reversal trick of Lemma 4, the experiment design and much of the code came out of interactive sessions with the assistant. The assistant's first suggestion, an O(_n_⁴) algorithm, turned out to be wrong for the reason above and was discarded. Theorem 6 came from studying the noise experiment. [[State which ideas, checks and decisions were yours.]]"),

  H1("4. Experimental evaluation"),
  P("**Setup.** Both programs are C++17, compiled with Apple clang 21 at `-O2`, on an Apple M1 laptop with 8 GB RAM. Each run is a separate process timed by the Python driver `experiments/run.py` (wall clock, including about 2 ms of start-up). Each data point is the median over 3 random strings. Three workloads are used: **random DNA** (uniform over {a,c,g,t}), **random binary**, and **near-cube** (_Y_·_Y_·_Y_ with random _Y_ of length _n_/3, then each position replaced by a random letter with probability _p_ = 10%). For the scaling experiment, _n_ grows over 20, 40, …, 1200 until a run exceeds a 30 s limit. **Correctness checks:** both programs match an exponential brute force on 409 random and hand-picked strings with _n_ ≤ 14 (`make test`), and the driver stops with an error if the two programs ever report different lengths (none occurred)."),
  Tbl([2900, 1450, 1450, 1450, 1050, 1060], [
    ["Workload", "baseline: largest n (time)", "fasterAlgo: largest n (time)", "Speedup at n = 250", "Slope baseline", "Slope faster"],
    ["Random DNA (σ = 4)", "250 (16.3 s)", "400 (21.1 s)", "14×", "4.99", "5.12"],
    ["Random binary (σ = 2)", "250 (12.8 s)", "500 (8.0 s)", "45×", "4.97", "4.99"],
    ["Near-cube, 10% noise", "250 (15.9 s)", "700 (11.6 s)", "183×", "5.03", "4.61"],
  ]),
  Caption("Table 2. Largest size solved within 30 s (the next size on the grid timed out), speedup, and empirical growth exponent (least-squares slope of log time against log n for n ≥ 100)."),
  Img("fig1_scaling.png", 540, 347),
  Caption("Figure 1. Running time against n on log-log axes. The grey line has slope 5."),
  P("**Scalability (Figure 1, Table 2).** The baseline follows the Θ(_n_⁵) prediction almost exactly (slopes 4.97 to 5.03), and its time hardly depends on the input type. fasterAlgo solves inputs 1.6× (random DNA) to 2.8× (near-cube) longer within the same limit. On random strings, however, its slope is still about 5: pruning removes a roughly constant share of the work, so the gain is a constant factor (about 13× for DNA, 30 to 70× for binary), not a better exponent. Only near-cubes show a smaller slope (4.6)."),
  Img("fig2_noise.png", 600, 240),
  Caption("Figure 2. Effect of noise at n = 200: (a) running time; (b) share of cuts that survive the initial bound and that are fully evaluated."),
  P("**Distance from a cube (Figure 2).** The baseline takes 5.0 to 5.1 s at every noise level. fasterAlgo evaluates about 1 cut out of 20,301 at 0 to 5% noise (as Theorem 6 predicts), 0.02% at 10%, and then rises sharply between 10% and 30%, levelling off at about 4% of cuts (0.4 s) once _S_ is essentially random. Note that about 40% of cuts survive the _initial_ bound check at every noise level: the pruning comes almost entirely from _best_ quickly reaching the optimum during the best-first scan."),
  P("**Discussion.** (1) _Share of cuts is not share of work._ On random DNA only 4% of cuts are evaluated, yet the speedup is about 13×, not 25×. The surviving cuts are the balanced ones (all blocks near _n_/3), which are also the most expensive, since cost grows with |_A_||_B_||_C_|. (2) _Alphabet size_ (Figure 3, Appendix A): fasterAlgo slows from 0.004 s at σ = 1 to 0.5 s at σ = 26 for _n_ = 150, while the baseline stays at 1.0 to 1.5 s. As σ grows the answer shrinks faster than the pairwise LCS values, so the bound becomes looser. (3) _Unexpected behaviour:_ at σ = 1 the baseline is about 3× faster than at σ = 26, because every comparison takes the cheap 'match' branch of the recurrence. The noise curve is also not monotone (30% is slower than 40%), which we attribute to using only 3 samples per point. (4) The letter filter never triggered in these tests, because every letter occurs at least 3 times once _n_ ≥ 150. It only helps on inputs with many rare letters. **Weakness:** no worst-case guarantee; adversarial inputs where every pairwise LCS greatly exceeds LCS3 would remove most of the benefit."),

  // ---------------- APPENDIX ----------------
  new Paragraph({ children: [new PageBreak()] }),
  H1("Appendix A. Additional figures"),
  Img("fig3_alphabet.png", 540, 309),
  Caption("Figure 3. Running time against alphabet size σ at n = 150 (left axis), with the optimal length 3|X| (right axis, grey)."),
  Img("fig4_bound.png", 540, 309),
  Caption("Figure 4. Percentage of cuts for which fasterAlgo computes a full LCS3, against n (mean of 3 strings)."),
  Tbl([2400, 1000, 2900, 3060], [
    ["Workload", "n", "Cuts surviving initial bound", "Cuts fully evaluated"],
    ["Random DNA", "400", "45.1%", "3.91%"],
    ["Random binary", "400", "19.4%", "1.09%"],
    ["Near-cube, 10% noise", "400", "42.8%", "0.30%"],
  ]),
  Caption("Table 3. Pruning statistics from experiments/results/bound.csv."),

  H1("Appendix B. GitHub development history"),
  P("Repository: github.com/ayoogunade/lcubs (private; [[add the instructor/TA as a collaborator or make it visible]]). Commit history so far:"),
  Tbl([1200, 1900, 6260], [
    ["Commit", "Date", "Message"],
    ["ca88edb", "2026-11-17 14:44", "Project setup and O(n^5) baseline for LCubS"],
    ["e898851", "2026-11-25 00:25", "fasterAlgo: branch-and-bound with pairwise-LCS upper bounds"],
    ["ad41013", "2026-11-25 00:29", "Experiment runner and plotting scripts"],
    ["390b3d9", "2026-11-25 00:46", "Full experiment run: results CSVs, log, figures, summary tables"],
  ]),
  P("[[Insert screenshots: (1) the GitHub commit history page, (2) a terminal running `make test` showing both solvers passing, (3) part of experiments/results/run_log.txt, (4) a code snapshot of lcsByPrefix / the bound computation in fasterAlgo.cpp.]]"),
  P("[[Ayo: the rubric asks for substantial progress before the midterm break. Work on this repository started on 2026-11-17. If you have earlier notes or attempts, mention them here; otherwise say so plainly. Do not alter commit dates.]]"),

  H1("Appendix C. How to run"),
  P("`make` builds `bin/baseline` and `bin/fasterAlgo`. Run `./bin/fasterAlgo atcgtatgcatgca` (or pipe _S_ on stdin). The output is the length 3|_X_|, then _X_, then _C_ = _X_._X_._X_; fasterAlgo also prints pruning statistics on stderr. `make test` runs the brute-force comparison. `experiments/run.py` reproduces every experiment and `experiments/plot.py` regenerates all figures and tables (see the readme)."),
];

const doc = new Document({
  creator: "Ayo Ogunade",
  title: "LCubS Algorithm Design Report",
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 26, bold: true, color: "1F3864" },
        paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 22, bold: true, color: "2E4A70" },
        paragraph: { spacing: { before: 140, after: 60 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "steps2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 400, hanging: 300 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(OUT, buf); console.log("wrote " + OUT); });
