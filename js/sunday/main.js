/* Waymo Care · Sunday Drive · the mode itself. WG.sunday is what js/game.js calls while the game is in the sunday
   (bird's-eye city) or sundayCare (a swoop down to a car) state: enter and exit, update each frame, the camera, the
   pointer and the keys. It keeps the save (localStorage wc.sunday.v1), the Map Seals and what's unlocked, the fleet's
   size, the Inspector card, the cloud-parting ceremony, each district's light, the music's stems, the menu and the
   toasts, and hands out the swoops (js/sunday/swoop.js), Photo Mode (photo.js) and the scrapbook (album.js).
   URL flags: ?mode=sunday starts here (with &reset=1 to wipe the save). */
(function () {
  "use strict";
  const WG = window.WG,
    T = THREE,
    W = WG.world,
    I = WG.isle,
    D = WG.sundayData,
    AD = WG.adoptData,
    Sim = WG.adoptSim,
    City = WG.sundayCity,
    Clouds = WG.sundayClouds,
    Sw = WG.sundaySwoop,
    Photo = WG.sundayPhoto,
    Album = WG.sundayAlbum,
    Traffic = WG.Traffic;
  const K = W.SCALE;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const Q = new URLSearchParams(location.search);
  const KEY = "wc.sunday.v1";
  const g = () => WG.game;
  const SD = { S: null, active: false, t: 0, sel: null };

  /* ---------- the save ---------- */
  function fresh() {
    return {
      version: 1,
      freeDrive: false,
      mapSeals: 0,
      totalCared: 0,
      faresDelivered: 0,
      unlockedDistricts: [D.DISTRICTS[0].id],
      postcards: {},
      thankYouNotes: [],
      sealLog: { care: 0, fare: 0 },
      hinted: {},
      settings: { tilt: true },
      seenIntro: false,
    };
  }
  function load() {
    if (SD.S) return SD.S;
    let S = null;
    try {
      S = JSON.parse(localStorage.getItem(KEY) || "null");
    } catch (e) {}
    const F = fresh();
    if (!S || S.version !== 1) S = F;
    for (const k in F) if (S[k] === undefined) S[k] = F[k];
    S.sealLog = Object.assign({ care: 0, fare: 0 }, S.sealLog);
    S.settings = Object.assign({}, F.settings, S.settings);
    S.unlockedDistricts = S.unlockedDistricts.filter((id) => D.BY_ID[id]);
    if (!S.unlockedDistricts.includes(D.DISTRICTS[0].id)) S.unlockedDistricts.unshift(D.DISTRICTS[0].id);
    return (SD.S = S);
  }
  function save() {
    if (!SD.S) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(SD.S));
    } catch (e) {}
  }
  if (Q.get("mode") === "sunday" && Q.has("reset")) {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
    Album.wipe();
  }

  /* ---------- what's open ---------- */
  const openSet = () => new Set(SD.S.freeDrive ? D.DISTRICTS.map((d) => d.id) : SD.S.unlockedDistricts);
  // a locked district can be opened once one of its neighbourhoods has a road to an open one
  function reachable(id) {
    const open = openSet(),
      d = D.BY_ID[id];
    for (const n of d.all) for (const [m] of Sim.G.adj[n]) if (open.has(City.hoodDist[m])) return true;
    return false;
  }
  function info(id) {
    const d = D.BY_ID[id],
      locked = !openSet().has(id),
      reach = locked && reachable(id);
    return { cost: d.cost, locked, reachable: reach, can: reach && SD.S.mapSeals >= d.cost };
  }
  const markOpen = (m) => openSet().has(City.markDistrict(m));
  function applyOpen(animate) {
    const open = openSet();
    City.setOpen(open, animate);
    if (!animate) Clouds.set(open);
    City.refreshLabels(info);
    WG.audio.setSundayStems(open);
    fleetSize();
  }
  // the fleet grows with the city: three cars, and one more for every district opened
  function fleetSize(at) {
    const open = openSet(),
      want = Math.min(D.FLEET.max, D.FLEET.base + D.FLEET.perDistrict * (open.size - 1)),
      hubs = D.DISTRICTS.filter((d) => open.has(d.id)).map((d) => d.hub);
    while (City.cars.length < want) City.spawn(at || hubs[City.cars.length % hubs.length]);
  }

  /* ---------- in and out ---------- */
  SD.enter = function () {
    const G = g(),
      S = load();
    if (!SD.booted) {
      City.init(G.scene);
      Clouds.init(G.scene);
      Photo.init();
      City.on = onCity;
      City.onDistrictTap = districtTap;
      Photo.onCapture = captured;
      Photo.markOpen = markOpen;
      bindUI();
      SD.booted = true;
    }
    Traffic.reset();
    Sw.fleetVisible(false);
    G.mii.root.visible = false;
    G.setState("sunday");
    City.show(true);
    Clouds.show(true);
    applyOpen(false);
    $("#sunday").hidden = false;
    SD.active = true;
    SD.sel = null;
    lookNow = "";
    lookAt = { id: null, t: 0 };
    look(true);
    G.A.music("sunday", { restart: true });
    hud();
    if (!S.seenIntro) setTimeout(intro, 500);
    save();
  };
  SD.exit = function () {
    const G = g();
    if (Photo.active) Photo.exit();
    Sw.reset();
    Album.close();
    closeModal();
    select(null);
    cer = null;
    save();
    $("#sunday").hidden = true;
    City.show(false);
    Clouds.show(false);
    City.cam.ride = City.cam.follow = null;
    // put the arcade back as it was: its fleet, the crew member at the patch's start
    G.moveDistrict(W.zoneKey || "lombard");
    Traffic.n = W.fleet;
    Traffic.reset();
    Sw.fleetVisible(true);
    G.mii.root.visible = true;
    G.P.pos.set(W.start.x, W.groundY(W.start.x, W.start.z), W.start.z);
    G.P.path = [];
    G.CAM.yaw = W.start.yaw;
    G.snap();
    SD.active = false;
    G.VOX.clear();
    G.toTitle();
  };
  SD.isActive = () => SD.active;

  /* ---------- each frame ---------- */
  let timers = { hud: 0, save: 0, look: 0 };
  SD.update = function (dt) {
    if (!SD.active) return;
    SD.t += dt;
    City.update(dt, SD.t, {
      autoAfter: D.AUTO_CARE_SECS,
      needEvery: Math.max(22, 50 - City.cars.length * 3),
    });
    Clouds.update(dt, SD.t);
    Sw.update(dt);
    Photo.update(dt);
    if (cer) ceremony(dt);
    for (const k in timers) timers[k] += dt;
    if (timers.look > 0.4) {
      timers.look = 0;
      look();
    }
    if (timers.hud > 0.25) {
      timers.hud = 0;
      hud();
      card();
    }
    if (timers.save > 10) {
      timers.save = 0;
      save();
    }
  };
  SD.after = function () {
    if (!SD.active) return;
    City.place(g().camera);
    placeCard();
  };

  /* ---------- each district's light, following the camera (the street patch's own during a swoop) ---------- */
  let lookNow = "",
    lookAt = { id: null, t: 0 };
  function look(now) {
    if (Sw.active) return;
    const c = City.cam;
    let x = c.x,
      z = c.z;
    if (c.ride) {
      const car = City.find(c.ride);
      if (car) {
        x = car.x;
        z = car.z;
      }
    } else if (Photo.active) {
      const p = City.ground(innerWidth / 2, innerHeight / 2, g().camera);
      if (p) {
        x = p.x;
        z = p.z;
      }
    }
    const id = City.districtAt(x, z);
    if (id !== lookAt.id) lookAt = { id, t: SD.t };
    // a short dwell, so a quick pan across doesn't flicker the light
    if (!now && SD.t - lookAt.t < 1.2) return;
    const L = D.BY_ID[id].look.map;
    if (L !== lookNow) {
      lookNow = L;
      W.setLook(L);
    }
  }

  /* ---------- the camera ---------- */
  SD.camera = function (dt, pos, look) {
    if (Sw.active) return Sw.camera(dt, pos, look);
    if (Photo.active) return Photo.camera(dt, pos, look);
    if (cer && cer.orbit) return cerCamera(dt, pos, look);
    const K2 = g().keys,
      busy = modalOpen || Album.open || cer;
    if (!busy) {
      let dx = 0,
        dy = 0;
      if (K2.has("KeyW") || K2.has("ArrowUp")) dy += 1;
      if (K2.has("KeyS") || K2.has("ArrowDown")) dy -= 1;
      if (K2.has("KeyA") || K2.has("ArrowLeft")) dx += 1;
      if (K2.has("KeyD") || K2.has("ArrowRight")) dx -= 1;
      if (dx || dy) City.pan(dx * 700 * dt, dy * 700 * dt, g().camera);
      const r = (K2.has("KeyQ") ? 1 : 0) - (K2.has("KeyE") ? 1 : 0);
      if (r) City.rotate(r * 1.4 * dt);
      if (K2.has("Equal") || K2.has("NumpadAdd")) City.zoom(1 - dt);
      if (K2.has("Minus") || K2.has("NumpadSubtract")) City.zoom(1 + dt);
    }
    return City.camera(dt, pos, look);
  };

  /* ---------- the pointer: drag to pan, right-drag to turn, pinch and wheel to zoom, tap to pick, double-tap to frame ---------- */
  const ptrs = new Map();
  let drag = null,
    pinch = null,
    lastTap = { t: 0, x: 0, y: 0 };
  SD.pointer = function (type, e) {
    if (Photo.active) return Photo.pointer(type, e);
    if (Sw.active) return;
    const cam = g().camera;
    if (cer) {
      if (type === "down" && cer.orbit) skipCeremony();
      return;
    }
    if (type === "wheel") {
      City.cam.ride = null;
      City.zoom(e.deltaY > 0 ? 1.1 : 0.9);
      return;
    }
    if (type === "down") {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
        drag = null;
      } else drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, turn: e.button === 2 || e.button === 1, moved: false };
      return;
    }
    if (type === "move") {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && ptrs.size >= 2) {
        const [a, b] = Array.from(ptrs.values()),
          d = Math.hypot(a[0] - b[0], a[1] - b[1]),
          ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        City.zoom(pinch.d / Math.max(10, d));
        City.rotate(-(ang - pinch.a));
        pinch.d = d;
        pinch.a = ang;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) {
        if (drag.turn) City.rotate(-dx * 0.006);
        else City.pan(dx, dy, cam);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.moved && !drag.turn && e.type === "pointerup") {
      const now = performance.now(),
        dbl = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
      lastTap = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY };
      tap(e.clientX, e.clientY, dbl);
    }
    drag = null;
  };
  function tap(x, y, dbl) {
    const hit = City.pick(x, y, g().camera);
    if (hit && hit.car) {
      if (dbl) {
        City.cam.follow = hit.car.id;
        City.glide(hit.car.x, hit.car.z, Math.min(City.cam.h, 300 * K), 1.2);
        City.cam.follow = hit.car.id;
      }
      select(hit.car.id);
      return;
    }
    if (hit && hit.district) return districtTap(hit.district);
    if (dbl) {
      // frame the neighbourhood under the tap
      const p = City.ground(x, y, g().camera);
      if (p) City.glide(p.x, p.z, Math.max(City.H0, City.cam.h * 0.6), 1.2);
      return;
    }
    if (SD.sel) select(null);
  }

  /* ---------- keys ---------- */
  SD.key = function (e) {
    const onBtn = document.activeElement && document.activeElement.closest && document.activeElement.closest("button");
    if (Photo.active) return Photo.key(e);
    if (e.code === "Escape") {
      if (e.repeat) return true;
      if (closeModal() || Album.close()) return true;
      if (cer) {
        skipCeremony();
        return true;
      }
      if (Sw.active) {
        Sw.abort();
        return true;
      }
      if (City.cam.ride) {
        City.cam.ride = null;
        return true;
      }
      if (SD.sel) {
        select(null);
        return true;
      }
      menu();
      return true;
    }
    if (e.repeat && !/^(Arrow|Key[WASDQE]|Equal|Minus)/.test(e.code)) return true;
    if (modalOpen) {
      if ((e.code === "Enter" || e.code === "Space") && !onBtn) {
        const b = $("#sd-modal .panel-f .btn.primary:not([disabled])");
        if (b) b.click();
        return true;
      }
      if (/^Arrow(Up|Down|Left|Right)$/.test(e.code)) {
        const bs = Array.from(document.querySelectorAll("#sd-modal button:not([disabled])"));
        if (bs.length) {
          const i = bs.indexOf(document.activeElement),
            d = /Down|Right/.test(e.code) ? 1 : -1;
          bs[(i + d + bs.length) % bs.length].focus();
        }
        return true;
      }
      return false;
    }
    if (Album.open || Sw.active || cer) return /^(Arrow|Key[WASDQE])/.test(e.code);
    if (e.code === "KeyP") {
      photo();
      return true;
    }
    if (e.code === "KeyB") {
      book();
      return true;
    }
    if (SD.sel && !onBtn) {
      const car = City.find(SD.sel);
      if (car && e.code === "KeyC" && car.need) return takeCare(car), true;
      if (car && e.code === "KeyR") return rideAlong(car), true;
    }
    return /^(Arrow|Key[WASDQE]|Equal|Minus)/.test(e.code);
  };

  /* ---------- the Inspector card ---------- */
  function select(id) {
    SD.sel = id;
    const el = $("#sd-card");
    if (!id) {
      el.hidden = true;
      if (City.cam.follow && !City.cam.ride) City.cam.follow = null;
      return;
    }
    City.cam.follow = id;
    g().A.sfx("select");
    el.hidden = false;
    el.dataset.key = "";
    card();
  }
  function riderLine(r) {
    const R = AD.RIDERS[r.key];
    return R.icon + " " + R.name.replace(/^The /, "") + ": " + r.from + " → " + r.to;
  }
  function doing(car) {
    const r = car.rider;
    if (car.mode === "care") return "Waiting for you down on the street";
    if (car.mode === "servicing") return "Freshening up at the " + D.BY_ID[car.depot].name + " depot";
    if (car.mode === "depot") return "Heading to the " + D.BY_ID[car.depot].name + " depot";
    if (r && r.phase === "pickup") return "Picking up at " + r.from;
    if (r && r.phase === "ride") return "Cruising to " + r.to;
    return "Looking for a fare in " + car.at;
  }
  function card() {
    const el = $("#sd-card");
    if (!SD.sel || el.hidden) return;
    const car = City.find(SD.sel);
    if (!car) return select(null);
    const n = car.need,
      key = [car.mode, n && n.kind, n && n.auto, car.rider && car.rider.key + car.rider.phase, City.cam.ride === car.id].join("|");
    el.querySelector(".sd-c-name").textContent = car.name + " · " + doing(car);
    el.querySelector(".sd-c-ring").style.background = car.ring;
    el.querySelector(".sd-c-plate").textContent = car.plate + " · " + car.fares + " fare" + (car.fares === 1 ? "" : "s") + " today";
    if (el.dataset.key === key) return;
    el.dataset.key = key;
    el.querySelector(".sd-c-rider").textContent = car.rider ? riderLine(car.rider) : "No passenger right now";
    const st = el.querySelector(".sd-c-status");
    st.querySelector("span").textContent = n
      ? n.why + (n.auto ? (car.mode === "servicing" ? " · sorting itself out now" : " · off to a depot to sort itself out") : "")
      : "Feeling great, thanks for asking!";
    st.classList.toggle("need", !!n);
    const ic = el.querySelector("canvas"),
      x = ic.getContext("2d");
    x.clearRect(0, 0, 64, 64);
    ic.hidden = !n;
    if (n) WG.drawIcon(x, n.kind, 32, 34, 0.9);
    const care = el.querySelector('[data-a="care"]'),
      auto = el.querySelector('[data-a="auto"]'),
      ride = el.querySelector('[data-a="ride"]');
    care.hidden = !n || car.mode === "servicing";
    care.title = n ? D.NEEDS[n.kind].act + " (C)" : "";
    auto.hidden = !n || n.auto;
    ride.textContent = City.cam.ride === car.id ? "Fly back up" : "Ride Along";
  }
  // the card floats beside its car on a wide screen, docks at the bottom on a narrow one
  function placeCard() {
    const el = $("#sd-card");
    if (el.hidden || !SD.sel) return;
    const car = City.find(SD.sel);
    if (!car || innerWidth < 760 || City.cam.ride === car.id) {
      el.classList.add("dock");
      el.style.transform = "";
      return;
    }
    el.classList.remove("dock");
    const s = City.screenPos(car, g().camera, 3),
      w = el.offsetWidth,
      h = el.offsetHeight;
    const x = clamp(s.x + 60, 12, innerWidth - w - 12),
      y = clamp(s.y - h / 2, 80, innerHeight - h - 70);
    el.style.transform = "translate(" + x.toFixed(0) + "px," + y.toFixed(0) + "px)";
  }

  /* ---------- care, by hand or by itself ---------- */
  function takeCare(car) {
    if (!car || !car.need || Sw.active || cer) return;
    const d = D.BY_ID[car.need.district] || D.BY_ID[City.hoodDist[car.to || car.at]],
      kind = car.need.kind,
      prevMode = car.mode;
    car.mode = "care";
    select(null);
    City.cam.ride = null;
    City.cam.follow = car.id;
    Sw.start({
      car,
      kind,
      zone: d.zone,
      look: d.look.street,
      word: () => pick(["Lovely!", "Sparkling!", "All set!", D.NEEDS[kind].word]),
      onUp: () => {
        lookNow = "";
        look(true);
      },
      onEnd: (res) => {
        if (res) {
          const S = SD.S,
            rider = (car.rider && car.rider.key) || pick(AD.RIDER_KEYS),
            notes = D.NOTES[rider] || {},
            text = notes[kind] || notes["*"] || "Thank you!";
          City.clearNeed(car);
          car.mode = prevMode === "depot" || prevMode === "servicing" ? "fare" : prevMode === "care" ? "fare" : prevMode;
          if (car.mode === "fare" && !car.rider && !car.from) car.wait = 0.5;
          car.hop = 1;
          S.totalCared++;
          S.thankYouNotes.push({ rider, job: kind, text, at: Date.now() });
          if (S.thankYouNotes.length > 300) S.thankYouNotes.shift();
          setTimeout(() => note(rider, text), 1200);
          seals();
        } else {
          car.mode = prevMode === "care" ? "fare" : prevMode;
          toast("🙂", "No worries. " + car.name + " will carry on, and sort itself out if you leave it.");
        }
        hud();
        save();
      },
    });
  }
  function autoCare(car) {
    if (!car || !car.need) return;
    City.autoCare(car);
    g().A.sfx("select");
    toast("↪️", car.name + " will pop into a depot" + (car.rider && car.rider.phase === "ride" ? " after this ride" : "") + " and sort itself out.");
    card();
  }
  function rideAlong(car) {
    if (City.cam.ride === car.id) {
      City.cam.ride = null;
      g().A.sfx("back");
    } else {
      City.cam.ride = car.id;
      City.cam.follow = car.id;
      g().A.sfx("whoosh");
      toast("🎥", "Riding along with " + car.name + ". Esc, or drag the map, to fly back up.");
    }
    card();
  }

  /* ---------- what the city says ---------- */
  function onCity(ev) {
    const G = g(),
      S = SD.S,
      car = ev.car;
    const onScreen = () => {
      const s = City.screenPos(car, G.camera, 1);
      return s.vis && s.x > 0 && s.x < innerWidth && s.y > 0 && s.y < innerHeight;
    };
    switch (ev.type) {
      case "fare": {
        S.faresDelivered++;
        const R = AD.RIDERS[ev.rider.key];
        if (onScreen() && !Photo.active) {
          G.floater(new T.Vector3(car.x, car.y + 3.6 * City.MS, car.z), R.name.replace(/^The /, "") + " delivered!", "+Fare · " + ev.hood, 1);
          if (City.cam.h < 900 * K || City.cam.follow === car.id) G.A.sfx("chime", 0);
        }
        seals();
        break;
      }
      case "board":
        if (City.cam.follow === car.id && Math.random() < 0.5) G.VOX.say("rider.pickup." + ev.rider.key.toLowerCase());
        break;
      case "need":
        if (onScreen() && !Photo.active) G.A.sfx("bubble");
        if (!S.hinted.need) {
          S.hinted.need = 1;
          toast(
            "🫧",
            car.name + " could use a hand (" + D.NEEDS[car.need.kind].label.toLowerCase() + "). Tap it if you'd like to help, or let it sort itself out.",
            "",
            8000,
          );
        }
        break;
      case "autoCared":
        toast("✨", car.name + " freshened up at the " + D.BY_ID[ev.district].name + " depot.", "", 4000);
        break;
    }
  }

  /* ---------- Map Seals ---------- */
  function seals() {
    const S = SD.S,
      care = Math.floor(S.totalCared / D.SEALS.perCares) - S.sealLog.care,
      fare = Math.floor(S.faresDelivered / D.SEALS.perFares) - S.sealLog.fare;
    if (care > 0) {
      S.sealLog.care += care;
      grant(care, "for " + D.SEALS.perCares + " cars cared for by hand");
    }
    if (fare > 0) {
      S.sealLog.fare += fare;
      grant(fare, "for " + D.SEALS.perFares + " fares across town");
    }
  }
  function grant(n, why) {
    const S = SD.S;
    S.mapSeals += n;
    g().A.sfx("ding", 79);
    toast("✦", "+" + n + " Map Seal" + (n > 1 ? "s" : "") + " " + why + ".", "good");
    pulse("#sd-seals");
    City.refreshLabels(info);
    // a nudge, once per district, when there are enough seals to open one
    if (!S.freeDrive)
      for (const d of D.DISTRICTS) {
        const i = info(d.id);
        if (i.can && !S.hinted["can_" + d.id]) {
          S.hinted["can_" + d.id] = 1;
          setTimeout(() => toast("☁️", "You have enough Map Seals to part the clouds over " + d.name + ". Tap its label on the map!", "good", 7000), 1600);
          break;
        }
      }
    hud();
    save();
  }

  /* ---------- districts: fly to an open one, offer to unlock a locked one ---------- */
  function districtTap(id) {
    const d = D.BY_ID[id],
      i = info(id);
    if (cer || Sw.active) return;
    g().A.sfx("select");
    if (!i.locked) {
      City.glide(d.cx, d.cz, 640 * K, 1.6);
      toast(d.icon, d.name + ": " + d.quirk, "", 4500);
      return;
    }
    const S = SD.S,
      body =
        "<p class='lead'>" +
        esc(d.quirk) +
        "</p><ul class='sd-unlock'><li>🎵 Adds <b>" +
        esc(d.stem) +
        "</b> to the music</li><li>🚕 A new car joins the fleet</li><li>🛣️ New roads and rides across town</li></ul>" +
        (i.reachable
          ? "<p class='sd-cost'>Needs <b>" + d.cost + " ✦ Map Seals</b>. You have <b>" + S.mapSeals + "</b>.</p>" +
            (i.can ? "" : "<p class='sub small'>Seals come from caring for cars by hand (1 per " + D.SEALS.perCares + "), new landmark postcards (1 each) and fares (1 per " + D.SEALS.perFares + ").</p>")
          : "<p class='sd-cost'>Open a neighbouring district to connect its roads first.</p>");
    modal(d.name, d.sub, body, [
      ["Not yet", "", () => closeModal()],
      [i.can ? "Part the clouds ✦" + d.cost : "Part the clouds", "primary", i.can ? () => unlock(id) : null],
    ]);
  }
  function unlock(id) {
    const S = SD.S,
      d = D.BY_ID[id],
      i = info(id);
    if (!i.can) return;
    closeModal();
    select(null);
    S.mapSeals -= d.cost;
    S.unlockedDistricts.push(id);
    save();
    hud();
    startCeremony(id);
  }

  /* ---------- the cloud-parting ceremony ---------- */
  let cer = null;
  function startCeremony(id) {
    const d = D.BY_ID[id];
    City.cam.ride = null;
    City.glide(d.cx, d.cz, 900 * K, 1.8, City.cam.yaw);
    // the district's landmark to circle: the first of its street patch's (js/world.js ZONES), or the nearest one
    const zm = (W.ZONES[d.zone] && W.ZONES[d.zone].marks) || [];
    let m = zm.map((n) => I.MARKS.find((q) => q.name === n)).find((q) => q && City.markDistrict(q) === id);
    if (!m) {
      let bd = Infinity;
      for (const q of I.MARKS) {
        const dd = (q.x * K - d.cx) ** 2 + (q.z * K - d.cz) ** 2;
        if (dd < bd && q.h > 10) {
          bd = dd;
          m = q;
        }
      }
    }
    cer = { id, t: 0, step: 0, mark: m, orbit: false };
    g().A.sfx("whoosh");
    $("#sunday").classList.add("cer");
  }
  function ceremony(dt) {
    const c = cer,
      d = D.BY_ID[c.id];
    c.t += dt;
    if (c.step === 0 && c.t > 1.9) {
      c.step = 1;
      Clouds.part(c.id);
      g().A.sfx("wind");
      setTimeout(() => g().A.sfx("chime", 2), 500);
    }
    if (c.step === 1 && c.t > 2.6) {
      c.step = 2;
      // new roads light up, new cars, the next instrument
      City.setOpen(openSet(), true);
      City.refreshLabels(info);
      WG.audio.setSundayStems(openSet());
      fleetSize(d.hub);
      g().big(d.name + " is open!", "go");
      g().A.sfx("medal");
      if (c.mark) {
        c.orbit = true;
        c.a0 = City.cam.yaw;
        c.ot = 0;
      }
    }
    if (c.orbit) c.ot += dt;
    if (c.step === 2 && c.t > (c.mark ? 9 : 4)) endCeremony();
  }
  // circling the district's landmark, then easing back up to the map
  function cerCamera(dt, pos, look) {
    const c = cer,
      m = c.mark,
      x = m.x * K,
      y = m.y * K,
      z = m.z * K,
      h = Math.max(20, m.h) * K,
      r = clamp(h * 2.2 + 80 * K, 160 * K, 700 * K),
      a = c.a0 + c.ot * 0.32;
    look.set(x, y + h * 0.45, z);
    pos.set(x + Math.sin(a) * r, y + h * 0.7 + r * 0.32, z + Math.cos(a) * r);
    return c.ot < 0.5 ? 1.5 : 2.2;
  }
  function endCeremony() {
    const d = D.BY_ID[cer.id];
    if (cer.step < 2) {
      Clouds.part(cer.id);
      City.setOpen(openSet(), true);
      City.refreshLabels(info);
      WG.audio.setSundayStems(openSet());
      fleetSize(d.hub);
    }
    cer = null;
    $("#sunday").classList.remove("cer");
    City.cam.x = d.cx;
    City.cam.z = d.cz;
    City.cam.h = 700 * K;
    toast(d.icon, d.name + " is open: " + d.quirk + " 🎵 " + d.stem + " joins the band.", "good", 7000);
    hud();
    save();
  }
  function skipCeremony() {
    if (cer && cer.step >= 1) endCeremony();
  }

  /* ---------- Photo Mode and the scrapbook ---------- */
  function photo() {
    if (Sw.active || cer || modalOpen) return;
    Album.close();
    select(null);
    Photo.enter();
    if (!SD.S.hinted.photo) {
      SD.S.hinted.photo = 1;
      toast("📷", "Frame a landmark near the middle for its postcard. Catch a Waymo in it for the golden stamp!", "", 7000);
    }
  }
  Photo.onExit = () => hud();
  function captured(cv, d, opt) {
    const S = SD.S,
      id = "photo_" + Date.now().toString(36),
      today = new Date().toISOString().slice(0, 10),
      m = d.framed ? d.mark : null;
    const rec = {
      id,
      at: Date.now(),
      date: today,
      mark: m ? m.id : null,
      markName: m ? m.name : null,
      filter: opt.filter,
      border: opt.border,
      hasWaymo: !!d.waymo,
      thumb: Photo.thumb(cv),
      blob: null,
    };
    cv.toBlob((blob) => {
      rec.blob = blob;
      Album.put(rec).then((ok) => {
        if (!ok) toast("⚠️", "The photo couldn't be saved in this browser.", "bad");
      });
    }, "image/png");
    if (m) {
      const key = Album.markKey(m),
        old = S.postcards[key];
      if (!old) {
        S.postcards[key] = { capturedAt: today, hasWaymo: !!d.waymo, filter: opt.filter, photoId: id };
        toast("📮", "New postcard: " + m.name + "!" + (d.waymo ? " ★ Waymo Spotted!" : ""), "good", 5000);
        grant(D.SEALS.perPostcard, "for a new landmark postcard");
      } else if (d.waymo && !old.hasWaymo) {
        S.postcards[key] = { capturedAt: today, hasWaymo: true, filter: opt.filter, photoId: id };
        toast("★", m.name + " postcard upgraded: Waymo Spotted!", "good", 5000);
      } else {
        if (!old.photoId) old.photoId = id;
        toast("📸", "Another lovely shot of " + m.name + ". It's in your scrapbook.", "", 3500);
      }
    } else toast("📸", "Snapshot saved to your scrapbook" + (d.waymo ? ", with a Waymo in it ★" : "") + ".", "", 3500);
    save();
    hud();
  }
  function book(tab) {
    if (Sw.active || cer) return;
    closeModal();
    select(null);
    g().A.sfx("open");
    Album.show(
      {
        S: SD.S,
        markOpen,
        districtName: (m) => D.BY_ID[City.markDistrict(m)].name,
        onChange: save,
      },
      tab,
    );
  }

  /* ---------- the HUD ---------- */
  function hud() {
    const S = SD.S;
    if (!S) return;
    const open = openSet();
    $("#sd-seal-n").textContent = S.mapSeals;
    $("#sd-seals").title =
      "Next seals: " +
      (S.totalCared % D.SEALS.perCares) + "/" + D.SEALS.perCares + " hands-on cares · " +
      (S.faresDelivered % D.SEALS.perFares) + "/" + D.SEALS.perFares + " fares · or a new postcard";
    $("#sd-seal-next").textContent =
      "cares " + (S.totalCared % D.SEALS.perCares) + "/" + D.SEALS.perCares + " · fares " + (S.faresDelivered % D.SEALS.perFares) + "/" + D.SEALS.perFares;
    $("#sd-dist-n").textContent = open.size + "/" + D.DISTRICTS.length;
    $("#sd-fares-n").textContent = S.faresDelivered.toLocaleString("en-US");
    $("#sd-pc-n").textContent = Object.keys(S.postcards).length + "/" + I.MARKS.length;
    document.body.classList.toggle("sd-tilt", !!S.settings.tilt);
  }
  function pulse(sel) {
    const e = $(sel);
    if (!e) return;
    e.classList.remove("bump");
    void e.offsetWidth;
    e.classList.add("bump");
  }
  function toast(icon, text, cls, ms) {
    const box = $("#sd-toasts"),
      e = document.createElement("div");
    e.className = "sd-toast " + (cls || "");
    e.innerHTML = '<span class="ti"></span><span></span>';
    e.firstChild.textContent = icon;
    e.lastChild.textContent = text;
    box.appendChild(e);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => e.classList.add("out"), ms || 3800);
    setTimeout(() => e.remove(), (ms || 3800) + 600);
  }
  // a rider's thank-you note: a little card that drifts up for a while
  function note(rider, text) {
    const R = AD.RIDERS[rider] || { icon: "💌", name: "A rider" },
      e = document.createElement("div");
    e.className = "sd-notecard";
    e.innerHTML = '<small>💌 Thank-you note</small><p></p><b></b>';
    e.querySelector("p").textContent = "“" + text + "”";
    e.querySelector("b").textContent = "— " + R.icon + " " + R.name;
    $("#sunday").appendChild(e);
    g().A.sfx("ding", 84);
    setTimeout(() => e.classList.add("out"), 5200);
    setTimeout(() => e.remove(), 6000);
  }

  /* ---------- modals: the intro, a district, the menu ---------- */
  let modalOpen = false;
  function modal(title, small, html, buttons, wide) {
    const m = $("#sd-modal");
    m.querySelector(".panel-h span").textContent = title;
    m.querySelector(".panel-h small").textContent = small || "";
    m.querySelector(".panel-b").innerHTML = html;
    const f = m.querySelector(".panel-f");
    f.innerHTML = "";
    for (const [label, cls, fn] of buttons) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (cls || "");
      b.textContent = label;
      if (!fn) b.disabled = true;
      else
        b.addEventListener("click", () => {
          g().A.sfx(cls === "primary" ? "select" : "back");
          fn();
        });
      f.appendChild(b);
    }
    m.classList.toggle("wide", !!wide);
    m.hidden = false;
    modalOpen = true;
    const pb = f.querySelector(".btn.primary:not([disabled])") || f.querySelector(".btn:not([disabled])");
    if (pb) setTimeout(() => pb.focus({ preventScroll: true }), 40);
    return m;
  }
  function closeModal() {
    if (!modalOpen) return false;
    $("#sd-modal").hidden = true;
    modalOpen = false;
    return true;
  }
  function intro() {
    if (!SD.active) return;
    modal(
      "Sunday Drive",
      "San Francisco sandbox",
      "<p class='lead'>Watch robotaxis pick up riders and drive across town.</p>" +
        "<ul class='sd-unlock'>" +
        "<li>🫧 Tap a car with a bubble and choose <b>Take Care</b> to help. Unattended cars visit a depot automatically.</li>" +
        "<li>✦ Earn <b>Map Seals</b> from care, fares and landmark photos. Spend them to unlock districts.</li>" +
        "<li>🎵 Every district you open adds an instrument to the bossa nova.</li>" +
        "<li>📷 Press <kbd>P</kbd> for Photo Mode, <kbd>B</kbd> for your scrapbook.</li>" +
        "</ul><p class='sub small'>Drag to pan · wheel or pinch to zoom · <kbd>Q</kbd>/<kbd>E</kbd> or right-drag to turn · double-click to frame</p>",
      [
        [
          "Let's go ☀️",
          "primary",
          () => {
            SD.S.seenIntro = true;
            save();
            closeModal();
          },
        ],
      ],
      true,
    );
  }
  function menu() {
    const S = SD.S,
      A = g().A,
      sw = (id, label, on) =>
        "<button type='button' class='tgl' id='" + id + "' role='switch' aria-checked='" + !!on + "'><span>" + label + "</span><i aria-hidden='true'></i></button>";
    modal(
      "Sunday Drive",
      "Settings",
      "<div class='pz-set sd-set'>" +
        sw("sd-s-free", "Free Drive: every neighbourhood open", S.freeDrive) +
        sw("sd-s-music", "Music", A.musicOn) +
        sw("sd-s-tilt", "Tilt-shift blur", S.settings.tilt) +
        "</div><p class='sub small'>Free Drive opens the whole city. Turn off to resume unlocking districts; progress and seals are saved.</p>" +
        "<dl class='stats sd-stats'><div><dt>Cars cared for</dt><dd>" + S.totalCared + "</dd></div><div><dt>Fares</dt><dd>" + S.faresDelivered +
        "</dd></div><div><dt>Postcards</dt><dd>" + Object.keys(S.postcards).length + "/" + I.MARKS.length + "</dd></div><div><dt>Notes</dt><dd>" +
        S.thankYouNotes.length + "</dd></div></dl>",
      [
        ["Quit to title", "", () => (closeModal(), SD.exit())],
        ["How it works", "", () => intro()],
        ["Keep driving", "primary", () => closeModal()],
      ],
      true,
    );
    const tg = (id, f) => {
      const b = $("#" + id);
      b.addEventListener("click", () => {
        const on = b.getAttribute("aria-checked") !== "true";
        b.setAttribute("aria-checked", on);
        A.sfx(on ? "select" : "back");
        f(on);
      });
    };
    tg("sd-s-free", (on) => {
      S.freeDrive = on;
      applyOpen(false);
      hud();
      save();
    });
    tg("sd-s-music", (on) => A.setMusicOn(on));
    tg("sd-s-tilt", (on) => {
      S.settings.tilt = on;
      hud();
      save();
    });
  }

  /* ---------- the HUD's buttons ---------- */
  function bindUI() {
    const on = (sel, f) =>
      $(sel).addEventListener("click", (e) => {
        g().A.init();
        f(e);
      });
    on("#sd-menu-btn", () => (g().A.sfx("open"), menu()));
    on("#sd-photo-btn", () => photo());
    on("#sd-book-btn", () => book());
    on("#sd-seals", () => book("postcards"));
    on("#sd-card .x", () => select(null));
    on('#sd-card [data-a="care"]', () => takeCare(City.find(SD.sel)));
    on('#sd-card [data-a="auto"]', () => autoCare(City.find(SD.sel)));
    on('#sd-card [data-a="ride"]', () => rideAlong(City.find(SD.sel)));
    on("#sd-book .sd-book-x", () => (g().A.sfx("back"), Album.close()));
  }

  /* ---------- saving when the tab goes away ---------- */
  addEventListener("visibilitychange", () => document.hidden && SD.active && save());
  addEventListener("pagehide", () => SD.active && save());

  /* ---------- debug hooks ---------- */
  SD.debug = {
    get S() {
      return SD.S;
    },
    seals: (n) => {
      SD.S.mapSeals += n || 10;
      City.refreshLabels(info);
      hud();
    },
    unlock: (id) => {
      SD.S.mapSeals += D.BY_ID[id].cost;
      unlock(id);
    },
    need: (carId, kind) => {
      const car = City.find(carId) || City.cars[0];
      City.giveNeed(car, kind || "dirty");
      return car.id;
    },
    care: (carId) => takeCare(City.find(carId) || City.cars.find((c) => c.need)),
    fares: (n) => {
      SD.S.faresDelivered += n || 10;
      seals();
    },
    ageNeeds: (s) => City.cars.forEach((c) => c.need && (c.need.age += s || D.AUTO_CARE_SECS)),
    select: (id) => select(id),
    district: (id) => districtTap(id),
    photo,
    book,
    City,
  };

  WG.sunday = SD;
  if (Q.get("mode") === "sunday") {
    const go = () => (WG.game && WG.game.G.state === "title" ? SD.enter() : setTimeout(go, 100));
    setTimeout(go, 50);
  }
})();
