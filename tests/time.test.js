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
