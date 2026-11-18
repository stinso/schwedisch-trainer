import { h, thinking, answerField, speakButton } from "../ui.js";
import { dueItems } from "../srs.js";
import { exerciseFor, localMatch } from "../exercise.js";
import { aiErrorMessage } from "../ai.js";

export function render(root, ctx) {
  let alive = true;
  const started = Date.now();
  const box = h("div", { class: "stack" });
  root.append(h("div", { class: "stack" }, h("p", { class: "eyebrow" }, "Wiederholung"), h("h1", {}, "Was du gelernt hast")), box);
  box.append(h("div", { class: "card" }, thinking("Suche fällige Einträge")));
  let queue = [];
  let idx = 0;
  let right = 0;

  ctx.store.listReviewItems().then((items) => {
    if (!alive) return;
    queue = dueItems(items, new Date(), 20);
    if (!queue.length) return empty(items);
    next();
  }, () => alive && box.replaceChildren(h("div", { class: "note err" }, "Konnte die Wiederholung nicht laden.")));

  return () => (alive = false);

  function empty(items) {
    box.replaceChildren(h("section", { class: "card flash" },
      h("p", { class: "big-sv" }, "Allt klart! 🎉"),
      h("p", { class: "muted" }, items.length ? "Heute ist nichts mehr fällig. Neue Einträge kommen aus deinen Gesprächen und Hörübungen." : "Noch nichts zu wiederholen. Führe ein Gespräch – deine Fehler und neuen Wörter landen hier."),
      h("div", { class: "row" },
        items.length > 0 && h("button", { onclick: () => { queue = [...items].sort((a, b) => (a.box || 0) - (b.box || 0)).slice(0, 10); idx = 0; right = 0; next(); } }, "Trotzdem üben"),
        h("button", { class: "primary", onclick: () => ctx.go("talk") }, "Gespräch starten"))));
  }

  function next() {
    if (idx >= queue.length) return done();
    const item = queue[idx];
    const ex = exerciseFor(item);
    const field = answerField(ctx.mic, { placeholder: ex.answerLang === "sv" ? "Auf Schwedisch…" : "Auf Deutsch…", onEnter: () => check() });
    if (ex.answerLang !== "sv") field.micBtn.remove();
    const result = h("div", { class: "stack" });
    const actions = h("div", { class: "row end" },
      h("button", { class: "ghost", onclick: () => reveal() }, "Lösung zeigen"),
      h("button", { class: "primary", onclick: () => check() }, "Prüfen"));
    const showSv = ex.mode !== "de2sv";
    box.replaceChildren(
      h("div", { class: "spread" }, h("span", { class: "small muted" }, `${idx + 1} von ${queue.length}`), h("span", { class: "pill" }, item.kind === "mistake" ? "Eigener Fehler" : "Wort / Wendung")),
      h("div", { class: "progressbar" }, h("i", { style: `width:${(idx / queue.length) * 100}%` })),
      h("section", { class: "card" },
        h("p", { class: "eyebrow" }, ex.title),
        h("div", { class: "row" },
          h("p", { class: showSv ? "big-sv" : "big-sv", lang: showSv ? "sv" : "de", style: ex.mode === "fix" ? "text-decoration: line-through; text-decoration-color: var(--bad)" : "" }, ex.show),
          showSv && speakButton(ctx.speech, ex.show, { rate: () => ctx.rate })),
        field.el, result, actions)
    );
    if (ex.mode === "sv2de" && ctx.speech.available) ctx.speech.say(ex.show, { rate: ctx.rate });
    field.focus();

    let settled = false;
    async function check() {
      if (settled) return;
      const ans = field.input.value.trim();
      if (!ans) return reveal();
      if (ex.selfCheck) return reveal(ans);
      if (localMatch(ans, ex.expected)) return grade(true, "");
      if (!ctx.ai.available) return reveal(ans);
      actions.hidden = true;
      result.replaceChildren(thinking("Prüfe"));
      try {
        const r = await ctx.ai.checkReview({ prompt_de: `${ex.title} „${ex.show}“`, answer_sv: ex.expected }, ans);
        grade(r.correct, r.feedback_de);
      } catch (e) {
        result.replaceChildren(h("div", { class: "note err" }, aiErrorMessage(e)));
        reveal(ans);
      }
    }

    function reveal(ans) {
      if (settled) return;
      actions.hidden = true;
      result.replaceChildren(
        solution(),
        h("p", { class: "small muted" }, ans ? "Stimmt deine Antwort?" : "Wusstest du es?"),
        h("div", { class: "row end" },
          h("button", { onclick: () => grade(false, "", true) }, "Nein, nochmal üben"),
          h("button", { class: "primary", onclick: () => grade(true, "", true) }, ans ? "Ja, war richtig" : "Ja, gewusst")));
    }

    function solution() {
      return h("div", { class: "stack", style: "gap:4px" },
        h("span", { class: "small muted" }, "Lösung"),
        h("div", { class: "row" }, h("strong", { class: "sv", lang: ex.answerLang }, ex.expected || "–"), ex.answerLang === "sv" && ex.expected && speakButton(ctx.speech, ex.expected, { rate: () => ctx.rate })),
        ex.hint && h("span", { class: "small" }, ex.hint));
    }

    async function grade(ok, feedback, selfGraded = false) {
      if (settled) return;
      settled = true;
      if (ok) right++;
      const advance = (result) => { ctx.store.saveReview(item, result, new Date()).catch(() => {}); idx++; next(); };
      const cont = h("button", { class: "primary", onclick: () => advance(ok) }, idx + 1 < queue.length ? "Weiter" : "Fertig");
      result.replaceChildren(
        !selfGraded && h("div", { class: "row" }, h("span", { class: "pill " + (ok ? "good" : "bad") }, ok ? "Richtig!" : "Nicht ganz"), feedback && h("span", {}, feedback)),
        (!ok || ex.hint || selfGraded) && solution(),
        h("div", { class: "row end" },
          !ok && !selfGraded && h("button", { class: "ghost", onclick: () => { right++; advance(true); } }, "Ich hatte doch recht"),
          cont)
      );
      actions.hidden = true;
      if (ok && ex.answerLang === "sv" && ctx.speech.available) ctx.speech.say(ex.expected, { rate: ctx.rate });
      cont.focus();
    }
  }

  async function done() {
    box.replaceChildren(h("section", { class: "card flash" },
      h("p", { class: "big-sv" }, right === queue.length ? "Perfekt! 🌟" : "Bra! 👏"),
      h("p", {}, `${right} von ${queue.length} gewusst.`),
      h("div", { class: "row" }, h("button", { class: "primary", onclick: () => ctx.go("talk") }, "Gespräch starten"), h("button", { onclick: () => ctx.go("today") }, "Zur Übersicht"))));
    await ctx.store.addSession({ date: new Date().toISOString(), minutes: Math.max(1, Math.round((Date.now() - started) / 60000)), kind: "review", summary_de: `${right}/${queue.length} gewusst` }).catch(() => {});
    ctx.refreshHeader();
  }
}
