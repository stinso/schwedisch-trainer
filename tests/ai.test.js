import { test } from "node:test";
import assert from "node:assert/strict";
import { createAI, aiErrorMessage } from "../js/ai.js";
import { ParseError } from "../js/prompts.js";

function fakeSample({ text = "Hej!", json = {}, reject = null } = {}) {
  const calls = [];
  const s = async (input, opts) => {
    calls.push({ verb: "sample", input, opts });
    if (reject) throw reject;
    opts?.onText?.({ text, delta: text });
    return { text, truncated: false };
  };
  s.json = async (input, opts) => {
    calls.push({ verb: "json", input, opts });
    if (reject) throw reject;
    return typeof json === "function" ? json(input) : json;
  };
  s.calls = calls;
  return s;
}

test("createAI(null) is unavailable", () => {
  assert.equal(createAI(null).available, false);
});

test("reply uses quick tier without cache and streams", async () => {
  const s = fakeSample({ text: "Hej! Hur mår du?" });
  const ai = createAI(s);
  let streamed = "";
  const t = await ai.reply("A1", "Im Café", [], { onText: ({ text }) => (streamed = text) });
  assert.equal(t, "Hej! Hur mår du?");
  assert.equal(streamed, "Hej! Hur mår du?");
  assert.equal(s.calls[0].opts.cache, false);
  assert.equal(s.calls[0].opts.modelTier, "quick");
  assert.ok(Array.isArray(s.calls[0].input));
});

test("correct returns a parsed correction", async () => {
  const s = fakeSample({ json: { ok: false, corrected: "Jag heter Marc", explanation_de: "x" } });
  const c = await createAI(s).correct("A1", "Vad heter du?", "Jag heta Marc");
  assert.equal(c.corrected, "Jag heter Marc");
  assert.equal(c.natural, "Jag heter Marc");
  assert.equal(s.calls[0].opts.modelTier, "quick");
});

test("malformed JSON surfaces as ParseError with retry copy", async () => {
  const s = fakeSample({ json: { nope: 1 } });
  await assert.rejects(createAI(s).correct("A1", "a", "b"), (e) => {
    assert.ok(e instanceof ParseError);
    assert.match(aiErrorMessage(e), /nochmal versuchen/);
    return true;
  });
});

test("rate_limited is passed through once, never retried", async () => {
  const s = fakeSample({ reject: { code: "rate_limited", message: "x" } });
  await assert.rejects(createAI(s).evaluate("A1", "x", [{ role: "user", content: "hej" }]), (e) => e.code === "rate_limited");
  assert.equal(s.calls.length, 1);
  assert.equal(aiErrorMessage({ code: "rate_limited" }), "Gerade zu viele Anfragen – bitte kurz warten.");
});

test("aiErrorMessage copy per code", () => {
  assert.equal(aiErrorMessage({ code: "not_granted" }), "Claude ist für diese Seite nicht freigegeben.");
  assert.equal(aiErrorMessage({ code: "sampling_disabled" }), "Claude ist für diese Seite nicht freigegeben.");
  assert.equal(aiErrorMessage({ code: "invalid_json" }), "Antwort war unvollständig – nochmal versuchen.");
  assert.equal(aiErrorMessage({ code: "upstream_error" }), "Verbindungsproblem – nochmal versuchen.");
  assert.equal(aiErrorMessage({ code: "cancelled" }), "");
});

test("tiers: evaluate/listening/place default, grade/checkReview quick; listening uncached", async () => {
  const s = fakeSample({
    json: (input) =>
      /Dialog/.test(input)
        ? { lines: [{ speaker: "A", sv: "a" }, { speaker: "B", sv: "b" }], questions: [{ q_de: "q", answer_de: "a" }] }
        : /Niveau \(GER/.test(input)
        ? { level: "A2", reason_de: "r" }
        : /Verständnisfragen/.test(input)
        ? [{ correct: true, feedback_de: "" }]
        : /erwartete Antwort|Erwartete Antwort/.test(input)
        ? { correct: true, feedback_de: "" }
        : { summary_de: "s" },
  });
  const ai = createAI(s);
  await ai.evaluate("A1", "t", [{ role: "user", content: "x" }]);
  await ai.listening("A1", "t");
  await ai.place([{ task: "read", prompt: "p", answer: "a" }]);
  await ai.grade([{ q_de: "q", answer_de: "a", user: "a" }]);
  await ai.checkReview({ prompt_de: "Haus", answer_sv: "hus" }, "hus");
  const tiers = s.calls.map((c) => c.opts.modelTier);
  assert.deepEqual(tiers, ["default", "default", "default", "quick", "quick"]);
  assert.equal(s.calls[1].opts.cache, false);
});
