// "Mehr dazu · Frage stellen" under one point of an evaluation: opening it fetches a
// deeper explanation, then the learner can keep asking follow-up questions.
import { h, thinking, errorBox } from "./ui.js";
import { aiErrorMessage } from "./ai.js";

export function askPanel(ctx, { topic, history, item }) {
  const qa = [];
  let busy = false;
  const thread = h("div", { class: "ask-thread" });
  const input = h("input", { type: "text", placeholder: "Frage dazu stellen…", "aria-label": "Frage dazu stellen" });
  const btn = h("button", { type: "submit" }, "Fragen");
  const form = h("form", { class: "ask-form", onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); if (q) ask(q); } }, input, btn);
  const details = h("details", { class: "ask" }, h("summary", {}, "Mehr dazu · Frage stellen"), thread, form);
  details.addEventListener("toggle", () => {
    if (details.open && !qa.length && !busy) ask("");
  });

  async function ask(q) {
    if (busy || !ctx.ai?.available) return;
    busy = true;
    btn.disabled = true;
    const qEl = q ? h("p", { class: "ask-q" }, q) : null;
    if (qEl) thread.append(qEl);
    input.value = "";
    const aEl = h("p", { class: "ask-a" }, thinking(""));
    thread.append(aEl);
    qa.push({ q, a: "" });
    try {
      const text = await ctx.ai.discuss(ctx.level, topic, history, item, qa, { onText: ({ text }) => (aEl.textContent = text) });
      aEl.textContent = text;
      qa.at(-1).a = text;
    } catch (e) {
      qa.pop();
      qEl?.remove();
      const err = errorBox(aiErrorMessage(e), () => { err.remove(); ask(q); });
      aEl.replaceWith(err);
    } finally {
      busy = false;
      btn.disabled = false;
    }
  }
  return details;
}
