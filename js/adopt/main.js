/* Waymo Care · Adopt-a-Waymo · the mode itself. WG.adopt is what js/game.js calls while the game is in the adopt
   (bird's-eye map) or adoptCare (a hands-on job) state: enter and exit, update each frame, the camera, the pointer
   and the keys. It loads and saves the fleet (js/adopt/state.js), runs the simulation (js/adopt/sim.js), keeps the map
   (js/adopt/map.js) and the panels (js/adopt/ui.js) in step with it, turns its events into toasts, voices and music,
   and starts the swoops down to a Care Spot (js/adopt/care.js).
   URL flags: ?mode=adopt starts here, ?fast=10 runs time ten times faster, ?seed=123 seeds a new save, ?reset=1 wipes it. */
(function () {
  "use strict";
  const WG = window.WG,
    W = WG.world,
    D = WG.adoptData,
    Sim = WG.adoptSim,
    St = WG.adoptState,
    M = WG.adoptMap,
    C = WG.adoptCare,
    U = WG.adoptUI,
    Traffic = WG.Traffic;
  const Q = new URLSearchParams(location.search);
  Sim.fast = Math.max(1, +Q.get("fast") || 1);
  if (Q.has("reset")) St.wipe();
  const SEED = Q.has("seed") ? +Q.get("seed") >>> 0 : undefined;
  let dayOffset = 0; // the debug hook's newDay() moves the real calendar on
  Sim.now = () => Date.now() + dayOffset;

  const AD = { S: null, active: false, paused: false, t: 0 };
  const g = () => WG.game;
  let timers = { real: 0, ui: 0, save: 0, look: 0 },
    lookNow = "",
    musicNow = "",
    caught = false,
    postcards = [],
    quiet = false,
    nightNext = 0; // when to (re)show the night's diary, if it was closed without going to sleep

  function load() {
    if (!AD.S) AD.S = St.load(Sim.now(), SEED);
    return AD.S;
  }
  function save() {
    if (AD.S) St.save(AD.S, Sim.now());
  }

  /* ---------- in and out ---------- */
  AD.enter = function () {
    const G = g(),
      S = load();
    if (!AD.booted) {
      M.init(G.scene);
      M.onCarTap = (id) => AD.focusCar(id, true);
      M.onHoodTap = (n) => {
        G.A.sfx("select");
        U.panel("hood", n);
      };
      M.onCarDrop = (id, hood) => U.act(Sim.sendTo(AD.S, id, hood), { icon: "🗺️" });
      Sim.on = onEvent;
      AD.booted = true;
    }
    Sim.start(S);
    // time away (once per visit to the page; after that the save's lastSeen keeps up)
    let away = null;
    if (!caught) {
      caught = true;
      quiet = true;
      away = St.catchUp(S, Sim.now());
      quiet = false;
      backfill();
    }
    U.init(S);
    U.show(true);
    G.setState("adopt");
    M.show(true);
    M.sync(S);
    M.refreshLabels(S);
    C.fleetVisible(false);
    G.mii.root.visible = false;
    AD.active = true;
    AD.paused = false;
    lookNow = musicNow = "";
    look();
    U.update();
    U.coach();
    if (S.recovered) U.toast("🛟", "Your save couldn't be read, so the last good copy was restored.", "bad");
    if (!S.cars.length) setTimeout(() => U.welcome(), 600);
    else if (away && away.minutes >= 30)
      U.modal(
        "While you were away",
        "<p class='lead'>You were gone about " + (away.realHours < 1 ? Math.round(away.realHours * 60) + " minutes" : away.realHours.toFixed(1) + " hours") + ". The fleet carried on gently: <b>" + away.rides + " ride" + (away.rides === 1 ? "" : "s") + "</b> and <b>◎" + away.fares.toLocaleString("en-US") + "</b>" + (away.days ? ", and " + away.days + " night" + (away.days > 1 ? "s" : "") + " at home" : "") + ".</p>",
        { buttons: [["close", "Welcome back!", "primary"]] },
      );
    nightNext = 0;
    save();
  };
  AD.exit = function () {
    const G = g();
    if (C.active) C.abort();
    save();
    U.show(false);
    M.show(false);
    M.cam.ride = null;
    // put the arcade back as it was: its fleet, the crew member at the patch's start
    Traffic.n = W.fleet;
    Traffic.reset();
    C.fleetVisible(true);
    G.mii.root.visible = true;
    G.P.pos.set(W.start.x, 0, W.start.z);
    G.P.pos.y = W.groundY(W.start.x, W.start.z);
    G.P.path = [];
    G.CAM.yaw = W.start.yaw;
    G.snap();
    AD.active = false;
    G.toTitle();
  };
  AD.isActive = () => AD.active;

  /* ---------- each frame ---------- */
  AD.update = function (dt) {
    const S = AD.S;
    if (!S || !AD.active) return;
    AD.t += dt;
    if (!AD.paused) Sim.advance(S, dt);
    for (const k in timers) timers[k] += dt;
    if (timers.real > 1) {
      timers.real = 0;
      Sim.realTick(S);
    }
    if (timers.look > 1) {
      timers.look = 0;
      look();
    }
    if (timers.ui > 0.25) {
      timers.ui = 0;
      U.update();
    }
    if (timers.save > 10) {
      timers.save = 0;
      save();
    }
    M.update(dt, S, AD.t);
    C.update(dt);
    // a postcard a frame, never during a swoop
    if (postcards.length && !C.active) postcard(postcards.shift());
    // midnight: once everybody's home, the diary and bed (again a little later if it was closed without sleeping)
    if (S.clock.night && S.clock.sleepReady && AD.t > nightNext && !U.modalOpen && !C.active) {
      nightNext = AD.t + 20;
      U.night();
    }
  };
  AD.after = function () {
    if (AD.S && AD.active) M.place(AD.S, g().camera, M.cam);
  };
  function look() {
    const S = AD.S,
      L = Sim.look(S);
    if (L !== lookNow) {
      lookNow = L;
      W.setLook(L);
    }
    const mus = S.clock.night || L === "night" ? "night" : "garage";
    if (mus !== musicNow) {
      musicNow = mus;
      g().A.music(mus);
    }
  }

  /* ---------- the camera ---------- */
  AD.camera = function (dt, pos, look) {
    if (C.active) return C.camera(dt, pos, look);
    const K = g().keys,
      typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (!typing && !U.modalOpen) {
      let dx = 0,
        dy = 0;
      if (K.has("KeyW") || K.has("ArrowUp")) dy += 1;
      if (K.has("KeyS") || K.has("ArrowDown")) dy -= 1;
      if (K.has("KeyA") || K.has("ArrowLeft")) dx += 1;
      if (K.has("KeyD") || K.has("ArrowRight")) dx -= 1;
      if (dx || dy) M.pan(dx * 700 * dt, dy * 700 * dt, g().camera);
      const r = (K.has("KeyQ") ? 1 : 0) - (K.has("KeyE") ? 1 : 0);
      if (r) M.rotate(r * 1.4 * dt);
      if (K.has("Equal") || K.has("NumpadAdd")) M.zoom(1 - dt);
      if (K.has("Minus") || K.has("NumpadSubtract")) M.zoom(1 + dt);
    }
    return M.camera(dt, pos, look, g().camera);
  };

  /* ---------- the pointer: drag to pan, right-drag to turn, pinch and wheel to zoom, tap to pick ---------- */
  const ptrs = new Map();
  let drag = null,
    pinch = null;
  AD.pointer = function (type, e) {
    const cam = g().camera;
    if (C.active) return;
    if (type === "wheel") {
      M.zoom(e.deltaY > 0 ? 1.1 : 0.9);
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
        M.zoom(pinch.d / Math.max(10, d));
        M.rotate(-(ang - pinch.a));
        pinch.d = d;
        pinch.a = ang;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) {
        if (drag.turn) M.rotate(-dx * 0.006);
        else M.pan(dx, dy, cam);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    // up
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.moved && !drag.turn && e.type === "pointerup") {
      const hit = M.pick(e.clientX, e.clientY, cam);
      if (hit && hit.car) AD.focusCar(hit.car, true);
      else if (hit && hit.hood) {
        g().A.sfx("select");
        U.panel("hood", hit.hood);
      }
    }
    drag = null;
  };

  /* ---------- keys ---------- */
  let lastSpeed = 1;
  AD.key = function (e) {
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName),
      onBtn = document.activeElement && document.activeElement.closest && document.activeElement.closest("button");
    if (e.code === "Escape") {
      if (typing) document.activeElement.blur();
      if (U.closeModal() || U.close()) return true;
      if (M.cam.ride) {
        M.cam.ride = null;
        return true;
      }
      if (C.active) {
        C.abort();
        return true;
      }
      U.menu();
      return true;
    }
    if (typing) {
      if (e.code === "Enter") {
        const b = document.querySelector("#ad-modal .panel-f .btn.primary");
        if (b) b.click();
        return true;
      }
      return false;
    }
    if (e.code === "KeyP" && !U.modalOpen) {
      U.menu();
      return true;
    }
    if (e.code === "Space" && !onBtn) {
      const S = AD.S;
      if (S.settings.speed) {
        lastSpeed = S.settings.speed;
        S.settings.speed = 0;
      } else S.settings.speed = lastSpeed || 1;
      U.update();
      return true;
    }
    const sp = { Digit1: 1, Digit2: 2, Digit3: 4, Digit0: 0 }[e.code];
    if (sp !== undefined && !U.modalOpen) {
      AD.S.settings.speed = sp;
      U.update();
      return true;
    }
    // the menus: arrow keys move between buttons when a panel or modal is open
    if ((U.modalOpen || U.open) && /^Arrow(Up|Down)$/.test(e.code)) {
      const box = U.modalOpen ? document.getElementById("ad-modal") : document.getElementById("ad-panel"),
        bs = Array.from(box.querySelectorAll("button:not([disabled])"));
      if (bs.length) {
        const i = bs.indexOf(document.activeElement),
          d = e.code === "ArrowDown" ? 1 : -1;
        bs[(i + d + bs.length) % bs.length].focus();
        return true;
      }
    }
    return /^(Arrow|Key[WASDQE])/.test(e.code);
  };

  /* ---------- the fleet: following, caring, adopting ---------- */
  // tap a car (its tag, its card or the toy itself): follow it, and if you already were, open its profile
  AD.focusCar = function (id, tap) {
    const cam = M.cam;
    if (cam.follow === id && tap) U.panel("profile", id);
    else {
      cam.follow = id;
      cam.ride = null;
      const p = M.carPos(id);
      if (p && cam.h > 900 * M.K) cam.h = 700 * M.K;
      g().A.sfx("select");
    }
  };
  // hands-on care: swoop down to the Care Spot the car is at (or, for a car stuck anywhere, the nearest one)
  AD.care = function (id, kind) {
    const S = AD.S,
      car = Sim.find(S, id);
    if (!car || C.active) return;
    const incident = kind === "doors" || kind === "cone",
      hood = Sim.careSpot(car) ? car.sim.at : Sim.nearestCare(car);
    if (!incident && !Sim.careSpot(car)) return U.toast("📍", "Call " + Sim.nameOf(car) + " to a Care Spot first.", "bad");
    if (!incident) car.sim.task = "care";
    M.cam.follow = id;
    C.start({
      kind,
      carId: id,
      hood,
      onEnd: (res) => {
        if (res) {
          const r = Sim.careDone(S, id, kind, res.q);
          U.toast("💖", Sim.nameOf(car) + " feels " + (r && r.need ? Sim.label(r.need, car.needs[r.need]).toLowerCase() : "free to go") + "! +" + (r ? r.bond.toFixed(1) : "0.3") + " bond", "good", id);
          g().VOX.say("adopt.care");
          M.hop(id);
        } else U.toast("🙂", "Maybe later. " + Sim.nameOf(car) + " doesn't mind.", "", id);
        AD.changed();
        save();
      },
    });
  };
  AD.arcade = function (kind) {
    if (C.active) return;
    C.start({
      kind,
      arcade: true,
      hood: Sim.HOME,
      onEnd: (res) => {
        if (!res) return;
        const r = Sim.arcadeResult(AD.S, kind, res);
        setTimeout(() => U.arcadeResult(kind, r), 900);
        AD.changed();
        save();
      },
    });
  };
  AD.rideAlong = function (id) {
    M.cam.ride = id;
    M.cam.follow = id;
    U.toast("🎥", "Ride Along with " + Sim.nameOf(Sim.find(AD.S, id)) + ". Drag the map or press Esc to fly back up.", "good", id);
  };
  AD.adopted = function (car) {
    const S = AD.S,
      G = g();
    if (!S.tut) S.tut = 1;
    AD.changed(true);
    U.close();
    G.big("Welcome home, " + car.name + "!", "go");
    G.A.sfx("medal");
    G.VOX.say("adopt.adopt");
    if (S.cars.includes(car)) {
      M.cam.follow = car.id;
      M.cam.h = 520 * M.K;
    }
    U.coach();
    save();
  };
  // after anything changes the save: the map's markers and labels, the panels
  AD.changed = function () {
    if (!AD.S) return;
    M.sync(AD.S);
    M.refreshLabels(AD.S);
    U.update();
  };
  AD.pauseFor = (on) => (AD.paused = on);
  AD.resume = () => (AD.paused = false);
  // a run of the arcade's five shifts pays into the garage, once a day (game.js calls this from the final results)
  AD.arcadeRun = function (score) {
    const S = load();
    Sim.realTick(S);
    const f = Sim.arcadeRun(S, score);
    save();
    if (f) {
      const e = document.getElementById("fn-next");
      if (e) e.textContent += " · Adopt-a-Waymo: +◎" + f + " paid into your garage.";
    }
    return f;
  };

  /* ---------- what the simulation says ---------- */
  function onEvent(ev, S) {
    if (quiet) return;
    const G = g(),
      V = G.VOX;
    switch (ev.type) {
      case "pickup":
        if (ev.rider && M.cam.follow === ev.carId) V.say("rider.pickup." + ev.rider.toLowerCase());
        return;
      case "request":
        U.toast(ev.icon, ev.text, "", null);
        V.say("rider.ask." + ev.rider.toLowerCase());
        break;
      case "ride": {
        M.hop(ev.carId);
        if (M.cam.follow === ev.carId) G.A.sfx("carHappy", 0);
        return;
      }
      case "stamp":
        postcards.push(ev);
        U.toast(ev.icon, ev.text, "good", ev.carId);
        V.say("adopt.stamp");
        G.A.sfx("medal");
        break;
      case "rank":
        G.big("Crew Rank " + ev.rank + "!", "go");
        U.toast(ev.icon, ev.text, "good");
        V.say("adopt.rank");
        G.A.sfx("medal");
        break;
      case "night":
        U.toast(ev.icon, ev.text);
        V.say("adopt.night");
        break;
      case "morning":
        U.toast(ev.icon, ev.text);
        break;
      case "nap":
        U.toast(ev.icon, ev.text, "bad", ev.carId);
        V.say("adopt.nap");
        G.A.sfx("carSad", 0);
        break;
      case "karl":
        U.toast(ev.icon, ev.text, "", null);
        V.say("adopt.karl");
        break;
      case "show":
        U.toast(ev.icon, ev.text, "good");
        V.say("adopt.show");
        break;
      case "trophy":
        U.toast(ev.icon, ev.text, "good");
        G.A.sfx("medal");
        break;
      case "stage":
        G.big(ev.text.split("!")[0] + "!", "go");
        U.toast(ev.icon, ev.text, "good", ev.carId);
        G.A.sfx("cheer");
        break;
      case "incident":
        U.toast(ev.icon, ev.text, "bad", ev.carId);
        G.A.sfx("alert", 0);
        break;
      case "event":
        U.toast(ev.icon, ev.text, ev.tone === "bad" ? "bad" : ev.tone === "good" ? "good" : "", ev.carId);
        if (ev.tone === "bad" && Math.random() < 0.4) V.say("adopt.event.bad");
        if (M.cam.follow === ev.carId) G.A.sfx(ev.tone === "bad" ? "carSad" : "carHappy", 0);
        break;
      case "sleepReady":
        return;
      default:
        if (ev.text) U.toast(ev.icon, ev.text, "", ev.carId);
    }
    M.refreshLabels(S);
  }
  // a stamp's postcard: rendered from a camera framing the landmark, kept in IndexedDB
  function postcard(ev) {
    const S = AD.S,
      st = S.album.stamps[ev.stamp];
    if (!st) return;
    try {
      const url = M.postcard(g().renderer, ev.mark, ev.stamp, st.carName);
      if (!url) return;
      const id = "pc_" + ev.stamp.replace(/\W+/g, "_").toLowerCase();
      St.putCard(id, url).then((ok) => {
        if (ok) st.img = id;
      });
    } catch (e) {}
  }
  // stamps found while away get their postcards on the next visit
  function backfill() {
    const S = AD.S;
    for (const [name, st] of Object.entries(S.album.stamps)) if (!st.img) postcards.push({ stamp: name, mark: st.mark });
  }

  /* ---------- saving when the tab goes away ---------- */
  addEventListener("visibilitychange", () => document.hidden && AD.active && save());
  addEventListener("pagehide", () => AD.active && save());

  /* ---------- debug hooks ---------- */
  AD.debug = {
    skipHours: (n) => {
      Sim.run(AD.S, Math.round(n * 60));
      AD.changed();
    },
    setNeed: (carId, need, v) => {
      const c = Sim.find(AD.S, carId || (AD.S.cars[0] || {}).id);
      if (c) c.needs[need] = v;
    },
    give: (id, n) => Sim.give(AD.S, id, n || 1),
    fares: (n) => Sim.fares(AD.S, n),
    rank: (n) => {
      AD.S.player.rank = n;
      AD.S.player.xp = 0;
      Sim.syncUnlocks(AD.S);
      AD.changed();
    },
    event: (id, carId) => Sim.forceEvent(AD.S, Sim.find(AD.S, carId) || AD.S.cars[0], id),
    newDay: () => {
      const S = AD.S;
      if (!S.clock.night) Sim.run(S, 1440 - S.clock.minute);
      for (let k = 0; k < 600 && !S.clock.sleepReady; k++) Sim.run(S, 1);
      Sim.sleep(S);
      dayOffset += 864e5;
      Sim.realTick(S);
      AD.changed();
    },
    adopt: (name) => {
      const r = Sim.adopt(AD.S, 0, name || "Pickle");
      if (r.ok) AD.adopted(r.car);
      return r;
    },
    postcards: backfill,
    get S() {
      return AD.S;
    },
  };

  WG.adopt = AD;
  // ?mode=adopt: straight in
  if (Q.get("mode") === "adopt") {
    const go = () => (WG.game && WG.game.G.state === "title" ? AD.enter() : setTimeout(go, 100));
    setTimeout(go, 50);
  }
})();
