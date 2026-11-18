// Active practice time: add the gap since the last activity, unless the learner was away.
export const MAX_GAP_MS = 5 * 60_000;

export function accumulate(activeMs, lastAt, now, maxGap = MAX_GAP_MS) {
  if (lastAt == null) return activeMs;
  const gap = now - lastAt;
  if (gap <= 0 || gap > maxGap) return activeMs;
  return activeMs + gap;
}
