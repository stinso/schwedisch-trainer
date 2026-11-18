// Per-user persistence on the artifact `db` capability.
// Layout (all private to the viewer):
//   data/users/<uid>/profile                 profile doc
//   data/users/<uid>/profile/vocab/<key>     vocab items (SRS)
//   data/users/<uid>/profile/mistakes/<key>  mistake items (SRS)
//   data/users/<uid>/profile/sessions/<id>   session summaries
//   data/users/<uid>/draft                   running conversation
import { newItem, review } from "./srs.js";
import { dayKey } from "./level.js";

const dayKeyOf = (iso) => dayKey(new Date(iso));

const SAFE = /[a-z0-9_\-.]/;

export function normText(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,!?;:"'«»„“”…–-]+|[\s.,!?;:"'«»„“”…–-]+$/g, "");
}

export function normKey(s) {
  let out = "";
  for (const ch of normText(s)) {
    if (SAFE.test(ch)) out += ch;
    else if (ch === " ") out += "+";
    else out += [...new TextEncoder().encode(ch)].map((b) => "~" + b.toString(16).padStart(2, "0")).join("");
    if (out.length >= 150) break;
  }
  out = out.slice(0, 150);
  if (!out || out === "." || out === "..") out = "_" + out;
  return out;
}

const strip = ({ id, kind, ...rest }) => rest;

function noopStore() {
  const nil = async () => null;
  const none = async () => [];
  const ok = async () => {};
  return {
    persistent: false,
    getProfile: nil, saveProfile: ok,
    addVocab: ok, addMistake: ok,
    listReviewItems: none, saveReview: ok, deleteItem: ok,
    addSession: ok, listSessions: none,
    getStats: async () => ({ minutes: 0, sessions: 0, days: [] }),
    getDraft: nil, saveDraft: ok, clearDraft: ok,
  };
}

export function createStore(db, uid) {
  if (!db || !uid) return noopStore();
  const base = "data/users/" + uid;
  const profileRef = db.doc(base + "/profile");
  const draftRef = db.doc(base + "/draft");
  const vocab = profileRef.collection("vocab");
  const mistakes = profileRef.collection("mistakes");
  const sessions = profileRef.collection("sessions");
  const col = { vocab, mistake: mistakes };

  const statsRef = db.doc(base + "/stats");
  // Delivered snapshot bodies are frozen: always hand out deep copies.
  const copy = (v) => JSON.parse(JSON.stringify(v));
  const list = async (c, kind) => (await c.get()).docs.map((d) => ({ ...copy(d.data()), id: d.id, kind }));
  let statsChain = Promise.resolve();

  return {
    persistent: true,

    async getProfile() {
      const s = await profileRef.get();
      return s.exists ? copy(s.data()) : null;
    },
    saveProfile: (p) => profileRef.set({ ...p }),

    async addVocab({ sv, de = "", source = "" }, now) {
      if (!normText(sv)) return;
      const ref = vocab.doc(normKey(sv));
      const s = await ref.get();
      if (s.exists) return; // keep existing SRS state
      await ref.set(newItem({ sv: String(sv).trim(), de, source, createdAt: now.toISOString() }, now));
    },

    async addMistake({ wrong, right = "", rule_de = "", source = "" }, now) {
      if (!normText(wrong)) return;
      const ref = mistakes.doc(normKey(wrong));
      const s = await ref.get();
      if (s.exists) {
        const cur = s.data();
        await ref.set({ ...cur, right: right || cur.right, rule_de: rule_de || cur.rule_de, count: (cur.count || 1) + 1, box: 0, due: now.toISOString() });
        return;
      }
      await ref.set(newItem({ wrong: String(wrong).trim(), right, rule_de, source, count: 1, createdAt: now.toISOString() }, now));
    },

    async listReviewItems() {
      const [v, m] = await Promise.all([list(vocab, "vocab"), list(mistakes, "mistake")]);
      return [...v, ...m];
    },

    deleteItem: (item) => col[item.kind].doc(item.id).delete(),

    async saveReview(item, correct, now) {
      const next = review(strip(item), correct, now);
      await col[item.kind].doc(item.id).set(next);
      return { ...next, id: item.id, kind: item.kind };
    },

    async addSession(s) {
      await sessions.add({ ...s });
      // Running totals, so stats never depend on a capped session list.
      const day = dayKeyOf(s.date);
      statsChain = statsChain.then(async () => {
        const snap = await statsRef.get();
        const cur = snap.exists ? copy(snap.data()) : { minutes: 0, sessions: 0, days: [] };
        await statsRef.set({
          minutes: (cur.minutes || 0) + (s.minutes || 0),
          sessions: (cur.sessions || 0) + 1,
          days: cur.days?.includes(day) ? cur.days : [...(cur.days || []), day],
        });
      });
      await statsChain;
    },

    async getStats() {
      const snap = await statsRef.get();
      const d = snap.exists ? copy(snap.data()) : {};
      return { minutes: d.minutes || 0, sessions: d.sessions || 0, days: d.days || [] };
    },

    async listSessions(limit = 200) {
      return (await sessions.orderBy("date", "desc").limit(limit).get()).docs.map((d) => ({ ...d.data(), id: d.id }));
    },

    async getDraft() {
      const s = await draftRef.get();
      return s.exists ? copy(s.data()) : null;
    },
    saveDraft: (d) => draftRef.set({ ...d }),
    clearDraft: () => draftRef.delete(),
  };
}
