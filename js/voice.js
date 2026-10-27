/* Waymo Care · voices, in the manner of Slop Skies' radio. Dispatch and the riders say short
   lines (js/lines.js) with a caption. Lines queue by priority, chatter is dropped when someone is already talking,
   stale calls expire, and the music ducks under the words. A line plays voice/<id>.mp3 when voice/index.json lists
   it (tools/gen_voice.py records them). */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const A = () => WG.audio,
    LINES = WG.LINES || {};
  const $ = (s) => document.querySelector(s);

  // the lower the number, the more it matters; a class with a ttl is dropped if it waits longer than that
  const PRI = {
      timeup: 0,
      final: 0,
      miss: 1,
      start: 2,
      hurry: 2,
      result: 2,
      rider: 4,
      call: 5,
      perfect: 6,
      combo: 6,
      good: 7,
    },
    TTL = { call: 3, rider: 2.5, good: 2, perfect: 2.5, combo: 2.5 };
  const cls = (id) => (id.startsWith("rider.") ? "rider" : id.split(".")[1]);
  const V = {
    known: new Set(),
    buf: {},
    bad: {},
    q: [],
    cur: null,
    used: {},
    t: 0,
    on: true,
  };
  // the pause menu's setting: with voices off, nobody talks and no captions show
  try {
    V.on = localStorage.getItem("wc.voice") !== "0";
  } catch (e) {}

  fetch("voice/index.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j && j.lines) for (const id of j.lines) V.known.add(id);
    })
    .catch(() => {});

  // pick a variant (disp.good → disp.good.1 … .n), never the same one twice running
  function pick(id) {
    if (LINES[id]) return id;
    const all = Object.keys(LINES).filter(
      (k) => k.startsWith(id + ".") && /\.\d+$/.test(k),
    );
    if (!all.length) return null;
    const last = V.used[id],
      pool = all.length > 1 ? all.filter((k) => k !== last) : all,
      k = pool[(Math.random() * pool.length) | 0];
    V.used[id] = k;
    return k;
  }

  function say(id) {
    if (!V.on) return;
    const k = pick(id);
    if (!k) return;
    const c = cls(k),
      p = PRI[c] !== undefined ? PRI[c] : 7;
    if ((c === "good" || c === "call") && (V.cur || V.q.length)) return;
    // one of each class waiting at a time; the newest wins
    for (let i = V.q.length; i--; ) if (V.q[i].c === c) V.q.splice(i, 1);
    const i = V.q.findIndex((q) => q.p > p),
      L = LINES[k];
    V.q.splice(i < 0 ? V.q.length : i, 0, {
      id: k,
      who: L[0],
      text: L[1],
      c,
      p,
      at: V.t,
    });
    if (V.q.length > 4) V.q.pop();
    if (V.known.has(k)) load(k);
    pump();
  }
  // the most important lines cut in
  function interrupt(id) {
    stop();
    V.q.length = 0;
    say(id);
  }

  function load(id) {
    if (V.buf[id] || V.bad[id]) return V.buf[id];
    const ctx = A().ctx;
    if (!ctx) return null;
    V.buf[id] = fetch("voice/" + id + ".mp3")
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then((a) => new Promise((ok, bad) => ctx.decodeAudioData(a, ok, bad)))
      .catch(() => {
        V.bad[id] = true;
        return null;
      });
    return V.buf[id];
  }

  // the placeholder voice: a syllable per couple of letters, pitched by the letters.
  // Each character babbles at their own pitch, so even unrecorded lines tell them apart.
  const PITCH = { DISPATCH: 330, TOURIST: 210, INFLUENCER: 300, GRANDMA: 360, FOUNDER: 280, LOCAL: 150, ARTIST: 240, STUDENT: 260 };
  function babble(ctx, who, text) {
    const dest = A().voxBus,
      base = PITCH[who] || 240 + Math.random() * 160,
      words = text.replace(/[^a-zA-Z' ]/g, "").split(/\s+/).filter(Boolean);
    let t = ctx.currentTime + 0.06;
    const t0 = t;
    for (const w of words) {
      const syl = Math.max(1, Math.round(w.length / 2.6));
      for (let s = 0; s < syl; s++) {
        const ch = w.charCodeAt(Math.min(w.length - 1, s * 2)) || 97,
          f = base * (1 + ((ch % 7) - 3) * 0.045) * (s === syl - 1 && /[!?]/.test(text) ? 1.12 : 1),
          d = 0.075 + (ch % 3) * 0.012,
          o = ctx.createOscillator(),
          g = ctx.createGain(),
          bp = ctx.createBiquadFilter();
        o.type = "triangle";
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * (0.94 + (ch % 5) * 0.03), t + d);
        bp.type = "bandpass";
        bp.frequency.value = f * (2.2 + (ch % 4) * 0.5);
        bp.Q.value = 1.4;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0008, t + d);
        o.connect(bp);
        bp.connect(g);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + d + 0.02);
        t += d + 0.022;
      }
      t += 0.05;
    }
    return t - t0 + 0.1;
  }

  function show(q) {
    const el = $("#radio");
    if (!el) return;
    el.querySelector(".r-who").textContent =
      q.who === "DISPATCH" ? "Dispatch" : "Rider";
    el.querySelector(".r-txt").textContent = q.text;
    el.className = "show " + (q.who === "DISPATCH" ? "disp" : "rider");
  }
  function hide() {
    const el = $("#radio");
    if (el) el.className = "";
  }

  function stop() {
    if (V.cur && V.cur.src)
      try {
        V.cur.src.stop();
      } catch (e) {}
    V.cur = null;
    hide();
    A().voxDuck(false);
  }

  function pump() {
    if (V.cur) return;
    // drop what went stale while it waited
    while (
      V.q.length &&
      TTL[V.q[0].c] !== undefined &&
      V.t - V.q[0].at > TTL[V.q[0].c]
    )
      V.q.shift();
    const q = V.q.shift();
    if (!q) return;
    const ctx = A().init();
    V.cur = q;
    show(q);
    const read = 1.1 + q.text.length * 0.045;
    const p =
      ctx && !A().muted && V.known.has(q.id) && !V.bad[q.id]
        ? load(q.id)
        : null;
    if (!p) {
      q.end = V.t + read;
      return;
    }
    A().voxDuck(true);
    const p = V.known.has(q.id) && !V.bad[q.id] ? load(q.id) : null;
    if (p)
      Promise.resolve(p).then((b) => {
        if (V.cur !== q) return;
        if (!b) {
          q.end = V.t + Math.max(read, babble(ctx, q.who, q.text));
          return;
        }
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(A().voxBus);
        s.start();
        q.src = s;
        q.end = V.t + Math.max(read * 0.8, b.duration + 0.35);
      });
    else q.end = V.t + Math.max(read, babble(ctx, q.who, q.text));
  }

  function update(dt) {
    V.t += dt;
    if (V.cur && V.cur.end !== undefined && V.t >= V.cur.end) {
      V.cur = null;
      hide();
      A().voxDuck(false);
    }
    pump();
  }

  function setOn(on) {
    V.on = !!on;
    try {
      localStorage.setItem("wc.voice", V.on ? "1" : "0");
    } catch (e) {}
    if (!V.on) {
      stop();
      V.q.length = 0;
    }
  }

  WG.voice = {
    say,
    interrupt,
    stop,
    update,
    setOn,
    get on() {
      return V.on;
    },
    LINES,
  };
})();
