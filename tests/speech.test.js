import { test } from "node:test";
import assert from "node:assert/strict";
import { createSpeech, createMic } from "../js/speech.js";

function fakeTts({ reject = null } = {}) {
  const calls = [];
  return {
    calls,
    speak: async (what, opts) => {
      calls.push({ what, opts });
      if (reject) throw reject;
      return { playedMs: 1 };
    },
    stop: async () => {},
    setRate: async () => {},
    onState: () => () => {},
  };
}

function fakeDictation({ reject = null } = {}) {
  const h = {};
  return {
    startCalls: 0,
    lastOpts: null,
    h,
    start(opts) {
      this.startCalls++;
      this.lastOpts = opts;
      return reject ? Promise.reject(reject) : Promise.resolve();
    },
    stop: async () => {},
    onPartial: (fn) => ((h.partial = fn), () => {}),
    onFinal: (fn) => ((h.final = fn), () => {}),
    onState: (fn) => ((h.state = fn), () => {}),
  };
}

test("createSpeech(null) and createMic(null) are unavailable", () => {
  assert.equal(createSpeech(null).available, false);
  assert.equal(createMic(null).available, false);
});

test("say(text) speaks Swedish at the given rate", async () => {
  const t = fakeTts();
  await createSpeech(t).say("Hej!", { rate: 0.8 });
  assert.equal(t.calls[0].what, "Hej!");
  assert.equal(t.calls[0].opts.language, "sv");
  assert.equal(t.calls[0].opts.rate, 0.8);
});

test("say(lines) maps speakers to voices and Swedish", async () => {
  const t = fakeTts();
  await createSpeech(t).say([{ speaker: "A", sv: "Hej" }, { speaker: "B", sv: "Tjena" }]);
  assert.deepEqual(t.calls[0].what, [
    { text: "Hej", voice: "airy", language: "sv" },
    { text: "Tjena", voice: "rounded", language: "sv" },
  ]);
});

test("TTS not_granted marks speech unavailable and notifies", async () => {
  const sp = createSpeech(fakeTts({ reject: { code: "not_granted" } }));
  let fired = 0;
  sp.onUnavailable(() => fired++);
  await sp.say("Hej");
  assert.equal(sp.available, false);
  assert.equal(fired, 1);
});

test("TTS stopped is not treated as unavailable", async () => {
  const sp = createSpeech(fakeTts({ reject: { code: "stopped" } }));
  await sp.say("Hej");
  assert.equal(sp.available, true);
});

test("mic.start calls dictation.start synchronously with Swedish", () => {
  const d = fakeDictation();
  const mic = createMic(d);
  const p = mic.start({});
  assert.equal(d.startCalls, 1);
  assert.deepEqual(d.lastOpts, { language: "sv" });
  return p;
});

test("mic routes partial and final text to the current handlers", async () => {
  const d = fakeDictation();
  const mic = createMic(d);
  const got = [];
  await mic.start({ onPartial: (t) => got.push("p:" + t), onFinal: (t) => got.push("f:" + t) });
  d.h.partial({ text: "hej" });
  d.h.final({ text: "hej då" });
  assert.deepEqual(got, ["p:hej", "f:hej då"]);
});

test("dictation unavailable for Swedish hides the mic and notifies", async () => {
  const mic = createMic(fakeDictation({ reject: { code: "unavailable" } }));
  let fired = 0;
  mic.onUnavailable(() => fired++);
  await mic.start({}).catch(() => {});
  assert.equal(mic.available, false);
  assert.equal(fired, 1);
});

test("dictation dismissed keeps the mic available", async () => {
  const mic = createMic(fakeDictation({ reject: { code: "dismissed" } }));
  await mic.start({}).catch(() => {});
  assert.equal(mic.available, true);
});

test("say(lines) passes line ids so the page can follow along", async () => {
  const t = fakeTts();
  await createSpeech(t).say([{ id: "l0", speaker: "A", sv: "Hej" }, { id: "l1", speaker: "B", sv: "Tjena" }]);
  assert.deepEqual(t.calls[0].what.map((l) => l.id), ["l0", "l1"]);
});

test("onLine, pause and resume pass through to tts and are safe without it", async () => {
  const seen = [];
  let lineFn;
  const t = { ...fakeTts(), onLine: (fn) => ((lineFn = fn), () => {}), pause: async () => seen.push("pause"), resume: async () => seen.push("resume") };
  const sp = createSpeech(t);
  const got = [];
  sp.onLine((e) => got.push(e.id));
  lineFn({ line: 1, id: "l1" });
  await sp.pause();
  await sp.resume();
  assert.deepEqual(got, ["l1"]);
  assert.deepEqual(seen, ["pause", "resume"]);
  const none = createSpeech(null);
  assert.equal(typeof none.onLine(() => {}), "function");
  await none.pause();
  await none.resume();
});
