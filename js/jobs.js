/* Waymo Care · the jobs, played right on the 3D car with the main camera: the camera swoops in, you scrub, drag, fling,
   tap, vacuum or skate in the world, and a small job bar (title, hint, progress, Leave) sits over the scene.
   dirty → scrub the spots · charge → plug in, then pump the meter · cone → fling the cones · birds → shoo them
   reboot → key in the code · vacuum → clean the cabin (roof off) · doors → skateboard around and slam the open doors */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  const T = THREE,
    W = WG.world,
    A = () => WG.audio;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rr = (a, b) => a + Math.random() * (b - a);
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const TOUCH = matchMedia("(pointer: coarse)").matches;

  const SPH = new T.SphereGeometry(1, 12, 10),
    ICO = new T.IcosahedronGeometry(1, 0),
    BOX = new T.BoxGeometry(1, 1, 1),
    CYL = new T.CylinderGeometry(1, 1, 1, 12),
    HIT = new T.MeshBasicMaterial({ visible: false });
  const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  function mesh(geo, mat, x, y, z, sx, sy, sz, parent) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    m.castShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  /* ---------- effects that live in the world: bubbles, sparkles, things flying off ---------- */
  const FX = [];
  let starTex = null;
  function star() {
    if (!starTex) {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      x.shadowColor = "#ffe066";
      x.shadowBlur = 10;
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
          r = i % 2 ? 9 : 26;
        x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      x.closePath();
      x.fill();
      starTex = new T.CanvasTexture(c);
    }
    return starTex;
  }
  function sparkle(pos, n, spread, col) {
    for (let i = 0; i < (n || 6); i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: star(), color: col || 0xffe680, transparent: true, depthWrite: false, depthTest: false }));
      s.position.copy(pos);
      s.scale.setScalar(0.35);
      s.renderOrder = 12;
      env.scene.add(s);
      const a = Math.random() * Math.PI * 2;
      FX.push({ o: s, v: V3(Math.cos(a), rr(0.6, 1.6), Math.sin(a)).multiplyScalar(spread || 2), g: -3, life: rr(0.5, 0.9), t: 0, kind: "star" });
    }
  }
  const BUBBLE = new T.MeshPhongMaterial({ color: 0xe6f7ff, transparent: true, opacity: 0.65, shininess: 120, specular: 0xffffff, depthWrite: false });
  function bubble(pos, n) {
    const m = mesh(SPH, BUBBLE, pos.x, pos.y, pos.z, rr(0.04, 0.09));
    m.castShadow = false;
    env.scene.add(m);
    FX.push({ o: m, v: V3(rr(-0.4, 0.4), rr(0.6, 1.3), rr(-0.4, 0.4)).add(n ? n.clone().multiplyScalar(0.5) : UP), g: 0.2, life: rr(0.7, 1.2), t: 0, kind: "bubble", s0: m.scale.x });
  }
  // a thing knocked off the car: tumbles, bounces on the street, then shrinks away
  function release(o) {
    const j = J.active,
      i = j ? j.objs.indexOf(o) : -1;
    if (i >= 0) j.objs.splice(i, 1);
  }
  function launch(o, v, spin) {
    release(o);
    env.scene.attach(o);
    FX.push({ o, v, spin: spin || V3(rr(-6, 6), rr(-3, 3), rr(-6, 6)), g: -18, life: 3.2, t: 0, kind: "phys", s0: o.scale.x });
  }
  // a bird flying off
  function flyAway(b, v) {
    release(b.obj);
    env.scene.attach(b.obj);
    FX.push({ o: b.obj, v, g: 2, life: 2.6, t: 0, kind: "bird", wings: b.wings, s0: b.obj.scale.x });
  }
  function fxUpdate(dt) {
    for (let i = FX.length - 1; i >= 0; i--) {
      const f = FX[i];
      f.t += dt;
      const o = f.o;
      f.v.y += f.g * dt;
      o.position.addScaledVector(f.v, dt);
      const k = f.t / f.life;
      if (f.kind === "star") {
        o.material.opacity = 1 - k;
        o.scale.setScalar(0.35 + k * 0.3);
        o.material.rotation += dt * 4;
      } else if (f.kind === "bubble") o.scale.setScalar(f.s0 * (1 - k * 0.5));
      else if (f.kind === "phys") {
        o.rotation.x += f.spin.x * dt;
        o.rotation.y += f.spin.y * dt;
        o.rotation.z += f.spin.z * dt;
        const gy = W.groundY(o.position.x, o.position.z) + 0.05;
        if (o.position.y < gy) {
          o.position.y = gy;
          if (f.v.y < -2) A().sfx("bonk");
          f.v.y *= -0.35;
          f.v.x *= 0.65;
          f.v.z *= 0.65;
          f.spin.multiplyScalar(0.55);
        }
        if (k > 0.75) o.scale.setScalar(f.s0 * Math.max(0.01, (1 - k) * 4));
      } else if (f.kind === "bird") {
        const fl = Math.sin(f.t * 34) * 0.9;
        f.wings[0].rotation.z = fl;
        f.wings[1].rotation.z = -fl;
        if (k > 0.8) o.scale.setScalar(f.s0 * Math.max(0.01, (1 - k) * 5));
      }
      if (f.t >= f.life) {
        if (o.parent) o.parent.remove(o);
        if (o.material && o.material.map === starTex) o.material.dispose();
        FX.splice(i, 1);
      }
    }
  }

  /* ---------- floating words ---------- */
  function word(text, pos, cls) {
    const v = pos.clone().project(env.camera);
    const e = document.createElement("div");
    e.className = "jword " + (cls || "");
    e.textContent = text;
    e.style.left = ((v.x * 0.5 + 0.5) * innerWidth).toFixed(0) + "px";
    e.style.top = ((-v.y * 0.5 + 0.5) * innerHeight).toFixed(0) + "px";
    $("#job-words").appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }

  /* ---------- the framework ---------- */
  let env = null;
  const el = {};
  function dom() {
    if (el.root) return;
    el.root = $("#job");
    el.icon = $("#job-icon");
    el.title = $("#job-title");
    el.hint = $("#job-hint");
    el.bar = $("#job-bar-i");
    el.meter = $("#job-meter");
    el.needle = $("#job-needle");
    el.batt = $("#job-batt-i");
    el.battT = $("#job-batt-t");
    el.code = $("#job-code");
    el.row = $("#job-code-row");
    $("#job-leave").addEventListener("click", () => J.cancel());
    el.ollie = $("#job-ollie");
    el.ollie.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (J.active && J.active.key && !J.active.done) J.active.key("Space");
    });
    el.code.querySelectorAll("button[data-k]").forEach((b) =>
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (J.active && J.active.press && !J.active.done) J.active.press(+b.dataset.k);
      }),
    );
  }
  const TITLE = {
    dirty: "Scrub-a-dub!",
    charge: "Power Up!",
    cone: "Cone Toss!",
    birds: "Shoo!",
    reboot: "Recalibrate!",
    vacuum: "Vroom Vacuum!",
    doors: "Door Patrol!",
  };
  const DONE_WORD = {
    dirty: "Sparkling!",
    charge: "Charged!",
    cone: "Cone-free!",
    birds: "Shoo'd!",
    reboot: "Back online!",
    vacuum: "Spotless!",
    doors: "All shut!",
  };

  const J = { active: null, SPOT: V3(0.5, 0, -3.9) };
  const JOBS = {};

  J.start = function (kind, car, e, onDone) {
    env = e;
    dom();
    const j = Object.create(JOBS[kind]);
    Object.assign(j, { kind, car, t: 0, done: false, doneT: 0, onDone, round: e.round || 1, objs: [], pressed: false, ptr: null });
    car.parts.root.updateMatrixWorld(true);
    j.init();
    J.active = j;
    el.title.textContent = TITLE[kind];
    el.root.dataset.kind = kind;
    el.root.hidden = false;
    el.ollie.hidden = kind !== "doors";
    const ix = el.icon.getContext("2d");
    ix.clearRect(0, 0, 64, 64);
    WG.drawIcon(ix, kind, 32, 34, 1);
    el.hint.textContent = j.hint();
    document.body.classList.add("in-job");
  };
  // keep track of what a job adds so it can be cleared away
  function own(j, o, parent) {
    (parent || env.scene).add(o);
    j.objs.push(o);
    return o;
  }
  function end(j, res) {
    if (j.cleanup) j.cleanup(!!res);
    for (const o of j.objs) if (o.parent) o.parent.remove(o);
    J.active = null;
    el.root.hidden = true;
    el.meter.hidden = true;
    el.code.hidden = true;
    document.body.classList.remove("in-job");
    if (!res && j.car.problem) j.car.setProblem(j.car.problem);
    j.onDone && j.onDone(res);
  }
  function finish(j) {
    if (j.done) return;
    j.done = true;
    j.doneT = 0;
    j.time = j.t;
    const par = j.par();
    j.q = j.t <= par ? 2 : j.t <= par * 1.7 ? 1 : 0;
    A().sfx("sparkle");
    env.big(DONE_WORD[j.kind], "go");
    const c = j.car.parts.g.localToWorld(V3(0, 1.4, 0));
    sparkle(c, 16, 4);
  }
  J.cancel = function () {
    const j = J.active;
    if (!j || j.done) return;
    A().sfx("back");
    end(j, null);
  };
  J.update = function (dt) {
    fxUpdate(dt);
    const j = J.active;
    if (!j) return;
    if (j.ptr && j.track) j.track(env.ray(j.ptr.x, j.ptr.y));
    if (!j.done) {
      j.t += dt;
      j.update(dt);
      el.hint.textContent = j.hint();
      el.bar.style.transform = "scaleX(" + clamp(j.progress(), 0, 1) + ")";
    } else {
      j.doneT += dt;
      j.update(dt);
      el.bar.style.transform = "scaleX(1)";
      if (j.doneT > 1.1) end(j, { time: j.time, q: j.q });
    }
  };
  J.pointer = function (type, e) {
    const j = J.active;
    if (!j) return;
    j.ptr = type === "up" ? (e.pointerType === "mouse" ? { x: e.clientX, y: e.clientY } : null) : { x: e.clientX, y: e.clientY };
    if (j.done) return;
    const rc = env.ray(e.clientX, e.clientY);
    if (type === "down") {
      j.pressed = true;
      j.down && j.down(rc);
    } else if (type === "move") j.move && j.move(rc);
    else {
      j.pressed = false;
      j.up && j.up(rc);
    }
  };
  J.key = function (code) {
    const j = J.active;
    if (!j || j.done) return true;
    return j.key ? j.key(code) !== false : false;
  };
  // where the camera should be; offsets are in the car's own frame (-x is the street side, -z is the front)
  J.camera = function (pos, look) {
    const j = J.active;
    if (!j) return 0;
    const c = j.cam();
    if (c.world) {
      pos.copy(c.p);
      look.copy(c.l);
      return c.k || 3;
    }
    const g = j.car.parts.g;
    look.set(c.l[0], c.l[1], c.l[2]);
    g.localToWorld(look);
    pos.set(c.p[0], c.p[1], c.p[2]);
    g.localToWorld(pos);
    const asp = env.camera.aspect;
    if (asp < 1.25) pos.sub(look).multiplyScalar(Math.min(2.4, Math.pow(1.25 / asp, 0.85))).add(look);
    return 3;
  };
  function planeAt(worldPoint) {
    const n = env.camera.getWorldDirection(V3(0, 0, 0)).negate();
    return new T.Plane().setFromNormalAndCoplanarPoint(n, worldPoint);
  }

  /* ===================================================================================== */
  /* dirty: scrub the spots off the car                                                    */
  /* ===================================================================================== */
  const DIRT = [0x7a5636, 0xf1f1ea, 0xb59a6a];
  JOBS.dirty = {
    par() {
      return 7;
    },
    hint() {
      return TOUCH ? "Rub your finger over the dirty spots to scrub them off!" : "Hold the mouse button and scrub the dirty spots off!";
    },
    progress() {
      let s = 0;
      for (const p of this.splats) s += Math.max(0, p.dirt);
      return 1 - s / this.splats.length;
    },
    cam() {
      return { p: [-4.4, 4.0, 1.4], l: [0, 1.0, -0.1] };
    },
    init() {
      const P = this.car.parts;
      P.dirt.visible = false;
      // the dirt sits where it landed this time (actors.js lays it out afresh for every wash)
      const pr = this.car.problem,
        spots = (pr.spots || (pr.spots = WG.dirtSpots(12))).map((d) => [d.p.x, d.p.y, d.p.z, d.n.x, d.n.y, d.n.z, d.s, d.k]);
      this.splats = spots.map(([x, y, z, nx, ny, nz, s, k]) => {
        const mat = lam(DIRT[k], { transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
          g = new T.Group();
        g.position.set(x, y, z);
        g.quaternion.setFromUnitVectors(UP, V3(nx, ny, nz).normalize());
        const meshes = [mesh(SPH, mat, 0, 0, 0, s, 0.03, s * 0.8, g)];
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * 7,
            r = s * rr(0.7, 1.1);
          meshes.push(mesh(SPH, mat, Math.cos(a) * r, 0, Math.sin(a) * r, s * rr(0.22, 0.4), 0.025, s * rr(0.22, 0.4), g));
        }
        if (k === 0) meshes.push(mesh(SPH, mat, 0, 0, s * 1.2, s * 0.12, 0.025, s * 0.6, g));
        own(this, g, P.g);
        return { g, mat, dirt: 1, size: s, meshes };
      });
      P.root.updateMatrixWorld(true);
      for (const s of this.splats) s.w = s.g.getWorldPosition(V3(0, 0, 0));
      this.hits = [P.body].concat(...this.splats.map((s) => s.meshes));
      // the sponge
      const sp = new T.Group();
      mesh(WG.roundBox(0.36, 0.14, 0.24, 0.05, 2), lam(0xffd44a), 0, 0.09, 0, 1, 1, 1, sp);
      mesh(WG.roundBox(0.36, 0.06, 0.24, 0.025, 2), lam(0x4fb3e8), 0, 0.02, 0, 1, 1, 1, sp);
      sp.visible = false;
      this.sponge = own(this, sp);
      this.squeak = 0;
      this.last = null;
    },
    hitAt(rc) {
      return rc.intersectObjects(this.hits, false)[0];
    },
    track(rc) {
      const h = this.hitAt(rc);
      this.hover = h;
      if (!h) {
        this.sponge.visible = false;
        return;
      }
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
      this.sponge.visible = this.pressed || !TOUCH;
      this.sponge.position.copy(h.point).addScaledVector(n, 0.02);
      this.sponge.quaternion.setFromUnitVectors(UP, n);
      this.sponge.rotateY(Math.sin(this.t * 20) * (this.pressed ? 0.3 : 0.05));
      if (this.pressed) {
        const d = this.last ? Math.min(0.6, h.point.distanceTo(this.last)) : 0.03;
        this.scrub(h.point, n, d);
        this.last = h.point.clone();
      } else this.last = null;
    },
    scrub(p, n, d) {
      for (const s of this.splats) {
        if (s.dirt <= 0) continue;
        s.g.getWorldPosition(s.w);
        if (s.w.distanceTo(p) > 0.4 + s.size) continue;
        s.dirt -= d * 1.5 + 0.003;
        s.mat.opacity = 0.2 + 0.8 * Math.max(0, s.dirt);
        const k = 0.45 + 0.55 * Math.max(0, s.dirt);
        s.g.scale.set(k, 1, k);
        if (s.dirt <= 0) {
          s.g.visible = false;
          sparkle(s.w, 4, 1.4);
          A().sfx("bubble");
        }
      }
      this.squeak += d;
      if (this.squeak > 0.5) {
        this.squeak = 0;
        A().sfx("squeak", clamp(d * 4, 0.2, 1));
      }
      if (d > 0.01 && Math.random() < 0.7) bubble(p, n);
    },
    down(rc) {
      this.last = null;
      this.track(rc);
    },
    move(rc) {
      this.track(rc);
    },
    update() {
      if (!this.done && this.progress() >= 0.995) {
        for (const s of this.splats) s.g.visible = false;
        finish(this);
      }
      if (this.done) this.sponge.visible = false;
    },
    cleanup() {},
  };

  /* ===================================================================================== */
  /* charge: drag the plug to the port, then pump the meter                                */
  /* ===================================================================================== */
  // the port on the street-side front fender, on the car's own shell
  const PORT_HIT = WG.carSurf.side(-1, 0.98, -0.95),
    PORT = PORT_HIT.p.clone().addScaledVector(PORT_HIT.n, 0.01);
  JOBS.charge = {
    par() {
      return 5.5;
    },
    hint() {
      return this.phase === "plug"
        ? TOUCH
          ? "Drag the charging plug to the glowing port on the car."
          : "Drag the charging plug to the glowing port on the car (or press Space)."
        : TOUCH
          ? "Tap when the needle is in the green!"
          : "Click (or press Space) when the needle is in the green!";
    },
    progress() {
      return this.phase === "plug" ? 0.15 * clamp(1 - this.plug.position.distanceTo(PORT) / 3, 0, 1) : 0.15 + 0.85 * this.charge;
    },
    cam() {
      return { p: [-5.3, 4.8, 1.0], l: [-1.2, 0.5, 0.2] };
    },
    init() {
      const g = this.car.parts.g;
      this.phase = "plug";
      this.charge = 0.08;
      this.shown = 0.08;
      this.m = 0;
      this.mv = 2.6;
      this.cool = 0;
      // the port on the street-side front fender
      const port = own(this, new T.Group(), g);
      port.position.copy(PORT);
      port.quaternion.setFromUnitVectors(V3(-1, 0, 0), PORT_HIT.n);
      mesh(BOX, lam(0x2b3038), 0, 0, 0, 0.03, 0.2, 0.26, port);
      this.glow = mesh(BOX, lam(0x36d3c4, { emissive: 0x36d3c4, emissiveIntensity: 0.6 }), -0.012, 0, 0, 0.03, 0.08, 0.08, port);
      // the charging cart
      const cart = own(this, new T.Group(), g);
      cart.position.set(-2.0, 0, 2.2);
      mesh(WG.roundBox(0.6, 1.0, 0.5, 0.08, 2), lam(0xf4f6f8), 0, 0.6, 0, 1, 1, 1, cart);
      mesh(BOX, lam(0x36d3c4, { emissive: 0x1a8078 }), -0.31, 0.85, 0, 0.02, 0.22, 0.32, cart);
      mesh(BOX, lam(0x3a3f47), -0.31, 0.5, 0.12, 0.03, 0.1, 0.1, cart);
      for (const [x, z] of [
        [-0.22, -0.18],
        [0.22, -0.18],
        [-0.22, 0.18],
        [0.22, 0.18],
      ])
        mesh(SPH, lam(0x24272c), x, 0.08, z, 0.08, 0.08, 0.08, cart);
      this.outlet = V3(-2.32, 0.5, 2.32);
      // the plug
      const plug = own(this, new T.Group(), g);
      mesh(WG.roundBox(0.28, 0.15, 0.15, 0.05, 2), lam(0x3a3f47), -0.05, 0, 0, 1, 1, 1, plug);
      mesh(BOX, lam(0x36d3c4, { emissive: 0x1a8078 }), 0.1, 0, 0, 0.05, 0.08, 0.08, plug);
      this.plugHit = mesh(SPH, HIT, 0, 0, 0, 0.42, 0.42, 0.42, plug);
      this.rest = V3(-1.75, 0.8, 1.45);
      plug.position.copy(this.rest);
      this.plug = plug;
      this.cable = null;
      this.cableMat = lam(0x2b3038);
    },
    snap() {
      this.phase = "meter";
      this.held = false;
      this.plug.position.set(PORT.x - 0.16, PORT.y, PORT.z);
      A().sfx("click");
      A().sfx("plug");
      word("Click!", this.car.parts.g.localToWorld(PORT.clone()), "ok");
      el.meter.hidden = false;
    },
    down(rc) {
      if (this.phase === "meter") return this.pump();
      const h = rc.intersectObject(this.plugHit, false)[0];
      if (!h) return;
      this.held = true;
      // drag in the camera-facing plane through the port, so the plug meets the port where the pointer does
      this.plane = planeAt(this.car.parts.g.localToWorld(PORT.clone()));
      A().sfx("pop");
    },
    move(rc) {
      if (!this.held) return;
      const p = rc.ray.intersectPlane(this.plane, V3(0, 0, 0));
      if (!p) return;
      this.car.parts.g.worldToLocal(p);
      p.y = Math.max(0.12, p.y);
      this.plug.position.copy(p);
      if (p.distanceTo(PORT) < 0.4 || this.nearPort() < 28) this.snap();
    },
    up() {
      if (!this.held) return;
      this.held = false;
      if (this.plug.position.distanceTo(PORT) < 0.8 || this.nearPort() < 60) this.snap();
    },
    // how far apart the plug and the port look on screen, in pixels
    nearPort() {
      const g = this.car.parts.g,
        a = g.localToWorld(this.plug.position.clone()).project(env.camera),
        b = g.localToWorld(PORT.clone()).project(env.camera);
      return Math.hypot((a.x - b.x) * innerWidth, (a.y - b.y) * innerHeight) / 2;
    },
    key(code) {
      if (code !== "Space" && code !== "Enter") return false;
      if (this.phase === "plug") this.snap();
      else this.pump();
      return true;
    },
    pump() {
      if (this.cool > 0) return;
      this.cool = 0.22;
      const v = Math.sin(this.m) * 0.5 + 0.5,
        d = Math.abs(v - 0.5),
        at = this.car.parts.g.localToWorld(V3(PORT.x - 0.2, PORT.y + 0.5, PORT.z));
      let q, add;
      if (d < 0.045) {
        q = 2;
        add = 0.4;
        word("PERFECT!", at, "gold");
      } else if (d < 0.13) {
        q = 1;
        add = 0.26;
        word("Good!", at, "ok");
      } else {
        q = 0;
        add = 0.08;
        word("Miss", at, "meh");
      }
      A().sfx("ding", q);
      this.charge = Math.min(1, this.charge + add);
      this.mv += 0.35;
      A().sfx("chargeUp", this.charge);
      sparkle(this.car.parts.g.localToWorld(PORT.clone()), q ? 6 : 2, 1.5, 0xaaf7ef);
      el.meter.classList.remove("hit");
      void el.meter.offsetWidth;
      el.meter.classList.add("hit");
      if (this.charge >= 1) finish(this);
    },
    update(dt) {
      this.cool = Math.max(0, this.cool - dt);
      if (this.phase === "meter" && !this.done) this.m += dt * this.mv;
      this.shown += (this.charge - this.shown) * Math.min(1, dt * 8);
      if (this.phase === "plug" && !this.held) {
        this.plug.position.lerp(this.rest, Math.min(1, dt * 8));
        this.plug.position.y = this.rest.y + Math.sin(this.t * 3) * 0.04;
      }
      this.glow.material.emissiveIntensity = this.phase === "plug" ? 0.4 + 0.6 * Math.abs(Math.sin(this.t * 5)) : 1;
      // the cable: a sagging tube from the cart to the back of the plug
      const a = this.outlet,
        b = this.plug.position.clone().add(V3(-0.2, 0, 0)),
        mid = a.clone().lerp(b, 0.5);
      mid.y = Math.max(0.06, mid.y - Math.max(0.15, 0.7 - a.distanceTo(b) * 0.15));
      const geo = new T.TubeGeometry(new T.CatmullRomCurve3([a, a.clone().lerp(mid, 0.6).setY(Math.max(0.06, (a.y + mid.y) / 2 - 0.1)), mid, b]), 24, 0.035, 6);
      if (this.cable) {
        this.cable.geometry.dispose();
        this.cable.geometry = geo;
      } else {
        this.cable = own(this, new T.Mesh(geo, this.cableMat), this.car.parts.g);
        this.cable.castShadow = true;
      }
      // the meter and the battery
      const v = Math.sin(this.m) * 0.5 + 0.5;
      el.needle.style.left = (v * 100).toFixed(2) + "%";
      el.batt.style.transform = "scaleX(" + clamp(this.shown, 0.04, 1) + ")";
      el.batt.style.background = this.shown > 0.5 ? "#41c45a" : this.shown > 0.25 ? "#ffbf1f" : "#ff4b3e";
      el.battT.textContent = Math.round(this.shown * 100) + "%";
      this.car.parts.ring.material.color.setHSL(this.shown * 0.36, 0.75, 0.5);
    },
    cleanup() {
      if (this.cable) this.cable.geometry.dispose();
    },
  };

  /* ===================================================================================== */
  /* cone: grab the cones and fling them off                                               */
  /* ===================================================================================== */
  JOBS.cone = {
    par() {
      return 1.2 + this.cones.length * 1.2;
    },
    hint() {
      return TOUCH ? "Grab each cone and flick it off the car!" : "Grab each cone and fling it off the car! (Space flicks one)";
    },
    progress() {
      return this.cones.filter((c) => c.st === "gone").length / this.cones.length;
    },
    cam() {
      return { p: [-4.8, 4.6, 1.3], l: [0, 1.55, -0.4] };
    },
    init() {
      const g = this.car.parts.g;
      this.car.parts.cone.visible = false;
      const D = WG.CAR_DOME,
        S = WG.carSurf,
        on = (x, z, r) => {
          const h = S.top(x, z);
          return [h.p.x, h.p.y, h.p.z, r, Math.atan2(h.n.z, h.n.y) * 0.7];
        },
        spots = [on(0, -0.62, 0.12), [D.x, D.top, D.z, 0, 0], on(0.25, 0.85, -0.1)];
      const n = this.round >= 3 ? 3 : this.round >= 2 ? 2 : Math.random() < 0.4 ? 2 : 1;
      this.cones = spots.slice(0, n).map(([x, y, z, r, rx]) => {
        const o = WG.makeCone();
        o.scale.setScalar(1.05);
        o.position.set(x, y, z);
        o.rotation.x = rx;
        o.rotation.z = r;
        own(this, o, g);
        const c = { o, home: V3(x, y, z), r, st: "on", samples: [] };
        o.traverse((m) => m.isMesh && (m.userData.cone = c));
        mesh(SPH, HIT, 0, 0.45, 0, 0.45, 0.6, 0.45, o).userData.cone = c;
        return c;
      });
      this.hits = [];
      for (const c of this.cones) c.o.traverse((m) => m.isMesh && this.hits.push(m));
    },
    down(rc) {
      const h = rc.intersectObjects(this.hits, false).find((x) => x.object.userData.cone && x.object.userData.cone.st !== "gone");
      if (!h) return;
      const c = h.object.userData.cone;
      c.st = "held";
      const w = c.o.getWorldPosition(V3(0, 0, 0));
      this.plane = planeAt(w);
      c.off = w.sub(h.point);
      c.samples = [];
      this.held = c;
      A().sfx("pop");
    },
    move(rc) {
      const c = this.held;
      if (!c) return;
      const p = rc.ray.intersectPlane(this.plane, V3(0, 0, 0));
      if (!p) return;
      p.add(c.off);
      c.samples.push([performance.now() / 1000, p.clone()]);
      if (c.samples.length > 6) c.samples.shift();
      this.car.parts.g.worldToLocal(p);
      c.o.position.copy(p);
      c.o.rotation.z = clamp((p.x - c.home.x) * 0.4, -0.7, 0.7);
    },
    up() {
      const c = this.held;
      if (!c) return;
      this.held = null;
      const s = c.samples,
        tNow = performance.now() / 1000;
      let v = V3(0, 0, 0);
      if (s.length >= 2) {
        const a = s.find((q) => tNow - q[0] < 0.15) || s[0],
          b = s[s.length - 1],
          dt = Math.max(0.016, b[0] - a[0]);
        v = b[1].clone().sub(a[1]).divideScalar(dt);
      }
      const off = c.o.position.distanceTo(c.home) > 1.1;
      if (off || v.length() > 5) this.fling(c, v);
      else {
        c.st = "back";
        A().sfx("bonk");
      }
    },
    fling(c, v) {
      if (v.length() < 3) {
        // a gentle toss: carry on outward from the car
        const out = c.o.getWorldPosition(V3(0, 0, 0)).sub(this.car.parts.g.localToWorld(V3(0, 1.2, 0)));
        out.y = 0;
        v = out.normalize().multiplyScalar(4);
      }
      if (v.length() > 16) v.setLength(16);
      v.y = Math.max(v.y, 3.5);
      c.st = "gone";
      launch(c.o, v);
      A().sfx("whoosh");
      word(["Yeet!", "Nice!", "Bye cone!", "Whee!"][(Math.random() * 4) | 0], c.o.getWorldPosition(V3(0, 0, 0)), "orange");
      if (this.cones.every((k) => k.st === "gone")) this.allT = 0.4;
    },
    key(code) {
      if (code !== "Space" && code !== "Enter") return false;
      const c = this.cones.find((k) => k.st === "on");
      if (c) {
        const side = this.car.parts.g.localToWorld(V3(-1, 0, 0)).sub(this.car.parts.g.localToWorld(V3(0, 0, 0)));
        this.fling(c, side.multiplyScalar(rr(4, 7)).add(V3(0, rr(4, 6), 0)));
      }
      return true;
    },
    update(dt) {
      for (const c of this.cones) {
        if (c.st === "back") {
          c.o.position.lerp(c.home, Math.min(1, dt * 12));
          c.o.rotation.z += (c.r - c.o.rotation.z) * Math.min(1, dt * 12);
          if (c.o.position.distanceTo(c.home) < 0.01) c.st = "on";
        } else if (c.st === "on") c.o.rotation.z = c.r + Math.sin(this.t * 3 + c.home.z) * 0.04;
      }
      if (this.allT !== undefined && !this.done) {
        this.allT -= dt;
        if (this.allT <= 0) finish(this);
      }
    },
  };

  /* ===================================================================================== */
  /* birds: shoo the pigeons (and the gulls, which take two taps)                          */
  /* ===================================================================================== */
  function makeBird(gull) {
    const g = new T.Group(),
      body = lam(gull ? 0xf4f6f8 : 0x9aa3b0),
      head = lam(gull ? 0xffffff : 0x6b8f99),
      wing = lam(gull ? 0xb9c2cc : 0x7d8794),
      beak = lam(gull ? 0xffcf3a : 0xe9a23b),
      eye = lam(0x222222);
    mesh(SPH, body, 0, 0.14, 0, 0.16, 0.13, 0.24, g);
    const h = new T.Group();
    h.position.set(0, 0.27, -0.16);
    g.add(h);
    mesh(SPH, head, 0, 0, 0, 0.09, 0.09, 0.09, h);
    mesh(SPH, beak, 0, -0.01, -0.1, 0.03, 0.025, 0.05, h);
    for (const s of [-1, 1]) mesh(SPH, eye, s * 0.06, 0.02, -0.06, 0.015, 0.015, 0.015, h);
    mesh(BOX, wing, 0, 0.17, 0.22, 0.12, 0.03, 0.16, g);
    const wings = [-1, 1].map((s) => {
      const p = new T.Group();
      p.position.set(s * 0.1, 0.2, 0.02);
      g.add(p);
      mesh(BOX, wing, s * 0.15, 0, 0, 0.3, 0.025, 0.16, p);
      return p;
    });
    for (const s of [-1, 1]) mesh(CYL, beak, s * 0.05, 0.03, 0, 0.012, 0.07, 0.012, g);
    return { obj: g, head: h, wings };
  }
  JOBS.birds = {
    par() {
      return 1 + this.total * 0.55;
    },
    hint() {
      return TOUCH ? "Tap the pigeons to shoo them off the sensors!" : "Click the pigeons to shoo them off the sensors! (Space shoos one)";
    },
    progress() {
      return this.gone / this.total;
    },
    cam() {
      return { p: [-4.6, 4.8, 1.3], l: [0, 1.6, -0.2] };
    },
    init() {
      this.car.parts.birds.visible = false;
      // on the roof, the lidar, the top of the windscreen and the tail
      const D = WG.CAR_DOME,
        spots = [
          [0.3, 0.75],
          [-0.35, 0.45],
          [0.38, -0.3],
          [-0.3, -0.5],
          [0.05, -0.72],
          [-0.38, 1.05],
          [0.3, 1.25],
          [-0.42, 0.05],
        ]
          .map(([x, z]) => WG.carSurf.top(x, z).p.toArray())
          .concat([[D.x, D.top, D.z]])
          .sort(() => Math.random() - 0.5);
      const n = 4 + Math.min(3, this.round);
      this.free = spots.slice(n);
      this.birds = spots.slice(0, n).map((s, i) => this.mk(s, i === 0 && this.round >= 2));
      this.extra = this.round >= 2 ? 2 : 1;
      this.extraT = 1.3;
      this.total = n + this.extra;
      this.gone = 0;
      this.cooT = 1;
    },
    mk(s, gull, fromSky) {
      const b = makeBird(gull);
      b.home = V3(s[0], s[1], s[2]);
      b.gull = gull;
      b.hp = gull ? 2 : 1;
      b.st = fromSky ? "land" : "sit";
      b.t = Math.random() * 5;
      b.obj.scale.setScalar(gull ? 1.7 : 1.3);
      b.obj.rotation.y = Math.random() * 7;
      if (fromSky) {
        const a = Math.random() * 7;
        b.from = V3(Math.cos(a) * 7, 7, Math.sin(a) * 7).add(b.home);
        b.obj.position.copy(b.from);
        b.k = 0;
      } else b.obj.position.copy(b.home);
      own(this, b.obj, this.car.parts.g);
      b.hit = mesh(SPH, HIT, 0, 0.18, 0, 0.3, 0.3, 0.3, b.obj);
      b.hit.userData.bird = b;
      return b;
    },
    down(rc) {
      const hs = this.birds.filter((b) => b.st === "sit" || b.st === "land").map((b) => b.hit),
        h = rc.intersectObjects(hs, false)[0];
      if (h) this.shoo(h.object.userData.bird);
    },
    shoo(b) {
      const wpos = b.obj.getWorldPosition(V3(0, 0, 0));
      b.hp--;
      if (b.hp > 0) {
        b.hop = 0.3;
        A().sfx("squawk");
        word("Squawk!", wpos.clone().add(V3(0, 0.8, 0)), "purple");
        return;
      }
      b.st = "fly";
      this.gone++;
      const out = wpos.clone().sub(this.car.parts.g.localToWorld(V3(0, 1, 0)));
      out.y = 0;
      if (out.lengthSq() < 0.01) out.set(-1, 0, 0);
      out.normalize().multiplyScalar(rr(3, 5));
      out.y = rr(4, 6);
      b.obj.lookAt(wpos.clone().add(V3(-out.x, 0, -out.z)));
      flyAway(b, out);
      A().sfx("flap");
      word(["Shoo!", "Bye!", "Scram!", "Off you go!"][(Math.random() * 4) | 0], wpos.add(V3(0, 0.8, 0)), "purple");
    },
    key(code) {
      if (code !== "Space" && code !== "Enter") return false;
      const b = this.birds.find((k) => k.st === "sit");
      if (b) this.shoo(b);
      return true;
    },
    update(dt) {
      this.cooT -= dt;
      if (this.cooT <= 0) {
        this.cooT = rr(1.2, 2.2);
        if (this.birds.some((b) => b.st === "sit")) A().sfx("coo");
      }
      if (this.extra > 0 && !this.done) {
        this.extraT -= dt;
        if (this.extraT <= 0 && this.free.length) {
          this.extraT = rr(1.1, 1.8);
          this.extra--;
          this.birds.push(this.mk(this.free.pop(), false, true));
          A().sfx("flap");
        }
      }
      for (const b of this.birds) {
        b.t += dt;
        if (b.st === "sit") {
          b.head.rotation.x = Math.max(0, Math.sin(b.t * 2.3 + b.home.z * 5) * 1.6 - 0.6) * 0.9;
          let y = 0;
          if (b.hop > 0) {
            b.hop -= dt;
            y = Math.sin((b.hop / 0.3) * Math.PI) * 0.3;
          }
          b.obj.position.y = b.home.y + y;
          b.wings[0].rotation.z = b.wings[1].rotation.z = 0;
        } else if (b.st === "land") {
          b.k = Math.min(1, b.k + dt * 0.9);
          const e = 1 - Math.pow(1 - b.k, 2);
          b.obj.position.lerpVectors(b.from, b.home, e);
          const fl = Math.sin(b.t * 30) * 0.9;
          b.wings[0].rotation.z = fl;
          b.wings[1].rotation.z = -fl;
          if (b.k >= 1) b.st = "sit";
        }
      }
      if (!this.done && this.extra <= 0 && this.birds.every((b) => b.st === "fly")) finish(this);
    },
  };

  /* ===================================================================================== */
  /* reboot: key in the recalibration code while the lidar spins out                       */
  /* ===================================================================================== */
  const ARW = ["↑", "→", "↓", "←"];
  JOBS.reboot = {
    par() {
      return 1 + this.code.length * 0.55;
    },
    hint() {
      return TOUCH ? "Tap the arrows to enter the recalibration code." : "Enter the recalibration code with the arrow keys / WASD (or click the arrows).";
    },
    progress() {
      return this.i / this.code.length;
    },
    cam() {
      return { p: [-5.2, 4.4, 2.6], l: [0, 1.7, 0] };
    },
    init() {
      const n = 4 + Math.min(3, this.round);
      this.code = Array.from({ length: n }, () => (Math.random() * 4) | 0);
      this.i = 0;
      this.car.problem.calm = 0;
      el.row.innerHTML = this.code.map((k) => "<i>" + ARW[k] + "</i>").join("");
      this.sync();
      el.code.hidden = false;
      // a holographic scan ring on the street, and one that sweeps out with each good key
      const g = this.car.parts.g;
      this.ringMat = new T.MeshBasicMaterial({ color: 0xe8508a, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false });
      this.ring = own(this, new T.Mesh(new T.RingGeometry(2.9, 3.1, 64), this.ringMat), g);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.06;
      this.waveMat = new T.MeshBasicMaterial({ color: 0x36d3c4, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
      this.wave = own(this, new T.Mesh(new T.RingGeometry(0.9, 1, 64), this.waveMat), g);
      this.wave.rotation.x = -Math.PI / 2;
      this.wave.position.y = 0.07;
      this.waveT = 9;
    },
    sync() {
      el.row.querySelectorAll("i").forEach((e, k) => {
        e.className = k < this.i ? "ok" : k === this.i ? "cur" : "";
      });
    },
    press(k) {
      if (this.done) return;
      el.code.querySelector('button[data-k="' + k + '"]').classList.remove("flash");
      void el.code.offsetWidth;
      el.code.querySelector('button[data-k="' + k + '"]').classList.add("flash");
      if (k === this.code[this.i]) {
        A().sfx("beep", this.i);
        this.i++;
        this.car.problem.calm = this.i / this.code.length;
        this.waveT = 0;
        if (this.i >= this.code.length) {
          this.ringMat.color.set(0x41c45a);
          finish(this);
        }
      } else {
        A().sfx("buzz");
        this.car.sad = 0.5;
        this.i = 0;
        this.car.problem.calm = 0;
        el.code.classList.remove("shake");
        void el.code.offsetWidth;
        el.code.classList.add("shake");
        word("Oops! From the top", this.car.parts.g.localToWorld(V3(0, 3, 0)), "pink");
      }
      this.sync();
    },
    key(code) {
      const m = { ArrowUp: 0, KeyW: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3 };
      if (!(code in m)) return false;
      this.press(m[code]);
      return true;
    },
    update(dt) {
      const calm = this.i / this.code.length;
      this.ring.rotation.z += dt * (0.5 + calm);
      this.ringMat.opacity = 0.35 + 0.25 * Math.abs(Math.sin(this.t * (6 - calm * 4)));
      if (!this.done) this.ringMat.color.setHSL(0.93 - calm * 0.42, 0.75, 0.6);
      this.waveT += dt;
      const k = clamp(this.waveT / 0.7, 0, 1);
      this.wave.scale.setScalar(1 + k * 3.5);
      this.waveMat.opacity = (1 - k) * 0.8;
    },
    cleanup(ok) {
      if (!ok && this.car.problem) this.car.problem.calm = 0;
    },
  };

  /* ===================================================================================== */
  /* vacuum: the roof comes off, you vacuum the crumbs, popcorn and the odd sock          */
  /* ===================================================================================== */
  const MESS = {
    crumbs(g) {
      const m = lam(0xc9a46a);
      for (let i = 0; i < 7; i++) mesh(SPH, m, rr(-0.09, 0.09), 0.02, rr(-0.09, 0.09), rr(0.018, 0.03), 0.018, rr(0.018, 0.03), g);
      return 0.45;
    },
    popcorn(g) {
      const m = lam(0xfff6dc);
      for (let i = 0; i < 4; i++) {
        const p = mesh(ICO, m, rr(-0.1, 0.1), 0.04, rr(-0.1, 0.1), 0.045, 0.04, 0.05, g);
        p.rotation.set(rr(0, 7), rr(0, 7), 0);
      }
      return 0.5;
    },
    wrapper(g) {
      const w = mesh(BOX, lam([0xe8433f, 0xffcf3a, 0x3aa6e8, 0x8a7fd8][(Math.random() * 4) | 0]), 0, 0.01, 0, 0.2, 0.015, 0.13, g);
      w.rotation.set(rr(-0.2, 0.2), rr(0, 7), rr(-0.2, 0.2));
      return 0.6;
    },
    receipt(g) {
      const r = mesh(BOX, lam(0xffffff), 0, 0.006, 0, 0.09, 0.006, 0.22, g);
      r.rotation.y = rr(0, 7);
      return 0.45;
    },
    sock(g) {
      const m = lam([0xff7aa8, 0x7ad0ff, 0xb2e36a][(Math.random() * 3) | 0]);
      mesh(SPH, m, 0, 0.04, 0, 0.06, 0.04, 0.14, g);
      mesh(SPH, m, 0.06, 0.04, 0.12, 0.08, 0.045, 0.06, g);
      g.rotation.y = rr(0, 7);
      return 1.3;
    },
    leaf(g) {
      const l = mesh(SPH, lam(0x7cc04a), 0, 0.01, 0, 0.07, 0.01, 0.12, g);
      l.rotation.y = rr(0, 7);
      return 0.4;
    },
    cup(g) {
      mesh(CYL, lam(0xffffff), 0, 0.09, 0, 0.055, 0.18, 0.055, g);
      mesh(CYL, lam(0x7a5636), 0, 0.185, 0, 0.06, 0.02, 0.06, g);
      g.rotation.z = Math.PI / 2 - 0.1;
      g.position.y += 0.03;
      return 1.1;
    },
  };
  JOBS.vacuum = {
    par() {
      return 1.5 + this.items.length * 0.35;
    },
    hint() {
      return TOUCH ? "Hold your finger down and sweep the vacuum over the mess!" : "Hold the mouse button and sweep the vacuum over the mess!";
    },
    progress() {
      return this.gone / this.items.length;
    },
    cam() {
      return { p: [-1.7, 5.6, 1.5], l: [0, 0.6, -0.15] };
    },
    init() {
      const P = this.car.parts,
        g = P.g,
        C = WG.carCutaway();
      P.body.visible = false;
      P.spin.visible = false;
      if (this.car.doorParts) for (const d of this.car.doorParts) d.pivot.visible = d.patch.visible = false;
      this.cut = own(this, new T.Mesh(C[0], C[1]), g);
      this.cut.castShadow = this.cut.receiveShadow = true;
      // where mess can be: the bench, the footwells, the dash shelf
      const areas = WG.CABIN;
      const kinds = ["crumbs", "popcorn", "wrapper", "receipt", "crumbs", "popcorn", "leaf", "wrapper", "sock", "cup"];
      const n = Math.min(18, 10 + this.round * 2);
      this.items = [];
      for (let i = 0; i < n; i++) {
        let k = kinds[i % kinds.length];
        const a = areas[(Math.random() * areas.length) | 0](),
          o = new T.Group();
        if (k === "cup" && a[1] > 0.6) k = "receipt";
        o.position.set(a[0], a[1], a[2]);
        const hp = MESS[k](o);
        own(this, o, g);
        this.items.push({ o, hp, hp0: hp, home: o.position.clone(), gone: false });
      }
      this.gone = 0;
      // the nozzle and its wand
      const nz = new T.Group();
      mesh(WG.roundBox(0.36, 0.07, 0.14, 0.03, 2), lam(0x3a3f47), 0, 0.035, 0, 1, 1, 1, nz);
      mesh(BOX, lam(0x36d3c4, { emissive: 0x1a8078 }), 0, 0.075, 0, 0.3, 0.012, 0.08, nz);
      const wand = mesh(CYL, lam(0xc7ccd3), -0.16, 0.42, 0.14, 0.035, 0.8, 0.035, nz);
      wand.rotation.set(0.35, 0, 0.4);
      nz.visible = false;
      this.noz = own(this, nz);
      this.floor = mesh(new T.PlaneGeometry(1.5, 2.8), HIT, 0, 0.47, -0.1, 1, 1, 1, g);
      this.floor.rotation.x = -Math.PI / 2;
      this.objs.push(this.floor);
      this.hits = [this.cut, this.floor];
      this.nozL = null;
    },
    track(rc) {
      const h = rc.intersectObjects(this.hits, false)[0];
      if (!h) {
        this.noz.visible = false;
        this.nozL = null;
        return;
      }
      this.noz.visible = this.pressed || !TOUCH;
      this.noz.position.copy(h.point).add(V3(0, 0.03, 0));
      this.noz.rotation.y = this.car.parts.root.rotation.y + Math.sin(this.t * 25) * (this.pressed ? 0.08 : 0);
      this.nozL = this.car.parts.g.worldToLocal(h.point.clone());
    },
    update(dt) {
      const on = this.pressed && this.nozL && !this.done;
      A().loop("vacuum", on ? 1 : 0);
      if (on) {
        const p = this.nozL;
        for (const it of this.items) {
          if (it.gone) continue;
          const d = Math.hypot(it.o.position.x - p.x, it.o.position.z - p.z);
          if (d > 0.38) continue;
          it.hp -= dt * 2.4;
          const k = Math.max(0, it.hp / it.hp0);
          it.o.position.lerp(V3(p.x, p.y + 0.05, p.z), Math.min(1, dt * (3 + 10 * (1 - k))));
          it.o.scale.setScalar(0.25 + 0.75 * k);
          it.o.rotation.y += dt * 12;
          if (it.hp <= 0) {
            it.gone = true;
            it.o.visible = false;
            this.gone++;
            A().sfx("thup");
            if (this.gone % 3 === 0) sparkle(this.car.parts.g.localToWorld(it.home.clone()), 3, 1.2);
          }
        }
        if (Math.random() < 0.3) bubble(this.noz.position.clone().add(V3(0, 0.1, 0)));
      }
      if (!this.done && this.gone >= this.items.length) finish(this);
    },
    cleanup() {
      A().loop("vacuum", 0);
      this.car.parts.body.visible = true;
      this.car.parts.spin.visible = true;
    },
  };

  /* ===================================================================================== */
  /* doors: hop on a skateboard and slam the doors the passengers left open                */
  /* ===================================================================================== */
  JOBS.doors = {
    drives: true,
    par() {
      return 2.5 + this.open.length * 1.6;
    },
    hint() {
      return TOUCH
        ? "Skate into the open doors to slam them shut! Hold to steer."
        : "Skate into the open doors to slam them shut! WASD / arrows (or hold the mouse) to steer, Space to ollie.";
    },
    progress() {
      return this.open.filter((d) => d.shut).length / this.open.length;
    },
    cam() {
      const P = env.P,
        c = this.car.pos,
        l = V3(c.x, c.y + 0.5, c.z).lerp(P.pos, 0.55);
      const asp = env.camera.aspect,
        f = asp < 1.25 ? Math.min(2, Math.pow(1.25 / asp, 0.7)) : 1;
      // steep and high, so the row houses never get between the camera and the skater
      return { world: true, p: l.clone().add(V3(0, 17 * f, 6 * f)), l, k: 4 };
    },
    init() {
      const D = this.car.ensureDoors(),
        want = this.car.problem.doors || [0, 2];
      this.open = want.map((i) => Object.assign(D[i], { i, shut: false, k: 0 }));
      // the board
      const b = new T.Group();
      mesh(WG.roundBox(0.32, 0.05, 1.0, 0.024, 2), lam(0xff5a7a), 0, 0.12, 0, 1, 1, 1, b);
      mesh(WG.roundBox(0.3, 0.012, 0.92, 0.006, 1), lam(0x2b3038), 0, 0.15, 0, 1, 1, 1, b);
      for (const [x, z] of [
        [-0.11, -0.32],
        [0.11, -0.32],
        [-0.11, 0.32],
        [0.11, 0.32],
      ]) {
        const w = mesh(CYL, lam(0xffd23a), x, 0.05, z, 0.05, 0.05, 0.05, b);
        w.rotation.z = Math.PI / 2;
      }
      this.board = own(this, b);
      env.P.vel = V3(0, 0, 0);
      this.jump = 0;
      this.steer = null;
      this.lean = 0;
      A().sfx("ollie");
      word("Board on!", env.P.pos.clone().add(V3(0, 2.5, 0)), "teal");
    },
    down() {
      this.steerOn = true;
    },
    up() {
      this.steerOn = false;
      this.steer = null;
    },
    track() {
      if (this.pressed && this.ptr) this.steer = env.pickGround(this.ptr.x, this.ptr.y);
    },
    key(code) {
      if (code === "Space") {
        if (this.jump <= 0) {
          this.jump = 0.6;
          A().sfx("ollie");
        }
        return true;
      }
      return /^(Arrow|Key[WASD])/.test(code);
    },
    // move the skater (called by the game in place of walking)
    drive(dt, ix, iz) {
      const P = env.P,
        v = P.vel;
      let dx = 0,
        dz = 0;
      if (ix || iz) {
        const l = Math.hypot(ix, iz);
        dx = ix / l;
        dz = iz / l;
      } else if (this.steer) {
        const ex = this.steer.x - P.pos.x,
          ez = this.steer.z - P.pos.z,
          l = Math.hypot(ex, ez);
        if (l > 0.6) {
          dx = ex / l;
          dz = ez / l;
        }
      }
      if (this.done) dx = dz = 0;
      v.x += dx * 26 * dt;
      v.z += dz * 26 * dt;
      const fr = dx || dz ? 0.7 : 2.2;
      v.multiplyScalar(Math.max(0, 1 - fr * dt));
      const sp = Math.hypot(v.x, v.z);
      if (sp > 12) v.multiplyScalar(12 / sp);
      const ok = (x, z) => !W.isBlocked(x, z, 0.45);
      const nx = P.pos.x + v.x * dt,
        nz = P.pos.z + v.z * dt;
      if (ok(nx, P.pos.z)) P.pos.x = nx;
      else {
        v.x *= -0.4;
        A().sfx("bonk");
      }
      if (ok(P.pos.x, nz)) P.pos.z = nz;
      else {
        v.z *= -0.4;
        A().sfx("bonk");
      }
      const spd = Math.hypot(v.x, v.z);
      if (spd > 0.6) {
        const want = Math.atan2(-v.x, -v.z);
        let d = want - P.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.lean += (clamp(d * 2, -0.5, 0.5) - this.lean) * Math.min(1, dt * 6);
        P.yawWant = want;
      } else this.lean *= 0.9;
      P.speed = spd;
      A().loop("skate", this.jump > 0 ? 0 : Math.min(1, spd / 10));
      // slam any open door we roll into
      if (!this.done)
        for (const d of this.open) {
          if (d.shut) continue;
          const a = d.pivot.localToWorld(d.seg[0].clone()),
            b = d.pivot.localToWorld(d.seg[1].clone());
          const abx = b.x - a.x,
            abz = b.z - a.z,
            t = clamp(((P.pos.x - a.x) * abx + (P.pos.z - a.z) * abz) / (abx * abx + abz * abz), 0, 1),
            cx = a.x + abx * t,
            cz = a.z + abz * t;
          if (Math.hypot(P.pos.x - cx, P.pos.z - cz) < 0.95 * (WG.CAR_SCALE || 1) && spd > 1.2) {
            d.shut = true;
            d.k = 0;
            A().sfx("slam");
            const air = this.jump > 0;
            word(air ? "AIR SLAM!" : ["SLAM!", "Shut!", "Bam!"][(Math.random() * 3) | 0], b.clone().add(V3(0, 1.4, 0)), air ? "gold" : "teal");
            sparkle(b, 5, 1.6);
            this.car.sad = 0.25;
          }
        }
    },
    pose(mii, dt) {
      const P = env.P;
      let jy = 0;
      if (this.jump > 0) {
        this.jump -= dt;
        jy = Math.sin(((0.6 - this.jump) / 0.6) * Math.PI) * 0.9;
        if (this.jump <= 0) A().sfx("land");
      }
      const s = 1 / mii.root.scale.x;
      mii.body.position.y = (0.15 + jy) * s;
      mii.body.rotation.set(-0.05, 0.55, this.lean * 0.6);
      mii.legs[0].rotation.set(0, 0, -0.28);
      mii.legs[1].rotation.set(0, 0, 0.28);
      mii.arms[0].rotation.set(Math.sin(this.t * 3) * 0.2, 0, -1.15);
      mii.arms[1].rotation.set(-Math.sin(this.t * 3) * 0.2, 0, 1.15);
      this.board.position.set(P.pos.x, P.pos.y + jy, P.pos.z);
      this.board.rotation.set(0, P.yaw, this.jump > 0 ? ((0.6 - this.jump) / 0.6) * Math.PI * 2 : this.lean * 0.3);
    },
    update(dt) {
      for (const d of this.open)
        if (d.shut && d.pivot.visible) {
          d.k = Math.min(1, d.k + dt / 0.14);
          d.pose(1 - d.k * d.k);
          if (d.k >= 1) d.pivot.visible = d.patch.visible = false;
        }
      if (!this.done && this.open.every((d) => d.shut)) finish(this);
    },
    cleanup(ok) {
      A().loop("skate", 0);
      if (!ok && this.car.problem) this.car.problem.doors = this.open.filter((d) => !d.shut).map((d) => d.i);
      const mii = env.mii;
      mii.body.position.y = 0;
      mii.body.rotation.set(0, 0, 0);
      for (const l of mii.legs) l.rotation.set(0, 0, 0);
      mii.arms[0].rotation.set(0, 0, -0.18);
      mii.arms[1].rotation.set(0, 0, 0.18);
      env.P.vel = null;
      env.P.speed = 0;
    },
  };

  J.TITLE = TITLE;
  WG.jobs = J;
})();
