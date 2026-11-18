// Clickable Swedish text: click a word (or select several) to get it explained,
// plus a "translate the whole thing" button. Needs ctx.ai, ctx.store, ctx.speech, ctx.level.
import { h, fill, thinking, errorBox, speakButton } from "./ui.js";
import { tokenize } from "./words.js";
import { aiErrorMessage } from "./ai.js";

const cache = new Map(); // explanations and translations within this page load

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key);
}

// Returns { text, translateBtn, panel }: put `text` where the Swedish goes,
// `translateBtn` among the tools, `panel` below (shows translation / explanations).
export function glossable(ctx, sv, { className = "sv", source = "gespräch" } = {}) {
  const panel = h("div", { class: "gloss", hidden: true });
  const trLine = h("p", { class: "gloss-tr", hidden: true });
  const explainBox = h("div", { class: "gloss-word", hidden: true });
  panel.append(trLine, explainBox);
  const show = () => (panel.hidden = trLine.hidden && explainBox.hidden);

  const text = h("p", { class: className + " glossable", lang: "sv", title: "Wort anklicken oder mehrere markieren" },
    tokenize(sv).map((t) => (t.word ? h("span", { class: "w" }, t.text) : t.text)));

  let skipClick = false;
  text.addEventListener("mouseup", () => {
    const sel = window.getSelection?.();
    const picked = sel && !sel.isCollapsed && text.contains(sel.anchorNode) && text.contains(sel.focusNode) ? sel.toString().trim() : "";
    if (picked && /[\p{L}\p{N}]/u.test(picked)) {
      skipClick = true;
      explain(picked);
    }
  });
  text.addEventListener("click", (e) => {
    if (skipClick) return void (skipClick = false);
    if (text.classList.contains("hidden-text")) return; // first click only reveals (listen mode)
    const w = e.target.closest?.(".w");
    if (w) explain(w.textContent);
  });

  function mark(phrase) {
    text.querySelectorAll(".w.on").forEach((el) => el.classList.remove("on"));
    const parts = phrase.toLowerCase().split(/\s+/);
    text.querySelectorAll(".w").forEach((el) => parts.includes(el.textContent.toLowerCase()) && el.classList.add("on"));
  }

  async function explain(phrase) {
    if (!ctx.ai?.available) return;
    mark(phrase);
    explainBox.hidden = false;
    show();
    fill(explainBox, thinking("Erkläre „" + phrase + "“"));
    try {
      const r = await cached("x|" + ctx.level + "|" + phrase.toLowerCase() + "|" + sv, () => ctx.ai.explain(ctx.level, phrase, sv));
      const save = h("button", { class: "ghost", onclick: async () => {
        save.disabled = true;
        try {
          await ctx.store.addVocab({ sv: r.base_sv, de: r.de, source }, new Date());
          save.textContent = "✓ im Wortschatz";
        } catch {
          save.disabled = false;
          save.textContent = "Speichern fehlgeschlagen – nochmal";
        }
      } }, "+ Wortschatz");
      fill(explainBox,
        h("div", { class: "spread" },
          h("span", {}, h("strong", { lang: "sv" }, r.phrase), r.base_sv && r.base_sv.toLowerCase() !== r.phrase.toLowerCase() ? h("span", { class: "muted", lang: "sv" }, " (" + r.base_sv + ")") : null, " = ", r.de),
          h("button", { class: "ghost", "aria-label": "Schließen", onclick: () => { explainBox.hidden = true; mark(""); show(); } }, "✕")),
        r.note_de && h("span", { class: "small muted" }, r.note_de),
        h("div", { class: "row" }, speakButton(ctx.speech, r.base_sv || r.phrase, { rate: () => ctx.rate }), save));
    } catch (e) {
      fill(explainBox, errorBox(aiErrorMessage(e), () => explain(phrase)));
    }
  }

  async function translate() {
    if (!trLine.hidden) { trLine.hidden = true; return show(); }
    trLine.hidden = false;
    show();
    fill(trLine, thinking("Übersetze"));
    try {
      const r = await cached("t|" + sv, () => ctx.ai.translate(ctx.level, sv));
      fill(trLine, h("span", { class: "small muted" }, "🇩🇪 "), r.de);
    } catch (e) {
      fill(trLine, errorBox(aiErrorMessage(e), () => { trLine.hidden = true; translate(); }));
    }
  }

  const translateBtn = h("button", { type: "button", title: "Ganzen Text übersetzen", "aria-label": "Übersetzen", disabled: !ctx.ai?.available, onclick: translate }, "DE");
  return { text, translateBtn, panel };
}
