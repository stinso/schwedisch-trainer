// Prompt builders and tolerant parsers for every Claude call. Pure.
import { LEVELS } from "./level.js";

export class ParseError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "ParseError";
    this.code = "parse_error";
  }
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v : []);
const bool = (v) => v === true || v === "true" || v === "yes" || v === 1;
const need = (cond, msg) => {
  if (!cond) throw new ParseError(msg);
};

const LEVEL_HINT = {
  A1: "sehr einfache, kurze Hauptsätze im Präsens, häufigste Alltagswörter",
  A2: "einfache Sätze, Präsens und Präteritum, Alltagswortschatz",
  B1: "normale Alltagssprache, Nebensätze erlaubt, gelegentlich idiomatische Wendungen",
  B2: "natürliche, flüssige Sprache mit abwechslungsreichem Wortschatz",
  C1: "anspruchsvolle, idiomatische Sprache wie unter Muttersprachlern",
};

const transcript = (history) =>
  history.map((t) => (t.role === "user" ? "Lernender: " : "Partner: ") + t.content).join("\n");

const jsonOnly = (example) => `Antworte NUR mit JSON in genau dieser Form, ohne weiteren Text:\n${example}`;

// ---------- Conversation ----------

export function trimHistory(history, maxTurns = 20) {
  return history.slice(-maxTurns);
}

export function conversationInput(level, topic, history, mission = null) {
  const rules = [
    `Du bist ein freundlicher schwedischer Gesprächspartner für einen deutschsprachigen Lernenden auf Niveau ${level} (GER).`,
    mission
      ? `Rollenspiel: Du spielst "${mission.role_de}". Der Lernende hat diese Aufgabe: "${mission.goal_de}". Bleib konsequent in deiner Rolle, mach es realistisch, aber nicht unnötig schwer, und lass den Lernenden die Aufgabe selbst erledigen.`
      : `Thema des Gesprächs: "${topic}".`,
    `Regeln:`,
    `- Schreibe ausschließlich Schwedisch. Sprachniveau: ${LEVEL_HINT[level] || LEVEL_HINT.A1}.`,
    `- Pro Antwort 1–3 kurze Sätze. Beende die Antwort meistens mit einer offenen Frage, damit der Lernende weiterspricht.`,
    `- Bleib beim Thema, sei neugierig und natürlich, wie in einem echten Gespräch.`,
    `- Korrigiere KEINE Fehler und erkläre keine Grammatik. Reagiere einfach inhaltlich.`,
    `- Die Antworten des Lernenden stammen oft aus Spracherkennung: ignoriere fehlende Satzzeichen und Erkennungsfehler. Die Erkennung macht aus schwedisch gemeinten Wörtern manchmal ähnlich klingende englische oder deutsche Wörter (z. B. "what" statt "vad", "I" statt "jag"/"i", "hair" statt "här"): lies sie als das schwedische Wort, das gemeint war, und antworte darauf.`,
    `- Wenn der Lernende Deutsch schreibt oder sagt, dass er etwas nicht versteht, formuliere deine letzte Aussage einfacher auf Schwedisch neu.`,
    `- Keine Emojis, kein Markdown, keine Übersetzungen.`,
  ].join("\n");
  const h = trimHistory(history);
  const msgs = [{ role: "user", content: rules }, ...h];
  if (h.length === 0) {
    msgs.push({ role: "user", content: mission ? "Beginne jetzt das Rollenspiel mit deiner ersten Äußerung in deiner Rolle." : "Beginne jetzt das Gespräch mit einer kurzen Begrüßung und einer ersten Frage zum Thema." });
  }
  return msgs;
}

// ---------- Correction (✏️) ----------

export function correctionPrompt(level, prevAssistant, userText) {
  return [
    `Ein deutschsprachiger Schwedisch-Lernender (Niveau ${level}) hat in einem Gespräch geantwortet.`,
    `Der Text stammt evtl. aus Spracherkennung: fehlende Satzzeichen und Groß-/Kleinschreibung NICHT als Fehler werten.`,
    `Die Erkennung macht aus schwedisch gemeinten Wörtern manchmal ähnlich klingende englische oder deutsche Wörter (z. B. "what" statt "vad"). Solche Wörter sind KEINE Fehler des Lernenden: setze in "corrected" das gemeinte schwedische Wort ein und nenne sie in "heard_de" (z. B. "„what“ wurde erkannt – gemeint war wohl „vad“."), sonst "heard_de" leer.`,
    `Gesprächspartner sagte: "${prevAssistant}"`,
    `Lernender antwortete: "${userText}"`,
    ``,
    `Prüfe Grammatik, Wortwahl und Wortstellung. "ok" ist true, wenn der Satz korrekt ist.`,
    `"corrected": der minimal korrigierte Satz. "natural": wie ein Muttersprachler es natürlich sagen würde.`,
    `"explanation_de": kurze Erklärung der Fehler auf Deutsch (max. 2 Sätze), leer wenn ok.`,
    jsonOnly(`{"ok": false, "corrected": "Jag gick till stranden.", "natural": "Jag var på stranden.", "explanation_de": "Präteritum von gå ist gick.", "heard_de": ""}`),
  ].join("\n");
}

export function parseCorrection(v, userText = "") {
  need(isObj(v), "correction: not an object");
  const corrected = str(v.corrected) || (bool(v.ok) ? str(userText) : "");
  need(corrected, "correction: corrected missing");
  return {
    ok: bool(v.ok),
    corrected,
    explanation_de: str(v.explanation_de),
    natural: str(v.natural) || corrected,
    heard_de: str(v.heard_de),
  };
}

// ---------- Evaluation ----------

export function evaluationPrompt(level, topic, history, mission = null) {
  return [
    `Werte dieses schwedische Übungsgespräch eines deutschsprachigen Lernenden (Niveau ${level}) zum Thema "${topic}" aus.`,
    `Die Sätze des Lernenden stammen evtl. aus Spracherkennung: Satzzeichen ignorieren. Englische oder deutsche Wörter, die wie ein passendes schwedisches Wort klingen, sind Erkennungsfehler, keine Fehler des Lernenden – nimm sie nicht in "mistakes" auf.`,
    ``,
    transcript(history),
    ``,
    `Liefere:`,
    `- "summary_de": 2–3 ermutigende, konkrete Sätze auf Deutsch: was gut lief, worauf achten.`,
    `- "mistakes": die bis zu 5 wichtigsten Fehler des Lernenden: "wrong" (Originalausschnitt), "right" (korrigiert), "rule_de" (kurze Regel auf Deutsch).`,
    `- "phrases": 2–4 nützliche, natürlichere Formulierungen für das, was der Lernende sagen wollte: "sv" und "de".`,
    ...(mission ? [`- "goal_reached": true/false – hat der Lernende die Aufgabe "${mission.goal_de}" erledigt? Erwähne das Ergebnis auch in summary_de.`] : []),
    `- "vocab": 3–8 Wörter, die dem Lernenden gefehlt haben oder für das Thema wichtig sind (Grundform, bei Substantiven mit en/ett): "sv" und "de".`,
    jsonOnly(`{${mission ? `"goal_reached": true, ` : ""}"summary_de": "...", "mistakes": [{"wrong": "jag gå", "right": "jag gick", "rule_de": "..."}], "phrases": [{"sv": "...", "de": "..."}], "vocab": [{"sv": "en strand", "de": "Strand"}]}`),
  ].join("\n");
}

const pairs = (list, a, b) =>
  arr(list)
    .filter((x) => isObj(x) && str(x[a]))
    .map((x) => ({ [a]: str(x[a]), [b]: str(x[b]) }));

export function parseEvaluation(v) {
  need(isObj(v), "evaluation: not an object");
  const summary_de = str(v.summary_de);
  need(summary_de, "evaluation: summary_de missing");
  const mistakes = arr(v.mistakes)
    .filter((m) => isObj(m) && str(m.wrong) && str(m.right))
    .slice(0, 5)
    .map((m) => ({ wrong: str(m.wrong), right: str(m.right), rule_de: str(m.rule_de) }));
  const goal_reached = v.goal_reached == null ? null : bool(v.goal_reached);
  return { summary_de, mistakes, phrases: pairs(v.phrases, "sv", "de"), vocab: pairs(v.vocab, "sv", "de"), goal_reached };
}

// ---------- Listening ----------

export function listeningPrompt(level, topic) {
  return [
    `Schreibe einen kurzen, natürlichen schwedischen Dialog zwischen zwei Personen (A und B) zum Thema "${topic}" für Lernende auf Niveau ${level} (${LEVEL_HINT[level] || LEVEL_HINT.A1}).`,
    `6–12 Repliken. Jede Replik mit deutscher Übersetzung.`,
    `Dazu 3–4 Verständnisfragen auf Deutsch mit kurzer Musterantwort auf Deutsch. Die Fragen sollen nur durch Zuhören beantwortbar sein.`,
    `Wähle eine überraschende, konkrete Situation, nicht immer die gleiche.`,
    jsonOnly(`{"title_sv": "...", "lines": [{"speaker": "A", "sv": "...", "de": "..."}], "questions": [{"q_de": "...", "answer_de": "..."}]}`),
  ].join("\n");
}

export function parseListening(v) {
  need(isObj(v), "listening: not an object");
  const lines = arr(v.lines)
    .filter((l) => isObj(l) && str(l.sv))
    .map((l) => ({ speaker: str(l.speaker).toUpperCase() === "B" ? "B" : "A", sv: str(l.sv), de: str(l.de) }));
  const questions = arr(v.questions)
    .filter((q) => isObj(q) && str(q.q_de))
    .map((q) => ({ q_de: str(q.q_de), answer_de: str(q.answer_de) }));
  need(lines.length >= 2, "listening: too few lines");
  need(questions.length >= 1, "listening: no questions");
  return { title_sv: str(v.title_sv), lines, questions };
}

// ---------- Grading ----------

export function gradePrompt(items) {
  return [
    `Bewerte die Antworten eines Lernenden auf Verständnisfragen zu einem schwedischen Hörtext. Sei großzügig: der Sinn zählt, nicht die Formulierung oder Rechtschreibung.`,
    ...items.map((it, i) => `${i + 1}. Frage: ${it.q_de}\n   Musterantwort: ${it.answer_de}\n   Antwort des Lernenden: ${it.user || "(keine)"}`),
    `Gib für jede Frage in derselben Reihenfolge "correct" und ein kurzes "feedback_de" (1 Satz).`,
    jsonOnly(`[{"correct": true, "feedback_de": "Genau!"}]`),
  ].join("\n");
}

export function parseGrades(v, n) {
  need(Array.isArray(v) && v.length === n, "grades: wrong length");
  return v.map((g) => ({ correct: bool(isObj(g) && g.correct), feedback_de: isObj(g) ? str(g.feedback_de) : "" }));
}

// ---------- Placement ----------

export function placementItems() {
  const I = (task, level, prompt_sv, question_de) => ({ task, level, prompt_sv, question_de });
  return [
    I("listen", "A1", "Hej! Jag heter Anna och jag bor i Göteborg.", "Was hast du verstanden? Schreib es auf Deutsch."),
    I("speak", "A1", "Vad heter du och var bor du?", "Antworte auf Schwedisch."),
    I("read", "A2", "Igår gick vi till affären, men den var redan stängd.", "Was bedeutet der Satz auf Deutsch?"),
    I("speak", "A2", "Vad gjorde du i helgen?", "Antworte auf Schwedisch in 1–3 Sätzen."),
    I("listen", "B1", "Om jag hade haft mer tid skulle jag ha lärt mig svenska tidigare.", "Was hast du verstanden? Schreib es auf Deutsch."),
    I("speak", "B1", "Vad skulle du göra om du flyttade till Sverige i morgon?", "Antworte auf Schwedisch in 2–3 Sätzen."),
    I("read", "B2", "Trots att förslaget möttes av kritik valde regeringen att driva igenom det.", "Was bedeutet der Satz auf Deutsch?"),
    I("speak", "B2", "Vilka för- och nackdelar har det att jobba hemifrån?", "Antworte auf Schwedisch in einigen Sätzen."),
    I("listen", "C1", "Det är inte givet att den som har makten också besitter den legitimitet som krävs.", "Was hast du verstanden? Schreib es auf Deutsch."),
    I("speak", "C1", "Hur påverkar sociala medier det offentliga samtalet?", "Antworte auf Schwedisch, so ausführlich du kannst."),
  ];
}

export function placementPrompt(responses) {
  return [
    `Schätze das Schwedisch-Niveau (GER: ${LEVELS.join(", ")}) eines deutschsprachigen Lernenden anhand dieses Einstufungstests.`,
    `Aufgaben steigen von A1 bis C1. "listen" = Satz wurde vorgelesen, "read" = Satz gelesen, "speak" = freie Antwort (evtl. per Spracherkennung, Satzzeichen ignorieren).`,
    `Leere oder "weiß ich nicht"-Antworten zeigen, dass das Niveau darunter liegt.`,
    ``,
    ...responses.map((r, i) => `${i + 1}. [${r.task}] ${r.prompt}\n   Antwort: ${r.answer || "(keine)"}`),
    ``,
    `"reason_de": 2–3 Sätze auf Deutsch: was schon gut klappt, was als Nächstes dran ist.`,
    jsonOnly(`{"level": "A2", "reason_de": "..."}`),
  ].join("\n");
}

export function parsePlacement(v) {
  need(isObj(v), "placement: not an object");
  const level = str(v.level).toUpperCase();
  need(LEVELS.includes(level), "placement: unknown level");
  return { level, reason_de: str(v.reason_de) };
}

// ---------- Review check ----------

export function reviewCheckPrompt(item, userAnswer) {
  return [
    `Ein Schwedisch-Lernender übt. Aufgabe: "${item.prompt_de}". Erwartete Antwort: "${item.answer_sv}".`,
    `Antwort des Lernenden: "${userAnswer}" (evtl. per Spracherkennung, Satzzeichen und Groß-/Kleinschreibung ignorieren).`,
    `Ist die Antwort richtig oder gleichwertig richtig (Synonyme, korrekte Varianten zählen)? "feedback_de": 1 kurzer Satz auf Deutsch.`,
    jsonOnly(`{"correct": true, "feedback_de": "Richtig!"}`),
  ].join("\n");
}

export function parseReviewCheck(v) {
  need(isObj(v), "review: not an object");
  return { correct: bool(v.correct), feedback_de: str(v.feedback_de) };
}

// ---------- "Wie sagt man…?" helper ----------

export function howToSayPrompt(level, topic, de) {
  return [
    `Ein deutschsprachiger Schwedisch-Lernender (Niveau ${level}) führt ein Gespräch zum Thema "${topic}" und möchte Folgendes sagen:`,
    `"${de}"`,
    `Gib eine natürliche schwedische Formulierung, die zum Niveau passt (so einfach wie möglich, so idiomatisch wie nötig).`,
    `"note_de": optional 1 kurzer Hinweis auf Deutsch zu einem wichtigen Wort oder einer Konstruktion, sonst leer.`,
    jsonOnly(`{"sv": "Jag missade tåget.", "note_de": "missa = verpassen"}`),
  ].join("\n");
}

export function parseHowToSay(v) {
  need(isObj(v), "howToSay: not an object");
  const sv = str(v.sv);
  need(sv, "howToSay: sv missing");
  return { sv, note_de: str(v.note_de) };
}

// ---------- Shadowing (Nachsprechen) ----------

export function shadowPrompt(level, topic) {
  return [
    `Erstelle 6 schwedische Sätze zum Nachsprechen für deutschsprachige Lernende auf Niveau ${level} (${LEVEL_HINT[level] || LEVEL_HINT.A1}), Thema "${topic}".`,
    `Alltagsnah und natürlich, aufsteigend von kurz zu etwas länger. Achte auf typische Ausspracheschwierigkeiten (sj-Laut, tj/k vor hellen Vokalen, langes/kurzes a, å/ä/ö, stumme Buchstaben wie in "och", "jag", "de").`,
    `Schreibe Zahlen als Wörter, keine Ziffern (z. B. "tjugofem", nicht "25"), und vermeide Abkürzungen.`,
    `"tip_de": ein kurzer Aussprachetipp auf Deutsch zu einem Wort im Satz (z. B. "sju klingt etwa wie ‚chü‘"), oder leer.`,
    jsonOnly(`{"sentences": [{"sv": "Jag heter Anna.", "de": "Ich heiße Anna.", "tip_de": "jag spricht man ‚ja‘"}]}`),
  ].join("\n");
}

export function parseShadow(v) {
  need(isObj(v), "shadow: not an object");
  const s = arr(v.sentences)
    .filter((x) => isObj(x) && str(x.sv))
    .map((x) => ({ sv: str(x.sv), de: str(x.de), tip_de: str(x.tip_de) }));
  need(s.length > 0, "shadow: no sentences");
  return s;
}

// ---------- Grammar mini-lesson from an own mistake ----------

export function grammarPrompt(level, mistake) {
  return [
    `Ein deutschsprachiger Schwedisch-Lernender (Niveau ${level}) macht immer wieder diesen Fehler:`,
    `Falsch: "${mistake.wrong}" – Richtig: "${mistake.right}"${mistake.rule_de ? ` (${mistake.rule_de})` : ""}`,
    `Erstelle eine Mini-Lektion zur zugrunde liegenden Regel:`,
    `- "title_de": kurzer Titel der Regel.`,
    `- "lesson_de": Erklärung auf Deutsch in 3–5 Sätzen, mit Vergleich zum Deutschen, wo hilfreich. Einfach, konkret, ohne Fachjargon-Overkill.`,
    `- "examples": 3 schwedische Beispielsätze mit deutscher Übersetzung.`,
    `- "exercises": 5 Übungen auf Niveau ${level}: "prompt_de" ist ein deutscher Satz zum Übersetzen, der genau diese Regel braucht; "answer_sv" die Lösung.`,
    jsonOnly(`{"title_de": "...", "lesson_de": "...", "examples": [{"sv": "...", "de": "..."}], "exercises": [{"prompt_de": "...", "answer_sv": "..."}]}`),
  ].join("\n");
}

export function parseGrammar(v) {
  need(isObj(v), "grammar: not an object");
  const lesson_de = str(v.lesson_de);
  need(lesson_de, "grammar: lesson missing");
  const exercises = arr(v.exercises)
    .filter((x) => isObj(x) && str(x.prompt_de) && str(x.answer_sv))
    .map((x) => ({ prompt_de: str(x.prompt_de), answer_sv: str(x.answer_sv) }));
  need(exercises.length > 0, "grammar: no exercises");
  return { title_de: str(v.title_de), lesson_de, examples: pairs(v.examples, "sv", "de"), exercises };
}

// ---------- Translate a whole message / explain a word or phrase ----------

export function translatePrompt(level, sv) {
  return [
    `Übersetze diesen schwedischen Text für einen deutschsprachigen Lernenden (Niveau ${level}) natürlich ins Deutsche:`,
    `"${sv}"`,
    jsonOnly(`{"de": "Was hast du am Wochenende gemacht?"}`),
  ].join("\n");
}

export function parseTranslate(v) {
  need(isObj(v), "translate: not an object");
  const de = str(v.de);
  need(de, "translate: de missing");
  return { de };
}

export function explainPrompt(level, phrase, sentence) {
  return [
    `Ein deutschsprachiger Schwedisch-Lernender (Niveau ${level}) liest den Satz:`,
    `"${sentence}"`,
    `und möchte wissen, was "${phrase}" hier bedeutet.`,
    `"base_sv": Grundform (Verb im Infinitiv, Substantiv im Singular unbestimmt mit en/ett, sonst wie im Text).`,
    `"de": deutsche Bedeutung in genau diesem Satz (kurz, 1–4 Wörter).`,
    `"note_de": 1 kurzer Satz auf Deutsch: Form im Satz, feste Wendung oder Besonderheit – oder leer.`,
    jsonOnly(`{"base_sv": "tycka", "de": "meinen, finden", "note_de": "tycker = Präsens; tycka om = mögen"}`),
  ].join("\n");
}

export function parseExplain(v, phrase) {
  need(isObj(v), "explain: not an object");
  const de = str(v.de);
  need(de, "explain: de missing");
  return { phrase, base_sv: str(v.base_sv) || phrase, de, note_de: str(v.note_de) };
}
