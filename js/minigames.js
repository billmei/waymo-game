/* Waymo Care · the jobs. Each one is a short pointer (or keyboard) game on a 800×480 canvas inside a card:
   dirty → scrub, charge → plug in and pump the meter, cone → fling the cones, birds → shoo the pigeons, reboot → key in the code. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const A = () => WG.audio;
  const LW = 800,
    LH = 480;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rr = (a, b) => a + Math.random() * (b - a);
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const pop = (t) => {
    t = clamp(t / 0.35, 0, 1);
    return t < 0.6 ? 1.25 * ease(t / 0.6) : 1.25 - 0.25 * ease((t - 0.6) / 0.4);
  };
  const FONT = "'M PLUS Rounded 1c', 'Nunito', system-ui, sans-serif";
  function rrect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b);
    x.arcTo(a + w, b, a + w, b + h, r);
    x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r);
    x.arcTo(a, b, a + w, b, r);
    x.closePath();
  }
  function text(x, s, px, py, size, col, stroke, align) {
    x.font = "800 " + size + "px " + FONT;
    x.textAlign = align || "center";
    x.textBaseline = "middle";
    if (stroke) {
      x.lineJoin = "round";
      x.lineWidth = size * 0.22;
      x.strokeStyle = stroke;
      x.strokeText(s, px, py);
    }
    x.fillStyle = col;
    x.fillText(s, px, py);
  }

  /* ---------- the robotaxi, drawn ---------- */
  // side view facing left; origin at the ground under the car's middle
  function sidePath(x) {
    x.beginPath();
    x.moveTo(-226, -48);
    x.quadraticCurveTo(-236, -70, -228, -92);
    x.quadraticCurveTo(-222, -104, -196, -108);
    x.lineTo(-118, -118);
    x.quadraticCurveTo(-82, -150, -46, -170);
    x.quadraticCurveTo(-30, -178, 0, -178);
    x.lineTo(108, -176);
    x.quadraticCurveTo(140, -172, 172, -146);
    x.lineTo(214, -116);
    x.quadraticCurveTo(232, -104, 230, -80);
    x.lineTo(228, -52);
    x.quadraticCurveTo(226, -42, 214, -42);
    x.lineTo(-214, -42);
    x.quadraticCurveTo(-224, -42, -226, -48);
    x.closePath();
  }
  function domePath(x) {
    rrect(x, -10, -196, 64, 22, 8);
  }
  function drawSide(x, cx, cy, s, o) {
    o = o || {};
    x.save();
    x.translate(cx, cy);
    x.scale(s, s);
    // shadow
    x.fillStyle = "rgba(20,40,70,.18)";
    x.beginPath();
    x.ellipse(0, -2, 250, 16, 0, 0, 7);
    x.fill();
    // body
    const g = x.createLinearGradient(0, -180, 0, -40);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.55, "#f2f4f7");
    g.addColorStop(1, "#d9dee5");
    x.fillStyle = g;
    x.strokeStyle = "#9aa5b3";
    x.lineWidth = 3;
    sidePath(x);
    x.fill();
    x.stroke();
    // skirt
    x.fillStyle = "#3a3f47";
    x.beginPath();
    x.moveTo(-222, -46);
    x.lineTo(226, -46);
    x.lineTo(222, -62);
    x.lineTo(-224, -62);
    x.closePath();
    x.fill();
    // windows
    const gg = x.createLinearGradient(0, -170, 0, -118);
    gg.addColorStop(0, "#2a3a4f");
    gg.addColorStop(1, "#16202c");
    x.fillStyle = gg;
    x.beginPath();
    x.moveTo(-104, -120);
    x.quadraticCurveTo(-72, -150, -40, -164);
    x.lineTo(104, -164);
    x.quadraticCurveTo(130, -160, 166, -128);
    x.lineTo(166, -120);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(255,255,255,.22)";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(-60, -150);
    x.lineTo(-20, -124);
    x.moveTo(20, -160);
    x.lineTo(40, -126);
    x.stroke();
    // pillars and doors
    x.fillStyle = "#f6f7f9";
    x.fillRect(28, -166, 10, 48);
    x.strokeStyle = "#c3cad3";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-104, -116);
    x.lineTo(-100, -50);
    x.moveTo(33, -116);
    x.lineTo(33, -50);
    x.moveTo(160, -118);
    x.lineTo(156, -66);
    x.stroke();
    x.fillStyle = "#c3cad3";
    x.fillRect(-40, -100, 22, 5);
    x.fillRect(96, -100, 22, 5);
    // mirror pod and fender sensor
    x.fillStyle = "#ffffff";
    x.strokeStyle = "#9aa5b3";
    rrect(x, -112, -134, 26, 16, 6);
    x.fill();
    x.stroke();
    x.fillStyle = "#2b3038";
    x.beginPath();
    x.ellipse(-188, -112, 9, 6, 0, 0, 7);
    x.fill();
    // lights
    x.fillStyle = o.lights ? "#fff6b0" : "#fffbe8";
    rrect(x, -232, -94, 20, 10, 4);
    x.fill();
    x.fillStyle = "#e8433f";
    rrect(x, 214, -110, 18, 10, 4);
    x.fill();
    // charge port
    if (o.port !== undefined) {
      x.fillStyle = o.port > 0 ? "#2b3038" : "#e9edf2";
      x.strokeStyle = "#9aa5b3";
      rrect(x, -184, -100, 34, 26, 6);
      x.fill();
      x.stroke();
      if (o.port > 0) {
        x.fillStyle = "#36d3c4";
        x.beginPath();
        x.arc(-167, -87, 7, 0, 7);
        x.fill();
      }
    }
    // dome
    x.fillStyle = "#f8f9fb";
    x.strokeStyle = "#9aa5b3";
    x.lineWidth = 3;
    rrect(x, -14, -190, 72, 16, 6);
    x.fill();
    x.stroke();
    x.fillStyle = "#2b3038";
    domePath(x);
    rrect(x, -6, -214, 56, 26, 9);
    x.fill();
    x.fillStyle = o.ring || "#36d3c4";
    x.fillRect(-6, -196, 56, 5);
    const sp = (o.t || 0) * 3;
    x.fillStyle = "rgba(255,255,255,.35)";
    x.fillRect(-4 + ((Math.sin(sp) + 1) / 2) * 44, -212, 8, 14);
    // wheels
    for (const wx of [-140, 140]) {
      x.fillStyle = "#24272c";
      x.beginPath();
      x.arc(wx, -40, 40, 0, 7);
      x.fill();
      x.fillStyle = "#c7ccd3";
      x.beginPath();
      x.arc(wx, -40, 22, 0, 7);
      x.fill();
      x.fillStyle = "#9aa1aa";
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566 + (o.t || 0) * (o.roll || 0);
        x.beginPath();
        x.arc(wx + Math.cos(a) * 12, -40 + Math.sin(a) * 12, 4, 0, 7);
        x.fill();
      }
    }
    x.restore();
  }
  // front view, origin at the ground under the middle
  function frontBody(x) {
    x.beginPath();
    x.moveTo(-196, -40);
    x.quadraticCurveTo(-206, -110, -190, -160);
    x.quadraticCurveTo(-180, -178, -150, -182);
    x.lineTo(150, -182);
    x.quadraticCurveTo(180, -178, 190, -160);
    x.quadraticCurveTo(206, -110, 196, -40);
    x.closePath();
  }
  function drawFront(x, cx, cy, s, o) {
    o = o || {};
    x.save();
    x.translate(cx, cy);
    x.scale(s, s);
    x.fillStyle = "rgba(20,40,70,.2)";
    x.beginPath();
    x.ellipse(0, -4, 230, 18, 0, 0, 7);
    x.fill();
    // tyres
    x.fillStyle = "#24272c";
    rrect(x, -190, -70, 50, 70, 12);
    x.fill();
    rrect(x, 140, -70, 50, 70, 12);
    x.fill();
    // cabin
    x.fillStyle = "#f8f9fb";
    x.strokeStyle = "#9aa5b3";
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(-150, -180);
    x.lineTo(-120, -280);
    x.quadraticCurveTo(-112, -296, -90, -298);
    x.lineTo(90, -298);
    x.quadraticCurveTo(112, -296, 120, -280);
    x.lineTo(150, -180);
    x.closePath();
    x.fill();
    x.stroke();
    const gg = x.createLinearGradient(0, -290, 0, -186);
    gg.addColorStop(0, "#2d3e55");
    gg.addColorStop(1, "#17212d");
    x.fillStyle = gg;
    x.beginPath();
    x.moveTo(-136, -188);
    x.lineTo(-110, -276);
    x.lineTo(110, -276);
    x.lineTo(136, -188);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(255,255,255,.2)";
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(-70, -268);
    x.lineTo(-100, -196);
    x.stroke();
    // body
    const g = x.createLinearGradient(0, -182, 0, -40);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#dce1e8");
    x.fillStyle = g;
    x.strokeStyle = "#9aa5b3";
    x.lineWidth = 3;
    frontBody(x);
    x.fill();
    x.stroke();
    // hood crease, lights, sensors, grille
    x.strokeStyle = "#d3d9e1";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-90, -178);
    x.quadraticCurveTo(0, -160, 90, -178);
    x.stroke();
    x.fillStyle = o.happy ? "#fff27a" : "#fffbe8";
    x.strokeStyle = "#9aa5b3";
    for (const sx of [-1, 1]) {
      x.beginPath();
      x.moveTo(sx * 182, -140);
      x.lineTo(sx * 120, -132);
      x.lineTo(sx * 118, -118);
      x.lineTo(sx * 178, -122);
      x.closePath();
      x.fill();
      x.stroke();
    }
    x.fillStyle = "#2b3038";
    rrect(x, -80, -96, 160, 30, 12);
    x.fill();
    x.fillStyle = "#3e4550";
    rrect(x, -40, -126, 80, 14, 6);
    x.fill();
    for (const sx of [-1, 1]) {
      x.fillStyle = "#2b3038";
      x.beginPath();
      x.ellipse(sx * 188, -170, 9, 7, 0, 0, 7);
      x.fill();
      x.fillStyle = "#f8f9fb";
      x.strokeStyle = "#9aa5b3";
      rrect(x, sx * 150 - 18, -214, 36, 24, 8);
      x.fill();
      x.stroke();
    }
    x.fillStyle = "#3a3f47";
    rrect(x, -200, -58, 400, 18, 6);
    x.fill();
    // roof dome
    x.fillStyle = "#f8f9fb";
    x.strokeStyle = "#9aa5b3";
    rrect(x, -48, -312, 96, 16, 6);
    x.fill();
    x.stroke();
    x.fillStyle = "#2b3038";
    rrect(x, -38, -340, 76, 30, 10);
    x.fill();
    x.fillStyle = "#36d3c4";
    x.fillRect(-38, -320, 76, 5);
    x.restore();
  }

  function sky(x, top, bot) {
    const g = x.createLinearGradient(0, 0, 0, LH);
    g.addColorStop(0, top || "#bfe6fb");
    g.addColorStop(1, bot || "#f4fbff");
    x.fillStyle = g;
    x.fillRect(0, 0, LW, LH);
  }
  function street(x, gy) {
    // houses silhouettes and the road
    const cols = ["#f6c6d2", "#bfe2ee", "#f8e3a0", "#cfe8c4", "#e2d2f2", "#f6d2b0"];
    for (let i = 0; i < 9; i++) {
      const w = 92,
        hx = i * 96 - 20,
        hh = 150 + ((i * 37) % 60);
      x.fillStyle = cols[i % cols.length];
      x.fillRect(hx, gy - hh, w, hh);
      x.fillStyle = "#fffaf0";
      x.fillRect(hx - 3, gy - hh - 8, w + 6, 10);
      x.fillStyle = "rgba(51,80,122,.55)";
      for (let f = 0; f < 2; f++) {
        x.fillRect(hx + 14, gy - hh + 26 + f * 52, 24, 32);
        x.fillRect(hx + 54, gy - hh + 26 + f * 52, 24, 32);
      }
    }
    x.fillStyle = "#e8e2d6";
    x.fillRect(0, gy, LW, 14);
    x.fillStyle = "#6b7280";
    x.fillRect(0, gy + 14, LW, LH - gy);
    x.fillStyle = "#f3c94a";
    x.fillRect(0, LH - 26, LW, 4);
    x.fillRect(0, LH - 18, LW, 4);
  }

  /* ---------- the framework ---------- */
  const el = {};
  const MG = {
    active: null,
  };
  function ensureDom() {
    if (el.root) return;
    el.root = document.getElementById("mini");
    el.cv = document.getElementById("mini-cv");
    el.title = document.getElementById("mini-title");
    el.hint = document.getElementById("mini-hint");
    el.bar = document.getElementById("mini-bar-i");
    el.icon = document.getElementById("mini-icon");
    el.back = document.getElementById("mini-back");
    el.x = el.cv.getContext("2d");
    const pt = (e) => {
      const r = el.cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * LW) / r.width, y: ((e.clientY - r.top) * LH) / r.height, t: performance.now() / 1000 };
    };
    el.cv.addEventListener("pointerdown", (e) => {
      if (!MG.active || MG.active.done) return;
      e.preventDefault();
      try {
        el.cv.setPointerCapture(e.pointerId);
      } catch (_) {}
      const p = pt(e);
      MG.active.ptr = p;
      MG.active.pressed = true;
      MG.active.down && MG.active.down(p);
    });
    el.cv.addEventListener("pointermove", (e) => {
      if (!MG.active) return;
      const p = pt(e);
      MG.active.ptr = p;
      MG.active.hover = e.pointerType === "mouse";
      if (!MG.active.done) MG.active.move && MG.active.move(p);
    });
    const up = (e) => {
      if (!MG.active) return;
      const p = pt(e);
      MG.active.pressed = false;
      if (!MG.active.done) MG.active.up && MG.active.up(p);
    };
    el.cv.addEventListener("pointerup", up);
    el.cv.addEventListener("pointercancel", up);
    el.cv.addEventListener("pointerleave", (e) => {
      if (MG.active && e.pointerType === "mouse") MG.active.hover = false;
    });
    el.back.addEventListener("click", () => MG.cancel());
  }
  function fit() {
    const r = el.cv.getBoundingClientRect(),
      dpr = Math.min(2, window.devicePixelRatio || 1),
      w = Math.max(200, Math.round(r.width * dpr)),
      h = Math.round((w * LH) / LW);
    if (el.cv.width !== w || el.cv.height !== h) {
      el.cv.width = w;
      el.cv.height = h;
    }
    el.x.setTransform(w / LW, 0, 0, h / LH, 0, 0);
  }

  const GAMES = {};
  const DONE_WORD = { dirty: "Sparkling!", charge: "Fully charged!", cone: "Cone-free!", birds: "Shoo'd!", reboot: "Back online!" };
  const TITLE = { dirty: "Scrub-a-dub!", charge: "Power Up!", cone: "Cone Toss!", birds: "Shoo!", reboot: "Recalibrate!" };

  MG.open = function (kind, opts, onDone) {
    ensureDom();
    const g = Object.create(GAMES[kind]);
    g.kind = kind;
    g.opts = opts || {};
    g.t = 0;
    g.done = false;
    g.doneT = 0;
    g.onDone = onDone;
    g.ptr = { x: LW / 2, y: LH / 2 };
    g.fx = [];
    g.init();
    MG.active = g;
    el.title.textContent = TITLE[kind];
    el.root.dataset.kind = kind;
    el.root.hidden = false;
    el.root.classList.remove("out");
    void el.root.offsetWidth;
    el.root.classList.add("in");
    const ix = el.icon.getContext("2d");
    ix.clearRect(0, 0, 64, 64);
    WG.drawIcon(ix, kind, 32, 34, 1);
    MG.setHint(g.hint());
    fit();
  };
  MG.setHint = function (h) {
    if (el.hint && el.hint.textContent !== h) el.hint.textContent = h;
  };
  MG.close = function () {
    if (!el.root) return;
    el.root.classList.remove("in");
    el.root.classList.add("out");
    const r = el.root;
    setTimeout(() => {
      if (!MG.active) r.hidden = true;
    }, 220);
  };
  MG.cancel = function () {
    if (!MG.active || MG.active.done) return;
    const g = MG.active;
    MG.active = null;
    A().sfx("back");
    MG.close();
    g.onDone && g.onDone(null);
  };
  MG.key = function (code, e) {
    const g = MG.active;
    if (!g) return false;
    if (code === "Escape") {
      MG.cancel();
      return true;
    }
    if (!g.done && g.key) return g.key(code, e) !== false;
    return true;
  };
  MG.finish = function (g) {
    if (g.done) return;
    g.done = true;
    g.doneT = 0;
    g.time = g.t;
    const par = g.par();
    g.q = g.t <= par ? 2 : g.t <= par * 1.7 ? 1 : 0;
    A().sfx("sparkle");
  };
  MG.update = function (dt) {
    const g = MG.active;
    if (!g) return;
    fit();
    const x = el.x;
    if (!g.done) {
      g.t += dt;
      g.update(dt);
      MG.setHint(g.hint());
    } else {
      g.doneT += dt;
      g.update(dt * 0.5);
    }
    el.bar.style.transform = "scaleX(" + clamp(g.done ? 1 : g.progress(), 0, 1) + ")";
    x.save();
    if (g.shake > 0) {
      g.shake = Math.max(0, g.shake - dt);
      x.translate(Math.sin(g.t * 70) * 10 * g.shake, 0);
    }
    g.draw(x);
    x.restore();
    // floating words
    for (let i = g.fx.length - 1; i >= 0; i--) {
      const f = g.fx[i];
      f.t += dt;
      if (f.t > 0.9) {
        g.fx.splice(i, 1);
        continue;
      }
      x.save();
      x.globalAlpha = 1 - clamp((f.t - 0.6) / 0.3, 0, 1);
      const s = pop(f.t);
      x.translate(f.x, f.y - f.t * 40);
      x.scale(s, s);
      text(x, f.s, 0, 0, f.size || 34, f.col || "#ffffff", f.stroke || "#2b6fd6");
      x.restore();
    }
    if (g.done) {
      const t = g.doneT;
      x.fillStyle = "rgba(255,255,255," + clamp(t * 2, 0, 0.35) + ")";
      x.fillRect(0, 0, LW, LH);
      x.save();
      x.translate(LW / 2, LH / 2 - 20);
      const s = pop(t);
      x.scale(s, s);
      text(x, DONE_WORD[g.kind], 0, 0, 64, "#ffffff", "#1d8fd6");
      const qw = ["Good", "Great!", "Perfect!"][g.q];
      text(x, qw, 0, 64, 36, g.q === 2 ? "#ffd23a" : "#ffffff", g.q === 2 ? "#d67a00" : "#3aa04a");
      x.restore();
      // stars
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + t,
          r = 60 + t * 260;
        star(x, LW / 2 + Math.cos(a) * r, LH / 2 - 20 + Math.sin(a) * r * 0.6, 12 * (1 - clamp(t, 0, 1)) + 2, "#ffe066");
      }
      if (t > 1.15) {
        MG.active = null;
        MG.close();
        g.onDone && g.onDone({ time: g.time, q: g.q });
      }
    }
  };
  function star(x, cx, cy, r, col) {
    x.fillStyle = col;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
        rr2 = i % 2 ? r * 0.45 : r;
      x.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
    }
    x.closePath();
    x.fill();
  }
  function word(g, s, x, y, col, stroke, size) {
    g.fx.push({ s, x, y, t: 0, col, stroke, size });
  }

  /* ---------- dirty: scrub ---------- */
  GAMES.dirty = {
    init() {
      this.cx = 400;
      this.cy = 420;
      this.sc = 1.38;
      const c = document.createElement("canvas");
      c.width = LW;
      c.height = LH;
      this.dirt = c;
      const d = c.getContext("2d");
      this.bub = [];
      this.squeakD = 0;
      this.last = null;
      // splats in car space
      d.save();
      d.translate(this.cx, this.cy);
      d.scale(this.sc, this.sc);
      const blob = (x, y, r, col, n) => {
        d.fillStyle = col;
        for (let i = 0; i < n; i++) {
          d.beginPath();
          d.arc(x + rr(-r, r) * 0.8, y + rr(-r, r) * 0.6, rr(r * 0.35, r * 0.7), 0, 7);
          d.fill();
        }
      };
      // dusty lower half
      const dg = d.createLinearGradient(0, -120, 0, -40);
      dg.addColorStop(0, "rgba(150,120,80,0)");
      dg.addColorStop(1, "rgba(150,120,80,.55)");
      d.fillStyle = dg;
      d.fillRect(-240, -120, 480, 80);
      const nm = 5 + ((Math.random() * 3) | 0);
      for (let i = 0; i < nm; i++) {
        const x = rr(-200, 200),
          y = rr(-150, -60),
          r = rr(14, 26);
        blob(x, y, r, "rgba(110,78,46,.92)", 7);
        d.fillStyle = "rgba(110,78,46,.85)";
        for (let k = 0; k < 3; k++) d.fillRect(x + rr(-r, r) * 0.6, y, 4, rr(10, 26));
      }
      for (let i = 0; i < 4; i++) {
        const x = rr(-160, 180),
          y = rr(-178, -110);
        blob(x, y, 12, "rgba(246,246,238,.98)", 5);
        blob(x, y, 5, "rgba(150,150,140,.9)", 2);
        d.fillStyle = "rgba(246,246,238,.95)";
        d.fillRect(x - 2, y, 4, rr(10, 20));
      }
      // a smudge on the lidar dome
      blob(22, -202, 14, "rgba(110,78,46,.9)", 4);
      d.restore();
      // keep the grime on the car only
      const mask = document.createElement("canvas");
      mask.width = LW;
      mask.height = LH;
      const mx = mask.getContext("2d");
      mx.translate(this.cx, this.cy);
      mx.scale(this.sc, this.sc);
      mx.fillStyle = "#000";
      sidePath(mx);
      mx.fill();
      rrect(mx, -8, -216, 60, 46, 9);
      mx.fill();
      d.globalCompositeOperation = "destination-in";
      d.drawImage(mask, 0, 0);
      d.globalCompositeOperation = "source-over";
      this.lo = document.createElement("canvas");
      this.lo.width = 160;
      this.lo.height = 96;
      this.n0 = this.count() || 1;
      this.prog = 0;
      this.measT = 0;
    },
    count() {
      const l = this.loX || (this.loX = this.lo.getContext("2d", { willReadFrequently: true }));
      l.clearRect(0, 0, 160, 96);
      l.drawImage(this.dirt, 0, 0, 160, 96);
      const a = l.getImageData(0, 0, 160, 96).data;
      let n = 0;
      for (let i = 3; i < a.length; i += 4) if (a[i] > 40) n++;
      return n;
    },
    par() {
      return 7;
    },
    hint() {
      return "Scrub the grime off the car — hold and drag the sponge!";
    },
    progress() {
      return this.prog;
    },
    scrub(a, b) {
      const d = this.dirt.getContext("2d");
      d.globalCompositeOperation = "destination-out";
      d.strokeStyle = "rgba(0,0,0,.55)";
      d.lineCap = "round";
      d.lineWidth = 64;
      d.beginPath();
      d.moveTo(a.x, a.y);
      d.lineTo(b.x + 0.01, b.y);
      d.stroke();
      d.globalCompositeOperation = "source-over";
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      this.squeakD += dist;
      if (this.squeakD > 110) {
        this.squeakD = 0;
        A().sfx("squeak", clamp(dist / 40, 0.2, 1));
      }
      if (Math.random() < 0.6)
        this.bub.push({ x: b.x + rr(-30, 30), y: b.y + rr(-20, 20), r: rr(5, 14), vy: rr(-40, -10), t: 0, life: rr(0.6, 1.2) });
      if (Math.random() < 0.05) A().sfx("bubble");
    },
    down(p) {
      this.last = p;
      this.scrub(p, p);
    },
    move(p) {
      if (this.pressed && this.last) this.scrub(this.last, p);
      this.last = p;
    },
    up() {
      this.last = null;
    },
    update(dt) {
      this.measT -= dt;
      if (this.measT <= 0 && !this.done) {
        this.measT = 0.12;
        this.prog = clamp((1 - this.count() / this.n0) / 0.93, 0, 1);
        if (this.prog >= 1) {
          this.dirt.getContext("2d").clearRect(0, 0, LW, LH);
          MG.finish(this);
        }
      }
      for (let i = this.bub.length - 1; i >= 0; i--) {
        const b = this.bub[i];
        b.t += dt;
        b.y += b.vy * dt;
        if (b.t > b.life) this.bub.splice(i, 1);
      }
    },
    draw(x) {
      // the wash bay
      sky(x, "#d4effc", "#f8fdff");
      x.fillStyle = "#e3f3fb";
      for (let i = 0; i < 10; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2) x.fillRect(i * 80, j * 80, 80, 80);
      x.fillStyle = "#c9d6de";
      x.fillRect(0, 400, LW, 80);
      x.fillStyle = "#b5c4ce";
      for (let i = 0; i < 12; i++) x.fillRect(i * 70 + 10, 440, 40, 6);
      drawSide(x, this.cx, this.cy, this.sc, { t: this.t });
      x.drawImage(this.dirt, 0, 0, LW, LH);
      // shine sweep on finish
      if (this.done) {
        x.save();
        const base = x.getTransform();
        const sx = -100 + this.doneT * 1100;
        const g = x.createLinearGradient(sx - 70, 0, sx + 70, 0);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "rgba(255,255,255,.85)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        x.translate(this.cx, this.cy);
        x.scale(this.sc, this.sc);
        sidePath(x);
        x.clip();
        x.setTransform(base);
        x.fillStyle = g;
        x.fillRect(0, 0, LW, LH);
        x.restore();
      }
      for (const b of this.bub) {
        x.globalAlpha = 1 - b.t / b.life;
        x.fillStyle = "rgba(220,245,255,.6)";
        x.strokeStyle = "rgba(120,190,230,.9)";
        x.lineWidth = 2;
        x.beginPath();
        x.arc(b.x, b.y, b.r, 0, 7);
        x.fill();
        x.stroke();
        x.fillStyle = "#fff";
        x.beginPath();
        x.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, 7);
        x.fill();
      }
      x.globalAlpha = 1;
      // the sponge
      if (this.pressed || this.hover) {
        const p = this.ptr;
        x.save();
        x.translate(p.x, p.y);
        x.rotate(Math.sin(this.t * 18) * (this.pressed ? 0.15 : 0.03));
        x.fillStyle = "#ffd44a";
        x.strokeStyle = "#c99a12";
        x.lineWidth = 3;
        rrect(x, -38, -24, 76, 48, 14);
        x.fill();
        x.stroke();
        x.fillStyle = "#4fb3e8";
        rrect(x, -38, 8, 76, 16, 8);
        x.fill();
        x.fillStyle = "#e7b520";
        for (const [a, b] of [
          [-20, -8],
          [2, -12],
          [20, -4],
          [-6, 0],
        ]) {
          x.beginPath();
          x.arc(a, b, 4, 0, 7);
          x.fill();
        }
        x.restore();
      } else if (this.t < 2.5) {
        // a hand hint
        const k = (Math.sin(this.t * 4) + 1) / 2;
        x.globalAlpha = 0.85;
        text(x, "⟵ scrub ⟶", 400 + (k - 0.5) * 120, 250, 30, "#ffffff", "#1d8fd6");
        x.globalAlpha = 1;
      }
    },
  };

  /* ---------- charge: plug in, then pump the meter ---------- */
  GAMES.charge = {
    init() {
      this.cx = 470;
      this.cy = 420;
      this.sc = 1.15;
      this.phase = "plug";
      this.plug = { x: 150, y: 392 };
      this.port = { x: this.cx - 167 * this.sc, y: this.cy - 87 * this.sc };
      this.held = false;
      this.charge = 0.08;
      this.shown = 0.08;
      this.m = 0;
      this.mv = 2.6;
      this.cool = 0;
      this.flash = 0;
    },
    par() {
      return 5.5;
    },
    hint() {
      return this.phase === "plug"
        ? "Drag the charging plug to the port on the car."
        : "Tap (or press Space) when the needle is in the green!";
    },
    progress() {
      return this.phase === "plug" ? 0.15 * clamp(1 - Math.hypot(this.plug.x - this.port.x, this.plug.y - this.port.y) / 400, 0, 1) : 0.15 + 0.85 * this.charge;
    },
    down(p) {
      if (this.phase === "plug") {
        if (Math.hypot(p.x - this.plug.x, p.y - this.plug.y) < 70) {
          this.held = true;
          this.off = { x: this.plug.x - p.x, y: this.plug.y - p.y };
          A().sfx("pop");
        }
      } else this.pump();
    },
    move(p) {
      if (this.phase === "plug" && this.held) {
        this.plug.x = p.x + this.off.x;
        this.plug.y = p.y + this.off.y;
        if (Math.hypot(this.plug.x - this.port.x, this.plug.y - this.port.y) < 34) this.snap();
      }
    },
    up() {
      if (this.phase === "plug" && this.held) {
        this.held = false;
        if (Math.hypot(this.plug.x - this.port.x, this.plug.y - this.port.y) < 60) this.snap();
      }
    },
    key(code) {
      if ((code === "Space" || code === "Enter") && this.phase === "meter") {
        this.pump();
        return true;
      }
      if ((code === "Space" || code === "Enter") && this.phase === "plug") {
        // keyboard players: auto-plug
        this.snap();
        return true;
      }
      return false;
    },
    snap() {
      this.phase = "meter";
      this.held = false;
      this.plug.x = this.port.x;
      this.plug.y = this.port.y;
      A().sfx("click");
      word(this, "Click!", this.port.x, this.port.y - 50, "#ffffff", "#2f8e45", 30);
    },
    pump() {
      if (this.cool > 0) return;
      this.cool = 0.22;
      const v = Math.sin(this.m) * 0.5 + 0.5,
        d = Math.abs(v - 0.5);
      let q, add;
      if (d < 0.045) {
        q = 2;
        add = 0.4;
        word(this, "PERFECT!", 400, 150, "#ffd23a", "#d67a00", 38);
      } else if (d < 0.13) {
        q = 1;
        add = 0.26;
        word(this, "Good!", 400, 150, "#ffffff", "#3aa04a", 34);
      } else {
        q = 0;
        add = 0.08;
        word(this, "Miss", 400, 150, "#ffffff", "#9aa5b3", 30);
        this.shake = 0.25;
      }
      A().sfx("ding", q);
      this.charge = Math.min(1, this.charge + add);
      this.flash = 0.3;
      this.mv += 0.35;
      A().sfx("chargeUp", this.charge);
      if (this.charge >= 1) MG.finish(this);
    },
    update(dt) {
      this.cool = Math.max(0, this.cool - dt);
      this.flash = Math.max(0, this.flash - dt);
      if (this.phase === "meter") this.m += dt * this.mv;
      this.shown += (this.charge - this.shown) * Math.min(1, dt * 8);
      if (this.phase === "plug" && !this.held) {
        // the plug idles with a little bob
        this.plug.y = 392 + Math.sin(this.t * 3) * 3;
      }
    },
    draw(x) {
      sky(x, "#cdeefb", "#f6fcff");
      x.fillStyle = "#cfe8c4";
      x.fillRect(0, 380, LW, 100);
      x.fillStyle = "#e8e2d6";
      x.fillRect(0, 418, LW, 62);
      drawSide(x, this.cx, this.cy, this.sc, { t: this.t, port: this.phase === "meter" ? 1 : Math.hypot(this.plug.x - this.port.x, this.plug.y - this.port.y) < 120 ? 1 : 0, ring: this.charge >= 1 ? "#41c45a" : "#ff4b3e" });
      // charger
      x.fillStyle = "#f4f6f8";
      x.strokeStyle = "#9aa5b3";
      x.lineWidth = 3;
      rrect(x, 40, 250, 70, 180, 14);
      x.fill();
      x.stroke();
      x.fillStyle = "#36d3c4";
      rrect(x, 52, 266, 46, 26, 6);
      x.fill();
      text(x, Math.round(this.shown * 100) + "%", 75, 280, 15, "#0d4a44");
      // cable
      x.strokeStyle = "#2b3038";
      x.lineWidth = 9;
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(100, 330);
      const sag = Math.max(40, 160 - Math.hypot(this.plug.x - 100, this.plug.y - 330) * 0.25);
      x.bezierCurveTo(140, 330 + sag, this.plug.x - 60, this.plug.y + sag, this.plug.x, this.plug.y);
      x.stroke();
      // plug
      x.save();
      x.translate(this.plug.x, this.plug.y);
      x.fillStyle = "#3a3f47";
      rrect(x, -14, -16, 40, 32, 9);
      x.fill();
      x.fillStyle = "#36d3c4";
      x.fillRect(-14, -3, 10, 6);
      x.restore();
      if (this.phase === "plug") {
        const k = (Math.sin(this.t * 6) + 1) / 2;
        x.strokeStyle = "rgba(54,211,196," + (0.4 + k * 0.6) + ")";
        x.lineWidth = 4;
        x.beginPath();
        x.arc(this.port.x, this.port.y, 30 + k * 10, 0, 7);
        x.stroke();
        if (!this.held) {
          x.globalAlpha = 0.9;
          text(x, "drag me!", this.plug.x, this.plug.y - 42, 22, "#ffffff", "#1d8fd6");
          x.globalAlpha = 1;
        }
      } else {
        // the meter
        const mx = 150,
          my = 70,
          mw = 500,
          mh = 34;
        x.fillStyle = "rgba(255,255,255,.9)";
        rrect(x, mx - 12, my - 12, mw + 24, mh + 24, 20);
        x.fill();
        const g = x.createLinearGradient(mx, 0, mx + mw, 0);
        g.addColorStop(0, "#ff6b5a");
        g.addColorStop(0.33, "#ffd23a");
        g.addColorStop(0.5, "#41c45a");
        g.addColorStop(0.67, "#ffd23a");
        g.addColorStop(1, "#ff6b5a");
        x.fillStyle = g;
        rrect(x, mx, my, mw, mh, 14);
        x.fill();
        x.fillStyle = "rgba(255,255,255,.75)";
        x.fillRect(mx + mw * (0.5 - 0.045), my, mw * 0.09, mh);
        x.strokeStyle = "#2f8e45";
        x.lineWidth = 3;
        x.strokeRect(mx + mw * (0.5 - 0.13), my, mw * 0.26, mh);
        const v = Math.sin(this.m) * 0.5 + 0.5,
          nx = mx + v * mw;
        x.fillStyle = "#2b3038";
        x.beginPath();
        x.moveTo(nx, my + mh + 6);
        x.lineTo(nx - 12, my + mh + 24);
        x.lineTo(nx + 12, my + mh + 24);
        x.closePath();
        x.fill();
        x.fillRect(nx - 3, my - 8, 6, mh + 14);
        // battery
        const bx = 640,
          by = 190,
          bw = 120,
          bh = 60;
        x.fillStyle = "#fff";
        x.strokeStyle = "#2f8e45";
        x.lineWidth = 5;
        rrect(x, bx, by, bw, bh, 10);
        x.fill();
        x.stroke();
        x.fillStyle = "#2f8e45";
        x.fillRect(bx + bw + 2, by + 18, 9, 24);
        x.fillStyle = this.shown > 0.5 ? "#41c45a" : this.shown > 0.25 ? "#ffbf1f" : "#ff4b3e";
        rrect(x, bx + 8, by + 8, (bw - 16) * clamp(this.shown, 0.04, 1), bh - 16, 6);
        x.fill();
        if (this.flash > 0) {
          x.fillStyle = "rgba(255,255,255," + this.flash * 2 + ")";
          rrect(x, bx + 8, by + 8, bw - 16, bh - 16, 6);
          x.fill();
        }
        text(x, Math.round(this.shown * 100) + "%", bx + bw / 2, by + bh + 26, 26, "#2f8e45", "#ffffff");
      }
    },
  };

  /* ---------- cone: fling them off ---------- */
  GAMES.cone = {
    init() {
      this.cx = 400;
      this.cy = 470;
      this.sc = 1.05;
      const spots = [
        [400, 470 - 186 * 1.05, 0.05],
        [300, 470 - 180 * 1.05, -0.2],
        [500, 470 - 180 * 1.05, 0.2],
        [400, 470 - 340 * 1.05, 0],
      ];
      const n = this.opts.round >= 3 ? 3 : this.opts.round >= 2 ? 2 : 1 + (Math.random() < 0.4 ? 1 : 0);
      const order = [0, 3, 1, 2].slice(0, n);
      this.cones = order.map((k) => ({ x: spots[k][0], y: spots[k][1], hx: spots[k][0], hy: spots[k][1], r: spots[k][2], hr: spots[k][2], vx: 0, vy: 0, vr: 0, st: "on" }));
      this.held = null;
      this.vel = { x: 0, y: 0 };
      this.lastP = null;
    },
    par() {
      return 1.2 + this.cones.length * 1.2;
    },
    hint() {
      return "Grab each cone and fling it off the car!";
    },
    progress() {
      return this.cones.filter((c) => c.st === "fly" || c.st === "gone").length / this.cones.length;
    },
    down(p) {
      let best = null,
        bd = 70;
      for (const c of this.cones) {
        if (c.st !== "on" && c.st !== "back") continue;
        const d = Math.hypot(p.x - c.x, p.y - (c.y - 40));
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        this.held = best;
        best.st = "held";
        best.ox = best.x - p.x;
        best.oy = best.y - p.y;
        this.lastP = p;
        this.vel = { x: 0, y: 0 };
        A().sfx("pop");
      }
    },
    move(p) {
      const c = this.held;
      if (!c) return;
      c.x = p.x + c.ox;
      c.y = p.y + c.oy;
      if (this.lastP) {
        const dt = Math.max(0.008, p.t - this.lastP.t);
        this.vel.x = this.vel.x * 0.5 + ((p.x - this.lastP.x) / dt) * 0.5;
        this.vel.y = this.vel.y * 0.5 + ((p.y - this.lastP.y) / dt) * 0.5;
      }
      this.lastP = p;
      c.r = clamp(this.vel.x / 3000, -0.6, 0.6);
    },
    up() {
      const c = this.held;
      if (!c) return;
      this.held = null;
      const sp = Math.hypot(this.vel.x, this.vel.y),
        off = Math.abs(c.x - this.cx) > 230 || c.y < 470 - 360 * 1.05 || Math.hypot(c.x - c.hx, c.y - c.hy) > 170;
      if (sp > 700 || off) {
        c.st = "fly";
        c.vx = clamp(this.vel.x, -2200, 2200) || (c.x < this.cx ? -600 : 600);
        c.vy = Math.min(clamp(this.vel.y, -2200, 2200), -300);
        c.vr = c.vx / 120;
        A().sfx("whoosh");
        word(this, ["Yeet!", "Nice!", "Bye cone!", "Whee!"][(Math.random() * 4) | 0], c.x, c.y - 80, "#ffffff", "#ff7a1a", 30);
        if (this.cones.every((k) => k.st === "fly" || k.st === "gone")) this.allT = 0.45;
      } else {
        c.st = "back";
        A().sfx("bonk");
      }
    },
    key(code) {
      // keyboard fallback: Space flicks the next cone
      if (code === "Space" || code === "Enter") {
        const c = this.cones.find((k) => k.st === "on");
        if (c) {
          c.st = "fly";
          c.vx = (Math.random() < 0.5 ? -1 : 1) * rr(700, 1100);
          c.vy = -rr(700, 1000);
          c.vr = c.vx / 120;
          A().sfx("whoosh");
          if (this.cones.every((k) => k.st === "fly" || k.st === "gone")) this.allT = 0.45;
        }
        return true;
      }
      return false;
    },
    update(dt) {
      for (const c of this.cones) {
        if (c.st === "fly") {
          c.vy += 2000 * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
          c.r += c.vr * dt;
          if (c.y > LH + 120 || c.x < -120 || c.x > LW + 120) c.st = "gone";
        } else if (c.st === "back") {
          c.x += (c.hx - c.x) * Math.min(1, dt * 12);
          c.y += (c.hy - c.y) * Math.min(1, dt * 12);
          c.r += (c.hr - c.r) * Math.min(1, dt * 12);
          if (Math.hypot(c.x - c.hx, c.y - c.hy) < 1) c.st = "on";
        } else if (c.st === "on") c.r = c.hr + Math.sin(this.t * 3 + c.hx) * 0.03;
      }
      if (this.allT !== undefined) {
        this.allT -= dt;
        if (this.allT <= 0 && !this.done) MG.finish(this);
      }
    },
    draw(x) {
      sky(x, "#bfe6fb", "#f0f9ff");
      street(x, 330);
      drawFront(x, this.cx, this.cy, this.sc, { happy: this.done });
      for (const c of this.cones) {
        if (c.st === "gone") continue;
        x.save();
        x.translate(c.x, c.y);
        x.rotate(c.r);
        const s = c.st === "held" ? 1.12 : 1;
        x.scale(s, s);
        x.fillStyle = "#e0640f";
        rrect(x, -40, -12, 80, 14, 4);
        x.fill();
        const g = x.createLinearGradient(-26, 0, 26, 0);
        g.addColorStop(0, "#ff9a40");
        g.addColorStop(0.5, "#ff7a1a");
        g.addColorStop(1, "#e0640f");
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(-28, -10);
        x.lineTo(-8, -96);
        x.quadraticCurveTo(0, -102, 8, -96);
        x.lineTo(28, -10);
        x.closePath();
        x.fill();
        x.fillStyle = "#fff";
        x.beginPath();
        x.moveTo(-19, -46);
        x.lineTo(19, -46);
        x.lineTo(15, -64);
        x.lineTo(-15, -64);
        x.closePath();
        x.fill();
        x.restore();
      }
      if (this.t < 2.2 && !this.held) {
        const c = this.cones.find((k) => k.st === "on");
        if (c) {
          const k = (this.t * 1.4) % 1;
          x.globalAlpha = 1 - k;
          text(x, "↗ fling!", c.x + 60 + k * 60, c.y - 80 - k * 50, 28, "#ffffff", "#ff7a1a");
          x.globalAlpha = 1;
        }
      }
    },
  };

  /* ---------- birds: shoo them away ---------- */
  GAMES.birds = {
    init() {
      this.cx = 400;
      this.cy = 440;
      this.sc = 1.25;
      const spots = [
        [-150, -110],
        [-110, -116],
        [-20, -178],
        [30, -216],
        [60, -178],
        [100, -176],
        [170, -146],
        [200, -118],
        [-60, -168],
      ];
      const n = 4 + Math.min(3, this.opts.round || 1);
      const pickS = spots.slice().sort(() => Math.random() - 0.5).slice(0, n);
      this.birds = pickS.map((s, i) => this.mk(s, i === 0 && (this.opts.round || 1) >= 2 ? "gull" : "pigeon"));
      this.free = spots.filter((s) => !pickS.includes(s));
      this.extra = (this.opts.round || 1) >= 2 ? 2 : 1;
      this.extraT = 1.2;
      this.total = this.birds.length + this.extra;
      this.cooT = 1;
    },
    mk(s, kind, fromSky) {
      const x = this.cx + s[0] * this.sc,
        y = this.cy + s[1] * this.sc;
      return {
        x: fromSky ? (Math.random() < 0.5 ? -60 : LW + 60) : x,
        y: fromSky ? 40 : y,
        hx: x,
        hy: y,
        kind,
        hp: kind === "gull" ? 2 : 1,
        st: fromSky ? "land" : "sit",
        t: Math.random() * 5,
        flip: Math.random() < 0.5 ? 1 : -1,
        vx: 0,
        vy: 0,
        peck: 0,
      };
    },
    par() {
      return 1 + this.total * 0.55;
    },
    hint() {
      return "Tap the pigeons to shoo them off the sensors!";
    },
    progress() {
      return this.birds.filter((b) => b.st === "fly").length / this.total;
    },
    down(p) {
      let best = null,
        bd = 56;
      for (const b of this.birds) {
        if (b.st !== "sit" && b.st !== "land") continue;
        const d = Math.hypot(p.x - b.x, p.y - (b.y - 22));
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (!best) return;
      best.hp--;
      if (best.hp > 0) {
        best.hopT = 0.3;
        A().sfx("squawk");
        word(this, "Squawk!", best.x, best.y - 70, "#ffffff", "#8a7fd8", 26);
        return;
      }
      best.st = "fly";
      best.vx = (best.x < this.cx ? -1 : 1) * rr(200, 420);
      best.vy = -rr(380, 520);
      best.flip = best.vx < 0 ? 1 : -1;
      A().sfx("flap");
      word(this, ["Shoo!", "Bye!", "Scram!", "Off you go!"][(Math.random() * 4) | 0], best.x, best.y - 70, "#ffffff", "#8a7fd8", 28);
    },
    update(dt) {
      this.cooT -= dt;
      if (this.cooT <= 0) {
        this.cooT = rr(1.2, 2.2);
        if (this.birds.some((b) => b.st === "sit")) A().sfx("coo");
      }
      if (this.extra > 0) {
        this.extraT -= dt;
        if (this.extraT <= 0 && this.free.length) {
          this.extraT = rr(1.0, 1.8);
          this.extra--;
          const s = this.free.splice((Math.random() * this.free.length) | 0, 1)[0];
          this.birds.push(this.mk(s, "pigeon", true));
          A().sfx("flap");
        }
      }
      for (const b of this.birds) {
        b.t += dt;
        if (b.hopT > 0) b.hopT -= dt;
        if (b.st === "fly") {
          b.vy -= 200 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
        } else if (b.st === "land") {
          const k = Math.min(1, dt * 3);
          b.x += (b.hx - b.x) * k;
          b.y += (b.hy - b.y) * k;
          b.flip = b.hx < b.x ? 1 : -1;
          if (Math.hypot(b.x - b.hx, b.y - b.hy) < 3) b.st = "sit";
        } else {
          b.peck = Math.max(0, Math.sin(b.t * 2.3 + b.hx) * 1.6 - 0.6);
        }
      }
      if (!this.done && this.extra <= 0 && this.birds.every((b) => b.st === "fly")) MG.finish(this);
    },
    drawBird(x, b) {
      const s = b.kind === "gull" ? 1.35 : 1,
        flying = b.st === "fly" || b.st === "land";
      x.save();
      x.translate(b.x, b.y - (b.hopT > 0 ? Math.sin((b.hopT / 0.3) * Math.PI) * 14 : 0));
      x.scale(s * b.flip, s);
      const body = b.kind === "gull" ? "#f4f6f8" : "#9aa3b0",
        head = b.kind === "gull" ? "#ffffff" : "#6b8f99",
        wing = b.kind === "gull" ? "#b9c2cc" : "#7d8794";
      // legs
      if (!flying) {
        x.strokeStyle = "#e9a23b";
        x.lineWidth = 3;
        x.beginPath();
        x.moveTo(-4, -8);
        x.lineTo(-4, 0);
        x.moveTo(6, -8);
        x.lineTo(6, 0);
        x.stroke();
      }
      x.fillStyle = body;
      x.strokeStyle = "#5c6470";
      x.lineWidth = 2;
      x.beginPath();
      x.ellipse(2, -20, 22, 14, -0.15, 0, 7);
      x.fill();
      x.stroke();
      // tail
      x.beginPath();
      x.moveTo(20, -24);
      x.lineTo(36, -30);
      x.lineTo(34, -18);
      x.closePath();
      x.fill();
      x.stroke();
      // wing
      const flap = flying ? Math.sin(b.t * 30) : 0;
      x.fillStyle = wing;
      x.beginPath();
      if (flying) {
        x.moveTo(-2, -26);
        x.quadraticCurveTo(10, -60 * flap - 10, 26, -40 * flap - 22);
        x.lineTo(14, -22);
      } else x.ellipse(8, -20, 13, 8, -0.2, 0, 7);
      x.closePath();
      x.fill();
      x.stroke();
      // head
      x.save();
      x.translate(-18, -32 + b.peck * 10);
      x.fillStyle = head;
      x.beginPath();
      x.arc(0, 0, 10, 0, 7);
      x.fill();
      x.stroke();
      x.fillStyle = b.kind === "gull" ? "#ffcf3a" : "#e9a23b";
      x.beginPath();
      x.moveTo(-8, -2);
      x.lineTo(-17, 2);
      x.lineTo(-8, 4);
      x.closePath();
      x.fill();
      x.fillStyle = "#222";
      x.beginPath();
      x.arc(-3, -3, 2.2, 0, 7);
      x.fill();
      x.restore();
      x.restore();
    },
    draw(x) {
      sky(x, "#bfe6fb", "#f0f9ff");
      street(x, 360);
      drawSide(x, this.cx, this.cy, this.sc, { t: this.t });
      for (const b of this.birds) this.drawBird(x, b);
      if (this.t < 2 && this.birds[0] && this.birds[0].st === "sit") {
        const b = this.birds[0],
          k = (Math.sin(this.t * 7) + 1) / 2;
        x.strokeStyle = "rgba(255,255,255,.95)";
        x.lineWidth = 4;
        x.beginPath();
        x.arc(b.x, b.y - 22, 34 + k * 8, 0, 7);
        x.stroke();
        text(x, "tap!", b.x, b.y - 82, 24, "#ffffff", "#8a7fd8");
      }
    },
  };

  /* ---------- reboot: key in the recalibration code ---------- */
  const ARROWS = ["up", "right", "down", "left"];
  GAMES.reboot = {
    init() {
      const n = 4 + Math.min(3, this.opts.round || 1);
      this.code = [];
      for (let i = 0; i < n; i++) this.code.push((Math.random() * 4) | 0);
      this.i = 0;
      this.btns = ARROWS.map((a, k) => ({ k, x: 220 + k * 120, y: 400, r: 46, flash: 0 }));
      this.errs = 0;
    },
    par() {
      return 1 + this.code.length * 0.55;
    },
    hint() {
      return "Enter the recalibration code: arrow keys / WASD, or tap the buttons.";
    },
    progress() {
      return this.i / this.code.length;
    },
    press(k) {
      const b = this.btns[k];
      b.flash = 0.2;
      if (k === this.code[this.i]) {
        A().sfx("beep", this.i);
        this.i++;
        if (this.i >= this.code.length) MG.finish(this);
      } else {
        A().sfx("buzz");
        this.shake = 0.35;
        this.errs++;
        this.i = 0;
        word(this, "Oops! From the top", 400, 200, "#ffffff", "#e8508a", 30);
      }
    },
    down(p) {
      for (const b of this.btns) if (Math.hypot(p.x - b.x, p.y - b.y) < b.r + 10) this.press(b.k);
    },
    key(code) {
      const m = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
      if (code in m) {
        this.press(m[code]);
        return true;
      }
      return false;
    },
    update(dt) {
      for (const b of this.btns) b.flash = Math.max(0, b.flash - dt);
    },
    arrow(x, k, cx, cy, s, col) {
      x.save();
      x.translate(cx, cy);
      x.rotate((k * Math.PI) / 2);
      x.scale(s, s);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(0, -20);
      x.lineTo(18, 0);
      x.lineTo(7, 0);
      x.lineTo(7, 18);
      x.lineTo(-7, 18);
      x.lineTo(-7, 0);
      x.lineTo(-18, 0);
      x.closePath();
      x.fill();
      x.restore();
    },
    draw(x) {
      // the dashboard screen
      const g = x.createLinearGradient(0, 0, 0, LH);
      g.addColorStop(0, "#1d2b3c");
      g.addColorStop(1, "#0f1822");
      x.fillStyle = g;
      x.fillRect(0, 0, LW, LH);
      // lidar sweep: a top-down car in a ring of points
      const cx = 400,
        cy = 150,
        ok = this.i / this.code.length;
      x.save();
      x.translate(cx, cy);
      for (let r = 1; r <= 4; r++) {
        x.strokeStyle = "rgba(54,211,196," + (0.12 + 0.05 * r) + ")";
        x.lineWidth = 1.5;
        x.beginPath();
        x.ellipse(0, 0, r * 70, r * 26, 0, 0, 7);
        x.stroke();
      }
      const sw = this.t * (2 + ok * 4) + (this.shake > 0 ? Math.random() * 6 : 0);
      x.fillStyle = "rgba(54,211,196,.18)";
      x.beginPath();
      x.moveTo(0, 0);
      x.ellipse(0, 0, 290, 108, 0, sw, sw + 0.6);
      x.closePath();
      x.fill();
      for (let i = 0; i < 70; i++) {
        const a = i * 2.4 + Math.sin(i * 13.1) * 0.5,
          rr2 = 120 + ((i * 53) % 170),
          jitter = (1 - ok) * Math.sin(this.t * 9 + i) * 18;
        x.fillStyle = i % 5 ? "rgba(140,230,255,.7)" : "rgba(255,210,90,.8)";
        x.fillRect(Math.cos(a) * (rr2 + jitter), Math.sin(a) * (rr2 + jitter) * 0.37, 3, 3);
      }
      x.fillStyle = "#f8f9fb";
      rrect(x, -26, -46, 52, 92, 16);
      x.fill();
      x.fillStyle = "#1c2734";
      rrect(x, -20, -20, 40, 44, 10);
      x.fill();
      x.fillStyle = "#36d3c4";
      x.beginPath();
      x.arc(0, 0, 8, 0, 7);
      x.fill();
      x.restore();
      text(x, ok >= 1 ? "SENSORS OK" : "SENSORS CONFUSED", 400, 30, 20, ok >= 1 ? "#41c45a" : "#ff8fb4");
      // the code
      const n = this.code.length,
        w = 64,
        sx = 400 - ((n - 1) * (w + 12)) / 2;
      for (let i = 0; i < n; i++) {
        const bx = sx + i * (w + 12),
          by = 282,
          doneI = i < this.i,
          cur = i === this.i;
        x.fillStyle = doneI ? "#41c45a" : cur ? "#ffffff" : "rgba(255,255,255,.18)";
        rrect(x, bx - w / 2, by - w / 2, w, w, 14);
        x.fill();
        if (cur) {
          x.strokeStyle = "#36d3c4";
          x.lineWidth = 4;
          rrect(x, bx - w / 2 - 5, by - w / 2 - 5, w + 10, w + 10, 18);
          x.stroke();
        }
        this.arrow(x, this.code[i], bx, by + 2, 1.15, doneI ? "#ffffff" : cur ? "#e8508a" : "rgba(255,255,255,.75)");
      }
      // buttons
      for (const b of this.btns) {
        const s = b.flash > 0 ? 0.92 : 1;
        x.save();
        x.translate(b.x, b.y);
        x.scale(s, s);
        const bg = x.createLinearGradient(0, -b.r, 0, b.r);
        bg.addColorStop(0, "#ffffff");
        bg.addColorStop(1, "#d5dde6");
        x.fillStyle = bg;
        x.beginPath();
        x.arc(0, 0, b.r, 0, 7);
        x.fill();
        x.strokeStyle = b.flash > 0 ? "#36d3c4" : "#8fa0b3";
        x.lineWidth = 4;
        x.stroke();
        x.restore();
        this.arrow(x, b.k, b.x, b.y + 2, 1.2, "#2b3a4d");
      }
    },
  };

  WG.mini = MG;
  WG.drawSide = drawSide;
})();
