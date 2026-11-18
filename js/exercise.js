// Turns a review item into one exercise, and checks answers locally. Pure.
import { normText } from "./store.js";

export function exerciseFor(item, rnd = Math.random()) {
  if (item.kind === "mistake") {
    return {
      mode: "fix",
      title: "Wie sagt man das richtig?",
      show: item.wrong,
      expected: item.right,
      answerLang: "sv",
      hint: item.rule_de || "",
    };
  }
  const de = String(item.de || "").trim();
  if (de && rnd < 0.5) {
    return { mode: "de2sv", title: "Wie heißt das auf Schwedisch?", show: de, expected: item.sv, answerLang: "sv", hint: "" };
  }
  return {
    mode: "sv2de",
    title: "Was bedeutet das?",
    show: item.sv,
    listen: item.sv,
    expected: de,
    answerLang: "de",
    hint: "",
    selfCheck: !de,
  };
}

export function localMatch(answer, expected) {
  // Compare without any punctuation (dictation rarely produces commas).
  const bare = (s) => normText(String(s).replace(/[.,!?;:"'«»„“”…()]/g, " "));
  const a = bare(answer);
  if (!a) return false;
  return String(expected || "")
    .split(/\s*[\/;]\s*/)
    .map(bare)
    .filter(Boolean)
    .some((alt) => alt === a);
}
