/* Waymo Care · sound. Everything is synthesised with Web Audio: no files to load.
   Music is a small step sequencer (swung eighths) driving FM e-piano, vibes, round bass, brass stabs and a brush kit,
   in the bright, jazzy "plaza" style of a 2006 console sports menu. Sound effects are one-shot voices on their own bus. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});

  let ctx = null,
    master,
    musBus,
    sfxBus,
    verb,
    verbSend,
    noiseBuf;
  let muted = false;
  try {
    muted = localStorage.getItem("wc.muted") === "1";
  } catch (e) {}

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch (e) {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);

    musBus = ctx.createGain();
    musBus.gain.value = 0.42;
    musBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;
    sfxBus.connect(master);

    // a small, bright room: generated impulse response
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6),
      ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const vg = ctx.createGain();
    vg.gain.value = 0.28;
    verb.connect(vg);
    vg.connect(master);
    verbSend = ctx.createGain();
    verbSend.gain.value = 1;
    verbSend.connect(verb);
    musBus.connect(verbSend);
    const sv = ctx.createGain();
    sv.gain.value = 0.5;
    sfxBus.connect(sv);
    sv.connect(verbSend);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /* ---------- voices ---------- */
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), Math.max(t + a + d, end));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + a + d, end) + rel);
  }
  function osc(type, f, t, stop) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(stop);
    return o;
  }
  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.start(t, Math.random() * 1.5, dur + 0.05);
    return s;
  }
  function pan(dest, p) {
    if (!p || !ctx.createStereoPanner) return dest;
    const sp = ctx.createStereoPanner();
    sp.pan.value = Math.max(-1, Math.min(1, p));
    sp.connect(dest);
    return sp;
  }

  // FM electric piano
  function ep(t, m, dur, v, dest, p) {
    const f = mtof(m),
      end = t + dur;
    const stop = Math.max(end, t + 0.904) + 0.4,
      car = osc("sine", f, t, stop),
      mod = osc("sine", f, t, stop),
      mg = ctx.createGain(),
      g = ctx.createGain();
    mg.gain.setValueAtTime(f * 1.8, t);
    mg.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.7);
    mod.connect(mg);
    mg.connect(car.frequency);
    env(g, t, 0.004, v, 0.9, 0.35, 0.35, end);
    car.connect(g);
    g.connect(pan(dest, p));
  }
  // vibraphone: two sines with tremolo
  function vibes(t, m, dur, v, dest, p) {
    const f = mtof(m),
      end = t + Math.max(dur, 0.25);
    const stop = Math.max(end, t + 1.603) + 0.65,
      a = osc("sine", f, t, stop),
      b = osc("sine", f * 4.0, t, stop),
      g = ctx.createGain(),
      gb = ctx.createGain(),
      trem = osc("sine", 5.2, t, stop),
      tg = ctx.createGain();
    tg.gain.value = v * 0.25;
    trem.connect(tg);
    tg.connect(g.gain);
    env(g, t, 0.003, v, 1.6, 0.2, 0.6, end);
    gb.gain.setValueAtTime(v * 0.35, t);
    gb.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    a.connect(g);
    b.connect(gb);
    gb.connect(g);
    g.connect(pan(dest, p));
  }
  // glockenspiel / bell
  function bell(t, m, dur, v, dest, p) {
    const f = mtof(m);
    const a = osc("sine", f, t, t + 1.6),
      b = osc("sine", f * 2.76, t, t + 0.6),
      c = osc("sine", f * 5.4, t, t + 0.3),
      g = ctx.createGain(),
      gb = ctx.createGain(),
      gc = ctx.createGain();
    env(g, t, 0.002, v, 1.2, 0.05, 0.3, t + 0.01);
    gb.gain.setValueAtTime(v * 0.5, t);
    gb.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    gc.gain.setValueAtTime(v * 0.25, t);
    gc.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    a.connect(g);
    b.connect(gb);
    c.connect(gc);
    const out = pan(dest, p);
    g.connect(out);
    gb.connect(out);
    gc.connect(out);
  }
  // round, plucky upright-ish bass
  function bass(t, m, dur, v, dest) {
    const f = mtof(m),
      end = t + dur * 0.92;
    const a = osc("triangle", f, t, end + 0.3),
      b = osc("sine", f, t, end + 0.3),
      lp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.25);
    env(g, t, 0.004, v, 0.3, 0.45, 0.08, end);
    a.connect(lp);
    b.connect(lp);
    lp.connect(g);
    g.connect(dest);
  }
  // brass stab: detuned saws into an enveloped lowpass
  function brass(t, m, dur, v, dest, p) {
    const f = mtof(m),
      end = t + dur;
    const a = osc("sawtooth", f, t, end + 0.3),
      b = osc("sawtooth", f, t, end + 0.3),
      lp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    a.detune.value = -7;
    b.detune.value = 7;
    lp.type = "lowpass";
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + 0.05);
    lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
    env(g, t, 0.02, v, 0.2, 0.6, 0.12, end);
    a.connect(lp);
    b.connect(lp);
    lp.connect(g);
    g.connect(pan(dest, p));
  }
  // soft square lead, a little like a toy whistle
  function lead(t, m, dur, v, dest, p) {
    const f = mtof(m),
      end = t + dur;
    const a = osc("square", f, t, end + 0.3),
      vib = osc("sine", 5.5, t, end + 0.3),
      vg = ctx.createGain(),
      lp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
    vib.connect(vg);
    vg.connect(a.frequency);
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    env(g, t, 0.01, v, 0.15, 0.7, 0.1, end);
    a.connect(lp);
    lp.connect(g);
    g.connect(pan(dest, p));
  }
  // drums
  function kick(t, v, dest) {
    const o = osc("sine", 140, t, t + 0.35),
      g = ctx.createGain();
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(dest);
  }
  function hat(t, v, dest, open) {
    const s = noiseSrc(t, open ? 0.25 : 0.06),
      hp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.22 : 0.045));
    s.connect(hp);
    hp.connect(g);
    g.connect(pan(dest, 0.3));
  }
  function shaker(t, v, dest) {
    const s = noiseSrc(t, 0.1),
      bp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    bp.type = "bandpass";
    bp.frequency.value = 6000;
    bp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    s.connect(bp);
    bp.connect(g);
    g.connect(pan(dest, -0.3));
  }
  function snare(t, v, dest, brush) {
    const s = noiseSrc(t, 0.25),
      bp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    bp.type = brush ? "bandpass" : "highpass";
    bp.frequency.value = brush ? 3200 : 1400;
    bp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (brush ? 0.02 : 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (brush ? 0.22 : 0.16));
    s.connect(bp);
    bp.connect(g);
    g.connect(dest);
    if (!brush) {
      const o = osc("triangle", 200, t, t + 0.12),
        og = ctx.createGain();
      o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      og.gain.setValueAtTime(v * 0.7, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og);
      og.connect(dest);
    }
  }
  function clap(t, v, dest) {
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011,
        s = noiseSrc(tt, 0.15),
        bp = ctx.createBiquadFilter(),
        g = ctx.createGain();
      bp.type = "bandpass";
      bp.frequency.value = 1500;
      bp.Q.value = 1.2;
      g.gain.setValueAtTime(v, tt);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (i === 2 ? 0.14 : 0.02));
      s.connect(bp);
      bp.connect(g);
      g.connect(dest);
    }
  }
  function rim(t, v, dest) {
    const o = osc("square", 820, t, t + 0.05),
      bp = ctx.createBiquadFilter(),
      g = ctx.createGain();
    bp.type = "bandpass";
    bp.frequency.value = 1700;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(bp);
    bp.connect(g);
    g.connect(pan(dest, 0.2));
  }

  /* ---------- songs ---------- */
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nn(s) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(s);
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  }
  // "E5:3 D5 C5:2 r:2" -> [{s, d, n}] in eighth-note steps
  function seq(str) {
    const out = [];
    let s = 0;
    for (const tok of str.trim().split(/\s+/)) {
      const [nm, dd] = tok.split(":"),
        d = dd ? +dd : 1;
      if (nm !== "r") out.push({ s, d, n: nn(nm) });
      s += d;
    }
    out.len = s;
    return out;
  }
  const QUAL = {
    "": [0, 4, 7],
    m: [0, 3, 7],
    7: [0, 4, 7, 10],
    "^7": [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    6: [0, 4, 7, 9],
    9: [0, 4, 10, 14],
    m9: [0, 3, 10, 14],
    "^9": [0, 4, 11, 14],
    sus: [0, 5, 7, 10],
  };
  function chord(name) {
    const m = /^([A-G])([#b]?)(.*)$/.exec(name),
      pc = (NOTE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12,
      iv = QUAL[m[3]] || QUAL[""];
    const notes = iv.map((i) => {
      const q = (pc + i) % 12;
      return 55 + ((q - 7 + 12) % 12);
    });
    notes.sort((a, b) => a - b);
    return { root: 40 + ((pc - 4 + 12) % 12), notes };
  }
  // "F^7 | Em7 A7 | ..." one or two chords per bar
  function prog(str) {
    return str.split("|").map((bar) => {
      const cs = bar.trim().split(/\s+/);
      return cs.map((c, i) => ({ c: chord(c), at: (i * 8) / cs.length, len: 8 / cs.length }));
    });
  }

  const SONGS = {};
  // Title / menus: a gentle bossa nova
  SONGS.title = {
    bpm: 104,
    swing: 0.1,
    chords: prog(
      "F^7 | Em7 A7 | Dm7 | G7 | C^7 | Am7 | Dm7 G7 | C6 |" +
        "F^7 | Em7 A7 | Dm7 | G7 | Em7 | A7 | Dm7 G7 | C^9",
    ),
    mel: seq(
      "E5:3 D5 C5:2 A4:2  G4:2 B4:2 D5:2 C#5:2  F5:3 E5 D5:2 A4:2  G4 B4 D5:2 F5:3 r  " +
        "E5:4 G5:2 E5:2  C5:3 E5 A5:2 G5:2  F5:2 E5:2 D5:2 B4:2  C5:6 r:2  " +
        "E5:3 D5 C5:2 A4:2  G4:2 B4:2 D5:2 C#5:2  F5:3 E5 D5:2 A4:2  G4 B4 D5:2 F5:3 r  " +
        "G5:3 F#5 E5:2 B4:2  C#5:2 E5:2 G5:2 A5:2  F5:2 A5:2 G5:2 B4:2  C5:6 r:2",
    ),
    lead: "vibes",
    leadV: 0.11,
    comp(bar, b, t, step, c, play) {
      // bossa comping: 1, 2&, 3&, 4 (and its mirror on even bars)
      const hits = bar % 2 ? [0, 3, 5] : [0, 2, 5, 7];
      if (hits.includes(b)) c.notes.forEach((n, i) => play("ep", t, n, step * 1.2, 0.035, i * 0.15 - 0.2));
    },
    bass(bar, b, t, step, c, play, cs) {
      if (b === cs.at) play("bass", t, c.root, step * 2.8, 0.22);
      else if (b === cs.at + 3 && cs.len > 4) play("bass", t, c.root + 7, step * 0.9, 0.17);
      else if (b === cs.at + 4 && cs.len > 4) play("bass", t, c.root + 7, step * 2.8, 0.19);
      else if (b === cs.at + 7 && cs.len > 4) play("bass", t, c.root, step * 0.9, 0.15);
      else if (cs.len === 4 && b === cs.at + 3) play("bass", t, c.root + 7, step * 0.9, 0.16);
    },
    drums(bar, b, t, step, d) {
      d.shaker(t, b % 2 ? 0.05 : 0.09);
      if ([0, 3, 6].includes(b) && bar % 2 === 0) d.rim(t, 0.09);
      if ([2, 5].includes(b) && bar % 2 === 1) d.rim(t, 0.09);
      if (b === 0 || b === 4) d.kick(t, 0.32);
    },
  };

  // Game: a peppy swing-pop number
  SONGS.play = {
    bpm: 148,
    swing: 0.16,
    chords: prog(
      "C | Am | F | G | C | E7 | F | G7 |" + "F | G | Em | Am | Dm7 | G7 | C | G7",
    ),
    mel: seq(
      "G4 C5 E5 G5:2 E5 C5 D5  E5:2 C5 A4:3 r:2  A4 C5 F5 A5:2 G5 F5 E5  D5:3 B4 G4:2 r:2  " +
        "G4 C5 E5 G5:2 A5 G5 E5  G#5:2 E5 G#4 B4 D5 E5:2  F5 E5 D5 C5:2 A4 C5 D5  B4:2 D5:2 G5:3 r  " +
        "A5:3 G5 F5:2 E5:2  D5:3 E5 F5:2 G5:2  E5:3 D5 B4:2 G4:2  A4:2 C5:2 E5:2 A5:2  " +
        "F5:3 E5 D5:2 C5:2  B4:2 D5:2 F5:2 G5:2  E5 G5 C6:2 G5 E5 C5:2  D5:2 r:2 G4 A4 B4 D5",
    ),
    lead: "brass",
    leadV: 0.075,
    lead2: "bell",
    comp(bar, b, t, step, c, play) {
      if (b % 2 === 1) c.notes.forEach((n, i) => play("ep", t, n + 12, step * 0.6, 0.028, i * 0.2 - 0.3));
    },
    bass(bar, b, t, step, c, play) {
      const pat = [0, null, 12, 7, 0, null, 7, 12],
        o = pat[b];
      if (o !== null) play("bass", t, c.root + o, step * (o === 0 ? 1.6 : 0.8), o === 0 ? 0.24 : 0.17);
    },
    drums(bar, b, t, step, d, intense) {
      if (b === 0 || b === 4 || (b === 7 && bar % 2)) d.kick(t, 0.42);
      if (b === 2 || b === 6) d.clap(t, 0.16);
      d.hat(t, b % 2 ? 0.05 : 0.08, b === 7 && bar % 4 === 3);
      if (intense && b % 2) d.shaker(t, 0.06);
      if (bar % 16 === 15 && b >= 4) d.snare(t, 0.1 + b * 0.02);
    },
  };

  // Results: slower, warm, with a bell lead
  SONGS.results = Object.assign({}, SONGS.title, {
    bpm: 92,
    lead: "bell",
    leadV: 0.09,
    drums(bar, b, t, step, d) {
      d.shaker(t, b % 2 ? 0.03 : 0.06);
      if (b === 0) d.kick(t, 0.25);
      if (b === 4) d.rim(t, 0.06);
    },
  });

  /* ---------- sequencer ---------- */
  const M = {
    cur: null,
    gain: null,
    nextT: 0,
    step: 0,
    timer: 0,
    tempoMul: 1,
    transpose: 0,
    intense: false,
    filter: null,
  };
  const INST = { ep, vibes, bell, bass, brass, lead };

  function schedule() {
    if (!M.cur || !ctx) return;
    const song = M.cur,
      e8 = 60 / (song.bpm * M.tempoMul) / 2,
      bars = song.chords.length,
      total = bars * 8;
    const out = M.gain,
      tr = M.transpose;
    const play = (inst, t, n, d, v, p) => INST[inst](t, n + tr, d, v, out, p);
    const drums = {
      kick: (t, v) => kick(t, v, out),
      hat: (t, v, o) => hat(t, v, out, o),
      shaker: (t, v) => shaker(t, v, out),
      snare: (t, v) => snare(t, v, out),
      clap: (t, v) => clap(t, v, out),
      rim: (t, v) => rim(t, v, out),
    };
    while (M.nextT < ctx.currentTime + 0.18) {
      const s = M.step % total,
        bar = (s / 8) | 0,
        b = s % 8,
        t = M.nextT;
      const cs = song.chords[bar].find((x) => b >= x.at && b < x.at + x.len),
        c = cs.c;
      // melody
      for (const ev of song.melIdx[s] || []) {
        play(song.lead, t, ev.n, ev.d * e8 * 0.95, song.leadV, 0.1);
        if (song.lead2 && M.step % (total * 2) >= total) play(song.lead2, t, ev.n + 12, ev.d * e8, 0.05, -0.2);
      }
      try {
        song.comp(bar, b, t, e8, c, play);
        song.bass(bar, b, t, e8, c, (i, tt, n, d, v) => play(i, tt, n, d, v), cs);
        song.drums(bar, b, t, e8, drums, M.intense);
      } catch (e) {}
      const sw = b % 2 === 0 ? 1 + song.swing : 1 - song.swing;
      M.nextT += e8 * sw;
      M.step++;
    }
  }

  function music(name, opts) {
    opts = opts || {};
    if (!init()) return;
    if (M.cur === SONGS[name] && !opts.restart) {
      if (opts.transpose !== undefined) M.transpose = opts.transpose;
      return;
    }
    // fade out what is playing
    if (M.gain) {
      const g = M.gain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.18);
      setTimeout(() => g.disconnect(), 1500);
      M.gain = null;
    }
    M.cur = null;
    clearInterval(M.timer);
    if (!name || !SONGS[name]) return;
    const song = SONGS[name];
    if (!song.melIdx) {
      song.melIdx = {};
      for (const ev of song.mel) (song.melIdx[ev.s] = song.melIdx[ev.s] || []).push(ev);
      if (song.mel.len !== song.chords.length * 8)
        console.warn("song", name, "melody length", song.mel.len, "vs", song.chords.length * 8);
    }
    M.cur = song;
    M.step = 0;
    M.tempoMul = 1;
    M.intense = false;
    M.transpose = opts.transpose || 0;
    M.gain = ctx.createGain();
    M.gain.gain.value = 0.0001;
    M.gain.gain.setTargetAtTime(1, ctx.currentTime + 0.05, 0.12);
    M.gain.connect(musBus);
    M.nextT = ctx.currentTime + 0.12;
    M.timer = setInterval(schedule, 30);
    schedule();
  }

  /* ---------- sound effects ---------- */
  const S = {};
  const now = () => ctx.currentTime + 0.005;
  function tone(f, t, dur, o) {
    o = o || {};
    const os = osc(o.type || "sine", f, t, t + dur + 0.05),
      g = ctx.createGain();
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur * (o.toAt || 0.9));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.1, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g);
    g.connect(pan(sfxBus, o.p));
    return os;
  }
  function nz(t, dur, o) {
    o = o || {};
    const s = noiseSrc(t, dur),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    f.type = o.type || "bandpass";
    f.frequency.setValueAtTime(o.f || 1800, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    f.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.v || 0.08, t + (o.a || dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(pan(sfxBus, o.p));
  }

  S.hover = () => tone(1900, now(), 0.035, { v: 0.035, type: "triangle" });
  S.select = () => {
    const t = now();
    tone(880, t, 0.08, { v: 0.09 });
    tone(1320, t + 0.06, 0.14, { v: 0.09 });
  };
  S.back = () => {
    const t = now();
    tone(990, t, 0.08, { v: 0.08 });
    tone(660, t + 0.06, 0.14, { v: 0.08 });
  };
  S.pop = () => tone(600, now(), 0.1, { to: 1400, v: 0.1 });
  S.open = () => {
    const t = now();
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.045, 0.25, { v: 0.05 }));
    nz(t, 0.3, { f: 700, to: 5000, v: 0.03 });
  };
  S.count = () => {
    const t = now();
    bell(t, 81, 0.3, 0.18, sfxBus);
  };
  S.go = () => {
    const t = now();
    bell(t, 88, 0.6, 0.2, sfxBus);
    bell(t, 93, 0.6, 0.12, sfxBus);
    S.whistle(0.5);
  };
  S.whistle = (len) => {
    len = len || 0.45;
    const t = now(),
      o = osc("sine", 2900, t, t + len + 0.05),
      lfo = osc("square", 28, t, t + len + 0.05),
      lg = ctx.createGain(),
      g = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg);
    lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.setValueAtTime(0.09, t + len - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    g.connect(sfxBus);
    nz(t, len, { f: 3000, q: 2, v: 0.02 });
  };
  S.timeup = () => {
    S.whistle(0.3);
    setTimeout(() => S.whistle(0.3), 380);
    setTimeout(() => S.whistle(0.7), 760);
  };
  S.chime = (q) => {
    // q: 0 good, 1 great, 2 perfect
    const t = now(),
      ns = q >= 2 ? [72, 76, 79, 84, 88] : q >= 1 ? [72, 76, 79, 84] : [72, 76, 79];
    ns.forEach((n, i) => bell(t + i * 0.07, n + 12, 0.4, 0.11, sfxBus, (i - 2) * 0.2));
    if (q >= 2) S.cheer(1);
    else if (q >= 1) S.cheer(0.6);
  };
  S.cheer = (amt) => {
    amt = amt || 1;
    const t = now();
    for (let i = 0; i < 7; i++) {
      const f = 500 + Math.random() * 2200,
        st = t + Math.random() * 0.15,
        d = 1.0 + Math.random() * 0.6,
        s = noiseSrc(st, d),
        bp = ctx.createBiquadFilter(),
        g = ctx.createGain(),
        am = osc("sine", 6 + Math.random() * 9, st, st + d),
        ag = ctx.createGain();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = 3;
      ag.gain.value = 0.012 * amt;
      am.connect(ag);
      ag.connect(g.gain);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.03 * amt, st + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, st + d);
      s.connect(bp);
      bp.connect(g);
      g.connect(pan(sfxBus, Math.random() * 1.6 - 0.8));
    }
  };
  S.fail = () => {
    const t = now();
    brass(t, 55, 0.18, 0.06, sfxBus);
    brass(t + 0.2, 50, 0.45, 0.06, sfxBus);
  };
  S.squeak = (amt) => {
    const t = now(),
      f = 1400 + Math.random() * 900;
    tone(f, t, 0.07, { to: f * (1.2 + Math.random() * 0.3), v: 0.02 + 0.03 * amt, type: "sine" });
  };
  S.bubble = () => {
    const t = now(),
      f = 400 + Math.random() * 600;
    tone(f, t, 0.06, { to: f * 2.4, v: 0.04 });
  };
  S.sparkle = () => {
    const t = now();
    for (let i = 0; i < 6; i++) bell(t + i * 0.05, 96 + ((i * 5) % 12), 0.2, 0.05, sfxBus, Math.sin(i) * 0.6);
  };
  S.whoosh = () => nz(now(), 0.35, { f: 400, to: 3000, q: 0.8, v: 0.08 });
  S.bonk = () => {
    const t = now();
    tone(320, t, 0.12, { to: 180, v: 0.12, type: "triangle" });
    nz(t, 0.05, { f: 900, v: 0.05 });
  };
  S.flap = () => {
    const t = now();
    for (let i = 0; i < 5; i++) nz(t + i * 0.06, 0.05, { f: 900 + i * 80, q: 0.7, v: 0.06, a: 0.01 });
  };
  S.coo = () => {
    const t = now();
    tone(420, t, 0.18, { to: 360, v: 0.05, type: "triangle" });
    tone(470, t + 0.2, 0.25, { to: 390, v: 0.045, type: "triangle" });
  };
  S.squawk = () => {
    const t = now();
    tone(900, t, 0.15, { to: 600, v: 0.05, type: "sawtooth" });
  };
  S.beep = (i) => bell(now(), 76 + [0, 2, 4, 5, 7, 9, 11, 12][i % 8], 0.2, 0.12, sfxBus);
  S.buzz = () => {
    const t = now();
    tone(140, t, 0.25, { v: 0.08, type: "square" });
    tone(147, t, 0.25, { v: 0.06, type: "square" });
  };
  S.click = () => {
    const t = now();
    nz(t, 0.03, { f: 3000, v: 0.12, a: 0.002 });
    tone(220, t, 0.08, { to: 120, v: 0.1 });
  };
  S.ding = (q) => {
    const t = now();
    const n = q >= 2 ? 88 : q >= 1 ? 84 : 76;
    bell(t, n, 0.4, 0.15, sfxBus);
    if (q >= 2) bell(t + 0.06, n + 7, 0.4, 0.1, sfxBus);
  };
  S.chargeUp = (frac) => {
    const t = now(),
      f = 300 + frac * 900;
    tone(f, t, 0.3, { to: f * 1.5, v: 0.05, type: "triangle" });
  };
  S.step = () => nz(now(), 0.05, { f: 500 + Math.random() * 200, q: 1.2, v: 0.02, a: 0.005 });
  S.carHappy = (p) => {
    const t = now();
    tone(1046, t, 0.09, { v: 0.07, p });
    tone(1568, t + 0.1, 0.16, { v: 0.07, p });
  };
  S.carSad = (p) => {
    const t = now();
    tone(700, t, 0.2, { to: 520, v: 0.06, p });
    tone(520, t + 0.22, 0.35, { to: 380, v: 0.06, p });
  };
  S.carBeep = (p) => {
    const t = now();
    tone(880, t, 0.07, { v: 0.04, p, type: "triangle" });
    tone(880, t + 0.11, 0.07, { v: 0.04, p, type: "triangle" });
  };
  S.alert = (p) => {
    const t = now();
    bell(t, 83, 0.3, 0.09, sfxBus, p);
    bell(t + 0.14, 79, 0.4, 0.09, sfxBus, p);
  };
  S.tick = () => tone(2400, now(), 0.03, { v: 0.05, type: "square" });
  S.tock = () => tone(1600, now(), 0.03, { v: 0.05, type: "square" });
  S.medal = () => {
    const t = now();
    const fan = seq("C5 E5 G5 C6:3 A5 B5:2 C6:6");
    fan.forEach((ev) => {
      brass(t + ev.s * 0.11, ev.n, ev.d * 0.11, 0.06, sfxBus);
      bell(t + ev.s * 0.11, ev.n + 12, ev.d * 0.11, 0.05, sfxBus);
    });
    setTimeout(() => S.cheer(1.2), 500);
  };
  S.combo = (n) => bell(now(), 84 + Math.min(n, 8) * 2, 0.2, 0.08, sfxBus);
  S.slam = () => {
    const t = now();
    tone(110, t, 0.22, { to: 55, v: 0.28, type: "sine" });
    nz(t, 0.12, { f: 700, q: 0.7, v: 0.16, a: 0.003 });
    nz(t + 0.02, 0.06, { f: 2600, q: 2, v: 0.05, a: 0.002 });
  };
  S.thup = () => {
    const t = now();
    tone(500 + Math.random() * 300, t, 0.09, { to: 1500, v: 0.07, type: "triangle" });
  };
  S.ollie = () => {
    const t = now();
    nz(t, 0.05, { f: 1800, q: 1.5, v: 0.12, a: 0.002 });
    tone(300, t, 0.06, { to: 160, v: 0.08, type: "triangle" });
  };
  S.land = () => {
    const t = now();
    nz(t, 0.08, { f: 900, q: 1, v: 0.12, a: 0.003 });
    tone(140, t, 0.1, { to: 90, v: 0.1 });
  };
  S.plug = () => {
    const t = now();
    tone(1200, t, 0.05, { v: 0.06, type: "square" });
    tone(1800, t + 0.06, 0.12, { v: 0.05 });
  };

  /* ---------- looping machine sounds: the vacuum and the skateboard's roll ---------- */
  const LOOPS = {};
  function loop(name, level) {
    if (!init()) return;
    let L = LOOPS[name];
    if (!L) {
      if (!level) return;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(sfxBus);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      src.connect(f);
      f.connect(g);
      src.start();
      L = LOOPS[name] = { g, f, src };
      if (name === "vacuum") {
        f.type = "bandpass";
        f.frequency.value = 1400;
        f.Q.value = 0.6;
        const o = ctx.createOscillator(),
          og = ctx.createGain(),
          lp = ctx.createBiquadFilter();
        o.type = "sawtooth";
        o.frequency.value = 118;
        lp.type = "lowpass";
        lp.frequency.value = 900;
        og.gain.value = 0.35;
        o.connect(lp);
        lp.connect(og);
        og.connect(g);
        o.start();
        L.o = o;
      } else {
        f.type = "lowpass";
        f.frequency.value = 380;
        f.Q.value = 0.8;
      }
    }
    const v = muted ? 0 : level || 0;
    L.g.gain.setTargetAtTime(name === "vacuum" ? v * 0.09 : v * 0.22, ctx.currentTime, 0.05);
    if (L.o) L.o.frequency.setTargetAtTime(110 + v * 25, ctx.currentTime, 0.1);
    if (name === "skate") L.f.frequency.setTargetAtTime(220 + v * 500, ctx.currentTime, 0.05);
  }

  function sfx(name) {
    if (!init() || muted) return;
    const f = S[name];
    if (!f) return;
    try {
      f.apply(null, Array.prototype.slice.call(arguments, 1));
    } catch (e) {}
  }

  WG.audio = {
    init,
    sfx,
    music,
    loop,
    get muted() {
      return muted;
    },
    setMuted(m) {
      muted = !!m;
      try {
        localStorage.setItem("wc.muted", muted ? "1" : "0");
      } catch (e) {}
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
    },
    setTempo(mul) {
      M.tempoMul = mul;
    },
    setIntense(on) {
      M.intense = !!on;
    },
    duck(on) {
      if (ctx) musBus.gain.setTargetAtTime(on ? 0.2 : 0.42, ctx.currentTime, 0.2);
    },
  };
})();
