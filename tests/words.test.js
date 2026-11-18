import { test } from "node:test";
import assert from "node:assert/strict";
import { tokenize } from "../js/words.js";

test("tokenize keeps every character and marks words", () => {
  const t = tokenize("Hej! Vad gör du i helgen?");
  assert.equal(t.map((x) => x.text).join(""), "Hej! Vad gör du i helgen?");
  assert.deepEqual(t.filter((x) => x.word).map((x) => x.text), ["Hej", "Vad", "gör", "du", "i", "helgen"]);
});

test("tokenize treats å ä ö, hyphens and colon-forms as part of a word", () => {
  const words = tokenize("Får jag en kaffe-latte på SL:s buss?").filter((x) => x.word).map((x) => x.text);
  assert.deepEqual(words, ["Får", "jag", "en", "kaffe-latte", "på", "SL:s", "buss"]);
});

test("tokenize handles empty text", () => {
  assert.deepEqual(tokenize(""), []);
});
