import { h, fill, thinking, errorBox, answerField, speakButton, rateSelect, fmtMin, toast, readAnswer } from "../ui.js";
import { accumulate, MAX_GAP_MS } from "../time.js";
import { topicsFor, missionsFor } from "../level.js";
import { glossable } from "../gloss.js";
import { aiErrorMessage } from "../ai.js";

const SOFT_LIMIT_MS = 10 * 60 * 1000;

export function render(root, ctx, params = {}) {
  let state = null; // {topic, history, corrections, startedAt, activeMs}
  let lastAt = null; // last activity (ms) in this view
  let finished = false;
  let sending = false;
  let ctl = null;
  let timer = null;
  let alive = true;
  let saveChain = Promise.resolve();
  let listenMode = false;
  let autoRead = ctx.speech.available;
  let chatEl, composer, field, timerEl, softNote;

  const box = h("div", { class: "stack" });
  root.append(box);

  if (params.resume) {
    box.append(h("div", { class: "card" }, thinking("Lade dein Gespräch")));
    ctx.store.getDraft().then((d) => {
      if (!alive) return;
      if (d?.history?.length) {
        state = { corrections: {}, ...d };
        chat();
      } else pick();
    }, pick);
  } else {
    ctx.store.getDraft().then((d) => alive && pick(d), () => alive && pick());
  }

  return () => {
    alive = false;
    ctl?.abort();
    clearInterval(timer);
  };

  // ---------------------------------------------------------------- topic picker
  function pick(draft) {
    const topics = topicsFor(ctx.level);
    const custom = h("input", { type: "text", id: "custom-topic", placeholder: "Eigenes Thema, z. B. „Mein Garten“", maxlength: "80" });
    const startCustom = () => custom.value.trim() && start(custom.value.trim());
    custom.addEventListener("keydown", (e) => e.key === "Enter" && startCustom());
    fill(box, 
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Gespräch · Niveau " + ctx.level), h("h1", {}, "Worüber möchtest du sprechen?")),
      draft?.history?.length &&
        h("div", { class: "note row" }, h("span", {}, `Du hast ein offenes Gespräch: „${draft.topic}“.`), h("button", { onclick: () => { state = { corrections: {}, ...draft }; chat(); } }, "Fortsetzen")),
      !ctx.ai.available && h("div", { class: "note" }, "Claude ist hier nicht verfügbar. Öffne die Seite auf claude.ai, um Gespräche zu führen."),
      h("section", { class: "card" },
        h("div", { class: "topics" }, topics.map((t) => h("button", { class: "topic", onclick: () => start(t.de), disabled: !ctx.ai.available }, t.de, h("small", { lang: "sv" }, t.sv)))),
        h("div", { class: "row" }, h("div", { style: "flex:1;min-width:200px" }, custom), h("button", { onclick: startCustom, disabled: !ctx.ai.available }, "Mit eigenem Thema starten")),
        h("button", { class: "ghost", onclick: () => start(topics[Math.floor(Math.random() * topics.length)].de), disabled: !ctx.ai.available }, "🎲 Überrasch mich")),
      h("section", { class: "card" },
        h("div", { class: "spread" }, h("h3", {}, "🎭 Rollenspiele"), h("span", { class: "small muted" }, "Claude spielt eine Rolle, du hast eine Aufgabe")),
        h("ul", { class: "list" }, missionsFor(ctx.level).map((m) =>
          h("li", {}, h("div", { class: "spread" }, h("strong", {}, m.de), h("button", { disabled: !ctx.ai.available, onclick: () => start(m.de, m) }, "Spielen")), h("span", { class: "small muted" }, "🎯 " + m.goal_de))))),
      h("section", { class: "card" },
        h("h3", {}, "So läuft es ab"),
        h("ul", { class: "list" },
          h("li", {}, "Claude spricht dich auf Schwedisch an. Du antwortest mit 🎤 oder tippst."),
          h("li", {}, "Neben jeder Antwort steht ✏️. Klick darauf, wenn du die Korrektur sofort sehen willst."),
          h("li", {}, "Nach etwa 10 Minuten oder wann du willst: „Beenden & auswerten“. Fehler und neue Wörter wandern in die Wiederholung.")))
    );
  }

  function touch() {
    const now = Date.now();
    state.activeMs = accumulate(state.activeMs || 0, lastAt, now);
    lastAt = now;
  }
  function activeNow() {
    const gap = lastAt == null ? 0 : Date.now() - lastAt;
    return (state.activeMs || 0) + (gap > 0 && gap <= MAX_GAP_MS ? gap : 0);
  }

  function start(topic, mission = null) {
    finished = false;
    state = { topic, mission, history: [], corrections: {}, startedAt: new Date().toISOString(), activeMs: 0 };
    chat();
    reply();
  }

  // ---------------------------------------------------------------- chat

  function chat() {
    chatEl = h("div", { class: "chat", "aria-live": "polite" });
    timerEl = h("span", { class: "chip timer" }, "0:00");
    softNote = h("div", { class: "note row", hidden: true }, h("span", {}, "Schon 10 Minuten – Zeit für die Auswertung?"), h("button", { onclick: finish }, "Auswerten"));
    const listenBtn = h("button", { class: "ghost needs-speech", "aria-pressed": "false", onclick: () => {
      listenMode = !listenMode;
      listenBtn.setAttribute("aria-pressed", String(listenMode));
      listenBtn.textContent = listenMode ? "👁 Text zeigen" : "🎧 Nur hören";
      chatEl.querySelectorAll(".bubble.them .say").forEach((el) => el.classList.toggle("hidden-text", listenMode));
    } }, "🎧 Nur hören");
    const autoBtn = h("button", { class: "ghost needs-speech", "aria-pressed": String(autoRead), onclick: () => {
      autoRead = !autoRead;
      autoBtn.setAttribute("aria-pressed", String(autoRead));
      autoBtn.textContent = autoRead ? "🔊 Auto-Vorlesen an" : "🔈 Auto-Vorlesen aus";
    } }, autoRead ? "🔊 Auto-Vorlesen an" : "🔈 Auto-Vorlesen aus");

    field = answerField(ctx.mic, { placeholder: "Deine Antwort auf Schwedisch… (Enter zum Senden)", onEnter: send });
    const sendBtn = h("button", { class: "primary", onclick: send }, "Senden");
    composer = h("div", { class: "composer" }, field.el);
    field.el.querySelector(".row").append(h("span", { style: "flex:1" }), h("button", { class: "ghost", onclick: help, title: "Frag auf Deutsch, wie man etwas sagt" }, "💡 Wie sagt man…?"), sendBtn);

    fill(box, 
      h("div", { class: "spread" },
        h("div", { class: "stack", style: "gap:2px" }, h("p", { class: "eyebrow" }, "Gespräch · " + ctx.level), h("h2", {}, state.topic)),
        h("div", { class: "row" }, timerEl, h("button", { onclick: finish }, "Beenden & auswerten"))),
      state.mission && h("div", { class: "note" }, h("strong", {}, "🎯 Deine Aufgabe: "), state.mission.goal_de, h("br"), h("span", { class: "small muted" }, "Claude spielt: " + state.mission.role_de)),
      h("div", { class: "row" }, listenBtn, autoBtn, rateSelect(() => ctx.rate, (r) => ctx.setRate(r))),
      softNote,
      h("p", { class: "small muted" }, "Tipp: Wort in Claudes Antwort anklicken (oder mehrere markieren) für Erklärung, DE übersetzt alles."),
      chatEl,
      composer
    );
    state.history.forEach((t, idx) => chatEl.append(t.role === "user" ? meBubble(t.content, idx) : themBubble(t.content)));
    lastAt = Date.now();
    finished = false;
    clearInterval(timer);
    timer = setInterval(() => {
      const ms = activeNow();
      timerEl.textContent = fmtMin(ms);
      if (ms > SOFT_LIMIT_MS && softNote.hidden) softNote.hidden = false;
    }, 1000);
    // Resumed after a reload while Claude was answering: offer to fetch the reply.
    if (state.history.length && state.history.at(-1).role === "user") {
      const again = h("div", { class: "note row" }, h("span", {}, "Claudes Antwort fehlt noch."), h("button", { onclick: () => { again.remove(); reply(); } }, "Antwort holen"));
      chatEl.append(again);
    }
    field.focus();
  }

  function themBubble(text) {
    const g = glossable(ctx, text, { className: "sv say" + (listenMode ? " hidden-text" : ""), source: "gespräch: " + state.topic });
    const say = g.text;
    say.addEventListener("click", (e) => e.currentTarget.classList.remove("hidden-text"));
    return h("div", { class: "bubble them" }, say, g.panel, h("div", { class: "tools" }, g.translateBtn, speakButton(ctx.speech, () => say.textContent, { rate: () => ctx.rate })));
  }

  function meBubble(text, idx) {
    const fixBox = h("div", { class: "fix", hidden: true });
    const pen = h("button", { title: "Korrektur zeigen", "aria-label": "Korrektur zeigen", onclick: () => toggleFix(idx, fixBox, pen) }, "✏️");
    const b = h("div", { class: "bubble me" }, h("p", { class: "sv", lang: "sv" }, text), h("div", { class: "tools" }, pen), fixBox);
    if (state.corrections[idx]) renderFix(fixBox, state.corrections[idx]);
    return b;
  }

  async function toggleFix(idx, fixBox, pen) {
    if (!fixBox.hidden) return void (fixBox.hidden = true);
    fixBox.hidden = false;
    if (state.corrections[idx]) return renderFix(fixBox, state.corrections[idx]);
    const prev = [...state.history.slice(0, idx)].reverse().find((t) => t.role === "assistant")?.content || "";
    fill(fixBox, thinking("Prüfe deinen Satz"));
    pen.disabled = true;
    try {
      const c = await ctx.ai.correct(ctx.level, prev, state.history[idx].content);
      state.corrections[idx] = c;
      saveDraft();
      renderFix(fixBox, c);
    } catch (e) {
      fill(fixBox, errorBox(aiErrorMessage(e), () => { fixBox.hidden = true; toggleFix(idx, fixBox, pen); }));
    } finally {
      pen.disabled = false;
    }
  }

  function renderFix(fixBox, c) {
    fixBox.hidden = false;
    if (c.ok) {
      fill(fixBox, 
        h("span", { class: "pill good" }, "Richtig!"),
        c.natural && c.natural !== c.corrected && h("span", {}, "Natürlicher: ", h("span", { class: "right", lang: "sv" }, c.natural))
      );
      return;
    }
    fill(fixBox, 
      h("span", {}, h("span", { class: "right", lang: "sv" }, c.corrected), " ", speakButton(ctx.speech, c.corrected, { rate: () => ctx.rate })),
      c.explanation_de && h("span", { class: "muted" }, c.explanation_de),
      c.natural && c.natural !== c.corrected && h("span", { class: "small" }, "Natürlicher: ", h("span", { lang: "sv" }, c.natural))
    );
  }

  function saveDraft() {
    if (finished) return;
    touch();
    const snapshot = JSON.parse(JSON.stringify(state));
    saveChain = saveChain.then(() => ctx.store.saveDraft(snapshot)).catch(() => {});
  }

  async function send() {
    if (ctl || sending) return;
    sending = true;
    const text = await readAnswer(ctx.mic, field.input).finally(() => (sending = false));
    if (!text || !alive) return;
    field.input.value = "";
    field.interim.textContent = "";
    const idx = state.history.length;
    state.history.push({ role: "user", content: text });
    chatEl.append(meBubble(text, idx));
    saveDraft();
    reply();
  }

  async function reply() {
    const bubble = h("div", { class: "bubble them" }, thinking(""));
    chatEl.append(bubble);
    bubble.scrollIntoView({ block: "nearest", behavior: "smooth" });
    ctl = new AbortController();
    const p = h("p", { class: "sv", lang: "sv" });
    try {
      const text = await ctx.ai.reply(ctx.level, state.topic, state.history, {
        mission: state.mission || null,
        signal: ctl.signal,
        onText: ({ text }) => {
          if (!p.isConnected) fill(bubble, p);
          p.textContent = text;
        },
      });
      if (!alive) return;
      state.history.push({ role: "assistant", content: text });
      saveDraft();
      bubble.replaceWith(themBubble(text));
      if (autoRead) ctx.speech.say(text, { rate: ctx.rate });
    } catch (e) {
      if (!alive) return;
      const msg = aiErrorMessage(e);
      bubble.replaceWith(errorBox(msg || "Abgebrochen.", (ev) => { ev.currentTarget.closest(".note").remove(); reply(); }));
    } finally {
      ctl = null;
      field?.focus();
    }
  }

  async function help() {
    const q = field.input.value.trim();
    if (!q) return toast("Schreib auf Deutsch ins Feld, was du sagen möchtest – dann 💡 klicken.");
    const hint = h("div", { class: "note" }, thinking("Übersetze"));
    composer.prepend(hint);
    try {
      const r = await ctx.ai.howToSay(ctx.level, state.topic, q);
      fill(hint, 
        h("div", { class: "stack", style: "gap:4px" },
          h("span", { class: "small muted" }, "„" + q + "“ auf Schwedisch:"),
          h("strong", { class: "sv", lang: "sv" }, r.sv),
          r.note_de && h("span", { class: "small" }, r.note_de),
          h("div", { class: "row" }, speakButton(ctx.speech, r.sv, { rate: () => ctx.rate }),
            h("button", { onclick: () => { field.input.value = r.sv; hint.remove(); field.focus(); } }, "Übernehmen"),
            h("button", { class: "ghost", onclick: () => hint.remove() }, "Schließen")))
      );
      ctx.store.addVocab({ sv: r.sv, de: q, source: "hilfe" }, new Date()).catch(() => {});
    } catch (e) {
      fill(hint, errorBox(aiErrorMessage(e)), h("button", { class: "ghost", onclick: () => hint.remove() }, "Schließen"));
    }
  }

  // ---------------------------------------------------------------- evaluation
  async function finish() {
    if (finished) return;
    ctl?.abort();
    ctx.mic.stop();
    ctx.speech.stop();
    clearInterval(timer);
    touch();
    finished = true;
    const userTurns = state.history.filter((t) => t.role === "user").length;
    if (!userTurns) {
      await ctx.store.clearDraft().catch(() => {});
      return pick();
    }
    fill(box, h("section", { class: "card" }, thinking("Claude wertet euer Gespräch aus")));
    try {
      const ev = await ctx.ai.evaluate(ctx.level, state.topic, state.history, state.mission || null);
      if (!alive) return;
      await persist(ev);
      showEvaluation(ev);
    } catch (e) {
      if (!alive) return;
      fill(box, 
        errorBox(aiErrorMessage(e) || "Abgebrochen.", finish),
        h("div", { class: "row" }, h("button", { onclick: () => chat() }, "Zurück zum Gespräch"))
      );
    }
  }

  async function persist(ev) {
    const now = new Date();
    const minutes = Math.max(1, Math.round((state.activeMs || 0) / 60000));
    const src = "gespräch: " + state.topic;
    try {
      for (const m of ev.mistakes) await ctx.store.addMistake({ ...m, source: src }, now);
      for (const v of [...ev.vocab, ...ev.phrases]) await ctx.store.addVocab({ ...v, source: src }, now);
      await ctx.store.addSession({ date: now.toISOString(), minutes, kind: "conversation", topic: (state.mission ? "Rollenspiel: " : "") + state.topic, summary_de: ev.summary_de, turns: state.history.filter((t) => t.role === "user").length });
      await saveChain;
      await ctx.store.clearDraft();
      ctx.refreshHeader();
    } catch {
      toast("Auswertung konnte nicht vollständig gespeichert werden.");
    }
  }

  function showEvaluation(ev) {
    const say = (sv) => speakButton(ctx.speech, sv, { rate: () => ctx.rate });
    fill(box, 
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Auswertung · " + state.topic), h("h1", {}, "Bra jobbat!")),
      h("section", { class: "card" },
        ev.goal_reached != null && h("span", { class: "pill " + (ev.goal_reached ? "good" : "bad") }, ev.goal_reached ? "🎯 Aufgabe geschafft!" : "🎯 Aufgabe noch nicht ganz geschafft"),
        h("p", {}, ev.summary_de)),
      ev.mistakes.length > 0 && h("section", { class: "card" },
        h("h3", {}, "Deine wichtigsten Fehler"),
        h("ul", { class: "list" }, ev.mistakes.map((m) =>
          h("li", {}, h("span", {}, h("span", { class: "wrong", lang: "sv" }, m.wrong), " → ", h("span", { class: "right-txt", lang: "sv" }, m.right), " ", say(m.right)), m.rule_de && h("span", { class: "small muted" }, m.rule_de))))),
      ev.phrases.length > 0 && h("section", { class: "card" },
        h("h3", {}, "So klingt es natürlicher"),
        h("ul", { class: "list" }, ev.phrases.map((p) => h("li", {}, h("span", { class: "sv", lang: "sv" }, p.sv, " ", say(p.sv)), h("span", { class: "small muted" }, p.de))))),
      ev.vocab.length > 0 && h("section", { class: "card" },
        h("h3", {}, "Neue Wörter"),
        h("ul", { class: "list" }, ev.vocab.map((v) => h("li", {}, h("div", { class: "spread" }, h("span", { class: "sv", lang: "sv" }, v.sv), say(v.sv)), h("span", { class: "small muted" }, v.de))))),
      h("p", { class: "muted small" }, "Fehler, Wendungen und Wörter sind jetzt in deiner Wiederholung."),
      h("div", { class: "row" },
        h("button", { class: "primary", onclick: () => ctx.go("review") }, "Jetzt wiederholen"),
        h("button", { onclick: () => pick() }, "Neues Gespräch"),
        h("button", { class: "ghost", onclick: () => ctx.go("today") }, "Zur Übersicht"))
    );
  }
}
