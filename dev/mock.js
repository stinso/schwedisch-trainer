// Local-only stand-in for window.claude (never published).
import { fakeDb } from "../tests/fakeDb.js";
const db = fakeDb();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function sample(input, opts = {}) {
  return (async () => {
    await wait(30);
    const text = "Hej! Vad roligt. Vad gjorde du sedan?";
    opts.onText?.({ text, delta: text });
    return { text, truncated: false };
  })();
}
sample.json = async (p) => {
  await wait(30);
  if (/Partner:|Lernender:/.test(p) && /mistakes/.test(p)) return { goal_reached: /goal_reached/.test(p) ? true : undefined, summary_de: "Gut gemacht.", mistakes: [{ wrong: "jag gå", right: "jag gick", rule_de: "Präteritum" }], phrases: [{ sv: "Det var kul", de: "Das hat Spaß gemacht" }], vocab: [{ sv: "en strand", de: "Strand" }] };
  if (/Dialog/.test(p)) return { title_sv: "På tåget", lines: [{ speaker: "A", sv: "Hej!", de: "Hallo!" }, { speaker: "B", sv: "Hej, sitter någon här?", de: "Sitzt hier jemand?" }], questions: [{ q_de: "Wo sind sie?", answer_de: "Im Zug" }] };
  if (/Verständnisfragen/.test(p)) return [{ correct: true, feedback_de: "Genau." }];
  if (/Einstufungstests/.test(p)) return { level: "A2", reason_de: "Solide Grundlagen." };
  if (/Erwartete Antwort/.test(p)) return { correct: false, feedback_de: "Fast." };
  if (/zum Nachsprechen/.test(p)) return { sentences: [{ sv: "Jag bor och jobbar i Malmö.", de: "Ich wohne und arbeite in Malmö.", tip_de: "och spricht man ‚ock‘" }, { sv: "Hej då!", de: "Tschüss!" }] };
  if (/möchte Folgendes sagen/.test(p)) return { sv: "Jag missade tåget.", note_de: "" };
  return { ok: false, corrected: "Jag gick till stranden.", natural: "Jag var på stranden.", explanation_de: "gå → gick" };
};
const tts = { speak: async () => ({ playedMs: 1 }), stop: async () => {}, onState: () => () => {}, languages: async () => ["en", "sv", "de"] };
const user = { id: async () => "dev-user" };
const dh = {};
let listening = false;
const dictation = {
  start: async () => { listening = true; dh.state?.({ state: "listening" }); dh.partial?.({ text: "och jobbar" }); },
  stop: async () => { if (!listening) return; listening = false; await wait(20); dh.final?.({ text: " och jobbar" }); dh.state?.({ state: "idle", reason: "stopped" }); },
  active: () => listening,
  onPartial: (fn) => ((dh.partial = fn), () => {}),
  onFinal: (fn) => ((dh.final = fn), () => {}),
  onState: (fn) => ((dh.state = fn), () => {}),
};
const caps = { sample, tts, db, user, dictation };
window.claude = { use: async (n) => caps[n] ?? null };
