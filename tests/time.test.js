import { test } from "node:test";
import assert from "node:assert/strict";
import { accumulate, MAX_GAP_MS } from "../js/time.js";

test("accumulate adds the gap since the last activity", () => {
  assert.equal(accumulate(1000, 10_000, 70_000), 61_000);
});

test("accumulate ignores gaps longer than MAX_GAP_MS (learner left)", () => {
  assert.equal(MAX_GAP_MS, 5 * 60_000);
  assert.equal(accumulate(60_000, 0, 14 * 3600_000), 60_000);
});

test("accumulate handles missing lastAt and clock skew", () => {
  assert.equal(accumulate(0, null, 5000), 0);
  assert.equal(accumulate(500, 10_000, 9_000), 500);
});

import { createActiveClock } from "../js/time.js";

function fakeNow(start = 0) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => (t += ms);
  return now;
}

test("active clock: a page left open for hours before practising counts only practice time", () => {
  const now = fakeNow();
  const clock = createActiveClock(now);
  now.advance(10 * 3600_000); // tab open overnight
  clock.touch();
  for (let i = 0; i < 8; i++) { now.advance(60_000); clock.touch(); }
  assert.equal(clock.minutes(), 8);
});

test("active clock: steady activity counts from the start, idle gaps are skipped", () => {
  const now = fakeNow();
  const clock = createActiveClock(now);
  now.advance(2 * 60_000); clock.touch();
  now.advance(30 * 60_000); clock.touch(); // away
  now.advance(3 * 60_000);
  assert.equal(clock.minutes(), 5); // minutes() counts the gap up to now too
});

test("active clock: reset starts a new exercise, minutes() is at least 1", () => {
  const now = fakeNow();
  const clock = createActiveClock(now);
  now.advance(4 * 60_000); clock.touch();
  clock.reset();
  now.advance(10_000);
  assert.equal(clock.minutes(), 1);
});
