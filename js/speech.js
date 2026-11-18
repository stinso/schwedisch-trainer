// Wrappers around `tts` and `dictation` with graceful fallbacks.
const VOICE = { A: "airy", B: "rounded" };
const GONE = new Set(["not_granted", "unavailable"]);

function listeners() {
  const fns = new Set();
  return { add: (fn) => (fns.add(fn), () => fns.delete(fn)), fire: (...a) => fns.forEach((f) => f(...a)) };
}

export function createSpeech(tts) {
  const gone = listeners();
  const errors = listeners();
  const api = {
    available: !!tts,
    onUnavailable: gone.add,
    onError: errors.add,
    onState: (fn) => (tts ? tts.onState(fn) : () => {}),
    async say(what, { rate } = {}) {
      if (!api.available) return;
      const input = Array.isArray(what)
        ? what.map((l) => ({ text: l.sv, voice: VOICE[l.speaker] || VOICE.A, language: "sv" }))
        : what;
      try {
        await tts.speak(input, { language: "sv", ...(rate ? { rate } : {}) });
      } catch (e) {
        if (GONE.has(e?.code)) {
          api.available = false;
          gone.fire(e.code);
        } else if (e?.code === "rate_limited" || e?.code === "upstream_error") {
          errors.fire(e.code);
        }
        // stopped / busy / no_gesture: nothing to do
      }
    },
    stop: () => (tts ? tts.stop().catch(() => {}) : Promise.resolve()),
  };
  return api;
}

export function createMic(dictation) {
  const gone = listeners();
  let handlers = {};
  if (dictation) {
    dictation.onPartial((e) => handlers.onPartial?.(e.text));
    dictation.onFinal((e) => handlers.onFinal?.(e.text));
  }
  const api = {
    available: !!dictation,
    onUnavailable: gone.add,
    onState: (fn) => (dictation ? dictation.onState(fn) : () => {}),
    active: () => !!dictation?.active?.(),
    // Must be called synchronously from a click/key handler.
    start(h = {}) {
      handlers = h;
      const p = dictation.start({ language: "sv" });
      return p.catch((e) => {
        if (GONE.has(e?.code)) {
          api.available = false;
          gone.fire(e.code);
        }
        throw e;
      });
    },
    stop: () => (dictation ? dictation.stop().catch(() => {}) : Promise.resolve()),
  };
  return api;
}
