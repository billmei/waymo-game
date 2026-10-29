/* Waymo Care · Adopt-a-Waymo · the save. Loads, saves and migrates localStorage["wc.adopt.v1"], keeps a last-known-good
   copy in wc.adopt.bak, runs the time-away catch-up (through js/adopt/sim.js), owns the seeded RNG (mulberry32, its
   state kept in the save so a debug run repeats) and stores the postcard photos in IndexedDB (wc-adopt / postcards).
   Runs in Node too (tools/adopt_sim.js): storage is only touched when it exists. */
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  const WG = (root.WG = root.WG || {});
  const KEY = "wc.adopt.v1",
    BAK = "wc.adopt.bak",
    BAD = "wc.adopt.corrupt";
  const store = (() => {
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  })();

  /* ---------- the seeded RNG: mulberry32, its state in S.log.rng ---------- */
  function rand(S) {
    let a = (S.log.rng = (S.log.rng + 0x6d2b79f5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (S, a, b) => a + Math.floor(rand(S) * (b - a + 1));
  const pick = (S, arr) => arr[Math.floor(rand(S) * arr.length)];
  // a weighted pick from [[weight, value], …]
  function wpick(S, rows) {
    let sum = 0;
    for (const r of rows) sum += r[0];
    let x = rand(S) * sum;
    for (const r of rows) if ((x -= r[0]) < 0) return r[1];
    return rows[rows.length - 1][1];
  }
  function shuffle(S, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand(S) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- the real calendar (local time: the dailies reset at local midnight) ---------- */
  const pad = (n) => String(n).padStart(2, "0");
  const today = (now) => {
    const d = new Date(now);
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  };
  const dayNum = (date) => Math.round(Date.parse(date + "T12:00:00") / 864e5);
  const daysBetween = (a, b) => dayNum(b) - dayNum(a);
  // the Monday that starts this date's week, as a date string (the Car Show's week)
  function weekOf(now) {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return today(d.getTime());
  }

  /* ---------- a fresh save (the schema in the design brief §8, plus what the lands keep) ---------- */
  function fresh(now, seed) {
    seed = seed === undefined ? (now ^ 0x5eed) >>> 0 : seed;
    return {
      v: 1,
      createdAt: now,
      lastSeen: now,
      settings: { offline: "gentle", speed: 1 },
      clock: {
        day: 1,
        minute: 8 * 60,
        weather: "clear",
        night: false,
        sleepReady: false,
      },
      player: {
        name: "Crew",
        rank: 1,
        xp: 0,
        fares: 300,
        avatar: "car",
        trophies: [],
        avatars: ["car", "pigeon"],
      },
      dailies: {
        date: "",
        day: 0,
        done: {},
        gamePlays: {},
        fish: 0,
        run: false,
        wishes: 0,
      },
      unlocked: { hoods: [], carSlots: 1 },
      inventory: { snack_volt_bar: 2, wipe_basic: 1, toy_tennis: 1 },
      garage: {
        bays: 1,
        wash: 0,
        vac: 0,
        pods: 0,
        fridge: 0,
        rooms: 0,
        vault: 0,
        furniture: [],
      },
      cars: [],
      stored: [],
      adopted: 0,
      riders: {},
      album: {
        stamps: {},
        cards: {},
        playlist: {},
        wraps: ["default"],
        dashpets: [],
      },
      diary: [],
      inbox: [],
      today: null,
      req: [],
      shops: {},
      lot: null,
      quests: { karl: null, riddle: null, rally: null },
      story: {},
      show: { week: "", theme: "", entry: null, last: null },
      derby: { date: "", runs: 0, race: null },
      stocks: { prices: {}, own: {}, hour: -1 },
      auction: { date: "", lots: [] },
      arcade: { best: {}, trophies: {} },
      punch: 0,
      fish: { skill: 0 },
      counts: { birds: 0, fogDays: 0 },
      tut: 0,
      log: { lastEventDay: 0, seed, rng: seed | 0 },
    };
  }
  // fill in anything an older save is missing (new fields get their defaults; nothing is ever dropped)
  function fill(dst, def) {
    for (const k in def) {
      if (dst[k] === undefined) dst[k] = JSON.parse(JSON.stringify(def[k]));
      else if (
        def[k] &&
        typeof def[k] === "object" &&
        !Array.isArray(def[k]) &&
        dst[k] &&
        typeof dst[k] === "object"
      )
        fill(dst[k], def[k]);
    }
    return dst;
  }
  function migrate(S, now) {
    if (!S || typeof S !== "object" || !S.v) throw new Error("not a save");
    fill(S, fresh(now, S.log && S.log.seed));
    // (v1 is the only version so far; later versions upgrade here, one step at a time)
    S.v = 1;
    for (const c of S.cars.concat(S.stored)) fillCar(c);
    return S;
  }
  const CAR_DEF = {
    nick: null,
    title: null,
    stage: "rookie",
    gear: {
      roof: null,
      topper: null,
      mirrors: null,
      dash: null,
      plate: null,
      horn: null,
    },
    dashpet: null,
    training: null,
    read: [],
    heard: [],
    hoodTime: {},
    km: 0,
    rides: 0,
    bond: 0,
    low: { run: 0, hours: 0, total: 0 },
    sim: {
      at: "Russian Hill",
      from: null,
      to: null,
      t: 0,
      path: [],
      dest: null,
      task: "garage",
      wait: 0,
    },
  };
  const fillCar = (c) => {
    fill(c, CAR_DEF);
    if (c.needs) {
      if (c.needs.cleanliness === undefined) {
        c.needs.cleanliness =
          c.needs.shine ?? c.needs.cozy ?? c.needs.senses ?? 80;
      }
      if (c.needs.code === undefined) {
        c.needs.code = c.needs.clarity ?? 80;
      }
      delete c.needs.shine;
      delete c.needs.cozy;
      delete c.needs.senses;
      delete c.needs.clarity;
    }
    return c;
  };

  /* ---------- load and save ---------- */
  const St = {
    KEY,
    BAK,
    rand,
    ri,
    pick,
    wpick,
    shuffle,
    today,
    weekOf,
    daysBetween,
    fresh,
    migrate,
    fillCar,
    clone: (o) => JSON.parse(JSON.stringify(o)),
  };
  // the save, or a fresh one. A save that won't parse is kept (wc.adopt.corrupt) and the last good copy restored
  St.load = function (now, seed) {
    let raw = null;
    try {
      raw = store && store.getItem(KEY);
    } catch (e) {}
    if (raw) {
      try {
        const S = migrate(JSON.parse(raw), now);
        try {
          store.setItem(BAK, raw);
        } catch (e) {}
        return S;
      } catch (e) {
        try {
          store.setItem(BAD, raw);
        } catch (e2) {}
        try {
          const b = store.getItem(BAK);
          if (b) {
            const S = migrate(JSON.parse(b), now);
            S.recovered = true;
            return S;
          }
        } catch (e3) {}
      }
    }
    const S = fresh(now, seed);
    S.isNew = true;
    return S;
  };
  St.save = function (S, now) {
    if (!store || !S) return false;
    S.lastSeen = now || Date.now();
    const keep = { isNew: S.isNew, recovered: S.recovered };
    delete S.isNew;
    delete S.recovered;
    let ok = true;
    try {
      store.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      ok = false;
    }
    S.isNew = keep.isNew;
    S.recovered = keep.recovered;
    return ok;
  };
  St.wipe = function () {
    if (!store) return;
    for (const k of [KEY, BAK, BAD])
      try {
        store.removeItem(k);
      } catch (e) {}
  };

  /* ---------- time away: Gentle runs the fleet at a sixth of the speed for up to one in-game day, needs never dropping
     below 25 while you're gone; Paused stops the clock. The real calendar (dailies, training) moves on regardless ---------- */
  St.catchUp = function (S, now) {
    const Sim = WG.adoptSim,
      away = Math.max(0, now - (S.lastSeen || now)) / 1000;
    if (!Sim || away < 60 || S.settings.offline === "paused" || !S.cars.length)
      return null;
    const minutes = Math.min(18 * 60, Math.floor((away * (60 / 45)) / 6));
    if (minutes < 5) return null;
    const before = {
      fares: S.player.fares,
      rides: S.cars.reduce((a, c) => a + c.rides, 0),
      day: S.clock.day,
    };
    Sim.run(S, minutes, { away: true });
    return {
      minutes,
      realHours: away / 3600,
      fares: S.player.fares - before.fares,
      rides: S.cars.reduce((a, c) => a + c.rides, 0) - before.rides,
      days: S.clock.day - before.day,
    };
  };

  /* ---------- postcards: small jpegs in IndexedDB (the save only keeps their ids) ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error("no IndexedDB"));
      const r = root.indexedDB.open("wc-adopt", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("postcards");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => (dbp = null));
    return dbp;
  }
  St.putCard = (id, url) =>
    db()
      .then(
        (d) =>
          new Promise((res, rej) => {
            const t = d.transaction("postcards", "readwrite");
            t.objectStore("postcards").put(url, id);
            t.oncomplete = () => res(true);
            t.onerror = () => rej(t.error);
          }),
      )
      .catch(() => false);
  St.getCard = (id) =>
    db()
      .then(
        (d) =>
          new Promise((res) => {
            const r = d
              .transaction("postcards")
              .objectStore("postcards")
              .get(id);
            r.onsuccess = () => res(r.result || null);
            r.onerror = () => res(null);
          }),
      )
      .catch(() => null);

  WG.adoptState = St;
})();
