/* Waymo Care · Sunday Drive · Photo Mode & Landmark Detector
   Free-roam camera viewfinder with 24mm-120mm focal length,
   5 vintage film filters, automated 37-landmark frustum detection,
   "Waymo Spotted!" detector, and postcard snapshot compositor. */
(function () {
  "use strict";
  const WG = window.WG || (window.WG = {});
  const T = THREE;

  const FILTERS = [
    { id: "natural", name: "Natural", desc: "Clean daylight look" },
    { id: "golden", name: "Golden Hour", desc: "Warm amber glow + soft bloom" },
    { id: "fog", name: "Karl's Mist", desc: "Atmospheric fog vignetting" },
    { id: "kodachrome", name: "Kodachrome '68", desc: "Vibrant vintage street film" },
    { id: "noir", name: "Monochrome Noir", desc: "Classic black-and-white" },
  ];

  const P = {
    active: false,
    filter: "natural",
    focalLength: 35, // 24 to 120 mm
    camPos: new T.Vector3(),
    camYaw: 0.6,
    camPitch: -0.25,
    framedLandmark: null,
    hasWaymo: false,
    drag: null,
  };

  const _v = new T.Vector3();
  const _dir = new T.Vector3();

  function focalToFov(mm) {
    // 35mm full frame sensor height = 24mm, width = 36mm
    // vertical fov in degrees: 2 * atan(24 / (2 * mm)) * 180 / PI
    return 2 * Math.atan(24 / (2 * mm)) * (180 / Math.PI);
  }

  function enter(initialPos, initialLook) {
    const G = WG.game;
    if (!G) return;
    P.active = true;

    // Initialize camera position and orientation from current view
    if (initialPos && initialLook) {
      P.camPos.copy(initialPos);
      _dir.subVectors(initialLook, initialPos).normalize();
      P.camYaw = Math.atan2(_dir.x, _dir.z);
      P.camPitch = Math.asin(Math.max(-0.95, Math.min(0.95, _dir.y)));
    } else {
      P.camPos.copy(G.camera.position);
      G.camera.getWorldDirection(_dir);
      P.camYaw = Math.atan2(_dir.x, _dir.z);
      P.camPitch = Math.asin(Math.max(-0.95, Math.min(0.95, _dir.y)));
    }

    const overlay = document.getElementById("sunday-photo");
    if (overlay) {
      overlay.hidden = false;
      buildUI(overlay);
    }

    G.A.sfx("open");
  }

  function exit() {
    P.active = false;
    const overlay = document.getElementById("sunday-photo");
    if (overlay) overlay.hidden = true;
    if (WG.game && WG.game.A) WG.game.A.sfx("back");
  }

  function toggle() {
    if (P.active) exit();
    else enter();
  }

  function buildUI(root) {
    const filterRow = root.querySelector(".pm-filters");
    if (filterRow) {
      filterRow.innerHTML = "";
      FILTERS.forEach((f) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pm-filter-btn" + (f.id === P.filter ? " active" : "");
        btn.textContent = f.name;
        btn.title = f.desc;
        btn.onclick = () => {
          P.filter = f.id;
          root.querySelectorAll(".pm-filter-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          applyFilterPreview();
          if (WG.game && WG.game.A) WG.game.A.sfx("select");
        };
        filterRow.appendChild(btn);
      });
    }

    const slider = root.querySelector("#pm-focal-slider");
    const label = root.querySelector("#pm-focal-val");
    if (slider) {
      slider.value = P.focalLength;
      slider.oninput = (e) => {
        P.focalLength = +e.target.value;
        if (label) label.textContent = P.focalLength + "mm";
        updateCameraFov();
      };
    }
    if (label) label.textContent = P.focalLength + "mm";

    const snapBtn = root.querySelector("#pm-snap-btn");
    if (snapBtn) {
      snapBtn.onclick = () => snap();
    }

    const closeBtn = root.querySelector("#pm-close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => exit();
    }

    applyFilterPreview();
  }

  function applyFilterPreview() {
    const vf = document.querySelector("#sunday-photo .pm-viewfinder");
    if (!vf) return;
    vf.dataset.filter = P.filter;
  }

  function updateCameraFov() {
    const G = WG.game;
    if (!G || !G.camera) return;
    G.camera.fov = focalToFov(P.focalLength);
    G.camera.updateProjectionMatrix();
  }

  /* ---------- Camera Update & Landmark Detection ---------- */
  function update(dt) {
    if (!P.active) return;
    const G = WG.game;
    if (!G) return;

    // Smooth movement with keys
    const keys = G.keys;
    if (keys) {
      const spd = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 280 : 120) * dt;
      const cy = Math.cos(P.camYaw), sy = Math.sin(P.camYaw);
      if (keys.has("KeyW") || keys.has("ArrowUp")) {
        P.camPos.x += sy * spd;
        P.camPos.z += cy * spd;
      }
      if (keys.has("KeyS") || keys.has("ArrowDown")) {
        P.camPos.x -= sy * spd;
        P.camPos.z -= cy * spd;
      }
      if (keys.has("KeyA") || keys.has("ArrowLeft")) {
        P.camPos.x -= cy * spd;
        P.camPos.z += sy * spd;
      }
      if (keys.has("KeyD") || keys.has("ArrowRight")) {
        P.camPos.x += cy * spd;
        P.camPos.z -= sy * spd;
      }
      if (keys.has("KeyR") || keys.has("KeyE")) P.camPos.y += spd;
      if (keys.has("KeyF") || keys.has("KeyQ")) P.camPos.y = Math.max(8, P.camPos.y - spd);
    }

    detectSubjects(G.camera);
  }

  function camera(dt, pos, look) {
    const cy = Math.cos(P.camYaw), sy = Math.sin(P.camYaw);
    const cp = Math.cos(P.camPitch), sp = Math.sin(P.camPitch);

    _dir.set(sy * cp, sp, cy * cp).normalize();
    look.copy(P.camPos).add(_dir.clone().multiplyScalar(50));
    pos.copy(P.camPos);
    return 10; // direct responsive positioning
  }

  function detectSubjects(cam) {
    P.framedLandmark = null;
    P.hasWaymo = false;

    const marks = (WG.isle && WG.isle.MARKS) || [];
    const S = (WG.world && WG.world.SCALE) || 1.6;

    let bestDist = Infinity;
    let bestMark = null;

    // 1. Landmark check
    for (const m of marks) {
      const wx = m.x * S;
      const wz = m.z * S;
      const wy = (m.y + (m.h || 20) * 0.45) * S;

      _v.set(wx, wy, wz);
      const dist = P.camPos.distanceTo(_v);
      if (dist > 3600) continue;

      _v.project(cam);
      // Visible within frame?
      if (_v.z > 0 && _v.z < 1 && Math.abs(_v.x) < 0.76 && Math.abs(_v.y) < 0.76) {
        const centerDist = Math.hypot(_v.x, _v.y) * 1200 + dist * 0.4;
        if (centerDist < bestDist) {
          bestDist = centerDist;
          bestMark = m;
        }
      }
    }
    P.framedLandmark = bestMark;

    // 2. Waymo Car check
    const cars = (WG.sundayCity && WG.sundayCity.cars) || [];
    for (const c of cars) {
      if (!c.parts || !c.parts.root) continue;
      _v.set(c.x, c.y + 1.2, c.z);
      const dist = P.camPos.distanceTo(_v);
      if (dist > 900) continue;

      _v.project(cam);
      if (_v.z > 0 && _v.z < 1 && Math.abs(_v.x) < 0.85 && Math.abs(_v.y) < 0.85) {
        P.hasWaymo = true;
        break;
      }
    }

    // Update Viewfinder HUD elements
    const lmBadge = document.querySelector("#pm-landmark-badge");
    const waymoBadge = document.querySelector("#pm-waymo-badge");

    if (lmBadge) {
      if (P.framedLandmark) {
        lmBadge.textContent = `📸 ${P.framedLandmark.name} (Framed!)`;
        lmBadge.classList.add("visible");
      } else {
        lmBadge.textContent = "📸 Framing Landmark...";
        lmBadge.classList.remove("visible");
      }
    }

    if (waymoBadge) {
      waymoBadge.classList.toggle("visible", P.hasWaymo);
    }
  }

  /* ---------- Pointer & Controls ---------- */
  function pointer(type, e) {
    if (!P.active) return;
    if (type === "down") {
      P.drag = {
        x: e.clientX,
        y: e.clientY,
        yaw: P.camYaw,
        pitch: P.camPitch,
        btn: e.button,
      };
    } else if (type === "move") {
      if (!P.drag) return;
      const dx = e.clientX - P.drag.x;
      const dy = e.clientY - P.drag.y;

      if (P.drag.btn === 2 || e.buttons === 2 || e.shiftKey) {
        // Orbit / Pedestal
        P.camYaw = P.drag.yaw + dx * 0.005;
        P.camPitch = Math.max(-1.45, Math.min(1.45, P.drag.pitch - dy * 0.005));
      } else {
        // Look / Aim
        P.camYaw = P.drag.yaw + dx * 0.004;
        P.camPitch = Math.max(-1.45, Math.min(1.45, P.drag.pitch - dy * 0.004));
      }
    } else if (type === "up") {
      P.drag = null;
    } else if (type === "wheel") {
      const zoomDelta = e.deltaY > 0 ? 1 : -1;
      P.focalLength = Math.max(24, Math.min(120, P.focalLength - zoomDelta * 4));
      const slider = document.querySelector("#pm-focal-slider");
      const label = document.querySelector("#pm-focal-val");
      if (slider) slider.value = P.focalLength;
      if (label) label.textContent = P.focalLength + "mm";
      updateCameraFov();
    }
  }

  function key(e) {
    if (e.code === "KeyP") {
      toggle();
      return true;
    }
    if (!P.active) return false;
    if (e.code === "Escape") {
      exit();
      return true;
    }
    if (e.code === "Space" || e.code === "Enter") {
      snap();
      return true;
    }
    return false;
  }

  /* ---------- Postcard Snapshot Compositor ---------- */
  function snap() {
    const G = WG.game;
    if (!G || !G.renderer) return;

    // 1. Shutter sound
    G.A.sfx("shutter");

    // Flash animation on viewfinder
    const flash = document.querySelector(".pm-flash");
    if (flash) {
      flash.classList.add("trigger");
      setTimeout(() => flash.classList.remove("trigger"), 300);
    }

    // Force high quality render to canvas
    G.renderer.render(G.scene, G.camera);
    const srcCanvas = G.renderer.domElement;

    const outW = 1200;
    const outH = 800;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");

    // Postcard border margin
    const margin = 36;
    const bottomH = 92;
    const photoW = outW - margin * 2;
    const photoH = outH - margin * 2 - bottomH;

    // 2. Vintage Cream Postcard Base
    ctx.fillStyle = "#faf7ee";
    ctx.fillRect(0, 0, outW, outH);

    // Subtle aged paper texture / border
    ctx.strokeStyle = "#ded5c2";
    ctx.lineWidth = 2;
    ctx.strokeRect(margin * 0.45, margin * 0.45, outW - margin * 0.9, outH - margin * 0.9);

    // 3. Draw 3D Render
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin, margin, photoW, photoH);
    ctx.clip();
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, margin, margin, photoW, photoH);

    // Apply Filter Shaders / Overlays
    applyCanvasFilter(ctx, margin, margin, photoW, photoH, P.filter);
    ctx.restore();

    // Photo border
    ctx.strokeStyle = "#4a4237";
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin, photoW, photoH);

    // 4. Vintage Postage Stamp in Top Right of Postcard
    drawPostageStamp(ctx, outW - margin - 110, margin + 14, 96, 120);

    // 5. Postal Cancellation Ring & Wavy Postmark
    drawPostmark(ctx, outW - margin - 160, margin + 80);

    // 6. Landmark & City Caption
    const landmarkName = P.framedLandmark ? P.framedLandmark.name : "San Francisco Bay Panorama";
    ctx.fillStyle = "#332c24";
    ctx.font = "italic 700 28px 'M PLUS Rounded 1c', serif, Georgia";
    ctx.textBaseline = "middle";
    ctx.fillText(`San Francisco, California · ${landmarkName}`, margin + 8, outH - bottomH * 0.58);

    ctx.font = "500 15px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillStyle = "#8a7e6e";
    const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    ctx.fillText(`PACIFIC POSTAL SERVICE · ${dateStr} · 35mm LENS`, margin + 10, outH - bottomH * 0.28);

    // 7. "Waymo Spotted!" Golden Seal Stamp
    if (P.hasWaymo) {
      drawWaymoSpottedSeal(ctx, margin + photoW - 130, margin + photoH - 130);
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const photoId = "photo_" + Date.now();

    const photoRecord = {
      id: photoId,
      landmarkId: P.framedLandmark ? P.framedLandmark.id : "panorama",
      landmarkName: landmarkName,
      capturedAt: new Date().toISOString().slice(0, 10),
      hasWaymo: P.hasWaymo,
      filter: FILTERS.find((f) => f.id === P.filter).name,
      dataUrl,
    };

    if (WG.sundayAlbum) {
      WG.sundayAlbum.savePhoto(photoRecord);
    }

    // Award Map Seal if first time photographing this landmark!
    const isNew = P.framedLandmark && WG.sunday && !WG.sunday.state.postcards[P.framedLandmark.id];
    if (WG.sunday) {
      WG.sunday.recordPostcard(photoRecord, isNew);
    }

    if (isNew) {
      G.A.sfx("sparkle");
      showSnapToast(`📸 Postcard Saved! +1 Map Seal for Framing ${landmarkName}!`);
    } else {
      G.A.sfx("chime");
      showSnapToast(`📸 Postcard Saved to Scrapbook!`);
    }
  }

  function applyCanvasFilter(ctx, x, y, w, h, filter) {
    if (filter === "golden") {
      ctx.fillStyle = "rgba(255, 175, 45, 0.24)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 120, 20, 0.12)";
      ctx.fillRect(x, y, w, h);
    } else if (filter === "fog") {
      ctx.fillStyle = "rgba(230, 238, 245, 0.32)";
      ctx.fillRect(x, y, w, h);
      const rad = ctx.createRadialGradient(x + w / 2, y + h / 2, w * 0.25, x + w / 2, y + h / 2, w * 0.65);
      rad.addColorStop(0, "rgba(255, 255, 255, 0)");
      rad.addColorStop(1, "rgba(220, 230, 238, 0.5)");
      ctx.fillStyle = rad;
      ctx.fillRect(x, y, w, h);
    } else if (filter === "kodachrome") {
      ctx.fillStyle = "rgba(255, 40, 10, 0.08)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255, 230, 80, 0.1)";
      ctx.fillRect(x, y, w, h);
    } else if (filter === "noir") {
      // Fast desaturation
      const idata = ctx.getImageData(x, y, w, h);
      const d = idata.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrast = (lum - 128) * 1.35 + 128;
        d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, contrast));
      }
      ctx.putImageData(idata, x, y);
    }
  }

  function drawPostageStamp(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Perforated stamp edge
    ctx.fillStyle = "#fffbf0";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#8b4513";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    // Inner illustration
    ctx.fillStyle = "#2a8fd9";
    ctx.fillRect(8, 8, w - 16, h - 34);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AIR MAIL", w / 2, 24);

    ctx.font = "bold 20px 'M PLUS Rounded 1c', sans-serif";
    ctx.fillText("SF 45¢", w / 2, 54);

    ctx.fillStyle = "#4a3c28";
    ctx.font = "800 11px sans-serif";
    ctx.fillText("SAN FRANCISCO", w / 2, h - 12);

    ctx.restore();
  }

  function drawPostmark(ctx, cx, cy) {
    ctx.save();
    ctx.strokeStyle = "rgba(35, 30, 25, 0.65)";
    ctx.lineWidth = 1.8;

    // Circular postmark
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 33, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "bold 9px sans-serif";
    ctx.fillStyle = "rgba(35, 30, 25, 0.65)";
    ctx.textAlign = "center";
    ctx.fillText("SAN FRANCISCO", cx, cy - 14);
    ctx.fillText("CALIF.", cx, cy + 18);

    // Wavy cancellation lines
    ctx.beginPath();
    for (let r = -24; r <= 24; r += 12) {
      ctx.moveTo(cx + 44, cy + r);
      ctx.bezierCurveTo(cx + 70, cy + r - 8, cx + 90, cy + r + 8, cx + 120, cy + r);
    }
    ctx.stroke();

    ctx.restore();
  }

  function drawWaymoSpottedSeal(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Gold foil star seal
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(56, 56, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#fff8e1";
    ctx.font = "bold 13px 'M PLUS Rounded 1c', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("★ WAYMO ★", 56, 42);
    ctx.fillText("SPOTTED!", 56, 62);
    ctx.font = "9px sans-serif";
    ctx.fillText("OFFICIAL RIDE", 56, 78);

    ctx.restore();
  }

  function showSnapToast(msg) {
    let toast = document.getElementById("sunday-snap-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sunday-snap-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3200);
  }

  const PhotoMode = {
    get active() {
      return P.active;
    },
    enter,
    exit,
    toggle,
    update,
    camera,
    pointer,
    key,
    snap,
    FILTERS,
  };

  WG.sundayPhoto = PhotoMode;
})();
