import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, topicsFor, needsPlacement, shouldSuggestRetest, streak, dayKey } from "../js/level.js";

test("LEVELS are A1..C1", () => {
  assert.deepEqual(LEVELS, ["A1", "A2", "B1", "B2", "C1"]);
});

test("every level has at least 6 topics with id, de, sv", () => {
  for (const l of LEVELS) {
    const t = topicsFor(l);
    assert.ok(t.length >= 6, l);
    for (const x of t) assert.ok(x.id && x.de && x.sv, JSON.stringify(x));
  }
});

test("unknown level falls back to A1 topics", () => {
  assert.deepEqual(topicsFor("X9"), topicsFor("A1"));
});

test("needsPlacement only when no profile or no level", () => {
  assert.equal(needsPlacement(null), true);
  assert.equal(needsPlacement({}), true);
  assert.equal(needsPlacement({ level: "A2" }), false);
});

test("retest suggested from 14 days on", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  assert.equal(shouldSuggestRetest("2026-11-05T12:00:00Z", now), false);
  assert.equal(shouldSuggestRetest("2026-11-04T12:00:00Z", now), true);
  assert.equal(shouldSuggestRetest(undefined, now), false);
});

test("streak counts consecutive days ending today", () => {
  assert.equal(streak(["2026-11-16", "2026-11-17", "2026-11-18"], "2026-11-18"), 3);
});

test("streak counts only the latest run after a gap", () => {
  assert.equal(streak(["2026-11-10", "2026-11-17", "2026-11-18"], "2026-11-18"), 2);
});

test("streak still counts when last practice was yesterday", () => {
  assert.equal(streak(["2026-11-16", "2026-11-17"], "2026-11-18"), 2);
});

test("streak is 0 when empty or older than yesterday", () => {
  assert.equal(streak([], "2026-11-18"), 0);
  assert.equal(streak(["2026-11-15"], "2026-11-18"), 0);
});

test("streak ignores duplicates and order", () => {
  assert.equal(streak(["2026-11-18", "2026-11-17", "2026-11-18"], "2026-11-18"), 2);
});

test("streak crosses month boundaries", () => {
  assert.equal(streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2);
});

test("dayKey uses local date as YYYY-MM-DD", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});
