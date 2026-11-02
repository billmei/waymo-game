/* Waymo Care · Sunday Drive · the mode itself. WG.sunday is what js/game.js calls while the game is in the sunday
   (bird's-eye city), sundayCare (a hands-on swoop) or sundayPhoto (the viewfinder) state. It loads the save, runs the
   city and its clouds, keeps the top bar, car inspector and scrapbook in step, awards Map Seals, opens districts, and
   turns the map's events into toasts and music. */
(function () {
  "use strict";
  const WG = window.WG,
    W = WG.world,
    I = WG.isle,
    City = WG.sundayCity,
    Clouds = WG.sundayClouds,
    Swoop = WG.sundaySwoop,
    Photo = WG.sundayPhoto,
    Album = WG.sundayAlbum;
  const K = W.SCALE;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const clock = (s) => {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };
  const A = () => WG.game.A;

  const COACH = [
    "This is your Sunday city. Drag to look around, roll the wheel to zoom, and right-drag (or Q / E) to turn the map.",
    "Tap a Waymo to meet it. A bubble over a car means it could use a hand; if you leave it, the neighbourhood depot quietly sorts it out after three minutes.",
    "Take Care swoops you down for a real job. Every three hands-on cares earns a Map Seal; unique landmark postcards and every ten cross-town fares do too.",
    "Reach each cloudy neighbourhood's Map Seal goal to part the clouds. P opens Photo Mode, and the scrapbook keeps every postcard and thank-you note.",
  ];

  const SU = {
    active: false,
    S: null,
    booted: false,
    t: 0,
    saveT: 0,
    uiT: 0,
    inspect: null,
    inspectKey: "",
    coachStep: 0,
    modalOpen: false,
    bookOpen: false,
    ride: null,
    lastTap: 0,
    lastTapX: 0,
    lastTapY: 0,
  };
  let ptrs = new Map(),
    drag = null,
    pinch = null;

  /* ---------- save ---------- */
  function load() {
    const s = Album.load();
    if (!Array.isArray(s.unlockedDistricts) || !s.unlockedDistricts.length)
      s.unlockedDistricts = ["lombard"];
    if (!s.unlockedDistricts.includes("lombard"))
      s.unlockedDistricts.unshift("lombard");
    return s;
  }
  function save() {
    if (SU.S) Album.save(SU.S);
  }
  const unlockedSet = () => new Set(SU.S.unlockedDistricts);
  function prevDistrict(id) {
    const i = City.order.indexOf(id);
    if (i <= 0) return null;
    const prev = City.order[i - 1];
    return unlockedSet().has(prev) ? null : City.districts[prev];
  }
  function canUnlock(id) {
    const d = City.districts[id];
    if (!d || unlockedSet().has(id)) return false;
    if (SU.S.mapSeals < d.cost) return false;
    return !prevDistrict(id);
  }

  /* ---------- toasts ---------- */
  function toast(icon, text, tone) {
    const box = $("#su-toasts");
    if (!box) return;
    const e = document.createElement("div");
    e.className = "su-toast " + (tone || "");
    e.innerHTML =
      '<span class="ti">' + esc(icon || "✨") + "</span><span>" + esc(text) + "</span>";
    box.appendChild(e);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => e.classList.add("out"), 5200);
    setTimeout(() => e.remove(), 5700);
  }

  /* ---------- top bar ---------- */
  function nearestDistrict() {
    const c = City.cam;
    const open = SU.S ? new Set(SU.S.unlockedDistricts) : null;
    let best = "lombard",
      bd = Infinity;
    for (const id of City.order) {
      if (open && !open.has(id)) continue;
      const d = City.districts[id],
        dd = Math.hypot(d.x * K - c.x, d.z * K - c.z);
      if (dd < bd) {
        bd = dd;
        best = id;
      }
    }
    return best;
  }
  function currentDistrict() {
    if (City.cam.follow) {
      const car = City.cars.find((q) => q.id === City.cam.follow);
      if (car) return car.district;
    }
    return nearestDistrict();
  }
  function updateTop() {
    if (!SU.S) return;
    const S = SU.S,
      id = currentDistrict(),
      d = City.districts[id] || City.districts.lombard;
    $("#su-district").textContent = d.name;
    $("#su-weather").textContent = d.quirkShort;
    $("#su-seals").textContent = fmt(S.mapSeals);
    $("#su-cared").textContent = fmt(S.totalCared);
    $("#su-fares").textContent = fmt(S.faresDelivered);
    $("#su-seals").parentNode.title =
      "Map Seals: " +
      S.mapSeals +
      ". Three hands-on cares, a new landmark postcard, or ten cross-town fares each add one.";
  }

  /* ---------- coach ---------- */
  function coach() {
    const box = $("#su-coach");
    if (!box || !SU.S) return;
    const first =
      SU.S.totalCared === 0 &&
      SU.S.faresDelivered === 0 &&
      SU.S.postcards.length === 0 &&
      SU.S.mapSeals === 0;
    if (!first || SU.coachStep >= COACH.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    $("p", box).textContent = COACH[SU.coachStep];
    $("small", box).textContent = SU.coachStep + 1 + " / " + COACH.length;
  }

  /* ---------- the inspector ---------- */
  function carById(id) {
    return City.cars.find((c) => c.id === id) || null;
  }
  function renderInspect(force) {
    const box = $("#su-inspect"),
      car = SU.inspect ? carById(SU.inspect) : null;
    if (!box) return;
    if (!car) {
      box.hidden = true;
      SU.inspect = null;
      SU.inspectKey = "";
      return;
    }
    const d = City.districts[car.district] || City.districts.lombard,
      need = car.need,
      rider = car.passenger && car.passenger.rider,
      key = [
        car.id,
        need && need.kind,
        car.passenger && car.passenger.to,
        City.cam.ride === car.id ? "ride" : "",
      ].join("|");
    if (!force && key === SU.inspectKey) {
      const t = box.querySelector(".su-need-time");
      if (t && need) t.textContent = clock(need.left) + " until the depot";
      return;
    }
    SU.inspectKey = key;
    box.hidden = false;
    const route = car.passenger
      ? esc(rider.icon + " " + rider.name + " · " + City.districtName(car.passenger.from) + " → " + City.districtName(car.passenger.to))
      : "Between fares · cruising " + esc(d.short);
    box.innerHTML =
      '<div class="su-i-head">' +
      '<div class="su-avatar" aria-hidden="true">🚕</div>' +
      "<div><h3>" +
      esc(car.name) +
      '</h3><div class="su-plate">' +
      esc(car.plate) +
      "</div></div>" +
      '<button type="button" class="su-close" data-a="close" aria-label="Close">✕</button>' +
      "</div>" +
      '<p class="su-route">' +
      route +
      "</p>" +
      (need
        ? '<div class="su-need"><canvas width="64" height="64"></canvas><span>' +
          esc(need.label) +
          ' · <b class="su-need-time">' +
          clock(need.left) +
          " until the depot</b></span></div>"
        : '<p class="su-route">All good · nothing needed right now.</p>') +
      '<div class="su-btns">' +
      '<button type="button" class="btn warm" data-a="care"' +
      (need ? "" : " disabled") +
      ">Take Care</button>" +
      '<button type="button" class="btn" data-a="auto"' +
      (need ? "" : " disabled") +
      ">Auto-Care</button>" +
      '<button type="button" class="btn ride" data-a="ride">' +
      (City.cam.ride === car.id ? "End Ride" : "Ride Along") +
      "</button>" +
      "</div>";
    const cv = box.querySelector(".su-need canvas");
    if (cv && need)
      WG.drawIcon(cv.getContext("2d"), need.kind, 32, 34, 1);
  }
  function showInspect(car) {
    SU.inspect = car.id;
    SU.inspectKey = "";
    renderInspect(true);
    A().sfx("select");
  }
  function closeInspect() {
    SU.inspect = null;
    SU.inspectKey = "";
    const b = $("#su-inspect");
    if (b) b.hidden = true;
  }

  /* ---------- district cards and unlocking ---------- */
  function showDistrict(id) {
    const d = City.districts[id],
      open = unlockedSet().has(id);
    if (open) {
      focusDistrict(id);
      return;
    }
    const can = canUnlock(id),
      prev = prevDistrict(id);
    SU.inspect = null;
    SU.inspectKey = "";
    const box = $("#su-inspect");
    box.hidden = false;
    box.innerHTML =
      '<div class="su-locked">' +
      '<div class="big">🔒 ' +
      esc(d.name) +
      "</div>" +
      '<div class="req">' +
      d.cost +
      " Map Seals needed · you have " +
      SU.S.mapSeals +
      "</div>" +
      '<p class="quirk">' +
      esc(d.quirk) +
      "</p>" +
      '<p class="quirk">' +
      esc(d.stem) +
      " joins the music here.</p>" +
      '<button type="button" class="btn ' +
      (can ? "warm" : "") +
      '" data-a="unlock" data-id="' +
      esc(id) +
      '"' +
      (can ? "" : " disabled") +
      ">" +
      (can
        ? "Unlock " + esc(d.short)
        : prev
          ? "Open " + esc(prev.short) + " first"
          : "Keep earning seals") +
      "</button>" +
      "</div>";
    A().sfx("back");
  }
  function unlockDistrict(id) {
    const d = City.districts[id],
      S = SU.S;
    if (!d || unlockedSet().has(id)) return focusDistrict(id);
    const prev = prevDistrict(id);
    if (prev) {
      toast("🗺️", "Open " + prev.short + " first, then " + d.short + " can join the map.", "");
      A().sfx("back");
      return;
    }
    if (S.mapSeals < d.cost) {
      toast("🗺️", "You need " + (d.cost - S.mapSeals) + " more Map Seals for " + d.short + ".", "");
      A().sfx("back");
      return;
    }
    S.unlockedDistricts.push(id);
    save();
    cityChanged();
    Clouds.part(id);
    City.startCeremony(id);
    W.setLook(d.look);
    A().setSundayStems(unlockedSet());
    A().sfx("medal");
    toast("☁️", "The clouds part over " + d.name + "! " + d.stem + " joins the music.", "good");
    closeInspect();
    if (SU.modalOpen) closeModal();
  }
  function focusDistrict(id) {
    const d = City.districts[id];
    if (!d) return;
    City.focusDistrict(id);
    W.setLook(d.look);
    closeInspect();
    toast("📍", d.name + " · " + d.quirkShort, "");
    A().sfx("select");
  }
  function cityChanged() {
    const S = SU.S;
    City.setUnlocked(unlockedSet());
    City.sync(S);
    City.refreshLabels(S);
    City.refreshRoads(S);
    Clouds.sync(S);
    updateTop();
  }

  /* ---------- seals ---------- */
  function addSeal(n, why) {
    SU.S.mapSeals += n || 1;
    save();
    City.refreshLabels(SU.S);
    updateTop();
    A().sfx("medal");
    toast("🗺️", (why ? why + " · " : "") + "+" + (n || 1) + " Map Seal", "good");
  }

  /* ---------- fares and care ---------- */
  function onFare(car, p) {
    const S = SU.S;
    S.faresDelivered++;
    A().sfx("chime");
    if (S.faresDelivered % 10 === 0)
      addSeal(1, "Ten cross-town fares delivered");
    save();
    updateTop();
  }
  function onAuto(car, kind) {
    save();
    toast("🏠", "The neighbourhood depot took care of " + car.name + ". No rush at all.", "good");
  }
  function startCare(car) {
    if (!car || !car.need) return;
    const kind = car.need.kind;
    closeInspect();
    const ok = Swoop.start({
      district: car.district,
      kind,
      name: car.name,
      onDone: () => {
        City.clearNeed(car, true);
        careDone(car, kind);
      },
      onCancel: () => {
        toast("🌤️", "No rush. " + car.name + " is still waiting when you're ready.", "");
      },
    });
    if (!ok) toast("🌤️", "One thing at a time.", "");
  }
  function careDone(car, kind) {
    const S = SU.S,
      rider = City.riderFor(car),
      note = City.noteFor(kind);
    S.totalCared++;
    if (S.totalCared % 3 === 0) addSeal(1, "Three cars cared for by hand");
    const fresh = !S.thankYouNotes.some((n) => n.kind === kind);
    if (fresh)
      S.thankYouNotes.push({
        kind,
        text: note,
        rider: rider.name,
      });
    A().sfx("chime");
    toast(
      fresh ? "💌" : "✨",
      fresh
        ? "A thank-you note from " + rider.name + " is in the scrapbook. " + car.name + " is back to its best."
        : car.name + " is back to its best. " + rider.name + " says thanks again.",
      "good",
    );
    save();
    updateTop();
  }
  function autoCare(car) {
    if (!car || !car.need) return;
    City.clearNeed(car, false);
    City.float(car, "Off to the neighbourhood depot ✨");
    toast("🏠", car.name + " is off to the depot. It'll be looked after.", "good");
    A().sfx("chime");
    closeInspect();
    save();
  }
  function rideAlong(car) {
    if (!car) return;
    if (City.cam.ride === car.id) {
      City.clearFocus();
      SU.ride = null;
      toast("🗺️", "Back to the map.", "");
      A().sfx("back");
      closeInspect();
      return;
    }
    City.ride(car.id);
    SU.ride = car.id;
    toast("🚕", "Riding along with " + car.name + ". Press Esc to return to the map.", "");
    A().sfx("select");
    closeInspect();
  }

  /* ---------- postcards ---------- */
  Photo.onPostcard = function (card, url, framed, car) {
    const S = SU.S;
    const was = framed && S.postcards.some((p) => p.landmark === framed.name);
    S.postcards.push(card);
    let seal = false;
    if (card.landmark && !was) {
      addSeal(1, "A new landmark postcard: " + card.landmark);
      seal = true;
    }
    save();
    updateTop();
    toast(
      "📮",
      seal
        ? "Postcard added: " + card.title + " · +1 Map Seal"
        : card.waymo
          ? "Waymo spotted! Postcard added: " + card.title
          : "Postcard added: " + card.title,
      "good",
    );
  };

  /* ---------- scrapbook ---------- */
  async function openBook() {
    if (SU.bookOpen) return;
    SU.bookOpen = true;
    const book = $("#su-book"),
      box = $("#su-book-b");
    book.hidden = false;
    $("#su-book-close").textContent = Photo.active
      ? "Back to the viewfinder"
      : "Back to the city";
    box.innerHTML =
      '<div class="su-book-empty"><b>Developing the film…</b>One moment.</div>';
    const cards = SU.S.postcards.slice().reverse();
    let html = "";
    if (!cards.length) {
      html =
        '<div class="su-book-empty"><b>No postcards yet.</b>Press P (or the camera button) to open Photo Mode, frame a landmark, and snap your first Sunday postcard.</div>';
    } else {
      html = '<div class="su-book-grid">';
      for (const c of cards) {
        html +=
          '<div class="su-card" data-card="' +
          esc(c.id) +
          '">' +
          (c.waymo ? '<span class="su-stamp">Waymo Spotted!</span>' : "") +
          '<img alt="' +
          esc(c.title) +
          ' postcard" src="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'100\'%3E%3Crect width=\'160\' height=\'100\' fill=\'%23dce8f0\'/%3E%3C/svg%3E" />' +
          '<div class="su-card-t"><span>' +
          esc(c.title) +
          "</span><small>" +
          esc((Photo.FILTERS.find((f) => f.id === c.filter) || { name: "Natural" }).name) +
          "</small></div>" +
          '<div class="su-card-b"><button type="button" data-download="' +
          esc(c.id) +
          '">Download PNG</button></div>' +
          "</div>";
      }
      html += "</div>";
    }
    // thank-you notes
    const notes = SU.S.thankYouNotes;
    html +=
      '<div class="su-notes"><h3>Rider Thank-You Notes · ' +
      notes.length +
      " / 7</h3>";
    if (!notes.length)
      html +=
        '<p class="su-book-empty" style="padding:10px 0">Do a hands-on care and a rider will leave you a note.</p>';
    else {
      html += "<ul>";
      for (const n of notes)
        html +=
          "<li><b>" +
          esc(iconFor(n.kind)) +
          " " +
          esc(n.rider || "A rider") +
          "</b>" +
          esc(n.text) +
          " <small>· " +
          esc(n.kind) +
          "</small></li>";
      html += "</ul>";
    }
    html += "</div>";
    box.innerHTML = html;
    for (const c of cards)
      Album.getPhoto(c.id).then((url) => {
        if (!url) return;
        const img = box.querySelector('[data-card="' + c.id + '"] img');
        if (img) img.src = url;
      });
    A().sfx("open");
  }
  function closeBook() {
    if (!SU.bookOpen) return;
    SU.bookOpen = false;
    $("#su-book").hidden = true;
    blurBtn();
    A().sfx("back");
  }
  function iconFor(kind) {
    return (
      {
        dirty: "🫧",
        vacuum: "🧹",
        charge: "🔌",
        birds: "🐦",
        cone: "🚧",
        reboot: "🔁",
        doors: "🚪",
      }[kind] || "💌"
    );
  }
  function blurBtn() {
    const a = document.activeElement;
    if (a && a.tagName === "BUTTON" && a.blur) a.blur();
  }
  $("#su-book-b") &&
    $("#su-book-b").addEventListener("click", (e) => {
      const b = e.target.closest("[data-download]");
      if (!b) return;
      const card = SU.S.postcards.find((p) => p.id === b.dataset.download);
      if (!card) return;
      Album.getPhoto(card.id).then((url) => {
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = "sunday-drive-" + card.id + ".png";
        a.click();
      });
      A().sfx("click");
    });

  /* ---------- modal ---------- */
  function modal(title, sub, html, buttons) {
    const m = $("#su-modal");
    $(".panel-h small", m).textContent = sub || "";
    $(".panel-h span", m).textContent = title || "";
    $(".panel-b", m).innerHTML = html;
    $(".panel-f", m).innerHTML = (buttons || [])
      .map(
        (b) =>
          '<button type="button" class="btn ' +
          (b.cls || "") +
          '" data-a="' +
          esc(b.a) +
          '">' +
          esc(b.label) +
          "</button>",
      )
      .join("");
    m.hidden = false;
    SU.modalOpen = true;
    A().sfx("open");
    const first = $(".panel-f .btn.primary", m) || $(".panel-f .btn", m);
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 40);
  }
  function closeModal() {
    if (!SU.modalOpen) return false;
    $("#su-modal").hidden = true;
    SU.modalOpen = false;
    blurBtn();
    A().sfx("back");
    return true;
  }
  function menu() {
    if (SU.modalOpen) return;
    const S = SU.S;
    let rows = "";
    for (const id of City.order) {
      const d = City.districts[id],
        open = S.unlockedDistricts.includes(id),
        can = canUnlock(id),
        prev = prevDistrict(id);
      rows +=
        '<div class="su-unlock-row"><span>' +
        (open ? "☀️" : can ? "🌤️" : "☁️") +
        " <b>" +
        esc(d.name) +
        "</b> · " +
        esc(open ? d.quirkShort : d.cost + " Map Seals") +
        "</span>" +
        (open
          ? '<button type="button" class="btn tiny" data-a="focus" data-id="' +
            esc(id) +
            '">Visit</button>'
          : '<button type="button" class="btn tiny ' +
            (can ? "warm" : "") +
            '" data-a="unlock" data-id="' +
            esc(id) +
            '"' +
            (can ? "" : " disabled") +
            ">" +
            (can ? "Unlock" : prev ? "After " + esc(prev.short) : "Locked") +
            "</button>") +
        "</div>";
    }
    modal(
      "Sunday Drive",
      "A lazy afternoon in San Francisco",
      '<p class="lead">The robotaxis are out on their own, the bossa nova is playing, and every neighbourhood is a postcard waiting to happen.</p>' +
        '<div class="su-set">' +
        '<button type="button" class="tgl" data-a="free" aria-checked="' +
        (S.freeDrive ? "true" : "false") +
        '"><span>Free Drive<small>No needs and no little jobs: just the city and the open road.</small></span><i></i></button>' +
        "</div>" +
        "<h3 style=\"margin:6px 0 8px;font:900 17px/1.2 var(--font)\">Neighbourhoods</h3>" +
        '<div class="su-set">' +
        rows +
        "</div>" +
        '<ul class="su-keys">' +
        "<li><b>Drag</b> pan · <b>wheel / pinch</b> zoom · <b>right-drag or Q / E</b> turn · <b>double-click</b> focus</li>" +
        "<li><b>P</b> Photo Mode · <b>M / Esc</b> this menu · <b>F</b> Free Drive</li>" +
        "</ul>",
      [
        { a: "resume", label: "Back to the city", cls: "primary" },
        { a: "photo", label: "📷 Photo Mode" },
        { a: "book", label: "📮 Scrapbook" },
        { a: "title", label: "Title Screen" },
      ],
    );
  }

  /* ---------- actions ---------- */
  const H = {
    close: () => closeInspect(),
    care: () => {
      const car = SU.inspect && carById(SU.inspect);
      if (car) startCare(car);
    },
    auto: () => {
      const car = SU.inspect && carById(SU.inspect);
      if (car) autoCare(car);
    },
    ride: () => {
      const car = SU.inspect && carById(SU.inspect);
      if (car) rideAlong(car);
    },
    unlock: (b) => unlockDistrict(b.dataset.id),
    focus: (b) => {
      closeModal();
      focusDistrict(b.dataset.id);
    },
    resume: () => closeModal(),
    photo: () => {
      closeModal();
      enterPhoto();
    },
    book: () => {
      closeModal();
      openBook();
    },
    free: () => {
      const S = SU.S;
      S.freeDrive = !S.freeDrive;
      City.freeDrive = S.freeDrive;
      if (S.freeDrive)
        for (const c of City.cars)
          if (c.need) {
            City.clearNeed(c, false);
            City.float(c, "Off to the depot ✨");
          }
      save();
      A().sfx("select");
      const b = $('#su-modal [data-a="free"]');
      if (b) b.setAttribute("aria-checked", String(S.freeDrive));
      toast(
        "☀️",
        S.freeDrive
          ? "Free Drive on. No needs, no little jobs: just the city."
          : "Free Drive off. The robotaxis will start asking for a hand again.",
        "",
      );
    },
    title: () => {
      closeModal();
      SU.exit();
    },
  };
  function onAction(e) {
    const b = e.target.closest && e.target.closest("[data-a]");
    if (!b || b.disabled) return;
    const f = H[b.dataset.a];
    if (f) {
      e.preventDefault();
      A().init();
      f(b);
      if (b.blur) b.blur();
    }
  }

  /* ---------- photo ---------- */
  function enterPhoto() {
    if (WG.game.G.state !== "sunday") return;
    closeModal();
    closeBook();
    closeInspect();
    Photo.enter();
  }

  /* ---------- enter and exit ---------- */
  SU.enter = function () {
    if (SU.active) return;
    const G = WG.game;
    SU.S = load();
    Photo.setSave(SU.S);
    SU.active = true;
    SU.t = 0;
    SU.saveT = 0;
    SU.uiT = 0;
    SU.inspect = null;
    SU.inspectKey = "";
    SU.coachStep = 0;
    SU.ride = null;
    if (!SU.booted) {
      City.init(G.scene);
      Clouds.init(G.scene);
      Photo.buildFilters();
      bind();
      SU.booted = true;
    }
    City.freeDrive = SU.S.freeDrive;
    Swoop.active = null;
    G.setState("sunday");
    $("#sunday").hidden = false;
    $("#su-photo").hidden = true;
    $("#su-modal").hidden = true;
    $("#su-book").hidden = true;
    SU.modalOpen = SU.bookOpen = false;
    City.show(true);
    Clouds.show(true);
    City.setUnlocked(unlockedSet());
    City.sync(SU.S);
    City.refreshLabels(SU.S);
    Clouds.sync(SU.S);
    City.cam.x = 420 * K;
    City.cam.z = -620 * K;
    City.cam.h = 720 * K;
    City.cam.yaw = 0.6;
    City.cam.follow = null;
    City.cam.ride = null;
    City.cam.ceremony = null;
    City.clearFocus();
    W.setLook("morning");
    G.mii.root.visible = false;
    for (const c of WG.Traffic.cars) c.parts.root.visible = false;
    A().music("title");
    A().setSundayStems(unlockedSet());
    closeInspect();
    updateTop();
    coach();
    G.snap();
    save();
  };

  SU.exit = function () {
    if (!SU.active) return;
    const G = WG.game;
    if (Swoop.active) Swoop.abort();
    if (Photo.active) Photo.exit();
    save();
    closeModal();
    closeBook();
    closeInspect();
    City.clearFocus();
    City.cam.ceremony = null;
    City.show(false);
    Clouds.show(false);
    $("#sunday").hidden = true;
    $("#su-photo").hidden = true;
    $("#su-modal").hidden = true;
    $("#su-book").hidden = true;
    G.mii.root.visible = true;
    WG.Traffic.n = W.fleet;
    WG.Traffic.reset();
    for (const c of WG.Traffic.cars) c.parts.root.visible = true;
    G.P.pos.set(W.start.x, 0, W.start.z);
    G.P.pos.y = W.groundY(W.start.x, W.start.z);
    G.P.path = [];
    G.CAM.yaw = W.start.yaw;
    G.snap();
    A().setSundayStems(null);
    A().duck(false);
    A().music("title");
    SU.active = false;
    SU.ride = null;
    G.VOX.clear();
    G.toTitle();
  };

  SU.isActive = () => SU.active;

  /* ---------- each frame ---------- */
  SU.update = function (dt) {
    if (!SU.active) return;
    const G = WG.game;
    SU.t += dt;
    if (G.G.state === "sunday") City.update(dt, SU.S);
    Clouds.update(dt, SU.t);
    Swoop.update(dt);
    SU.saveT += dt;
    SU.uiT += dt;
    if (SU.saveT > 10) {
      SU.saveT = 0;
      save();
    }
    if (SU.uiT > 0.35) {
      SU.uiT = 0;
      updateTop();
      if (SU.inspect) renderInspect(false);
      coach();
      if (SU.ride && !City.cars.some((c) => c.id === SU.ride)) {
        SU.ride = null;
        City.clearFocus();
      }
      if (City.cam.ride !== SU.ride && !City.cam.ride) SU.ride = null;
    }
  };

  /* ---------- camera ---------- */
  SU.camera = function (dt, pos, look) {
    const G = WG.game;
    if (Photo.active) return Photo.camera(dt, pos, look);
    if (Swoop.active) return Swoop.camera(dt, pos, look);
    if (G.G.state === "sunday") {
      const typing =
          document.activeElement &&
          /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName),
        onBtn =
          document.activeElement &&
          document.activeElement.closest &&
          document.activeElement.closest("button");
      if (
        !typing &&
        !onBtn &&
        !SU.modalOpen &&
        !SU.bookOpen &&
        !City.cam.ceremony &&
        !City.cam.ride
      ) {
        const K2 = G.keys;
        let dx = 0,
          dy = 0;
        if (K2.has("KeyW") || K2.has("ArrowUp")) dy += 1;
        if (K2.has("KeyS") || K2.has("ArrowDown")) dy -= 1;
        if (K2.has("KeyA") || K2.has("ArrowLeft")) dx += 1;
        if (K2.has("KeyD") || K2.has("ArrowRight")) dx -= 1;
        if (dx || dy) City.pan(dx * 760 * dt, dy * 760 * dt, G.camera);
        const r = (K2.has("KeyQ") ? 1 : 0) - (K2.has("KeyE") ? 1 : 0);
        if (r) City.rotate(r * 1.5 * dt);
        if (K2.has("Equal") || K2.has("NumpadAdd")) City.zoom(1 - dt);
        if (K2.has("Minus") || K2.has("NumpadSubtract")) City.zoom(1 + dt);
      }
      return City.camera(dt, pos, look);
    }
    return 4;
  };

  /* ---------- pointer ---------- */
  SU.pointer = function (type, e) {
    if (Photo.active) return Photo.pointer(type, e);
    if (Swoop.active || SU.modalOpen || SU.bookOpen) return;
    if (WG.game.G.state !== "sunday") return;
    const cam = WG.game.camera;
    if (type === "wheel") {
      City.zoom(e.deltaY > 0 ? 1.1 : 0.9);
      return;
    }
    if (type === "down") {
      if (City.cam.ceremony) return;
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
      if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = {
          d: Math.hypot(a[0] - b[0], a[1] - b[1]),
          a: Math.atan2(b[1] - a[1], b[0] - a[0]),
        };
        drag = null;
      } else
        drag = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          sx: e.clientX,
          sy: e.clientY,
          t: performance.now(),
          turn: e.button === 2 || e.button === 1,
          moved: false,
        };
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
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6)
        drag.moved = true;
      if (drag.moved) {
        if (drag.turn) City.rotate(-dx * 0.006);
        else City.pan(dx, dy, cam);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      return;
    }
    // up
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.moved && !drag.turn && e.type === "pointerup") {
      const hit = City.pick(e.clientX, e.clientY, cam);
      const now = performance.now(),
        dbl =
          now - SU.lastTap < 330 &&
          Math.hypot(e.clientX - SU.lastTapX, e.clientY - SU.lastTapY) < 32;
      SU.lastTap = now;
      SU.lastTapX = e.clientX;
      SU.lastTapY = e.clientY;
      if (hit && hit.car) {
        const car = carById(hit.car);
        if (car) {
          showInspect(car);
          if (dbl) City.focusCar(car.id);
        }
      } else if (hit && hit.hood) {
        if (dbl) focusDistrict(hit.hood);
        else showDistrict(hit.hood);
      } else {
        if (dbl) {
          const g = WG.game.pickGround(e.clientX, e.clientY);
          if (g) City.focusAt(g.x, g.z);
        }
        closeInspect();
      }
    }
    drag = null;
  };

  /* ---------- keys ---------- */
  SU.key = function (e) {
    // a scrapbook opened over the viewfinder still closes first
    if (SU.bookOpen) {
      if (e.code === "Escape") closeBook();
      return true;
    }
    if (Photo.active) return Photo.key(e);
    const typing =
        document.activeElement &&
        /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName),
      onBtn =
        document.activeElement &&
        document.activeElement.closest &&
        document.activeElement.closest("button");
    if (e.code === "Escape") {
      if (typing) document.activeElement.blur();
      if (SU.bookOpen) {
        closeBook();
        return true;
      }
      if (SU.modalOpen) {
        closeModal();
        return true;
      }
      if (City.cam.ride) {
        City.clearFocus();
        SU.ride = null;
        toast("🗺️", "Back to the map.", "");
        return true;
      }
      if (Swoop.active) {
        Swoop.abort();
        return true;
      }
      if (!e.repeat) menu();
      return true;
    }
    if (e.repeat && !/^(Arrow|Key[WASDQE])/.test(e.code)) return true;
    if (typing) return false;
    if (e.code === "KeyP") {
      if (!SU.modalOpen && !SU.bookOpen) enterPhoto();
      return true;
    }
    if (e.code === "KeyM") {
      if (SU.bookOpen) return true;
      if (SU.modalOpen) closeModal();
      else menu();
      return true;
    }
    if (e.code === "KeyF") {
      if (!SU.modalOpen && !SU.bookOpen) H.free();
      return true;
    }
    if (onBtn) return false;
    return false;
  };

  /* ---------- after the render: labels and tags ---------- */
  SU.after = function () {
    if (!SU.active) return;
    if (Photo.active) Photo.after();
    else if (WG.game.G.state === "sunday") City.place(WG.game.camera);
  };

  /* ---------- set up the DOM ---------- */
  function bind() {
    $("#su-menu-btn").addEventListener("click", () => {
      A().init();
      menu();
    });
    $("#su-photo-btn").addEventListener("click", () => {
      A().init();
      enterPhoto();
    });
    $("#su-book-btn").addEventListener("click", () => {
      A().init();
      openBook();
    });
    $("#su-coach button").addEventListener("click", () => {
      SU.coachStep++;
      A().sfx("click");
      coach();
      blurBtn();
    });
    $("#su-inspect").addEventListener("click", onAction);
    $("#su-modal").addEventListener("click", (e) => {
      if (e.target === $("#su-modal")) closeModal();
      else onAction(e);
    });
    $("#su-book-close").addEventListener("click", closeBook);
    $("#su-book").addEventListener("click", (e) => {
      if (e.target === $("#su-book")) closeBook();
    });
    $("#su-photo-close").addEventListener("click", () => Photo.exit());
    $("#su-shutter").addEventListener("click", () => Photo.snap());
    $("#su-photo-album").addEventListener("click", () => openBook());
    $("#su-focal").addEventListener("input", (e) => Photo.setFocal(e.target.value));
    // double-click / double-tap a car or a neighbourhood to focus it
    const cv = WG.game.renderer.domElement;
    cv.addEventListener("dblclick", (e) => {
      if (!SU.active || WG.game.G.state !== "sunday" || Photo.active) return;
      const hit = City.pick(e.clientX, e.clientY, WG.game.camera);
      if (hit && hit.car) City.focusCar(hit.car);
      else if (hit && hit.hood) focusDistrict(hit.hood);
      else {
        const g = WG.game.pickGround(e.clientX, e.clientY);
        if (g) City.focusAt(g.x, g.z);
      }
    });
    City.onCarTap = (id) => {
      const car = carById(id);
      if (car) showInspect(car);
    };
    City.onDistrictTap = (id) => showDistrict(id);
    City.onNeed = () => {};
    City.onFare = onFare;
    City.onAuto = onAuto;
  }

  WG.sunday = SU;
})();
