/* SLOP SKIES — leaderboard adapter.  window.LB = { submit(entry), top(opts), … }

   One API over three backends, picked once at runtime (never blocks the page; every call is a promise):
     'worker'   same-origin /api/scores — the Cloudflare Worker + D1 in worker/ (the real site)
     'artifact' the claude.ai artifact shared database: (await window.claude.use("db")).collection("isle-scores"), one doc per runId
     'local'    this browser's localStorage (try/catch; memory if storage is blocked) — the last fallback
   Order: ?lb=worker|artifact|local (or window.LB_BACKEND) forces one; else artifact if window.claude.use exists and
   resolves a db within 4 s; else worker if the page is on http(s) and GET /api/scores answers {ok:true} within 3.5 s; else local.
   A static server on localhost / 127.x / [::1] (any port but wrangler's 8787) is never probed: it has no Worker, only a 404.
   If a save to worker/artifact fails for a network or permission reason it is kept locally and the result says so (fellBack).

   LB.submit({name, aircraft, total, splits, build, runId})
     → {ok:true, backend, entry, rank, of, aircraftRank, aircraftOf, fellBack?} | {ok:false, backend, error}   (worker: rank null = slower than the fastest 1000)
   LB.top({aircraft:'all'|id, limit:10}) → {ok:true, backend, rows:[{id,name,aircraft,total,splits,ts,mine,rank}], count} | {ok:false, error}
   LB.qualify(total) → {ok, qualifies, cut, rank, count, rows, backend}   the Top 10 gate (client, CP19: "Top 10 only"): a run qualifies
     for a name entry only if it would place in the overall TOP 10 (strictly faster than the 10th time; a tie ranks behind, as on the
     server). Fewer than 10 saved times: every run qualifies. Board unreachable or slower than 3 s: {ok:false, qualifies:true} (entry allowed)
   LB.check(entry) → {ok, error?, entry?}   same rules as worker/src/index.js (keep the two in step)
   LB.keepName(s)  what a name field may hold while typing (A–Z 0–9 single spaces, ≤ 10)
   LB.ready        promise of the backend name;  LB.backend  the name once known (null before)
   LB.isMine(runId) / LB.lastName() / LB.on('change'|'backend', fn) */
(function () {
  "use strict";
  const ROUNDS = 5,
    MIN_TOTAL = 20,
    MAX_TOTAL = 1800,
    TOL = 0.5,
    SPLIT_MIN = -60;
  const NAME_RE = /^[A-Z0-9 ]{3,10}$/,
    RUN_RE = /^[A-Za-z0-9_-]{8,64}$/,
    BUILD_RE = /^[A-Za-z0-9._:+-]{1,40}$/;
  const K_ROWS = "isle-lb-v1",
    K_MINE = "isle-lb-mine",
    K_NAME = "isle-lb-name"; // the island edition's own keys (Fleet and the original keep theirs)

  /* ---------- validation (mirrors worker/src/index.js) ---------- */
  const BLOCK_SUB = [
    "FUCK",
    "SHIT",
    "CUNT",
    "NIGG",
    "NIGA",
    "FAGG",
    "KIKE",
    "CHINK",
    "RETARD",
    "TRANNY",
    "WHORE",
    "SLUT",
    "PUSSY",
    "NAZI",
    "HITLER",
    "SIEGHEIL",
    "BITCH",
    "JIZZ",
    "DYKE",
    "WETBACK",
    "RAPIST",
    "KKK",
    "PENIS",
    "VAGINA",
    "DILDO",
    "TWAT",
    "BOLLOCK",
    "SPERM",
    "MOLEST",
  ];
  const BLOCK_WORD = [
    "ASS",
    "ARSE",
    "COCK",
    "DICK",
    "FAG",
    "CUM",
    "RAPE",
    "COON",
    "GOOK",
    "SPIC",
    "PAKI",
    "TIT",
    "TITS",
    "BOOB",
    "BOOBS",
    "HOE",
    "NIG",
    "NEGRO",
    "SEX",
    "PORN",
    "HH",
    "1488",
    "HEIL",
    "WANK",
    "PEDO",
    "ANUS",
    "CLIT",
    "MERDE",
    "PUTAIN",
    "PUTA",
    "PUTO",
    "MIERDA",
    "JODER",
    "CABRON",
    "PENDEJO",
    "SCHEISSE",
    "FOTZE",
    "CAZZO",
    "STRONZO",
    "KURWA",
  ];
  const LEET = { 0: "O", 1: "I", 3: "E", 4: "A", 5: "S", 7: "T", 8: "B" };
  const deleet = (s) => s.replace(/[0134578]/g, (d) => LEET[d]);
  const cleanName = (s) =>
    String(s == null ? "" : s)
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  const keepName = (s) =>
    String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, "")
      .replace(/ {2,}/g, " ")
      .replace(/^ /, "")
      .slice(0, 10);
  function blocked(name) {
    const flat = name.replace(/ /g, ""),
      flatL = deleet(flat),
      words = name.split(" ");
    if (BLOCK_SUB.some((w) => flat.includes(w) || flatL.includes(w)))
      return true;
    return words
      .concat([flat])
      .some((w) => BLOCK_WORD.includes(w) || BLOCK_WORD.includes(deleet(w)));
  }
  const aircraftIds = () => {
    const p =
      window.DR && Array.isArray(DR.aircraft)
        ? DR.aircraft.map((x) => x.id)
        : [];
    return p.length
      ? p
      : [
          "superhornet",
          "f22",
          "f35b",
          "u2",
          "c130j",
          "p51",
          "t6",
          "t33",
          "c27",
          "su29",
        ];
  };
  function checkRun(e) {
    // everything except the name
    if (!e || typeof e !== "object") return "body";
    if (!aircraftIds().includes(e.aircraft)) return "aircraft";
    const sp = e.splits;
    if (
      !Array.isArray(sp) ||
      sp.length !== ROUNDS ||
      !sp.every(
        (s) =>
          typeof s === "number" &&
          isFinite(s) &&
          s >= SPLIT_MIN &&
          s <= MAX_TOTAL,
      )
    )
      return "splits";
    const t = e.total,
      sum = sp.reduce((a, s) => a + s, 0);
    if (
      typeof t !== "number" ||
      !isFinite(t) ||
      t < MIN_TOTAL ||
      t > MAX_TOTAL ||
      Math.abs(t - sum) > TOL
    )
      return "total";
    if (typeof e.build !== "string" || !BUILD_RE.test(e.build)) return "build";
    if (typeof e.runId !== "string" || !RUN_RE.test(e.runId)) return "runId";
    return "";
  }
  function check(e) {
    const name = cleanName(e && e.name);
    if (!NAME_RE.test(name)) return { ok: false, error: "name" };
    if (blocked(name)) return { ok: false, error: "name_blocked" };
    const bad = checkRun(e);
    if (bad) return { ok: false, error: bad };
    return {
      ok: true,
      entry: {
        name,
        aircraft: e.aircraft,
        total: Math.round(e.total * 10) / 10,
        splits: e.splits.map((s) => Math.round(s * 10) / 10),
        build: e.build,
        runId: e.runId,
        report: e.report,
      },
    };
  }

  /* ---------- storage (never throws) ---------- */
  const mem = {};
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        if (v != null) return JSON.parse(v);
      } catch (e) {}
      return k in mem ? mem[k] : d;
    },
    set(k, v) {
      mem[k] = v;
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
    del(k) {
      delete mem[k];
      try {
        localStorage.removeItem(k);
      } catch (e) {}
    },
  };
  const mine = () => new Set(store.get(K_MINE, []));
  function addMine(id, name) {
    const m = store.get(K_MINE, []).filter((x) => x !== id);
    m.push(id);
    store.set(K_MINE, m.slice(-200));
    if (name) store.set(K_NAME, name);
  }

  const cmp = (a, b) => a.total - b.total || a.ts - b.ts;
  function rankIn(rows, row) {
    const s = rows.slice().sort(cmp),
      i = s.findIndex((r) => r.id === row.id);
    return i < 0 ? null : i + 1;
  }
  function decorate(rows) {
    const m = mine();
    return rows.map((r, i) =>
      Object.assign({}, r, { rank: i + 1, mine: m.has(r.id) }),
    );
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function fetchT(url, opt, ms) {
    const ac = window.AbortController ? new AbortController() : null,
      id = setTimeout(() => ac && ac.abort(), ms);
    return fetch(
      url,
      Object.assign(
        { credentials: "same-origin", cache: "no-store" },
        opt,
        ac ? { signal: ac.signal } : {},
      ),
    ).finally(() => clearTimeout(id));
  }
  const NET = "network";

  /* ---------- backend: local ---------- */
  const local = {
    name: "local",
    async submit(e) {
      const all = store.get(K_ROWS, []);
      if (all.some((r) => r.id === e.runId))
        return { ok: false, error: "duplicate" };
      const row = {
        id: e.runId,
        name: e.name,
        aircraft: e.aircraft,
        total: e.total,
        splits: e.splits,
        build: e.build,
        ts: Date.now(),
      };
      all.push(row);
      all.sort(cmp);
      const res = {
        ok: true,
        entry: row,
        rank: rankIn(all, row),
        of: all.length,
        aircraftRank: rankIn(
          all.filter((r) => r.aircraft === row.aircraft),
          row,
        ),
        aircraftOf: all.filter((r) => r.aircraft === row.aircraft).length,
      };
      store.set(K_ROWS, all.slice(0, 500));
      return res;
    },
    async top(o) {
      const all = store
        .get(K_ROWS, [])
        .filter((r) => !o.aircraft || r.aircraft === o.aircraft)
        .sort(cmp);
      return { ok: true, rows: all.slice(0, o.limit), count: all.length };
    },
    clear() {
      store.del(K_ROWS);
    }, // for tests and screenshots only
  };

  /* ---------- backend: worker (same-origin /api/scores) ---------- */
  const fresh = {}; // the POST answer carries the new top lists; prefer them for 20 s over the edge-cached GET
  let probe = null; // the backend probe's answer (fastest entry + count) serves the first top({limit:1})
  const worker = {
    name: "worker",
    async submit(e) {
      let r, d;
      try {
        r = await fetchT(
          "/api/scores",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              Object.assign({}, e, { ticket: await runTicket }),
            ),
          },
          15000,
        );
        d = await r.json();
      } catch (err) {
        throw NET;
      }
      if (!d || typeof d !== "object") throw NET;
      if (!d.ok) {
        if (r.status >= 500 && d.error !== "moderation_unavailable") throw NET;
        return { ok: false, error: d.error || "server" };
      }
      const at = Date.now();
      fresh.all = { rows: d.top, count: d.of, at };
      fresh[e.aircraft] = { rows: d.topAircraft, count: d.aircraftOf, at };
      return {
        ok: true,
        entry: d.entry,
        rank: d.rank,
        of: d.of,
        aircraftRank: d.aircraftRank,
        aircraftOf: d.aircraftOf,
      };
    },
    async top(o) {
      const f = fresh[o.aircraft || "all"];
      if (f && Date.now() - f.at < 20000 && o.limit <= 10)
        return { ok: true, rows: f.rows.slice(0, o.limit), count: f.count };
      if (
        probe &&
        !o.aircraft &&
        o.limit === 1 &&
        Date.now() - probe.at < 20000
      ) {
        const q = probe;
        probe = null;
        return { ok: true, rows: q.rows, count: q.count };
      }
      const r = await fetchT(
          "/api/scores?aircraft=" +
            encodeURIComponent(o.aircraft || "all") +
            "&limit=" +
            o.limit,
          {},
          6000,
        ),
        d = await r.json();
      if (!d.ok) return { ok: false, error: d.error || "server" };
      return { ok: true, rows: d.scores, count: d.count };
    },
  };

  /* ---------- backend: artifact (claude.ai shared database) ---------- */
  // Rules: the db's default rules let viewers at Contributor ("interact") and above write; view-only viewers read only.
  // There is no server-side validation here: the client check above is the only gate (fine for a page shared with friends).
  function artifact(db) {
    const col = () => db.collection("isle-scores");
    const retry = async (f) => {
      try {
        return await f();
      } catch (e) {
        if (e && e.code === "unavailable") {
          await sleep(400 + Math.random() * 600);
          return f();
        }
        throw e;
      }
    };
    const scan = async () =>
      (await retry(() => col().orderBy("total", "asc").limit(1000).get())).docs
        .map((d) => d.data())
        .filter((r) => r && typeof r.total === "number")
        .sort(cmp);
    return {
      name: "artifact",
      async submit(e) {
        const ref = col().doc(e.runId);
        try {
          if ((await retry(() => ref.get())).exists)
            return { ok: false, error: "duplicate" };
          const row = {
            id: e.runId,
            name: e.name,
            aircraft: e.aircraft,
            total: e.total,
            splits: e.splits,
            build: e.build,
            ts: Date.now(),
          };
          await retry(() => ref.set(row));
          const all = await scan().catch(() => [row]);
          if (!all.some((r) => r.id === row.id)) all.push(row);
          const mineP = all.filter((r) => r.aircraft === row.aircraft);
          return {
            ok: true,
            entry: row,
            rank: rankIn(all, row),
            of: all.length,
            aircraftRank: rankIn(mineP, row),
            aircraftOf: mineP.length,
          };
        } catch (err) {
          if (err && err.code === "quota_exceeded")
            return { ok: false, error: "full" };
          throw NET; // invalid_argument (a view-only viewer), revoked, unavailable…: keep it locally instead
        }
      },
      async top(o) {
        const all = (await scan()).filter(
          (r) =>
            aircraftIds().includes(r.aircraft) &&
            (!o.aircraft || r.aircraft === o.aircraft),
        );
        return { ok: true, rows: all.slice(0, o.limit), count: all.length };
      },
    };
  }

  /* ---------- pick a backend (once) ---------- */
  const L = {},
    emit = (ev, ...a) =>
      (L[ev] || []).slice().forEach((f) => {
        try {
          f(...a);
        } catch (e) {
          console.error(e);
        }
      });
  function forced() {
    const m = /[?&]lb=(worker|artifact|local)\b/.exec(location.search);
    return m ? m[1] : window.LB_BACKEND || "";
  }
  // a static file server on this machine (python http.server, the release checks) has no Worker behind it, so the probe would only put a
  // 404 in the console on every load: skip it there. `wrangler dev` (port 8787) runs the Worker; ?lb=worker forces the probe anywhere.
  const devStatic = () =>
    /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/.test(location.hostname) &&
    location.port !== "8787";
  async function pick() {
    const f = forced();
    if (f === "local") return local;
    if (
      (!f || f === "artifact") &&
      window.claude &&
      typeof window.claude.use === "function"
    ) {
      let db = null;
      try {
        db = await Promise.race([
          Promise.resolve(window.claude.use("db")).catch(() => null),
          sleep(4000).then(() => null),
        ]);
      } catch (e) {}
      if (db && typeof db.collection === "function") return artifact(db);
    }
    if (
      (f === "worker" || (!f && !devStatic())) &&
      /^https?:$/.test(location.protocol)
    ) {
      try {
        const r = await fetchT("/api/scores?limit=1", {}, 3500);
        if (r.ok && /json/.test(r.headers.get("content-type") || "")) {
          const d = await r.json();
          if (d && d.ok) {
            probe = { rows: d.scores || [], count: d.count, at: Date.now() };
            return worker;
          }
        }
      } catch (e) {}
    }
    return local;
  }
  let B = null;
  const ready = pick()
    .catch(() => local)
    .then((b) => {
      B = b;
      LB.backend = b.name;
      emit("backend", b.name);
      return b.name;
    });

  /* ---------- public API ---------- */
  async function submit(raw) {
    const c = check(raw);
    await ready;
    if (!c.ok) return { ok: false, backend: B.name, error: c.error };
    const e = c.entry;
    let res,
      fellBack = false;
    try {
      res = await B.submit(e);
    } catch (err) {
      if (B === local) return { ok: false, backend: "local", error: "storage" };
      res = await local.submit(e);
      fellBack = true;
    }
    if (res.ok) {
      addMine(e.runId, e.name);
      emit("change", {
        backend: fellBack ? "local" : B.name,
        entry: res.entry,
      });
    } else if (res.error === "duplicate") addMine(e.runId);
    return Object.assign(
      { backend: fellBack ? "local" : B.name, fellBack },
      res,
    );
  }
  async function top(o) {
    o = o || {};
    const limit = Math.max(1, Math.min(50, +o.limit || 10)),
      aircraft = o.aircraft && o.aircraft !== "all" ? o.aircraft : "";
    await ready;
    try {
      const r = await B.top({ aircraft, limit });
      return r.ok
        ? { ok: true, backend: B.name, rows: decorate(r.rows), count: r.count }
        : Object.assign({ backend: B.name }, r);
    } catch (e) {
      return { ok: false, backend: B.name, error: NET };
    }
  }
  const TOP_N = 10,
    GATE_MS = 3000;
  async function qualify(total) {
    const t = Math.round(total * 10) / 10; // saved times are kept to 0.1 s
    const res = await Promise.race([
      top({ limit: 50 }),
      sleep(GATE_MS).then(() => ({
        ok: false,
        backend: B ? B.name : null,
        error: "slow",
      })),
    ]).catch(() => ({ ok: false, error: NET }));
    if (!res.ok)
      return {
        ok: false,
        qualifies: true,
        backend: res.backend,
        error: res.error,
      };
    const rows = res.rows,
      n = rows.filter((r) => r.total <= t).length + 1,
      cut = rows.length >= TOP_N ? rows[TOP_N - 1].total : null;
    return {
      ok: true,
      backend: res.backend,
      qualifies: cut == null || t < cut,
      cut,
      rank: rows.length >= 50 && n > 50 ? null : n,
      count: res.count,
      rows,
    };
  }
  let runTicket = Promise.resolve(null);
  if (window.DR)
    DR.on("round", (n) => {
      if (n !== 1) return;
      const details = {
        aircraft: DR.aircraftId,
        build: DR.version + "+" + DR.build,
      };
      runTicket = ready
        .then(async (backend) => {
          if (backend !== "worker") return null;
          const res = await fetchT(
            "/api/runs",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(details),
            },
            7000,
          );
          const data = await res.json();
          return data.ok ? data.ticket : null;
        })
        .catch(() => null);
    });
  const LB = (window.LB = {
    submit,
    top,
    qualify,
    TOP_N,
    check,
    checkRun,
    keepName,
    cleanName,
    ready,
    backend: null,
    isMine: (id) => mine().has(id),
    lastName: () => store.get(K_NAME, ""),
    on(ev, f) {
      (L[ev] = L[ev] || []).push(f);
    },
    off(ev, f) {
      L[ev] = (L[ev] || []).filter((x) => x !== f);
    },
    _local: local, // tests and screenshots: LB._local.clear()
  });
})();
