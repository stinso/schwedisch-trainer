import { h, thinking } from "../ui.js";
import { dueItems } from "../srs.js";
import { streak, dayKey, shouldSuggestRetest, LEVELS } from "../level.js";

const GREETINGS = ["God morgon!", "Hej hej!", "Välkommen tillbaka!", "Tjena!", "Hallå där!"];

export function render(root, ctx) {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 10 ? "God morgon!" : hour >= 18 ? "God kväll!" : GREETINGS[now.getDate() % GREETINGS.length];
  const head = h("div", { class: "stack" }, h("p", { class: "eyebrow" }, now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })), h("h1", {}, greet));
  const body = h("div", { class: "stack" }, h("div", { class: "card" }, thinking("Plane deinen Tag")));
  root.append(head, body);

  let alive = true;
  load().catch(() => {
    if (alive) body.replaceChildren(h("div", { class: "note err" }, "Konnte deine Daten nicht laden."));
  });
  return () => (alive = false);

  async function load() {
    const [items, sessions, draft] = await Promise.all([ctx.store.listReviewItems(), ctx.store.listSessions(), ctx.store.getDraft()]);
    if (!alive) return;
    const due = dueItems(items, now, 1000).length;
    const todayKey = dayKey(now);
    const todays = sessions.filter((s) => dayKey(new Date(s.date)) === todayKey);
    const did = (kind) => todays.some((s) => s.kind === kind);
    const minutesToday = todays.reduce((a, s) => a + (s.minutes || 0), 0);
    const days = sessions.map((s) => dayKey(new Date(s.date)));
    const st = streak(days, todayKey);

    const notes = [];
    if (!ctx.store.persistent) notes.push(h("div", { class: "note" }, "Fortschritt wird in dieser Ansicht nicht gespeichert. Öffne die Seite angemeldet auf claude.ai."));
    if (!ctx.ai.available) notes.push(h("div", { class: "note" }, "Claude ist hier nicht verfügbar. Öffne die Seite auf claude.ai in Chrome, damit Gespräche und Übungen funktionieren."));
    if (ctx.speechNoSwedish) notes.push(h("div", { class: "note" }, "Schwedische Sprachausgabe wird gerade nicht angeboten – Texte werden evtl. mit falscher Aussprache vorgelesen."));
    if (shouldSuggestRetest(ctx.profile?.placedAt, now))
      notes.push(h("div", { class: "note row" }, h("span", {}, "Zwei Wochen sind um – Zeit für eine neue Einstufung?"), h("button", { onclick: () => ctx.go("placement", { retest: true }) }, "Neu einstufen")));

    const step = (ico, title, sub, done, action, label) =>
      h("div", { class: "plan-step" + (done ? " done" : "") },
        h("span", { class: "ico", "aria-hidden": "true" }, done ? "✓" : ico),
        h("div", { class: "stack", style: "gap:2px" }, h("h3", {}, title), h("p", { class: "muted small" }, sub)),
        h("button", { class: done ? "" : "primary", onclick: action }, label));

    const plan = h("div", { class: "plan" });
    if (draft?.history?.length) {
      plan.append(step("💬", "Gespräch fortsetzen", `„${draft.topic}“ – ${draft.history.filter((t) => t.role === "user").length} Antworten bisher`, false, () => ctx.go("talk", { resume: true }), "Weiter"));
    }
    plan.append(
      step("🔁", "Wiederholen", due ? `${due} ${due === 1 ? "Eintrag ist" : "Einträge sind"} fällig · ca. ${Math.max(2, Math.ceil(Math.min(due, 20) / 3))} Min.` : "Nichts fällig – neue Wörter kommen aus deinen Gesprächen.", did("review") || !due, () => ctx.go("review"), due ? "Starten" : "Ansehen"),
      step("🗣️", "Gespräch zu einem Thema", "Sprechen, ✏️ bei Bedarf, Auswertung am Ende · ca. 10 Min.", did("conversation"), () => ctx.go("talk"), did("conversation") ? "Noch eins" : "Starten"),
      step("🎧", "Hörübung", "Kurzer Dialog + Verständnisfragen · ca. 5 Min.", did("listening"), () => ctx.go("listen"), did("listening") ? "Noch eine" : "Starten")
    );

    const weekRow = h("div", { class: "week" });
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const on = days.includes(dayKey(d));
      weekRow.append(h("div", {}, h("i", { class: on ? "on" : "" }), d.toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2)));
    }

    const ladder = h("div", { class: "ladder", "aria-label": "Niveau-Leiter" },
      LEVELS.map((l, i) => h("span", { class: l === ctx.level ? "current" : i < LEVELS.indexOf(ctx.level) ? "reached" : "" }, l)));

    body.replaceChildren(
      ...notes,
      h("section", { class: "card" }, h("div", { class: "spread" }, h("h2", {}, "Dein Plan für heute"), h("span", { class: "pill sun" }, `${minutesToday} Min. heute`)), plan),
      h("section", { class: "card" },
        h("div", { class: "spread" }, h("h3", {}, "Diese Woche"), h("span", { class: "muted small" }, st ? `${st} ${st === 1 ? "Tag" : "Tage"} am Stück` : "Heute starten und die Serie beginnen")),
        weekRow,
        h("div", { class: "spread" }, h("h3", {}, "Niveau"), h("a", { href: "#progress", class: "small" }, "Fortschritt ansehen")),
        ladder)
    );
  }
}
