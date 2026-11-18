// Word-level comparison of a target sentence with what dictation heard (LCS). Pure.
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// Hyphenated words ("e-post") count as their parts, since dictation often splits them.
const parts = (w) => w.split(/[-‐–]/).map(norm).filter(Boolean);

export function compareWords(expected, heard) {
  const words = String(expected).trim().split(/\s+/).filter(Boolean);
  const owner = []; // token index -> display word index
  const a = [];
  words.forEach((w, wi) => parts(w).forEach((p) => { a.push(p); owner.push(wi); }));
  const b = String(heard || "").trim().split(/\s+/).flatMap(parts);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const wordOk = words.map(() => true);
  a.forEach((_, i) => { if (!hit[i]) wordOk[owner[i]] = false; });
  const hits = hit.filter(Boolean).length;
  return { words: words.map((word, i) => ({ word, ok: wordOk[i] })), score: n ? Math.round((hits / n) * 100) : 0 };
}
