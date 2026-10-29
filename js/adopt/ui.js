/* Waymo Care · Adopt-a-Waymo · the panels. Everything you read and press in the relaxed mode, as DOM over the map in
   the look of css/style.css: the top bar (clock, Fares, Crew Rank, speed, inbox), the car strip, the car profile card,
   each neighbourhood's land panel (shop and haggling, today's daily, its games and quests, its landmarks), the
   inventory, album, arcade, garage, Adoption Lot, diary and inbox, the minigames' little modals (the prize wheel, the
   fog horn toss, the raffle, the derby…) and the tutorial. It reads the save and calls js/adopt/sim.js; it never
   touches three.js (the map is js/adopt/map.js). */
(function () {
  "use strict";
  const WG = window.WG,
    D = WG.adoptData,
    Sim = WG.adoptSim,
    St = WG.adoptState;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const A = () => WG.game.A;
  const TOUCH = matchMedia("(pointer: coarse)").matches;
  const U = { open: null, modalOpen: false };
  let S = null;
  const H = {}; // the panels' and modals' button actions, by data-a

  /* ---------- small helpers ---------- */
  const nm = (car) => esc(car.nick || car.name);
  const item = (id) => D.ITEMS[id];
  const ic = (id) => (item(id) ? item(id).icon : "❔");
  const hearts = (b) => {
    const n = Math.floor(b);
    return '<span class="ad-hearts" aria-label="' + n + ' of 10 hearts">' + "♥".repeat(n) + '<s>' + "♥".repeat(10 - n) + "</s></span>";
  };
  const bar = (v, max, cls) => '<i class="ad-bar ' + (cls || "") + '"><u style="transform:scaleX(' + Math.max(0, Math.min(1, v / (max || 100))).toFixed(3) + ')"></u></i>';
  const needCol = (v) => (v >= 70 ? "ok" : v >= 40 ? "fine" : v >= 20 ? "low" : "bad");
  const btn = (a, label, o) => {
    o = o || {};
    const data = Object.entries(o.data || {})
      .map(([k, v]) => " data-" + k + '="' + esc(v) + '"')
      .join("");
    return '<button type="button" class="btn ' + (o.cls || "tiny") + '" data-a="' + a + '"' + data + (o.off ? " disabled" : "") + (o.title ? ' title="' + esc(o.title) + '"' : "") + ">" + label + "</button>";
  };
  U.act = function (r, o) {
    if (!r) return r;
    if (r.msg) U.toast(r.ok === false ? "🙁" : (o && o.icon) || "✨", r.msg, r.ok === false ? "bad" : "good");
    if (r.ok !== false) A().sfx(o && o.sfx ? o.sfx : "chime", 1);
    else A().sfx("back");
    WG.adopt.changed(r.look);
    U.refresh(true);
    return r;
  };

  /* ---------- toasts ---------- */
  U.toast = function (icon, text, tone, carId) {
    const box = $("#ad-toasts"),
      e = document.createElement("div");
    e.className = "ad-toast " + (tone || "");
    e.innerHTML = '<span class="ti">' + esc(icon || "🔔") + "</span><span>" + esc(text) + "</span>";
    if (carId)
      e.addEventListener("click", () => {
        WG.adopt.focusCar(carId);
      });
    box.appendChild(e);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => e.classList.add("out"), 5200);
    setTimeout(() => e.remove(), 5700);
  };

  /* ---------- the car's portrait: a little side view in its colours ---------- */
  U.portrait = function (cv, car, big) {
    const x = cv.getContext("2d"),
      w = cv.width,
      h = cv.height,
      wr = D.WRAPS[car.wrap] || D.WRAPS.default,
      k = w / 120;
    x.clearRect(0, 0, w, h);
    x.save();
    x.scale(k, k);
    x.translate(0, (h / k - 80) / 2);
    x.lineJoin = x.lineCap = "round";
    // the body
    x.fillStyle = wr.tint;
    x.strokeStyle = "#2e3a4a";
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(14, 60);
    x.quadraticCurveTo(8, 58, 10, 46);
    x.quadraticCurveTo(14, 30, 40, 26);
    x.lineTo(84, 26);
    x.quadraticCurveTo(108, 30, 110, 46);
    x.quadraticCurveTo(111, 60, 104, 60);
    x.closePath();
    x.fill();
    x.stroke();
    // decals
    const d = wr.decal;
    if (d) {
      x.save();
      x.clip();
      if (d.kind === "bands") d.cols.forEach((c, i) => ((x.fillStyle = c), x.fillRect(8, 44 + i * (14 / d.cols.length), 104, 14 / d.cols.length)));
      else if (d.kind === "stripe" || d.kind === "trim") ((x.fillStyle = d.col), x.fillRect(8, d.kind === "trim" ? 47 : 40, 104, 4));
      else
        for (let i = 0; i < 6; i++) {
          x.fillStyle = d.col;
          x.beginPath();
          x.arc(20 + i * 16, 48 + (i % 2) * 5, d.kind === "stars" ? 2 : 4, 0, 7);
          x.fill();
        }
      x.restore();
      x.beginPath();
    }
    // the windows and the lidar
    x.fillStyle = "#1c2734";
    x.beginPath();
    x.moveTo(34, 28);
    x.quadraticCurveTo(44, 14, 62, 13);
    x.lineTo(80, 13);
    x.quadraticCurveTo(92, 16, 96, 28);
    x.closePath();
    x.fill();
    x.fillStyle = "#1c2734";
    x.fillRect(54, 4, 18, 8);
    x.fillStyle = car.ring;
    x.fillRect(54, 9, 18, 3);
    // the wheels
    for (const cx of [32, 90]) {
      x.fillStyle = "#24272c";
      x.beginPath();
      x.arc(cx, 60, 10, 0, 7);
      x.fill();
      x.fillStyle = "#c7ccd3";
      x.beginPath();
      x.arc(cx, 60, 4, 0, 7);
      x.fill();
    }
    x.restore();
    // a topper and the dashpet, as emoji
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (car.gear && car.gear.topper) {
      x.font = 18 * k + "px system-ui";
      x.fillText(ic(car.gear.topper), 63 * k, ((h / k - 80) / 2 + 2) * k);
    }
    if (car.dashpet) {
      x.font = 14 * k + "px system-ui";
      x.fillText(D.DASHPETS[car.dashpet.id].icon, 40 * k, ((h / k - 80) / 2 + 12) * k);
    }
  };

  /* ---------- the top bar and the car strip ---------- */
  function top() {
    const c = S.clock,
      p = S.player,
      wx = { clear: "☀️", fog: "🌫️", drizzle: "🌧️" }[c.weather] || "☀️";
    $("#ad-time").textContent = c.night ? "Night" : Sim.fmtClock(c.minute);
    $("#ad-day").textContent = "Day " + c.day + " · " + (c.night ? "🌙" : wx) + (Sim.weekend(S) ? " · weekend" : "");
    $("#ad-fares").textContent = "◎" + fmt(p.fares);
    $("#ad-rank-n").textContent = "Crew Rank " + p.rank;
    $("#ad-xp").style.transform = "scaleX(" + Math.min(1, p.xp / Sim.xpNeed(p.rank)).toFixed(3) + ")";
    $("#ad-rank").title = fmt(p.xp) + " / " + fmt(Sim.xpNeed(p.rank)) + " XP to the next rank";
    for (const b of $$("#ad-speed button")) b.setAttribute("aria-pressed", String(+b.dataset.sp === S.settings.speed));
    const unread = S.inbox.filter((m) => !m.read).length;
    $("#ad-inbox-n").textContent = unread ? (unread > 9 ? "9+" : unread) : "";
    $("#ad-inbox-btn").setAttribute("aria-label", "Inbox" + (unread ? ", " + unread + " new" : ""));
  }
  const strip = new Map();
  function carStrip() {
    const box = $("#ad-strip"),
      ids = new Set(S.cars.map((c) => c.id));
    for (const [id, e] of strip)
      if (!ids.has(id)) {
        e.remove();
        strip.delete(id);
      }
    for (const car of S.cars) {
      let e = strip.get(car.id);
      if (!e) {
        e = document.createElement("button");
        e.type = "button";
        e.className = "ad-chip";
        e.innerHTML = '<canvas width="96" height="64" aria-hidden="true"></canvas><span class="t"><b></b><small></small></span><span class="f"></span>';
        e.addEventListener("click", () => WG.adopt.focusCar(car.id, true));
        box.appendChild(e);
        strip.set(car.id, e);
      }
      const key = car.wrap + car.ring + JSON.stringify(car.gear) + (car.dashpet && car.dashpet.id);
      if (e.dataset.look !== key) {
        U.portrait(e.querySelector("canvas"), car);
        e.dataset.look = key;
      }
      const w = Sim.worst(car),
        face = D.MOOD_FACE[Math.min(5, Math.floor(car.needs.mood / 18.5))];
      e.querySelector("b").textContent = car.nick || car.name;
      const st = car.sim.task === "stuck" ? "⚠ " + D.INCIDENTS[car.sim.incident].name : car.training ? "🎓 At school" : w.v < 40 ? D.NEEDS[w.need].icon + " " + Sim.label(w.need, w.v) : Sim.label("mood", car.needs.mood);
      e.querySelector("small").textContent = st;
      e.querySelector(".f").innerHTML = face + "<i>" + "♥".repeat(Math.min(10, Math.floor(car.bond))) + "</i>";
      e.classList.toggle("warn", w.v < 20 || car.sim.task === "stuck");
      e.classList.toggle("on", WG.adoptMap.cam.follow === car.id);
      e.setAttribute("aria-label", (car.nick || car.name) + ": " + st + ", mood " + Sim.label("mood", car.needs.mood) + ", " + Math.floor(car.bond) + " hearts. Show on the map.");
    }
    const empty = !S.cars.length;
    box.classList.toggle("empty", empty);
  }

  /* ---------- the side panel ---------- */
  const panel = () => $("#ad-panel");
  U.panel = function (kind, arg) {
    U.open = { kind, arg };
    const p = panel();
    p.hidden = false;
    p.dataset.kind = kind;
    render(true);
    A().sfx("open");
    setTimeout(() => {
      const f = $("#ad-panel .ad-ph button.x");
      if (f && !TOUCH) f.focus({ preventScroll: true });
    }, 30);
  };
  U.close = function () {
    if (!U.open) return false;
    U.open = null;
    panel().hidden = true;
    A().sfx("back");
    return true;
  };
  function render(scrollTop) {
    if (!U.open) return;
    const R = RENDER[U.open.kind];
    if (!R) return;
    const r = R(U.open.arg);
    if (!r) return U.close();
    const p = panel(),
      body = $(".ad-pb", p),
      y = body.scrollTop;
    $(".ad-ph h2", p).innerHTML = r.title;
    $(".ad-ph small", p).innerHTML = r.sub || "";
    body.innerHTML = r.html;
    if (r.after) r.after(body);
    body.scrollTop = scrollTop ? 0 : y;
    U.lastHour = Sim.hourIdx(S);
  }
  // re-render the open panel, unless someone's typing in it
  U.refresh = function (force) {
    if (!U.open) return;
    const a = document.activeElement;
    if (!force && a && a.tagName === "INPUT" && panel().contains(a)) return;
    render(false);
  };
  // the parts of a panel that change by the second
  function live() {
    if (!U.open) return;
    if (U.open.kind === "profile") {
      const car = Sim.find(S, U.open.arg);
      if (!car) return;
      for (const k of D.NEED_KEYS.concat(["mood"])) {
        const row = $('#ad-panel [data-need="' + k + '"]');
        if (!row) continue;
        const v = car.needs[k];
        $("u", row).style.transform = "scaleX(" + Math.min(1, v / 100).toFixed(3) + ")";
        row.className = "ad-need " + needCol(v);
        $("em", row).textContent = Sim.label(k, v);
      }
      const d = $("#ad-doing");
      if (d) d.textContent = Sim.doing(car);
    }
    if (Sim.hourIdx(S) !== U.lastHour && ["hood", "profile", "garage"].includes(U.open.kind)) U.refresh();
  }

  /* ---------- modals ---------- */
  U.modal = function (title, html, o) {
    o = o || {};
    if (U.onModalClose) {
      const f = U.onModalClose;
      U.onModalClose = null;
      f();
    }
    const m = $("#ad-modal");
    $(".panel-h span", m).innerHTML = title;
    $(".panel-h small", m).innerHTML = o.sub || "";
    $(".panel-b", m).innerHTML = html;
    $(".panel-f", m).innerHTML = (o.buttons || [["close", "Close", "primary"]]).map(([a, l, c, data]) => btn(a, l, { cls: c || "", data })).join("");
    m.hidden = false;
    m.classList.toggle("wide", !!o.wide);
    U.modalOpen = true;
    U.onModalClose = o.onClose || null;
    if (o.after) o.after($(".panel-b", m));
    setTimeout(() => {
      const b = $("#ad-modal .panel-f .btn.primary") || $("#ad-modal button");
      if (b && !TOUCH) b.focus({ preventScroll: true });
    }, 40);
    return m;
  };
  U.closeModal = function () {
    if (!U.modalOpen) return false;
    $("#ad-modal").hidden = true;
    U.modalOpen = false;
    const f = U.onModalClose;
    U.onModalClose = null;
    if (U.anim) cancelAnimationFrame(U.anim);
    if (f) f();
    return true;
  };
  H.close = () => {
    U.closeModal();
    A().sfx("back");
  };
  // pick one of your cars, then do something with it
  U.pickCar = function (title, cb, filter, why) {
    const cars = S.cars.filter(filter || (() => true));
    if (!cars.length) return U.toast("🙁", why || "No car can do that right now.", "bad");
    if (cars.length === 1 && !U.alwaysPick) return cb(cars[0].id);
    U.modal(
      title,
      '<div class="ad-picks">' +
        cars
          .map((c) => '<button type="button" class="ad-pick" data-a="picked" data-id="' + c.id + '"><canvas width="96" height="64" data-car="' + c.id + '"></canvas><b>' + nm(c) + "</b><small>" + esc(Sim.doing(c)) + "</small></button>")
          .join("") +
        "</div>",
      {
        buttons: [["close", "Cancel"]],
        after: (b) => $$("canvas[data-car]", b).forEach((cv) => U.portrait(cv, Sim.find(S, cv.dataset.car))),
      },
    );
    U.picked = cb;
  };
  H.picked = (ds) => {
    const cb = U.picked;
    U.closeModal();
    if (cb) cb(ds.id);
  };

  /* =====================================================================================================
     the panels
     ===================================================================================================== */
  const RENDER = {};

  /* ---------- the car profile card (the Neopets pet lookup) ---------- */
  RENDER.profile = function (id) {
    const car = Sim.find(S, id);
    if (!car) return null;
    const on = S.cars.includes(car),
      st = D.STAGES.find((s) => s.id === car.stage),
      e = Sim.eff(S, car),
      lv = Sim.level(car),
      spot = Sim.careSpot(car),
      busy = Sim.busy(car),
      stuck = car.sim.task === "stuck";
    let h = '<div class="ad-prof"><canvas width="240" height="150" id="ad-big" aria-hidden="true"></canvas><div>';
    h += '<p class="ad-badges"><span class="ad-badge">' + st.badge + " " + st.name + "</span>" + (car.title ? '<span class="ad-badge gold">' + esc(car.title) + "</span>" : "") + "</p>";
    h += "<p>" + esc(D.WRAPS[car.wrap].name) + " · " + esc(car.model === "cruiser" ? "Cruiser" : car.model) + ' · plate <span class="ad-plate">' + esc(car.plate) + "</span></p>";
    h += "<p>Adopted " + esc(car.born || "—") + " · " + Sim.age(car) + " day" + (Sim.age(car) === 1 ? "" : "s") + " old</p>";
    h += "<p>" + hearts(car.bond) + "</p>";
    h += on ? '<p class="ad-doing" id="ad-doing" aria-live="polite">' + esc(Sim.doing(car)) + "</p>" : "<p class='ad-doing'>Resting in the Adoption Lot</p>";
    h += "</div></div>";
    // needs
    h += '<h3>Needs</h3><div class="ad-needs">';
    for (const k of D.NEED_KEYS.concat(["mood"])) {
      const v = car.needs[k];
      h += '<div class="ad-need ' + needCol(v) + '" data-need="' + k + '"><span>' + D.NEEDS[k].icon + " " + D.NEEDS[k].name + "</span>" + bar(v) + "<em>" + esc(Sim.label(k, v)) + "</em></div>";
    }
    h += "</div>";
    // actions
    if (on) {
      h += '<div class="ad-acts">';
      if (stuck) {
        h += btn("care", "🔧 Rush over and fix it", { cls: "tiny primary", data: { id, k: car.sim.incident } });
        h += btn("roadside", "🚐 Roadside help (◎25)", { data: { id } });
      } else h += btn("careMenu", "🔧 Care hands-on", { cls: "tiny primary", data: { id }, off: !spot || busy, title: spot ? "" : car.sim.task === "toCare" ? "On its way to a Care Spot" : "Call it to a Care Spot first" });
      h += btn("callCare", "📍 Call to Care Spot", { data: { id }, off: !Sim.canCallToCare(car) || (!!spot && car.sim.task === "care") || car.sim.task === "toCare", title: (spot && car.sim.task === "care") ? "Already at a Care Spot" : car.sim.task === "toCare" ? "Already on its way to a Care Spot" : "" });
      h += btn("useItem", "🎒 Use item", { data: { id } });
      h += btn("pat", "✋ Pat", { data: { id } });
      h += btn("sendMenu", "🗺️ Send to…", { data: { id }, off: busy });
      h += btn("home", "🏠 Go home", { data: { id }, off: busy || Sim.atHome(car) });
      h += btn("dress", "👒 Dress up", { data: { id } });
      if (car.bond >= 2) h += btn("nick", "🏷️ Nickname", { data: { id } });
      if (car.bond >= 4 && car.gear.horn) h += btn("horn", "📯 Honk", { data: { id } });
      if (car.bond >= 6) h += btn("dance", "💃 Lidar dance", { data: { id } });
      if (car.bond >= 8) h += btn("ride", "🎥 Ride Along", { data: { id } });
      h += btn("share", "📤 Share card", { data: { id } });
      h += "</div>";
    } else h += '<div class="ad-acts">' + btn("activate", "Put back on the road", { cls: "tiny primary", data: { id } }) + "</div>";
    if (!spot && on && !stuck) h += '<p class="ad-hint">Hands-on care happens at a Care Spot 🔧 (Russian Hill, the Presidio, the Financial District, Alamo Square, Ocean Beach). Items work anywhere.</p>';
    // stats
    h += '<h3>Stats <small>Car Level ' + lv + "</small></h3><div class='ad-stats'>";
    for (const k of D.STAT_KEYS) {
      const bonus = e[k] - car.stats[k];
      h += '<div title="' + esc(D.STATS[k].desc) + '"><span>' + D.STATS[k].icon + " " + D.STATS[k].name + "</span><b>" + car.stats[k] + (bonus ? ' <small>+' + bonus + "</small>" : "") + "</b></div>";
    }
    h += "</div>";
    if (car.training) h += '<p class="ad-hint">🎓 Studying ' + D.STATS[car.training.stat].name + " at the Driving Academy: back " + when(car.training.endsAt) + ".</p>";
    // personality
    h += "<h3>Personality</h3><ul class='ad-list'>";
    for (const t of car.traits) h += "<li>" + D.TRAITS[t].icon + " <b>" + D.TRAITS[t].name + "</b>: " + esc(car.bond >= 10 ? D.TRAIT_PLUS[t] : D.TRAITS[t].desc) + "</li>";
    const L = car.likes || {};
    h += "<li>❤️ Loves " + esc(L.hood || "?") + ", " + esc(L.rider ? D.RIDERS[L.rider].name : "?") + ", " + esc(L.item ? item(L.item).name : "?") + " and " + esc(L.song ? item(L.song).name : "?") + "</li>";
    if (car.story) h += "<li>📖 " + esc(car.story) + "</li>";
    h += "</ul>";
    // look
    h += "<h3>Dashpet & accessories</h3><ul class='ad-list'>";
    h += "<li>" + (car.dashpet ? D.DASHPETS[car.dashpet.id].icon + " <b>" + esc(car.dashpet.name) + "</b>: " + esc(D.DASHPETS[car.dashpet.id].perk) + (car.dashpet.mite ? " (with a " + D.MITES[car.dashpet.mite].name + ")" : "") : "No dashpet yet. Adopt one at the Golden Gate Park Dashpet Paddock.") + "</li>";
    for (const s of Object.keys(D.SLOTS)) {
      const open = Sim.slots(car).includes(s),
        g = car.gear[s];
      h += "<li class='" + (open ? "" : "off") + "'>" + D.SLOTS[s] + ": " + (g ? ic(g) + " " + esc(item(g).name) + " " + btn("unequip", "Take off", { data: { id, slot: s } }) : open ? "—" : "🔒 when it grows up") + "</li>";
    }
    h += "</ul>";
    // records
    h += "<h3>Records</h3><dl class='ad-rec'>";
    h += "<div><dt>Odometer</dt><dd>" + car.km.toFixed(1) + " km</dd></div><div><dt>Rides given</dt><dd>" + car.rides + "</dd></div>";
    h += "<div><dt>Map packs read</dt><dd>" + car.read.length + "</dd></div><div><dt>Songs heard</dt><dd>" + car.heard.length + "</dd></div>";
    const visited = D.STAMPS.filter((st2) => S.album.stamps[st2.name] && S.album.stamps[st2.name].car === car.id).length;
    h += "<div><dt>Stamps found</dt><dd>" + visited + "</dd></div><div><dt>Favourite place</dt><dd>" + esc(topHood(car)) + "</dd></div></dl>";
    if (car.read.length) h += "<p class='ad-hint'>📚 Read: " + car.read.map((r) => esc(item(r).name)).join(", ") + "</p>";
    if (on) h += '<p class="ad-hint">' + btn("store", "Rest in the Adoption Lot", { data: { id } }) + "</p>";
    return {
      title: (car.nick ? esc(car.nick) + " <small>(" + esc(car.name) + ")</small>" : esc(car.name)),
      sub: "Level " + lv + " · " + esc(st.name),
      html: h,
      after: (b) => U.portrait($("#ad-big", b), car, true),
    };
  };
  function topHood(car) {
    let t = "—",
      v = -1;
    for (const [k, n] of Object.entries(car.hoodTime))
      if (n > v) {
        v = n;
        t = k;
      }
    return t;
  }
  function when(endMin) {
    if (endMin > 1e9) return "in 1 in-game hour";
    const m = Math.max(0, endMin - Sim.absMin(S));
    return m < 1 ? "any moment" : m < 60 ? "in " + m + " min (" + Sim.fmtClock(endMin % 1440) + ")" : "in " + Math.floor(m / 60) + " h" + (m % 60 ? " " + (m % 60) + " min" : "") + " (" + Sim.fmtClock(endMin % 1440) + ")";
  }
  H.careMenu = (ds) => {
    const car = Sim.find(S, ds.id);
    const rows = D.NEED_KEYS.map((k) => {
      const v = car.needs[k];
      return '<button type="button" class="ad-pick need ' + needCol(v) + '" data-a="care" data-id="' + car.id + '" data-k="' + Sim.NEED_JOB[k] + '"><canvas width="64" height="64" data-icon="' + Sim.NEED_JOB[k] + '"></canvas><b>' + D.NEEDS[k].name + "</b><small>" + esc(Sim.label(k, v)) + "</small>" + bar(v) + "</button>";
    }).join("");
    U.modal("Care for " + nm(car), '<p class="lead">Pick a job. The crew swoops down to the ' + esc(car.sim.at) + ' Care Spot and you do it by hand: the best care there is (+bond).</p><div class="ad-picks">' + rows + "</div>", {
      buttons: [["close", "Not now"]],
      after: (b) => $$("canvas[data-icon]", b).forEach((cv) => WG.drawIcon(cv.getContext("2d"), cv.dataset.icon, 32, 34, 1)),
    });
  };
  H.care = (ds) => {
    U.closeModal();
    U.close();
    WG.adopt.care(ds.id, ds.k);
  };
  H.roadside = (ds) => U.act(Sim.roadside(S, ds.id), { icon: "🚐" });
  H.callCare = (ds) => U.act(Sim.callToCare(S, ds.id), { icon: "📍" });
  H.pat = (ds) => {
    const r = U.act(Sim.pat(S, ds.id), { icon: "✋", sfx: "carHappy" });
    if (r && r.ok) WG.adoptMap.hop(ds.id);
  };
  H.home = (ds) => U.act(Sim.goHome(S, ds.id), { icon: "🏠" });
  H.store = (ds) => U.act(Sim.storeCar(S, ds.id));
  H.activate = (ds) => U.act(Sim.activate(S, ds.id));
  H.unequip = (ds) => U.act(Sim.unequip(S, ds.id, ds.slot));
  H.dance = (ds) => {
    WG.adoptMap.dance(ds.id);
    A().sfx("combo", 3);
    U.toast("💃", "Lidar dance!", "good");
  };
  H.horn = (ds) => {
    const car = Sim.find(S, ds.id),
      h = car && car.gear.horn && item(car.gear.horn).horn;
    if (h === "foghorn") A().sfx("timeup");
    else A().sfx(h || "carBeep");
  };
  H.ride = (ds) => {
    U.close();
    WG.adopt.rideAlong(ds.id);
  };
  H.sendMenu = (ds) => {
    const car = Sim.find(S, ds.id),
      fav = car.likes && car.likes.hood;
    const names = Object.keys(D.HOODS)
      .filter((n) => Sim.G.hoods[n])
      .sort();
    U.modal(
      "Send " + nm(car) + " to…",
      '<p class="lead">It drives there and hangs out for a couple of hours. Favourite places cheer it up. (You can also drag its name tag onto a neighbourhood.)</p><div class="ad-hoodlist">' +
        names.map((n) => '<button type="button" class="btn tiny' + (n === fav ? " primary" : "") + '" data-a="send" data-id="' + car.id + '" data-h="' + esc(n) + '">' + (n === fav ? "❤️ " : "") + esc(n) + "</button>").join("") +
        "</div>",
      { buttons: [["close", "Cancel"]], wide: true },
    );
  };
  H.send = (ds) => {
    U.closeModal();
    U.act(Sim.sendTo(S, ds.id, ds.h), { icon: "🗺️" });
  };
  H.nick = (ds) => {
    const car = Sim.find(S, ds.id);
    U.modal("A nickname for " + esc(car.name), '<label class="ad-field">Nickname <input id="ad-nick" maxlength="16" value="' + esc(car.nick || "") + '" autocomplete="off"></label>', {
      buttons: [
        ["close", "Cancel"],
        ["nickOk", "Save", "primary", { id: car.id }],
      ],
      after: (b) => setTimeout(() => $("#ad-nick", b).focus(), 50),
    });
  };
  H.nickOk = (ds) => {
    const v = $("#ad-nick").value;
    U.closeModal();
    U.act(Sim.nickname(S, ds.id, v));
  };
  // use an item on a car, from the profile
  H.useItem = (ds) => U.panel("inventory", { car: ds.id });
  H.dress = (ds) => U.panel("inventory", { car: ds.id, look: true });
  H.share = (ds) => shareCard(Sim.find(S, ds.id));

  // a PNG of the profile card, to save and show off
  function shareCard(car) {
    const cv = document.createElement("canvas");
    cv.width = 640;
    cv.height = 360;
    const x = cv.getContext("2d"),
      g = x.createLinearGradient(0, 0, 0, 360);
    g.addColorStop(0, "#74d6ff");
    g.addColorStop(1, "#eef3f7");
    x.fillStyle = g;
    x.fillRect(0, 0, 640, 360);
    x.fillStyle = "#fff";
    x.beginPath();
    x.roundRect ? x.roundRect(16, 16, 608, 328, 26) : x.rect(16, 16, 608, 328);
    x.fill();
    const pc = document.createElement("canvas");
    pc.width = 240;
    pc.height = 150;
    U.portrait(pc, car, true);
    x.drawImage(pc, 30, 60);
    x.fillStyle = "#1878c4";
    x.font = "900 34px 'M PLUS Rounded 1c', system-ui, sans-serif";
    x.fillText(car.nick || car.name, 290, 70);
    x.fillStyle = "#2e3a4a";
    x.font = "800 16px 'M PLUS Rounded 1c', system-ui, sans-serif";
    const st = D.STAGES.find((s) => s.id === car.stage);
    x.fillText(st.badge + " " + st.name + (car.title ? " · " + car.title : ""), 290, 98);
    x.fillText(D.WRAPS[car.wrap].name + " · " + car.plate, 290, 122);
    x.fillStyle = "#ff5a8a";
    x.fillText("♥".repeat(Math.floor(car.bond)) || "♡", 290, 148);
    x.fillStyle = "#2e3a4a";
    D.STAT_KEYS.forEach((k, i) => x.fillText(D.STATS[k].name + " " + car.stats[k], 290 + (i % 2) * 150, 186 + Math.floor(i / 2) * 26));
    x.fillText("Level " + Sim.level(car) + " · " + car.km.toFixed(0) + " km · " + car.rides + " rides", 290, 270);
    x.fillText(car.traits.map((t) => D.TRAITS[t].name).join(" · "), 30, 240);
    x.fillStyle = "#6a7a8c";
    x.font = "800 13px 'M PLUS Rounded 1c', system-ui, sans-serif";
    x.fillText("Adopt-a-Waymo · Waymo Care", 30, 320);
    const url = cv.toDataURL("image/png");
    U.modal("Share " + nm(car), '<p class="lead">Here is ' + nm(car) + "'s card.</p><img class='ad-share' src='" + url + "' alt='" + nm(car) + "'s profile card'><p><a class='btn tiny primary' download='" + esc((car.name || "car").replace(/\W+/g, "_")) + "_card.png' href='" + url + "'>Save the PNG</a></p>", { wide: true });
  }

  /* ---------- a neighbourhood's land panel ---------- */
  RENDER.hood = function (name) {
    const H0 = D.HOODS[name],
      open = Sim.open(S, name),
      care = H0.care;
    let h = '<p class="lead ad-lore">' + esc(H0.lore) + "</p>";
    h += '<p class="ad-tags">' + H0.tags.map((t) => '<span title="' + esc(D.TAG_FX[t].desc) + '">' + D.TAG_FX[t].icon + " " + D.TAG_FX[t].label + "</span>").join("") + (care ? '<span class="care">🔧 Care Spot</span>' : "") + (H0.home ? '<span class="care">🏠 Home garage</span>' : "") + "</p>";
    if (!open) {
      h += '<div class="ad-locked">🔒 Unlocks at Crew Rank ' + H0.rank + ". You're rank " + S.player.rank + ". Your cars can still drive and give rides here.</div>";
      h += stampsHtml(name);
      return { title: esc(name), sub: "Locked land", html: h };
    }
    const here = S.cars.filter((c) => !c.sim.from && c.sim.at === name);
    if (here.length) h += '<p class="ad-hint">Here now: ' + here.map((c) => "<b>" + nm(c) + "</b>").join(", ") + "</p>";
    if (care) h += '<div class="ad-acts">' + btn("callHere", "🔧 Call a car here for care", { cls: "tiny primary", data: { h: name } }) + btn("sendHere", "🗺️ Send a car to hang out", { data: { h: name } }) + "</div>";
    else h += '<div class="ad-acts">' + btn("sendHere", "🗺️ Send a car to hang out", { data: { h: name } }) + "</div>";
    if (H0.daily) h += dailyHtml(H0.daily);
    for (const f of H0.feats || []) h += (FEAT[f] || (() => ""))(name);
    for (const se of Sim.season().filter((s) => s.hub === name)) h += seasonHtml(se);
    if (H0.shop) h += shopHtml(H0.shop);
    h += stampsHtml(name);
    const next = Object.keys(D.HOODS).filter((n) => D.HOODS[n].rank > S.player.rank).sort((a, b) => D.HOODS[a].rank - D.HOODS[b].rank)[0];
    if (next) h += '<p class="ad-hint">Next land: ' + esc(next) + " at Crew Rank " + D.HOODS[next].rank + ".</p>";
    return { title: esc(name), sub: H0.rank === null ? "Neighbourhood" : "Land" + (H0.home ? " · home" : ""), html: h };
  };
  H.callHere = (ds) => U.pickCar("Which car needs care?", (id) => U.act(Sim.callTo(S, id, ds.h), { icon: "🔧" }), (c) => Sim.canCallToCare(c));
  H.sendHere = (ds) => U.pickCar("Who's going to " + esc(ds.h) + "?", (id) => U.act(Sim.sendTo(S, id, ds.h), { icon: "🗺️" }), (c) => !Sim.busy(c));
  function stampsHtml(name) {
    const st = D.STAMPS.filter((s) => s.hood === name);
    if (!st.length) return "";
    const WHEN = { any: "any time", morning: "in the morning", day: "in the daytime", dusk: "at dusk", night: "at night", fog: "in the fog", clear: "on a clear day" };
    return (
      "<h3>Landmarks</h3><ul class='ad-list'>" +
      st
        .map((s) => {
          const got = S.album.stamps[s.name];
          if (s.hidden && !got) return "<li>❔ A hidden stamp. Keep exploring.</li>";
          return "<li>" + (got ? "📮 <b>" + esc(s.name) + "</b> (found by " + esc(got.carName) + ")" : "◻️ " + esc(s.name) + ": visit " + WHEN[s.when]) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  /* ---------- shops ---------- */
  function shopHtml(id) {
    const sh = D.SHOPS[id],
      st = Sim.shop(S, id);
    let h = '<h3>' + sh.icon + " " + esc(sh.name) + " <small>" + esc(sh.keeper) + " · restocks every hour</small></h3>";
    if (!st.stock.length) return h + "<p class='ad-hint'>Sold out! " + esc(sh.keeper) + " is restocking. Come back next hour.</p>";
    h += '<ul class="ad-shop">';
    st.stock.forEach((e, i) => {
      const it = item(e.item),
        out = e.qty <= 0;
      h +=
        '<li class="' + (out ? "out" : "") + '"><span class="ii">' + it.icon + '</span><span class="in"><b>' + esc(it.name) + "</b><small>" + esc(rarity(it.rarity)) + " · " + (out ? "sold out" : e.qty + " left") + (it.desc ? " · " + esc(it.desc) : "") + "</small></span>" +
        '<span class="ip">◎' + fmt(e.price) + "</span>" +
        (out ? "" : btn("buy", "Buy", { cls: "tiny primary", data: { s: id, i } }) + btn("haggle", "Haggle", { data: { s: id, i }, off: e.mad })) +
        "</li>";
    });
    return h + "</ul>";
  }
  const rarity = (r) => (r >= 100 ? "Special" : r >= 90 ? "Ultra rare" : r >= 75 ? "Very rare" : r >= 55 ? "Rare" : r >= 35 ? "Uncommon" : "Common") + " (r" + r + ")";
  H.buy = (ds) => U.act(Sim.buy(S, ds.s, +ds.i), { icon: "🛍️", sfx: "ding" });
  H.haggle = (ds) => {
    const e = Sim.shop(S, ds.s).stock[+ds.i],
      it = item(e.item),
      sh = D.SHOPS[ds.s];
    U.modal(
      "Haggle with " + esc(sh.keeper),
      '<p class="lead">' + it.icon + " " + esc(it.name) + " · asking <b>◎" + fmt(e.price) + "</b></p><label class='ad-field'>Your offer ◎ <input id='ad-offer' type='number' inputmode='numeric' min='1' value='" + Math.round(e.price * 0.85) + "'></label><p class='ad-hint' id='ad-hag'>Offer too little and " + esc(sh.keeper) + " gets offended.</p>",
      {
        buttons: [
          ["close", "Leave"],
          ["offer", "Make offer", "primary", { s: ds.s, i: ds.i }],
        ],
        after: (b) => setTimeout(() => $("#ad-offer", b).select(), 50),
      },
    );
  };
  H.offer = (ds) => {
    const v = +$("#ad-offer").value,
      r = Sim.buy(S, ds.s, +ds.i, v);
    if (r.ok) {
      U.closeModal();
      U.act(r, { icon: "🤝", sfx: "ding" });
    } else if (r.counter) {
      $("#ad-hag").textContent = r.msg;
      $("#ad-offer").value = r.counter;
      A().sfx("pop");
    } else {
      U.closeModal();
      U.act(r);
    }
  };

  /* ---------- dailies ---------- */
  function dailyHtml(id) {
    const d = D.DAILIES[id],
      st = Sim.dailyState(S, id);
    return (
      '<div class="ad-daily ' + (st.open ? "ready" : "done") + '"><span class="di">' + d.icon + "</span><div><b>" + esc(d.name) + "</b><small>" + esc(d.desc) + "</small></div>" +
      (st.open ? btn("daily", "Play", { cls: "tiny primary", data: { d: id } }) : "<em>" + (st.done ? "✓ Done today" : esc(st.why)) + "</em>") +
      "</div>"
    );
  }
  H.daily = (ds) => {
    const d = D.DAILIES[ds.d],
      claim = (opt) => {
        const r = Sim.claimDaily(S, ds.d, opt);
        WG.adopt.changed(r.look);
        U.refresh(true);
        return r;
      };
    const result = (r) => {
      U.modal(d.icon + " " + esc(d.name), '<p class="lead ad-prize">' + esc(r.msg) + "</p>", { buttons: [["close", "Nice!", "primary"]] });
      A().sfx(r.ok === false ? "back" : "medal");
    };
    switch (d.kind) {
      case "wheel":
        return wheel(d, claim, result);
      case "timing":
        return timing(d, claim, result);
      case "scratch":
        return scratch(d, claim, result);
      case "sneak":
        U.sneak = (yes) => result(claim({ sneak: yes }));
        return U.modal(d.icon + " " + esc(d.name), '<p class="lead">' + esc(d.desc) + "</p><p class='ad-hint'>It might wake up. Nothing bad will really happen. Probably damp, though.</p>", {
          buttons: [
            ["sneakNo", "Tiptoe away"],
            ["sneakYes", "Sneak in", "primary"],
          ],
        });
      case "bonfire":
      case "summit":
      case "lab":
        return U.pickCar(d.icon + " " + esc(d.name) + ": which car?", (id) => result(claim({ car: id })));
      default:
        return result(claim({}));
    }
  };
  H.sneakNo = () => U.sneak(false);
  H.sneakYes = () => U.sneak(true);
  // the Lombard Zigzag Spin: a prize wheel that lands on the slice sim.js picked
  function wheel(d, claim, result) {
    U.modal(d.icon + " " + esc(d.name), '<canvas id="ad-wheel" width="300" height="300" aria-label="The prize wheel"></canvas><p class="ad-hint" id="ad-wheel-t">Spin it!</p>', {
      buttons: [["spin", "Spin!", "primary"]],
      after: (b) => drawWheel($("#ad-wheel", b), 0),
    });
    H.spin = () => {
      $("#ad-modal .panel-f").innerHTML = "";
      const r = claim({}),
        n = D.WHEEL.length,
        target = Math.PI * 2 * 5 + (Math.PI * 2 * (n - r.slice - 0.5)) / n - Math.PI / 2,
        t0 = performance.now();
      A().sfx("whoosh");
      let lastT = -1;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 3200),
          a = target * (1 - Math.pow(1 - k, 3));
        drawWheel($("#ad-wheel"), a);
        const tick = Math.floor((a / (Math.PI * 2)) * n);
        if (tick !== lastT) {
          lastT = tick;
          A().sfx("tick");
        }
        if (k < 1) U.anim = requestAnimationFrame(step);
        else result(r);
      };
      U.anim = requestAnimationFrame(step);
    };
  }
  function drawWheel(cv, a) {
    if (!cv) return;
    const x = cv.getContext("2d"),
      n = D.WHEEL.length,
      cols = ["#ff7a5a", "#ffd23a", "#41c45a", "#2cc4e4", "#8a7fd8", "#c9d5df", "#ff7ad9", "#ffbf1f"];
    x.clearRect(0, 0, 300, 300);
    x.save();
    x.translate(150, 155);
    x.rotate(a);
    for (let i = 0; i < n; i++) {
      x.fillStyle = cols[i];
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, 130, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      x.fill();
      x.save();
      x.rotate(((i + 0.5) / n) * Math.PI * 2);
      x.fillStyle = "#2e3a4a";
      x.font = "900 16px 'M PLUS Rounded 1c', system-ui, sans-serif";
      x.textAlign = "right";
      x.fillText(D.WHEEL[i], 120, 6);
      x.restore();
    }
    x.restore();
    x.strokeStyle = "#fff";
    x.lineWidth = 8;
    x.beginPath();
    x.arc(150, 155, 132, 0, 7);
    x.stroke();
    x.fillStyle = "#2e3a4a";
    x.beginPath();
    x.moveTo(150, 30);
    x.lineTo(138, 6);
    x.lineTo(162, 6);
    x.fill();
  }
  // the Fog Horn Toss: stop the marker in the gold
  function timing(d, claim, result) {
    U.modal(d.icon + " " + esc(d.name), '<p class="lead">Tap (or press Space) when the ring is over the gold.</p><div class="ad-timing" id="ad-timing"><i class="g"></i><i class="p"></i><b></b></div>', {
      buttons: [["toss", "Toss!", "primary"]],
    });
    const t0 = performance.now();
    let pos = 0;
    const step = (now) => {
      pos = (Math.sin((now - t0) / 380) + 1) / 2;
      const b = $("#ad-timing b");
      if (!b) return;
      b.style.left = (pos * 100).toFixed(1) + "%";
      U.anim = requestAnimationFrame(step);
    };
    U.anim = requestAnimationFrame(step);
    H.toss = () => {
      cancelAnimationFrame(U.anim);
      const off = Math.abs(pos - 0.5),
        q = off < 0.05 ? 2 : off < 0.16 ? 1 : 0;
      result(claim({ q }));
    };
  }
  // the Marquee Raffle: scratch three stars
  function scratch(d, claim, result) {
    U.modal(d.icon + " " + esc(d.name), '<p class="lead">Scratch three stars.</p><div class="ad-scratch">' + [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => '<button type="button" data-a="scr" data-i="' + i + '" aria-label="Star ' + (i + 1) + '">★</button>').join("") + "</div>", {
      buttons: [["close", "Later"]],
    });
    // sim.js has already decided: three masks for a win, three different things otherwise
    const r = claim({}),
      syms = r.win ? ["🎭", "🎭", "🎭"] : ["🍿", "🎭", "🌈"];
    let n = 0;
    H.scr = (ds, el) => {
      if (el.disabled || n >= 3) return;
      el.disabled = true;
      el.textContent = syms[n];
      A().sfx("squeak");
      if (++n >= 3) setTimeout(() => result(r), 600);
    };
  }

  /* ---------- the lands' games and quests ---------- */
  const FEAT = {};
  FEAT.garage = () => "<h3>🏠 The garage</h3><div class='ad-acts'>" + btn("panel", "Open the garage", { cls: "tiny primary", data: { p: "garage" } }) + "</div>";
  FEAT.lot = () => "<h3>🐾 Adoption Lot</h3><p class='ad-hint'>Three cars are waiting for a home today.</p><div class='ad-acts'>" + btn("panel", "Visit the lot", { cls: "tiny primary", data: { p: "lot" } }) + "</div>";
  FEAT.fishing = () => "<h3>🎣 Pier 39 Fishing</h3><p class='ad-hint'>Three casts a day. Skill " + S.fish.skill + ". The more you fish, the better the catch.</p><div class='ad-acts'>" + btn("fish", "Cast a line (" + Math.max(0, 3 - S.dailies.fish) + " left)", { cls: "tiny primary", off: S.dailies.fish >= 3 }) + "</div>";
  H.fish = () => {
    A().sfx("whoosh");
    const r = Sim.fish(S);
    U.modal("🎣 Pier 39 Fishing", '<p class="lead ad-prize">' + esc(r.msg || "") + "</p>", { buttons: [["close", "Nice!", "primary"]] });
    WG.adopt.changed();
    U.refresh(true);
  };
  FEAT.bank = () => "<h3>🏦 Credit union</h3><p class='ad-hint'>Daily interest " + (D.INTEREST[S.garage.vault] * 100).toFixed(2) + "% on your Fares. A bigger account (Garage → Credit union account) pays more.</p>";
  FEAT.stocks = () => {
    if (S.player.rank < 12) return "<h3>📈 SF Startup Index</h3><p class='ad-hint'>Opens at Crew Rank 12.</p>";
    let h = "<h3>📈 SF Startup Index <small>prices move every hour</small></h3><ul class='ad-shop'>";
    for (const s of D.STARTUPS) {
      const p = Sim.price(S, s.id),
        own = S.stocks.own[s.id] || 0;
      h += "<li><span class='ii'>📊</span><span class='in'><b>" + s.id + " · " + esc(s.name) + "</b><small>" + esc(s.desc) + " · you own " + own + "</small></span><span class='ip'>◎" + p.toFixed(2) + "</span>" + btn("trade", "Buy 10", { cls: "tiny primary", data: { s: s.id, n: 10 } }) + btn("trade", "Sell 10", { data: { s: s.id, n: -10 }, off: !own }) + "</li>";
    }
    return h + "</ul>";
  };
  H.trade = (ds) => U.act(Sim.trade(S, ds.s, +ds.n), { icon: "📈" });
  FEAT.auction = () => {
    const A0 = Sim.auction(S),
      h0 = Sim.hourIdx(S);
    let h = "<h3>🔨 Auction House <small>bid against the regulars</small></h3><ul class='ad-shop'>";
    A0.lots.forEach((l, i) => {
      const it = item(l.item),
        left = l.ends - h0;
      h += "<li class='" + (l.done ? "out" : "") + "'><span class='ii'>" + it.icon + "</span><span class='in'><b>" + esc(it.name) + "</b><small>" + (l.done ? "Sold to " + esc(l.by === "you" ? "you!" : l.by) : "Top bid: " + esc(l.by === "you" ? "you" : l.by) + " · closes in " + left + " in-game hour" + (left === 1 ? "" : "s")) + "</small></span><span class='ip'>◎" + fmt(l.bid) + "</span>" + (l.done ? "" : btn("bid", "Bid ◎" + fmt(Math.ceil(l.bid * 1.05) + 1), { cls: "tiny primary", data: { i }, off: l.by === "you" })) + "</li>";
    });
    return h + "</ul>";
  };
  H.bid = (ds) => U.act(Sim.bid(S, +ds.i), { icon: "🔨" });
  FEAT.show = () => {
    const t = Sim.showTheme(S),
      e = S.show.entry,
      L = S.show.last;
    let h = "<h3>🎀 The weekly Car Show <small>this week: “" + esc(t.name) + "”</small></h3>";
    h += "<p class='ad-hint'>Charm, Shine, wraps and accessories that suit the theme, and a pinch of luck. Results on Monday.</p>";
    if (e) h += "<p>Entered: <b>" + esc(e.name) + "</b>. Fingers crossed!</p>";
    else h += "<div class='ad-acts'>" + btn("showEnter", "Enter a car", { cls: "tiny primary" }) + "</div>";
    if (L) h += "<p class='ad-hint'>Last week (“" + esc((D.SHOW_THEMES.find((x) => x.id === L.theme) || {}).name || L.theme) + "”): " + L.results.slice(0, 3).map((r, i) => ["🥇", "🥈", "🥉"][i] + " " + esc(r.name)).join(" · ") + (L.place > 3 ? " · yours: #" + L.place : "") + "</p>";
    return h;
  };
  H.showEnter = () =>
    U.pickCar("Enter the Car Show", (id) => {
      const car = Sim.find(S, id);
      U.modal("Enter " + nm(car) + "?", "<p class='lead'>Judges' first impression: " + Math.round(Sim.showScore(S, car, S.show.theme)) + " points (before luck). You can only enter one car a week.</p>", {
        buttons: [
          ["close", "Not yet"],
          ["showOk", "Enter!", "primary", { id }],
        ],
      });
    });
  H.showOk = (ds) => {
    U.closeModal();
    U.act(Sim.showEnter(S, ds.id), { icon: "🎀" });
  };
  FEAT.academy = () => {
    let h = "<h3>🎓 Twin Peaks Driving Academy</h3><p class='ad-hint'>Courses take 1 in-game hour. Pay Fares and a firmware chip; the car studies at the top of the hill and comes back +1 (sometimes +2).</p>";
    const at = S.cars.filter((c) => c.training);
    if (at.length) h += "<ul class='ad-list'>" + at.map((c) => "<li>🎓 " + nm(c) + ": " + D.STATS[c.training.stat].name + ", back " + when(c.training.endsAt) + "</li>").join("") + "</ul>";
    return h + "<div class='ad-acts'>" + btn("enrol", "Enrol a car", { cls: "tiny primary" }) + "</div>";
  };
  H.enrol = () =>
    U.pickCar(
      "Who's going to school?",
      (id) => {
        const car = Sim.find(S, id);
        const rows = D.STAT_KEYS.filter((k) => k !== "smarts")
          .map((k) => {
            const c = Sim.course(car, k),
              ok = Sim.has(S, c.chip) && S.player.fares >= c.fares;
            return "<button type='button' class='ad-pick' data-a='train' data-id='" + id + "' data-k='" + k + "'" + (ok ? "" : " disabled") + "><b>" + D.STATS[k].icon + " " + D.STATS[k].name + " " + car.stats[k] + "</b><small>Level " + c.level + " · " + c.hours + " h · ◎" + c.fares + " + " + item(c.chip).name + (Sim.has(S, c.chip) ? "" : " (you need one)") + "</small></button>";
          })
          .join("");
        U.modal("Courses for " + nm(car), "<p class='lead'>Smarts can't be taught here: it comes from reading map packs and podcasts.</p><div class='ad-picks'>" + rows + "</div>", { buttons: [["close", "Cancel"]] });
      },
      (c) => !c.training,
    );
  H.train = (ds) => {
    U.closeModal();
    U.act(Sim.train(S, ds.id, ds.k), { icon: "🎓" });
  };
  FEAT.riddle = () => {
    const r = Sim.riddle(S);
    let h = "<h3>📡 The Sutro Tower riddle</h3><p>“" + esc(r.q) + "”</p>";
    if (r.done) return h + "<p class='ad-hint'>Sutro Tower has nothing more to ask today.</p>";
    return h + "<div class='ad-acts'>" + r.opts.map((o, i) => btn("answer", esc(o), { data: { i } })).join("") + "</div>";
  };
  H.answer = (ds) => {
    const r = Sim.answerRiddle(S, +ds.i);
    U.modal("📡 Sutro Tower", '<p class="lead ad-prize">' + esc(r.msg) + "</p>");
    A().sfx(r.ok ? "medal" : "fail");
    WG.adopt.changed();
    U.refresh(true);
  };
  FEAT.derby = () => {
    if (S.player.rank < 6) return "<h3>⛰️ Hill Climb Derby</h3><p class='ad-hint'>Opens at Crew Rank 6.</p>";
    return "<h3>⛰️ Hill Climb Derby <small>prizes for 3 races a day (" + Math.max(0, 3 - (S.dailies.derby || 0)) + " left)</small></h3><p class='ad-hint'>A gentle race up the hill against three regulars. Handling, Range and Charm count. No damage, just placing.</p><div class='ad-acts'>" + btn("derby", "Race!", { cls: "tiny primary" }) + "</div>";
  };
  H.derby = () =>
    U.pickCar("Who's racing?", (id) => {
      const r = Sim.derbyStart(S, id);
      if (!r.ok) return U.act(r);
      derbyModal();
    });
  function derbyModal() {
    const race = S.derby.race,
      all = [race.me].concat(race.npcs),
      max = Math.max(30, ...all.map((c) => c.d));
    const lanes = all.map((c) => '<div class="ad-lane' + (c === race.me ? " me" : "") + '"><span>' + esc(c.name) + "</span><i><u style='left:" + ((c.d / (max * 1.05)) * 100).toFixed(1) + "%'>🚗</u></i><small>⚡" + Math.round(c.st) + "</small></div>").join("");
    const snacks = Object.keys(S.inventory).filter((i) => item(i).cat === "snack");
    const btns = race.done
      ? [["close", "Done", "primary"]]
      : [
          ["dmove", "Coast", "", { m: "coast" }],
          ["dmove", "Use a snack" + (snacks.length ? "" : " (none)"), "", { m: "item" }],
          ["dmove", "Push!", "primary", { m: "push" }],
        ];
    U.modal("⛰️ Hill Climb Derby", '<p class="ad-hint">Hairpin ' + Math.min(race.leg + 1, race.legs) + " of " + race.legs + ". Push costs stamina (⚡); coasting and snacks get it back.</p><div class='ad-race'>" + lanes + "</div><ol class='ad-log'>" + race.log.slice(-4).map((l) => "<li>" + esc(l) + "</li>").join("") + "</ol>", { buttons: btns, wide: true });
  }
  H.dmove = (ds) => {
    const snack = Object.keys(S.inventory).find((i) => item(i).cat === "snack");
    const r = Sim.derbyMove(S, ds.m, ds.m === "item" ? snack : null);
    if (!r.ok) return U.toast("🙁", r.msg || "Can't do that.", "bad");
    A().sfx(ds.m === "push" ? "whoosh" : "click");
    if (r.race.done) A().sfx(r.race.place === 1 ? "medal" : "chime", 1);
    WG.adopt.changed();
    derbyModal();
  };
  FEAT.karl = () => {
    const q = S.quests.karl;
    let h = "<h3>🌫️ Karl the Fog</h3>";
    if (!q) return h + "<p class='ad-hint'>On foggy days, Karl sometimes drifts in with a request. His rewards are big and permanent.</p>";
    return h + "<p>Karl wants a <b>" + ic(q.item) + " " + esc(item(q.item).name) + "</b> before " + Sim.fmtClock(q.by % 1440) + ".</p><div class='ad-acts'>" + btn("karl", "Give it to Karl", { cls: "tiny primary", off: !Sim.has(S, q.item) }) + "</div>";
  };
  H.karl = () => U.pickCar("Which car brings it? (It might get the reward.)", (id) => U.act(Sim.karlDeliver(S, id), { icon: "🌫️" }));
  FEAT.rally = () => {
    const r = S.quests.rally;
    let h = "<h3>🏁 Rider Rally <small>one a day</small></h3>";
    if (r && r.day === S.clock.day) return h + "<p>" + r.hoods.map((n) => (r.done.includes(n) ? "✅ " : "◻️ ") + esc(n)).join(" · ") + "</p>" + (r.won ? "<p class='ad-hint'>Won! ◎400 and a Chip-Sutro.</p>" : "<p class='ad-hint'>Any of your cars counts. Send them, or let the rides take them there. Before midnight!</p>");
    return h + "<p class='ad-hint'>Visit five places with your fleet before midnight for ◎400 and a firmware chip.</p><div class='ad-acts'>" + btn("rally", "Start today's rally", { cls: "tiny primary", off: S.clock.night }) + "</div>";
  };
  H.rally = () => U.act(Sim.rallyStart(S), { icon: "🏁" });
  FEAT.stamp_hidden = () => "";
  // a seasonal event's stall and storyline
  function seasonHtml(se) {
    const s = Sim.story(S, se.id);
    let h = '<div class="ad-event"><h3>' + se.icon + " " + esc(se.name) + " <small>until " + se.to.replace("-", "/") + "</small></h3>";
    h += "<p class='ad-hint'>Limited items: they're retired when the event ends.</p><ul class='ad-shop'>";
    for (const id of se.shop) {
      const it = item(id);
      h += "<li><span class='ii'>" + it.icon + "</span><span class='in'><b>" + esc(it.name) + "</b><small>" + esc(rarity(it.rarity)) + "</small></span><span class='ip'>◎" + fmt(it.price) + "</span>" + btn("buySeason", "Buy", { cls: "tiny primary", data: { i: id } }) + "</li>";
    }
    h += "</ul><h3>📖 Storyline <small>a chapter a day</small></h3><ol class='ad-story'>";
    se.story.forEach((ch, i) => {
      const done = i < s.st.done,
        open = i < s.avail;
      h += "<li class='" + (done ? "done" : open ? "now" : "later") + "'><b>" + esc(ch.title) + "</b> " + (open ? esc(ch.text) : "Unlocks on day " + (i + 1) + " of the event.") + (open && !done && i === s.st.done && ch.ask.item ? " " + btn("storyGive", "Hand over " + ic(ch.ask.item), { data: { s: se.id }, off: !Sim.has(S, ch.ask.item) }) : "") + (done ? " ✅" : "") + "</li>";
    });
    h += "</ol>" + (s.st.finished ? "<p class='ad-hint'>🏆 Storyline complete!</p>" : "") + "</div>";
    return h;
  }
  H.buySeason = (ds) => U.act(Sim.buySeason(S, ds.i), { icon: "🛍️" });
  H.storyGive = (ds) => U.act(Sim.storyGive(S, ds.s), { icon: "📖" });
  H.panel = (ds) => U.panel(ds.p);

  /* ---------- inventory ---------- */
  RENDER.inventory = function (o) {
    o = o || {};
    const car = o.car && Sim.find(S, o.car),
      ids = Object.keys(S.inventory).filter((i) => item(i));
    const cats = {};
    for (const id of ids) (cats[item(id).cat] = cats[item(id).cat] || []).push(id);
    let h = "<p class='ad-hint'>Snack fridge: " + Sim.invCount(S) + " / " + Sim.invCap(S) + " items." + (car ? " Using items on <b>" + nm(car) + "</b>." : "") + " Selling goes to the Pawn Shop at half price.</p>";
    if (!ids.length) h += "<p class='lead'>Your fridge is empty. The shops in each land restock every in-game hour.</p>";
    const order = o.look ? ["wrap", "gear", "dashpet", "song"] : Object.keys(D.CAT_NAMES);
    for (const cat of order) {
      if (!cats[cat]) continue;
      h += "<h3>" + D.CAT_NAMES[cat] + "</h3><ul class='ad-shop inv'>";
      for (const id of cats[cat].sort()) {
        const it = item(id),
          fx = it.effect
            ? Object.entries(it.effect)
                .map(([k, v]) => (v > 0 ? "+" : "") + v + " " + (D.NEEDS[k] ? D.NEEDS[k].name : k))
                .join(", ")
            : it.smarts
              ? "+" + it.smarts + " Smarts (once per car)"
              : it.slot
                ? D.SLOTS[it.slot] + (it.charm ? ", +" + it.charm + " Charm" : "")
                : it.bonus
                  ? "Garage: " + Object.entries(it.bonus).map(([k, v]) => "+" + v + " " + k).join(", ")
                  : it.desc || "";
        const use = cat === "chip" || cat === "rare" && !it.effect ? null : cat === "furniture" ? "Place" : cat === "wrap" ? "Paint" : cat === "gear" ? "Wear" : cat === "dashpet" ? "Adopt" : cat === "song" ? "Play" : cat === "read" ? "Read" : "Use";
        h +=
          "<li><span class='ii'>" + it.icon + "</span><span class='in'><b>" + esc(it.name) + (S.inventory[id] > 1 ? " ×" + S.inventory[id] : "") + "</b><small>" + esc(fx) + "</small></span>" +
          (use ? btn("use", use, { cls: "tiny primary", data: { i: id, c: o.car || "" } }) : "") +
          (cat === "song" ? "" : btn("sell", "Sell ◎" + Math.floor(it.price * 0.5), { data: { i: id } })) +
          "</li>";
      }
      h += "</ul>";
    }
    if (o.look && car) h += "<p class='ad-hint'>Wraps are sold at the Painted Ladies Paint Shop (Alamo Square) and the Mural Supply Co.; accessories at the Lantern & Charm Shop; dashpets at the Golden Gate Park Paddock.</p>";
    return { title: o.look ? "Dress up" + (car ? " " + nm(car) : "") : "Inventory", sub: "◎" + fmt(S.player.fares), html: h };
  };
  H.use = (ds) => {
    const it = item(ds.i);
    if (it.cat === "furniture") return U.act(Sim.placeFurniture(S, ds.i), { icon: "🪴" });
    const go = (id) => {
      const r = U.act(Sim.useItem(S, id, ds.i), { icon: it.icon, sfx: it.cat === "song" ? "bubble" : "chime" });
      if (r && r.ok) WG.adoptMap.hop(id);
    };
    if (ds.c) go(ds.c);
    else U.pickCar("Use " + esc(it.name) + " on…", go);
  };
  H.sell = (ds) => U.act(Sim.sell(S, ds.i), { icon: "💰", sfx: "ding" });

  /* ---------- the album ---------- */
  RENDER.album = function (tab) {
    tab = tab || "stamps";
    const tabs = [
      ["stamps", "📮 Stamps"],
      ["cards", "🃏 Rider Cards"],
      ["wraps", "🎨 Wraps"],
      ["pets", "🐾 Dashpets"],
      ["songs", "🎵 Playlist"],
      ["trophies", "🏆 Trophies"],
    ];
    let h = "<div class='ad-tabs' role='tablist'>" + tabs.map(([k, l]) => '<button type="button" role="tab" aria-selected="' + (k === tab) + '" data-a="tab" data-t="' + k + '">' + l + "</button>").join("") + "</div>";
    if (tab === "stamps") {
      const got = Object.keys(S.album.stamps).length;
      h += "<p class='ad-hint'>" + got + " of " + D.STAMPS.length + " stamps. The first time any of your cars visits a landmark in the right conditions, you might get its stamp and a postcard.</p><div class='ad-stamps'>";
      for (const s of D.STAMPS) {
        const g = S.album.stamps[s.name];
        h += g
          ? "<figure class='got'><img data-pc='" + esc(g.img || "") + "' alt='Postcard: " + esc(s.name) + "'><figcaption><b>" + esc(s.name) + "</b><small>" + esc(g.carName) + ", day " + g.day + "</small></figcaption></figure>"
          : "<figure><div class='ph'>" + (s.hidden ? "❔" : "📮") + "</div><figcaption><b>" + (s.hidden ? "???" : esc(s.name)) + "</b><small>" + (s.hidden ? "Hidden" : esc(s.hood) + ", " + esc(s.when === "any" ? "any time" : s.when)) + "</small></figcaption></figure>";
      }
      h += "</div>";
      return {
        title: "Album",
        sub: "Stamps",
        html: h,
        after: (b) =>
          $$("img[data-pc]", b).forEach((im) => {
            if (!im.dataset.pc) return (im.replaceWith(Object.assign(document.createElement("div"), { className: "ph", textContent: "📮" })));
            St.getCard(im.dataset.pc).then((u) => (u ? (im.src = u) : im.replaceWith(Object.assign(document.createElement("div"), { className: "ph", textContent: "📮" }))));
          }),
      };
    }
    if (tab === "cards") {
      h += "<p class='ad-hint'>Riders sometimes leave a card after a ride: common, holo, and very rarely secret.</p><div class='ad-cards'>";
      for (const r of D.RIDER_KEYS) {
        const f = S.riders[r];
        h += "<div class='ad-rider'><b>" + D.RIDERS[r].icon + " " + esc(D.RIDERS[r].name) + "</b><small>Friendship " + (f ? f.friend : 0) + " · " + (f ? f.rides : 0) + " rides</small><div>";
        for (const t of ["c", "h", "s"]) {
          const id = r.toLowerCase() + "_" + t,
            n = S.album.cards[id];
          h += "<span class='ad-card " + t + (n ? " got" : "") + "' title='" + esc(D.CARDS[id].name) + "'>" + (n ? esc(D.CARDS[id].name) + (n > 1 ? " ×" + n : "") : "?") + "</span>";
        }
        h += "</div></div>";
      }
      return { title: "Album", sub: "Rider Cards", html: h + "</div>" };
    }
    if (tab === "wraps") {
      h += "<div class='ad-grid'>";
      for (const [k, w] of Object.entries(D.WRAPS)) {
        const got = S.album.wraps.includes(k);
        h += "<div class='ad-sw " + (got ? "got" : "") + "'><i style='background:" + w.tint + ";border-color:" + w.ring + "'></i><small>" + (got ? esc(w.name) : "???") + "</small></div>";
      }
      return { title: "Album", sub: "Wraps", html: h + "</div>" };
    }
    if (tab === "pets") {
      h += "<div class='ad-grid'>";
      for (const [k, p] of Object.entries(D.DASHPETS)) {
        const got = S.album.dashpets.includes(k);
        h += "<div class='ad-sw " + (got ? "got" : "") + "'><span class='big'>" + (got ? p.icon : "❔") + "</span><small>" + (got ? esc(p.name) : "???") + "</small></div>";
      }
      return { title: "Album", sub: "Dashpets", html: h + "</div>" };
    }
    if (tab === "songs") {
      h += "<p class='ad-hint'>The Playlist Club: which songs each car has heard on its radio. Buy songs in the shops; play them from the inventory.</p><ul class='ad-list'>";
      for (const id of Object.keys(D.ITEMS).filter((i) => item(i).cat === "song")) {
        const who = (S.album.playlist[id] || []).map((cid) => Sim.find(S, cid)).filter(Boolean);
        h += "<li>🎵 <b>" + esc(item(id).name) + "</b>: " + (who.length ? who.map((c) => nm(c)).join(", ") : "nobody yet") + "</li>";
      }
      return { title: "Album", sub: "Playlist Club", html: h + "</ul>" };
    }
    // trophies and avatars
    h += "<div class='ad-grid'>";
    for (const [k, t] of Object.entries(D.TROPHIES)) {
      const got = S.player.trophies.includes(k);
      h += "<div class='ad-sw " + (got ? "got" : "") + "' title='" + esc(t.desc) + "'><span class='big'>" + (got ? t.icon : "🔒") + "</span><small>" + esc(t.name) + "</small></div>";
    }
    h += "</div><h3>Avatar</h3><div class='ad-acts'>" + S.player.avatars.map((a) => btn("avatar", D.AVATARS[a] || a, { cls: "tiny" + (S.player.avatar === a ? " primary" : ""), data: { v: a } })).join("") + "</div>";
    return { title: "Album", sub: "Trophies", html: h };
  };
  H.tab = (ds) => {
    U.open.arg = ds.t;
    render(true);
    A().sfx("click");
  };
  H.avatar = (ds) => {
    S.player.avatar = ds.v;
    U.refresh(true);
  };

  /* ---------- the arcade ---------- */
  const GAMES = ["dirty", "charge", "cone", "birds", "reboot", "vacuum", "doors"];
  RENDER.arcade = function () {
    let h = "<p class='lead'>Every pit-crew job, played on its own. Each game pays Fares for its first " + D.ARCADE.plays + " plays a day, and keeps your best score. Bronze, silver and gold trophies at " + D.ARCADE.tiers.join(", ") + ".</p><ul class='ad-shop'>";
    for (const k of GAMES) {
      const best = S.arcade.best[k] || 0,
        tier = S.arcade.trophies[k] || 0,
        left = Math.max(0, D.ARCADE.plays - (S.dailies.gamePlays[k] || 0));
      h += "<li><canvas width='64' height='64' data-icon='" + k + "'></canvas><span class='in'><b>" + esc(WG.jobs.TITLE[k]) + " " + ["", "🥉", "🥈", "🥇"][tier] + "</b><small>Best " + fmt(best) + " · " + (left ? left + " paid play" + (left > 1 ? "s" : "") + " left today" : "for fun (no more pay today)") + "</small></span>" + btn("play", "Play", { cls: "tiny primary", data: { k } }) + "</li>";
    }
    h += "</ul><p class='ad-hint'>🕹️ The arcade shifts from the title screen pay into your garage too: once a day, up to ◎" + D.ARCADE.runCap + (S.dailies.run ? " (already paid today)" : "") + ".</p>";
    return { title: "Arcade", sub: "Games for Fares", html: h, after: (b) => $$("canvas[data-icon]", b).forEach((cv) => WG.drawIcon(cv.getContext("2d"), cv.dataset.icon, 32, 34, 1)) };
  };
  H.play = (ds) => {
    U.closeModal();
    U.close();
    WG.adopt.arcade(ds.k);
  };
  U.arcadeResult = function (k, r) {
    U.modal(
      "🕹️ " + esc(WG.jobs.TITLE[k]),
      "<div class='big-num'><small>Score</small><b>" + fmt(r.score) + "</b></div><p class='lead'>" + (r.newBest ? "New best! " : "") + (r.tier ? ["", "Bronze", "Silver", "Gold"][r.tier] + " trophy score. " : "") + (r.paid ? "+◎" + r.paid + " (" + r.left + " paid play" + (r.left === 1 ? "" : "s") + " left today)" : "Just for fun: today's pay for this game is used up.") + "</p>",
      {
        buttons: [
          ["close", "Back to the map"],
          ["play", "Again!", "primary", { k }],
        ],
      },
    );
  };

  /* ---------- the garage ---------- */
  RENDER.garage = function () {
    let h = "<h3>🚗 The fleet <small>" + S.cars.length + " of " + S.unlocked.carSlots + " car slots</small></h3><ul class='ad-shop'>";
    for (const c of S.cars) h += "<li><canvas width='96' height='64' data-car='" + c.id + "'></canvas><span class='in'><b>" + nm(c) + "</b><small>" + esc(Sim.doing(c)) + "</small></span>" + btn("profile", "Profile", { data: { id: c.id } }) + btn("store", "Rest", { data: { id: c.id }, off: S.cars.length < 2 }) + "</li>";
    for (const c of S.stored) h += "<li class='out'><canvas width='96' height='64' data-car='" + c.id + "'></canvas><span class='in'><b>" + nm(c) + "</b><small>Resting in the lot</small></span>" + btn("activate", "On the road", { cls: "tiny primary", data: { id: c.id }, off: S.cars.length >= S.unlocked.carSlots }) + btn("rehome", "Rehome", { data: { id: c.id } }) + "</li>";
    h += "</ul><p class='ad-hint'>More car slots at Crew Rank 2, 5 and 9. " + btn("panel", "Adoption Lot", { data: { p: "lot" } }) + "</p>";
    h += "<h3>🔧 Upgrades</h3><ul class='ad-shop'>";
    for (const [k, g] of Object.entries(D.GARAGE)) {
      const cost = Sim.upgradeCost(S, k),
        lv = S.garage[k];
      h += "<li><span class='ii'>" + g.icon + "</span><span class='in'><b>" + esc(g.name) + " · " + (k === "bays" ? lv + " bay" + (lv > 1 ? "s" : "") : "level " + lv) + "</b><small>" + esc(g.desc) + "</small></span>" + (cost == null ? "<em>Maxed</em>" : btn("upgrade", "◎" + fmt(cost), { cls: "tiny primary", data: { k }, off: S.player.fares < cost })) + "</li>";
    }
    h += "</ul><h3>🛋️ Rooms <small>" + S.garage.furniture.length + " / " + Sim.roomSlots(S) + " furniture slots</small></h3><ul class='ad-shop'>";
    S.garage.furniture.forEach((f, i) => {
      const it = item(f);
      h += "<li><span class='ii'>" + it.icon + "</span><span class='in'><b>" + esc(it.name) + "</b><small>" + Object.entries(it.bonus).map(([k, v]) => "+" + v + " " + k).join(", ") + " for every car</small></span>" + btn("unplace", "Put away", { data: { i } }) + "</li>";
    });
    const have = Object.keys(S.inventory).filter((i) => item(i) && item(i).cat === "furniture");
    if (have.length) h += have.map((f) => "<li><span class='ii'>" + ic(f) + "</span><span class='in'><b>" + esc(item(f).name) + "</b><small>in your inventory</small></span>" + btn("use", "Place", { cls: "tiny primary", data: { i: f } }) + "</li>").join("");
    h += "</ul>";
    return { title: "The Garage", sub: "Russian Hill", html: h, after: (b) => $$("canvas[data-car]", b).forEach((cv) => U.portrait(cv, Sim.find(S, cv.dataset.car))) };
  };
  H.profile = (ds) => U.panel("profile", ds.id);
  H.upgrade = (ds) => U.act(Sim.upgrade(S, ds.k), { icon: "🔧", sfx: "medal" });
  H.unplace = (ds) => U.act(Sim.removeFurniture(S, +ds.i));
  H.rehome = (ds) => {
    const car = Sim.find(S, ds.id);
    U.modal("Rehome " + nm(car) + "?", "<p class='lead'>" + nm(car) + " will go to a lovely new home and won't come back. Its accessories return to your inventory. This can't be undone.</p>", {
      buttons: [
        ["close", "Keep it", "primary"],
        ["rehomeOk", "Rehome", "", { id: car.id }],
      ],
    });
  };
  H.rehomeOk = (ds) => {
    U.closeModal();
    U.act(Sim.rehome(S, ds.id), { icon: "💌" });
  };

  /* ---------- the Adoption Lot ---------- */
  RENDER.lot = function () {
    const lot = Sim.lot(S),
      fee = Sim.adoptFee(S),
      full = S.cars.length >= S.unlocked.carSlots;
    let h = "<p class='lead'>Three cars are looking for a home today. New faces every morning. " + (fee ? "Adopting costs ◎" + fmt(fee) + "." : "<b>Your first adoption is free!</b>") + "</p>";
    if (full) h += "<p class='ad-hint'>Your car slots are full: a car you adopt now waits in the lot until you swap it in from the Garage.</p>";
    if (!lot.cars.length) h += "<p class='ad-hint'>Everybody found a home today! Come back tomorrow.</p>";
    lot.cars.forEach((c, i) => {
      const w = D.WRAPS[c.wrap];
      h += "<div class='ad-lotcar'><canvas width='180' height='112' data-lot='" + i + "'></canvas><div><b>" + esc(w.name) + (c.wrap !== "default" && D.ITEMS["wrap_" + c.wrap] && D.ITEMS["wrap_" + c.wrap].rarity >= 55 ? " ✨ rare!" : "") + "</b><p>" + c.traits.map((t) => D.TRAITS[t].icon + " " + D.TRAITS[t].name).join(" · ") + "</p><p class='ad-hint'>" + esc(c.story) + "</p><p class='ad-hint'>Loves " + esc(c.likes.hood) + ".</p>" + btn("adopt", fee ? "Adopt · ◎" + fmt(fee) : "Adopt · free!", { cls: "tiny primary", data: { i }, off: S.player.fares < fee }) + "</div></div>";
    });
    return { title: "Adoption Lot", sub: "Russian Hill", html: h, after: (b) => $$("canvas[data-lot]", b).forEach((cv) => U.portrait(cv, lot.cars[+cv.dataset.lot], true)) };
  };
  H.adopt = (ds) => {
    const c = Sim.lot(S).cars[+ds.i];
    U.modal("Name your car", "<p class='lead'>What will you call this " + esc(D.WRAPS[c.wrap].name) + " robotaxi?</p><label class='ad-field'>Name <input id='ad-name' maxlength='14' value='" + esc(c.name) + "' autocomplete='off'></label><p class='ad-hint' id='ad-name-err'></p>", {
      buttons: [
        ["close", "Back"],
        ["adoptOk", "Adopt!", "primary", { i: ds.i }],
      ],
      after: (b) => setTimeout(() => $("#ad-name", b).select(), 50),
    });
  };
  H.adoptOk = (ds) => {
    const v = $("#ad-name").value,
      bad = Sim.validName(S, v);
    if (bad) return ($("#ad-name-err").textContent = bad);
    const r = Sim.adopt(S, +ds.i, v);
    if (!r.ok) return ($("#ad-name-err").textContent = r.msg);
    U.closeModal();
    WG.adopt.adopted(r.car);
  };

  /* ---------- the diary and the inbox ---------- */
  RENDER.diary = function () {
    let h = S.diary.length ? "" : "<p class='lead'>Nothing yet. Dispatch writes it up every night.</p>";
    for (const d of S.diary) h += "<h3>Day " + d.day + "</h3><ul class='ad-list diary'>" + d.lines.map((l) => "<li>" + esc(l) + "</li>").join("") + "</ul>";
    return { title: "Diary", sub: "As told by Dispatch", html: h };
  };
  RENDER.inbox = function () {
    let h = S.inbox.length ? "" : "<p class='lead'>No news. Enjoy the quiet.</p>";
    // the open rider requests first
    const asks = D.RIDER_KEYS.filter((r) => S.riders[r] && S.riders[r].request);
    if (asks.length) {
      h += "<h3>Rider requests</h3><ul class='ad-shop'>";
      for (const r of asks) {
        const q = S.riders[r].request,
          it = item(q.item);
        h += "<li><span class='ii'>" + D.RIDERS[r].icon + "</span><span class='in'><b>" + esc(D.RIDERS[r].name) + " wants " + it.icon + " " + esc(it.name) + "</b><small>By " + esc(Sim.fmtWhen(q.by)) + (Sim.has(S, q.item) ? " · you have one!" : " · find it in a shop") + "</small></span>" + btn("deliver", "Deliver", { cls: "tiny primary", data: { r }, off: !Sim.has(S, q.item) }) + "</li>";
      }
      h += "</ul>";
    }
    if (S.quests.karl) h += "<p class='ad-hint'>🌫️ Karl the Fog wants a " + esc(item(S.quests.karl.item).name) + ". Find him at Ocean Beach.</p>";
    h += "<ul class='ad-list inbox'>" + S.inbox.map((m) => "<li class='" + (m.read ? "" : "new") + "'><span>" + esc(m.icon) + "</span> " + esc(m.text) + " <small>" + esc(Sim.fmtWhen(m.at)) + "</small></li>").join("") + "</ul>";
    setTimeout(() => S.inbox.forEach((m) => (m.read = true)), 400);
    return { title: "Inbox", sub: "News, requests and results", html: h };
  };
  H.deliver = (ds) => U.pickCar("Which car delivers it?", (id) => U.act(Sim.deliver(S, ds.r, id), { icon: D.RIDERS[ds.r].icon }));

  /* ---------- how to play ---------- */
  RENDER.help = function () {
    const h = `
      <p class="lead">Adopt robotaxis as pets. They drive themselves round San Francisco, give rides, earn Fares (◎) and come home to the garage at night. Nothing ever breaks for good: a neglected car just sulks until you make it up to it.</p>
      <ul class="ad-list">
        <li>🗺️ <b>The map</b>: drag to pan, wheel or pinch to zoom, <kbd>Q</kbd>/<kbd>E</kbd> to turn. <kbd>WASD</kbd> or the arrows pan too.</li>
        <li>🚗 <b>Cars</b>: tap a car's name tag (or its card at the bottom) to follow it; tap again for its profile. Drag a name tag onto a neighbourhood to send it there.</li>
        <li>🔋 <b>Needs</b>: Charge, Shine, Cozy, Senses and Clarity drop as a car drives. A bubble shows the most urgent. Use items anywhere, or call the car to a Care Spot 🔧 and do the job by hand (more bond).</li>
        <li>★ <b>Lands</b>: each neighbourhood with a label is a land, with a shop, a daily freebie (★ when it's waiting) and things to do. More open as your Crew Rank rises.</li>
        <li>❤️ <b>Bond</b>: pats, items and hands-on care earn hearts. Hearts unlock a nickname, a horn, the lidar dance, Ride Along and a trait upgrade.</li>
        <li>🌙 <b>Days</b>: an in-game day is about 13 minutes. At midnight the cars drive home and Dispatch writes the diary. The lands' dailies come back every in-game morning.</li>
        <li>⏸ <b>Speed</b>: 1×, 2×, 4× or paused at the top. <kbd>Space</kbd> pauses. <kbd>Esc</kbd> closes a panel or opens the menu.</li>
      </ul>`;
    return { title: "How to Play", sub: "Adopt-a-Waymo", html: h };
  };

  /* ---------- the night: Dispatch's diary of the day, then sleep ---------- */
  U.night = function () {
    const lines = Sim.diary(S);
    WG.game.VOX.say("adopt.diary");
    U.modal("📔 Day " + S.clock.day, "<ul class='ad-list diary'>" + lines.map((l) => "<li>" + esc(l) + "</li>").join("") + "</ul>", {
      sub: "Everybody's home · the diary, by Dispatch",
      buttons: [["sleep", "Sleep → next morning", "primary"]],
    });
    U.diaryLines = lines;
  };
  H.sleep = () => {
    Sim.sleep(S, false, U.diaryLines);
    U.diaryLines = null;
    U.closeModal();
    WG.game.VOX.say("adopt.morning");
    WG.adopt.changed();
  };

  /* ---------- the menu (Esc / P) ---------- */
  U.menu = function () {
    const off = S.settings.offline;
    U.modal(
      "Paused",
      '<div class="pz-set" role="group" aria-label="Settings">' +
        '<button type="button" class="tgl" data-a="setOff" role="switch" aria-checked="' + (off === "gentle") + '"><span>Fleet keeps going while I\'m away (gently)</span><i aria-hidden="true"></i></button>' +
        '<button type="button" class="tgl" data-a="setMusic" role="switch" aria-checked="' + A().musicOn + '"><span>Music</span><i aria-hidden="true"></i></button>' +
        '<button type="button" class="tgl" data-a="setVoice" role="switch" aria-checked="' + WG.game.VOX.on + '"><span>Voices &amp; captions</span><i aria-hidden="true"></i></button>' +
        "</div><p class='ad-hint'>Away, the fleet runs at a sixth of the speed for up to a day, and needs never drop below 25. Turn it off to stop the clock while you're gone.</p>",
      {
        buttons: [
          ["quit", "Save & quit to title"],
          ["helpOpen", "How to play"],
          ["close", "Resume", "primary"],
        ],
        onClose: () => WG.adopt.resume(),
      },
    );
    WG.adopt.pauseFor(true);
  };
  H.setOff = (ds, el) => {
    S.settings.offline = S.settings.offline === "gentle" ? "paused" : "gentle";
    el.setAttribute("aria-checked", String(S.settings.offline === "gentle"));
  };
  H.setMusic = (ds, el) => {
    A().setMusicOn(!A().musicOn);
    el.setAttribute("aria-checked", String(A().musicOn));
  };
  H.setVoice = (ds, el) => {
    WG.game.VOX.setOn(!WG.game.VOX.on);
    el.setAttribute("aria-checked", String(WG.game.VOX.on));
  };
  H.quit = () => {
    U.closeModal();
    WG.adopt.exit();
  };
  H.helpOpen = () => {
    U.closeModal();
    U.panel("help");
  };

  /* ---------- the tutorial: a few coach cards after the first adoption ---------- */
  const COACH = [
    "This is {car} on the map! Tap its name tag (or its card down below) to follow it. Tap again to open its profile.",
    "Cars drive themselves between neighbourhoods and give rides for Fares (◎). The bubble over a car shows its most urgent need.",
    "When a need gets low, use an item from your inventory, or call the car to a Care Spot 🔧 and do the job by hand: the best care there is.",
    "Labelled neighbourhoods are lands, each with a shop and a free daily (★). Start with the Lombard Zigzag Spin at Russian Hill, right by your garage!",
  ];
  U.coach = function () {
    const box = $("#ad-coach");
    if (S.tut < 1 || S.tut > COACH.length || !S.cars.length) return (box.hidden = true);
    box.hidden = false;
    $("p", box).textContent = COACH[S.tut - 1].replace("{car}", S.cars[0].nick || S.cars[0].name);
    $("small", box).textContent = S.tut + " / " + COACH.length;
  };
  U.welcome = function () {
    WG.game.VOX.say("adopt.welcome");
    U.modal(
      "Welcome to the garage!",
      "<p class='lead'>Dispatch here. Congratulations: you're adopting a robotaxi. It'll drive itself round San Francisco, give rides and come home at night. You look after it: charge, washes, crumbs, pigeons, the occasional reboot.</p><p class='lead'>Nothing ever breaks for good. Worst case, it sulks.</p><p class='ad-hint'>Your first adoption is free. Three cars are waiting in the lot.</p>",
      { buttons: [["lotOpen", "Visit the Adoption Lot 🐾", "primary"]], sub: "Adopt-a-Waymo" },
    );
  };
  H.lotOpen = () => {
    U.closeModal();
    U.panel("lot");
  };

  /* ---------- set up ---------- */
  U.init = function (state) {
    S = state;
    if (U.ready) return;
    U.ready = true;
    // every data-a button, in the panel or a modal
    const click = (e) => {
      const b = e.target.closest("[data-a]");
      if (!b || b.disabled) return;
      const f = H[b.dataset.a];
      if (f) {
        WG.game.A.init();
        f(b.dataset, b);
      }
    };
    $("#ad-panel").addEventListener("click", click);
    $("#ad-modal").addEventListener("click", click);
    $("#ad-panel .ad-ph button.x").addEventListener("click", () => U.close());
    for (const b of $$("#ad-dock button")) b.addEventListener("click", () => (U.open && U.open.kind === b.dataset.p ? U.close() : U.panel(b.dataset.p)));
    for (const b of $$("#ad-speed button"))
      b.addEventListener("click", () => {
        S.settings.speed = +b.dataset.sp;
        b.blur();
        A().sfx("click");
        top();
      });
    $("#ad-inbox-btn").addEventListener("click", () => (U.open && U.open.kind === "inbox" ? U.close() : U.panel("inbox")));
    $("#ad-menu-btn").addEventListener("click", () => U.menu());
    // at night, the clock opens the diary (and bed)
    $(".ad-clock").addEventListener("click", () => S.clock.night && S.clock.sleepReady && !U.modalOpen && U.night());
    $("#ad-coach button").addEventListener("click", () => {
      S.tut++;
      A().sfx("click");
      U.coach();
    });
    // the map's tag and label taps come through main.js
  };
  U.bind = (state) => (S = state);
  U.update = function () {
    if (!S) return;
    top();
    carStrip();
    live();
  };
  U.show = function (on) {
    $("#adopt").hidden = !on;
    if (!on) {
      U.close();
      U.closeModal();
    }
  };
  WG.adoptUI = U;
})();
