import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseFor, localMatch } from "../js/exercise.js";

test("vocab with German becomes de2sv or sv2de depending on rnd", () => {
  const v = { kind: "vocab", sv: "ett hus", de: "Haus" };
  const a = exerciseFor(v, 0.1);
  assert.equal(a.mode, "de2sv");
  assert.equal(a.expected, "ett hus");
  assert.equal(a.answerLang, "sv");
  const b = exerciseFor(v, 0.9);
  assert.equal(b.mode, "sv2de");
  assert.equal(b.expected, "Haus");
  assert.equal(b.answerLang, "de");
  assert.equal(b.listen, "ett hus");
});

test("vocab without German is always sv2de with self-check", () => {
  const e = exerciseFor({ kind: "vocab", sv: "hus", de: "" }, 0.1);
  assert.equal(e.mode, "sv2de");
  assert.equal(e.selfCheck, true);
});

test("mistake becomes a fix exercise", () => {
  const e = exerciseFor({ kind: "mistake", wrong: "jag gå igår", right: "jag gick igår", rule_de: "Präteritum" }, 0.5);
  assert.equal(e.mode, "fix");
  assert.equal(e.show, "jag gå igår");
  assert.equal(e.expected, "jag gick igår");
  assert.equal(e.answerLang, "sv");
  assert.equal(e.hint, "Präteritum");
});

test("localMatch ignores case, spaces and punctuation", () => {
  assert.equal(localMatch(" Ett hus. ", "ett hus"), true);
  assert.equal(localMatch("ett huss", "ett hus"), false);
  assert.equal(localMatch("", "hus"), false);
});

test("localMatch accepts listed alternatives", () => {
  assert.equal(localMatch("Gebäude", "Haus / Gebäude"), true);
  assert.equal(localMatch("ja", "Ja, jag kommer"), false);
  assert.equal(localMatch("ja jag kommer", "Ja, jag kommer."), true);
  assert.equal(localMatch("Haus", "Haus; Heim"), true);
});
