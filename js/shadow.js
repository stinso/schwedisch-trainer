// Word-level comparison of a target sentence with what dictation heard (LCS). Pure.
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function compareWords(expected, heard) {
  const words = String(expected).trim().split(/\s+/).filter(Boolean);
  const a = words.map(norm);
  const b = String(heard || "").trim().split(/\s+/).map(norm).filter(Boolean);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] && a[i] === b[j]) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const counted = a.filter(Boolean).length || 1;
  const hits = ok.filter(Boolean).length;
  return { words: words.map((word, i) => ({ word, ok: ok[i] || !a[i] })), score: Math.round((hits / counted) * 100) };
}
