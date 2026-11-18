// Bootstrap: resolve capabilities, load the profile, route between views.
import { createAI } from "./ai.js";
import { createSpeech, createMic } from "./speech.js";
import { createStore } from "./store.js";
import { needsPlacement, streak, dayKey } from "./level.js";
import { wireMicState, toast } from "./ui.js";
import * as today from "./views/today.js";
import * as progress from "./views/progress.js";
import * as placement from "./views/placement.js";
import * as talk from "./views/conversation.js";
import * as listen from "./views/listening.js";
import * as review from "./views/review.js";
import * as speak from "./views/shadowing.js";

const VIEWS = { today, progress, placement, talk, listen, speak, review };
const root = document.getElementById("view");

async function use(name) {
  try {
    return window.claude?.use ? await window.claude.use(name) : null;
  } catch {
    return null;
  }
}

const ctx = {
  ai: null, speech: null, mic: null, store: null,
  profile: null,
  params: {},
  get level() { return ctx.profile?.level || "A1"; },
  get rate() { return ctx.profile?.rate || 0.8; },
  async setProfile(patch) {
    ctx.profile = { ...(ctx.profile || {}), ...patch };
    try { await ctx.store.saveProfile(ctx.profile); } catch { toast("Speichern hat nicht geklappt."); }
    renderHeader();
  },
  async setRate(r) {
    await ctx.setProfile({ rate: r });
  },
  go(view, params = {}) {
    ctx.params = params;
    if (location.hash === "#" + view) route();
    else location.hash = view;
  },
  refreshHeader: () => renderHeader(),
};

let cleanup = null;
function route() {
  if (ctx.loadError) return renderLoadError();
  let name = location.hash.slice(1) || "today";
  if (!VIEWS[name]) name = "today";
  if (needsPlacement(ctx.profile) && name !== "placement") name = "placement";
  document.querySelectorAll("nav.tabs a").forEach((a) => {
    if (a.getAttribute("href") === "#" + name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  try { cleanup?.(); } catch {}
  cleanup = null;
  ctx.speech?.stop();
  ctx.mic?.stop();
  root.replaceChildren();
  const params = ctx.params;
  ctx.params = {};
  const out = VIEWS[name].render(root, ctx, params);
  if (typeof out === "function") cleanup = out;
  window.scrollTo({ top: 0 });
}

function renderLoadError() {
  const btn = document.createElement("button");
  btn.className = "primary";
  btn.textContent = "Erneut laden";
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      ctx.profile = await withTimeout(ctx.store.getProfile(), 10000);
      ctx.loadError = false;
      renderHeader();
      route();
    } catch {
      btn.disabled = false;
      toast("Immer noch keine Verbindung.");
    }
  };
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = "<h2>Deine Daten sind gerade nicht erreichbar</h2><p class='muted'>Dein Fortschritt ist sicher gespeichert, nur die Verbindung hakt. Prüfe dein Internet und versuche es nochmal.</p>";
  card.append(btn);
  root.replaceChildren(card);
}

async function renderHeader() {
  const lv = document.getElementById("hdr-level");
  const st = document.getElementById("hdr-streak");
  lv.hidden = !ctx.profile?.level;
  lv.textContent = ctx.profile?.level ? "Niveau " + ctx.profile.level : "";
  try {
    const stats = await ctx.store.getStats();
    const n = streak(stats.days, dayKey(new Date()));
    st.hidden = n === 0;
    st.textContent = "🔥 " + n + (n === 1 ? " Tag" : " Tage");
  } catch {
    st.hidden = true;
  }
}

async function boot() {
  const [sample, tts, dictation, db, user] = await Promise.all(["sample", "tts", "dictation", "db", "user"].map(use));
  ctx.ai = createAI(sample);
  ctx.speech = createSpeech(tts);
  ctx.mic = createMic(dictation);
  let uid = null;
  try { uid = user ? await user.id() : null; } catch {}
  ctx.store = createStore(db, uid);

  if (!ctx.mic.available) document.body.dataset.nomic = "";
  if (!ctx.speech.available) document.body.dataset.nospeech = "";
  ctx.mic.onUnavailable(() => (document.body.dataset.nomic = ""));
  ctx.speech.onUnavailable(() => {
    document.body.dataset.nospeech = "";
    toast("Vorlesen ist hier nicht verfügbar – der Text wird angezeigt.");
  });
  ctx.speech.onError((code) => toast(code === "rate_limited" ? "Vorlesen gerade pausiert – zu viele Anfragen." : "Vorlesen hat nicht geklappt."));
  if (ctx.mic.available) wireMicState(ctx.mic);
  // A page-side Stop whenever something is being read aloud.
  const stopBar = document.createElement("button");
  stopBar.className = "speaking-bar primary";
  stopBar.textContent = "■ Vorlesen stoppen";
  stopBar.hidden = true;
  stopBar.onclick = () => ctx.speech.stop();
  document.body.append(stopBar);
  ctx.speech.onState(({ state }) => (stopBar.hidden = state === "idle"));

  // Swedish voice check: if the platform lists languages and Swedish is missing, say so once.
  try {
    const langs = await tts?.languages?.();
    if (Array.isArray(langs) && !langs.some((l) => l.toLowerCase().startsWith("sv"))) {
      ctx.speechNoSwedish = true;
    }
  } catch {}

  try {
    ctx.profile = await withTimeout(ctx.store.getProfile(), 10000);
  } catch {
    ctx.profile = null;
    ctx.loadError = true;
  }
  renderHeader();
  window.addEventListener("hashchange", route);
  route();
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

boot();
