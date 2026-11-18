// Leitner-style spaced repetition. Pure functions, no mutation.
export const BOX_DAYS = [0, 1, 3, 7, 14, 30];
const DAY = 86400000;
const MAX_BOX = BOX_DAYS.length - 1;

export function newItem(fields, now) {
  return { ...fields, box: 0, due: now.toISOString(), seen: 0, correct: 0 };
}

export function review(item, correct, now) {
  const seen = (item.seen || 0) + 1;
  if (!correct) {
    return { ...item, box: 0, due: now.toISOString(), seen };
  }
  const box = Math.min((item.box || 0) + 1, MAX_BOX);
  return {
    ...item,
    box,
    due: new Date(now.getTime() + BOX_DAYS[box] * DAY).toISOString(),
    seen,
    correct: (item.correct || 0) + 1,
  };
}

export function dueItems(items, now, limit = 20) {
  const t = now.getTime();
  return items
    .filter((i) => new Date(i.due).getTime() <= t)
    .sort((a, b) => (a.box || 0) - (b.box || 0) || new Date(a.due) - new Date(b.due))
    .slice(0, limit);
}
