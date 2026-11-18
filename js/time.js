// Active practice time: add the gap since the last activity, unless the learner was away.
export const MAX_GAP_MS = 5 * 60_000;

export function accumulate(activeMs, lastAt, now, maxGap = MAX_GAP_MS) {
  if (lastAt == null) return activeMs;
  const gap = now - lastAt;
  if (gap <= 0 || gap > maxGap) return activeMs;
  return activeMs + gap;
}

// One exercise's active time: starts now, every touch() adds the gap since the last one
// unless the learner was away. minutes() rounds and never reports less than 1.
export function createActiveClock(now = () => Date.now(), maxGap = MAX_GAP_MS) {
  let active = 0;
  let last = now();
  const clock = {
    touch() {
      const t = now();
      active = accumulate(active, last, t, maxGap);
      last = t;
    },
    reset() {
      active = 0;
      last = now();
    },
    minutes() {
      clock.touch();
      return Math.max(1, Math.round(active / 60000));
    },
  };
  return clock;
}
