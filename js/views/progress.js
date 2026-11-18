import { h, fill, thinking, toast } from "../ui.js";
import { LEVELS, dayKey, streak } from "../level.js";

const KIND = { conversation: "Gespräch", listening: "Hörübung", review: "Wiederholung", placement: "Einstufung" };

export function render(root, ctx) {
  const body = h("div", { class: "stack" }, h("div", { class: "card" }, thinking("Lade deinen Fortschritt")));
  root.append(h("h1", {}, "Fortschritt"), body);
  let alive = true;
  load().catch(() => alive && fill(body, h("div", { class: "note err" }, "Konnte den Fortschritt nicht laden.")));
  return () => (alive = false);

  async function load() {
    const [items, sessions] = await Promise.all([ctx.store.listReviewItems(), ctx.store.listSessions()]);
    if (!alive) return;
    const vocab = items.filter((i) => i.kind === "vocab");
    const mistakes = items.filter((i) => i.kind === "mistake").sort((a, b) => (b.count || 1) - (a.count || 1));
    const learned = vocab.filter((v) => (v.box || 0) >= 3).length;
    const days = new Set(sessions.map((s) => dayKey(new Date(s.date))));
    const minutes = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
    const st = streak([...days], dayKey(new Date()));

    const levelSel = h("select", { id: "level-select", "aria-label": "Niveau ändern" }, LEVELS.map((l) => h("option", { value: l }, l)));
    levelSel.value = ctx.level;
    levelSel.onchange = async () => {
      await ctx.setProfile({ level: levelSel.value });
      toast("Niveau auf " + levelSel.value + " gesetzt.");
    };

    const stat = (n, label) => h("div", { class: "stat" }, h("b", {}, n), h("span", { class: "muted small" }, label));

    fill(body, 
      h("section", { class: "card" },
        h("div", { class: "spread" }, h("h2", {}, "Niveau " + ctx.level), h("div", { class: "row" }, h("label", { for: "level-select", class: "small muted" }, "Ändern:"), levelSel)),
        h("div", { class: "ladder" }, LEVELS.map((l, i) => h("span", { class: l === ctx.level ? "current" : i < LEVELS.indexOf(ctx.level) ? "reached" : "" }, l))),
        ctx.profile?.reason_de && h("p", { class: "muted" }, ctx.profile.reason_de),
        h("div", { class: "row" },
          ctx.profile?.placedAt && h("span", { class: "small muted" }, "Eingestuft am " + new Date(ctx.profile.placedAt).toLocaleDateString("de-DE")),
          h("button", { onclick: () => ctx.go("placement", { retest: true }) }, "Neu einstufen"))),
      h("section", { class: "stats" },
        stat(days.size, days.size === 1 ? "Tag geübt" : "Tage geübt"),
        stat(st, st === 1 ? "Tag am Stück" : "Tage am Stück"),
        stat(minutes, "Minuten gesamt"),
        stat(vocab.length, "Wörter & Wendungen"),
        stat(learned, "davon sicher")),
      h("section", { class: "card" },
        h("h3", {}, "Deine häufigsten Fehler"),
        mistakes.length
          ? h("ul", { class: "list" }, mistakes.slice(0, 5).map((m) =>
              h("li", {}, h("div", { class: "spread" }, h("span", {}, h("span", { class: "wrong" }, m.wrong), " → ", h("span", { class: "right-txt" }, m.right)), h("span", { class: "pill" }, (m.count || 1) + "×")), m.rule_de && h("span", { class: "small muted" }, m.rule_de))))
          : h("p", { class: "muted" }, "Noch keine Fehler gesammelt. Nach deinem ersten Gespräch erscheinen sie hier.")),
      h("section", { class: "card" },
        h("h3", {}, "Letzte Einheiten"),
        sessions.length
          ? h("ul", { class: "list" }, sessions.slice(0, 10).map((s) =>
              h("li", {}, h("div", { class: "spread" }, h("strong", {}, (KIND[s.kind] || s.kind) + (s.topic ? " · " + s.topic : "")), h("span", { class: "small muted" }, new Date(s.date).toLocaleDateString("de-DE") + " · " + (s.minutes || 0) + " Min.")), s.summary_de && h("span", { class: "small muted" }, s.summary_de))))
          : h("p", { class: "muted" }, "Noch keine Einheiten."))
    );
  }
}
