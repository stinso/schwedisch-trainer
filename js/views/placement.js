import { h, thinking, errorBox, answerField, speakButton, toast } from "../ui.js";
import { placementItems } from "../prompts.js";
import { LEVELS, placementShouldStop } from "../level.js";
import { aiErrorMessage } from "../ai.js";

export function render(root, ctx, params = {}) {
  const items = placementItems();
  const responses = [];
  const started = Date.now();
  let i = 0;
  const box = h("div", { class: "stack" });
  root.append(box);
  intro();

  function intro() {
    box.replaceChildren(
      h("div", { class: "stack" },
        h("p", { class: "eyebrow" }, params.retest ? "Neue Einstufung" : "Willkommen"),
        h("h1", {}, params.retest ? "Wo stehst du jetzt?" : "Lass uns herausfinden, wo du stehst")),
      h("section", { class: "card" },
        h("p", {}, "Zehn kurze Aufgaben von leicht (A1) bis schwer (C1): Sätze hören, lesen und selbst antworten. Etwa 5–8 Minuten."),
        h("p", { class: "muted small" }, "Fehler sind ausdrücklich erwünscht. Wenn du etwas nicht weißt, klick auf „Weiß ich nicht“. Nach zwei unbeantworteten Aufgaben in Folge hören wir auf."),
        !ctx.ai.available && h("div", { class: "note" }, "Claude ist hier nicht verfügbar, daher kann der Test nicht ausgewertet werden. Du kannst dein Niveau unten direkt wählen."),
        h("div", { class: "row" },
          ctx.ai.available && h("button", { class: "primary", onclick: () => step() }, "Test starten"),
          h("button", { onclick: () => manual("A1", "Start bei Null.") }, "Ich fange bei Null an"),
          params.retest && h("button", { class: "ghost", onclick: () => ctx.go("today") }, "Abbrechen"))),
      manualPicker()
    );
  }

  function manualPicker() {
    const sel = h("select", { id: "manual-level", "aria-label": "Niveau" }, LEVELS.map((l) => h("option", { value: l }, l)));
    sel.value = ctx.profile?.level || "A1";
    return h("details", { class: "card" },
      h("summary", {}, "Ich kenne mein Niveau schon"),
      h("div", { class: "row" }, sel, h("button", { onclick: () => manual(sel.value, "Selbst gewählt.") }, "Übernehmen")));
  }

  async function manual(level, reason_de) {
    await ctx.setProfile({ level, placedAt: new Date().toISOString(), reason_de });
    ctx.go("today");
  }

  function step() {
    if (i >= items.length || placementShouldStop(responses)) return finish();
    const it = items[i];
    const total = items.length;
    const showText = it.task !== "listen" || !ctx.speech.available;
    const text = h("p", { class: "big-sv" + (showText ? "" : " hidden-text"), lang: "sv" }, it.prompt_sv);
    const reveal = h("button", { class: "ghost", hidden: showText, onclick: () => { text.classList.remove("hidden-text"); reveal.hidden = true; } }, "Text zeigen");
    const isSpeak = it.task === "speak";
    const field = answerField(ctx.mic, { placeholder: isSpeak ? "Antwort auf Schwedisch…" : "Auf Deutsch…", rows: isSpeak ? 3 : 2 });
    if (!isSpeak) field.micBtn.remove(); // German answers are typed
    const next = (answer) => {
      responses.push({ task: it.task, level: it.level, prompt: it.prompt_sv, answer: answer.trim(), revealed: !text.classList.contains("hidden-text") && it.task === "listen" });
      i++;
      step();
    };
    box.replaceChildren(
      h("div", { class: "spread" }, h("p", { class: "eyebrow" }, `Aufgabe ${i + 1} von ${total} · ${it.level}`), h("span", { class: "pill" }, { listen: "Hören", read: "Lesen", speak: "Sprechen" }[it.task])),
      h("div", { class: "progressbar" }, h("i", { style: `width:${(i / total) * 100}%` })),
      h("section", { class: "card" },
        h("div", { class: "row" }, (it.task !== "read") && speakButton(ctx.speech, it.prompt_sv, { label: it.task === "listen" ? "Anhören" : "", rate: () => ctx.rate }), reveal),
        text,
        h("p", { class: "muted" }, it.question_de),
        field.el,
        h("div", { class: "row end" },
          h("button", { class: "ghost", onclick: () => next("") }, "Weiß ich nicht"),
          h("button", { class: "primary", onclick: () => next(field.input.value) }, "Weiter")))
    );
    if (it.task === "listen" && ctx.speech.available) ctx.speech.say(it.prompt_sv, { rate: ctx.rate });
    field.focus();
  }

  async function finish() {
    const answered = responses.filter((r) => r.answer);
    if (!answered.length) return manual("A1", "Start bei Null – keine Aufgabe beantwortet.");
    box.replaceChildren(h("section", { class: "card" }, thinking("Claude wertet deine Antworten aus")));
    try {
      const res = await ctx.ai.place(responses.map((r) => ({ task: r.task + (r.revealed ? " (Text eingeblendet)" : ""), prompt: r.prompt, answer: r.answer })));
      result(res);
    } catch (e) {
      box.replaceChildren(errorBox(aiErrorMessage(e) || "Abgebrochen.", finish), manualPicker());
    }
  }

  function result({ level, reason_de }) {
    const sel = h("select", { id: "result-level", "aria-label": "Niveau anpassen" }, LEVELS.map((l) => h("option", { value: l }, l)));
    sel.value = level;
    box.replaceChildren(
      h("p", { class: "eyebrow" }, "Ergebnis"),
      h("section", { class: "card" },
        h("div", { class: "ladder" }, LEVELS.map((l, k) => h("span", { class: l === level ? "current" : k < LEVELS.indexOf(level) ? "reached" : "" }, l))),
        h("h1", {}, "Dein Niveau: " + level),
        reason_de && h("p", {}, reason_de),
        h("div", { class: "row" }, h("label", { for: "result-level", class: "small muted" }, "Passt nicht? Anpassen:"), sel),
        h("div", { class: "row end" }, h("button", {
          class: "primary",
          onclick: async () => {
            await ctx.setProfile({ level: sel.value, placedAt: new Date().toISOString(), reason_de });
            try {
              await ctx.store.addSession({ date: new Date().toISOString(), minutes: Math.max(1, Math.round((Date.now() - started) / 60000)), kind: "placement", summary_de: "Einstufung: " + sel.value });
            } catch {}
            toast("Los geht's – lycka till!");
            ctx.go("today");
          },
        }, "Los geht's")))
    );
  }
}
