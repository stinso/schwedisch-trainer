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

test("parseCorrection falls back to the learner's text when ok and corrected is empty", () => {
  const c = parseCorrection({ ok: true, corrected: "" }, "Jag heter Marc");
  assert.equal(c.corrected, "Jag heter Marc");
  assert.equal(c.ok, true);
});

test("parseEvaluation drops mistakes without a correction", () => {
  const e = parseEvaluation({ summary_de: "s", mistakes: [{ wrong: "a", right: "" }, { wrong: "b", right: "c" }] });
  assert.deepEqual(e.mistakes.map((m) => m.wrong), ["b"]);
});

import { missionsFor } from "../js/level.js";

test("every level has at least 4 missions with role and goal", () => {
  for (const l of LEVELS) {
    const ms = missionsFor(l);
    assert.ok(ms.length >= 4, l);
    for (const m of ms) assert.ok(m.id && m.de && m.role_de && m.goal_de, JSON.stringify(m));
  }
});

test("conversationInput with a mission puts role and goal into the rules", () => {
  const m = { id: "x", de: "Im Café bestellen", role_de: "Barista in einem Café in Stockholm", goal_de: "Bestelle einen Kaffee und eine Zimtschnecke" };
  const msgs = conversationInput("A1", m.de, [], m);
  assert.match(msgs[0].content, /Barista/);
  assert.match(msgs[0].content, /Zimtschnecke/);
  assert.equal(msgs.at(-1).role, "user");
});

test("evaluationPrompt with mission asks for goal_reached; parser keeps it", () => {
  const m = { goal_de: "Bestelle einen Kaffee" };
  assert.match(evaluationPrompt("A1", "Café", [{ role: "user", content: "En kaffe" }], m), /goal_reached/);
  assert.equal(parseEvaluation({ summary_de: "s", goal_reached: true }).goal_reached, true);
  assert.equal(parseEvaluation({ summary_de: "s" }).goal_reached, null);
});

import { grammarPrompt, parseGrammar, shadowPrompt } from "../js/prompts.js";

test("grammarPrompt names the mistake and level", () => {
  const p = grammarPrompt("A2", { wrong: "jag gå igår", right: "jag gick igår", rule_de: "Präteritum" });
  assert.match(p, /jag gå igår/);
  assert.match(p, /A2/);
});

test("parseGrammar requires explanation and exercises", () => {
  const g = parseGrammar({
    title_de: "Präteritum",
    lesson_de: "So geht's",
    examples: [{ sv: "Jag gick", de: "Ich ging" }, { de: "ohne sv" }],
    exercises: [{ prompt_de: "Ich ging nach Hause", answer_sv: "Jag gick hem" }, { prompt_de: "x" }],
  });
  assert.equal(g.examples.length, 1);
  assert.equal(g.exercises.length, 1);
  assert.throws(() => parseGrammar({ lesson_de: "x", exercises: [] }), ParseError);
  assert.throws(() => parseGrammar({ exercises: [{ prompt_de: "a", answer_sv: "b" }] }), ParseError);
});

test("evaluation JSON example includes goal_reached only with a mission", () => {
  const h = [{ role: "user", content: "x" }];
  assert.match(evaluationPrompt("A1", "t", h, { goal_de: "g" }), /\{"goal_reached": true/);
  assert.doesNotMatch(evaluationPrompt("A1", "t", h), /"goal_reached"/);
});

test("shadowPrompt asks for numbers written as words", () => {
  assert.match(shadowPrompt("A1", "x"), /Ziffern/);
});

import { translatePrompt, parseTranslate, explainPrompt, parseExplain } from "../js/prompts.js";

test("translate prompt carries the Swedish text and asks for German", () => {
  const p = translatePrompt("B1", "Vad tycker du om det?");
  assert.match(p, /Vad tycker du om det\?/);
  assert.match(p, /Deutsch/);
});

test("parseTranslate requires de", () => {
  assert.deepEqual(parseTranslate({ de: "Was hältst du davon?" }), { de: "Was hältst du davon?" });
  assert.throws(() => parseTranslate({}), ParseError);
});

test("explain prompt names the phrase, its sentence and the level", () => {
  const p = explainPrompt("B1", "tycker", "Vad tycker du om det?");
  assert.match(p, /"tycker"/);
  assert.match(p, /Vad tycker du om det\?/);
  assert.match(p, /B1/);
});

test("parseExplain requires de and falls back to the clicked phrase", () => {
  assert.deepEqual(
    parseExplain({ base_sv: "tycka", de: "meinen, finden", note_de: "tycka om = mögen" }, "tycker"),
    { phrase: "tycker", base_sv: "tycka", de: "meinen, finden", note_de: "tycka om = mögen" }
  );
  assert.equal(parseExplain({ de: "finden" }, "tycker").base_sv, "tycker");
  assert.throws(() => parseExplain({ note_de: "x" }, "tycker"), ParseError);
});
