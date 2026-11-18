import { h, fill, thinking, errorBox, speakButton, rateSelect, toast } from "../ui.js";
import { topicsFor } from "../level.js";
import { aiErrorMessage } from "../ai.js";

export function render(root, ctx) {
  let alive = true;
  let started = Date.now();
  const box = h("div", { class: "stack" });
  root.append(box);
  pick();
  return () => (alive = false);

  function pick() {
    const topics = topicsFor(ctx.level);
    const custom = h("input", { type: "text", id: "listen-topic", placeholder: "Eigenes Thema …", maxlength: "80" });
    fill(box, 
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Hörübung · Niveau " + ctx.level), h("h1", {}, "Hör gut zu")),
      !ctx.ai.available && h("div", { class: "note" }, "Claude ist hier nicht verfügbar. Öffne die Seite auf claude.ai, um Hörübungen zu erzeugen."),
      !ctx.speech.available && h("div", { class: "note" }, "Vorlesen ist in dieser Ansicht nicht verfügbar. Du kannst den Dialog lesen statt hören."),
      h("section", { class: "card" },
        h("p", { class: "muted" }, "Claude schreibt einen kurzen Dialog zu deinem Thema. Du hörst ihn an und beantwortest danach ein paar Fragen."),
        h("div", { class: "topics" }, topics.map((t) => h("button", { class: "topic", disabled: !ctx.ai.available, onclick: () => make(t.de) }, t.de, h("small", { lang: "sv" }, t.sv)))),
        h("div", { class: "row" }, h("div", { style: "flex:1;min-width:200px" }, custom), h("button", { disabled: !ctx.ai.available, onclick: () => custom.value.trim() && make(custom.value.trim()) }, "Los"))),
    );
  }

  async function make(topic) {
    started = Date.now();
    fill(box, h("section", { class: "card" }, thinking("Claude schreibt deinen Dialog")));
    try {
      const d = await ctx.ai.listening(ctx.level, topic);
      if (alive) player(topic, d);
    } catch (e) {
      if (alive) fill(box, errorBox(aiErrorMessage(e) || "Abgebrochen.", () => make(topic)), h("button", { class: "ghost", onclick: pick }, "Anderes Thema"));
    }
  }

  function player(topic, d) {
    let showText = !ctx.speech.available;
    let showDe = false;
    const lines = h("div", {});
    const renderLines = () =>
      fill(lines, ...d.lines.map((l) =>
        h("div", { class: "line" },
          h("span", { class: "spk " + l.speaker, "aria-label": "Sprecher " + l.speaker }, l.speaker),
          h("div", { class: "stack", style: "gap:2px" },
            h("span", { class: "sv" + (showText ? "" : " hidden-text"), lang: "sv" }, l.sv),
            showDe && h("span", { class: "small muted" }, l.de)),
          h("div", { class: "row", style: "gap:2px" },
            speakButton(ctx.speech, [l], { rate: () => ctx.rate }),
            showText && h("button", { class: "icon ghost", title: "In die Wiederholung", "aria-label": "In die Wiederholung", onclick: async (e) => {
              e.currentTarget.disabled = true;
              await ctx.store.addVocab({ sv: l.sv, de: l.de, source: "hören: " + topic }, new Date()).catch(() => {});
              toast("Gemerkt – kommt in der Wiederholung.");
            } }, "＋")))));
    renderLines();

    const textBtn = h("button", { class: "ghost", onclick: () => { showText = !showText; textBtn.textContent = showText ? "Text verbergen" : "Text zeigen"; renderLines(); } }, showText ? "Text verbergen" : "Text zeigen");
    const deBtn = h("button", { class: "ghost", onclick: () => { showDe = !showDe; if (showDe) showText = true; textBtn.textContent = showText ? "Text verbergen" : "Text zeigen"; deBtn.textContent = showDe ? "Übersetzung aus" : "Übersetzung"; renderLines(); } }, "Übersetzung");

    const answers = d.questions.map((q, i) => h("input", { type: "text", id: "q" + i, placeholder: "Antwort auf Deutsch" }));
    const feedback = d.questions.map(() => h("div", { class: "small" }));
    const checkBtn = h("button", { class: "primary", onclick: check }, "Antworten prüfen");

    fill(box, 
      h("div", { class: "spread" }, h("div", { class: "stack", style: "gap:2px" }, h("p", { class: "eyebrow" }, "Hörübung · " + topic), h("h2", { lang: "sv" }, d.title_sv || topic)), h("button", { class: "ghost", onclick: pick }, "Andere Übung")),
      h("section", { class: "card" },
        h("div", { class: "row" },
          h("button", { class: "primary speak", onclick: () => ctx.speech.say(d.lines, { rate: ctx.rate }) }, "▶ Dialog abspielen"),
          h("button", { class: "speak", onclick: () => ctx.speech.stop() }, "■ Stopp"),
          rateSelect(() => ctx.rate, (r) => ctx.setRate(r)),
          textBtn, deBtn),
        lines),
      h("section", { class: "card" },
        h("h3", {}, "Verständnisfragen"),
        h("ol", { class: "list" }, d.questions.map((q, i) => h("li", {}, h("label", { for: "q" + i }, q.q_de), answers[i], feedback[i]))),
        h("div", { class: "row end" }, checkBtn))
    );
    if (ctx.speech.available) ctx.speech.say(d.lines, { rate: ctx.rate });

    async function check() {
      checkBtn.disabled = true;
      fill(checkBtn, "Prüfe …");
      try {
        const grades = await ctx.ai.grade(d.questions.map((q, i) => ({ ...q, user: answers[i].value.trim() })));
        let right = 0;
        grades.forEach((g, i) => {
          if (g.correct) right++;
          feedback[i].replaceChildren(
            h("span", { class: "pill " + (g.correct ? "good" : "bad") }, g.correct ? "Richtig" : "Nicht ganz"),
            " ", g.feedback_de, !g.correct && h("span", { class: "muted" }, " Musterantwort: " + d.questions[i].answer_de));
        });
        showText = true;
        renderLines();
        textBtn.textContent = "Text verbergen";
        checkBtn.replaceWith(h("div", { class: "row" },
          h("span", { class: "pill sun" }, `${right} von ${grades.length} richtig`),
          h("button", { class: "primary", onclick: pick }, "Neue Hörübung"),
          h("button", { onclick: () => ctx.go("today") }, "Zur Übersicht")));
        await ctx.store.addSession({ date: new Date().toISOString(), minutes: Math.max(1, Math.round((Date.now() - started) / 60000)), kind: "listening", topic, summary_de: `${right}/${grades.length} Fragen richtig` }).catch(() => {});
        ctx.refreshHeader();
      } catch (e) {
        checkBtn.disabled = false;
        fill(checkBtn, "Antworten prüfen");
        toast(aiErrorMessage(e));
      }
    }
  }
}
