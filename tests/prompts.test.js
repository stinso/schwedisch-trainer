import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ParseError, trimHistory, conversationInput,
  correctionPrompt, parseCorrection,
  evaluationPrompt, parseEvaluation,
  listeningPrompt, parseListening,
  gradePrompt, parseGrades,
  placementPrompt, parsePlacement, placementItems,
  reviewCheckPrompt, parseReviewCheck,
} from "../js/prompts.js";
import { LEVELS } from "../js/level.js";

const turns = (n) =>
  Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "user" : "assistant", content: "t" + i }));

test("trimHistory keeps the last N turns", () => {
  const h = trimHistory(turns(30), 20);
  assert.equal(h.length, 20);
  assert.equal(h[19].content, "t29");
  assert.equal(trimHistory(turns(3)).length, 3);
});

test("conversationInput with empty history starts and ends on user and names level and topic", () => {
  const m = conversationInput("A2", "Im Café", []);
  assert.equal(m[0].role, "user");
  assert.equal(m.at(-1).role, "user");
  assert.match(m[0].content, /A2/);
  assert.match(m[0].content, /Im Café/);
});

test("conversationInput with history ends on the last user turn and trims to 20", () => {
  const h = [...turns(40), { role: "user", content: "last" }];
  const m = conversationInput("B1", "Reisen", h);
  assert.equal(m[0].role, "user");
  assert.equal(m.at(-1).content, "last");
  assert.equal(m.length, 21);
});

test("conversationInput never sends a leading assistant turn after the rules", () => {
  const m = conversationInput("B1", "Reisen", [{ role: "assistant", content: "Hej!" }, { role: "user", content: "Hej" }]);
  assert.equal(m[0].role, "user");
  assert.equal(m.at(-1).role, "user");
});

test("prompts contain their inputs", () => {
  assert.match(correctionPrompt("A1", "Vad heter du?", "Jag heta Marc"), /Jag heta Marc/);
  assert.match(evaluationPrompt("A2", "Familie", [{ role: "user", content: "Jag har en bror" }]), /Jag har en bror/);
  assert.match(listeningPrompt("B2", "Klima"), /B2/);
  assert.match(gradePrompt([{ q_de: "Wo?", answer_de: "Stockholm", user: "Stockholm" }]), /Stockholm/);
  assert.match(placementPrompt([{ task: "read", prompt: "Jag bor i Malmö", answer: "Ich wohne in Malmö" }]), /Malmö/);
  assert.match(reviewCheckPrompt({ prompt_de: "Haus", answer_sv: "hus" }, "huset"), /huset/);
});

test("parseCorrection happy path and natural fallback", () => {
  const c = parseCorrection({ ok: false, corrected: "Jag heter Marc", explanation_de: "heta → heter" });
  assert.equal(c.ok, false);
  assert.equal(c.natural, "Jag heter Marc");
  assert.equal(c.explanation_de, "heta → heter");
});

test("parseCorrection requires corrected", () => {
  assert.throws(() => parseCorrection({ ok: true }), ParseError);
  assert.throws(() => parseCorrection(null), ParseError);
});

test("parseEvaluation normalises arrays and caps mistakes at 5", () => {
  const e = parseEvaluation({
    summary_de: "Gut!",
    mistakes: Array.from({ length: 8 }, (_, i) => ({ wrong: "w" + i, right: "r" + i, rule_de: "x" })).concat([{ right: "no wrong" }]),
    phrases: "nope",
    vocab: [{ sv: "hus", de: "Haus" }, { de: "ohne sv" }],
  });
  assert.equal(e.mistakes.length, 5);
  assert.deepEqual(e.phrases, []);
  assert.deepEqual(e.vocab, [{ sv: "hus", de: "Haus" }]);
});

test("parseEvaluation requires summary_de", () => {
  assert.throws(() => parseEvaluation({ mistakes: [] }), ParseError);
});

test("parseListening coerces speakers and requires lines and questions", () => {
  const l = parseListening({
    title_sv: "På tåget",
    lines: [{ speaker: "x", sv: "Hej", de: "Hallo" }, { speaker: "B", sv: "Hej hej", de: "Hallo hallo" }],
    questions: [{ q_de: "Wo?", answer_de: "Im Zug" }],
  });
  assert.equal(l.lines[0].speaker, "A");
  assert.equal(l.lines[1].speaker, "B");
  assert.throws(() => parseListening({ lines: [l.lines[0]], questions: l.questions }), ParseError);
  assert.throws(() => parseListening({ lines: l.lines, questions: [] }), ParseError);
});

test("parseGrades requires matching length", () => {
  assert.deepEqual(parseGrades([{ correct: true, feedback_de: "ok" }], 1), [{ correct: true, feedback_de: "ok" }]);
  assert.throws(() => parseGrades([{ correct: true }, { correct: false }], 3), ParseError);
  assert.throws(() => parseGrades({}, 1), ParseError);
});

test("parsePlacement validates the level", () => {
  assert.deepEqual(parsePlacement({ level: "B1", reason_de: "weil" }), { level: "B1", reason_de: "weil" });
  assert.throws(() => parsePlacement({ level: "X1" }), ParseError);
});

test("parseReviewCheck returns boolean correct", () => {
  assert.deepEqual(parseReviewCheck({ correct: "yes", feedback_de: "" }), { correct: true, feedback_de: "" });
  assert.throws(() => parseReviewCheck(null), ParseError);
});

test("placementItems has two items per level with known tasks", () => {
  const items = placementItems();
  for (const l of LEVELS) assert.equal(items.filter((i) => i.level === l).length, 2, l);
  for (const i of items) {
    assert.ok(["listen", "read", "speak"].includes(i.task));
    assert.ok(i.prompt_sv && i.question_de);
  }
});

import { howToSayPrompt, parseHowToSay } from "../js/prompts.js";

test("howToSay prompt includes the German phrase and level", () => {
  const p = howToSayPrompt("A2", "Reisen", "Ich habe meinen Zug verpasst");
  assert.match(p, /Ich habe meinen Zug verpasst/);
  assert.match(p, /A2/);
});

test("parseHowToSay requires sv", () => {
  assert.deepEqual(parseHowToSay({ sv: "Jag missade tåget.", note_de: "" }), { sv: "Jag missade tåget.", note_de: "" });
  assert.throws(() => parseHowToSay({ note_de: "x" }), ParseError);
});
