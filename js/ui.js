// Small DOM helpers shared by all views.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "hidden") el.hidden = !!v;
    else if (k === "value") el.value = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
export function toast(msg) {
  if (!msg) return;
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 3500);
}

export const thinking = (text = "Claude denkt nach") => h("p", { class: "thinking" }, text);

export function errorBox(msg, retry) {
  return h("div", { class: "note err row" }, h("span", {}, msg), retry && h("button", { onclick: retry }, "Nochmal versuchen"));
}

// --- Microphone -----------------------------------------------------------
let activeMic = null; // the button currently listening

export function micButton(mic, { onPartial, onFinal, label = "Sprechen" } = {}) {
  const btn = h("button", { class: "mic", type: "button", title: "Auf Schwedisch sprechen (nochmal klicken zum Stoppen)" }, "🎤 ", h("span", {}, label));
  const setOn = (on) => {
    btn.classList.toggle("on", on);
    btn.querySelector("span").textContent = on ? "Stopp" : label;
  };
  btn.addEventListener("click", () => {
    if (!mic.available) return;
    if (activeMic === btn) {
      mic.stop();
      return;
    }
    if (activeMic) activeMic._off?.();
    activeMic = btn;
    btn._off = () => setOn(false);
    setOn(true);
    // start() must run synchronously in the click handler
    mic
      .start({ onPartial, onFinal })
      .catch((e) => {
        if (activeMic === btn) activeMic = null;
        setOn(false);
        if (e?.code === "not_granted") toast("Mikrofon ist nicht freigegeben – du kannst tippen.");
        else if (e?.code === "unavailable") toast("Spracheingabe auf Schwedisch ist hier nicht verfügbar – bitte tippen.");
        else if (e?.code === "rate_limited") toast("Gerade zu viele Diktate – kurz warten.");
        else if (e?.code !== "stopped" && e?.code !== "dismissed") toast("Mikrofon-Problem – bitte tippen.");
      });
  });
  return btn;
}

/** Wire global mic state so whichever button is active resets when listening ends. */
export function wireMicState(mic) {
  mic.onState(({ state }) => {
    if (state === "idle" && activeMic) {
      activeMic._off?.();
      activeMic = null;
    }
  });
}

/** Textarea + mic + live partial line. Returns {el, input, interim, focus()} */
export function answerField(mic, { placeholder = "Antwort auf Schwedisch…", rows = 2, onEnter } = {}) {
  const input = h("textarea", { rows, placeholder, id: "ans-" + Math.random().toString(36).slice(2, 8) });
  const interim = h("div", { class: "interim small", "aria-live": "polite" });
  if (onEnter) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onEnter();
      }
    });
  }
  const btn = micButton(mic, {
    onPartial: (t) => (interim.textContent = t),
    onFinal: (t) => {
      interim.textContent = "";
      const cur = input.value;
      input.value = cur ? cur + t : t.replace(/^\s+/, "");
    },
  });
  const el = h("div", { class: "stack" }, input, interim, h("div", { class: "row" }, btn));
  return { el, input, interim, micBtn: btn, focus: () => input.focus() };
}

// --- Speech ----------------------------------------------------------------
export function speakButton(speech, getWhat, { label = "", rate } = {}) {
  return h(
    "button",
    {
      class: "speak" + (label ? "" : " icon"),
      type: "button",
      title: "Vorlesen",
      "aria-label": "Vorlesen",
      onclick: () => speech.say(typeof getWhat === "function" ? getWhat() : getWhat, { rate: typeof rate === "function" ? rate() : rate }),
    },
    "🔊",
    label && " " + label
  );
}

export function rateSelect(get, set) {
  const sel = h(
    "select",
    { class: "needs-speech", id: "rate-" + Math.random().toString(36).slice(2, 7), "aria-label": "Sprechtempo", onchange: (e) => set(+e.target.value) },
    h("option", { value: "0.8" }, "Langsam"),
    h("option", { value: "1" }, "Normal")
  );
  sel.value = String(get() === 1 ? "1" : "0.8");
  return sel;
}

export function fmtMin(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
