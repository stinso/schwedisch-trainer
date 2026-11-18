import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore, normKey } from "../js/store.js";
import { needsPlacement } from "../js/level.js";
import { fakeDb } from "./fakeDb.js";

const NOW = new Date("2026-11-18T08:00:00Z");
const LATER = new Date("2026-11-20T08:00:00Z");
const SEG = /^[A-Za-z0-9_\-.~:@+]+$/;

test("normKey normalises case, whitespace, trailing punctuation", () => {
  assert.equal(normKey("  Hus "), normKey("hus"));
  assert.equal(normKey("Jag  gick."), normKey("jag gick"));
  assert.equal(normKey("Hej!?"), normKey("hej"));
});

test("normKey is a safe db segment, also for å ä ö and spaces", () => {
  for (const s of ["år", "en räka", "jag gick", "vad är klockan?", "x".repeat(400)]) {
    const k = normKey(s);
    assert.match(k, SEG, s);
    assert.ok(Buffer.byteLength(k) <= 150);
  }
  assert.notEqual(normKey("år"), normKey("ar"));
});

test("empty db: no profile, placement needed", async () => {
  const st = createStore(fakeDb(), "u1");
  const p = await st.getProfile();
  assert.equal(p, null);
  assert.equal(needsPlacement(p), true);
});

test("profile round-trips", async () => {
  const st = createStore(fakeDb(), "u1");
  await st.saveProfile({ level: "A2", placedAt: NOW.toISOString() });
  assert.equal((await st.getProfile()).level, "A2");
});

test("addVocab upserts by normalised key and keeps SRS state", async () => {
  const db = fakeDb();
  const st = createStore(db, "u1");
  await st.addVocab({ sv: "Hus", de: "Haus", source: "conv" }, NOW);
  let [item] = await st.listReviewItems();
  await st.saveReview(item, true, NOW);
  await st.addVocab({ sv: " hus ", de: "Haus (neu)", source: "listen" }, LATER);
  const items = await st.listReviewItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].box, 1);
  assert.equal(items[0].sv, "Hus");
});

test("addMistake twice increments count", async () => {
  const st = createStore(fakeDb(), "u1");
  await st.addMistake({ wrong: "jag gå", right: "jag gick", rule_de: "Präteritum" }, NOW);
  await st.addMistake({ wrong: "Jag gå.", right: "jag gick", rule_de: "Präteritum" }, LATER);
  const items = await st.listReviewItems();
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "mistake");
  assert.equal(items[0].count, 2);
});

test("listReviewItems tags kinds and saveReview persists the new box", async () => {
  const st = createStore(fakeDb(), "u1");
  await st.addVocab({ sv: "hus", de: "Haus" }, NOW);
  await st.addMistake({ wrong: "en hus", right: "ett hus", rule_de: "ett-Wort" }, NOW);
  const items = await st.listReviewItems();
  assert.deepEqual(items.map((i) => i.kind).sort(), ["mistake", "vocab"]);
  const m = items.find((i) => i.kind === "mistake");
  await st.saveReview(m, true, NOW);
  const again = (await st.listReviewItems()).find((i) => i.kind === "mistake");
  assert.equal(again.box, 1);
  assert.equal(again.kind, "mistake");
});

test("data lives under data/users/<uid>/", async () => {
  const db = fakeDb();
  const st = createStore(db, "u1");
  await st.saveProfile({ level: "A1" });
  await st.addVocab({ sv: "hus", de: "Haus" }, NOW);
  await st.addSession({ date: NOW.toISOString(), minutes: 5, kind: "review" });
  await st.saveDraft({ topic: "x", history: [], corrections: {}, startedAt: NOW.toISOString() });
  for (const k of db._docs.keys()) assert.ok(k.startsWith("data/users/u1/"), k);
});

test("draft survives a new store instance and can be cleared", async () => {
  const db = fakeDb();
  const draft = {
    topic: "Im Café",
    history: [{ role: "assistant", content: "Hej!" }, { role: "user", content: "Hej" }],
    corrections: { 1: { ok: true, corrected: "Hej", natural: "Hej!", explanation_de: "" } },
    startedAt: NOW.toISOString(),
  };
  await createStore(db, "u1").saveDraft(draft);
  const st2 = createStore(db, "u1");
  assert.deepEqual(await st2.getDraft(), draft);
  await st2.clearDraft();
  assert.equal(await st2.getDraft(), null);
});

test("sessions list newest first", async () => {
  const st = createStore(fakeDb(), "u1");
  await st.addSession({ date: NOW.toISOString(), minutes: 5, kind: "review" });
  await st.addSession({ date: LATER.toISOString(), minutes: 10, kind: "conversation", topic: "x" });
  const s = await st.listSessions();
  assert.deepEqual(s.map((x) => x.minutes), [10, 5]);
});

test("no db or uid → non-persistent no-op store", async () => {
  const st = createStore(null, null);
  assert.equal(st.persistent, false);
  assert.equal(await st.getProfile(), null);
  await st.saveProfile({ level: "A1" });
  await st.addVocab({ sv: "hus" }, NOW);
  assert.deepEqual(await st.listReviewItems(), []);
  assert.deepEqual(await st.listSessions(), []);
  assert.equal(await st.getDraft(), null);
});
