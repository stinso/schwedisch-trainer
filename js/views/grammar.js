import { h, fill, thinking, errorBox, answerField, speakButton, readAnswer } from "../ui.js";
import { localMatch } from "../exercise.js";
import { aiErrorMessage } from "../ai.js";

// Grammar mini-lesson built from one of the learner's own recurring mistakes.
export function render(root, ctx, params = {}) {
  let alive = true;
  let started = Date.now();
  const box = h("div", { class: "stack" });
  root.append(box);
  if (params.mistake) lesson(params.mistake);
  else choose();
  return () => (alive = false);

  async function choose() {
    fill(box, h("div", { class: "card" }, thinking("Lade deine Fehler")));
    const items = await ctx.store.listReviewItems().catch(() => []);
    if (!alive) return;
    const mistakes = items.filter((i) => i.kind === "mistake").sort((a, b) => (b.count || 1) - (a.count || 1));
    fill(box,
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Grammatik"), h("h1", {}, "Lerne die Regel hinter deinen Fehlern")),
      mistakes.length
        ? h("section", { class: "card" },
            h("p", { class: "muted" }, "Wähle einen Fehler. Claude erklärt die Regel kurz und gibt dir fünf Übungssätze."),
            h("ul", { class: "list" }, mistakes.slice(0, 10).map((m) =>
              h("li", {}, h("div", { class: "spread" },
                h("span", {}, h("span", { class: "wrong", lang: "sv" }, m.wrong), " → ", h("span", { class: "right-txt", lang: "sv" }, m.right)),
                h("button", { disabled: !ctx.ai.available, onclick: () => lesson(m) }, "Regel lernen")),
                m.rule_de && h("span", { class: "small muted" }, m.rule_de, " · ", (m.count || 1) + "×")))))
        : h("section", { class: "card" }, h("p", { class: "muted" }, "Noch keine Fehler gesammelt. Führe ein Gespräch – danach kannst du hier gezielt die Regeln üben."), h("div", { class: "row" }, h("button", { class: "primary", onclick: () => ctx.go("talk") }, "Gespräch starten"))));
  }

  async function lesson(mistake) {
    fill(box, h("section", { class: "card" }, thinking("Claude bereitet deine Lektion vor")));
    try {
      const g = await ctx.ai.grammar(ctx.level, mistake);
      if (alive) teach(mistake, g);
    } catch (e) {
      if (alive) fill(box, errorBox(aiErrorMessage(e) || "Abgebrochen.", () => lesson(mistake)), h("button", { class: "ghost", onclick: choose }, "Anderen Fehler wählen"));
    }
  }

  function teach(mistake, g) {
    fill(box,
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Grammatik · " + ctx.level), h("h1", {}, g.title_de || "Die Regel")),
      h("section", { class: "card" },
        h("p", {}, h("span", { class: "wrong", lang: "sv" }, mistake.wrong), " → ", h("span", { class: "right-txt", lang: "sv" }, mistake.right)),
        h("p", {}, g.lesson_de),
        g.examples.length > 0 && h("ul", { class: "list" }, g.examples.map((x) =>
          h("li", {}, h("span", { class: "row", style: "gap:6px" }, h("span", { class: "sv", lang: "sv" }, x.sv), speakButton(ctx.speech, x.sv, { rate: () => ctx.rate })), h("span", { class: "small muted" }, x.de)))),
        h("div", { class: "row end" }, h("button", { class: "primary", onclick: () => practice(mistake, g) }, "Jetzt üben →")))
    );
  }

  function practice(mistake, g) {
    started = Date.now();
    let finished = false;
    let i = 0;
    let right = 0;
    next();

    function next() {
      ctx.mic.stop();
      if (i >= g.exercises.length) return done();
      const ex = g.exercises[i];
      const field = answerField(ctx.mic, { placeholder: "Auf Schwedisch…", onEnter: () => check() });
      const result = h("div", { class: "stack" });
      const checkBtn = h("button", { class: "primary", onclick: () => check() }, "Prüfen");
      let busy = false;
      let settled = false;

      async function check() {
        if (busy || settled) return;
        busy = true;
        const ans = await readAnswer(ctx.mic, field.input);
        if (!ans) {
          busy = false;
          field.focus();
          fill(result, h("p", { class: "small muted" }, "Schreib oder sprich zuerst deine Antwort."));
          return;
        }
        let ok = localMatch(ans, ex.answer_sv);
        let feedback = "";
        let canOverride = !ok;
        if (!ok && ctx.ai.available) {
          fill(result, thinking("Prüfe"));
          try {
            const r = await ctx.ai.checkReview({ prompt_de: "Übersetze: " + ex.prompt_de, answer_sv: ex.answer_sv }, ans);
            ok = r.correct;
            feedback = r.feedback_de;
          } catch (e) {
            feedback = aiErrorMessage(e) + " Vergleiche selbst mit der Lösung.";
          }
        }
        if (!alive) return;
        settled = true;
        if (ok) right++;
        checkBtn.hidden = true;
        fill(result,
          h("div", { class: "row" }, h("span", { class: "pill " + (ok ? "good" : "bad") }, ok ? "Richtig!" : "Nicht ganz"), feedback && h("span", {}, feedback)),
          !ok && h("div", { class: "row" }, h("span", { class: "small muted" }, "Lösung:"), h("strong", { class: "sv", lang: "sv" }, ex.answer_sv), speakButton(ctx.speech, ex.answer_sv, { rate: () => ctx.rate })),
          h("div", { class: "row end" },
            !ok && canOverride && h("button", { class: "ghost", onclick: (e) => { e.currentTarget.disabled = true; right++; i++; next(); } }, "Ich hatte doch recht"),
            h("button", { class: "primary", onclick: (e) => { e.currentTarget.disabled = true; i++; next(); } }, i + 1 < g.exercises.length ? "Weiter" : "Fertig")));
        if (ok && ctx.speech.available) ctx.speech.say(ex.answer_sv, { rate: ctx.rate });
      }

      fill(box,
        h("div", { class: "spread" }, h("span", { class: "small muted" }, `Übung ${i + 1} von ${g.exercises.length} · ${g.title_de}`), h("button", { class: "ghost", onclick: () => teach(mistake, g) }, "Regel nochmal lesen")),
        h("div", { class: "progressbar" }, h("i", { style: `width:${(i / g.exercises.length) * 100}%` })),
        h("section", { class: "card" },
          h("p", { class: "eyebrow" }, "Übersetze ins Schwedische"),
          h("p", { class: "big-sv", lang: "de" }, ex.prompt_de),
          field.el, result,
          h("div", { class: "row end" }, checkBtn)));
      field.focus();
    }

    async function done() {
      if (finished) return;
      finished = true;
      const passed = right / g.exercises.length >= 0.8;
      const minutes = Math.max(1, Math.round((Date.now() - started) / 60000));
      if (alive) fill(box, h("section", { class: "card flash" },
        h("p", { class: "big-sv" }, passed ? "Regel sitzt! 🌟" : "Weiter dranbleiben 💪"),
        h("p", {}, `${right} von ${g.exercises.length} richtig.` + (passed ? "" : " Der Fehler bleibt in deiner Wiederholung.")),
        h("div", { class: "row" }, h("button", { class: "primary", onclick: choose }, "Nächste Regel"), h("button", { onclick: () => ctx.go("today") }, "Zur Übersicht"))));
      if (mistake.id) await ctx.store.saveReview(mistake, passed, new Date()).catch(() => {});
      await ctx.store.addSession({ date: new Date().toISOString(), minutes, kind: "grammar", topic: g.title_de, summary_de: `${right}/${g.exercises.length} richtig` }).catch(() => {});
      ctx.refreshHeader();
    }
  }
}
