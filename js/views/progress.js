import { h, fill, thinking, toast, speakButton } from "../ui.js";
import { LEVELS, dayKey, streak } from "../level.js";

const KIND = { conversation: "Gespräch", listening: "Hörübung", review: "Wiederholung", placement: "Einstufung", speaking: "Nachsprechen", grammar: "Grammatik" };

export function render(root, ctx) {
  const body = h("div", { class: "stack" }, h("div", { class: "card" }, thinking("Lade deinen Fortschritt")));
  root.append(h("h1", {}, "Fortschritt"), body, voiceCheck());
  let alive = true;
  load().catch(() => alive && fill(body, h("div", { class: "note err" }, "Konnte den Fortschritt nicht laden.")));
  return () => (alive = false);

  async function load() {
    const [items, sessions, stats] = await Promise.all([ctx.store.listReviewItems(), ctx.store.listSessions(10), ctx.store.getStats()]);
    if (!alive) return;
    const vocab = items.filter((i) => i.kind === "vocab");
    const mistakes = items.filter((i) => i.kind === "mistake").sort((a, b) => (b.count || 1) - (a.count || 1));
    const learned = vocab.filter((v) => (v.box || 0) >= 3).length;
    const days = new Set(stats.days);
    const minutes = stats.minutes;
    const st = streak([...days], dayKey(new Date()));

    const levelSel = h("select", { id: "level-select", "aria-label": "Niveau ändern" }, LEVELS.map((l) => h("option", { value: l }, l)));
    levelSel.value = ctx.level;
    levelSel.onchange = async () => {
      levelSel.disabled = true;
      await ctx.setProfile({ level: levelSel.value });
      levelSel.disabled = false;
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
              h("li", {}, h("div", { class: "spread" }, h("span", {}, h("span", { class: "wrong" }, m.wrong), " → ", h("span", { class: "right-txt" }, m.right)), h("span", { class: "row", style: "gap:6px" }, h("span", { class: "pill" }, (m.count || 1) + "×"), h("button", { disabled: !ctx.ai.available, onclick: () => ctx.go("grammar", { mistake: m }) }, "Regel lernen"))), m.rule_de && h("span", { class: "small muted" }, m.rule_de))))
          : h("p", { class: "muted" }, "Noch keine Fehler gesammelt. Nach deinem ersten Gespräch erscheinen sie hier.")),
      wordbook(vocab),
      h("section", { class: "card" },
        h("h3", {}, "Letzte Einheiten"),
        sessions.length
          ? h("ul", { class: "list" }, sessions.slice(0, 10).map((s) =>
              h("li", {}, h("div", { class: "spread" }, h("strong", {}, (KIND[s.kind] || s.kind) + (s.topic ? " · " + s.topic : "")), h("span", { class: "small muted" }, new Date(s.date).toLocaleDateString("de-DE") + " · " + (s.minutes || 0) + " Min.")), s.summary_de && h("span", { class: "small muted" }, s.summary_de))))
          : h("p", { class: "muted" }, "Noch keine Einheiten."))
    );
  }

  // Searchable word book: listen, see level, remove entries.
  function wordbook(vocab) {
    const sorted = [...vocab].sort((a, b) => String(a.sv).localeCompare(String(b.sv), "sv"));
    const search = h("input", { type: "text", id: "wordbook-search", placeholder: "Suchen (Schwedisch oder Deutsch) …" });
    const list = h("ul", { class: "list" });
    const LIMIT = 50;
    const deleting = new Set();
    const countEl = h("span", { class: "small muted" });
    const draw = () => {
      countEl.textContent = sorted.length + " Einträge";
      const q = search.value.trim().toLowerCase();
      const hits = sorted.filter((v) => !q || String(v.sv).toLowerCase().includes(q) || String(v.de).toLowerCase().includes(q));
      fill(list,
        hits.slice(0, LIMIT).map((v) => {
          const del = h("button", { class: "icon ghost", title: "Entfernen", "aria-label": "Entfernen", disabled: deleting.has(v), onclick: async () => {
            if (deleting.has(v)) return;
            deleting.add(v);
            del.disabled = true;
            try {
              await ctx.store.deleteItem(v);
              const k = sorted.indexOf(v);
              if (k >= 0) sorted.splice(k, 1);
              draw();
            } catch {
              del.disabled = false;
              toast("Löschen hat nicht geklappt.");
            } finally {
              deleting.delete(v);
            }
          } }, "✕");
          return h("li", {},
            h("div", { class: "spread" },
              h("span", { class: "row", style: "gap:6px" }, h("strong", { class: "sv", lang: "sv" }, v.sv), speakButton(ctx.speech, v.sv, { rate: () => ctx.rate })),
              h("span", { class: "row", style: "gap:6px" }, h("span", { class: "pill" + ((v.box || 0) >= 3 ? " good" : "") }, "Stufe " + (v.box || 0) + "/5"), del)),
            v.de && h("span", { class: "small muted" }, v.de));
        }),
        hits.length > LIMIT && h("li", { class: "small muted" }, `… und ${hits.length - LIMIT} weitere – grenze die Suche ein.`),
        !hits.length && h("li", { class: "muted" }, q ? "Nichts gefunden." : "Noch keine Wörter gesammelt."));
    };
    search.addEventListener("input", draw);
    draw();
    return h("section", { class: "card" },
      h("div", { class: "spread" }, h("h3", {}, "📖 Dein Wortschatz"), countEl),
      search, list);
  }

  // Small diagnostic: which languages the read-aloud offers, and how each voice sounds.
  function voiceCheck() {
    const sv = "Hej! Jag heter Astrid och jag bor i Göteborg. Sju sjösjuka sjömän.";
    const langs = ctx.ttsLanguages;
    return h("details", { class: "card needs-speech" },
      h("summary", {}, "🔧 Sprachausgabe testen"),
      h("p", { class: "small muted" }, "Vom System angebotene Sprachen: " + (langs ? langs.join(", ") || "keine" : "nicht abfragbar")),
      h("div", { class: "row" },
        h("button", { class: "speak", onclick: () => ctx.speech.say(sv) }, "🔊 Standardstimme"),
        h("button", { class: "speak", onclick: () => ctx.speech.say([{ speaker: "A", sv }]) }, "🔊 Dialogstimme A"),
        h("button", { class: "speak", onclick: () => ctx.speech.say([{ speaker: "B", sv }]) }, "🔊 Dialogstimme B")));
  }
}
