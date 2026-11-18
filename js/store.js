// Per-user persistence on the artifact `db` capability.
// Layout (all private to the viewer):
//   data/users/<uid>/profile                 profile doc
//   data/users/<uid>/profile/vocab/<key>     vocab items (SRS)
//   data/users/<uid>/profile/mistakes/<key>  mistake items (SRS)
//   data/users/<uid>/profile/sessions/<id>   session summaries
//   data/users/<uid>/draft                   running conversation
import { newItem, review } from "./srs.js";

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
    listReviewItems: none, saveReview: ok,
    addSession: ok, listSessions: none,
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

  const list = async (c, kind) => (await c.get()).docs.map((d) => ({ ...d.data(), id: d.id, kind }));

  return {
    persistent: true,

    async getProfile() {
      const s = await profileRef.get();
      return s.exists ? s.data() : null;
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

    async saveReview(item, correct, now) {
      const next = review(strip(item), correct, now);
      await col[item.kind].doc(item.id).set(next);
      return { ...next, id: item.id, kind: item.kind };
    },

    addSession: (s) => sessions.add({ ...s }),

    async listSessions(limit = 200) {
      return (await sessions.orderBy("date", "desc").limit(limit).get()).docs.map((d) => ({ ...d.data(), id: d.id }));
    },

    async getDraft() {
      const s = await draftRef.get();
      return s.exists ? s.data() : null;
    },
    saveDraft: (d) => draftRef.set({ ...d }),
    clearDraft: () => draftRef.delete(),
  };
}
