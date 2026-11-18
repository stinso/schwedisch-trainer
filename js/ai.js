// Thin wrapper around the `sample` capability: one function per Claude task.
import * as P from "./prompts.js";

export function createAI(sample) {
  const available = typeof sample === "function";
  const json = async (prompt, opts, parse) => parse(await sample.json(prompt, opts));

  return {
    available,

    async reply(level, topic, history, { onText, signal, mission } = {}) {
      const { text } = await sample(P.conversationInput(level, topic, history, mission), {
        modelTier: "quick",
        cache: false,
        onText,
        signal,
      });
      return text.trim();
    },

    correct: (level, prev, userText) =>
      json(P.correctionPrompt(level, prev, userText), { modelTier: "quick" }, (v) => P.parseCorrection(v, userText)),

    evaluate: (level, topic, history, mission) =>
      json(P.evaluationPrompt(level, topic, history, mission), { modelTier: "default", cache: false }, P.parseEvaluation),

    listening: (level, topic) =>
      json(P.listeningPrompt(level, topic), { modelTier: "default", cache: false }, P.parseListening),

    place: (responses) => json(P.placementPrompt(responses), { modelTier: "default" }, P.parsePlacement),

    grade: (items) => json(P.gradePrompt(items), { modelTier: "quick" }, (v) => P.parseGrades(v, items.length)),

    checkReview: (item, answer) =>
      json(P.reviewCheckPrompt(item, answer), { modelTier: "quick" }, P.parseReviewCheck),

    shadow: (level, topic) =>
      json(P.shadowPrompt(level, topic), { modelTier: "default", cache: false }, P.parseShadow),

    grammar: (level, mistake) =>
      json(P.grammarPrompt(level, mistake), { modelTier: "default", cache: false }, P.parseGrammar),

    howToSay: (level, topic, de) =>
      json(P.howToSayPrompt(level, topic, de), { modelTier: "quick" }, P.parseHowToSay),
    async discuss(level, topic, history, item, qa, { onText, signal } = {}) {
      const { text } = await sample(P.discussInput(level, topic, history, item, qa), { modelTier: "default", cache: false, onText, signal });
      return text.trim();
    },
    translate: (level, sv) => json(P.translatePrompt(level, sv), { modelTier: "quick" }, P.parseTranslate),
    explain: (level, phrase, sentence) =>
      json(P.explainPrompt(level, phrase, sentence), { modelTier: "quick" }, (v) => P.parseExplain(v, phrase)),
  };
}

export function aiErrorMessage(err) {
  const code = err?.code;
  if (code === "cancelled") return "";
  if (code === "not_granted" || code === "sampling_disabled" || code === "not_declared")
    return "Claude ist für diese Seite nicht freigegeben.";
  if (code === "rate_limited") return "Gerade zu viele Anfragen – bitte kurz warten.";
  if (code === "invalid_json" || code === "parse_error" || code === "empty_completion" || err instanceof P.ParseError)
    return "Antwort war unvollständig – nochmal versuchen.";
  if (code === "refused") return "Claude hat das abgelehnt – formuliere es anders.";
  if (code === "session_expired") return "Bitte bei claude.ai neu anmelden.";
  return "Verbindungsproblem – nochmal versuchen.";
}
