/* Waymo Care · Sunday Drive · Photo Mode. Traffic holds still and the camera comes free: look about, fly, rise and
   fall, orbit, and zoom from a wide 24 mm to a tight 120 mm. Five film looks (previewed live as a CSS filter on the
   canvas, applied to the photo through the 2D canvas's filter), four borders, and a detector that checks the camera's
   view against the island's 37 landmarks (js/isle.js MARKS): in frame, near the middle, big enough and not hidden
   behind a hill or a building. A Waymo in the shot earns the golden "Waymo Spotted!" stamp. The photo is rendered
   off screen at twice its size and scaled down (for smooth edges), finished on a 2D canvas, and handed to main.js. */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle,
    D = WG.sundayData;
  const K = W.SCALE;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (s) => document.querySelector(s);
  const City = () => WG.sundayCity;
  const P = {
    active: false,
    focal: 35,
    filter: D.FILTERS[0],
    border: D.BORDERS[0],
    det: null,
    onCapture: null, // (canvas, detection) → main.js
    onExit: null,
    markOpen: () => true,
  };
  const cam = { pos: new T.Vector3(), yaw: 0, pitch: -0.5 };
  const fovOf = (mm) => (2 * Math.atan(12 / mm) * 180) / Math.PI; // a 35 mm frame's 24 mm height

  /* ---------- in and out ---------- */
  P.enter = function () {
    const g = WG.game,
      c = g.camera;
    if (P.active) return;
    P.active = true;
    cam.pos.copy(c.position);
    const d = new T.Vector3();
    c.getWorldDirection(d);
    cam.yaw = Math.atan2(-d.x, -d.z);
    cam.pitch = Math.asin(clamp(d.y, -1, 1));
    P.focal = clamp(Math.round(24 / Math.tan((c.fov * Math.PI) / 360) / 2), 24, 120);
    City().paused = true;
    City().bubbles = false;
    City().labels = false;
    $("#sd-photo").hidden = false;
    document.body.classList.add("sd-photo");
    syncUI();
    applyLook();
    WG.audio.sfx("open");
    det(true);
  };
  P.exit = function () {
    if (!P.active) return;
    P.active = false;
    City().paused = false;
    City().bubbles = true;
    City().labels = true;
    $("#sd-photo").hidden = true;
    document.body.classList.remove("sd-photo");
    $("#gl").style.filter = "";
    WG.game.resize(); // the usual field of view
    WG.audio.sfx("back");
    if (P.onExit) P.onExit();
  };

  /* ---------- the viewfinder's controls ---------- */
  function buildUI() {
    const f = $("#sd-ph-filters"),
      b = $("#sd-ph-borders");
    f.innerHTML = D.FILTERS.map((q) => '<button type="button" data-f="' + q.id + '">' + q.name + "</button>").join("");
    b.innerHTML = D.BORDERS.map((q) => '<button type="button" data-b="' + q.id + '">' + q.name + "</button>").join("");
    f.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      P.filter = D.FILTERS.find((q) => q.id === t.dataset.f) || D.FILTERS[0];
      WG.audio.sfx("select");
      syncUI();
      applyLook();
    });
    b.addEventListener("click", (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      P.border = D.BORDERS.find((q) => q.id === t.dataset.b) || D.BORDERS[0];
      WG.audio.sfx("select");
      syncUI();
      applyLook();
    });
    const fl = $("#sd-ph-focal");
    fl.addEventListener("input", () => {
      P.focal = +fl.value;
      syncUI();
    });
    $("#sd-ph-snap").addEventListener("click", () => P.snap());
    $("#sd-ph-x").addEventListener("click", () => P.exit());
  }
  function syncUI() {
    for (const e of document.querySelectorAll("#sd-ph-filters button")) e.setAttribute("aria-pressed", e.dataset.f === P.filter.id);
    for (const e of document.querySelectorAll("#sd-ph-borders button")) e.setAttribute("aria-pressed", e.dataset.b === P.border.id);
    $("#sd-ph-focal").value = P.focal;
    $("#sd-ph-mm").textContent = P.focal + " mm";
  }
  // the live look: the film as a CSS filter on the canvas; the vignette and the border on an overlay canvas
  function applyLook() {
    $("#gl").style.filter = P.filter.css === "none" ? "" : P.filter.css;
    drawOverlay();
  }
  function drawOverlay() {
    const cv = $("#sd-ph-over"),
      dpr = Math.min(2, devicePixelRatio || 1),
      w = innerWidth,
      h = innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const x = cv.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    vignette(x, w, h, P.filter);
    border(x, w, h, P.border.id, caption(P.det), P.det && P.det.waymo, true);
  }
  const caption = (d) => (d && d.framed ? d.mark.name : "San Francisco");

  /* ---------- the free camera ---------- */
  P.camera = function (dt, pos, look) {
    const K2 = WG.game.keys,
      g = WG.game,
      typing = document.activeElement && /INPUT/.test(document.activeElement.tagName) && document.activeElement.type !== "range";
    if (!typing) {
      const up = Math.max(20, cam.pos.y - Math.max(0, W.height(cam.pos.x, cam.pos.z))),
        sp = clamp(up * 0.9, 25, 900) * dt;
      let f = 0,
        s = 0,
        u = 0;
      if (K2.has("KeyW") || K2.has("ArrowUp")) f += 1;
      if (K2.has("KeyS") || K2.has("ArrowDown")) f -= 1;
      if (K2.has("KeyA") || K2.has("ArrowLeft")) s -= 1;
      if (K2.has("KeyD") || K2.has("ArrowRight")) s += 1;
      if (K2.has("KeyR") || K2.has("PageUp")) u += 1;
      if (K2.has("KeyF") || K2.has("PageDown")) u -= 1;
      if (f || s) move(f * sp, s * sp);
      if (u) cam.pos.y += u * sp;
      const o = (K2.has("KeyQ") ? 1 : 0) - (K2.has("KeyE") ? 1 : 0);
      if (o) orbit(o * 0.8 * dt);
      if (K2.has("Equal") || K2.has("NumpadAdd")) setFocal(P.focal * (1 + dt));
      if (K2.has("Minus") || K2.has("NumpadSubtract")) setFocal(P.focal * (1 - dt));
    }
    keepAbove();
    const fov = fovOf(P.focal);
    if (Math.abs(g.camera.fov - fov) > 0.01) {
      g.camera.fov = fov;
      g.camera.updateProjectionMatrix();
    }
    const cp = Math.cos(cam.pitch);
    pos.copy(cam.pos);
    look.set(cam.pos.x - Math.sin(cam.yaw) * cp * 100, cam.pos.y + Math.sin(cam.pitch) * 100, cam.pos.z - Math.cos(cam.yaw) * cp * 100);
    return 14;
  };
  function move(f, s) {
    const fx = -Math.sin(cam.yaw),
      fz = -Math.cos(cam.yaw);
    cam.pos.x += fx * f + -fz * s;
    cam.pos.z += fz * f + fx * s;
  }
  // orbit round the ground point in the middle of the view
  function orbit(a) {
    const g = WG.game,
      p = City().ground(innerWidth / 2, innerHeight / 2, g.camera);
    const cx = p ? p.x : cam.pos.x - Math.sin(cam.yaw) * 200,
      cz = p ? p.z : cam.pos.z - Math.cos(cam.yaw) * 200,
      dx = cam.pos.x - cx,
      dz = cam.pos.z - cz,
      c = Math.cos(a),
      s = Math.sin(a);
    cam.pos.x = cx + dx * c + dz * s;
    cam.pos.z = cz - dx * s + dz * c;
    cam.yaw += a;
  }
  function keepAbove() {
    const gy = Math.max(0, W.height(cam.pos.x, cam.pos.z));
    cam.pos.y = clamp(cam.pos.y, gy + 4, 2400 * K);
    cam.pos.x = clamp(cam.pos.x, -3200 * K, 3400 * K);
    cam.pos.z = clamp(cam.pos.z, -3800 * K, 2600 * K);
    cam.pitch = clamp(cam.pitch, -1.45, 0.6);
  }
  const setFocal = (mm) => {
    P.focal = Math.round(clamp(mm, 24, 120));
    syncUI();
  };

  /* ---------- the pointer: drag to look, right-drag (or two fingers) to move, wheel or pinch to fly in and out ---------- */
  const ptrs = new Map();
  let drag = null,
    pinch = null;
  P.pointer = function (type, e) {
    if (type === "wheel") {
      move(-Math.sign(e.deltaY) * Math.max(8, (cam.pos.y - Math.max(0, W.height(cam.pos.x, cam.pos.z))) * 0.12), 0);
      return;
    }
    if (type === "down") {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
        drag = null;
      } else drag = { x: e.clientX, y: e.clientY, move: e.button === 2 || e.button === 1 };
      return;
    }
    if (type === "move") {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      const k = fovOf(P.focal) / 40;
      if (pinch && ptrs.size >= 2) {
        const [a, b] = Array.from(ptrs.values()),
          d = Math.hypot(a[0] - b[0], a[1] - b[1]),
          mx = (a[0] + b[0]) / 2,
          my = (a[1] + b[1]) / 2,
          up = Math.max(10, cam.pos.y - Math.max(0, W.height(cam.pos.x, cam.pos.z)));
        move((d - pinch.d) * up * 0.004, -(mx - pinch.x) * up * 0.002);
        cam.pos.y += (my - pinch.y) * up * 0.002;
        pinch.d = d;
        pinch.x = mx;
        pinch.y = my;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (drag.move) {
        const up = Math.max(10, cam.pos.y - Math.max(0, W.height(cam.pos.x, cam.pos.z)));
        move(dy * up * 0.003, -dx * up * 0.003);
      } else {
        cam.yaw += dx * 0.004 * k;
        cam.pitch += dy * 0.004 * k;
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    drag = null;
  };
  P.key = function (e) {
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) P.exit();
      return true;
    }
    if ((e.code === "Space" || e.code === "Enter") && !e.repeat) {
      const onBtn = document.activeElement && document.activeElement.closest && document.activeElement.closest("button");
      if (!onBtn || e.code === "Space") {
        P.snap();
        return true;
      }
      return false;
    }
    if (/^Digit[1-5]$/.test(e.code)) {
      P.filter = D.FILTERS[+e.code.slice(5) - 1];
      syncUI();
      applyLook();
      return true;
    }
    if (e.code === "KeyB" && !e.repeat) {
      const i = D.BORDERS.indexOf(P.border);
      P.border = D.BORDERS[(i + 1) % D.BORDERS.length];
      syncUI();
      applyLook();
      return true;
    }
    return /^(Arrow|Key[WASDQERF]|PageUp|PageDown|Equal|Minus|Numpad)/.test(e.code);
  };

  /* ---------- the landmark detector ---------- */
  const _v = new T.Vector3(),
    _a = new T.Vector3(),
    _b = new T.Vector3();
  // is the straight line from the camera to a point (game metres) clear of hills and buildings, until `stop` short of it?
  function clear(from, to, stop) {
    const L = from.distanceTo(to),
      n = clamp(Math.ceil(L / 25), 8, 90),
      end = Math.max(0, 1 - stop / L);
    for (let i = 1; i < n; i++) {
      const t = (i / n) * end;
      _v.lerpVectors(from, to, t);
      const x = _v.x / K,
        y = _v.y / K,
        z = _v.z / K;
      if (I.groundH(x, z) > y + 1) return false;
      if (t > 0.02 && I.hitsBuilding(x, y, z, 0.5)) return false;
    }
    return true;
  }
  // what the view holds: the best-framed landmark, how well, and whether a Waymo is in it
  P.detect = function (camera) {
    camera.updateMatrixWorld();
    const cp = camera.position,
      tanH = Math.tan((camera.fov * Math.PI) / 360);
    let best = null;
    for (const m of I.MARKS) {
      const foot = _a.set(m.x * K, m.y * K, m.z * K),
        hh = Math.max(4, m.h) * K,
        mid = new T.Vector3(foot.x, foot.y + hh * 0.5, foot.z),
        dist = cp.distanceTo(mid);
      if (dist > 9000 * K) continue;
      _v.copy(mid).project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1) continue;
      const off = Math.hypot(_v.x, _v.y);
      // its size on screen: the taller of its height and its spread (a bridge, a beach), as a fraction of the frame
      _b.set(foot.x, foot.y + hh, foot.z).project(camera);
      const top = _b.y;
      _b.copy(foot).project(camera);
      const hFrac = Math.abs(top - _b.y) / 2,
        rFrac = (Math.min(m.r, 600) * K) / dist / (2 * tanH),
        size = Math.max(hFrac, rFrac * 0.6);
      if (size < 0.025) continue;
      // in view of the camera: its middle, its top or its foot
      const stop = Math.min(m.r * 0.5, 120) * K + 6,
        seen =
          clear(cp, mid, stop) ||
          clear(cp, new T.Vector3(foot.x, foot.y + hh * 0.9, foot.z), stop) ||
          clear(cp, new T.Vector3(foot.x, foot.y + Math.min(hh * 0.2, 12), foot.z), stop);
      const score = (seen ? 2 : 0) + clamp(size, 0, 0.6) * 2 - off;
      if (!best || score > best.score)
        best = {
          mark: m,
          score,
          size,
          off,
          seen,
          framed: seen && size >= 0.07 && off < 0.6,
        };
    }
    // a Waymo in the frame, big enough to make out
    let waymo = false;
    const H = innerHeight;
    for (const car of City().cars) {
      if (car.x === null) continue;
      _v.set(car.x, car.y + 0.8 * City().MS, car.z);
      const dist = cp.distanceTo(_v);
      _v.project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) continue;
      const px = ((5 * City().MS) / dist) * (H / (2 * tanH));
      if (px < 14) continue;
      if (!clear(cp, new T.Vector3(car.x, car.y + 0.8 * City().MS, car.z), 12)) continue;
      waymo = true;
      break;
    }
    if (best && best.framed && !P.markOpen(best.mark)) {
      best.clouded = true;
      best.framed = false;
    }
    return { mark: best && best.mark, framed: !!(best && best.framed), best, waymo };
  };
  // the viewfinder's line: what's framed, or how to frame it better
  let detT = 0;
  function det(now) {
    detT = 0;
    const d = (P.det = P.detect(WG.game.camera)),
      e = $("#sd-ph-det"),
      b = d.best;
    let t, cls;
    if (d.framed) {
      t = "📸 " + d.mark.name + " (Framed!)";
      cls = "ok";
    } else if (b && b.clouded) {
      t = "☁️ " + b.mark.name + " is still under the clouds";
      cls = "";
    } else if (b && !b.seen) {
      t = "🙈 " + b.mark.name + " is hidden behind something";
      cls = "";
    } else if (b && b.size < 0.07) {
      t = "🔭 " + b.mark.name + ": get closer, or zoom in";
      cls = "";
    } else if (b) {
      t = "🎯 " + b.mark.name + ": bring it to the middle";
      cls = "";
    } else {
      t = "No landmark in view: just a lovely snapshot";
      cls = "";
    }
    if (d.waymo) t += "  ·  ★ Waymo Spotted!";
    if (e.textContent !== t) e.textContent = t;
    e.className = cls;
    drawOverlay();
  }
  P.update = function (dt) {
    if (!P.active) return;
    detT += dt;
    if (detT > 0.25) det();
  };

  /* ---------- finishing a photo: the vignette, the border, the golden stamp ---------- */
  function vignette(x, w, h, f) {
    if (!f.vig) return;
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
    const c = f.white ? "235,240,244" : f.warm ? "80,30,0" : "0,0,0";
    g.addColorStop(0, "rgba(" + c + ",0)");
    g.addColorStop(1, "rgba(" + c + "," + f.vig + ")");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  }
  // a little film grain (for the vintage looks), drawn from a tile of noise
  let grainTile = null;
  function grain(x, w, h, amt) {
    if (!grainTile) {
      grainTile = document.createElement("canvas");
      grainTile.width = grainTile.height = 128;
      const gx = grainTile.getContext("2d"),
        img = gx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gx.putImageData(img, 0, 0);
    }
    x.save();
    x.globalAlpha = amt;
    x.globalCompositeOperation = "overlay";
    x.fillStyle = x.createPattern(grainTile, "repeat");
    x.fillRect(0, 0, w, h);
    x.restore();
  }
  const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif";
  // preview: the live viewfinder, where the golden stamp moves up out of the shutter button's way
  function border(x, w, h, kind, title, waymo, preview) {
    const u = Math.min(w, h) / 100;
    if (kind === "postcard") {
      // a cream card with a deckled edge, a big retro greeting, a stamp and a postmark
      const m = u * 3.2;
      x.save();
      x.fillStyle = "#f6efdc";
      x.beginPath();
      x.rect(0, 0, w, h);
      x.rect(m, m, w - 2 * m, h - 2 * m);
      x.fill("evenodd");
      x.strokeStyle = "rgba(150,110,60,.55)";
      x.lineWidth = u * 0.3;
      x.strokeRect(m - u * 0.8, m - u * 0.8, w - 2 * m + u * 1.6, h - 2 * m + u * 1.6);
      greeting(x, m + u * 2.4, m + u * 9.5, u, "Greetings from", title);
      stamp(x, w - m - u * 15, m + u * 2, u * 12.5, u * 15);
      postmark(x, w - m - u * 21, m + u * 13, u * 8);
      x.restore();
    } else if (kind === "stamp") {
      // the whole photo as a postage stamp: white perforated margin, the value and the city along the bottom
      const m = u * 6,
        r = u * 1.3;
      x.save();
      x.fillStyle = "#fbfaf6";
      x.beginPath();
      x.rect(0, 0, w, h);
      x.rect(m, m, w - 2 * m, h - 2 * m - u * 4);
      x.fill("evenodd");
      x.globalCompositeOperation = "destination-out";
      const step = r * 3;
      for (let px = step / 2; px < w; px += step) {
        x.beginPath();
        x.arc(px, 0, r, 0, 7);
        x.arc(px, h, r, 0, 7);
        x.fill();
      }
      for (let py = step / 2; py < h; py += step) {
        x.beginPath();
        x.arc(0, py, r, 0, 7);
        x.arc(w, py, r, 0, 7);
        x.fill();
      }
      x.globalCompositeOperation = "source-over";
      x.fillStyle = "#1c5e9e";
      x.font = "900 " + u * 3.6 + "px " + FONT;
      x.textBaseline = "alphabetic";
      x.textAlign = "left";
      x.fillText("SAN FRANCISCO · " + title.toUpperCase(), m, h - m + u * 1.2);
      x.textAlign = "right";
      x.fillStyle = "#d8432f";
      x.font = "900 " + u * 6 + "px " + FONT;
      x.fillText("25¢", w - m, h - m + u * 2);
      x.restore();
    } else if (kind === "snapshot") {
      // an instant photo: a thick white frame, a handwritten caption on the bottom
      const m = u * 4,
        mb = u * 17;
      x.save();
      x.fillStyle = "#fdfdfb";
      x.beginPath();
      x.rect(0, 0, w, h);
      x.rect(m, m, w - 2 * m, h - m - mb);
      x.fill("evenodd");
      x.fillStyle = "#3a4a6a";
      x.font = "italic 800 " + u * 6 + "px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(title + " · " + niceDate(), w / 2, h - mb / 2);
      x.restore();
    }
    if (waymo && preview) goldStamp(x, w - u * 16, h * 0.5, u * 9);
    else if (waymo) goldStamp(x, w - u * (kind === "none" ? 14 : 18), h - u * (kind === "snapshot" ? 30 : kind === "none" ? 14 : 18), u * 10);
  }
  function greeting(x, gx, gy, u, small, big) {
    x.save();
    x.textBaseline = "alphabetic";
    x.textAlign = "left";
    x.font = "italic 800 " + u * 4.2 + "px " + FONT;
    x.lineWidth = u * 0.9;
    x.strokeStyle = "rgba(255,255,255,.9)";
    x.fillStyle = "#c2412f";
    x.strokeText(small, gx, gy - u * 5.2);
    x.fillText(small, gx, gy - u * 5.2);
    const size = Math.min(u * 10, (u * 100 * 0.62) / Math.max(6, big.length * 0.62));
    x.font = "900 " + size + "px " + FONT;
    x.lineJoin = "round";
    x.lineWidth = u * 2;
    x.strokeStyle = "#173e6e";
    x.strokeText(big.toUpperCase(), gx + u * 0.5, gy + u * 0.5 + size * 0.62);
    x.lineWidth = u * 1;
    x.strokeStyle = "#fff";
    x.strokeText(big.toUpperCase(), gx, gy + size * 0.62);
    const gr = x.createLinearGradient(0, gy, 0, gy + size * 0.7);
    gr.addColorStop(0, "#ffd23a");
    gr.addColorStop(1, "#ff8a3a");
    x.fillStyle = gr;
    x.fillText(big.toUpperCase(), gx, gy + size * 0.62);
    x.restore();
  }
  function stamp(x, sx, sy, sw, sh) {
    x.save();
    x.fillStyle = "#fff";
    const r = sw * 0.045;
    x.fillRect(sx, sy, sw, sh);
    x.globalCompositeOperation = "destination-out";
    for (let px = sx; px <= sx + sw; px += r * 3) {
      x.beginPath();
      x.arc(px, sy, r, 0, 7);
      x.arc(px, sy + sh, r, 0, 7);
      x.fill();
    }
    for (let py = sy; py <= sy + sh; py += r * 3) {
      x.beginPath();
      x.arc(sx, py, r, 0, 7);
      x.arc(sx + sw, py, r, 0, 7);
      x.fill();
    }
    x.globalCompositeOperation = "source-over";
    // inside: a sunset sky, a hill and a little Coit Tower
    const ix = sx + sw * 0.1,
      iy = sy + sh * 0.1,
      iw = sw * 0.8,
      ih = sh * 0.8;
    const g = x.createLinearGradient(0, iy, 0, iy + ih);
    g.addColorStop(0, "#ffb27a");
    g.addColorStop(1, "#7fbfe8");
    x.fillStyle = g;
    x.fillRect(ix, iy, iw, ih);
    x.fillStyle = "#3f8a5a";
    x.beginPath();
    x.moveTo(ix, iy + ih);
    x.quadraticCurveTo(ix + iw * 0.5, iy + ih * 0.45, ix + iw, iy + ih);
    x.fill();
    x.fillStyle = "#f4efe2";
    x.fillRect(ix + iw * 0.45, iy + ih * 0.28, iw * 0.1, ih * 0.38);
    x.fillStyle = "#c2412f";
    x.font = "900 " + sw * 0.2 + "px " + FONT;
    x.textAlign = "left";
    x.textBaseline = "top";
    x.fillText("25¢", ix + iw * 0.04, iy + ih * 0.03);
    x.restore();
  }
  function postmark(x, cx, cy, r) {
    x.save();
    x.strokeStyle = "rgba(40,50,70,.55)";
    x.fillStyle = "rgba(40,50,70,.6)";
    x.lineWidth = r * 0.08;
    x.beginPath();
    x.arc(cx, cy, r, 0, 7);
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, r * 0.72, 0, 7);
    x.stroke();
    x.font = "900 " + r * 0.24 + "px " + FONT;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("SAN FRANCISCO", cx, cy - r * 0.18);
    x.fillText(niceDate(true), cx, cy + r * 0.18);
    // the wavy cancellation lines, off to the left
    for (let k = 0; k < 4; k++) {
      x.beginPath();
      for (let i = 0; i <= 20; i++) {
        const px = cx - r * 1.1 - i * r * 0.18,
          py = cy - r * 0.45 + k * r * 0.3 + Math.sin(i * 0.9) * r * 0.08;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
    x.restore();
  }
  // the coveted golden "Waymo Spotted!" stamp: a rosette with a ribbon
  function goldStamp(x, cx, cy, r) {
    x.save();
    x.translate(cx, cy);
    x.rotate(-0.18);
    x.fillStyle = "#c98a00";
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(s * r * 0.3, r * 0.5);
      x.lineTo(s * r * 0.75, r * 1.45);
      x.lineTo(s * r * 0.45, r * 1.3);
      x.lineTo(s * r * 0.25, r * 1.55);
      x.lineTo(s * r * 0.05, r * 0.6);
      x.fill();
    }
    x.beginPath();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2,
        rr = i % 2 ? r : r * 0.88;
      x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath();
    const g = x.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#fff3b0");
    g.addColorStop(0.5, "#ffcc3a");
    g.addColorStop(1, "#d99a10");
    x.fillStyle = g;
    x.fill();
    x.lineWidth = r * 0.06;
    x.strokeStyle = "#a86e00";
    x.stroke();
    x.beginPath();
    x.arc(0, 0, r * 0.7, 0, 7);
    x.stroke();
    x.fillStyle = "#7a4a00";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.font = "900 " + r * 0.3 + "px " + FONT;
    x.fillText("WAYMO", 0, -r * 0.16);
    x.font = "900 " + r * 0.22 + "px " + FONT;
    x.fillText("SPOTTED!", 0, r * 0.16);
    x.font = "900 " + r * 0.2 + "px " + FONT;
    x.fillText("★", 0, r * 0.45);
    x.restore();
  }
  function niceDate(short) {
    const d = new Date();
    return short
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }
  /* ---------- taking the photo ---------- */
  P.snap = function () {
    if (!P.active || P.busy) return;
    P.busy = true;
    const g = WG.game,
      d = P.detect(g.camera);
    WG.audio.sfx("shutter");
    const fl = $("#sd-ph-flash");
    fl.classList.remove("go");
    void fl.offsetWidth;
    fl.classList.add("go");
    // let the flash show before the (slow) off-screen render
    setTimeout(() => {
      let cv = null;
      try {
        cv = render(g, d);
      } catch (e) {
        console.warn("photo failed", e);
      }
      P.busy = false;
      if (cv && P.onCapture) P.onCapture(cv, d, { filter: P.filter.name, border: P.border.name });
    }, 60);
  };
  function render(g, d) {
    const renderer = g.renderer,
      camera = g.camera,
      scene = g.scene,
      aspect = innerWidth / innerHeight,
      long = 1920,
      w = aspect >= 1 ? long : Math.round(long * aspect),
      h = aspect >= 1 ? Math.round(long / aspect) : long,
      max = (renderer.capabilities && renderer.capabilities.maxTextureSize) || 4096,
      ss = Math.max(w, h) * 2 <= max ? 2 : 1,
      rw = w * ss,
      rh = h * ss;
    const rt = new T.WebGLRenderTarget(rw, rh);
    for (const car of City().cars) car.parts.sprite.visible = false;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    I.frame(camera, 0, rw, rh);
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    const px = new Uint8Array(rw * rh * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, rw, rh, px);
    renderer.setRenderTarget(null);
    rt.dispose();
    I.frame(camera, 0, innerWidth, innerHeight);
    // into a 2D canvas, the right way up
    const raw = document.createElement("canvas");
    raw.width = rw;
    raw.height = rh;
    const rx = raw.getContext("2d"),
      img = rx.createImageData(rw, rh),
      row = rw * 4;
    for (let r = 0; r < rh; r++) img.data.set(px.subarray((rh - 1 - r) * row, (rh - r) * row), r * row);
    rx.putImageData(img, 0, 0);
    // scaled down (smooth edges) through the film
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const x = out.getContext("2d");
    x.imageSmoothingQuality = "high";
    const css = P.filter.css;
    if (css !== "none" && "filter" in x) x.filter = css;
    x.drawImage(raw, 0, 0, w, h);
    x.filter = "none";
    if (css !== "none" && !("filter" in x)) fallbackFilter(x, w, h, P.filter.id);
    vignette(x, w, h, P.filter);
    if (P.filter.id === "kodachrome" || P.filter.id === "noir") grain(x, w, h, P.filter.id === "noir" ? 0.16 : 0.08);
    border(x, w, h, P.border.id, caption(d), d.waymo);
    return out;
  }
  // for browsers without the 2D canvas filter: the same looks, roughly, by hand
  function fallbackFilter(x, w, h, id) {
    const img = x.getImageData(0, 0, w, h),
      a = img.data;
    for (let i = 0; i < a.length; i += 4) {
      let r = a[i],
        g = a[i + 1],
        b = a[i + 2];
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (id === "noir") r = g = b = clamp((l - 128) * 1.38 + 122, 0, 255);
      else if (id === "golden") {
        r = clamp(r * 1.1 + 18, 0, 255);
        g = clamp(g * 1.02 + 6, 0, 255);
        b = clamp(b * 0.82, 0, 255);
      } else if (id === "mist") {
        r = clamp((l + (r - l) * 0.62) * 0.82 + 52, 0, 255);
        g = clamp((l + (g - l) * 0.62) * 0.82 + 54, 0, 255);
        b = clamp((l + (b - l) * 0.62) * 0.82 + 58, 0, 255);
      } else if (id === "kodachrome") {
        r = clamp(((l + (r - l) * 1.5) - 128) * 1.18 + 132, 0, 255);
        g = clamp(((l + (g - l) * 1.5) - 128) * 1.18 + 128, 0, 255);
        b = clamp(((l + (b - l) * 1.5) - 128) * 1.18 + 120, 0, 255);
      }
      a[i] = r;
      a[i + 1] = g;
      a[i + 2] = b;
    }
    x.putImageData(img, 0, 0);
  }
  P.thumb = function (cv) {
    const t = document.createElement("canvas"),
      w = 360,
      h = Math.round((360 * cv.height) / cv.width);
    t.width = w;
    t.height = h;
    t.getContext("2d").drawImage(cv, 0, 0, w, h);
    return t.toDataURL("image/jpeg", 0.8);
  };
  P.init = buildUI;
  P.cam = cam; // the free camera (position, yaw, pitch), for the playtest to aim
  addEventListener("resize", () => P.active && drawOverlay());
  WG.sundayPhoto = P;
})();
