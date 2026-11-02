/* Waymo Care · Sunday Drive · the save and the postcards. The save is one small JSON record in localStorage
   (wc.sunday.v1) with exactly the fields the mode needs; the postcard PNGs live in IndexedDB (wc-sunday-photos) so the
   save stays tiny. Nothing here touches three.js. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const KEY = "wc.sunday.v1";
  const DB = "wc-sunday-photos";
  const STORE = "photos";
  let store = null;
  try {
    store = window.localStorage;
  } catch (e) {}

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const fresh = () => ({
    version: 1,
    freeDrive: false,
    mapSeals: 0,
    totalCared: 0,
    faresDelivered: 0,
    unlockedDistricts: ["lombard"],
    postcards: [],
    thankYouNotes: [],
  });

  function normalize(o) {
    const s = fresh();
    if (!o || typeof o !== "object") return s;
    s.version = 1;
    s.freeDrive = !!o.freeDrive;
    s.mapSeals = Math.max(0, Math.floor(num(o.mapSeals, 0)));
    s.totalCared = Math.max(0, Math.floor(num(o.totalCared, 0)));
    s.faresDelivered = Math.max(0, Math.floor(num(o.faresDelivered, 0)));
    const ids = Array.isArray(o.unlockedDistricts)
      ? o.unlockedDistricts.filter((x) => typeof x === "string")
      : [];
    if (!ids.includes("lombard")) ids.unshift("lombard");
    s.unlockedDistricts = Array.from(new Set(ids));
    s.postcards = Array.isArray(o.postcards)
      ? o.postcards
          .filter((p) => p && typeof p === "object" && p.id)
          .map((p) => ({
            id: String(p.id),
            title: String(p.title || "San Francisco"),
            landmark: p.landmark ? String(p.landmark) : "",
            waymo: !!p.waymo,
            car: p.car ? String(p.car) : "",
            filter: String(p.filter || "natural"),
            date: String(p.date || ""),
          }))
      : [];
    s.thankYouNotes = Array.isArray(o.thankYouNotes)
      ? o.thankYouNotes
          .filter((n) => n && typeof n === "object" && n.kind)
          .map((n) => ({
            kind: String(n.kind),
            text: String(n.text || ""),
            rider: String(n.rider || ""),
          }))
      : [];
    return s;
  }

  const A = {
    KEY,
    DB,
    STORE,
    fresh,
    normalize,
    load() {
      let raw = null;
      try {
        raw = store && store.getItem(KEY);
      } catch (e) {}
      if (!raw) return fresh();
      try {
        return normalize(JSON.parse(raw));
      } catch (e) {
        try {
          store && store.setItem(KEY + ".corrupt", raw);
        } catch (_) {}
        return fresh();
      }
    },
    save(S) {
      try {
        store && store.setItem(KEY, JSON.stringify(normalize(S)));
        return true;
      } catch (e) {
        return false;
      }
    },
    wipe() {
      try {
        store && store.removeItem(KEY);
      } catch (e) {}
    },
  };

  /* ---------- postcard images in IndexedDB ---------- */
  let dbp = null;
  const photoCache = new Map();
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no IndexedDB"));
      const r = window.indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE))
          r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => (dbp = null));
    return dbp;
  }
  A.putPhoto = (id, url) => {
    photoCache.set(id, url);
    return db()
      .then(
        (d) =>
          new Promise((res, rej) => {
            const t = d.transaction(STORE, "readwrite");
            t.objectStore(STORE).put(url, id);
            t.oncomplete = () => res(true);
            t.onerror = () => rej(t.error);
          }),
      )
      .catch(() => false);
  };
  A.getPhoto = (id) => {
    if (photoCache.has(id)) return Promise.resolve(photoCache.get(id));
    return db()
      .then(
        (d) =>
          new Promise((res) => {
            const r = d.transaction(STORE, "readonly").objectStore(STORE).get(id);
            r.onsuccess = () => {
              const url = r.result || null;
              if (url) photoCache.set(id, url);
              res(url);
            };
            r.onerror = () => res(null);
          }),
      )
      .catch(() => null);
  };
  A.delPhoto = (id) => {
    photoCache.delete(id);
    return db()
      .then(
        (d) =>
          new Promise((res) => {
            const t = d.transaction(STORE, "readwrite");
            t.objectStore(STORE).delete(id);
            t.oncomplete = () => res(true);
            t.onerror = () => res(false);
          }),
      )
      .catch(() => false);
  };
  A.listPhotos = () =>
    db()
      .then(
        (d) =>
          new Promise((res) => {
            const out = [];
            const r = d.transaction(STORE, "readonly").objectStore(STORE).openCursor();
            r.onsuccess = () => {
              const c = r.result;
              if (c) {
                out.push({ id: c.key, url: c.value });
                c.continue();
              } else res(out);
            };
            r.onerror = () => res(out);
          }),
      )
      .catch(() => []);

  // a small unique id for a postcard
  A.uid = () =>
    "pc_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 7);

  A.seal = function (S, n, why) {
    S.mapSeals = Math.max(0, S.mapSeals + (n || 1));
    return why || "";
  };

  WG.sundayAlbum = A;
})();
