import { test } from "node:test";
import assert from "node:assert/strict";
import { BOX_DAYS, newItem, review, dueItems } from "../js/srs.js";

const NOW = new Date("2026-11-18T08:00:00Z");
const DAY = 86400000;

test("BOX_DAYS matches the plan", () => {
  assert.deepEqual(BOX_DAYS, [0, 1, 3, 7, 14, 30]);
});

test("newItem starts in box 0, due now, with zero counters", () => {
  const it = newItem({ sv: "hus" }, NOW);
  assert.equal(it.sv, "hus");
  assert.equal(it.box, 0);
  assert.equal(it.due, NOW.toISOString());
  assert.equal(it.seen, 0);
  assert.equal(it.correct, 0);
});

test("correct answer from box 0 moves to box 1, due in 1 day", () => {
  const it = review(newItem({}, NOW), true, NOW);
  assert.equal(it.box, 1);
  assert.equal(it.due, new Date(NOW.getTime() + DAY).toISOString());
  assert.equal(it.seen, 1);
  assert.equal(it.correct, 1);
});

test("correct answer in box 5 stays in box 5, due in 30 days", () => {
  const it = review({ ...newItem({}, NOW), box: 5 }, true, NOW);
  assert.equal(it.box, 5);
  assert.equal(it.due, new Date(NOW.getTime() + 30 * DAY).toISOString());
});

test("wrong answer resets to box 0, due now, counts seen only", () => {
  const start = { ...newItem({}, NOW), box: 3, seen: 4, correct: 3 };
  const it = review(start, false, NOW);
  assert.equal(it.box, 0);
  assert.equal(it.due, NOW.toISOString());
  assert.equal(it.seen, 5);
  assert.equal(it.correct, 3);
});

test("review does not mutate the input", () => {
  const start = newItem({}, NOW);
  review(start, true, NOW);
  assert.equal(start.box, 0);
});

test("dueItems excludes future, orders by box then due, respects limit", () => {
  const iso = (ms) => new Date(NOW.getTime() + ms).toISOString();
  const items = [
    { id: "future", box: 0, due: iso(DAY) },
    { id: "b2old", box: 2, due: iso(-3 * DAY) },
    { id: "b0new", box: 0, due: iso(-1000) },
    { id: "b0old", box: 0, due: iso(-2 * DAY) },
  ];
  assert.deepEqual(dueItems(items, NOW).map((i) => i.id), ["b0old", "b0new", "b2old"]);
  assert.deepEqual(dueItems(items, NOW, 2).map((i) => i.id), ["b0old", "b0new"]);
});
