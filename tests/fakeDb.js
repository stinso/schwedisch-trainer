// In-memory stand-in for the artifact `db` capability (subset used by store.js).
export function fakeDb() {
  const docs = new Map();
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const snap = (path) => {
    const has = docs.has(path);
    const body = has ? deepFreeze(clone(docs.get(path))) : undefined;
    return { id: path.split("/").at(-1), exists: has, data: () => body, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const segs = (p) => p.split("/").length;

  function doc(path) {
    if (segs(path) % 2) throw new TypeError("doc path needs even segments: " + path);
    return {
      id: path.split("/").at(-1),
      path,
      get: async () => snap(path),
      set: async (d) => void docs.set(path, clone(d)),
      update: async (d) => {
        if (!docs.has(path)) throw { code: "invalid_argument", message: "missing" };
        docs.set(path, { ...docs.get(path), ...clone(d) });
      },
      delete: async () => void docs.delete(path),
      collection: (sub) => collection(path + "/" + sub),
    };
  }

  function query(path, filters = [], order = null, lim = null) {
    return {
      where: (f, op, v) => query(path, [...filters, [f, op, v]], order, lim),
      orderBy: (f, dir = "asc") => query(path, filters, [f, dir], lim),
      limit: (n) => query(path, filters, order, n),
      async get() {
        let list = [...docs.keys()]
          .filter((k) => k.startsWith(path + "/") && segs(k) === segs(path) + 1)
          .sort()
          .map(snap);
        for (const [f, op, v] of filters) {
          list = list.filter((s) => {
            const x = s.data()[f];
            return op === "==" ? x === v : op === "<=" ? x <= v : op === ">=" ? x >= v : op === "<" ? x < v : op === ">" ? x > v : true;
          });
        }
        if (order) {
          const [f, dir] = order;
          list.sort((a, b) => (a.data()[f] < b.data()[f] ? -1 : a.data()[f] > b.data()[f] ? 1 : 0) * (dir === "desc" ? -1 : 1));
        }
        if (lim) list = list.slice(0, lim);
        return { docs: list, size: list.length, empty: list.length === 0 };
      },
    };
  }

  let n = 0;
  function collection(path) {
    if (segs(path) % 2 === 0) throw new TypeError("collection path needs odd segments: " + path);
    return {
      ...query(path),
      path,
      doc: (id) => doc(path + "/" + (id ?? "auto" + ++n)),
      add: async (d) => {
        const r = doc(path + "/auto" + ++n);
        await r.set(d);
        return r;
      },
    };
  }

  return { doc, collection, _docs: docs };
}
