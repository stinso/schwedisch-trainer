import { h, fill, thinking, errorBox, speakButton, rateSelect, toast } from "../ui.js";
import { topicsFor } from "../level.js";
import { aiErrorMessage } from "../ai.js";

export function render(root, ctx) {
  let alive = true;
  let unsubs = []; // tts listeners of the current player
  const unhook = () => { unsubs.forEach((u) => { try { u(); } catch {} }); unsubs = []; };
  const box = h("div", { class: "stack" });
  root.append(box);
  pick();
  return () => { alive = false; unhook(); };

  function pick() {
    unhook();
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
    ctx.clock.reset();
    fill(box, h("section", { class: "card" }, thinking("Claude schreibt deinen Dialog")));
    try {
      const d = await ctx.ai.listening(ctx.level, topic);
      if (alive) player(topic, d);
    } catch (e) {
      if (alive) fill(box, errorBox(aiErrorMessage(e) || "Abgebrochen.", () => make(topic)), h("button", { class: "ghost", onclick: pick }, "Anderes Thema"));
    }
  }

  function player(topic, d) {
    unhook();
    d = { ...d, lines: d.lines.map((l, i) => ({ ...l, id: "l" + i })) };
    let showText = !ctx.speech.available;
    let current = null; // id of the line being read
    let phase = "idle"; // idle | speaking | paused
    let showDe = false;
    const lines = h("div", {});
    const renderLines = () =>
      fill(lines, ...d.lines.map((l) =>
        h("div", { class: "line" + (l.id === current ? " playing" : ""), "data-id": l.id },
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

    const mark = () => lines.querySelectorAll(".line").forEach((el) => {
      const on = el.dataset.id === current;
      el.classList.toggle("playing", on);
      if (on) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    // From the top: end a paused or running reading first, then read every line again.
    const playAll = async () => {
      if (phase !== "idle") await ctx.speech.stop();
      ctx.speech.say(d.lines, { rate: ctx.rate });
    };
    const mainBtn = h("button", { class: "primary speak", onclick: () => (phase === "speaking" ? ctx.speech.pause() : phase === "paused" ? ctx.speech.resume() : playAll()) }, "▶ Dialog abspielen");
    const drawMain = () => (mainBtn.textContent = phase === "speaking" ? "⏸ Pause" : phase === "paused" ? "▶ Weiter" : "▶ Dialog abspielen");
    unsubs.push(
      ctx.speech.onLine(({ id }) => { if (id) { current = id; mark(); } }),
      ctx.speech.onState(({ state }) => {
        phase = state === "paused" ? "paused" : state === "idle" ? "idle" : "speaking";
        if (phase === "idle") { current = null; mark(); }
        drawMain();
      })
    );

    const textBtn = h("button", { class: "ghost", onclick: () => { showText = !showText; textBtn.textContent = showText ? "Text verbergen" : "Text zeigen"; renderLines(); } }, showText ? "Text verbergen" : "Text zeigen");
    const deBtn = h("button", { class: "ghost", onclick: () => { showDe = !showDe; if (showDe) showText = true; textBtn.textContent = showText ? "Text verbergen" : "Text zeigen"; deBtn.textContent = showDe ? "Übersetzung aus" : "Übersetzung"; renderLines(); } }, "Übersetzung");

    const answers = d.questions.map((q, i) => h("input", { type: "text", id: "q" + i, placeholder: "Antwort auf Deutsch" }));
    const feedback = d.questions.map(() => h("div", { class: "small" }));
    const checkBtn = h("button", { class: "primary", onclick: check }, "Antworten prüfen");

    fill(box, 
      h("div", { class: "spread" }, h("div", { class: "stack", style: "gap:2px" }, h("p", { class: "eyebrow" }, "Hörübung · " + topic), h("h2", { lang: "sv" }, d.title_sv || topic)), h("button", { class: "ghost", onclick: pick }, "Andere Übung")),
      h("section", { class: "card" },
        h("div", { class: "row" },
          mainBtn,
          h("button", { class: "speak", title: "Dialog von Anfang an abspielen", onclick: playAll }, "⏮ Von vorne"),
          h("button", { class: "speak", onclick: () => ctx.speech.stop() }, "■ Stopp"),
          rateSelect(() => ctx.rate, (r) => ctx.setRate(r)),
          textBtn, deBtn),
        lines),
      h("section", { class: "card" },
        h("h3", {}, "Verständnisfragen"),
        h("ol", { class: "list" }, d.questions.map((q, i) => h("li", {}, h("label", { for: "q" + i }, q.q_de), answers[i], feedback[i]))),
        h("div", { class: "row end" }, checkBtn))
    );
    if (ctx.speech.available) playAll();

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
        await ctx.store.addSession({ date: new Date().toISOString(), minutes: ctx.clock.minutes(), kind: "listening", topic, summary_de: `${right}/${grades.length} Fragen richtig` }).catch(() => {});
        ctx.refreshHeader();
      } catch (e) {
        checkBtn.disabled = false;
        fill(checkBtn, "Antworten prüfen");
        toast(aiErrorMessage(e));
      }
    }
  }
}
