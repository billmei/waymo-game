/* Waymo Care · Sunday Drive · photo mode. A free camera over the whole diorama, a 24–120 mm lens, five film looks, and
   a postcard maker: the frame finds one of the island's 37 landmarks, notices any Waymo in shot, and renders a high-res
   offscreen copy with a border, a caption and a stamp. The pictures are kept by js/sunday/album.js in IndexedDB. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle,
    City = WG.sundayCity,
    Album = WG.sundayAlbum;
  const K = W.SCALE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s) => document.querySelector(s);
  const _v = new T.Vector3(),
    _w = new T.Vector3(),
    _dir = new T.Vector3();

  const FILTERS = [
    { id: "natural", name: "Natural", css: "none", note: "Sunday morning, as it is." },
    {
      id: "golden",
      name: "Golden Hour",
      css: "sepia(0.32) saturate(1.28) brightness(1.06) contrast(1.04)",
      note: "Alamo Square light, all day long.",
    },
    {
      id: "mist",
      name: "Karl's Mist",
      css: "saturate(0.82) brightness(1.08) contrast(0.92)",
      note: "Soft grey from the Pacific.",
    },
    {
      id: "kodachrome",
      name: "Kodachrome '68",
      css: "sepia(0.16) saturate(1.42) contrast(1.14) brightness(0.98)",
      note: "A shoebox slide, slightly warm.",
    },
    {
      id: "noir",
      name: "Monochrome Noir",
      css: "grayscale(1) contrast(1.24) brightness(0.96)",
      note: "Fog, shadows, and a robotaxi.",
    },
  ];
  const byId = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];
  const fovFor = (mm) => (2 * Math.atan(12 / mm) * 180) / Math.PI;

  const P = {
    active: false,
    busy: false,
    filter: "natural",
    mm: 40,
    pos: new T.Vector3(),
    yaw: 0,
    pitch: -0.9,
    framed: null,
    car: null,
    S: null,
    onPostcard: null,
  };
  P.FILTERS = FILTERS;
  let ptrs = new Map(),
    drag = null,
    pinch = null,
    lastFramed = "";

  P.setSave = (S) => (P.S = S);
  P.filterInfo = () => byId(P.filter);

  function unlockedSet() {
    return new Set((P.S && P.S.unlockedDistricts) || ["lombard"]);
  }
  function nearestDistrict(x, z) {
    let best = null,
      bd = Infinity;
    for (const id of City.order) {
      const d = City.districts[id],
        dd = Math.hypot(d.x - x, d.z - z);
      if (dd < bd) {
        bd = dd;
        best = id;
      }
    }
    return best;
  }
  function markOpen(m) {
    const open = unlockedSet();
    for (const id of City.order) {
      const d = City.districts[id];
      if (d.markObjs && d.markObjs.some((q) => q.id === m.id)) return open.has(id);
    }
    return open.has(nearestDistrict(m.x, m.z));
  }

  /* ---------- in and out ---------- */
  P.enter = function () {
    if (P.active) return false;
    const g = WG.game,
      cam = g.camera;
    P.active = true;
    P.busy = false;
    P.pos.copy(cam.position);
    cam.getWorldDirection(_dir);
    P.yaw = Math.atan2(_dir.x, _dir.z);
    P.pitch = Math.asin(clamp(_dir.y, -1, 1));
    P.framed = null;
    P.car = null;
    P.mm = 40;
    P.filter = "natural";
    lastFramed = "";
    g.setState("sundayPhoto");
    $("#su-photo").hidden = false;
    $("#su-mm").textContent = "40mm";
    $("#su-focal").value = "40";
    const f = $("#su-framed");
    if (f) {
      f.textContent = "Look around…";
      f.parentNode.classList.remove("found");
    }
    syncFilters();
    setFov();
    g.snap();
    g.A.sfx("open");
    return true;
  };

  P.exit = function () {
    if (!P.active) return false;
    const g = WG.game;
    P.active = false;
    P.busy = false;
    ptrs.clear();
    drag = pinch = null;
    $("#su-photo").hidden = true;
    g.camera.fov = innerWidth < innerHeight ? 58 : 40;
    g.camera.updateProjectionMatrix();
    g.setState("sunday");
    g.snap();
    g.A.sfx("back");
    return true;
  };

  P.setFocal = function (mm) {
    P.mm = clamp(+mm || 40, 24, 120);
    const s = $("#su-focal");
    if (s && +s.value !== P.mm) s.value = P.mm;
    const b = $("#su-mm");
    if (b) b.textContent = Math.round(P.mm) + "mm";
    if (P.active) setFov();
  };
  function setFov() {
    const cam = WG.game.camera;
    cam.fov = fovFor(P.mm);
    cam.updateProjectionMatrix();
  }

  P.setFilter = function (id) {
    P.filter = byId(id).id;
    syncFilters();
    WG.game.A.sfx("select");
  };
  function syncFilters() {
    const box = $("#su-filters");
    if (!box) return;
    for (const b of box.querySelectorAll("button"))
      b.setAttribute("aria-pressed", String(b.dataset.filter === P.filter));
  }
  P.buildFilters = function () {
    const box = $("#su-filters");
    if (!box || box.children.length) return;
    for (const f of FILTERS) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.filter = f.id;
      b.textContent = f.name;
      b.title = f.note;
      b.setAttribute("aria-pressed", String(f.id === P.filter));
      b.addEventListener("click", () => P.setFilter(f.id));
      box.appendChild(b);
    }
  };

  /* ---------- the free camera ---------- */
  P.camera = function (dt, pos, look) {
    if (!P.active) return 4;
    const g = WG.game,
      K2 = g.keys,
      typing =
        document.activeElement &&
        /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!typing && !g.PHOTO_LOCK) {
      const sp = (K2.has("ShiftLeft") || K2.has("ShiftRight") ? 620 : 220) * dt;
      const cy = Math.cos(P.yaw),
        sy = Math.sin(P.yaw),
        cp = Math.cos(P.pitch);
      let fx = 0,
        fz = 0,
        rx = 0,
        rz = 0,
        up = 0;
      if (K2.has("KeyW") || K2.has("ArrowUp")) {
        fx += sy * cp;
        fz += cy * cp;
      }
      if (K2.has("KeyS") || K2.has("ArrowDown")) {
        fx -= sy * cp;
        fz -= cy * cp;
      }
      if (K2.has("KeyD") || K2.has("ArrowRight")) {
        rx += cy;
        rz -= sy;
      }
      if (K2.has("KeyA") || K2.has("ArrowLeft")) {
        rx -= cy;
        rz += sy;
      }
      if (K2.has("KeyE") || K2.has("Space")) up += 1;
      if (K2.has("KeyQ")) up -= 1;
      P.pos.x += (fx + rx) * sp;
      P.pos.z += (fz + rz) * sp;
      P.pos.y += up * sp * 0.9;
    }
    P.pos.x = clamp(P.pos.x, -4200, 4200);
    P.pos.z = clamp(P.pos.z, -4200, 4200);
    P.pos.y = clamp(
      P.pos.y,
      W.height(P.pos.x, P.pos.z) + 2.5,
      4200,
    );
    const cp = Math.cos(P.pitch),
      sy = Math.sin(P.yaw),
      cy = Math.cos(P.yaw);
    look.set(
      P.pos.x + sy * cp * 100,
      P.pos.y + Math.sin(P.pitch) * 100,
      P.pos.z + cy * cp * 100,
    );
    pos.copy(P.pos);
    WG.game.snap();
    if (Math.abs(WG.game.camera.fov - fovFor(P.mm)) > 0.01) setFov();
    return 20;
  };

  P.dolly = function (dir) {
    const cp = Math.cos(P.pitch),
      sy = Math.sin(P.yaw),
      cy = Math.cos(P.yaw);
    const step = dir * Math.max(12, P.pos.y * 0.18);
    P.pos.x += sy * cp * step;
    P.pos.y += Math.sin(P.pitch) * step;
    P.pos.z += cy * cp * step;
  };

  /* ---------- the pointer ---------- */
  P.pointer = function (type, e) {
    if (!P.active) return;
    if (type === "wheel") {
      P.dolly(e.deltaY > 0 ? 1 : -1);
      return;
    }
    if (type === "down") {
      if (e.pointerType !== "mouse")
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        drag = null;
      } else {
        drag = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: 0,
          button: e.button,
        };
      }
      return;
    }
    if (type === "move") {
      if (ptrs.has(e.pointerId))
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 0) P.dolly((pinch.d - d) * 0.02);
        pinch.d = d;
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      P.yaw -= dx * 0.004;
      P.pitch = clamp(P.pitch - dy * 0.004, -1.45, 1.45);
      return;
    }
    if (type === "up") {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (drag && drag.id === e.pointerId) drag = null;
    }
  };

  P.key = function (e) {
    if (!P.active) return false;
    if (e.code === "Escape" || e.code === "KeyP") {
      P.exit();
      return true;
    }
    if (/^(Key[WASDQE]|Arrow|Space|Shift)/.test(e.code)) return false;
    return false;
  };

  /* ---------- finding a landmark and a Waymo in the frame ---------- */
  function markWorld(m) {
    return {
      x: m.x * K,
      y: m.y * K + m.h * K * 0.45,
      z: m.z * K,
      r: Math.max(2, m.r * K),
    };
  }
  function screenOf(x, y, z, cam) {
    _v.set(x, y, z).project(cam);
    return {
      x: (_v.x * 0.5 + 0.5) * innerWidth,
      y: (-_v.y * 0.5 + 0.5) * innerHeight,
      z: _v.z,
    };
  }
  P.after = function () {
    if (!P.active) return;
    const cam = WG.game.camera;
    cam.updateMatrixWorld();
    let best = null,
      bestScore = -1;
    for (const m of I.MARKS) {
      if (!markOpen(m)) continue;
      const w = markWorld(m),
        s = screenOf(w.x, w.y, w.z, cam);
      if (s.z > 1) continue;
      const nx = s.x / innerWidth,
        ny = s.y / innerHeight;
      if (nx < 0.12 || nx > 0.88 || ny < 0.12 || ny > 0.88) continue;
      const dist = Math.hypot(w.x - P.pos.x, w.y - P.pos.y, w.z - P.pos.z);
      if (dist > 7000) continue;
      const rPx =
        ((w.r / Math.max(1, dist)) *
          (innerHeight / 2)) /
        Math.tan((cam.fov * Math.PI) / 360);
      if (rPx < 1.2) continue;
      const cd = Math.hypot(nx - 0.5, ny - 0.5);
      const score = (1 - cd) * 1.4 + Math.min(1, rPx / 60) * 0.6;
      if (score > bestScore) {
        bestScore = score;
        best = { name: m.name, id: m.id, x: w.x, z: w.z };
      }
    }
    P.framed = best;
    let car = null,
      bd = Infinity;
    for (const c of City.cars) {
      if (c.x === null) continue;
      const s = screenOf(c.x, c.y + 2.2 * 9, c.z, cam);
      if (s.z > 1) continue;
      const nx = s.x / innerWidth,
        ny = s.y / innerHeight;
      if (nx < 0.06 || nx > 0.94 || ny < 0.06 || ny > 0.94) continue;
      const d = Math.hypot(nx - 0.5, ny - 0.5);
      if (d < bd) {
        bd = d;
        car = c;
      }
    }
    P.car = car;
    const label = best ? best.name : car ? "A Waymo in the city" : "Look around…";
    if (label !== lastFramed) {
      lastFramed = label;
      const b = $("#su-framed");
      if (b) {
        b.textContent = label;
        b.parentNode.classList.toggle("found", !!best);
      }
    }
  };

  /* ---------- the postcard ---------- */
  function overlay(ctx, w, h, id) {
    if (id === "golden") {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(255,196,120,0.22)");
      g.addColorStop(0.55, "rgba(255,160,70,0.07)");
      g.addColorStop(1, "rgba(120,60,20,0.18)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (id === "mist") {
      ctx.fillStyle = "rgba(226,236,244,0.16)";
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(238,244,248,0.3)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (id === "kodachrome") {
      ctx.fillStyle = "rgba(255,220,150,0.06)";
      ctx.fillRect(0, 0, w, h);
      // a little slide grain
      for (let i = 0; i < 2600; i++) {
        const a = Math.random() * 0.05;
        ctx.fillStyle = "rgba(255,255,255," + a + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
    }
    // soft vignette for every film
    const rg = ctx.createRadialGradient(
      w / 2,
      h * 0.46,
      Math.min(w, h) * 0.25,
      w / 2,
      h * 0.46,
      Math.max(w, h) * 0.75,
    );
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, id === "noir" ? "rgba(0,0,0,0.38)" : "rgba(20,30,45,0.2)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  function decorate(ctx, w, h, framed, car) {
    const pad = 26;
    ctx.strokeStyle = "#f7f1df";
    ctx.lineWidth = pad * 2;
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);
    ctx.strokeStyle = "rgba(120,100,60,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(pad + 8, pad + 8, w - (pad + 8) * 2, h - (pad + 8) * 2);
    // caption
    ctx.fillStyle = "#f7f1df";
    ctx.fillRect(0, h - 92, w, 92);
    ctx.fillStyle = "#4a3a20";
    ctx.font = "900 34px 'M PLUS Rounded 1c', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(framed ? framed.name : "San Francisco", pad + 12, h - 56);
    ctx.fillStyle = "#8a7550";
    ctx.font = "700 19px 'M PLUS Rounded 1c', system-ui, sans-serif";
    ctx.fillText(
      "Sunday Drive · " +
        new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      pad + 12,
      h - 27,
    );
    // the stamp
    if (car) {
      ctx.save();
      ctx.translate(w - 220, 100);
      ctx.rotate(-0.09);
      ctx.fillStyle = "rgba(255,248,220,0.94)";
      ctx.strokeStyle = "#c9971c";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-120, -30, 240, 60, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#a87a10";
      ctx.font = "900 22px 'M PLUS Rounded 1c', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Waymo Spotted!", 0, 1);
      ctx.restore();
    }
    // a tiny brand line
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "800 16px 'M PLUS Rounded 1c', system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("SUNDAY DRIVE", w - pad - 12, pad + 26);
  }

  P.snap = function () {
    if (!P.active || P.busy) return false;
    const g = WG.game,
      cam = g.camera,
      r = g.renderer;
    // freeze what the frame found: the IndexedDB write is async and the camera may move on before it lands
    const framed = P.framed,
      car = P.car;
    P.busy = true;
    const flash = $("#su-flash");
    if (flash) {
      flash.classList.remove("go");
      void flash.offsetWidth;
      flash.classList.add("go");
    }
    g.A.sfx("click");
    const w = 1600,
      h = 1000,
      oldW = r.domElement.width,
      oldH = r.domElement.height,
      oldAspect = cam.aspect,
      oldFov = cam.fov;
    try {
      cam.aspect = w / h;
      cam.fov = fovFor(P.mm);
      cam.updateProjectionMatrix();
      r.setSize(w, h, false);
      if (WG.isle && WG.isle.frame) WG.isle.frame(cam, 0, w, h);
      r.render(g.scene, cam);
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const ctx = out.getContext("2d");
      const f = byId(P.filter);
      ctx.filter = f.css;
      ctx.drawImage(r.domElement, 0, 0, w, h);
      ctx.filter = "none";
      overlay(ctx, w, h, P.filter);
      decorate(ctx, w, h, framed, car);
      const url = out.toDataURL("image/png");
      const card = {
        id: Album.uid(),
        title: framed ? framed.name : "San Francisco",
        landmark: framed ? framed.name : "",
        waymo: !!car,
        car: car ? car.name : "",
        filter: P.filter,
        date: new Date().toISOString(),
      };
      Album.putPhoto(card.id, url).then((ok) => {
        if (!ok) {
          // IndexedDB can be unavailable in private windows; the card stays in the scrapbook for this visit
        }
      });
      // keep the save and the scrapbook immediate; the photo itself lands in IndexedDB in the background
      if (P.onPostcard) P.onPostcard(card, url, framed, car);
      g.A.sfx("sparkle");
      return true;
    } finally {
      r.setSize(innerWidth, innerHeight, false);
      cam.aspect = oldAspect;
      cam.fov = P.active ? fovFor(P.mm) : oldFov;
      cam.updateProjectionMatrix();
      P.busy = false;
    }
  };

  WG.sundayPhoto = P;
})();
