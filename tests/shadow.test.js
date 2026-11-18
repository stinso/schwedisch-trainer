import { test } from "node:test";
import assert from "node:assert/strict";
import { compareWords } from "../js/shadow.js";
import { shadowPrompt, parseShadow } from "../js/prompts.js";

test("identical sentence scores 100 with all words ok", () => {
  const r = compareWords("Jag bor i Malmö.", "jag bor i malmö");
  assert.equal(r.score, 100);
  assert.ok(r.words.every((w) => w.ok));
  assert.deepEqual(r.words.map((w) => w.word), ["Jag", "bor", "i", "Malmö."]);
});

test("missing and misheard words are marked, score is share of matched words", () => {
  const r = compareWords("Jag skulle vilja ha en kaffe", "jag ville ha en kaffe");
  assert.deepEqual(r.words.map((w) => w.ok), [true, false, false, true, true, true]);
  assert.equal(r.score, 67);
});

test("extra heard words do not raise the score", () => {
  const r = compareWords("hej", "hej hej hallå");
  assert.equal(r.score, 100);
});

test("empty heard text scores 0", () => {
  assert.equal(compareWords("Hej då", "").score, 0);
});

test("shadowPrompt and parseShadow", () => {
  assert.match(shadowPrompt("B1", "Reisen"), /B1/);
  const s = parseShadow({ sentences: [{ sv: "Hej!", de: "Hallo!", tip_de: "" }, { sv: "", de: "x" }] });
  assert.deepEqual(s, [{ sv: "Hej!", de: "Hallo!", tip_de: "" }]);
  assert.throws(() => parseShadow({ sentences: [] }));
});
