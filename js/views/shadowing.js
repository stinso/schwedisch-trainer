import { h, fill, thinking, errorBox, speakButton, toast } from "../ui.js";
import { topicsFor } from "../level.js";
import { aiErrorMessage } from "../ai.js";
import { compareWords } from "../shadow.js";

// Nachsprechen: listen to a sentence, repeat it into the mic, see which words were understood.
export function render(root, ctx) {
  let alive = true;
  let unsub = () => {};
  const started = Date.now();
  const box = h("div", { class: "stack" });
  root.append(box);
  pick();
  return () => {
    alive = false;
    unsub();
  };

  function pick() {
    const topics = topicsFor(ctx.level);
    fill(box,
      h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Nachsprechen · Niveau " + ctx.level), h("h1", {}, "Hören, nachsprechen, vergleichen")),
      !ctx.mic.available && h("div", { class: "note" }, "Spracheingabe ist hier nicht verfügbar (nur Chrome bzw. Claude-Desktop-App). Du kannst trotzdem anhören, laut nachsprechen und dich selbst bewerten."),
      !ctx.ai.available && h("div", { class: "note" }, "Claude ist hier nicht verfügbar. Öffne die Seite auf claude.ai."),
      h("section", { class: "card" },
        h("p", { class: "muted" }, "Claude erstellt sechs Sätze zu deinem Thema. Du hörst jeden Satz, sprichst ihn nach, und die Seite zeigt, welche Wörter erkannt wurden – ein guter Test für deine Aussprache."),
        h("div", { class: "topics" }, topics.map((t) => h("button", { class: "topic", disabled: !ctx.ai.available, onclick: () => make(t.de) }, t.de, h("small", { lang: "sv" }, t.sv))))));
  }

  async function make(topic) {
    fill(box, h("section", { class: "card" }, thinking("Claude schreibt deine Sätze")));
    try {
      const sentences = await ctx.ai.shadow(ctx.level, topic);
      if (alive) run(topic, sentences);
    } catch (e) {
      if (alive) fill(box, errorBox(aiErrorMessage(e) || "Abgebrochen.", () => make(topic)), h("button", { class: "ghost", onclick: pick }, "Anderes Thema"));
    }
  }

  function run(topic, sentences) {
    const scores = [];
    let i = 0;
    show();

    function show() {
      unsub();
      if (i >= sentences.length) return done();
      const s = sentences[i];
      let heard = "";
      let hidden = false;
      const text = h("p", { class: "big-sv", lang: "sv" }, s.sv);
      const interim = h("div", { class: "interim" });
      const result = h("div", { class: "stack" });
      const micBtn = h("button", { class: "mic primary", type: "button" }, "🎤 Nachsprechen");
      const setOn = (on) => { micBtn.classList.toggle("on", on); micBtn.textContent = on ? "■ Fertig" : "🎤 Nachsprechen"; };

      micBtn.addEventListener("click", () => {
        if (ctx.mic.active()) return void ctx.mic.stop();
        heard = "";
        fill(result);
        setOn(true);
        ctx.mic
          .start({ onPartial: (t) => (interim.textContent = t), onFinal: (t) => { heard += t; interim.textContent = ""; } })
          .catch((e) => { setOn(false); if (e?.code !== "stopped" && e?.code !== "dismissed") toast("Mikrofon nicht verfügbar – sprich laut nach und bewerte dich selbst."); });
      });
      unsub = ctx.mic.onState(({ state }) => {
        if (state !== "idle") return;
        setOn(false);
        if (heard.trim()) evaluate(heard);
      });

      function evaluate(said) {
        const r = compareWords(s.sv, said);
        scores[i] = r.score;
        text.classList.remove("hidden-text");
        fill(result,
          h("div", { class: "row" }, h("span", { class: "pill " + (r.score >= 85 ? "good" : r.score >= 60 ? "sun" : "bad") }, r.score + " %"), h("span", { class: "small muted" }, r.score >= 85 ? "Sehr gut verständlich!" : r.score >= 60 ? "Fast – achte auf die rot markierten Wörter." : "Hör nochmal genau hin und versuch es langsamer.")),
          h("p", { class: "sv", lang: "sv" }, r.words.map((w) => h("span", { style: `color: var(${w.ok ? "--good" : "--bad"}); font-weight: 600; margin-right: .3em;` }, w.word))),
          h("p", { class: "small muted" }, "Erkannt: „" + said.trim() + "“"));
      }

      const selfGrade = h("div", { class: "row", hidden: ctx.mic.available },
        h("span", { class: "small muted" }, "Wie gut ging's?"),
        ...[["😕", 40], ["🙂", 75], ["😄", 100]].map(([e, v]) => h("button", { onclick: () => { scores[i] = v; i++; show(); } }, e)));

      fill(box,
        h("div", { class: "spread" }, h("span", { class: "small muted" }, `Satz ${i + 1} von ${sentences.length} · ${topic}`), h("button", { class: "ghost", onclick: pick }, "Anderes Thema")),
        h("div", { class: "progressbar" }, h("i", { style: `width:${(i / sentences.length) * 100}%` })),
        h("section", { class: "card" },
          h("div", { class: "row" },
            speakButton(ctx.speech, s.sv, { label: "Anhören", rate: 1 }),
            speakButton(ctx.speech, s.sv, { label: "Langsam", rate: 0.75 }),
            h("button", { class: "ghost needs-speech", onclick: (e) => { hidden = !hidden; text.classList.toggle("hidden-text", hidden); e.currentTarget.textContent = hidden ? "Text zeigen" : "Nur hören"; } }, "Nur hören")),
          text,
          h("p", { class: "muted" }, s.de),
          s.tip_de && h("p", { class: "note small" }, "💡 " + s.tip_de),
          h("div", { class: "row" }, ctx.mic.available && micBtn, interim),
          result,
          selfGrade,
          h("div", { class: "row end" }, ctx.mic.available && h("button", { onclick: () => { ctx.mic.stop(); scores[i] ??= null; i++; show(); } }, "Weiter →"))));
      if (ctx.speech.available) ctx.speech.say(s.sv, { rate: ctx.rate });
    }

    async function done() {
      const rated = scores.filter((x) => typeof x === "number");
      const avg = rated.length ? Math.round(rated.reduce((a, b) => a + b, 0) / rated.length) : 0;
      const weak = sentences.filter((_, k) => typeof scores[k] === "number" && scores[k] < 70);
      for (const s of weak) await ctx.store.addVocab({ sv: s.sv, de: s.de, source: "nachsprechen: " + topic }, new Date()).catch(() => {});
      await ctx.store.addSession({ date: new Date().toISOString(), minutes: Math.max(1, Math.round((Date.now() - started) / 60000)), kind: "speaking", topic, summary_de: rated.length ? `Ø ${avg} % verständlich` : "Nachgesprochen" }).catch(() => {});
      ctx.refreshHeader();
      if (!alive) return;
      fill(box, h("section", { class: "card flash" },
        h("p", { class: "big-sv" }, rated.length ? `Ø ${avg} %` : "Klart!"),
        h("p", {}, weak.length ? `${weak.length} ${weak.length === 1 ? "Satz kommt" : "Sätze kommen"} zum Üben in deine Wiederholung.` : "Super – alles gut verständlich."),
        h("div", { class: "row" }, h("button", { class: "primary", onclick: pick }, "Neue Sätze"), h("button", { onclick: () => ctx.go("today") }, "Zur Übersicht"))));
    }
  }
}
